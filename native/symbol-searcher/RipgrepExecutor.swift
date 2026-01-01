import Foundation

// MARK: - RipgrepExecutor

/// Executor for ripgrep (rg) command for symbol search
class RipgrepExecutor {
    static let DEFAULT_MAX_SYMBOLS = 20000
    static let TIMEOUT_SECONDS: Double = 5.0

    // MARK: - rg Path Detection

    /// Get the path to the rg executable
    static func getRgPath() -> String? {
        let paths = [
            "/opt/homebrew/bin/rg",    // Apple Silicon Homebrew
            "/usr/local/bin/rg",       // Intel Homebrew
            "/usr/bin/rg"              // System
        ]
        for path in paths {
            if FileManager.default.fileExists(atPath: path) {
                return path
            }
        }
        return nil
    }

    /// Check if rg is available
    static func isRgAvailable() -> Bool {
        return getRgPath() != nil
    }

    // MARK: - Security Validation

    /// Validate directory path to prevent path traversal and injection attacks
    /// - Parameter path: The directory path to validate
    /// - Returns: true if the path is safe to use
    static func isValidDirectory(_ path: String) -> Bool {
        // 1. Check if path exists and is a directory
        var isDirectory: ObjCBool = false
        guard FileManager.default.fileExists(atPath: path, isDirectory: &isDirectory),
              isDirectory.boolValue else {
            return false
        }

        // 2. Resolve to real path (handles symlinks)
        let realPath: String
        do {
            let url = URL(fileURLWithPath: path)
            realPath = url.standardized.path
        }

        // 3. Reject dangerous system paths
        let dangerousPaths = ["/", "/System", "/Library", "/usr", "/bin", "/sbin", "/etc", "/var", "/private"]
        if dangerousPaths.contains(realPath) {
            return false
        }

        // 4. Reject path traversal patterns and shell metacharacters
        if path.contains("..") || path.contains(";") || path.contains("&") ||
           path.contains("|") || path.contains("`") || path.contains("$") ||
           path.contains("'") || path.contains("\"") || path.contains("\n") {
            return false
        }

        return true
    }

    // MARK: - Symbol Search

    /// Search for symbols in a directory
    /// - Parameters:
    ///   - directory: The directory to search in
    ///   - language: The language key (e.g., "go", "ts", "py")
    ///   - maxSymbols: Maximum number of symbols to return
    /// - Returns: Array of symbol results, or nil if search failed
    static func searchSymbols(
        directory: String,
        language: String,
        maxSymbols: Int = DEFAULT_MAX_SYMBOLS
    ) -> [SymbolResult]? {
        guard let rgPath = getRgPath() else {
            return nil
        }

        guard let config = LANGUAGE_PATTERNS[language] else {
            return nil
        }

        // Use parallel execution for all patterns
        let group = DispatchGroup()
        var allResults: [SymbolResult] = []
        let resultsLock = NSLock()

        // 1. Single-line pattern search (existing logic)
        for pattern in config.patterns {
            group.enter()
            DispatchQueue.global(qos: .userInitiated).async {
                defer { group.leave() }

                let args = buildRgArgs(
                    directory: directory,
                    pattern: pattern.regex,
                    rgType: config.rgType,
                    maxCount: maxSymbols
                )

                if let output = executeRg(rgPath: rgPath, args: args) {
                    let results = parseRgJsonOutput(
                        output: output,
                        pattern: pattern,
                        language: language,
                        baseDirectory: directory
                    )
                    resultsLock.lock()
                    allResults.append(contentsOf: results)
                    resultsLock.unlock()
                }
            }
        }

        // 2. Block-based search for Go (secure direct execution)
        if language == "go" {
            group.enter()
            DispatchQueue.global(qos: .userInitiated).async {
                defer { group.leave() }
                if let blockResults = searchBlockSymbols(
                    directory: directory,
                    configs: GO_BLOCK_CONFIGS,
                    language: language,
                    maxSymbols: maxSymbols
                ) {
                    resultsLock.lock()
                    allResults.append(contentsOf: blockResults)
                    resultsLock.unlock()
                }
            }
        }

        // Wait for all patterns to complete (with timeout)
        let waitResult = group.wait(timeout: .now() + TIMEOUT_SECONDS * 2)
        if waitResult == .timedOut {
            // Return what we have so far
            resultsLock.lock()
            let partialResults = allResults
            resultsLock.unlock()
            return deduplicateAndSort(results: partialResults, maxSymbols: maxSymbols)
        }

        // Deduplicate and sort (block search may overlap with single-line patterns)
        return deduplicateAndSort(results: allResults, maxSymbols: maxSymbols)
    }

