import type { BrowserWindow } from 'electron';
import { logger } from '../../utils/utils';
import type DirectoryManager from '../directory-manager';
import type { DirectoryInfo } from '../../types';
import { createTimeoutDirectoryInfo, createDirectoryInfoWithFlags } from './directory-info-builder';
import { CacheOperations } from './cache-operations';

/**
 * Handle background directory detection and notification
 */
export class BackgroundDetectionHandler {
  constructor(
    private cacheOperations: CacheOperations,
    private directoryManager: DirectoryManager | null,
    private isFileSearchDisabledDirectory: (dir: string) => boolean
  ) {}

  private savedDirectory: string | null = null;

  /**
   * Update saved directory reference
   */
  updateSavedDirectory(directory: string | null): void {
    this.savedDirectory = directory;
  }

  /**
   * Handle successful directory detection
   */
  async handleSuccessfulDetection(
    result: DirectoryInfo,
    inputWindow: BrowserWindow,
    startTime: number
  ): Promise<void> {
    const detectedDirectory = result.directory!;
    const directoryChanged = this.savedDirectory !== null && detectedDirectory !== this.savedDirectory;

    const hasChanges = await this.updateCacheForDirectory(result, detectedDirectory);
    this.updateDirectoryManager(detectedDirectory);

    const shouldNotify = hasChanges || directoryChanged || result.hint;
    if (shouldNotify) {
      this.notifyRendererWithChanges(result, directoryChanged, inputWindow, startTime, hasChanges);
    } else {
      this.logNoChanges(detectedDirectory, result.fileCount);
    }
  }

  /**
   * Handle failed detection
   */
  handleFailedDetection(inputWindow: BrowserWindow | null): void {
    logger.debug('Background directory detection: no result or window not available, keeping draft directory', {
      savedDirectory: this.savedDirectory
    });

    if (inputWindow && !inputWindow.isDestroyed()) {
      const timeoutInfo = createTimeoutDirectoryInfo(this.savedDirectory);
      inputWindow.webContents.send('directory-data-updated', timeoutInfo);
    }
  }

  /**
   * Notify renderer about detection error
   */
  notifyDetectionError(inputWindow: BrowserWindow | null): void {
    if (inputWindow && !inputWindow.isDestroyed()) {
      const errorInfo = createTimeoutDirectoryInfo(this.savedDirectory);
      inputWindow.webContents.send('directory-data-updated', errorInfo);
    }
  }

  /**
   * Update cache for detected directory
   */
  private async updateCacheForDirectory(result: DirectoryInfo, detectedDirectory: string): Promise<boolean> {
    const isFileSearchDisabled = this.isFileSearchDisabledDirectory(detectedDirectory) || Boolean(result.filesDisabled);
    return await this.cacheOperations.updateCacheForDirectory(detectedDirectory, result.files, isFileSearchDisabled);
  }

  /**
   * Update directory manager
   */
  private updateDirectoryManager(detectedDirectory: string): void {
    if (this.directoryManager) {
      this.directoryManager.setDirectory(detectedDirectory);
      this.savedDirectory = detectedDirectory;
    }
  }

  /**
   * Notify renderer with changes
   */
  private notifyRendererWithChanges(
    result: DirectoryInfo,
    directoryChanged: boolean,
    inputWindow: BrowserWindow,
    startTime: number,
    hasChanges: boolean
  ): void {
    const resultWithFlags = createDirectoryInfoWithFlags(result, directoryChanged, this.savedDirectory);

    inputWindow.webContents.send('directory-data-updated', resultWithFlags);
    logger.debug(`✅ Directory detection completed in ${(performance.now() - startTime).toFixed(2)}ms`, {
      directory: result.directory,
      fileCount: result.fileCount,
      directoryChanged,
      hasChanges,
      hint: result.hint
    });
  }

  /**
   * Log no changes detected
   */
  private logNoChanges(detectedDirectory: string, fileCount: number | undefined): void {
    logger.debug(`✅ Directory detection completed, no changes detected, skipping renderer notification`, {
      directory: detectedDirectory,
      fileCount
    });
  }
}
