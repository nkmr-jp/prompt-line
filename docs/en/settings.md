# Settings Reference

Prompt Line settings file: `~/.prompt-line/settings.yaml`

Settings are hot-reloaded (300ms debounce) — changes take effect without restarting.

## Shortcuts

Two formats supported. The app auto-detects which format is used.

### Old format (action → key)
```yaml
shortcuts:
  main: Cmd+Shift+Space
  paste: Cmd+Enter
  close: Escape
  historyNext: Ctrl+j
  historyPrev: Ctrl+k
  search: Cmd+f
```

### New format (key → action)
```yaml
shortcuts:
  Cmd+Shift+Space: main    # Show/hide the input window (global)
  Cmd+Enter: paste          # Paste text and close window
  Escape: close             # Close window without pasting
  Ctrl+j: historyNext       # Navigate to next history item
  Ctrl+k: historyPrev       # Navigate to previous history item
  Cmd+f: search             # Enable search mode in history
  # Custom actions
  Ctrl+m: "input=@md:"      # Insert @md: into input field
  Ctrl+g: "input=@ghq:"     # Insert @ghq: into input field
```

**Built-in actions:** `main`, `paste`, `close`, `historyNext`, `historyPrev`, `search`

**Custom actions:** `input=<text>` — inserts text into the input field and triggers search.

**Available modifiers:** `Cmd`, `Ctrl`, `Alt`, `Shift`

## Window

```yaml
window:
  position: active-text-field   # active-text-field | active-window-center | cursor | center
  width: 640                    # Recommended: 400-800 pixels
  height: 320                   # Recommended: 200-400 pixels
```

## Plugins

Plugins provide slash commands (`/`), custom search (`@prefix:`), and agent built-in commands.

```yaml
plugins:
  github.com/nkmr-jp/prompt-line-plugins:
    - claude/agent-built-in/en                  # Claude Code built-in commands | lang: en,ja
    - claude/agent-skills/commands              # sourcePath: ~/.claude/commands/*.md
    - claude/agent-skills/plugin-commands       # sourcePath: ~/.claude/plugins/cache/*/*/{latest}/**/commands/*.md
    - claude/agent-skills/plugin-skills         # sourcePath: ~/.claude/plugins/cache/*/*/{latest}/**/SKILL.md
    - claude/agent-skills/skills                # sourcePath: ~/.claude/skills/**/SKILL.md
    - claude/custom-search/agents@agent         # sourcePath: ~/.claude/agents/*.md
    - claude/custom-search/plans@plan           # sourcePath: ~/.claude/plans/*.md
    - claude/custom-search/plugin-agents@agent  # sourcePath: ~/.claude/plugins/cache/*/*/{latest}/**/agents/*.md
    - claude/custom-search/teams@team           # sourcePath: ~/.claude/teams/**/config.json
    - claude/custom-search/history@r            # sourcePath: ~/.claude/history.jsonl
    # - codex/agent-built-in/en                 # Codex CLI built-in commands
    # - gemini/agent-built-in/en                # Gemini CLI built-in commands
    # - path/custom-search/ghq@ghq?open=iTerm   # sourceCommand: ghq list
```

### Plugin path syntax

```
<package>/<type>/<name>[@searchPrefix][?key=value&key2=value2]
```

- `@suffix` — overrides `searchPrefix` in the plugin YAML
- `?key=val` — overrides `args` in the plugin YAML (e.g., `?open=iTerm`)

### Plugin types

| Directory | Type | Trigger |
|-----------|------|---------|
| `agent-built-in/` | Agent built-in commands | `/` |
| `agent-skills/` | Agent skills from files | `/` |
| `custom-search/` | Custom search | `@prefix:` |

### Install plugins

```bash
prompt-line-plugin install github.com/nkmr-jp/prompt-line-plugins
prompt-line-plugin install github.com/user/repo@branch   # specific branch/tag
prompt-line-plugin install ./local/path                   # local path
```

## Local YAML Directories

You can place YAML config files directly in `~/.prompt-line/` subdirectories without creating a plugin:

```
~/.prompt-line/
  agent-built-in/     # Agent built-in commands (*.yaml)
  agent-skills/       # Agent skills from files (*.yaml)
  custom-search/      # Custom search entries (*.yaml)
```

These directories are automatically created and watched for changes (hot reload). The YAML format is the same as plugin YAML files — see [plugins.md](plugins.md) for field reference and template variables.

**Example:** `~/.prompt-line/custom-search/my-notes.yaml`
```yaml
sourcePath: ~/notes/**/*.md
name: "{basename}"
description: "{heading}"
searchPrefix: note
shortcut: Ctrl+n
```

## File Search

```yaml
fileSearch:
  respectGitignore: true
  includeHidden: true
  maxFiles: 100000
  maxDepth: null
  maxSuggestions: 50
  followSymlinks: false
  includePatterns: []
  excludePatterns: []
```

## Symbol Search

```yaml
symbolSearch:
  respectGitignore: true
  maxSymbols: 200000
  timeout: 60000
  includePatterns: []
  excludePatterns: []
```

## File Opener

```yaml
fileOpener:
  defaultEditor: null             # null = system default
  extensions:
    png: "Preview"
    pdf: "Preview"
  directories:
    - path: "~/ghq/github.com/my-org/my-go*"
      editor: "GoLand"
```

Priority: `extensions` > `directories` > `defaultEditor` > system default.
