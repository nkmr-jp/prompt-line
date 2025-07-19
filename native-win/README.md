# Windows Native Tools

This module contains native Windows tools written in **C#** that provide system-level functionality for Prompt Line on Windows. These compiled binaries replace FFI-based DLL calls for better compatibility, security, and reliability.

## Overview

The Windows native tools architecture provides:
- **High Performance**: Compiled C# binaries execute efficiently
- **Enhanced Security**: No DLL export complications or script injection vulnerabilities  
- **Reliable Communication**: JSON-based structured data exchange via stdout/stdin
- **System Integration**: Direct access to Windows APIs through P/Invoke
- **Error Handling**: Comprehensive error reporting with structured responses
- **Modern Language**: C# provides memory safety and robust error handling

## Files

### build-all.ps1
PowerShell build script for compiling all C# projects:

```powershell
# Build all Windows native tools
powershell -ExecutionPolicy Bypass -File build-all.ps1
```

**Build Process:**
- **Compiler**: Uses `dotnet build` with Release configuration
- **Runtime**: Targets `win-x64` runtime identifier
- **Output**: Creates executables in `../src/native-tools/` directory
- **Dependencies**: Copies .exe, .dll, .runtimeconfig.json, and .deps.json files

### window-detector/
Native tool for window and application detection using Windows APIs:

**Core Functionality:**
- `current-app`: Get current foreground application information
- `window-bounds`: Get active window bounds and dimensions

**Command-Line Interface:**
```cmd
window-detector.exe current-app     # Get current application info
window-detector.exe window-bounds   # Get active window bounds
```

**JSON Response Format:**
```json
// Current App Response
{
  "name": "notepad",
  "bundleId": null
}

// Window Bounds Response
{
  "x": 100,
  "y": 200,
  "width": 800,
  "height": 600,
  "appName": "notepad",
  "bundleId": null
}

// Error Response
{
  "error": "No active window found"
}
```

### keyboard-simulator/
Native tool for keyboard simulation and application activation:

**Core Functionality:**
- `paste`: Send Ctrl+V to current application
- `activate-name <app>`: Activate application by process name
- `activate-and-paste-name <app>`: Combined activation and paste operation

**Command-Line Interface:**
```cmd
keyboard-simulator.exe paste                           # Send Ctrl+V
keyboard-simulator.exe activate-name "notepad"         # Activate app by name
keyboard-simulator.exe activate-and-paste-name "notepad"  # Combined operation
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
  "error": "Failed to send Ctrl+V"
}
```

### text-field-detector/
Native tool for focused text field detection using Windows UI Automation:

**Core Functionality:**
- Default command: Detect currently focused text input field
- `bounds` or `text-field-bounds`: Same as default

**Command-Line Interface:**
```cmd
text-field-detector.exe                    # Detect focused text field
text-field-detector.exe bounds             # Same as above
```

**JSON Response Format:**
```json
// Success Response
{
  "x": 150,
  "y": 300,
  "width": 400,
  "height": 25,
  "appName": "notepad",
  "bundleId": null,
  "controlType": "edit",
  "name": "Text Editor"
}

// Error Response
{
  "error": "No focused text field found"
}
```

## Architecture Integration

### Build Process Integration
1. **Development Build**: `npm run compile` includes Windows native tool compilation
2. **Production Build**: `npm run build:win` ensures native tools are compiled and distributed
3. **Platform Detection**: Build process only compiles on Windows systems (`win32`)
4. **Asset Distribution**: Native binaries are included in Electron app distribution

**NPM Script Integration:**
```json
{
  "compile:win": "cd native-win && powershell -ExecutionPolicy Bypass -File build-all.ps1 && cd .."
}
```

