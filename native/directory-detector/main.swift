import Foundation

// MARK: - CLI Entry Point

func main() {
    let arguments = CommandLine.arguments

    guard arguments.count >= 2 else {
        fputs("Usage: \(arguments[0]) <command> [options]\n", stderr)
        fputs("Commands:\n", stderr)
        fputs("  detect [--pid <pid> --bundleId <bundleId>] - Detect current directory from active terminal\n", stderr)
        fputs("  detect-with-files [--pid <pid> --bundleId <bundleId>] [options] - Detect current directory and list files recursively with fd\n", stderr)
        fputs("  list <path> [options] - List files in specified directory recursively with fd\n", stderr)
        fputs("  check-fd         - Check if fd command is available\n", stderr)
        fputs("\nOptions:\n", stderr)
        fputs("  --pid <pid>        - Use specific process ID instead of frontmost app\n", stderr)
        fputs("  --bundleId <id>    - Bundle ID of the app (required with --pid)\n", stderr)
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

    // Parse optional --pid and --bundleId arguments
    var overridePid: pid_t? = nil
    var overrideBundleId: String? = nil

    var i = 2
    while i < arguments.count {
        if arguments[i] == "--pid" && i + 1 < arguments.count {
            if let pid = Int32(arguments[i + 1]) {
                overridePid = pid
            }
            i += 2
        } else if arguments[i] == "--bundleId" && i + 1 < arguments.count {
            overrideBundleId = arguments[i + 1]
            i += 2
        } else {
            i += 1
        }
    }

    // Parse FileSearchSettings from arguments
    let settings = FileSearchSettings.fromArguments(Array(arguments.dropFirst(2)))

    switch command {
    case "detect":
        result = DirectoryDetector.detectCurrentDirectory(overridePid: overridePid, overrideBundleId: overrideBundleId)

    case "detect-with-files":
        result = DirectoryDetector.detectCurrentDirectoryWithFiles(
            overridePid: overridePid,
            overrideBundleId: overrideBundleId,
            settings: settings
        )

    case "list":
        guard arguments.count >= 3 else {
            fputs("Error: 'list' command requires a path argument\n", stderr)
            exit(1)
        }
        let path = arguments[2]
        result = DirectoryDetector.listDirectory(path, settings: settings)

    case "check-fd":
        let fdAvailable = DirectoryDetector.isFdAvailable()
        let fdPath = DirectoryDetector.getFdPath()
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
