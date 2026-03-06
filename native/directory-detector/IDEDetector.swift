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

    // MARK: - Electron IDE Recent Workspaces

    /// Extract project name candidates from Electron-based IDE window title
    /// VSCode format: "filename.ext — project-name — Visual Studio Code"
    /// Cursor format: "filename.ext — project-name — Cursor"
    /// Returns meaningful title parts (excluding known app names) for matching
    static func extractProjectNameCandidatesFromElectronIDETitle(_ title: String) -> [String] {
        let parts = title.components(separatedBy: " — ")
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }

        let appNames: Set<String> = [
            "Visual Studio Code", "Visual Studio Code - Insiders", "VSCodium",
            "Cursor", "Windsurf", "Kiro", "Zed"
        ]

        return parts.filter { !appNames.contains($0) }
    }

    /// Get the User Data directory for an Electron-based IDE
    static func getElectronIDEUserDataDir(_ bundleId: String) -> String? {
        let homeDir = FileManager.default.homeDirectoryForCurrentUser.path
        let appSupport = homeDir + "/Library/Application Support"

        switch bundleId {
        case "com.microsoft.VSCode":
            return appSupport + "/Code"
        case "com.microsoft.VSCodeInsiders":
            return appSupport + "/Code - Insiders"
        case "com.vscodium.VSCodium":
            return appSupport + "/VSCodium"
        case "com.todesktop.230313mzl4w4u92":
            return appSupport + "/Cursor"
        case "com.exafunction.windsurf":
            return appSupport + "/Windsurf"
        case "dev.kiro.desktop":
            return appSupport + "/Kiro"
        default:
            return nil
        }
    }

    /// Extract folder path from a file:// URI string
    private static func pathFromFileURI(_ uri: String) -> String? {
        guard let url = URL(string: uri), url.scheme == "file" else {
            return nil
        }
        return url.path
    }

    /// Match project name candidates against folder paths
    /// Tries candidates in reverse order (last part is most likely the project name)
    private static func matchCandidatesAgainstFolders(_ candidates: [String], folders: [String]) -> String? {
        let fileManager = FileManager.default
        for candidate in candidates.reversed() {
            for path in folders {
                if (path as NSString).lastPathComponent == candidate && fileManager.fileExists(atPath: path) {
                    return path
                }
            }
        }
        return nil
    }

    /// Extract folder paths from a VSCode-family window/entry dictionary
    /// Handles both "folder" (single folder) and "workspace" (workspace file) entries
    private static func extractFoldersFromEntry(_ entry: [String: Any]) -> [String] {
        var paths: [String] = []
        if let folderUri = entry["folderUri"] as? String ?? entry["folder"] as? String,
           let path = pathFromFileURI(folderUri) {
            paths.append(path)
        }
        if let workspace = entry["workspace"] as? [String: Any],
           let configPath = workspace["configPath"] as? String,
           let path = pathFromFileURI(configPath) {
            paths.append((path as NSString).deletingLastPathComponent)
        }
        return paths
    }

    /// Collect folder paths from VSCode-family storage.json
    private static func collectFoldersFromStorageJSON(_ userDataDir: String) -> [String] {
        let storagePath = userDataDir + "/storage.json"
        guard let data = FileManager.default.contents(atPath: storagePath),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let windowsState = json["windowsState"] as? [String: Any] else {
            return []
        }

        var folders: [String] = []

        if let lastWindow = windowsState["lastActiveWindow"] as? [String: Any] {
            folders.append(contentsOf: extractFoldersFromEntry(lastWindow))
        }
        if let openedWindows = windowsState["openedWindows"] as? [[String: Any]] {
            for window in openedWindows {
                folders.append(contentsOf: extractFoldersFromEntry(window))
            }
        }

        return folders
    }

    /// Collect folder paths from VSCode-family state.vscdb (SQLite)
    private static func collectFoldersFromStateDB(_ userDataDir: String) -> [String] {
        let dbPath = userDataDir + "/User/globalStorage/state.vscdb"
        guard FileManager.default.fileExists(atPath: dbPath) else {
            return []
        }

        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/sqlite3")
        process.arguments = [dbPath, "SELECT value FROM ItemTable WHERE key = 'history.recentlyOpenedPathsList'"]

        let pipe = Pipe()
        process.standardOutput = pipe
        process.standardError = FileHandle.nullDevice

        do {
            try process.run()
            process.waitUntilExit()

            guard process.terminationStatus == 0 else { return [] }

            let data = pipe.fileHandleForReading.readDataToEndOfFile()
            guard !data.isEmpty,
                  let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let entries = json["entries"] as? [[String: Any]] else {
                return []
            }

            var folders: [String] = []
            for entry in entries {
                folders.append(contentsOf: extractFoldersFromEntry(entry))
            }
            return folders
        } catch {
            return []
        }
    }

    /// Get project directory from Electron IDE configuration files
    /// Tries storage.json first (lightweight), then falls back to state.vscdb (more historical data)
    static func getDirectoryFromElectronIDERecentWorkspaces(candidates: [String], bundleId: String) -> String? {
        guard let userDataDir = getElectronIDEUserDataDir(bundleId) else {
            return nil
        }

        // Try storage.json first (no external tool needed)
        let storageFolders = collectFoldersFromStorageJSON(userDataDir)
        if let match = matchCandidatesAgainstFolders(candidates, folders: storageFolders) {
            return match
        }

        // Fallback: try state.vscdb (requires sqlite3 CLI, has more historical data)
        let dbFolders = collectFoldersFromStateDB(userDataDir)
        return matchCandidatesAgainstFolders(candidates, folders: dbFolders)
    }
}
