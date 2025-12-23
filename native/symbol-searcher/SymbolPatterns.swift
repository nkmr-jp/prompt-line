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
            SymbolPattern(type: .structDecl, regex: "^type\\s+(\\w+)\\s+struct", captureGroup: 1),
            SymbolPattern(type: .interface, regex: "^type\\s+(\\w+)\\s+interface", captureGroup: 1),
            SymbolPattern(type: .typeAlias, regex: "^type\\s+(\\w+)\\s+(?!struct|interface)\\w+", captureGroup: 1),
            SymbolPattern(type: .constant, regex: "^const\\s+(\\w+)\\s*=", captureGroup: 1),
            // Constants inside const ( ... ) block with type: `Name Type = value`
            SymbolPattern(type: .constant, regex: "^\\s+(\\w+)\\s+\\w+\\s*=\\s*[\"']", captureGroup: 1),
            // Constants inside const ( ... ) block without type: `Name = value`
            SymbolPattern(type: .constant, regex: "^\\s+(\\w+)\\s*=\\s*(?:iota|\\d)", captureGroup: 1),
            SymbolPattern(type: .variable, regex: "^var\\s+(\\w+)\\s+", captureGroup: 1),
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
            SymbolPattern(type: .typeAlias, regex: "^(?:export\\s+)?type\\s+(\\w+)\\s*[=<]", captureGroup: 1),
            SymbolPattern(type: .enumDecl, regex: "^(?:export\\s+)?(?:const\\s+)?enum\\s+(\\w+)", captureGroup: 1),
            SymbolPattern(type: .constant, regex: "^(?:export\\s+)?const\\s+(\\w+)\\s*[=:]", captureGroup: 1),
            SymbolPattern(type: .namespace, regex: "^(?:export\\s+)?(?:declare\\s+)?namespace\\s+(\\w+)", captureGroup: 1),
        ]
    ),
    "tsx": LanguageConfig(
        extensionName: "tsx",
        displayName: "TypeScript React",
        rgType: "tsx",
        patterns: [
            SymbolPattern(type: .function, regex: "^(?:export\\s+)?(?:async\\s+)?function\\s+(\\w+)", captureGroup: 1),
            SymbolPattern(type: .classDecl, regex: "^(?:export\\s+)?(?:abstract\\s+)?class\\s+(\\w+)", captureGroup: 1),
            SymbolPattern(type: .interface, regex: "^(?:export\\s+)?interface\\s+(\\w+)", captureGroup: 1),
            SymbolPattern(type: .typeAlias, regex: "^(?:export\\s+)?type\\s+(\\w+)\\s*[=<]", captureGroup: 1),
            SymbolPattern(type: .enumDecl, regex: "^(?:export\\s+)?(?:const\\s+)?enum\\s+(\\w+)", captureGroup: 1),
            SymbolPattern(type: .constant, regex: "^(?:export\\s+)?const\\s+(\\w+)\\s*[=:]", captureGroup: 1),
        ]
    ),
    "js": LanguageConfig(
        extensionName: "js",
        displayName: "JavaScript",
        rgType: "js",
        patterns: [
            SymbolPattern(type: .function, regex: "^(?:export\\s+)?(?:async\\s+)?function\\s+(\\w+)", captureGroup: 1),
            SymbolPattern(type: .classDecl, regex: "^(?:export\\s+)?class\\s+(\\w+)", captureGroup: 1),
            SymbolPattern(type: .constant, regex: "^(?:export\\s+)?const\\s+(\\w+)\\s*[=;]", captureGroup: 1),
            SymbolPattern(type: .variable, regex: "^(?:export\\s+)?let\\s+(\\w+)\\s*[=;,]", captureGroup: 1),
            SymbolPattern(type: .variable, regex: "^(?:export\\s+)?var\\s+(\\w+)\\s*[=;,]", captureGroup: 1),
        ]
    ),
    "jsx": LanguageConfig(
        extensionName: "jsx",
        displayName: "JavaScript React",
        rgType: "jsx",
        patterns: [
            SymbolPattern(type: .function, regex: "^(?:export\\s+)?(?:async\\s+)?function\\s+(\\w+)", captureGroup: 1),
            SymbolPattern(type: .classDecl, regex: "^(?:export\\s+)?class\\s+(\\w+)", captureGroup: 1),
            SymbolPattern(type: .constant, regex: "^(?:export\\s+)?const\\s+(\\w+)\\s*[=;]", captureGroup: 1),
            SymbolPattern(type: .variable, regex: "^(?:export\\s+)?let\\s+(\\w+)\\s*[=;,]", captureGroup: 1),
            SymbolPattern(type: .variable, regex: "^(?:export\\s+)?var\\s+(\\w+)\\s*[=;,]", captureGroup: 1),
        ]
    ),
    "py": LanguageConfig(
        extensionName: "py",
        displayName: "Python",
        rgType: "py",
        patterns: [
            SymbolPattern(type: .function, regex: "^(?:async\\s+)?def\\s+(\\w+)\\s*\\(", captureGroup: 1),
            SymbolPattern(type: .classDecl, regex: "^class\\s+(\\w+)", captureGroup: 1),
            SymbolPattern(type: .constant, regex: "^([A-Z][A-Z0-9_]+)\\s*=", captureGroup: 1),
        ]
    ),
    "rs": LanguageConfig(
        extensionName: "rs",
        displayName: "Rust",
        rgType: "rust",
        patterns: [
            SymbolPattern(type: .function, regex: "^(?:pub(?:\\([^)]+\\))?\\s+)?(?:async\\s+)?(?:unsafe\\s+)?(?:extern\\s+\"C\"\\s+)?fn\\s+(\\w+)", captureGroup: 1),
            SymbolPattern(type: .structDecl, regex: "^(?:pub(?:\\([^)]+\\))?\\s+)?struct\\s+(\\w+)", captureGroup: 1),
            SymbolPattern(type: .enumDecl, regex: "^(?:pub(?:\\([^)]+\\))?\\s+)?enum\\s+(\\w+)", captureGroup: 1),
            SymbolPattern(type: .interface, regex: "^(?:pub(?:\\([^)]+\\))?\\s+)?(?:unsafe\\s+)?trait\\s+(\\w+)", captureGroup: 1),
            SymbolPattern(type: .typeAlias, regex: "^(?:pub(?:\\([^)]+\\))?\\s+)?type\\s+(\\w+)", captureGroup: 1),
            SymbolPattern(type: .constant, regex: "^(?:pub(?:\\([^)]+\\))?\\s+)?const\\s+(\\w+)\\s*:", captureGroup: 1),
            SymbolPattern(type: .variable, regex: "^(?:pub(?:\\([^)]+\\))?\\s+)?static\\s+(?:mut\\s+)?(\\w+)\\s*:", captureGroup: 1),
            SymbolPattern(type: .module, regex: "^(?:pub(?:\\([^)]+\\))?\\s+)?mod\\s+(\\w+)", captureGroup: 1),
        ]
    ),
    "java": LanguageConfig(
        extensionName: "java",
        displayName: "Java",
        rgType: "java",
        patterns: [
            SymbolPattern(type: .classDecl, regex: "^(?:public\\s+|private\\s+|protected\\s+)?(?:abstract\\s+|final\\s+)?class\\s+(\\w+)", captureGroup: 1),
            SymbolPattern(type: .interface, regex: "^(?:public\\s+)?interface\\s+(\\w+)", captureGroup: 1),
            SymbolPattern(type: .enumDecl, regex: "^(?:public\\s+)?enum\\s+(\\w+)", captureGroup: 1),
            SymbolPattern(type: .method, regex: "^\\s+(?:public\\s+|private\\s+|protected\\s+)?(?:static\\s+)?(?:final\\s+)?(?:synchronized\\s+)?(?:\\w+(?:<[^>]+>)?\\s+)(\\w+)\\s*\\(", captureGroup: 1),
        ]
    ),
    "kt": LanguageConfig(
        extensionName: "kt",
        displayName: "Kotlin",
        rgType: "kotlin",
        patterns: [
            SymbolPattern(type: .function, regex: "^(?:suspend\\s+)?(?:inline\\s+)?(?:private\\s+|internal\\s+)?fun\\s+(?:<[^>]+>\\s+)?(\\w+)", captureGroup: 1),
            SymbolPattern(type: .classDecl, regex: "^(?:data\\s+|sealed\\s+|open\\s+|abstract\\s+)?(?:private\\s+|internal\\s+)?class\\s+(\\w+)", captureGroup: 1),
            SymbolPattern(type: .interface, regex: "^(?:private\\s+|internal\\s+)?interface\\s+(\\w+)", captureGroup: 1),
            SymbolPattern(type: .enumDecl, regex: "^(?:private\\s+|internal\\s+)?enum\\s+class\\s+(\\w+)", captureGroup: 1),
            SymbolPattern(type: .typeAlias, regex: "^(?:private\\s+|internal\\s+)?typealias\\s+(\\w+)", captureGroup: 1),
            SymbolPattern(type: .constant, regex: "^(?:private\\s+|internal\\s+)?(?:const\\s+)?val\\s+(\\w+)\\s*[=:]", captureGroup: 1),
        ]
    ),
    "swift": LanguageConfig(
        extensionName: "swift",
        displayName: "Swift",
        rgType: "swift",
        patterns: [
            SymbolPattern(type: .function, regex: "^\\s*(?:public\\s+|private\\s+|internal\\s+|fileprivate\\s+|open\\s+)?(?:static\\s+)?(?:class\\s+)?func\\s+(\\w+)", captureGroup: 1),
            SymbolPattern(type: .classDecl, regex: "^(?:public\\s+|private\\s+|internal\\s+|fileprivate\\s+|open\\s+)?(?:final\\s+)?class\\s+(\\w+)", captureGroup: 1),
            SymbolPattern(type: .structDecl, regex: "^(?:public\\s+|private\\s+|internal\\s+|fileprivate\\s+)?struct\\s+(\\w+)", captureGroup: 1),
            SymbolPattern(type: .interface, regex: "^(?:public\\s+|private\\s+|internal\\s+|fileprivate\\s+)?protocol\\s+(\\w+)", captureGroup: 1),
            SymbolPattern(type: .enumDecl, regex: "^(?:public\\s+|private\\s+|internal\\s+|fileprivate\\s+)?enum\\s+(\\w+)", captureGroup: 1),
            SymbolPattern(type: .typeAlias, regex: "^(?:public\\s+|private\\s+|internal\\s+|fileprivate\\s+)?typealias\\s+(\\w+)", captureGroup: 1),
        ]
    ),
    "rb": LanguageConfig(
        extensionName: "rb",
        displayName: "Ruby",
        rgType: "ruby",
        patterns: [
            SymbolPattern(type: .function, regex: "^\\s*def\\s+(self\\.)?(\\w+[!?]?)", captureGroup: 2),
            SymbolPattern(type: .classDecl, regex: "^class\\s+(\\w+)", captureGroup: 1),
            SymbolPattern(type: .module, regex: "^module\\s+(\\w+)", captureGroup: 1),
            SymbolPattern(type: .constant, regex: "^\\s*([A-Z][A-Z0-9_]+)\\s*=", captureGroup: 1),
        ]
    ),
    "cpp": LanguageConfig(
        extensionName: "cpp",
        displayName: "C++",
        rgType: "cpp",
        patterns: [
            SymbolPattern(type: .classDecl, regex: "^(?:template\\s*<[^>]*>\\s*)?class\\s+(\\w+)", captureGroup: 1),
            SymbolPattern(type: .structDecl, regex: "^(?:template\\s*<[^>]*>\\s*)?struct\\s+(\\w+)", captureGroup: 1),
            SymbolPattern(type: .enumDecl, regex: "^enum\\s+(?:class\\s+)?(\\w+)", captureGroup: 1),
            SymbolPattern(type: .namespace, regex: "^namespace\\s+(\\w+)", captureGroup: 1),
            SymbolPattern(type: .typeAlias, regex: "^(?:using|typedef)\\s+(?:\\w+\\s+)*(\\w+)\\s*=", captureGroup: 1),
        ]
    ),
    "c": LanguageConfig(
        extensionName: "c",
        displayName: "C",
        rgType: "c",
        patterns: [
            SymbolPattern(type: .structDecl, regex: "^(?:typedef\\s+)?struct\\s+(\\w+)", captureGroup: 1),
            SymbolPattern(type: .enumDecl, regex: "^(?:typedef\\s+)?enum\\s+(\\w+)", captureGroup: 1),
            SymbolPattern(type: .typeAlias, regex: "^typedef\\s+\\w+\\s+(\\w+)\\s*;", captureGroup: 1),
        ]
    ),
    "sh": LanguageConfig(
        extensionName: "sh",
        displayName: "Shell",
        rgType: "sh",
        patterns: [
            // function name() { or function name {
            SymbolPattern(type: .function, regex: "^function\\s+(\\w+)\\s*(?:\\(\\)|\\{)", captureGroup: 1),
            // name() { (POSIX style)
            SymbolPattern(type: .function, regex: "^(\\w+)\\s*\\(\\)\\s*\\{", captureGroup: 1),
            // Variable assignment (uppercase convention)
            SymbolPattern(type: .variable, regex: "^([A-Z][A-Z0-9_]*)=", captureGroup: 1),
        ]
    ),
    "make": LanguageConfig(
        extensionName: "mk",
        displayName: "Makefile",
        rgType: "make",
        patterns: [
            // Targets (target: or target::)
            SymbolPattern(type: .function, regex: "^([a-zA-Z_][a-zA-Z0-9_-]*)\\s*::?", captureGroup: 1),
            // Variable definitions (VAR = or VAR :=)
            SymbolPattern(type: .variable, regex: "^([A-Z][A-Z0-9_]*)\\s*[:?]?=", captureGroup: 1),
        ]
    ),
    // Alias: @mk: for Makefile (same as @make:)
    "mk": LanguageConfig(
        extensionName: "mk",
        displayName: "Makefile",
        rgType: "make",
        patterns: [
            // Targets (target: or target::)
            SymbolPattern(type: .function, regex: "^([a-zA-Z_][a-zA-Z0-9_-]*)\\s*::?", captureGroup: 1),
            // Variable definitions (VAR = or VAR :=)
            SymbolPattern(type: .variable, regex: "^([A-Z][A-Z0-9_]*)\\s*[:?]?=", captureGroup: 1),
        ]
    ),
    "php": LanguageConfig(
        extensionName: "php",
        displayName: "PHP",
        rgType: "php",
        patterns: [
            SymbolPattern(type: .function, regex: "^\\s*(?:public\\s+|private\\s+|protected\\s+)?(?:static\\s+)?function\\s+(\\w+)", captureGroup: 1),
            SymbolPattern(type: .classDecl, regex: "^(?:abstract\\s+|final\\s+)?class\\s+(\\w+)", captureGroup: 1),
            SymbolPattern(type: .interface, regex: "^interface\\s+(\\w+)", captureGroup: 1),
            SymbolPattern(type: .interface, regex: "^trait\\s+(\\w+)", captureGroup: 1),
            SymbolPattern(type: .constant, regex: "^\\s*(?:public\\s+|private\\s+|protected\\s+)?const\\s+(\\w+)\\s*=", captureGroup: 1),
            SymbolPattern(type: .enumDecl, regex: "^enum\\s+(\\w+)", captureGroup: 1),
        ]
    ),
    "cs": LanguageConfig(
        extensionName: "cs",
        displayName: "C#",
        rgType: "csharp",
        patterns: [
            SymbolPattern(type: .classDecl, regex: "^\\s*(?:public\\s+|private\\s+|protected\\s+|internal\\s+)?(?:static\\s+)?(?:sealed\\s+|abstract\\s+|partial\\s+)?class\\s+(\\w+)", captureGroup: 1),
            SymbolPattern(type: .interface, regex: "^\\s*(?:public\\s+|private\\s+|protected\\s+|internal\\s+)?interface\\s+(\\w+)", captureGroup: 1),
            SymbolPattern(type: .structDecl, regex: "^\\s*(?:public\\s+|private\\s+|protected\\s+|internal\\s+)?(?:readonly\\s+)?struct\\s+(\\w+)", captureGroup: 1),
            SymbolPattern(type: .enumDecl, regex: "^\\s*(?:public\\s+|private\\s+|protected\\s+|internal\\s+)?enum\\s+(\\w+)", captureGroup: 1),
            SymbolPattern(type: .method, regex: "^\\s*(?:public\\s+|private\\s+|protected\\s+|internal\\s+)?(?:static\\s+)?(?:async\\s+)?(?:virtual\\s+|override\\s+|abstract\\s+)?(?:\\w+(?:<[^>]+>)?\\s+)(\\w+)\\s*\\(", captureGroup: 1),
            SymbolPattern(type: .namespace, regex: "^namespace\\s+([\\w.]+)", captureGroup: 1),
        ]
    ),
    "scala": LanguageConfig(
        extensionName: "scala",
        displayName: "Scala",
        rgType: "scala",
        patterns: [
            SymbolPattern(type: .function, regex: "^\\s*(?:private\\s+|protected\\s+)?def\\s+(\\w+)", captureGroup: 1),
            SymbolPattern(type: .classDecl, regex: "^(?:sealed\\s+|abstract\\s+|final\\s+)?(?:case\\s+)?class\\s+(\\w+)", captureGroup: 1),
            SymbolPattern(type: .interface, regex: "^(?:sealed\\s+)?trait\\s+(\\w+)", captureGroup: 1),
            SymbolPattern(type: .module, regex: "^(?:case\\s+)?object\\s+(\\w+)", captureGroup: 1),
            SymbolPattern(type: .typeAlias, regex: "^\\s*type\\s+(\\w+)", captureGroup: 1),
            SymbolPattern(type: .constant, regex: "^\\s*(?:private\\s+|protected\\s+)?val\\s+(\\w+)\\s*[=:]", captureGroup: 1),
            SymbolPattern(type: .variable, regex: "^\\s*(?:private\\s+|protected\\s+)?var\\s+(\\w+)\\s*[=:]", captureGroup: 1),
        ]
    ),
    "tf": LanguageConfig(
        extensionName: "tf",
        displayName: "Terraform",
        rgType: "tf",
        patterns: [
            // resource "aws_instance" "example" { → captures "example"
            SymbolPattern(type: .resource, regex: "^resource\\s+\"[^\"]+\"\\s+\"([\\w-]+)\"", captureGroup: 1),
            // data "aws_ami" "example" { → captures "example"
            SymbolPattern(type: .dataSource, regex: "^data\\s+\"[^\"]+\"\\s+\"([\\w-]+)\"", captureGroup: 1),
            // variable "instance_type" { → captures "instance_type"
            SymbolPattern(type: .variable, regex: "^variable\\s+\"([\\w-]+)\"", captureGroup: 1),
            // output "instance_ip" { → captures "instance_ip"
            SymbolPattern(type: .output, regex: "^output\\s+\"([\\w-]+)\"", captureGroup: 1),
            // module "vpc" { → captures "vpc"
            SymbolPattern(type: .module, regex: "^module\\s+\"([\\w-]+)\"", captureGroup: 1),
            // provider "aws" { → captures "aws"
            SymbolPattern(type: .provider, regex: "^provider\\s+\"([\\w-]+)\"", captureGroup: 1),
            // locals { with named values inside: local_name = value
            SymbolPattern(type: .constant, regex: "^\\s+([a-z][\\w-]*)\\s*=\\s*(?![=])", captureGroup: 1),
        ]
    ),
    // Alias: @terraform: for Terraform (same as @tf:)
    "terraform": LanguageConfig(
        extensionName: "tf",
        displayName: "Terraform",
        rgType: "tf",
        patterns: [
            SymbolPattern(type: .resource, regex: "^resource\\s+\"[^\"]+\"\\s+\"([\\w-]+)\"", captureGroup: 1),
            SymbolPattern(type: .dataSource, regex: "^data\\s+\"[^\"]+\"\\s+\"([\\w-]+)\"", captureGroup: 1),
            SymbolPattern(type: .variable, regex: "^variable\\s+\"([\\w-]+)\"", captureGroup: 1),
            SymbolPattern(type: .output, regex: "^output\\s+\"([\\w-]+)\"", captureGroup: 1),
            SymbolPattern(type: .module, regex: "^module\\s+\"([\\w-]+)\"", captureGroup: 1),
            SymbolPattern(type: .provider, regex: "^provider\\s+\"([\\w-]+)\"", captureGroup: 1),
            SymbolPattern(type: .constant, regex: "^\\s+([a-z][\\w-]*)\\s*=\\s*(?![=])", captureGroup: 1),
        ]
    ),
    "md": LanguageConfig(
        extensionName: "md",
        displayName: "Markdown",
        rgType: "markdown",
        patterns: [
            // ATX-style headings: # Heading, ## Heading, etc. (capture heading text)
            SymbolPattern(type: .heading, regex: "^#{1,6}\\s+(.+?)(?:\\s+#+)?$", captureGroup: 1),
            // Link reference definitions: [reference]: url
            SymbolPattern(type: .link, regex: "^\\[([^\\]]+)\\]:\\s*\\S", captureGroup: 1),
        ]
    ),
    // Alias: @markdown: for Markdown (same as @md:)
    "markdown": LanguageConfig(
        extensionName: "md",
        displayName: "Markdown",
        rgType: "markdown",
        patterns: [
            SymbolPattern(type: .heading, regex: "^#{1,6}\\s+(.+?)(?:\\s+#+)?$", captureGroup: 1),
            SymbolPattern(type: .link, regex: "^\\[([^\\]]+)\\]:\\s*\\S", captureGroup: 1),
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
