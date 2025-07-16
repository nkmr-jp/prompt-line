# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

### Development
```bash
npm start          # Run app in production mode
npm run reset-accessibility  # Reset accessibility permissions for Prompt Line
```

### Testing
```bash
npm test                    # Run all tests
npm run test:watch         # Run tests in watch mode
npm run test:coverage      # Generate coverage report
npm run test:unit          # Run unit tests only
npm run test:integration   # Run integration tests only

# Run a specific test file
npm test tests/unit/utils.test.js

# Run tests matching a pattern
npm test -- --testNamePattern="formatTimeAgo"
```

### Build & Distribution
```bash
npm run build      # Build the application for local use (creates app directory)
npm run compile    # Full build: TypeScript + Renderer + Native Tools compilation
npm run lint       # Check code style
npm run lint:fix   # Auto-fix code style issues
npm run typecheck  # Run TypeScript type checking
npm run pre-push   # Run all pre-push checks (lint + typecheck + test)

# Additional build commands
npm run build:renderer  # Vite build for renderer process
npm run clean      # Removes build artifacts
npm run release    # Semantic release process
npm run prepare    # Husky setup
```

**Build Process Details:**
The `npm run compile` command performs:
1. TypeScript compilation (`tsc`)
2. Renderer build (`npm run build:renderer`)  
3. Native tools compilation (`cd native && make install`)
4. Copy compiled tools to distribution directory

### Git Hooks & Quality Assurance
The project uses automated git hooks to ensure code quality:

**Pre-commit hooks (via husky):**
- Custom script: Automatically runs ESLint with --fix on staged .js and .ts files
- Runs TypeScript type checking
- Re-adds auto-fixed files to staging
- Only processes files that are actually being committed (faster than full project linting)

**Pre-push hooks:**
- TypeScript type checking (`npm run typecheck`)
- Full test suite (`npm test`)
- Prevents pushing if any checks fail

**Manual quality checks:**
```bash
npm run pre-push   # Run all pre-push checks manually
```

**Setup for new contributors:**
```bash
npm install        # Installs husky and sets up hooks automatically via "prepare" script
```

### Development Tools
```bash
github             # Open repository in GitHub Desktop
```

### Commit Message Guidelines
Follow the Angular Commit Message Conventions:

**Format:**
```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `perf`: A code change that improves performance
- `test`: Adding missing tests or correcting existing tests
- `chore`: Changes to the build process or auxiliary tools and libraries

**Examples:**
```
feat(history): add search functionality to paste history
fix(window): resolve positioning issue on multi-monitor setups
docs(readme): update installation instructions
```

For full guidelines, see: https://github.com/angular/angular/blob/main/contributing-docs/commit-message-guidelines.md
## Architecture Overview

### Electron Process Architecture
The app uses Electron's two-process model with clean separation:

- **Main Process** (`src/main.ts`): Controls application lifecycle, window management, and system interactions
- **Renderer Process** (`src/renderer/`): Handles UI and user interactions
  - `renderer.ts`: Main renderer class with integrated keyboard handling and manager pattern
  - `ui-manager.ts`: Advanced UI management with themes, animations, and notifications
  - `input.html`: Main window template
  - 9 specialized managers: DOM, events, search, lifecycle, shortcuts, animation, and more
  - Comprehensive CSS architecture with themes and modular stylesheets
  - TypeScript configuration and utility functions
- **IPC Bridge** (`src/handlers/ipc-handlers.ts`): All communication between processes goes through well-defined IPC channels

### Manager Pattern
Core functionality is organized into specialized managers:

- **WindowManager**: Controls window creation, positioning, and lifecycle
  - Supports multiple positioning modes: active-text-field (default), active-window-center, cursor, center
  - Native Swift tools integration for window and text field detection
  - Multi-monitor aware positioning with boundary constraints
- **HistoryManager**: Manages unlimited paste history with optimized performance (persisted to JSONL)
- **OptimizedHistoryManager**: Performance-optimized history management with LRU caching for large datasets
- **DraftManager**: Auto-saves input drafts with adaptive debouncing
- **SettingsManager**: Manages user preferences with YAML-based configuration
  - Default window positioning mode: `active-text-field`
  - Real-time settings updates with deep merge functionality
  - Automatic settings file creation with sensible defaults
- **DesktopSpaceManager**: Ultra-fast desktop space change detection for window recreation

### Data Flow
```
User Input → Renderer → IPC Event → Handler → Manager → Data/System
                ↑                                    ↓
                └────────── IPC Response ────────────┘
