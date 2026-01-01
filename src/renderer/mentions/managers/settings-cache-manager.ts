/**
 * SettingsCacheManager - Manages caching for settings-related data
 *
 * Responsibilities:
 * - Caching maxSuggestions for mdSearch and fileSearch
 * - Caching searchPrefixes for command and mention types
 * - Preloading cache on startup
 * - Sync access to cached values for performance-critical paths
 */

import { BaseCacheManager } from './base-cache-manager';
import { handleError } from '../../utils/error-handler';
import { SUGGESTIONS } from '../../../constants';
import { electronAPI } from '../../services/electron-api';

/**
 * SettingsCacheManager class for caching settings data
 * Extends BaseCacheManager for maxSuggestions caching
 */
export class SettingsCacheManager extends BaseCacheManager<string, number> {
  private searchPrefixesCache: Map<string, string[]> = new Map();
  private fileSearchMaxSuggestionsCache: number | null = null;

  private static readonly DEFAULT_MAX_SUGGESTIONS = SUGGESTIONS.DEFAULT_MAX;

  constructor() {
    super();
  }

  /**
   * Implement abstract fetchValue for maxSuggestions
   */
  protected async fetchValue(key: string): Promise<number> {
    try {
      const type = key as 'command' | 'mention';
      if (electronAPI?.mdSearch?.getMaxSuggestions) {
        return await electronAPI.mdSearch.getMaxSuggestions(type);
      }
    } catch (error) {
      handleError('SettingsCacheManager.fetchValue', error);
    }
    return SettingsCacheManager.DEFAULT_MAX_SUGGESTIONS;
  }

  /**
   * Get maxSuggestions for a given type (cached)
   * Uses base class caching mechanism
   */
  public async getMaxSuggestions(type: 'command' | 'mention'): Promise<number> {
    return this.getOrFetch(type);
  }

  /**
   * Clear maxSuggestions cache (call when settings might have changed)
   */
  public clearMaxSuggestionsCache(): void {
    this.clearCache(); // Use base class method
    this.fileSearchMaxSuggestionsCache = null;
  }

  /**
   * Get maxSuggestions for file search (cached)
   * This is for @ mentions file/symbol search, separate from mdSearch settings
   */
  public async getFileSearchMaxSuggestions(): Promise<number> {
    // Check cache first
    if (this.fileSearchMaxSuggestionsCache !== null) {
      return this.fileSearchMaxSuggestionsCache;
    }

    try {
      if (electronAPI?.fileSearch?.getMaxSuggestions) {
        const maxSuggestions = await electronAPI.fileSearch.getMaxSuggestions();
        this.fileSearchMaxSuggestionsCache = maxSuggestions;
        return maxSuggestions;
      }
    } catch (error) {
      handleError('SettingsCacheManager.getFileSearchMaxSuggestions', error);
    }

    return SettingsCacheManager.DEFAULT_MAX_SUGGESTIONS;
  }

  /**
   * Get searchPrefixes for a given type (cached)
   */
  public async getSearchPrefixes(type: 'command' | 'mention'): Promise<string[]> {
    // Check cache first
    if (this.searchPrefixesCache.has(type)) {
      return this.searchPrefixesCache.get(type)!;
    }

    try {
      if (electronAPI?.mdSearch?.getSearchPrefixes) {
        const prefixes = await electronAPI.mdSearch.getSearchPrefixes(type);
        this.searchPrefixesCache.set(type, prefixes);
        return prefixes;
      }
    } catch (error) {
      handleError('SettingsCacheManager.getSearchPrefixes', error);
    }

    return [];
  }

  /**
   * Clear searchPrefixes cache (call when settings might have changed)
   */
  public clearSearchPrefixesCache(): void {
    this.searchPrefixesCache.clear();
  }

  /**
   * Clear all caches
   */
  public clearAllCaches(): void {
    this.clearCache(); // Clear maxSuggestions cache (base class)
    this.clearSearchPrefixesCache();
    this.fileSearchMaxSuggestionsCache = null;
  }

  /**
   * Check if query matches any searchPrefix for the given type
   */
  public async matchesSearchPrefix(query: string, type: 'command' | 'mention'): Promise<boolean> {
    const prefixes = await this.getSearchPrefixes(type);
    return prefixes.some(prefix => query.startsWith(prefix));
  }

  /**
   * Synchronously check if command type is enabled (from cache)
   * Returns false if cache is not populated yet
   */
  public isCommandEnabledSync(): boolean {
    const prefixes = this.searchPrefixesCache.get('command');
    return prefixes !== undefined && prefixes.length > 0;
  }

  /**
   * Synchronously check if query matches any searchPrefix for the given type (from cache)
   * Returns false if cache is not populated yet
   */
  public matchesSearchPrefixSync(query: string, type: 'command' | 'mention'): boolean {
    const prefixes = this.searchPrefixesCache.get(type);
    if (!prefixes) {
      return false;
    }
    return prefixes.some(prefix => query.startsWith(prefix));
  }

  /**
   * Preload searchPrefixes cache for command and mention types
   * Call this early (e.g., on window-shown) to populate cache for sync checks
   */
  public async preloadSearchPrefixesCache(): Promise<void> {
    try {
      // Load both command and mention prefixes in parallel
      await Promise.all([
        this.getSearchPrefixes('command'),
        this.getSearchPrefixes('mention')
      ]);
    } catch (error) {
      handleError('SettingsCacheManager.preloadSearchPrefixesCache', error);
    }
  }

  /**
   * Get the default max suggestions value
   */
  public getDefaultMaxSuggestions(): number {
    return SettingsCacheManager.DEFAULT_MAX_SUGGESTIONS;
  }
}
