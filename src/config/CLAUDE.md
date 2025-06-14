# Configuration Module

This module handles application configuration settings and constants with a comprehensive, type-safe configuration system.

## Files

### app-config.ts
Comprehensive AppConfigClass providing centralized configuration management:

**Window Configuration:**
```typescript
window: {
  width: 600,
  height: 300,
  frame: false,
  transparent: true,
  alwaysOnTop: true,
  skipTaskbar: true,
  resizable: false,
  webPreferences: {
    nodeIntegration: true,        // Required for renderer IPC
    contextIsolation: false,      // Disabled for legacy compatibility
    webSecurity: false,           // Disabled for local file access
    spellcheck: false,           // Disabled for performance
    disableDialogs: true,        // Prevent unwanted dialogs
    enableWebSQL: false,         // Disabled for security
    experimentalFeatures: false, // Stable feature set only
    defaultEncoding: 'UTF-8',   // Consistent text encoding
    offscreen: false,            // Disable offscreen rendering
    enablePreferredSizeMode: false,  // Disable preferred size mode
    disableHtmlFullscreenWindowResize: true  // Prevent fullscreen resize
  }
}
```

**Path Management System:**
```typescript
paths: {
  userDataDir: '~/.prompt-line',
  get historyFile() { return path.join(userDataDir, 'history.jsonl'); },
  get draftFile() { return path.join(userDataDir, 'draft.json'); },
  get logFile() { return path.join(userDataDir, 'app.log'); },
  get imagesDir() { return path.join(userDataDir, 'images'); }
}
```
- **Dynamic Path Generation**: Getter-based path construction for flexibility
- **Cross-platform Compatibility**: Uses `os.homedir()` and `path.join()`
- **Centralized Location**: Single user data directory for all app files

**Keyboard Shortcuts:**
```typescript
shortcuts: {
  main: 'Cmd+Shift+Space',  // Primary app activation
  paste: 'Cmd+Enter',       // Paste and close action
  close: 'Escape'           // Close window action
}
```

**Performance & Timing Configuration:**
```typescript
history: {
  maxItems: 50,        // Memory and file size management
  saveInterval: 1000   // Batch save optimization
},
draft: {
  saveDelay: 500       // Auto-save debounce timing
},
timing: {
  windowHideDelay: 10, // Window hide animation timing
  appFocusDelay: 50    // App switching delay for stability
}
```

**Application Metadata:**
```typescript
app: {
  name: 'Prompt Line',
  version: packageJson.version,  // Dynamic version from package.json
  description: 'プロンプトラインアプリ - カーソル位置にテキストを素早く貼り付け'
}
```

**Platform Detection:**
```typescript
platform: {
  isMac: process.platform === 'darwin',
  isWindows: process.platform === 'win32',
  isLinux: process.platform === 'linux'
}
```

**Logging System:**
```typescript
logging: {
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  enableFileLogging: true,
  maxLogFileSize: 5 * 1024 * 1024,  // 5MB
  maxLogFiles: 3                     // Rotation limit
}
```

## Key Responsibilities

### Configuration Architecture
- **Singleton Pattern**: Single instance exported as default for consistent access
- **Type Safety**: Comprehensive TypeScript interfaces for all configuration sections
- **Environment Awareness**: Dynamic behavior based on NODE_ENV
- **Cross-platform Compatibility**: Platform-specific path and feature handling
- **Performance Optimization**: Getter-based lazy evaluation for expensive operations

### Dynamic Configuration System
```typescript
class AppConfigClass {
  get<K extends keyof this>(section: K): this[K] {
    return this[section] || {} as this[K];
  }
  
  getValue(path: string): unknown {
    return path.split('.').reduce((obj, key) => 
      obj && (obj as Record<string, unknown>)[key], this as unknown
    );
  }
  
  isDevelopment(): boolean {
    return process.env.NODE_ENV === 'development';
  }
  
  isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  }
  
  getInputHtmlPath(): string {
    return path.join(__dirname, '..', 'renderer', 'input.html');
  }
}
```

### Path Management Strategy
- **User Data Directory**: `~/.prompt-line` for all application data
- **Getter-based Paths**: Dynamic path generation for flexibility
- **File Type Organization**:
  - `history.jsonl`: JSONL format for efficient append operations
  - `draft.json`: JSON format for structured draft data
  - `app.log`: Plain text for logging output
  - `images/`: Directory for pasted images

## Usage Patterns

### Basic Configuration Access
```typescript
import config from '../config/app-config';

// Section access
const windowConfig = config.window;
const shortcuts = config.shortcuts;

// Path access with getters
const historyFile = config.paths.historyFile;
const draftFile = config.paths.draftFile;

// Environment detection
if (config.isDevelopment()) {
  console.log('Development mode');
}

// Platform detection
if (config.platform.isMac) {
  // macOS-specific code
}
```

### Dynamic Configuration Access
```typescript
// Generic section access
const draftConfig = config.get('draft');

// Dot-notation value access
const saveDelay = config.getValue('draft.saveDelay');
const maxItems = config.getValue('history.maxItems');

// HTML path resolution
const inputHtmlPath = config.getInputHtmlPath();
```

### Environment-Specific Behavior
```typescript
// Logging level based on environment
const logLevel = config.logging.level; // 'debug' in dev, 'info' in prod

// Performance settings
const isDev = config.isDevelopment();
const enableVerboseLogging = isDev;
const enableDevTools = isDev;
```

## Testing Strategy

### Configuration Validation
```typescript
describe('AppConfig', () => {
  it('should have all required sections', () => {
    expect(config.window).toBeDefined();
    expect(config.shortcuts).toBeDefined();
    expect(config.paths).toBeDefined();
    expect(config.history).toBeDefined();
    expect(config.draft).toBeDefined();
    expect(config.timing).toBeDefined();
    expect(config.app).toBeDefined();
    expect(config.platform).toBeDefined();
    expect(config.logging).toBeDefined();
  });
});
```

### Path Generation Testing
- **Getter Functionality**: Verify path getters return correct absolute paths
- **Cross-platform Paths**: Test path generation on different operating systems
- **Directory Structure**: Validate user data directory creation and access
- **HTML Path Resolution**: Verify correct renderer HTML file path

### Environment Testing
```typescript
// Environment detection
it('should detect development environment', () => {
  process.env.NODE_ENV = 'development';
  expect(config.isDevelopment()).toBe(true);
  expect(config.isProduction()).toBe(false);
});

// Platform detection
it('should detect platform correctly', () => {
  if (process.platform === 'darwin') {
    expect(config.platform.isMac).toBe(true);
  }
});
```

### Dynamic Access Testing
- **Section Access**: Test `get()` method with valid and invalid sections
- **Value Access**: Test `getValue()` with dot notation paths
- **Error Handling**: Verify graceful handling of missing configuration keys
- **Type Safety**: Validate TypeScript interfaces match runtime structure

### Integration Testing
- **Manager Integration**: Test configuration usage in manager classes
- **Path Validation**: Verify all file paths are accessible and writable
- **Settings Coordination**: Test interaction with SettingsManager
- **Performance Impact**: Measure configuration access performance