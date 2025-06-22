#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Fix renderer files for browser compatibility
function fixRendererFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  const fileName = path.basename(filePath, '.js');
  
  // Remove CommonJS headers
  content = content.replace('"use strict";\n', '');
  content = content.replace('"use strict";\r\n', '');
  content = content.replace('Object.defineProperty(exports, "__esModule", { value: true });\n', '');
  content = content.replace('Object.defineProperty(exports, "__esModule", { value: true });\r\n', '');
  
  // Handle special cases for constants and utilities files that export values
  if (fileName === 'index' && filePath.includes('constants')) {
    // Keep constants exports but convert to window globals
    content = content.replace(/exports\.([A-Z_]+) = /g, 'window.$1 = ');
    content = content.replace(/exports\.CONSTANTS = [^;]+;/, 'window.CONSTANTS = { TIMEOUTS: window.TIMEOUTS, DELAYS: window.DELAYS, LIMITS: window.LIMITS, TIME_CALCULATIONS: window.TIME_CALCULATIONS };');
  } else if (filePath.includes('utils/')) {
    // For utility functions, convert exports to window globals
    content = content.replace(/exports\.([a-zA-Z_][a-zA-Z0-9_]*) = /g, 'window.$1 = ');
  } else {
    // Remove exports for other files
    content = content.replace(/exports\.[^;]+;/g, '');
    content = content.replace(/exports\[[^\]]+\][^;]*;/g, '');
  }
  
  // Convert require statements to window module references
  const requirePattern = /const ([^=]+) = require\("\.\/([^"]+)"\);/g;
  content = content.replace(requirePattern, (match, varName, modulePath) => {
    const moduleBaseName = path.basename(modulePath, '.js');
    // Convert kebab-case to PascalCase for class names
    const className = moduleBaseName.split('-').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join('');
    return `const ${varName} = { ${className}: window.${className} };`;
  });
  
  // Handle parent directory requires (like ../constants)
  const parentRequirePattern = /const ([^=]+) = require\("\.\.\/([^"]+)"\);/g;
  content = content.replace(parentRequirePattern, (match, varName, modulePath) => {
    const moduleBaseName = path.basename(modulePath, '.js');
    if (moduleBaseName === 'constants') {
      return `const ${varName} = window.CONSTANTS;`;
    }
    // Convert kebab-case to PascalCase for class names
    const className = moduleBaseName.split('-').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join('');
    return `const ${varName} = { ${className}: window.${className} };`;
  });
  
  // Handle electron module requires specifically
  content = content.replace(/const \{ ([^}]+) \} = window\.require\('electron'\);/g, '// Electron modules removed - use window.electronAPI instead');
  content = content.replace(/const \{ ([^}]+) \} = require\('electron'\);/g, '// Electron modules removed - use window.electronAPI instead');
  
  // Replace any remaining ipcRenderer references with window.electronAPI
  content = content.replace(/ipcRenderer/g, 'window.electronAPI');
  
  // Handle any remaining require statements
  content = content.replace(/window\.require\([^)]+\)/g, '{}');
  content = content.replace(/require\([^)]+\)/g, '{}');
  
  // Fix electronAPI variable declaration
  content = content.replace(/const electronAPI = window\.electronAPI;/g, 'var electronAPI = window.electronAPI;');
  
  // Fix constants access patterns
  content = content.replace(/constants_1\.TIMEOUTS/g, 'constants_1.TIMEOUTS');
  content = content.replace(/constants_1\.DELAYS/g, 'constants_1.DELAYS');
  content = content.replace(/constants_1\.LIMITS/g, 'constants_1.LIMITS');
  content = content.replace(/constants_1\.TIME_CALCULATIONS/g, 'constants_1.TIME_CALCULATIONS');
  
  // Fix TypeScript compiled function call patterns - only match module function calls
  content = content.replace(/\(0, ([a-zA-Z_]\w*_1)\.([a-zA-Z_]\w*)\)/g, '$1.$2');
  
  // Specifically fix function calls to use window functions
  content = content.replace(/shortcut_formatter_1\.updateShortcutsDisplay/g, 'window.updateShortcutsDisplay');
  content = content.replace(/shortcut_formatter_1\.formatShortcut/g, 'window.formatShortcut');
  content = content.replace(/time_formatter_1\.formatTime/g, 'window.formatTime');
  content = content.replace(/shortcut_parser_1\.matchesShortcutString/g, 'window.matchesShortcutString');
  content = content.replace(/shortcut_parser_1\.parseShortcut/g, 'window.parseShortcut');
  content = content.replace(/shortcut_parser_1\.matchesShortcut/g, 'window.matchesShortcut');
  
  // Fix HistoryUIManager naming in renderer.js
  if (fileName === 'renderer') {
    content = content.replace(/HistoryUiManager: window\.HistoryUiManager/g, 'HistoryUIManager: window.HistoryUIManager');
  }
  
  // Wrap the entire content in an IIFE that exposes the main class to window
  if (fileName === 'renderer') {
    content = `
(function() {
  ${content}
  // Expose PromptLineRenderer globally for initialization
  if (typeof PromptLineRenderer !== 'undefined') {
    window.PromptLineRenderer = PromptLineRenderer;
  }
})();
`;
  } else {
    // For other modules, expose their main class
    const className = fileName.split('-').map((word, index) => 
      index === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join('');
    
    // Special case for history-ui-manager to maintain HistoryUIManager naming
    const actualClassName = fileName === 'history-ui-manager' ? 'HistoryUIManager' : className;
    
    content = `
(function() {
  ${content}
  // Expose ${actualClassName} globally
  if (typeof ${actualClassName} !== 'undefined') {
    window.${actualClassName} = ${actualClassName};
  }
})();
`;
  }
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Fixed renderer file: ${filePath}`);
}

// Special function to fix shortcut-parser with proper object structure
function fixShortcutParserFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  
  // Remove CommonJS headers
  content = content.replace('"use strict";\n', '');
  content = content.replace('"use strict";\r\n', '');
  content = content.replace('Object.defineProperty(exports, "__esModule", { value: true });\n', '');
  content = content.replace('Object.defineProperty(exports, "__esModule", { value: true });\r\n', '');
  
  // Remove any remaining exports statements
  content = content.replace(/exports\.[^;]+;/g, '');
  content = content.replace(/exports\[[^\]]+\][^;]*;/g, '');
  
  // Handle electron module requires specifically
  content = content.replace(/const \{ ([^}]+) \} = window\.require\('electron'\);/g, '// Electron modules removed - use window.electronAPI instead');
  content = content.replace(/const \{ ([^}]+) \} = require\('electron'\);/g, '// Electron modules removed - use window.electronAPI instead');
  
  // Replace any remaining ipcRenderer references with window.electronAPI
  content = content.replace(/ipcRenderer/g, 'window.electronAPI');
  
  // Handle any remaining require statements
  content = content.replace(/window\.require\([^)]+\)/g, '{}');
  content = content.replace(/require\([^)]+\)/g, '{}');
  
  // Fix electronAPI variable declaration
  content = content.replace(/const electronAPI = window\.electronAPI;/g, 'var electronAPI = window.electronAPI;');
  
  // Remove source map comment
  content = content.replace(/\/\/#.*sourceMappingURL=.*\.map/g, '');
  
  // Wrap in IIFE and create proper ShortcutParser object
  content = `
(function() {
  ${content}
  
  // Expose individual functions to window first
  window.parseShortcut = parseShortcut;
  window.matchesShortcut = matchesShortcut;
  window.matchesShortcutString = matchesShortcutString;
  
  // Create ShortcutParser object with all methods
  window.ShortcutParser = {
    parseShortcut: parseShortcut,
    matchesShortcut: matchesShortcut,
    matchesShortcutString: matchesShortcutString
  };
})();
`;
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Fixed shortcut-parser file: ${filePath}`);
}

