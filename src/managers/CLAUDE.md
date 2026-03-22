# Managers Module

15 specialized managers + 2 sub-modules implementing core application functionality.

## Overview

### Core Managers
| Manager | Key Responsibility |
|---------|-------------------|
| `history-manager.ts` | Unlimited history with JSONL persistence |
| `draft-manager.ts` | Auto-save with adaptive debouncing and backup |
| `settings-manager.ts` | YAML-based user config with deep merge |
| `desktop-space-manager.ts` | Ultra-fast (<5ms) desktop space change detection |
| `file-cache-manager.ts` | File list caching with TTL invalidation |
| `custom-search-loader.ts` | Slash command and agent loading from markdown files |
| `file-opener-manager.ts` | File opening with per-extension editor mapping |
| `directory-manager.ts` | CWD management and storage |
| `symbol-cache-manager.ts` | Language-separated symbol caching (JSONL) |
| `at-path-cache-manager.ts` | @path pattern caching (project + global) |
| `agent-skill-cache-manager.ts` | Agent skill caching with TTL |
| `usage-history-manager.ts` | Base class for usage tracking (LRU) |
| `agent-usage-history-manager.ts` | Agent selection history (singleton) |
| `file-usage-history-manager.ts` | File selection history (singleton) |
| `symbol-usage-history-manager.ts` | Symbol selection history (singleton) |

### Sub-Modules
| Module | Purpose |
|--------|---------|
| `symbol-search/` | Thin wrapper delegating to `src/utils/symbol-search/` |
| `window/` | 12-file modular window management (see below) |

## Non-obvious Patterns

### Window module architecture (`window/`)
- `window-manager.ts`: Main coordinator
- `position-calculator.ts`: 4 positioning modes (active-text-field → active-window-center → cursor → center)
- `text-field-bounds-detector.ts`: Uses native text-field-detector tool
- `directory-detector.ts` + `directory-cache-helper.ts`: CWD detection with 2-second TTL cache
- `strategies/native-detector-strategy.ts`: Pluggable detection strategy pattern
- Window reuse: checks if window exists and is visible before creating new one

### History manager debounce strategy
- Standard save: 2000ms debounce
- Critical save: 500ms debounce (add/remove operations)
- Immediate save: synchronous (shutdown scenarios)
- JSONL format: oldest-first on disk, reversed in memory for display

### Draft manager adaptive debouncing
- Short text (≤200 chars): 500ms delay
- Long text (>200 chars): 1000ms delay
- Change detection skips unnecessary saves
- Draft persists on Esc close, cleared only on successful paste (Cmd+Enter)

### Usage history managers (inheritance pattern)
- Base class `UsageHistoryManager` provides LRU + JSONL persistence
- 3 specialized managers extend it: agent (100 entries), file (500), symbol (500)
- All use singleton pattern via `getInstance()` + lazy getter function
- TTL: 30 days, stored in `~/.prompt-line/cache/projects/`
- Bonus calculation uses frequency + recency scoring

### Settings manager deep merge
- User settings.yml is merged with defaults: `{ ...defaults.section, ...user.section }`
- Automatic file creation with defaults if missing
- Real-time file watching for live updates

### Desktop space manager
- Hash-based space signatures for efficient comparison
- 2-second TTL cache prevents expensive repeated detection
- Synthetic data creation for ultra-fast mode
- Triggers window recreation on space change

### Custom search loader
- Entry-level enable/disable filtering (each entry defines own patterns)
- Global-level enable/disable filtering (settings-based, applied after entry-level)
- Configurable order-by per entry
- Supports YAML frontmatter in markdown files for metadata
- Chokidar file watching for individual (non-glob) files with 300ms debounce
- Same EventEmitter pattern as PluginManager: emits `source-changed` on file changes
- Streaming JSONL parsing for files >= 1MB (createReadStream + readline)
- Shell command template resolution with `shellQuote` valueTransform (CWE-78 prevention)
- Icon auto-detection from file pattern: `SKILL_PATTERN` → codicon-edit-sparkle, others → codicon-terminal
