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

## 📦 Installation

### Development Setup
1. Clone the repository:
   ```bash
   git clone https://github.com/nkmr-jp/prompt-line.git
   cd prompt-line
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the application:
   ```bash
   npm run build
   ```

4. The built application will be available in `dist/app/`:
   - `dist/app/mac-arm64/Prompt Line.app` for Apple Silicon Macs (M1/M2/M3)
   - `dist/app/mac-x64/Prompt Line.app` for Intel Macs

5. **Grant accessibility permissions** when prompted on first use (required for pasting)

6. Launch the app and press `Cmd+Shift+Space` to start using

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
  position: "cursor"         # Window position: "cursor" (default), "active-window-center", or "center"
  width: 600                 # Window width in pixels
  height: 300                # Window height in pixels

```

**Configuration Options:**

- **Shortcuts**: Format: `Cmd`, `Ctrl`, `Alt`, `Shift` + any key
- **Window Position**: `cursor` (default), `active-window-center`, or `center`


## System Requirements

### For Development
- macOS 10.14 or later
- Node.js 16.x or later
- npm 8.x or later
- 500MB available disk space (for development dependencies)

### For Users
- macOS 10.14 or later
- 100MB available disk space


## Privacy

- All data stored locally on your Mac
- No internet connection required
- Text history saved in `~/.prompt-line/`

## 📄 License

MIT License - see [LICENSE](./LICENSE) for details.