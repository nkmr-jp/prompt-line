/**
 * Symbol Searcher - Cross-platform symbol search using ripgrep
 * Replaces native Swift symbol-searcher binary
 *
 * Ported from native/symbol-searcher/SymbolPatterns.swift
 * Supports 20+ programming languages with comprehensive symbol patterns
 */

import { execFile } from 'child_process';
import { logger } from '../logger';
import type {
  SymbolSearchResponse,
  RgCheckResponse,
  LanguagesResponse,
  SymbolSearchOptions,
  SymbolResult,
  SymbolType
} from '../../managers/symbol-search/types';

const DEFAULT_MAX_SYMBOLS = 200000;
const DEFAULT_SEARCH_TIMEOUT = 5000; // 5 seconds
const DEFAULT_MAX_BUFFER = 100 * 1024 * 1024; // 100MB

/**
 * Pattern definition for symbol detection
 * captureGroup: 1-based index of the capturing group containing the symbol name
 */
interface SymbolPattern {
  type: SymbolType;
  pattern: string;
  captureGroup: number;
}

/**
 * Language configuration
 * rgType: ripgrep's built-in type name for --type filtering
 * extensions: file extensions for --glob fallback
 */
interface LanguageConfig {
  name: string;
  rgType: string;
  extensions: string[];
  patterns: SymbolPattern[];
}

/**
 * Language configurations with file extensions and symbol patterns
 * Ported from native/symbol-searcher/SymbolPatterns.swift
 */
