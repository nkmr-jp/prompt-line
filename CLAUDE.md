# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

### Development
```bash
npm start          # Run app in production mode
npm run dev        # Run app in development mode with detailed logging
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
npm run lint       # Check code style
npm run lint:fix   # Auto-fix code style issues
npm run typecheck  # Run TypeScript type checking
npm run pre-push   # Run all pre-push checks (lint + typecheck + test)
```

### Git Hooks & Quality Assurance
The project uses automated git hooks to ensure code quality:

**Pre-commit hooks (via husky):**
- `lint-staged`: Automatically runs ESLint with --fix on staged .js and .ts files
- Only processes files that are actually being committed (faster than full project linting)

**Pre-push hooks:**
- TypeScript type checking (`npm run typecheck`)
- Full test suite (`npm test`)
- Prevents pushing if any checks fail

**Manual quality checks:**
```bash
npm run pre-push   # Run all pre-push checks manually
npx lint-staged    # Run lint-staged manually on staged files
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
- `style`: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)
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

- **Main Process** (`src/main.js`): Controls application lifecycle, window management, and system interactions
- **Renderer Process** (`src/renderer/`): Handles UI and user interactions
  - `renderer.js`: Main renderer class with integrated keyboard handling
  - `ui-manager.js`: Advanced UI management with themes, animations, and notifications
  - `input.html`: Main window template
- **IPC Bridge** (`src/handlers/ipc-handlers.js`): All communication between processes goes through well-defined IPC channels

### Manager Pattern
Core functionality is organized into specialized managers:

- **WindowManager**: Controls window creation, positioning, and lifecycle
  - Supports multiple positioning modes: active-text-field (default), active-window-center, cursor, active-display-center
  - Advanced native Swift integration for text field and window detection
  - Multi-monitor aware positioning with boundary constraints
- **HistoryManager**: Manages unlimited paste history with optimized performance (persisted to JSONL)
- **DraftManager**: Auto-saves input drafts with debouncing
- **SettingsManager**: Manages user preferences with YAML-based configuration
  - Default window positioning mode: `active-text-field`
  - Real-time settings updates with deep merge functionality
  - Automatic settings file creation with sensible defaults

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

## Platform-Specific Implementation

### macOS Auto-Paste
The app uses AppleScript (`osascript`) to simulate Cmd+V in the previously active application. This requires:
- Accessibility permissions (prompted on first use)
- Proper window management to restore focus

**AppleScript Integration Features:**
- **Window Detection**: Advanced AppleScript to get active window bounds with position and size
- **Robust Parsing**: Handles AppleScript output with commas and spaces (`"1028, |, 44, |, 1028, |, 1285"`)
- **Error Recovery**: Graceful fallback from window detection to cursor positioning
- **Timeout Protection**: 3-second timeout prevents hanging on unresponsive AppleScript calls
- **Security**: Command injection prevention through proper string escaping

### Data Storage
All data is stored in `~/.prompt-line/`:
- `history.jsonl`: Paste history (JSONL format for efficient append operations)
- `draft.json`: Auto-saved drafts
- `settings.yaml`: User preferences including window positioning mode
- `app.log`: Application logs with debug information

### Build Output
The built application is stored in `dist/app/`:
- `dist/app/mac-arm64/`: Apple Silicon build
- `dist/app/mac-x64/`: Intel build
- Each folder contains the complete `Prompt Line.app` ready for use

## Testing Strategy

### Mock Infrastructure
Tests use comprehensive mocks defined in `tests/setup.js`:
- Electron APIs (app, BrowserWindow, clipboard, etc.)
- File system operations
- Child process execution
- IPC communication

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
- Uses native Swift tools to detect text field bounds with multiple fallback methods
- Falls back to active-window-center when no text field is detected
- Provides optimal context by appearing near the text insertion point

**Available Positioning Options:**
- `active-text-field`: Position near the currently focused text field (default)
- `active-window-center`: Center within the currently active window
- `cursor`: Position at mouse cursor location
- `active-display-center`: Center on the active display (where cursor is located)

**Implementation Details:**
1. Detect focused text field bounds via native Swift tools (with multiple fallback methods)
2. Calculate optimal position based on selected positioning mode
3. Apply screen boundary constraints for multi-monitor setups
4. Create and position window with sub-pixel precision
5. Handle error cases with graceful fallback to alternative positioning modes

### Draft Auto-Save
- Debounced at 500ms to prevent excessive writes
- Draft persists until explicitly cleared by successful paste (Cmd+Enter)
- Closing with Esc preserves the draft

### History Management
- Unlimited storage with optimized performance
- Newest items appear at top
- Duplicates are prevented
- Configurable display limit (default: 20 items)
- LRU caching for efficient memory usage
- Relative timestamps update on each render

### Security Considerations
- No app sandboxing (required for auto-paste functionality)
- Requires explicit user permissions for accessibility
- All data stored locally, no network requests

## Investigation and Troubleshooting

### Investigation Task Guidelines
When conducting investigations (CI failures, bugs, security issues, design considerations, implementation planning, etc.), follow these guidelines:

1. **Documentation**: Always document investigation results in `.claude/scratch/` directory
2. **File Format**: Use markdown format for all investigation reports
3. **File Naming**: Use descriptive names like:
   - `ci-failure-investigation-YYYYMMDD.md`
   - `bug-report-issue-123.md`
   - `design-plan-feature-name.md`
   - `implementation-plan-YYYYMMDD.md`
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