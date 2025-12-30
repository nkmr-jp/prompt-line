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

    // MARK: - Ghostty detection

    /// Check if bundle ID is Ghostty
    static func isGhostty(_ bundleId: String) -> Bool {
        return bundleId == "com.mitchellh.ghostty"
    }

    /// Get CWD from Ghostty terminal using process tree detection
    /// Ghostty is a native Swift terminal, so we find shell processes under it
    static func getGhosttyDirectory(appPid: pid_t) -> (directory: String?, shellPid: pid_t?) {
        // Find shell processes that are descendants of Ghostty
        // Ghostty spawns shell processes directly as children
        let shellNames = ["zsh", "bash", "fish", "sh", "nu", "pwsh"]

        // Get all shell processes and check if they're descendants of Ghostty
        for shellName in shellNames {
            let task = Process()
            task.launchPath = "/usr/bin/pgrep"
            task.arguments = ["-P", String(appPid), shellName]

            let pipe = Pipe()
            task.standardOutput = pipe
            task.standardError = FileHandle.nullDevice

            do {
                try task.run()
                task.waitUntilExit()

                let data = pipe.fileHandleForReading.readDataToEndOfFile()
                if let output = String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines),
                   !output.isEmpty {
                    // Found direct child shell processes
                    let pids = output.components(separatedBy: "\n")
                    for pidStr in pids {
                        if let pid = pid_t(pidStr.trimmingCharacters(in: .whitespaces)) {
                            if let cwd = getCwdFromPid(pid) {
                                return (cwd, pid)
                            }
                        }
                    }
                }
            } catch {
                continue
            }
        }

        // Try to find shell processes in deeper levels (Ghostty might have intermediate processes)
        // Get all descendant processes and filter by shell names
        let allDescendants = getDescendantProcesses(of: appPid)
        for (pid, name) in allDescendants {
            if shellNames.contains(where: { name.contains($0) }) {
                if let cwd = getCwdFromPid(pid) {
                    return (cwd, pid)
                }
            }
        }

        return (nil, nil)
    }

    /// Get all descendant processes of a given PID
    private static func getDescendantProcesses(of parentPid: pid_t) -> [(pid: pid_t, name: String)] {
        var descendants: [(pid_t, String)] = []

        let task = Process()
        task.launchPath = "/bin/ps"
        task.arguments = ["-axo", "pid,ppid,comm"]

        let pipe = Pipe()
        task.standardOutput = pipe
        task.standardError = FileHandle.nullDevice

        do {
            try task.run()
            task.waitUntilExit()

            let data = pipe.fileHandleForReading.readDataToEndOfFile()
            guard let output = String(data: data, encoding: .utf8) else {
                return descendants
            }

            // Build parent-child relationships
            var childrenMap: [pid_t: [(pid: pid_t, name: String)]] = [:]
            let lines = output.components(separatedBy: "\n")

            for line in lines.dropFirst() { // Skip header
                let parts = line.trimmingCharacters(in: .whitespaces).components(separatedBy: CharacterSet.whitespaces)
                guard parts.count >= 3,
                      let pid = pid_t(parts[0]),
                      let ppid = pid_t(parts[1]) else {
                    continue
                }
                let name = parts.dropFirst(2).joined(separator: " ")
                childrenMap[ppid, default: []].append((pid, name))
            }

            // BFS to find all descendants
            var queue: [pid_t] = [parentPid]
            var visited: Set<pid_t> = [parentPid]

            while !queue.isEmpty {
                let current = queue.removeFirst()
                if let children = childrenMap[current] {
                    for child in children {
                        if !visited.contains(child.pid) {
                            visited.insert(child.pid)
                            descendants.append(child)
                            queue.append(child.pid)
                        }
                    }
                }
            }
        } catch {
            // Ignore errors
        }

        return descendants
    }
}
