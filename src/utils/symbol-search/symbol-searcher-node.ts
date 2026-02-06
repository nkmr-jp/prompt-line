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
      { type: 'constant', pattern: '^(?:\\t|    )(\\w+)\\s+\\w+\\s*=', captureGroup: 1 },
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
      { type: 'type', pattern: '^(?:export\\s+)?type\\s+(\\w+)\\s*=', captureGroup: 1 },
      { type: 'enum', pattern: '^(?:export\\s+)?enum\\s+(\\w+)', captureGroup: 1 },
      { type: 'constant', pattern: '^(?:export\\s+)?const\\s+(\\w+)\\s*[=:]', captureGroup: 1 },
      { type: 'namespace', pattern: '^(?:export\\s+)?namespace\\s+(\\w+)', captureGroup: 1 },
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
      { type: 'type', pattern: '^(?:export\\s+)?type\\s+(\\w+)\\s*=', captureGroup: 1 },
      { type: 'enum', pattern: '^(?:export\\s+)?enum\\s+(\\w+)', captureGroup: 1 },
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
      { type: 'constant', pattern: '^(?:export\\s+)?const\\s+(\\w+)\\s*=', captureGroup: 1 },
      { type: 'variable', pattern: '^(?:export\\s+)?(?:var|let)\\s+(\\w+)', captureGroup: 1 },
    ]
  },
  jsx: {
    name: 'JavaScript React',
    rgType: 'jsx',
    extensions: ['.jsx'],
    patterns: [
      { type: 'function', pattern: '^(?:export\\s+)?(?:async\\s+)?function\\s+(\\w+)', captureGroup: 1 },
      { type: 'class', pattern: '^(?:export\\s+)?class\\s+(\\w+)', captureGroup: 1 },
      { type: 'constant', pattern: '^(?:export\\s+)?const\\s+(\\w+)\\s*=', captureGroup: 1 },
    ]
  },
  py: {
    name: 'Python',
    rgType: 'py',
    extensions: ['.py'],
    patterns: [
      { type: 'function', pattern: '^(?:async\\s+)?def\\s+(\\w+)', captureGroup: 1 },
      { type: 'class', pattern: '^class\\s+(\\w+)', captureGroup: 1 },
      { type: 'constant', pattern: '^([A-Z_][A-Z0-9_]*)\\s*=', captureGroup: 1 },
    ]
  },
  rs: {
    name: 'Rust',
    rgType: 'rust',
    extensions: ['.rs'],
    patterns: [
      { type: 'function', pattern: '^(?:pub\\s+)?(?:async\\s+)?(?:unsafe\\s+)?fn\\s+(\\w+)', captureGroup: 1 },
      { type: 'struct', pattern: '^(?:pub\\s+)?struct\\s+(\\w+)', captureGroup: 1 },
      { type: 'enum', pattern: '^(?:pub\\s+)?enum\\s+(\\w+)', captureGroup: 1 },
      { type: 'type', pattern: '^(?:pub\\s+)?type\\s+(\\w+)', captureGroup: 1 },
      { type: 'constant', pattern: '^(?:pub\\s+)?const\\s+(\\w+)', captureGroup: 1 },
      { type: 'variable', pattern: '^(?:pub\\s+)?static\\s+(\\w+)', captureGroup: 1 },
      { type: 'module', pattern: '^(?:pub\\s+)?mod\\s+(\\w+)', captureGroup: 1 },
      { type: 'property', pattern: '^\\s+pub\\s+(\\w+):', captureGroup: 1 },
    ]
  },
  java: {
    name: 'Java',
    rgType: 'java',
    extensions: ['.java'],
    patterns: [
      { type: 'class', pattern: '^(?:public\\s+)?(?:abstract\\s+)?(?:final\\s+)?class\\s+(\\w+)', captureGroup: 1 },
      { type: 'interface', pattern: '^(?:public\\s+)?interface\\s+(\\w+)', captureGroup: 1 },
      { type: 'enum', pattern: '^(?:public\\s+)?enum\\s+(\\w+)', captureGroup: 1 },
      { type: 'method', pattern: '^\\s+(?:public|private|protected)?\\s+(?:static\\s+)?\\w[\\w<>\\[\\]]*\\s+(\\w+)\\s*\\(', captureGroup: 1 },
    ]
  },
  kt: {
    name: 'Kotlin',
    rgType: 'kotlin',
    extensions: ['.kt'],
    patterns: [
      { type: 'function', pattern: '^(?:fun\\s+)(\\w+)', captureGroup: 1 },
      { type: 'class', pattern: '^(?:class\\s+)(\\w+)', captureGroup: 1 },
      { type: 'interface', pattern: '^(?:interface\\s+)(\\w+)', captureGroup: 1 },
      { type: 'enum', pattern: '^(?:enum\\s+class\\s+)(\\w+)', captureGroup: 1 },
      { type: 'type', pattern: '^(?:typealias\\s+)(\\w+)', captureGroup: 1 },
      { type: 'constant', pattern: '^(?:const\\s+val\\s+)(\\w+)', captureGroup: 1 },
    ]
  },
  swift: {
    name: 'Swift',
    rgType: 'swift',
    extensions: ['.swift'],
    patterns: [
      { type: 'function', pattern: '^(?:func\\s+)(\\w+)', captureGroup: 1 },
      { type: 'class', pattern: '^(?:class\\s+)(\\w+)', captureGroup: 1 },
      { type: 'struct', pattern: '^(?:struct\\s+)(\\w+)', captureGroup: 1 },
      { type: 'enum', pattern: '^(?:enum\\s+)(\\w+)', captureGroup: 1 },
      { type: 'property', pattern: '^\\s+(?:var|let)\\s+(\\w+):', captureGroup: 1 },
      { type: 'type', pattern: '^(?:typealias\\s+)(\\w+)', captureGroup: 1 },
    ]
  },
  rb: {
    name: 'Ruby',
    rgType: 'ruby',
    extensions: ['.rb'],
    patterns: [
      { type: 'function', pattern: '^(?:def\\s+)(\\w+)', captureGroup: 1 },
      { type: 'class', pattern: '^(?:class\\s+)(\\w+)', captureGroup: 1 },
      { type: 'module', pattern: '^(?:module\\s+)(\\w+)', captureGroup: 1 },
      { type: 'constant', pattern: '^([A-Z]\\w*)\\s*=', captureGroup: 1 },
    ]
  },
  cpp: {
    name: 'C++',
    rgType: 'cpp',
    extensions: ['.cpp', '.h', '.hpp'],
    patterns: [
      { type: 'class', pattern: '^(?:class|struct)\\s+(\\w+)', captureGroup: 1 },
      { type: 'namespace', pattern: '^namespace\\s+(\\w+)', captureGroup: 1 },
      { type: 'enum', pattern: '^enum\\s+(?:class\\s+)?(\\w+)', captureGroup: 1 },
      { type: 'type', pattern: '^typedef\\s+.+\\s+(\\w+);', captureGroup: 1 },
      { type: 'variable', pattern: '^extern\\s+.+\\s+(\\w+);', captureGroup: 1 },
    ]
  },
  c: {
    name: 'C',
    rgType: 'c',
    extensions: ['.c', '.h'],
    patterns: [
      { type: 'struct', pattern: '^(?:typedef\\s+)?struct\\s+(\\w+)', captureGroup: 1 },
      { type: 'enum', pattern: '^(?:typedef\\s+)?enum\\s+(\\w+)', captureGroup: 1 },
      { type: 'type', pattern: '^typedef\\s+.+\\s+(\\w+);', captureGroup: 1 },
    ]
  },
  sh: {
    name: 'Shell',
    rgType: 'sh',
    extensions: ['.sh'],
    patterns: [
      { type: 'function', pattern: '^(\\w+)\\s*\\(\\)', captureGroup: 1 },
      { type: 'variable', pattern: '^([A-Z_]\\w*)=', captureGroup: 1 },
      { type: 'variable', pattern: '^export\\s+([A-Z_]\\w*)', captureGroup: 1 },
    ]
  },
  make: {
    name: 'Makefile',
    rgType: 'make',
    extensions: ['.mk', 'Makefile'],
    patterns: [
      { type: 'function', pattern: '^(\\w+):', captureGroup: 1 },
      { type: 'variable', pattern: '^([A-Z_]\\w*)\\s*=', captureGroup: 1 },
    ]
  },
  php: {
    name: 'PHP',
    rgType: 'php',
    extensions: ['.php'],
    patterns: [
      { type: 'function', pattern: '^(?:function\\s+)(\\w+)', captureGroup: 1 },
      { type: 'class', pattern: '^(?:class\\s+)(\\w+)', captureGroup: 1 },
      { type: 'interface', pattern: '^(?:interface\\s+)(\\w+)', captureGroup: 1 },
      { type: 'type', pattern: '^(?:trait\\s+)(\\w+)', captureGroup: 1 },
      { type: 'constant', pattern: '^(?:const\\s+)(\\w+)', captureGroup: 1 },
      { type: 'enum', pattern: '^(?:enum\\s+)(\\w+)', captureGroup: 1 },
    ]
  },
  cs: {
    name: 'C#',
    rgType: 'csharp',
    extensions: ['.cs'],
    patterns: [
      { type: 'class', pattern: '^(?:public\\s+)?(?:abstract\\s+)?class\\s+(\\w+)', captureGroup: 1 },
      { type: 'interface', pattern: '^(?:public\\s+)?interface\\s+(\\w+)', captureGroup: 1 },
      { type: 'struct', pattern: '^(?:public\\s+)?struct\\s+(\\w+)', captureGroup: 1 },
      { type: 'enum', pattern: '^(?:public\\s+)?enum\\s+(\\w+)', captureGroup: 1 },
      { type: 'namespace', pattern: '^namespace\\s+(\\w+)', captureGroup: 1 },
      { type: 'method', pattern: '^\\s+(?:public|private|protected)?\\s+\\w[\\w<>\\[\\]]*\\s+(\\w+)\\s*\\(', captureGroup: 1 },
    ]
  },
  scala: {
    name: 'Scala',
    rgType: 'scala',
    extensions: ['.scala'],
    patterns: [
      { type: 'function', pattern: '^(?:def\\s+)(\\w+)', captureGroup: 1 },
      { type: 'class', pattern: '^(?:class\\s+)(\\w+)', captureGroup: 1 },
      { type: 'type', pattern: '^(?:case\\s+class\\s+)(\\w+)', captureGroup: 1 },
      { type: 'type', pattern: '^(?:trait\\s+)(\\w+)', captureGroup: 1 },
      { type: 'module', pattern: '^(?:object\\s+)(\\w+)', captureGroup: 1 },
      { type: 'type', pattern: '^(?:type\\s+)(\\w+)', captureGroup: 1 },
      { type: 'constant', pattern: '^(?:val\\s+)(\\w+)', captureGroup: 1 },
    ]
  },
  tf: {
    name: 'Terraform',
    rgType: 'hcl',
    extensions: ['.tf'],
    patterns: [
      { type: 'resource', pattern: '^resource\\s+"([^"]+)"\\s+"([^"]+)"', captureGroup: 2 },
      { type: 'data', pattern: '^data\\s+"([^"]+)"\\s+"([^"]+)"', captureGroup: 2 },
      { type: 'variable', pattern: '^variable\\s+"(\\w+)"', captureGroup: 1 },
      { type: 'output', pattern: '^output\\s+"(\\w+)"', captureGroup: 1 },
      { type: 'module', pattern: '^module\\s+"(\\w+)"', captureGroup: 1 },
      { type: 'provider', pattern: '^provider\\s+"(\\w+)"', captureGroup: 1 },
      { type: 'constant', pattern: '^locals\\s+{', captureGroup: 1 },
    ]
  },
  md: {
    name: 'Markdown',
    rgType: 'markdown',
    extensions: ['.md'],
    patterns: [
      { type: 'heading', pattern: '^#{1,6}\\s+(.+?)\\s*$', captureGroup: 1 },
    ]
  }
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
 * Execute a single ripgrep search and return raw output
 */
