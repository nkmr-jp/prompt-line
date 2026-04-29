# Native Tools Module

4 native macOS Swift tools replacing AppleScript for better performance, security, and reliability.

## Tools

| Tool | Purpose | CLI Example |
|------|---------|-------------|
| `window-detector` | Window bounds & app detection | `window-detector current-app` / `window-detector window-bounds` |
| `keyboard-simulator` | Cmd+V simulation & app activation | `keyboard-simulator paste` / `keyboard-simulator activate-bundle "com.apple.Terminal"` |
| `text-field-detector` | Focused text field detection | `text-field-detector text-field-bounds` |
| `directory-detector` | Terminal/IDE CWD detection | `directory-detector detect` |

## Build

```bash
cd native
make all       # Build all 4 tools
make install   # Build + set executable permissions
make clean     # Remove binaries
make rebuild   # Clean + rebuild
```

Output: `src/native-tools/`. Also built automatically by `pnpm run compile`.

## Non-obvious Patterns & Gotchas

### directory-detector is multi-file
Other 3 tools are single `.swift` files, but `directory-detector/` is a directory:
- `main.swift`, `DirectoryDetector.swift`, `CWDDetector.swift`, `TerminalDetector.swift`, `IDEDetector.swift`, `ProcessTree.swift`, `MultiplexerDetector.swift`
- Requires `libproc-bridge.h` bridging header (uses libproc for CWD detection, 10-50x faster than lsof)

### text-field-detector container detection
- When no standard text field (AXTextField/AXTextArea) is found, traverses parent hierarchy for container bounds
- Works for non-standard terminals like Ghostty (`detectionMethod: "parent_container"`)
- Stops at AXWindow level to avoid returning entire window bounds

### Supported applications (directory-detector)
Terminal.app, iTerm2, Ghostty, Warp, WezTerm, JetBrains IDEs, VSCode/Insiders/VSCodium, Cursor, Windsurf, Zed, OpenCode, Antigravity, Kiro, Codex

### Codex Desktop detection strategy
- Codex.app (`com.openai.codex`) has no `state.vscdb`. Its window title is just `"Codex"` (no project info) and its renderer never enables a11y, so AX-tree introspection yields nothing useful.
- Each Codex Desktop session is backed by a `node_repl` child process whose cwd is the worktree root (`~/.codex/worktrees/<id>/<project>`). The set of these cwds is the authoritative list of currently-open Codex projects.
- CWD is resolved by intersecting the open `node_repl` cwds with the session metadata in `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl` (first line is `session_meta` with `payload.cwd`, `payload.originator`, and optionally `payload.source.subagent`):
  1. Filter sessions to `originator == "Codex Desktop"` and *not* `payload.source.subagent` (this strips guardian / other sub-agent runs).
  2. Sort the remaining sessions by jsonl mtime descending — the most recently written file is the session the user most recently interacted with.
  3. Return the first cwd that is also in the open `node_repl` cwd set; if no `node_repl` info is available (older Codex builds), return the mtime-newest valid session.
- Limitation: when the user switches sessions in Codex's sidebar but hasn't yet sent a new message, mtime still points at the previous session. Codex stores selected-session state only in renderer memory, not on disk.
- Legacy flat `~/.codex/sessions/rollout-*.json[l]` layout is still walked as a fallback for pre-2025-05 sessions.

### Testing native tool changes
- After modifying Swift source, run `cd native && make install` then `pnpm run compile` to update `dist/native-tools/`
- Dev mode uses `dist/native-tools/` (NOT `src/native-tools/`) — `make install` alone is insufficient
- Kill existing instances before testing: `pkill -f "Electron.*prompt-line"` (single-instance lock prevents parallel runs)
- Start from the correct worktree: `LOG_LEVEL=debug ./node_modules/.bin/electron .`
- Verify with: `ps -ax -o command | grep "Electron \." | grep prompt-line` — check the worktree path in the output
- Test directory-detector directly: `./dist/native-tools/directory-detector detect --bundleId com.microsoft.VSCode`
- E2E test via AppleScript: `osascript -e 'tell application "Visual Studio Code" to activate'` then check `~/.prompt-line/app.log`

### Electron IDE detection strategy (directory-detector)
- PRIMARY: Window title (AX API `kAXFocusedWindowAttribute`) + `state.vscdb` (SQLite) lookup
- FALLBACK: Process tree traversal (pty-host → shell CWD)
- All terminal shells share one Code Helper process — process tree CANNOT distinguish windows
- `state.vscdb` path: `~/Library/Application Support/{Code,Cursor,Windsurf,...}/User/globalStorage/state.vscdb`

### All tools
- Communicate via JSON on stdout. Errors use `{"error": "..."}` format
- Require Accessibility permissions (`AXIsProcessTrustedWithOptions()`)
- Compiled binaries eliminate script injection vulnerabilities
- Link Cocoa + ApplicationServices frameworks, compiled with `-O` optimization
- Packaged at `app.asar.unpacked/dist/native-tools/`
