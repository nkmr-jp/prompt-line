# Utils Module

    This module contains shared utility functions used across the application with comprehensive system integration and native tools support.

## Files

### utils.ts
Comprehensive utility module with native tool integration and performance optimization for macOS systems:

### apple-script-sanitizer.ts
Security-focused AppleScript sanitization and execution module providing comprehensive protection against script injection attacks:

**Core Security Functions:**
```typescript
function sanitizeAppleScript(input: string): string {
  // Comprehensive input sanitization
  // Length limits: 64KB maximum to prevent DoS attacks
  // Character escaping: Quotes, backslashes, special characters
  // Pattern detection: Identifies dangerous operations
}

function executeAppleScriptSafely(script: string, timeout = 3000): Promise<string> {
  // Wrapper with sanitization and timeout handling
  // Automatic input sanitization before execution
  // Configurable timeout protection
  // Error isolation and recovery
}

function validateAppleScriptSecurity(script: string): { isValid: boolean; issues: string[] } {
  // Security validation with pattern detection
  // Identifies dangerous operations (shell scripts, file deletion, credential access)
  // Returns validation results with specific security issues
}
```

**Security Features:**
- **Input Sanitization**: 64KB length limits prevent DoS attacks
- **Character Escaping**: Comprehensive escaping of quotes, backslashes, and special characters
- **Pattern Detection**: Identifies dangerous operations like shell scripts and file access
- **Timeout Protection**: Configurable timeout (default 3 seconds) prevents hanging
- **Error Isolation**: AppleScript failures don't affect main process
- **Validation System**: Pre-execution security checks with detailed issue reporting

**Threat Protection:**
- **Script Injection**: Input sanitization prevents malicious script execution
- **Command Injection**: Character escaping prevents shell command injection
- **DoS Prevention**: Length limits and timeout protection
- **File System Protection**: Pattern detection prevents unauthorized file operations
- **Credential Protection**: Detects attempts to access keychain or passwords

### utils.ts (continued)
Comprehensive utility module with native tool integration and performance optimization for macOS systems:

**Logger Class:**
```typescript
class Logger {
  private level: LogLevel = 'info';
  private enableFileLogging: boolean = true;
  private logFile: string;
  
  constructor() {
    this.logFile = path.join(os.homedir(), '.prompt-line', 'app.log');
    this.initializeConfig();
  }
  
  log(level: LogLevel, message: string, data?: unknown): void {
    // Console output with level filtering
    // Non-blocking file append operations  
    // Structured logging with ISO timestamps
  }
}
```
- **Level-based Filtering**: debug, info, warn, error with configurable thresholds
- **Dual Output**: Console and file logging with independent control
- **Performance**: Non-blocking file writes using `fs.appendFile()` without await
- **Structured Data**: JSON serialization for complex data objects
- **ISO Timestamps**: Consistent timestamp formatting across all log entries
- **Dynamic Configuration**: Loads config from app-config module with fallback defaults
- **Circular Dependency Prevention**: Safe initialization to avoid dependency issues

**Native Tools Integration:**
```typescript
function getNativeToolsPath(): string {
  // Handle both packaged and development modes
  // In packaged mode: resources/app.asar.unpacked/dist/native-tools
  // Development mode: src/native-tools
}
```
- **Path Resolution**: Dynamic path resolution for packaged vs development environments
- **Native Executables**: Uses compiled native tools for security and performance
- **Window Detector**: `window-detector` binary for window bounds and app detection
- **Keyboard Simulator**: `keyboard-simulator` binary for secure paste operations
- **Text Field Detector**: `text-field-detector` binary for focused text field positioning

