# Managers Module

This module contains specialized managers that handle core application functionality using the Manager Pattern. The managers are designed for optimal performance, reliability, and user experience with advanced features like native app integration, optimized history management, and intelligent draft handling.

## Files Overview

The managers module consists of five main components:
- **window-manager.ts**: Advanced window lifecycle management with native app integration
- **history-manager.ts**: Traditional unlimited history management with JSONL format
- **optimized-history-manager.ts**: Performance-optimized history management with caching
- **draft-manager.ts**: Intelligent draft auto-save with backup system
- **settings-manager.ts**: YAML-based user configuration management

## Implementation Details

### window-manager.ts
WindowManager class controlling Electron window lifecycle with native macOS integration:

**Core Window Management:**
- BrowserWindow creation with dynamic configuration from settings
- Fixed window positioning: always centers within currently active window
  - Uses AppleScript to detect active window bounds
  - Falls back to center of primary display if window detection fails
- Multi-monitor aware positioning with screen boundary constraints
- Intelligent window reuse: checks if window exists and is visible before creating new
- Window state management with proper show/hide/focus coordination

**Native App Integration:**
- Previous app detection using `getCurrentApp()` before showing window
- App restoration via `focusPreviousApp()` with native keyboard simulator
- Native tool integration: Uses compiled binary at `src/native-tools/keyboard-simulator`
- Bundle ID and app name support for reliable app activation
- JSON response parsing from native tools with error handling
- 3-second timeout protection for native tool execution

**Advanced Positioning Algorithm:**
```typescript
// Active window center positioning
const activeWindowBounds = await getActiveWindowBounds();
x = activeWindowBounds.x + (activeWindowBounds.width - windowWidth) / 2;
y = activeWindowBounds.y + (activeWindowBounds.height - windowHeight) / 2;

// Multi-monitor boundary constraints
const display = screen.getDisplayNearestPoint(point);
const bounds = display.bounds;
x = Math.max(bounds.x, Math.min(x, bounds.x + bounds.width - windowWidth));
y = Math.max(bounds.y, Math.min(y, bounds.y + bounds.height - windowHeight));
```

**Event Handling & Security:**
- Context menu prevention via webContents event handling
- Tab key prevention to avoid unwanted navigation
- Custom event listener setup for blur and closed events
- WindowData communication to renderer via `window-shown` IPC event
- Settings-driven window customization with runtime updates

### history-manager.ts
Traditional HistoryManager with full-file based JSONL persistence:

**File Format & Persistence:**
- JSONL (JSON Lines) format: `{"text": "content", "timestamp": 1234567890, "id": "abc123"}`
- Complete file rewrite strategy for atomic operations
- Chronological file storage (oldest first) with in-memory reverse sorting for display
- Graceful handling of corrupt lines with line-by-line JSON parsing

**Debounced Save Operations:**
- Standard save: 2000ms debounce for regular operations
- Critical save: 500ms debounce for important operations (add/remove items)
- Immediate save: Synchronous save for shutdown scenarios
- Pending save protection to prevent concurrent write operations

**Data Management:**
- Duplicate prevention: Filters existing items by text content before adding
- In-memory data with `sort((a, b) => b.timestamp - a.timestamp)` for newest-first display
- Search with case-insensitive `toLowerCase().includes()` matching
- Unlimited storage capacity with full dataset in memory

**Export/Import System:**
```typescript
interface ExportData {
  version: '1.0';
  exportDate: string;
  history: HistoryItem[];
  stats: HistoryStats;
}
```

### optimized-history-manager.ts
Performance-optimized HistoryManager for large datasets with caching strategy:

**Caching Architecture:**
- LRU cache of recent items (LIMITS.MAX_VISIBLE_ITEMS = 200)
- Duplicate check set for O(1) duplicate detection in cache
- Background total count calculation to avoid blocking startup
- Append-only file operations for better performance with large files

**Advanced File Operations:**
- `readLastNLines()`: Efficient backward file reading with 8KB chunks
- Streaming line processing for large files using readline interface
- Append queue with debounced batch writes (100ms debounce)
- Atomic file operations for item removal with temporary file strategy

**Memory Management:**
```typescript
private recentCache: HistoryItem[] = []; // 最新N件のキャッシュ
private duplicateCheckSet = new Set<string>(); // O(1) duplicate detection
private totalItemCount = 0; // Background calculated total
private appendQueue: HistoryItem[] = []; // Batch append queue
```

**Performance Features:**
- Lazy total count calculation (background after startup)
- Cache-first operations for UI responsiveness
- Streaming export/import for large datasets
- Optimized search within cached items only

### draft-manager.ts
Intelligent draft management with adaptive auto-save and backup system:

**Adaptive Auto-Save Logic:**
- Text size based debouncing: >200 chars = 1000ms, ≤200 chars = 500ms
- Change detection: Compares with `lastSavedContent` to skip unnecessary saves
- Immediate save mode for critical operations (window close, app shutdown)
- Pending save state management to prevent concurrent writes

**File Format & Security:**
```json
{
  "text": "draft content",
  "timestamp": 1234567890,
  "version": "1.0"
}
```

**Backup System:**
- Timestamp-based backup naming: `${draftFile}.backup.${ISO-timestamp}`
- Path validation with `path.normalize()` to prevent directory traversal
- Configurable cleanup of old backups (default: 7 days)
- Backup restoration with format validation

**Extended Statistics:**
```typescript
interface DraftStatsExtended {
  hasContent: boolean;
  length: number;
  wordCount: number;
  lineCount: number;
  isMultiline?: boolean;
}
```

