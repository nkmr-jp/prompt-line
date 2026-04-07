# Plugin YAML Reference

Plugins are YAML files installed to `~/.prompt-line/plugins/` that define slash commands, custom search entries, and agent built-in commands.

## Directory Structure

```
~/.prompt-line/plugins/
  <package>/                          # e.g., github.com/nkmr-jp/prompt-line-plugins
    <category>/                       # e.g., claude, codex, gemini
      agent-built-in/<name>.yaml      # → slash commands from CLI tools
      agent-skills/<name>.yaml        # → slash commands from markdown files
      custom-search/<name>.yaml       # → @prefix: custom search entries
```

## Plugin Types

### agent-built-in

Defines built-in slash commands, skills, and agents for CLI tools (Claude Code, Codex, Gemini).

```yaml
name: Claude Code                     # Display name
color: amber                          # Badge color
reference: https://code.claude.com/docs/en/commands
references:                           # Multiple reference URLs
  - https://code.claude.com/docs/en/commands
  - https://code.claude.com/docs/en/skills
commands:
  - name: commit
    description: Create a git commit
    argument-hint: "[-m message]"
    color: green                      # Per-command color override
skills:
  - name: batch
    description: Run batch operations
agents:
  - name: Explore
    description: Fast codebase exploration agent
```

### agent-skills

Defines slash commands loaded from markdown files. Each YAML maps to a directory of `.md` files.

```yaml
# Claude Code global commands
sourcePath: ~/.claude/commands/*.md
name: "{basename}"
label: global
description: "{frontmatter@description}"
argumentHint: "{frontmatter@argument-hint}"
```

#### Fields

| Field | Required | Description |
|-------|----------|-------------|
| `sourcePath` | Yes* | Glob path to source files (e.g., `~/.claude/commands/*.md`) |
| `sourceCommand` | Yes* | Shell command for data source (alternative to sourcePath) |
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

\* Either `sourcePath` or `sourceCommand` is required.

### custom-search

Defines `@prefix:` search entries loaded from files, commands, or JSON sources.

```yaml
# Claude Code global agents
sourcePath: ~/.claude/agents/*.md
searchPrefix: agent
name: "{basename}(agent)"
label: global
description: "{frontmatter@description}"
displayTime: "{updatedAt}"
```

#### Additional fields (custom-search only)

| Field | Description |
|-------|-------------|
| `searchPrefix` | Prefix for `@prefix:` activation |
| `displayTime` | Timestamp display template |
| `inputFormat` | Insert format template |
| `shortcut` | Keyboard shortcut to activate |
| `runCommand` | Shell command on Ctrl+Enter |
| `excludeMarker` | Skip directories with this file |

## sourcePath Format

Single field combining directory and glob pattern:

```yaml
# Simple glob
sourcePath: ~/.claude/commands/*.md

# Recursive glob
sourcePath: ~/.claude/skills/**/*/SKILL.md

# Specific file
sourcePath: ~/.claude/history.jsonl

# With jq expression (JSON/JSONL)
sourcePath: "~/.claude/teams/**/config.json@. | select(.createdAt / 1000 > (now - 86400))"

# Command source (sourcePath empty, sourceCommand instead)
sourceCommand: "ghq list"
sourcePath: ""
```

### Splitting rules

The `sourcePath` is split into directory + pattern at the first glob character (`*`, `?`, `[`):

| sourcePath | Directory | Pattern |
|-----------|-----------|---------|
| `~/.claude/commands/*.md` | `~/.claude/commands` | `*.md` |
| `~/.claude/skills/**/*/SKILL.md` | `~/.claude/skills` | `**/*/SKILL.md` |
| `~/.claude/history.jsonl` | `~/.claude` | `history.jsonl` |

## sourceCommand

Shell command whose stdout is used as data source:

```yaml
sourceCommand: "ghq list"            # Each line becomes an item
runCommand: "open -a {args.open} ~/ghq/{line}"
args:
  open: iTerm
```

- Output format: plain text (one item per line) or JSONL (one JSON per line)
- Auto-detected from first line of output

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
| `{args.key}` | Value from `args` field | `{args.open}` |

**Fallback:** `{frontmatter@description}|{heading}` — uses right side if left is empty.

## Plugin Path Overrides (settings.yaml)

In `settings.yaml`, plugin paths can include overrides:

```yaml
plugins:
  github.com/nkmr-jp/prompt-line-plugins:
    - claude/custom-search/agents@agent         # @agent overrides searchPrefix
    - path/custom-search/ghq@ghq?open=iTerm     # ?open=iTerm overrides args.open
```

### Syntax

```
<path>[@searchPrefix][?key=value&key2=value2]
```

- `@suffix` after path → sets/overrides `searchPrefix`
- `?params` after path → sets/overrides `args` field

## Installation

```bash
# From GitHub
prompt-line-plugin install github.com/nkmr-jp/prompt-line-plugins

# Specific branch/tag/commit
prompt-line-plugin install github.com/nkmr-jp/prompt-line-plugins@develop

# Local path
prompt-line-plugin install ./my-plugins
prompt-line-plugin install ~/my-plugins
```

## Hot Reload

Plugin YAML files are watched by chokidar (300ms debounce). Changes are auto-detected without app restart.

## Repository Structure

```
prompt-line-plugins/
  claude/
    agent-built-in/en.yaml          # Claude Code built-in (English)
    agent-built-in/ja.yaml          # Claude Code built-in (Japanese)
    agent-skills/commands.yaml      # ~/.claude/commands/*.md
    agent-skills/plugin-commands.yaml
    agent-skills/plugin-skills.yaml
    agent-skills/skills.yaml        # ~/.claude/skills/**/SKILL.md
    custom-search/agents.yaml       # @agent: search
    custom-search/history.yaml      # @r: Claude history
    custom-search/plans.yaml        # @plan: search
    custom-search/plugin-agents.yaml
    custom-search/teams.yaml        # @team: search
  codex/
    agent-built-in/en.yaml          # Codex CLI built-in
  gemini/
    agent-built-in/en.yaml          # Gemini CLI built-in
  path/
    custom-search/ghq.yaml          # @ghq: repository search
  skills/
    agent-skills/skills.yaml        # ~/.agents/skills/**/SKILL.md
```
