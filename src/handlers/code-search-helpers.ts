/**
 * Code Search Handler Helpers
 * Extracted helper functions for code-search-handler.ts
 */

import { logger } from '../utils/utils';
import { symbolCacheManager } from '../managers/symbol-cache-manager';
import { searchSymbols } from '../managers/symbol-search';
import type { SymbolSearchResponse } from '../managers/symbol-search/types';

/**
 * Validate search inputs (directory, language, maxSymbols)
 */
export function validateSearchInputs(
  directory: string,
  language: string,
  maxSymbols: number
): { valid: boolean; errorResponse?: SymbolSearchResponse } {
  const baseError = {
    success: false,
    symbols: [],
    symbolCount: 0,
    searchMode: 'full' as const,
    partial: false,
    maxSymbols
  };

  if (!directory || typeof directory !== 'string') {
    return {
      valid: false,
      errorResponse: { ...baseError, error: 'Invalid directory' }
    };
  }

  if (!language || typeof language !== 'string') {
    return {
      valid: false,
      errorResponse: { ...baseError, error: 'Invalid language' }
    };
  }

  return { valid: true };
}

/**
 * Validate directory parameter
 */
export function validateDirectory(directory: string, maxSymbols: number): SymbolSearchResponse | null {
  if (!directory || typeof directory !== 'string') {
    return createErrorResponse(maxSymbols, 'Invalid directory');
  }
  return null;
}

/**
 * Validate cache availability for directory
 */
export async function validateCacheAvailability(
  directory: string,
  maxSymbols: number
): Promise<SymbolSearchResponse | null> {
  const isCacheValid = await symbolCacheManager.isCacheValid(directory);
  if (!isCacheValid) {
    return createErrorResponse(maxSymbols, 'No valid cache found');
  }
  return null;
}

/**
 * Create error response with consistent structure
 */
export function createErrorResponse(maxSymbols: number, error: string): SymbolSearchResponse {
  return {
    success: false,
    symbols: [],
    symbolCount: 0,
    searchMode: 'cached',
    partial: false,
    maxSymbols,
    error
  };
}

/**
 * Log cached symbols information
 */
export function logCachedSymbolsInfo(
  cachedCount: number,
  returnedCount: number,
  maxSymbols: number,
  wasLimited: boolean
): void {
  logger.debug('Returning cached symbols', {
    cachedCount,
    returnedCount,
    maxSymbols,
    wasLimited
  });
}

/**
 * Build cached symbols response with optional language
 */
export function buildCachedSymbolsResponse(
  directory: string,
  language: string | undefined,
  symbols: any[],
  wasLimited: boolean,
  maxSymbols: number
): SymbolSearchResponse {
  const response: SymbolSearchResponse = {
    success: true,
    directory,
    symbols,
    symbolCount: symbols.length,
    searchMode: 'cached',
    partial: wasLimited,
    maxSymbols
  };

  if (language) {
    response.language = language;
  }

  return response;
}

/**
 * Try to get cached symbols with optional background refresh
 */
export async function tryGetCachedSymbols(
  directory: string,
  language: string,
  maxSymbols: number,
  timeout: number,
  refreshCache: boolean | undefined,
  refreshCacheCallback: (directory: string, language: string, options: { maxSymbols: number; timeout: number }) => void
): Promise<SymbolSearchResponse | null> {
  const hasLanguage = await symbolCacheManager.hasLanguageCache(directory, language);
  if (!hasLanguage) {
    return null;
  }

  const cachedSymbols = await symbolCacheManager.loadSymbols(directory, language);
  if (cachedSymbols.length === 0) {
    return null;
  }

  const limitedSymbols = cachedSymbols.slice(0, maxSymbols);
  const wasLimited = cachedSymbols.length > maxSymbols;

  logger.debug('Returning cached symbols (stale-while-revalidate)', {
    cachedCount: cachedSymbols.length,
    returnedCount: limitedSymbols.length,
    maxSymbols,
    wasLimited
  });

  if (refreshCache === true) {
    refreshCacheCallback(directory, language, { maxSymbols, timeout });
  }

  return {
    success: true,
    directory,
    language,
    symbols: limitedSymbols,
    symbolCount: limitedSymbols.length,
    searchMode: 'cached',
    partial: wasLimited,
    maxSymbols
  };
}

/**
 * Load and format cached symbols
 */
export async function loadAndFormatCachedSymbols(
  directory: string,
  language: string | undefined,
  maxSymbols: number
): Promise<SymbolSearchResponse> {
  const allSymbols = await symbolCacheManager.loadSymbols(directory, language);
  const limitedSymbols = allSymbols.slice(0, maxSymbols);
  const wasLimited = allSymbols.length > maxSymbols;

  logCachedSymbolsInfo(allSymbols.length, limitedSymbols.length, maxSymbols, wasLimited);

  return buildCachedSymbolsResponse(directory, language, limitedSymbols, wasLimited, maxSymbols);
}

/**
 * Perform fresh symbol search and cache results
 */
export async function performFreshSearch(
  directory: string,
  language: string,
  maxSymbols: number,
  timeout: number
): Promise<SymbolSearchResponse> {
  const searchOptions = { maxSymbols, timeout };
  const result = await searchSymbols(directory, language, searchOptions);

  if (result.success && result.symbols.length > 0) {
    await symbolCacheManager.saveSymbols(directory, language, result.symbols, 'full');
  }

  return result;
}

/**
 * Refresh cache in background (stale-while-revalidate pattern)
 * This runs asynchronously without blocking the main response
 * Uses deduplication to avoid multiple concurrent refreshes for the same directory/language
 */
export function refreshCacheInBackground(
  directory: string,
  language: string,
  options: { maxSymbols?: number; timeout?: number } | undefined,
  pendingRefreshes: Map<string, boolean>
): void {
  // Create a unique key for this refresh operation
  const refreshKey = `${directory}:${language}`;

  // Skip if a refresh is already in progress for this combination
  if (pendingRefreshes.get(refreshKey)) {
    logger.debug('Background cache refresh skipped (already in progress)', { directory, language });
    return;
  }

  // Mark as pending
  pendingRefreshes.set(refreshKey, true);

  // Run in background without awaiting
  (async () => {
    try {
      logger.debug('Background cache refresh started', { directory, language });
      const result = await searchSymbols(directory, language, options);

      if (result.success && result.symbols.length > 0) {
        await symbolCacheManager.saveSymbols(
          directory,
          language,
          result.symbols,
          'full'
        );
        logger.debug('Background cache refresh completed', {
          directory,
          language,
          symbolCount: result.symbols.length
        });
      }
    } catch (error) {
      logger.warn('Background cache refresh failed', { directory, language, error });
    } finally {
      // Clear pending status
      pendingRefreshes.delete(refreshKey);
    }
  })();
}
