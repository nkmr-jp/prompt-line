# Windows Native Tools - C# DLL Implementation

This directory contains the Windows-specific implementation of native tools using C# and Win32 APIs.

## Architecture

Unlike the macOS version which uses separate Swift executables, the Windows version uses a single C# DLL that is loaded via FFI (Foreign Function Interface) from Node.js. This approach provides:

- **Better Performance**: No process startup overhead
- **Direct Memory Access**: Efficient data exchange
- **Simpler Deployment**: Single DLL file instead of multiple executables

## Files

### WindowDetector.csproj
.NET 6.0 project file with required dependencies:
- `DllExport` - Enables C# methods to be called from unmanaged code
- `System.Text.Json` - JSON serialization for data exchange

### WindowDetector.cs
Main implementation with exported functions:
- `GetCurrentApp()` - Returns current foreground application info
- `GetActiveWindowBounds()` - Returns active window position and size
- `FreeString()` - Memory cleanup for returned strings

### build.ps1
PowerShell build script that:
- Builds the C# project for win-x64 runtime
- Copies WindowDetector.dll to src/native-tools directory
- Copies required runtime dependencies

## Win32 APIs Used

- `GetForegroundWindow()` - Get currently active window handle
- `GetWindowRect()` - Get window position and dimensions
- `GetWindowThreadProcessId()` - Get process ID from window handle
- `GetWindowText()` - Get window title (for debugging)

## Data Exchange Format

The DLL returns JSON strings in the same format as macOS Swift tools:

```json
// GetCurrentApp() response
{
  "name": "notepad",
  "bundleId": null
}

// GetActiveWindowBounds() response
{
  "x": 100,
  "y": 200,
  "width": 800,
  "height": 600,
  "appName": "notepad",
  "bundleId": null
}

// Error response
{
  "error": "No active window found"
}
```

## Building

### Prerequisites
- .NET 6.0 SDK or later
- PowerShell (for build script)

### Build Commands
```powershell
# From native-win directory
.\build.ps1

# Or manually
dotnet build --configuration Release --runtime win-x64
```

### Integration with Build System
The main build process (`scripts/build-windows-tools.js`) calls this build script to ensure the DLL is available during application compilation.

## Memory Management

The DLL uses proper memory management:
- `Marshal.StringToHGlobalAnsi()` allocates unmanaged memory for strings
- `FreeString()` method provided for cleanup (though Node.js FFI handles this automatically)
- Exception handling prevents memory leaks

## Security Considerations

- **No Script Injection**: Compiled C# code eliminates script injection vulnerabilities
- **Win32 API Direct Access**: No shell command execution or external processes
- **Memory Safety**: .NET runtime provides memory safety and garbage collection
- **Error Isolation**: DLL failures don't affect the main Electron process

## Testing

The DLL can be tested independently:
```csharp
// Test GetCurrentApp
var ptr = WindowDetector.GetCurrentApp();
var json = Marshal.PtrToStringAnsi(ptr);
Console.WriteLine(json);

// Test GetActiveWindowBounds
var boundsPtr = WindowDetector.GetActiveWindowBounds();
var boundsJson = Marshal.PtrToStringAnsi(boundsPtr);
Console.WriteLine(boundsJson);
```

## Deployment

The built DLL is copied to `src/native-tools/WindowDetector.dll` and included in the Electron app package. The Node.js FFI layer loads it dynamically at runtime.