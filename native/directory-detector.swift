import Cocoa
import ApplicationServices
import Foundation

// MARK: - File Search Settings

struct FileSearchSettings {
    let respectGitignore: Bool
    let excludePatterns: [String]
    let includePatterns: [String]
    let maxFiles: Int
    let includeHidden: Bool
    let maxDepth: Int?
    let followSymlinks: Bool

    static let `default` = FileSearchSettings(
        respectGitignore: true,
        excludePatterns: [],
        includePatterns: [],
        maxFiles: 5000,
        includeHidden: true,
        maxDepth: nil,
        followSymlinks: false
    )

    /// Parse settings from command line arguments
    static func fromArguments(_ args: [String]) -> FileSearchSettings {
        var respectGitignore = true
        var excludePatterns: [String] = []
        var includePatterns: [String] = []
        var maxFiles = 5000
        var includeHidden = true
        var maxDepth: Int? = nil
        var followSymlinks = false

        var i = 0
        while i < args.count {
            switch args[i] {
            case "--no-gitignore":
                respectGitignore = false
                i += 1
            case "--exclude":
                if i + 1 < args.count {
                    excludePatterns.append(args[i + 1])
                    i += 2
                } else {
                    i += 1
                }
            case "--include":
                if i + 1 < args.count {
                    includePatterns.append(args[i + 1])
                    i += 2
                } else {
                    i += 1
                }
            case "--max-files":
                if i + 1 < args.count, let value = Int(args[i + 1]) {
                    maxFiles = value
                    i += 2
                } else {
                    i += 1
                }
            case "--include-hidden":
                includeHidden = true
                i += 1
            case "--max-depth":
                if i + 1 < args.count, let value = Int(args[i + 1]) {
                    maxDepth = value
                    i += 2
                } else {
                    i += 1
                }
            case "--follow-symlinks":
                followSymlinks = true
                i += 1
            default:
                i += 1
            }
        }

        return FileSearchSettings(
            respectGitignore: respectGitignore,
            excludePatterns: excludePatterns,
            includePatterns: includePatterns,
            maxFiles: maxFiles,
            includeHidden: includeHidden,
            maxDepth: maxDepth,
            followSymlinks: followSymlinks
        )
    }
}

class DirectoryDetector {

    // MARK: - Default Excludes

    /// Default patterns to exclude from file search
    /// These are common directories/files that should not be searched
    static let DEFAULT_EXCLUDES: [String] = [
        // Dependencies
        "node_modules", "vendor", "bower_components", ".pnpm",
        // Build outputs
        ".next", ".nuxt", "dist", "build", "out", "target", ".output",
        // Version control
        ".git", ".svn", ".hg",
        // IDE
        ".idea", ".vscode", ".fleet",
        // Cache
        ".cache", "__pycache__", ".pytest_cache", ".mypy_cache", ".ruff_cache",
        // OS
        ".DS_Store", "Thumbs.db",
        // Other
        "coverage", ".nyc_output", ".turbo", ".vercel", ".netlify"
    ]

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

    // MARK: - IDE support (JetBrains, VSCode, etc.)

    /// Check if bundle ID is a JetBrains IDE
    static func isJetBrainsIDE(_ bundleId: String) -> Bool {
        return bundleId.hasPrefix("com.jetbrains.")
    }

    /// Check if bundle ID is VSCode or similar
    static func isVSCode(_ bundleId: String) -> Bool {
        return bundleId == "com.microsoft.VSCode" ||
               bundleId == "com.microsoft.VSCodeInsiders" ||
               bundleId == "com.vscodium.VSCodium"
    }

    /// Check if bundle ID is Cursor
    static func isCursor(_ bundleId: String) -> Bool {
        return bundleId == "com.todesktop.230313mzl4w4u92"
    }

    /// Check if bundle ID is Windsurf
    static func isWindsurf(_ bundleId: String) -> Bool {
        return bundleId == "com.exafunction.windsurf"
    }

    /// Check if bundle ID is an Electron-based IDE (VSCode, Cursor, Windsurf)
    /// These IDEs have a different process hierarchy than JetBrains IDEs
    static func isElectronIDE(_ bundleId: String) -> Bool {
        return isVSCode(bundleId) || isCursor(bundleId) || isWindsurf(bundleId)
    }

    /// Check if the app is an IDE with integrated terminal
    static func isIDEWithTerminal(_ bundleId: String) -> Bool {
        return isJetBrainsIDE(bundleId) || isElectronIDE(bundleId)
    }

    /// Get the focused window title for an application using Accessibility API
    /// Uses kAXFocusedWindowAttribute to get the currently focused window (not just the first window)
    static func getWindowTitle(pid: pid_t, bundleId: String) -> String? {
        let appRef = AXUIElementCreateApplication(pid)

        // First, try to get the focused window (most reliable for multi-window scenarios)
        var focusedWindowRef: CFTypeRef?
        let focusedResult = AXUIElementCopyAttributeValue(appRef, kAXFocusedWindowAttribute as CFString, &focusedWindowRef)

        var targetWindow: AXUIElement?

        if focusedResult == .success, let focusedWindow = focusedWindowRef {
            // Note: AXUIElement is a toll-free bridged CoreFoundation type
            // The guard let above ensures focusedWindow is not nil, so force unwrap is safe
            targetWindow = (focusedWindow as! AXUIElement)
        } else {
            // Fallback: try to get the first window from the windows list
            var windowsRef: CFTypeRef?
            let result = AXUIElementCopyAttributeValue(appRef, kAXWindowsAttribute as CFString, &windowsRef)

            guard result == .success,
                  let windows = windowsRef as? [AXUIElement],
                  let firstWindow = windows.first else {
                return nil
            }
            targetWindow = firstWindow
        }

        guard let window = targetWindow else {
            return nil
        }

        var titleRef: CFTypeRef?
        let titleResult = AXUIElementCopyAttributeValue(window, kAXTitleAttribute as CFString, &titleRef)

        guard titleResult == .success,
              let title = titleRef as? String else {
            return nil
        }

        return title
    }