**macOS Native App Detection:**
```typescript
function getCurrentApp(): Promise<AppInfo | null> {
  // Uses native window-detector tool with JSON output:
  // exec('"${WINDOW_DETECTOR_PATH}" current-app', ...)
  // Returns: {"name": "Terminal", "bundleId": "com.apple.Terminal"}
}
```
- **Native Tool Integration**: Uses compiled window-detector for secure app detection
- **JSON Communication**: Structured data exchange prevents parsing vulnerabilities
- **Error Recovery**: Graceful fallback for apps without bundle identifiers  
- **Timeout Protection**: 2-second timeout to prevent hanging
- **Platform Check**: Direct platform check to avoid config dependencies

**Native Paste Operations:**
```typescript
function pasteWithNativeTool(): Promise<void> {
  // Simple paste using keyboard-simulator:
  // exec('"${KEYBOARD_SIMULATOR_PATH}" paste', ...)
}

function activateAndPasteWithNativeTool(appInfo: AppInfo | string): Promise<void> {
  // Atomic app activation and paste:
  // Uses bundle ID when available for precision
  // Fallbacks to app name when bundle ID unavailable
}
```
- **Atomic Operations**: Combined app activation and paste to prevent race conditions
- **Security**: Native tools eliminate script injection vulnerabilities
- **Bundle ID Support**: Precise app targeting using bundle identifiers
- **Fallback Strategy**: Graceful degradation from bundle ID to app name
- **Timeout Handling**: Comprehensive timeout and error recovery

**Window Bounds Detection:**
```typescript
function getActiveWindowBounds(): Promise<WindowBounds | null> {
  // Uses native window-detector tool:
  // exec('"${WINDOW_DETECTOR_PATH}" window-bounds', ...)
  // Returns: {"x": 100, "y": 200, "width": 800, "height": 600}
}
```
- **Native Implementation**: Uses compiled tool for reliable window detection
- **JSON Output**: Structured data format with numeric validation
- **Error Recovery**: Returns `null` on parsing failures, triggering cursor fallback
- **Timeout Protection**: 3-second timeout prevents hanging on unresponsive apps
- **Validation**: Checks for valid numeric values in window bounds
- **Debug Logging**: Comprehensive logging for troubleshooting window detection

**Accessibility Permission Management:**
```typescript
function checkAccessibilityPermission(): Promise<AccessibilityStatus> {
  // AppleScript-based accessibility permission check
  // Tests actual accessibility functions to verify permissions
  // Returns bundle ID information for system preferences
}
```
- **Permission Verification**: Tests actual accessibility functions rather than just querying
- **Bundle ID Detection**: Retrieves app bundle ID for system preference navigation
- **Multiple Fallbacks**: Multiple AppleScript approaches for reliable detection
- **Error Recovery**: Graceful handling of permission-related errors

**Safe Operations Suite:**
```typescript
function safeJsonParse<T = unknown>(jsonString: string, fallback?: T): T | null {
  // Generic type support with optional fallback
  // Nullish coalescing for clean fallback handling
}

function safeJsonStringify(obj: unknown, fallback = '{}'): string {
  // Pretty printing with 2-space indentation
  // Comprehensive error handling with logging
}
```
- **Type Safety**: Generic type support for compile-time safety
- **Nullish Coalescing**: Modern JavaScript patterns for clean fallback handling
- **Error Handling**: Comprehensive error catching with logging
- **Pretty Printing**: JSON formatting with 2-space indentation

**File System Utilities:**
```typescript
async function ensureDir(dirPath: string): Promise<void> {
  // ENOENT-specific error handling for missing directories
  // Recursive directory creation with performance optimization
}

async function fileExists(filePath: string): Promise<boolean> {
  // Simple boolean file existence check
  // Uses fs.access for efficient existence testing
}
```
- **Directory Creation**: Recursive directory creation with existence checking
- **Error Differentiation**: Distinguish between missing directories and permission errors
- **Performance**: Avoid unnecessary operations when directories exist
- **Boolean Utility**: Clean boolean file existence checking

