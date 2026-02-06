# Utils Module

This module contains shared utility functions used across the application with comprehensive system integration and native tools support.

## Architecture

The utils module is organized into specialized files for maintainability:

- **utils.ts**: Re-export hub maintaining backward compatibility
- **logger.ts**: Logging system with sensitive data masking
- **common.ts**: General utilities (debounce, JSON, ID generation)
- **security.ts**: Security utilities and error handling
- **file-utils.ts**: File system operations
- **rate-limiter.ts**: Rate limiting for abuse prevention
- **apple-script-sanitizer.ts**: AppleScript security
- **native-tools.ts**: Re-export hub for native tools
- **native-tools/**: Modular native tool integrations
  - `index.ts`: Main export hub
  - `paths.ts`: Tool path constants
  - `app-detection.ts`: App and window detection
  - `paste-operations.ts`: Paste and activate operations
  - `directory-operations.ts`: Directory detection and file listing (delegates to `file-search/` for file listing)
- **file-search/**: Cross-platform file search module (replaces native Swift file-searcher)
  - `index.ts`: Module exports (`listDirectory`, `checkFdAvailable`)
  - `file-searcher.ts`: File search implementation using `fd` with Node.js `fs.readdir` fallback
- **symbol-search/**: Cross-platform symbol search module (replaces native Swift symbol-searcher)
  - `index.ts`: Module exports (`checkRgAvailable`, `getSupportedLanguages`, `searchSymbols`)
  - `symbol-searcher-node.ts`: Symbol search implementation using `ripgrep` directly from Node.js

## Files

### utils.ts
Re-export module that maintains the original API for backward compatibility. All implementation is split into specialized modules.

### logger.ts
Comprehensive logging system with sensitive data masking:

**Sensitive Data Masking:**
```typescript
function maskSensitiveData(data: unknown): unknown {
  // Masks sensitive information in strings and objects
  // Pattern-based masking for passwords, tokens, API keys, secrets
  // Recursive object and array masking
  // Key-based masking for sensitive field names
}
```

**Sensitive Patterns:**
- `password`: Masked in strings and object keys
- `token`: Masked in strings and object keys
- `api_key`: Masked in strings and object keys
- `secret`: Masked in strings and object keys
- `authorization`: Bearer tokens masked
- Pattern matching with case-insensitive detection

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
    // Early return if log level doesn't meet threshold
    // Console output with appropriate method (log/warn/error)
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
- **Dynamic Configuration**: Loads config from app-config module (uses LOG_LEVEL env var)
- **Environment-based Control**: DEBUG logs only enabled when LOG_LEVEL=debug in non-packaged apps
- **Circular Dependency Prevention**: Uses ES6 import to avoid require() circular dependency issues
- **Early Return Pattern**: Simplified code flow with early returns for better readability

### common.ts
General utility functions for common operations:

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
```
- **Generic Functions**: Type-safe debouncing for any function signature
- **Context Preservation**: Proper `this` binding for method calls
- **Immediate Mode**: Option for immediate execution with trailing debounce
- **Memory Management**: Proper timeout cleanup to prevent memory leaks

**Safe JSON Operations:**
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

**ID Generation:**
```typescript
function generateId(): string {
  // Returns: "abc123xyz789" (lowercase alphanumeric)
}
```
- **Format**: Lowercase alphanumeric using base-36 encoding
- **Uniqueness**: Timestamp + random components for collision avoidance
- **Base-36 Encoding**: Uses TIME_CALCULATIONS.TIMESTAMP_BASE constant
- **Validation**: Coordinated with IPC handlers for security
- **Implementation Note**: ID validation in ipc-handlers.ts depends on this format

**Sleep Utility:**
```typescript
function sleep(ms: number): Promise<void> {
  // Promise-based delay
}
```

### security.ts
Security utilities and error handling:

**Secure Error Messages:**
```typescript
const SecureErrors = {
  INVALID_INPUT: 'Invalid input provided',
  OPERATION_FAILED: 'Operation failed',
  FILE_NOT_FOUND: 'File not found',
  PERMISSION_DENIED: 'Permission denied',
  INTERNAL_ERROR: 'An internal error occurred',
  INVALID_FORMAT: 'Invalid format',
  SIZE_LIMIT_EXCEEDED: 'Size limit exceeded',
} as const;
```
- **User-Facing Messages**: Generic error messages that don't expose internal details
- **Internal Logging**: Separate internal log messages with full error context
- **Security**: Prevents information leakage through error messages

**Command Argument Sanitization:**
```typescript
function sanitizeCommandArgument(input: string, maxLength = 256): string {
  // Removes dangerous characters
  // Limits length to prevent buffer overflows
  // Logs sanitization events
}

function isCommandArgumentSafe(input: string): boolean {
  // Validates command arguments contain only safe characters
  // Checks for shell metacharacters, null bytes, newlines
  // Prevents path traversal and flag injection
}
```
- **Command Injection Prevention**: Removes shell metacharacters
- **Length Limits**: Default 256 characters to prevent buffer overflows
- **Pattern Detection**: Identifies dangerous characters and patterns
- **Logging**: Automatic logging when sanitization occurs

**Error Handling:**
```typescript
function handleError(error: Error, context: string): { logMessage: string; userMessage: string } {
  // Separates user-facing and internal log messages
}
```

### file-utils.ts
File system operations:

**Directory Management:**
```typescript
async function ensureDir(dirPath: string): Promise<void> {
  // ENOENT-specific error handling for missing directories
  // Recursive directory creation with performance optimization
  // Restrictive permissions (0o700 - owner read/write/execute only)
}

async function fileExists(filePath: string): Promise<boolean> {
  // Simple boolean file existence check
  // Uses fs.access for efficient existence testing
}
```
- **Directory Creation**: Recursive directory creation with existence checking
- **Error Differentiation**: Distinguish between missing directories and permission errors
- **Performance**: fs.access existence checks before creation attempts
- **Security**: Restrictive directory permissions (0o700)

### rate-limiter.ts
Rate limiting for abuse prevention and DoS protection:

**RateLimiter Class:**
```typescript
class RateLimiter {
  constructor(config: RateLimitConfig) {
    // windowMs: Time window in milliseconds
    // maxRequests: Maximum requests allowed within the window
  }

  isAllowed(key: string): boolean {
    // Sliding window algorithm
    // Per-key tracking
  }

  reset(key: string): void;
  resetAll(): void;
  getCount(key: string): number;
  getTimeUntilReset(key: string): number;
}
```

**Pre-configured Rate Limiters:**
```typescript
// Paste operations: 10 requests per second
export const pasteRateLimiter = new RateLimiter({
  windowMs: 1000,
  maxRequests: 10
});

// History operations: 50 requests per second
export const historyRateLimiter = new RateLimiter({
  windowMs: 1000,
  maxRequests: 50
});

// Image operations: 5 requests per second
export const imageRateLimiter = new RateLimiter({
  windowMs: 1000,
  maxRequests: 5
});
```

**Features:**
- **Sliding Window**: Accurate rate limiting with timestamp tracking
- **Per-Key Tracking**: Independent limits for different operations
- **Configurable**: Customizable window size and request limits
- **Utility Methods**: Reset, count, and time-until-reset methods
- **DoS Prevention**: Prevents abuse through request throttling

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

### native-tools.ts
Re-export module for macOS native tool integrations. Implementation is in `native-tools/` directory.

### native-tools/ Directory

**Module Structure:**
- `index.ts`: Main export hub coordinating all native tool integrations
- `paths.ts`: Tool path constants for all native binaries
- `app-detection.ts`: App and window detection using native tools
- `paste-operations.ts`: Paste and activate operations
- `directory-operations.ts`: Directory detection and file listing (delegates to `file-search/`)

**Native Tools Integration (paths.ts):**
```typescript
const WINDOW_DETECTOR_PATH: string;        // Window bounds and app detection
const KEYBOARD_SIMULATOR_PATH: string;     // Keyboard simulation and app activation
const TEXT_FIELD_DETECTOR_PATH: string;    // Focused text field detection
const DIRECTORY_DETECTOR_PATH: string;     // Current working directory detection
const FILE_SEARCHER_PATH: string;          // Legacy path (file search now uses file-search/ module)
const SYMBOL_SEARCHER_PATH: string;        // Legacy path (symbol search now uses symbol-search/ module)
```
- **Path Resolution**: Dynamic path resolution for packaged vs development environments
- **Native Executables**: Uses compiled native tools for security and performance
- **Security**: Compiled binaries eliminate script injection vulnerabilities
- **Note**: File search and symbol search have been migrated to Node.js modules (`file-search/` and `symbol-search/`). Path constants are retained for backward compatibility.

**macOS Native App Detection (app-detection.ts):**
```typescript
function getCurrentApp(): Promise<AppInfo | null> {
  // Uses native window-detector tool with JSON output
  // Returns: {"name": "Terminal", "bundleId": "com.apple.Terminal"}
}

function getActiveWindowBounds(): Promise<WindowBounds | null> {
  // Uses native window-detector tool
  // Returns: {"x": 100, "y": 200, "width": 800, "height": 600}
}

function checkAccessibilityPermission(): Promise<AccessibilityStatus> {
  // AppleScript-based accessibility permission check
  // Tests actual accessibility functions to verify permissions
}
```
- **Native Tool Integration**: Uses compiled window-detector for secure app detection
- **JSON Communication**: Structured data exchange prevents parsing vulnerabilities
- **Error Recovery**: Graceful fallback for apps without bundle identifiers
- **Timeout Protection**: 2-3 second timeouts to prevent hanging
- **Validation**: Checks for valid numeric values in window bounds

**Native Paste Operations (paste-operations.ts):**
```typescript
function pasteWithNativeTool(): Promise<void> {
  // Simple paste using keyboard-simulator
}

function activateAndPasteWithNativeTool(appInfo: AppInfo | string): Promise<void> {
  // Atomic app activation and paste
  // Uses bundle ID when available for precision
}
```
- **Atomic Operations**: Combined app activation and paste to prevent race conditions
- **Security**: Native tools eliminate script injection vulnerabilities
- **Bundle ID Support**: Precise app targeting using bundle identifiers
- **Fallback Strategy**: Graceful degradation from bundle ID to app name
- **Timeout Handling**: Comprehensive timeout and error recovery

**Directory Operations (directory-operations.ts):**
```typescript
function detectCurrentDirectory(options?: DirectoryDetectionOptions): Promise<DirectoryInfo> {
  // Uses native directory-detector tool for CWD detection
  // Returns current working directory of active application
}

function detectCurrentDirectoryWithFiles(options?: DirectoryDetectionOptions): Promise<DirectoryInfo> {
  // Combines directory detection with file listing
  // Step 1: directory-detector for CWD, Step 2: file-search module for file listing
}

function listDirectory(directoryPath: string, fileSearchSettings?: FileSearchSettings): Promise<DirectoryInfo> {
  // Delegates to Node.js file-search module (cross-platform)
}
```
- **Hybrid Architecture**: Uses native directory-detector for CWD detection, Node.js `file-search/` module for file listing
- **JSON Communication**: Structured data exchange with native directory-detector
- **Performance**: Fast directory detection using libproc (10-50x faster)
- **Cross-platform File Listing**: File listing via `file-search/` module works on all platforms
- **Timeout Protection**: Configurable timeouts for directory detection

**File Search Module (file-search/):**
```typescript
function listDirectory(directoryPath: string, settings?: Partial<FileSearchSettings>): Promise<DirectoryInfo> {
  // Cross-platform file listing
  // Uses fd if available, falls back to Node.js fs.readdir
}

function checkFdAvailable(): Promise<{ fdAvailable: boolean; fdPath: string | null }> {
  // Checks multiple fd paths: /opt/homebrew/bin/fd, /usr/local/bin/fd, /usr/bin/fd, PATH
}
```
- **Replaces Native Swift file-searcher**: Cross-platform Node.js implementation
- **fd Integration**: Uses `fd` command for fast recursive file listing when available
- **Node.js Fallback**: Falls back to `fs.readdir` (single level) when `fd` is not installed
- **Default Excludes**: Filters out common non-essential directories (node_modules, .git, dist, build, etc.)
- **Security**: Path sanitization, root directory disabled, input validation
- **Configurable**: `FileSearchSettings` for gitignore, hidden files, max depth, exclude patterns, max files (default 5000)
- **Timeout Protection**: 5-second default timeout for `fd` commands

**Symbol Search Module (symbol-search/):**
```typescript
function searchSymbols(directory: string, language: string, options?: SymbolSearchOptions): Promise<SymbolSearchResponse> {
  // Search for code symbols using ripgrep
}

function checkRgAvailable(): Promise<RgCheckResponse> {
  // Checks multiple rg paths: /opt/homebrew/bin/rg, /usr/local/bin/rg, /usr/bin/rg, PATH
}

function getSupportedLanguages(): Promise<LanguagesResponse> {
  // Returns list of supported programming languages with their keys and extensions
}
```
- **Replaces Native Swift symbol-searcher**: Cross-platform Node.js implementation
- **ripgrep Integration**: Uses `rg` for fast symbol pattern matching
- **Language Configs**: Built-in regex patterns for Go, TypeScript, TSX, JavaScript, JSX, Python, Rust (8 languages with patterns defined in `LANGUAGE_CONFIGS`)
- **Pattern Matching**: Each language defines symbol type patterns (function, class, struct, interface, etc.)
- **Output Parsing**: Parses ripgrep `path:lineNumber:lineContent` format and extracts symbol names
- **Configurable**: Options for max symbols (default 200,000), timeout (default 5s), exclude patterns
- **Error Handling**: Graceful handling of rg exit code 1 (no matches), timeouts, and invalid inputs

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

**Rate Limiting:**
```typescript
// Check if paste operation is allowed
if (pasteRateLimiter.isAllowed('paste')) {
  // Perform paste operation
} else {
  // Handle rate limit exceeded
  const waitTime = pasteRateLimiter.getTimeUntilReset('paste');
}

// Check current count
const count = historyRateLimiter.getCount('history-search');

// Reset rate limit for specific operation
pasteRateLimiter.reset('paste');
```

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
- **Sensitive Data Masking**: Verify masking of passwords, tokens, API keys, secrets
- **Error Handling**: Test file write failures and recovery
- **Configuration Loading**: Test safe config loading with fallback defaults

**Security Testing:**
```typescript
describe('Security Utilities', () => {
  it('should sanitize command arguments', () => {
    const dangerous = 'test; rm -rf /';
    const safe = sanitizeCommandArgument(dangerous);
    expect(safe).not.toContain(';');
    expect(safe).not.toContain('rm');
  });

  it('should validate command argument safety', () => {
    expect(isCommandArgumentSafe('safe-input')).toBe(true);
    expect(isCommandArgumentSafe('danger;ous')).toBe(false);
    expect(isCommandArgumentSafe('../../../etc/passwd')).toBe(false);
  });

  it('should provide secure error messages', () => {
    const error = new Error('Internal database connection failed');
    const { logMessage, userMessage } = handleError(error, 'Database operation');
    expect(logMessage).toContain('Internal database');
    expect(userMessage).toBe(SecureErrors.OPERATION_FAILED);
  });
});
```

**Rate Limiter Testing:**
```typescript
describe('Rate Limiter', () => {
  it('should allow requests within limit', () => {
    const limiter = new RateLimiter({ windowMs: 1000, maxRequests: 3 });
    expect(limiter.isAllowed('test')).toBe(true);
    expect(limiter.isAllowed('test')).toBe(true);
    expect(limiter.isAllowed('test')).toBe(true);
  });

  it('should block requests exceeding limit', () => {
    const limiter = new RateLimiter({ windowMs: 1000, maxRequests: 2 });
    limiter.isAllowed('test');
    limiter.isAllowed('test');
    expect(limiter.isAllowed('test')).toBe(false);
  });

  it('should reset after window expires', async () => {
    const limiter = new RateLimiter({ windowMs: 100, maxRequests: 1 });
    limiter.isAllowed('test');
    expect(limiter.isAllowed('test')).toBe(false);
    await new Promise(resolve => setTimeout(resolve, 150));
    expect(limiter.isAllowed('test')).toBe(true);
  });
});

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
- **Memory Leaks**: Monitor timeout cleanup and reference management
- **File I/O Performance**: Measure file operation efficiency with 0o700 permissions
- **Native Tool Performance**: Test binary execution timing and timeout handling
- **JSON Parsing Performance**: Benchmark safe JSON operations
- **Rate Limiter Performance**: Test sliding window algorithm efficiency
- **Masking Performance**: Benchmark sensitive data masking for large objects
- **Directory Detection**: Measure native directory-detector performance (target: <5ms)

## Usage Guidelines

### Import Patterns
```typescript
// Named imports for specific utilities
import { logger, maskSensitiveData, safeJsonParse, generateId } from '../utils/utils';

// Security utilities
import { SecureErrors, handleError, sanitizeCommandArgument, isCommandArgumentSafe } from '../utils/utils';

// Native tool utilities (macOS only)
import {
  getCurrentApp,
  pasteWithNativeTool,
  activateAndPasteWithNativeTool,
  detectCurrentDirectory,
  detectCurrentDirectoryWithFiles,
  listDirectory
} from '../utils/utils';

// System utilities
import { getActiveWindowBounds, checkAccessibilityPermission } from '../utils/utils';

// Performance utilities
import { debounce, sleep } from '../utils/utils';

// File system utilities
import { ensureDir, fileExists } from '../utils/utils';

// AppleScript security
import { sanitizeAppleScript, executeAppleScriptSafely, validateAppleScriptSecurity } from '../utils/utils';

// Rate limiting (separate module)
import { pasteRateLimiter, historyRateLimiter, imageRateLimiter, RateLimiter } from '../utils/rate-limiter';
import type { RateLimitConfig } from '../utils/rate-limiter';
```

### Best Practices

**Logging with Sensitive Data Masking:**
```typescript
// Structured logging with context (sensitive data automatically masked)
logger.info('Operation completed', {
  operation: 'paste',
  textLength: text.length,
  timestamp: Date.now(),
  apiKey: 'secret123'  // Automatically masked in logs
});

// Error logging with full context
logger.error('Operation failed', {
  error: error.message,
  stack: error.stack,
  context: operationContext
});

// Manual masking if needed
const maskedData = maskSensitiveData(userData);
logger.debug('User data', maskedData);
```

**Security Best Practices:**
```typescript
// Use secure error messages for user-facing errors
try {
  // Some operation
} catch (error) {
  const { logMessage, userMessage } = handleError(error as Error, 'Operation context');
  logger.error(logMessage);
  throw new Error(userMessage); // User sees generic message
}

// Sanitize command arguments before shell execution
const userInput = sanitizeCommandArgument(rawInput, 256);
// Or validate first
if (!isCommandArgumentSafe(rawInput)) {
  throw new Error(SecureErrors.INVALID_INPUT);
}
```

**Rate Limiting:**
```typescript
// Check rate limit before performing operation
if (!pasteRateLimiter.isAllowed('paste')) {
  const waitTime = pasteRateLimiter.getTimeUntilReset('paste');
  throw new Error(`Rate limit exceeded. Please wait ${waitTime}ms`);
}
// Perform paste operation

// Use different rate limiters for different operations
if (!historyRateLimiter.isAllowed('search')) {
  // Handle rate limit
}
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

// Directory detection with error handling
const directory = await detectCurrentDirectory({ timeout: 5000 });
if (directory) {
  const { files } = await detectCurrentDirectoryWithFiles({ timeout: 5000 });
  // Use detected directory and files
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
  await ensureDir(directoryPath);  // Creates with 0o700 permissions
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

The utils module exports the following functions from specialized modules:

**From utils.ts (main export hub):**
```typescript
export {
  // Logger (from logger.ts)
  logger,                           // Logger instance
  maskSensitiveData,               // Mask sensitive data in logs

  // Security (from security.ts)
  SecureErrors,                    // Secure error message constants
  handleError,                     // Error handler helper
  sanitizeCommandArgument,         // Sanitize command arguments
  isCommandArgumentSafe,           // Validate command argument safety

  // Native tools (from native-tools.ts)
  getCurrentApp,                   // Get current active application info
  getActiveWindowBounds,           // Get active window bounds
  pasteWithNativeTool,            // Simple paste using native tool
  activateAndPasteWithNativeTool, // Activate app and paste
  checkAccessibilityPermission,   // Check accessibility permissions
  detectCurrentDirectory,         // Detect current working directory
  detectCurrentDirectoryWithFiles, // Detect directory with file listing
  listDirectory,                  // List directory files
  KEYBOARD_SIMULATOR_PATH,        // Path to keyboard-simulator binary
  TEXT_FIELD_DETECTOR_PATH,       // Path to text-field-detector binary
  WINDOW_DETECTOR_PATH,           // Path to window-detector binary
  DIRECTORY_DETECTOR_PATH,        // Path to directory-detector binary
  FILE_SEARCHER_PATH,             // Path to file-searcher binary
  SYMBOL_SEARCHER_PATH,           // Path to symbol-searcher binary

  // Common utilities (from common.ts)
  debounce,                       // Function debouncing
  safeJsonParse,                  // Safe JSON parsing
  safeJsonStringify,              // Safe JSON stringification
  generateId,                     // Generate unique IDs
  sleep,                          // Promise-based delay

  // File utilities (from file-utils.ts)
  ensureDir,                      // Ensure directory exists
  fileExists,                     // Check file existence

  // AppleScript security (from apple-script-sanitizer.ts)
  sanitizeAppleScript,            // Sanitize AppleScript input
  executeAppleScriptSafely,       // Execute AppleScript with security
  validateAppleScriptSecurity     // Validate AppleScript security
};
```

**From rate-limiter.ts (separate export):**
```typescript
export {
  RateLimiter,                    // Rate limiter class
  pasteRateLimiter,              // Pre-configured for paste operations
  historyRateLimiter,            // Pre-configured for history operations
  imageRateLimiter,              // Pre-configured for image operations
};
export type { RateLimitConfig };   // Rate limiter configuration type
```

## Dependencies

**External Dependencies:**
- **Node.js Built-ins**: `child_process`, `fs/promises`, `path`, `os`
- **Electron**: `app` (for packaged mode detection)

**Internal Dependencies:**
- `../types`: Type definitions (LogLevel, DebounceFunction, AppInfo, WindowBounds, etc.)
- `../constants`: Constants (TIME_CALCULATIONS, TIMEOUTS, etc.)
- `../config/app-config`: Application configuration

**Module Dependencies:**
```
utils.ts (re-export hub)
  ├── logger.ts (logging, masking)
  ├── common.ts (general utilities)
  ├── security.ts (security utilities)
  ├── file-utils.ts (file operations)
  ├── apple-script-sanitizer.ts (AppleScript security)
  └── native-tools.ts (re-export hub)
      └── native-tools/
          ├── index.ts (main export hub)
          ├── paths.ts (path constants)
          ├── app-detection.ts (app/window detection)
          ├── paste-operations.ts (paste operations)
          └── directory-operations.ts (directory detection, delegates file listing to file-search/)

file-search/ (cross-platform file search, replaces native Swift file-searcher)
  ├── index.ts (exports listDirectory, checkFdAvailable)
  └── file-searcher.ts (fd + Node.js fs.readdir fallback)

symbol-search/ (cross-platform symbol search, replaces native Swift symbol-searcher)
  ├── index.ts (exports checkRgAvailable, getSupportedLanguages, searchSymbols)
  └── symbol-searcher-node.ts (ripgrep-based symbol search)

rate-limiter.ts (independent module)
```

**Native Tools (macOS Swift binaries):**
- `window-detector`: Window bounds and app detection
- `keyboard-simulator`: Keyboard simulation and app activation
- `text-field-detector`: Focused text field detection
- `directory-detector`: Current working directory detection

**Node.js Modules (cross-platform, replaced native Swift binaries):**
- `file-search/`: File listing using `fd` command with Node.js `fs.readdir` fallback
- `symbol-search/`: Symbol search using `ripgrep` directly from Node.js

## Platform Support

- **macOS**: Full functionality with native tools + cross-platform modules
- **Windows/Linux**: Limited functionality (file system, utility functions, file-search, and symbol-search modules work cross-platform)
- **Development**: Uses relative paths to native tools
- **Production**: Uses unpacked asar paths for native tools