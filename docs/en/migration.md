# Settings Migration Guide

This guide covers changes to `~/.prompt-line/settings.yaml` between versions.

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

### 6. Plugin examples updated

The commented plugin examples now show the full v2 format with more available plugins.

**Before:**
```yaml
#plugins:
#  github.com/nkmr-jp/prompt-line-plugins:
#    - claude/agent-skills/commands
#    - claude/agent-built-in/claude
```

**After:**
```yaml
#plugins:
#  github.com/nkmr-jp/prompt-line-plugins:
#    - claude/agent-built-in/en                  # Claude Code built-in commands,skills,agents
#    - claude/agent-skills/commands              # sourcePath: ~/.claude/commands/*.md
#    - claude/agent-skills/skills                # sourcePath: ~/.claude/skills/**/SKILL.md
#    - claude/custom-search/agents@agent         # sourcePath: ~/.claude/agents/*.md
#    - claude/custom-search/history@r            # sourcePath: ~/.claude/history.jsonl
```

**Action required:** Uncomment and customize the plugins you want to enable.

---

### 7. Custom search `sourcePath` replaces `path` + `pattern`

The `path` and `pattern` fields have been consolidated into a single `sourcePath` field.

**Before:**
```yaml
customSearch:
  - name: "{basename}"
    path: ~/.claude/agents
    pattern: "*.md"
    searchPrefix: agent
```

**After:**
```yaml
customSearch:
  - name: "{basename}"
    sourcePath: ~/.claude/agents/*.md
    searchPrefix: agent
```

**Action required:** If you have inline `customSearch` entries using `path`/`pattern`, combine them into `sourcePath`. Both formats are supported for backward compatibility.

---

## Quick reference: full new format

See [settings.md](settings.md) for the complete settings reference.
