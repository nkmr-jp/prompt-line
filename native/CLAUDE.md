# Native Tools Module

This module contains native macOS tools written in **Swift** that provide system-level functionality for Prompt Line. These compiled binaries replace AppleScript for better performance, security, and reliability.

## Overview

The native tools architecture provides:
- **High Performance**: Compiled Swift binaries execute significantly faster than AppleScript
- **Enhanced Security**: No script injection vulnerabilities
- **Reliable Communication**: JSON-based structured data exchange
- **System Integration**: Direct access to macOS Cocoa and ApplicationServices frameworks
- **Error Handling**: Comprehensive error reporting with structured responses
- **Modern Language**: Swift provides memory safety and modern language features

## Files

### Makefile
Build configuration for compiling Swift sources into native binaries:

```makefile
SWIFTC = swiftc
SWIFT_FLAGS = -O
FRAMEWORKS = -framework Cocoa -framework ApplicationServices
OUTPUT_DIR = ../src/native-tools
SOURCES = window-detector.swift keyboard-simulator.swift text-field-detector.swift directory-detector file-searcher symbol-searcher
TARGETS = $(OUTPUT_DIR)/window-detector $(OUTPUT_DIR)/keyboard-simulator $(OUTPUT_DIR)/text-field-detector $(OUTPUT_DIR)/directory-detector $(OUTPUT_DIR)/file-searcher $(OUTPUT_DIR)/symbol-searcher
```

**Build Process:**
- **Compiler**: Uses `swiftc` with optimization flags (`-O`)
- **Frameworks**: Links against Cocoa and ApplicationServices
- **Output**: Creates binaries in `src/native-tools/` directory
- **Targets**: `window-detector`, `keyboard-simulator`, `text-field-detector`, `directory-detector`, `file-searcher`, and `symbol-searcher` executables
- **Bridging Header**: `directory-detector` uses `libproc-bridge.h` for fast CWD detection via libproc
- **Multi-file Tools**: `directory-detector`, `file-searcher`, and `symbol-searcher` are directory-based with multiple Swift files

**Build Commands:**
```bash
make all           # Build all tools
make install       # Build and set executable permissions
make clean         # Remove built binaries
make rebuild       # Clean and rebuild everything
```

### window-detector.swift
Native tool for window and application detection using macOS APIs:

**Core Functionality:**
```swift
class WindowDetector {
    static func getActiveWindowBounds() -> [String: Any]
    static func getCurrentApp() -> [String: Any]
}
```

**Window Bounds Detection:**
- Uses `CGWindowListCopyWindowInfo()` to get system window information
- Filters windows by process ID and layer (main windows only, layer 0)
- Returns JSON structure: `{ x, y, width, height, appName, bundleId }`
- Handles edge cases: no active window, permission issues, invalid data
- Uses `NSWorkspace.shared.frontmostApplication` to get current app context

**Application Detection:**
- Uses `NSWorkspace.shared.frontmostApplication` for current app identification
- Provides both app name (`localizedName`) and bundle identifier
- Graceful fallback for apps without bundle IDs (returns `NSNull()`)
- Error handling for system state inconsistencies

**Command-Line Interface:**
```bash
window-detector current-app     # Get current application info
window-detector window-bounds   # Get active window bounds
```

**JSON Response Format:**
```json
// Current App Response
{
  "name": "Terminal",
  "bundleId": "com.apple.Terminal"
}

// Window Bounds Response
{
  "x": 100,
  "y": 200,
  "width": 800,
  "height": 600,
  "appName": "Terminal",
  "bundleId": "com.apple.Terminal"
}

// Error Response
{
  "error": "No active window found"
}
```

### keyboard-simulator.swift
Native tool for keyboard simulation and application activation:

**Core Functionality:**
```swift
class KeyboardSimulator {
    static func sendCommandV() -> Bool
    static func activateApplication(byName appName: String) -> Bool
    static func activateApplication(byBundleId bundleId: String) -> Bool
}
```

