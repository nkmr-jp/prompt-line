import Foundation

// MARK: - Symbol Types

/// Symbol types that can be detected
enum SymbolType: String, Codable {
    case function
    case method
    case classDecl = "class"
    case structDecl = "struct"
    case interface
    case typeAlias = "type"
    case constant
    case variable
    case enumDecl = "enum"
    case property
    case module
    case namespace
    case heading
    case link
}

// MARK: - Language Configuration

/// Configuration for a programming language
struct LanguageConfig {
    let extensionName: String  // Renamed to avoid conflict with Swift keyword
    let displayName: String
    let rgType: String         // rg --type argument
    let patterns: [SymbolPattern]
}

/// Pattern for detecting a symbol type
struct SymbolPattern {
    let type: SymbolType
    let regex: String
    let captureGroup: Int
}

// MARK: - Search Results

/// A single symbol search result
struct SymbolResult: Codable {
    let name: String
    let type: SymbolType
    let filePath: String
    let relativePath: String
    let lineNumber: Int
    let lineContent: String
    let language: String
}

/// Response from symbol search command
struct SymbolSearchResponse: Codable {
    let success: Bool
    let directory: String?
    let language: String?
    let symbols: [SymbolResult]
    let symbolCount: Int
    let searchMode: String        // "full" or "cached"
    let partial: Bool             // Whether results hit the limit
    let maxSymbols: Int
    let error: String?
}

/// Response from check-rg command
struct RgCheckResponse: Codable {
    let rgAvailable: Bool
    let rgPath: String?
}

/// Language info for list-languages command
struct LanguageInfo: Codable {
    let key: String
    let extensionName: String  // Renamed to match LanguageConfig
    let displayName: String
}
