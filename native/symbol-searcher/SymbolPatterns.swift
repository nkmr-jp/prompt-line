import Foundation

// MARK: - Language Pattern Definitions

/// Mapping of language keys to their configurations
let LANGUAGE_PATTERNS: [String: LanguageConfig] = [
    "go": LanguageConfig(
        extensionName: "go",
        displayName: "Go",
        rgType: "go",
        patterns: [
            SymbolPattern(type: .function, regex: "^func\\s+(\\w+)\\s*\\(", captureGroup: 1),
            SymbolPattern(type: .method, regex: "^func\\s*\\([^)]+\\)\\s+(\\w+)\\s*\\(", captureGroup: 1),
            SymbolPattern(type: .structDecl, regex: "^type\\s+(\\w+)\\s+struct\\s*\\{", captureGroup: 1),
            SymbolPattern(type: .interface, regex: "^type\\s+(\\w+)\\s+interface\\s*\\{", captureGroup: 1),
        ]
    ),
    "ts": LanguageConfig(
        extensionName: "ts",
        displayName: "TypeScript",
        rgType: "ts",
        patterns: [
            SymbolPattern(type: .function, regex: "^(?:export\\s+)?(?:async\\s+)?function\\s+(\\w+)", captureGroup: 1),
            SymbolPattern(type: .classDecl, regex: "^(?:export\\s+)?(?:abstract\\s+)?class\\s+(\\w+)", captureGroup: 1),
            SymbolPattern(type: .interface, regex: "^(?:export\\s+)?interface\\s+(\\w+)", captureGroup: 1),
            SymbolPattern(type: .typeAlias, regex: "^(?:export\\s+)?type\\s+(\\w+)\\s*=", captureGroup: 1),
        ]
    ),
    "tsx": LanguageConfig(
        extensionName: "tsx",
        displayName: "TypeScript React",
        rgType: "tsx",
        patterns: [
            SymbolPattern(type: .function, regex: "^(?:export\\s+)?(?:async\\s+)?function\\s+(\\w+)", captureGroup: 1),
            SymbolPattern(type: .classDecl, regex: "^(?:export\\s+)?class\\s+(\\w+)", captureGroup: 1),
            SymbolPattern(type: .interface, regex: "^(?:export\\s+)?interface\\s+(\\w+)", captureGroup: 1),
            SymbolPattern(type: .typeAlias, regex: "^(?:export\\s+)?type\\s+(\\w+)\\s*=", captureGroup: 1),
        ]
    ),
    "js": LanguageConfig(
        extensionName: "js",
        displayName: "JavaScript",
        rgType: "js",
        patterns: [
            SymbolPattern(type: .function, regex: "^(?:export\\s+)?(?:async\\s+)?function\\s+(\\w+)", captureGroup: 1),
            SymbolPattern(type: .classDecl, regex: "^(?:export\\s+)?class\\s+(\\w+)", captureGroup: 1),
        ]
    ),
    "jsx": LanguageConfig(
        extensionName: "jsx",
        displayName: "JavaScript React",
        rgType: "jsx",
        patterns: [
            SymbolPattern(type: .function, regex: "^(?:export\\s+)?(?:async\\s+)?function\\s+(\\w+)", captureGroup: 1),
            SymbolPattern(type: .classDecl, regex: "^(?:export\\s+)?class\\s+(\\w+)", captureGroup: 1),
        ]
    ),
    "py": LanguageConfig(
        extensionName: "py",
        displayName: "Python",
        rgType: "py",
        patterns: [
            SymbolPattern(type: .function, regex: "^def\\s+(\\w+)\\s*\\(", captureGroup: 1),
            SymbolPattern(type: .classDecl, regex: "^class\\s+(\\w+)", captureGroup: 1),
        ]
    ),
    "rs": LanguageConfig(
        extensionName: "rs",
        displayName: "Rust",
        rgType: "rust",
        patterns: [
            SymbolPattern(type: .function, regex: "^(?:pub\\s+)?(?:async\\s+)?fn\\s+(\\w+)", captureGroup: 1),
            SymbolPattern(type: .structDecl, regex: "^(?:pub\\s+)?struct\\s+(\\w+)", captureGroup: 1),
            SymbolPattern(type: .typeAlias, regex: "^(?:pub\\s+)?type\\s+(\\w+)", captureGroup: 1),
            SymbolPattern(type: .interface, regex: "^(?:pub\\s+)?trait\\s+(\\w+)", captureGroup: 1),
        ]
    ),
    "java": LanguageConfig(
        extensionName: "java",
        displayName: "Java",
        rgType: "java",
        patterns: [
            SymbolPattern(type: .classDecl, regex: "^(?:public\\s+)?(?:abstract\\s+)?class\\s+(\\w+)", captureGroup: 1),
            SymbolPattern(type: .interface, regex: "^(?:public\\s+)?interface\\s+(\\w+)", captureGroup: 1),
        ]
    ),
    "kt": LanguageConfig(
        extensionName: "kt",
        displayName: "Kotlin",
        rgType: "kotlin",
        patterns: [
            SymbolPattern(type: .function, regex: "^(?:suspend\\s+)?fun\\s+(\\w+)", captureGroup: 1),
            SymbolPattern(type: .classDecl, regex: "^(?:data\\s+)?class\\s+(\\w+)", captureGroup: 1),
            SymbolPattern(type: .interface, regex: "^interface\\s+(\\w+)", captureGroup: 1),
        ]
    ),
    "swift": LanguageConfig(
        extensionName: "swift",
        displayName: "Swift",
        rgType: "swift",
        patterns: [
            SymbolPattern(type: .function, regex: "^\\s*(?:public\\s+|private\\s+|internal\\s+)?func\\s+(\\w+)", captureGroup: 1),
            SymbolPattern(type: .classDecl, regex: "^(?:public\\s+|private\\s+)?class\\s+(\\w+)", captureGroup: 1),
            SymbolPattern(type: .structDecl, regex: "^(?:public\\s+|private\\s+)?struct\\s+(\\w+)", captureGroup: 1),
            SymbolPattern(type: .interface, regex: "^(?:public\\s+|private\\s+)?protocol\\s+(\\w+)", captureGroup: 1),
        ]
    ),
    "rb": LanguageConfig(
        extensionName: "rb",
        displayName: "Ruby",
        rgType: "ruby",
        patterns: [
            SymbolPattern(type: .function, regex: "^\\s*def\\s+(\\w+)", captureGroup: 1),
            SymbolPattern(type: .classDecl, regex: "^class\\s+(\\w+)", captureGroup: 1),
        ]
    ),
    "cpp": LanguageConfig(
        extensionName: "cpp",
        displayName: "C++",
        rgType: "cpp",
        patterns: [
            SymbolPattern(type: .classDecl, regex: "^class\\s+(\\w+)", captureGroup: 1),
            SymbolPattern(type: .structDecl, regex: "^struct\\s+(\\w+)", captureGroup: 1),
        ]
    ),
    "c": LanguageConfig(
        extensionName: "c",
        displayName: "C",
        rgType: "c",
        patterns: [
            SymbolPattern(type: .structDecl, regex: "^struct\\s+(\\w+)", captureGroup: 1),
        ]
    ),
]

/// Get all supported language keys
func getSupportedLanguages() -> [LanguageInfo] {
    return LANGUAGE_PATTERNS.map { key, config in
        LanguageInfo(
            key: key,
            extensionName: config.extensionName,
            displayName: config.displayName
        )
    }.sorted { $0.key < $1.key }
}
