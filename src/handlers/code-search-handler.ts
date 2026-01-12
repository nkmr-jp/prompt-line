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

  // Incremental search cache
  // NOTE: These are shared across all IPC requests. In a multi-window scenario,
  // this could lead to state interference between windows. Currently, the app
  // is single-window only, so this is acceptable. Future improvement: consider
  // per-window or per-session cache to support multiple concurrent search contexts.
  private previousQuery = '';
  private previousResults: import('../managers/symbol-search/types').SymbolResult[] = [];
  private previousCacheKey = ''; // "directory:language:relativePath:symbolTypeFilter" to detect context change

  /**
   * Set settings manager for symbol search configuration
   */
  setSettingsManager(settingsManager: SettingsManager): void {
    this.settingsManager = settingsManager;
  }

  /**
   * Get symbol search settings with defaults
   */
  private getSymbolSearchOptions(): {
    maxSymbols: number;
    timeout: number;
    includePatterns?: string[];
    excludePatterns?: string[];
  } {
    const symbolSearchSettings = this.settingsManager?.getSymbolSearchSettings();
    const result: {
      maxSymbols: number;
      timeout: number;
      includePatterns?: string[];
      excludePatterns?: string[];
    } = {
      maxSymbols: symbolSearchSettings?.maxSymbols ?? DEFAULT_MAX_SYMBOLS,
      timeout: symbolSearchSettings?.timeout ?? DEFAULT_SEARCH_TIMEOUT
    };

    if (symbolSearchSettings?.includePatterns) {
      result.includePatterns = symbolSearchSettings.includePatterns;
    }
    if (symbolSearchSettings?.excludePatterns) {
      result.excludePatterns = symbolSearchSettings.excludePatterns;
    }

    return result;
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
   * Clear incremental search cache
   */
  private clearIncrementalCache(): void {
    this.previousQuery = '';
    this.previousResults = [];
    this.previousCacheKey = '';
  }

  /**
   * Filter symbols by query (name or lineContent match)
   * Performs case-insensitive matching with relevance sorting
   * Uses incremental filtering when query extends previous query
   */
  private filterSymbolsByQuery(
    symbols: import('../managers/symbol-search/types').SymbolResult[],
    query: string,
    symbolTypeFilter?: string | null,
    maxResults: number = 50,
    cacheKey?: string,
    relativePath?: string
  ): import('../managers/symbol-search/types').SymbolResult[] {
    // Minimum query length check
    // Allow 1 char when symbolTypeFilter is set (e.g., @go:func:a) or for CJK users
    // Otherwise require at least 2 chars to avoid too many results
    if (!symbolTypeFilter && query.length < 2) {
      this.clearIncrementalCache();
      return [];
    }

    // Build comprehensive cache key including filter context
    const fullCacheKey = cacheKey
      ? `${cacheKey}:${relativePath || ''}:${symbolTypeFilter || ''}`
      : '';

    // Check if we can use incremental filtering
    const canUseIncremental =
      fullCacheKey === this.previousCacheKey &&
      this.previousQuery.length > 0 &&
      query.startsWith(this.previousQuery) &&
      query.length > this.previousQuery.length;

    // Determine source symbols for filtering
    let sourceSymbols: import('../managers/symbol-search/types').SymbolResult[];
    if (canUseIncremental) {
      // Use previous results as base (incremental refinement)
      sourceSymbols = this.previousResults;
    } else {
      // Start fresh from all symbols
      sourceSymbols = symbols;
      // Clear cache on backspace or context change
      if (fullCacheKey !== this.previousCacheKey || query.length < this.previousQuery.length) {
        this.clearIncrementalCache();
      }
    }

    let filtered = sourceSymbols;

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
      filtered = filtered.filter(s => {
        // Use pre-computed nameLower if available, otherwise compute on the fly
        const nameLower = s.nameLower ?? s.name.toLowerCase();
        return nameLower.includes(lowerQuery) ||
          s.lineContent.toLowerCase().includes(lowerQuery);
      });

      // Sort by relevance (symbols starting with query first, then alphabetical)
      filtered.sort((a, b) => {
        const aName = a.nameLower ?? a.name.toLowerCase();
        const bName = b.nameLower ?? b.name.toLowerCase();
        const aStarts = aName.startsWith(lowerQuery);
        const bStarts = bName.startsWith(lowerQuery);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return aName.localeCompare(bName);
      });
    }

    // Update incremental cache (store full filtered results before limiting)
    if (fullCacheKey) {
      this.previousQuery = query;
      this.previousResults = filtered;
      this.previousCacheKey = fullCacheKey;
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
      relativePath?: string;
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
        let cachedSymbols = await symbolCacheManager.loadSymbols(directory, language);
        if (cachedSymbols.length > 0) {
          // Apply relativePath filtering first if provided
          if (options?.relativePath) {
            // Normalize paths to use forward slashes for consistent comparison
            const normalizedTargetPath = options.relativePath.replace(/\\/g, '/');
            cachedSymbols = cachedSymbols.filter(s => {
              const normalizedPath = s.relativePath.replace(/\\/g, '/');
              // macOS/Linux are case-sensitive, Windows is case-insensitive
              return process.platform === 'win32'
                ? normalizedPath.toLowerCase() === normalizedTargetPath.toLowerCase()
                : normalizedPath === normalizedTargetPath;
            });
          }

          // Apply query filtering if provided (Main process filtering for performance)
          const unfilteredCount = cachedSymbols.length;
          const cacheKey = `${directory}:${language}`;
          const filteredSymbols = options?.query !== undefined
            ? this.filterSymbolsByQuery(
                cachedSymbols,
                options.query,
                options.symbolTypeFilter,
                maxResults,
                cacheKey,
                options.relativePath
              )
            : cachedSymbols.slice(0, effectiveMaxSymbols);

          const wasLimited = options?.query !== undefined
            ? false // Query filtering already limits results
            : cachedSymbols.length > effectiveMaxSymbols;

          // Background refresh: only update cache when refreshCache is explicitly true
          // This prevents unnecessary refreshes during file navigation (e.g., @go vs @go:)
          if (options?.refreshCache === true) {
            const refreshOptions: {
              maxSymbols: number;
              timeout: number;
              includePatterns?: string[];
              excludePatterns?: string[];
            } = {
              maxSymbols: effectiveMaxSymbols,
              timeout: settingsOptions.timeout
            };
            if (settingsOptions.includePatterns) {
              refreshOptions.includePatterns = settingsOptions.includePatterns;
            }
            if (settingsOptions.excludePatterns) {
              refreshOptions.excludePatterns = settingsOptions.excludePatterns;
            }
            this.refreshCacheInBackground(directory, language, refreshOptions);
          }

          return {
            success: true,
            directory,
            language,
            symbols: filteredSymbols,
            symbolCount: filteredSymbols.length,
            unfilteredCount,
            searchMode: 'cached',
            partial: wasLimited,
            maxSymbols: effectiveMaxSymbols
          };
        }
      }
    }

    // Perform fresh search (no cache available)
    const searchOptions: {
      maxSymbols: number;
      timeout: number;
      includePatterns?: string[];
      excludePatterns?: string[];
    } = {
      maxSymbols: effectiveMaxSymbols,
      timeout: settingsOptions.timeout
    };
    if (settingsOptions.includePatterns) {
      searchOptions.includePatterns = settingsOptions.includePatterns;
    }
    if (settingsOptions.excludePatterns) {
      searchOptions.excludePatterns = settingsOptions.excludePatterns;
    }
    const result = await searchSymbols(directory, language, searchOptions);

    // Cache successful results
    if (result.success && result.symbols.length > 0) {
      await symbolCacheManager.saveSymbols(
        directory,
        language,
        result.symbols,
        'full'
      );

      // Store unfilteredCount before relativePath filtering
      const unfilteredCount = result.symbols.length;

      // Apply relativePath filtering if provided
      if (options?.relativePath) {
        // Normalize paths to use forward slashes for consistent comparison
        const normalizedTargetPath = options.relativePath.replace(/\\/g, '/');
        result.symbols = result.symbols.filter(s => {
          const normalizedPath = s.relativePath.replace(/\\/g, '/');
          // macOS/Linux are case-sensitive, Windows is case-insensitive
          return process.platform === 'win32'
            ? normalizedPath.toLowerCase() === normalizedTargetPath.toLowerCase()
            : normalizedPath === normalizedTargetPath;
        });
        result.symbolCount = result.symbols.length;
      }

      // Add unfilteredCount to result
      result.unfilteredCount = unfilteredCount;
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

    // Load symbols with maxSymbols limit (streaming read with early termination)
    const symbols = await symbolCacheManager.loadSymbols(directory, language, settingsOptions.maxSymbols);

    // Check if we hit the limit (partial results)
    const wasLimited = symbols.length >= settingsOptions.maxSymbols;

    const response: SymbolSearchResponse = {
      success: true,
      directory,
      symbols,
      symbolCount: symbols.length,
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
      // Clear incremental search cache to prevent using stale results
      this.clearIncrementalCache();
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
    options?: {
      maxSymbols?: number;
      timeout?: number;
      includePatterns?: string[];
      excludePatterns?: string[];
    }
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
          // Clear incremental cache after background update to ensure fresh results
          this.clearIncrementalCache();
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
