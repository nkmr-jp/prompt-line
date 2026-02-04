# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

### Development
```bash
npm start          # Run app in development mode (with DEBUG logging enabled)
npm run update-built-in-commands # Update slash commands with confirmation
npm run reset-built-in-commands  # Reset slash commands to defaults (removes all)
npm run reset-accessibility      # Reset accessibility permissions for Prompt Line
```

**Development vs Production Modes:**
- **Development Mode** (`npm start`):
  - Sets `LOG_LEVEL=debug` environment variable
  - Enables DEBUG level logging
  - Shows detailed debug information in console and log files
  - Only active when running `npm start` with `LOG_LEVEL=debug`

- **Production Mode** (packaged app):
  - Packaged apps (.dmg, .app) always use INFO level logging (DEBUG logs disabled)
  - Cannot be overridden by environment variables in packaged builds
  - Provides cleaner logs for end users

### Viewing Logs
Application logs are stored in `~/.prompt-line/app.log`.

```bash
# View recent logs (last 50 lines)
tail -50 ~/.prompt-line/app.log

# Monitor logs in real-time
tail -f ~/.prompt-line/app.log

# Search for errors
grep -i error ~/.prompt-line/app.log | tail -20

# Search for specific patterns
grep "Paste text" ~/.prompt-line/app.log | tail -10
```

