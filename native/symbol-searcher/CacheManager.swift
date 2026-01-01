import Foundation

// MARK: - Cache Manager

/// Manages symbol cache for fast subsequent searches
class CacheManager {

    // MARK: - Constants

    /// Base cache directory under ~/.prompt-line/
    private static let CACHE_BASE_DIR = ".prompt-line/cache/projects"

    /// Cache metadata filename
    private static let METADATA_FILE = "metadata.json"

    /// Symbols cache file prefix
    private static let SYMBOLS_PREFIX = "symbols-"

    /// Cache TTL in seconds (default: 24 hours)
    static let DEFAULT_TTL: TimeInterval = 24 * 60 * 60

    // MARK: - Cache Metadata

    /// Cache metadata structure
    struct CacheMetadata: Codable {
        let directory: String
        let language: String
        let symbolCount: Int
        let createdAt: Date
        let ttlSeconds: TimeInterval

        var isValid: Bool {
            return Date().timeIntervalSince(createdAt) < ttlSeconds
        }

        var expiresAt: Date {
            return createdAt.addingTimeInterval(ttlSeconds)
        }
    }

    /// Cache info response
    struct CacheInfo: Codable {
        let exists: Bool
        let directory: String?
        let language: String?
        let symbolCount: Int?
        let createdAt: String?
        let expiresAt: String?
        let isValid: Bool?
        let cachePath: String?
    }

    // MARK: - Path Utilities

    /// Encode directory path to be filesystem-safe
    /// Converts "/Users/nkmr/project" to "-Users-nkmr-project"
    private static func encodeDirectoryPath(_ directory: String) -> String {
        return directory.replacingOccurrences(of: "/", with: "-")
    }

    /// Get cache directory path for a project directory
    /// Cache is stored in ~/.prompt-line/cache/projects/<encoded-path>/
    static func getCacheDir(for directory: String) -> String {
        let homeDir = FileManager.default.homeDirectoryForCurrentUser.path
        let encodedPath = encodeDirectoryPath(directory)
        let basePath = (homeDir as NSString).appendingPathComponent(CACHE_BASE_DIR)
        return (basePath as NSString).appendingPathComponent(encodedPath)
    }

    /// Get metadata file path
    static func getMetadataPath(cacheDir: String, language: String) -> String {
        return (cacheDir as NSString).appendingPathComponent("\(language)-\(METADATA_FILE)")
    }

    /// Get symbols cache file path
    static func getSymbolsPath(cacheDir: String, language: String) -> String {
        return (cacheDir as NSString).appendingPathComponent("\(SYMBOLS_PREFIX)\(language).jsonl")
    }

    // MARK: - Cache Operations

    /// Check if cache exists and is valid
    static func isCacheValid(directory: String, language: String) -> Bool {
        let cacheDir = getCacheDir(for: directory)
        let metadataPath = getMetadataPath(cacheDir: cacheDir, language: language)

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601

        guard FileManager.default.fileExists(atPath: metadataPath),
              let data = FileManager.default.contents(atPath: metadataPath),
              let metadata = try? decoder.decode(CacheMetadata.self, from: data) else {
            return false
        }

        // Check TTL
        guard metadata.isValid else {
            return false
        }

        // Check symbols file exists
        let symbolsPath = getSymbolsPath(cacheDir: cacheDir, language: language)
        return FileManager.default.fileExists(atPath: symbolsPath)
    }

    /// Write symbols to cache
    static func writeCache(
        directory: String,
        language: String,
        symbols: [SymbolResult],
        ttl: TimeInterval = DEFAULT_TTL
    ) -> Bool {
        let cacheDir = getCacheDir(for: directory)

        // Create cache directory if needed
        do {
            try FileManager.default.createDirectory(
                atPath: cacheDir,
                withIntermediateDirectories: true,
                attributes: nil
            )
        } catch {
            fputs("Failed to create cache directory: \(error)\n", stderr)
            return false
        }

        // Write metadata
        let metadata = CacheMetadata(
            directory: directory,
            language: language,
            symbolCount: symbols.count,
            createdAt: Date(),
            ttlSeconds: ttl
        )

        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601

        guard let metadataData = try? encoder.encode(metadata) else {
            fputs("Failed to encode metadata\n", stderr)
            return false
        }

        let metadataPath = getMetadataPath(cacheDir: cacheDir, language: language)
        guard FileManager.default.createFile(atPath: metadataPath, contents: metadataData) else {
            fputs("Failed to write metadata file\n", stderr)
            return false
        }

        // Write symbols as JSONL
        let symbolsPath = getSymbolsPath(cacheDir: cacheDir, language: language)
        var jsonlLines: [String] = []

        for symbol in symbols {
            if let symbolData = try? encoder.encode(symbol),
               let line = String(data: symbolData, encoding: .utf8) {
                jsonlLines.append(line)
            }
        }

        let jsonlContent = jsonlLines.joined(separator: "\n")
        guard let jsonlData = jsonlContent.data(using: .utf8),
              FileManager.default.createFile(atPath: symbolsPath, contents: jsonlData) else {
            fputs("Failed to write symbols file\n", stderr)
            return false
        }

        return true
    }

