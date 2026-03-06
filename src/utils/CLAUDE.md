# Utils Module

Shared utility functions used across the application. Organized into specialized files.

## File Structure

| File/Directory | Purpose |
|----------------|---------|
| `utils.ts` | Re-export hub (backward compatibility) |
| `logger.ts` | Logging with sensitive data masking |
| `common.ts` | General utilities (debounce, JSON, ID generation) |
| `security.ts` | Security utilities and error handling |
| `file-utils.ts` | File system operations |
| `rate-limiter.ts` | Rate limiting for abuse prevention |
| `apple-script-sanitizer.ts` | AppleScript input sanitization |
| `native-tools.ts` | Re-export hub for native tools |
| `native-tools/` | Modular native tool integrations (paths, app-detection, paste-operations, directory-operations) |
| `file-search/` | File listing using `fd` with `fs.readdir` fallback (replaces former Swift tool) |
| `symbol-search/` | Symbol search using `ripgrep` from Node.js (replaces former Swift tool) |

## Non-obvious Patterns

### Native tools path resolution
- In development: `__dirname/../native-tools/`
- In packaged app: `app.asar.unpacked/dist/native-tools/` (resolved via `app.getAppPath()`)
- Timeout protection: 2-5 seconds per tool call

### file-search module
- Uses `fd` command for fast recursive file listing
- Falls back to Node.js `fs.readdir` if `fd` is not installed
- Respects `.gitignore` patterns

### symbol-search module
- Uses `ripgrep` (`rg`) via `child_process.execFile`
- Supports 21 programming languages with regex-based symbol pattern matching
- 5-second timeout, 100MB buffer for large codebases
- Requires `rg` to be installed (`brew install ripgrep`)

### Security utilities
- AppleScript sanitization: 64KB limit, character escaping
- Input size limit: 1MB (byte-based via `Buffer.byteLength()`)
- Path normalization prevents directory traversal
- Rate limiter uses token bucket algorithm

### Logger
- Masks sensitive data (paths, tokens) in log output
- File-based logging to `~/.prompt-line/app.log`
- Max 5MB per file, 3 file rotation
