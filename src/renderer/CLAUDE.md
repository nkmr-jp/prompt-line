# Renderer Module

This module contains the renderer process files that handle UI and user interactions in the Electron application. All files are written in TypeScript with comprehensive type safety.

## Files

### Core Files

#### input.html
Main HTML template for the application window:
- Clean, minimal UI structure
- Text input area with proper focus management
- History display with scrollable list
- Search functionality with overlay UI
- Keyboard shortcut indicators
- Dark theme styling

#### renderer.ts
Main renderer process class (PromptLineRenderer) with TypeScript:
- Class-based architecture with proper encapsulation
- Coordinates all manager classes (DomManager, LifecycleManager, etc.)
- IPC communication with main process using typed interfaces
- History display and click selection with type-safe data structures
- Image paste functionality with error handling
- Keyboard navigation for history with Cmd+Up/Down
- Filtered history support for search results

#### types.ts
Comprehensive TypeScript type definitions:
- IpcRenderer and ElectronWindow interfaces for Electron APIs
- HistoryItem, AppInfo, UserSettings, WindowData interfaces
- Config, PasteResult, ImageResult interfaces
- Global window type declarations
- Backwards compatibility exports

### Manager Classes

#### dom-manager.ts
DOM element management and basic UI operations:
- Centralized DOM element references with null safety
- Element initialization and validation
- Character count updates
- App name display updates
- Error message display with temporary styling

#### lifecycle-manager.ts
Window lifecycle and initialization management:
- Window show/hide event handling
- Draft restoration and initialization
- User settings updates
- App name display logic
- Draft notification system
- Cursor positioning and text selection

#### draft-manager.ts
Draft auto-save functionality:
- Debounced draft saving (500ms delay) for performance
- Draft persistence and restoration
- Draft clear operations
- Integration with IPC communication

#### history-ui-manager.ts
History display and interaction management:
- Dynamic history list rendering with click handlers
- XSS prevention through HTML escaping
- Efficient DOM updates for history items
- Support for filtered history during search
- Empty state handling

#### event-handler.ts
Dedicated event handling class (EventHandler):
- Centralized keyboard and DOM event management
- Composition event handling for IME support
- Window blur event handling
- Async paste operations with proper error handling
- Tab key insertion functionality
- History navigation keyboard shortcuts
- Search mode toggle functionality

#### search-manager.ts
Search functionality management class (SearchManager):
- Search mode toggle and UI state management
- Real-time history filtering based on search query
- Case-insensitive text search
- Search overlay UI management
- Escape key handling to exit search mode
- Click/touch event handling for search close button
- Integration with renderer for filtered history display

#### ui-manager.ts
Advanced UI management class providing:
- Theme management (dark/light modes with CSS custom properties)
- Type-safe theme configuration with Theme interface
- Animation system placeholder (disabled for instant UI)
- Notification system with toast messages
- Visual feedback for user actions
- Loading states and cursor management
- Cross-platform shortcut display

### Utility Functions

#### utils/shortcut-formatter.ts
Keyboard shortcut formatting utilities:
- Cross-platform shortcut symbol conversion (⌘, ⇧, ⌥, etc.)
- Dynamic shortcut display updates
- Header and history shortcut formatting
- Platform-specific key mappings

#### utils/time-formatter.ts
Time and timestamp formatting utilities:
- Relative time display ("Just now", "5m ago", "2h ago", "3d ago")
- Integration with shared time constants
- Human-readable timestamp conversion

### Styling Structure

#### styles/
Organized CSS architecture:
- **main.css**: Main stylesheet entry point
- **base/**: Foundation styles (reset.css, variables.css)
- **layout/**: Layout components (container.css, sections)
- **components/**: UI component styles (buttons, history items, search)
- **themes/**: Theme definitions and variations
- **animations/**: Transition and animation styles

## Key Functionality

### Keyboard Shortcuts
- `Cmd+Enter`: Paste current text and close window
- `Esc`: Close window (preserves draft)
- `Cmd+V`: Paste image from clipboard
- `Tab`: Insert tab character in textarea
- `Cmd+F`: Toggle search mode
- `Cmd+Up/Down`: Navigate through history items

### UI Components
- **Input Area**: Textarea with draft persistence and image paste support
- **History List**: Scrollable list with relative timestamps and click selection
- **Search Overlay**: Real-time search with filtered history display
- **Notification System**: Toast notifications for feedback
- **Theme Support**: Dark/light mode switching
- **Animations**: Animation system (currently disabled for instant UI)
- **Loading States**: Visual indicators for async operations

### IPC Communication
- Send events to main process for all actions
- Receive responses and update UI accordingly
- Handle async operations with proper error states
- Type-safe communication with defined interfaces

## Architecture

### Class Structure
```
 PromptLineRenderer (Main Controller)
├── DomManager (DOM Element Management)
├── LifecycleManager (Window Lifecycle)
├── DraftManager (Draft Auto-Save)
├── HistoryUIManager (History Display)
├── EventHandler (Event Management)
├── SearchManager (Search Functionality)
└── UIManager (UI State & Themes)
```

### Data Flow
1. User input → EventHandler → PromptLineRenderer → IPC
2. Search query → SearchManager → Filter history → HistoryUIManager → Update UI
3. Draft changes → DraftManager → Debounced save → IPC
4. Window lifecycle → LifecycleManager → Initialize/cleanup → DomManager
5. IPC response → PromptLineRenderer → Manager delegation → UI update

## Implementation Details

### History Rendering (HistoryUIManager)
- Dynamic list generation from history data with click handlers
- Relative timestamp display using time-formatter utility
- XSS prevention through HTML escaping utilities
- Efficient DOM updates with innerHTML replacement
- Support for filtered history during search mode
- Empty state handling and user feedback

### Input Management (DomManager + DraftManager)
- Auto-focus on window show with configurable delay
- Debounced draft saving (500ms delay) via DraftManager
- Image paste integration with cursor positioning
- Tab character insertion support
- Real-time character count updates
- Optimized DOM updates for responsive UI
- IME composition event handling

### Search Functionality
- Real-time filtering as user types
- Case-insensitive search across history text
- Visual feedback with search overlay
- Maintains original history data while displaying filtered results
- Keyboard navigation works with filtered results

### State Synchronization
- Keep UI in sync with main process state
- Handle window show/hide state transitions via LifecycleManager
- Manage focus and selection state across window lifecycle
- Coordinate between all manager classes for consistent state
- Draft persistence across window sessions
- Settings synchronization and real-time updates

## Security Considerations
- Sanitize all user input before display
- Validate data received from main process
- Prevent XSS through proper DOM manipulation
- Limit exposed renderer APIs
- Type-safe interfaces prevent runtime errors

## Testing Strategy
- Mock IPC communication for isolation testing
- Test manager class interactions and coordination
- Verify DOM manipulation and XSS prevention
- Test image paste functionality and error handling
- Test draft auto-save timing and debouncing (DraftManager)
- Verify UI manager animation and theme systems
- Test search functionality and filtering logic
- Test event handler composition and blur events
- Test lifecycle manager window transitions
- Test utility function formatting and calculations
- Integration testing between manager classes