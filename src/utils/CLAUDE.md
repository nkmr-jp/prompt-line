# Utils Module

This module contains shared utility functions used across the application with comprehensive system integration.

## Files

### utils.ts
Comprehensive utility module with advanced system integration and performance optimization:

**Logger Class:**
```typescript
class Logger {
  private level: LogLevel = 'info';
  private enableFileLogging: boolean = true;
  private logFile: string;
  
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

**macOS AppleScript Integration:**
```typescript
function getCurrentApp(): Promise<AppInfo | null> {
  // Combined AppleScript for efficiency:
  // "tell application \"System Events\"
  //   set frontApp to first application process whose frontmost is true
  //   return (name of frontApp) & \"|\" & (bundle identifier of frontApp)
  // end tell"
}
```
- **App Detection**: Combined name and bundle ID retrieval in single AppleScript call
- **Error Recovery**: Graceful fallback for apps without bundle identifiers
- **Timeout Protection**: 2-second timeout to prevent hanging
- **Parsing Logic**: Robust parsing of pipe-delimited AppleScript output

**Advanced AppleScript Operations:**
```typescript
function activateAndPasteWithAppleScript(appInfo: AppInfo | string): Promise<void> {
  // Combined activation and paste for atomicity:
  // "tell application \"System Events\"
  //   set targetProcess to first process whose name is \"AppName\"
  //   set frontmost of targetProcess to true
  //   keystroke \"v\" using command down
  // end tell"
}
```
- **Atomic Operations**: Combined app activation and paste to prevent race conditions
- **Security**: `escapeAppleScriptString()` prevents command injection
- **Fallback Strategy**: Graceful degradation to simple paste if activation fails
- **Error Handling**: Timeout handling with graceful recovery

**Window Bounds Detection:**
```typescript
function getActiveWindowBounds(): Promise<WindowBounds | null> {
  // AppleScript to get active window position and size:
  // "tell application \"System Events\"
  //   set frontApp to first application process whose frontmost is true
  //   tell frontApp
  //     set frontWindow to front window
  //     set windowPosition to position of frontWindow
  //     set windowSize to size of frontWindow
  //     return (item 1 of windowPosition) & \"|\" & (item 2 of windowPosition) & \"|\" & (item 1 of windowSize) & \"|\" & (item 2 of windowSize)
  //   end tell
  // end tell"
}
```
- **Advanced Parsing**: Handles AppleScript output with commas and spaces (`"1028, |, 44, |, 1028, |, 1285"`)
- **Output Cleanup**: `replace(/,\s*/g, '').replace(/\s*\|\s*/g, '|')` normalizes format
- **Error Recovery**: Returns `null` on parsing failures, triggering cursor fallback
- **Timeout Protection**: 3-second timeout prevents hanging on unresponsive apps
- **Validation**: Checks for valid numeric values and proper format (4 pipe-separated values)
- **Logging**: Comprehensive debug logging for troubleshooting window detection issues

**Safe Operations Suite:**
```typescript
function safeJsonParse<T>(jsonString: string, fallback: T): T {
  try {
    return JSON.parse(jsonString) as T;
  } catch (error) {
    logger.warn('Failed to parse JSON:', error);
    return fallback;
  }
}

function safeJsonStringify(obj: unknown, fallback = '{}'): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch (error) {
    logger.warn('Failed to stringify object:', error);
    return fallback;
  }
}
```
- **Type Safety**: Generic type support for type-safe JSON parsing
- **Error Handling**: Comprehensive error catching with logging
- **Fallback Values**: Configurable fallback values for failed operations
- **Pretty Printing**: JSON formatting with 2-space indentation

**File System Utilities:**
```typescript
async function ensureDir(dirPath: string): Promise<void> {
  try {
    await fs.access(dirPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      await fs.mkdir(dirPath, { recursive: true });
    } else {
      throw error;
    }
  }
}
```
- **Directory Creation**: Recursive directory creation with existence checking
- **Error Differentiation**: Distinguish between missing directories and permission errors
- **Performance**: Avoid unnecessary operations when directories exist

**Performance Utilities:**
```typescript
function debounce<T extends unknown[]>(
  func: (...args: T) => void, 
  wait: number, 
  immediate = false
): DebounceFunction<T> {
  let timeout: NodeJS.Timeout | undefined;
  // Implementation with cancel support and immediate execution option
}
```
- **Generic Debouncing**: Type-safe debouncing for any function signature
- **Cancel Support**: Debounce cancellation for cleanup scenarios
- **Immediate Mode**: Option for immediate execution with trailing debounce
- **Memory Management**: Proper timeout cleanup to prevent memory leaks

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
- **Configuration**: Dynamic level adjustment based on environment
- **File Management**: Automatic log file creation and append operations

### File System Operations
**Directory Management:**
```typescript
await ensureDir('/path/to/directory');  // Creates if missing
const exists = await fileExists('/path/to/file');  // Boolean check
```
- **Recursive Creation**: `fs.mkdir({ recursive: true })` for deep directory structures
- **Error Handling**: Distinguish ENOENT from permission errors
- **Performance**: Existence checks before creation attempts

**Safe JSON Operations:**
```typescript
// Type-safe parsing with fallback
const config = safeJsonParse<ConfigType>(data, defaultConfig);

