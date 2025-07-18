#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Windows native tools build script
 * Builds Windows-specific native tools for the application
 */

console.log('🪟 Building Windows native tools...');

const platform = process.platform;
const nativeToolsDir = path.join('src', 'native-tools');

try {
  // Ensure we're on Windows or allow cross-compilation
  if (platform !== 'win32') {
    console.log('ℹ️  Not on Windows platform - creating placeholder native tools');
    
    // Create placeholder native tools directory
    fs.ensureDirSync(nativeToolsDir);
    
    // Create placeholder executables (these will be replaced with actual Windows binaries)
    const placeholderTools = [
      'window-detector.exe',
      'keyboard-simulator.exe',
      'text-field-detector.exe'
    ];
    
    for (const tool of placeholderTools) {
      const toolPath = path.join(nativeToolsDir, tool);
      fs.writeFileSync(toolPath, '# Windows native tool placeholder\n');
      console.log(`📝 Created placeholder: ${tool}`);
    }
    
    console.log('✅ Windows native tools placeholders created');
    return;
  }

  // Check if Windows development tools are available
  const hasVisualStudio = checkVisualStudio();
  const hasNodeGyp = checkNodeGyp();
  
  if (!hasVisualStudio || !hasNodeGyp) {
    console.warn('⚠️  Missing Windows development tools - creating placeholders');
    console.warn('   Install Visual Studio Build Tools and node-gyp for native compilation');
    
    // Create placeholder tools for now
    fs.ensureDirSync(nativeToolsDir);
    const placeholderTools = [
      'window-detector.exe',
      'keyboard-simulator.exe', 
      'text-field-detector.exe'
    ];
    
    for (const tool of placeholderTools) {
      const toolPath = path.join(nativeToolsDir, tool);
      fs.writeFileSync(toolPath, '# Windows native tool placeholder\n');
      console.log(`📝 Created placeholder: ${tool}`);
    }
    
    console.log('ℹ️  To build actual native tools, install:');
    console.log('   npm install -g node-gyp');
    console.log('   npm install -g windows-build-tools');
    return;
  }

  // TODO: Implement actual Windows native tools compilation
  console.log('🚧 Windows native tools compilation not yet implemented');
  console.log('    This will compile C++ tools using node-gyp and Windows API');
  
  // For now, create placeholder tools
  fs.ensureDirSync(nativeToolsDir);
  const tools = [
    'window-detector.exe',
    'keyboard-simulator.exe',
    'text-field-detector.exe'
  ];
  
  for (const tool of tools) {
    const toolPath = path.join(nativeToolsDir, tool);
    fs.writeFileSync(toolPath, '# Windows native tool - to be implemented\n');
    console.log(`📝 Created: ${tool}`);
  }
  
  console.log('✅ Windows native tools build completed (placeholders)');
  
} catch (error) {
  console.error('❌ Failed to build Windows native tools:', error.message);
  process.exit(1);
}

function checkVisualStudio() {
  try {
    execSync('where cl', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function checkNodeGyp() {
  try {
    execSync('node-gyp --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}