    /// Parse project directory path from window title
    /// Returns nil if no valid path is found in the title
    static func parsePathFromWindowTitle(_ title: String, bundleId: String) -> String? {
        // JetBrains format: "project-name – path/to/project – filename.ext"
        // VSCode format: "filename.ext — project-name" or "filename - project-name - Visual Studio Code"

        if isJetBrainsIDE(bundleId) {
            // JetBrains: look for path after " – " (en dash)
            let parts = title.components(separatedBy: " – ")
            if parts.count >= 2 {
                // Second part usually contains the path
                let pathCandidate = parts[1].trimmingCharacters(in: .whitespaces)
                if pathCandidate.hasPrefix("/") || pathCandidate.hasPrefix("~") {
                    let expandedPath = NSString(string: pathCandidate).expandingTildeInPath
                    if FileManager.default.fileExists(atPath: expandedPath) {
                        return expandedPath
                    }
                }
            }
        }

        if isVSCode(bundleId) {
            // VSCode: look for path in various formats
            // Try to find a path that starts with / or ~
            let candidates = title.components(separatedBy: CharacterSet(charactersIn: "—-"))
            for candidate in candidates {
                let trimmed = candidate.trimmingCharacters(in: .whitespaces)
                if trimmed.hasPrefix("/") || trimmed.hasPrefix("~") {
                    let expandedPath = NSString(string: trimmed).expandingTildeInPath
                    if FileManager.default.fileExists(atPath: expandedPath) {
                        return expandedPath
                    }
                }
            }
        }

        return nil
    }

    /// Get project directory from IDE window title using Accessibility API (legacy function for compatibility)
    /// Most IDEs show the project path or name in the window title
    /// Uses kAXFocusedWindowAttribute to get the currently focused window (not just the first window)
    static func getDirectoryFromWindowTitle(pid: pid_t, bundleId: String) -> String? {
        guard let title = getWindowTitle(pid: pid, bundleId: bundleId) else {
            return nil
        }
        return parsePathFromWindowTitle(title, bundleId: bundleId)
    }

    /// Extract project name from JetBrains IDE window title
    /// Window title format: "project-name – file.ext [branch]" or "project-name – path/to/file [branch]"
    private static func extractProjectNameFromTitle(_ title: String) -> String? {
        // JetBrains format: first part before " – " is usually the project name
        let parts = title.components(separatedBy: " – ")
        if let projectPart = parts.first {
            let projectName = projectPart.trimmingCharacters(in: .whitespaces)
            // Exclude empty or obviously wrong values
            if !projectName.isEmpty && !projectName.hasPrefix("/") {
                return projectName
            }
        }
        return nil
    }