const LANGUAGE_CONFIGS: Record<string, LanguageConfig> = {
  go: {
    name: 'Go',
    rgType: 'go',
    extensions: ['.go'],
    patterns: [
      // Generic function: func Name[T any](...) or func Name[T any, R comparable](...)
      { type: 'function', pattern: '^func\\s+(\\w+)\\s*\\[[^\\]]+\\]\\s*\\(', captureGroup: 1 },
      // Regular function: func Name(...)
      { type: 'function', pattern: '^func\\s+(\\w+)\\s*\\(', captureGroup: 1 },
      // Generic method: func (r *Receiver) Name[T any](...)
      { type: 'method', pattern: '^func\\s*\\([^)]+\\)\\s+(\\w+)\\s*\\[[^\\]]+\\]\\s*\\(', captureGroup: 1 },
      // Regular method: func (r *Receiver) Name(...)
      { type: 'method', pattern: '^func\\s*\\([^)]+\\)\\s+(\\w+)\\s*\\(', captureGroup: 1 },
      { type: 'struct', pattern: '^type\\s+(\\w+)\\s+struct', captureGroup: 1 },
      { type: 'interface', pattern: '^type\\s+(\\w+)\\s+interface', captureGroup: 1 },
      // Type aliases: slice type (e.g., type Names []string)
      { type: 'type', pattern: '^type\\s+(\\w+)\\s+\\[', captureGroup: 1 },
      // Type aliases: map type (e.g., type Cache map[string]int)
      { type: 'type', pattern: '^type\\s+(\\w+)\\s+map\\[', captureGroup: 1 },
      // Type aliases: pointer type (e.g., type Handler *http.Handler)
      { type: 'type', pattern: '^type\\s+(\\w+)\\s+\\*', captureGroup: 1 },
      // Type aliases: function type (e.g., type HandlerFunc func(...))
      { type: 'type', pattern: '^type\\s+(\\w+)\\s+func\\(', captureGroup: 1 },
      // Type aliases: channel type (e.g., type Signal chan struct{}, type Events <-chan Event)
      { type: 'type', pattern: '^type\\s+(\\w+)\\s+<?-?chan\\b', captureGroup: 1 },
      // Type aliases: built-in types (string, int, bool, byte, rune, error, etc.)
      { type: 'type', pattern: '^type\\s+(\\w+)\\s+(string|bool|byte|rune|error|any|comparable|u?int(8|16|32|64)?|float(32|64)|complex(64|128)|uintptr)\\b', captureGroup: 1 },
      // Type aliases: package types (e.g., type Handler http.Handler, type Time time.Time)
      { type: 'type', pattern: '^type\\s+(\\w+)\\s+[a-z]\\w*\\.', captureGroup: 1 },
      { type: 'constant', pattern: '^const\\s+(\\w+)\\s*=', captureGroup: 1 },
      // Constants inside const ( ... ) block with type: `Name Type = value`
      { type: 'constant', pattern: '^(?:\\t|    )(\\w+)\\s+\\w+\\s*(?<![!:<>=])=', captureGroup: 1 },
      // Constants inside const ( ... ) block without type: `Name = literal`
      { type: 'constant', pattern: '^(?:\\t|    )(\\w+)\\s*=\\s*(?:iota|-?\\d[\\d_.]*|"[^"]*"|`[^`]*`|\'[^\']*\'|true|false|nil)\\s*(?://.*)?$', captureGroup: 1 },
      // Constants inside const ( ... ) block: iota continuation (name only, e.g., `StatusOK`)
      { type: 'constant', pattern: '^(?:\\t|    )([A-Z]\\w*)\\s*$', captureGroup: 1 },
      { type: 'variable', pattern: '^var\\s+(\\w+)\\s+', captureGroup: 1 },
      // Variables inside var ( ... ) block with exported type
      { type: 'variable', pattern: '^(?:\\t|    )(?!(?:if|for|switch|select|case|default|return|break|continue|goto|fallthrough|defer|go|var|const|type|func)\\s)(\\w+)\\s+\\*?(?:\\[\\])?(?:map\\[.+\\])?(?:chan\\s+)?(?:\\w+\\.)?[A-Z]\\w*\\s*$', captureGroup: 1 },
      // Variables inside var ( ... ) block with basic type
      { type: 'variable', pattern: '^(?:\\t|    )(?!(?:if|for|switch|select|case|default|return|break|continue|goto|fallthrough|defer|go|var|const|type|func)\\s)(\\w+)\\s+(string|bool|byte|rune|error|any|int\\d*|uint\\d*|float\\d*|complex\\d*|uintptr)\\s*$', captureGroup: 1 },
    ]
  },
  ts: {
    name: 'TypeScript',
    rgType: 'ts',
    extensions: ['.ts'],
    patterns: [
      { type: 'function', pattern: '^(?:export\\s+)?(?:async\\s+)?function\\s+(\\w+)', captureGroup: 1 },
      { type: 'class', pattern: '^(?:export\\s+)?(?:abstract\\s+)?class\\s+(\\w+)', captureGroup: 1 },
      { type: 'interface', pattern: '^(?:export\\s+)?interface\\s+(\\w+)', captureGroup: 1 },
      { type: 'type', pattern: '^(?:export\\s+)?type\\s+(\\w+)\\s*[=<]', captureGroup: 1 },
      { type: 'enum', pattern: '^(?:export\\s+)?(?:const\\s+)?enum\\s+(\\w+)', captureGroup: 1 },
      { type: 'constant', pattern: '^(?:export\\s+)?const\\s+(\\w+)\\s*[=:]', captureGroup: 1 },
      { type: 'namespace', pattern: '^(?:export\\s+)?(?:declare\\s+)?namespace\\s+(\\w+)', captureGroup: 1 },
    ]
  },
  tsx: {
    name: 'TypeScript React',
    rgType: 'tsx',
    extensions: ['.tsx'],
    patterns: [
      { type: 'function', pattern: '^(?:export\\s+)?(?:async\\s+)?function\\s+(\\w+)', captureGroup: 1 },
      { type: 'class', pattern: '^(?:export\\s+)?(?:abstract\\s+)?class\\s+(\\w+)', captureGroup: 1 },
      { type: 'interface', pattern: '^(?:export\\s+)?interface\\s+(\\w+)', captureGroup: 1 },
      { type: 'type', pattern: '^(?:export\\s+)?type\\s+(\\w+)\\s*[=<]', captureGroup: 1 },
      { type: 'enum', pattern: '^(?:export\\s+)?(?:const\\s+)?enum\\s+(\\w+)', captureGroup: 1 },
      { type: 'constant', pattern: '^(?:export\\s+)?const\\s+(\\w+)\\s*[=:]', captureGroup: 1 },
    ]
  },
  js: {
    name: 'JavaScript',
    rgType: 'js',
    extensions: ['.js'],
    patterns: [
      { type: 'function', pattern: '^(?:export\\s+)?(?:async\\s+)?function\\s+(\\w+)', captureGroup: 1 },
      { type: 'class', pattern: '^(?:export\\s+)?class\\s+(\\w+)', captureGroup: 1 },
      { type: 'constant', pattern: '^(?:export\\s+)?const\\s+(\\w+)\\s*[=;]', captureGroup: 1 },
      { type: 'variable', pattern: '^(?:export\\s+)?let\\s+(\\w+)\\s*[=;,]', captureGroup: 1 },
      { type: 'variable', pattern: '^(?:export\\s+)?var\\s+(\\w+)\\s*[=;,]', captureGroup: 1 },
    ]
  },
  jsx: {
    name: 'JavaScript React',
    rgType: 'jsx',
    extensions: ['.jsx'],
    patterns: [
      { type: 'function', pattern: '^(?:export\\s+)?(?:async\\s+)?function\\s+(\\w+)', captureGroup: 1 },
      { type: 'class', pattern: '^(?:export\\s+)?class\\s+(\\w+)', captureGroup: 1 },
      { type: 'constant', pattern: '^(?:export\\s+)?const\\s+(\\w+)\\s*[=;]', captureGroup: 1 },
      { type: 'variable', pattern: '^(?:export\\s+)?let\\s+(\\w+)\\s*[=;,]', captureGroup: 1 },
      { type: 'variable', pattern: '^(?:export\\s+)?var\\s+(\\w+)\\s*[=;,]', captureGroup: 1 },
    ]
  },
  py: {
    name: 'Python',
    rgType: 'py',
    extensions: ['.py'],
    patterns: [
      { type: 'function', pattern: '^(?:async\\s+)?def\\s+(\\w+)\\s*\\(', captureGroup: 1 },
      { type: 'class', pattern: '^class\\s+(\\w+)', captureGroup: 1 },
      { type: 'constant', pattern: '^([A-Z][A-Z0-9_]+)\\s*=', captureGroup: 1 },
    ]
  },
  rs: {
    name: 'Rust',
    rgType: 'rust',
    extensions: ['.rs'],
    patterns: [
      { type: 'function', pattern: '^(?:pub(?:\\([^)]+\\))?\\s+)?(?:async\\s+)?(?:unsafe\\s+)?(?:extern\\s+"C"\\s+)?fn\\s+(\\w+)', captureGroup: 1 },
      { type: 'struct', pattern: '^(?:pub(?:\\([^)]+\\))?\\s+)?struct\\s+(\\w+)', captureGroup: 1 },
      { type: 'enum', pattern: '^(?:pub(?:\\([^)]+\\))?\\s+)?enum\\s+(\\w+)', captureGroup: 1 },
      { type: 'interface', pattern: '^(?:pub(?:\\([^)]+\\))?\\s+)?(?:unsafe\\s+)?trait\\s+(\\w+)', captureGroup: 1 },
      { type: 'type', pattern: '^(?:pub(?:\\([^)]+\\))?\\s+)?type\\s+(\\w+)', captureGroup: 1 },
      { type: 'constant', pattern: '^(?:pub(?:\\([^)]+\\))?\\s+)?const\\s+(\\w+)\\s*:', captureGroup: 1 },
      { type: 'variable', pattern: '^(?:pub(?:\\([^)]+\\))?\\s+)?static\\s+(?:mut\\s+)?(\\w+)\\s*:', captureGroup: 1 },
      { type: 'module', pattern: '^(?:pub(?:\\([^)]+\\))?\\s+)?mod\\s+(\\w+)', captureGroup: 1 },
    ]
  },
  java: {
    name: 'Java',
    rgType: 'java',
    extensions: ['.java'],
    patterns: [
      { type: 'class', pattern: '^(?:public\\s+|private\\s+|protected\\s+)?(?:abstract\\s+|final\\s+)?class\\s+(\\w+)', captureGroup: 1 },
      { type: 'interface', pattern: '^(?:public\\s+)?interface\\s+(\\w+)', captureGroup: 1 },
      { type: 'enum', pattern: '^(?:public\\s+)?enum\\s+(\\w+)', captureGroup: 1 },
      { type: 'method', pattern: '^\\s+(?:public\\s+|private\\s+|protected\\s+)?(?:static\\s+)?(?:final\\s+)?(?:synchronized\\s+)?(?:\\w+(?:<[^>]+>)?\\s+)(\\w+)\\s*\\(', captureGroup: 1 },
    ]
  },
  kt: {
    name: 'Kotlin',
    rgType: 'kotlin',
    extensions: ['.kt'],
    patterns: [
      { type: 'function', pattern: '^(?:suspend\\s+)?(?:inline\\s+)?(?:private\\s+|internal\\s+)?fun\\s+(?:<[^>]+>\\s+)?(\\w+)', captureGroup: 1 },
      { type: 'class', pattern: '^(?:data\\s+|sealed\\s+|open\\s+|abstract\\s+)?(?:private\\s+|internal\\s+)?class\\s+(\\w+)', captureGroup: 1 },
      { type: 'interface', pattern: '^(?:private\\s+|internal\\s+)?interface\\s+(\\w+)', captureGroup: 1 },
      { type: 'enum', pattern: '^(?:private\\s+|internal\\s+)?enum\\s+class\\s+(\\w+)', captureGroup: 1 },
      { type: 'type', pattern: '^(?:private\\s+|internal\\s+)?typealias\\s+(\\w+)', captureGroup: 1 },
      { type: 'constant', pattern: '^(?:private\\s+|internal\\s+)?(?:const\\s+)?val\\s+(\\w+)\\s*[=:]', captureGroup: 1 },
    ]
  },
  swift: {
    name: 'Swift',
    rgType: 'swift',
    extensions: ['.swift'],
    patterns: [
      { type: 'function', pattern: '^\\s*(?:public\\s+|private\\s+|internal\\s+|fileprivate\\s+|open\\s+)?(?:static\\s+)?(?:class\\s+)?func\\s+(\\w+)', captureGroup: 1 },
      { type: 'class', pattern: '^(?:public\\s+|private\\s+|internal\\s+|fileprivate\\s+|open\\s+)?(?:final\\s+)?class\\s+(\\w+)', captureGroup: 1 },
      { type: 'struct', pattern: '^(?:public\\s+|private\\s+|internal\\s+|fileprivate\\s+)?struct\\s+(\\w+)', captureGroup: 1 },
      { type: 'interface', pattern: '^(?:public\\s+|private\\s+|internal\\s+|fileprivate\\s+)?protocol\\s+(\\w+)', captureGroup: 1 },
      { type: 'enum', pattern: '^(?:public\\s+|private\\s+|internal\\s+|fileprivate\\s+)?enum\\s+(\\w+)', captureGroup: 1 },
      { type: 'type', pattern: '^(?:public\\s+|private\\s+|internal\\s+|fileprivate\\s+)?typealias\\s+(\\w+)', captureGroup: 1 },
    ]
  },
  rb: {
    name: 'Ruby',
    rgType: 'ruby',
    extensions: ['.rb'],
    patterns: [
      { type: 'function', pattern: '^\\s*def\\s+(?:self\\.)?(\\w+[!?]?)', captureGroup: 1 },
      { type: 'class', pattern: '^class\\s+(\\w+)', captureGroup: 1 },
      { type: 'module', pattern: '^module\\s+(\\w+)', captureGroup: 1 },
      { type: 'constant', pattern: '^\\s*([A-Z][A-Z0-9_]+)\\s*=', captureGroup: 1 },
    ]
  },
  cpp: {
    name: 'C++',
    rgType: 'cpp',
    extensions: ['.cpp', '.hpp', '.cc', '.cxx', '.hxx'],
    patterns: [
      { type: 'class', pattern: '^(?:template\\s*<[^>]*>\\s*)?class\\s+(\\w+)', captureGroup: 1 },
      { type: 'struct', pattern: '^(?:template\\s*<[^>]*>\\s*)?struct\\s+(\\w+)', captureGroup: 1 },
      { type: 'enum', pattern: '^enum\\s+(?:class\\s+)?(\\w+)', captureGroup: 1 },
      { type: 'namespace', pattern: '^namespace\\s+(\\w+)', captureGroup: 1 },
      { type: 'type', pattern: '^(?:using|typedef)\\s+(?:\\w+\\s+)*(\\w+)\\s*=', captureGroup: 1 },
    ]
  },
  c: {
    name: 'C',
    rgType: 'c',
    extensions: ['.c', '.h'],
    patterns: [
      { type: 'struct', pattern: '^(?:typedef\\s+)?struct\\s+(\\w+)', captureGroup: 1 },
      { type: 'enum', pattern: '^(?:typedef\\s+)?enum\\s+(\\w+)', captureGroup: 1 },
      { type: 'type', pattern: '^typedef\\s+\\w+\\s+(\\w+)\\s*;', captureGroup: 1 },
    ]
  },
  sh: {
    name: 'Shell',
    rgType: 'sh',
    extensions: ['.sh', '.bash'],
    patterns: [
      // function name() { or function name {
      { type: 'function', pattern: '^function\\s+(\\w+)\\s*(?:\\(\\)|\\{)', captureGroup: 1 },
      // name() { (POSIX style)
      { type: 'function', pattern: '^(\\w+)\\s*\\(\\)\\s*\\{', captureGroup: 1 },
      // Variable assignment (uppercase convention)
      { type: 'variable', pattern: '^([A-Z][A-Z0-9_]*)=', captureGroup: 1 },
    ]
  },
  make: {
    name: 'Makefile',
    rgType: 'make',
    extensions: ['.mk', 'Makefile', 'makefile'],
    patterns: [
      // Targets (target: or target::)
      { type: 'function', pattern: '^([a-zA-Z_][a-zA-Z0-9_-]*)\\s*::?', captureGroup: 1 },
      // Variable definitions (VAR = or VAR :=)
      { type: 'variable', pattern: '^([A-Z][A-Z0-9_]*)\\s*[:?]?=', captureGroup: 1 },
    ]
  },
  // Alias: @mk: for Makefile (same as @make:)
  mk: {
    name: 'Makefile',
    rgType: 'make',
    extensions: ['.mk', 'Makefile', 'makefile'],
    patterns: [
      { type: 'function', pattern: '^([a-zA-Z_][a-zA-Z0-9_-]*)\\s*::?', captureGroup: 1 },
      { type: 'variable', pattern: '^([A-Z][A-Z0-9_]*)\\s*[:?]?=', captureGroup: 1 },
    ]
  },
  php: {
    name: 'PHP',
    rgType: 'php',
    extensions: ['.php'],
    patterns: [
      { type: 'function', pattern: '^\\s*(?:public\\s+|private\\s+|protected\\s+)?(?:static\\s+)?function\\s+(\\w+)', captureGroup: 1 },
      { type: 'class', pattern: '^(?:abstract\\s+|final\\s+)?class\\s+(\\w+)', captureGroup: 1 },
      { type: 'interface', pattern: '^interface\\s+(\\w+)', captureGroup: 1 },
      { type: 'interface', pattern: '^trait\\s+(\\w+)', captureGroup: 1 },
      { type: 'constant', pattern: '^\\s*(?:public\\s+|private\\s+|protected\\s+)?const\\s+(\\w+)\\s*=', captureGroup: 1 },
      { type: 'enum', pattern: '^enum\\s+(\\w+)', captureGroup: 1 },
    ]
  },
  cs: {
    name: 'C#',
    rgType: 'csharp',
    extensions: ['.cs'],
    patterns: [
      { type: 'class', pattern: '^\\s*(?:public\\s+|private\\s+|protected\\s+|internal\\s+)?(?:static\\s+)?(?:sealed\\s+|abstract\\s+|partial\\s+)?class\\s+(\\w+)', captureGroup: 1 },
      { type: 'interface', pattern: '^\\s*(?:public\\s+|private\\s+|protected\\s+|internal\\s+)?interface\\s+(\\w+)', captureGroup: 1 },
      { type: 'struct', pattern: '^\\s*(?:public\\s+|private\\s+|protected\\s+|internal\\s+)?(?:readonly\\s+)?struct\\s+(\\w+)', captureGroup: 1 },
      { type: 'enum', pattern: '^\\s*(?:public\\s+|private\\s+|protected\\s+|internal\\s+)?enum\\s+(\\w+)', captureGroup: 1 },
      { type: 'method', pattern: '^\\s*(?:public\\s+|private\\s+|protected\\s+|internal\\s+)?(?:static\\s+)?(?:async\\s+)?(?:virtual\\s+|override\\s+|abstract\\s+)?(?:\\w+(?:<[^>]+>)?\\s+)(\\w+)\\s*\\(', captureGroup: 1 },
      { type: 'namespace', pattern: '^namespace\\s+([\\w.]+)', captureGroup: 1 },
    ]
  },
  scala: {
    name: 'Scala',
    rgType: 'scala',
    extensions: ['.scala'],
    patterns: [
      { type: 'function', pattern: '^\\s*(?:private\\s+|protected\\s+)?def\\s+(\\w+)', captureGroup: 1 },
      { type: 'class', pattern: '^(?:sealed\\s+|abstract\\s+|final\\s+)?(?:case\\s+)?class\\s+(\\w+)', captureGroup: 1 },
      { type: 'interface', pattern: '^(?:sealed\\s+)?trait\\s+(\\w+)', captureGroup: 1 },
      { type: 'module', pattern: '^(?:case\\s+)?object\\s+(\\w+)', captureGroup: 1 },
      { type: 'type', pattern: '^\\s*type\\s+(\\w+)', captureGroup: 1 },
      { type: 'constant', pattern: '^\\s*(?:private\\s+|protected\\s+)?val\\s+(\\w+)\\s*[=:]', captureGroup: 1 },
      { type: 'variable', pattern: '^\\s*(?:private\\s+|protected\\s+)?var\\s+(\\w+)\\s*[=:]', captureGroup: 1 },
    ]
  },
  tf: {
    name: 'Terraform',
    rgType: 'tf',
    extensions: ['.tf'],
    patterns: [
      // resource "aws_instance" "example" { → captures "example"
      { type: 'resource', pattern: '^resource\\s+"[^"]+"\\s+"([\\w-]+)"', captureGroup: 1 },
      // data "aws_ami" "example" { → captures "example"
      { type: 'data', pattern: '^data\\s+"[^"]+"\\s+"([\\w-]+)"', captureGroup: 1 },
      // variable "instance_type" { → captures "instance_type"
      { type: 'variable', pattern: '^variable\\s+"([\\w-]+)"', captureGroup: 1 },
      // output "instance_ip" { → captures "instance_ip"
      { type: 'output', pattern: '^output\\s+"([\\w-]+)"', captureGroup: 1 },
      // module "vpc" { → captures "vpc"
      { type: 'module', pattern: '^module\\s+"([\\w-]+)"', captureGroup: 1 },
      // provider "aws" { → captures "aws"
      { type: 'provider', pattern: '^provider\\s+"([\\w-]+)"', captureGroup: 1 },
      // locals { with named values inside: local_name = value
      { type: 'constant', pattern: '^\\s+([a-z][\\w-]*)\\s*=\\s*(?![=])', captureGroup: 1 },
    ]
  },
  // Alias: @terraform: for Terraform (same as @tf:)
  terraform: {
    name: 'Terraform',
    rgType: 'tf',
    extensions: ['.tf'],
    patterns: [
      { type: 'resource', pattern: '^resource\\s+"[^"]+"\\s+"([\\w-]+)"', captureGroup: 1 },
      { type: 'data', pattern: '^data\\s+"[^"]+"\\s+"([\\w-]+)"', captureGroup: 1 },
      { type: 'variable', pattern: '^variable\\s+"([\\w-]+)"', captureGroup: 1 },
      { type: 'output', pattern: '^output\\s+"([\\w-]+)"', captureGroup: 1 },
      { type: 'module', pattern: '^module\\s+"([\\w-]+)"', captureGroup: 1 },
      { type: 'provider', pattern: '^provider\\s+"([\\w-]+)"', captureGroup: 1 },
      { type: 'constant', pattern: '^\\s+([a-z][\\w-]*)\\s*=\\s*(?![=])', captureGroup: 1 },
    ]
  },
  md: {
    name: 'Markdown',
    rgType: 'markdown',
    extensions: ['.md'],
    patterns: [
      // ATX-style headings: # Heading, ## Heading, etc. (capture heading text)
      { type: 'heading', pattern: '^#{1,6}\\s+(.+?)(?:\\s+#+)?$', captureGroup: 1 },
    ]
  },
  // Alias: @markdown: for Markdown (same as @md:)
  markdown: {
    name: 'Markdown',
    rgType: 'markdown',
    extensions: ['.md'],
    patterns: [
      { type: 'heading', pattern: '^#{1,6}\\s+(.+?)(?:\\s+#+)?$', captureGroup: 1 },
    ]
  },
};

