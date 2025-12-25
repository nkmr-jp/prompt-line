import { logger } from '../../utils/utils';
import type FileCacheManager from '../file-cache-manager';
import type { DirectoryInfo } from '../../types';
import { createDisabledDirectoryInfo, createCachedDirectoryInfo } from './directory-info-builder';
import { isFileSearchDisabledDirectory } from './directory-security';

/**
 * Cache loading operations for DirectoryDetector
 */
export class CacheLoader {
  constructor(private fileCacheManager: FileCacheManager | null) {}

  /**
   * Load cached files for window show - provides instant file search availability
   * Priority: savedDirectory cache > lastUsedDirectory cache
   */
  async loadCachedFilesForWindow(savedDirectory: string | null): Promise<DirectoryInfo | null> {
    if (!this.fileCacheManager) return null;

    try {
      // Priority 1: Try savedDirectory
      const savedDirResult = await this.loadCacheForDirectory(savedDirectory);
      if (savedDirResult) return savedDirResult;

      // Priority 2: Try lastUsedDirectory
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
   * Load cache for specific directory
   */
  private async loadCacheForDirectory(directory: string | null): Promise<DirectoryInfo | null> {
    if (!directory || !this.fileCacheManager) return null;

    if (isFileSearchDisabledDirectory(directory)) {
      return createDisabledDirectoryInfo(directory);
    }

    const cached = await this.fileCacheManager.loadCache(directory);
    if (cached && this.fileCacheManager.isCacheValid(cached.metadata)) {
      return createCachedDirectoryInfo(cached);
    }

    return null;
  }
}