    /// Read symbols from cache
    static func readCache(directory: String, language: String) -> [SymbolResult]? {
        guard isCacheValid(directory: directory, language: language) else {
            return nil
        }

        let cacheDir = getCacheDir(for: directory)
        let symbolsPath = getSymbolsPath(cacheDir: cacheDir, language: language)

        guard let data = FileManager.default.contents(atPath: symbolsPath),
              let content = String(data: data, encoding: .utf8) else {
            return nil
        }

        let decoder = JSONDecoder()
        var symbols: [SymbolResult] = []

        for line in content.components(separatedBy: "\n") where !line.isEmpty {
            if let lineData = line.data(using: .utf8),
               let symbol = try? decoder.decode(SymbolResult.self, from: lineData) {
                symbols.append(symbol)
            }
        }

        return symbols
    }

    /// Get cache info
    static func getCacheInfo(directory: String, language: String) -> CacheInfo {
        let cacheDir = getCacheDir(for: directory)
        let metadataPath = getMetadataPath(cacheDir: cacheDir, language: language)

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601

        guard FileManager.default.fileExists(atPath: metadataPath),
              let data = FileManager.default.contents(atPath: metadataPath),
              let metadata = try? decoder.decode(CacheMetadata.self, from: data) else {
            return CacheInfo(
                exists: false,
                directory: directory,
                language: language,
                symbolCount: nil,
                createdAt: nil,
                expiresAt: nil,
                isValid: nil,
                cachePath: nil
            )
        }

        let dateFormatter = ISO8601DateFormatter()

        return CacheInfo(
            exists: true,
            directory: directory,
            language: language,
            symbolCount: metadata.symbolCount,
            createdAt: dateFormatter.string(from: metadata.createdAt),
            expiresAt: dateFormatter.string(from: metadata.expiresAt),
            isValid: metadata.isValid,
            cachePath: cacheDir
        )
    }

    /// Clear cache for a directory/language
    static func clearCache(directory: String, language: String? = nil) -> Bool {
        let cacheDir = getCacheDir(for: directory)

        if let lang = language {
            // Clear specific language cache
            let metadataPath = getMetadataPath(cacheDir: cacheDir, language: lang)
            let symbolsPath = getSymbolsPath(cacheDir: cacheDir, language: lang)

            var success = true
            if FileManager.default.fileExists(atPath: metadataPath) {
                do {
                    try FileManager.default.removeItem(atPath: metadataPath)
                } catch {
                    fputs("Failed to remove metadata: \(error)\n", stderr)
                    success = false
                }
            }
            if FileManager.default.fileExists(atPath: symbolsPath) {
                do {
                    try FileManager.default.removeItem(atPath: symbolsPath)
                } catch {
                    fputs("Failed to remove symbols: \(error)\n", stderr)
                    success = false
                }
            }
            return success
        } else {
            // Clear all cache for directory
            guard FileManager.default.fileExists(atPath: cacheDir) else {
                return true  // Nothing to clear
            }

            do {
                try FileManager.default.removeItem(atPath: cacheDir)
                return true
            } catch {
                fputs("Failed to remove cache directory: \(error)\n", stderr)
                return false
            }
        }
    }

    /// List all cached languages for a directory
    static func listCachedLanguages(directory: String) -> [String] {
        let cacheDir = getCacheDir(for: directory)

        guard FileManager.default.fileExists(atPath: cacheDir),
              let files = try? FileManager.default.contentsOfDirectory(atPath: cacheDir) else {
            return []
        }

        var languages: [String] = []
        for file in files {
            if file.hasPrefix(SYMBOLS_PREFIX) && file.hasSuffix(".jsonl") {
                let lang = String(file.dropFirst(SYMBOLS_PREFIX.count).dropLast(".jsonl".count))
                languages.append(lang)
            }
        }

        return languages
    }
}
