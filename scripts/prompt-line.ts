#!/usr/bin/env ts-node

/**
 * prompt-line CLI dispatcher.
 *
 * Bundled into the packaged app (dist/cli) and exposed as the `prompt-line`
 * command via the Homebrew cask `binary` shim (ELECTRON_RUN_AS_NODE), or via
 * `pnpm add -g .` for source builds. Only Node builtins may be imported here —
 * the bundled runtime has no ts-node, no node_modules, and no Electron APIs.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execFileSync } from 'child_process';

const BUNDLE_ID = 'com.electron.prompt-line';
const SETTINGS_DIR = path.join(os.homedir(), '.prompt-line');

// --- reset-accessibility ---

function resetAccessibility(): void {
  execFileSync('tccutil', ['reset', 'Accessibility', BUNDLE_ID], { stdio: 'inherit' });
  console.log('✅ Accessibility permissions for Prompt Line have been reset');
}

// --- migrate-settings ---

function backupFilename(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `settings.backup.${ts}.yaml`;
}

// Packaged CLI: settings.example.yaml sits next to this file in dist/cli.
// Repo (ts-node) usage: fall back to the project root copy.
function bundledExamplePath(): string {
  const alongside = path.join(__dirname, 'settings.example.yaml');
  return fs.existsSync(alongside)
    ? alongside
    : path.join(__dirname, '..', 'settings.example.yaml');
}

function migrateSettings(): void {
  const settingsFile = path.join(SETTINGS_DIR, 'settings.yaml');
  const legacyFile = path.join(SETTINGS_DIR, 'settings.yml');
  const examplePath = bundledExamplePath();

  if (!fs.existsSync(examplePath)) {
    console.error(`❌ Error: settings.example.yaml not found: ${examplePath}`);
    process.exit(1);
  }

  console.log('🔄 Migrating settings...');
  console.log(`📂 Settings directory: ${SETTINGS_DIR}\n`);
  fs.mkdirSync(SETTINGS_DIR, { recursive: true });

  const sourceFile = fs.existsSync(settingsFile) ? settingsFile
    : fs.existsSync(legacyFile) ? legacyFile
    : null;

  if (sourceFile) {
    const backupPath = path.join(SETTINGS_DIR, backupFilename());
    fs.copyFileSync(sourceFile, backupPath);
    console.log(`💾 Backup created: ${path.basename(backupPath)}`);
    if (sourceFile === legacyFile) {
      console.log('📄 Found legacy settings.yml, migrating to settings.yaml');
    }
  } else {
    console.log('⚠️  No existing settings file found. Creating new one.');
  }

  fs.copyFileSync(examplePath, settingsFile);
  fs.chmodSync(settingsFile, 0o600);
  console.log('✅ Settings migrated successfully!');
  console.log(`\n📄 New settings: ${settingsFile}`);
}

// --- help ---

function showHelp(): void {
  const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
  const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
  const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;

  console.log(`
${bold('🖥️  Prompt Line CLI')}

${bold('Commands:')}
  ${cyan('prompt-line plugin install <source>')}   Install plugins
  ${cyan('prompt-line plugin help')}              Show plugin install usage
  ${cyan('prompt-line reset-accessibility')}      Reset Accessibility permission
  ${cyan('prompt-line migrate-settings')}         Reset settings.yaml to fresh defaults ${dim('(auto-backup)')}
  ${cyan('prompt-line help')}                     Show this help message
`);
}

// --- dispatch ---

const command = process.argv[2];

switch (command) {
  case 'plugin': {
    // Reindex argv so the plugin module sees its own command at argv[2]
    // ("prompt-line plugin install X" → "install X").
    process.argv.splice(2, 1);
    require('./plugin');
    break;
  }
  case 'reset-accessibility':
    resetAccessibility();
    break;
  case 'migrate-settings':
    migrateSettings();
    break;
  case 'help':
  case '--help':
  case '-h':
  case undefined:
    showHelp();
    break;
  default:
    console.error(`Unknown command: ${command}`);
    showHelp();
    process.exit(1);
}
