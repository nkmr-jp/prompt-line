import type { BrowserWindow } from 'electron';
import { logger } from '../../utils/utils';
import FileCacheManager from '../file-cache-manager';
import type DirectoryManager from '../directory-manager';
import type { AppInfo, DirectoryInfo, FileSearchSettings } from '../../types';
import { FdAvailabilityChecker } from './fd-availability-checker';
import { DetectionExecutor } from './detection-executor';
import { BackgroundDetectionHandler } from './background-detection-handler';
import { CacheOperations } from './cache-operations';
import { CacheLoader } from './cache-loader';
import { isFileSearchDisabledDirectory } from './directory-security';

/**
 * DirectoryDetector handles directory detection and file search logic
 *
 * Core responsibilities:
 * - Execute native directory-detector tool with fd integration
 * - Check fd command availability on system
 * - Manage file caching for detected directories
 * - Handle file search disabled directories (root, system directories)
 * - Orchestrate background directory detection with window updates
 *
 * Integration:
 * - Uses FileCacheManager for caching file lists
 * - Requires DirectoryManager reference for fallback behavior
 * - Sends updates to renderer via BrowserWindow.webContents
 */
class DirectoryDetector {
  private fileSearchSettings: FileSearchSettings | null = null;
  private savedDirectory: string | null = null;
  private previousApp: AppInfo | string | null = null;

  // Helper instances
  private fdAvailabilityChecker = new FdAvailabilityChecker();
  private detectionExecutor: DetectionExecutor;
  private cacheOperations: CacheOperations;
  private cacheLoader: CacheLoader;
  private backgroundHandler: BackgroundDetectionHandler;

  constructor(fileCacheManager: FileCacheManager | null) {
    this.cacheOperations = new CacheOperations(fileCacheManager);
    this.cacheLoader = new CacheLoader(fileCacheManager);
    this.detectionExecutor = new DetectionExecutor(null, null);
    this.backgroundHandler = new BackgroundDetectionHandler(
      this.cacheOperations,
      null,
      isFileSearchDisabledDirectory
    );
  }

  /**
   * Set DirectoryManager reference for directory fallback feature
   */
  setDirectoryManager(directoryManager: DirectoryManager): void {
    this.backgroundHandler = new BackgroundDetectionHandler(
      this.cacheOperations,
      directoryManager,
      isFileSearchDisabledDirectory
    );
    logger.debug('DirectoryManager reference set in DirectoryDetector');
  }

  /**
   * Update file search settings
   */
  updateFileSearchSettings(settings: FileSearchSettings | null | undefined): void {
    this.fileSearchSettings = settings ?? null;
    this.detectionExecutor = new DetectionExecutor(this.previousApp, this.fileSearchSettings);
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
    this.backgroundHandler.updateSavedDirectory(directory);
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
    this.detectionExecutor.updatePreviousApp(app);
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
    await this.fdAvailabilityChecker.check(this.fileSearchSettings);
  }

  /**
   * Check if fd command is available
   */
  isFdCommandAvailable(): boolean {
    return this.fdAvailabilityChecker.isAvailable();
  }

  /**
   * Check if a directory should have file search disabled
   * Root directory (/) and root-owned system directories are excluded for security
   * This is a pre-check before calling directory-detector; the Swift tool also checks ownership
   */
  isFileSearchDisabledDirectory(directory: string): boolean {
    return isFileSearchDisabledDirectory(directory);
  }

  /**
   * Load cached files for window show - provides instant file search availability
   * Priority: savedDirectory cache > lastUsedDirectory cache
   */
  async loadCachedFilesForWindow(): Promise<DirectoryInfo | null> {
    return await this.cacheLoader.loadCachedFilesForWindow(this.savedDirectory);
  }

  /**
   * Execute directory-detector native tool with fd (single stage)
   * fd is required - always uses recursive search mode
   * @param timeout Timeout in milliseconds
   * @returns DirectoryInfo or null on error
   */
  async executeDirectoryDetector(timeout: number): Promise<DirectoryInfo | null> {
    return await this.detectionExecutor.executeDirectoryDetector(timeout);
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

      const result = await this.executeDirectoryDetector(5000);

      if (result && result.directory && inputWindow && !inputWindow.isDestroyed()) {
        await this.backgroundHandler.handleSuccessfulDetection(result, inputWindow, startTime);
      } else {
        this.backgroundHandler.handleFailedDetection(inputWindow);
      }

      logger.debug(`🏁 Total background directory detection time: ${(performance.now() - startTime).toFixed(2)}ms`);
    } catch (error) {
      logger.warn('Background directory detection failed:', error);
      this.backgroundHandler.notifyDetectionError(inputWindow);
    }
  }
}

export default DirectoryDetector;
