import { logger } from '../../utils/utils';
import type FileCacheManager from '../file-cache-manager';
import type { FileInfo } from '../../types';
import { hasFileListChanges } from './directory-info-builder';

/**
 * Cache operations for DirectoryDetector
 */
export class CacheOperations {
  constructor(private fileCacheManager: FileCacheManager | null) {}

  /**
   * Update cache for detected directory
   * @returns true if cache was updated with changes, false otherwise
   */
  async updateCacheForDirectory(
    detectedDirectory: string,
    files: FileInfo[] | undefined,
    isFileSearchDisabled: boolean
  ): Promise<boolean> {
    if (isFileSearchDisabled) {
      await this.clearCacheForDirectory(detectedDirectory);
      return false;
    }

    if (this.fileCacheManager && files) {
      return await this.updateOrCreateCache(detectedDirectory, files);
    }

    return true;
  }

  /**
   * Clear cache for directory
   */
  private async clearCacheForDirectory(detectedDirectory: string): Promise<void> {
    if (this.fileCacheManager) {
      try {
        await this.fileCacheManager.clearCache(detectedDirectory);
        logger.debug(`Cleared cache for ${detectedDirectory} (file search disabled)`);
      } catch {
        // Cache may not exist, ignore errors
      }
    }
    logger.debug(`Skipping cache for ${detectedDirectory} (file search disabled)`);
  }

  /**
   * Update or create cache
   */
  private async updateOrCreateCache(detectedDirectory: string, files: FileInfo[]): Promise<boolean> {
    if (!this.fileCacheManager) return false;

    const existingCache = await this.fileCacheManager.loadCache(detectedDirectory);
    const hasChanges = existingCache ? hasFileListChanges(existingCache.files, files) : true;

    await this.fileCacheManager.setLastUsedDirectory(detectedDirectory);

    if (hasChanges) {
      await this.fileCacheManager.saveCache(detectedDirectory, files, { searchMode: 'recursive' });
      logger.debug(`Cache updated for ${detectedDirectory}, ${files.length} files`);
    } else {
      await this.fileCacheManager.updateCacheTimestamp(detectedDirectory);
      logger.debug(`Cache timestamp updated for ${detectedDirectory}, no file changes`);
    }

    return hasChanges;
  }
}
