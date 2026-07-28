# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

### Development
```bash
pnpm start          # Run app in development mode (with DEBUG logging enabled)
pnpm run reset-accessibility      # Reset accessibility permissions for Prompt Line
```

- `pnpm run setup-codesign` creates a "Prompt Line" self-signed certificate in the login Keychain. Automatically run by `install-app`, so manual execution is not needed.
- `pnpm start` sets `LOG_LEVEL=debug` automatically. Packaged apps always use INFO level.
- Logs: `~/.prompt-line/app.log` (use `tail -f ~/.prompt-line/app.log` for real-time monitoring)

### Isolated Verification Instance (per worktree)
Verify the checkout you are working in without disturbing the Prompt Line the user keeps running.

```bash
pnpm run isolated start              # Compile if needed, then launch headless in the background
pnpm run isolated show               # Run the real show flow (renderer gets history/draft/settings)
pnpm run isolated type "@"           # Type into the input, as a user would
pnpm run isolated clear              # Empty the input
pnpm run isolated eval "<js>"        # Evaluate JavaScript in the renderer
pnpm run isolated screenshot out.png # Capture the offscreen window
pnpm run isolated logs -n 40         # Tail this instance's app.log
pnpm run isolated status
pnpm run isolated stop               # `clean` also deletes the instance's data directory
```

How the isolation works (`scripts/isolated-instance.js`):
- `PROMPT_LINE_DATA_DIR=~/.prompt-line-isolated/<worktree>/data` — its own history, drafts, settings, log, plugins and cache. On first start, `settings.yaml`, `plugins/` and `custom-search/` are **copied** (never symlinked) from `~/.prompt-line` so verification runs against a realistic config; pass `--no-seed` for a pristine one.
- Its own Electron `--user-data-dir`, so it gets its own single-instance lock and runs alongside the installed app.
- `PROMPT_LINE_ISOLATED=1` — no global shortcut (no fight over `Cmd+Shift+Space`), no tray icon, no native warmup, and the window is never shown or focused. The renderer still paints offscreen, so CDP screenshots show the real UI.
- CDP port derived from the worktree directory name (9300–9399), so parallel worktrees never collide. Two checkouts whose directories share a name are rejected (the state file records `repoRoot`) — set `PROMPT_LINE_INSTANCE_ID` to give one of them a distinct id.
- The CDP-driven commands (`type`, `clear`, `eval`, `screenshot`) need **Node 22+** (global `WebSocket`); `start`/`stop`/`status`/`show`/`logs` run on the version in `engines`.

Do **not** use `pnpm run install-app` to verify a worktree — it replaces `/Applications/Prompt Line.app` and quits the app the user is running.

### Testing
```bash
pnpm test                    # Run all tests
pnpm run test:watch         # Run tests in watch mode
pnpm run test:coverage      # Generate coverage report
pnpm run test:unit          # Run unit tests only
pnpm run test:integration   # Run integration tests only
pnpm run test:mutation      # Run mutation tests with Stryker
pnpm test tests/unit/utils.test.js              # Specific test file
pnpm test -- --testNamePattern="formatTimeAgo"  # Pattern matching
```

### Build & Distribution
```bash
pnpm run build      # Build the application (creates app + DMG for current architecture)
pnpm run install-app # Build and install directly to /Applications (skip DMG, for development)
pnpm run compile    # Full build: TypeScript + Renderer + Native Tools
pnpm run lint       # Check code style
pnpm run lint:fix   # Auto-fix code style issues
pnpm run typecheck  # Run TypeScript type checking
pnpm run pre-push   # Run all pre-push checks (lint + typecheck + test)
pnpm run clean      # Removes build artifacts (DMG, zip files)
pnpm run clean:cache     # Clears build caches
pnpm run clean:full      # Full cleanup (artifacts + caches + dist)
pnpm run generate:settings-example  # Regenerate settings.example.yaml
pnpm run migrate-settings           # Backup existing settings and replace with fresh defaults
pnpm run plugin:install <source>    # Install plugins from local path or GitHub repo
```

`pnpm run compile` performs: tsc → Vite renderer build → native tools (`cd native && make install`) → copy to dist.

### Code Signing
- `scripts/afterSign.js` auto-detects "Prompt Line" certificate in Keychain; falls back to ad-hoc signing if not found
- Override with `CODE_SIGN_IDENTITY` env var (e.g., `CODE_SIGN_IDENTITY=- pnpm run build` for ad-hoc)
- Verify signature: `codesign -d --requirements -` should show `certificate leaf = H"..."` (not `cdhash`)

### Git Hooks
- **Pre-commit**: ESLint --fix on staged .js/.ts files + TypeScript type checking
- **Pre-push**: typecheck + full test suite
- Setup: `pnpm install` (husky auto-configured via "prepare" script)

### Commit Message Guidelines
Follow Angular Commit Message Conventions: `<type>(<scope>): <subject>`