    // MARK: - Private Helpers

    /// Build rg command arguments
    private static func buildRgArgs(
        directory: String,
        pattern: String,
        rgType: String,
        maxCount: Int
    ) -> [String] {
        return [
            "--json",
            "--line-number",
            "--no-heading",
            "--type", rgType,
            "--max-count", String(maxCount),
            "-e", pattern,
            directory
        ]
    }

    /// Execute rg command with timeout and async pipe reading
    /// Uses concurrent reading to prevent pipe buffer deadlock
    private static func executeRg(rgPath: String, args: [String]) -> String? {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: rgPath)
        process.arguments = args

        let pipe = Pipe()
        process.standardOutput = pipe
        process.standardError = FileHandle.nullDevice

        // Use concurrent reading to prevent pipe buffer deadlock
        var outputData = Data()
        let dataLock = NSLock()
        let semaphore = DispatchSemaphore(value: 0)

        // Set up async reading before starting process
        pipe.fileHandleForReading.readabilityHandler = { handle in
            let chunk = handle.availableData
            if chunk.isEmpty {
                // EOF reached
                pipe.fileHandleForReading.readabilityHandler = nil
                semaphore.signal()
                return
            }
            dataLock.lock()
            outputData.append(chunk)
            dataLock.unlock()
        }

