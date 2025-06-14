# Renderer Module

This module contains the renderer process files that handle UI and user interactions in the Electron application. All files are written in TypeScript with comprehensive type safety.

## Files

### input.html
Main HTML template for the application window:
- Clean, minimal UI structure
- Text input area with proper focus management
- History display with scrollable list
- Search functionality with overlay UI
- Keyboard shortcut indicators
- Dark theme styling

### renderer.ts
Main renderer process class (PromptLineRenderer) with TypeScript:
- Class-based architecture with proper encapsulation
- DOM initialization and event binding with type safety
- Integrated keyboard shortcut handling (Cmd+Enter, Esc, Cmd+V, Tab, Cmd+F)
- IPC communication with main process using typed interfaces
- History display and click selection with type-safe data structures
- Draft auto-save coordination with debouncing
- Image paste functionality with error handling
- Comprehensive type definitions for WindowData, AppInfo, UserSettings, HistoryItem
- Manages EventHandler and SearchManager instances
- Keyboard navigation for history with Cmd+Up/Down
- Filtered history support for search results

### event-handler.ts
Dedicated event handling class (EventHandler):
- Centralized keyboard and DOM event management
- Composition event handling for IME support
- Window blur event handling
- Async paste operations with proper error handling
- Tab key insertion functionality
- History navigation keyboard shortcuts
- Search mode toggle functionality
- Proper TypeScript interfaces for results (PasteResult, ImageResult)

### search-manager.ts
Search functionality management class (SearchManager):
- Search mode toggle and UI state management
- Real-time history filtering based on search query
- Case-insensitive text search
- Search overlay UI management
- Escape key handling to exit search mode
- Click/touch event handling for search close button
- Integration with renderer for filtered history display
- Maintains search state and filtered data

### ui-manager.ts
Advanced UI management class providing:
- Theme management (dark/light modes with CSS custom properties)
- Type-safe theme configuration with Theme interface
- Animation system placeholder (disabled for instant UI)
- Notification system with toast messages
- Visual feedback for user actions
- Loading states and cursor management
- Character count with color coding
- Empty state handling for history
- Cross-platform shortcut display
- Proper element caching with TypeScript interfaces

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
├── EventHandler (Event Management)
├── SearchManager (Search Functionality)
└── UIManager (UI State & Themes)
```

### Data Flow
1. User input → EventHandler → PromptLineRenderer → IPC
2. Search query → SearchManager → Filter history → Update UI
3. IPC response → PromptLineRenderer → UI update

## Implementation Details

### History Rendering
- Dynamic list generation from history data with click handlers
- Relative timestamp display using formatTime() method
- XSS prevention through escapeHtml() sanitization
- Efficient DOM updates with innerHTML replacement
- Support for filtered history during search mode

### Input Management
- Auto-focus on window show with 50ms delay
- Debounced draft saving (500ms delay) for performance optimization
- Image paste integration with cursor positioning
- Tab character insertion support
- Character count updates and validation
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
- Handle window show/hide state transitions
- Manage focus and selection state across window lifecycle
- Coordinate between EventHandler, SearchManager, and UI updates

## Security Considerations
- Sanitize all user input before display
- Validate data received from main process
- Prevent XSS through proper DOM manipulation
- Limit exposed renderer APIs
- Type-safe interfaces prevent runtime errors

## Testing Strategy
- Mock IPC communication for isolation testing
- Test integrated keyboard event handling
- Verify DOM manipulation and XSS prevention
- Test image paste functionality and error handling
- Test draft auto-save timing and debouncing
- Verify UI manager animation and theme systems
- Test search functionality and filtering logic
- Test event handler composition and blur events