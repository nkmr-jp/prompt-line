/**
 * Symbol Searcher - Native tool executor for ripgrep-based symbol search
 * Interfaces with the symbol-searcher native binary
 */

import { execFile } from 'child_process';
import { SYMBOL_SEARCHER_PATH, logger } from '../../utils/utils';
import type {
  SymbolSearchResponse,
  RgCheckResponse,
  LanguagesResponse,
  SymbolSearchOptions
} from './types';
import { TIMEOUTS, LIMITS } from '../../constants';

// Default search options (exported for use by handlers)
export const DEFAULT_MAX_SYMBOLS = 200000;
export const DEFAULT_SEARCH_TIMEOUT = TIMEOUTS.SYMBOL_SEARCH;
export const DEFAULT_MAX_BUFFER = 100 * 1024 * 1024; // 100MB buffer for large codebases

/**
 * Check if ripgrep (rg) is available
 */
export async function checkRgAvailable(): Promise<RgCheckResponse> {
  return new Promise((resolve) => {
    if (process.platform !== 'darwin') {
      resolve({ rgAvailable: false, rgPath: null });
      return;
    }

    const options = {
      timeout: DEFAULT_SEARCH_TIMEOUT,
      killSignal: 'SIGTERM' as const,
      maxBuffer: DEFAULT_MAX_BUFFER
    };

    execFile(SYMBOL_SEARCHER_PATH, ['check-rg'], options, (error, stdout) => {
      if (error) {
        logger.warn('Error checking rg availability:', error.message);
        resolve({ rgAvailable: false, rgPath: null });
        return;
      }

      try {
        const result = JSON.parse(stdout.trim()) as RgCheckResponse;
        resolve(result);
      } catch (parseError) {
        logger.warn('Error parsing rg check result:', parseError);
        resolve({ rgAvailable: false, rgPath: null });
      }
    });
  });
}

/**
 * Get list of supported programming languages
 */
export async function getSupportedLanguages(): Promise<LanguagesResponse> {
  return new Promise((resolve) => {
    if (process.platform !== 'darwin') {
      resolve({ languages: [] });
      return;
    }

    const options = {
      timeout: DEFAULT_SEARCH_TIMEOUT,
      killSignal: 'SIGTERM' as const,
      maxBuffer: DEFAULT_MAX_BUFFER
    };

    execFile(SYMBOL_SEARCHER_PATH, ['list-languages'], options, (error, stdout) => {
      if (error) {
        logger.warn('Error getting supported languages:', error.message);
        resolve({ languages: [] });
        return;
      }

      try {
        const result = JSON.parse(stdout.trim()) as LanguagesResponse;
        resolve(result);
      } catch (parseError) {
        logger.warn('Error parsing languages result:', parseError);
        resolve({ languages: [] });
      }
    });
  });
}

/**
 * Search for symbols in a directory for a specific language
 * @param directory - The directory to search in
 * @param language - The language key (e.g., 'ts', 'go', 'py')
 * @param options - Optional search options
 */
export async function searchSymbols(
  directory: string,
  language: string,
  options: SymbolSearchOptions = {}
): Promise<SymbolSearchResponse> {
  return new Promise((resolve) => {
    if (process.platform !== 'darwin') {
      resolve({
        success: false,
        symbols: [],
        symbolCount: 0,
        searchMode: 'full',
        partial: false,
        maxSymbols: options.maxSymbols || DEFAULT_MAX_SYMBOLS,
        error: 'Symbol search only supported on macOS'
      });
      return;
    }

    // Validate inputs
    if (!directory || typeof directory !== 'string') {
      resolve({
        success: false,
        symbols: [],
        symbolCount: 0,
        searchMode: 'full',
        partial: false,
        maxSymbols: options.maxSymbols || DEFAULT_MAX_SYMBOLS,
        error: 'Invalid directory'
      });
      return;
    }

    if (!language || typeof language !== 'string') {
      resolve({
        success: false,
        symbols: [],
        symbolCount: 0,
        searchMode: 'full',
        partial: false,
        maxSymbols: options.maxSymbols || DEFAULT_MAX_SYMBOLS,
        error: 'Invalid language'
      });
      return;
    }

    const maxSymbols = options.maxSymbols || DEFAULT_MAX_SYMBOLS;
    const timeout = options.timeout || DEFAULT_SEARCH_TIMEOUT;
    const args = [
      'search',
      directory,
      '--language', language,
      '--max-symbols', String(maxSymbols)
    ];

    // Add exclude patterns
    if (options.excludePatterns && options.excludePatterns.length > 0) {
      for (const pattern of options.excludePatterns) {
        args.push('--exclude', pattern);
      }
    }

    // Add include patterns
    if (options.includePatterns && options.includePatterns.length > 0) {
      for (const pattern of options.includePatterns) {
        args.push('--include', pattern);
      }
    }

    const execOptions = {
      timeout,
      killSignal: 'SIGTERM' as const,
      maxBuffer: DEFAULT_MAX_BUFFER
    };

    execFile(SYMBOL_SEARCHER_PATH, args, execOptions, (error, stdout, stderr) => {
      if (error) {
        logger.warn('Error searching symbols:', {
          message: error.message,
          code: (error as any).code,
          signal: (error as any).signal,
          killed: (error as any).killed,
          stderr: stderr?.toString()?.substring(0, LIMITS.MAX_ERROR_LOG_LENGTH)
        });
        resolve({
          success: false,
          symbols: [],
          symbolCount: 0,
          searchMode: 'full',
          partial: false,
          maxSymbols,
          error: error.message
        });
        return;
      }

      try {
        const result = JSON.parse(stdout.trim()) as SymbolSearchResponse;
        resolve(result);
      } catch (parseError) {
        logger.warn('Error parsing symbol search result:', parseError);
        resolve({
          success: false,
          symbols: [],
          symbolCount: 0,
          searchMode: 'full',
          partial: false,
          maxSymbols,
          error: 'Failed to parse symbol search result'
        });
      }
    });
  });
}
