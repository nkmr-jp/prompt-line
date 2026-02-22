# Managers Module

This module contains specialized managers that handle core application functionality using the Manager Pattern. The managers are designed for optimal performance, reliability, and user experience with advanced features like native app integration, optimized history management, and intelligent draft handling.

## Files Overview

The managers module consists of sixteen main components plus two sub-modules:

### Core Managers
- **history-manager.ts**: Unlimited history management with JSONL format
- **draft-manager.ts**: Intelligent draft auto-save with backup system
- **settings-manager.ts**: YAML-based user configuration management
- **desktop-space-manager.ts**: Ultra-fast desktop space change detection for window recreation
- **file-cache-manager.ts**: File caching with invalidation for performance optimization
- **custom-search-loader.ts**: Custom search and loading functionality for slash commands and agents
- **file-opener-manager.ts**: File opening with custom editor support
- **directory-manager.ts**: Directory operations and CWD management
- **symbol-cache-manager.ts**: Language-separated symbol search caching with JSONL storage
- **at-path-cache-manager.ts**: @path pattern caching for file highlighting
- **agent-skill-cache-manager.ts**: Agent skill caching with TTL-based invalidation
- **built-in-commands-manager.ts**: Built-in command definitions and management
- **usage-history-manager.ts**: Base class for usage history tracking with LRU-based management
- **agent-usage-history-manager.ts**: Agent usage history tracking for smart suggestions
- **file-usage-history-manager.ts**: File usage history tracking for smart suggestions
- **symbol-usage-history-manager.ts**: Symbol usage history tracking for smart suggestions

