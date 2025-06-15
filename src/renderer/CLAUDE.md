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

### DraftManager
Intelligent auto-save functionality with performance optimization:
- **Debounced Saving**: 500ms delay prevents excessive disk writes during typing
- **Immediate Save**: Force-save capability for critical moments (window hide)
- **Configuration**: Respects user-defined save delays from config
- **State Management**: Tracks and clears timeouts properly
- **Error Handling**: Graceful degradation if IPC communication fails

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

### SearchManager
Real-time search functionality with advanced UI state management:
- **Mode Management**: Search state tracking with visual feedback
- **Real-time Filtering**: Instant search results as user types
- **Highlight System**: Search term highlighting with escape character handling
- **Event Coordination**: Comprehensive mouse, touch, and keyboard event handling
- **Focus Management**: Intelligent focus transitions between search and main input
- **Data Synchronization**: Maintains original data while providing filtered views

User experience features:
- Case-insensitive search with regex-based highlighting
- Multiple event handlers for reliable close button functionality
- Escape key handling with proper event propagation control
- Auto-focus on search input when entering search mode
- Seamless transition back to main textarea on search exit

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
- **`window-shown`**: Window lifecycle event with data payload

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