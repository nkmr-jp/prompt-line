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

interface PluginEntry {
  path: string;
  description?: string | undefined;
}

/**
 * Extract pluginDescription from a YAML file content
 */
function extractPluginDescription(filePath: string): string | undefined {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const match = content.match(/^pluginDescription:\s*["']?(.+?)["']?\s*$/m);
    return match ? match[1] : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Recursively copy all YAML files from source to target, creating directories as needed.
 * Returns the list of plugin entries (path without extension + description).
 */
function copyDirectoryRecursive(source: string, target: string, baseSource: string): PluginEntry[] {
  const pluginEntries: PluginEntry[] = [];

  if (!fs.existsSync(source)) return pluginEntries;

  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }

  const entries = fs.readdirSync(source, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);

    if (entry.isDirectory()) {
      pluginEntries.push(...copyDirectoryRecursive(sourcePath, targetPath, baseSource));
    } else if (entry.isFile() && (entry.name.endsWith('.yml') || entry.name.endsWith('.yaml'))) {
      fs.copyFileSync(sourcePath, targetPath);
      const relPath = path.relative(baseSource, sourcePath);
      const withoutExt = relPath.replace(/\.(yml|yaml)$/, '');
      const description = extractPluginDescription(sourcePath);
      pluginEntries.push({ path: withoutExt, description });
    }
  }

  return pluginEntries;
}

/**
 * Collect plugin entries from an existing directory (for already-installed case)
 */
function collectPluginEntries(dir: string, baseDir: string): PluginEntry[] {
  const pluginEntries: PluginEntry[] = [];
  if (!fs.existsSync(dir)) return pluginEntries;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      pluginEntries.push(...collectPluginEntries(fullPath, baseDir));
    } else if (entry.isFile() && (entry.name.endsWith('.yml') || entry.name.endsWith('.yaml'))) {
      const relPath = path.relative(baseDir, fullPath);
      const withoutExt = relPath.replace(/\.(yml|yaml)$/, '');
      const description = extractPluginDescription(fullPath);
      pluginEntries.push({ path: withoutExt, description });
    }
  }
  return pluginEntries;
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

  // Find all package directories in assets (e.g., "prompt-line-plugin")
  const packages = fs.readdirSync(ASSETS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory());

  // Map of packageName → plugin entries (relative path + description)
  const allPluginEntries: Map<string, PluginEntry[]> = new Map();

  for (const pkg of packages) {
    const sourcePackageDir = path.join(ASSETS_DIR, pkg.name);
    const targetPackageDir = path.join(PLUGINS_DIR, pkg.name, hash);

    if (fs.existsSync(targetPackageDir)) {
      console.log(`⏭️  Already installed: ${pkg.name}/${hash}`);
      const entries = collectPluginEntries(targetPackageDir, targetPackageDir);
      allPluginEntries.set(pkg.name, entries);
      continue;
    }

    const entries = copyDirectoryRecursive(sourcePackageDir, targetPackageDir, sourcePackageDir);
    allPluginEntries.set(pkg.name, entries);
    console.log(`✅ Installed: ${pkg.name}/${hash} (${entries.length} files)`);
  }

  const totalCount = Array.from(allPluginEntries.values()).reduce((sum, e) => sum + e.length, 0);

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
  for (const [pkgName, entries] of allPluginEntries) {
    const sorted = entries.sort((a, b) => a.path.localeCompare(b.path));
    for (const entry of sorted) {
      const desc = entry.description ? `  # ${entry.description}` : '';
      console.log(`  - ${pkgName}/${entry.path}${desc}`);
    }
  }
  console.log('─'.repeat(60));
}

main();
