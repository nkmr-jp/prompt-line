const { execSync } = require('child_process');

const arch = process.arch; // 'arm64' or 'x64'
console.log(`Building for ${arch} architecture...`);

execSync(`electron-builder --mac --${arch} --publish=never`, {
  stdio: 'inherit',
});
