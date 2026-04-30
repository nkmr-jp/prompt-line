import Cocoa
import Foundation

// MARK: - Terminal Detection

extension DirectoryDetector {

    // MARK: - Terminal.app tty detection

    static func getTerminalTty() -> String? {
        let script = """
        tell application "Terminal"
            set W to the front window
            set T to selected tab of W
            return tty of T
        end tell
        """

        let appleScript = NSAppleScript(source: script)
        var error: NSDictionary?
        guard let result = appleScript?.executeAndReturnError(&error) else {
            return nil
        }

        return result.stringValue
    }

    // MARK: - iTerm2 tty detection

    static func getiTerm2Tty() -> String? {
        let script = """
        tell application "iTerm2"
            tell current session of current tab of current window
                return tty
            end tell
        end tell
        """

        let appleScript = NSAppleScript(source: script)
        var error: NSDictionary?
        guard let result = appleScript?.executeAndReturnError(&error) else {
            return nil
        }

        return result.stringValue
    }

    // MARK: - cmux directory detection

    /// Check if bundle ID is cmux
    static func isCmux(_ bundleId: String) -> Bool {
        return bundleId == "com.cmuxterm.app"
    }

    /// Get working directory from cmux's focused terminal via AppleScript.
    /// Why AppleScript instead of process-tree: cmux embeds Ghostty internally, but
    /// the parent app's bundle ID is what NSWorkspace.frontmostApplication returns,
    /// so process-tree detection (used for Ghostty/Warp/WezTerm) wouldn't match.
    /// cmux exposes a "working directory" property on its focused terminal
    /// (see Contents/Resources/cmux.sdef in the app bundle).
    static func getCmuxWorkingDirectory() -> String? {
        // `focused terminal` can momentarily be nil (e.g. right after a pane split or
        // when no pane has keyboard focus). Fall back to the tab's first terminal so we
        // still return a directory instead of failing the whole detection.
        let script = """
        tell application "cmux"
            tell front window
                tell selected tab
                    try
                        return working directory of focused terminal
                    on error
                        return working directory of (first terminal)
                    end try
                end tell
            end tell
        end tell
        """

        let appleScript = NSAppleScript(source: script)
        var error: NSDictionary?
        guard let result = appleScript?.executeAndReturnError(&error),
              let value = result.stringValue,
              !value.isEmpty else {
            return nil
        }
        return value
    }

    // MARK: - Native Terminal Detection (Ghostty, Warp, WezTerm)

    /// Check if bundle ID is Ghostty
    static func isGhostty(_ bundleId: String) -> Bool {
        return bundleId == "com.mitchellh.ghostty"
    }

    /// Check if bundle ID is Warp
    static func isWarp(_ bundleId: String) -> Bool {
        return bundleId == "dev.warp.Warp-Stable"
    }

    /// Check if bundle ID is WezTerm
    static func isWezTerm(_ bundleId: String) -> Bool {
        return bundleId == "com.github.wez.wezterm"
    }

    /// Check if bundle ID is a native terminal (Ghostty, Warp, WezTerm)
    /// These terminals use process tree detection for CWD
    static func isNativeTerminal(_ bundleId: String) -> Bool {
        return isGhostty(bundleId) || isWarp(bundleId) || isWezTerm(bundleId)
    }

