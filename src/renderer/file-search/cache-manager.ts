/**
 * Cache Manager for file search functionality
 * Handles caching of directory data, search prefixes, and max suggestions
 */

import type { DirectoryInfo, InputFormatType } from '../../types';
import type { DirectoryData, FileSearchCallbacks } from './types';
import { formatLog } from './types';

export class FileSearchCacheManager {
  private cachedDirectoryData: DirectoryData | null = null;
  private maxSuggestionsCache: Map<string, number> = new Map();
  private searchPrefixesCache: Map<string, string[]> = new Map();
  private fileSearchEnabled: boolean = false;
  private fileSearchInputFormat: InputFormatType = 'path';  // Default to 'path' for file search
  private callbacks: FileSearchCallbacks;

  static readonly DEFAULT_MAX_SUGGESTIONS = 20;

  constructor(callbacks: FileSearchCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Set file search enabled state
   */
  public setFileSearchEnabled(enabled: boolean): void {
    this.fileSearchEnabled = enabled;
    console.debug('[FileSearchManager] File search enabled:', enabled);
  }

  /**
   * Check if file search is enabled
   */
  public isFileSearchEnabled(): boolean {
    return this.fileSearchEnabled;
  }

  /**
   * Set file search input format
   */
  public setFileSearchInputFormat(format: InputFormatType): void {
    this.fileSearchInputFormat = format;
    console.debug('[FileSearchManager] File search inputFormat:', format);
  }

  /**
   * Get file search input format
   */
  public getFileSearchInputFormat(): InputFormatType {
    return this.fileSearchInputFormat;
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
      const electronAPI = (window as any).electronAPI;
      if (electronAPI?.mdSearch?.getMaxSuggestions) {
        const maxSuggestions = await electronAPI.mdSearch.getMaxSuggestions(type);
        this.maxSuggestionsCache.set(type, maxSuggestions);
        return maxSuggestions;
      }
    } catch (error) {
      console.error('[FileSearchManager] Failed to get maxSuggestions:', error);
    }

    return FileSearchCacheManager.DEFAULT_MAX_SUGGESTIONS;
  }

