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
- `main.swift`, `DirectoryDetector.swift`, `CWDDetector.swift`, `TerminalDetector.swift`, `IDEDetector.swift`, `ProcessTree.swift`, `ClaudeCodeDetector.swift`, `MultiplexerDetector.swift`
- Requires `libproc-bridge.h` bridging header (uses libproc for CWD detection, 10-50x faster than lsof)

### text-field-detector container detection
- When no standard text field (AXTextField/AXTextArea) is found, traverses parent hierarchy for container bounds
- Works for non-standard terminals like Ghostty (`detectionMethod: "parent_container"`)
- Stops at AXWindow level to avoid returning entire window bounds

### Supported applications (directory-detector)
Terminal.app, iTerm2, Ghostty, Warp, WezTerm, cmux, JetBrains IDEs, VSCode/Insiders/VSCodium, Cursor, Windsurf, Zed, OpenCode, Antigravity, Kiro

### cmux directory detection
cmux (`com.cmuxterm.app`) exposes a `working directory` property on its focused terminal via its AppleScript dictionary (`Contents/Resources/cmux.sdef`). The detector uses AppleScript directly instead of process tree traversal — cmux embeds Ghostty internally, but the parent app's bundle ID is what `NSWorkspace.frontmostApplication` returns, so process-tree detection wouldn't run correctly without explicit handling.

### Claude Code sessions move without their shell (`ClaudeCodeDetector.swift`)
Every terminal detector resolves a **shell's** working directory, but Claude Code's `Entering worktree(...)` performs a real `chdir()` inside the CLI process: the agent ends up in the worktree while its parent shell stays where the user started it, and nothing re-emits OSC 7, so Ghostty's `AXDocument`, `wezterm cli`, cmux's AppleScript and tty mtime all keep reporting the pre-move directory. Every terminal path therefore runs `preferClaudeCodeCwd` before returning, which prefers the agent process's own cwd and falls back to the shell's when no agent is running there. Two variants:
- `preferClaudeCodeCwd(over:shellPid:)` — used where the pane's shell pid is known (tty path, Terminal.app/iTerm2, the tty-mtime process path shared by Warp/Ghostty/WezTerm fallbacks, `wezterm cli`).
- `preferClaudeCodeCwd(over:appPid:)` — used where only a directory is known (Ghostty `AXDocument`, cmux AppleScript). It locates the shells under the app that sit in that directory, narrows them to the most recently active tty (so a second pane in the same directory cannot hijack the result), then looks for the agent beneath them.

Matching is deliberately narrow: `isClaudeCodeExecutable` recognises `<...>/claude/versions/<version>` (the native install layout, which `proc_pidpath` resolves the `~/.local/bin/claude` symlink to) plus a defensive basename check. IDE integrated terminals are **not** covered.

### libproc: `PROC_PIDT_SHORTBSDINFO` vs `PROC_PIDTBSDINFO`
`proc_pidinfo(PROC_PIDTBSDINFO)` is refused for processes owned by another user, and a terminal's process tree runs straight through one — the setuid-root `/usr/bin/login` between the terminal app and the pane's shell. Building a pid→ppid table with the full flavour silently drops that link and every descendant becomes unreachable. Use `PROC_PIDT_SHORTBSDINFO` for the table (it is permitted cross-user) and ask for the full flavour only when the tty device is needed, on the user's own shell processes. Note the short flavour carries no `e_tdev`.

### cmux paste handling (NOT keyboard-simulator)
Cmd+V CGEvents posted by `keyboard-simulator paste` do not reach cmux's embedded Ghostty terminal — the parent NSApplication consumes the event and the keystroke never lands in the focused PTY. For cmux, `src/utils/native-tools/paste-operations.ts` bypasses keyboard-simulator entirely and runs a single `osascript` invocation that activates cmux and forwards Ghostty's `paste_from_clipboard` action via `cmux.sdef` (`CmuxPfAc`) to the focused terminal pane.

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
