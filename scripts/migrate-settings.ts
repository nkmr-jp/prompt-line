#!/usr/bin/env ts-node

/**
 * Settings migration script
 *
 * Backs up existing settings.yaml and replaces it with the latest
 * settings.example.yaml format (fresh defaults with commented examples).
 *
 * Usage: pnpm run migrate-settings
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { defaultSettings } from '../src/config/default-settings';
import { generateSettingsYaml } from '../src/config/settings-yaml-generator';

const SETTINGS_DIR = path.join(os.homedir(), '.prompt-line');
const SETTINGS_FILE = path.join(SETTINGS_DIR, 'settings.yaml');
const LEGACY_YML_PATH = path.join(SETTINGS_DIR, 'settings.yml');

function createBackupFilename(): string {
  const now = new Date();
  const timestamp = now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0') + '_' +
    String(now.getHours()).padStart(2, '0') +
    String(now.getMinutes()).padStart(2, '0') +
    String(now.getSeconds()).padStart(2, '0');
  return `settings.backup.${timestamp}.yaml`;
}

function main(): void {
  console.log('🔄 Migrating settings...');
  console.log(`📂 Settings directory: ${SETTINGS_DIR}\n`);

  if (!fs.existsSync(SETTINGS_DIR)) {
    fs.mkdirSync(SETTINGS_DIR, { recursive: true });
  }

  // Determine source file (.yaml or legacy .yml)
  const sourceFile = fs.existsSync(SETTINGS_FILE) ? SETTINGS_FILE
    : fs.existsSync(LEGACY_YML_PATH) ? LEGACY_YML_PATH
    : null;

  // Backup existing settings
  if (sourceFile) {
    const backupFilename = createBackupFilename();
    const backupPath = path.join(SETTINGS_DIR, backupFilename);
    fs.copyFileSync(sourceFile, backupPath);
    console.log(`💾 Backup created: ${backupFilename}`);

    if (sourceFile === LEGACY_YML_PATH) {
      console.log(`📄 Found legacy settings.yml, migrating to settings.yaml`);
    }
  } else {
    console.log('⚠️  No existing settings file found. Creating new one.');
  }

  // Generate fresh settings from defaults
  const content = generateSettingsYaml(defaultSettings, { includeCommentedExamples: true });
  fs.writeFileSync(SETTINGS_FILE, content, { encoding: 'utf8', mode: 0o600 });

  console.log(`✅ Settings migrated successfully!`);
  console.log(`\n📄 New settings: ${SETTINGS_FILE}`);
  console.log(`\n📂 To open settings directory:`);
  console.log(`   open ${SETTINGS_DIR}`);
}

main();
