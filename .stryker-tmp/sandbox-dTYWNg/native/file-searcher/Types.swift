import Foundation

// MARK: - File Search Settings

struct FileSearchSettings {
    let respectGitignore: Bool
    let excludePatterns: [String]
    let includePatterns: [String]
    let maxFiles: Int
    let includeHidden: Bool
    let maxDepth: Int?
    let followSymlinks: Bool

    static let `default` = FileSearchSettings(
        respectGitignore: true,
        excludePatterns: [],
        includePatterns: [],
        maxFiles: 5000,
        includeHidden: true,
        maxDepth: nil,
        followSymlinks: false
    )

    /// Parse settings from command line arguments
    static func fromArguments(_ args: [String]) -> FileSearchSettings {
        var respectGitignore = true
        var excludePatterns: [String] = []
        var includePatterns: [String] = []
        var maxFiles = 5000
        var includeHidden = true
        var maxDepth: Int? = nil
        var followSymlinks = false

        var i = 0
        while i < args.count {
            switch args[i] {
            case "--no-gitignore":
                respectGitignore = false
                i += 1
            case "--exclude":
                if i + 1 < args.count {
                    excludePatterns.append(args[i + 1])
                    i += 2
                } else {
                    i += 1
                }
            case "--include":
                if i + 1 < args.count {
                    includePatterns.append(args[i + 1])
                    i += 2
                } else {
                    i += 1
                }
            case "--max-files":
                if i + 1 < args.count, let value = Int(args[i + 1]) {
                    maxFiles = value
                    i += 2
                } else {
                    i += 1
                }
            case "--include-hidden":
                includeHidden = true
                i += 1
            case "--max-depth":
                if i + 1 < args.count, let value = Int(args[i + 1]) {
                    maxDepth = value
                    i += 2
                } else {
                    i += 1
                }
            case "--follow-symlinks":
                followSymlinks = true
                i += 1
            default:
                i += 1
            }
        }

        return FileSearchSettings(
            respectGitignore: respectGitignore,
            excludePatterns: excludePatterns,
            includePatterns: includePatterns,
            maxFiles: maxFiles,
            includeHidden: includeHidden,
            maxDepth: maxDepth,
            followSymlinks: followSymlinks
        )
    }
}

// MARK: - File List Result

struct FileListResult {
    let files: [[String: Any]]
    let fileLimitReached: Bool
    let maxFiles: Int
}

// MARK: - Default Excludes

/// Default patterns to exclude from file search
/// These are common directories/files that should not be searched
let DEFAULT_EXCLUDES: [String] = [
    // Dependencies
    "node_modules", "vendor", "bower_components", ".pnpm",
    // Build outputs
    ".next", ".nuxt", "dist", "build", "out", "target", ".output",
    // Version control
    ".git", ".svn", ".hg",
    // IDE
    ".idea", ".vscode", ".fleet",
    // Cache
    ".cache", "__pycache__", ".pytest_cache", ".mypy_cache", ".ruff_cache",
    // OS
    ".DS_Store", "Thumbs.db",
    // Other
    "coverage", ".nyc_output", ".turbo", ".vercel", ".netlify"
]
