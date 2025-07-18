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

  // Check if .NET SDK is available for C# DLL compilation
  const hasDotNet = checkDotNet();
  
  if (!hasDotNet) {
    console.warn('⚠️  Missing .NET SDK - creating placeholders');
    console.warn('   Install .NET 6.0 SDK or later for C# DLL compilation');
    
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
    console.log('   - .NET 6.0 SDK or later');
    console.log('   - PowerShell execution policy allows script execution');
    return;
  }

  // Build C# DLL instead of executables
  console.log('🔨 Building C# DLL for Windows native tools...');
  
  // Check if .NET SDK is available
  try {
    execSync('dotnet --version', { stdio: 'ignore' });
  } catch (error) {
    console.log('❌ .NET SDK not found. Please install .NET 6.0 SDK or later');
    console.log('   Download from: https://dotnet.microsoft.com/download');
    process.exit(1);
  }

  // Build C# DLL
  const nativeWinDir = path.join(__dirname, '..', 'native-win');
  const buildScript = path.join(nativeWinDir, 'build.ps1');

  try {
    console.log('🔨 Building WindowDetector.dll...');
    execSync(`powershell -ExecutionPolicy Bypass -File "${buildScript}"`, { 
      cwd: nativeWinDir,
      stdio: 'inherit'
    });
    console.log('✅ Windows native tools built successfully!');
  } catch (error) {
    console.log('❌ Failed to build Windows native tools:', error.message);
    
    // Create placeholder executables as fallback
    fs.ensureDirSync(nativeToolsDir);
    const tools = [
      'window-detector.exe',
      'keyboard-simulator.exe',
      'text-field-detector.exe'
    ];
    
    for (const tool of tools) {
      const toolPath = path.join(nativeToolsDir, tool);
      fs.writeFileSync(toolPath, '# Windows native tool placeholder\n');
      console.log(`📝 Created placeholder: ${tool}`);
    }
    
    console.log('ℹ️  To build actual native tools, ensure:');
    console.log('   - .NET 6.0 SDK is installed');
    console.log('   - PowerShell execution policy allows script execution');
    console.log('   - Run: Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser');
  }
  
} catch (error) {
  console.error('❌ Failed to build Windows native tools:', error.message);
  process.exit(1);
}

function checkDotNet() {
  try {
    execSync('dotnet --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
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