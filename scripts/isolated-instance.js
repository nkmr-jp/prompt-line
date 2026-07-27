#!/usr/bin/env node
/**
 * Run this checkout of Prompt Line as an isolated, headless instance.
 *
 * Every git worktree gets its own instance: its own data directory
 * (`PROMPT_LINE_DATA_DIR`), its own Electron userData directory (so it does not
 * collide with the single-instance lock of the app the user keeps running), and
 * its own CDP port. The instance registers no global shortcut and no tray icon,
 * and never shows a window or takes focus (`PROMPT_LINE_ISOLATED=1`) — the UI is
 * driven and screenshotted over CDP instead.
 *
 * Usage: pnpm run isolated <command>
 *   start [--rebuild] [--no-seed]  Launch the instance in the background
 *   stop                           Quit the instance
 *   status                         Print instance id, port, pid, data directory
 *   show                           Run the show flow (renderer gets history/draft/settings)
 *   type <text>                    Type text into the input, as a user would
 *   clear                          Empty the input
 *   eval <js>                      Evaluate JavaScript in the renderer, print the result
 *   screenshot [file]              Capture the (offscreen) window to a PNG
 *   logs [-n <lines>]              Tail the instance's app.log
 *   clean                          Stop the instance and delete its data directory
 */

const { spawn, spawnSync, execFileSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const ROOT_DIR = path.join(os.homedir(), '.prompt-line-isolated');
const PORT_RANGE_START = 9300;
const PORT_RANGE_SIZE = 100;
const START_TIMEOUT_MS = 30000;
const STOP_TIMEOUT_MS = 10000;
/** Copied into a fresh data directory so verification sees a realistic setup. */
const SEED_ENTRIES = ['settings.yaml', 'plugins', 'custom-search'];
/** An id becomes a directory name that `clean` deletes — keep it a plain segment. */
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function instanceId() {
  const override = process.env.PROMPT_LINE_INSTANCE_ID;
  if (!override) return path.basename(REPO_ROOT);
  if (!ID_PATTERN.test(override)) {
    throw new Error(`Invalid PROMPT_LINE_INSTANCE_ID: ${override} (allowed: letters, digits, . _ -)`);
  }
  return override;
}

function paths() {
  const id = instanceId();
  const home = path.join(ROOT_DIR, id);
  return {
    id,
    home,
    dataDir: path.join(home, 'data'),
    electronDir: path.join(home, 'electron'),
    stateFile: path.join(home, 'instance.json'),
    stdoutLog: path.join(home, 'stdout.log')
  };
}

/**
 * State of the instance for this checkout. Two worktrees whose directories
 * happen to share a name would otherwise resolve to the same data directory
 * and CDP port — refuse rather than drive (or report on) the other one.
 */
function readState() {
  const { stateFile } = paths();
  let state;
  try {
    state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  } catch {
    return null;
  }
  if (state.repoRoot && state.repoRoot !== REPO_ROOT) {
    throw new Error(
      `Instance "${state.id}" belongs to ${state.repoRoot}.\n` +
      'Set PROMPT_LINE_INSTANCE_ID to a distinct id for this checkout.'
    );
  }
  return state;
}

function waitForExit(pid) {
  const deadline = Date.now() + STOP_TIMEOUT_MS;
  return (async () => {
    while (Date.now() < deadline) {
      if (!isAlive(pid)) return true;
      await new Promise(r => setTimeout(r, 100));
    }
    return false;
  })();
}

function isAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function isPortFree(port) {
  return new Promise(resolve => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => server.close(() => resolve(true)));
    server.listen(port, '127.0.0.1');
  });
}

/**
 * Deterministic per-instance port so the same worktree keeps the same port
 * across restarts; scans upward when another instance already took it.
 */
async function pickPort(id) {
  const digest = crypto.createHash('sha1').update(id).digest();
  const base = PORT_RANGE_START + (digest.readUInt16BE(0) % PORT_RANGE_SIZE);
  for (let i = 0; i < PORT_RANGE_SIZE; i++) {
    const port = PORT_RANGE_START + ((base - PORT_RANGE_START + i) % PORT_RANGE_SIZE);
    if (await isPortFree(port)) return port;
  }
  throw new Error(`No free port in ${PORT_RANGE_START}-${PORT_RANGE_START + PORT_RANGE_SIZE - 1}`);
}

function electronBin() {
  const bin = path.join(REPO_ROOT, 'node_modules', '.bin', 'electron');
  if (!fs.existsSync(bin)) {
    throw new Error('electron not found — run `pnpm install` first');
  }
  return bin;
}

