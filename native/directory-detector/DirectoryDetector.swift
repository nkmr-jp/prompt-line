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
/// Note: FileSearch functionality has been moved to separate file-searcher tool
class DirectoryDetector {

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

        // Check for Ghostty terminal (native Swift terminal with process-based detection)
        if isGhostty(bundleId) {
            let (directory, shellPid) = getGhosttyDirectory(appPid: appPid)

            if let cwd = directory {
                var result: [String: Any] = [
                    "success": true,
                    "directory": cwd,
                    "appName": appName,
                    "bundleId": bundleId,
                    "method": "ghostty-process"
                ]

                if let pid = shellPid {
                    result["pid"] = pid
                }

                return result
            }

            return [
                "error": "Failed to detect directory from Ghostty",
                "appName": appName,
                "bundleId": bundleId
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
}
