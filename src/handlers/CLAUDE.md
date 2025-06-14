# IPC Handlers Module

This module handles all Inter-Process Communication (IPC) between the main and renderer processes.

## Files

### ipc-handlers.ts
IPCHandlers class managing all Inter-Process Communication:
- Constructor dependency injection for WindowManager, HistoryManager, DraftManager, SettingsManager
- Comprehensive IPC channel setup with ipcMain.handle() bindings
- Async operation handling with proper error catching and logging
- Parallel operations optimization (history + draft management)
- Native Tools integration for macOS auto-paste functionality (replaces AppleScript)
- Image paste support with clipboard integration and path validation
- Settings management IPC channels with YAML configuration support

## Key IPC Channels

### Text Operations
- `paste-text`: Main action - pastes text with history and auto-focus
- `paste-image`: Clipboard image pasting to file system

### History Management
- `get-history`: Retrieves complete paste history
- `clear-history`: Clears all history items
- `remove-history-item`: Removes specific history item by ID (with ID format validation)
- `search-history`: Searches history with query string and optional limit
- `get-history-stats`: Returns comprehensive history statistics

### Draft Management
- `save-draft`: Auto-saves draft content with debouncing (supports immediate mode)
- `clear-draft`: Clears saved draft
- `get-draft`: Retrieves current draft content
- `get-draft-stats`: Returns comprehensive draft metadata and statistics

### Window Management
- `show-window`: Shows application window with data and context
- `hide-window`: Hides application window (with optional focus restoration control)

### System Integration
- `get-app-info`: Returns comprehensive application metadata
- `get-config`: Returns configuration object (with section filtering support)
- `paste-image`: Handles clipboard image pasting with security validation

### Settings Management
- `get-settings`: Retrieves current user settings
- `update-settings`: Updates user settings with validation
- `reset-settings`: Resets settings to defaults

## Implementation Patterns
- Class-based structure with dependency injection in constructor
- All handlers use async/await with proper error catching
- Consistent response format: `{ success: boolean, error?: string, warning?: string, data?: any }`
- Parallel operations using Promise.all() for performance optimization
- **Native Tools integration** with timeout handling for macOS automation (replaces AppleScript)
- Comprehensive logging with structured data and context
- Non-blocking window operations for smooth user experience
- Optimized I/O operations with batched and debounced saves
- **Security enhancements**: Input validation, path traversal prevention, ID format validation
- **Performance optimizations**: Byte-based size limits, efficient clipboard operations

## Security Considerations
- **Input Validation**: Comprehensive validation of all input from renderer process
- **Size Limits**: 1MB byte-based limit for paste text to prevent DoS attacks
- **ID Format Validation**: Regex validation for history item IDs (lowercase alphanumeric)
- **Path Traversal Prevention**: Path normalization and validation for image operations
- **Data Sanitization**: Sanitize data before system operations
- **Limited Exposure**: Limit exposed functionality to necessary operations only
- **Config Section Filtering**: Whitelist-based config section access
- **Timeout Protection**: Timeouts for all native tool operations

## Testing
- Mock manager dependencies for isolated testing
- Test all IPC channels with valid and invalid inputs
- Verify async error handling and response formats
- **Test Native Tools integration** on macOS with timeout scenarios
- Mock clipboard operations for image paste testing with security validation
- Verify parallel operation performance and error handling
- **Security Testing**: Test input validation, size limits, and path traversal prevention
- **Settings Testing**: Test YAML-based settings management and validation
- **Timeout Testing**: Verify graceful handling of native tool timeouts