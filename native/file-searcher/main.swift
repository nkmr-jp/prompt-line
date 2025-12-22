import Foundation

// MARK: - CLI Entry Point

func main() {
    let arguments = CommandLine.arguments

    guard arguments.count >= 2 else {
        fputs("Usage: \(arguments[0]) <command> [options]\n", stderr)
        fputs("Commands:\n", stderr)
        fputs("  list <path> [options] - List files in specified directory recursively with fd\n", stderr)
        fputs("  check-fd              - Check if fd command is available\n", stderr)
        fputs("\nOptions:\n", stderr)
        fputs("  --no-gitignore     - Don't respect .gitignore files\n", stderr)
        fputs("  --exclude <pattern> - Add exclude pattern (can be used multiple times)\n", stderr)
        fputs("  --include <pattern> - Add include pattern for .gitignored files (can be used multiple times)\n", stderr)
        fputs("  --max-files <n>    - Maximum number of files to return (default: 5000)\n", stderr)
        fputs("  --include-hidden   - Include hidden files (starting with .)\n", stderr)
        fputs("  --max-depth <n>    - Maximum directory depth to search\n", stderr)
        fputs("  --follow-symlinks  - Follow symbolic links (default: false)\n", stderr)
        fputs("\nNote: fd (https://github.com/sharkdp/fd) is required for file listing.\n", stderr)
        fputs("      Install with: brew install fd\n", stderr)
        exit(1)
    }

    let command = arguments[1]
    let result: [String: Any]

    switch command {
    case "list":
        guard arguments.count >= 3 else {
            fputs("Error: 'list' command requires a path argument\n", stderr)
            exit(1)
        }
        let path = arguments[2]
        // Parse settings from remaining arguments
        let settings = FileSearchSettings.fromArguments(Array(arguments.dropFirst(3)))
        result = FileSearcher.listDirectory(path, settings: settings)

    case "check-fd":
        let fdAvailable = FileSearcher.isFdAvailable()
        let fdPath = FileSearcher.getFdPath()
        result = [
            "fdAvailable": fdAvailable,
            "fdPath": fdPath ?? NSNull()
        ]

    default:
        fputs("Unknown command: \(command)\n", stderr)
        exit(1)
    }

    // Convert result to JSON and output
    do {
        let jsonData = try JSONSerialization.data(withJSONObject: result, options: [.sortedKeys])
        if let jsonString = String(data: jsonData, encoding: .utf8) {
            print(jsonString)
        }
    } catch {
        fputs("JSON serialization error: \(error.localizedDescription)\n", stderr)
        exit(1)
    }

    exit(0)
}

main()
