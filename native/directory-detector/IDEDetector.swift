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

    /// Check if bundle ID is Zed
    static func isZed(_ bundleId: String) -> Bool {
        return bundleId == "dev.zed.Zed"
    }

    /// Check if bundle ID is OpenCode
    static func isOpenCode(_ bundleId: String) -> Bool {
        return bundleId == "ai.opencode.desktop"
    }

    /// Check if bundle ID is an Electron-based IDE or similar (VSCode, Cursor, Windsurf, Antigravity, Kiro, Zed, OpenCode)
    /// These IDEs have a different process hierarchy than JetBrains IDEs
    /// Note: Zed and OpenCode are not Electron-based (Zed uses native, OpenCode uses Tauri) but use similar process tree detection
    static func isElectronIDE(_ bundleId: String) -> Bool {
        return isVSCode(bundleId) || isCursor(bundleId) || isWindsurf(bundleId) || isAntigravity(bundleId) || isKiro(bundleId) || isZed(bundleId) || isOpenCode(bundleId)
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

    // MARK: - Electron IDE Storage Fallback

    /// Get the Application Support directory name for an Electron IDE
    static func getElectronIDEAppSupportName(_ bundleId: String) -> String? {
        if bundleId == "com.microsoft.VSCode" { return "Code" }
        if bundleId == "com.microsoft.VSCodeInsiders" { return "Code - Insiders" }
        if bundleId == "com.vscodium.VSCodium" { return "VSCodium" }
        if isCursor(bundleId) { return "Cursor" }
        if isWindsurf(bundleId) { return "Windsurf" }
        if isKiro(bundleId) { return "Kiro" }
        return nil
    }

    /// Extract workspace name candidates from Electron IDE window title
    /// VSCode titles: "file.ext — FolderName", "FolderName", "● file.ext — FolderName"
    static func extractWorkspaceNamesFromElectronIDETitle(_ title: String) -> [String] {
        var cleanTitle = title
        // Remove leading indicators (● for unsaved changes)
        cleanTitle = cleanTitle.replacingOccurrences(of: "^[●◎]\\s*", with: "", options: .regularExpression)
        // Remove trailing brackets like [SSH: remote], [Extension Development Host]
        cleanTitle = cleanTitle.replacingOccurrences(of: "\\s*\\[.*\\]\\s*$", with: "", options: .regularExpression)

        var candidates: [String] = []

        // Split by " — " (em dash with spaces) - common VSCode separator
        let emDashParts = cleanTitle.components(separatedBy: " \u{2014} ")
        if emDashParts.count >= 2 {
            for part in emDashParts {
                let trimmed = part.trimmingCharacters(in: .whitespaces)
                if !trimmed.isEmpty {
                    candidates.append(trimmed)
                }
            }
        }

        // Also try splitting by " - " (regular dash) - some IDE variants
        let dashParts = cleanTitle.components(separatedBy: " - ")
        if dashParts.count >= 2 {
            for part in dashParts {
                let trimmed = part.trimmingCharacters(in: .whitespaces)
                if !trimmed.isEmpty && !candidates.contains(trimmed) {
                    candidates.append(trimmed)
                }
            }
        }

        // If no separator found, use the whole title
        if candidates.isEmpty {
            let trimmed = cleanTitle.trimmingCharacters(in: .whitespaces)
            if !trimmed.isEmpty {
                candidates.append(trimmed)
            }
        }

        // Filter out known app name suffixes
        let appNames = ["visual studio code", "vs code", "cursor", "windsurf", "kiro", "zed", "opencode"]
        candidates = candidates.filter { candidate in
            !appNames.contains(candidate.lowercased())
        }

        return candidates
    }

    /// Get project directory from Electron IDE's storage database (state.vscdb)
    /// Reads recently opened workspaces and matches against workspace name
    static func getDirectoryFromElectronIDEStorage(workspaceNames: [String], bundleId: String) -> String? {
        guard let appSupportName = getElectronIDEAppSupportName(bundleId) else {
            return nil
        }

        let homeDir = FileManager.default.homeDirectoryForCurrentUser.path
        let dbPath = "\(homeDir)/Library/Application Support/\(appSupportName)/User/globalStorage/state.vscdb"

        guard FileManager.default.fileExists(atPath: dbPath) else {
            return nil
        }

        // Query using sqlite3 command (available on macOS by default)
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/sqlite3")
        process.arguments = [dbPath, "SELECT value FROM ItemTable WHERE key = 'history.recentlyOpenedPathsList'"]

        let pipe = Pipe()
        process.standardOutput = pipe
        process.standardError = FileHandle.nullDevice

        do {
            try process.run()
            process.waitUntilExit()

            guard process.terminationStatus == 0 else {
                return nil
            }

            let data = pipe.fileHandleForReading.readDataToEndOfFile()
            guard let output = String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines),
                  !output.isEmpty,
                  let jsonData = output.data(using: .utf8),
                  let json = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any],
                  let entries = json["entries"] as? [[String: Any]] else {
                return nil
            }

            // Find matching workspace by folder name
            let lowercaseNames = workspaceNames.map { $0.lowercased() }
            for entry in entries {
                if let folderUri = entry["folderUri"] as? String,
                   folderUri.hasPrefix("file://") {
                    let path = String(folderUri.dropFirst(7)) // Remove "file://"
                    let decoded = path.removingPercentEncoding ?? path
                    let basename = (decoded as NSString).lastPathComponent
                    if lowercaseNames.contains(basename.lowercased()) {
                        if FileManager.default.fileExists(atPath: decoded) {
                            return decoded
                        }
                    }
                }
            }

            return nil
        } catch {
            return nil
        }
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

    /// Get project directory from JetBrains recent projects configuration file
    /// Searches ~/Library/Application Support/JetBrains/*/options/recentProjects.xml
    /// Matches by project name extracted from window title against entry key basenames
    static func getDirectoryFromRecentProjects(projectName: String) -> String? {
        let homeDir = FileManager.default.homeDirectoryForCurrentUser.path
        let jetbrainsDir = homeDir + "/Library/Application Support/JetBrains"
        let fileManager = FileManager.default

        guard let productDirs = try? fileManager.contentsOfDirectory(atPath: jetbrainsDir) else {
            return nil
        }

        // Compile regex patterns once outside the loop
        guard let entryRegex = try? NSRegularExpression(pattern: "entry key=\"([^\"]+)\""),
              let tsRegex = try? NSRegularExpression(pattern: "name=\"activationTimestamp\" value=\"(\\d+)\"") else {
            return nil
        }

        let projectSuffix = "/" + projectName
        var bestMatch: (path: String, timestamp: Int64)? = nil

        for productDir in productDirs {
            let recentProjectsPath = jetbrainsDir + "/" + productDir + "/options/recentProjects.xml"
            guard let xmlContent = try? String(contentsOfFile: recentProjectsPath, encoding: .utf8) else {
                continue
            }

            let matches = entryRegex.matches(in: xmlContent, range: NSRange(xmlContent.startIndex..., in: xmlContent))

            for match in matches {
                guard let keyRange = Range(match.range(at: 1), in: xmlContent) else {
                    continue
                }

                // Check suffix before allocating full String to avoid unnecessary work
                let keySubstring = xmlContent[keyRange]
                guard keySubstring.hasSuffix(projectSuffix) || keySubstring == projectName else {
                    continue
                }

                let key = String(keySubstring)
                let expandedPath = key.replacingOccurrences(of: "$USER_HOME$", with: homeDir)

                guard fileManager.fileExists(atPath: expandedPath) else {
                    continue
                }

                let timestamp = extractActivationTimestamp(xmlContent: xmlContent, entryKey: key, tsRegex: tsRegex)
                if let current = bestMatch {
                    if timestamp > current.timestamp {
                        bestMatch = (expandedPath, timestamp)
                    }
                } else {
                    bestMatch = (expandedPath, timestamp)
                }
            }
        }

        return bestMatch?.path
    }

    /// Extract activationTimestamp value from XML content for a specific entry
    /// Uses literal string search (not regex) for entryKey to avoid special character issues
    private static func extractActivationTimestamp(xmlContent: String, entryKey: String, tsRegex: NSRegularExpression) -> Int64 {
        guard let entryStart = xmlContent.range(of: "entry key=\"\(entryKey)\"") else {
            return 0
        }

        // Use </entry> tag as boundary instead of arbitrary character limit
        let searchStart = entryStart.upperBound
        let entryEnd = xmlContent.range(of: "</entry>", range: searchStart..<xmlContent.endIndex)
        let searchEnd = entryEnd?.lowerBound ?? xmlContent.endIndex
        let searchText = String(xmlContent[searchStart..<searchEnd])

        if let tsMatch = tsRegex.firstMatch(in: searchText, range: NSRange(searchText.startIndex..., in: searchText)),
           let tsRange = Range(tsMatch.range(at: 1), in: searchText) {
            return Int64(searchText[tsRange]) ?? 0
        }

        return 0
    }
}
