import Foundation

// MARK: - RipgrepExecutor

/// Executor for ripgrep (rg) command for symbol search
class RipgrepExecutor {
    static let DEFAULT_MAX_SYMBOLS = 2000
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

        var allResults: [SymbolResult] = []

        for pattern in config.patterns {
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
                allResults.append(contentsOf: results)
            }
        }

        // Deduplicate and sort
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

    /// Execute rg command with timeout
    private static func executeRg(rgPath: String, args: [String]) -> String? {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: rgPath)
        process.arguments = args

        let pipe = Pipe()
        process.standardOutput = pipe
        process.standardError = FileHandle.nullDevice

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

            let data = pipe.fileHandleForReading.readDataToEndOfFile()
            return String(data: data, encoding: .utf8)
        } catch {
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
}
