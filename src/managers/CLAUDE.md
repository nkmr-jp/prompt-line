# Managers Module

This module contains specialized managers that handle core application functionality using the Manager Pattern.

## Files

### window-manager.ts
WindowManager class controlling Electron window lifecycle with advanced features:

**Core Window Management:**
- BrowserWindow creation with comprehensive config-driven settings
- Advanced window positioning with three modes:
  - `active-window-center`: Centers within currently active window (default)
  - `cursor`: Positions at mouse cursor location
  - `center`: Centers on primary display
- Multi-monitor aware positioning with screen boundary constraints
- Window recreation on each show for optimal performance and state management
- Proper focus management with `focus()` and `show()` coordination

**Active Window Detection:**
- AppleScript integration to detect active window bounds (`getActiveWindowBounds()`)
- Robust parsing of AppleScript output with comma/space cleanup
- Error handling with graceful fallback to cursor positioning
- Real-time window bounds calculation for dynamic positioning
- 3-second timeout protection for unresponsive AppleScript calls

**Previous App Integration:**
- Previous app detection using `getCurrentApp()` utility with AppleScript
- App restoration via `focusPreviousApp()` with AppleScript activation
- Support for both string app names and AppInfo objects with bundle IDs
- Error handling for app detection failures with graceful fallbacks

**Advanced Features:**
- Context menu prevention via webContents event handling
- Tab key prevention to avoid unwanted navigation
- Data communication to renderer via IPC channels (`window-shown` event)
- Window bounds calculation with screen boundary constraints
- Event listener setup for blur and closed events
- Proper cleanup with window destruction

### history-manager.ts
HistoryManager class with comprehensive JSONL-based history management:

**File Format & Persistence:**
- JSONL (JSON Lines) format for efficient append operations and corruption resistance
- Each line: `{"text": "content", "timestamp": 1234567890, "id": "abc123"}`
- Atomic write operations with complete file rewrite to prevent corruption
- Graceful handling of missing or corrupt history files with fallback to empty state

**Performance Optimization:**
- Debounced save operations: 2s standard delay, 500ms for critical operations
- Batched save operations to minimize disk I/O
- In-memory sorting with `sort((a, b) => b.timestamp - a.timestamp)`
- Optimized unlimited storage with LRU caching for memory efficiency

**Data Management:**
- Duplicate prevention by filtering existing items before adding new ones
- Unique ID generation using `generateId()` utility
- Search functionality with case-insensitive `toLowerCase().includes()` matching
- Statistics tracking: totalItems, totalCharacters, averageLength, oldest/newest timestamps
- Export/import functionality with version control and merge options

**Configuration & Storage:**
- Unlimited history storage with OptimizedHistoryManager by default
- Configurable display limits via `maxDisplayItems` setting
- Immediate save option for critical operations (app shutdown)

### draft-manager.ts
DraftManager class with intelligent auto-save and backup system:

**Auto-Save Intelligence:**
- Adaptive debouncing: 500ms for small text (<200 chars), 1000ms for larger text
- Change detection to prevent unnecessary saves (`lastSavedContent` comparison)
- Immediate save mode for critical operations (window close, app shutdown)
- Pending save state management to prevent concurrent writes

**File Format & Structure:**
```json
{
  "text": "draft content",
  "timestamp": 1234567890,
  "version": "1.0"
}
```

**Advanced Features:**
- Draft backup system with timestamp-based file naming
- Backup cleanup with configurable max age (default: 7 days)
- Path validation to prevent directory traversal attacks
- Draft statistics: hasContent, length, wordCount, lineCount, isMultiline
- Safe JSON operations with fallback handling

**State Management:**
- In-memory draft caching for performance
- Empty draft detection with automatic cleanup
- Flush pending saves on app shutdown
- Proper cleanup with debounce cancellation

### settings-manager.ts
SettingsManager class with YAML-based user configuration:

**Configuration Structure:**
```yaml
shortcuts:
  main: "Cmd+Shift+Space"
  paste: "Cmd+Enter"
  close: "Escape"
window:
  position: "active-window-center"  # Default: centers within active window
  # Available options: "active-window-center", "cursor", "center"
  width: 600
  height: 300
history:
  maxDisplayItems: 20  # Number of items shown in history panel (unlimited storage)
```

**Window Position Options:**
- `active-window-center`: Centers prompt window within the currently active application window (using native window detection) - Default
- `cursor`: Positions at mouse cursor location
- `center`: Centers on primary display screen

**Features:**
- YAML file format for human-readable configuration
- Default settings with deep merge functionality
- Settings validation and fallback to defaults
- Automatic settings file creation if missing
- Individual section updates (shortcuts, window, history)
- Settings reset functionality
- Type-safe configuration access

## Manager Pattern Implementation