        do {
            try process.run()

            // Timeout handling
            let deadline = DispatchTime.now() + TIMEOUT_SECONDS
            DispatchQueue.global().asyncAfter(deadline: deadline) {
                if process.isRunning {
                    process.terminate()
                }
            }

            // Wait for process to exit
            process.waitUntilExit()

            // Wait for reading to complete (with timeout)
            let waitResult = semaphore.wait(timeout: .now() + 1.0)

            // Clean up handler if not already done
            pipe.fileHandleForReading.readabilityHandler = nil

            // If semaphore timed out, try to read any remaining data
            if waitResult == .timedOut {
                let remaining = pipe.fileHandleForReading.availableData
                if !remaining.isEmpty {
                    dataLock.lock()
                    outputData.append(remaining)
                    dataLock.unlock()
                }
            }

            dataLock.lock()
            let result = String(data: outputData, encoding: .utf8)
            dataLock.unlock()

            return result
        } catch {
            pipe.fileHandleForReading.readabilityHandler = nil
            return nil
        }
    }

    /// Parse rg JSON output (NDJSON format)
    private static func parseRgJsonOutput(
        output: String,
        pattern: SymbolPattern,
        language: String,
        baseDirectory: String
    ) -> [SymbolResult] {
        var results: [SymbolResult] = []

        // rg --json output is NDJSON (one JSON per line)
        for line in output.components(separatedBy: "\n") {
            guard !line.isEmpty,
                  let data = line.data(using: .utf8),
                  let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  json["type"] as? String == "match",
                  let matchData = json["data"] as? [String: Any] else {
                continue
            }

            guard let path = (matchData["path"] as? [String: Any])?["text"] as? String,
                  let lineNum = matchData["line_number"] as? Int,
                  let lines = matchData["lines"] as? [String: Any],
                  let lineText = lines["text"] as? String else {
                continue
            }

            // Extract symbol name from regex capture group
            if let symbolName = extractSymbolName(
                from: lineText,
                pattern: pattern.regex,
                captureGroup: pattern.captureGroup
            ) {
                // Calculate relative path
                let relativePath: String
                if path.hasPrefix(baseDirectory) {
                    let dropCount = baseDirectory.count + (baseDirectory.hasSuffix("/") ? 0 : 1)
                    relativePath = String(path.dropFirst(dropCount))
                } else {
                    relativePath = path
                }

                results.append(SymbolResult(
                    name: symbolName,
                    type: pattern.type,
                    filePath: path,
                    relativePath: relativePath,
                    lineNumber: lineNum,
                    lineContent: lineText.trimmingCharacters(in: .whitespacesAndNewlines),
                    language: language
                ))
            }
        }

        return results
    }

    /// Extract symbol name from line using regex capture group
    private static func extractSymbolName(
        from text: String,
        pattern: String,
        captureGroup: Int
    ) -> String? {
        guard let regex = try? NSRegularExpression(pattern: pattern) else {
            return nil
        }

        let range = NSRange(text.startIndex..., in: text)
        guard let match = regex.firstMatch(in: text, range: range),
              match.numberOfRanges > captureGroup else {
            return nil
        }

        let captureRange = match.range(at: captureGroup)
        guard let swiftRange = Range(captureRange, in: text) else {
            return nil
        }

        return String(text[swiftRange])
    }

    /// Deduplicate and sort results
    private static func deduplicateAndSort(results: [SymbolResult], maxSymbols: Int) -> [SymbolResult] {
        var seen = Set<String>()
        var unique: [SymbolResult] = []

        for result in results {
            let key = "\(result.filePath):\(result.lineNumber):\(result.name)"
            if !seen.contains(key) {
                seen.insert(key)
                unique.append(result)
            }
        }

        // Sort by file path, then line number
        let sorted = unique.sorted { lhs, rhs in
            if lhs.filePath != rhs.filePath {
                return lhs.filePath < rhs.filePath
            }
            return lhs.lineNumber < rhs.lineNumber
        }

        // Apply max symbols limit
        if sorted.count > maxSymbols {
            return Array(sorted.prefix(maxSymbols))
        }
        return sorted
    }

    // MARK: - Block-based Symbol Search (Secure Direct Execution)

    /// Search for symbols in blocks using direct rg execution (secure)
    /// Used for detecting symbols inside var ( ... ) and const ( ... ) blocks in Go
    /// - Parameters:
    ///   - directory: The directory to search in
    ///   - configs: Block search configurations
    ///   - language: The language key
    ///   - maxSymbols: Maximum number of symbols to return
    /// - Returns: Array of symbol results, or nil if search failed
    static func searchBlockSymbols(
        directory: String,
        configs: [BlockSearchConfig],
        language: String,
        maxSymbols: Int = DEFAULT_MAX_SYMBOLS
    ) -> [SymbolResult]? {
        // Security validation
        guard isValidDirectory(directory) else {
            return nil
        }

        guard let rgPath = getRgPath() else {
            return nil
        }

        var allResults: [SymbolResult] = []
        let resultsLock = NSLock()
        let group = DispatchGroup()

        for config in configs {
            group.enter()
            DispatchQueue.global(qos: .userInitiated).async {
                defer { group.leave() }

                // Build rg arguments for multiline search (direct execution, no shell)
                let args = [
                    "-U", "--multiline-dotall",  // Multiline mode
                    "-n",                         // Show line numbers
                    "--type", "go",
                    "-e", config.blockPattern,
                    directory
                ]

                guard let output = executeRgDirect(rgPath: rgPath, args: args) else {
                    return
                }

                // Parse and filter in Swift (secure)
                let results = parseAndFilterBlockOutput(
                    output: output,
                    config: config,
                    language: language,
                    baseDirectory: directory
                )

                resultsLock.lock()
                allResults.append(contentsOf: results)
                resultsLock.unlock()
            }
        }

        // Wait with extended timeout for multiline search
        let waitResult = group.wait(timeout: .now() + TIMEOUT_SECONDS * 2)
        if waitResult == .timedOut {
            resultsLock.lock()
            let partialResults = allResults
            resultsLock.unlock()
            return deduplicateAndSort(results: partialResults, maxSymbols: maxSymbols)
        }

        return deduplicateAndSort(results: allResults, maxSymbols: maxSymbols)
    }

    /// Execute rg command directly with timeout and pipe buffer protection
    /// Similar to executeRg() but without --json flag for multiline output
    private static func executeRgDirect(rgPath: String, args: [String]) -> String? {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: rgPath)
        process.arguments = args

        let pipe = Pipe()
        process.standardOutput = pipe
        process.standardError = FileHandle.nullDevice

        // Use concurrent reading to prevent pipe buffer deadlock
        var outputData = Data()
        let dataLock = NSLock()
        let semaphore = DispatchSemaphore(value: 0)

        pipe.fileHandleForReading.readabilityHandler = { handle in
            let chunk = handle.availableData
            if chunk.isEmpty {
                pipe.fileHandleForReading.readabilityHandler = nil
                semaphore.signal()
                return
            }
            dataLock.lock()
            outputData.append(chunk)
            dataLock.unlock()
        }

        do {
            try process.run()

            // Timeout handling
            let deadline = DispatchTime.now() + TIMEOUT_SECONDS
            DispatchQueue.global().asyncAfter(deadline: deadline) {
                if process.isRunning {
                    process.terminate()
                }
            }

            process.waitUntilExit()

            let waitResult = semaphore.wait(timeout: .now() + 1.0)

            pipe.fileHandleForReading.readabilityHandler = nil

            if waitResult == .timedOut {
                let remaining = pipe.fileHandleForReading.availableData
                if !remaining.isEmpty {
                    dataLock.lock()
                    outputData.append(remaining)
                    dataLock.unlock()
                }
            }

            dataLock.lock()
            let result = String(data: outputData, encoding: .utf8)
            dataLock.unlock()

            return result
        } catch {
            pipe.fileHandleForReading.readabilityHandler = nil
            return nil
        }
    }

    /// Parse rg output and filter by indentation level
    /// Extracts symbol names from block content using Swift filtering
    private static func parseAndFilterBlockOutput(
        output: String,
        config: BlockSearchConfig,
        language: String,
        baseDirectory: String
    ) -> [SymbolResult] {
        var results: [SymbolResult] = []

        guard let symbolRegex = try? NSRegularExpression(pattern: config.symbolNameRegex) else {
            return []
        }

        for line in output.components(separatedBy: "\n") {
            guard !line.isEmpty else { continue }

            // Skip comment lines
            let trimmedLine = line.trimmingCharacters(in: .whitespaces)
            if trimmedLine.hasPrefix("//") { continue }

            // Parse "file:line:content" format
            // Need to handle paths with colons carefully
            guard let firstColonIndex = line.firstIndex(of: ":") else { continue }
            let afterFirstColon = line.index(after: firstColonIndex)
            guard afterFirstColon < line.endIndex else { continue }

            let remaining = String(line[afterFirstColon...])
            guard let secondColonIndex = remaining.firstIndex(of: ":") else { continue }

            let filePath = String(line[..<firstColonIndex])
            let lineNumberStr = String(remaining[..<secondColonIndex])
            guard let lineNumber = Int(lineNumberStr) else { continue }

            let contentStartIndex = remaining.index(after: secondColonIndex)
            guard contentStartIndex < remaining.endIndex else { continue }
            let content = String(remaining[contentStartIndex...])

            // Apply indentation filter
            if config.indentFilter == .singleLevel {
                // Allow only tab (1) or spaces (2-4) - top-level block content
                // Reject: double tab, 5+ spaces (nested blocks)
                if content.hasPrefix("\t\t") || content.hasPrefix("     ") {
                    continue  // Too deeply indented - likely function-local
                }
                // Require some indentation (skip "var (" line itself)
                if !content.hasPrefix("\t") && !content.hasPrefix("  ") {
                    continue
                }
            }

            // Skip lines that are just closing parenthesis
            if trimmedLine == ")" || trimmedLine == ")" + " " {
                continue
            }

            // Extract symbol name
            let contentRange = NSRange(content.startIndex..., in: content)
            guard let match = symbolRegex.firstMatch(in: content, range: contentRange),
                  match.numberOfRanges > 1,
                  let captureRange = Range(match.range(at: 1), in: content) else {
                continue
            }

            let symbolName = String(content[captureRange])

            // Skip if symbol name is empty or just whitespace
            if symbolName.trimmingCharacters(in: .whitespaces).isEmpty {
                continue
            }

            // Calculate relative path
            let relativePath: String
            if filePath.hasPrefix(baseDirectory) {
                let dropCount = baseDirectory.count + (baseDirectory.hasSuffix("/") ? 0 : 1)
                relativePath = String(filePath.dropFirst(dropCount))
            } else {
                relativePath = filePath
            }

            results.append(SymbolResult(
                name: symbolName,
                type: config.symbolType,
                filePath: filePath,
                relativePath: relativePath,
                lineNumber: lineNumber,
                lineContent: content.trimmingCharacters(in: .whitespaces),
                language: language
            ))
        }

        return results
    }
}