    /// Get CWD from native terminal using optimized process tree detection
    /// Works for Ghostty, Warp, WezTerm, and other native terminals
    /// Uses the same fast approach as Electron IDE detection
    static func getNativeTerminalDirectory(appPid: pid_t) -> (directory: String?, shellPid: pid_t?) {
        // One `ps` call gathers pid/ppid/tty/comm for every process. We avoid
        // `pgrep -f` because macOS pgrep silently drops long-running processes
        // whose KERN_PROCARGS2 has become unreadable — the focused login shell
        // of an old Ghostty tab is exactly the one that gets dropped.
        let snapshot = snapshotProcessesWithTty()
        if snapshot.isEmpty {
            return (nil, nil)
        }

        // Reuse the snapshot for parent lookups so we don't fork another `ps`.
        var parentMap: [pid_t: pid_t] = [:]
        parentMap.reserveCapacity(snapshot.count)
        for entry in snapshot {
            parentMap[entry.pid] = entry.ppid
        }

        // Pick the shell whose tty was most recently active. A pty's mtime
        // advances on read/write traffic, so it tracks the tab/window the user
        // just interacted with. Ghostty's AX hierarchy only exposes the focused
        // window's title — there is no direct pty mapping — so tty mtime is
        // what lets us resolve focus across multiple terminal windows/tabs.
        struct ShellCandidate {
            let pid: pid_t
            let cwd: String
            let ttyMtime: TimeInterval
        }

        var candidates: [ShellCandidate] = []
        for entry in snapshot where isShellCommand(entry.comm) && !entry.tty.isEmpty {
            guard isDescendantOf(entry.pid, ancestorPid: appPid, parentMap: parentMap, maxDepth: 10) else { continue }
            guard let cwd = getCwdFromPid(entry.pid) else { continue }
            let mtime = mtimeForTty(entry.tty) ?? 0
            candidates.append(ShellCandidate(pid: entry.pid, cwd: cwd, ttyMtime: mtime))
        }

        if candidates.isEmpty {
            return (nil, nil)
        }

        // Sort shells with a known tty mtime first (newest first); shells
        // without a resolvable tty fall back to pid order (newest first).
        candidates.sort { lhs, rhs in
            if lhs.ttyMtime > 0 && rhs.ttyMtime > 0 {
                return lhs.ttyMtime > rhs.ttyMtime
            }
            if lhs.ttyMtime > 0 { return true }
            if rhs.ttyMtime > 0 { return false }
            return lhs.pid > rhs.pid
        }

        let focused = candidates[0]
        return (focused.cwd, focused.pid)
    }

    private struct ProcessEntry {
        let pid: pid_t
        let ppid: pid_t
        let tty: String
        let comm: String
    }

    /// Capture pid/ppid/tty/comm for every process in a single `ps` invocation.
    private static func snapshotProcessesWithTty() -> [ProcessEntry] {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/bin/ps")
        process.arguments = ["-axo", "pid=,ppid=,tty=,comm="]

        let pipe = Pipe()
        process.standardOutput = pipe
        process.standardError = FileHandle.nullDevice

        do {
            try process.run()
            // Drain before waiting — `ps -ax` output exceeds the 64KB pipe
            // buffer on busy systems, and waiting first would deadlock.
            let data = pipe.fileHandleForReading.readDataToEndOfFile()
            process.waitUntilExit()

            guard let output = String(data: data, encoding: .utf8) else {
                return []
            }

            var entries: [ProcessEntry] = []
            entries.reserveCapacity(256)

            for rawLine in output.split(separator: "\n") {
                let line = rawLine.trimmingCharacters(in: .whitespaces)
                if line.isEmpty { continue }
                let parts = line.split(separator: " ", maxSplits: 3, omittingEmptySubsequences: true)
                if parts.count < 4 { continue }
                guard let pid = Int32(parts[0]),
                      let ppid = Int32(parts[1]) else { continue }
                let tty = parts[2] == "??" ? "" : String(parts[2])
                // `ps` pads each column to a fixed width, so the comm slice
                // can carry a leading space (e.g. " -zsh"). Trim before use —
                // otherwise isShellCommand misses WezTerm's "-zsh" entries.
                let comm = parts[3].trimmingCharacters(in: .whitespaces)
                entries.append(ProcessEntry(pid: pid, ppid: ppid, tty: tty, comm: comm))
            }

            return entries
        } catch {
            return []
        }
    }

    private static func mtimeForTty(_ tty: String) -> TimeInterval? {
        let path = tty.hasPrefix("/dev/") ? tty : "/dev/\(tty)"
        guard let attrs = try? FileManager.default.attributesOfItem(atPath: path),
              let modDate = attrs[.modificationDate] as? Date else {
            return nil
        }
        return modDate.timeIntervalSince1970
    }

    /// Get CWD from Ghostty terminal (wrapper for getNativeTerminalDirectory)
    static func getGhosttyDirectory(appPid: pid_t) -> (directory: String?, shellPid: pid_t?) {
        return getNativeTerminalDirectory(appPid: appPid)
    }

    /// Get CWD from Warp terminal (wrapper for getNativeTerminalDirectory)
    static func getWarpDirectory(appPid: pid_t) -> (directory: String?, shellPid: pid_t?) {
        return getNativeTerminalDirectory(appPid: appPid)
    }

    /// Get CWD from WezTerm terminal (wrapper for getNativeTerminalDirectory)
    static func getWezTermDirectory(appPid: pid_t) -> (directory: String?, shellPid: pid_t?) {
        return getNativeTerminalDirectory(appPid: appPid)
    }
}
