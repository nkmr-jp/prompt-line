/**
 * Directory Cache Manager - Manages directory file data caching for file search
 *
 * Responsibilities:
 * - Cache directory data from window-shown and directory-data-updated events
 * - Track indexing status (building/ready)
 * - Notify parent of cache updates and indexing status changes
 *
 * This manager handles caching only. It does NOT:
 * - Update UI directly (uses callbacks for notifications)
 * - Manage suggestions display
 * - Handle file search logic
 */

import type { DirectoryData, FileInfo } from '../types';
import type { DirectoryInfo } from '../../types';
import { formatLog } from '../types';

/**
 * Callbacks for directory cache events
 */
export interface DirectoryCacheCallbacks {
  /**
   * Called when indexing status changes
   * @param isBuilding - true if index is being built, false if ready
   * @param hint - Optional hint message (e.g., "Install fd: brew install fd")
   */
  onIndexingStatusChange?: (isBuilding: boolean, hint?: string) => void;

  /**
   * Called when cache is updated with new data
   * @param data - Updated directory data
   */
  onCacheUpdated?: (data: DirectoryData) => void;

  /**
   * Update hint text in footer
   * @param text - Hint text to display
   */
  updateHintText?: (text: string) => void;
}

/**
 * Directory Cache Manager
 * Manages caching of directory file data for file search
 */
export class DirectoryCacheManager {
  private cachedDirectoryData: DirectoryData | null = null;
  private callbacks: DirectoryCacheCallbacks;

  constructor(callbacks: DirectoryCacheCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Handle cached directory data from window-shown event
   * This enables instant file search when window opens
   */
  public handleCachedDirectoryData(data: DirectoryInfo | undefined): void {
    if (!data || !data.directory) {
      console.debug('[DirectoryCacheManager] No cached directory data');
      return;
    }

    // Check if this is from cache or just draft fallback
    const fromCache = data.fromCache === true;
    const fromDraft = data.fromDraft === true;

    if (fromDraft && (!data.files || data.files.length === 0)) {
      // Draft fallback with no files - just store directory for later
      console.debug('[DirectoryCacheManager] Draft directory fallback:', data.directory);
      // Don't cache empty data, but remember the directory
      this.cachedDirectoryData = {
        directory: data.directory,
        files: [],
        timestamp: Date.now(),
        partial: false,  // Always false (single stage with fd)
        searchMode: 'recursive',  // Always recursive (fd is required)
        fromDraft: true
      };

      // Notify indexing status change (building)
      if (this.callbacks.onIndexingStatusChange) {
        this.callbacks.onIndexingStatusChange(true, data.hint);
      }
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
      console.warn('[DirectoryCacheManager] Hint:', data.hint);
    }

    // Notify indexing status change (ready or still building)
    const isBuilding = this.isIndexBeingBuilt();
    if (this.callbacks.onIndexingStatusChange) {
      this.callbacks.onIndexingStatusChange(isBuilding, data.hint);
    }

    // Notify cache update
    if (this.callbacks.onCacheUpdated) {
      this.callbacks.onCacheUpdated(this.cachedDirectoryData);
    }

    console.debug('[DirectoryCacheManager] handleCachedDirectoryData:', formatLog({
      directory: data.directory,
      fileCount: this.cachedDirectoryData.files.length,
      fromCache: fromCache,
      cacheAge: data.cacheAge,
      searchMode: data.searchMode,
      hint: data.hint
    }));
  }

  /**
   * Update cache with new data from directory-data-updated event (Stage 2 recursive data)
   * Handles both full updates (with files) and directory-only updates (for code search)
   */
  public updateCache(data: DirectoryInfo | DirectoryData): void {
    if (!data.directory) {
      console.debug('[DirectoryCacheManager] updateCache: no directory in data');
      return;
    }

    // Get hint and filesDisabled from DirectoryInfo if available
    const hint = 'hint' in data ? (data as DirectoryInfo).hint : undefined;
    const filesDisabled = 'filesDisabled' in data ? (data as DirectoryInfo).filesDisabled : undefined;
    const filesDisabledReason = 'filesDisabledReason' in data ? (data as DirectoryInfo).filesDisabledReason : undefined;

    // Check if this is an update to the same directory
    const isSameDirectory = this.cachedDirectoryData?.directory === data.directory;

    // Handle directory-only updates (no files - e.g., file listing failed)
    // This is important for code search which only needs the directory
    if (!data.files) {
      // For directory-only updates, only update if directory changed
      if (!isSameDirectory) {
        console.debug('[DirectoryCacheManager] updateCache: directory-only update (directory changed)', {
          from: this.cachedDirectoryData?.directory,
          to: data.directory
        });
        this.cachedDirectoryData = {
          directory: data.directory,
          files: [],  // Empty files - code search will work, file search won't
          timestamp: Date.now(),
          partial: false,
          searchMode: 'recursive',
          ...(hint ? { hint } : {}),
          ...(filesDisabled && filesDisabledReason ? { filesDisabled, filesDisabledReason } : filesDisabled ? { filesDisabled } : {})
        };

        // Show hint message if present
        if (hint && this.callbacks.updateHintText) {
          this.callbacks.updateHintText(hint);
          console.warn('[DirectoryCacheManager] Hint:', hint);
        }

        // Notify cache update
        if (this.callbacks.onCacheUpdated) {
          this.callbacks.onCacheUpdated(this.cachedDirectoryData);
        }
      } else {
        console.debug('[DirectoryCacheManager] updateCache: skipping directory-only update (same directory)');
      }
      return;
    }

    // Full update with files - only update if we have more complete data
    const shouldUpdate = !this.cachedDirectoryData ||
      !isSameDirectory ||
      (data.searchMode === 'recursive') ||
      (data.files.length > (this.cachedDirectoryData?.files.length || 0));

    if (!shouldUpdate) {
      console.debug('[DirectoryCacheManager] updateCache: skipping update, existing data is sufficient');
      return;
    }

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
      console.warn('[DirectoryCacheManager] Hint:', hint);
    }

    // Notify indexing status change (ready)
    if (this.callbacks.onIndexingStatusChange) {
      this.callbacks.onIndexingStatusChange(false, hint);
    }

    // Notify cache update
    if (this.callbacks.onCacheUpdated) {
      this.callbacks.onCacheUpdated(this.cachedDirectoryData);
    }

    console.debug('[DirectoryCacheManager] updateCache:', formatLog({
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
  public getCacheStatus(): { directory: string; fileCount: number; timestamp: number } | null {
    if (!this.cachedDirectoryData) return null;

    return {
      directory: this.cachedDirectoryData.directory,
      fileCount: this.cachedDirectoryData.files.length,
      timestamp: this.cachedDirectoryData.timestamp
    };
  }

  /**
   * Check if file index is being built
   * Returns true if directory data is not yet available or is from draft fallback with no files
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
   * Get all cached files
   */
  public getFiles(): FileInfo[] {
    return this.cachedDirectoryData?.files || [];
  }

  /**
   * Get cached directory path
   */
  public getDirectory(): string | null {
    return this.cachedDirectoryData?.directory || null;
  }

  /**
   * Check if cache has data
   */
  public hasCache(): boolean {
    return this.cachedDirectoryData !== null;
  }

  /**
   * Get full cached data
   */
  public getCachedData(): DirectoryData | null {
    return this.cachedDirectoryData;
  }
}