**Note:** When running `npm start` in JetBrains IDE, the console output shows Electron startup messages. For detailed application logs (DEBUG/INFO level), always check the log file directly.

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
npm run clean      # Removes build artifacts (DMG, zip files, etc.)
npm run clean:cache     # Clears build caches (node_modules/.cache, electron caches)
npm run clean:full      # Full cleanup (build artifacts + caches + dist directory)
npm run release    # Info about automated release process (via GitHub Actions)
npm run prepare    # Husky setup
```

**Build Process Details:**
The `npm run compile` command performs:
1. TypeScript compilation (`tsc`)
2. Renderer build (`npm run build:renderer`)
3. Native tools compilation (`cd native && make install`)
4. Copy compiled tools to distribution directory

**Release Process:**
This project uses [Release Please](https://github.com/googleapis/release-please) (Google's official release automation tool) for automated releases:
- Release PRs are created automatically on push to `main` branch via GitHub Actions
- Version numbers follow [Semantic Versioning](https://semver.org/) based on [Conventional Commits](https://www.conventionalcommits.org/)
- Configuration: `release-please-config.json` and `.release-please-manifest.json` in project root
- Workflow: `.github/workflows/release-please.yml`
- The release process automatically:
  1. **Creates Release PR**: Analyzes commits and creates a PR with version bump and CHANGELOG updates
  2. **Manual Review**: Team reviews the PR before merging (optional but recommended)
  3. **On PR Merge**: Automatically creates GitHub release and runs tests
  4. **Updates Files**:
     - `package.json` and `package-lock.json` versions
     - `CHANGELOG.md` with categorized changes
     - Creates git tags and GitHub releases

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

### Pull Request Guidelines
When creating pull requests:

- **Target Branch**: Always create PRs against the `develop` branch (not `main`)
- **Language**: Write all PR titles and descriptions in English

## Architecture Overview

### Electron Process Architecture
The app uses Electron's two-process model with clean separation:

- **Main Process** (`src/main.ts`): Controls application lifecycle, window management, and system interactions
- **Renderer Process** (`src/renderer/`): Handles UI and user interactions
  - `renderer.ts`: Main renderer class with integrated keyboard handling and manager pattern
  - `ui-manager.ts`: Advanced UI management with themes, animations, and notifications
  - `input.html`: Main window template
  - 15+ specialized managers: DOM, events, search, lifecycle, shortcuts, animation, mentions, slash-commands, history-ui, and more
  - Comprehensive CSS architecture with themes and modular stylesheets
  - TypeScript configuration and utility functions
  - `interfaces/`: Shared TypeScript type definitions
  - `services/`: Service layer components
  - `lib/`: Shared library code
- **Preload Script** (`src/preload/preload.ts`): Secure context bridge with whitelisted IPC channels
- **IPC Handlers** (`src/handlers/`): Modular handler architecture with 8 specialized components:
  - `ipc-handlers.ts`: Main coordinator that delegates to specialized handlers
  - `paste-handler.ts`: Text and image paste operations with security validation
  - `history-draft-handler.ts`: History CRUD and draft management operations
  - `window-handler.ts`: Window visibility and focus control
  - `system-handler.ts`: App info, config, and settings retrieval
  - `mdsearch-handler.ts`: Slash commands and agent selection
  - `file-handler.ts`: File operations and external URL handling
  - `handler-utils.ts`: Shared validation and utility functions

### Manager Pattern
Core functionality is organized into specialized managers:

**Main Process Managers:**
- **WindowManager** (`src/managers/window/`): Modular architecture with 6 specialized components:
  - `window-manager.ts`: Main coordinator for window creation and lifecycle
  - `directory-detector.ts`: Directory detection and file search orchestration
  - `position-calculator.ts`: Window positioning algorithms (4 modes)
  - `native-tool-executor.ts`: Native macOS tool execution with timeout
  - `types.ts`: Type definitions for window module
  - `index.ts`: Public API exports
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
- **FileCacheManager**: File caching with invalidation for performance optimization
- **MdSearchLoader**: Markdown file search and loading functionality
- **DirectoryManager**: Directory operations and management
- **FileOpenerManager**: File opening with custom editor support
- **SymbolCacheManager**: Language-separated symbol search caching with TTL
- **AtPathCacheManager**: @path pattern caching for file highlighting
- **symbol-search/**: Native symbol search integration with ripgrep (20+ languages)

**Renderer Process Managers:**
- **DomManager**: DOM element management and manipulation
- **EventHandler**: Centralized event processing
- **SearchManager**: Search functionality implementation
- **SlashCommandManager**: Slash command processing and execution
- **MentionSystem** (`src/renderer/mentions/`): Modular @ mention architecture with 15+ specialized managers:
  - `mention-initializer.ts`: System initialization and lifecycle management
  - `mention-state.ts`: Centralized state management for mention system
  - `suggestion-ui-manager.ts`: UI rendering and interaction for suggestions
  - `popup-manager.ts`: Popup positioning and lifecycle control
  - `file-filter-manager.ts`: File filtering and scoring algorithms
  - `directory-cache-manager.ts`: Directory data caching with two-stage loading
  - `navigation-manager.ts`: Keyboard navigation and selection handling
  - `path-manager.ts`: Path detection, insertion, and tracking
  - `base-cache-manager.ts`: Base cache functionality for directory and code search
  - `highlight-manager.ts`: @path highlighting and visual tracking
  - `file-opener-event-handler.ts`: File opening via Cmd+click
  - `code-search-manager.ts`: Symbol search integration with ripgrep
  - `event-listener-manager.ts`: Event lifecycle management
  - `query-extraction-manager.ts`: Query parsing and extraction
  - `settings-cache-manager.ts`: Settings caching and updates
  - Supports file search (`@`), code search (`@lang:query`), and directory navigation (`@dir/`)
- **HistoryUIManager**: History display and interaction management
- **SnapshotManager**: Undo/redo functionality with text and cursor state tracking
- **HistorySearchManager** (`src/renderer/history-search/`): Score-based history search with fuzzy matching

### Data Flow
```
User Input → Renderer → IPC Event → IPCHandlers (coordinator) → Specialized Handler → Manager → Data/System
                ↑                                                                            ↓
                └─────────────────────────── IPC Response ───────────────────────────────────┘
```

**Handler Coordination Flow:**
```
Renderer Process
    ↓
IPC invoke request
    ↓
IPCHandlers (coordinator)
    ↓
Specialized Handler (paste, history-draft, window, system, mdsearch, file, code-search)
    ↓
Manager (WindowManager, HistoryManager, SymbolCacheManager, etc.)
    ↓
System/Data
    ↓