/**
 * Check if ripgrep (rg) is available
 */
export async function checkRgAvailable(): Promise<RgCheckResponse> {
  const rgPaths = [
    '/opt/homebrew/bin/rg',  // Apple Silicon Homebrew
    '/usr/local/bin/rg',     // Intel Homebrew
    '/usr/bin/rg',           // System
    'rg'                     // PATH
  ];

  for (const rgPath of rgPaths) {
    try {
      await new Promise<void>((resolve, reject) => {
        execFile(rgPath, ['--version'], { timeout: 2000 }, (error) => {
          if (error) reject(error);
          else resolve();
        });
      });

      return { rgAvailable: true, rgPath };
    } catch {
      continue;
    }
  }

  return { rgAvailable: false, rgPath: null };
}

/**
 * Get list of supported programming languages
 */
export async function getSupportedLanguages(): Promise<LanguagesResponse> {
  const languages = Object.entries(LANGUAGE_CONFIGS).map(([key, config]) => {
    const extension = config.extensions[0];
    if (!extension) {
      throw new Error(`No extensions configured for language: ${key}`);
    }
    return {
      key,
      displayName: config.name,
      extension
    };
  });

  return { languages };
}

/**
 * Parse ripgrep output and extract symbols
 */
function parseRipgrepOutput(
  output: string,
  language: string,
  maxSymbols: number,
  directory: string
): SymbolResult[] {
  const symbols: SymbolResult[] = [];
  const config = LANGUAGE_CONFIGS[language];

  if (!config) {
    return symbols;
  }

  // Pre-compile regexes for performance
  const compiledPatterns = config.patterns.map(p => ({
    type: p.type,
    regex: new RegExp(p.pattern),
    captureGroup: p.captureGroup
  }));

  const lines = output.split('\n');

  for (const line of lines) {
    if (symbols.length >= maxSymbols) {
      break;
    }

    if (!line.trim()) {
      continue;
    }

    // Expected format: path:lineNumber:lineContent
    const parts = line.split(':');
    if (parts.length < 3) {
      continue;
    }

    const filePath = parts[0];
    const lineNumberStr = parts[1];
    const lineContent = parts.slice(2).join(':').trim();

    // Skip if required fields are invalid
    if (!filePath || !lineNumberStr || !lineContent) {
      continue;
    }

    const lineNumber = parseInt(lineNumberStr, 10);

    // Try to match against language patterns
    for (const { type, regex, captureGroup } of compiledPatterns) {
      const match = lineContent.match(regex);

      if (match) {
        // Extract symbol name from the specified capture group
        const name = match[captureGroup];

        // Skip if name is undefined or empty
        if (!name) {
          continue;
        }

        // Calculate relative path
        const relativePath = filePath.startsWith(directory)
          ? filePath.substring(directory.length + 1)
          : filePath;

        symbols.push({
          name,
          type: type as SymbolType,
          filePath,
          relativePath,
          lineNumber,
          lineContent,
          language
        });
        break;
      }
    }
  }

  return symbols;
}

