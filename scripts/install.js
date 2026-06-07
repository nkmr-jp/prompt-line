const { execSync } = require('child_process');
const path = require('path');

const arch = process.arch; // 'arm64' or 'x64'
const appName = 'Prompt Line';
const outDir = arch === 'arm64' ? 'dist/mac-arm64' : 'dist/mac';
const appPath = path.join(outDir, `${appName}.app`);
const installPath = `/Applications/${appName}.app`;

console.log(`Building for ${arch} architecture (skip DMG)...`);

// Skip electron-builder's built-in signing (takes ~3-4 min for Electron framework).
// afterSign.js handles all signing via codesign --deep (~1s).
execSync(`electron-builder --mac --${arch} --dir --publish=never -c.mac.identity=null`, {
  stdio: 'inherit',
});

// Check if the app is currently running and quit it before installing
let wasRunning = false;
try {
  execSync(`pgrep -f "${appName}"`, { stdio: 'ignore' });
  wasRunning = true;
} catch {
  // App is not running
}

if (wasRunning) {
  try {
    execSync(`osascript -e 'quit app "${appName}"'`, { stdio: 'inherit' });
    // Poll until the process has fully exited (timeout after 10s)
    const maxWait = 10000;
    const interval = 200;
    let waited = 0;
    while (waited < maxWait) {
      try {
        execSync(`pgrep -f "${appName}"`, { stdio: 'ignore' });
      } catch {
        break; // pgrep exits non-zero when no process found
      }
      execSync(`sleep ${interval / 1000}`, { stdio: 'ignore' });
      waited += interval;
    }
    if (waited >= maxWait) {
      console.warn(`⚠️  ${appName} did not exit within ${maxWait / 1000}s, proceeding anyway`);
    } else {
      console.log(`🔄 Quit ${appName}`);
    }
  } catch {
    // quit command failed — proceed anyway
  }
}

// Read versions from Info.plist before and after install
function getAppVersion(bundlePath) {
  try {
    const absPath = path.resolve(bundlePath);
    return execSync(`defaults read "${absPath}/Contents/Info" CFBundleShortVersionString`, { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

// Append git hash on non-main branches for dev builds
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

const oldVersion = getAppVersion(installPath);
const newVersion = getAppVersion(appPath);

console.log(`\n📦 Installing to ${installPath}...`);
if (oldVersion) {
  console.log(`   ${oldVersion} → ${formatVersion(newVersion)}`);
} else {
  console.log(`   New install: ${formatVersion(newVersion)}`);
}
execSync(`rsync -a --delete "${appPath}/" "${installPath}/"`);
console.log(`✅ Installed successfully`);

// Relaunch the app only if it was previously running
if (wasRunning) {
  console.log(`🚀 Launching ${appName}...`);
  try {
    execSync(`open "${installPath}"`);
    console.log(`✅ ${appName} is running`);
  } catch {
    console.warn(`⚠️  Failed to launch ${appName} automatically; installation completed successfully`);
  }
} else {
  console.log(`ℹ️  ${appName} was not running; skipping launch`);
}

console.log(`\n📌 To install plugins:`);
console.log(`   pnpm add -g .`);
console.log(`   prompt-line-plugin install github.com/nkmr-jp/prompt-line-plugins`);
console.log(`   See: docs/en/plugins.md`);
