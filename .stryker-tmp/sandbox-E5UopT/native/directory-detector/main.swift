import Foundation

// MARK: - CLI Entry Point

func main() {
    let arguments = CommandLine.arguments

    guard arguments.count >= 2 else {
        fputs("Usage: \(arguments[0]) <command> [options]\n", stderr)
        fputs("Commands:\n", stderr)
        fputs("  detect [--pid <pid> --bundleId <bundleId>] - Detect current directory from active terminal/IDE\n", stderr)
        fputs("\nOptions:\n", stderr)
        fputs("  --pid <pid>        - Use specific process ID instead of frontmost app\n", stderr)
        fputs("  --bundleId <id>    - Bundle ID of the app (required with --pid)\n", stderr)
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

    switch command {
    case "detect":
        result = DirectoryDetector.detectCurrentDirectory(overridePid: overridePid, overrideBundleId: overrideBundleId)

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
