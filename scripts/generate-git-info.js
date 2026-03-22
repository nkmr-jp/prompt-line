const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const outputPath = path.join(__dirname, '..', 'src', 'generated', 'git-info.json');

let gitInfo = { hash: '', branch: '' };

try {
  gitInfo.hash = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  gitInfo.branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
} catch {
  // Not a git repo or git not available
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(gitInfo, null, 2) + '\n');
console.log(`Generated git-info.json: ${JSON.stringify(gitInfo)}`);
