# Plugin Guide

Plugins are YAML files that add agent skills (`/`), custom search (`@prefix:`), and built-in commands/skills/agents for CLI tools to Prompt Line.

## Setup

Run the following once in the prompt-line project directory to install `prompt-line-plugin` command globally:

```bash
pnpm link
```

This makes the `prompt-line-plugin` command available from any directory.

## Using Plugins

Plugin examples: [prompt-line-plugins](https://github.com/nkmr-jp/prompt-line-plugins)

### Install

```bash
prompt-line-plugin install github.com/nkmr-jp/prompt-line-plugins
```

### Enable in settings.yaml

After installing, add the entries you need to `~/.prompt-line/settings.yaml`:

```yaml
plugins:
  github.com/nkmr-jp/prompt-line-plugins:
    - claude/agent-built-in/en                  # Built-in commands, skills, agents | lang: en, ja
    - claude/agent-skills/commands              # sourcePath: ~/.claude/commands/*.md
    - claude/agent-skills/skills                # sourcePath: ~/.claude/skills/**/SKILL.md
    - claude/agent-skills/plugin-commands       # sourcePath: ~/.claude/plugins/cache/*/*/{latest}/**/commands/*.md
    - claude/agent-skills/plugin-skills         # sourcePath: ~/.claude/plugins/cache/*/*/{latest}/**/SKILL.md
    - claude/custom-search/agents@agent         # sourcePath: ~/.claude/agents/*.md
    - claude/custom-search/plans@plan           # sourcePath: ~/.claude/plans/*.md
    - claude/custom-search/plugin-agents@agent  # sourcePath: ~/.claude/plugins/cache/*/*/{latest}/**/agents/*.md
    - claude/custom-search/teams@team           # sourcePath: ~/.claude/teams/**/config.json
    - claude/custom-search/history@r            # sourcePath: ~/.claude/history.jsonl
    # - codex/agent-built-in/en                 # Codex CLI built-in
    # - gemini/agent-built-in/en                # Gemini CLI built-in
    # - path/custom-search/ghq@ghq?open=iTerm   # sourceCommand: ghq list
```

### Path overrides

Plugin paths in settings.yaml support overrides:

```
<path>[@searchPrefix][?key=value&key2=value2]
```

- `@suffix` → overrides `searchPrefix` (e.g., `agents@agent` → `@agent:`)
- `?key=val` → overrides `args` (e.g., `?open=iTerm`)

### Shortcut activation

After setting up a plugin with a `searchPrefix`, you can assign a keyboard shortcut in `settings.yaml` to activate it directly:

```yaml
shortcuts:
  Ctrl+g: "input=@ghq:"    # Press Ctrl+g → inserts @ghq: and opens search
  Ctrl+r: "input=@r:"      # Press Ctrl+r → inserts @r: and opens history search
  Ctrl+n: "input=@note:"   # Press Ctrl+n → inserts @note: and opens note search
```

This uses the custom action format `input=@prefix:` to insert the search prefix into the input field and trigger the plugin's search.

---

## Creating Plugins

### Quick start — local YAML

Place a YAML file in `~/.prompt-line/` subdirectories:

```
~/.prompt-line/
  agent-built-in/     # Built-in commands, skills, agents (*.yaml)
  agent-skills/       # Agent skills from files (*.yaml)
  custom-search/      # Custom search entries (*.yaml)
```

**Agent skill example** — `~/.prompt-line/agent-skills/my-skills.yaml`:
```yaml
sourcePath: ~/my-project/skills/**/*/SKILL.md
name: "{frontmatter@name}"
description: "{frontmatter@description}"
argumentHint: "{frontmatter@argument-hint}"
icon: codicon-edit-sparkle
```

**Custom search example** — `~/.prompt-line/custom-search/my-notes.yaml`:
```yaml
sourcePath: ~/notes/**/*.md
name: "{basename}"
description: "{heading}"
searchPrefix: note
icon: codicon-note
```

**Built-in commands example** — `~/.prompt-line/agent-built-in/my-tool.yaml`:
```yaml
name: My Tool
color: blue
reference: https://example.com/docs
commands:
  - name: deploy
    description: Deploy to production
    argument-hint: "[env]"
    icon: codicon-rocket
skills:
  - name: test
    description: Run test suite
    icon: codicon-beaker
agents:
  - name: reviewer
    description: Code review agent
    icon: codicon-eye
```

### Managing with a Git repository

Instead of placing YAML files directly in `~/.prompt-line/`, you can organize them in a Git repository. This lets you version-control your plugin configurations and share them across machines. Works with GitHub repos, private repos, or local Git repos.

Create a repository with YAML files organized by category and type:

```
my-plugins/
  my-tool/
    agent-built-in/en.yaml      # Built-in commands, skills, agents
    agent-skills/skills.yaml    # Agent skills from markdown files
    custom-search/search.yaml   # Custom search entries
```

Install from a GitHub repo, specific version, or local path:

```bash
prompt-line-plugin install github.com/user/my-plugins
prompt-line-plugin install github.com/user/my-plugins@v1.0.0   # specific version
prompt-line-plugin install ./local/path                         # local path
```

YAML files are copied to `~/.prompt-line/plugins/` and then enabled via `settings.yaml` (see [Enable in settings.yaml](#enable-in-settingsyaml)).

---

## Plugin Types

| Directory | Type | Trigger | Purpose |
|-----------|------|---------|---------|
| `agent-built-in/` | Built-in | `/`, `@` | Define commands, skills, and agents for CLI tools |
| `agent-skills/` | Agent skills | `/` | Load skills from markdown files |
| `custom-search/` | Custom search | `@prefix:` | Search files, JSON, JSONL, or command output |

---

## YAML Reference

### agent-built-in

```yaml
name: Tool Name                       # Display name
color: amber                          # Badge color
icon: codicon-tools                   # Codicon icon (see Icon section)
reference: https://example.com/docs   # Single reference URL
references:                           # Or multiple URLs
  - https://example.com/commands
  - https://example.com/skills
commands:
  - name: commit
    description: Create a git commit
    argument-hint: "[-m message]"
    color: green                      # Per-item color override
    icon: codicon-git-commit          # Per-item icon override
skills:
  - name: batch
    description: Run batch operations
    icon: codicon-run-all
agents:
  - name: Explore
    description: Fast codebase exploration
    icon: codicon-search
```

### agent-skills

Loads skills from markdown files. Each YAML maps to a directory of `.md` files (typically `SKILL.md`).

```yaml
sourcePath: ~/.claude/skills/**/*/SKILL.md
name: "{frontmatter@name}"
label: global
description: "{frontmatter@description}"
argumentHint: "{frontmatter@argument-hint}"
icon: codicon-edit-sparkle
```

Also works with commands:
```yaml
sourcePath: ~/.claude/commands/*.md
name: "{basename}"
description: "{frontmatter@description}"
icon: codicon-terminal
```

#### Fields

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

### custom-search

Defines custom search entries activated by typing `@` followed by a prefix. For example, setting `searchPrefix: agent` lets you type `@agent:` in the input to search the configured source.

```yaml
sourcePath: ~/.claude/agents/*.md
searchPrefix: agent                   # → type @agent: to search
name: "{basename}(agent)"
label: global
description: "{frontmatter@description}"
displayTime: "{updatedAt}"
icon: codicon-hubot
```

#### Additional fields (custom-search only)

| Field | Description |
|-------|-------------|
| `searchPrefix` | Activation prefix — typing `@agent:` triggers search when set to `agent` |
| `displayTime` | Timestamp display template |
| `inputFormat` | Insert format template |
| `runCommand` | Shell command on Ctrl+Enter |
| `excludeMarker` | Skip directories with this file |

#### Source types

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

**Custom scripts:**

`sourceCommand` and `runCommand` are executed with the YAML file's directory as the working directory (`cwd`). You can place scripts alongside the plugin YAML and reference them with relative paths.

```yaml
sourceCommand: "./search.sh"
name: "{line}"
searchPrefix: mydata
runCommand: "./open.sh {line}"
```

```
~/.prompt-line/plugins/my-plugin/custom-search/
  ├── my-search.yaml    # sourceCommand: "./search.sh"
  ├── search.sh         # cwd = this directory when executed
  └── open.sh
```

---

## Template Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `{basename}` | Filename without extension | `commit.md` → `commit` |
| `{frontmatter@field}` | YAML frontmatter field | `{frontmatter@description}` |
| `{json@field}` | JSON field value | `{json@display}`, `{json@items[0].name}` |
| `{json:N@field}` | Nth parent JSON field | `{json:1@name}` |
| `{heading}` | First markdown heading | |
| `{line}` | Each line of plain text | |
| `{content}` | Full file content | |
| `{filepath}` | Absolute file path | |
| `{dirname}` | Parent directory name | |
| `{dirname:N}` | N levels up directory | `{dirname:2}` |
| `{pathdir:N}` | Nth directory from sourcePath base | e.g., `sourcePath: ~/a/b/*/file.md` → base=`~/a/b`, `{pathdir:1}`=first dir after base |
| `{projectdir}` | Current project directory (detected CWD). Remains unresolved if no directory is detected — plugin should handle this case | e.g., `git -C {projectdir} log` |
| `{latest}` | Most recently modified dir | |
| `{updatedAt}` | File modification time | |
| `{args.key}` | Value from `args` field | `{args.open}` |

**Fallback:** `{frontmatter@description}|{heading}` — uses right side if left is empty.

## sourcePath Format

Single field combining directory and glob pattern:

```yaml
sourcePath: ~/.claude/skills/**/*/SKILL.md    # Recursive glob
sourcePath: ~/.claude/commands/*.md           # Simple glob
sourcePath: ~/.claude/history.jsonl            # Specific file
sourcePath: "~/.claude/teams/**/config.json@. | select(.active)"  # JSON + jq
```

## Color

Badge colors support named colors and hex codes:

**Named:** grey, darkGrey, slate, stone, red, rose, orange, amber, yellow, lime, green, emerald, teal, cyan, sky, blue, indigo, violet, purple, fuchsia, pink

**Hex:** `#RGB` or `#RRGGBB` (e.g., `#FF6B35`, `#F63`)

## Icon

Set the `icon` field to a [Codicon](https://microsoft.github.io/vscode-codicons/dist/codicon.html) class name to display an icon next to the item.

```yaml
icon: codicon-rocket          # Rocket icon
icon: codicon-terminal        # Terminal icon
icon: codicon-edit-sparkle    # Edit sparkle (used for skills)
icon: codicon-hubot           # Robot icon (used for agents)
```

Icons can be set at both the entry level (applies to all items) and per-item level (overrides entry-level). Browse all available icons at [Codicon](https://microsoft.github.io/vscode-codicons/dist/codicon.html).

## Hot Reload

All YAML files are watched by chokidar (300ms debounce). Changes are auto-detected without app restart — both local directories and plugin directories.
