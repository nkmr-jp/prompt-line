import { logger } from '../../utils/utils';
import type { WindowData, AppInfo } from '../../types';
import type DirectoryDetector from './directory-detector';

/**
 * WindowDataPreparer prepares window data with directory information
 * Extracted from WindowManager to reduce file complexity
 */
export class WindowDataPreparer {
  private directoryDetector: DirectoryDetector;

  constructor(directoryDetector: DirectoryDetector) {
    this.directoryDetector = directoryDetector;
  }

  /**
   * Prepare window data with directory information
   */
  async prepareWindowData(
    data: WindowData,
    previousApp: AppInfo | string | null,
    currentSpaceInfo: any
  ): Promise<WindowData> {
    const savedDirectory = this.directoryDetector.getSavedDirectory();
    this.directoryDetector.updateSavedDirectory(savedDirectory);

    const windowData: WindowData = {
      sourceApp: previousApp,
      currentSpaceInfo,
      fileSearchEnabled: this.directoryDetector.isEnabled(),
      ...data
    };

    if (this.directoryDetector.isEnabled()) {
      await this.prepareDirectoryData(windowData, savedDirectory);
    }

    return windowData;
  }

  /**
   * Prepare directory data for file search
   * @private
   */
  private async prepareDirectoryData(windowData: WindowData, savedDirectory: string | null): Promise<void> {
    await this.directoryDetector.checkFdCommandAvailability();

    const cachedData = await this.directoryDetector.loadCachedFilesForWindow();
    if (cachedData) {
      this.applyCachedDirectoryData(windowData, cachedData);
    } else if (savedDirectory) {
      this.applyFallbackDirectoryData(windowData, savedDirectory);
    }

    this.addFdHintIfNeeded(windowData);
  }

  /**
   * Apply cached directory data to window data
   * @private
   */
  private applyCachedDirectoryData(windowData: WindowData, cachedData: any): void {
    windowData.directoryData = cachedData;
    logger.debug('Loaded cached directory data', {
      directory: cachedData.directory,
      fileCount: cachedData.fileCount,
      fromCache: cachedData.fromCache
    });
  }

  /**
   * Apply fallback directory data
   * @private
   */
  private applyFallbackDirectoryData(windowData: WindowData, savedDirectory: string): void {
    const isRootDirectory = this.directoryDetector.isFileSearchDisabledDirectory(savedDirectory);
    windowData.directoryData = {
      success: true,
      directory: savedDirectory,
      files: [],
      fileCount: 0,
      partial: false,
      searchMode: 'recursive',
      fromDraft: true,
      ...(isRootDirectory ? {
        filesDisabled: true,
        filesDisabledReason: 'File search is disabled for root directory'
      } : {})
    };
  }

  /**
   * Add fd hint if command is not available
   * @private
   */
  private addFdHintIfNeeded(windowData: WindowData): void {
    if (!this.directoryDetector.isFdCommandAvailable()) {
      if (!windowData.directoryData) {
        windowData.directoryData = { success: false };
      }
      windowData.directoryData.hint = 'Install fd for file search: brew install fd';
      logger.debug('Added fd not available hint to directoryData');
    }
  }
}

export default WindowDataPreparer;
