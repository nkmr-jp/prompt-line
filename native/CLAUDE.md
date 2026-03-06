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
Terminal.app, iTerm2, Ghostty, Warp, WezTerm, JetBrains IDEs, VSCode/Insiders/VSCodium, Cursor, Windsurf, Zed, OpenCode, Antigravity, Kiro

### All tools
- Communicate via JSON on stdout. Errors use `{"error": "..."}` format
- Require Accessibility permissions (`AXIsProcessTrustedWithOptions()`)
- Compiled binaries eliminate script injection vulnerabilities
- Link Cocoa + ApplicationServices frameworks, compiled with `-O` optimization
- Packaged at `app.asar.unpacked/dist/native-tools/`
