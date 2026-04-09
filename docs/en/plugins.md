# Plugin Guide

Plugins are YAML files that add agent skills (`/`), custom search (`@prefix:`), and agent built-in commands to Prompt Line.

## Setup

Run the following once in the prompt-line project directory:

```bash
pnpm link
```

Then install plugins:

```bash
prompt-line-plugin install github.com/nkmr-jp/prompt-line-plugins
prompt-line-plugin install github.com/user/repo@branch   # specific version
prompt-line-plugin help                                   # show help
```

---

## Quick Start

Place a YAML file in a local directory — no GitHub repo needed.

### Add an agent skill

Create `~/.prompt-line/agent-skills/my-skills.yaml`:
```yaml
sourcePath: ~/my-project/skills/**/*/SKILL.md
name: "{frontmatter@name}"
description: "{frontmatter@description}"
argumentHint: "{frontmatter@argument-hint}"
```

Type `/` in the input and your skills appear.

### Add a custom search

Create `~/.prompt-line/custom-search/my-notes.yaml`:
```yaml
sourcePath: ~/notes/**/*.md
name: "{basename}"
description: "{heading}"
searchPrefix: note
shortcut: Ctrl+n
```

Type `@note:` or press `Ctrl+n` to search your notes.

### Add agent built-in commands

Create `~/.prompt-line/agent-built-in/my-tool.yaml`:
```yaml
name: My Tool
color: blue
reference: https://example.com/docs
commands:
  - name: deploy
    description: Deploy to production
  - name: rollback
    description: Rollback last deployment
    argument-hint: "[version]"
skills:
  - name: test
    description: Run test suite
agents:
  - name: reviewer
    description: Code review agent
```

---

## Plugin Types

| Directory | Type | Trigger | Purpose |
|-----------|------|---------|---------|
| `agent-built-in/` | Agent built-in | `/`, `@` | Define commands, skills, and agents for CLI tools |
| `agent-skills/` | Agent skills | `/` | Load skills from markdown files |
| `custom-search/` | Custom search | `@prefix:` | Search files, JSON, JSONL, or command output |

---

## agent-built-in

Defines a list of commands, skills, and agents that appear when typing `/` or `@`.

```yaml
name: Tool Name                       # Display name
color: amber                          # Badge color
reference: https://example.com/docs   # Single reference URL
references:                           # Or multiple URLs
  - https://example.com/commands
  - https://example.com/skills
commands:
  - name: commit
    description: Create a git commit
    argument-hint: "[-m message]"
    color: green                      # Per-item color override
skills:
  - name: batch
    description: Run batch operations
agents:
  - name: Explore
    description: Fast codebase exploration
```

---

## agent-skills

Loads skills from markdown files. Each YAML maps to a directory of `.md` files (typically `SKILL.md`).

```yaml
sourcePath: ~/.claude/skills/**/*/SKILL.md
name: "{frontmatter@name}"
label: global
description: "{frontmatter@description}"
argumentHint: "{frontmatter@argument-hint}"
```

Also works with commands:
```yaml
sourcePath: ~/.claude/commands/*.md
name: "{basename}"
description: "{frontmatter@description}"
```

### Fields

| Field | Required | Description |
|-------|----------|-------------|
| `sourcePath` | No* | Glob path to source files |
| `sourceCommand` | No* | Shell command for data source (alternative to sourcePath) |
| `name` | Yes | Display name template |
| `description` | No | Description template |
| `label` | No | UI badge label |
| `color` | No | Badge color |
| `icon` | No | Codicon icon name |
| `argumentHint` | No | Argument hint template |
| `maxSuggestions` | No | Max suggestions (default: 20) |
| `orderBy` | No | Sort order |
| `values` | No | Template variable patterns |
| `triggers` | No | Trigger characters (default: `["/"]`) |
| `args` | No | Template arguments |

\* At least one of `sourcePath` or `sourceCommand` is required.

**Example with custom triggers:**
```yaml
sourcePath: ~/prompts/*.md
name: "{basename}"
description: "{heading}"
triggers: ["/", "$"]                  # Activates with both / and $
```

---

## custom-search

Defines `@prefix:` search entries loaded from files, commands, or JSON sources.

```yaml
sourcePath: ~/.claude/agents/*.md
searchPrefix: agent
name: "{basename}(agent)"
label: global
description: "{frontmatter@description}"
displayTime: "{updatedAt}"
```

### Additional fields (custom-search only)

| Field | Description |
|-------|-------------|
| `searchPrefix` | Prefix for `@prefix:` activation |
| `displayTime` | Timestamp display template |
| `inputFormat` | Insert format template |
| `shortcut` | Keyboard shortcut to activate |
| `runCommand` | Shell command on Ctrl+Enter |
| `excludeMarker` | Skip directories with this file |

### Source types

**Markdown files:**
```yaml
sourcePath: ~/docs/**/*.md
name: "{basename}"
description: "{frontmatter@description}|{heading}"
searchPrefix: doc
```

