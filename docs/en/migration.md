# Settings Migration Guide

This guide covers changes to `~/.prompt-line/settings.yaml` between versions.

## Auto-migration

Run the migration command to back up your existing settings and replace with fresh defaults:

```bash
pnpm run migrate-settings
```

This will:
1. Back up `~/.prompt-line/settings.yaml` → `settings.backup.<timestamp>.yaml`
2. Replace with the latest default settings (same as `settings.example.yaml`)

Your backup is preserved, so you can refer to it when re-applying customizations.

---

## v0.32 → v0.33

### 1. Template variable `{updatedAt}` renamed to `{mtime}`

The `{updatedAt}` template variable has been renamed to `{mtime}` for consistency with other lowercase template variables (`{basename}`, `{heading}`, `{filepath}`, etc.).

If you use `{updatedAt}` in your `settings.yaml` custom search entries (e.g., `orderBy` or `displayTime`), update them:

**Before:**
```yaml
orderBy: "{updatedAt} desc"
displayTime: "{updatedAt}"
```

**After:**
```yaml
orderBy: "{mtime} desc"
displayTime: "{mtime}"
```

Also update any custom plugin YAML files that reference `{updatedAt}`.

---

## v0.29 → v0.30

### 1. Shortcuts format changed (key → action)

The shortcuts section now uses a **key → action** format instead of **action → key**.

**Before:**
```yaml
shortcuts:
  main: Cmd+Shift+Space
  paste: Cmd+Enter
  close: Escape
  historyNext: Ctrl+j
  historyPrev: Ctrl+k
  search: Cmd+f
```

**After:**
```yaml
shortcuts:
  Cmd+Shift+Space: main    # Show/hide the input window (global)
  Cmd+Enter: paste          # Paste text and close window
  Escape: close             # Close window without pasting
  Ctrl+j: historyNext       # Navigate to next history item
  Ctrl+k: historyPrev       # Navigate to previous history item
  Cmd+f: search             # Enable search mode in history
  # Ctrl+m: "input=@md:"   # Custom action
  # Ctrl+g: "input=@ghq:"
```

**Action required:** None. Both formats are auto-detected and supported. The new format is recommended because it also supports **custom actions** like `input=@md:`.

---

### 2. Section order changed

The settings file sections have been reordered for better organization.

**Before:** shortcuts → window → fileOpener → plugins → agentBuiltIn → agentSkills → customSearch → fileSearch → symbolSearch

**After:** window → shortcuts → plugins → fileOpener → fileSearch → symbolSearch → customSearch

**Action required:** None. Section order has no effect on behavior.

---

### 3. `fileSearch.maxFiles` default increased

| Setting | Before | After |
|---------|--------|-------|
| `fileSearch.maxFiles` | 5000 | 100000 |

**Action required:** None. If you had explicitly set `maxFiles: 5000`, you may want to increase it to benefit from searching larger codebases.

---

### 4. `symbolSearch.respectGitignore` added

New setting to respect `.gitignore` when searching symbols.

```yaml
symbolSearch:
  respectGitignore: true   # New (default: true)
  maxSymbols: 200000
  timeout: 60000
```

**Action required:** None. Default is `true`, matching previous behavior.

---

### 5. Deprecated sections removed from default output

The following sections are no longer shown in the settings file when empty:

- `agentBuiltIn` — use `plugins` instead
- `agentSkills` — use `plugins` instead

If you have active entries in these sections, they will still appear and continue to work.

**Migration:** Move to the `plugins` format:

**Before (agentBuiltIn):**
```yaml
agentBuiltIn:
  - claude
```

**After (plugins):**
```yaml
plugins:
  github.com/nkmr-jp/prompt-line-plugins:
    - claude/agent-built-in/en
```

**Before (agentSkills):**
```yaml
agentSkills:
  - name: "{basename}"
    description: "{frontmatter@description}"
    sourcePath: ~/.claude/commands/*.md
```

**After (plugins):**
```yaml
plugins:
  github.com/nkmr-jp/prompt-line-plugins:
    - claude/agent-skills/commands    # sourcePath: ~/.claude/commands/*.md
```

---

### 6. `customSearch` section deprecated

The inline `customSearch` section in settings.yaml is now deprecated, same as `agentBuiltIn` and `agentSkills`. It will only appear in the settings file when you have active entries.

**Migration:** Use plugins or local YAML files instead (see item 7).

If you have inline entries using the old `path`/`pattern` fields, combine them into `sourcePath`:

**Before:**
```yaml
customSearch:
  - name: "{basename}"
    path: ~/.claude/agents
    pattern: "*.md"
    searchPrefix: agent
```

**After (plugin YAML or local YAML):**
```yaml
sourcePath: ~/.claude/agents/*.md
name: "{basename}"
searchPrefix: agent
```

---

### 7. Local YAML directories (no plugin required)

You can now place YAML config files directly in `~/.prompt-line/` subdirectories without creating a plugin:

```
~/.prompt-line/
  agent-built-in/     # Agent built-in slash commands (*.yaml)
  agent-skills/       # Slash commands from markdown files (*.yaml)
  custom-search/      # Custom search entries (*.yaml)
```

These directories are automatically created and watched for changes (hot reload).

**Example:** Create `~/.prompt-line/custom-search/my-notes.yaml`:
```yaml
sourcePath: ~/notes/**/*.md
name: "{basename}"
description: "{heading}"
searchPrefix: note
shortcut: Ctrl+n
```

This is equivalent to using a plugin but simpler for personal configurations.

**Action required:** None. This is an additional option alongside plugins.

---

## Quick reference: full new format

See [settings.md](settings.md) for the complete settings reference.
