# Renderer Module

This module contains the renderer process files that handle the UI and user interactions in the Electron application. All files are written in TypeScript with comprehensive type safety and follow a modular architecture pattern.

## Purpose and Role

The renderer package serves as the frontend layer of the Prompt Line application, responsible for:
- Managing all user interface interactions and visual feedback
- Handling keyboard shortcuts and input events
- Coordinating with the main process via IPC for data operations
- Providing real-time search and history navigation functionality
- Managing application state and user preferences
- Ensuring responsive and accessible user experience

## Core Architecture

### Main Entry Point

#### input.html
The application's HTML template featuring:
- Semantic HTML structure with accessibility attributes (`role`, `aria-label`)
- Main input textarea with autocomplete disabled for security
- History section with search overlay functionality
- Integrated keyboard shortcut displays that update dynamically
- Optimized for both keyboard and mouse interaction patterns
- Modular script loading for UI manager and main renderer

#### renderer.ts - PromptLineRenderer Class
The central coordinator class that orchestrates all functionality:
- **Dependency Injection**: Constructor-based dependency injection for all manager classes
- **Lifecycle Management**: Handles initialization, window events, and cleanup
- **State Coordination**: Maintains synchronized state between filtered/unfiltered history data
- **IPC Integration**: All communication with main process flows through this class
- **Event Delegation**: Distributes user actions to appropriate manager classes
- **Error Handling**: Comprehensive error boundaries with user feedback

Key architectural decisions:
- Single responsibility principle with clear separation of concerns
- Async/await pattern for all IPC communication
- Immutable data patterns for history state management
- Callback-based communication between managers to prevent circular dependencies

### Type System

#### types.ts
Comprehensive TypeScript definitions providing:
- **Electron Integration**: `IpcRenderer` and `ElectronWindow` interfaces for browser environment
- **Data Models**: `HistoryItem`, `AppInfo`, `UserSettings`, `WindowData` with strict typing
- **Result Types**: `PasteResult` and `ImageResult` for async operation responses
- **Configuration**: `Config` interface for application settings
- **Global Extensions**: Window interface extensions for renderer access
- **Backwards Compatibility**: Legacy exports for smooth upgrades

## Manager Classes Architecture

The renderer process uses a modular manager pattern with 15+ specialized classes:

**Core Managers:**
- DomManager: DOM element access and manipulation
- LifecycleManager: Window and application lifecycle
- EventHandler: Comprehensive event management
- UIManager: Theme and notification system

**Data Management:**
- DraftManagerClient: Auto-save functionality (renderer side)
- HistoryUIManager: History display and interaction
- HistorySearchManager: Advanced history search with scoring
- SimpleSnapshotManager: Undo/redo with state tracking

**Mention System:**
- MentionManager: @ mention orchestration (15+ sub-managers)
- AgentSkillManager: Agent skill system
- FrontmatterPopupManager: Frontmatter display

**Event Delegation:**
- ShortcutHandler: Keyboard shortcut handling (`shortcut-handler.ts`)
- WindowBlurHandler: Window blur/auto-hide handling (`window-blur-handler.ts`)
- DirectoryDataHandler: Directory data updates from main process (`directory-data-handler.ts`)

### DomManager
Centralized DOM element access and manipulation:
- **Element Caching**: Initializes and validates all required DOM elements on startup
- **Null Safety**: Comprehensive null checks for all DOM operations
- **Text Operations**: Cursor positioning, text insertion, and selection management
- **UI Updates**: Character counting, app name display, and error messaging
- **Input Handling**: Tab character insertion and text manipulation utilities

Key features:
- Fails fast with descriptive errors if required elements are missing
- Optimized for performance with cached element references
- Immutable text operations that preserve cursor state

### LifecycleManager
Window and application lifecycle coordination:
- **Window Events**: Handles show/hide transitions with proper focus management
- **Draft Restoration**: Intelligent draft recovery with visual feedback
- **Settings Integration**: Dynamic shortcut display updates based on user preferences
- **App State**: Manages app name display with source application context
- **Focus Management**: Coordinated textarea focus with cursor positioning
- **Notification System**: Temporary status messages for user feedback

Implementation details:
- Uses configurable delays for smooth UI transitions
- Extracts draft data from multiple possible formats (string or object)
- Integrates with shortcut formatter for cross-platform display

