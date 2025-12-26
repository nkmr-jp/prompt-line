/**
 * SettingsCacheManager - Manages caching for settings-related data
 *
 * Responsibilities:
 * - Caching maxSuggestions for mdSearch and fileSearch
 * - Caching searchPrefixes for command and mention types
 * - Preloading cache on startup
 * - Sync access to cached values for performance-critical paths
 */
// @ts-nocheck


import { handleError } from '../../utils/error-handler';
import { SUGGESTIONS } from '../../../constants';

/**
 * ElectronAPI interface for mdSearch and fileSearch operations
 */
interface ElectronAPI {
  mdSearch?: {
    getMaxSuggestions: (type: 'command' | 'mention') => Promise<number>;
    getSearchPrefixes: (type: 'command' | 'mention') => Promise<string[]>;
  };
  fileSearch?: {
    getMaxSuggestions: () => Promise<number>;
  };
}

/**
 * SettingsCacheManager class for caching settings data
 */
export class SettingsCacheManager {
  private maxSuggestionsCache: Map<string, number> = new Map();
  private searchPrefixesCache: Map<string, string[]> = new Map();
  private fileSearchMaxSuggestionsCache: number | null = null;

  private static readonly DEFAULT_MAX_SUGGESTIONS = SUGGESTIONS.DEFAULT_MAX;

  constructor() {
    // No initialization needed
  }

  /**
   * Get electronAPI from window object
   */
  private getElectronAPI(): ElectronAPI | null {
    return (window as unknown as { electronAPI?: ElectronAPI }).electronAPI || null;
  }

  /**
   * Get maxSuggestions for a given type (cached)
   */
  public async getMaxSuggestions(type: 'command' | 'mention'): Promise<number> {
    // Check cache first
    if (this.maxSuggestionsCache.has(type)) {
      return this.maxSuggestionsCache.get(type)!;
    }

    try {
      const electronAPI = this.getElectronAPI();
      if (electronAPI?.mdSearch?.getMaxSuggestions) {
        const maxSuggestions = await electronAPI.mdSearch.getMaxSuggestions(type);
        this.maxSuggestionsCache.set(type, maxSuggestions);
        return maxSuggestions;
      }
    } catch (error) {
      handleError('SettingsCacheManager.getMaxSuggestions', error);
    }

    return SettingsCacheManager.DEFAULT_MAX_SUGGESTIONS;
  }

  /**
   * Clear maxSuggestions cache (call when settings might have changed)
   */
  public clearMaxSuggestionsCache(): void {
    this.maxSuggestionsCache.clear();
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
      const electronAPI = this.getElectronAPI();
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
      const electronAPI = this.getElectronAPI();
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
    this.clearMaxSuggestionsCache();
    this.clearSearchPrefixesCache();
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
      console.debug('[SettingsCacheManager] SearchPrefixes cache preloaded');
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