// Special function to fix shortcut-formatter
function fixShortcutFormatterFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  
  // Remove CommonJS headers and source maps
  content = content.replace('"use strict";\n', '');
  content = content.replace('"use strict";\r\n', '');
  content = content.replace('Object.defineProperty(exports, "__esModule", { value: true });\n', '');
  content = content.replace('Object.defineProperty(exports, "__esModule", { value: true });\r\n', '');
  content = content.replace(/\/\/#.*sourceMappingURL=.*\.map/g, '');
  content = content.replace(/exports\.[^;]+;/g, '');
  content = content.replace(/exports\[[^\]]+\][^;]*;/g, '');
  
  // Wrap in IIFE and create proper object
  content = `
(function() {
  ${content}
  
  // Expose individual functions to window first
  window.formatShortcut = formatShortcut;
  window.updateShortcutsDisplay = updateShortcutsDisplay;
  
  // Create ShortcutFormatter object
  window.ShortcutFormatter = {
    formatShortcut: formatShortcut,
    updateShortcutsDisplay: updateShortcutsDisplay
  };
})();
`;
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Fixed shortcut-formatter file: ${filePath}`);
}

// Special function to fix time-formatter
function fixTimeFormatterFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  
  // Remove CommonJS headers and source maps
  content = content.replace('"use strict";\n', '');
  content = content.replace('"use strict";\r\n', '');
  content = content.replace('Object.defineProperty(exports, "__esModule", { value: true });\n', '');
  content = content.replace('Object.defineProperty(exports, "__esModule", { value: true });\r\n', '');
  content = content.replace(/\/\/#.*sourceMappingURL=.*\.map/g, '');
  content = content.replace(/exports\.[^;]+;/g, '');
  content = content.replace(/exports\[[^\]]+\][^;]*;/g, '');
  
  // Replace require with window.CONSTANTS
  content = content.replace(/const constants_1 = require\("[^"]+"\);/g, 'const constants_1 = window.CONSTANTS;');
  
  // Wrap in IIFE and create proper object
  content = `
