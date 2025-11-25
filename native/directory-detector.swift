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

    static let `default` = FileSearchSettings(
        respectGitignore: true,
        excludePatterns: [],
        includePatterns: [],
        maxFiles: 5000,
        includeHidden: false,
        maxDepth: nil
    )

    /// Parse settings from command line arguments
    static func fromArguments(_ args: [String]) -> FileSearchSettings {
        var respectGitignore = true
        var excludePatterns: [String] = []
        var includePatterns: [String] = []
        var maxFiles = 5000
        var includeHidden = false
        var maxDepth: Int? = nil

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
            maxDepth: maxDepth
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

    /// Get project directory from IDE window title using Accessibility API
    /// Most IDEs show the project path or name in the window title
    static func getDirectoryFromWindowTitle(pid: pid_t, bundleId: String) -> String? {
        let appRef = AXUIElementCreateApplication(pid)

        var windowsRef: CFTypeRef?
        let result = AXUIElementCopyAttributeValue(appRef, kAXWindowsAttribute as CFString, &windowsRef)

        guard result == .success,
              let windows = windowsRef as? [AXUIElement],
              let frontWindow = windows.first else {
            return nil
        }

        var titleRef: CFTypeRef?
        let titleResult = AXUIElementCopyAttributeValue(frontWindow, kAXTitleAttribute as CFString, &titleRef)

        guard titleResult == .success,
              let title = titleRef as? String else {
            return nil
        }

        // Parse project path from window title
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

    /// Fast method to get IDE terminal directory using pgrep
    /// This is a simplified version that's much faster than full process tree traversal
    static func getIDETerminalDirectoryFast(idePid: pid_t) -> (directory: String?, shellPid: pid_t?) {
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

            // Try each shell, preferring higher PIDs (newer processes)
            let sortedPids = shellPids.sorted(by: >)
            let homeDir = FileManager.default.homeDirectoryForCurrentUser.path

            for pid in sortedPids {
                if let cwd = getCwdFromPid(pid) {
                    if cwd != homeDir || sortedPids.count == 1 {
                        return (cwd, pid)
                    }
                }
            }

            // If all in home dir, return first
            if let firstPid = sortedPids.first,
               let cwd = getCwdFromPid(firstPid) {
                return (cwd, firstPid)
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

    static func getCwdFromPid(_ pid: pid_t) -> String? {
        // Use lsof to get the current working directory with timeout
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/sbin/lsof")
        process.arguments = ["-a", "-p", String(pid), "-d", "cwd", "-F", "n"]

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

    // MARK: - Get file list from directory

    static func getFileList(from directory: String) -> [[String: Any]]? {
        let fileManager = FileManager.default

        do {
            let contents = try fileManager.contentsOfDirectory(atPath: directory)
            var files: [[String: Any]] = []

            for item in contents {
                let fullPath = (directory as NSString).appendingPathComponent(item)

                var fileInfo: [String: Any] = [
                    "name": item,
                    "path": fullPath
                ]

                do {
                    let attributes = try fileManager.attributesOfItem(atPath: fullPath)

                    if let fileType = attributes[.type] as? FileAttributeType {
                        fileInfo["isDirectory"] = (fileType == .typeDirectory)
                        fileInfo["isSymlink"] = (fileType == .typeSymbolicLink)
                    }

                    if let size = attributes[.size] as? Int64 {
                        fileInfo["size"] = size
                    }

                    if let modDate = attributes[.modificationDate] as? Date {
                        fileInfo["modifiedAt"] = ISO8601DateFormatter().string(from: modDate)
                    }
                } catch {
                    fileInfo["isDirectory"] = false
                    fileInfo["error"] = "Failed to get attributes"
                }

                files.append(fileInfo)
            }

            // Sort: directories first, then by name
            files.sort { (a, b) in
                let aIsDir = a["isDirectory"] as? Bool ?? false
                let bIsDir = b["isDirectory"] as? Bool ?? false

                if aIsDir != bIsDir {
                    return aIsDir
                }

                let aName = a["name"] as? String ?? ""
                let bName = b["name"] as? String ?? ""
                return aName.localizedCaseInsensitiveCompare(bName) == .orderedAscending
            }

            return files
        } catch {
            return nil
        }
    }

    // MARK: - Quick File List (Single Level with Excludes)

    /// Get file list from directory with default excludes applied (Stage 1: Quick mode)
    /// Only returns files from the immediate directory (no recursion)
    static func getFileListQuick(from directory: String, settings: FileSearchSettings = .default) -> [[String: Any]]? {
        let fileManager = FileManager.default

        do {
            let contents = try fileManager.contentsOfDirectory(atPath: directory)
            var files: [[String: Any]] = []

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

                var fileInfo: [String: Any] = [
                    "name": item,
                    "path": fullPath
                ]

                do {
                    let attributes = try fileManager.attributesOfItem(atPath: fullPath)

                    if let fileType = attributes[.type] as? FileAttributeType {
                        fileInfo["isDirectory"] = (fileType == .typeDirectory)
                        fileInfo["isSymlink"] = (fileType == .typeSymbolicLink)
                    }

                    if let size = attributes[.size] as? Int64 {
                        fileInfo["size"] = size
                    }

                    if let modDate = attributes[.modificationDate] as? Date {
                        fileInfo["modifiedAt"] = ISO8601DateFormatter().string(from: modDate)
                    }
                } catch {
                    fileInfo["isDirectory"] = false
                }

                files.append(fileInfo)
            }

            // Sort: directories first, then by name
            files.sort { (a, b) in
                let aIsDir = a["isDirectory"] as? Bool ?? false
                let bIsDir = b["isDirectory"] as? Bool ?? false

                if aIsDir != bIsDir {
                    return aIsDir
                }

                let aName = a["name"] as? String ?? ""
                let bName = b["name"] as? String ?? ""
                return aName.localizedCaseInsensitiveCompare(bName) == .orderedAscending
            }

            return files
        } catch {
            return nil
        }
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

        return regex
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
        maxFiles: Int
    ) -> [[String: Any]]? {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: fdPath)
        process.currentDirectoryURL = URL(fileURLWithPath: directory)

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

        // Depth limit
        if let depth = maxDepth {
            args.append("--max-depth")
            args.append(String(depth))
        }

        // Exclude patterns (only for normal search, not include patterns)
        if includePattern == nil {
            for exclude in excludePatterns {
                args.append("--exclude")
                args.append(exclude)
            }

            // Add default excludes
            for exclude in DEFAULT_EXCLUDES {
                args.append("--exclude")
                args.append(exclude)
            }
        }

        // Search pattern
        if let pattern = includePattern {
            let regexPattern = convertGlobToRegex(pattern)
            args.append(regexPattern)
        } else {
            args.append(".")  // Match all files
        }

        process.arguments = args

        let outputPipe = Pipe()
        let errorPipe = Pipe()
        process.standardOutput = outputPipe
        process.standardError = errorPipe

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
                fputs("fd process timed out\n", stderr)
                return nil
            }

            if process.terminationStatus != 0 && !timedOut {
                let errorData = errorPipe.fileHandleForReading.readDataToEndOfFile()
                if let errorString = String(data: errorData, encoding: .utf8), !errorString.isEmpty {
                    fputs("fd error: \(errorString)\n", stderr)
                }
                return nil
            }

            let outputData = outputPipe.fileHandleForReading.readDataToEndOfFile()
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
                if let attributes = try? FileManager.default.attributesOfItem(atPath: path) {
                    if let size = attributes[.size] as? Int64 {
                        fileInfo["size"] = size
                    }
                    if let modDate = attributes[.modificationDate] as? Date {
                        fileInfo["modifiedAt"] = ISO8601DateFormatter().string(from: modDate)
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

    // MARK: - find Integration (Fallback)

    /// Execute find search as fallback when fd is not available
    static func executeFindSearch(
        directory: String,
        excludePatterns: [String],
        includeHidden: Bool,
        maxDepth: Int?,
        maxFiles: Int
    ) -> [[String: Any]]? {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/find")
        process.currentDirectoryURL = URL(fileURLWithPath: directory)

        var args: [String] = ["."]

        // Depth limit
        if let depth = maxDepth {
            args.append("-maxdepth")
            args.append(String(depth))
        }

        // File type
        args.append("-type")
        args.append("f")

        // Exclude patterns
        let allExcludes = DEFAULT_EXCLUDES + excludePatterns
        for exclude in allExcludes {
            args.append("-not")
            args.append("-path")
            args.append("*/\(exclude)/*")
        }

        // Exclude hidden files if not included
        if !includeHidden {
            args.append("-not")
            args.append("-path")
            args.append("*/.*")
            args.append("-not")
            args.append("-name")
            args.append(".*")
        }

        process.arguments = args

        let outputPipe = Pipe()
        let errorPipe = Pipe()
        process.standardOutput = outputPipe
        process.standardError = errorPipe

        do {
            try process.run()

            // Timeout processing (5 seconds)
            let semaphore = DispatchSemaphore(value: 0)

            DispatchQueue.global(qos: .userInitiated).async {
                process.waitUntilExit()
                semaphore.signal()
            }

            let result = semaphore.wait(timeout: .now() + 5.0)
            if result == .timedOut {
                process.terminate()
                fputs("find process timed out\n", stderr)
                return nil
            }

            let outputData = outputPipe.fileHandleForReading.readDataToEndOfFile()
            guard let outputString = String(data: outputData, encoding: .utf8) else {
                return nil
            }

            let lines = outputString.components(separatedBy: "\n").filter { !$0.isEmpty }
            var fileList: [[String: Any]] = []

            for line in lines.prefix(maxFiles) {
                var path = line.trimmingCharacters(in: .whitespaces)

                // Convert relative path to absolute
                if path.hasPrefix("./") {
                    path = (directory as NSString).appendingPathComponent(String(path.dropFirst(2)))
                } else if !path.hasPrefix("/") {
                    path = (directory as NSString).appendingPathComponent(path)
                }

                let fileName = URL(fileURLWithPath: path).lastPathComponent

                var fileInfo: [String: Any] = [
                    "name": fileName,
                    "path": path,
                    "isDirectory": false
                ]

                // Get file attributes
                if let attributes = try? FileManager.default.attributesOfItem(atPath: path) {
                    if let size = attributes[.size] as? Int64 {
                        fileInfo["size"] = size
                    }
                    if let modDate = attributes[.modificationDate] as? Date {
                        fileInfo["modifiedAt"] = ISO8601DateFormatter().string(from: modDate)
                    }
                }

                fileList.append(fileInfo)
            }

            return fileList
        } catch {
            fputs("Failed to execute find: \(error.localizedDescription)\n", stderr)
            return nil
        }
    }

    // MARK: - Recursive File List (fd/find integration)

    /// Get file list recursively using fd (preferred) or find (fallback)
    /// Stage 2: Full recursive scan
    static func getFileListRecursive(from directory: String, settings: FileSearchSettings = .default) -> [[String: Any]]? {
        var allFiles: [[String: Any]] = []

        if let fdPath = getFdPath() {
            // Step 1: Normal search (respecting .gitignore + excludePatterns)
            if let normalFiles = executeFdSearch(
                fdPath: fdPath,
                directory: directory,
                respectGitignore: settings.respectGitignore,
                excludePatterns: settings.excludePatterns,
                includePattern: nil,
                includeHidden: settings.includeHidden,
                maxDepth: settings.maxDepth,
                maxFiles: settings.maxFiles
            ) {
                allFiles.append(contentsOf: normalFiles)
            }

            // Step 2: Include patterns (ignoring .gitignore for these specific patterns)
            if !settings.includePatterns.isEmpty {
                for pattern in settings.includePatterns {
                    if let includedFiles = executeFdSearch(
                        fdPath: fdPath,
                        directory: directory,
                        respectGitignore: false,  // Ignore .gitignore for include patterns
                        excludePatterns: [],      // No excludes for include patterns
                        includePattern: pattern,
                        includeHidden: true,      // Allow hidden files in include patterns
                        maxDepth: settings.maxDepth,
                        maxFiles: settings.maxFiles
                    ) {
                        allFiles.append(contentsOf: includedFiles)
                    }
                }
            }
        } else {
            // Fallback to find command
            if let findFiles = executeFindSearch(
                directory: directory,
                excludePatterns: settings.excludePatterns,
                includeHidden: settings.includeHidden,
                maxDepth: settings.maxDepth,
                maxFiles: settings.maxFiles
            ) {
                allFiles.append(contentsOf: findFiles)
            }
        }

        // Step 3: Remove duplicates (by path)
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

        // Check file count limit
        if uniqueFiles.count > settings.maxFiles {
            fputs("Warning: File count (\(uniqueFiles.count)) exceeds limit (\(settings.maxFiles))\n", stderr)
            return Array(uniqueFiles.prefix(settings.maxFiles))
        }

        // Sort by name
        uniqueFiles.sort { (a, b) in
            let aName = a["name"] as? String ?? ""
            let bName = b["name"] as? String ?? ""
            return aName.localizedCaseInsensitiveCompare(bName) == .orderedAscending
        }

        return uniqueFiles
    }

    // MARK: - Detect with Files (Quick and Recursive modes)

    /// Detect current directory with quick file list (Stage 1)
    static func detectCurrentDirectoryWithFilesQuick(
        overridePid: pid_t? = nil,
        overrideBundleId: String? = nil,
        settings: FileSearchSettings = .default
    ) -> [String: Any] {
        var result = detectCurrentDirectory(overridePid: overridePid, overrideBundleId: overrideBundleId)

        guard result["error"] == nil,
              let directory = result["directory"] as? String else {
            return result
        }

        if let files = getFileListQuick(from: directory, settings: settings) {
            result["files"] = files
            result["fileCount"] = files.count
            result["partial"] = true  // Indicates this is Stage 1 (partial) data
            result["searchMode"] = "quick"
        } else {
            result["files"] = []
            result["fileCount"] = 0
            result["filesError"] = "Failed to list files"
        }

        return result
    }

    /// Detect current directory with recursive file list (Stage 2)
    static func detectCurrentDirectoryWithFilesRecursive(
        overridePid: pid_t? = nil,
        overrideBundleId: String? = nil,
        settings: FileSearchSettings = .default
    ) -> [String: Any] {
        var result = detectCurrentDirectory(overridePid: overridePid, overrideBundleId: overrideBundleId)

        guard result["error"] == nil,
              let directory = result["directory"] as? String else {
            return result
        }

        if let files = getFileListRecursive(from: directory, settings: settings) {
            result["files"] = files
            result["fileCount"] = files.count
            result["partial"] = false  // Indicates this is Stage 2 (complete) data
            result["searchMode"] = "recursive"
            result["usedFd"] = isFdAvailable()
        } else {
            result["files"] = []
            result["fileCount"] = 0
            result["filesError"] = "Failed to list files recursively"
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
                // JetBrains IDEs: Try window title first (usually contains full path)
                if let directory = getDirectoryFromWindowTitle(pid: appPid, bundleId: bundleId) {
                    return [
                        "success": true,
                        "directory": directory,
                        "appName": appName,
                        "bundleId": bundleId,
                        "idePid": appPid,
                        "method": "window-title"
                    ]
                }

                // Fallback: Shell processes are direct children of the IDE process
                let (directory, shellPid) = getIDETerminalDirectoryFast(idePid: appPid)

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

    static func detectCurrentDirectoryWithFiles(overridePid: pid_t? = nil, overrideBundleId: String? = nil) -> [String: Any] {
        var result = detectCurrentDirectory(overridePid: overridePid, overrideBundleId: overrideBundleId)

        guard result["error"] == nil,
              let directory = result["directory"] as? String else {
            return result
        }

        if let files = getFileList(from: directory) {
            result["files"] = files
            result["fileCount"] = files.count
        } else {
            result["files"] = []
            result["fileCount"] = 0
            result["filesError"] = "Failed to list files"
        }

        return result
    }

    static func listDirectory(_ path: String) -> [String: Any] {
        let expandedPath = NSString(string: path).expandingTildeInPath

        let fileManager = FileManager.default
        var isDir: ObjCBool = false

        guard fileManager.fileExists(atPath: expandedPath, isDirectory: &isDir) else {
            return ["error": "Path does not exist", "path": expandedPath]
        }

        guard isDir.boolValue else {
            return ["error": "Path is not a directory", "path": expandedPath]
        }

        if let files = getFileList(from: expandedPath) {
            return [
                "success": true,
                "directory": expandedPath,
                "files": files,
                "fileCount": files.count
            ]
        } else {
            return [
                "error": "Failed to list files",
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
        fputs("  detect-with-files [--pid <pid> --bundleId <bundleId>] - Detect current directory and list files\n", stderr)
        fputs("  detect-with-files --quick [options] - Quick mode: list files from current directory only (Stage 1)\n", stderr)
        fputs("  detect-with-files --recursive [options] - Recursive mode: list all files recursively (Stage 2)\n", stderr)
        fputs("  list <path>      - List files in specified directory\n", stderr)
        fputs("  list-quick <path> - List files from directory with excludes (no recursion)\n", stderr)
        fputs("  list-recursive <path> [options] - List files recursively with fd/find\n", stderr)
        fputs("  check-fd         - Check if fd command is available\n", stderr)
        fputs("\nOptions:\n", stderr)
        fputs("  --pid <pid>        - Use specific process ID instead of frontmost app\n", stderr)
        fputs("  --bundleId <id>    - Bundle ID of the app (required with --pid)\n", stderr)
        fputs("  --quick            - Stage 1: Quick mode (current directory only)\n", stderr)
        fputs("  --recursive        - Stage 2: Recursive mode (all subdirectories)\n", stderr)
        fputs("  --no-gitignore     - Don't respect .gitignore files (fd only)\n", stderr)
        fputs("  --exclude <pattern> - Add exclude pattern (can be used multiple times)\n", stderr)
        fputs("  --include <pattern> - Add include pattern for .gitignored files (can be used multiple times)\n", stderr)
        fputs("  --max-files <n>    - Maximum number of files to return (default: 5000)\n", stderr)
        fputs("  --include-hidden   - Include hidden files (starting with .)\n", stderr)
        fputs("  --max-depth <n>    - Maximum directory depth to search\n", stderr)
        exit(1)
    }

    let command = arguments[1]
    let result: [String: Any]

    // Parse optional --pid and --bundleId arguments
    var overridePid: pid_t? = nil
    var overrideBundleId: String? = nil
    var isQuickMode = false
    var isRecursiveMode = false

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
        } else if arguments[i] == "--quick" {
            isQuickMode = true
            i += 1
        } else if arguments[i] == "--recursive" {
            isRecursiveMode = true
            i += 1
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
        if isQuickMode {
            // Stage 1: Quick mode
            result = DirectoryDetector.detectCurrentDirectoryWithFilesQuick(
                overridePid: overridePid,
                overrideBundleId: overrideBundleId,
                settings: settings
            )
        } else if isRecursiveMode {
            // Stage 2: Recursive mode
            result = DirectoryDetector.detectCurrentDirectoryWithFilesRecursive(
                overridePid: overridePid,
                overrideBundleId: overrideBundleId,
                settings: settings
            )
        } else {
            // Default: Original behavior (single level, no excludes)
            result = DirectoryDetector.detectCurrentDirectoryWithFiles(overridePid: overridePid, overrideBundleId: overrideBundleId)
        }

    case "list":
        guard arguments.count >= 3 else {
            fputs("Error: 'list' command requires a path argument\n", stderr)
            exit(1)
        }
        let path = arguments[2]
        result = DirectoryDetector.listDirectory(path)

    case "list-quick":
        guard arguments.count >= 3 else {
            fputs("Error: 'list-quick' command requires a path argument\n", stderr)
            exit(1)
        }
        let path = arguments[2]
        let expandedPath = NSString(string: path).expandingTildeInPath

        let fileManager = FileManager.default
        var isDir: ObjCBool = false

        guard fileManager.fileExists(atPath: expandedPath, isDirectory: &isDir) else {
            result = ["error": "Path does not exist", "path": expandedPath]
            break
        }

        guard isDir.boolValue else {
            result = ["error": "Path is not a directory", "path": expandedPath]
            break
        }

        if let files = DirectoryDetector.getFileListQuick(from: expandedPath, settings: settings) {
            result = [
                "success": true,
                "directory": expandedPath,
                "files": files,
                "fileCount": files.count,
                "searchMode": "quick",
                "partial": true
            ]
        } else {
            result = ["error": "Failed to list files", "directory": expandedPath]
        }

    case "list-recursive":
        guard arguments.count >= 3 else {
            fputs("Error: 'list-recursive' command requires a path argument\n", stderr)
            exit(1)
        }
        let path = arguments[2]
        let expandedPath = NSString(string: path).expandingTildeInPath

        let fileManager = FileManager.default
        var isDir: ObjCBool = false

        guard fileManager.fileExists(atPath: expandedPath, isDirectory: &isDir) else {
            result = ["error": "Path does not exist", "path": expandedPath]
            break
        }

        guard isDir.boolValue else {
            result = ["error": "Path is not a directory", "path": expandedPath]
            break
        }

        if let files = DirectoryDetector.getFileListRecursive(from: expandedPath, settings: settings) {
            result = [
                "success": true,
                "directory": expandedPath,
                "files": files,
                "fileCount": files.count,
                "searchMode": "recursive",
                "partial": false,
                "usedFd": DirectoryDetector.isFdAvailable()
            ]
        } else {
            result = ["error": "Failed to list files recursively", "directory": expandedPath]
        }

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