**Keyboard Simulation:**
- Uses `CGEvent(keyboardEventSource:virtualKey:keyDown:)` for precise key event generation
- Simulates Cmd+V with proper key down/up sequence (virtual key 9 = 'V')
- Uses `.maskCommand` flag for Command key modifier
- Posts events via `CGEvent.post(tap: .cghidEventTap)`
- Includes 10ms delay between key down and up events
- Checks accessibility permissions with `AXIsProcessTrustedWithOptions()`

**Application Activation:**
- Uses `NSWorkspace.shared.runningApplications` to enumerate running apps
- Supports activation by both app name (`localizedName`) and bundle identifier
- Uses `NSRunningApplication.activate(options: .activateAllWindows)` for complete activation
- Handles running application enumeration and matching
- Provides detailed logging for debugging

**Command-Line Interface:**
```bash
keyboard-simulator paste                           # Send Cmd+V to current app
keyboard-simulator activate-name "Terminal"        # Activate app by name
keyboard-simulator activate-bundle "com.apple.Terminal"  # Activate by bundle ID
keyboard-simulator activate-and-paste-name "Terminal"    # Combined operation
keyboard-simulator activate-and-paste-bundle "com.apple.Terminal"  # Combined operation
```

**JSON Response Format:**
```json
// Success Response
{
  "success": true,
  "command": "paste",
  "hasAccessibility": true
}

// Error Response
{
  "success": false,
  "command": "paste",
  "hasAccessibility": false
}
```

### text-field-detector.swift
Native tool for detecting focused text fields using macOS Accessibility APIs:

**Core Functionality:**
```swift
class TextFieldDetector {
    static func getActiveTextFieldBounds() -> [String: Any]
    static func getFocusedContainerBounds(from element: AXUIElement, ...) -> [String: Any]?
    static func getElementBounds(from element: AXUIElement) -> CGRect?
    static func checkAccessibilityPermission() -> [String: Any]
    static func getFocusedElementInfo() -> [String: Any]
}
```

**Features:**
- Detects the currently focused text field in any application
- Returns position and size of the focused element
- Used for `active-text-field` window positioning mode
- **Container Detection for Terminal Apps**: When text field is not found (e.g., Ghostty), traverses parent hierarchy to find suitable container bounds
- Supports multiple detection methods: `text_field`, `focused_element`, `parent_container`

**Detection Strategy:**
1. First, check if focused element is a standard text field (`AXTextField`, `AXTextArea`, `AXSecureTextField`, `AXComboBox`)
2. If not a text field, try to get bounds from the focused element itself (if it has reasonable size > 50x50)
3. If that fails, traverse parent hierarchy looking for containers (`AXScrollArea`, `AXGroup`, `AXSplitGroup`, `AXLayoutArea`)
4. Stop at window level (`AXWindow`) to prevent using entire window bounds

**Command-Line Interface:**
```bash
text-field-detector text-field-bounds  # Detect focused text field/container position
text-field-detector check-permission   # Check accessibility permission status
text-field-detector focused-element    # Get information about focused element
```

**JSON Response Format:**
```json
// Standard Text Field Response
{
  "success": true,
  "x": 100,
  "y": 200,
  "width": 300,
  "height": 24,
  "role": "AXTextArea",
  "appName": "iTerm2",
  "bundleId": "com.googlecode.iterm2"
}

// Container Detection Response (for Ghostty, etc.)
{
  "success": true,
  "x": 100,
  "y": 200,
  "width": 500,
  "height": 400,
  "role": "AXGroup",
  "originalRole": "AXUnknown",
  "appName": "Ghostty",
  "bundleId": "com.mitchellh.ghostty",
  "detectionMethod": "parent_container",
  "traversalDepth": 2
}

// Focused Element Response (when element has bounds)
{
  "success": true,
  "x": 100,
  "y": 200,
  "width": 500,
  "height": 400,
  "role": "AXGroup",
  "appName": "Ghostty",
  "bundleId": "com.mitchellh.ghostty",
  "detectionMethod": "focused_element"
}

// Error Response
{
  "error": "not_text_field",
  "role": "AXUnknown"
}
```

