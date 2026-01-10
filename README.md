# 🧑‍💻 Prompt Line
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/nkmr-jp/prompt-line)

<!-- Keep these links. Translations will automatically update with the README. -->
English |
[日本語](README_ja.md)

## Overview

**Search Any Context, Write Better Prompts**

Prompt Line is a macOS app designed for AI coding agents like [Claude Code](https://github.com/anthropics/claude-code), [Gemini CLI](https://github.com/google-gemini/gemini-cli), [OpenAI Codex CLI](https://github.com/openai/codex), and [Aider](https://github.com/paul-gauthier/aider). It helps you find and insert context quickly so you can focus on writing effective prompts.

### Key Capabilities

**🔍 Context Search at Your Fingertips**
- **@File Search** - Find and insert file paths instantly
- **@Symbol Search** - Search code symbols (functions, classes, types) across 20+ languages
- **@Markdown Search** - Search agents, skills, and knowledge base entries
- **Slash Commands** - Quick access to AI tool commands
- **History Search** - Reuse and refine past prompts

**✍️ Focused Prompt Writing**
- Dedicated floating input interface that stays out of your way
- Quick launch (`Cmd+Shift+Space`) and paste (`Cmd+Enter`)
- Perfect for voice input editing and multi-byte character input
- Auto-save drafts so you never lose your work


## Features

### 🔍 Context Search Features

#### @File Search - Find Files Instantly
Search and insert file paths by typing `@`.<br>
Works with Terminal.app, iTerm2, Ghostty, Warp, WezTerm, JetBrains IDEs, VSCode, Cursor, Windsurf, Zed, and more.<br>
※ Requires [fd](https://github.com/sharkdp/fd) command (`brew install fd`) and settings configuration.

![doc10.png](assets/doc10.png)

#### @Symbol Search - Navigate Code Semantically
Search code symbols (functions, classes, types, etc.) by typing `@<language>:<query>`.<br>
Supports 20+ languages including TypeScript, Go, Python, Rust, Java, and more.<br>
※ Requires [ripgrep](https://github.com/BurntSushi/ripgrep) (`brew install ripgrep`) and File Search enabled.

**Examples:**
- `@ts:Config` - Search TypeScript symbols containing "Config"
- `@go:Handler` - Search Go symbols containing "Handler"
- `@py:parse` - Search Python symbols containing "parse"

![doc13.png](assets/doc13.png)

#### @Markdown Search - Access Your Knowledge Base
Search agents, skills, and documentation by typing `@<searchPrefix>:<query>`.<br>
Customize search prefixes in settings to build your own knowledge base.

![doc12.png](assets/doc12.png)

#### Slash Commands - Quick Command Access
Search slash commands by typing `/`.<br>
Built-in commands for Claude Code, OpenAI Codex, and Google Gemini.<br>
Custom commands can be added via `~/.prompt-line/settings.yml`.

![doc11.png](assets/doc11.png)

#### History Search - Reuse Past Prompts
All prompts are saved and searchable (`Cmd+f`).<br>
Click any entry to reuse it instantly.

![doc3.gif](assets/doc3.gif)

### ✍️ Focused Writing Experience

#### Quick Launch, Quick Paste
Launch anywhere with `Cmd+Shift+Space`.<br>
Type and paste with `Cmd+Enter`.<br>
Works across all applications, not just terminals.

![doc1.gif](assets/doc1.gif)

#### Perfect for Voice Input
Same operation as a typical text editor.<br>
Enter key creates new lines instead of sending text.<br>
Ideal for editing voice-inputted text.<br>
(This video uses [superwhisper](https://superwhisper.com/).)

![doc2.gif](assets/doc2.gif)

#### File Opener
Open files directly from file paths or @mentions.<br>
Use `Ctrl+Enter` or `Cmd+Click` to view file contents.

![doc9.png](assets/doc9.png)

#### Launch Anywhere
Can be launched wherever there's a text input field.<br>
Convenient for reusing prompts across different applications.

![doc4.gif](assets/doc4.gif)
![doc5.gif](assets/doc5.gif)

## 📦 Installation

### System Requirements

- macOS 10.14 or later
- Node.js 20 or later
- Xcode Command Line Tools or Xcode (for compiling native tools)

### Build from Source

1. Clone the repository:
   ```bash
   git clone https://github.com/nkmr-jp/prompt-line.git
   cd prompt-line
   ```

   To build a specific version:
   ```bash
   git clone https://github.com/nkmr-jp/prompt-line.git
   cd prompt-line
   git checkout v0.x.x  # Replace with desired version tag
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the application:
   ```bash
   npm run build
   ```

4. The built app will be created in the `dist/` directory
5. Open the dmg file:
   ```bash
   open dist/Prompt-Line-0.x.x-arm64.dmg # Apple Silicon
   open dist/Prompt-Line-0.x.x-x64.dmg # Intel
   ```
6. Drag Prompt Line.app to Applications folder
7. Launch Prompt Line. An icon will appear in the system tray.
<div><img src="assets/doc6.png" width="200"></div>

8. You can start using it with `Cmd+Shift+Space`.

### Accessibility Permissions

Prompt Line requires accessibility permissions to paste text into other applications.
A dialog box will appear on first use, so follow the instructions to set it up.

<div><img src="assets/doc7.png" width="200"></div>


### Troubleshooting

#### If the accessibility permissions dialog box does not appear

1. Open **System Settings** → **Privacy and Security** → **Accessibility**.
2. Find “Prompt Line” in the list and enable it.
3. If it is not in the list, add Prompt Line from Applications using the “+” button.

#### If “Prompt Line” is enabled in Accessibility Permissions but you still cannot paste

1. Open **System Settings** → **Privacy and Security** → **Accessibility**
2. Delete “Prompt Line” from Applications using the “-” button to reset permissions
3. The issue should be resolved after reconfiguring settings.

Accessibility permissions can also be reset using the following command:
```bash
npm run reset-accessibility
```

## 📦 Update

If you already have an older version installed and want to update to the latest version, follow these steps.

1. Run the `npm run reset-accessibility` command to reset the accessibility permissions in the “Prompt Line.”
2. Refer to the “📦 Installation” section and reinstall


## Usage

### Basic Workflow
1. Move to where you want to input
2. Press `Cmd+Shift+Space` to open Prompt Line
3. Use context search features (@files, @symbols, /commands, history)
4. Type your prompt
5. Press `Cmd+Enter` to paste
6. Continue working

### Quick Reference

- **History Panel** - `Cmd+f` to search, click to reuse
- **Draft Autosave** - Automatically saves your work
- **Image Support** - Paste clipboard images with `Cmd+V`
- **File Opener** - `Ctrl+Enter` or `Cmd+Click` to open files
- **Context Search**
  - `@` - File search
  - `@<lang>:` - Symbol search (e.g., `@ts:Config`)
  - `@<prefix>:` - Markdown search (e.g., `@agent:claude`)
  - `/` - Slash commands


## ⚙️ Settings

You can customize Prompt Line's behavior by creating a settings file at `~/.prompt-line/settings.yml`.

For the full configuration example with all available options and comments, see:
**[settings.example.yml](settings.example.yml)**

### Quick Overview

| Section | Description |
|---------|-------------|
| `shortcuts` | Keyboard shortcuts (main, paste, close, history navigation, search) |
| `window` | Window size and positioning mode |
| `fileOpener` | Default editor and extension-specific applications |
| `slashCommands` | Built-in AI tool commands, custom slash commands, and skill search |
| `mentions.fileSearch` | File search settings (@path/to/file completion) |
| `mentions.symbolSearch` | Symbol search settings (@ts:Config, @go:Handler) |
| `mentions.mdSearch` | Markdown-based mentions with searchPrefix support (agent, rules, docs, etc.) and frontmatter template variables |

## Prompt History

- All data stored locally on your Mac
- No internet connection required
- Prompt history saved in `~/.prompt-line/history.jsonl`
- Saved in JSON Lines format, so you can analyze it using [DuckDB](https://duckdb.org/)

![doc8.png](assets/doc8.png)

## Contributing

See [Contribution Guide](CONTRIBUTING.md) for details.

## License

MIT License - see [LICENSE](./LICENSE) for details.
