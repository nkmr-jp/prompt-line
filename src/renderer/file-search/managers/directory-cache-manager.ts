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

    const fromCache = data.fromCache === true;
    const fromDraft = data.fromDraft === true;

    if (fromDraft && (!data.files || data.files.length === 0)) {
      this.handleDraftFallback(data);
      return;
    }

    this.cacheDirectoryData(data, fromCache);
    this.notifyCallbacks(data, fromCache);
  }

  /**
   * Handle draft fallback with no files
   */
  private handleDraftFallback(data: DirectoryInfo): void {
    console.debug('[DirectoryCacheManager] Draft directory fallback:', data.directory);

    // data.directory is guaranteed to be defined by the caller check
    this.cachedDirectoryData = {
      directory: data.directory!,
      files: [],
      timestamp: Date.now(),
      partial: false,
      searchMode: 'recursive',
      fromDraft: true
    };

    this.callbacks.onIndexingStatusChange?.(true, data.hint);
  }

  /**
   * Cache directory data with appropriate flags
   */
  private cacheDirectoryData(data: DirectoryInfo, fromCache: boolean): void {
    // data.directory is guaranteed to be defined by the caller check
    this.cachedDirectoryData = {
      directory: data.directory!,
      files: data.files || [],
      timestamp: Date.now(),
      partial: false,
      searchMode: 'recursive',
      ...(fromCache ? { fromCache: true } : {}),
      ...(data.cacheAge !== undefined ? { cacheAge: data.cacheAge } : {}),
      ...(data.hint ? { hint: data.hint } : {}),
      ...(data.filesDisabled ? {
        filesDisabled: data.filesDisabled,
        filesDisabledReason: data.filesDisabledReason
      } : {})
    };
  }

  /**
   * Notify callbacks about cache update and indexing status
   */
  private notifyCallbacks(data: DirectoryInfo, fromCache: boolean): void {
    if (data.hint && this.callbacks.updateHintText) {
      this.callbacks.updateHintText(data.hint);
      console.warn('[DirectoryCacheManager] Hint:', data.hint);
    }

    const isBuilding = this.isIndexBeingBuilt();
    this.callbacks.onIndexingStatusChange?.(isBuilding, data.hint);

    if (this.cachedDirectoryData) {
      this.callbacks.onCacheUpdated?.(this.cachedDirectoryData);
    }

    console.debug('[DirectoryCacheManager] handleCachedDirectoryData:', formatLog({
      directory: data.directory,
      fileCount: this.cachedDirectoryData?.files.length || 0,
      fromCache,
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

    const metadata = this.extractMetadata(data);
    const isSameDirectory = this.cachedDirectoryData?.directory === data.directory;

    if (!data.files) {
      this.handleDirectoryOnlyUpdate(data.directory, isSameDirectory, metadata);
      return;
    }

    this.handleFullUpdate(data, isSameDirectory, metadata);
  }

  /**
   * Extract metadata from directory data
   */
  private extractMetadata(data: DirectoryInfo | DirectoryData): {
    hint?: string;
    filesDisabled?: boolean;
    filesDisabledReason?: string;
  } {
    const hint = 'hint' in data ? (data as DirectoryInfo).hint : undefined;
    const filesDisabled = 'filesDisabled' in data ? (data as DirectoryInfo).filesDisabled : undefined;
    const filesDisabledReason = 'filesDisabledReason' in data ? (data as DirectoryInfo).filesDisabledReason : undefined;

    // Build result object with only defined properties to satisfy exactOptionalPropertyTypes
    const result: { hint?: string; filesDisabled?: boolean; filesDisabledReason?: string } = {};
    if (hint !== undefined) {
      result.hint = hint;
    }
    if (filesDisabled !== undefined) {
      result.filesDisabled = filesDisabled;
    }
    if (filesDisabledReason !== undefined) {
      result.filesDisabledReason = filesDisabledReason;
    }

    return result;
  }

  /**
   * Handle directory-only update (no files)
   */
  private handleDirectoryOnlyUpdate(
    directory: string,
    isSameDirectory: boolean,
    metadata: { hint?: string; filesDisabled?: boolean; filesDisabledReason?: string }
  ): void {
    if (isSameDirectory) {
      console.debug('[DirectoryCacheManager] updateCache: skipping directory-only update (same directory)');
      return;
    }

    console.debug('[DirectoryCacheManager] updateCache: directory-only update (directory changed)', {
      from: this.cachedDirectoryData?.directory,
      to: directory
    });

    this.cachedDirectoryData = {
      directory,
      files: [],
      timestamp: Date.now(),
      partial: false,
      searchMode: 'recursive',
      ...this.buildMetadataObject(metadata)
    };

    this.showHintIfPresent(metadata.hint);
    this.callbacks.onCacheUpdated?.(this.cachedDirectoryData);
  }

  /**
   * Handle full update with files
   */
  private handleFullUpdate(
    data: DirectoryInfo | DirectoryData,
    isSameDirectory: boolean,
    metadata: { hint?: string; filesDisabled?: boolean; filesDisabledReason?: string }
  ): void {
    if (!this.shouldUpdateCache(data, isSameDirectory)) {
      console.debug('[DirectoryCacheManager] updateCache: skipping update, existing data is sufficient');
      return;
    }

    // data.directory is guaranteed to be defined by the caller check in updateCache
    this.cachedDirectoryData = {
      directory: data.directory!,
      files: data.files!,
      timestamp: Date.now(),
      partial: false,
      searchMode: 'recursive',
      ...this.buildMetadataObject(metadata)
    };

    this.showHintIfPresent(metadata.hint);
    this.callbacks.onIndexingStatusChange?.(false, metadata.hint);
    if (this.cachedDirectoryData) {
      this.callbacks.onCacheUpdated?.(this.cachedDirectoryData);
    }

    console.debug('[DirectoryCacheManager] updateCache:', formatLog({
      directory: data.directory,
      fileCount: data.files!.length,
      searchMode: 'recursive',
      hint: metadata.hint
    }));
  }

  /**
   * Determine if cache should be updated
   */
  private shouldUpdateCache(
    data: DirectoryInfo | DirectoryData,
    isSameDirectory: boolean
  ): boolean {
    return !this.cachedDirectoryData ||
      !isSameDirectory ||
      data.searchMode === 'recursive' ||
      (data.files!.length > (this.cachedDirectoryData?.files.length || 0));
  }

  /**
   * Build metadata object for cache data
   */
  private buildMetadataObject(metadata: {
    hint?: string;
    filesDisabled?: boolean;
    filesDisabledReason?: string;
  }): Record<string, unknown> {
    return {
      ...(metadata.hint ? { hint: metadata.hint } : {}),
      ...(metadata.filesDisabled && metadata.filesDisabledReason ? {
        filesDisabled: metadata.filesDisabled,
        filesDisabledReason: metadata.filesDisabledReason
      } : metadata.filesDisabled ? { filesDisabled: metadata.filesDisabled } : {})
    };
  }

  /**
   * Show hint message if present
   */
  private showHintIfPresent(hint?: string): void {
    if (hint && this.callbacks.updateHintText) {
      this.callbacks.updateHintText(hint);
      console.warn('[DirectoryCacheManager] Hint:', hint);
    }
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
