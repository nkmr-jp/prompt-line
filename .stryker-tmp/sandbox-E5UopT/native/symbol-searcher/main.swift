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
    default:
        fputs("Unknown command: \(command)\n", stderr)
        printUsage()
        exit(1)
    }
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

    var i = 0
    while i < args.count {
        switch args[i] {
        case "--language", "-l":
            i += 1
            if i < args.count { language = args[i] }
        case "--max-symbols":
            i += 1
            if i < args.count { maxSymbols = Int(args[i]) ?? maxSymbols }
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
      symbol-searcher search <directory> --language <lang> [--max-symbols <n>]

    Commands:
      check-rg        Check if ripgrep (rg) is available
      list-languages  List all supported programming languages
      search          Search for symbols in a directory

    Options:
      --language, -l <lang>    Language to search (e.g., go, ts, py, rs)
      --max-symbols <n>        Maximum number of symbols to return (default: 20000)

    Examples:
      symbol-searcher check-rg
      symbol-searcher list-languages
      symbol-searcher search /path/to/project --language ts
      symbol-searcher search /path/to/project -l go --max-symbols 500

    """, stderr)
}

main()
