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

// Default search options
const DEFAULT_MAX_SYMBOLS = 2000;
const QUICK_MAX_SYMBOLS = 500;
const SEARCH_TIMEOUT = 5000; // 5 seconds for symbol search

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
      timeout: SEARCH_TIMEOUT,
      killSignal: 'SIGTERM' as const
    };

    execFile(SYMBOL_SEARCHER_PATH, ['check-rg'], options, (error, stdout) => {
      if (error) {
        logger.warn('Error checking rg availability:', error.message);
        resolve({ rgAvailable: false, rgPath: null });
        return;
      }

      try {
        const result = JSON.parse(stdout.trim()) as RgCheckResponse;
        logger.debug('rg availability check:', result);
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
      timeout: SEARCH_TIMEOUT,
      killSignal: 'SIGTERM' as const
    };

    execFile(SYMBOL_SEARCHER_PATH, ['list-languages'], options, (error, stdout) => {
      if (error) {
        logger.warn('Error getting supported languages:', error.message);
        resolve({ languages: [] });
        return;
      }

      try {
        const result = JSON.parse(stdout.trim()) as LanguagesResponse;
        logger.debug('Supported languages:', result);
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
    const args = [
      'search',
      directory,
      '--language', language,
      '--max-symbols', String(maxSymbols)
    ];

    const execOptions = {
      timeout: SEARCH_TIMEOUT,
      killSignal: 'SIGTERM' as const
    };

    logger.debug('Searching symbols:', { directory, language, maxSymbols });

    execFile(SYMBOL_SEARCHER_PATH, args, execOptions, (error, stdout) => {
      if (error) {
        logger.warn('Error searching symbols:', error.message);
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
        if (result.success) {
          logger.debug('Symbol search completed:', {
            directory: result.directory,
            language: result.language,
            symbolCount: result.symbolCount
          });
        } else {
          logger.debug('Symbol search returned error:', result.error);
        }
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

/**
 * Quick symbol search with lower limits (for Stage 1 caching)
 * @param directory - The directory to search in
 * @param language - The language key
 */
export async function searchSymbolsQuick(
  directory: string,
  language: string
): Promise<SymbolSearchResponse> {
  return searchSymbols(directory, language, { maxSymbols: QUICK_MAX_SYMBOLS });
}

/**
 * Full symbol search (for Stage 2 caching)
 * @param directory - The directory to search in
 * @param language - The language key
 */
export async function searchSymbolsFull(
  directory: string,
  language: string
): Promise<SymbolSearchResponse> {
  return searchSymbols(directory, language, { maxSymbols: DEFAULT_MAX_SYMBOLS });
}
