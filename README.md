# 🧑‍💻 Prompt Line
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/nkmr-jp/prompt-line)

<!-- Keep these links. Translations will automatically update with the README. -->
English |
[日本語](README_ja.md)

## Overview

Prompt Line is a macOS app developed to make prompt input more comfortable for CLI-based AI coding agents such as [Claude Code](https://github.com/anthropics/claude-code), [Codex CLI](https://github.com/openai/codex), and [Gemini CLI](https://github.com/google-gemini/gemini-cli).
It provides features focused on improving the prompt input UX, including editing in a floating window, context search with `/` and `@`, and prompt history reuse. Extensible via [YAML plugins](docs/en/plugins.md).

Key capabilities:

1. **Quick input, quick paste** — Floating window with `Cmd+Shift+Space`, paste anywhere with `Cmd+Enter`
2. **Context search** — Search agent skills, files, symbols, and more with `/` and `@`, with prompt history reuse
3. **Extensible via plugins** — Add custom search and skills with simple YAML files ([Plugin Guide](docs/en/plugins.md))


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

Type `/` or `@` to search and autocomplete contexts such as agent skills, built-in commands, files, and symbols.<br>
These can be extended with plugins. See: [Plugin Guide](docs/en/plugins.md) | [prompt-line-plugins](https://github.com/nkmr-jp/prompt-line-plugins)
<table>
<tr>
<td>Agent Skills and Built-in Commands <img src="assets/doc9.png"> </td>
<td>File and Directory Search <img src="assets/doc10.png"> </td>
</tr>
<tr>
<td>Symbol Search<img src="assets/doc11.png"> </td>
<td>Custom Search (@agent:, @plan:, etc.) <img src="assets/doc14.png"> </td>
</tr>
<tr>
<td>Custom Search (@plan:) <img src="assets/doc12.png"> </td>
<td>Custom Search (@team:)  <img src="assets/doc13.png"> </td>
</tr>
</table>

## 📦 Installation

### System Requirements

- macOS 10.14 or later
- Node.js 20 or later
- [pnpm](https://pnpm.io/installation)
- Xcode Command Line Tools or Xcode (for compiling native tools)
- [fd](https://github.com/sharkdp/fd) and [rg (ripgrep)](https://github.com/BurntSushi/ripgrep) (for file search and symbol search features)

### Prompt Line Installation

```bash
git clone https://github.com/nkmr-jp/prompt-line.git
cd prompt-line
git checkout v0.x.x  # Optional: replace with desired version tag
pnpm install
pnpm run install-app    # Build and install to /Applications (includes code signing setup)
```

Launch Prompt Line. An icon will appear in the system tray.

<div><img src="assets/doc6.png" width="200"></div>

You can start using it with `Cmd+Shift+Space`.

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

If you already have an older version installed and want to update to the latest version:

```bash
git pull
pnpm install
pnpm run install-app
pnpm run migrate-settings        # Migrate settings to latest defaults (auto-backup)
```

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
- **Custom Search** - Search agents, plans, teams, history, etc. by typing `@prefix:` (extensible with [plugins](docs/en/plugins.md))

## ⚙️ Settings

Settings file: `~/.prompt-line/settings.yaml` (hot-reloaded, no restart needed)

See: [Settings Reference](docs/en/settings.md) | [settings.example.yaml](settings.example.yaml) | [Migration Guide](docs/en/migration.md)

## 🔌 Plugins

Plugins are YAML files that add agent skills (`/`), custom search (`@prefix:`), and built-in commands/skills/agents for CLI tools.

**Quickest way:** Place a YAML file in `~/.prompt-line/agent-skills/`, `~/.prompt-line/custom-search/`, or `~/.prompt-line/agent-built-in/` — no GitHub repo needed.

**Share via GitHub:** Install plugins from repositories:

```bash
# Global CLI setup (run once in the prompt-line project directory)
pnpm link

# Install plugins
prompt-line-plugin install github.com/nkmr-jp/prompt-line-plugins
prompt-line-plugin install github.com/user/repo@branch   # specific version
```

**Details:** [docs/en/plugins.md](docs/en/plugins.md)<br>
**Example repo:** [prompt-line-plugins](https://github.com/nkmr-jp/prompt-line-plugins)

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