```

### Key IPC Channels
- `paste-text`: Main action - pastes text to previous application
- `paste-image`: Clipboard image pasting support
- `get-history`, `clear-history`, `remove-history-item`, `search-history`: History operations
- `save-draft`, `clear-draft`, `get-draft`: Draft management
- `hide-window`, `show-window`: Window control
- `get-config`, `get-app-info`: Configuration and app metadata
- Additional channels: Settings management, statistics, configuration, and more (18 total channels)

## Platform-Specific Implementation

### macOS Auto-Paste
The app uses compiled Swift native tools to simulate Cmd+V in the previously active application. This requires:
- Accessibility permissions (prompted on first use)
- Proper window management to restore focus

**Native Swift Tools Integration:**
- **Window Detector**: Compiled Swift binary for reliable window bounds and app detection
- **Keyboard Simulator**: Native Cmd+V simulation and app activation with bundle ID support
- **Text Field Detector**: Focused text field detection for precise positioning using Accessibility APIs
- **JSON Communication**: Structured data exchange prevents parsing vulnerabilities
- **Error Recovery**: Graceful fallback from text field → window center → cursor → center positioning
- **Timeout Protection**: 3-second timeout prevents hanging on unresponsive operations
- **Security**: Compiled binaries eliminate script injection vulnerabilities

### Data Storage
All data is stored in `~/.prompt-line/`:
- `history.jsonl`: Paste history (JSONL format for efficient append operations)
- `draft.json`: Auto-saved drafts (created on-demand when drafts are saved)
- `settings.yml`: User preferences including window positioning mode
- `app.log`: Application logs with debug information
- `images/`: Directory for image storage

### Build Output
The built application is stored in `dist/`:
- `dist/mac-arm64/Prompt Line.app`: Apple Silicon build
- `dist/mac/Prompt Line.app`: Intel build
- DMG files: `Prompt-Line-{version}-arm64.dmg` and `Prompt-Line-{version}-x64.dmg`

## Testing Strategy

### Mock Infrastructure
Tests use comprehensive mocks defined in `tests/setup.ts`:
- Electron APIs (app, BrowserWindow, clipboard, screen, etc.)
- File system operations
- Child process execution
- IPC communication
- Advanced mocking with full TypeScript support

### Test Organization
- **Unit tests**: Test individual managers/utilities in isolation
- **Integration tests**: Test cross-module interactions
- **Fixtures**: Shared test data in `tests/fixtures/`

### Running Specific Tests
```bash
# Test a specific manager
npm test tests/unit/history-manager.test.js

# Test with pattern matching
npm test -- --testNamePattern="should save draft"