### DraftManager & DraftManagerClient
Intelligent auto-save functionality with performance optimization:

**DraftManager (Main Process):**
- Manages draft persistence to disk
- Handles draft CRUD operations
- Directory-aware draft management

**DraftManagerClient (Renderer Process):**
- **Debounced Saving**: 500ms delay prevents excessive disk writes during typing
- **Immediate Save**: Force-save capability for critical moments (window hide)
- **Configuration**: Respects user-defined save delays from config
- **State Management**: Tracks and clears timeouts properly
- **Error Handling**: Graceful degradation if IPC communication fails
- **IPC Communication**: Bridges renderer to main process draft operations

Performance considerations:
- Uses shared constants for consistent timing across application
- Implements proper cleanup to prevent memory leaks
- Callback-based text retrieval for loose coupling

### HistoryUIManager
Advanced history display and interaction management:
- **Dynamic Rendering**: Efficient DOM updates using DocumentFragment for performance
- **Search Integration**: Highlighting of search terms with XSS prevention
- **Keyboard Navigation**: Visual feedback with flash animations and auto-scrolling
- **Click Handling**: Mouse and keyboard interaction coordination
- **State Management**: Selection state tracking with timeout-based cleanup
- **Limit Handling**: Configurable visible item limits with "more items" indicator

Advanced features:
- Search highlighting with regex-based term replacement
- Smooth scrolling with `scrollIntoView` for keyboard navigation
- Flash animation system with proper CSS class management
- Keyboard navigation mode with hover effect disabling
- Empty state handling with contextual messaging

### EventHandler
Comprehensive event management with IME support:
- **Global Event Handling**: Document-level event capture with proper propagation control
- **IME Compatibility**: Composition event handling for international input methods
- **Shortcut Processing**: Dynamic shortcut matching based on user settings
- **Window Management**: Blur detection for auto-hide functionality
- **Image Paste**: Advanced clipboard image handling with cursor positioning
- **Search Integration**: Coordinated search mode handling across components

Technical implementation:
- Uses shortcut-parser utility for flexible shortcut matching
- Implements proper event capture/bubble phases
- Includes timeout-based window blur handling to prevent accidental closes
- Supports both event-target specific and global shortcut handling

### MentionManager (mentions/)
Comprehensive @ mention system with modular architecture for file search and code search:

**Module Structure:**
- `mentions/index.ts`: Public API exports
- `mentions/types.ts`: Type definitions for mention system
- `mentions/managers/`: 15+ specialized managers (see below)
- `mentions/code-search/`: Code/symbol search module
- `mentions/dom-utils.ts`: DOM manipulation utilities
- `mentions/fuzzy-matcher.ts`: Fuzzy matching algorithms
- `mentions/text-finder.ts`: Text pattern detection
- `mentions/path-utils.ts`: Path manipulation utilities

**Specialized Managers (mentions/managers/):**
1. **MentionInitializer** (`mention-initializer.ts`): Orchestrates initialization of all mention subsystems
2. **MentionState** (`mention-state.ts`): Centralized state management for mention functionality
3. **SuggestionUIManager** (`suggestion-ui-manager.ts`): Manages suggestion dropdown display and positioning
4. **PopupManager** (`popup-manager.ts`): Controls popup lifecycle and visibility
5. **FileFilterManager** (`file-filter-manager.ts`): Implements file filtering with fuzzy matching
6. **DirectoryCacheManager** (`directory-cache-manager.ts`): Manages directory data caching with hybrid loading
7. **NavigationManager** (`navigation-manager.ts`): Handles keyboard navigation through suggestions
8. **PathManager** (`path-manager.ts`): Path detection, insertion, and file opening
9. **BaseCacheManager** (`base-cache-manager.ts`): Abstract base class for cache implementations
10. **HighlightManager** (`highlight-manager.ts`): @path highlighting and Cmd+click support in textarea
11. **FileOpenerEventHandler** (`file-opener-event-handler.ts`): Handles file opening events
12. **CodeSearchManager** (`code-search-manager.ts`): Symbol search integration with ripgrep
13. **EventListenerManager** (`event-listener-manager.ts`): Centralized event listener management
14. **QueryExtractionManager** (`query-extraction-manager.ts`): Extracts and parses @ mention queries
15. **SettingsCacheManager** (`settings-cache-manager.ts`): Caches user settings for mention features