    /// Get TTY modification time for a process
    private static func getTtyModTime(for pid: pid_t) -> TimeInterval? {
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

    // MARK: - Electron IDE terminal directory detection (optimized single-pass method)

    /// Process info for building process tree
    private struct ProcessNode {
        let pid: pid_t
        let ppid: pid_t
        let command: String
    }

    /// Get all processes with a single ps command (much faster than multiple pgrep calls)
    private static func getAllProcessNodes() -> [pid_t: ProcessNode] {
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
    private static func buildChildrenMap(_ nodes: [pid_t: ProcessNode]) -> [pid_t: [pid_t]] {
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
    private static func getDescendantsFromTree(_ rootPid: pid_t, childrenMap: [pid_t: [pid_t]], maxDepth: Int = 6) -> [pid_t] {
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
    private static func isShellCommand(_ command: String) -> Bool {
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
    private static func getElectronIDETerminalDirectoryFallback(appPid: pid_t) -> (directory: String?, shellPid: pid_t?) {
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
    private static func buildParentMapFast() -> [pid_t: pid_t] {
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
    private static func isDescendantOf(_ pid: pid_t, ancestorPid: pid_t, parentMap: [pid_t: pid_t], maxDepth: Int) -> Bool {
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

    // MARK: - Get current working directory from PID

    /// Get process CWD using libproc (10-50x faster than lsof)
    /// Performance: ~1-5ms vs 50-200ms for lsof
    static func getCwdFromPidFast(_ pid: pid_t) -> String? {
        var vnodeInfo = proc_vnodepathinfo()
        let size = MemoryLayout<proc_vnodepathinfo>.size

        let result = withUnsafeMutablePointer(to: &vnodeInfo) { pointer in
            proc_pidinfo(
                pid,
                PROC_PIDVNODEPATHINFO,
                0,
                pointer,
                Int32(size)
            )
        }

        guard result > 0 else {
            // Error: fall back to lsof
            return getCwdFromPidLsof(pid)
        }

        let cwdPath = withUnsafePointer(to: &vnodeInfo.pvi_cdir.vip_path) { pointer in
            pointer.withMemoryRebound(to: CChar.self, capacity: Int(MAXPATHLEN)) {
                String(cString: $0)
            }
        }

        return cwdPath.isEmpty ? nil : cwdPath
    }

    /// Original lsof-based implementation (fallback)
    /// Performance: ~50-200ms per call
    static func getCwdFromPidLsof(_ pid: pid_t) -> String? {
        // Use lsof to get the current working directory with timeout
        // Added -n -P flags to skip DNS resolution and port name conversion
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/sbin/lsof")
        process.arguments = ["-n", "-P", "-a", "-p", String(pid), "-d", "cwd", "-F", "n"]

        let pipe = Pipe()
        process.standardOutput = pipe
        process.standardError = FileHandle.nullDevice

        do {
            try process.run()

            // Add 1 second timeout to prevent hanging on unresponsive processes
            let semaphore = DispatchSemaphore(value: 0)
            var result: String?

            DispatchQueue.global(qos: .userInitiated).async {
                process.waitUntilExit()
                semaphore.signal()
            }

            let waitResult = semaphore.wait(timeout: .now() + 1.0)

            if waitResult == .timedOut {
                process.terminate()
                return nil
            }

            let data = pipe.fileHandleForReading.readDataToEndOfFile()
            guard let output = String(data: data, encoding: .utf8) else {
                return nil
            }

            // Parse lsof -F output (field output format)
            // Lines starting with 'n' contain the name (path)
            for line in output.split(separator: "\n") {
                let lineStr = String(line)
                if lineStr.hasPrefix("n") && !lineStr.hasPrefix("ncwd") {
                    result = String(lineStr.dropFirst())
                    break
                }
            }

            return result
        } catch {
            return nil
        }
    }

    /// Main entry point with automatic fallback
    static func getCwdFromPid(_ pid: pid_t) -> String? {
        return getCwdFromPidFast(pid)
    }

    // MARK: - fd Integration

    /// Check if fd command is available
    static func isFdAvailable() -> Bool {
        return getFdPath() != nil
    }

    /// Get the path to fd command
    static func getFdPath() -> String? {
        let fdPaths = [
            "/opt/homebrew/bin/fd",  // Apple Silicon Homebrew
            "/usr/local/bin/fd",     // Intel Homebrew
            "/usr/bin/fd"            // System
        ]

        for path in fdPaths {
            if FileManager.default.fileExists(atPath: path) {
                return path
            }
        }
        return nil
    }

    /// Convert glob pattern to regex for fd
    /// Note: fd uses --absolute-path, so patterns must match absolute paths
    static func convertGlobToRegex(_ pattern: String) -> String {
        var regex = pattern

        // Escape special regex characters (except * and ?)
        regex = regex.replacingOccurrences(of: ".", with: "\\.")
        regex = regex.replacingOccurrences(of: "[", with: "\\[")
        regex = regex.replacingOccurrences(of: "]", with: "\\]")
        regex = regex.replacingOccurrences(of: "(", with: "\\(")
        regex = regex.replacingOccurrences(of: ")", with: "\\)")
        regex = regex.replacingOccurrences(of: "+", with: "\\+")
        regex = regex.replacingOccurrences(of: "^", with: "\\^")
        regex = regex.replacingOccurrences(of: "$", with: "\\$")

        // **/ to .* (match any path)
        regex = regex.replacingOccurrences(of: "\\*\\*/", with: ".*/")

        // ** to .* (match any characters including /)
        regex = regex.replacingOccurrences(of: "\\*\\*", with: ".*")

        // * to [^/]* (match any characters except /)
        regex = regex.replacingOccurrences(of: "\\*", with: "[^/]*")

        // ? to . (match single character)
        regex = regex.replacingOccurrences(of: "?", with: ".")

        // Prepend pattern to match absolute paths
        // If pattern doesn't start with /, add .* prefix so it matches anywhere in the path
        if !regex.hasPrefix("/") && !regex.hasPrefix("\\.") {
            regex = ".*/" + regex
        }

        // Append $ to match end of path (ensure pattern matches the file, not a substring)
        regex = regex + "$"

        return regex
    }

    /// Parse a glob pattern into directory and file pattern components
    /// e.g., "dist/**/*.js" -> ("dist", "*.js")
    /// e.g., ".storybook/**/*" -> (".storybook", "*")
    /// e.g., "node_modules/**/*" -> ("node_modules", "*")
    static func parseGlobPattern(_ pattern: String) -> (directory: String?, filePattern: String) {
        // Find the first ** or * in the pattern
        if let starRange = pattern.range(of: "**") {
            let beforeStar = String(pattern[..<starRange.lowerBound])
            let afterStar = String(pattern[starRange.upperBound...])

            // Remove trailing slash from directory
            var dir = beforeStar.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
            if dir.isEmpty {
                dir = "."
            }

            // Extract file pattern (e.g., "/*.js" -> "*.js")
            var filePattern = afterStar.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
            if filePattern.isEmpty {
                filePattern = "*"
            }

            return (dir, filePattern)
        }

        // No ** found, use the pattern as-is
        return (nil, pattern)
    }

    /// Execute fd search with given parameters
    static func executeFdSearch(
        fdPath: String,
        directory: String,
        respectGitignore: Bool,
        excludePatterns: [String],
        includePattern: String?,
        includeHidden: Bool,
        maxDepth: Int?,
        maxFiles: Int,
        skipAttributes: Bool = false,  // Skip file attributes for large directory searches
        followSymlinks: Bool = false   // Follow symbolic links
    ) -> [[String: Any]]? {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: fdPath)

        // Determine search directory and pattern
        var searchDirectory = directory
        var searchPattern: String
        var useGlob = false

        if let pattern = includePattern {
            // Parse the include pattern to extract directory and file pattern
            let parsed = parseGlobPattern(pattern)

            if let subDir = parsed.directory {
                // Use the parsed directory relative to the base directory
                let subDirPath = URL(fileURLWithPath: directory).appendingPathComponent(subDir).path
                if FileManager.default.fileExists(atPath: subDirPath) {
                    searchDirectory = subDirPath
                    searchPattern = parsed.filePattern
                    useGlob = true
                } else {
                    // Directory doesn't exist, skip this pattern
                    fputs("Include pattern directory not found: \(subDirPath)\n", stderr)
                    return []
                }
            } else {
                searchPattern = parsed.filePattern
                useGlob = true
            }
        } else {
            searchPattern = "."  // Match all files
        }

        process.currentDirectoryURL = URL(fileURLWithPath: searchDirectory)

        var args: [String] = [
            "--type", "f",           // Files only
            "--color", "never",      // No color output
            "--absolute-path"        // Absolute paths
        ]

        // .gitignore setting
        if !respectGitignore {
            args.append("--no-ignore")
            args.append("--no-ignore-vcs")
        }

        // Hidden files setting
        if includeHidden {
            args.append("--hidden")
        }

        // Note: We don't use --follow here because we handle symlink directories
        // separately in getFileListRecursive() to preserve symlink paths in results

        // Depth limit
        if let depth = maxDepth {
            args.append("--max-depth")
            args.append(String(depth))
        }

        // Exclude patterns (always apply user-specified excludes)
        for exclude in excludePatterns {
            args.append("--exclude")
            args.append(exclude)
        }

        // Add default excludes only for normal search (not include patterns)
        if includePattern == nil {
            for exclude in DEFAULT_EXCLUDES {
                args.append("--exclude")
                args.append(exclude)
            }
        }

        // Search pattern
        if useGlob {
            args.append("--glob")
            args.append(searchPattern)
        } else {
            args.append(searchPattern)
        }

        process.arguments = args

        let outputPipe = Pipe()
        let errorPipe = Pipe()
        process.standardOutput = outputPipe
        process.standardError = errorPipe

        // Use async pipe reading to prevent deadlock with large output
        // (Pipe buffer is ~64KB, but fd can output 2MB+ for node_modules)
        var outputData = Data()
        var errorData = Data()
        let outputLock = NSLock()
        let errorLock = NSLock()

        // Set up async reading handlers BEFORE running the process
        outputPipe.fileHandleForReading.readabilityHandler = { handle in
            let data = handle.availableData
            if !data.isEmpty {
                outputLock.lock()
                outputData.append(data)
                outputLock.unlock()
            }
        }

        errorPipe.fileHandleForReading.readabilityHandler = { handle in
            let data = handle.availableData
            if !data.isEmpty {
                errorLock.lock()
                errorData.append(data)
                errorLock.unlock()
            }
        }

        do {
            try process.run()

            // Timeout processing (5 seconds)
            let semaphore = DispatchSemaphore(value: 0)
            var timedOut = false

            DispatchQueue.global(qos: .userInitiated).async {
                process.waitUntilExit()
                semaphore.signal()
            }

            let result = semaphore.wait(timeout: .now() + 5.0)
            if result == .timedOut {
                process.terminate()
                timedOut = true
                // Clean up handlers
                outputPipe.fileHandleForReading.readabilityHandler = nil
                errorPipe.fileHandleForReading.readabilityHandler = nil
                fputs("fd process timed out\n", stderr)
                return nil
            }

            // Clean up handlers after process exits
            outputPipe.fileHandleForReading.readabilityHandler = nil
            errorPipe.fileHandleForReading.readabilityHandler = nil

            // Read any remaining data in the pipes
            outputLock.lock()
            let remainingOutput = outputPipe.fileHandleForReading.availableData
            if !remainingOutput.isEmpty {
                outputData.append(remainingOutput)
            }
            outputLock.unlock()

            if process.terminationStatus != 0 && !timedOut {
                errorLock.lock()
                let remainingError = errorPipe.fileHandleForReading.availableData
                if !remainingError.isEmpty {
                    errorData.append(remainingError)
                }
                if let errorString = String(data: errorData, encoding: .utf8), !errorString.isEmpty {
                    fputs("fd error: \(errorString)\n", stderr)
                }
                errorLock.unlock()
                return nil
            }

            guard let outputString = String(data: outputData, encoding: .utf8) else {
                return nil
            }

            // Parse output (each line is one file)
            let lines = outputString.components(separatedBy: "\n").filter { !$0.isEmpty }
            var fileList: [[String: Any]] = []

            for line in lines.prefix(maxFiles) {
                let path = line.trimmingCharacters(in: .whitespaces)
                let fileName = URL(fileURLWithPath: path).lastPathComponent

                var fileInfo: [String: Any] = [
                    "name": fileName,
                    "path": path,
                    "isDirectory": false
                ]

                // Get file attributes (optional, for size and modifiedAt)
                // Skip for include pattern searches to improve performance on large directories
                if !skipAttributes {
                    if let attributes = try? FileManager.default.attributesOfItem(atPath: path) {
                        if let size = attributes[.size] as? Int64 {
                            fileInfo["size"] = size
                        }
                        if let modDate = attributes[.modificationDate] as? Date {
                            fileInfo["modifiedAt"] = ISO8601DateFormatter().string(from: modDate)
                        }
                    }
                }

                fileList.append(fileInfo)
            }

            return fileList
        } catch {
            fputs("Failed to execute fd: \(error.localizedDescription)\n", stderr)
            return nil
        }
    }


    // MARK: - Recursive File List (fd/find integration)

    /// Find symlink directories in the given directory (single level)
    /// Returns array of tuples: (symlinkPath, resolvedPath)
    static func findSymlinkDirectories(in directory: String, settings: FileSearchSettings) -> [(symlinkPath: String, resolvedPath: String)] {
        let fileManager = FileManager.default
        var symlinkDirs: [(symlinkPath: String, resolvedPath: String)] = []

        guard let contents = try? fileManager.contentsOfDirectory(atPath: directory) else {
            return symlinkDirs
        }

        let allExcludes = DEFAULT_EXCLUDES + settings.excludePatterns

        for item in contents {
            // Skip hidden files unless explicitly included
            if !settings.includeHidden && item.hasPrefix(".") {
                continue
            }

            // Skip excluded patterns
            if allExcludes.contains(item) {
                continue
            }

            let fullPath = (directory as NSString).appendingPathComponent(item)

            // Check if it's a symbolic link
            guard let attrs = try? fileManager.attributesOfItem(atPath: fullPath),
                  let fileType = attrs[.type] as? FileAttributeType,
                  fileType == .typeSymbolicLink else {
                continue
            }

            // Resolve the symlink and check if it points to a directory
            guard let resolvedPath = try? fileManager.destinationOfSymbolicLink(atPath: fullPath) else {
                continue
            }

            // Handle relative paths
            let absoluteResolvedPath: String
            if resolvedPath.hasPrefix("/") {
                absoluteResolvedPath = resolvedPath
            } else {
                absoluteResolvedPath = (directory as NSString).appendingPathComponent(resolvedPath)
            }

            // Normalize the path
            let normalizedPath = (absoluteResolvedPath as NSString).standardizingPath

            // Check if the resolved path is a directory
            var isDir: ObjCBool = false
            if fileManager.fileExists(atPath: normalizedPath, isDirectory: &isDir), isDir.boolValue {
                symlinkDirs.append((symlinkPath: fullPath, resolvedPath: normalizedPath))
            }
        }

        return symlinkDirs
    }

    /// Result type for getFileList function
    struct FileListResult {
        let files: [[String: Any]]
        let fileLimitReached: Bool
        let maxFiles: Int
    }

    /// Get file list recursively using fd
    /// fd is required - returns nil if fd is not available
    static func getFileList(from directory: String, settings: FileSearchSettings = .default) -> FileListResult? {
        // fd is required
        guard let fdPath = getFdPath() else {
            fputs("fd not found. Please install fd: brew install fd\n", stderr)
            return nil
        }

        var allFiles: [[String: Any]] = []

        // Step 1: Normal search (respecting .gitignore + excludePatterns)
        // Note: Don't use --follow here to avoid resolving symlink paths
        if let normalFiles = executeFdSearch(
            fdPath: fdPath,
            directory: directory,
            respectGitignore: settings.respectGitignore,
            excludePatterns: settings.excludePatterns,
            includePattern: nil,
            includeHidden: settings.includeHidden,
            maxDepth: settings.maxDepth,
            maxFiles: settings.maxFiles,
            skipAttributes: true,
            followSymlinks: false  // Don't follow symlinks in main search
        ) {
            allFiles.append(contentsOf: normalFiles)
        }

        // Step 2: Search inside symlink directories with symlink path preserved
        if settings.followSymlinks {
            let symlinkDirs = findSymlinkDirectories(in: directory, settings: settings)
            for (symlinkPath, resolvedPath) in symlinkDirs {
                // Search inside the resolved directory
                if let symlinkFiles = executeFdSearch(
                    fdPath: fdPath,
                    directory: resolvedPath,
                    respectGitignore: settings.respectGitignore,
                    excludePatterns: settings.excludePatterns,
                    includePattern: nil,
                    includeHidden: settings.includeHidden,
                    maxDepth: settings.maxDepth,
                    maxFiles: settings.maxFiles,
                    skipAttributes: true,
                    followSymlinks: false  // Don't recursively follow symlinks
                ) {
                    // Replace resolved path with symlink path in results
                    for var file in symlinkFiles {
                        if let path = file["path"] as? String {
                            // Replace the resolved path prefix with the symlink path
                            let newPath = path.replacingOccurrences(of: resolvedPath, with: symlinkPath)
                            file["path"] = newPath
                        }
                        allFiles.append(file)
                    }
                }
            }
        }

        // Step 3: Include patterns (ignoring .gitignore for these specific patterns)
        // Skip file attributes for large directory searches like node_modules
        if !settings.includePatterns.isEmpty {
            for pattern in settings.includePatterns {
                if let includedFiles = executeFdSearch(
                    fdPath: fdPath,
                    directory: directory,
                    respectGitignore: false,  // Ignore .gitignore for include patterns
                    excludePatterns: settings.excludePatterns,  // Apply user-specified excludes
                    includePattern: pattern,
                    includeHidden: true,      // Allow hidden files in include patterns
                    maxDepth: settings.maxDepth,
                    maxFiles: settings.maxFiles,
                    skipAttributes: true,     // Skip file attributes for performance
                    followSymlinks: false     // Don't follow symlinks in include patterns
                ) {
                    allFiles.append(contentsOf: includedFiles)
                }
            }
        }

        // Step 4: Remove duplicates (by path)
        var uniquePaths = Set<String>()
        var uniqueFiles: [[String: Any]] = []

        for file in allFiles {
            if let path = file["path"] as? String {
                if !uniquePaths.contains(path) {
                    uniquePaths.insert(path)
                    uniqueFiles.append(file)
                }
            }
        }

        // Step 5: Filter out root-owned files for security
        uniqueFiles = filterOutRootOwnedFiles(uniqueFiles)

        // Check file count limit
        var fileLimitReached = false
        if uniqueFiles.count > settings.maxFiles {
            fputs("Warning: File count (\(uniqueFiles.count)) exceeds limit (\(settings.maxFiles))\n", stderr)
            uniqueFiles = Array(uniqueFiles.prefix(settings.maxFiles))
            fileLimitReached = true
        }

        // Sort by name
        uniqueFiles.sort { (a, b) in
            let aName = a["name"] as? String ?? ""
            let bName = b["name"] as? String ?? ""
            return aName.localizedCaseInsensitiveCompare(bName) == .orderedAscending
        }

        return FileListResult(files: uniqueFiles, fileLimitReached: fileLimitReached, maxFiles: settings.maxFiles)
    }

    /// Filter out files/directories owned by root (uid 0) for security
    static func filterOutRootOwnedFiles(_ files: [[String: Any]]) -> [[String: Any]] {
        let fileManager = FileManager.default
        return files.filter { file in
            guard let path = file["path"] as? String else { return true }

            // Get file attributes to check owner
            guard let attributes = try? fileManager.attributesOfItem(atPath: path),
                  let ownerAccountID = attributes[.ownerAccountID] as? NSNumber else {
                // If we can't get attributes, include the file (might be permission issue)
                return true
            }

            // Filter out files owned by root (uid 0)
            let uid = ownerAccountID.uint32Value
            if uid == 0 {
                return false
            }

            return true
        }
    }

    // MARK: - Git Repository Detection

    /// Check if a directory is inside a git repository
    /// Walks up the directory tree to find a .git directory
    static func isGitRepository(_ directory: String) -> Bool {
        let fileManager = FileManager.default
        var currentPath = directory

        // Walk up the directory tree
        while currentPath != "/" && !currentPath.isEmpty {
            let gitPath = (currentPath as NSString).appendingPathComponent(".git")

            // Check if .git exists (either as directory or file for worktrees)
            if fileManager.fileExists(atPath: gitPath) {
                return true
            }

            // Move to parent directory
            currentPath = (currentPath as NSString).deletingLastPathComponent
        }

        return false
    }

    // MARK: - Root-Owned Directory Detection

    /// Check if a directory is owned by root (uid 0)
    /// Used to disable file search for system directories like /Library
    static func isRootOwnedDirectory(_ directory: String) -> Bool {
        let fileManager = FileManager.default

        guard let attributes = try? fileManager.attributesOfItem(atPath: directory),
              let ownerAccountID = attributes[.ownerAccountID] as? NSNumber else {
            return false
        }

        // Root user has uid 0
        return ownerAccountID.uint32Value == 0
    }

    // MARK: - Detect with Files

    /// Detect current directory with file list
    static func detectCurrentDirectoryWithFiles(
        overridePid: pid_t? = nil,
        overrideBundleId: String? = nil,
        settings: FileSearchSettings = .default
    ) -> [String: Any] {
        var result = detectCurrentDirectory(overridePid: overridePid, overrideBundleId: overrideBundleId)

        guard result["error"] == nil,
              let directory = result["directory"] as? String else {
            return result
        }

        // Check if directory is inside a git repository
        let isGitRepo = isGitRepository(directory)
        result["isGitRepository"] = isGitRepo

        // Disable file search for root directory (/) for security
        if directory == "/" {
            result["files"] = []
            result["fileCount"] = 0
            result["filesDisabled"] = true
            result["filesDisabledReason"] = "File search is disabled for root directory"
            return result
        }

        // Disable file search for root-owned directories for security
        if isRootOwnedDirectory(directory) {
            result["files"] = []
            result["fileCount"] = 0
            result["filesDisabled"] = true
            result["filesDisabledReason"] = "File search is disabled for root-owned directories"
            return result
        }

        // For security and performance: enforce maxDepth=1 for non-git directories
        // This prevents deep recursive searches in arbitrary directories (e.g., home directory)
        var effectiveSettings = settings
        if !isGitRepo {
            effectiveSettings = FileSearchSettings(
                respectGitignore: settings.respectGitignore,
                excludePatterns: settings.excludePatterns,
                includePatterns: settings.includePatterns,
                maxFiles: settings.maxFiles,
                includeHidden: settings.includeHidden,
                maxDepth: 1,  // Force maxDepth=1 for non-git directories
                followSymlinks: settings.followSymlinks
            )
        }

        if let fileListResult = getFileList(from: directory, settings: effectiveSettings) {
            result["files"] = fileListResult.files
            result["fileCount"] = fileListResult.files.count
            result["partial"] = false  // Always complete with fd
            result["searchMode"] = "recursive"
            if fileListResult.fileLimitReached {
                result["fileLimitReached"] = true
                result["maxFiles"] = fileListResult.maxFiles
            }
        } else {
            result["files"] = []
            result["fileCount"] = 0
            result["filesError"] = "Failed to list files (fd required)"
        }

        return result
    }

    // MARK: - Main detection logic

    /// Detect current directory from the active terminal or IDE
    /// - Parameters:
    ///   - overridePid: Optional PID to use instead of frontmost app (for when caller window is in front)
    ///   - overrideBundleId: Optional bundle ID to use (can be used alone without PID - PID will be looked up)
    static func detectCurrentDirectory(overridePid: pid_t? = nil, overrideBundleId: String? = nil) -> [String: Any] {
        let appName: String
        let bundleId: String
        let appPid: pid_t

        if let bundle = overrideBundleId {
            // Bundle ID provided - use it to find the app
            bundleId = bundle

            if let pid = overridePid {
                // PID also provided - use it directly
                appPid = pid
                if let runningApp = NSWorkspace.shared.runningApplications.first(where: { $0.processIdentifier == pid }) {
                    appName = runningApp.localizedName ?? "Unknown"
                } else {
                    appName = "Unknown"
                }
            } else {
                // Only bundleId provided - look up the PID from bundleId
                guard let runningApp = NSRunningApplication.runningApplications(withBundleIdentifier: bundle).first else {
                    return ["error": "No running application found with bundle ID: \(bundle)"]
                }
                appPid = runningApp.processIdentifier
                appName = runningApp.localizedName ?? "Unknown"
            }
        } else {
            // Use frontmost application (default behavior)
            guard let frontApp = NSWorkspace.shared.frontmostApplication else {
                return ["error": "No active application found"]
            }
            appName = frontApp.localizedName ?? "Unknown"
            bundleId = frontApp.bundleIdentifier ?? ""
            appPid = frontApp.processIdentifier
        }

        // Check if this is an IDE with integrated terminal (JetBrains, VSCode, etc.)
        if isIDEWithTerminal(bundleId) {
            // For Electron IDEs, use process tree method directly (faster and more reliable)
            // Window title method uses Accessibility APIs that can hang without permission
            if isElectronIDE(bundleId) {
                // Electron IDEs (VSCode, Cursor, Windsurf): Use optimized process tree traversal
                // Shell processes are deeply nested in Electron's process hierarchy
                let (directory, shellPid) = getElectronIDETerminalDirectory(appPid: appPid, bundleId: bundleId)

                if let cwd = directory {
                    var result: [String: Any] = [
                        "success": true,
                        "directory": cwd,
                        "appName": appName,
                        "bundleId": bundleId,
                        "idePid": appPid,
                        "method": "electron-pty"
                    ]

                    if let pid = shellPid {
                        result["pid"] = pid
                    }

                    return result
                }
            } else if isJetBrainsIDE(bundleId) {
                // JetBrains IDEs: First try to get project name from focused window title
                // Then use it as a hint to find the correct shell process
                var projectNameHint: String? = nil

                // Try to get project name from window title first
                if let windowTitle = getWindowTitle(pid: appPid, bundleId: bundleId) {
                    projectNameHint = extractProjectNameFromTitle(windowTitle)

                    // Also try to extract full path from window title (some JetBrains versions include it)
                    if let directory = parsePathFromWindowTitle(windowTitle, bundleId: bundleId) {
                        return [
                            "success": true,
                            "directory": directory,
                            "appName": appName,
                            "bundleId": bundleId,
                            "idePid": appPid,
                            "method": "window-title"
                        ]
                    }
                }

                // Use project name as hint to find correct shell among multiple IDE terminals
                let (directory, shellPid) = getIDETerminalDirectoryFast(idePid: appPid, projectNameHint: projectNameHint)

                if let cwd = directory {
                    var result: [String: Any] = [
                        "success": true,
                        "directory": cwd,
                        "appName": appName,
                        "bundleId": bundleId,
                        "idePid": appPid,
                        "method": "ide-shell-fast"
                    ]

                    if let pid = shellPid {
                        result["pid"] = pid
                    }

                    return result
                }
            }

            // IDE detected but no directory found
            return [
                "error": "No project directory found in IDE",
                "appName": appName,
                "bundleId": bundleId,
                "idePid": appPid
            ]
        }

        // Standard terminal applications (Terminal.app, iTerm2)
        var tty: String?

        // Try to get tty based on the active application
        switch bundleId {
        case "com.apple.Terminal":
            tty = getTerminalTty()
        case "com.googlecode.iterm2":
            tty = getiTerm2Tty()
        default:
            // Not a supported application
            return [
                "error": "Not a supported terminal or IDE application",
                "appName": appName,
                "bundleId": bundleId
            ]
        }

        guard let ttyPath = tty else {
            return [
                "error": "Failed to get tty",
                "appName": appName,
                "bundleId": bundleId
            ]
        }

        guard let pid = getShellPidFromTty(ttyPath) else {
            return [
                "error": "Failed to get shell PID",
                "tty": ttyPath,
                "appName": appName,
                "bundleId": bundleId
            ]
        }

        guard let cwd = getCwdFromPid(pid) else {
            return [
                "error": "Failed to get current directory",
                "tty": ttyPath,
                "pid": pid,
                "appName": appName,
                "bundleId": bundleId
            ]
        }

        return [
            "success": true,
            "directory": cwd,
            "tty": ttyPath,
            "pid": pid,
            "appName": appName,
            "bundleId": bundleId,
            "method": "tty"
        ]
    }

    static func listDirectory(_ path: String, settings: FileSearchSettings = .default) -> [String: Any] {
        let expandedPath = NSString(string: path).expandingTildeInPath

        let fileManager = FileManager.default
        var isDir: ObjCBool = false

        guard fileManager.fileExists(atPath: expandedPath, isDirectory: &isDir) else {
            return ["error": "Path does not exist", "path": expandedPath]
        }

        guard isDir.boolValue else {
            return ["error": "Path is not a directory", "path": expandedPath]
        }

        // Check if directory is inside a git repository
        let isGitRepo = isGitRepository(expandedPath)

        // Disable file search for root directory (/) for security
        if expandedPath == "/" {
            return [
                "success": true,
                "directory": expandedPath,
                "files": [],
                "fileCount": 0,
                "isGitRepository": isGitRepo,
                "filesDisabled": true,
                "filesDisabledReason": "File search is disabled for root directory"
            ]
        }

        // For security and performance: enforce maxDepth=1 for non-git directories
        var effectiveSettings = settings
        if !isGitRepo {
            effectiveSettings = FileSearchSettings(
                respectGitignore: settings.respectGitignore,
                excludePatterns: settings.excludePatterns,
                includePatterns: settings.includePatterns,
                maxFiles: settings.maxFiles,
                includeHidden: settings.includeHidden,
                maxDepth: 1,  // Force maxDepth=1 for non-git directories
                followSymlinks: settings.followSymlinks
            )
        }

        if let fileListResult = getFileList(from: expandedPath, settings: effectiveSettings) {
            var result: [String: Any] = [
                "success": true,
                "directory": expandedPath,
                "files": fileListResult.files,
                "fileCount": fileListResult.files.count,
                "searchMode": "recursive",
                "partial": false,
                "isGitRepository": isGitRepo
            ]
            if fileListResult.fileLimitReached {
                result["fileLimitReached"] = true
                result["maxFiles"] = fileListResult.maxFiles
            }
            return result
        } else {
            return [
                "error": "Failed to list files (fd required)",
                "directory": expandedPath
            ]
        }
    }
}

func main() {
    let arguments = CommandLine.arguments

    guard arguments.count >= 2 else {
        fputs("Usage: \(arguments[0]) <command> [options]\n", stderr)
        fputs("Commands:\n", stderr)
        fputs("  detect [--pid <pid> --bundleId <bundleId>] - Detect current directory from active terminal\n", stderr)
        fputs("  detect-with-files [--pid <pid> --bundleId <bundleId>] [options] - Detect current directory and list files recursively with fd\n", stderr)
        fputs("  list <path> [options] - List files in specified directory recursively with fd\n", stderr)
        fputs("  check-fd         - Check if fd command is available\n", stderr)
        fputs("\nOptions:\n", stderr)
        fputs("  --pid <pid>        - Use specific process ID instead of frontmost app\n", stderr)
        fputs("  --bundleId <id>    - Bundle ID of the app (required with --pid)\n", stderr)
        fputs("  --no-gitignore     - Don't respect .gitignore files\n", stderr)
        fputs("  --exclude <pattern> - Add exclude pattern (can be used multiple times)\n", stderr)
        fputs("  --include <pattern> - Add include pattern for .gitignored files (can be used multiple times)\n", stderr)
        fputs("  --max-files <n>    - Maximum number of files to return (default: 5000)\n", stderr)
        fputs("  --include-hidden   - Include hidden files (starting with .)\n", stderr)
        fputs("  --max-depth <n>    - Maximum directory depth to search\n", stderr)
        fputs("  --follow-symlinks  - Follow symbolic links (default: false)\n", stderr)
        fputs("\nNote: fd (https://github.com/sharkdp/fd) is required for file listing.\n", stderr)
        fputs("      Install with: brew install fd\n", stderr)
        exit(1)
    }

    let command = arguments[1]
    let result: [String: Any]

    // Parse optional --pid and --bundleId arguments
    var overridePid: pid_t? = nil
    var overrideBundleId: String? = nil

    var i = 2
    while i < arguments.count {
        if arguments[i] == "--pid" && i + 1 < arguments.count {
            if let pid = Int32(arguments[i + 1]) {
                overridePid = pid
            }
            i += 2
        } else if arguments[i] == "--bundleId" && i + 1 < arguments.count {
            overrideBundleId = arguments[i + 1]
            i += 2
        } else {
            i += 1
        }
    }

    // Parse FileSearchSettings from arguments
    let settings = FileSearchSettings.fromArguments(Array(arguments.dropFirst(2)))

    switch command {
    case "detect":
        result = DirectoryDetector.detectCurrentDirectory(overridePid: overridePid, overrideBundleId: overrideBundleId)

    case "detect-with-files":
        result = DirectoryDetector.detectCurrentDirectoryWithFiles(
            overridePid: overridePid,
            overrideBundleId: overrideBundleId,
            settings: settings
        )

    case "list":
        guard arguments.count >= 3 else {
            fputs("Error: 'list' command requires a path argument\n", stderr)
            exit(1)
        }
        let path = arguments[2]
        result = DirectoryDetector.listDirectory(path, settings: settings)

    case "check-fd":
        let fdAvailable = DirectoryDetector.isFdAvailable()
        let fdPath = DirectoryDetector.getFdPath()
        result = [
            "fdAvailable": fdAvailable,
            "fdPath": fdPath ?? NSNull()
        ]

    default:
        fputs("Unknown command: \(command)\n", stderr)
        exit(1)
    }

    // Convert result to JSON and output
    do {
        let jsonData = try JSONSerialization.data(withJSONObject: result, options: [.sortedKeys])
        if let jsonString = String(data: jsonData, encoding: .utf8) {
            print(jsonString)
        }
    } catch {
        fputs("JSON serialization error: \(error.localizedDescription)\n", stderr)
        exit(1)
    }

    exit(0)
}

main()
