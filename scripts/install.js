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
  // Wait briefly for the process to fully exit
  execSync('sleep 1');
  console.log(`🛑 Quit ${appName}`);
} catch {
  // App may not be running — ignore
}

console.log(`\n📦 Installing to ${installPath}...`);
execSync(`rm -rf "${installPath}" && cp -R "${appPath}" "${installPath}"`);
console.log(`✅ Installed successfully`);

// Relaunch the app
console.log(`🚀 Launching ${appName}...`);
execSync(`open "${installPath}"`);
console.log(`✅ ${appName} is running`);
