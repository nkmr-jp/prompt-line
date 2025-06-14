# Native Tools Module

This module contains native macOS tools written in Objective-C that provide system-level functionality for Prompt Line. These compiled binaries replace AppleScript for better performance, security, and reliability.

## Overview

The native tools architecture provides:
- **High Performance**: Compiled binaries execute significantly faster than AppleScript
- **Enhanced Security**: No script injection vulnerabilities
- **Reliable Communication**: JSON-based structured data exchange
- **System Integration**: Direct access to macOS Cocoa and ApplicationServices frameworks
- **Error Handling**: Comprehensive error reporting with structured responses

## Files

### Makefile
Build configuration for compiling Objective-C sources into native binaries:

```makefile
CC = clang
CFLAGS = -Wall -Wextra -O2
FRAMEWORKS = -framework Cocoa -framework ApplicationServices
OUTPUT_DIR = ../src/native-tools
```

**Build Process:**
- **Compiler**: Uses clang with optimization flags
- **Frameworks**: Links against Cocoa and ApplicationServices
- **Output**: Creates binaries in `src/native-tools/` directory
- **Targets**: `window-detector` and `keyboard-simulator` executables

**Build Commands:**
```bash
make all           # Build both tools
make install       # Build and set executable permissions
make clean         # Remove built binaries
make rebuild       # Clean and rebuild everything
```

### window-detector.m
Native tool for window and application detection using macOS APIs:

**Core Functionality:**
```objective-c
@interface WindowDetector : NSObject
+ (NSDictionary *)getActiveWindowBounds;
+ (NSDictionary *)getCurrentApp;
@end
```

**Window Bounds Detection:**
- Uses `CGWindowListCopyWindowInfo()` to get system window information
- Filters windows by process ID and layer (main windows only)
- Returns JSON structure: `{ x, y, width, height, appName, bundleId }`
- Handles edge cases: no active window, permission issues, invalid data

**Application Detection:**
- Uses `NSWorkspace.frontmostApplication` for current app identification
- Provides both app name and bundle identifier
- Graceful fallback for apps without bundle IDs
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

### keyboard-simulator.m
Native tool for keyboard simulation and application activation:

**Core Functionality:**
```objective-c
@interface KeyboardSimulator : NSObject
+ (BOOL)sendCommandV;
+ (BOOL)activateApplicationByName:(NSString *)appName;
+ (BOOL)activateApplicationByBundleId:(NSString *)bundleId;
@end
```

**Keyboard Simulation:**
- Uses `CGEventCreateKeyboardEvent()` for precise key event generation
- Simulates Cmd+V with proper key down/up sequence
- Posts events via `CGEventPost()` with annotation session tap
- Handles memory management with `CFRelease()`

**Application Activation:**
- Uses `NSRunningApplication.activateWithOptions()` for app switching
- Supports activation by both app name and bundle identifier
- Uses `NSApplicationActivateAllWindows` for complete activation
- Handles running application enumeration and matching

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
  "success": true
}

// Error Response
{
  "success": false,
  "error": "Application not found"
}
```

## Architecture Integration

### Build Process Integration
1. **Development Build**: `npm run dev` includes native tool compilation
2. **Production Build**: `npm run build` ensures native tools are compiled and distributed
3. **Distribution**: Native binaries are packaged with the Electron app
4. **Platform Detection**: Build process only compiles on macOS systems

### Runtime Integration
**Path Resolution:**
```typescript
const NATIVE_TOOLS_DIR = path.join(__dirname, '..', 'native-tools');
const WINDOW_DETECTOR_PATH = path.join(NATIVE_TOOLS_DIR, 'window-detector');
const KEYBOARD_SIMULATOR_PATH = path.join(NATIVE_TOOLS_DIR, 'keyboard-simulator');
```

**Process Execution:**
```typescript
exec(`"${WINDOW_DETECTOR_PATH}" current-app`, options, (error, stdout) => {
  if (error) {
    logger.warn('Native tool error:', error);
    resolve(null);
  } else {
    const result = JSON.parse(stdout.trim());
    resolve(result);
  }
});
```

**Error Handling:**
- **Timeout Protection**: 2-3 second timeouts prevent hanging
- **Permission Validation**: Check for accessibility permissions
- **Fallback Strategies**: Graceful degradation when tools fail
- **Structured Logging**: Comprehensive error reporting with context

## Security Considerations

### Compilation Security
- **Source Verification**: All source code is visible and auditable
- **Compiler Flags**: `-Wall -Wextra` for comprehensive warnings
- **Framework Linking**: Only links against official Apple frameworks
- **Output Validation**: Compiled binaries are deterministic and verifiable

### Runtime Security
- **No Script Injection**: Compiled binaries eliminate script injection attacks
- **Permission Model**: Uses standard macOS accessibility permissions
- **Input Validation**: Command-line arguments are validated before processing
- **Error Isolation**: Tool failures don't compromise main application

### System Integration
- **Sandbox Compatibility**: Tools work within macOS security model
- **Permission Prompts**: Follows standard macOS permission request flow
- **Accessibility API**: Uses documented macOS accessibility frameworks
- **Process Isolation**: Each tool runs in separate process for isolation

## Performance Characteristics

### Execution Speed
- **Native Compilation**: Significantly faster than AppleScript (5-10x improvement)
- **Framework Access**: Direct API calls without interpretation overhead
- **Memory Efficiency**: Minimal memory footprint with automatic cleanup
- **Startup Time**: Fast process startup with optimized compilation

### Resource Usage
- **CPU Usage**: Minimal CPU overhead for brief operations
- **Memory Usage**: Small resident memory footprint
- **Disk Usage**: Compact binary size (~50KB each)
- **Network Usage**: No network dependencies

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
```

### Testing Integration
```bash
# Test window detection
../src/native-tools/window-detector current-app

# Test keyboard simulation (requires accessibility permissions)
../src/native-tools/keyboard-simulator paste
```

### Debugging
- **Console Output**: Native tools output JSON to stdout
- **Error Reporting**: Errors reported via stderr and JSON error fields
- **System Logs**: Integration with macOS system logging for debugging
- **Accessibility Debugging**: Use Accessibility Inspector for permission validation

## Cross-Platform Considerations

### macOS Exclusive
- **Platform Lock**: Native tools are macOS-specific by design
- **Framework Dependencies**: Requires Cocoa and ApplicationServices frameworks
- **API Compatibility**: Uses modern macOS APIs (10.12+ compatible)
- **Architecture Support**: Supports both Intel and Apple Silicon

### Fallback Strategy
- **Platform Detection**: Code checks `process.platform === 'darwin'`
- **Graceful Degradation**: Falls back to basic clipboard operations on other platforms
- **Feature Availability**: Advanced features (app switching, window detection) are macOS-only
- **Error Messages**: Clear communication about platform limitations

## Maintenance and Updates

### Version Compatibility
- **macOS Versions**: Tested on macOS 10.15+ (Catalina and newer)
- **API Stability**: Uses stable macOS APIs with long-term support
- **Deprecation Handling**: Monitors Apple's API deprecation announcements
- **Migration Path**: Clear upgrade path for API changes

### Code Maintenance
- **Documentation**: Comprehensive inline documentation in Objective-C
- **Error Handling**: Robust error handling with meaningful messages
- **Memory Management**: Proper memory management with ARC compatibility
- **Testing**: Unit tests for core functionality validation

### Distribution
- **Code Signing**: Native tools are code-signed with the main application
- **Notarization**: Included in macOS notarization process
- **Updates**: Native tools are updated with main application releases
- **Verification**: Checksums and signatures verify tool integrity