**Core Features:**
- **@ Mention Detection**: Triggers file/code search when user types `@` or `@language:` in textarea
- **Incremental Search**: Real-time filtering as user types after `@`
- **Hybrid Loading**: Stage 1 (quick single-level) + Stage 2 (recursive with fd command)
- **Fuzzy Matching**: Score-based ranking (exact, starts-with, contains, fuzzy)
- **Keyboard Navigation**: Arrow keys, Enter/Tab to select, Escape to close
- **Cache Management**: Multi-layer caching for performance optimization
- **@path Highlighting**: Visual highlighting with Cmd+click to open files
- **XSS Prevention**: Safe DOM manipulation with proper escaping

**Implementation Details:**
- Uses fd command (if available) for fast recursive file searching
- Respects .gitignore patterns with optional override
- Supports hidden files via settings
- Configurable limits (maxFiles: 5000, maxDepth)
- File icons based on extension with emoji indicators
- Modular design with clear separation of concerns

### CodeSearchManager (mentions/code-search/)
Code/symbol search functionality with `@language:query` syntax for 20+ programming languages:

**Module Structure:**
- `mentions/code-search/types.ts`: Type definitions and symbol utilities
- `mentions/code-search/index.ts`: Public API exports

**Features:**
- **Syntax**: Type `@<language>:<query>` to search for symbols (e.g., `@ts:Config`, `@go:Handler`)
- **Symbol Types**: function, method, class, struct, interface, type, enum, constant, variable, module, trait, resource, heading, etc.
- **Score-based Filtering**: Symbols ranked by name match quality
- **Keyboard Navigation**: Arrow keys to navigate, Enter/Tab to select, Escape to close

**Key Types:**
```typescript
interface SymbolResult {
  name: string;
  type: SymbolType;
  filePath: string;
  lineNumber: number;
  lineContent: string;
}

interface SymbolSearchResponse {
  success: boolean;
  symbols: SymbolResult[];
  count: number;
  directory: string;
  language: string;
  searchMode: 'full' | 'cached';
}
```

**Supported Languages (20+):**
| Language | Key | Example |
|----------|-----|---------|
| Go | `go` | `@go:Handler` |
| TypeScript | `ts` | `@ts:Config` |
| JavaScript | `js` | `@js:init` |
| Python | `py` | `@py:parse` |
| Rust | `rs` | `@rs:handle` |
| Java | `java` | `@java:Service` |
| Swift | `swift` | `@swift:detect` |
| Makefile | `make`, `mk` | `@make:install` |
| Terraform | `tf` | `@tf:instance` |
| Markdown | `md` | `@md:Installation` |

**Helper Functions:**
- `getSymbolTypeDisplay(type)`: Returns localized display label for symbol type
- `SYMBOL_TYPE_FROM_DISPLAY`: Reverse mapping from display label to SymbolType

**Requirements:**
- ripgrep (`rg`) must be installed (`brew install ripgrep`)
- File search must be enabled in settings

### HistorySearchManager (history-search/)
Advanced history search functionality with score-based filtering and fuzzy matching:

**Module Structure:**
- `history-search/types.ts`: Configuration and type definitions
- `history-search/filter-engine.ts`: Score-based filtering with fuzzy match support
- `history-search/highlighter.ts`: Search term highlighting with XSS prevention
- `history-search/history-search-manager.ts`: Orchestration layer
- `history-search/index.ts`: Public API exports

**Features:**
- **Score-based Ranking**: Exact match (1000) > starts-with (500) > contains (200) > fuzzy (10)
- **Recency Bonus**: 0-50 points based on age (7-day window)
- **Fuzzy Matching**: Intelligent substring matching for partial queries
- **Debounced Search**: 150ms delay prevents excessive filtering
- **Configurable Limits**: maxSearchItems (5000), maxDisplayResults (50)

**Key Types:**
```typescript
interface HistorySearchConfig {
  debounceDelay: number;      // 150ms default
  fuzzyMatch: boolean;        // Enable fuzzy matching
  maxSearchItems: number;     // 5000 - items to search through
  maxDisplayResults: number;  // 50 - items to display
  caseSensitive: boolean;     // false by default
}

interface SearchResult {
  item: HistoryItem;
  score: number;
  matchPositions?: number[];  // For fuzzy match highlighting
}
```

