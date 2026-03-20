# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

### Development
```bash
pnpm start          # Run app in development mode (with DEBUG logging enabled)
pnpm run update-built-in-commands # Update slash commands with confirmation
pnpm run reset-accessibility      # Reset accessibility permissions for Prompt Line
```

- `pnpm start` sets `LOG_LEVEL=debug` automatically. Packaged apps always use INFO level.
- Logs: `~/.prompt-line/app.log` (use `tail -f ~/.prompt-line/app.log` for real-time monitoring)

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
pnpm run build      # Build the application (creates app + DMG)
pnpm run compile    # Full build: TypeScript + Renderer + Native Tools
pnpm run lint       # Check code style
pnpm run lint:fix   # Auto-fix code style issues
pnpm run typecheck  # Run TypeScript type checking
pnpm run pre-push   # Run all pre-push checks (lint + typecheck + test)
pnpm run clean      # Removes build artifacts (DMG, zip files)
pnpm run clean:cache     # Clears build caches
pnpm run clean:full      # Full cleanup (artifacts + caches + dist)
pnpm run generate:settings-example  # Regenerate settings.example.yml
```

`pnpm run compile` performs: tsc → Vite renderer build → native tools (`cd native && make install`) → copy to dist.

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
- **Target Branch**: Always create PRs against the `develop` branch (not `main`)
- **Language**: Write all PR titles and descriptions in English
- **Merge Strategy**: **Squash and merge** for feature PRs to `develop`. **Merge commit** for `develop` → `main`.

### Release Process
Uses [Release Please](https://github.com/googleapis/release-please) for automated releases. Config: `release-please-config.json`, workflow: `.github/workflows/release-please.yml`. Pushes to `main` trigger Release PR creation with version bump and CHANGELOG updates.

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
- **IPC Handlers** (`src/handlers/`): 10 specialized files, 53 IPC channels. See `src/handlers/CLAUDE.md`
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

### Built-in Commands

Slash command definitions for CLI tools (Claude Code, Codex CLI, Gemini CLI) stored as YAML files.

**Source:** `assets/built-in-commands/*.yml` → **Installed to:** `~/.prompt-line/built-in-commands/`

**Updating to latest versions:**
1. Check latest slash commands:
   - **Claude Code**: [changelog](https://github.com/anthropics/claude-code/releases) / [docs](https://code.claude.com/docs/en/commands)
   - **Codex CLI**: [source](https://github.com/openai/codex) / [docs](https://developers.openai.com/codex/cli/slash-commands/)
   - **Gemini CLI**: [docs](https://google-gemini.github.io/gemini-cli/docs/cli/commands.html) / [releases](https://github.com/google-gemini/gemini-cli/releases)
2. Edit YAML files in `assets/built-in-commands/` (add/update commands; do not remove existing)
3. Run `pnpm run update-built-in-commands` (requires `pnpm install` if node_modules is missing)

**Commit type for built-in-commands updates:** Use `chore` (not `feat`)

**YAML format:**
```yaml
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
- `settings.yml`: User preferences
- `directory.json`: CWD tracking for file search
- `app.log`: Application logs
- `images/`: Image storage
- `cache/`: Symbol cache, @path patterns (per-project and global)

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
Use `pnpm run compile` instead of `pnpm run build` for development iterations.

### Cleanup Reference

| Command | When to Use |
|---------|-------------|
| `pnpm run clean` | Remove DMG/zip build artifacts |
| `pnpm run clean:cache` | Cache-related build issues |
| `pnpm run clean:full` | Fresh build or troubleshooting |
