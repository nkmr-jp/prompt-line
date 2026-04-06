/**
 * Quick incremental install script for development.
 *
 * Reuses the existing .app bundle (Electron framework, pruned node_modules)
 * and only updates source code (asar) + native tools, then re-signs.
 *
 * Requires a prior full build via `pnpm run install-app`.
 * Typical time: ~15-20s vs ~250s for full install.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CERT_NAME = 'Prompt Line';
const APP_NAME = 'Prompt Line';
const arch = process.arch; // 'arm64' or 'x64'
const outDir = arch === 'arm64' ? 'dist/mac-arm64' : 'dist/mac';
const appPath = path.join(outDir, `${APP_NAME}.app`);
const asarPath = path.join(appPath, 'Contents', 'Resources', 'app.asar');
const unpackedPath = path.join(appPath, 'Contents', 'Resources', 'app.asar.unpacked');
const installPath = `/Applications/${APP_NAME}.app`;
const entitlementsPath = path.join(__dirname, '..', 'build', 'entitlements.mac.plist');

// --- Preflight checks ---

if (!fs.existsSync(asarPath)) {
  console.error(`❌ No previous build found at ${asarPath}`);
  console.error(`   Run 'pnpm run install-app' first to create the initial full build.`);
  process.exit(1);
}

if (!fs.existsSync(entitlementsPath)) {
  console.error(`❌ Entitlements file not found: ${entitlementsPath}`);
  process.exit(1);
}

// --- Helper functions ---

function getSigningIdentity() {
  const envIdentity = process.env.CODE_SIGN_IDENTITY;
  if (envIdentity) return envIdentity;
  try {
    const result = execSync('security find-identity -v -p codesigning', { encoding: 'utf8' });
    if (result.includes(`"${CERT_NAME}"`)) return CERT_NAME;
  } catch { /* fall through */ }
  return '-';
}

