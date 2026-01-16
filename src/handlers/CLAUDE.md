# IPC Handlers Module

This module handles all Inter-Process Communication (IPC) between the main and renderer processes in the Prompt Line application. It serves as the central communication bridge that enables the renderer process (UI) to interact with system resources and managers through secure, validated channels.

## Purpose and Role

The handlers module provides:
- **Process Communication Bridge**: Secure IPC channel management between main and renderer processes
- **Manager Orchestration**: Coordinates operations across WindowManager, HistoryManager, DraftManager, SettingsManager, and usage history managers
- **Security Layer**: Input validation, size limits, and path traversal prevention
- **Platform Integration**: Native tool integration for macOS automation and cross-platform compatibility
- **Error Handling**: Comprehensive error handling with structured logging and user feedback

## Files

### Handler Files Overview
The handlers module consists of 10 specialized files:
- **ipc-handlers.ts**: Coordinator that delegates to specialized handlers
- **paste-handler.ts**: Text and image paste operations
- **history-draft-handler.ts**: History CRUD and draft management with @path caching
- **window-handler.ts**: Window visibility and focus control
- **system-handler.ts**: App info, config, and settings retrieval
- **mdsearch-handler.ts**: Slash commands and agent selection
- **file-handler.ts**: File operations and external URL handling
- **code-search-handler.ts**: Symbol search with ripgrep integration
- **usage-history-handler.ts**: Usage history tracking for files, symbols, and agents
- **handler-utils.ts**: Shared validation and utility functions

### ipc-handlers.ts
Core IPCHandlers class that manages all Inter-Process Communication with the following key features:

#### Architecture
- **Dependency Injection**: Constructor accepts WindowManager, IHistoryManager, DraftManager, and SettingsManager
- **Type Safety**: Comprehensive TypeScript interfaces for all operations and responses
- **Handler Registration**: Automatic setup of all IPC channels via `ipcMain.handle()`
- **Clean Shutdown**: `removeAllHandlers()` method for proper cleanup
- **Delegation Pattern**: Coordinates specialized handlers (paste, history-draft, window, system, mdsearch, file, code-search, usage-history)

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

### code-search-handler.ts
Handles symbol search via native ripgrep integration:

#### Architecture
- **Stale-while-Revalidate**: Returns cached data while refreshing in background
- **Background Deduplication**: Prevents duplicate concurrent refresh operations
- **Settings Integration**: Reads search configuration from SettingsManager
- **Cache Management**: Uses SymbolCacheManager for persistent symbol storage

#### Key Implementation
```typescript
// Search symbols with caching strategy
async function handleSearchSymbols(directory: string, language: string, options: SearchOptions) {
  // 1. Check if valid cache exists
  // 2. If cached: return cached + trigger background refresh
  // 3. If not cached: perform full search + save to cache
}
```

### usage-history-handler.ts
Handles usage history tracking for files, symbols, and agents to enable intelligent scoring and prioritization:

#### Architecture
- **Usage Recording**: Tracks usage frequency and recency for intelligent scoring
- **Bonus Calculation**: Calculates usage bonuses based on usage patterns
- **Manager Integration**: Uses specialized managers for each usage type
- **Performance**: Efficient batch bonus retrieval for search results

#### Key Features
```typescript
// File usage tracking
async recordFileUsage(filePath: string): Promise<void>
calculateFileBonus(filePath: string): number

// Symbol usage tracking
async recordSymbolUsage(filePath: string, symbolName: string): Promise<void>
calculateSymbolBonus(filePath: string, symbolName: string): number

// Agent usage tracking
async recordAgentUsage(agentName: string): Promise<void>
calculateAgentBonus(agentName: string): number
```

### handler-utils.ts
Shared utilities for all handlers:

