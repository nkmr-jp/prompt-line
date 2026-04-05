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
      execSync(`pgrep -x "${appName}"`, { stdio: 'ignore' });
    } catch {
      break; // pgrep exits non-zero when no process found
    }
    execSync(`sleep 0.2`);
    waited += interval;
  }
  if (waited >= maxWait) {
    console.warn(`⚠️  ${appName} did not exit within ${maxWait / 1000}s, proceeding anyway`);
  }
  console.log(`🛑 Quit ${appName}`);
} catch {
  // App may not be running — ignore
}

console.log(`\n📦 Installing to ${installPath}...`);
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
