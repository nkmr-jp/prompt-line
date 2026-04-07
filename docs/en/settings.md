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
| `agent-skills/` | Slash commands from files | `/` |
| `custom-search/` | Custom search | `@prefix:` |

### Install plugins

```bash
prompt-line-plugin install github.com/nkmr-jp/prompt-line-plugins
prompt-line-plugin install github.com/user/repo@branch   # specific branch/tag
prompt-line-plugin install ./local/path                   # local path
```

## Custom Search (inline)

Define custom search entries directly in settings (alternative to plugins):

```yaml
customSearch:
  # File-based source
  - name: "{line}"
    icon: folder
    color: lime
    description: ""
    sourcePath: "~/.prompt-line/z.txt"
    searchPrefix: z
    shortcut: Ctrl+]
    inputFormat: "{line}"
    maxSuggestions: 100

  # Command-based source
  - name: "{line}"
    icon: repo
    color: rose
    description: ""
    searchPrefix: ghq
    sourceCommand: "ghq list"
    shortcut: Ctrl+g
    runCommand: "open -a iTerm ~/ghq/{line}"
    sourcePath: ""
    inputFormat: "~/ghq/{line}"
    maxSuggestions: 100

  # JSONL source
  - name: "{json@display}"
    icon: history
    color: orange
    description: ""
    searchPrefix: r
    shortcut: Ctrl+r
    sourcePath: "~/.claude/history.jsonl"
    orderBy: "{json@timestamp} desc"
    inputFormat: "{json@display}"
    displayTime: "{json@timestamp}"
    maxSuggestions: 100
```

### Entry fields

| Field | Description |
|-------|-------------|
| `name` | Display name template |
| `description` | Description template (supports `\|` fallback) |
| `sourcePath` | Source path with glob (e.g., `~/.claude/commands/*.md`) |
| `sourceCommand` | Shell command for data source (instead of sourcePath) |
| `runCommand` | Shell command on Ctrl+Enter |
| `args` | Template arguments (e.g., `{ open: "iTerm" }` → `{args.open}`) |
| `searchPrefix` | Trigger prefix (e.g., `agent` → `@agent:`) |
| `shortcut` | Keyboard shortcut to activate search |
| `icon` | Codicon icon name |
| `color` | Badge color (name or hex) |
| `label` | UI badge label |
| `orderBy` | Sort order (e.g., `{updatedAt} desc`) |
| `displayTime` | Timestamp display template |
| `inputFormat` | Insert format (`name` or template like `{filepath}`) |
| `maxSuggestions` | Max suggestions to show |
| `values` | Template variable patterns |
| `triggers` | Trigger characters (default: `["/"]`) |
| `excludeMarker` | Skip directories containing this file |

### Template variables

| Variable | Description |
|----------|-------------|
| `{basename}` | Filename without extension |
| `{frontmatter@field}` | YAML frontmatter field |
| `{json@field}` | JSON field value |
| `{json:N@field}` | Nth parent JSON field |
| `{heading}` | First markdown heading |
| `{line}` | Each line of plain text file |
| `{content}` | Full file content |
| `{filepath}` | Absolute file path |
| `{dirname}` | Parent directory name |
| `{dirname:N}` | N levels up directory |
| `{pathdir:N}` | Nth directory from base path |
| `{latest}` | Most recently modified directory |
| `{args.key}` | Value from `args` field |

Fallback syntax: `{frontmatter@description}|{heading}` — uses right side if left is empty.

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
