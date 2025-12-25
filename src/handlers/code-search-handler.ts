/**
 * Code Search IPC Handler
 * Handles IPC requests for symbol search functionality
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { logger } from '../utils/utils';
import {
  checkRgAvailable,
  getSupportedLanguages,
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
import {
  validateSearchInputs,
  validateDirectory,
  validateCacheAvailability,
  loadAndFormatCachedSymbols,
  performFreshSearch,
  tryGetCachedSymbols,
  refreshCacheInBackground
} from './code-search-helpers';

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
    logger.debug('CodeSearchHandler: SettingsManager configured');
  }

  /**
   * Get symbol search settings with defaults
   */
  private getSymbolSearchOptions(): { maxSymbols: number; timeout: number } {
    const symbolSearchSettings = this.settingsManager?.getSymbolSearchSettings();
    const result = {
      maxSymbols: symbolSearchSettings?.maxSymbols ?? DEFAULT_MAX_SYMBOLS,
      timeout: symbolSearchSettings?.timeout ?? DEFAULT_SEARCH_TIMEOUT
    };
    logger.debug('getSymbolSearchOptions:', {
      hasSettingsManager: !!this.settingsManager,
      symbolSearchSettings,
      effectiveOptions: result
    });
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
    options?: { maxSymbols?: number; useCache?: boolean; refreshCache?: boolean }
  ): Promise<SymbolSearchResponse> {
    logger.debug('Handling search-symbols request', { directory, language, options });

    const settingsOptions = this.getSymbolSearchOptions();
    const effectiveMaxSymbols = options?.maxSymbols ?? settingsOptions.maxSymbols;

    const validationResult = validateSearchInputs(directory, language, effectiveMaxSymbols);
    if (!validationResult.valid) {
      return validationResult.errorResponse!;
    }

    if (options?.useCache !== false) {
      const cachedResult = await tryGetCachedSymbols(
        directory,
        language,
        effectiveMaxSymbols,
        settingsOptions.timeout,
        options?.refreshCache,
        this.refreshCacheInBackgroundBound.bind(this)
      );
      if (cachedResult) {
        return cachedResult;
      }
    }

    return await performFreshSearch(directory, language, effectiveMaxSymbols, settingsOptions.timeout);
  }

  /**
   * Bound version of refreshCacheInBackground for use as callback
   */
  private refreshCacheInBackgroundBound(
    directory: string,
    language: string,
    options: { maxSymbols: number; timeout: number }
  ): void {
    refreshCacheInBackground(directory, language, options, this.pendingRefreshes);
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

    const settingsOptions = this.getSymbolSearchOptions();

    const directoryValidation = validateDirectory(directory, settingsOptions.maxSymbols);
    if (directoryValidation) {
      return directoryValidation;
    }

    const cacheValidation = await validateCacheAvailability(directory, settingsOptions.maxSymbols);
    if (cacheValidation) {
      return cacheValidation;
    }

    return await loadAndFormatCachedSymbols(directory, language, settingsOptions.maxSymbols);
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
}

// Export singleton instance
export const codeSearchHandler = new CodeSearchHandler();
