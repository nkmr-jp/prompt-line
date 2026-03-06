# IPC Handlers Module

Central communication bridge between main and renderer processes. 10 specialized handler files, 52 IPC channels total.

## File Structure

| File | Responsibility |
|------|---------------|
| `ipc-handlers.ts` | Main coordinator, delegates to specialized handlers |
| `paste-handler.ts` | Text/image paste with security validation |
| `history-draft-handler.ts` | History CRUD, draft management, @path caching |
| `window-handler.ts` | Window visibility and focus control |
| `system-handler.ts` | App info, config, settings retrieval |
| `custom-search-handler.ts` | Slash commands, agent selection, built-in commands events |
| `file-handler.ts` | File operations, external URL handling |
| `usage-history-handler.ts` | Usage tracking for files, symbols, agents |
| `code-search-handler.ts` | Symbol search with ripgrep integration |
| `handler-utils.ts` | Shared validation utilities |

## Non-obvious Patterns

### code-search-handler registers independently
- Does **NOT** go through the IPCHandlers coordinator
- Registered directly from `main.ts` via `codeSearchHandler.register()`
- Uses `initialized` flag to prevent double registration
- Implements stale-while-revalidate caching with background deduplication

### Handler utilities (handler-utils.ts)
- `withIPCErrorHandling`: HOF wrapper for standardized error handling
- `withIPCDataHandler`: HOF for data handlers with default values
- `normalizeAndValidatePath`: Path normalization with traversal attack prevention
- `validateHistoryId`: Strict regex `/^[a-z0-9]+$/` (max 32 chars)
- `updateCustomSearchConfig`: CustomSearch configuration update utility

### Security boundaries
- Paste text: 1MB byte-based limit via `Buffer.byteLength()`
- Config access: whitelist `['shortcuts', 'history', 'draft', 'timing', 'app', 'platform']`
- External URLs: only `http:` and `https:` protocols
- Image paths: traversal prevention + restrictive permissions (0o700/0o600)
- History IDs: lowercase alphanumeric only

### custom-search-handler listens for built-in commands changes
- Subscribes to `commands-changed` event from BuiltInCommandsManager
- Invalidates cache and notifies renderer when YAML files change in `~/.prompt-line/built-in-commands/`
