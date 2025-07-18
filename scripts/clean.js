#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');
const glob = require('glob');

/**
 * Cross-platform cleanup script
 * Replaces Unix-specific 'rm -rf' commands with Node.js fs operations
 */

console.log('🧹 Cleaning build artifacts...');

const cleanPatterns = [
  'dist/mac*',
  'dist/*.dmg',
  'dist/*.zip',
  'dist/*.blockmap',
  'dist/win*',
  'dist/*.exe',
  'dist/*.msi',
  'dist/builder-*',
  'dist/latest*.yml'
];

try {
  let removedCount = 0;

  for (const pattern of cleanPatterns) {
    const matches = glob.sync(pattern);
    
    for (const match of matches) {
      if (fs.existsSync(match)) {
        const stat = fs.statSync(match);
        
        if (stat.isDirectory()) {
          fs.removeSync(match);
          console.log(`🗂️  Removed directory: ${match}`);
        } else {
          fs.removeSync(match);
          console.log(`📄 Removed file: ${match}`);
        }
        
        removedCount++;
      }
    }
  }

  if (removedCount === 0) {
    console.log('✨ No build artifacts to clean');
  } else {
    console.log(`🎉 Cleaned ${removedCount} build artifacts`);
  }
  
} catch (error) {
  console.error('❌ Failed to clean build artifacts:', error.message);
  process.exit(1);
}