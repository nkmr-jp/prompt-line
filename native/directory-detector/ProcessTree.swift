import Foundation

// MARK: - Process Tree Traversal

extension DirectoryDetector {

    // MARK: - Process Node

    /// Process info for building process tree
    struct ProcessNode {
        let pid: pid_t
        let ppid: pid_t
        let command: String
    }

    // MARK: - TTY Modification Time

    /// Get TTY modification time for a process
    static func getTtyModTime(for pid: pid_t) -> TimeInterval? {
        // Get TTY for the process
        let psProcess = Process()
        psProcess.executableURL = URL(fileURLWithPath: "/bin/ps")
        psProcess.arguments = ["-p", String(pid), "-o", "tty="]

        let psPipe = Pipe()
        psProcess.standardOutput = psPipe
        psProcess.standardError = FileHandle.nullDevice

        do {
            try psProcess.run()
            psProcess.waitUntilExit()

            let psData = psPipe.fileHandleForReading.readDataToEndOfFile()
            guard let ttyOutput = String(data: psData, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines),
                  !ttyOutput.isEmpty,
                  ttyOutput != "??" else {
                return nil
            }

            // Convert tty name to device path
            let ttyPath: String
            if ttyOutput.hasPrefix("/dev/") {
                ttyPath = ttyOutput
            } else {
                ttyPath = "/dev/\(ttyOutput)"
            }

            // Get modification time of the TTY device
            let fileManager = FileManager.default
            if let attrs = try? fileManager.attributesOfItem(atPath: ttyPath),
               let modDate = attrs[.modificationDate] as? Date {
                return modDate.timeIntervalSince1970
            }
        } catch {
            // Ignore errors
        }
        return nil
    }

    // MARK: - IDE Terminal Directory Detection (Fast Method)

    /// Fast method to get IDE terminal directory using pgrep
    /// This is a simplified version that's much faster than full process tree traversal
    /// Enhanced with early termination: returns immediately when a non-home directory is found
    /// Uses libproc for ~10-50x faster CWD detection compared to lsof
    static func getIDETerminalDirectoryFast(idePid: pid_t, projectNameHint: String? = nil) -> (directory: String?, shellPid: pid_t?) {
        // Use pgrep to quickly find shell processes with the IDE as ancestor
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/pgrep")
        process.arguments = ["-P", String(idePid), "-x", "zsh|bash|fish|sh"]

        let pipe = Pipe()
        process.standardOutput = pipe
        process.standardError = FileHandle.nullDevice

        do {
            try process.run()
            process.waitUntilExit()

            let data = pipe.fileHandleForReading.readDataToEndOfFile()
            guard let output = String(data: data, encoding: .utf8) else {
                return (nil, nil)
            }

            // Get direct child shells
            let shellPids = output.split(separator: "\n").compactMap { Int32(String($0)) }

            guard !shellPids.isEmpty else {
                return (nil, nil)
            }

            let homeDir = FileManager.default.homeDirectoryForCurrentUser.path

            // Early termination optimization: If we have a project name hint,
            // check matching shells first for immediate return
            if let projectName = projectNameHint {
                for pid in shellPids {
                    if let cwd = getCwdFromPid(pid) {
                        let components = cwd.components(separatedBy: "/")
                        if components.contains(where: { $0.lowercased().contains(projectName.lowercased()) }) {
                            // Found matching project directory - return immediately
                            return (cwd, pid)
                        }
                    }
                }
            }

            // Early termination: Return first non-home directory found
            // This avoids checking all shells when we find a good match early
            var firstHomeDir: (cwd: String, pid: pid_t)? = nil

            for pid in shellPids {
                if let cwd = getCwdFromPid(pid) {
                    if cwd != homeDir {
                        // Found non-home directory - return immediately (early termination!)
                        return (cwd, pid)
                    }
                    // Remember first home dir as fallback
                    if firstHomeDir == nil {
                        firstHomeDir = (cwd, pid)
                    }
                }
            }

            // All shells are in home directory, return the first one
            if let fallback = firstHomeDir {
                return (fallback.cwd, fallback.pid)
            }

            return (nil, nil)
        } catch {
            return (nil, nil)
        }
    }

    // MARK: - Process Tree Building

    /// Get all processes with a single ps command (much faster than multiple pgrep calls)
    static func getAllProcessNodes() -> [pid_t: ProcessNode] {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/bin/ps")
        process.arguments = ["-ax", "-o", "pid,ppid,comm"]

        let pipe = Pipe()
        process.standardOutput = pipe
        process.standardError = FileHandle.nullDevice

        do {
            try process.run()
            process.waitUntilExit()

            let data = pipe.fileHandleForReading.readDataToEndOfFile()
            guard let output = String(data: data, encoding: .utf8) else {
                return [:]
            }

            var nodes: [pid_t: ProcessNode] = [:]
            let lines = output.split(separator: "\n").map { String($0) }

            // Skip header line
            for line in lines.dropFirst() {
                let trimmed = line.trimmingCharacters(in: .whitespaces)
                let components = trimmed.split(separator: " ", maxSplits: 2, omittingEmptySubsequences: true)
                if components.count >= 3,
                   let pid = Int32(components[0]),
                   let ppid = Int32(components[1]) {
                    let command = String(components[2])
                    nodes[pid] = ProcessNode(pid: pid, ppid: ppid, command: command)
                }
            }

            return nodes
        } catch {
            return [:]
        }
    }

