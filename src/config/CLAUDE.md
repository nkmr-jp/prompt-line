# Configuration Module

This module provides centralized configuration management for the Prompt Line application with a comprehensive, type-safe configuration system using a singleton pattern.

## Files

### app-config.ts
Comprehensive AppConfigClass providing centralized configuration management through a singleton instance exported as default.

**Window Configuration:**
```typescript
window: {
  width: 600,
  height: 300,
  frame: false,
  transparent: false,           // Updated: Set to non-transparent
  backgroundColor: '#141414',   // Dark background color
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
  userDataDir: path.join(os.homedir(), '.prompt-line'),
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
  main: 'Cmd+Shift+Space',      // Primary app activation
  paste: 'Cmd+Enter',           // Paste and close action
  close: 'Escape',              // Close window action
  historyNext: 'Ctrl+j',        // Navigate to next history item
  historyPrev: 'Ctrl+k'         // Navigate to previous history item
}
```

**Performance & Timing Configuration:**
```typescript
history: {
  saveInterval: 1000   // Batch save optimization (milliseconds)
},
draft: {
  saveDelay: 500       // Auto-save debounce timing (milliseconds)
},
timing: {
  windowHideDelay: 10, // Window hide animation timing (milliseconds)
  appFocusDelay: 50    // App switching delay for stability (milliseconds)
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
  level: (process.env.NODE_ENV === 'development' ? 'debug' : 'info') as LogLevel,
  enableFileLogging: true,
  maxLogFileSize: 5 * 1024 * 1024,  // 5MB
  maxLogFiles: 3                     // Rotation limit
}
```

## Key Responsibilities

### Configuration Architecture
- **Singleton Pattern**: Single instance exported as default for consistent access across the application
- **Type Safety**: Comprehensive TypeScript interfaces defined in `src/types/index.ts` ensure type safety
- **Environment Awareness**: Dynamic behavior based on NODE_ENV for logging levels
- **Cross-platform Compatibility**: Platform-specific path and feature handling using `os.homedir()` and `process.platform`
- **Performance Optimization**: Getter-based lazy evaluation for path generation

### Dynamic Configuration System
The AppConfigClass provides several utility methods for accessing configuration:

```typescript
class AppConfigClass {
  // Generic section access with type safety
  get<K extends keyof this>(section: K): this[K] {
    return this[section] || {} as this[K];
  }
  
  // Dot-notation path access for nested values
  getValue(path: string): unknown {
    return path.split('.').reduce((obj, key) => 
      obj && (obj as Record<string, unknown>)[key], this as unknown
    );
  }
  
  // Environment detection utilities
  isDevelopment(): boolean {
    return process.env.NODE_ENV === 'development';
  }
  
  isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  }
  
  // HTML path resolution for renderer process
  getInputHtmlPath(): string {
    // In production, HTML file is copied to dist/renderer directory
    // __dirname is dist/config
    return path.join(__dirname, '..', 'renderer', 'input.html');
  }
}
```

### Initialization Process
The configuration is initialized through a private `init()` method called in the constructor:

1. **Window Configuration**: Sets up Electron BrowserWindow options with security and performance optimizations
2. **Keyboard Shortcuts**: Defines global shortcuts including new history navigation shortcuts (`Ctrl+j`, `Ctrl+k`)
3. **Path Management**: Creates getter-based path system for all application data files
4. **Timing Configuration**: Sets debounce and delay values for optimal performance
5. **Platform Detection**: Determines runtime platform for conditional behavior
6. **Logging Setup**: Configures logging levels based on environment

### Path Management Strategy
- **User Data Directory**: `~/.prompt-line` for all application data (uses `os.homedir()`)
- **Getter-based Paths**: Dynamic path generation for flexibility and cross-platform compatibility
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

// New history navigation shortcuts
console.log(config.shortcuts.historyNext); // 'Ctrl+j'
console.log(config.shortcuts.historyPrev); // 'Ctrl+k'
```

### Dynamic Configuration Access
```typescript
// Generic section access
const draftConfig = config.get('draft');
const timingConfig = config.get('timing');

// Dot-notation value access
const saveDelay = config.getValue('draft.saveDelay');
const saveInterval = config.getValue('history.saveInterval');
const windowHideDelay = config.getValue('timing.windowHideDelay');

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

// Window appearance
const backgroundColor = config.window.backgroundColor; // '#141414'
const isTransparent = config.window.transparent; // false
```

## Type Safety and Integration

### TypeScript Integration
The configuration system uses comprehensive TypeScript interfaces defined in `src/types/index.ts`:

- `WindowConfig`: Electron BrowserWindow configuration
- `ShortcutsConfig`: Keyboard shortcut definitions
- `PathsConfig`: File path configurations
- `HistoryConfig`, `DraftConfig`, `TimingConfig`: Performance settings
- `AppConfig`: Application metadata
- `PlatformConfig`: Platform detection
- `LoggingConfig`: Logging configuration with `LogLevel` union type

### Manager Integration
The configuration is used throughout the application:

```typescript
// In HistoryManager
import config from '../config/app-config';
const saveInterval = config.history.saveInterval;

// In WindowManager
const windowOptions = config.window;
const position = config.window.position;

// In DraftManager
const saveDelay = config.draft.saveDelay;
```

### Real-world Usage Examples
```typescript
// Main process window creation
const window = new BrowserWindow({
  ...config.window,
  webPreferences: {
    ...config.window.webPreferences
  }
});

// Renderer process keyboard handling
electron.ipcRenderer.on('shortcut-pressed', (event, shortcut) => {
  if (shortcut === config.shortcuts.historyNext) {
    navigateHistory(1);
  } else if (shortcut === config.shortcuts.historyPrev) {
    navigateHistory(-1);
  }
});
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
  
  it('should include new history navigation shortcuts', () => {
    expect(config.shortcuts.historyNext).toBe('Ctrl+j');
    expect(config.shortcuts.historyPrev).toBe('Ctrl+k');
  });
});
```

### Path Generation Testing
- **Getter Functionality**: Verify path getters return correct absolute paths
- **Cross-platform Paths**: Test path generation on different operating systems using `os.homedir()`
- **Directory Structure**: Validate user data directory creation and access
- **HTML Path Resolution**: Verify correct renderer HTML file path resolution

### Environment Testing
```typescript
// Environment detection
it('should detect development environment', () => {
  process.env.NODE_ENV = 'development';
  expect(config.isDevelopment()).toBe(true);
  expect(config.isProduction()).toBe(false);
  expect(config.logging.level).toBe('debug');
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
- **Performance Impact**: Measure configuration access performance with getter-based paths