**Score Constants:**
```typescript
const MATCH_SCORES = {
  EXACT_MATCH: 1000,
  STARTS_WITH: 500,
  CONTAINS: 200,
  FUZZY_MATCH: 10,
  MAX_RECENCY_BONUS: 50
};
```

**Key Classes:**
- `HistorySearchFilterEngine`: Core search and scoring logic
- `HistorySearchHighlighter`: Safe HTML highlighting with XSS protection
- `HistorySearchManager`: Coordinates search UI, events, and state

**Key Methods:**
- `performSearch(query)`: Triggers debounced search
- `enterSearchMode()` / `exitSearchMode()`: Mode transitions
- `loadMore()` / `canLoadMore()`: Infinite scroll support
- `highlightSearchTerms(text, query)`: Safe term highlighting
- `highlightFuzzyMatch(text, positions)`: Position-based highlighting

### AgentSkillManager
Agent skill system for quick skill access:
- **Skill Detection**: Triggers on `/` character at start of line
- **Skill Loading**: Loads skills from markdown files
- **Agent Selection**: Provides agent selection functionality
- **Integration**: Works with CustomSearchLoader for skill discovery

Features:
- Dynamic skill loading from user-defined files
- Keyboard navigation through available skills
- Seamless integration with mention system

### FrontmatterPopupManager
Frontmatter data display for context-aware editing:
- **Popup Display**: Shows frontmatter information in overlay
- **Dynamic Positioning**: Positions popup near relevant content
- **Data Parsing**: Extracts and displays frontmatter metadata
- **User Interaction**: Handles popup show/hide lifecycle

Implementation:
- Coordinates with mention system for context display
- Provides visual feedback for markdown frontmatter
- Supports YAML frontmatter format

### UIManager
Theme and notification management (currently optimized for performance):
- **Theme System**: CSS custom property-based theming with type-safe theme definitions
- **Notification System**: Toast notifications with multiple severity levels
- **Animation Framework**: Placeholder system (disabled for instant UI performance)
- **Loading States**: Visual feedback for async operations
- **Cross-platform**: Platform-aware shortcut display handling

Design decisions:
- Animations disabled by design for instant UI responsiveness
- CSS custom properties for runtime theme switching
- Fixed positioning for notifications with z-index management
- Global window attachment for browser environment compatibility

### SimpleSnapshotManager
Undo/redo functionality with text and cursor state tracking:
- **State Snapshots**: Captures text content and cursor position together
- **History Stack**: Maintains undo/redo history with configurable depth
- **Cursor Preservation**: Restores cursor position along with text content
- **Integration**: Works with DomManager for text operations

Key methods:
- `saveSnapshot()`: Captures current text and cursor state
- `undo()`: Reverts to previous state with cursor restoration
- `redo()`: Restores previously undone state
- `clear()`: Clears snapshot history

Implementation:
- Lightweight state storage with minimal memory footprint
- Debounced snapshot creation to avoid excessive history entries
- Maximum history depth limit for memory management

## Supporting Modules

### Interfaces (interfaces/)
TypeScript interface definitions for shared contracts:

**interfaces/initializable.ts:**
- `IInitializable`: Interface for manager initialization lifecycle
  - `initialize()`: Setup method for DOM elements and event listeners
  - `destroy()`: Cleanup method for resource disposal (optional)

**interfaces/index.ts:**
- Public API exports for all interfaces

Design principles:
- Standardizes manager lifecycle patterns
- Enables consistent initialization and cleanup
- Supports dependency injection and testing

### Services (services/)
Service layer for cross-cutting concerns:

**services/electron-api.ts:**
- `getElectronAPI()`: Type-safe access to Electron preload API
- `electronAPI`: Lazy-initialized singleton proxy for convenience
- Error handling for missing preload script
- Test-friendly Proxy implementation for mocking support

Features:
- Centralized Electron API access point
- Type safety with ElectronAPI interface
- Prevents direct window.electronAPI access
- Graceful error messages for debugging

## Utility Functions

### utils/shortcut-formatter.ts
Cross-platform keyboard shortcut display:
- **Symbol Conversion**: Platform-specific symbols (⌘, ⇧, ⌥, Ctrl)
- **Dynamic Updates**: Real-time shortcut display based on user settings
- **Format Parsing**: Intelligent parsing of shortcut strings into display components
- **HTML Generation**: Safe HTML generation for shortcut display elements