    /// Build children map from process nodes (parent -> [children])
    static func buildChildrenMap(_ nodes: [pid_t: ProcessNode]) -> [pid_t: [pid_t]] {
        var childrenMap: [pid_t: [pid_t]] = [:]
        for (pid, node) in nodes {
            if childrenMap[node.ppid] == nil {
                childrenMap[node.ppid] = []
            }
            childrenMap[node.ppid]?.append(pid)
        }
        return childrenMap
    }

    /// Get all descendant PIDs from process tree in memory (no external calls)
    static func getDescendantsFromTree(_ rootPid: pid_t, childrenMap: [pid_t: [pid_t]], maxDepth: Int = 6) -> [pid_t] {
        var descendants: [pid_t] = []
        var toProcess: [(pid: pid_t, depth: Int)] = [(rootPid, 0)]

        while !toProcess.isEmpty {
            let (currentPid, depth) = toProcess.removeFirst()
            if depth >= maxDepth { continue }

            if let children = childrenMap[currentPid] {
                for child in children {
                    descendants.append(child)
                    toProcess.append((child, depth + 1))
                }
            }
        }

        return descendants
    }

    /// Check if command name is a shell
    /// Handles formats like: "zsh", "/bin/zsh", "zsh (qterm)", "-zsh"
    static func isShellCommand(_ command: String) -> Bool {
        let shellNames = ["zsh", "bash", "fish", "sh"]
        let baseName = (command as NSString).lastPathComponent.lowercased()

        // Check exact match
        if shellNames.contains(baseName) {
            return true
        }

        // Check if starts with shell name (handles "zsh (qterm)" format)
        for shell in shellNames {
            if baseName == shell || baseName == "-\(shell)" || baseName.hasPrefix("\(shell) ") || baseName.hasPrefix("-\(shell) ") {
                return true
            }
        }

        return false
    }

    // MARK: - Electron IDE Terminal Detection

    /// Electron IDE terminal directory detection using targeted pty-host search
    /// This method is designed for Electron-based IDEs (VSCode, Cursor, Windsurf)
    /// where shell processes are children of the "pty-host" process
    static func getElectronIDETerminalDirectory(appPid: pid_t, bundleId: String) -> (directory: String?, shellPid: pid_t?) {
        // Fast approach: Find "pty-host" process under the Electron app
        // Shell processes are direct children of pty-host
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/pgrep")
        process.arguments = ["-P", String(appPid), "-f", "pty-host"]

        let pipe = Pipe()
        process.standardOutput = pipe
        process.standardError = FileHandle.nullDevice

        do {
            try process.run()
            process.waitUntilExit()

            let data = pipe.fileHandleForReading.readDataToEndOfFile()
            guard let output = String(data: data, encoding: .utf8) else {
                // pty-host not found, try fallback
                return getElectronIDETerminalDirectoryFallback(appPid: appPid)
            }

            // Get pty-host PIDs
            let ptyHostPids = output.split(separator: "\n").compactMap { Int32(String($0)) }
            if ptyHostPids.isEmpty {
                // pty-host not found, try fallback
                return getElectronIDETerminalDirectoryFallback(appPid: appPid)
            }

            // For each pty-host, find shell children
            for ptyHostPid in ptyHostPids {
                // Find shells that are children of this pty-host
                let shellProcess = Process()
                shellProcess.executableURL = URL(fileURLWithPath: "/usr/bin/pgrep")
                shellProcess.arguments = ["-P", String(ptyHostPid)]

                let shellPipe = Pipe()
                shellProcess.standardOutput = shellPipe
                shellProcess.standardError = FileHandle.nullDevice

                try shellProcess.run()
                shellProcess.waitUntilExit()

                let shellData = shellPipe.fileHandleForReading.readDataToEndOfFile()
                guard let shellOutput = String(data: shellData, encoding: .utf8) else {
                    continue
                }

                // Get shell PIDs and sort by newest first
                let shellPids = shellOutput.split(separator: "\n")
                    .compactMap { Int32(String($0)) }
                    .sorted(by: >)

                let homeDir = FileManager.default.homeDirectoryForCurrentUser.path

                // Check each shell, prefer non-home directories
                for shellPid in shellPids.prefix(5) {
                    if let cwd = getCwdFromPid(shellPid), cwd != homeDir {
                        return (cwd, shellPid)
                    }
                }

                // Fallback: return first shell even if in home directory
                if let firstPid = shellPids.first, let cwd = getCwdFromPid(firstPid) {
                    return (cwd, firstPid)
                }
            }

            // pty-host found but no shells, try fallback
            return getElectronIDETerminalDirectoryFallback(appPid: appPid)
        } catch {
            return getElectronIDETerminalDirectoryFallback(appPid: appPid)
        }
    }

