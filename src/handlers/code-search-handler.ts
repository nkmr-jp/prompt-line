/**
 * Code Search IPC Handler
 * Handles IPC requests for symbol search functionality
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { logger } from '../utils/utils';
import {
  checkRgAvailable,
  getSupportedLanguages,
  searchSymbols,
  DEFAULT_MAX_SYMBOLS,
  DEFAULT_SEARCH_TIMEOUT
} from '../managers/symbol-search';
import { symbolCacheManager } from '../managers/symbol-cache-manager';
import type SettingsManager from '../managers/settings-manager';
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
  // Track pending background refreshes to avoid duplicates
  private pendingRefreshes = new Map<string, boolean>();
  private settingsManager: SettingsManager | null = null;

  /**
   * Set settings manager for symbol search configuration
   */
  setSettingsManager(settingsManager: SettingsManager): void {
    this.settingsManager = settingsManager;
  }

  /**
   * Get symbol search settings with defaults
   */
  private getSymbolSearchOptions(): { maxSymbols: number; timeout: number } {
    const symbolSearchSettings = this.settingsManager?.getSymbolSearchSettings();
    return {
      maxSymbols: symbolSearchSettings?.maxSymbols ?? DEFAULT_MAX_SYMBOLS,
      timeout: symbolSearchSettings?.timeout ?? DEFAULT_SEARCH_TIMEOUT
    };
  }

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
  }

  /**
   * Handle check-rg request
   */
  private async handleCheckRg(): Promise<RgCheckResponse> {
    return checkRgAvailable();
  }

  /**
   * Handle get-supported-languages request
   */
  private async handleGetSupportedLanguages(): Promise<LanguagesResponse> {
    return getSupportedLanguages();
  }

  /**
   * Filter symbols by query (name or lineContent match)
   * Performs case-insensitive matching with relevance sorting
   */
  private filterSymbolsByQuery(
    symbols: import('../managers/symbol-search/types').SymbolResult[],
    query: string,
    symbolTypeFilter?: string | null,
    maxResults: number = 50
  ): import('../managers/symbol-search/types').SymbolResult[] {
    let filtered = symbols;

    // Filter by symbol type first (e.g., @go:func: → only functions)
    if (symbolTypeFilter) {
      // Map display names to internal types
      const typeMap: Record<string, string> = {
        'func': 'function',
        'method': 'method',
        'class': 'class',
        'struct': 'struct',
        'interface': 'interface',
        'type': 'type',
        'const': 'constant',
        'var': 'variable',
        'enum': 'enum',
        'trait': 'trait',
        'module': 'module',
        'namespace': 'namespace'
      };
      const targetType = typeMap[symbolTypeFilter.toLowerCase()];
      if (targetType) {
        filtered = filtered.filter(s => s.type === targetType);
      }
    }

    // Filter by query
    if (query) {
      const lowerQuery = query.toLowerCase();
      filtered = filtered.filter(s =>
        s.name.toLowerCase().includes(lowerQuery) ||
        s.lineContent.toLowerCase().includes(lowerQuery)
      );

      // Sort by relevance (symbols starting with query first, then alphabetical)
      filtered.sort((a, b) => {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();
        const aStarts = aName.startsWith(lowerQuery);
        const bStarts = bName.startsWith(lowerQuery);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return aName.localeCompare(bName);
      });
    }

    // Return limited results
    return filtered.slice(0, maxResults);
  }

  /**
   * Handle search-symbols request
   */
  private async handleSearchSymbols(
    _event: IpcMainInvokeEvent,
    directory: string,
    language: string,
    options?: {
      maxSymbols?: number;
      useCache?: boolean;
      refreshCache?: boolean;
      query?: string;
      symbolTypeFilter?: string | null;
      maxResults?: number;
    }
  ): Promise<SymbolSearchResponse> {
    // Get settings-based defaults
    const settingsOptions = this.getSymbolSearchOptions();
    const effectiveMaxSymbols = options?.maxSymbols ?? settingsOptions.maxSymbols;
    const maxResults = options?.maxResults ?? 50;

    // Validate inputs
    if (!directory || typeof directory !== 'string') {
      return {
        success: false,
        symbols: [],
        symbolCount: 0,
        searchMode: 'full',
        partial: false,
        maxSymbols: effectiveMaxSymbols,
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
        maxSymbols: effectiveMaxSymbols,
        error: 'Invalid language'
      };
    }

    // Check cache first if requested
    if (options?.useCache !== false) {
      const hasLanguage = await symbolCacheManager.hasLanguageCache(directory, language);

      if (hasLanguage) {
        const cachedSymbols = await symbolCacheManager.loadSymbols(directory, language);
        if (cachedSymbols.length > 0) {
          // Apply query filtering if provided (Main process filtering for performance)
          const filteredSymbols = options?.query !== undefined
            ? this.filterSymbolsByQuery(
                cachedSymbols,
                options.query,
                options.symbolTypeFilter,
                maxResults
              )
            : cachedSymbols.slice(0, effectiveMaxSymbols);

          const wasLimited = options?.query !== undefined
            ? false // Query filtering already limits results
            : cachedSymbols.length > effectiveMaxSymbols;

          // Background refresh: only update cache when refreshCache is explicitly true
          // This prevents unnecessary refreshes during file navigation (e.g., @go vs @go:)
          if (options?.refreshCache === true) {
            this.refreshCacheInBackground(directory, language, {
              maxSymbols: effectiveMaxSymbols,
              timeout: settingsOptions.timeout
            });
          }

          return {
            success: true,
            directory,
            language,
            symbols: filteredSymbols,
            symbolCount: filteredSymbols.length,
            searchMode: 'cached',
            partial: wasLimited,
            maxSymbols: effectiveMaxSymbols
          };
        }
      }
    }

    // Perform fresh search (no cache available)
    const searchOptions = {
      maxSymbols: effectiveMaxSymbols,
      timeout: settingsOptions.timeout
    };
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
    const settingsOptions = this.getSymbolSearchOptions();

    if (!directory || typeof directory !== 'string') {
      return {
        success: false,
        symbols: [],
        symbolCount: 0,
        searchMode: 'cached',
        partial: false,
        maxSymbols: settingsOptions.maxSymbols,
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
        maxSymbols: settingsOptions.maxSymbols,
        error: 'No valid cache found'
      };
    }

    const allSymbols = await symbolCacheManager.loadSymbols(directory, language);

    // Apply maxSymbols limit to cached results
    const limitedSymbols = allSymbols.slice(0, settingsOptions.maxSymbols);
    const wasLimited = allSymbols.length > settingsOptions.maxSymbols;

    const response: SymbolSearchResponse = {
      success: true,
      directory,
      symbols: limitedSymbols,
      symbolCount: limitedSymbols.length,
      searchMode: 'cached',
      partial: wasLimited,
      maxSymbols: settingsOptions.maxSymbols
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
   * Uses deduplication to avoid multiple concurrent refreshes for the same directory/language
   */
  private refreshCacheInBackground(
    directory: string,
    language: string,
    options?: { maxSymbols?: number; timeout?: number }
  ): void {
    // Create a unique key for this refresh operation
    const refreshKey = `${directory}:${language}`;

    // Skip if a refresh is already in progress for this combination
    if (this.pendingRefreshes.get(refreshKey)) {
      return;
    }

    // Mark as pending
    this.pendingRefreshes.set(refreshKey, true);

    // Run in background without awaiting
    (async () => {
      try {
        const result = await searchSymbols(directory, language, options);

        if (result.success && result.symbols.length > 0) {
          await symbolCacheManager.saveSymbols(
            directory,
            language,
            result.symbols,
            'full'
          );
        }
      } catch (error) {
        logger.warn('Background cache refresh failed', { directory, language, error });
      } finally {
        // Clear pending status
        this.pendingRefreshes.delete(refreshKey);
      }
    })();
  }
}

// Export singleton instance
export const codeSearchHandler = new CodeSearchHandler();