Features:
- Handles both macOS and Windows/Linux shortcut conventions
- Extracts individual keys for precise formatting control
- Generates styled HTML with proper keyboard element tags

### utils/shortcut-parser.ts
Robust shortcut parsing and matching system:
- **String Parsing**: Converts shortcut strings into structured objects
- **Event Matching**: Compares keyboard events against parsed shortcuts
- **Modifier Support**: Full support for all modifier key combinations
- **Case Insensitive**: Normalized key matching for reliability

Implementation:
- Handles multiple modifier key names (cmd/meta, ctrl/control, alt/option)
- Provides both object-based and string-based matching APIs
- Used by EventHandler for dynamic shortcut processing

### utils/time-formatter.ts
Human-readable timestamp formatting:
- **Relative Time**: Smart relative time display ("Just now", "5m ago", "2h ago", "3d ago")
- **Shared Constants**: Uses application-wide time calculation constants
- **Performance**: Optimized calculations using integer math

Formatting logic:
- Sub-minute times show as "Just now"
- Minutes and hours for recent items
- Days for older items
- Integrates with shared TIME_CALCULATIONS constants

## Styling Architecture

### Modular CSS Structure
Organized for maintainability and performance:

#### styles/main.css
- **Entry Point**: Single import point for all stylesheets
- **Load Order**: Carefully ordered imports (base → layout → components → themes → animations)
- **Dependency Management**: Explicit import declarations for build optimization

#### styles/base/
Foundation styles for consistent base layer:
- **variables.css**: CSS custom properties for theming and consistent spacing
- **reset.css**: Normalized browser defaults for cross-platform consistency

#### styles/layout/
Structural component styles:
- **container.css**: Main application container and responsive layout
- **input-section.css**: Textarea and input wrapper styling
- **history-section.css**: History list container and scrolling behavior

#### styles/components/
Interactive component styling:
- **buttons.css**: Button states, hover effects, and accessibility features
- **search.css**: Search overlay and input styling with transitions
- **history-item.css**: Individual history item styling with interaction states
- **file-suggestions.css**: File search dropdown styling with keyboard navigation states

#### styles/themes/
Theme definitions and variations:
- **themes.css**: CSS custom property definitions for dark/light themes
- Runtime theme switching support via UIManager

#### styles/animations/
Performance-optimized animation definitions:
- **transitions.css**: Smooth state transitions (currently minimal for performance)

## Key Functionality

### Keyboard Shortcuts (Configurable)
- **`Cmd+Enter`**: Paste current text and close window
- **`Esc`**: Close window (preserves draft) or exit search mode
- **`Cmd+V`**: Paste image from clipboard with path insertion
- **`Tab`**: Insert tab character in textarea
- **`Cmd+F`**: Toggle search mode with auto-focus
- **`Ctrl+j/k`**: Navigate through history items (configurable via settings)

### Advanced Input Management
- **Draft Auto-save**: Debounced saving with configurable delays
- **Image Paste Support**: Clipboard image detection with path insertion
- **IME Support**: International input method compatibility
- **Multi-line Support**: Full textarea functionality with proper formatting
- **Character Counting**: Real-time character count display
- **Tab Insertion**: Proper tab character support (not focus change)

### Search Functionality
- **Real-time Filtering**: Instant search results as user types
- **Term Highlighting**: Visual search term highlighting with XSS protection
- **Keyboard Navigation**: History navigation works within search results
- **Case Insensitive**: Flexible search matching
- **Visual Feedback**: Search overlay with smooth transitions
- **Multi-modal Close**: Mouse, touch, and keyboard close options

### File Search (@ Mention)
- **Trigger**: Type `@` anywhere in textarea to activate file search
- **Incremental Search**: Filter files as you type after `@`
- **Fuzzy Matching**: Intelligent matching with filename and path search
- **Keyboard Navigation**: Arrow keys to navigate, Enter/Tab to select, Escape to close
- **Hybrid Loading**: Fast Stage 1 (single-level) + Background Stage 2 (recursive with fd)
- **Configurable**: Settings for fd usage, gitignore respect, hidden files, max files/depth

### History Management
- **Infinite Scrolling**: Configurable visible item limits with "more items" indicator
- **Click Selection**: Mouse-based history item selection
- **Keyboard Navigation**: Flash animation feedback with auto-scrolling
- **Timestamp Display**: Relative time formatting with auto-updates
- **Empty States**: Contextual messaging for empty or filtered results
- **XSS Prevention**: Safe HTML rendering of user content