    /// Fallback method for Electron IDE terminal directory detection
    /// Uses pgrep for fast shell discovery and single ps call for parent map building
    /// This handles cases where pty-host is not found (e.g., some VSCode configurations)
    static func getElectronIDETerminalDirectoryFallback(appPid: pid_t) -> (directory: String?, shellPid: pid_t?) {
        // Step 1: Get all shell processes using pgrep (very fast)
        let pgrepProcess = Process()
        pgrepProcess.executableURL = URL(fileURLWithPath: "/usr/bin/pgrep")
        pgrepProcess.arguments = ["-f", "zsh|bash|fish"]

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

            // Step 3: For each shell, check if it's a descendant of the IDE
            var ideShells: [pid_t] = []

            for shellPid in shellPids {
                if isDescendantOf(shellPid, ancestorPid: appPid, parentMap: parentMap, maxDepth: 10) {
                    ideShells.append(shellPid)
                }
            }

            if ideShells.isEmpty {
                return (nil, nil)
            }

            let homeDir = FileManager.default.homeDirectoryForCurrentUser.path

            // Step 4: Check CWD of each IDE shell, prefer non-home directories
            for shellPid in ideShells.prefix(5) {
                if let cwd = getCwdFromPid(shellPid), cwd != homeDir {
                    return (cwd, shellPid)
                }
            }

            // Fallback: return first shell even if in home directory
            if let firstPid = ideShells.first, let cwd = getCwdFromPid(firstPid) {
                return (cwd, firstPid)
            }

            return (nil, nil)
        } catch {
            return (nil, nil)
        }
    }

    /// Build parent map (pid -> ppid) from ps output - optimized version
    static func buildParentMapFast() -> [pid_t: pid_t] {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/bin/ps")
        process.arguments = ["-axo", "pid=,ppid="]

        let pipe = Pipe()
        process.standardOutput = pipe
        process.standardError = FileHandle.nullDevice

        do {
            try process.run()
            process.waitUntilExit()

            let data = pipe.fileHandleForReading.readDataToEndOfFile()
            guard let output = String(data: data, encoding: .utf8) else {
                return [:]
            }

            var parentMap: [pid_t: pid_t] = [:]

            // Parse output - each line is "PID PPID"
            for line in output.split(separator: "\n") {
                let components = line.split(separator: " ", omittingEmptySubsequences: true)
                if components.count >= 2,
                   let pid = Int32(components[0]),
                   let ppid = Int32(components[1]) {
                    parentMap[pid] = ppid
                }
            }

            return parentMap
        } catch {
            return [:]
        }
    }

    /// Check if a process is a descendant of another process by traversing the parent chain
    static func isDescendantOf(_ pid: pid_t, ancestorPid: pid_t, parentMap: [pid_t: pid_t], maxDepth: Int) -> Bool {
        var currentPid = pid
        var depth = 0

        while depth < maxDepth {
            guard let ppid = parentMap[currentPid] else {
                return false
            }

            if ppid == ancestorPid {
                return true
            }

            // Reached init/launchd or invalid state
            if ppid <= 1 {
                return false
            }

            currentPid = ppid
            depth += 1
        }

        return false
    }

    // MARK: - Get shell PID from tty

    static func getShellPidFromTty(_ tty: String) -> pid_t? {
        // Use ps to find the foreground process for this tty
        // ps -t <tty> -o pid,stat,comm gives us processes on that tty
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/bin/ps")

        // Extract tty name (e.g., /dev/ttys001 -> ttys001)
        let ttyName = tty.replacingOccurrences(of: "/dev/", with: "")

        process.arguments = ["-t", ttyName, "-o", "pid,stat,comm", "-r"]

        let pipe = Pipe()
        process.standardOutput = pipe
        process.standardError = FileHandle.nullDevice

        do {
            try process.run()
            process.waitUntilExit()

            let data = pipe.fileHandleForReading.readDataToEndOfFile()
            guard let output = String(data: data, encoding: .utf8) else {
                return nil
            }

            // Parse output to find the foreground process (first line after header with + in STAT)
            let lines = output.split(separator: "\n").map { String($0) }

            // Skip header and find the foreground process
            for line in lines.dropFirst() {
                let components = line.split(separator: " ", omittingEmptySubsequences: true)
                if components.count >= 2 {
                    // STAT contains + for foreground process
                    let stat = String(components[1])
                    if stat.contains("+") || stat.contains("s") {
                        if let pid = Int32(String(components[0])) {
                            return pid
                        }
                    }
                }
            }

            // Fallback: return the first process (usually the shell)
            for line in lines.dropFirst() {
                let components = line.split(separator: " ", omittingEmptySubsequences: true)
                if components.count >= 1 {
                    if let pid = Int32(String(components[0])) {
                        return pid
                    }
                }
            }

            return nil
        } catch {
            return nil
        }
    }
}
