#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');

/**
 * Cross-platform file copying script for renderer files
 * Replaces Unix-specific 'cp' commands with Node.js fs operations
 */

console.log('📂 Copying renderer files...');

try {
  // Ensure target directory exists
  const targetDir = path.join('dist', 'renderer');
  fs.ensureDirSync(targetDir);

  // Copy HTML file
  const htmlSource = path.join('src', 'renderer', 'input.html');
  const htmlTarget = path.join('dist', 'renderer', 'input.html');
  
  if (fs.existsSync(htmlSource)) {
    fs.copyFileSync(htmlSource, htmlTarget);
    console.log('✅ Copied input.html');
  } else {
    console.warn('⚠️  input.html not found at:', htmlSource);
  }

  // Copy styles directory
  const stylesSource = path.join('src', 'renderer', 'styles');
  const stylesTarget = path.join('dist', 'renderer', 'styles');
  
  if (fs.existsSync(stylesSource)) {
    fs.copySync(stylesSource, stylesTarget);
    console.log('✅ Copied styles directory');
  } else {
    console.warn('⚠️  styles directory not found at:', stylesSource);
  }

  // Copy any additional renderer assets
  const assetsSource = path.join('src', 'renderer', 'assets');
  const assetsTarget = path.join('dist', 'renderer', 'assets');
  
  if (fs.existsSync(assetsSource)) {
    fs.copySync(assetsSource, assetsTarget);
    console.log('✅ Copied renderer assets');
  }

  console.log('🎉 All renderer files copied successfully!');
  
} catch (error) {
  console.error('❌ Failed to copy renderer files:', error.message);
  process.exit(1);
}