**Performance Utilities:**
```typescript
function debounce<T extends unknown[]>(
  func: (...args: T) => void, 
  wait: number, 
  immediate = false
): DebounceFunction<T> {
  // Generic debouncing with immediate execution support
  // Proper context binding with 'this' preservation
}

function throttle<T extends unknown[]>(
  func: (...args: T) => void, 
  wait: number
): (...args: T) => void {
  // Leading-edge throttling implementation
  // Time-based execution control
}
```
- **Generic Functions**: Type-safe debouncing and throttling for any function signature
- **Context Preservation**: Proper `this` binding for method calls
- **Immediate Mode**: Option for immediate execution with trailing debounce
- **Memory Management**: Proper timeout cleanup to prevent memory leaks
- **Leading Edge**: Throttle executes immediately then waits

## Key Utilities

### Logger System
**Comprehensive Logging:**
```typescript
logger.debug('Detailed debug info', { context: 'specific operation' });
logger.info('General information', { count: 5, status: 'success' });
logger.warn('Warning condition', { reason: 'timeout', attempt: 3 });
logger.error('Error occurred', { error: errorObject, stack: true });
```
- **Structured Logging**: JSON data support for complex debugging scenarios
- **Performance**: Non-blocking file operations prevent UI freezing
- **Dynamic Configuration**: Loads from app-config module with safe fallbacks
- **File Management**: Automatic log file creation in ~/.prompt-line/app.log
- **Console Methods**: Uses appropriate console methods (debug, info, warn, error)
- **ISO Timestamps**: Consistent [ISO timestamp] [LEVEL] message format

### File System Operations
**Directory Management:**
```typescript
await ensureDir('/path/to/directory');  // Creates if missing
const exists = await fileExists('/path/to/file');  // Boolean check
```
- **Recursive Creation**: `fs.mkdir({ recursive: true })` for deep directory structures
- **Error Handling**: Distinguish ENOENT from permission errors with proper type assertions
- **Performance**: fs.access existence checks before creation attempts
- **Debug Logging**: Logs directory creation for troubleshooting

**Safe JSON Operations:**
```typescript
// Type-safe parsing with optional fallback
const config = safeJsonParse<ConfigType>(data, defaultConfig);
const result = safeJsonParse(data); // Returns null if no fallback provided

// Safe stringification with error recovery
const jsonString = safeJsonStringify(object, '{}');
```
- **Type Safety**: Generic type support with default unknown type
- **Nullish Coalescing**: Modern ?? operator for clean fallback handling
- **Error Recovery**: Graceful handling of circular references and invalid data
- **Logging**: Automatic error logging for debugging
- **Pretty Printing**: 2-space indentation for readable output

### macOS Native Tools Integration
**Application Detection:**
```typescript
interface AppInfo {
  name: string;
  bundleId?: string | null;
}

const currentApp = await getCurrentApp();
// Returns: { name: "Terminal", bundleId: "com.apple.Terminal" }
```
- **Native Tool Integration**: Uses compiled window-detector binary for security
- **JSON Communication**: Structured data exchange prevents parsing attacks
- **Error Resilience**: Handles apps without bundle identifiers
- **Timeout Protection**: 2-second timeout prevents hanging
- **Platform Safety**: Direct platform check avoids config dependencies

**Paste Operations:**
```typescript
// Simple paste (current app)
await pasteWithNativeTool();

// Activate app and paste (specific app)
await activateAndPasteWithNativeTool(appInfo);
```
- **Native Security**: Compiled binaries eliminate script injection vulnerabilities
- **Atomic Operations**: Combined activation and paste for reliability
- **Bundle ID Priority**: Uses bundle ID when available, falls back to app name
- **Timeout Handling**: Graceful timeout recovery with fallback to simple paste
- **JSON Response**: Structured success/error reporting from native tools

