import Foundation

// MARK: - File Search (fd Integration)

extension DirectoryDetector {

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

    // MARK: - Symlink Directory Handling

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

    // MARK: - File List

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
}