// Safe stringification with error recovery
const jsonString = safeJsonStringify(object, '{}');
```
- **Type Safety**: Generic type support for compile-time safety
- **Error Recovery**: Graceful handling of circular references and invalid data
- **Logging**: Automatic error logging for debugging

### macOS AppleScript Integration
**Application Detection:**
```typescript
interface AppInfo {
  name: string;
  bundleId?: string | null;
}

const currentApp = await getCurrentApp();
// Returns: { name: "Terminal", bundleId: "com.apple.Terminal" }
```
- **Efficient Detection**: Single AppleScript call for both name and bundle ID
- **Error Resilience**: Handles apps without bundle identifiers
- **Timeout Protection**: 2-second timeout prevents hanging

**Paste Operations:**
```typescript
// Simple paste (current app)
await pasteWithAppleScript();

// Activate app and paste (specific app)
await activateAndPasteWithAppleScript(appInfo);
```
- **Security**: Command injection prevention through string escaping
- **Atomic Operations**: Combined activation and paste for reliability
- **Fallback Strategy**: Graceful degradation on operation failures

**Security Features:**
- **Native Tools**: Compiled binaries eliminate script injection vulnerabilities
- **JSON Communication**: Structured data exchange prevents parsing attacks
- **Input Validation**: Type-safe parameters with validation
- **Timeout Protection**: All operations have timeout limits
- **Error Isolation**: Native tool failures don't affect main process
- **No Script Interpretation**: Direct binary execution eliminates script injection risks

### System Utilities
**Performance Optimization:**
```typescript
// Debouncing for frequent operations
const debouncedSave = debounce(saveFunction, 500);
debouncedSave.cancel(); // Cleanup support

// Throttling for rate limiting
const throttledUpdate = throttle(updateFunction, 100);

