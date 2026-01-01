import Cocoa
import ApplicationServices
import Foundation

// MARK: - IDE Detection

extension DirectoryDetector {

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

    /// Check if bundle ID is Antigravity (Google IDE)
    static func isAntigravity(_ bundleId: String) -> Bool {
        return bundleId == "com.google.antigravity"
    }

    /// Check if bundle ID is Kiro (AWS IDE)
    static func isKiro(_ bundleId: String) -> Bool {
        return bundleId == "dev.kiro.desktop"
    }

    /// Check if bundle ID is an Electron-based IDE (VSCode, Cursor, Windsurf, Antigravity, Kiro)
    /// These IDEs have a different process hierarchy than JetBrains IDEs
    static func isElectronIDE(_ bundleId: String) -> Bool {
        return isVSCode(bundleId) || isCursor(bundleId) || isWindsurf(bundleId) || isAntigravity(bundleId) || isKiro(bundleId)
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
    static func extractProjectNameFromTitle(_ title: String) -> String? {
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
}
