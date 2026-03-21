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
 * Recursively copy all YAML files from source to target, creating directories as needed
 */
function copyDirectoryRecursive(source: string, target: string): number {
  let count = 0;

  if (!fs.existsSync(source)) return count;

  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }

  const entries = fs.readdirSync(source, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);

    if (entry.isDirectory()) {
      count += copyDirectoryRecursive(sourcePath, targetPath);
    } else if (entry.isFile() && (entry.name.endsWith('.yml') || entry.name.endsWith('.yaml'))) {
      fs.copyFileSync(sourcePath, targetPath);
      count++;
    }
  }

  return count;
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

  let totalCount = 0;

  for (const pkg of packages) {
    const sourcePackageDir = path.join(ASSETS_DIR, pkg.name);
    const targetPackageDir = path.join(PLUGINS_DIR, pkg.name, hash);

    if (fs.existsSync(targetPackageDir)) {
      console.log(`⏭️  Already installed: ${pkg.name}/${hash}`);
      // Count existing files
      const count = countYamlFiles(targetPackageDir);
      totalCount += count;
      continue;
    }

    const count = copyDirectoryRecursive(sourcePackageDir, targetPackageDir);
    totalCount += count;
    console.log(`✅ Installed: ${pkg.name}/${hash} (${count} files)`);
  }

  if (totalCount === 0) {
    console.log('⚠️  No plugin files found in assets directory.');
    process.exit(1);
  }

  console.log(`\n✅ ${totalCount} plugin file(s) installed successfully!`);
  console.log('🔄 Changes are auto-detected — no app restart needed.');
  console.log(`\n📂 Plugins directory: ${PLUGINS_DIR}`);
}

/**
 * Count YAML files recursively in a directory
 */
function countYamlFiles(dir: string): number {
  let count = 0;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      count += countYamlFiles(path.join(dir, entry.name));
    } else if (entry.isFile() && (entry.name.endsWith('.yml') || entry.name.endsWith('.yaml'))) {
      count++;
    }
  }
  return count;
}

main();