// Timing utilities
await sleep(100); // Promise-based delay
```

**ID Generation:**
```typescript
const uniqueId = generateId();
// Returns: "abc123xyz789" (lowercase alphanumeric)
```
- **Format**: Lowercase alphanumeric for consistent validation
- **Uniqueness**: Timestamp + random components for collision avoidance
- **Validation**: Coordinated with IPC handlers for security

**Time Utilities:**
```typescript
const timeAgo = formatTimeAgo(timestamp);
// Returns: "Just now", "5m ago", "2h ago", "3d ago"
```
- **Relative Formatting**: Human-readable relative timestamps
- **Performance**: Efficient calculation using division and Math.floor
- **Internationalization Ready**: English format with expansion potential

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
- **Graceful Degradation**: Fallback values and recovery strategies

### Logger Implementation Details
```typescript
class Logger {
  private shouldLog(level: LogLevel): boolean {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    return levels[level] >= levels[this.level];
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
- **Structured Output**: JSON serialization for complex data objects
- **Error Recovery**: Fallback to console for file write failures

### AppleScript Integration Patterns
**Security-First Design:**
```typescript
const escapedAppName = escapeAppleScriptString(appName);
const script = `tell application "System Events"
  set targetProcess to first process whose name is "${escapedAppName}"
  set frontmost of targetProcess to true
  keystroke "v" using command down
end tell`;
```
- **Injection Prevention**: Comprehensive string escaping before script execution
- **Structured Commands**: Template-based script generation for consistency
- **Error Isolation**: Separate error handling for different script types

**Performance Optimization:**
```typescript
// Combined operations for atomicity
const combinedScript = `
  tell application "System Events"
    set frontApp to first application process whose frontmost is true
    try
      return (name of frontApp) & "|" & (bundle identifier of frontApp)
    on error
      return (name of frontApp) & "|"
    end try
  end tell
`;
```
- **Atomic Operations**: Single AppleScript call for multiple data points
- **Error Recovery**: Built-in AppleScript error handling
- **Timeout Management**: Process-level timeouts with graceful recovery

### Performance Considerations
**Async Operation Optimization:**
- **Non-blocking I/O**: All file operations use async patterns
- **Promise Chaining**: Proper async/await usage for readable code
- **Error Boundaries**: Isolated error handling prevents cascade failures
- **Resource Cleanup**: Proper timeout and resource management

**Memory Management:**
```typescript
function debounce<T extends unknown[]>(
  func: (...args: T) => void, 
  wait: number
): DebounceFunction<T> {
  let timeout: NodeJS.Timeout | undefined;
  
  const debouncedFunction = function(...args: T) {
    clearTimeout(timeout);  // Prevent memory leaks
    timeout = setTimeout(() => {
      timeout = undefined;  // Clear reference
      func.apply(this, args);
    }, wait);
  };
  
  return debouncedFunction;
}
```
- **Timeout Cleanup**: Proper clearTimeout to prevent memory leaks
- **Reference Management**: Clear timeout references after execution
- **Generic Types**: Type-safe implementation for all function signatures

**I/O Optimization:**
- **Batched Operations**: Group related file operations when possible
- **Debounced Writes**: Reduce excessive file system calls
- **Cached Results**: In-memory caching for frequently accessed data
- **Error Recovery**: Graceful handling of file system errors

## Testing Strategy

### Unit Testing Approach
```typescript
// Logger testing with output capture
const captureConsole = () => {
  const logs: Array<[string, ...any[]]> = [];
  console.log = jest.fn((...args) => logs.push(['log', ...args]));
  return { getLogs: () => logs, restore: () => Object.assign(console, originalConsole) };
};

// AppleScript testing with process mocking
jest.mock('child_process', () => ({
  exec: jest.fn((command, options, callback) => {
    // Mock successful AppleScript execution
    callback(null, 'Terminal|com.apple.Terminal');
  })
}));
```

### Utility-Specific Testing
**Logger Testing:**
- **Level Filtering**: Verify log level filtering works correctly
- **File Output**: Test file writing with temporary directories
- **Structured Data**: Validate JSON serialization of complex objects
- **Error Handling**: Test file write failures and recovery

**AppleScript Testing:**
```typescript
describe('AppleScript Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  it('should parse app info correctly', async () => {
    mockExec.mockImplementation((command, options, callback) => {
      callback(null, 'Terminal|com.apple.Terminal');
    });
    
    const appInfo = await getCurrentApp();
    expect(appInfo).toEqual({
      name: 'Terminal',
      bundleId: 'com.apple.Terminal'
    });
  });
  
  it('should handle apps without bundle ID', async () => {
    mockExec.mockImplementation((command, options, callback) => {
      callback(null, 'SomeApp|');
    });
    
    const appInfo = await getCurrentApp();
    expect(appInfo).toEqual({
      name: 'SomeApp',
      bundleId: null
    });
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
  
  it('should handle circular references in stringify', () => {
    const circular: any = {name: 'test'};
    circular.self = circular;
    
    const result = safeJsonStringify(circular, '{}');
    expect(result).toBe('{}'); // Fallback due to circular reference
  });
});
```

### Integration Testing
- **Cross-platform Testing**: Test file operations on different operating systems
- **Performance Testing**: Measure debouncing timing and memory usage
- **Error Recovery**: Test graceful degradation scenarios
- **Security Testing**: Validate AppleScript injection prevention

### Performance Testing
- **Debounce Timing**: Verify debounce delays and cancellation
- **Memory Leaks**: Monitor timeout cleanup and reference management
- **File I/O Performance**: Measure file operation efficiency
- **AppleScript Timing**: Test timeout handling and recovery

## Usage Guidelines

### Import Patterns
```typescript
// Named imports for specific utilities
import { logger, safeJsonParse, generateId } from '../utils/utils';

// AppleScript utilities (macOS only)
import { getCurrentApp, pasteWithAppleScript } from '../utils/utils';

// Performance utilities
import { debounce, throttle, sleep } from '../utils/utils';
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

**AppleScript Usage:**
```typescript
// Platform check before AppleScript
if (config.platform.isMac) {
  try {
    await activateAndPasteWithAppleScript(appInfo);
  } catch (error) {
    logger.warn('AppleScript failed, using fallback', { error });
    await pasteWithAppleScript(); // Fallback strategy
  }
}
```

**Safe Operations:**
```typescript
// Always use safe JSON operations
const data = safeJsonParse<ConfigType>(jsonString, defaultConfig);
const jsonString = safeJsonStringify(data, '{}');

// File operations with error handling
try {
  await ensureDir(directoryPath);
  await fs.writeFile(filePath, content);
} catch (error) {
  logger.error('File operation failed', { error, path: filePath });
  throw error;
}
```