**Security Features:**
- **Native Tools**: Compiled binaries eliminate script injection vulnerabilities
- **JSON Communication**: Structured data exchange prevents parsing attacks
- **Input Validation**: Type-safe parameters with runtime validation
- **Timeout Protection**: All operations have configurable timeout limits
- **Error Isolation**: Native tool failures don't affect main process
- **No Script Interpretation**: Direct binary execution eliminates script injection risks
- **Path Security**: Quoted executable paths prevent path injection
- **Signal Handling**: Proper SIGTERM handling for clean process termination

### System Utilities
**Performance Optimization:**
```typescript
// Debouncing for frequent operations
const debouncedSave = debounce(saveFunction, 500);
// Note: Current implementation doesn't include cancel method

// Throttling for rate limiting (leading-edge)
const throttledUpdate = throttle(updateFunction, 100);

// Timing utilities
await sleep(100); // Promise-based delay
```

**ID Generation:**
```typescript
const uniqueId = generateId();
// Returns: "abc123xyz789" (lowercase alphanumeric)
```
- **Format**: Lowercase alphanumeric using base-36 encoding
- **Uniqueness**: Timestamp + random components for collision avoidance
- **Base-36 Encoding**: Uses TIME_CALCULATIONS.TIMESTAMP_BASE constant
- **Validation**: Coordinated with IPC handlers for security
- **Implementation Note**: ID validation in ipc-handlers.ts depends on this format

**Time Utilities:**
```typescript
const timeAgo = formatTimeAgo(timestamp);
// Returns: "Just now", "5m ago", "2h ago", "3d ago"
```
- **Relative Formatting**: Human-readable relative timestamps
- **Performance**: Efficient calculation using TIME_CALCULATIONS constants
- **Granular Thresholds**: Minutes < 1 (Just now), < 60 (Xm ago), < 24h (Xh ago), else (Xd ago)
- **Consistent Constants**: Uses TIME_CALCULATIONS for millisecond conversions

## Implementation Patterns

### Error Handling Architecture
```typescript
// Promise-based operations with comprehensive error handling
try {
  const result = await someAsyncOperation();
  logger.debug('Operation successful', { result });
  return result;
} catch (error) {
  logger.error('Operation failed', { error, context: 'specific operation' });
  throw new Error(`Operation failed: ${(error as Error).message}`);
}
```
- **Error Propagation**: Structured error handling with context preservation
- **Logging Integration**: Automatic error logging with contextual information
- **Type Safety**: Error type assertions for proper error handling
- **Graceful Degradation**: Null returns for non-critical failures, fallback strategies
- **Non-blocking Warnings**: Uses logger.warn for recoverable errors

### Logger Implementation Details
```typescript
class Logger {
  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = { 
      debug: 0, info: 1, warn: 2, error: 3 
    };
    return levels[level] >= levels[this.level];
  }
  
  private getConsoleMethod(level: LogLevel): typeof console.log {
    // Uses appropriate console method for each log level
    switch (level) {
      case 'debug': return console.debug;
      case 'info': return console.info;
      case 'warn': return console.warn;
      case 'error': return console.error;
      default: return console.log;
    }
  }
  
  private writeToFile(message: string, data: unknown): void {
    const fullMessage = data ? `${message} ${JSON.stringify(data)}\n` : `${message}\n`;
    fs.appendFile(this.logFile, fullMessage).catch(err => {
      console.error('Failed to write to log file:', err);
    });
  }
}
```
- **Performance**: Non-blocking file writes with error recovery
- **Level Filtering**: Numeric level comparison for efficient filtering
- **Console Method Mapping**: Uses appropriate console methods for each level
- **Structured Output**: JSON serialization for complex data objects
- **Error Recovery**: Fallback to console for file write failures
- **Type Safety**: Proper Record type for level mapping

