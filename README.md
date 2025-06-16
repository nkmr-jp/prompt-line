[English](README.md) | [日本語](README_ja.md)

# Prompt Line

A floating text input for macOS that enables quick text entry across any application.

## Overview

Prompt Line was primarily designed to improve the terminal prompt input experience for CLI-based AI coding agents like [Claude Code](https://github.com/anthropics/claude-code), [OpenAI Codex CLI](https://github.com/openai/codex), and [aider](https://github.com/paul-gauthier/aider). Terminal input for multi-byte characters (Japanese, Chinese, etc.) often has poor UX, which this app solves with a dedicated floating input interface.

While it works across any macOS application, the main focus is enhancing terminal-based AI coding experience.

## How It Works

1. Press `Cmd+Shift+Space` → Input window appears
2. Type your text → Supports multi-line input with auto-save  
3. Press `Cmd+Enter` → Text pastes into the active application
4. Window disappears automatically

## 📦 Setup & Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/nkmr-jp/prompt-line.git
   cd prompt-line
   ```

   To build a specific version:
   ```bash
   git clone https://github.com/nkmr-jp/prompt-line.git
   cd prompt-line
   git checkout v0.2.1  # Replace with desired version tag
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the application:
   ```bash
   npm run build
   ```

4. The built app will be available in the `dist/` directory
5. Open a dmg file
   ```bash
   open dist/Prompt-Line-0.2.1-arm64.dmg # Apple Silicon
   open dist/Prompt-Line-0.2.1-x64.dmg # Intel
   ```
6. Drag Prompt Line.app to your Applications folder
7. **Grant accessibility permissions** when prompted on first use (required for pasting)
8. Launch the app
9. Done! Press `Cmd+Shift+Space` to start using

### Accessibility Permissions

Prompt Line requires accessibility permissions to paste text into other applications:

1. When you first run the app, macOS will show a permission dialog
2. Click "Open System Settings" (macOS 13+) or "Open System Preferences" (macOS 12-)
3. Toggle ON the switch next to "Prompt Line"
4. Restart the app if needed

**Manual setup:**
1. Open **System Settings** → **Privacy & Security** → **Accessibility**
2. Find "Prompt Line" in the list and enable it
3. If not listed, click "+" and add Prompt Line from Applications


## Usage

### Basic Workflow
1. Position yourself where you want to type
2. Press `Cmd+Shift+Space` to open Prompt Line
3. Type your text (supports multiple lines)
4. Press `Cmd+Enter` to paste text
5. Continue working

### Features

- **Unlimited History** - Store unlimited paste history with optimized performance
- **History Panel** - Click previous entries to reuse
- **Draft Autosave** - Automatically saves your work
- **Search** - Find previously typed text
- **Image Support** - Paste clipboard images with `Cmd+V`

### Keyboard Shortcuts

| Key | Action              |
|-----|---------------------|
| `Cmd+Shift+Space` | Open Prompt Line    |
| `Cmd+Enter` | Paste & close       |
| `Esc` | Close (saves draft) |

## ⚙️ Configuration

Create a settings file at `~/.prompt-line/settings.yaml`:

```yaml
shortcuts:
  main: "Cmd+Shift+Space"    # Global shortcut to open Prompt Line
  paste: "Cmd+Enter"         # Paste text and close window
  close: "Escape"            # Close window (saves draft)

window:
  width: 600                 # Window width in pixels
  height: 300                # Window height in pixels

```

**Configuration Options:**

- **Shortcuts**: Format: `Cmd`, `Ctrl`, `Alt`, `Shift` + any key

## Development

### Build Requirements

- **macOS** (required for native tools compilation)
- **Node.js 20+**
- **Xcode Command Line Tools** or **Xcode**
  ```bash
  xcode-select --install  # Install command line tools
  ```

### Commands
```bash
npm run dev          # Development mode with hot reload
npm test             # Run tests
npm run lint         # Code linting
npm run typecheck    # TypeScript type checking
npm run build        # Build macOS application (both architectures)
npm run build:x64    # Build for Intel Macs
npm run build:arm64  # Build for Apple Silicon Macs
```

### Architecture
Built with Electron + TypeScript using a Manager Pattern:

- **WindowManager** - Window lifecycle and positioning
- **HistoryManager** - JSONL-based persistent storage with deduplication  
- **DraftManager** - Debounced auto-save with backup system
- **SettingsManager** - User preferences and configuration
- **IPCHandlers** - Main/renderer process communication

## System Requirements

### For Users
- macOS 10.14 or later
- 100MB available disk space

### For Development
- macOS 10.14 or later
- Node.js 20+
- Xcode Command Line Tools or Xcode (for native tools compilation)

## Privacy

- All data stored locally on your Mac
- No internet connection required
- Text history saved in `~/.prompt-line/`

## 📄 License

MIT License - see [LICENSE](./LICENSE) for details.