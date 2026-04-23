# Settings Reference

Prompt Line settings file: `~/.prompt-line/settings.yaml`

Settings are hot-reloaded (300ms debounce) — changes take effect without restarting.

## Window

Window size and positioning mode. The window appears near the active context based on the `position` setting.

```yaml
window:
  position: active-text-field   # Where the window appears (see below)
  width: 640                    # Recommended: 400-800 pixels
  height: 320                   # Recommended: 200-400 pixels
```

**Position options:**
- `active-text-field` — Near the focused text field (default, falls back to `active-window-center`)
- `active-window-center` — Center within the currently active window
- `cursor` — At the current mouse cursor location
- `center` — Center on primary display

## Shortcuts

Format: `Key: action` (e.g., `Cmd+Shift+Space: main`)

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

## Plugins

Add the entries you need to enable. See [Plugin Guide](plugins.md) for setup, creating plugins, and YAML reference.

```yaml
plugins:
  github.com/nkmr-jp/prompt-line-plugins:
    - claude/agent-built-in/en                  # Built-in commands, skills, agents | lang: en,ja
    - claude/agent-skills/commands              # sourcePath: ~/.claude/commands/*.md
    - claude/agent-skills/skills                # sourcePath: ~/.claude/skills/**/SKILL.md
    - claude/custom-search/agents@agent         # sourcePath: ~/.claude/agents/*.md
    - claude/custom-search/history@r            # sourcePath: ~/.claude/history.jsonl
```

## Image Storage

Image storage directory. Relative paths are resolved against CWD. When unset, defaults to `~/.prompt-line/images/`. Tip: Add the directory to `.gitignore` when using a relative path.

```yaml
imagesDirectory: .prompt-line/images
```

## File Search

Triggered by typing `@` in the input. Requires `fd` (`brew install fd`).

```yaml
fileSearch:
  respectGitignore: true    # Respect .gitignore files (fd only)
  includeHidden: true       # Include hidden files (starting with .)
  maxFiles: 100000          # Maximum number of files to index
  maxDepth: null            # Directory depth limit (null = unlimited)
  maxSuggestions: 50        # Max suggestions shown in popup
  followSymlinks: false     # Follow symbolic links during search
  #fdPath: null             # Custom path to fd (null = auto-detect)
  includePatterns: []       # Force include even if in .gitignore (e.g., ["*.log", "dist/**"])
  excludePatterns: []       # Additional excludes (e.g., ["node_modules", "*.min.js"])
```

## Symbol Search

Triggered by typing `@lang:query` (e.g., `@ts:Config`, `@go:Handler`). Requires `ripgrep` (`brew install ripgrep`). Space-separated keywords enable AND search (e.g., `@ts:Config util`).

```yaml
symbolSearch:
  respectGitignore: true    # Respect .gitignore files
  maxSymbols: 200000        # Maximum number of symbols to index
  timeout: 60000            # Search timeout in milliseconds
  followSymlinks: false     # Follow symbolic links during search
  #rgPath: null             # Custom path to rg (null = auto-detect)
  includePatterns: []       # Force include (e.g., ["*.test.ts", "vendor/**"])
  excludePatterns: []       # Additional excludes (e.g., ["*.generated.go"])
```

## File Opener

Configure which applications open file links (Cmd+click on `@path` references). Priority: `extensions` > `directories` > `defaultEditor` > system default.

```yaml
fileOpener:
  defaultEditor: "Visual Studio Code"   # null = system default (macOS "open" command)
  extensions:                           # Extension-specific apps (overrides defaultEditor)
    go: "GoLand"
    py: "PyCharm"
    png: "Preview"
    pdf: "Preview"
  directories:                          # Directory-specific editors (glob: ~, *, **)
    - path: "~/ghq/github.com/my-org/my-go*"
      editor: "GoLand"
```