  /**
   * Clear maxSuggestions cache (call when settings might have changed)
   */
  public clearMaxSuggestionsCache(): void {
    this.maxSuggestionsCache.clear();
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
      const electronAPI = (window as any).electronAPI;
      if (electronAPI?.mdSearch?.getSearchPrefixes) {
        const prefixes = await electronAPI.mdSearch.getSearchPrefixes(type);
        this.searchPrefixesCache.set(type, prefixes);
        return prefixes;
      }
    } catch (error) {
      console.error('[FileSearchManager] Failed to get searchPrefixes:', error);
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
      console.debug('[FileSearchManager] SearchPrefixes cache preloaded');
    } catch (error) {
      console.error('[FileSearchManager] Failed to preload searchPrefixes cache:', error);
    }
  }

  /**
   * Handle cached directory data from window-shown event
   */
  public handleCachedDirectoryData(data: DirectoryInfo | undefined): void {
    if (!data || !data.directory) {
      console.debug('[FileSearchManager] No cached directory data');
      return;
    }

    // Check if this is from cache or just draft fallback
    const fromCache = data.fromCache === true;
    const fromDraft = data.fromDraft === true;

    if (fromDraft && (!data.files || data.files.length === 0)) {
      // Draft fallback with no files - just store directory for later
      console.debug('[FileSearchManager] Draft directory fallback:', data.directory);
      // Don't cache empty data, but remember the directory
      this.cachedDirectoryData = {
        directory: data.directory,
        files: [],
        timestamp: Date.now(),
        partial: false,  // Always false (single stage with fd)
        searchMode: 'recursive',  // Always recursive (fd is required)
        fromDraft: true
      };
      return;
    }

    // Cache the data with appropriate flags
    this.cachedDirectoryData = {
      directory: data.directory,
      files: data.files || [],
      timestamp: Date.now(),
      partial: false,  // Always false (single stage with fd)
      searchMode: 'recursive',  // Always recursive (fd is required)
      ...(fromCache ? { fromCache: true } : {}),
      ...(data.cacheAge !== undefined ? { cacheAge: data.cacheAge } : {}),
      ...(data.hint ? { hint: data.hint } : {}),
      ...(data.filesDisabled ? { filesDisabled: data.filesDisabled, filesDisabledReason: data.filesDisabledReason } : {})
    };

    // Show hint message in footer if present (e.g., fd not installed)
    if (data.hint && this.callbacks.updateHintText) {
      this.callbacks.updateHintText(data.hint);
      console.warn('[FileSearchManager] Hint:', data.hint);
    }

    console.debug('[FileSearchManager] handleCachedDirectoryData:', formatLog({
      directory: data.directory,
      fileCount: this.cachedDirectoryData.files.length,
      fromCache: fromCache,
      cacheAge: data.cacheAge,
      searchMode: data.searchMode,
      hint: data.hint
    }));
  }

  /**
   * Cache directory data from window-shown event (Stage 1 quick data)
   * @deprecated Use handleCachedDirectoryData instead for better cache support
   */
  public cacheDirectoryData(data: DirectoryInfo | DirectoryData): void {
    // Forward to new method for consistency
    this.handleCachedDirectoryData(data);
  }

  /**
   * Update cache with new data from directory-data-updated event (Stage 2 recursive data)
   * Only updates if we have more complete data
   */
  public updateCache(data: DirectoryInfo | DirectoryData): void {
    if (!data.directory || !data.files) {
      console.debug('[FileSearchManager] updateCache: invalid data');
      return;
    }

    // Check if this is an update to the same directory
    const isSameDirectory = this.cachedDirectoryData?.directory === data.directory;

    // Only update if:
    // 1. No existing data
    // 2. Different directory
    // 3. More complete data (recursive > quick, more files)
    const shouldUpdate = !this.cachedDirectoryData ||
      !isSameDirectory ||
      (data.searchMode === 'recursive') ||
      (data.files.length > (this.cachedDirectoryData?.files.length || 0));

    if (!shouldUpdate) {
      console.debug('[FileSearchManager] updateCache: skipping update, existing data is sufficient');
      return;
    }

    // Get hint and filesDisabled from DirectoryInfo if available
    const hint = 'hint' in data ? (data as DirectoryInfo).hint : undefined;
    const filesDisabled = 'filesDisabled' in data ? (data as DirectoryInfo).filesDisabled : undefined;
    const filesDisabledReason = 'filesDisabledReason' in data ? (data as DirectoryInfo).filesDisabledReason : undefined;

    this.cachedDirectoryData = {
      directory: data.directory,
      files: data.files,
      timestamp: Date.now(),
      partial: false,  // Always false (single stage with fd)
      searchMode: 'recursive',  // Always recursive (fd is required)
      // Cache flags (fromCache, cacheAge) are intentionally omitted for fresh data
      ...(hint ? { hint } : {}),
      ...(filesDisabled && filesDisabledReason ? { filesDisabled, filesDisabledReason } : filesDisabled ? { filesDisabled } : {})
    };

    // Show hint message in footer if present (e.g., fd not installed)
    if (hint && this.callbacks.updateHintText) {
      this.callbacks.updateHintText(hint);
      console.warn('[FileSearchManager] Hint:', hint);
    }

    console.debug('[FileSearchManager] updateCache:', formatLog({
      directory: data.directory,
      fileCount: data.files.length,
      searchMode: 'recursive',
      hint
    }));
  }

  /**
   * Clear the cached directory data
   */
  public clearCache(): void {
    this.cachedDirectoryData = null;
  }

  /**
   * Get cache status for display (e.g., in footer hint)
   */
  public getCacheStatus(): { fromCache: boolean; cacheAge?: number | undefined; directory?: string | undefined } | null {
    if (!this.cachedDirectoryData) return null;

    const status: { fromCache: boolean; cacheAge?: number | undefined; directory?: string | undefined } = {
      fromCache: this.cachedDirectoryData.fromCache || false
    };

    if (this.cachedDirectoryData.cacheAge !== undefined) {
      status.cacheAge = this.cachedDirectoryData.cacheAge;
    }

    if (this.cachedDirectoryData.directory !== undefined) {
      status.directory = this.cachedDirectoryData.directory;
    }

    return status;
  }

  /**
   * Build a set of valid paths from cached directory data
   * Returns null if no cached data is available
   */
  public buildValidPathsSet(): Set<string> | null {
    if (!this.cachedDirectoryData?.files || this.cachedDirectoryData.files.length === 0) {
      return null;
    }

    const baseDir = this.cachedDirectoryData.directory;
    const validPaths = new Set<string>();

    for (const file of this.cachedDirectoryData.files) {
      // Get relative path from base directory
      const relativePath = this.getRelativePath(file.path, baseDir);
      validPaths.add(relativePath);

      // For directories: add both with and without trailing slash
      if (file.isDirectory) {
        if (!relativePath.endsWith('/')) {
          validPaths.add(relativePath + '/');
        } else {
          validPaths.add(relativePath.slice(0, -1));
        }
      }

      // Also add parent directories
      const pathParts = relativePath.split('/');
      let parentPath = '';
      for (let i = 0; i < pathParts.length - 1; i++) {
        parentPath += (i > 0 ? '/' : '') + pathParts[i];
        validPaths.add(parentPath);
        validPaths.add(parentPath + '/');
      }
    }

    return validPaths;
  }

  /**
   * Get relative path from base directory
   * Helper method for buildValidPathsSet
   */
  private getRelativePath(absolutePath: string, baseDir: string): string {
    // Ensure both paths are normalized
    const normalizedAbsolute = absolutePath.replace(/\/+$/, '');
    const normalizedBase = baseDir.replace(/\/+$/, '');

    if (normalizedAbsolute.startsWith(normalizedBase + '/')) {
      return normalizedAbsolute.substring(normalizedBase.length + 1);
    }

    return absolutePath;
  }

  /**
   * Get the cached directory data
   */
  public getCachedDirectoryData(): DirectoryData | null {
    return this.cachedDirectoryData;
  }

  /**
   * Get the cached directory path
   */
  public getCachedDirectory(): string | null {
    return this.cachedDirectoryData?.directory || null;
  }

  /**
   * Check if index is being built (no data or draft fallback with no files)
   */
  public isIndexBeingBuilt(): boolean {
    // No cached data at all - index is being built
    if (!this.cachedDirectoryData) {
      return true;
    }

    // File search is disabled for this directory (e.g., root directory) - not building
    if (this.cachedDirectoryData.filesDisabled) {
      return false;
    }

    // Draft fallback with no files - index is being built
    if (this.cachedDirectoryData.fromDraft && this.cachedDirectoryData.files.length === 0) {
      return true;
    }

    return false;
  }

  /**
   * Check if we have any cached data
   */
  public hasCachedData(): boolean {
    return this.cachedDirectoryData !== null;
  }
}
