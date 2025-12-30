import Foundation

// MARK: - Terminal Multiplexer Detection

extension DirectoryDetector {

    // MARK: - tmux Pane Info

    /// Structure to hold tmux pane information
    struct TmuxPane {
        let pid: pid_t
        let currentPath: String
        let isActive: Bool
        let tty: String
    }

    // MARK: - tmux Path Discovery

    /// Find tmux executable path
    /// Checks common installation locations: Homebrew (arm64 and x86), and /usr/local/bin
    static func findTmuxPath() -> String? {
        let possiblePaths = [
            "/opt/homebrew/bin/tmux",   // Homebrew on Apple Silicon
            "/usr/local/bin/tmux",      // Homebrew on Intel or manual install
            "/usr/bin/tmux"             // System install (rare)
        ]

        for path in possiblePaths {
            if FileManager.default.fileExists(atPath: path) {
                return path
            }
        }

        // Try which command as fallback
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/which")
        process.arguments = ["tmux"]

        let pipe = Pipe()
        process.standardOutput = pipe
        process.standardError = FileHandle.nullDevice

        do {
            try process.run()
            process.waitUntilExit()

            if process.terminationStatus == 0 {
                let data = pipe.fileHandleForReading.readDataToEndOfFile()
                if let path = String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines),
                   !path.isEmpty {
                    return path
                }
            }
        } catch {
            // Ignore errors
        }

        return nil
    }

    // MARK: - tmux Availability Check

    /// Check if tmux is available and has active sessions
    static func isTmuxAvailable() -> Bool {
        guard let tmuxPath = findTmuxPath() else {
            return false
        }

        let process = Process()
        process.executableURL = URL(fileURLWithPath: tmuxPath)
        process.arguments = ["ls"]

        process.standardOutput = FileHandle.nullDevice
        process.standardError = FileHandle.nullDevice

        do {
            try process.run()
            process.waitUntilExit()
            return process.terminationStatus == 0
        } catch {
            return false
        }
    }

    // MARK: - tmux Pane Detection

    /// Get all tmux panes with their information
    static func getTmuxPanes() -> [TmuxPane] {
        guard let tmuxPath = findTmuxPath() else {
            return []
        }

        let process = Process()
        process.executableURL = URL(fileURLWithPath: tmuxPath)
        // Format: pane_pid|pane_current_path|pane_active|pane_tty
        process.arguments = ["list-panes", "-a", "-F", "#{pane_pid}|#{pane_current_path}|#{pane_active}|#{pane_tty}"]

        let pipe = Pipe()
        process.standardOutput = pipe
        process.standardError = FileHandle.nullDevice

        do {
            try process.run()
            process.waitUntilExit()

            guard process.terminationStatus == 0 else {
                return []
            }

            let data = pipe.fileHandleForReading.readDataToEndOfFile()
            guard let output = String(data: data, encoding: .utf8) else {
                return []
            }

            var panes: [TmuxPane] = []

            for line in output.split(separator: "\n") {
                let components = String(line).split(separator: "|", omittingEmptySubsequences: false)
                if components.count >= 4,
                   let pid = Int32(components[0]) {
                    let currentPath = String(components[1])
                    let isActive = components[2] == "1"
                    let tty = String(components[3])

                    panes.append(TmuxPane(
                        pid: pid,
                        currentPath: currentPath,
                        isActive: isActive,
                        tty: tty
                    ))
                }
            }

            return panes
        } catch {
            return []
        }
    }

    // MARK: - tmux Directory Detection

    /// Detect directory from tmux using tmux API directly
    /// This works regardless of which terminal/IDE started tmux
    /// Priority: active pane > non-home directory
    static func getTmuxDirectory() -> (directory: String?, shellPid: pid_t?, method: String?) {
        let panes = getTmuxPanes()

        if panes.isEmpty {
            return (nil, nil, nil)
        }

        let homeDir = FileManager.default.homeDirectoryForCurrentUser.path

        // Sort panes by priority:
        // 1. Active panes first
        // 2. Non-home directories first
        let sortedPanes = panes.sorted { a, b in
            // Active panes take priority
            if a.isActive != b.isActive {
                return a.isActive
            }
            // Then prefer non-home directories
            let aIsHome = a.currentPath == homeDir
            let bIsHome = b.currentPath == homeDir
            if aIsHome != bIsHome {
                return !aIsHome
            }
            return false
        }

        // Return the best matching pane's directory
        if let best = sortedPanes.first {
            // Skip if it's just home directory and there might be better options
            if best.currentPath != homeDir || sortedPanes.count == 1 {
                return (best.currentPath, best.pid, "tmux-api")
            }

            // Try to find any non-home directory
            if let nonHome = sortedPanes.first(where: { $0.currentPath != homeDir }) {
                return (nonHome.currentPath, nonHome.pid, "tmux-api")
            }

            // Fallback to home directory
            return (best.currentPath, best.pid, "tmux-api")
        }

        return (nil, nil, nil)
    }

    // MARK: - Multiplexer Detection Entry Point

    /// Main entry point for multiplexer detection
    /// Currently supports tmux only (screen/zellij not implemented)
    static func getMultiplexerDirectory() -> (directory: String?, shellPid: pid_t?, method: String?) {
        // Try tmux first (most common)
        if isTmuxAvailable() {
            let result = getTmuxDirectory()
            if result.directory != nil {
                return result
            }
        }

        // No multiplexer detected or no directory found
        return (nil, nil, nil)
    }
}
