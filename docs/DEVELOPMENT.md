# Development Guide

This document provides comprehensive information for developers working on Prompt Line.

## 📦 Development Setup

### Prerequisites
- macOS
- Node.js 18.0.0 or higher
- npm
- Xcode Command Line Tools (recommended)

### Setup Instructions
```bash
# Clone the repository
git clone https://github.com/nkmr-jp/prompt-line.git
cd prompt-line

# Install dependencies
npm install

# Run in development mode with detailed logging
npm run dev

# Or run in production mode
npm start
```

### Available Commands
```bash
# Development
npm start          # Run app in production mode
npm run dev        # Run app in development mode with detailed logging

# Testing
npm test                    # Run all tests
npm run test:watch         # Run tests in watch mode
npm run test:coverage      # Generate coverage report
npm run test:unit          # Run unit tests only
npm run test:integration   # Run integration tests only

# Build & Distribution
npm run build      # Build the application
npm run dist       # Create macOS distribution (DMG and ZIP files)
npm run lint       # Check code style
npm run lint:fix   # Auto-fix code style issues

# Development Tools
github             # Open repository in GitHub Desktop
```

## 🏗️ Architecture Overview

### Electron Process Architecture
The app uses Electron's two-process model with clean separation:

- **Main Process** (`src/main.ts`): Controls application lifecycle, window management, and system interactions
- **Renderer Process** (`src/renderer/`): Handles UI and user interactions
  - `renderer.ts`: Main renderer class with integrated keyboard handling
  - `ui-manager.ts`: Advanced UI management with themes, animations, and notifications
  - `input.html`: Main window template
- **IPC Bridge** (`src/handlers/ipc-handlers.ts`): All communication between processes goes through well-defined IPC channels

### Manager Pattern
Core functionality is organized into specialized managers:

- **WindowManager**: Controls window creation, positioning, and lifecycle
- **HistoryManager**: Manages paste history (max 50 items, persisted to JSON)
- **DraftManager**: Auto-saves input drafts with debouncing

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

## 📁 Project Structure

```
prompt-line/
├── src/                      # Source code
│   ├── main.ts              # Main process
│   ├── config/              # Configuration
│   │   └── app-config.ts    # App configuration
│   ├── managers/            # Core managers
│   │   ├── window-manager.ts     # Window management
│   │   ├── history-manager.ts    # History management
│   │   └── draft-manager.ts      # Draft management
│   ├── handlers/            # IPC handlers
│   │   └── ipc-handlers.ts       # IPC communication
│   ├── utils/               # Utilities
│   │   └── utils.ts             # Utility functions & logging
│   ├── types/               # TypeScript types
│   │   └── index.ts
│   └── renderer/            # Renderer process
│       ├── input.html           # Main UI template
│       ├── renderer.ts          # Renderer logic
│       └── ui-manager.ts        # UI management
├── tests/                   # Test code
│   ├── unit/               # Unit tests
│   ├── integration/        # Integration tests
│   ├── fixtures/           # Test data
│   └── setup.ts           # Test configuration
├── assets/                  # Resource files
├── docs/                    # Documentation
├── package.json
├── tsconfig.json
└── README.md
```

## 🛠️ Technical Specifications

### Core Technologies
- **Framework**: Electron 25.0.0
- **Runtime**: Node.js 22.0.0 support
- **Language**: TypeScript
- **Testing**: Jest (140 tests, 100% success rate)
- **Linting**: ESLint
- **Performance**: Debounced I/O, batch processing, parallel execution

### Platform-Specific Implementation

#### macOS Auto-Paste
The app uses AppleScript (`osascript`) to simulate Cmd+V in the previously active application. This requires:
- Accessibility permissions (prompted on first use)
- Proper window management to restore focus

#### Data Storage
All data is stored in `~/.prompt-line/`:
- `history.json`: Paste history
- `draft.json`: Auto-saved drafts
- `app.log`: Application logs

### Critical Implementation Details

#### Window Positioning
The window appears at cursor position using a workaround:
1. Create window at (0,0)
2. Show window to get accurate bounds
3. Calculate position based on cursor
4. Move window to final position

#### Draft Auto-Save
- Debounced at 500ms to prevent excessive writes
- Draft persists until explicitly cleared by successful paste (Cmd+Enter)
- Closing with Esc preserves the draft

#### History Management
- Newest items appear at top
- Duplicates are prevented
- Limited to 50 items to prevent unbounded growth
- Relative timestamps update on each render

#### Security Considerations
- No app sandboxing (required for auto-paste functionality)
- Requires explicit user permissions for accessibility
- All data stored locally, no network requests