### Native Tools Integration Patterns
**Security-First Design:**
```typescript
// Native tool execution with JSON communication
const command = `"${KEYBOARD_SIMULATOR_PATH}" activate-and-paste-bundle "${bundleId}"`;
exec(command, options, (error, stdout, stderr) => {
  if (error) {
    // Handle timeout and error scenarios
  } else {
    const result = JSON.parse(stdout.trim());
    if (result.success) {
      // Handle success
    }
  }
});
```
- **Binary Execution**: Uses compiled native tools instead of script interpretation
- **Quoted Paths**: All executable paths are properly quoted for security
- **JSON Communication**: Structured data exchange prevents parsing vulnerabilities
- **Error Isolation**: Native tool failures don't affect main process

**Performance Optimization:**
```typescript
// Native tool with timeout and error handling
const options = {
  timeout: TIMEOUTS.CURRENT_APP_TIMEOUT,
  killSignal: 'SIGTERM' as const
};

exec(`"${WINDOW_DETECTOR_PATH}" current-app`, options, (error, stdout) => {
  if (error) {
    if (error.killed) {
      // Handle timeout scenario
    }
    // Other error handling
  }
});
```
- **Atomic Operations**: Single native tool call with structured JSON response
- **Timeout Management**: Configurable timeouts with SIGTERM signal handling
- **Error Recovery**: Comprehensive error handling with logging
- **Signal Safety**: Proper process termination with killSignal option

### Performance Considerations
**Async Operation Optimization:**
- **Non-blocking I/O**: All file operations use async patterns with fs.promises
- **Promise Chaining**: Proper async/await usage for readable code
- **Error Boundaries**: Isolated error handling prevents cascade failures
- **Resource Cleanup**: Proper timeout and signal handling for process cleanup
- **Native Tools**: Compiled binaries provide better performance than script execution

**Memory Management:**
```typescript
function debounce<T extends unknown[]>(
  func: (...args: T) => void, 
  wait: number, 
  immediate = false
): DebounceFunction<T> {
  let timeout: NodeJS.Timeout | undefined;
  
  const debouncedFunction = function(this: unknown, ...args: T) {
    const later = () => {
      timeout = undefined;  // Clear reference
      if (!immediate) func.apply(this, args);
    };
    const callNow = immediate && !timeout;
    clearTimeout(timeout);  // Prevent memory leaks
    timeout = setTimeout(later, wait);
    if (callNow) func.apply(this, args);
  };
  
  return debouncedFunction;
}
```
- **Timeout Cleanup**: Proper clearTimeout to prevent memory leaks
- **Reference Management**: Clear timeout references after execution
- **Context Preservation**: Proper `this` binding for method calls
- **Immediate Mode**: Support for immediate execution option
- **Generic Types**: Type-safe implementation for all function signatures

**I/O Optimization:**
- **Non-blocking File Operations**: Uses fs.appendFile without await for log writes
- **Existence Checks**: fs.access before mkdir to avoid unnecessary operations
- **Native Tool Efficiency**: Compiled binaries for system interactions
- **Error Recovery**: Graceful handling of file system errors
- **Timeout Protection**: All external process calls have timeout limits

## Testing Strategy

### Unit Testing Approach
```typescript
// Logger testing with output capture
const captureConsole = () => {
  const logs: Array<[string, ...any[]]> = [];
  console.log = jest.fn((...args) => logs.push(['log', ...args]));
  return { getLogs: () => logs, restore: () => Object.assign(console, originalConsole) };
};

// Native tools testing with process mocking
jest.mock('child_process', () => ({
  exec: jest.fn((command, options, callback) => {
    // Mock successful native tool execution with JSON response
    callback(null, '{"name": "Terminal", "bundleId": "com.apple.Terminal"}');
  })
}));
```

### Utility-Specific Testing
**Logger Testing:**
- **Level Filtering**: Verify log level filtering works correctly using Record<LogLevel, number>
- **Console Method Selection**: Test proper console method selection for each level
- **File Output**: Test file writing with temporary directories
- **Structured Data**: Validate JSON serialization of complex objects
- **Error Handling**: Test file write failures and recovery
- **Configuration Loading**: Test safe config loading with fallback defaults