### Runtime Integration
**Path Resolution with Packaging Support:**
```typescript
function getNativeToolsPath(): string {
  if (app && app.isPackaged) {
    // In packaged mode, native tools are in the .asar.unpacked directory
    const appPath = app.getAppPath();
    const resourcesPath = path.dirname(appPath);
    return path.join(resourcesPath, 'app.asar.unpacked', 'dist', 'native-tools');
  }
  
  // Development mode
  return path.join(__dirname, '..', '..', 'src', 'native-tools');
}

const WINDOW_DETECTOR_PATH = path.join(NATIVE_TOOLS_DIR, 'window-detector.exe');
const KEYBOARD_SIMULATOR_PATH = path.join(NATIVE_TOOLS_DIR, 'keyboard-simulator.exe');
const TEXT_FIELD_DETECTOR_PATH = path.join(NATIVE_TOOLS_DIR, 'text-field-detector.exe');
```

**Process Execution with Error Handling:**
```typescript
exec(`"${WINDOW_DETECTOR_PATH}" current-app`, options, (error, stdout) => {
  if (error) {
    console.warn('Native tool error:', error);
    resolve(null);
  } else {
    try {
      const result = JSON.parse(stdout.trim());
      if (result.error) {
        console.warn('Native tool returned error:', result.error);
        resolve(null);
        return;
      }
      resolve(result);
    } catch (parseError) {
      console.warn('Error parsing native tool output:', parseError);
      resolve(null);
    }
  }
});
```

## Technical Implementation

### Windows API Integration
- **User32.dll**: Window management, input simulation, process information
- **UI Automation**: Text field detection using Windows Accessibility APIs
- **P/Invoke**: Direct Windows API calls for optimal performance
- **Process Management**: Application enumeration and activation

### Dependencies
- **.NET 8 Runtime**: Required for execution (framework-dependent deployment)
- **System.Text.Json**: JSON serialization for structured communication
- **Microsoft.WindowsDesktop.App**: Windows Desktop APIs and UI Automation

### Security Considerations
- **No Special Permissions**: Windows tools don't require explicit accessibility permissions
- **Process Isolation**: Each tool runs in separate process for security isolation
- **Input Validation**: Command-line arguments are validated before processing
- **Error Isolation**: Tool failures don't compromise main application

## Development Workflow

### Local Development
```cmd
# Navigate to native-win directory
cd native-win

# Build all native tools
powershell -ExecutionPolicy Bypass -File build-all.ps1

# Or use integrated npm script
npm run compile  # Builds TypeScript + native tools + copies to src/native-tools/
```

### Testing Integration
```cmd
# Test window detection
..\src\native-tools\window-detector.exe current-app

# Test window bounds detection
..\src\native-tools\window-detector.exe window-bounds

# Test keyboard simulation
..\src\native-tools\keyboard-simulator.exe paste

# Test app activation
..\src\native-tools\keyboard-simulator.exe activate-name "notepad"

# Test text field detection
..\src\native-tools\text-field-detector.exe
```

### Debugging
- **Console Output**: Native tools output JSON to stdout
- **Error Reporting**: Errors reported via stderr and JSON error fields
- **Structured Logging**: Application logs include native tool execution details
- **Timeout Handling**: Configurable timeouts with detailed error reporting

## Cross-Platform Compatibility

### Windows Exclusive
- **Platform Lock**: Native tools are Windows-specific by design (`win32` only)
- **API Dependencies**: Uses Windows-specific APIs (User32, UI Automation)
- **Runtime Requirements**: Requires .NET 8 Runtime on target system
- **Architecture Support**: Supports x64 Windows systems

### Integration with macOS Version
- **Unified Interface**: Same IPlatformTools interface as macOS version
- **Consistent JSON**: Compatible JSON response formats
- **Parallel Architecture**: Similar process-based execution model
- **Cross-Platform Electron**: Same Electron main process code works on both platforms

## Maintenance and Updates

### Version Compatibility
- **Windows Versions**: Tested on Windows 10/11
- **API Stability**: Uses stable Windows APIs with long-term support
- **.NET Compatibility**: Compatible with .NET 8+ runtime

### Code Maintenance
- **Documentation**: Comprehensive inline documentation in C#
- **Error Handling**: Robust error handling with meaningful JSON error responses
- **Memory Management**: Automatic garbage collection provides memory safety
- **Testing**: Integration tests via command-line interface validation