## 🧪 Testing

### Test Infrastructure
Tests use comprehensive mocks defined in `tests/setup.ts`:
- Electron APIs (app, BrowserWindow, clipboard, etc.)
- File system operations
- Child process execution
- IPC communication

### Test Organization
- **Unit tests**: Test individual managers/utilities in isolation
- **Integration tests**: Test cross-module interactions
- **Fixtures**: Shared test data in `tests/fixtures/`

### Running Tests
```bash
# Run all tests
npm test

# Run with verbose output
npm test -- --verbose

# Run specific test file
npm test tests/unit/utils.test.ts

# Run tests matching pattern
npm test -- --testNamePattern="formatTimeAgo"

# Run with coverage
npm run test:coverage

# Watch mode for development
npm run test:watch
```

### Test Results
```
Test Suites: 6 passed, 6 total
Tests:       140 passed, 140 total
Snapshots:   0 total
Time:        < 1s
Coverage:    91%+ code coverage
```

## 🏗️ Build & Distribution

### Building for macOS

#### Prerequisites
1. **Node.js 18.0.0+** installed
2. **npm** installed
3. **Xcode Command Line Tools** (recommended)

#### Build Process
```bash
# Install dependencies
npm install

# Build macOS application
npm run build
```

#### Build Artifacts
After building, the `dist/` directory contains:

- **DMG files** (recommended):
  - `Prompt-Line-1.0.0.dmg` - Intel Mac
  - `Prompt-Line-1.0.0-arm64.dmg` - Apple Silicon Mac
  
- **ZIP files**:
  - `Prompt-Line-1.0.0-mac.zip` - Intel Mac
  - `Prompt-Line-1.0.0-arm64-mac.zip` - Apple Silicon Mac

### Code Signing (Optional)
For distribution, it's recommended to sign with Apple Developer ID.
The app will work without signing but will show warnings on first launch.

## 🔧 Development Workflow

### Adding New Features
1. Implement functionality in appropriate manager
2. Create corresponding tests
3. Update IPC handlers in `ipc-handlers.ts` if needed
4. Update renderer UI in `renderer/` if needed
5. Run tests and linting before committing

### Configuration Changes
Modify settings in `src/config/app-config.ts`:
- Window size and appearance
- Keyboard shortcuts
- File paths
- Timing settings

### Development Tools
```bash
# Development mode with debug logging
npm run dev

# Test watch mode (auto-run on file changes)
npm run test:watch

# Linting with auto-fix
npm run lint:fix
```

## 🐛 Advanced Troubleshooting

### Development Issues

#### Build Failures
1. Ensure Node.js version compatibility
2. Clear `node_modules` and reinstall: `rm -rf node_modules && npm install`
3. Check for native dependency issues

#### Test Failures
1. Run individual test files to isolate issues
2. Check mock setup in `tests/setup.ts`
3. Verify test environment configuration

#### Permission Issues During Development
1. Grant accessibility permissions to your IDE (VS Code, etc.)
2. Grant permissions to Terminal if running from command line
3. Use `npm run dev` for detailed error logging

### Debugging
```bash
# View application logs
tail -f ~/.prompt-line/app.log

# Run with development logging
npm run dev

# Debug specific functionality
npm test -- --testNamePattern="specific-feature"
```

## 🤝 Contributing

### Before Contributing
1. Ensure tests pass: `npm test`
2. Run linting: `npm run lint:fix`
3. Add appropriate tests for new features
4. Follow existing code patterns and conventions

### Coding Standards
- Follow ESLint configuration
- Write clear JSDoc comments
- Maintain test coverage above 90%
- Use meaningful commit messages
- Follow TypeScript best practices

### Pull Request Process
1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Ensure all tests pass and linting is clean
5. Submit pull request with clear description

## 🚀 Future Roadmap

### Planned Features
- [ ] Custom themes (light/dark toggle)
- [ ] Custom shortcut configuration
- [ ] History search and filtering
- [ ] Cloud sync (optional)
- [ ] Plugin system
- [ ] Multi-language support
- [ ] Windows/Linux support

### Technical Improvements
- [ ] Performance optimizations
- [ ] Better error handling
- [ ] Enhanced accessibility
- [ ] Automated testing in CI/CD
- [ ] Code signing automation

## 📚 Related Documentation

- [Main README](../README.md) - End user documentation
- [Japanese Development Guide](./DEVELOPMENT_ja.md) - 開発者向け（日本語）
- [Electron Documentation](https://www.electronjs.org/docs)
- [Jest Testing Guide](https://jestjs.io/docs/getting-started)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)