function executeRg(
  rgCommand: string,
  args: string[],
  timeout: number
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const execOptions = {
      timeout,
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
}

/**
 * Build rg arguments for a search phase
 * Matches Swift's buildRgArgs behavior
 */
function buildRgArgs(
  directory: string,
  combinedPattern: string,
  rgType: string,
  excludePatterns: string[],
  includePatterns: string[]
): string[] {
  const args = [
    '--line-number',
    '--no-heading',
    '--color', 'never'
  ];

  // When includePatterns are specified, search hidden files and ignore .gitignore rules
  // This matches Swift's behavior: only the include search phase uses --hidden/--no-ignore
  if (includePatterns.length > 0) {
    args.push('--hidden');
    args.push('--no-ignore');
  }

  args.push('--type', rgType);

  // Add exclude patterns using --glob with negation
  for (const pattern of excludePatterns) {
    args.push('--glob', `!${pattern}`);
  }

  // Add include patterns using --glob
  for (const pattern of includePatterns) {
    args.push('--glob', pattern);
  }

  args.push('-e', combinedPattern);
  args.push(directory);

  return args;
}

/**
 * Deduplicate and sort symbol results
 * Matches Swift's deduplicateAndSort: dedup by filePath:lineNumber:name, sort by filePath then lineNumber
 */
function deduplicateAndSort(results: SymbolResult[], maxSymbols: number): SymbolResult[] {
  const seen = new Set<string>();
  const unique: SymbolResult[] = [];

  for (const result of results) {
    const key = `${result.filePath}:${result.lineNumber}:${result.name}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(result);
    }
  }

  // Sort by file path, then line number
  unique.sort((a, b) => {
    if (a.filePath !== b.filePath) {
      return a.filePath < b.filePath ? -1 : 1;
    }
    return a.lineNumber - b.lineNumber;
  });

  // Apply max symbols limit
  if (unique.length > maxSymbols) {
    return unique.slice(0, maxSymbols);
  }
  return unique;
}

/**
 * Search for symbols in a directory for a specific language
 *
 * Uses two-phase search matching Swift implementation:
 * Phase 1: Normal search respecting .gitignore with excludePatterns
 * Phase 2: Include patterns search with --hidden --no-ignore (only when includePatterns specified)
 * Results are deduplicated and sorted by filePath then lineNumber
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

    const rgCommand: string = rgPath;
    const maxSymbols = options.maxSymbols || DEFAULT_MAX_SYMBOLS;
    const timeout = options.timeout || DEFAULT_SEARCH_TIMEOUT;
    const hasIncludePatterns = options.includePatterns && options.includePatterns.length > 0;

    // Combine all pattern regexes into one (used for both phases)
    const combinedPattern = config.patterns.map(p => `(${p.pattern})`).join('|');

    // Phase 1: Normal search (respects .gitignore, uses excludePatterns)
    const normalArgs = buildRgArgs(
      directory,
      combinedPattern,
      config.rgType,
      options.excludePatterns || [],
      [] // No includePatterns for normal search
    );

    const normalOutput = await executeRg(rgCommand, normalArgs, timeout);
    let allSymbols = parseRipgrepOutput(normalOutput, language, maxSymbols, directory);

    // Phase 2: Include patterns search (with --hidden --no-ignore, only when includePatterns specified)
    // This matches Swift behavior: separate rg execution for include patterns
    if (hasIncludePatterns) {
      const includeArgs = buildRgArgs(
        directory,
        combinedPattern,
        config.rgType,
        [], // No excludePatterns for include search
        options.includePatterns!
      );

      const includeOutput = await executeRg(rgCommand, includeArgs, timeout);
      const includeSymbols = parseRipgrepOutput(includeOutput, language, maxSymbols, directory);
      allSymbols = allSymbols.concat(includeSymbols);
    }

    // Deduplicate and sort (matching Swift's deduplicateAndSort)
    const symbols = deduplicateAndSort(allSymbols, maxSymbols);

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
