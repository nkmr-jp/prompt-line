#!/usr/bin/env ts-node

/**
 * Settings migration script
 *
 * Backs up existing settings.yml and regenerates it with the latest defaults
 * while preserving user customizations.
 *
 * Usage: pnpm run migrate-settings
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'js-yaml';
import { execSync } from 'child_process';

import { defaultSettings } from '../src/config/default-settings';
import { generateSettingsYaml } from '../src/config/settings-yaml-generator';
import type { UserSettings, AgentSkillEntry, MentionEntry } from '../src/types';

const SETTINGS_DIR = path.join(os.homedir(), '.prompt-line');
const SETTINGS_FILE = path.join(SETTINGS_DIR, 'settings.yml');

/**
 * Merge user settings with defaults (simplified version of SettingsManager.mergeWithDefaults)
 */
function mergeWithDefaults(userSettings: Partial<UserSettings>): UserSettings {
  const result: UserSettings = {
    shortcuts: {
      ...defaultSettings.shortcuts,
      ...(userSettings.shortcuts || {})
    },
    window: {
      ...defaultSettings.window,
      ...(userSettings.window || {})
    },
    fileOpener: {
      ...defaultSettings.fileOpener,
      ...(userSettings.fileOpener || {}),
      extensions: {
        ...defaultSettings.fileOpener?.extensions,
        ...(userSettings.fileOpener?.extensions || {})
      }
    }
  };

  // Handle mentions with deep merge
  result.mentions = {
    fileSearch: {
      ...defaultSettings.mentions?.fileSearch,
      ...(userSettings.mentions?.fileSearch || {})
    },
    symbolSearch: {
      ...defaultSettings.mentions?.symbolSearch,
      ...(userSettings.mentions?.symbolSearch || {})
    }
  };

  // customSearch: user settings > defaults
  const customSearch = userSettings.mentions?.customSearch ?? userSettings.mentions?.mdSearch ?? defaultSettings.mentions?.customSearch;
  if (customSearch) {
    result.mentions.customSearch = customSearch;
  }

  // builtInCommands
  const defaultBuiltInCommands = defaultSettings.builtInCommands ?? ['claude'];
  if (Array.isArray(userSettings.builtInCommands)) {
    result.builtInCommands = userSettings.builtInCommands;
  } else {
    result.builtInCommands = defaultBuiltInCommands;
  }

  // agentSkills
  const defaultAgentSkills = defaultSettings.agentSkills ?? [];
  if (Array.isArray(userSettings.agentSkills)) {
    result.agentSkills = userSettings.agentSkills as AgentSkillEntry[];
  } else {
    result.agentSkills = defaultAgentSkills;
  }

  // Handle legacy fileSearch -> mentions.fileSearch
  if (userSettings.fileSearch) {
    result.mentions = result.mentions || {};
    result.mentions.fileSearch = {
      ...defaultSettings.mentions?.fileSearch,
      ...(result.mentions.fileSearch || {}),
      ...(userSettings.fileSearch || {})
    };
  }

  // Handle legacy symbolSearch -> mentions.symbolSearch
  if (userSettings.symbolSearch) {
    result.mentions = result.mentions || {};
    result.mentions.symbolSearch = {
      ...defaultSettings.mentions?.symbolSearch,
      ...(result.mentions.symbolSearch || {}),
      ...(userSettings.symbolSearch || {})
    };
  }

  // Handle legacy mdSearch
  if (userSettings.mdSearch && userSettings.mdSearch.length > 0) {
    const customEntries: MentionEntry[] = [];
    for (const entry of userSettings.mdSearch) {
      if ('searchPrefix' in entry) {
        customEntries.push(entry as MentionEntry);
      }
    }
    if (customEntries.length > 0 && (!result.mentions?.customSearch || result.mentions.customSearch.length === 0)) {
      result.mentions = result.mentions || {};
      result.mentions.customSearch = customEntries;
    }
  }

  return result;
}

/**
 * Create a backup filename with timestamp
 */
function createBackupFilename(): string {
  const now = new Date();
  const timestamp = now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0') + '_' +
    String(now.getHours()).padStart(2, '0') +
    String(now.getMinutes()).padStart(2, '0') +
    String(now.getSeconds()).padStart(2, '0');
  return `settings.backup.${timestamp}.yml`;
}

/**
 * Main migration function
 */
function main(): void {
  console.log('🔄 Migrating settings...');
  console.log(`📂 Settings directory: ${SETTINGS_DIR}\n`);

  // Check if settings file exists
  if (!fs.existsSync(SETTINGS_FILE)) {
    console.log('⚠️  No existing settings.yml found.');
    console.log('📝 Creating new settings.yml with defaults...');

    // Ensure directory exists
    if (!fs.existsSync(SETTINGS_DIR)) {
      fs.mkdirSync(SETTINGS_DIR, { recursive: true });
    }

    const content = generateSettingsYaml(defaultSettings, { includeCommentedExamples: true });
    fs.writeFileSync(SETTINGS_FILE, content, { encoding: 'utf8', mode: 0o600 });
    console.log(`✅ Created: ${SETTINGS_FILE}`);
    openSettingsDir();
    return;
  }

  // Read existing settings
  console.log('📖 Reading existing settings...');
  const existingContent = fs.readFileSync(SETTINGS_FILE, 'utf8');

  let userSettings: Partial<UserSettings>;
  try {
    userSettings = yaml.load(existingContent, { schema: yaml.JSON_SCHEMA }) as Partial<UserSettings>;
    if (!userSettings || typeof userSettings !== 'object') {
      throw new Error('Invalid YAML format');
    }
  } catch (error) {
    console.error('❌ Failed to parse existing settings.yml');
    if (error instanceof Error) {
      console.error(`   Error: ${error.message}`);
    }
    process.exit(1);
  }

  // Create backup
  const backupFilename = createBackupFilename();
  const backupPath = path.join(SETTINGS_DIR, backupFilename);
  fs.copyFileSync(SETTINGS_FILE, backupPath);
  console.log(`💾 Backup created: ${backupFilename}`);

  // Merge with defaults and regenerate
  console.log('🔀 Merging with latest defaults...');
  const mergedSettings = mergeWithDefaults(userSettings);
  const newContent = generateSettingsYaml(mergedSettings, { includeCommentedExamples: true });
  fs.writeFileSync(SETTINGS_FILE, newContent, { encoding: 'utf8', mode: 0o600 });

  console.log(`✅ Settings migrated successfully!`);
  console.log(`\n📄 Updated: ${SETTINGS_FILE}`);
  console.log(`💾 Backup:  ${backupPath}`);

  openSettingsDir();
}

/**
 * Open settings directory in Finder
 */
function openSettingsDir(): void {
  try {
    console.log(`\n📂 Opening settings directory in 5 seconds...`);
    execSync('sleep 5');
    execSync(`open "${SETTINGS_DIR}"`);
  } catch {
    // Ignore errors (non-macOS environments)
  }
}

// Run
main();
