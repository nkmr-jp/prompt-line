import Cocoa
import ApplicationServices
import Foundation

// MARK: - DirectoryDetector

/// Main class for directory detection from terminals and IDEs
/// Methods are organized across multiple files using extensions:
/// - CWDDetector.swift: CWD detection (libproc + lsof)
/// - TerminalDetector.swift: Terminal.app, iTerm2
/// - IDEDetector.swift: JetBrains, VSCode, Cursor, Windsurf
/// - ProcessTree.swift: Process tree traversal
/// - FileSearch.swift: fd integration, file listing
class DirectoryDetector {

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

    // MARK: - List Directory

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
