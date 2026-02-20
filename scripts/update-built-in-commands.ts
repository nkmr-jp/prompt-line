#!/usr/bin/env ts-node

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import * as os from 'os';

const BUILT_IN_COMMANDS_DIR = path.join(os.homedir(), '.prompt-line', 'built-in-commands');
const ASSETS_DIR = path.join(__dirname, '..', 'assets', 'built-in-commands');

interface CommandFile {
  name: string;
  sourcePath: string;
  targetPath: string;
  exists: boolean;
}

/**
 * Get list of command files to update
 */
function getCommandFiles(): CommandFile[] {
  const files = fs.readdirSync(ASSETS_DIR);
  return files
    .filter(file => file.endsWith('.yml'))
    .map(file => {
      const sourcePath = path.join(ASSETS_DIR, file);
      const targetPath = path.join(BUILT_IN_COMMANDS_DIR, file);
      return {
        name: file,
        sourcePath,
        targetPath,
        exists: fs.existsSync(targetPath)
      };
    });
}

/**
 * Ask user for confirmation
 */
function askConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question(`${question} (y/N): `, answer => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

/**
 * Copy file from source to target
 */
function copyFile(source: string, target: string): void {
  fs.copyFileSync(source, target);
}

/**
 * Main function
 */
async function main(): Promise<void> {
  console.log('🔄 Updating built-in commands...');
  console.log(`📂 Commands directory: ${BUILT_IN_COMMANDS_DIR}\n`);

  // Ensure target directory exists
  if (!fs.existsSync(BUILT_IN_COMMANDS_DIR)) {
    fs.mkdirSync(BUILT_IN_COMMANDS_DIR, { recursive: true });
    console.log(`✅ Created directory: ${BUILT_IN_COMMANDS_DIR}\n`);
  }

  const commandFiles = getCommandFiles();
  const existingFiles = commandFiles.filter(f => f.exists);
  const newFiles = commandFiles.filter(f => !f.exists);

  let updatedCount = 0;

  // Handle existing files
  if (existingFiles.length > 0) {
    console.log('📋 Existing files found:');
    existingFiles.forEach(f => console.log(`  - ${f.name}`));
    console.log('');

    const overwrite = await askConfirmation(
      '⚠️  Do you want to overwrite these files with defaults?'
    );

    if (overwrite) {
      // Overwrite existing files
      existingFiles.forEach(file => {
        copyFile(file.sourcePath, file.targetPath);
        console.log(`✅ Updated: ${file.name}`);
        updatedCount++;
      });
    } else {
      console.log('⏭️  Skipped overwriting existing files.');
    }
    console.log('');
  }

  // Copy new files (always, without confirmation)
  if (newFiles.length > 0) {
    console.log('📝 Creating new files:');
    newFiles.forEach(file => {
      copyFile(file.sourcePath, file.targetPath);
      console.log(`✅ Created: ${file.name}`);
      updatedCount++;
    });
  }

  if (commandFiles.length === 0) {
    console.log('⚠️  No command files found in assets directory.');
    process.exit(1);
  }

  if (updatedCount === 0) {
    console.log('\n✅ All files are up to date. No changes needed.');
  } else {
    console.log(`\n✅ ${updatedCount} file(s) updated successfully!`);
    console.log('🔄 Please restart the app to apply changes.');
  }

  console.log(`\n📂 Commands directory: ${BUILT_IN_COMMANDS_DIR}`);
}

// Run main function
main().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
