import { logger } from '../../utils/utils';
import FileCacheManager from '../file-cache-manager';
import type { DirectoryInfo, FileInfo } from '../../types';
import { DirectoryDetectorUtils } from './directory-detector-utils';

/**
 * Helper class for DirectoryDetector cache operations
 * Handles loading cached files for window initialization
 */
export class DirectoryCacheHelper {
  constructor(private fileCacheManager: FileCacheManager | null) {}

  /**
   * Load cached files for window show - provides instant file search availability
   * Priority: savedDirectory cache > lastUsedDirectory cache
   */
  async loadCachedFilesForWindow(savedDirectory: string | null): Promise<DirectoryInfo | null> {
    if (!this.fileCacheManager) return null;

    try {
      // Priority 1: Try to load cache for savedDirectory (from DirectoryManager)
      if (savedDirectory) {
        const result = await this.loadCacheForDirectory(savedDirectory);
        if (result) return result;
      }

      // Priority 2: Try to load cache for lastUsedDirectory
      const lastUsedDir = await this.fileCacheManager.getLastUsedDirectory();
      if (lastUsedDir && lastUsedDir !== savedDirectory) {
        return await this.loadCacheForDirectory(lastUsedDir);
      }

      return null;
    } catch (error) {
      logger.error('Failed to load cached files:', error);
      return null;
    }
  }

  /**
   * Load cache for a specific directory
   */
  private async loadCacheForDirectory(directory: string): Promise<DirectoryInfo | null> {
    if (!this.fileCacheManager) return null;

    // Check if this directory has file search disabled
    if (DirectoryDetectorUtils.isFileSearchDisabledDirectory(directory)) {
      return {
        success: true,
        directory,
        files: [],
        fileCount: 0,
        partial: false,
        fromCache: true,
        searchMode: 'recursive',
        filesDisabled: true,
        filesDisabledReason: 'File search is disabled for root directory'
      };
    }

    // Load cache with refreshed mtimes for accurate mtime-based scoring
    const cached = await this.fileCacheManager.loadCache(directory, { refreshMtimes: true });
    if (cached && this.fileCacheManager.isCacheValid(cached.metadata)) {
      return {
        success: true,
        directory: cached.directory,
        files: cached.files,
        fileCount: cached.files.length,
        partial: false,
        fromCache: true,
        cacheAge: Date.now() - new Date(cached.metadata.updatedAt).getTime(),
        searchMode: 'recursive'
      };
    }

    return null;
  }

  /**
   * Update cache with new file list or timestamp
   */
  async updateCache(
    directory: string,
    files: FileInfo[],
    existingFiles?: FileInfo[]
  ): Promise<boolean> {
    if (!this.fileCacheManager) return false;

    const hasChanges = DirectoryDetectorUtils.hasFileListChanges(existingFiles, files);

    if (hasChanges) {
      await this.fileCacheManager.saveCache(
        directory,
        files,
        { searchMode: 'recursive' }
      );
    } else {
      await this.fileCacheManager.updateCacheTimestamp(directory);
    }

    return hasChanges;
  }

  /**
   * Clear cache for a directory
   */
  async clearCache(directory: string): Promise<void> {
    if (!this.fileCacheManager) return;

    try {
      await this.fileCacheManager.clearCache(directory);
    } catch {
      // Cache may not exist, ignore errors
    }
  }

  /**
   * Set last used directory
   */
  async setLastUsedDirectory(directory: string): Promise<void> {
    if (!this.fileCacheManager) return;
    await this.fileCacheManager.setLastUsedDirectory(directory);
  }

  /**
   * Handle cache operations for background directory detection
   * @returns true if files changed, false if no changes
   */
  async handleBackgroundCacheUpdate(
    detectedDirectory: string,
    files: FileInfo[] | undefined,
    isFileSearchDisabled: boolean
  ): Promise<boolean> {
    if (!this.fileCacheManager) return true;

    // Skip cache operations for directories with file search disabled
    if (isFileSearchDisabled) {
      await this.clearCache(detectedDirectory);
      return false;
    }

    if (!files) return true;

    // Check if file list has changed compared to cache
    const existingCache = await this.fileCacheManager.loadCache(detectedDirectory);
    const hasChanges = DirectoryDetectorUtils.hasFileListChanges(
      existingCache?.files,
      files
    );

    // Update lastUsedDirectory
    await this.setLastUsedDirectory(detectedDirectory);

    // Update cache
    await this.updateCache(detectedDirectory, files, existingCache?.files);

    return hasChanges;
  }
}
