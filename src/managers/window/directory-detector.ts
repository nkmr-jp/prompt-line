import type { BrowserWindow } from 'electron';
import { logger } from '../../utils/utils';
import FileCacheManager from '../file-cache-manager';
import type DirectoryManager from '../directory-manager';
import type { AppInfo, DirectoryInfo, FileSearchSettings } from '../../types';
import type { IDirectoryDetectionStrategy } from './strategies';
import { NativeDetectorStrategy } from './strategies';
import { DirectoryDetectorUtils } from './directory-detector-utils';
import { DirectoryCacheHelper } from './directory-cache-helper';

/**
 * DirectoryDetector orchestrates directory detection and file caching
 *
 * Responsibilities:
 * - Delegate directory detection to strategy (Strategy Pattern)
 * - Manage file caching for detected directories
 * - Handle file search disabled directories (root, system directories)
 * - Orchestrate background directory detection with window updates
 *
 * Integration:
 * - Uses IDirectoryDetectionStrategy for platform-specific detection
 * - Uses FileCacheManager for caching file lists
 * - Requires DirectoryManager reference for fallback behavior
 * - Sends updates to renderer via BrowserWindow.webContents
 */
class DirectoryDetector {
  private fileSearchSettings: FileSearchSettings | null = null;
  private directoryManager: DirectoryManager | null = null;
  private savedDirectory: string | null = null;
  private fdCommandAvailable: boolean = true;
  private fdCommandChecked: boolean = false;
  private previousApp: AppInfo | string | null = null;
  private strategy: IDirectoryDetectionStrategy;
  private cacheHelper: DirectoryCacheHelper;

  constructor(fileCacheManager: FileCacheManager | null) {
    this.cacheHelper = new DirectoryCacheHelper(fileCacheManager);
    // Initialize with native detector strategy
    this.strategy = new NativeDetectorStrategy();
  }

  /**
   * Set DirectoryManager reference for directory fallback feature
   */
  setDirectoryManager(directoryManager: DirectoryManager): void {
    this.directoryManager = directoryManager;
    logger.debug('DirectoryManager reference set in DirectoryDetector');
  }

  /**
   * Update file search settings
   */
  updateFileSearchSettings(settings: FileSearchSettings | null | undefined): void {
    this.fileSearchSettings = settings ?? null;
    logger.debug('File search settings updated in DirectoryDetector', {
      enabled: settings !== null && settings !== undefined,
      settings
    });
  }

  /**
   * Update saved directory from DirectoryManager
   */
  updateSavedDirectory(directory: string | null): void {
    this.savedDirectory = directory;
    logger.debug('Saved directory updated in DirectoryDetector:', { savedDirectory: directory });
  }

  /**
   * Check if file search is enabled based on settings
   * Returns true only if file search settings have been configured
   */
  isEnabled(): boolean {
    return this.fileSearchSettings !== null;
  }

  /**
   * Update previous app info for directory detection
   */
  updatePreviousApp(app: AppInfo | string | null): void {
    this.previousApp = app;
  }

  /**
   * Get current saved directory
   */
  getSavedDirectory(): string | null {
    return this.savedDirectory;
  }

  /**
   * Check if fd command is available on the system (only once)
   */
  async checkFdCommandAvailability(): Promise<void> {
    // Only check once
    if (this.fdCommandChecked) {
      return;
    }
    this.fdCommandChecked = true;

    this.fdCommandAvailable = DirectoryDetectorUtils.checkFdCommandAvailability(
      this.fileSearchSettings?.fdPath ?? undefined
    );
  }

  /**
   * Check if fd command is available
   */
  isFdCommandAvailable(): boolean {
    return this.fdCommandAvailable;
  }

  /**
   * Check if a directory should have file search disabled
   * Root directory (/) and root-owned system directories are excluded for security
   * This is a pre-check before calling directory-detector; the Swift tool also checks ownership
   */
  isFileSearchDisabledDirectory(directory: string): boolean {
    return DirectoryDetectorUtils.isFileSearchDisabledDirectory(directory);
  }

  /**
   * Load cached files for window show - provides instant file search availability
   * Priority: savedDirectory cache > lastUsedDirectory cache
   */
  async loadCachedFilesForWindow(): Promise<DirectoryInfo | null> {
    return this.cacheHelper.loadCachedFilesForWindow(this.savedDirectory);
  }

  /**
   * Set detection strategy (for testing or platform-specific implementations)
   */
  setStrategy(strategy: IDirectoryDetectionStrategy): void {
    this.strategy = strategy;
    logger.debug(`Detection strategy changed to: ${strategy.getName()}`);
  }