**JSONL files:**
```yaml
sourcePath: ~/.claude/history.jsonl
name: "{json@display}"
searchPrefix: r
orderBy: "{json@timestamp} desc"
displayTime: "{json@timestamp}"
```

**JSON with jq expression:**
```yaml
sourcePath: "~/.claude/teams/**/config.json@.members"
name: "{json@name}"
description: "{json@prompt}"
searchPrefix: team
```

**Command output:**
```yaml
sourceCommand: "ghq list"
name: "{line}"
searchPrefix: ghq
runCommand: "open -a {args.open} ~/ghq/{line}"
inputFormat: "~/ghq/{line}"
args:
  open: iTerm
```

- Output format: plain text (one item per line) or JSONL (one JSON per line)
- Auto-detected from first line of output

---

## Template Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `{basename}` | Filename without extension | `SKILL.md` → `SKILL` |
| `{frontmatter@field}` | YAML frontmatter field | `{frontmatter@description}` |
| `{json@field}` | JSON field (dot notation) | `{json@display}` |
| `{json:N@field}` | Nth parent JSON field | `{json:1@name}` |
| `{heading}` | First markdown heading | |
| `{line}` | Each line of plain text | |
| `{content}` | Full file content | |
| `{filepath}` | Absolute file path | |
| `{dirname}` | Parent directory name | |
| `{dirname:N}` | N levels up directory | `{dirname:2}` |
| `{pathdir:N}` | Nth directory from base | `{pathdir:1}` |
| `{latest}` | Most recently modified dir | |
| `{updatedAt}` | File modification time | |
| `{args.key}` | Value from `args` field | `{args.open}` |

**Fallback:** `{frontmatter@description}|{heading}` — uses right side if left is empty.

---

## sourcePath Format

Single field combining directory and glob pattern:

```yaml
sourcePath: ~/.claude/skills/**/*/SKILL.md    # Recursive glob
sourcePath: ~/.claude/commands/*.md           # Simple glob
sourcePath: ~/.claude/history.jsonl            # Specific file
sourcePath: "~/.claude/teams/**/config.json@. | select(.active)"  # JSON + jq
```

### Splitting rules

The `sourcePath` is split into directory + pattern at the first glob character (`*`, `?`, `[`):

| sourcePath | Directory | Pattern |
|-----------|-----------|---------|
| `~/.claude/skills/**/*/SKILL.md` | `~/.claude/skills` | `**/*/SKILL.md` |
| `~/.claude/commands/*.md` | `~/.claude/commands` | `*.md` |
| `~/.claude/history.jsonl` | `~/.claude` | `history.jsonl` |

---

## Color

Badge colors support named colors and hex codes:

**Named:** grey, darkGrey, slate, stone, red, rose, orange, amber, yellow, lime, green, emerald, teal, cyan, sky, blue, indigo, violet, purple, fuchsia, pink

**Hex:** `#RGB` or `#RRGGBB` (e.g., `#FF6B35`, `#F63`)

---

## Distributing as a GitHub Plugin

To share your plugin with others, create a GitHub repository:

```
my-plugins/
  my-tool/
    agent-built-in/en.yaml
    agent-skills/skills.yaml
    custom-search/search.yaml
```

### Install

```bash
prompt-line-plugin install github.com/user/my-plugins
prompt-line-plugin install github.com/user/my-plugins@v1.0.0   # specific version
prompt-line-plugin install ./local/path                         # local path
```

### Enable in settings.yaml

```yaml
plugins:
  github.com/user/my-plugins:
    - my-tool/agent-built-in/en
    - my-tool/agent-skills/skills
    - my-tool/custom-search/search@prefix    # @prefix overrides searchPrefix
```

### Path overrides

```
<path>[@searchPrefix][?key=value&key2=value2]
```

- `@suffix` → overrides `searchPrefix`
- `?key=val` → overrides `args` (e.g., `?open=iTerm`)

### Plugin directory structure

```
~/.prompt-line/plugins/
  <package>/                          # e.g., github.com/nkmr-jp/prompt-line-plugins
    <category>/                       # e.g., claude, codex, gemini
      agent-built-in/<name>.yaml
      agent-skills/<name>.yaml
      custom-search/<name>.yaml
```

### Example repository (prompt-line-plugins)

```
prompt-line-plugins/
  claude/
    agent-built-in/en.yaml          # Claude Code built-in (English)
    agent-built-in/ja.yaml          # Claude Code built-in (Japanese)
    agent-skills/commands.yaml      # ~/.claude/commands/*.md
    agent-skills/skills.yaml        # ~/.claude/skills/**/SKILL.md
    custom-search/agents.yaml       # @agent: search
    custom-search/history.yaml      # @r: Claude history
    custom-search/teams.yaml        # @team: search
  codex/
    agent-built-in/en.yaml          # Codex CLI built-in
  gemini/
    agent-built-in/en.yaml          # Gemini CLI built-in
  path/
    custom-search/ghq.yaml          # @ghq: repository search
```

---

## Hot Reload

All YAML files are watched by chokidar (300ms debounce). Changes are auto-detected without app restart — both local directories and plugin directories.