**Supported Terminal Detection:**
- **iTerm2**: Exposes `AXTextArea` for terminal input (standard detection)
- **Terminal.app**: Exposes `AXTextArea` for terminal input (standard detection)
- **Ghostty**: Uses container detection via parent hierarchy traversal
- **Other terminals**: Falls back to container detection when text field not exposed

### directory-detector/ (Multi-file tool)
Native tool for terminal/IDE directory detection and file search:

**Directory Structure:**
- `directory-detector/main.swift` - Entry point and CLI handling
- `directory-detector/DirectoryDetector.swift` - Main coordinator for detection logic
- `directory-detector/CWDDetector.swift` - CWD detection using libproc
- `directory-detector/TerminalDetector.swift` - Terminal-specific detection (Terminal.app, iTerm2)
- `directory-detector/IDEDetector.swift` - IDE-specific detection (VSCode, JetBrains, Cursor, etc.)
- `directory-detector/ProcessTree.swift` - Process tree traversal utilities
- `directory-detector/MultiplexerDetector.swift` - tmux/screen multiplexer detection

**Core Functionality:**
```swift
class DirectoryDetector {
    static func detectCurrentDirectory() -> [String: Any]
    static func getFileList(from directory: String) -> FileListResult?
}

class CWDDetector {
    static func getCwdFromPid(_ pid: pid_t) -> String?
}
```

**Supported Applications:**
- **Terminal.app** (`com.apple.Terminal`) - Uses AppleScript to get TTY, then libproc for CWD
- **iTerm2** (`com.googlecode.iterm2`) - Uses AppleScript to get TTY, then libproc for CWD
- **Ghostty** (`com.mitchellh.ghostty`) - Uses process tree traversal to find shell CWD
- **Warp** (`dev.warp.Warp-Stable`) - Uses process tree traversal to find shell CWD
- **WezTerm** (`com.github.wez.wezterm`) - Uses process tree traversal to find shell CWD
- **JetBrains IDEs** (`com.jetbrains.*`) - IntelliJ IDEA, WebStorm, PyCharm, etc. Uses window title parsing and shell process detection
- **VSCode** (`com.microsoft.VSCode`, `com.microsoft.VSCodeInsiders`, `com.vscodium.VSCodium`) - Uses pty-host process tree traversal
- **Cursor** (`com.todesktop.230313mzl4w4u92`) - Uses Electron pty-host detection
- **Windsurf** (`com.exafunction.windsurf`) - Uses Electron pty-host detection
- **Zed** (`dev.zed.Zed`) - Uses process tree traversal to find shell CWD
- **OpenCode** (`ai.opencode.desktop`) - Uses Tauri pty-host detection
- **Antigravity** (`com.google.antigravity`) - Google IDE, uses tmux-based terminal detection
- **Kiro** (`dev.kiro.desktop`) - AWS IDE, uses Electron pty-host detection

**CWD Detection:**
- Uses libproc `proc_pidinfo()` for 10-50x faster CWD detection compared to `lsof`
- Performance: ~1-5ms vs 50-200ms for lsof
- Automatic fallback to lsof if libproc fails
- Requires `libproc-bridge.h` bridging header