### Sub-Modules
- **symbol-search/**: Cross-platform symbol search using ripgrep via Node.js (types.ts, symbol-searcher.ts, index.ts)
- **window/**: Advanced window lifecycle management with native app integration (12 files including strategies/)

## Implementation Details

### window/ (Sub-Module)
Advanced window lifecycle management with native macOS integration using modular architecture.

**Module Structure:**
- `window-manager.ts`: Main window lifecycle controller
- `position-calculator.ts`: Window positioning algorithms
- `native-tool-executor.ts`: Native tool execution with timeout protection
- `directory-detector.ts`: Directory detection orchestration
- `directory-detector-utils.ts`: Directory detection utility functions
- `directory-cache-helper.ts`: Directory detection caching for performance
- `text-field-bounds-detector.ts`: Text field bounds detection
- `types.ts`: Type definitions for window module
- `index.ts`: Public API exports
- `strategies/`: Detection strategy implementations
  - `native-detector-strategy.ts`: Native tool-based detection strategy
  - `types.ts`: Strategy type definitions
  - `index.ts`: Strategy exports

**window-manager.ts - Core Window Management:**
- BrowserWindow creation with dynamic configuration from settings
- Advanced window positioning with four positioning modes:
  - `active-text-field`: Positions near currently focused text field (default)
  - `active-window-center`: Centers within currently active window
  - `cursor`: Positions at mouse cursor location
  - `center`: Centers on primary display with slight upward offset (-100px)
- Multi-monitor aware positioning with screen boundary constraints
- Intelligent window reuse: checks if window exists and is visible before creating new
- Window state management with proper show/hide/focus coordination

**Native App Integration:**
- Previous app detection using `getCurrentApp()` with native `window-detector` tool
- App restoration via `focusPreviousApp()` with native `keyboard-simulator` tool
- Text field detection using native `text-field-detector` for precise positioning
- Directory detection using native `directory-detector` tool with caching
- Native Swift tools: `window-detector`, `keyboard-simulator`, `text-field-detector`, `directory-detector`
- Bundle ID and app name support for reliable app activation
- JSON response parsing from native tools with comprehensive error handling
- 3-5 second timeout protection for native tool execution
- Accessibility permission management with automatic user guidance

**position-calculator.ts - Positioning Algorithms:**
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

**directory-detector.ts - Directory Detection:**
- Orchestrates directory detection with native tool integration
- Supports multiple source applications (Terminal, iTerm2, VSCode, JetBrains IDEs, etc.)
- Caching strategy for performance optimization
- Fallback chain for robust detection

**directory-cache-helper.ts - Caching:**
- 2-second cache TTL for directory detection results
- Reduces expensive native tool calls
- Cache invalidation on directory changes

**Event Handling & Security:**
- Context menu prevention via webContents event handling
- Tab key prevention to avoid unwanted navigation
- Custom event listener setup for blur and closed events
- WindowData communication to renderer via `window-shown` IPC event
- Settings-driven window customization with runtime updates

### history-manager.ts
HistoryManager with full-file based JSONL persistence:

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

### usage-history-manager.ts
Usage history tracking with frequency/recency bonus calculation:

**Core Functionality:**
```typescript
class UsageHistoryManager {
  constructor(filePath: string, config?: Partial<UsageHistoryConfig>)
  async initialize(): Promise<void>
  async recordUsage(key: string): Promise<void>
  calculateBonus(key: string): number
  getEntry(key: string): UsageEntry | undefined
  getAllEntries(): UsageEntry[]
  async clearCache(): Promise<void>
}
```

**Entry Format:**
```typescript
interface UsageEntry {
  key: string;       // Unique identifier
  count: number;     // Usage count
  lastUsed: number;  // Last used timestamp (ms)
  firstUsed: number; // First used timestamp (ms)
}
```

**Features:**
- In-memory cache (Map) with lazy initialization
- TTL-based and count-based pruning (default: 500 entries, 30 days)
- Frequency and recency bonus calculation via `usage-bonus-calculator`
- JSONL storage format for efficient operations

### agent-usage-history-manager.ts
Agent usage history tracking for smart suggestions:

**Storage:**
- File path: `appConfig.paths.projectsCacheDir/agent-usage-history.jsonl`
- Entry format: `UsageEntry {key, count, lastUsed, firstUsed}`

**Singleton Pattern:**
- Private constructor with static `getInstance()` method
- Lazy singleton via `getAgentUsageHistoryManager()` exported function

**Features:**
- Extends UsageHistoryManager (maxEntries: 100, ttlDays: 30)
- Records agent selection by name via `recordAgentUsage(agentName)`
- Calculates bonus score via `calculateAgentBonus(agentName)`

### file-usage-history-manager.ts
File usage history tracking for smart suggestions:

**Storage:**
- File path: `projectsCacheDir/file-usage-history.jsonl`
- Entry format: `UsageEntry {key, count, lastUsed, firstUsed}`

**Singleton Pattern:**
- Private constructor with static `getInstance()` method
- Lazy singleton via `getFileUsageHistoryManager()` exported function

**Features:**
- Extends UsageHistoryManager (maxEntries: 500, ttlDays: 30)
- Normalizes file paths via `normalizeKey(filePath)` with path traversal detection
- Records file usage via `recordFileUsage(filePath)`
- Calculates bonus score via `calculateFileBonus(filePath)`

### symbol-usage-history-manager.ts
Symbol usage history tracking for smart suggestions:

**Storage:**
- File path: `projectsCacheDir/symbol-usage-history.jsonl`
- Entry format: `UsageEntry {key, count, lastUsed, firstUsed}`

**Singleton Pattern:**
- Private constructor with static `getInstance()` method
- Lazy singleton via `getSymbolUsageHistoryManager()` exported function

**Features:**
- Extends UsageHistoryManager (maxEntries: 500, ttlDays: 30)
- Creates composite key `{filePath}:{symbolName}` with path traversal detection via `createSymbolKey()`
- Records symbol usage via `recordSymbolUsage(filePath, symbolName)`
- Calculates bonus score via `calculateSymbolBonus(filePath, symbolName)`

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
  position: "active-text-field"  # default
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
- File path: `~/.prompt-line/settings.yml`

### desktop-space-manager.ts
Ultra-fast desktop space change detection for intelligent window recreation:

**Core Responsibilities:**
- Desktop space change detection with <5ms performance target
- Space signature generation for change comparison
- Accessibility permission management for space detection
- Synthetic data creation for performance optimization

**Performance Features:**
- **2-second cache TTL**: Prevents repeated expensive detection operations
- **Hash-based signatures**: Efficient space identification using string hashing
- **Ultra-fast mode**: Sacrifices precision for extreme speed when needed
- **Synthetic data creation**: Lightweight space signatures instead of full detection

**Space Detection Strategy:**
```typescript
interface SpaceInfo {
  signature: string;
  timestamp: number;
  isValid: boolean;
  isSynthetic?: boolean;
}

// Cache-based detection with TTL
private getCurrentSpaceInfo(): Promise<SpaceInfo> {
  if (this.cacheIsValid()) {
    return this.cachedSpaceInfo;
  }
  
  return this.generateSpaceSignature();
}
```

**Integration with WindowManager:**
- Window recreation on desktop space changes
- Previous space signature comparison
- Non-blocking space detection during window show operations
- Fallback to center positioning when space detection fails

**Security and Permissions:**
- Accessibility permission validation before space detection
- Graceful degradation when permissions unavailable
- Safe error handling without blocking window operations

### file-cache-manager.ts
File caching system for performance optimization with TTL-based invalidation:

**Core Functionality:**
- Caches directory file lists with metadata in JSONL format
- TTL-based cache invalidation for freshness
- Git ignore pattern support for filtering
- Efficient streaming file operations

**Cache Structure:**
```typescript
interface FileCacheMetadata {
  directory: string;
  timestamp: number;
  fileCount: number;
  ttl: number;
}

interface CachedDirectoryData {
  files: FileInfo[];
  metadata: FileCacheMetadata;
}
```

**Storage Format:**
- `~/.prompt-line/cache/files.jsonl`: Cached file lists
- `~/.prompt-line/cache/metadata.json`: Cache metadata

**Features:**
- LRU-style cache management with configurable TTL
- Background cache refresh for non-blocking UI
- Efficient JSONL streaming for large file lists
- Integration with directory-detector for source data

### custom-search-loader.ts
Custom search and loading functionality for agent skills and agents:

**Core Functionality:**
```typescript
class CustomSearchLoader {
  loadAgentSkills(directory: string, query?: string): Promise<AgentSkillItem[]>
  loadAgents(directory: string, query?: string): Promise<AgentItem[]>
  getMaxSuggestions(type: CustomSearchType): number
  getPrefixes(type: CustomSearchType): string[]
  getSortOrder(type: CustomSearchType): 'asc' | 'desc'
  getSortOrderForQuery(type: CustomSearchType, query: string): 'asc' | 'desc'
}
```

**Features:**
- Loads slash commands from markdown files in specified directories
- Loads agent definitions from markdown files
- Flexible name/description templating with YAML frontmatter support
- Search prefix filtering (e.g., "agent:" prefix)
- Configurable max suggestions per search type
- Configurable sort order per entry ('asc' for A→Z, 'desc' for Z→A)
- Entry-level enable/disable filtering: Each entry can define its own enable/disable patterns
- Global-level enable/disable filtering: Settings-based filtering applied after entry-level filtering

**File Format Support:**
- YAML frontmatter for metadata extraction
- Markdown content for descriptions
- Configurable file patterns and directory structures

### file-opener-manager.ts
File opening with custom editor support based on file extension:

**Core Functionality:**
```typescript
class FileOpenerManager {
  openFile(filePath: string): Promise<void>
  openWithEditor(filePath: string, editorApp: string): Promise<void>
  getEditorForExtension(extension: string): string | null
}
```

**Features:**
- Extension-specific application mapping from user settings
- Default editor fallback when no specific mapping exists
- Path expansion and validation before opening
- Uses `shell.openPath()` for default system handling
- Uses macOS `open -a` command for specific editor applications

**Configuration:**
```yaml
fileOpener:
  extensions:
    ".ts": "Visual Studio Code"
    ".md": "Typora"
    ".json": "Visual Studio Code"
  defaultEditor: "Visual Studio Code"
```

### directory-manager.ts
Directory operations and CWD (current working directory) management:

**Core Functionality:**
```typescript
class DirectoryManager {
  getCurrentDirectory(): Promise<string | null>
  setDirectory(directory: string): Promise<void>
  getStoredDirectory(): Promise<string | null>
}
```

**Features:**
- Detects and manages current working directory for file search
- Stores directory at `~/.prompt-line/directory.json`
- Fallback to draft directory if detection fails
- Integration with native directory-detector for terminal/IDE detection
- Supports multiple source applications (Terminal, iTerm2, VSCode, JetBrains IDEs, Cursor, Windsurf)

**Storage Format:**
```json
{
  "directory": "/Users/user/project",
  "timestamp": 1234567890,
  "source": "Terminal"
}
```

### symbol-search/ (Sub-Module)
Cross-platform symbol search using ripgrep via Node.js for code navigation:

**Module Structure:**
- `symbol-search/types.ts`: Type definitions for symbols and search responses
- `symbol-search/symbol-searcher.ts`: Thin wrapper that delegates to `src/utils/symbol-search/` Node.js implementation
- `symbol-search/index.ts`: Public API exports

**Core Functionality:**
```typescript
// Exported functions
function checkRgAvailable(): Promise<RgCheckResponse>
function getSupportedLanguages(): Promise<LanguagesResponse>
function searchSymbols(directory: string, language: string, options?: SymbolSearchOptions): Promise<SymbolSearchResponse>

// Constants
const DEFAULT_MAX_SYMBOLS = 200000
const DEFAULT_SEARCH_TIMEOUT = 5000   // 5 seconds
const DEFAULT_MAX_BUFFER = 100 * 1024 * 1024  // 100MB buffer for large codebases
```

**Key Types:**
```typescript
interface SymbolResult {
  name: string;
  type: SymbolType;  // 'function' | 'method' | 'class' | 'struct' | 'interface' | 'type'
  filePath: string;
  relativePath: string;
  lineNumber: number;
  lineContent: string;
  language: string;
  nameLower?: string;  // Pre-computed lowercase for efficient filtering
  mtimeMs?: number;    // File modification time for scoring
}

interface SymbolSearchResponse {
  success: boolean;
  symbols: SymbolResult[];
  symbolCount: number;
  directory?: string;
  language?: string;
  searchMode: 'full' | 'cached';
  partial: boolean;
  maxSymbols: number;
  error?: string;
}
```

**Features:**
- Cross-platform Node.js implementation (replaces native Swift binary)
- Delegates to `src/utils/symbol-search/symbol-searcher-node.ts` which invokes ripgrep via `child_process.execFile`
- Supports multiple languages (Go, TypeScript, TSX, JavaScript, JSX, Python, Rust, etc.)
- Regex-based symbol pattern matching per language
- Timeout protection (5 seconds) to prevent hanging
- 100MB buffer for large codebases

### symbol-cache-manager.ts
Manages disk-based caching for symbol search results with language-separated storage:

**Core Functionality:**
```typescript
class SymbolCacheManager {
  isCacheValid(directory: string): Promise<boolean>
  hasLanguageCache(directory: string, language: string): Promise<boolean>
  loadSymbols(directory: string, language?: string): Promise<SymbolResult[]>
  saveSymbols(directory: string, language: string, symbols: SymbolResult[], searchMode: string): Promise<void>
  clearCache(directory?: string): Promise<void>
  clearLanguageCache(directory: string, language: string): Promise<void>
  clearAllCaches(): Promise<void>
  loadMetadata(directory: string): Promise<SymbolCacheMetadata | null>
}
```

**Storage Architecture:**
- **Cache Location**: `~/.prompt-line/cache/<encoded-path>/`
- **Metadata File**: `symbol-metadata.json` - Version, TTL, language statistics
- **Symbol Files**: `symbols-{language}.jsonl` - Language-specific symbol storage

**Cache Metadata:**
```typescript
interface SymbolCacheMetadata {
  version: string;        // "2.0"
  directory: string;
  createdAt: number;
  updatedAt: number;
  ttl: number;            // 1 hour default
  languages: {
    [lang: string]: {
      count: number;
      updatedAt: number;
      searchMode: string;
    }
  }
}
```

**Features:**
- Language-separated JSONL files for efficient per-language access
- Cache version 2.0 with TTL support (1 hour default)
- Dynamic total symbol count calculation
- Line-by-line parsing for large symbol sets
- Efficient directory encoding for path-based cache keys

### at-path-cache-manager.ts
Caches registered @path patterns for file highlighting and symbol references:

**Core Functionality:**
```typescript
class AtPathCacheManager {
  // Project-level cache
  loadPaths(directory: string): Promise<AtPathEntry[]>
  addPath(directory: string, atPath: string): Promise<void>
  clearCache(directory: string): Promise<void>

  // Global cache (for customSearch agents, etc.)
  loadGlobalPaths(): Promise<AtPathEntry[]>
  addGlobalPath(atPath: string): Promise<void>
  clearGlobalCache(): Promise<void>
}
```

**Dual Storage System:**
- **Project-level**: `~/.prompt-line/cache/<encoded-path>/registered-at-paths.jsonl`
- **Global**: `~/.prompt-line/cache/global-at-paths.jsonl`

**Entry Structure:**
```typescript
interface AtPathEntry {
  path: string;      // The @path pattern (e.g., "@src/utils.ts")
  timestamp: number; // Unix timestamp for age tracking
}
```

**Features:**
- 100-entry limit per cache with FIFO removal of oldest entries
- Duplicate prevention with filter-and-re-add strategy
- Lazy cache directory initialization
- Project-level and global separation for different content types
- JSONL format with one entry per line for streaming

### agent-skill-cache-manager.ts
Agent skill caching with TTL-based invalidation:

**Core Functionality:**
```typescript
class AgentSkillCacheManager {
  async loadSkills(directory: string): Promise<AgentSkillItem[]>
  async saveSkills(directory: string, skills: AgentSkillItem[]): Promise<void>
  async isCacheValid(directory: string): Promise<boolean>
  async clearCache(directory: string): Promise<void>
}
```

**Storage:**
- Cache location: `~/.prompt-line/cache/<encoded-path>/agent-skills.json`
- Metadata: `{skills: AgentSkillItem[], timestamp: number, ttl: number}`

**Features:**
- TTL-based cache invalidation (default: 1 hour)
- Directory-specific caching
- Automatic cache expiration based on file modification time
- Reduces expensive file system operations for slash command loading

### built-in-commands-manager.ts
Built-in command definitions and management:

**Core Functionality:**
```typescript
class BuiltInCommandsManager {
  getCommands(): BuiltInCommand[]
  getCommand(id: string): BuiltInCommand | undefined
  executeCommand(id: string, context: CommandContext): Promise<void>
}
```

**Features:**
- Defines system-level built-in commands
- Provides command metadata and execution handlers
- Integrated with slash command system
- Examples: clear history, open settings, show help, etc.

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
- **Utilities**: `src/utils/utils` - Logger, safe JSON operations, ID generation, native tools integration
- **Native Tools**: Swift binaries for macOS system integration (`window-detector`, `keyboard-simulator`, `text-field-detector`, `directory-detector`)
- **Node.js Implementations**: Cross-platform modules replacing native binaries (`src/utils/symbol-search/` for symbol search, `src/utils/file-search/` for file listing)
- **Electron APIs**: BrowserWindow, screen, ipcMain for system integration
- **Node.js APIs**: fs.promises for async file operations, path for cross-platform paths, child_process for native tool execution
- **External Libraries**: js-yaml for YAML parsing, readline for streaming file operations
- **External Commands**: ripgrep (`rg`) for symbol search, fd for file search

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

1. **Settings Integration**: Reads position mode from user settings with fallback to defaults
2. **Window State Check**: Avoids unnecessary repositioning if window already visible
3. **Position Calculation**: Three distinct algorithms based on selected mode
4. **Boundary Constraints**: Ensures window stays within screen bounds on multi-monitor setups
5. **Precise Positioning**: Uses `Math.round()` for pixel-perfect placement

### History Management Strategy

**HistoryManager (history-manager.ts):**
- Complete file rewrite approach for atomic operations
- Full dataset loaded into memory for fast access
- Debounced save operations for performance
- JSONL format for efficient storage and parsing
- Supports unlimited history with duplicate prevention

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
**Swift Native Tools Integration:**
- **window-detector**: Compiled Swift binary for window bounds and app detection
- **keyboard-simulator**: Compiled Swift binary for Cmd+V simulation and app activation
- **text-field-detector**: Compiled Swift binary for focused text field detection
- JSON-based communication protocol for all native tools
- Bundle ID and app name support for reliable activation
- Timeout protection (3000ms) to prevent hanging operations
- Accessibility permission management with user guidance dialogs

**Text Field Positioning Integration:**
```typescript
// Active text field positioning with native tool
const textFieldBounds = await getActiveTextFieldBounds();
if (textFieldBounds) {
  // Position window near focused text field
  x = textFieldBounds.x;
  y = textFieldBounds.y + textFieldBounds.height + 10;
} else {
  // Fallback to active window center
  const windowBounds = await getActiveWindowBounds();
  x = windowBounds.x + (windowBounds.width - windowWidth) / 2;
  y = windowBounds.y + (windowBounds.height - windowHeight) / 2;
}
```

**App Detection Flow:**
1. Capture current app using native `window-detector` before showing window
2. Store app info (name + bundleId) for later restoration
3. Use native `keyboard-simulator` to activate previous app after paste operation
4. Handle both string names and AppInfo objects with comprehensive error handling

## Testing Strategy

### Unit Testing Approach
- **Dependency Mocking**: Mock config, utils, and Electron APIs for isolated testing
- **File System Mocking**: Use jest.mock('fs/promises') for predictable file operations
- **Timing Tests**: Verify debouncing behavior with jest timers and time advancement
- **Error Scenarios**: Test with missing files, corrupt JSON, and permission errors

### Manager-Specific Testing
**WindowManager:**
- Mock BrowserWindow and screen APIs
- Test positioning algorithms with various screen configurations
- Verify native app detection and restoration flows
- Test window recreation and data injection
- Test directory detection with caching

**HistoryManager:**
- Test JSONL file parsing with malformed lines
- Verify duplicate prevention
- Test search functionality with various query patterns
- Verify export/import operations with version handling

**UsageHistoryManagers:**
- Test LRU cache management with limits
- Verify deduplication logic
- Test timestamp-based sorting
- Test JSONL storage operations

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

**DesktopSpaceManager:**
- Test space signature generation and comparison
- Verify cache TTL behavior with time advancement
- Test accessibility permission handling and fallbacks
- Verify synthetic data creation for performance mode
- Test integration with WindowManager for space change detection

### Integration Testing
- Test manager interactions through IPC handlers
- Verify complete workflows (paste operation, window lifecycle)
- Test error propagation and recovery across manager boundaries
- Verify resource cleanup during app shutdown

## Architecture Notes

### Window Module Refactoring
The window management functionality has been refactored into a modular architecture:
- **Separation of Concerns**: Each component (positioning, detection, caching) has dedicated files
- **Strategy Pattern**: Detection strategies are pluggable through the strategies/ subdirectory
- **Improved Testability**: Smaller, focused modules are easier to test in isolation
- **Enhanced Caching**: Directory detection caching reduces expensive native tool calls

### Usage History Pattern
The usage history managers follow a consistent inheritance pattern:
- **Base Class**: UsageHistoryManager provides common LRU functionality
- **Specialized Managers**: agent-usage, file-usage, and symbol-usage extend the base
- **Type Safety**: Generic type parameter ensures type-safe operations
- **Consistent API**: All usage managers share the same interface