IPC response → Renderer Process
```

### Key IPC Channels (by Handler Module)

**Paste Handler (paste-handler.ts):**
- `paste-text`: Main action - pastes text to previous application with security validation
- `paste-image`: Clipboard image handling with path traversal prevention

**History & Draft Handler (history-draft-handler.ts):**
- `get-history`, `clear-history`, `remove-history-item`, `search-history`: History operations
- `save-draft`, `clear-draft`, `get-draft`: Draft management
- `set-draft-directory`, `get-draft-directory`: Directory tracking

**Window Handler (window-handler.ts):**
- `hide-window`, `show-window`, `focus-window`: Window visibility control

**System Handler (system-handler.ts):**
- `get-app-info`: Application metadata
- `get-config`: Configuration access with whitelist validation
- `open-settings`: Settings file management

**MdSearch Handler (mdsearch-handler.ts):**
- `get-slash-commands`, `get-slash-command-file-path`: Slash command support
- `get-agents`, `get-agent-file-path`: Agent selection and management
- `get-md-search-max-suggestions`, `get-md-search-prefixes`: Search configuration

**File Handler (file-handler.ts):**
- `check-file-exists`, `open-file-in-editor`: File operations
- `open-external-url`: URL handling with protocol validation

**Code Search Handler (code-search-handler.ts):**
- `check-rg`: Check ripgrep availability
- `get-supported-languages`: List of 20+ supported programming languages
- `search-symbols`: Symbol search with caching strategy
- `get-cached-symbols`: Retrieve cached symbols
- `clear-symbol-cache`: Clear symbol cache

**Events (Renderer → Main):**
- `window-shown`: Window display with data context
- `directory-data-updated`: Directory change notifications

Total: 30+ IPC channels across 7 specialized handlers

### Built-in Commands Hot Reload

Built-in command YAMLファイルの変更は自動的に検知され、リアルタイムで反映されます:

**仕組み:**
- ファイル監視: `~/.prompt-line/built-in-commands/`
- デバウンス: 300ms
- アプリ再起動不要

**実装パターン:**
- SettingsManagerと同じchokidar + EventEmitterパターン
- YAMLファイル(.yaml, .yml)のみを監視
- ファイル変更時にキャッシュクリアと'commands-changed'イベント発火

**関連ファイル:**
- `src/managers/built-in-commands-manager.ts` - ファイルウォッチング実装
- `src/handlers/mdsearch-handler.ts` - イベントリスナー

## Platform-Specific Implementation

### macOS Auto-Paste
The app uses compiled Swift native tools to simulate Cmd+V in the previously active application. This requires:
- Accessibility permissions (prompted on first use)
- Proper window management to restore focus

**Native Swift Tools Integration (6 tools):**
- **Window Detector**: Compiled Swift binary for reliable window bounds and app detection
- **Keyboard Simulator**: Native Cmd+V simulation and app activation with bundle ID support
- **Text Field Detector**: Focused text field detection for precise positioning using Accessibility APIs
- **Directory Detector**: Fast CWD (current working directory) detection using libproc for 10-50x faster performance
- **File Searcher**: Fast file listing using `fd` command with .gitignore support
- **Symbol Searcher**: Code symbol search using `ripgrep` supporting 20+ programming languages
- **JSON Communication**: Structured data exchange prevents parsing vulnerabilities
- **Error Recovery**: Graceful fallback from text field → window center → cursor → center positioning
- **Timeout Protection**: 3-5 second timeouts prevent hanging on unresponsive operations
- **Security**: Compiled binaries eliminate script injection vulnerabilities

### Data Storage
All data is stored in `~/.prompt-line/`:
- `history.jsonl`: Paste history (JSONL format for efficient append operations)
- `draft.json`: Auto-saved drafts (created on-demand when drafts are saved)
- `settings.yml`: User preferences including window positioning mode
- `directory.json`: Current working directory tracking for file search
- `app.log`: Application logs with debug information
- `images/`: Directory for image storage
- `cache/`: Directory for file caching and metadata
  - `<encoded-path>/symbol-metadata.json`: Symbol cache metadata with TTL
  - `<encoded-path>/symbols-{lang}.jsonl`: Language-specific symbol cache
  - `<encoded-path>/registered-at-paths.jsonl`: Project @path patterns
  - `global-at-paths.jsonl`: Global @path patterns for mdSearch agents

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

### @ Mention System (File & Code Search)
- **@ mention syntax**: Type `@` to trigger file search, `@lang:query` for code search
- **Modular architecture**: 15+ specialized managers for mentions functionality
- **File search**: Directory navigation with fuzzy matching and score-based ranking
- **Code search**: Symbol search with ripgrep integration for 20+ languages
- **Hybrid loading strategy**: Stage 1 (quick single-level) + Stage 2 (recursive fd command)
- **@path highlighting**: Visual highlighting in textarea with Cmd+click to open files
- **Undo/redo support**: Full undo/redo integration for file path insertion
- **Disabled by default**: Enable via settings for stability
- **Security**: Disabled in root and system directories (/, /System, /Library, etc.)
- **fd command integration**: Uses `fd` for fast recursive file discovery
- **Supported applications** (directory-detector):
  - Terminal.app (`com.apple.Terminal`)
  - iTerm2 (`com.googlecode.iterm2`)
  - Ghostty (`com.mitchellh.ghostty`)
  - Warp (`dev.warp.Warp-Stable`)
  - WezTerm (`com.github.wez.wezterm`)
  - JetBrains IDEs (`com.jetbrains.*` - IntelliJ IDEA, WebStorm, PyCharm, etc.)
  - VSCode (`com.microsoft.VSCode`, VSCode Insiders, VSCodium)
  - Cursor (`com.todesktop.230313mzl4w4u92`)
  - Windsurf (`com.exafunction.windsurf`)
  - Zed (`dev.zed.Zed`)
  - OpenCode (`ai.opencode.desktop`)
  - Antigravity (`com.google.antigravity`) - tmux-based terminal
  - Kiro (`dev.kiro.desktop`)

### Code Search (Symbol Search)
- **Syntax**: Type `@<language>:<query>` to search for symbols (e.g., `@ts:Config`, `@go:Handler`)
- **Part of @ mention system**: Integrated with file search in `src/renderer/mentions/`
- **ripgrep-based**: Uses `rg` (ripgrep) for fast symbol searching via `code-search-manager.ts`
- **Native Swift tool**: `symbol-searcher` binary in `native/symbol-searcher/`
- **Symbol caching**: Results cached per directory and language for faster subsequent searches
- **Supported languages (20)**:
  | Language | Key | Example | Symbol Types |
  |----------|-----|---------|--------------|
  | Go | `go` | `@go:Handler` | function, method, struct, interface, type, constant, variable |
  | TypeScript | `ts` | `@ts:Config` | function, class, interface, type, enum, constant, namespace |
  | TypeScript React | `tsx` | `@tsx:Component` | function, class, interface, type, enum, constant |
  | JavaScript | `js` | `@js:init` | function, class, constant, variable |
  | JavaScript React | `jsx` | `@jsx:Button` | function, class, constant, variable |
  | Python | `py` | `@py:parse` | function, class, constant |
  | Rust | `rs` | `@rs:handle` | function, struct, enum, trait, type, constant, variable, module |
  | Java | `java` | `@java:Service` | class, interface, enum, method |
  | Kotlin | `kt` | `@kt:create` | function, class, interface, enum, typealias, constant |
  | Swift | `swift` | `@swift:detect` | function, class, struct, protocol, enum, typealias |
  | Ruby | `rb` | `@rb:initialize` | function, class, module, constant |
  | C++ | `cpp` | `@cpp:Node` | class, struct, enum, namespace, typedef |
  | C | `c` | `@c:parse` | struct, enum, typedef |
  | Shell | `sh` | `@sh:build` | function, variable |
  | Makefile | `make`, `mk` | `@make:install`, `@mk:install` | function (targets), variable |
  | PHP | `php` | `@php:render` | function, class, interface, trait, constant, enum |
  | C# | `cs` | `@cs:Handle` | class, interface, struct, enum, method, namespace |
  | Scala | `scala` | `@scala:process` | function, class, trait, object, type, constant, variable |
  | Terraform | `tf`, `terraform` | `@tf:instance`, `@terraform:vpc` | resource, data, variable, output, module, provider |
  | Markdown | `md`, `markdown` | `@md:Installation`, `@markdown:Usage` | heading |
- **Requirements**: ripgrep (`rg`) must be installed (`brew install ripgrep`)
- **File search must be enabled**: Code search is part of the @ mention system

### Slash Commands & Agents
- **Slash command system**: Type `/` to access commands
- **Custom commands**: User-defined commands from markdown files
- **Agent selection**: Choose from available agents
- **File path integration**: Commands can reference file paths

### Desktop Space Management
- **Ultra-fast detection**: <5ms performance target for space changes
- **Space signatures**: Hash-based identification for efficient comparison
- **Window recreation**: Automatic window recreation when desktop space changes
- **Cache optimization**: 2-second TTL cache prevents expensive repeated operations
- **Accessibility integration**: Seamless integration with macOS accessibility APIs

### Security Considerations
- **Native tools security**: Compiled Swift binaries eliminate script injection vulnerabilities
- **Input sanitization**: AppleScript sanitization with 64KB limits and character escaping, input size limits (1MB)
- **Path validation**: Comprehensive path normalization prevents directory traversal in all handlers
- **Image file security**: Path traversal prevention with restrictive file permissions (0o700/0o600)
- **History ID validation**: Strict format validation (lowercase alphanumeric, max 32 chars)
- **URL protocol whitelist**: Only `http:` and `https:` protocols allowed for external URLs
- **Config section whitelist**: Configuration access limited to predefined sections
- **File search restrictions**: Disabled in root and system directories for security
- **Preload script security**: Context bridge with whitelisted IPC channels only
- **Prototype pollution prevention**: Input validation against prototype attacks
- **No app sandboxing** (required for auto-paste functionality)
- **Explicit permissions**: Requires user accessibility permissions with guided setup
- **Local data only**: All data stored locally, no network requests
- **JSON communication**: Structured data exchange prevents parsing attacks
- **XSS prevention**: Safe SVG injection using DOMParser in mentions module

## Common Build Issues and Troubleshooting

### Build Failures

#### electron-builder ENOENT Error
If you encounter an error like `ENOENT: no such file or directory, rename '...Electron' -> '...Prompt Line'`:

**Root Cause:** Corrupted electron-builder cache or incomplete Electron binary download.

**Solution:**
```bash
# Full cleanup and rebuild
npm run clean:full
npm install
npm run build
```

**Quick Fix (cache only):**
```bash
npm run clean:cache
npm run build
```

#### TypeScript Compilation Errors
If `tsc` command is not found or TypeScript compilation fails:

**Solution:**
```bash
# Reinstall dependencies
npm install
npm run build
```

#### Native Tools Compilation Errors
If Swift compilation fails for native tools:

**Common Issues:**
- Xcode Command Line Tools not installed
- Incompatible macOS SDK version

**Solution:**
```bash
# Install Xcode Command Line Tools
xcode-select --install

# Verify installation
xcode-select -p
```

### Performance Issues

#### Slow Build Times
- Use `npm run compile` instead of full `npm run build` for faster development iterations
- Native tools are cached after first compilation
- Consider using SSD for faster I/O operations

#### Large Distribution Size
- DMG files are ~100-110MB per architecture (expected size)
- App bundle contains full Electron framework
- Use `npm run clean` to remove old build artifacts

### Cleanup Commands Reference

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `npm run clean` | Remove build artifacts only | After each build to clean up DMG/zip files |
| `npm run clean:cache` | Clear build caches | When experiencing cache-related build issues |
| `npm run clean:full` | Complete cleanup | Before fresh build or when troubleshooting build errors |

### Build Process Verification

To verify a successful build:
```bash
# Check generated files
ls -lh dist/*.dmg

# Verify app bundles exist
ls -la dist/mac*/Prompt\ Line.app

# Check native tools
ls -la dist/mac*/Prompt\ Line.app/Contents/Resources/app.asar.unpacked/dist/native-tools/
```