**Native Tools Testing:**
```typescript
describe('Native Tools Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  it('should parse app info correctly', async () => {
    mockExec.mockImplementation((command, options, callback) => {
      callback(null, '{"name": "Terminal", "bundleId": "com.apple.Terminal"}');
    });
    
    const appInfo = await getCurrentApp();
    expect(appInfo).toEqual({
      name: 'Terminal',
      bundleId: 'com.apple.Terminal'
    });
  });
  
  it('should handle apps without bundle ID', async () => {
    mockExec.mockImplementation((command, options, callback) => {
      callback(null, '{"name": "SomeApp", "bundleId": null}');
    });
    
    const appInfo = await getCurrentApp();
    expect(appInfo).toEqual({
      name: 'SomeApp',
      bundleId: null
    });
  });
  
  it('should handle JSON parsing errors', async () => {
    mockExec.mockImplementation((command, options, callback) => {
      callback(null, 'invalid json');
    });
    
    const appInfo = await getCurrentApp();
    expect(appInfo).toBeNull();
  });
});
```

**Safe JSON Testing:**
```typescript
describe('Safe JSON Operations', () => {
  it('should parse valid JSON', () => {
    const result = safeJsonParse<{test: string}>('{"test": "value"}', {test: 'default'});
    expect(result).toEqual({test: 'value'});
  });
  
  it('should return fallback for invalid JSON', () => {
    const result = safeJsonParse<{test: string}>('invalid json', {test: 'default'});
    expect(result).toEqual({test: 'default'});
  });
  
  it('should return null when no fallback provided', () => {
    const result = safeJsonParse('invalid json');
    expect(result).toBeNull();
  });
  
  it('should handle circular references in stringify', () => {
    const circular: any = {name: 'test'};
    circular.self = circular;
    
    const result = safeJsonStringify(circular, '{}');
    expect(result).toBe('{}'); // Fallback due to circular reference
  });
});
```

**AppleScript Security Testing:**
```typescript
describe('AppleScript Security Functions', () => {
  it('should sanitize dangerous input', () => {
    const maliciousInput = 'do shell script "rm -rf /"';
    const sanitized = sanitizeAppleScript(maliciousInput);
    expect(sanitized).not.toContain('do shell script');
  });
  
  it('should validate script security', () => {
    const dangerousScript = 'tell application "Keychain Access" to get password';
    const validation = validateAppleScriptSecurity(dangerousScript);
    expect(validation.isValid).toBe(false);
    expect(validation.issues).toContain('Potential credential access detected');
  });
  
  it('should enforce length limits', () => {
    const longScript = 'a'.repeat(70000); // Exceeds 64KB limit
    expect(() => sanitizeAppleScript(longScript)).toThrow('Input too long');
  });
  
  it('should handle timeout in executeAppleScriptSafely', async () => {
    const hangingScript = 'delay 10'; // 10 second delay
    await expect(executeAppleScriptSafely(hangingScript, 1000)).rejects.toThrow('timeout');
  });
});
```

### Integration Testing
- **Cross-platform Testing**: Test file operations on different operating systems
- **Performance Testing**: Measure debouncing timing and memory usage
- **Error Recovery**: Test graceful degradation scenarios
- **Security Testing**: Validate native tool security and proper path quoting
- **Native Tool Integration**: Test actual binary execution in development/packaged modes
- **Timeout Handling**: Verify timeout behavior and process cleanup

### Performance Testing
- **Debounce Timing**: Verify debounce delays and immediate execution mode
- **Throttle Behavior**: Test leading-edge throttling implementation
- **Memory Leaks**: Monitor timeout cleanup and reference management
- **File I/O Performance**: Measure file operation efficiency
- **Native Tool Performance**: Test binary execution timing and timeout handling
- **JSON Parsing Performance**: Benchmark safe JSON operations

## Usage Guidelines