**File Search Integration:**
- Requires `fd` command (https://github.com/sharkdp/fd)
- Supports `.gitignore` respect, exclude/include patterns
- Handles symlink directories with path preservation
- Default excludes: node_modules, .git, dist, build, etc.
- Configurable max files, depth, and hidden file inclusion

**Command-Line Interface:**
```bash
directory-detector detect                        # Detect CWD from active terminal/IDE
directory-detector detect --bundleId <id>        # Detect from specific app
directory-detector detect-with-files [options]   # Detect CWD and list files
directory-detector list <path> [options]         # List files in directory
directory-detector check-fd                      # Check if fd is available

# Options:
#   --pid <pid>            Use specific process ID
#   --bundleId <id>        Bundle ID of the app
#   --no-gitignore         Don't respect .gitignore
#   --exclude <pattern>    Add exclude pattern
#   --include <pattern>    Include pattern for .gitignored files
#   --max-files <n>        Maximum files (default: 5000)
#   --include-hidden       Include hidden files
#   --max-depth <n>        Maximum directory depth
#   --follow-symlinks      Follow symbolic links
```

**JSON Response Format:**
```json
// Detect Response (Terminal)
{
  "success": true,
  "directory": "/Users/user/project",
  "tty": "/dev/ttys001",
  "pid": 12345,
  "appName": "Terminal",
  "bundleId": "com.apple.Terminal",
  "method": "tty"
}

// Detect Response (IDE)
{
  "success": true,
  "directory": "/Users/user/project",
  "appName": "Code",
  "bundleId": "com.microsoft.VSCode",
  "idePid": 12345,
  "pid": 12346,
  "method": "electron-pty"
}

// Detect with Files Response
{
  "success": true,
  "directory": "/Users/user/project",
  "files": [{"name": "index.ts", "path": "/Users/user/project/index.ts", "isDirectory": false}],
  "fileCount": 150,
  "searchMode": "recursive",
  "partial": false
}

// Error Response
{
  "error": "Not a supported terminal or IDE application",
  "appName": "Safari",
  "bundleId": "com.apple.Safari"
}
```

### file-searcher/ (Multi-file tool)
Native tool for fast file search using the `fd` command:

**Directory Structure:**
- `file-searcher/main.swift` - Entry point and CLI handling
- `file-searcher/Types.swift` - Type definitions for file search
- `file-searcher/FileSearcher.swift` - Core file search logic

**Core Functionality:**
```swift
class FileSearcher {
    static func listFiles(from directory: String, options: SearchOptions) -> FileListResult
    static func checkFdAvailable() -> Bool
}
```

**Features:**
- Uses `fd` command for fast recursive file searching (https://github.com/sharkdp/fd)
- Respects `.gitignore` patterns with optional override
- Supports exclude/include patterns for filtering
- Handles symlink directories with path preservation
- Default excludes: node_modules, .git, dist, build, etc.
- Configurable max files, depth, and hidden file inclusion

**Command-Line Interface:**
```bash
file-searcher list <path> [options]    # List files in directory
file-searcher check-fd                 # Check if fd is available

# Options:
#   --no-gitignore         Don't respect .gitignore
#   --exclude <pattern>    Add exclude pattern
#   --include <pattern>    Include pattern for .gitignored files
#   --max-files <n>        Maximum files (default: 5000)
#   --include-hidden       Include hidden files
#   --max-depth <n>        Maximum directory depth
#   --follow-symlinks      Follow symbolic links
```

**JSON Response Format:**
```json
// List Response
{
  "success": true,
  "files": [
    {"name": "index.ts", "path": "/Users/user/project/index.ts", "isDirectory": false}
  ],
  "fileCount": 150,
  "partial": false
}

// Check fd Response
{
  "available": true,
  "version": "8.7.0"
}

// Error Response
{
  "error": "fd command not found",
  "suggestion": "Install fd: brew install fd"
}
```

### symbol-searcher/ (Multi-file tool)
Native tool for code symbol search across 20+ programming languages using ripgrep:

**Directory Structure:**
- `symbol-searcher/main.swift` - Entry point and CLI handling
- `symbol-searcher/Types.swift` - Type definitions for symbols and languages
- `symbol-searcher/SymbolPatterns.swift` - Language-specific regex patterns for symbol detection
- `symbol-searcher/RipgrepExecutor.swift` - ripgrep command execution and result parsing
- `symbol-searcher/CacheManager.swift` - Cache management (deprecated, use JS-side SymbolCacheManager)

**Core Functionality:**
```swift
class SymbolSearcher {
    static func searchSymbols(in directory: String, language: String, options: SearchOptions) -> SymbolSearchResult
    static func checkRgAvailable() -> Bool
    static func getSupportedLanguages() -> [LanguageInfo]
}
```

**Supported Languages (20+):**

| Language | Key | Symbol Types |
|----------|-----|--------------|
| Go | `go` | function, method, struct, interface, type, constant, variable |
| TypeScript | `ts` | function, class, interface, type, enum, constant, namespace |
| TypeScript React | `tsx` | function, class, interface, type, enum, constant |
| JavaScript | `js` | function, class, constant, variable |
| JavaScript React | `jsx` | function, class, constant, variable |
| Python | `py` | function, class, constant |
| Rust | `rs` | function, struct, enum, trait, type, constant, variable, module |
| Java | `java` | class, interface, enum, method |
| Kotlin | `kt` | function, class, interface, enum, typealias, constant |
| Swift | `swift` | function, class, struct, protocol, enum, typealias |
| Ruby | `rb` | function, class, module, constant |
| C++ | `cpp` | class, struct, enum, namespace, typedef |
| C | `c` | struct, enum, typedef |
| Shell | `sh` | function, variable |
| Makefile | `make`, `mk` | function (targets), variable |
| PHP | `php` | function, class, interface, trait, constant, enum |
| C# | `cs` | class, interface, struct, enum, method, namespace |
| Scala | `scala` | function, class, trait, object, type, constant, variable |
| Terraform | `tf`, `terraform` | resource, data, variable, output, module, provider |
| Markdown | `md`, `markdown` | heading |

**Command-Line Interface:**
```bash
# Basic Commands (Swift-side)
symbol-searcher check-rg                           # Check if ripgrep is available
symbol-searcher list-languages                     # List all supported languages
symbol-searcher search <directory> --language <lang> [options]  # Search symbols (always full search)

# Search Options:
#   --language, -l <lang>  Language to search (e.g., go, ts, py, rs)
#   --max-symbols <n>      Maximum symbols to return (default: 20000)
#   --exclude <pattern>    Exclude files matching glob pattern
#   --include <pattern>    Include files matching glob pattern

# Note: Swift-side caching has been disabled to avoid double caching with JS-side SymbolCacheManager.
#       The following commands are deprecated and will return an error:
#         - build-cache (cache is built automatically by JS-side)
#         - cache-info (use JS-side IPC handler 'get-cached-symbols')
#         - clear-cache (use JS-side IPC handler 'clear-symbol-cache')
#         - --no-cache option (no longer needed as Swift always performs full search)
```

**Cache Storage (JS-side only):**
- Cache is stored in `~/.prompt-line/cache/<encoded-path>/`
- Path encoding: `/Users/nkmr/project` → `-Users-nkmr-project`
- Files per language:
  - `symbol-metadata.json` - Cache metadata (version, TTL, language info, timestamps)
  - `symbols-<lang>.jsonl` - Symbol data in JSONL format per language
- Cache management is handled entirely by JS-side SymbolCacheManager with:
  - In-memory LRU cache (50 entries, 5-minute TTL)
  - Persistent JSONL storage with 1-hour TTL
  - Automatic background refresh on stale cache hits

**JSON Response Format:**
```json
// Search Response
{
  "success": true,
  "symbols": [
    {
      "name": "handleRequest",
      "type": "function",
      "filePath": "/Users/user/project/src/handler.go",
      "lineNumber": 42,
      "lineContent": "func handleRequest(w http.ResponseWriter, r *http.Request) {"
    }
  ],
  "count": 150,
  "language": "go",
  "searchMode": "full"
}

// Languages Response
{
  "languages": [
    {"key": "go", "name": "Go", "extensions": [".go"]},
    {"key": "ts", "name": "TypeScript", "extensions": [".ts"]}
  ]
}

// Check rg Response
{
  "available": true,
  "version": "14.0.0"
}

// Error Response
{
  "error": "ripgrep (rg) command not found",
  "suggestion": "Install ripgrep: brew install ripgrep"
}
```

**Dependencies:**
- Requires `ripgrep` (`rg`) command: `brew install ripgrep`

**Performance Characteristics:**

Symbol search performance with JS-side caching:

| Operation | Performance | Notes |
|-----------|-------------|-------|
| First search (no cache) | ~28-32 sec | Full ripgrep scan (e.g., Kubernetes: 16,549 Go files) |
| Cached search (memory hit) | **<10ms** | LRU memory cache hit (50 entries, 5-min TTL) |
| Cached search (disk hit) | **80-100ms** | JSONL disk cache read (streaming with early termination) |
| Background refresh | Non-blocking | Stale-while-revalidate pattern updates cache in background |

**Cache Behavior:**
- **Automatic caching**: First search result is automatically cached by JS-side SymbolCacheManager
- **Stale-while-revalidate**: Returns cached data immediately, refreshes in background if stale (>1 hour)
- **Memory optimization**: LRU cache keeps 50 most recent projects in memory for instant access
- **Disk efficiency**: JSONL streaming read with early termination when maxSymbols limit is reached

**Performance Tuning Tips:**
1. **Use `--max-symbols`** to limit results for faster searches (default: 20000)
2. **Leverage cache**: First search may be slow, subsequent searches are instant (memory) or fast (disk)
3. **Background refresh**: Cache updates automatically, no manual intervention needed
4. **Clear cache**: Use JS-side IPC handler `clear-symbol-cache` after major refactoring if needed

## Architecture Integration

### Build Process Integration
1. **Development Build**: Development build includes native tool compilation via `make install`
2. **Production Build**: `npm run build` ensures native tools are compiled and distributed
3. **Distribution**: Native binaries are packaged with the Electron app in `dist/native-tools/`
4. **Platform Detection**: Build process only compiles on macOS systems
5. **Asset Unpacking**: Electron-builder configured to unpack native tools from ASAR (`asarUnpack: ["dist/native-tools/**/*"]`)

**NPM Script Integration:**
```json
{
  "compile": "node node_modules/electron/install.js && tsc && npm run build:renderer && cd native && make install && cp -r ../src/native-tools ../dist/"
}
```

### Runtime Integration
**Path Resolution with Packaging Support:**
```typescript
function getNativeToolsPath(): string {
  const { app } = require('electron');
  
  if (app && app.isPackaged) {
    // In packaged mode, native tools are in the .asar.unpacked directory
    const appPath = app.getAppPath();
    const resourcesPath = path.dirname(appPath);
    return path.join(resourcesPath, 'app.asar.unpacked', 'dist', 'native-tools');
  }
  
  // Development mode
  return path.join(__dirname, '..', 'native-tools');
}

const NATIVE_TOOLS_DIR = getNativeToolsPath();
const WINDOW_DETECTOR_PATH = path.join(NATIVE_TOOLS_DIR, 'window-detector');
const KEYBOARD_SIMULATOR_PATH = path.join(NATIVE_TOOLS_DIR, 'keyboard-simulator');
```

**Process Execution with Comprehensive Error Handling:**
```typescript
exec(`"${WINDOW_DETECTOR_PATH}" current-app`, options, (error, stdout) => {
  if (error) {
    logger.warn('Native tool error:', error);
    resolve(null);
  } else {
    try {
      const result = JSON.parse(stdout.trim());
      if (result.error) {
        logger.warn('Native tool returned error:', result.error);
        resolve(null);
        return;
      }
      resolve(result);
    } catch (parseError) {
      logger.warn('Error parsing native tool output:', parseError);
      resolve(null);
    }
  }
});
```

**Error Handling:**
- **Timeout Protection**: Configurable timeouts prevent hanging (2-3 seconds)
- **Permission Validation**: Check for accessibility permissions via Swift tools
- **Fallback Strategies**: Graceful degradation when tools fail
- **Structured Logging**: Comprehensive error reporting with context
- **Platform Guards**: macOS-only execution with platform checks

## Security Considerations

### Compilation Security
- **Source Verification**: All Swift source code is visible and auditable
- **Compiler Optimization**: Swift compiler with `-O` optimization flag
- **Framework Linking**: Only links against official Apple frameworks (Cocoa, ApplicationServices)
- **Memory Safety**: Swift provides automatic memory management and safety features
- **Output Validation**: Compiled binaries are deterministic and verifiable

### Runtime Security
- **No Script Injection**: Compiled Swift binaries eliminate script injection attacks
- **Permission Model**: Uses standard macOS accessibility permissions via `AXIsProcessTrustedWithOptions()`
- **Input Validation**: Command-line arguments are validated before processing
- **Error Isolation**: Tool failures don't compromise main application
- **Structured Logging**: Comprehensive logging for security auditing

### System Integration
- **Entitlements**: Required entitlements defined in `build/entitlements.mac.plist`:
  - `com.apple.security.automation.apple-events`: For AppleScript automation
  - `com.apple.security.cs.disable-library-validation`: For Electron compatibility
- **Permission Prompts**: Follows standard macOS permission request flow
- **Accessibility API**: Uses documented macOS accessibility frameworks
- **Process Isolation**: Each tool runs in separate process for isolation
- **No Hardened Runtime**: Disabled for accessibility features (`hardenedRuntime: false`)

## Performance Characteristics

### Execution Speed
- **Native Swift Compilation**: Significantly faster than AppleScript (5-10x improvement)
- **Framework Access**: Direct API calls without interpretation overhead
- **Memory Efficiency**: Swift's automatic reference counting provides efficient memory management
- **Startup Time**: Fast process startup with optimized Swift compilation
- **JSON Processing**: Efficient JSON serialization/deserialization using Foundation APIs

### Resource Usage
- **CPU Usage**: Minimal CPU overhead for brief operations
- **Memory Usage**: Small resident memory footprint with automatic cleanup
- **Disk Usage**: Compact binary size (~100-150KB each)
- **Network Usage**: No network dependencies
- **Timeout Protection**: Configurable timeouts prevent resource leaks

## Development Workflow

### Local Development
```bash
# Navigate to native directory
cd native

# Build native tools
make all

# Install with permissions
make install

# Verify installation
ls -la ../src/native-tools/

# Or use integrated npm script
npm run compile  # Builds TypeScript + native tools + copies to dist/
```

### Testing Integration
```bash
# Test window detection
../src/native-tools/window-detector current-app

# Test window bounds detection
../src/native-tools/window-detector window-bounds

# Test keyboard simulation (requires accessibility permissions)
../src/native-tools/keyboard-simulator paste

# Test app activation
../src/native-tools/keyboard-simulator activate-name "Terminal"
../src/native-tools/keyboard-simulator activate-bundle "com.apple.Terminal"

# Test combined operations
../src/native-tools/keyboard-simulator activate-and-paste-name "Terminal"

# Test text field detection
../src/native-tools/text-field-detector detect

# Test directory detection (from active terminal/IDE)
../src/native-tools/directory-detector detect

# Test directory detection with files
../src/native-tools/directory-detector detect-with-files

# Test file listing
../src/native-tools/directory-detector list /path/to/project

# Check fd availability
../src/native-tools/directory-detector check-fd

# Test file-searcher
../src/native-tools/file-searcher list /path/to/project
../src/native-tools/file-searcher check-fd

# Test symbol-searcher
../src/native-tools/symbol-searcher check-rg
../src/native-tools/symbol-searcher list-languages
../src/native-tools/symbol-searcher search /path/to/project --language go
../src/native-tools/symbol-searcher search /path/to/project --language ts --max-symbols 1000
../src/native-tools/symbol-searcher search /path/to/project -l go --no-cache

# Test symbol-searcher cache commands
../src/native-tools/symbol-searcher build-cache /path/to/project -l go
../src/native-tools/symbol-searcher cache-info /path/to/project
../src/native-tools/symbol-searcher cache-info /path/to/project -l go
../src/native-tools/symbol-searcher clear-cache /path/to/project -l go
../src/native-tools/symbol-searcher clear-cache /path/to/project --all
```

### Debugging
- **Console Output**: Native tools output JSON to stdout
- **Error Reporting**: Errors reported via stderr and JSON error fields
- **System Logs**: Integration with macOS system logging for debugging
- **Accessibility Debugging**: Use Accessibility Inspector for permission validation
- **Structured Logging**: Application logs include native tool execution details
- **Timeout Handling**: Configurable timeouts with detailed error reporting

## Cross-Platform Considerations

### macOS Exclusive
- **Platform Lock**: Native tools are macOS-specific by design
- **Framework Dependencies**: Requires Cocoa and ApplicationServices frameworks
- **API Compatibility**: Uses modern macOS APIs (10.12+ compatible)
- **Architecture Support**: Supports both Intel and Apple Silicon via universal binaries
- **Swift Runtime**: Requires Swift runtime (included in modern macOS versions)

### Fallback Strategy
- **Platform Detection**: Code checks `process.platform === 'darwin'`
- **Graceful Degradation**: Falls back to basic clipboard operations on other platforms
- **Feature Availability**: Advanced features (app switching, window detection) are macOS-only
- **Error Messages**: Clear communication about platform limitations via logging

## Usage Patterns

### Core Functions Used by Application
1. **Window Positioning**: `getActiveWindowBounds()` in `utils.ts` for `active-window-center` positioning
2. **App Detection**: `getCurrentApp()` in `utils.ts` to track source application
3. **Keyboard Simulation**: `pasteWithNativeTool()` in `utils.ts` for Cmd+V simulation
4. **App Activation**: `activateAndPasteWithNativeTool()` in `utils.ts` for combined operations
5. **Window Management**: `focusPreviousApp()` in `window-manager.ts` for app switching
6. **Text Field Detection**: `detectTextFieldPosition()` in `window-manager.ts` for `active-text-field` positioning
7. **Directory Detection**: `detectDirectory()` in `window-manager.ts` for terminal/IDE CWD detection
8. **File Search**: `getFileListWithDirectory()` in `window-manager.ts` for @ mention file search
9. **Symbol Search**: `searchSymbols()` in `symbol-searcher.ts` for `@language:query` code search
10. **File Listing**: `listFiles()` in `file-searcher.ts` for fast file discovery

### Timeout Configuration
```typescript
const TIMEOUTS = {
  CURRENT_APP_TIMEOUT: 2000,        // getCurrentApp()
  WINDOW_BOUNDS_TIMEOUT: 2000,      // getActiveWindowBounds()
  NATIVE_PASTE_TIMEOUT: 3000,       // pasteWithNativeTool()
  ACTIVATE_PASTE_TIMEOUT: 3000,     // activateAndPasteWithNativeTool()
  TEXT_FIELD_DETECTION: 3000,       // detectTextFieldPosition()
  DIRECTORY_DETECTION: 5000,        // detectDirectory(), fd process timeout
  SYMBOL_SEARCH_TIMEOUT: 5000       // searchSymbols(), ripgrep process timeout
};
```

## Maintenance and Updates

### Version Compatibility
- **macOS Versions**: Tested on macOS 10.15+ (Catalina and newer)
- **API Stability**: Uses stable macOS APIs with long-term support
- **Deprecation Handling**: Monitors Apple's API deprecation announcements
- **Swift Version**: Compatible with Swift 5.0+ runtime

### Code Maintenance
- **Documentation**: Comprehensive inline documentation in Swift
- **Error Handling**: Robust error handling with meaningful JSON error responses
- **Memory Management**: Automatic reference counting provides memory safety
- **Testing**: Integration tests via command-line interface validation

### Distribution
- **Code Signing**: Native tools are code-signed with the main application
- **Notarization**: Included in macOS notarization process
- **Updates**: Native tools are updated with main application releases
- **Asset Unpacking**: Electron-builder unpacks native tools from ASAR for execution
- **Verification**: Build process ensures tool availability and permissions