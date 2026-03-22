# Configuration Module

Centralized configuration management using a singleton pattern for consistent access across all modules.

## File Structure

| File | Role |
|------|------|
| `default-settings.ts` | **Single Source of Truth for all default values** |
| `app-config.ts` | Electron/app-specific config (singleton instance) |
| `settings-yaml-generator.ts` | Generates `settings.example.yml` |

## Key Principles

### default-settings.ts is the only place to change defaults
- **Always edit this file only** when modifying default values
- Run `pnpm run generate:settings-example` after changes to regenerate `settings.example.yml`
- Runtime defaults = documentation = example file are always in sync by design

### Configuration hierarchy
```
default-settings.ts (Single Source of Truth)
    ├→ app-config.ts (Electron config, paths, timing)
    ├→ SettingsManager (merges with user settings.yml)
    └→ settings-yaml-generator.ts (generates settings.example.yml)
```

## Non-obvious Patterns

### LOG_LEVEL controls log verbosity
- DEBUG level only when `LOG_LEVEL=debug` is explicitly set
- Otherwise always INFO (cannot be overridden in packaged builds)
- `pnpm start` sets `LOG_LEVEL=debug` automatically

### Path management
- All data stored under `~/.prompt-line/` (based on `os.homedir()`)
- Getter-based lazy path generation
- `pluginsDir`: `~/.prompt-line/plugins/`

### Key default values
- Window: 640x320, position: `active-text-field`
- Shortcuts: main=`Cmd+Shift+Space`, paste=`Cmd+Enter`, close=`Escape`, historyNext=`Ctrl+j`, historyPrev=`Ctrl+k`, search=`Cmd+f`
- `builtInCommands`: deprecated (use plugins instead)
- `fileSearch.maxFiles`: 5000
- `symbolSearch.maxSymbols`: 200000