### Import Patterns
```typescript
// Named imports for specific utilities
import { logger, safeJsonParse, generateId } from '../utils/utils';

// Native tool utilities (macOS only)
import { getCurrentApp, pasteWithNativeTool, activateAndPasteWithNativeTool } from '../utils/utils';

// System utilities
import { getActiveWindowBounds, checkAccessibilityPermission } from '../utils/utils';

// Performance utilities
import { debounce, throttle, sleep } from '../utils/utils';

// File system utilities
import { ensureDir, fileExists } from '../utils/utils';

// Time utilities
import { formatTimeAgo } from '../utils/utils';
```

### Best Practices
**Logging:**
```typescript
// Structured logging with context
logger.info('Operation completed', { 
  operation: 'paste', 
  textLength: text.length, 
  timestamp: Date.now() 
});

// Error logging with full context
logger.error('Operation failed', { 
  error: error.message, 
  stack: error.stack, 
  context: operationContext 
});
```

**Native Tools Usage:**
```typescript
// Platform check before native tools
if (process.platform === 'darwin') {
  try {
    await activateAndPasteWithNativeTool(appInfo);
  } catch (error) {
    logger.warn('Native tool failed, using fallback', { error });
    await pasteWithNativeTool(); // Fallback strategy
  }
}
```

**Safe Operations:**
```typescript
// Always use safe JSON operations
const data = safeJsonParse<ConfigType>(jsonString, defaultConfig);
const result = safeJsonParse(jsonString); // Returns null if no fallback
const jsonString = safeJsonStringify(data, '{}');

// File operations with error handling
try {
  await ensureDir(directoryPath);
  const exists = await fileExists(filePath);
  if (!exists) {
    await fs.writeFile(filePath, content);
  }
} catch (error) {
  logger.error('File operation failed', { error, path: filePath });
  throw error;
}
```

## Exported Functions

The utils module exports the following functions:

```typescript
export {
  // Core utilities
  logger,                           // Logger instance
  debounce,                       // Function debouncing
  throttle,                       // Function throttling
  safeJsonParse,                  // Safe JSON parsing
  safeJsonStringify,              // Safe JSON stringification
  generateId,                     // Generate unique IDs
  formatTimeAgo,                  // Format relative timestamps
  ensureDir,                      // Ensure directory exists
  fileExists,                     // Check file existence
  sleep,                          // Promise-based delay
  
  // Native macOS integration
  getCurrentApp,                    // Get current active application info
  getActiveWindowBounds,           // Get active window bounds
  pasteWithNativeTool,            // Simple paste using native tool
  activateAndPasteWithNativeTool, // Activate app and paste
  checkAccessibilityPermission,   // Check accessibility permissions
  
  // Native tool paths
  KEYBOARD_SIMULATOR_PATH,        // Path to keyboard-simulator binary
  WINDOW_DETECTOR_PATH,           // Path to window-detector binary
  TEXT_FIELD_DETECTOR_PATH,       // Path to text-field-detector binary
  
  // AppleScript security (from apple-script-sanitizer.ts)
  sanitizeAppleScript,            // Sanitize AppleScript input
  executeAppleScriptSafely,       // Execute AppleScript with security
  validateAppleScriptSecurity     // Validate AppleScript security
};
```

## Dependencies

- **Node.js Built-ins**: `child_process`, `fs/promises`, `path`, `os`
- **Electron**: `app` (for packaged mode detection)
- **Internal**: `../types`, `../constants`, `../config/app-config`
- **Native Tools**: `window-detector`, `keyboard-simulator`, `text-field-detector` binaries
- **Security Module**: `./apple-script-sanitizer` for AppleScript security functions

## Platform Support

- **macOS**: Full functionality with native tools
- **Windows/Linux**: Limited functionality (file system and utility functions only)
- **Development**: Uses relative paths to native tools
- **Production**: Uses unpacked asar paths for native tools