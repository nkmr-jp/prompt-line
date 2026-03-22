#!/usr/bin/env ts-node

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';

const PLUGINS_DIR = path.join(os.homedir(), '.prompt-line', 'plugins');
const ASSETS_DIR = path.join(__dirname, '..', 'assets', 'plugins');

/**
 * Get git short hash of HEAD
 */
function getGitShortHash(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8', cwd: __dirname }).trim();
  } catch {
    // Fallback: use timestamp if git is not available
    return `v${Date.now()}`;
  }
}

/**
 * Recursively copy all YAML files from source to target, creating directories as needed.
 * Returns the list of relative plugin paths (without extension).
 */
function copyDirectoryRecursive(source: string, target: string, baseSource: string): string[] {
  const pluginPaths: string[] = [];

  if (!fs.existsSync(source)) return pluginPaths;

  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }

  const entries = fs.readdirSync(source, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);

    if (entry.isDirectory()) {
      pluginPaths.push(...copyDirectoryRecursive(sourcePath, targetPath, baseSource));
    } else if (entry.isFile() && (entry.name.endsWith('.yml') || entry.name.endsWith('.yaml'))) {
      fs.copyFileSync(sourcePath, targetPath);
      // Collect relative path without extension (e.g., "agent-skills/claude-commands")
      const relPath = path.relative(baseSource, sourcePath);
      const withoutExt = relPath.replace(/\.(yml|yaml)$/, '');
      pluginPaths.push(withoutExt);
    }
  }

  return pluginPaths;
}

/**
 * Collect plugin paths from an existing directory (for already-installed case)
 */
function collectPluginPaths(dir: string, baseDir: string): string[] {
  const pluginPaths: string[] = [];
  if (!fs.existsSync(dir)) return pluginPaths;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      pluginPaths.push(...collectPluginPaths(fullPath, baseDir));
    } else if (entry.isFile() && (entry.name.endsWith('.yml') || entry.name.endsWith('.yaml'))) {
      const relPath = path.relative(baseDir, fullPath);
      const withoutExt = relPath.replace(/\.(yml|yaml)$/, '');
      pluginPaths.push(withoutExt);
    }
  }
  return pluginPaths;
}

/**
 * Main function
 */
function main(): void {
  const hash = getGitShortHash();

  console.log(`🔄 Installing plugins (${hash})...`);
  console.log(`📂 Plugins directory: ${PLUGINS_DIR}\n`);

  if (!fs.existsSync(PLUGINS_DIR)) {
    fs.mkdirSync(PLUGINS_DIR, { recursive: true });
  }

  // Find all package directories in assets (e.g., "prompt-line-plugins")
  const packages = fs.readdirSync(ASSETS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory());

  // Map of packageName → plugin paths (relative, without hash)
  const allPluginPaths: Map<string, string[]> = new Map();

  for (const pkg of packages) {
    const sourcePackageDir = path.join(ASSETS_DIR, pkg.name);
    const targetPackageDir = path.join(PLUGINS_DIR, pkg.name, hash);

    if (fs.existsSync(targetPackageDir)) {
      console.log(`⏭️  Already installed: ${pkg.name}/${hash}`);
      const paths = collectPluginPaths(targetPackageDir, targetPackageDir);
      allPluginPaths.set(pkg.name, paths);
      continue;
    }

    const paths = copyDirectoryRecursive(sourcePackageDir, targetPackageDir, sourcePackageDir);
    allPluginPaths.set(pkg.name, paths);
    console.log(`✅ Installed: ${pkg.name}/${hash} (${paths.length} files)`);
  }

  const totalCount = Array.from(allPluginPaths.values()).reduce((sum, p) => sum + p.length, 0);

  if (totalCount === 0) {
    console.log('⚠️  No plugin files found in assets directory.');
    process.exit(1);
  }

  console.log(`\n✅ ${totalCount} plugin file(s) installed successfully!`);
  console.log('🔄 Changes are auto-detected — no app restart needed.');

  // Print settings.yml configuration guide
  console.log('\n' + '─'.repeat(60));
  console.log('📝 Copy the following to ~/.prompt-line/settings.yml');
  console.log('   and keep only the plugins you want to use:');
  console.log('─'.repeat(60));
  console.log('plugins:');
  for (const [pkgName, paths] of allPluginPaths) {
    const sorted = paths.sort();
    for (const p of sorted) {
      console.log(`  - ${pkgName}/${p}`);
    }
  }
  console.log('─'.repeat(60));
}

main();
