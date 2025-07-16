# IPC Handlers Module

This module handles all Inter-Process Communication (IPC) between the main and renderer processes in the Prompt Line application. It serves as the central communication bridge that enables the renderer process (UI) to interact with system resources and managers through secure, validated channels.

## Purpose and Role

The handlers module provides:
- **Process Communication Bridge**: Secure IPC channel management between main and renderer processes
- **Manager Orchestration**: Coordinates operations across WindowManager, HistoryManager, DraftManager, and SettingsManager
- **Security Layer**: Input validation, size limits, and path traversal prevention
- **Platform Integration**: Native tool integration for macOS automation and cross-platform compatibility
- **Error Handling**: Comprehensive error handling with structured logging and user feedback

## Files

### ipc-handlers.ts
Core IPCHandlers class that manages all Inter-Process Communication with the following key features:

#### Architecture
- **Dependency Injection**: Constructor accepts WindowManager, IHistoryManager, DraftManager, and SettingsManager
- **Type Safety**: Comprehensive TypeScript interfaces for all operations and responses
- **Handler Registration**: Automatic setup of all IPC channels via `ipcMain.handle()`
- **Clean Shutdown**: `removeAllHandlers()` method for proper cleanup

#### Key Dependencies
```typescript
import { ipcMain, clipboard, dialog } from 'electron';
import { exec } from 'child_process';
import { promises as fs } from 'fs';
import { 
  pasteWithNativeTool, 
  activateAndPasteWithNativeTool, 
  checkAccessibilityPermission 
} from '../utils/utils';
```

## IPC Channel Implementation

### Text Operations
- **`paste-text`**: Primary paste operation with complete workflow
  - Input validation (type, empty check, 1MB size limit)
  - Parallel operations: history save + draft clear + clipboard write
  - Window management: hide window + get previous app
  - Native paste execution with accessibility permission checks
  - Comprehensive error handling with warning dialog integration

- **`paste-image`**: Clipboard image handling
  - Clipboard image validation and extraction
  - Secure path generation with timestamp-based naming
  - Path traversal prevention with normalization validation
  - PNG format conversion and file system write operations

### History Management
- **`get-history`**: Retrieves complete history array from HistoryManager
- **`clear-history`**: Clears all history items with success confirmation
- **`remove-history-item`**: Removes specific item with ID format validation
  - Regex validation: `/^[a-z0-9]+$/` (coupled with utils.generateId())
- **`search-history`**: Full-text search with configurable result limits

### Draft Management
- **`save-draft`**: Draft persistence with debouncing control
  - Supports immediate mode for explicit saves
  - Uses DraftManager's debounced or immediate save methods
- **`clear-draft`**: Explicit draft removal
- **`get-draft`**: Current draft content retrieval

### Window Management
- **`show-window`**: Window display with optional WindowData context
- **`hide-window`**: Window hiding with focus restoration control
  - Optional `restoreFocus` parameter (default: true)
  - macOS-specific previous app focus restoration
  - Fallback AppleScript for focus failures
  - Non-blocking operation with proper error handling

### System Integration
- **`get-app-info`**: Application metadata retrieval
  - Returns: name, version, description, platform, electron/node versions, development flag
- **`get-config`**: Configuration access with section filtering
  - Whitelist validation: `['shortcuts', 'history', 'draft', 'timing', 'app', 'platform']`
  - Supports full config or specific section requests
  - Security-focused exposure of safe configuration data

### Settings Management
- **`get-settings`**: Current UserSettings retrieval
- **`update-settings`**: Settings modification with validation
- **`reset-settings`**: Settings reset to defaults

## Implementation Details

### Response Format Standardization
All handlers return consistent response objects:
```typescript
interface IPCResult {
  success: boolean;
  error?: string;
  warning?: string;
}
```

### Security Implementation
- **Input Validation**: Type checking, format validation, and sanitization
- **Size Limits**: 1MB byte-based limit using `Buffer.byteLength()` for accurate measurement
- **ID Format Validation**: Strict regex validation for history item IDs
- **Path Traversal Prevention**: `path.normalize()` and prefix validation for file operations
- **Config Section Filtering**: Whitelist-based access to configuration sections
- **Error Logging**: Comprehensive security event logging with context

### Performance Optimizations
- **Parallel Operations**: `Promise.all()` for concurrent history/draft/clipboard operations
- **Non-blocking UI**: Asynchronous window operations maintain responsiveness
- **Efficient Clipboard**: Optimized clipboard operations with error recovery
- **Debounced Operations**: Draft saves use configurable debouncing

### Native Platform Integration
- **macOS Native Tools**: Integration with native automation tools
  - `pasteWithNativeTool()`: Direct paste operation
  - `activateAndPasteWithNativeTool()`: App activation + paste
  - `checkAccessibilityPermission()`: Permission validation
- **Accessibility Management**: Automatic permission checking and user guidance
- **Cross-platform Compatibility**: Platform-specific code paths with graceful degradation

### Error Handling and User Experience
- **Comprehensive Logging**: Structured logging with operation context
- **User Feedback**: Warning dialogs for accessibility permissions
- **Graceful Degradation**: Operations continue with warnings when possible
- **Accessibility Guidance**: Step-by-step permission setup instructions

## Integration with Other Modules

### Manager Dependencies
- **WindowManager**: Window lifecycle, positioning, and focus management
- **IHistoryManager**: Complete history operations and search functionality
- **DraftManager**: Draft persistence with debouncing and immediate save options
- **SettingsManager**: User preferences management with YAML persistence

### Utility Integration
- **utils/utils**: Native tool functions, accessibility checks, logging utilities
- **config/app-config**: Application configuration and platform detection
- **types**: Comprehensive type definitions for all operations

### Cross-Module Communication
- Serves as the central communication hub for all renderer-to-main interactions
- Orchestrates complex operations involving multiple managers
- Provides unified error handling and logging across all operations
- Maintains data consistency through proper operation sequencing

## Constants and Configuration
```typescript
const MAX_PASTE_TEXT_LENGTH_BYTES = 1024 * 1024; // 1MB limit
const VALID_CONFIG_SECTIONS = ['shortcuts', 'history', 'draft', 'timing', 'app', 'platform'];
```

## Testing Considerations
- **Manager Mocking**: Mock all manager dependencies for isolated testing
- **IPC Channel Testing**: Verify all channels with valid/invalid inputs
- **Security Testing**: Path traversal attempts, size limit validation, ID format testing
- **Error Handling**: Test all error paths and recovery mechanisms
- **Platform Testing**: macOS-specific functionality and cross-platform compatibility
- **Permission Testing**: Accessibility permission scenarios and user guidance
- **Performance Testing**: Parallel operation efficiency and timeout handling