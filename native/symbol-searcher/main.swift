import Foundation

// MARK: - CLI Entry Point

func main() {
    let arguments = CommandLine.arguments

    guard arguments.count >= 2 else {
        printUsage()
        exit(1)
    }

    let command = arguments[1]

    switch command {
    case "check-rg":
        checkRg()
    case "list-languages":
        listLanguages()
    case "search":
        search(args: Array(arguments.dropFirst(2)))
    case "build-cache":
        buildCache(args: Array(arguments.dropFirst(2)))
    case "cache-info":
        cacheInfo(args: Array(arguments.dropFirst(2)))
    case "clear-cache":
        clearCache(args: Array(arguments.dropFirst(2)))
    default:
        fputs("Unknown command: \(command)\n", stderr)
        printUsage()
        exit(1)
    }
}

// MARK: - Helper Functions

/// Check if a directory is inside a git repository
/// Walks up the directory tree to find a .git directory
func isGitRepository(_ directory: String) -> Bool {
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

// MARK: - Commands

/// Check if rg is available
func checkRg() {
    let available = RipgrepExecutor.isRgAvailable()
    let path = RipgrepExecutor.getRgPath()

    let response = RgCheckResponse(
        rgAvailable: available,
        rgPath: path
    )

    printJsonEncodable(response)
}

/// List all supported languages
func listLanguages() {
    let languages = getSupportedLanguages()
    let response: [String: Any] = [
        "languages": languages.map { lang in
            [
                "key": lang.key,
                "extension": lang.extensionName,
                "displayName": lang.displayName
            ]
        }
    ]

    printJsonDict(response)
}

/// Search for symbols in a directory
func search(args: [String]) {
    var directory: String?
    var language: String?
    var maxSymbols = RipgrepExecutor.DEFAULT_MAX_SYMBOLS
    var noCache = false

    var i = 0
    while i < args.count {
        switch args[i] {
        case "--language", "-l":
            i += 1
            if i < args.count { language = args[i] }
        case "--max-symbols":
            i += 1
            if i < args.count { maxSymbols = Int(args[i]) ?? maxSymbols }
        case "--no-cache":
            noCache = true
        default:
            if directory == nil { directory = args[i] }
        }
        i += 1
    }

    guard let dir = directory, let lang = language else {
        let response: [String: Any] = [
            "success": false,
            "error": "Missing directory or language"
        ]
        printJsonDict(response)
        return
    }

    guard RipgrepExecutor.isRgAvailable() else {
        let response: [String: Any] = [
            "success": false,
            "error": "rg command not found. Install with: brew install ripgrep"
        ]
        printJsonDict(response)
        return
    }

    guard LANGUAGE_PATTERNS[lang] != nil else {
        let response: [String: Any] = [
            "success": false,
            "error": "Unsupported language: \(lang)"
        ]
        printJsonDict(response)
        return
    }

    // Require git repository for symbol search
    guard isGitRepository(dir) else {
        let response: [String: Any] = [
            "success": false,
            "error": "Symbol search is only available in git repositories",
            "directory": dir
        ]
        printJsonDict(response)
        return
    }

    // Try cache first (unless --no-cache is specified)
    if !noCache, let cachedSymbols = CacheManager.readCache(directory: dir, language: lang) {
        let limitedSymbols = Array(cachedSymbols.prefix(maxSymbols))
        let response = SymbolSearchResponse(
            success: true,
            directory: dir,
            language: lang,
            symbols: limitedSymbols,
            symbolCount: limitedSymbols.count,
            searchMode: "cached",
            partial: cachedSymbols.count > maxSymbols,
            maxSymbols: maxSymbols,
            error: nil
        )
        printJsonEncodable(response)
        return
    }

    // Full search
    if let symbols = RipgrepExecutor.searchSymbols(
        directory: dir,
        language: lang,
        maxSymbols: maxSymbols
    ) {
        let response = SymbolSearchResponse(
            success: true,
            directory: dir,
            language: lang,
            symbols: symbols,
            symbolCount: symbols.count,
            searchMode: "full",
            partial: symbols.count >= maxSymbols,
            maxSymbols: maxSymbols,
            error: nil
        )
        printJsonEncodable(response)
    } else {
        let response: [String: Any] = [
            "success": false,
            "error": "Search failed"
        ]
        printJsonDict(response)
    }
}

// MARK: - Cache Commands

/// Build cache for a directory/language
func buildCache(args: [String]) {
    var directory: String?
    var language: String?
    var maxSymbols = RipgrepExecutor.DEFAULT_MAX_SYMBOLS
    var ttl = CacheManager.DEFAULT_TTL

    var i = 0
    while i < args.count {
        switch args[i] {
        case "--language", "-l":
            i += 1
            if i < args.count { language = args[i] }
        case "--max-symbols":
            i += 1
            if i < args.count { maxSymbols = Int(args[i]) ?? maxSymbols }
        case "--ttl":
            i += 1
            if i < args.count { ttl = TimeInterval(args[i]) ?? ttl }
        default:
            if directory == nil { directory = args[i] }
        }
        i += 1
    }

    guard let dir = directory, let lang = language else {
        let response: [String: Any] = [
            "success": false,
            "error": "Missing directory or language"
        ]
        printJsonDict(response)
        return
    }

    guard RipgrepExecutor.isRgAvailable() else {
        let response: [String: Any] = [
            "success": false,
            "error": "rg command not found. Install with: brew install ripgrep"
        ]
        printJsonDict(response)
        return
    }

    guard LANGUAGE_PATTERNS[lang] != nil else {
        let response: [String: Any] = [
            "success": false,
            "error": "Unsupported language: \(lang)"
        ]
        printJsonDict(response)
        return
    }

    // Require git repository for symbol search
    guard isGitRepository(dir) else {
        let response: [String: Any] = [
            "success": false,
            "error": "Symbol search is only available in git repositories",
            "directory": dir
        ]
        printJsonDict(response)
        return
    }

    // Perform full search
    guard let symbols = RipgrepExecutor.searchSymbols(
        directory: dir,
        language: lang,
        maxSymbols: maxSymbols
    ) else {
        let response: [String: Any] = [
            "success": false,
            "error": "Search failed"
        ]
        printJsonDict(response)
        return
    }

    // Write to cache
    let success = CacheManager.writeCache(
        directory: dir,
        language: lang,
        symbols: symbols,
        ttl: ttl
    )

    if success {
        let response: [String: Any] = [
            "success": true,
            "directory": dir,
            "language": lang,
            "symbolCount": symbols.count,
            "cachePath": CacheManager.getCacheDir(for: dir),
            "ttlSeconds": ttl
        ]
        printJsonDict(response)
    } else {
        let response: [String: Any] = [
            "success": false,
            "error": "Failed to write cache"
        ]
        printJsonDict(response)
    }
}

/// Get cache info for a directory/language
func cacheInfo(args: [String]) {
    var directory: String?
    var language: String?

    var i = 0
    while i < args.count {
        switch args[i] {
        case "--language", "-l":
            i += 1
            if i < args.count { language = args[i] }
        default:
            if directory == nil { directory = args[i] }
        }
        i += 1
    }

    guard let dir = directory else {
        let response: [String: Any] = [
            "success": false,
            "error": "Missing directory"
        ]
        printJsonDict(response)
        return
    }

    if let lang = language {
        // Get info for specific language
        let info = CacheManager.getCacheInfo(directory: dir, language: lang)
        printJsonEncodable(info)
    } else {
        // List all cached languages
        let languages = CacheManager.listCachedLanguages(directory: dir)
        var infos: [CacheManager.CacheInfo] = []
        for lang in languages {
            infos.append(CacheManager.getCacheInfo(directory: dir, language: lang))
        }
        let response: [String: Any] = [
            "directory": dir,
            "cachePath": CacheManager.getCacheDir(for: dir),
            "languages": languages,
            "count": languages.count
        ]
        printJsonDict(response)
    }
}

/// Clear cache for a directory/language
func clearCache(args: [String]) {
    var directory: String?
    var language: String?
    var all = false

    var i = 0
    while i < args.count {
        switch args[i] {
        case "--language", "-l":
            i += 1
            if i < args.count { language = args[i] }
        case "--all":
            all = true
        default:
            if directory == nil { directory = args[i] }
        }
        i += 1
    }

    guard let dir = directory else {
        let response: [String: Any] = [
            "success": false,
            "error": "Missing directory"
        ]
        printJsonDict(response)
        return
    }

    let success: Bool
    if all {
        success = CacheManager.clearCache(directory: dir, language: nil)
    } else if let lang = language {
        success = CacheManager.clearCache(directory: dir, language: lang)
    } else {
        let response: [String: Any] = [
            "success": false,
            "error": "Specify --language <lang> or --all"
        ]
        printJsonDict(response)
        return
    }

    let response: [String: Any] = [
        "success": success,
        "directory": dir,
        "language": language as Any,
        "cleared": all ? "all" : (language ?? "none")
    ]
    printJsonDict(response)
}

// MARK: - JSON Output Helpers

/// Print an Encodable value as JSON
func printJsonEncodable<T: Encodable>(_ value: T) {
    let encoder = JSONEncoder()
    encoder.outputFormatting = .sortedKeys
    if let data = try? encoder.encode(value),
       let str = String(data: data, encoding: .utf8) {
        print(str)
    }
}

/// Print a dictionary as JSON
func printJsonDict(_ dict: [String: Any]) {
    if let data = try? JSONSerialization.data(withJSONObject: dict, options: [.sortedKeys]),
       let str = String(data: data, encoding: .utf8) {
        print(str)
    }
}

/// Print usage information
func printUsage() {
    fputs("""
    Usage:
      symbol-searcher check-rg
      symbol-searcher list-languages
      symbol-searcher search <directory> --language <lang> [options]
      symbol-searcher build-cache <directory> --language <lang> [options]
      symbol-searcher cache-info <directory> [--language <lang>]
      symbol-searcher clear-cache <directory> (--language <lang> | --all)

    Commands:
      check-rg        Check if ripgrep (rg) is available
      list-languages  List all supported programming languages
      search          Search for symbols in a directory (uses cache if available)
      build-cache     Build symbol cache for a directory/language
      cache-info      Show cache information for a directory
      clear-cache     Clear cache for a directory/language

    Search Options:
      --language, -l <lang>    Language to search (e.g., go, ts, py, rs)
      --max-symbols <n>        Maximum number of symbols to return (default: 20000)
      --no-cache               Skip cache and perform full search

    Cache Options:
      --language, -l <lang>    Language for cache operation
      --ttl <seconds>          Cache TTL in seconds (default: 86400 = 24 hours)
      --all                    Clear all language caches for a directory

    Examples:
      symbol-searcher check-rg
      symbol-searcher list-languages
      symbol-searcher search /path/to/project --language ts
      symbol-searcher search /path/to/project -l go --max-symbols 500
      symbol-searcher search /path/to/project -l go --no-cache
      symbol-searcher build-cache /path/to/project -l go
      symbol-searcher build-cache /path/to/project -l go --ttl 3600
      symbol-searcher cache-info /path/to/project
      symbol-searcher cache-info /path/to/project -l go
      symbol-searcher clear-cache /path/to/project -l go
      symbol-searcher clear-cache /path/to/project --all

    """, stderr)
}

main()