  /**
   * Execute directory detection using the current strategy
   * @param timeout Timeout in milliseconds
   * @returns DirectoryInfo or null on error
   */
  async executeDirectoryDetector(
    timeout: number
  ): Promise<DirectoryInfo | null> {
    if (!this.strategy.isAvailable()) {
      logger.debug(`Strategy ${this.strategy.getName()} is not available on this platform`);
      return null;
    }

    return this.strategy.detect(timeout, this.previousApp, this.fileSearchSettings);
  }

  /**
   * Execute directory detection in background (single stage with fd)
   * This ensures window shows immediately without waiting for directory detection
   *
   * Draft Directory Fallback Logic:
   * - If detection succeeds: update draft directory and send result with directoryChanged flag
   * - If detection fails: keep using draft directory (do nothing)
   * - directoryChanged flag is true when detected directory differs from saved draft directory
   *
   * Cache Integration:
   * - Background detection always runs to catch file changes
   * - If files changed, update cache and notify renderer
   * - If no changes, just update cache timestamp (no renderer notification)
   */
  async executeBackgroundDirectoryDetection(inputWindow: BrowserWindow | null): Promise<void> {
    try {
      const startTime = performance.now();
      logger.debug('🔄 Starting background directory detection...', {
        savedDirectory: this.savedDirectory
      });

      // Single stage directory detection with fd (5 second timeout)
      const result = await this.executeDirectoryDetector(5000);

      if (result && result.directory && inputWindow && !inputWindow.isDestroyed()) {
        // Detection succeeded - check if directory changed from draft
        const detectedDirectory = result.directory;
        const directoryChanged = this.savedDirectory !== null && detectedDirectory !== this.savedDirectory;

        // Handle cache operations
        const isFileSearchDisabled = this.isFileSearchDisabledDirectory(detectedDirectory) || (result.filesDisabled ?? false);
        const hasChanges = await this.cacheHelper.handleBackgroundCacheUpdate(
          detectedDirectory,
          result.files,
          isFileSearchDisabled
        );

        // Update directory manager with detected directory (detection succeeded)
        if (this.directoryManager) {
          this.directoryManager.setDirectory(detectedDirectory);
          this.savedDirectory = detectedDirectory; // Update local reference
        }

        // Notify renderer if there are changes, directory changed, or hint exists
        // hint needs to be sent even without file changes (e.g., fd not installed)
        if (hasChanges || directoryChanged || result.hint) {
          // Add directoryChanged flag to result
          const resultWithFlags: DirectoryInfo = {
            ...result,
            directoryChanged
          };
          // Only add previousDirectory if directory actually changed
          if (directoryChanged && this.savedDirectory !== null && this.savedDirectory !== detectedDirectory) {
            resultWithFlags.previousDirectory = this.savedDirectory;
          }

          inputWindow.webContents.send('directory-data-updated', resultWithFlags);
          logger.debug(`✅ Directory detection completed in ${(performance.now() - startTime).toFixed(2)}ms`, {
            directory: detectedDirectory,
            fileCount: result.fileCount,
            directoryChanged,
            hasChanges,
            hint: result.hint
          });
        } else {
          logger.debug(`✅ Directory detection completed, no changes detected, skipping renderer notification`, {
            directory: detectedDirectory,
            fileCount: result.fileCount
          });
        }
      } else {
        // Detection failed (likely timeout) - keep using draft directory (fallback)
        // Notify renderer about timeout so it can show hint
        logger.debug('Background directory detection: no result or window not available, keeping draft directory', {
          savedDirectory: this.savedDirectory
        });

        // Send timeout notification to renderer if window is available
        if (inputWindow && !inputWindow.isDestroyed()) {
          const timeoutInfo: DirectoryInfo = {
            success: false,
            detectionTimedOut: true
          };
          if (this.savedDirectory) {
            timeoutInfo.directory = this.savedDirectory;
          }
          inputWindow.webContents.send('directory-data-updated', timeoutInfo);
        }
      }

      logger.debug(`🏁 Total background directory detection time: ${(performance.now() - startTime).toFixed(2)}ms`);
    } catch (error) {
      logger.warn('Background directory detection failed:', error);
      // Detection failed - keep using draft directory (fallback)
      // Notify renderer about failure
      if (inputWindow && !inputWindow.isDestroyed()) {
        const errorInfo: DirectoryInfo = {
          success: false,
          detectionTimedOut: true
        };
        if (this.savedDirectory) {
          errorInfo.directory = this.savedDirectory;
        }
        inputWindow.webContents.send('directory-data-updated', errorInfo);
      }
    }
  }

}

export default DirectoryDetector;