function instanceEnv(dataDir) {
  return {
    ...process.env,
    PROMPT_LINE_DATA_DIR: dataDir,
    PROMPT_LINE_ISOLATED: '1',
    LOG_LEVEL: process.env.LOG_LEVEL || 'debug'
  };
}

function seedDataDir(dataDir) {
  const source = path.join(os.homedir(), '.prompt-line');
  for (const entry of SEED_ENTRIES) {
    const from = path.join(source, entry);
    const to = path.join(dataDir, entry);
    if (!fs.existsSync(from) || fs.existsSync(to)) continue;
    // Copy — never symlink: the instance must not write back into ~/.prompt-line.
    fs.cpSync(from, to, { recursive: true, dereference: true });
  }
}

async function cdpTargets(port) {
  const res = await fetch(`http://127.0.0.1:${port}/json/list`);
  return res.json();
}

async function waitForCdp(port, pid) {
  const deadline = Date.now() + START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (!isAlive(pid)) throw new Error('instance exited during startup — see stdout.log');
    try {
      const targets = await cdpTargets(port);
      if (targets.some(t => t.type === 'page')) return;
    } catch {
      // not listening yet
    }
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error(`CDP did not come up on port ${port} within ${START_TIMEOUT_MS}ms`);
}

/** Minimal CDP client over the page target — no dependencies, no browser needed. */
async function withPage(port, fn) {
  if (typeof WebSocket === 'undefined') {
    // Global WebSocket is only enabled by default from Node 22 on.
    throw new Error(`CDP commands need Node 22 or newer (running ${process.version})`);
  }

  const targets = await cdpTargets(port);
  const page = targets.find(t => t.type === 'page');
  if (!page) throw new Error('no page target — is the instance running?');

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = () => reject(new Error('failed to connect to CDP'));
  });

  let nextId = 1;
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = nextId++;
    const timer = setTimeout(() => reject(new Error(`${method} timed out`)), 15000);
    const onMessage = event => {
      const msg = JSON.parse(event.data);
      if (msg.id !== id) return;
      clearTimeout(timer);
      ws.removeEventListener('message', onMessage);
      if (msg.error) reject(new Error(`${method}: ${JSON.stringify(msg.error)}`));
      else resolve(msg.result);
    };
    ws.addEventListener('message', onMessage);
    ws.send(JSON.stringify({ id, method, params }));
  });

  try {
    return await fn(send);
  } finally {
    ws.close();
  }
}

async function evaluate(port, expression) {
  return withPage(port, async send => {
    const result = await send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description || 'evaluation failed');
    }
    return result.result.value;
  });
}

function requireRunning() {
  const state = readState();
  if (!state || !isAlive(state.pid)) {
    throw new Error('instance is not running — run `pnpm run isolated start` first');
  }
  return state;
}

async function start(args) {
  const { id, home, dataDir, electronDir, stateFile, stdoutLog } = paths();

  const existing = readState();
  if (existing && isAlive(existing.pid)) {
    console.log(`Already running: pid ${existing.pid}, CDP port ${existing.port}`);
    return;
  }

  if (args.includes('--rebuild') || !fs.existsSync(path.join(REPO_ROOT, 'dist', 'main.js'))) {
    console.log('Compiling...');
    const build = spawnSync('pnpm', ['run', 'compile'], { cwd: REPO_ROOT, stdio: 'inherit' });
    if (build.status !== 0) throw new Error('compile failed');
  }

  // 0700: the seeded copy carries the user's real settings and plugins.
  fs.mkdirSync(ROOT_DIR, { recursive: true, mode: 0o700 });
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(electronDir, { recursive: true });
  if (!args.includes('--no-seed')) seedDataDir(dataDir);

  const port = await pickPort(id);
  const out = fs.openSync(stdoutLog, 'a');
  const child = spawn(
    electronBin(),
    [REPO_ROOT, `--user-data-dir=${electronDir}`, `--remote-debugging-port=${port}`],
    { cwd: REPO_ROOT, env: instanceEnv(dataDir), detached: true, stdio: ['ignore', out, out] }
  );
  child.unref();
  fs.closeSync(out);

  const state ={ id, pid: child.pid, port, repoRoot: REPO_ROOT, dataDir, startedAt: new Date().toISOString() };
  fs.mkdirSync(home, { recursive: true });
  fs.writeFileSync(stateFile, `${JSON.stringify(state, null, 2)}\n`);

  await waitForCdp(port, child.pid);
  console.log(`Started ${id}: pid ${child.pid}, CDP port ${port}`);
  console.log(`  data:   ${dataDir}`);
  console.log(`  stdout: ${stdoutLog}`);
}

