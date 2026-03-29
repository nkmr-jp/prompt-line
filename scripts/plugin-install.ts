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

function getCommitInfo(gitPath: string, cwd: string): { hash: string; message: string } {
  const raw = execGit(`git log -1 --format="%h%n%s" -- "${gitPath}"`, cwd);
  const [hash = '', ...rest] = raw.split('\n');
  return { hash, message: rest.join('\n').trim() };
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

interface GitHubRemoteInfo {
  packagePrefix: string; // "github.com/user/repo"
  githubBase: string;    // "https://github.com/user/repo"
}

function parseGitHubRemote(dir: string): GitHubRemoteInfo | null {
  const remoteUrl = execGit('git remote get-url origin', dir);
  if (!remoteUrl) return null;

  // Match HTTPS (https://github.com/user/repo.git) or SSH (git@github.com:user/repo.git)
  const httpsMatch = remoteUrl.match(/github\.com\/([^/]+)\/([^/.]+)/);
  const sshMatch = remoteUrl.match(/github\.com:([^/]+)\/([^/.]+)/);
  const match = httpsMatch || sshMatch;
  if (!match) return null;

  const [, user, repo] = match;
  return {
    packagePrefix: `github.com/${user}/${repo}`,
    githubBase: `https://github.com/${user}/${repo}`,
  };
}

interface ResolvedSource {
  localPath: string;
  packageId: string;
  githubBase: string; // e.g. "https://github.com/user/repo"
  repoRelativePath: string; // e.g. "plugins"
  isGithub: boolean;
  ref?: string; // branch, tag, or commit hash (e.g. "develop", "v1.0.1", "sea8pxe")
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

    // Derive packageId from git remote URL if available
    const gitRoot = getGitRoot(resolved);
    if (gitRoot) {
      const remote = parseGitHubRemote(gitRoot);
      if (remote) {
        const repoRelativePath = path.relative(gitRoot, resolved);
        const packageId = repoRelativePath
          ? `${remote.packagePrefix}/${repoRelativePath}`
          : remote.packagePrefix;
        return {
          localPath: resolved,
          packageId,
          githubBase: remote.githubBase,
          repoRelativePath,
          isGithub: true,
        };
      }
    }

    return {
      localPath: resolved,
      packageId: path.basename(resolved),
      githubBase: '',
      repoRelativePath: '',
      isGithub: false,
    };
  }

  // github.com/user/repo[/path][@ref] format
  const ghMatch = source.match(/^github\.com\/([^/]+)\/([^/@]+)(?:\/([^@]+))?(?:@(.+))?$/);
  if (!ghMatch) {
    console.error(`❌ Error: Invalid source format: ${source}`);
    console.error('Usage: pnpm run plugin:install <source>');
    console.error('  <source> can be:');
    console.error('    ./local/path                        - Local directory');
    console.error('    ~/local/path                        - Local directory (home-relative)');
    console.error('    /absolute/path                      - Absolute path');
    console.error('    github.com/user/repo[/path]         - GitHub repository (default branch)');
    console.error('    github.com/user/repo[/path]@ref     - GitHub repository at branch/tag/hash');
    process.exit(1);
  }

  const user = ghMatch[1] as string;
  const repo = ghMatch[2] as string;
  const subPath = ghMatch[3] as string | undefined;
  const ref = ghMatch[4] as string | undefined;
  const githubBase = `https://github.com/${user}/${repo}`;
  const repoRelativePath = subPath || '';
  // packageId excludes @ref so install target is consistent regardless of ref
  const packageId = subPath ? `github.com/${user}/${repo}/${subPath}` : `github.com/${user}/${repo}`;

  // Try local ghq path first (only when no ref specified)
  if (!ref) {
    const ghqPath = path.join(os.homedir(), 'ghq', 'github.com', user, repo);
    if (fs.existsSync(ghqPath)) {
      const localPath = repoRelativePath ? path.join(ghqPath, repoRelativePath) : ghqPath;
      if (!fs.existsSync(localPath)) {
        console.error(`❌ Error: Path not found in local repository: ${localPath}`);
        process.exit(1);
      }
      return { localPath, packageId, githubBase, repoRelativePath, isGithub: true };
    }
  }

  // Clone to temp directory
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-install-'));
  const cloneTarget = path.join(tempDir, repo as string);

  const hasGh = hasCommand('gh');
  const hasGit = hasCommand('git');

  if (!hasGh && !hasGit) {
    console.error('❌ Error: Neither "gh" nor "git" command is available.');
    console.error('  Install GitHub CLI (gh) or git to clone remote repositories.');
    fs.rmSync(tempDir, { recursive: true, force: true });
    process.exit(1);
  }

  const refLabel = ref ? `${user}/${repo}@${ref}` : `${user}/${repo}`;
  console.log(`📥 Cloning ${refLabel}...`);

  const cloned = ref
    ? cloneWithRef(user, repo, ref, githubBase, cloneTarget, hasGh, hasGit)
    : cloneDefault(user, repo, githubBase, cloneTarget, hasGh);

  if (!cloned) {
    console.error(`❌ Error: Failed to clone repository: ${refLabel}`);
    fs.rmSync(tempDir, { recursive: true, force: true });
    process.exit(1);
  }

  const localPath = repoRelativePath ? path.join(cloneTarget, repoRelativePath) : cloneTarget;
  if (!fs.existsSync(localPath)) {
    console.error(`❌ Error: Path not found in cloned repository: ${repoRelativePath}`);
    fs.rmSync(tempDir, { recursive: true, force: true });
    process.exit(1);
  }

  const result: ResolvedSource = { localPath, packageId, githubBase, repoRelativePath, isGithub: true, tempDir };
  if (ref) result.ref = ref;
  return result;
}