**State Management:**
- In-memory current draft caching
- Empty draft detection with automatic file cleanup
- Debounce cancellation on destroy
- Flush pending saves during shutdown

### settings-manager.ts
YAML-based configuration management with deep merge and validation:

**Configuration Structure:**
```yaml
shortcuts:
  main: "Cmd+Shift+Space"
  paste: "Cmd+Enter"  
  close: "Escape"
  historyNext: "Ctrl+j"
  historyPrev: "Ctrl+k"
window:
  width: 600
  height: 300
```

**Deep Merge Strategy:**
```typescript
private mergeWithDefaults(userSettings: Partial<UserSettings>): UserSettings {
  return {
    shortcuts: { ...this.defaultSettings.shortcuts, ...userSettings.shortcuts },
    window: { ...this.defaultSettings.window, ...userSettings.window }
  };
}
```

**Features:**
- YAML format for human-readable configuration files
- Automatic settings file creation with defaults if missing
- Section-specific updates (shortcuts, window) with deep merge
- Settings validation with fallback to defaults
- Type-safe configuration access with TypeScript interfaces
- File path: `~/.prompt-line/settings.yaml`

## Manager Pattern Implementation

### Common Patterns
All managers follow consistent architectural patterns:

**Class-based Architecture:**
- Constructor dependency injection with config-driven paths
- Async initialization lifecycle: `constructor()` → `initialize()`/`init()` → ready state
- Proper resource cleanup with `destroy()` methods

**Error Handling & Logging:**
- Comprehensive error catching with structured logging
- Graceful degradation with fallback behaviors
- Contextual debug information for troubleshooting

**Performance Optimization:**
- Debounced operations to reduce I/O overhead
- Caching strategies for frequently accessed data
- Async/await patterns with proper error propagation

**File System Integration:**
- Safe JSON operations using utility functions
- Atomic file operations to prevent corruption
- Proper handling of missing files and permissions

### Dependencies
- **Core Config**: `src/config/app-config` - Centralized configuration paths and settings
- **Utilities**: `src/utils/utils` - Logger, safe JSON operations, ID generation, AppleScript integration
- **Electron APIs**: BrowserWindow, screen, ipcMain for system integration
- **Node.js APIs**: fs.promises for async file operations, path for cross-platform paths
- **External Libraries**: js-yaml for YAML parsing, readline for streaming file operations

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

### Window Positioning Algorithm (window-manager.ts:120-178)
The window positioning system uses a sophisticated multi-step process:

1. **Active Window Detection**: Uses AppleScript to get active window bounds
2. **Position Calculation**: Centers window within active window bounds
3. **Fallback Handling**: Centers on primary display if detection fails
4. **Boundary Constraints**: Ensures window stays within screen bounds on multi-monitor setups
5. **Precise Positioning**: Uses `Math.round()` for pixel-perfect placement

### History Management Strategies

**Traditional HistoryManager (history-manager.ts):**
- Complete file rewrite approach for atomic operations
- Full dataset loaded into memory for fast access
- Suitable for moderate history sizes (< 10,000 items)

**OptimizedHistoryManager (optimized-history-manager.ts):**
- Streaming file operations with LRU caching
- Background total count calculation
- Designed for unlimited history with minimal memory footprint
- Suitable for large datasets (> 10,000 items)

### Draft Persistence Strategy (draft-manager.ts)
**Adaptive Debouncing Logic:**
```typescript
if (text.length > 200) {
  this.debouncedSave(text); // 1000ms delay
} else {
  this.quickSave(text); // 500ms delay
}
```

**Change Detection Optimization:**
```typescript
if (this.lastSavedContent === text) {
  logger.debug('Draft save skipped - no changes');
  return;
}
```

### Native Integration Details (window-manager.ts)
**Keyboard Simulator Integration:**
- Compiled binary at `src/native-tools/keyboard-simulator`
- JSON-based communication protocol
- Bundle ID and app name support for reliable activation
- Timeout protection (3000ms) to prevent hanging

**App Detection Flow:**
1. Capture current app before showing window
2. Store app info (name + bundleId) for later restoration
3. Use native tool to activate previous app after paste operation
4. Handle both string names and AppInfo objects

## Testing Strategy

### Unit Testing Approach
- **Dependency Mocking**: Mock config, utils, and Electron APIs for isolated testing
- **File System Mocking**: Use jest.mock('fs/promises') for predictable file operations
- **Timing Tests**: Verify debouncing behavior with jest timers and time advancement
- **Error Scenarios**: Test with missing files, corrupt JSON, and permission errors

### Manager-Specific Testing
**WindowManager:**
- Mock BrowserWindow and screen APIs
- Test active window centering with various screen configurations
- Verify native app detection and restoration flows
- Test window recreation and data injection

**HistoryManager/OptimizedHistoryManager:**
- Test JSONL file parsing with malformed lines
- Verify duplicate prevention and caching behavior
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

## Migration Notes

### From HistoryManager to OptimizedHistoryManager
The application can use either history manager implementation:
- **HistoryManager**: Traditional approach with full file operations
- **OptimizedHistoryManager**: Streaming approach with caching for better performance

Both implement the same `IHistoryManager` interface ensuring seamless interchangeability.

### Key Differences:
- **Memory Usage**: OptimizedHistoryManager uses fixed-size cache vs full dataset in memory
- **Startup Time**: OptimizedHistoryManager has faster startup with background total count
- **File Operations**: OptimizedHistoryManager uses append-only operations vs complete rewrites
- **Search Scope**: OptimizedHistoryManager searches within cache only vs full dataset