# 🧑‍💻 Prompt Line
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/nkmr-jp/prompt-line)

<!-- Keep these links. Translations will automatically update with the README. -->
English |
[日本語](README_ja.md)

## Overview

Prompt Line is a macOS app developed to improve the prompt input experience in the terminal for CLI-based AI coding agents such as [Claude Code](https://github.com/anthropics/claude-code), [Gemini CLI](https://github.com/google-gemini/gemini-cli), [OpenAI Codex CLI](https://github.com/openai/codex), and [Aider](https://github.com/paul-gauthier/aider).
It addresses UX challenges related to multi-byte character input (e.g., Japanese) by providing a dedicated floating input interface. 

This greatly reduces stress when entering text in the following cases in particular. 

1. **Prompt input for CLI-based AI coding agents in the terminal** 
2. **Chat apps where pressing Enter sends the message at an unintended time** 
3. **Text editor with slow input response (e.g., large Confluence documents)**


## Features

### Quick Launch, Quick Paste
Quick launch with shortcut (`Cmd+Shift+Space`).<br>
Type text and quick paste (`Cmd+Enter`).
![doc1.gif](assets/doc1.gif)

### Perfect for Editing Voice-Inputted Text
The operation is the same as a typical text editor. <br>
Of course, you can also use it in combination with a voice input app. <br>
Pressing Enter will not automatically send the text, so you don't have to worry about line breaks. <br>
It is also ideal for editing text entered by voice. <br>
(This video uses [superwhisper](https://superwhisper.com/).)
![doc2.gif](assets/doc2.gif)

### Search and Reuse Prompt History
Prompt history is saved and can be reused from the right menu. <br>
Search is also available. (`Cmd+f`)
![doc3.gif](assets/doc3.gif)

### Launch Anywhere
Can be launched anywhere there's a text input field. <br>
Also convenient when you want to reuse the same prompt in other apps.
![doc4.gif](assets/doc4.gif)

Of course, it also works with apps other than Terminal.
![doc5.gif](assets/doc5.gif)

### Context Search and Autocomplete

Type `/` or `@` to search and autocomplete contexts such as Agent Skills, Built-in Commands, files, and symbols.<br>
These can be customized in the settings file (`~/.prompt-line/settings.yml`). See: [settings.example.yml](settings.example.yml)
<table>
<tr>
<td>Agent Skills and Built-in Commands <img src="assets/doc9.png"> </td>
<td>File and Directory Search <img src="assets/doc10.png"> </td>
</tr>
<tr>
<td>Symbol Search<img src="assets/doc11.png"> </td>
<td>Subagents Search (~/.claude/agents)  <img src="assets/doc14.png"> </td>
</tr>
<tr>
<td>Plans Search (~/.claude/plans) <img src="assets/doc12.png"> </td>
<td>Agent Teams Search (~/.claude/teams)  <img src="assets/doc13.png"> </td>
</tr>
</table>

## 📦 Installation

### Command Installation

Install [fd](https://github.com/sharkdp/fd) and [rg (ripgrep)](https://github.com/BurntSushi/ripgrep) commands. Used for file search and symbol search features.
```bash
brew install fd ripgrep
```

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
   pnpm install
   ```

3. Build the application:
   ```bash
   pnpm run build
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
pnpm run reset-accessibility
```

## 📦 Update

If you already have an older version installed and want to update to the latest version, follow these steps.

1. Run the `pnpm run reset-accessibility` command to reset the accessibility permissions in the “Prompt Line.”
2. Refer to the “📦 Installation” section and reinstall
3. Run `pnpm run migrate-settings` to migrate your settings to the latest defaults (existing settings are automatically backed up)
4. Run `pnpm run update-built-in-commands` to update built-in commands to the latest version


## Usage

### Basic Workflow
1. Move to where you want to input
2. Press `Cmd+Shift+Space` to open Prompt Line
3. Type your text
4. Press `Cmd+Enter` to paste text
5. Continue working

### Features

- **History Panel** - Click previous entries to reuse. Search is also available. (`Cmd+f`)
- **Draft Autosave** - Automatically saves your work
- **Image Support** - Paste clipboard images with `Cmd+V`
- **File Opener** - Open files from file path text (`Ctrl+Enter` or `Cmd+Click`)
- **File Search** - Search files by typing `@`
- **Symbol Search** - Search code symbols by typing `@<lang>:<query>` (e.g., `@ts:Config`)
- **Custom Search** - Search Slash Commands and Agent Skills by typing `/`, or search sub-agents by typing `@`

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
| `builtInCommands` | Built-in slash commands to enable (claude, codex, gemini, etc.) |
| `agentSkills` | Agent skills from markdown files (custom commands, skills, plugins) |
| `mentions.customSearch` | Custom search entries triggered by @prefix: — supports Markdown (.md), JSON (.json), JSONL (.jsonl), and jq expressions |
| `mentions.fileSearch` | File search settings (@path/to/file completion) |
| `mentions.symbolSearch` | Symbol search settings (@ts:Config, @go:Handler) |

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
