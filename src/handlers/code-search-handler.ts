/**
 * Code Search IPC Handler
 * Handles IPC requests for symbol search functionality
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { logger } from '../utils/utils';
import {
  checkRgAvailable,
  getSupportedLanguages,
  searchSymbols
} from '../managers/symbol-search';
import { symbolCacheManager } from '../managers/symbol-cache-manager';
import type {
  SymbolSearchResponse,
  RgCheckResponse,
  LanguagesResponse
} from '../managers/symbol-search/types';

/**
 * Code Search Handler class
 * Manages IPC handlers for code/symbol search operations
 */
class CodeSearchHandler {
  private initialized = false;

  /**
   * Register all IPC handlers
   */
  register(): void {
    if (this.initialized) {
      logger.warn('CodeSearchHandler already initialized');
      return;
    }

    // Check if ripgrep is available
    ipcMain.handle('check-rg', this.handleCheckRg.bind(this));

    // Get supported programming languages
    ipcMain.handle('get-supported-languages', this.handleGetSupportedLanguages.bind(this));

    // Search for symbols in a directory
    ipcMain.handle('search-symbols', this.handleSearchSymbols.bind(this));

    // Get cached symbols
    ipcMain.handle('get-cached-symbols', this.handleGetCachedSymbols.bind(this));

    // Clear symbol cache
    ipcMain.handle('clear-symbol-cache', this.handleClearSymbolCache.bind(this));

    this.initialized = true;
    logger.debug('CodeSearchHandler registered');
  }

  /**
   * Handle check-rg request
   */
  private async handleCheckRg(): Promise<RgCheckResponse> {
    logger.debug('Handling check-rg request');
    return checkRgAvailable();
  }

  /**
   * Handle get-supported-languages request
   */
  private async handleGetSupportedLanguages(): Promise<LanguagesResponse> {
    logger.debug('Handling get-supported-languages request');
    return getSupportedLanguages();
  }

  /**
   * Handle search-symbols request
   */
  private async handleSearchSymbols(
    _event: IpcMainInvokeEvent,
    directory: string,
    language: string,
    options?: { maxSymbols?: number; useCache?: boolean }
  ): Promise<SymbolSearchResponse> {
    logger.debug('Handling search-symbols request', { directory, language, options });

    // Validate inputs
    if (!directory || typeof directory !== 'string') {
      return {
        success: false,
        symbols: [],
        symbolCount: 0,
        searchMode: 'full',
        partial: false,
        maxSymbols: options?.maxSymbols || 20000,
        error: 'Invalid directory'
      };
    }

    if (!language || typeof language !== 'string') {
      return {
        success: false,
        symbols: [],
        symbolCount: 0,
        searchMode: 'full',
        partial: false,
        maxSymbols: options?.maxSymbols || 20000,
        error: 'Invalid language'
      };
    }

    // Check cache first if requested
    if (options?.useCache !== false) {
      const hasLanguage = await symbolCacheManager.hasLanguageCache(directory, language);

      if (hasLanguage) {
        const cachedSymbols = await symbolCacheManager.loadSymbols(directory, language);
        if (cachedSymbols.length > 0) {
          logger.debug('Returning cached symbols (stale-while-revalidate)', { count: cachedSymbols.length });

          // Background refresh: update cache without blocking the response
          const searchOptions = options?.maxSymbols !== undefined
            ? { maxSymbols: options.maxSymbols }
            : undefined;
          this.refreshCacheInBackground(directory, language, searchOptions);

          return {
            success: true,
            directory,
            language,
            symbols: cachedSymbols,
            symbolCount: cachedSymbols.length,
            searchMode: 'cached',
            partial: false,
            maxSymbols: options?.maxSymbols || 20000
          };
        }
      }
    }

    // Perform fresh search (no cache available)
    const searchOptions = options?.maxSymbols !== undefined
      ? { maxSymbols: options.maxSymbols }
      : undefined;
    const result = await searchSymbols(directory, language, searchOptions);

    // Cache successful results
    if (result.success && result.symbols.length > 0) {
      await symbolCacheManager.saveSymbols(
        directory,
        language,
        result.symbols,
        'full'
      );
    }

    return result;
  }

  /**
   * Handle get-cached-symbols request
   */
  private async handleGetCachedSymbols(
    _event: IpcMainInvokeEvent,
    directory: string,
    language?: string
  ): Promise<SymbolSearchResponse> {
    logger.debug('Handling get-cached-symbols request', { directory, language });

    if (!directory || typeof directory !== 'string') {
      return {
        success: false,
        symbols: [],
        symbolCount: 0,
        searchMode: 'cached',
        partial: false,
        maxSymbols: 20000,
        error: 'Invalid directory'
      };
    }

    const isCacheValid = await symbolCacheManager.isCacheValid(directory);
    if (!isCacheValid) {
      return {
        success: false,
        symbols: [],
        symbolCount: 0,
        searchMode: 'cached',
        partial: false,
        maxSymbols: 20000,
        error: 'No valid cache found'
      };
    }

    const symbols = await symbolCacheManager.loadSymbols(directory, language);
    const metadata = await symbolCacheManager.loadMetadata(directory);

    const response: SymbolSearchResponse = {
      success: true,
      directory,
      symbols,
      symbolCount: symbols.length,
      searchMode: 'cached',
      partial: false,
      maxSymbols: metadata?.totalSymbolCount || 20000
    };

    if (language) {
      response.language = language;
    }

    return response;
  }

  /**
   * Handle clear-symbol-cache request
   */
  private async handleClearSymbolCache(
    _event: IpcMainInvokeEvent,
    directory?: string
  ): Promise<{ success: boolean }> {
    logger.debug('Handling clear-symbol-cache request', { directory });

    try {
      if (directory) {
        await symbolCacheManager.clearCache(directory);
      } else {
        await symbolCacheManager.clearAllCaches();
      }
      return { success: true };
    } catch (error) {
      logger.error('Error clearing symbol cache:', error);
      return { success: false };
    }
  }

  /**
   * Refresh cache in background (stale-while-revalidate pattern)
   * This runs asynchronously without blocking the main response
   */
  private refreshCacheInBackground(
    directory: string,
    language: string,
    options?: { maxSymbols?: number }
  ): void {
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
      }
    })();
  }
}

// Export singleton instance
export const codeSearchHandler = new CodeSearchHandler();