function getAppVersion(bundlePath) {
  try {
    const absPath = path.resolve(bundlePath);
    return execSync(`defaults read "${absPath}/Contents/Info" CFBundleShortVersionString`, { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function formatVersion(version) {
  if (!version) return 'unknown';
  try {
    const gitInfo = require('../src/generated/git-info.json');
    if (!gitInfo.hash) return version;
    const isMain = gitInfo.branch === 'main' || gitInfo.branch === 'master';
    if (isMain) return version;
    return `${version} (${gitInfo.branch} ${gitInfo.hash})`;
  } catch {
    return version;
  }
}

// --- Main ---

const startTime = Date.now();

console.log('⚡ Quick install: updating source code in existing app bundle...\n');

// 1. Extract existing asar to temp directory (preserves electron-builder's pruned node_modules)
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pl-quick-'));
console.log('📦 Extracting existing asar...');
execSync(`npx asar extract "${asarPath}" "${tmpDir}"`, { stdio: 'inherit' });

// 2. Update dist/ (source code) — remove old, copy new
const tmpDist = path.join(tmpDir, 'dist');
if (fs.existsSync(tmpDist)) {
  fs.rmSync(tmpDist, { recursive: true });
}
// Copy only the source dist directories (exclude mac build outputs)
const distDirs = fs.readdirSync('dist').filter(entry => {
  return !entry.startsWith('mac') && !entry.endsWith('.dmg') && !entry.endsWith('.zip')
    && !entry.endsWith('.blockmap') && !entry.startsWith('builder-')
    && !entry.endsWith('.yml') && !entry.endsWith('.yaml');
});
fs.mkdirSync(tmpDist, { recursive: true });
for (const entry of distDirs) {
  const src = path.join('dist', entry);
  execSync(`cp -R "${src}" "${tmpDist}/"`);
}

// 3. Update assets/
const tmpAssets = path.join(tmpDir, 'assets');
if (fs.existsSync(tmpAssets)) {
  fs.rmSync(tmpAssets, { recursive: true });
}
execSync(`cp -R assets "${tmpDir}/"`);

// 4. Update package.json
fs.copyFileSync('package.json', path.join(tmpDir, 'package.json'));

// 5. Re-pack asar (exclude native-tools from asar, put in unpacked)
console.log('📦 Packing new asar...');
execSync(`npx asar pack "${tmpDir}" "${asarPath}" --unpack-dir "dist/native-tools"`, { stdio: 'inherit' });

// 6. Update native tools in unpacked directory
const nativeToolsSrc = 'dist/native-tools';
const nativeToolsDst = path.join(unpackedPath, 'dist', 'native-tools');
if (fs.existsSync(nativeToolsSrc)) {
  if (fs.existsSync(nativeToolsDst)) {
    fs.rmSync(nativeToolsDst, { recursive: true });
  }
  fs.mkdirSync(nativeToolsDst, { recursive: true });
  execSync(`cp -R "${nativeToolsSrc}/"* "${nativeToolsDst}/"`);
}

// 7. Re-sign native binaries + app bundle
console.log('🔏 Signing...');
const identity = getSigningIdentity();

if (fs.existsSync(nativeToolsDst)) {
  const binaries = fs.readdirSync(nativeToolsDst).filter(f =>
    !f.endsWith('.js') && !f.endsWith('.json') && !f.startsWith('.')
  );
  for (const binary of binaries) {
    const binaryPath = path.join(nativeToolsDst, binary);
    try {
      execSync(`codesign --force --sign "${identity}" "${binaryPath}"`, { stdio: 'pipe' });
    } catch (e) {
      console.warn(`⚠️ Failed to sign ${binary}: ${e.message}`);
    }
  }
}

execSync(`codesign --force --deep --sign "${identity}" --entitlements "${entitlementsPath}" "${appPath}"`, { stdio: 'inherit' });
execSync(`codesign --verify --verbose "${appPath}"`, { stdio: 'inherit' });

// 8. Quit running app if needed
let wasRunning = false;
try {
  execSync(`pgrep -f "${APP_NAME}"`, { stdio: 'ignore' });
  wasRunning = true;
} catch { /* not running */ }

if (wasRunning) {
  try {
    execSync(`osascript -e 'quit app "${APP_NAME}"'`, { stdio: 'inherit' });
    const maxWait = 10000;
    const interval = 200;
    let waited = 0;
    while (waited < maxWait) {
      try {
        execSync(`pgrep -f "${APP_NAME}"`, { stdio: 'ignore' });
      } catch {
        break;
      }
      execSync('sleep 0.2');
      waited += interval;
    }
    if (waited < maxWait) {
      console.log(`🔄 Quit ${APP_NAME}`);
    }
  } catch { /* proceed */ }
}

// 9. Install to /Applications
const oldVersion = getAppVersion(installPath);
const newVersion = getAppVersion(appPath);

console.log(`\n📦 Installing to ${installPath}...`);
if (oldVersion) {
  console.log(`   ${oldVersion} → ${formatVersion(newVersion)}`);
} else {
  console.log(`   New install: ${formatVersion(newVersion)}`);
}

execSync(`rsync -a --delete "${appPath}/" "${installPath}/"`, { stdio: 'inherit' });
console.log('✅ Installed successfully');

// 10. Relaunch if was running
if (wasRunning) {
  console.log(`🚀 Launching ${APP_NAME}...`);
  try {
    execSync(`open "${installPath}"`);
    console.log(`✅ ${APP_NAME} is running`);
  } catch {
    console.warn(`⚠️ Failed to launch ${APP_NAME} automatically`);
  }
} else {
  console.log(`ℹ️  ${APP_NAME} was not running; skipping launch`);
}

// Cleanup
fs.rmSync(tmpDir, { recursive: true, force: true });

const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
console.log(`\n⏱️  Quick install completed in ${elapsed}s`);