## IPC Communication Pattern

### Request/Response Flow
1. **User Action** → EventHandler or Manager class
2. **IPC Invocation** → Typed request to main process
3. **Response Handling** → Type-safe response processing
4. **UI Update** → Manager coordination for UI changes
5. **Error Handling** → User feedback via notifications or error display

### Communication Channels
- **`paste-text`**: Main paste action with result feedback
- **`paste-image`**: Clipboard image paste with path result
- **`save-draft`/`clear-draft`**: Draft persistence operations
- **`get-config`**: Configuration retrieval for initialization
- **`hide-window`/`show-window`**: Window visibility control
- **`window-shown`**: Window lifecycle with history, draft, settings, and directory data (Stage 1)
- **`directory-data-updated`**: Background file list update (Stage 2 recursive search)

## State Management

### Data Flow Architecture
```
User Input → EventHandler → PromptLineRenderer → Manager Classes → UI Updates
     ↑                                                                    ↓
     └─────────────── IPC Communication ←→ Main Process ←─────────────────┘
```

### State Synchronization
- **History State**: Maintains both original and filtered history arrays
- **Search State**: Coordinated between SearchManager and HistoryUIManager
- **Draft State**: Synchronized between DraftManager and input content
- **Settings State**: Propagated from LifecycleManager to all relevant managers
- **Focus State**: Managed by EventHandler with lifecycle coordination

### Memory Management
- **Cleanup Methods**: All managers implement cleanup for timeout and event cleanup
- **Event Removal**: Proper event listener cleanup on component destruction
- **Timeout Management**: All timeouts tracked and cleared appropriately
- **DOM References**: Cached references with null safety throughout

## Security Considerations

### XSS Prevention
- **HTML Escaping**: All user content escaped before DOM insertion
- **Safe innerHTML**: Search highlighting uses regex replacement with escaped content
- **Input Sanitization**: Proper handling of user input in all contexts
- **DOM Manipulation**: Direct text content setting where possible over innerHTML

### Data Validation
- **Type Safety**: Comprehensive TypeScript interfaces prevent runtime errors
- **IPC Validation**: Response type checking for all IPC communication
- **Input Validation**: Proper handling of malformed or unexpected data
- **Error Boundaries**: Comprehensive error handling with graceful degradation

## Performance Optimizations

### Rendering Performance
- **DocumentFragment**: Efficient DOM updates for history rendering
- **Debounced Operations**: Draft saving and search input debouncing
- **Cached References**: DOM element caching to avoid repeated queries
- **Animation Reduction**: Animations disabled by design for instant UI response
- **Limit Management**: Configurable visible item limits to prevent DOM bloat

### Memory Efficiency
- **Event Delegation**: Minimal event listeners with proper cleanup
- **Timeout Management**: Tracked and cleared timeouts prevent memory leaks
- **Manager Lifecycle**: Proper initialization and cleanup for all components
- **Data Structures**: Efficient array operations with immutable patterns

## Testing Strategy

### Unit Testing Approach
- **Manager Isolation**: Each manager class testable in isolation
- **IPC Mocking**: Comprehensive mocks for Electron IPC communication
- **DOM Testing**: Jsdom-based testing for DOM manipulation
- **Event Simulation**: Keyboard and mouse event simulation
- **State Testing**: Verification of state transitions and synchronization

### Integration Testing
- **Manager Coordination**: Cross-manager communication testing
- **Lifecycle Testing**: Window show/hide state transitions
- **Search Flow**: End-to-end search functionality testing
- **Draft Persistence**: Auto-save and restoration testing
- **Error Handling**: Error propagation and user feedback testing

## Development Guidelines

### Adding New Features
1. **Manager Pattern**: Create dedicated manager classes for complex functionality
2. **Type Safety**: Define TypeScript interfaces for all data structures
3. **IPC Integration**: Use established IPC patterns for main process communication
4. **Error Handling**: Implement comprehensive error boundaries
5. **Testing**: Include unit and integration tests
6. **Documentation**: Update this CLAUDE.md with implementation details

### Code Organization
- Keep manager classes focused on single responsibilities
- Use dependency injection for loose coupling
- Implement proper cleanup methods for all components
- Follow established patterns for IPC communication
- Maintain type safety throughout the codebase