# Renderer Module

Frontend layer handling UI and user interactions. All TypeScript with modular manager pattern.

## Architecture

### Core Files
| File | Role |
|------|------|
| `input.html` | Main window template with accessibility attributes |
| `renderer.ts` | Central coordinator (PromptLineRenderer class) |
| `ui-manager.ts` | Theme system and notifications |
| `types.ts` | Shared TypeScript definitions |

### Manager Classes
| Manager | Responsibility |
|---------|---------------|
| `DomManager` | DOM element caching and manipulation |
| `EventHandler` | Global events, IME support, shortcut processing |
| `LifecycleManager` | Window show/hide, draft restoration, settings sync |
| `ShortcutHandler` | Keyboard shortcut handling |
| `WindowBlurHandler` | Window blur/auto-hide |
| `DirectoryDataHandler` | Directory data updates from main process |
| `DraftManagerClient` | Client-side draft auto-save (adaptive: 500ms/1000ms) |
| `HistoryUIManager` | History rendering with DocumentFragment |
| `AgentSkillManager` | Slash command skill system |
| `FrontmatterPopupManager` | YAML frontmatter popup display |
| `SnapshotManager` | Undo/redo with text + cursor state |

### Mention System (`mentions/`)
15+ specialized managers for `@` file search and `@lang:query` code search:
- Root: `dom-utils.ts`, `fuzzy-matcher.ts`, `path-utils.ts`, `text-finder.ts` (shared utilities)
- `managers/`: 16 specialized managers including:
  - `mention-initializer.ts`: Orchestrates initialization
  - `mention-state.ts`: Centralized state
  - `suggestion-ui-manager.ts`: Dropdown display
  - `file-filter-manager.ts`: Fuzzy matching with score-based ranking
  - `directory-cache-manager.ts`: Hybrid loading (Stage 1 single-level + Stage 2 recursive fd)
  - `navigation-manager.ts`: Keyboard navigation
  - `path-manager.ts`: Path detection and insertion
  - `highlight-manager.ts`: @path highlighting with Cmd+click
  - `code-search-manager.ts`: Symbol search integration
- `code-search/`: Code search types and exports

### History Search (`history-search/`)
Score-based filtering with fuzzy matching:
- Exact match (1000) > starts-with (500) > contains (200) > fuzzy (10)
- Recency bonus: 0-50 points (7-day window)
- 150ms debounce, max 5000 search items, max 50 display results

## Non-obvious Patterns

### IME composition handling
- EventHandler tracks composition state via `compositionstart`/`compositionend`
- Shortcuts are suppressed during active IME composition
- Critical for Japanese/Chinese/Korean input support

### XSS prevention
- `escapeHtml()` / `escapeHtmlFast()` for all user content before DOM insertion
- Search highlighting uses regex replacement on escaped content
- SVG injection uses DOMParser for safe parsing (in mentions module)

### Window blur auto-hide
- Uses timeout-based blur detection to prevent accidental closes
- Coordinates with EventHandler for focus state management

### CSS architecture
- Tailwind CSS v4 with `@theme {}` custom tokens
- Modular: `styles/base/` → `styles/layout/` → `styles/components/` → `styles/themes/`
- Codicon icon font for symbol type icons
- Animations disabled by design for instant UI responsiveness

### Shortcut system
- `shortcut-parser.ts`: Parses strings like `Cmd+Shift+Space` into structured objects
- `shortcut-formatter.ts`: Platform-specific display (⌘, ⇧, ⌥ on macOS)
- Dynamic: shortcuts update when user changes settings

### IPC communication pattern
- All main process calls go through `electronAPI` singleton proxy
- `window-shown` event delivers history, draft, settings, and directory data (Stage 1)
- `directory-data-updated` event delivers background file list (Stage 2 recursive search)
