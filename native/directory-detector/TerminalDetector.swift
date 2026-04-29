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
        // Step 1: Get all shell processes using pgrep (very fast)
        let pgrepProcess = Process()
        pgrepProcess.executableURL = URL(fileURLWithPath: "/usr/bin/pgrep")
        pgrepProcess.arguments = ["-f", "zsh|bash|fish|sh|nu|pwsh"]

        let pgrepPipe = Pipe()
        pgrepProcess.standardOutput = pgrepPipe
        pgrepProcess.standardError = FileHandle.nullDevice

        do {
            try pgrepProcess.run()
            pgrepProcess.waitUntilExit()

            let pgrepData = pgrepPipe.fileHandleForReading.readDataToEndOfFile()
            guard let pgrepOutput = String(data: pgrepData, encoding: .utf8) else {
                return (nil, nil)
            }

            let shellPids = pgrepOutput.split(separator: "\n")
                .compactMap { Int32(String($0)) }
                .sorted(by: >) // Newest first

            if shellPids.isEmpty {
                return (nil, nil)
            }

            // Step 2: Build parent map from ps output (single call)
            let parentMap = buildParentMapFast()
            if parentMap.isEmpty {
                return (nil, nil)
            }

            // Step 3: For each shell, check if it's a descendant of the terminal app
            var terminalShells: [pid_t] = []

            for shellPid in shellPids {
                if isDescendantOf(shellPid, ancestorPid: appPid, parentMap: parentMap, maxDepth: 10) {
                    terminalShells.append(shellPid)
                }
            }

            if terminalShells.isEmpty {
                return (nil, nil)
            }

            let homeDir = FileManager.default.homeDirectoryForCurrentUser.path

            // Step 4: Check CWD of each shell, prefer non-home directories
            for shellPid in terminalShells.prefix(5) {
                if let cwd = getCwdFromPid(shellPid), cwd != homeDir {
                    return (cwd, shellPid)
                }
            }

            // Fallback: return first shell even if in home directory
            if let firstPid = terminalShells.first, let cwd = getCwdFromPid(firstPid) {
                return (cwd, firstPid)
            }

            return (nil, nil)
        } catch {
            return (nil, nil)
        }
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