(function() {
  ${content}
  
  // Expose individual function to window first
  window.formatTime = formatTime;
  
  // Create TimeFormatter object
  window.TimeFormatter = {
    formatTime: formatTime
  };
})();
`;
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Fixed time-formatter file: ${filePath}`);
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

// Create browser-compatible constants file for renderer
function createBrowserConstants() {
  const destConstantsFile = path.join(__dirname, '..', 'dist', 'renderer', 'constants.js');
  
  // Use a fixed template to avoid parsing issues
  const content = `(function() {
  /**
   * Application constants - centralized location for all magic numbers and configuration values
   */

  // Time-related constants
  window.TIMEOUTS = {
      WINDOW_BLUR_HIDE_DELAY: 150,
      TEXTAREA_FOCUS_DELAY: 50,
      FLASH_ANIMATION_DURATION: 400,
      KEYBOARD_NAVIGATION_TIMEOUT: 3000,
      ERROR_MESSAGE_DURATION: 3000,
      CURRENT_APP_TIMEOUT: 2000,
      NATIVE_PASTE_TIMEOUT: 1500,
      ACCESSIBILITY_CHECK_TIMEOUT: 3000,
      WINDOW_BOUNDS_TIMEOUT: 3000,
      ACTIVATE_PASTE_TIMEOUT: 3000,
      MINIMUM_WINDOW_HIDE_DELAY: 5
  };

  // Delay constants for various operations
  window.DELAYS = {
      DEFAULT_DRAFT_SAVE: 500
  };

  // Size and limit constants
  window.LIMITS = {
      MAX_VISIBLE_ITEMS: 200
  };

  // Time calculation constants
  window.TIME_CALCULATIONS = {
      MILLISECONDS_PER_MINUTE: 60000,
      MILLISECONDS_PER_HOUR: 3600000,
      MILLISECONDS_PER_DAY: 86400000,
      TIMESTAMP_BASE: 36,
      RANDOM_ID_START: 2,
      RANDOM_ID_END: 11
  };

  // Export all constants as a single object for convenience
  window.CONSTANTS = {
      TIMEOUTS: window.TIMEOUTS,
      DELAYS: window.DELAYS,
      LIMITS: window.LIMITS,
      TIME_CALCULATIONS: window.TIME_CALCULATIONS
  };

})();`;
    
    fs.writeFileSync(destConstantsFile, content, 'utf8');
    console.log(`Created browser-compatible constants: ${destConstantsFile}`);
}

createBrowserConstants();

// Fix all renderer files for browser compatibility
const distDir = path.join(__dirname, '..', 'dist', 'renderer');
const rendererFiles = [
  'dom-manager.js',
  'draft-manager.js', 
  'event-handler.js',
  'history-ui-manager.js',
  'lifecycle-manager.js',
  'search-manager.js',
  'ui-manager.js',
  'renderer.js'  // Process renderer.js last as it depends on others
];

rendererFiles.forEach(file => {
  fixRendererFile(path.join(distDir, file));
});

// Also process any utility files that might be needed
const utilFiles = [
  'utils/shortcut-formatter.js',
  'utils/shortcut-parser.js',
  'utils/time-formatter.js'
];

utilFiles.forEach(file => {
  const utilPath = path.join(distDir, file);
  if (fs.existsSync(utilPath)) {
    // Special handling for utility files to create proper objects
    if (file === 'utils/shortcut-parser.js') {
      fixShortcutParserFile(utilPath);
    } else if (file === 'utils/shortcut-formatter.js') {
      fixShortcutFormatterFile(utilPath);
    } else if (file === 'utils/time-formatter.js') {
      fixTimeFormatterFile(utilPath);
    } else {
      fixRendererFile(utilPath);
    }
  }
});

// Copy HTML files
copyHtmlFiles();

// Copy CSS files
copyCssFiles();

console.log('Renderer files fixed for browser compatibility');