Types: `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `chore`

```
feat(history): add search functionality to paste history
fix(window): resolve positioning issue on multi-monitor setups
```

### Pull Request Guidelines
- **Target Branch**: Create PRs against `develop` if it exists, otherwise against `main`
- **Language**: Write all PR titles and descriptions in English
- **Merge Strategy**: **Squash and merge** for feature PRs into `develop`. Use **regular merge commit** (no squash) when merging `develop` into `main`. **For PRs opened directly against `main`** (the common case now that `main` is branch-protected — see below), **use squash merge** (`gh pr merge --squash`), not a regular merge commit: `gh pr merge --merge` writes the PR title into the merge commit body, and since PR titles follow Conventional Commits format, Release Please's commit parser picks that up as a second, duplicate changelog entry alongside the branch's original commit. Squash merge avoids this — it's the only commit release-please sees.
- **`main` is branch-protected** (public repo): direct pushes are disabled, even for admins. All changes to `main` must go through a PR with the `test` CI check passing. Never attempt `git push` directly to `main` — create a branch, push it, and open a PR with `gh pr create` instead.

### Release Process
Uses [Release Please](https://github.com/googleapis/release-please) for automated releases. Config: `release-please-config.json`, manifest: `.release-please-manifest.json`, workflow: `.github/workflows/release-please.yml`.

Pushes to `main` with conventional commits automatically trigger a Release Please PR with version bump and CHANGELOG updates. Merging that PR creates a GitHub Release.

## Architecture Overview

### Electron Process Architecture
```
User Input → Renderer → IPC Event → IPCHandlers (coordinator) → Specialized Handler → Manager → Data/System
                ↑                                                                            ↓
                └─────────────────────────── IPC Response ───────────────────────────────────┘
```

- **Main Process** (`src/main.ts`): Application lifecycle, window management, system interactions
- **Renderer Process** (`src/renderer/`): UI and user interactions with 13+ specialized managers. See `src/renderer/CLAUDE.md`
- **Preload Script** (`src/preload/preload.ts`): Secure context bridge with whitelisted IPC channels
- **IPC Handlers** (`src/handlers/`): 9 specialized files, 52 IPC channels. See `src/handlers/CLAUDE.md`
- **Managers** (`src/managers/`): 16 specialized managers + window sub-module. See `src/managers/CLAUDE.md`
- **Config** (`src/config/`): Centralized settings with `default-settings.ts` as Single Source of Truth. See `src/config/CLAUDE.md`
- **Utils** (`src/utils/`): Shared utilities, native tools, file/symbol search. See `src/utils/CLAUDE.md`
- **Native Tools** (`native/`): 4 compiled Swift tools for macOS integration. See `native/CLAUDE.md`
- **Shared Types** (`src/types/`): TypeScript definitions shared across processes
- **Shared Libraries** (`src/lib/`): Custom search, template resolution, scoring utilities

### Key Features
- **Auto-paste**: Native Swift tools simulate Cmd+V in the previously active app (requires Accessibility permissions)
- **Window positioning**: 4 modes (active-text-field → active-window-center → cursor → center) with fallback chain
- **Custom search system**: `@prefix:` triggers for custom file/data sources, `@` file search, `@lang:query` code search. Shortcut keys for direct activation (e.g., `Ctrl+g` → `@kb:`)
- **Slash commands**: Type `/` (or custom triggers like `$`) for built-in and custom commands. Agent selection support
- **History**: Unlimited JSONL-based paste history with real-time search
- **Draft auto-save**: Adaptive debouncing, persists on Esc, cleared on successful paste (Cmd+Enter)

### Plugin System

Plugins provide agent-built-in slash commands, agent-skills, and custom-search entries. Two settings formats are supported:

**v1 format (string[]):** `plugins: ["github.com/nkmr-jp/prompt-line-plugins/claude/agent-built-in/claude"]`
**v2 format (Record<string, string[]>):**
```yaml
plugins:
  github.com/nkmr-jp/prompt-line-plugins:
    - claude/agent-built-in/claude
    - claude/agent-skills/commands