#### Exported Functions
- `withIPCErrorHandling`: HOF for standardized error handling wrapper
- `withIPCDataHandler`: HOF for data handlers with default values
- `expandPath`: Path expansion with `~` and relative path support
- `normalizeAndValidatePath`: Path normalization with traversal attack prevention
- `validateHistoryId`: History ID format validation (lowercase alphanumeric)
- `updateMdSearchConfig`: MdSearch configuration update utility

#### Types
- `IPCResult`: Standard response interface with success/error/warning fields

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
- **`get-file-search-max-suggestions`**: Retrieves max suggestions for file search

### Settings Management
- **`get-settings`**: Current UserSettings retrieval
- **`update-settings`**: Settings modification with validation
- **`reset-settings`**: Settings reset to defaults
- **`open-settings`**: Opens settings file in default editor
- **`open-settings-directory`**: Opens settings directory in Finder

### Slash Commands & Agents
- **`get-slash-commands`**: Retrieves slash commands with optional query filtering
- **`get-slash-command-file-path`**: Resolves slash command file path
- **`has-command-file`**: Checks if a slash command file exists
- **`get-agents`**: Retrieves agent definitions with optional query filtering
- **`get-agent-file-path`**: Resolves agent file path
- **`get-md-search-max-suggestions`**: Gets max suggestions for search type
- **`get-md-search-prefixes`**: Gets search prefixes for search type
- **`register-global-slash-command`**: Registers a global slash command for caching
- **`get-global-slash-commands`**: Retrieves registered global slash commands
- **`get-usage-bonuses`**: Gets usage bonuses for agents

### File Operations
- **`open-file-in-editor`**: Opens file with configured editor based on extension
- **`check-file-exists`**: File existence check with path validation
- **`open-external-url`**: Opens URLs with protocol whitelist (http://, https://)

### Draft Directory Management
- **`set-draft-directory`**: Sets the draft directory for file operations
- **`get-draft-directory`**: Retrieves the current draft directory
- **`save-draft-to-history`**: Saves the current draft to history without clearing

### Code Search (code-search-handler.ts)
- **`check-rg`**: Checks ripgrep availability for symbol search
- **`get-supported-languages`**: Returns list of 20+ supported programming languages
- **`search-symbols`**: Searches for symbols in a directory for a specific language
  - Parameters: directory, language, options (maxSymbols, useCache)
  - Uses native `symbol-searcher` tool with ripgrep
  - Stale-while-revalidate caching pattern with background refresh
  - Background refresh deduplication to prevent duplicate searches
- **`get-cached-symbols`**: Retrieves cached symbols for a directory and optional language
- **`clear-symbol-cache`**: Clears symbol cache (specific directory, language, or all)

### At-Path Registration (history-draft-handler.ts)
- **`register-at-path`**: Registers a file path pattern for highlighting (project-level)
- **`get-registered-at-paths`**: Retrieves registered @path patterns for a directory
- **`register-global-at-path`**: Registers a global @path pattern (for mdSearch agents)
- **`get-global-at-paths`**: Retrieves global @path patterns

### Usage History Tracking (usage-history-handler.ts)
- **`record-file-usage`**: Records file usage for intelligent scoring
- **`get-file-usage-bonuses`**: Retrieves usage bonuses for file paths
- **`record-symbol-usage`**: Records symbol usage for intelligent scoring
- **`get-symbol-usage-bonuses`**: Retrieves usage bonuses for symbols
- **`record-agent-usage`**: Records agent usage for intelligent scoring
- **`get-agent-usage-bonuses`**: Retrieves usage bonuses for agents

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
- **SymbolCacheManager**: Symbol search result caching with language separation
- **AtPathCacheManager**: @path pattern caching for file highlighting
- **MdSearchLoader**: Markdown file search for slash commands and agents
- **FileUsageHistoryManager**: File usage tracking and bonus calculation
- **SymbolUsageHistoryManager**: Symbol usage tracking and bonus calculation
- **AgentUsageHistoryManager**: Agent usage tracking and bonus calculation

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