/** Stops and waits: `start` and `clean` must never race a dying instance. */
async function stop() {
  const { stateFile } = paths();
  const state = readState();
  if (!state || !isAlive(state.pid)) {
    fs.rmSync(stateFile, { force: true });
    console.log('Not running');
    return;
  }

  process.kill(state.pid, 'SIGTERM');
  if (!await waitForExit(state.pid)) {
    process.kill(state.pid, 'SIGKILL');
    await waitForExit(state.pid);
  }
  fs.rmSync(stateFile, { force: true });
  console.log(`Stopped pid ${state.pid}`);
}

function status() {
  const { id, dataDir, stdoutLog } = paths();
  const state = readState();
  const running = state ? isAlive(state.pid) : false;
  console.log(`instance: ${id}`);
  console.log(`running:  ${running}`);
  if (state) {
    console.log(`pid:      ${state.pid}`);
    console.log(`port:     ${state.port}`);
    console.log(`started:  ${state.startedAt}`);
  }
  console.log(`data:     ${dataDir}`);
  console.log(`stdout:   ${stdoutLog}`);
  if (!running) process.exitCode = 1;
}

/**
 * Trigger the real show flow. Launching a second process against the same
 * userData directory hits Electron's `second-instance` event, so the running
 * instance composes the same window data as the global shortcut would — while
 * staying headless because of PROMPT_LINE_ISOLATED.
 */
function show() {
  const { dataDir, electronDir } = paths();
  requireRunning();
  const result = spawnSync(electronBin(), [REPO_ROOT, `--user-data-dir=${electronDir}`], {
    cwd: REPO_ROOT,
    env: instanceEnv(dataDir),
    stdio: 'ignore'
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`show trigger exited with ${result.status ?? result.signal}`);
  }
}

async function typeText(port, text) {
  // Without a focused textarea Input.insertText succeeds but goes nowhere.
  const focused = await evaluate(port, `(() => {
    const el = document.querySelector('textarea');
    el?.focus();
    return !!el;
  })()`);
  if (!focused) {
    throw new Error('no input to type into — run `pnpm run isolated show` first');
  }
  await withPage(port, send => send('Input.insertText', { text }));
}

async function clearInput(port) {
  const cleared = await evaluate(port, `(() => {
    const el = document.querySelector('textarea');
    if (!el) return false;
    el.value = '';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  if (!cleared) {
    throw new Error('no input to clear — run `pnpm run isolated show` first');
  }
}

async function screenshot(port, file) {
  const target = path.resolve(file || path.join(os.tmpdir(), `prompt-line-${instanceId()}.png`));
  const data = await withPage(port, async send => {
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    return shot.data;
  });
  fs.writeFileSync(target, Buffer.from(data, 'base64'));
  console.log(target);
}

function logs(args) {
  const { dataDir } = paths();
  const index = args.indexOf('-n');
  const lines = index >= 0 ? args[index + 1] : '40';
  if (!/^\d+$/.test(lines || '')) {
    throw new Error(`-n needs a line count (got: ${lines ?? 'nothing'})`);
  }
  const logFile = path.join(dataDir, 'app.log');
  if (!fs.existsSync(logFile)) {
    console.log(`No log yet: ${logFile}`);
    return;
  }
  process.stdout.write(execFileSync('tail', ['-n', lines, logFile], { encoding: 'utf8' }));
}

async function clean() {
  const { home } = paths();
  await stop();
  fs.rmSync(home, { recursive: true, force: true });
  console.log(`Removed ${home}`);
}

async function main() {
  const [command = 'status', ...args] = process.argv.slice(2);

  switch (command) {
    case 'start':
      return start(args);
    case 'stop':
      return stop();
    case 'status':
      return status();
    case 'show':
      return show();
    case 'type':
      return typeText(requireRunning().port, args.join(' '));
    case 'clear':
      return clearInput(requireRunning().port);
    case 'eval': {
      const value = await evaluate(requireRunning().port, args.join(' '));
      console.log(typeof value === 'string' ? value : JSON.stringify(value, null, 2));
      return;
    }
    case 'screenshot':
      return screenshot(requireRunning().port, args[0]);
    case 'logs':
      return logs(args);
    case 'clean':
      return clean();
    default:
      console.error(`Unknown command: ${command}`);
      console.error('Usage: pnpm run isolated <start|stop|status|show|type|clear|eval|screenshot|logs|clean>');
      process.exitCode = 2;
  }
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