/**
 * Search for symbols in a directory for a specific language
 */
export async function searchSymbols(
  directory: string,
  language: string,
  options: SymbolSearchOptions = {}
): Promise<SymbolSearchResponse> {
  try {
    // Validate inputs
    if (!directory || typeof directory !== 'string') {
      return {
        success: false,
        symbols: [],
        symbolCount: 0,
        directory,
        language,
        searchMode: 'full',
        partial: false,
        maxSymbols: options.maxSymbols || DEFAULT_MAX_SYMBOLS,
        error: 'Invalid directory'
      };
    }

    if (!language || typeof language !== 'string') {
      return {
        success: false,
        symbols: [],
        symbolCount: 0,
        directory,
        language,
        searchMode: 'full',
        partial: false,
        maxSymbols: options.maxSymbols || DEFAULT_MAX_SYMBOLS,
        error: 'Invalid language'
      };
    }

    const config = LANGUAGE_CONFIGS[language];
    if (!config) {
      return {
        success: false,
        symbols: [],
        symbolCount: 0,
        directory,
        language,
        searchMode: 'full',
        partial: false,
        maxSymbols: options.maxSymbols || DEFAULT_MAX_SYMBOLS,
        error: `Unsupported language: ${language}`
      };
    }

    // Check if rg is available
    const { rgAvailable, rgPath } = await checkRgAvailable();
    if (!rgAvailable || !rgPath) {
      return {
        success: false,
        symbols: [],
        symbolCount: 0,
        directory,
        language,
        searchMode: 'full',
        partial: false,
        maxSymbols: options.maxSymbols || DEFAULT_MAX_SYMBOLS,
        error: 'ripgrep (rg) command not found. Install with: brew install ripgrep'
      };
    }

    // At this point, rgPath is guaranteed to be non-null
    const rgCommand: string = rgPath;

    // Build rg arguments
    const maxSymbols = options.maxSymbols || DEFAULT_MAX_SYMBOLS;
    const hasIncludePatterns = options.includePatterns && options.includePatterns.length > 0;
    const args = [
      '--line-number',
      '--no-heading',
      '--color', 'never'
    ];

    // Use --type for file type filtering (same as Swift version)
    // When include patterns are specified, also search hidden files and ignore rules
    if (hasIncludePatterns) {
      args.push('--hidden');
      args.push('--no-ignore');
    }

    args.push('--type', config.rgType);

    // Add exclude patterns using --glob with negation
    if (options.excludePatterns && options.excludePatterns.length > 0) {
      for (const pattern of options.excludePatterns) {
        args.push('--glob', `!${pattern}`);
      }
    }

    // Add include patterns using --glob
    if (hasIncludePatterns) {
      for (const pattern of options.includePatterns!) {
        args.push('--glob', pattern);
      }
    }

    // Combine all pattern regexes
    const combinedPattern = config.patterns.map(p => `(${p.pattern})`).join('|');
    args.push('-e', combinedPattern);
    args.push(directory);

    // Execute ripgrep
    const rgOutput = await new Promise<string>((resolve, reject) => {
      const execOptions = {
        timeout: options.timeout || DEFAULT_SEARCH_TIMEOUT,
        maxBuffer: DEFAULT_MAX_BUFFER,
        killSignal: 'SIGTERM' as const
      };

      execFile(rgCommand, args, execOptions, (error, stdout, stderr) => {
        // rg exits with code 1 when no matches found, which is not an error
        if (error && error.code !== 1) {
          if (error.killed) {
            reject(new Error('ripgrep command timed out'));
          } else {
            reject(error);
          }
          return;
        }

        if (stderr) {
          logger.debug('rg stderr', { stderr });
        }

        resolve(stdout);
      });
    });

    // Parse output
    const symbols = parseRipgrepOutput(rgOutput, language, maxSymbols, directory);

    return {
      success: true,
      symbols,
      symbolCount: symbols.length,
      directory,
      language,
      searchMode: 'full',
      partial: symbols.length >= maxSymbols,
      maxSymbols
    };

  } catch (error) {
    logger.error('Error searching symbols:', error);
    return {
      success: false,
      symbols: [],
      symbolCount: 0,
      directory,
      language,
      searchMode: 'full',
      partial: false,
      maxSymbols: options.maxSymbols || DEFAULT_MAX_SYMBOLS,
      error: error instanceof Error ? error.message : 'Symbol search failed'
    };
  }
}