function cloneDefault(user: string, repo: string, githubBase: string, target: string, hasGh: boolean): boolean {
  try {
    if (hasGh) {
      execSync(`gh repo clone ${user}/${repo} "${target}" -- --depth=1`, { stdio: 'inherit' });
    } else {
      execSync(`git clone --depth=1 ${githubBase}.git "${target}"`, { stdio: 'inherit' });
    }
    return true;
  } catch {
    return false;
  }
}

function cloneWithRef(user: string, repo: string, ref: string, githubBase: string, target: string, hasGh: boolean, hasGit: boolean): boolean {
  // Try shallow clone with --branch (works for branches and tags)
  try {
    if (hasGh) {
      execSync(`gh repo clone ${user}/${repo} "${target}" -- --branch ${ref} --depth=1`, { stdio: 'inherit' });
    } else {
      execSync(`git clone --branch ${ref} --depth=1 ${githubBase}.git "${target}"`, { stdio: 'inherit' });
    }
    return true;
  } catch {
    // --branch failed (likely a commit hash) — fall back to full clone + checkout
  }

  if (!hasGit) return false;

  try {
    execSync(`git clone ${githubBase}.git "${target}"`, { stdio: 'inherit' });
    execSync(`git checkout ${ref}`, { cwd: target, stdio: 'inherit' });
    return true;
  } catch {
    return false;
  }
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
): FolderInfo {
  const hasGit = gitCwd !== '';
  const fullSourceFolder = path.join(sourcePath, folderRelPath);
  const gitRelFolder = repoRelativePath
    ? path.join(repoRelativePath, folderRelPath)
    : folderRelPath;

  const version = hasGit ? getFolderCommitHash(gitRelFolder, gitCwd) : '';
  const log = hasGit ? getFolderCommitLog(gitRelFolder, gitCwd) : [];

  if (githubBase) {
    for (const entry of log) {
      entry.githubUrl = `${githubBase}/tree/${entry.hash}/${gitRelFolder}`;
    }
  }

  const githubUrl = githubBase && version
    ? `${githubBase}/tree/${version}/${gitRelFolder}`
    : '';

  const files: FileInfo[] = [];
  if (fs.existsSync(fullSourceFolder)) {
    const entries = fs.readdirSync(fullSourceFolder, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && (entry.name.endsWith('.yml') || entry.name.endsWith('.yaml'))) {
        const gitRelFile = path.join(gitRelFolder, entry.name);
        const { hash: fileVersion, message: commitMessage } = hasGit
          ? getCommitInfo(gitRelFile, gitCwd)
          : { hash: '', message: '' };
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
  ref?: string,
): void {
  const lines: string[] = [
    '# Plugin Metadata',
    '# Auto-generated by plugin:install command. Do not edit manually.',
    '',
    `source: ${source}`,
  ];

  if (githubUrl) lines.push(`github: ${githubUrl}`);
  if (ref) lines.push(`ref: ${ref}`);
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
  ref?: string,
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
  if (ref) lines.push(`ref: ${ref}`);
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

interface CopyResult {
  pluginEntries: PluginEntry[];
  leafFolders: string[];
  totalFiles: number;
}

function copyYamlFiles(
  sourceDir: string,
  targetDir: string,
  gitCwd: string,
  repoRelativePath: string,
  githubBase: string,
  baseSourceDir: string,
  baseTargetDir?: string,
): CopyResult {
  const rootTargetDir = baseTargetDir || targetDir;
  const hasGit = gitCwd !== '';
  const pluginEntries: PluginEntry[] = [];
  const leafFolders: string[] = [];
  let totalFiles = 0;
  let hasYamlInDir = false;

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      const sub = copyYamlFiles(sourcePath, targetPath, gitCwd, repoRelativePath, githubBase, baseSourceDir, rootTargetDir);
      pluginEntries.push(...sub.pluginEntries);
      leafFolders.push(...sub.leafFolders);
      totalFiles += sub.totalFiles;
    } else if (entry.isFile() && (entry.name.endsWith('.yml') || entry.name.endsWith('.yaml'))) {
      hasYamlInDir = true;
      const content = fs.readFileSync(sourcePath, 'utf-8');
      const gitRelFile = path.relative(gitCwd, sourcePath);

      let versionComment = '';
      if (hasGit) {
        const { hash, message } = getCommitInfo(gitRelFile, gitCwd);
        const sourceUrl = githubBase && hash
          ? `${githubBase}/blob/${hash}/${gitRelFile}`
          : '';
        if (hash) {
          versionComment = buildVersionComment(hash, sourceUrl, message) + '\n';
        }
      }

      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.writeFileSync(targetPath, versionComment + content, 'utf-8');

      const relPath = path.relative(rootTargetDir, targetPath);
      const descMatch = content.match(/^pluginDescription:\s*["']?(.+?)["']?\s*$/m);
      const entry: PluginEntry = { path: relPath.replace(/\.(yml|yaml)$/, '') };
      if (descMatch?.[1]) entry.description = descMatch[1];
      pluginEntries.push(entry);

      totalFiles++;
    }
  }

  if (hasYamlInDir) {
    leafFolders.push(path.relative(baseSourceDir, sourceDir));
  }

  return { pluginEntries, leafFolders, totalFiles };
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
    console.error('  pnpm run plugin:install github.com/nkmr-jp/prompt-line-plugins');
    console.error('  pnpm run plugin:install github.com/nkmr-jp/prompt-line-plugins@develop');
    console.error('  pnpm run plugin:install github.com/nkmr-jp/prompt-line-plugins@v1.0.0');
    console.error('  pnpm run plugin:install github.com/nkmr-jp/prompt-line-plugins@sea8pxe');
    console.error('  pnpm run plugin:install ~/ghq/github.com/nkmr-jp/prompt-line-plugins');
    console.error('  pnpm run plugin:install ./path/to/local/plugins');
    process.exit(1);
  }

  const resolved = resolveSource(source);
  const targetDir = path.join(PLUGINS_DIR, resolved.packageId);

  console.log(`🔄 Installing plugins from ${source}...`);
  console.log(`📂 Source: ${resolved.localPath}`);
  if (resolved.ref) console.log(`🏷️  Ref: ${resolved.ref}`);
  console.log(`📂 Target: ${targetDir}`);
  console.log('');

  // Determine git context (empty gitRoot means no git repo)
  const gitRoot = isGitRepo(resolved.localPath) ? getGitRoot(resolved.localPath) : '';

  // Copy YAML files with version comments (also collects leaf folders in one pass)
  const { pluginEntries, leafFolders, totalFiles } = copyYamlFiles(
    resolved.localPath,
    targetDir,
    gitRoot,
    resolved.repoRelativePath,
    resolved.githubBase,
    resolved.localPath,
  );

  if (totalFiles === 0) {
    console.log('⚠️  No YAML plugin files found in source directory.');
    cleanup(resolved.tempDir);
    process.exit(1);
  }

  // Generate .prompt-line-plugin metadata files
  const folderInfos: FolderInfo[] = [];
  let metadataCount = 0;

  for (const folderRelPath of leafFolders) {
    const folderInfo = buildFolderMetadata(
      resolved.localPath,
      folderRelPath,
      resolved.githubBase,
      resolved.repoRelativePath,
      gitRoot,
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
      resolved.ref,
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
    const version = gitRoot ? getFolderCommitHash(gitRelFolder, gitRoot) : '';
    const intermediateSource = resolved.isGithub
      ? `${resolved.packageId}/${intermediateDir}`
      : intermediateDir;

    writeRootMetadata(intermediateTargetDir, intermediateSource, resolved.githubBase, gitRelFolder, version, childFolders, resolved.ref);
    metadataCount++;
  }

  // Generate root .prompt-line-plugin
  const rootVersion = gitRoot
    ? getFolderCommitHash(resolved.repoRelativePath || '.', gitRoot)
    : '';

  writeRootMetadata(targetDir, resolved.packageId, resolved.githubBase, resolved.repoRelativePath, rootVersion, folderInfos, resolved.ref);
  metadataCount++;

  // Print summary
  const rootGithubUrl = resolved.githubBase && rootVersion
    ? `${resolved.githubBase}/tree/${rootVersion}/${resolved.repoRelativePath}`
    : '';

  const refInfo = resolved.ref ? ` @${resolved.ref}` : '';
  console.log(`✅ Installed ${totalFiles} plugin file(s)${rootVersion ? ` (version: ${rootVersion}${refInfo})` : ''}`);
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