# Debug test failures
npm test -- --verbose
```

## Critical Implementation Details

### Window Positioning
The window supports multiple positioning modes with dynamic configuration:

**Default Mode: active-text-field**
- Positions prompt window near the currently focused text field
- Uses native text-field-detector tool for precise positioning
- Falls back to active-window-center if no text field is focused
- Provides optimal context by staying near the user's current input focus

**Available Positioning Options:**
- `active-text-field`: Position near the currently focused text field (default, falls back to active-window-center)
- `active-window-center`: Center within the currently active window
- `cursor`: Position at mouse cursor location
- `center`: Center on primary display

**Implementation Details:**
1. Detect focused text field using native text-field-detector tool with JSON response
2. If text field found, position window near text field with offset
3. If no text field, get active window bounds via native window-detector tool
4. Calculate optimal position within detected bounds (text field > window center > cursor > screen center)
5. Apply screen boundary constraints for multi-monitor setups
6. Create and position window with sub-pixel precision
7. Handle fallback chain gracefully with comprehensive error handling

### Draft Auto-Save
- Adaptive debouncing: 500ms for short text (≤200 chars), 1000ms for longer text
- Change detection prevents unnecessary saves when content hasn't changed
- Draft persists until explicitly cleared by successful paste (Cmd+Enter)
- Closing with Esc preserves the draft
- Backup system with timestamp-based naming for recovery

### History Management
- **Two implementations**: Traditional HistoryManager and OptimizedHistoryManager for large datasets
- **LRU Caching**: OptimizedHistoryManager uses 200-item cache for performance
- **Unlimited storage** with optimized performance (JSONL format)
- **Newest items appear at top** with timestamp-based sorting
- **Duplicates are prevented** through content comparison
- **Configurable display limit** (default: 20 items) prevents DOM bloat
- **Real-time search** with highlighting and case-insensitive matching
- **Streaming operations** for large files with efficient append-only strategy

### Desktop Space Management
- **Ultra-fast detection**: <5ms performance target for space changes
- **Space signatures**: Hash-based identification for efficient comparison
- **Window recreation**: Automatic window recreation when desktop space changes
- **Cache optimization**: 2-second TTL cache prevents expensive repeated operations
- **Accessibility integration**: Seamless integration with macOS accessibility APIs

### Security Considerations
- **Native tools security**: Compiled Swift binaries eliminate script injection vulnerabilities
- **Input sanitization**: AppleScript sanitization with 64KB limits and character escaping
- **Path validation**: Comprehensive path normalization prevents directory traversal
- **No app sandboxing** (required for auto-paste functionality)
- **Explicit permissions**: Requires user accessibility permissions with guided setup
- **Local data only**: All data stored locally, no network requests
- **JSON communication**: Structured data exchange prevents parsing attacks

## Investigation and Troubleshooting

### Investigation Task Guidelines
When conducting investigations (CI failures, bugs, security issues, design considerations, implementation planning, etc.), follow these guidelines:

1. **Documentation**: Always document investigation results in `.claude/scratch/` directory
2. **File Format**: Use markdown format for all investigation reports
3. **File Naming**: Use descriptive names like:
   - `YYYYMMDD-ci-failure-investigation.md`
   - `YYYYMMDD-bug-report-issue-123.md`
   - `YYYYMMDD-design-plan-feature-name.md`
   - `YYYYMMDD-implementation-plan.md`
4. **Content Structure**: Include:
   - Summary of the issue/task
   - Investigation/analysis steps taken
   - Root cause analysis (for bugs/issues) or design considerations (for planning)
   - Resolution recommendations or implementation plan
   - Next steps and follow-up actions

**Example Report Structures:**

*For Investigations:*
```markdown
# [Issue Type] Investigation

**Date:** YYYY-MM-DD
**Issue:** Brief description
**Status:** In Progress/Resolved/Blocked

## Summary
Brief overview of the issue and findings

## Investigation Details
Detailed steps taken and findings

## Root Cause Analysis
Technical analysis of the underlying cause

## Resolution Recommendations
Proposed solutions and next steps
```

*For Design/Implementation Planning:*
```markdown
# [Feature/Component] Design/Implementation Plan

**Date:** YYYY-MM-DD
**Scope:** Brief description of what's being planned
**Status:** Planning/In Progress/Ready for Implementation

## Summary
Overview of the feature/component and objectives

## Analysis & Design Considerations
Requirements analysis, constraints, and design decisions

## Implementation Plan
Detailed implementation steps and approach

## Next Steps
Action items and implementation timeline
```