### Common Patterns
- **Class-based architecture** with constructor dependency injection
- **Initialization lifecycle**: `constructor()` → `initialize()` → `ready state`
- **Async/await patterns** with comprehensive error catching and logging
- **Structured logging** integration with contextual data for debugging
- **Config-driven behavior** using centralized app-config module
- **Safe operations** using utility functions for JSON, file I/O, and system calls
- **Resource cleanup** with proper `destroy()` methods and promise handling

### Dependencies
- **Core Config**: `src/config/app-config` - Configuration-driven paths and settings
- **Utilities**: `src/utils/utils` - Logger, safe JSON operations, ID generation, AppleScript integration
- **Electron APIs**: BrowserWindow, screen, ipcMain for system integration
- **Node.js APIs**: fs.promises for async file operations, path for cross-platform paths
- **External Libraries**: js-yaml for YAML parsing in SettingsManager

### Data Flow
```
IPC Handler → Manager → File System/System API
     ↑              ↓
     └── Response ──┘

Main Process → Manager.method() → Async Operation → Result
     ↑                                               ↓
     └────────── Error Handling/Logging ←────────────┘
```

## Critical Implementation Details

### Window Positioning Algorithm (window-manager.ts:95-127)
1. **Cursor Detection**: `screen.getCursorScreenPoint()` for precise cursor location
2. **Display Management**: `screen.getDisplayNearestPoint()` for multi-monitor support
3. **Previous App Capture**: `getCurrentApp()` AppleScript before window creation
4. **Window Recreation**: Destroy existing window and create new one for clean state
5. **Position Calculation**: 
   - Cursor mode: `point.x - (windowWidth / 2)`, `point.y - (windowHeight / 2)`
   - Boundary constraints: `Math.max(bounds.x, Math.min(x, bounds.x + bounds.width - windowWidth))`
6. **Data Injection**: Send WindowData via `window-shown` IPC event after DOM ready

### History Management (history-manager.ts)
**JSONL File Format:**
- Each line: `JSON.stringify({text, timestamp, id}) + '\n'`
- Chronological append for write efficiency
- In-memory reverse sort for display: `sort((a, b) => b.timestamp - a.timestamp)`

**Optimization Strategies:**
- **Write Batching**: `debouncedSave` (2s) vs `criticalSave` (500ms)
- **Duplicate Prevention**: `filter(item => item.text !== trimmedText)` before add
- **Memory Management**: LRU cache with configurable display limits
- **Corruption Recovery**: Line-by-line JSON parsing with error skipping

**Data Structure:**
```typescript
interface HistoryItem {
  text: string;     // User input content
  timestamp: number; // Date.now() for chronological ordering
  id: string;       // generateId() for unique identification
}
```

### Draft Persistence (draft-manager.ts)
**Adaptive Auto-Save:**
- **Size-based debouncing**: `text.length > 200 ? debouncedSave : quickSave`
- **Change detection**: Skip save if `lastSavedContent === text`
- **Immediate mode**: `saveDraftImmediately()` for critical operations

**File Structure:**
```json
{
  "text": "draft content",
  "timestamp": 1234567890,
  "version": "1.0"
}
```

**Backup System:**
- **Backup naming**: `${draftFile}.backup.${timestamp}`
- **Path validation**: Prevent directory traversal with `path.normalize()` checks
- **Cleanup routine**: Remove backups older than configurable max age

### Settings Management (settings-manager.ts)
**YAML Configuration:**
- **File location**: `~/.prompt-line/settings.yaml`
- **Deep merge**: `mergeWithDefaults()` preserves user settings while adding new defaults
- **Validation**: Type checking and fallback to defaults for invalid values
- **Auto-creation**: Create settings file with defaults if missing

## Testing Strategy

### Unit Testing Approach
- **Dependency Mocking**: Mock config, utils, and Electron APIs for isolated testing
- **File System Mocking**: Use jest.mock('fs/promises') for predictable file operations
- **Timing Tests**: Verify debouncing behavior with jest timers and time advancement
- **Error Scenarios**: Test with missing files, corrupt JSON, and permission errors

### Manager-Specific Testing
**WindowManager:**
- Mock BrowserWindow and screen APIs
- Test cursor positioning algorithms with various screen configurations
- Verify previous app detection and restoration flows
- Test window recreation and data injection

**HistoryManager:**
- Test JSONL file parsing with malformed lines
- Verify duplicate prevention and automatic trimming
- Test search functionality with various query patterns
- Verify export/import operations with version handling

**DraftManager:**
- Test adaptive debouncing with different text sizes
- Verify backup creation and cleanup operations
- Test path validation for security
- Verify change detection and save optimization

**SettingsManager:**
- Test YAML parsing with malformed files
- Verify deep merge functionality with partial updates
- Test settings validation and fallback behavior
- Verify file creation and permission handling

### Integration Testing
- Test manager interactions through IPC handlers
- Verify complete workflows (paste operation, window lifecycle)
- Test error propagation and recovery across manager boundaries
- Verify resource cleanup during app shutdown