```

**Plugin commands:**
```bash
prompt-line-plugin install <source>              # Install from local path or GitHub
prompt-line-plugin install <source>@<ref>        # Install at specific branch/tag/hash
prompt-line-plugin help                          # Show help
```

`plugin:install` supports local paths (`./path`, `~/path`) and GitHub repos (`github.com/user/repo[/path][@ref]`). Append `@ref` to specify a branch, tag, or commit hash (e.g., `@develop`, `@v1.0.0`, `@sea8pxe`). It generates `.prompt-line-plugin` metadata files with commit-hash-pinned GitHub URLs for version tracking.

**Source resolution for `github.com/...`:** `gh repo clone` → `git clone`

**Global CLI setup** — run `pnpm add -g .` in the project directory to install `prompt-line-plugin` globally (pnpm 11+ requires this; bare `pnpm link` no longer works):
```bash
pnpm add -g .
prompt-line-plugin install github.com/nkmr-jp/prompt-line-plugins
```

### Agent Built-in

Slash command definitions for CLI tools (Claude Code, Codex CLI, Gemini CLI) stored as plugin YAML files in the [prompt-line-plugins](https://github.com/nkmr-jp/prompt-line-plugins) repository.

**Source:** `github.com/nkmr-jp/prompt-line-plugins/<tool>/agent-built-in/*.yaml` → **Installed to:** `~/.prompt-line/plugins/github.com/nkmr-jp/prompt-line-plugins/<tool>/agent-built-in/`

**Updating to latest versions:**
1. Check latest slash commands:
   - **Claude Code**: [changelog](https://github.com/anthropics/claude-code/releases) / [docs](https://code.claude.com/docs/en/commands)
   - **Codex CLI**: [source](https://github.com/openai/codex) / [docs](https://developers.openai.com/codex/cli/slash-commands/)
   - **Gemini CLI**: [docs](https://google-gemini.github.io/gemini-cli/docs/cli/commands.html) / [releases](https://github.com/google-gemini/gemini-cli/releases)
2. Edit YAML files in the [prompt-line-plugins](https://github.com/nkmr-jp/prompt-line-plugins) repository

**Commit type for agent-built-in updates:** Use `chore` (not `feat`)

**YAML format:**
```yaml
pluginDescription: "Claude Code built-in slash commands"
name: claude
color: amber
reference: https://example.com/docs
commands:
  - name: command-name
    description: Short description of what the command does
    argument-hint: "[optional-args]"  # optional
```

Hot reload: Changes auto-detected (chokidar, 300ms debounce) without app restart.

### Data Storage
All data stored in `~/.prompt-line/`:
- `history.jsonl`: Paste history (JSONL append-only)
- `draft.json`: Auto-saved drafts
- `settings.yaml`: User preferences (falls back to `settings.yml`)
- `directory.json`: CWD tracking for file search
- `app-directories.json`: Per-app startup directory overrides (see below)
- `app.log`: Application logs
- `images/`: Image storage
- `cache/`: Symbol cache, @path patterns (per-project and global)
- `plugins/`: Plugin YAML files with `.prompt-line-plugin` metadata

#### `app-directories.json` (per-app directory override)

A flat map of macOS bundle id to absolute directory path:

```json
{
  "com.example.someapp": "/Users/me/ghq/github.com/me/project",
  "com.microsoft.VSCode": "/Users/me/work/foo"
}
```

**Prompt Line only reads this file — external tools own and write it.** This is a
cross-repo contract: an app that knows which project the user is currently working
on (for example a browser-like/Electron app whose terminal CWD cannot be detected)
writes its own bundle id here, and Prompt Line opens that directory when triggered
from that app.

- Prompt Line looks up `previousApp.bundleId`; apps not listed are unaffected.
- A matching entry **wins over live native directory detection** and over the
  `directory.json` fallback. Losing to live detection would make the override
  useless: the background detection that runs right after the window is shown
  would overwrite it within a few hundred ms.
- Missing, empty, malformed, non-absolute, or stale entries (directory deleted)
  are ignored silently and fall back to the normal detection chain.
- The file is re-read only when its mtime or size changes, so an entry can be
  updated at any time and takes effect on the next window show.
- Overrides ride the normal directory pipeline, so like live detection they
  require file search to be configured and `fd` to be installed.

## Testing Strategy

- **Mocks**: Comprehensive mocks in `tests/setup.ts` (Electron APIs, fs, child_process, IPC)
- **Organization**: Unit tests (isolation) + Integration tests (cross-module) + Fixtures (`tests/fixtures/`)
- **Console suppression**: Use `vi.spyOn(console, 'error').mockImplementation(() => {})` (not `.mockImplementation()` — the latter doesn't suppress in vitest v4)

## Troubleshooting

### electron-builder ENOENT Error
Corrupted cache. Fix: `pnpm run clean:full && pnpm install && pnpm run build`

### TypeScript Compilation Errors
Fix: `pnpm install && pnpm run build`

### Native Tools Compilation Errors
Requires Xcode Command Line Tools: `xcode-select --install`

### Slow Build Times
Use `pnpm run install-app` for development — it skips DMG creation and installs directly to `/Applications`.

### Electron CDP Debugging
- `LOG_LEVEL=debug ./node_modules/.bin/electron . --remote-debugging-port=9222` to start with CDP
- `curl http://localhost:9222/json/list` to get WebSocket URL for the renderer page
- Python `websockets` library works for CDP communication: `pip3 install websockets`

### Cleanup Reference

| Command | When to Use |
|---------|-------------|
| `pnpm run clean` | Remove DMG/zip build artifacts |
| `pnpm run clean:cache` | Cache-related build issues |
| `pnpm run clean:full` | Fresh build or troubleshooting |
