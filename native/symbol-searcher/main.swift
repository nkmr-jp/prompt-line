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
    var excludePatterns: [String] = []
    var includePatterns: [String] = []

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
            // Deprecated: Swift-side cache is disabled, option kept for backward compatibility
            break
        case "--exclude":
            i += 1
            if i < args.count { excludePatterns.append(args[i]) }
        case "--include":
            i += 1
            if i < args.count { includePatterns.append(args[i]) }
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

    // Swift-side caching is disabled to avoid double caching with JS-side SymbolCacheManager
    // JS-side manages persistent cache with memory cache for optimal performance
    // Swift only performs search operations without cache read/write

    // Full search (always perform fresh search, no Swift-side cache)
    if let symbols = RipgrepExecutor.searchSymbols(
        directory: dir,
        language: lang,
        maxSymbols: maxSymbols,
        excludePatterns: excludePatterns,
        includePatterns: includePatterns
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
/// NOTE: This command is deprecated. Cache management is handled by JS-side SymbolCacheManager.
/// Swift-side caching has been disabled to avoid double caching and improve performance.
/// This command is kept for backward compatibility but will not create Swift-side cache.
func buildCache(args: [String]) {
    var directory: String?
    var language: String?

    var i = 0
    while i < args.count {
        switch args[i] {
        case "--language", "-l":
            i += 1
            if i < args.count { language = args[i] }
        case "--max-symbols", "--ttl":
            // Skip deprecated options
            i += 1
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

    let response: [String: Any] = [
        "success": false,
        "error": "Swift-side cache building is deprecated. Cache is managed by JS-side SymbolCacheManager.",
        "directory": dir,
        "language": lang
    ]
    printJsonDict(response)
}

/// Get cache info for a directory/language
/// NOTE: This command is deprecated. Cache info is managed by JS-side SymbolCacheManager.
/// Swift-side cache has been disabled.
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

    let response: [String: Any] = [
        "success": false,
        "error": "Swift-side cache info is deprecated. Cache is managed by JS-side SymbolCacheManager.",
        "directory": dir,
        "language": language as Any
    ]
    printJsonDict(response)
}

/// Clear cache for a directory/language
/// NOTE: This command is deprecated. Cache clearing is handled by JS-side SymbolCacheManager.
/// Swift-side cache has been disabled.
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

    let response: [String: Any] = [
        "success": false,
        "error": "Swift-side cache clearing is deprecated. Cache is managed by JS-side SymbolCacheManager.",
        "directory": dir,
        "language": language as Any,
        "all": all
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

    Commands:
      check-rg        Check if ripgrep (rg) is available
      list-languages  List all supported programming languages
      search          Search for symbols in a directory (always performs full search)

    Search Options:
      --language, -l <lang>    Language to search (e.g., go, ts, py, rs)
      --max-symbols <n>        Maximum number of symbols to return (default: 20000)
      --exclude <pattern>      Exclude files matching glob pattern (can be repeated)
      --include <pattern>      Include files matching glob pattern (can be repeated)

    Examples:
      symbol-searcher check-rg
      symbol-searcher list-languages
      symbol-searcher search /path/to/project --language ts
      symbol-searcher search /path/to/project -l go --max-symbols 500
      symbol-searcher search /path/to/project -l go --exclude "*.test.go"

    Note:
      Swift-side caching has been disabled. Cache is now managed by JS-side SymbolCacheManager
      for better performance and to avoid double caching. The following commands are deprecated:
        - build-cache (cache is built automatically by JS-side)
        - cache-info (use JS-side IPC handler 'get-cached-symbols')
        - clear-cache (use JS-side IPC handler 'clear-symbol-cache')

    """, stderr)
}

main()
