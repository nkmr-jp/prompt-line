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
import {
  createPlatformErrorResponse,
  createValidationErrorResponse,
  createExecutionErrorResponse,
  validateDirectory,
  validateLanguage,
  buildSearchArgs,
  logExecutionError,
  parseSearchResponse
} from './search-helpers';

// Default search options (exported for use by handlers)
export const DEFAULT_MAX_SYMBOLS = 20000;
export const DEFAULT_SEARCH_TIMEOUT = 5000; // 5 seconds for symbol search

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
      timeout: DEFAULT_SEARCH_TIMEOUT,
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
  // Check platform support
  if (process.platform !== 'darwin') {
    return createPlatformErrorResponse(options);
  }

  // Validate inputs
  if (!validateDirectory(directory)) {
    return createValidationErrorResponse(options, 'Invalid directory');
  }

  if (!validateLanguage(language)) {
    return createValidationErrorResponse(options, 'Invalid language');
  }

  // Prepare search parameters
  const maxSymbols = options.maxSymbols || DEFAULT_MAX_SYMBOLS;
  const timeout = options.timeout || DEFAULT_SEARCH_TIMEOUT;
  const args = buildSearchArgs(directory, language, maxSymbols);

  logger.debug('Searching symbols:', { directory, language, maxSymbols });

  // Execute search
  return executeSymbolSearch(args, timeout, maxSymbols);
}

/**
 * Execute symbol search with native tool
 */
function executeSymbolSearch(
  args: string[],
  timeout: number,
  maxSymbols: number
): Promise<SymbolSearchResponse> {
  return new Promise((resolve) => {
    const execOptions = {
      timeout,
      killSignal: 'SIGTERM' as const
    };

    execFile(SYMBOL_SEARCHER_PATH, args, execOptions, (error, stdout, stderr) => {
      if (error) {
        logExecutionError(error, stderr);
        resolve(createExecutionErrorResponse(maxSymbols, error));
        return;
      }

      resolve(parseSearchResponse(stdout, maxSymbols));
    });
  });
}
