/**
 * Symbol Searcher - Cross-platform symbol search using ripgrep
 * Replaces native Swift symbol-searcher binary
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
 * Language configurations with file extensions and symbol patterns
 */
const LANGUAGE_CONFIGS = {
  go: {
    name: 'Go',
    extensions: ['.go'],
    patterns: [
      { type: 'function', pattern: '^func\\s+(\\w+)' },
      { type: 'method', pattern: '^func\\s+\\([^)]+\\)\\s+(\\w+)' },
      { type: 'struct', pattern: '^type\\s+(\\w+)\\s+struct' },
      { type: 'interface', pattern: '^type\\s+(\\w+)\\s+interface' }
    ]
  },
  ts: {
    name: 'TypeScript',
    extensions: ['.ts'],
    patterns: [
      { type: 'function', pattern: '^(export\\s+)?(async\\s+)?function\\s+(\\w+)' },
      { type: 'class', pattern: '^(export\\s+)?(abstract\\s+)?class\\s+(\\w+)' },
      { type: 'interface', pattern: '^(export\\s+)?interface\\s+(\\w+)' },
      { type: 'type', pattern: '^(export\\s+)?type\\s+(\\w+)' }
    ]
  },
  tsx: {
    name: 'TypeScript React',
    extensions: ['.tsx'],
    patterns: [
      { type: 'function', pattern: '^(export\\s+)?(async\\s+)?function\\s+(\\w+)' },
      { type: 'class', pattern: '^(export\\s+)?(abstract\\s+)?class\\s+(\\w+)' },
      { type: 'interface', pattern: '^(export\\s+)?interface\\s+(\\w+)' }
    ]
  },
  js: {
    name: 'JavaScript',
    extensions: ['.js'],
    patterns: [
      { type: 'function', pattern: '^(export\\s+)?(async\\s+)?function\\s+(\\w+)' },
      { type: 'class', pattern: '^(export\\s+)?class\\s+(\\w+)' }
    ]
  },
  jsx: {
    name: 'JavaScript React',
    extensions: ['.jsx'],
    patterns: [
      { type: 'function', pattern: '^(export\\s+)?(async\\s+)?function\\s+(\\w+)' },
      { type: 'class', pattern: '^(export\\s+)?class\\s+(\\w+)' }
    ]
  },
  py: {
    name: 'Python',
    extensions: ['.py'],
    patterns: [
      { type: 'function', pattern: '^(async\\s+)?def\\s+(\\w+)' },
      { type: 'class', pattern: '^class\\s+(\\w+)' }
    ]
  },
  rs: {
    name: 'Rust',
    extensions: ['.rs'],
    patterns: [
      { type: 'function', pattern: '^(pub\\s+)?(async\\s+)?fn\\s+(\\w+)' },
      { type: 'struct', pattern: '^(pub\\s+)?struct\\s+(\\w+)' },
      { type: 'enum', pattern: '^(pub\\s+)?enum\\s+(\\w+)' },
      { type: 'trait', pattern: '^(pub\\s+)?trait\\s+(\\w+)' }
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
  const config = LANGUAGE_CONFIGS[language as keyof typeof LANGUAGE_CONFIGS];

  if (!config) {
    return symbols;
  }

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
    for (const { type, pattern } of config.patterns) {
      const regex = new RegExp(pattern);
      const match = lineContent.match(regex);

      if (match) {
        // Extract symbol name from the last capturing group
        const name = match[match.length - 1];

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

    const config = LANGUAGE_CONFIGS[language as keyof typeof LANGUAGE_CONFIGS];
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
    const args = [
      '--line-number',
      '--no-heading',
      '--color', 'never'
    ];

    // Add file type filters
    for (const ext of config.extensions) {
      args.push('--glob', `*${ext}`);
    }

    // Add exclude patterns
    if (options.excludePatterns && options.excludePatterns.length > 0) {
      for (const pattern of options.excludePatterns) {
        args.push('--glob', `!${pattern}`);
      }
    }

    // Combine all pattern regexes
    const combinedPattern = config.patterns.map(p => `(${p.pattern})`).join('|');
    args.push(combinedPattern);
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
