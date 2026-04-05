const { execSync } = require('child_process');
const path = require('path');

const arch = process.arch; // 'arm64' or 'x64'
const appName = 'Prompt Line';
const outDir = arch === 'arm64' ? 'dist/mac-arm64' : 'dist/mac';
const appPath = path.join(outDir, `${appName}.app`);
const installPath = `/Applications/${appName}.app`;

console.log(`Building for ${arch} architecture (skip DMG)...`);

execSync(`electron-builder --mac --${arch} --dir --publish=never`, {
  stdio: 'inherit',
});

// Quit the running app before installing
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
    execSync(`sleep 0.2`);
    waited += interval;
  }
  if (waited >= maxWait) {
    console.warn(`⚠️  ${appName} did not exit within ${maxWait / 1000}s, proceeding anyway`);
  } else {
    console.log(`🔄 Quit ${appName}`);
  }
} catch {
  // App may not be running — ignore
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
execSync(`rm -rf "${installPath}" && cp -R "${appPath}" "${installPath}"`);
console.log(`✅ Installed successfully`);

// Relaunch the app
console.log(`🚀 Launching ${appName}...`);
try {
  execSync(`open "${installPath}"`);
  console.log(`✅ ${appName} is running`);
} catch {
  console.warn(`⚠️  Failed to launch ${appName} automatically; installation completed successfully`);
}
