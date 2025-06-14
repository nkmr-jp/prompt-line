#!/usr/bin/env node

// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require('fs');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('path');

// Fix renderer files for browser compatibility
function fixRendererFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  
  // Remove CommonJS exports that break browser compatibility
  content = content.replace('"use strict";\nObject.defineProperty(exports, "__esModule", { value: true });\n', '');
  content = content.replace('"use strict";\r\nObject.defineProperty(exports, "__esModule", { value: true });\r\n', '');
  
  // Remove any remaining exports statements
  content = content.replace(/exports\.[^;]+;/g, '');
  content = content.replace(/exports\[[^\]]+\][^;]*;/g, '');
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Fixed renderer file: ${filePath}`);
}

// Copy HTML file to dist directory
function copyHtmlFiles() {
  const srcHtml = path.join(__dirname, '..', 'src', 'renderer', 'input.html');
  const distRendererDir = path.join(__dirname, '..', 'dist', 'renderer');
  const destHtml = path.join(distRendererDir, 'input.html');
  
  if (!fs.existsSync(distRendererDir)) {
    fs.mkdirSync(distRendererDir, { recursive: true });
  }
  
  if (fs.existsSync(srcHtml)) {
    fs.copyFileSync(srcHtml, destHtml);
    console.log(`Copied HTML file: ${srcHtml} → ${destHtml}`);
  } else {
    console.error(`HTML file not found: ${srcHtml}`);
  }
}

// Copy CSS styles directory to dist directory
function copyCssFiles() {
  const srcStylesDir = path.join(__dirname, '..', 'src', 'renderer', 'styles');
  const distRendererDir = path.join(__dirname, '..', 'dist', 'renderer');
  const destStylesDir = path.join(distRendererDir, 'styles');
  
  if (!fs.existsSync(distRendererDir)) {
    fs.mkdirSync(distRendererDir, { recursive: true });
  }
  
  if (fs.existsSync(srcStylesDir)) {
    // Copy entire styles directory recursively
    copyDirSync(srcStylesDir, destStylesDir);
    console.log(`Copied CSS styles: ${srcStylesDir} → ${destStylesDir}`);
  } else {
    console.error(`Styles directory not found: ${srcStylesDir}`);
  }
}

// Helper function to copy directory recursively
function copyDirSync(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Fix both renderer files
const distDir = path.join(__dirname, '..', 'dist', 'renderer');
fixRendererFile(path.join(distDir, 'renderer.js'));
fixRendererFile(path.join(distDir, 'ui-manager.js'));

// Copy HTML files
copyHtmlFiles();

// Copy CSS files
copyCssFiles();

console.log('Renderer files fixed for browser compatibility');