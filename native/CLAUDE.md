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

The sdef carries **no pane identity** — only `id`, `name` and `working directory` — and several panes routinely sit in the same directory, so the AppleScript answer alone cannot say *which* pane the user is looking at. cmux's control socket can: `getCmuxFocusedTty` speaks one NDJSON `system.tree` request over the UNIX socket named in `~/.local/state/cmux/last-socket-path` (read the pointer file — the state directory keeps stale sockets from earlier runs) and reads `active.surface_ref` plus each surface's `tty`. That is the same API the bundled `cmux` CLI wraps; talking to it directly avoids a fork, and it costs ~1.6ms. Degrades to nil — and callers to directory-only matching — when cmux is unreachable, when the socket read exceeds its 200ms timeout, or when the focused pane is **brand new**: a surface reports no tty until its shell has started, so a freshly split/created pane briefly has none.

### Claude Code sessions move without their shell (`ClaudeCodeDetector.swift`)
Every terminal detector resolves a **shell's** working directory, but Claude Code's `Entering worktree(...)` performs a real `chdir()` inside the CLI process: the agent ends up in the worktree while its parent shell stays where the user started it, and nothing re-emits OSC 7, so Ghostty's `AXDocument`, `wezterm cli`, cmux's AppleScript and tty mtime all keep reporting the pre-move directory. Every terminal path therefore runs `preferClaudeCodeCwd` before returning, which prefers the agent process's own cwd and falls back to the shell's when no agent is running there. Two variants:
- `preferClaudeCodeCwd(over:shellPid:)` — used where the pane's shell pid is known (tty path, Terminal.app/iTerm2, the tty-mtime process path shared by Warp/Ghostty/WezTerm fallbacks, `wezterm cli`). 0.5ms per call.
- `preferClaudeCodeCwd(over:appPid:focusedTty:)` — used where only a directory is known (cmux AppleScript, Ghostty `AXDocument`). With `focusedTty` (cmux, via the control socket above) the pane is identified exactly and the agent occupying that tty is the answer: 6.8ms. Without it — Ghostty exposes no pane tty — the agent's cwd is adopted **only when every pane sitting in the directory resolves to the same place**, otherwise the directory is returned unchanged: 9.8ms. All numbers measured on a 1300-process machine, 20-run average.

**Do not arbitrate between panes by tty mtime.** It measures output traffic, not focus — the very reason `getGhosttyDirectory` prefers `AXDocument` — so background panes redrawing their prompts win over the focused one. A first cut of this feature used it and was rejected in review: on the reporter's own machine the pane holding the agent lost to a sibling whose tty was 243s newer, the fix silently did nothing, and repeated runs on identical input returned three different worktrees. Determinism is the hard requirement here: the wrong worktree scopes `@` file search to an unrelated repository, and a stable "unchanged" is worth more than a lucky guess.

The agent is matched on its **controlling tty**, not on a parent shell, so a pane whose foreground process *is* the agent resolves like one where the agent hangs off the pane's shell, and no guess is needed about which of a pane's nested shells started the session.

Matching is deliberately narrow: `isClaudeCodeExecutable` recognises `<...>/claude/versions/<version>` (the native install layout, which `proc_pidpath` resolves the `~/.local/bin/claude` symlink to — verified against every live session on this machine) plus a basename `claude` sitting in a `bin`/`.bin` directory. npm-global and bun installs, where `proc_pidpath` reports `node`/`bun`, are **missed** — that degrades safely to the original directory, so do not widen the matcher to chase them. IDE integrated terminals are **not** covered.

### `getCwdFromPid` falls back to lsof on an *empty* libproc path
`getCwdFromPidFast` returns nil both when `proc_pidinfo` fails and when it succeeds with an empty path; `getCwdFromPid` then forks lsof. The empty-path case is new since `0c98ff4` (the commit message there claimed the behaviour was unchanged — it was not). Two consequences for the loop callers (`TerminalDetector.swift:146`, `ProcessTree.swift:118/136/329/415/443/538`): a process that previously yielded `""` now yields whatever lsof reports, so the **candidate set differs**, and each such candidate can pay lsof's **1-second timeout**. Reviewed for a "returns a wrong cwd" risk and none was found — on a process whose cwd had been deleted, libproc returned the same path lsof did. Use `getCwdFromPidFast` directly in hot walks (the agent search does) so no candidate can fork lsof.

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
