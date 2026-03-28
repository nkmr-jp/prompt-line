#!/usr/bin/env ts-node

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';

const PLUGINS_DIR = path.join(os.homedir(), '.prompt-line', 'plugins');

// --- Types ---

interface FileInfo {
  name: string;
  version: string;
  commitMessage: string;
  githubUrl: string;
}

interface LogEntry {
  hash: string;
  date: string;
  message: string;
  githubUrl: string;
}

interface FolderInfo {
  relativePath: string;
  version: string;
  githubUrl: string;
  files: FileInfo[];
  log: LogEntry[];
}

interface PluginEntry {
  path: string;
  description?: string;
}

// --- Git Helpers ---

function execGit(cmd: string, cwd: string): string {
  try {
    return execSync(cmd, { cwd, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return '';
  }
}

function isGitRepo(dir: string): boolean {
  return execGit('git rev-parse --is-inside-work-tree', dir) === 'true';
}

function getGitRoot(dir: string): string {
  return execGit('git rev-parse --show-toplevel', dir);
}

function getFileCommitHash(filePath: string, cwd: string): string {
  return execGit(`git log -1 --format="%h" -- "${filePath}"`, cwd);
}

function getFileCommitMessage(filePath: string, cwd: string): string {
  return execGit(`git log -1 --format="%s" -- "${filePath}"`, cwd);
}

function getFolderCommitHash(folderPath: string, cwd: string): string {
  return execGit(`git log -1 --format="%h" -- "${folderPath}/"`, cwd);
}

function getFolderCommitLog(folderPath: string, cwd: string): LogEntry[] {
  const raw = execGit(`git log --format="%h %ad %s" --date=short -10 -- "${folderPath}/"`, cwd);
  if (!raw) return [];
  return raw.split('\n').filter(Boolean).map(line => {
    const match = line.match(/^(\S+)\s+(\S+)\s+(.*)$/);
    if (!match) return null;
    return { hash: match[1], date: match[2], message: match[3], githubUrl: '' };
  }).filter((e): e is LogEntry => e !== null);
}

// --- Source Resolution ---

interface ResolvedSource {
  localPath: string;
  packageId: string;
  githubBase: string; // e.g. "https://github.com/user/repo"
  repoRelativePath: string; // e.g. "plugins"
  isGithub: boolean;
  tempDir?: string;
}

function resolveSource(source: string): ResolvedSource {
  // Local path
  if (source.startsWith('./') || source.startsWith('~/') || source.startsWith('/')) {
    const resolved = source.startsWith('~/')
      ? path.join(os.homedir(), source.slice(2))
      : path.resolve(source);

    if (!fs.existsSync(resolved)) {
      console.error(`❌ Error: Path not found: ${resolved}`);
      process.exit(1);
    }

    return {
      localPath: resolved,
      packageId: path.basename(resolved),
      githubBase: '',
      repoRelativePath: '',
      isGithub: false,
    };
  }

  // github.com/user/repo/path format
  const ghMatch = source.match(/^github\.com\/([^/]+)\/([^/]+)(?:\/(.+))?$/);
  if (!ghMatch) {
    console.error(`❌ Error: Invalid source format: ${source}`);
    console.error('Usage: pnpm run plugin:install <source>');
    console.error('  <source> can be:');
    console.error('    ./local/path          - Local directory');
    console.error('    ~/local/path          - Local directory (home-relative)');
    console.error('    /absolute/path        - Absolute path');
    console.error('    github.com/user/repo/path - GitHub repository');
    process.exit(1);
  }

  const [, user, repo, subPath] = ghMatch;
  const githubBase = `https://github.com/${user}/${repo}`;
  const repoRelativePath = subPath || '';

  // Try local ghq path first
  const ghqPath = path.join(os.homedir(), 'ghq', 'github.com', user, repo);
  if (fs.existsSync(ghqPath)) {
    const localPath = repoRelativePath ? path.join(ghqPath, repoRelativePath) : ghqPath;
    if (!fs.existsSync(localPath)) {
      console.error(`❌ Error: Path not found in local repository: ${localPath}`);
      process.exit(1);
    }
    return { localPath, packageId: source, githubBase, repoRelativePath, isGithub: true };
  }

  // Try remote clone
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-install-'));
  const cloneTarget = path.join(tempDir, repo);

  const hasGh = hasCommand('gh');
  const hasGit = hasCommand('git');

  if (!hasGh && !hasGit) {
    console.error('❌ Error: Neither "gh" nor "git" command is available.');
    console.error('  Install GitHub CLI (gh) or git to clone remote repositories.');
    fs.rmSync(tempDir, { recursive: true, force: true });
    process.exit(1);
  }

  console.log(`📥 Cloning ${user}/${repo}...`);
  try {
    if (hasGh) {
      execSync(`gh repo clone ${user}/${repo} "${cloneTarget}" -- --depth=1`, {
        stdio: 'inherit',
      });
    } else {
      execSync(`git clone --depth=1 ${githubBase}.git "${cloneTarget}"`, {
        stdio: 'inherit',
      });
    }
  } catch {
    console.error(`❌ Error: Failed to clone repository: ${user}/${repo}`);
    fs.rmSync(tempDir, { recursive: true, force: true });
    process.exit(1);
  }

  const localPath = repoRelativePath ? path.join(cloneTarget, repoRelativePath) : cloneTarget;
  if (!fs.existsSync(localPath)) {
    console.error(`❌ Error: Path not found in cloned repository: ${repoRelativePath}`);
    fs.rmSync(tempDir, { recursive: true, force: true });
    process.exit(1);
  }

  return { localPath, packageId: source, githubBase, repoRelativePath, isGithub: true, tempDir };
}

function hasCommand(cmd: string): boolean {
  try {
    execSync(`which ${cmd}`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

// --- YAML Helpers ---

function extractPluginDescription(filePath: string): string | undefined {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const match = content.match(/^pluginDescription:\s*["']?(.+?)["']?\s*$/m);
    return match ? match[1] : undefined;
  } catch {
    return undefined;
  }
}

function getNowISO(): string {
  const now = new Date();
  const offset = -now.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const pad = (n: number) => String(Math.abs(n)).padStart(2, '0');
  const hours = Math.floor(Math.abs(offset) / 60);
  const minutes = Math.abs(offset) % 60;
  return now.toISOString().replace('Z', '').replace(/\.\d{3}/, '') + sign + pad(hours) + ':' + pad(minutes);
}

function sanitize(str: string): string {
  // Remove characters that could break YAML comments
  return str.replace(/[\r\n]/g, ' ').trim();
}

function buildVersionComment(fileVersion: string, sourceUrl: string, commitMessage: string): string {
  const lines = [
    `# version: ${fileVersion}`,
    `# source: ${sourceUrl}`,
    `# installed: ${getNowISO()}`,
    `# commit-message: ${sanitize(commitMessage)}`,
    '# ---',
  ];
  return lines.join('\n');
}

// --- Metadata Generation ---

function buildFolderMetadata(
  sourcePath: string,
  folderRelPath: string,
  githubBase: string,
  repoRelativePath: string,
  gitCwd: string,
  hasGit: boolean,
): FolderInfo {
  const fullSourceFolder = path.join(sourcePath, folderRelPath);
  const gitRelFolder = repoRelativePath
    ? path.join(repoRelativePath, folderRelPath)
    : folderRelPath;

  const version = hasGit ? getFolderCommitHash(gitRelFolder, gitCwd) : '';
  const log = hasGit ? getFolderCommitLog(gitRelFolder, gitCwd) : [];

  // Add GitHub URLs to log entries
  if (githubBase) {
    for (const entry of log) {
      entry.githubUrl = `${githubBase}/tree/${entry.hash}/${gitRelFolder}`;
    }
  }

  const githubUrl = githubBase && version
    ? `${githubBase}/tree/${version}/${gitRelFolder}`
    : '';

  // Collect YAML files in this folder
  const files: FileInfo[] = [];
  if (fs.existsSync(fullSourceFolder)) {
    const entries = fs.readdirSync(fullSourceFolder, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && (entry.name.endsWith('.yml') || entry.name.endsWith('.yaml'))) {
        const gitRelFile = path.join(gitRelFolder, entry.name);
        const fileVersion = hasGit ? getFileCommitHash(gitRelFile, gitCwd) : '';
        const commitMessage = hasGit ? getFileCommitMessage(gitRelFile, gitCwd) : '';
        const fileGithubUrl = githubBase && fileVersion
          ? `${githubBase}/blob/${fileVersion}/${gitRelFile}`
          : '';

        files.push({
          name: entry.name,
          version: fileVersion,
          commitMessage: sanitize(commitMessage),
          githubUrl: fileGithubUrl,
        });
      }
    }
  }

  return {
    relativePath: folderRelPath,
    version,
    githubUrl,
    files,
    log,
  };
}

function writePromptLinePluginFile(
  targetDir: string,
  source: string,
  githubUrl: string,
  version: string,
  files: FileInfo[],
  log: LogEntry[],
): void {
  const lines: string[] = [
    '# Plugin Metadata',
    '# Auto-generated by plugin:install command. Do not edit manually.',
    '',
    `source: ${source}`,
  ];

  if (githubUrl) lines.push(`github: ${githubUrl}`);
  if (version) lines.push(`version: ${version}`);
  lines.push(`installed: ${getNowISO()}`);

  if (files.length > 0) {
    lines.push('');
    lines.push('files:');
    for (const f of files) {
      lines.push(`  - name: ${f.name}`);
      if (f.version) lines.push(`    version: ${f.version}`);
      if (f.commitMessage) lines.push(`    commit-message: "${sanitize(f.commitMessage)}"`);
      if (f.githubUrl) lines.push(`    github: ${f.githubUrl}`);
    }
  }

  if (log.length > 0) {
    lines.push('');
    lines.push('log:');
    for (const entry of log) {
      lines.push(`  - hash: ${entry.hash}`);
      lines.push(`    date: ${entry.date}`);
      lines.push(`    message: "${sanitize(entry.message)}"`);
      if (entry.githubUrl) lines.push(`    github: ${entry.githubUrl}`);
    }
  }

  lines.push('');
  fs.writeFileSync(path.join(targetDir, '.prompt-line-plugin'), lines.join('\n'), 'utf-8');
}

function writeRootMetadata(
  targetDir: string,
  source: string,
  githubBase: string,
  repoRelativePath: string,
  version: string,
  folders: FolderInfo[],
): void {
  const githubUrl = githubBase && version
    ? `${githubBase}/tree/${version}/${repoRelativePath}`
    : '';

  const lines: string[] = [
    '# Plugin Package Metadata',
    '# Auto-generated by plugin:install command. Do not edit manually.',
    '',
    `source: ${source}`,
  ];

  if (githubUrl) lines.push(`github: ${githubUrl}`);
  if (version) lines.push(`version: ${version}`);
  lines.push(`installed: ${getNowISO()}`);

  if (folders.length > 0) {
    lines.push('');
    lines.push('folders:');
    for (const f of folders) {
      lines.push(`  - path: ${f.relativePath}`);
      if (f.version) lines.push(`    version: ${f.version}`);
      if (f.githubUrl) lines.push(`    github: ${f.githubUrl}`);
      lines.push(`    files: ${f.files.length}`);
    }
  }

  lines.push('');
  fs.writeFileSync(path.join(targetDir, '.prompt-line-plugin'), lines.join('\n'), 'utf-8');
}

// --- File Copy ---

function collectLeafFolders(dir: string, base: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const hasYaml = entries.some(e => e.isFile() && (e.name.endsWith('.yml') || e.name.endsWith('.yaml')));
  const subDirs = entries.filter(e => e.isDirectory());

  if (hasYaml) {
    results.push(path.relative(base, dir));
  }

  for (const sub of subDirs) {
    results.push(...collectLeafFolders(path.join(dir, sub.name), base));
  }

  return results;
}

function copyYamlFiles(
  sourceDir: string,
  targetDir: string,
  gitCwd: string,
  repoRelativePath: string,
  githubBase: string,
  hasGitRepo: boolean,
): { pluginEntries: PluginEntry[]; totalFiles: number } {
  const pluginEntries: PluginEntry[] = [];
  let totalFiles = 0;

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      const sub = copyYamlFiles(sourcePath, targetPath, gitCwd, repoRelativePath, githubBase, hasGitRepo);
      pluginEntries.push(...sub.pluginEntries);
      totalFiles += sub.totalFiles;
    } else if (entry.isFile() && (entry.name.endsWith('.yml') || entry.name.endsWith('.yaml'))) {
      const content = fs.readFileSync(sourcePath, 'utf-8');

      // Get git info for version comment
      const gitRelFile = repoRelativePath
        ? path.relative(path.resolve(gitCwd), sourcePath)
        : path.relative(gitCwd, sourcePath);

      let versionComment = '';
      if (hasGitRepo) {
        const fileVersion = getFileCommitHash(gitRelFile, gitCwd);
        const commitMessage = getFileCommitMessage(gitRelFile, gitCwd);
        const sourceUrl = githubBase && fileVersion
          ? `${githubBase}/blob/${fileVersion}/${gitRelFile}`
          : '';
        if (fileVersion) {
          versionComment = buildVersionComment(fileVersion, sourceUrl, commitMessage) + '\n';
        }
      }

      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.writeFileSync(targetPath, versionComment + content, 'utf-8');

      // Build plugin entry for settings example
      const relPath = path.relative(targetDir, targetPath).replace(/^\.\//, '');
      // We need relative from the package root, so recalculate
      const description = extractPluginDescription(sourcePath);
      pluginEntries.push({
        path: relPath.replace(/\.(yml|yaml)$/, ''),
        description,
      });

      totalFiles++;
    }
  }

  return { pluginEntries, totalFiles };
}

// --- Main ---

function main(): void {
  const source = process.argv[2];

  if (!source) {
    console.error('❌ Error: No source specified.');
    console.error('');
    console.error('Usage: pnpm run plugin:install <source>');
    console.error('');
    console.error('Examples:');
    console.error('  pnpm run plugin:install ./plugins');
    console.error('  pnpm run plugin:install ~/ghq/github.com/nkmr-jp/prompt-line/plugins');
    console.error('  pnpm run plugin:install github.com/nkmr-jp/prompt-line/plugins');
    process.exit(1);
  }

  const resolved = resolveSource(source);
  const targetDir = path.join(PLUGINS_DIR, resolved.packageId);

  console.log(`🔄 Installing plugins from ${source}...`);
  console.log(`📂 Source: ${resolved.localPath}`);
  console.log(`📂 Target: ${targetDir}`);
  console.log('');

  // Determine git context
  const hasGitRepo = isGitRepo(resolved.localPath);
  const gitRoot = hasGitRepo ? getGitRoot(resolved.localPath) : '';

  // Copy YAML files with version comments
  const { pluginEntries, totalFiles } = copyYamlFiles(
    resolved.localPath,
    targetDir,
    gitRoot,
    resolved.repoRelativePath,
    resolved.githubBase,
    hasGitRepo,
  );

  if (totalFiles === 0) {
    console.log('⚠️  No YAML plugin files found in source directory.');
    cleanup(resolved.tempDir);
    process.exit(1);
  }

  // Generate .prompt-line-plugin metadata files
  const leafFolders = collectLeafFolders(resolved.localPath, resolved.localPath);
  const folderInfos: FolderInfo[] = [];
  let metadataCount = 0;

  for (const folderRelPath of leafFolders) {
    const folderInfo = buildFolderMetadata(
      resolved.localPath,
      folderRelPath,
      resolved.githubBase,
      resolved.repoRelativePath,
      gitRoot,
      hasGitRepo,
    );

    const folderTargetDir = path.join(targetDir, folderRelPath);
    const folderSource = resolved.isGithub
      ? `${resolved.packageId}/${folderRelPath}`
      : folderRelPath;

    writePromptLinePluginFile(
      folderTargetDir,
      folderSource,
      folderInfo.githubUrl,
      folderInfo.version,
      folderInfo.files,
      folderInfo.log,
    );

    folderInfos.push(folderInfo);
    metadataCount++;
  }

  // Generate intermediate directory metadata (e.g., claude/ which contains agent-built-in/, agent-skills/, custom-search/)
  const intermediateDirs = new Set<string>();
  for (const folderRelPath of leafFolders) {
    const parts = folderRelPath.split(path.sep);
    for (let i = 1; i < parts.length; i++) {
      intermediateDirs.add(parts.slice(0, i).join(path.sep));
    }
  }

  for (const intermediateDir of Array.from(intermediateDirs)) {
    const intermediateTargetDir = path.join(targetDir, intermediateDir);
    if (!fs.existsSync(intermediateTargetDir)) continue;

    const childFolders = folderInfos.filter(f => f.relativePath.startsWith(intermediateDir + path.sep));
    const gitRelFolder = resolved.repoRelativePath
      ? path.join(resolved.repoRelativePath, intermediateDir)
      : intermediateDir;
    const version = hasGitRepo ? getFolderCommitHash(gitRelFolder, gitRoot) : '';
    const intermediateSource = resolved.isGithub
      ? `${resolved.packageId}/${intermediateDir}`
      : intermediateDir;

    writeRootMetadata(intermediateTargetDir, intermediateSource, resolved.githubBase, gitRelFolder, version, childFolders);
    metadataCount++;
  }

  // Generate root .prompt-line-plugin
  const rootVersion = hasGitRepo
    ? getFolderCommitHash(resolved.repoRelativePath || '.', gitRoot)
    : '';

  writeRootMetadata(targetDir, resolved.packageId, resolved.githubBase, resolved.repoRelativePath, rootVersion, folderInfos);
  metadataCount++;

  // Print summary
  const rootGithubUrl = resolved.githubBase && rootVersion
    ? `${resolved.githubBase}/tree/${rootVersion}/${resolved.repoRelativePath}`
    : '';

  console.log(`✅ Installed ${totalFiles} plugin file(s)${rootVersion ? ` (version: ${rootVersion})` : ''}`);
  console.log(`📋 Generated .prompt-line-plugin files for ${metadataCount} folders`);
  if (rootGithubUrl) {
    console.log(`🔗 GitHub: ${rootGithubUrl}`);
  }

  // Print settings.yml configuration guide
  console.log('');
  console.log('─'.repeat(50));
  console.log('📝 Copy the following to ~/.prompt-line/settings.yml:');
  console.log('─'.repeat(50));
  console.log('plugins:');

  const sorted = pluginEntries.sort((a, b) => a.path.localeCompare(b.path));
  console.log(`  ${resolved.packageId}:`);
  for (const entry of sorted) {
    const desc = entry.description ? `  # ${entry.description}` : '';
    console.log(`    - ${entry.path}${desc}`);
  }

  console.log('─'.repeat(50));

  // Cleanup temp directory
  cleanup(resolved.tempDir);
}

function cleanup(tempDir?: string): void {
  if (tempDir && fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

main();
