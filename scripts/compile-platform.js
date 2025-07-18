#!/usr/bin/env node

const os = require('os');
const { execSync } = require('child_process');
const path = require('path');

/**
 * Cross-platform compilation script
 * Detects the current platform and runs the appropriate build commands
 */

const platform = os.platform();
const arch = os.arch();

console.log(`🔨 Platform-specific compilation starting...`);
console.log(`Platform: ${platform} (${arch})`);

try {
  // Common TypeScript compilation
  console.log('📦 Compiling TypeScript...');
  execSync('tsc', { stdio: 'inherit' });

  // Build renderer (common for all platforms)
  console.log('🎨 Building renderer...');
  execSync('npm run build:renderer', { stdio: 'inherit' });

  // Platform-specific native tools compilation
  if (platform === 'darwin') {
    console.log('🍎 Building macOS native tools...');
    execSync('npm run compile:mac', { stdio: 'inherit' });
  } else if (platform === 'win32') {
    console.log('🪟 Building Windows native tools...');
    execSync('npm run compile:win', { stdio: 'inherit' });
  } else if (platform === 'linux') {
    console.log('🐧 Linux platform detected - no native tools required');
  } else {
    console.warn(`⚠️  Unknown platform: ${platform} - skipping native tools`);
  }

  console.log('✅ Platform-specific compilation completed successfully!');
  
} catch (error) {
  console.error('❌ Compilation failed:', error.message);
  process.exit(1);
}