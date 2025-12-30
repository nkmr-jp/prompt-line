import type { BrowserWindow } from 'electron';
import { logger } from '../../utils/utils';
import FileCacheManager from '../file-cache-manager';
import type DirectoryManager from '../directory-manager';
import type { AppInfo, DirectoryInfo, FileSearchSettings } from '../../types';
import type { IDirectoryDetectionStrategy } from './strategies';
import { NativeDetectorStrategy } from './strategies';
import { DirectoryDetectorUtils } from './directory-detector-utils';
import { DirectoryCacheHelper } from './directory-cache-helper';
import { TIMEOUTS } from '../../constants';

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
  }

  /**
   * Update file search settings
   */
  updateFileSearchSettings(settings: FileSearchSettings | null | undefined): void {
    this.fileSearchSettings = settings ?? null;
  }

  /**
   * Update saved directory from DirectoryManager
   */
  updateSavedDirectory(directory: string | null): void {
    this.savedDirectory = directory;
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
      return null;
    }

    return this.strategy.detect(timeout, this.previousApp, this.fileSearchSettings);
  }

  /**
   * Check if directory changed from saved directory
   */
  private isDirectoryChanged(detectedDirectory: string): boolean {
    return this.savedDirectory !== null && detectedDirectory !== this.savedDirectory;
  }

  /**
   * Determine if renderer notification is needed
   */
  private shouldNotifyRenderer(hasChanges: boolean, directoryChanged: boolean, hint?: string): boolean {
    return hasChanges || directoryChanged || Boolean(hint);
  }

  /**
   * Create success notification with directory change information
   */
  private createSuccessNotification(
    result: DirectoryInfo,
    directoryChanged: boolean
  ): DirectoryInfo {
    const notification: DirectoryInfo = {
      ...result,
      directoryChanged
    };

    // Only add previousDirectory if directory actually changed
    if (directoryChanged && this.savedDirectory !== null && result.directory !== this.savedDirectory) {
      notification.previousDirectory = this.savedDirectory;
    }

    return notification;
  }

  /**
   * Create timeout/error notification
   */
  private createTimeoutNotification(): DirectoryInfo {
    const notification: DirectoryInfo = {
      success: false,
      detectionTimedOut: true
    };

    if (this.savedDirectory) {
      notification.directory = this.savedDirectory;
    }

    return notification;
  }

  /**
   * Notify renderer of directory data update
   */
  private notifyRenderer(inputWindow: BrowserWindow, data: DirectoryInfo): void {
    if (!inputWindow.isDestroyed()) {
      inputWindow.webContents.send('directory-data-updated', data);
    }
  }

  /**
   * Update directory manager with detected directory
   */
  private updateDirectoryManager(detectedDirectory: string): void {
    if (this.directoryManager) {
      this.directoryManager.setDirectory(detectedDirectory);
      this.savedDirectory = detectedDirectory;
    }
  }

  /**
   * Handle successful detection result
   */
  private async handleSuccessfulDetection(
    result: DirectoryInfo,
    inputWindow: BrowserWindow,
    _startTime: number
  ): Promise<void> {
    const detectedDirectory = result.directory!;
    const directoryChanged = this.isDirectoryChanged(detectedDirectory);

    // Handle cache operations
    const isFileSearchDisabled = this.isFileSearchDisabledDirectory(detectedDirectory) || (result.filesDisabled ?? false);
    const hasChanges = await this.cacheHelper.handleBackgroundCacheUpdate(
      detectedDirectory,
      result.files,
      isFileSearchDisabled
    );

    // Update directory manager with detected directory (detection succeeded)
    this.updateDirectoryManager(detectedDirectory);

    // Notify renderer if there are changes, directory changed, or hint exists
    if (this.shouldNotifyRenderer(hasChanges, directoryChanged, result.hint)) {
      const notification = this.createSuccessNotification(result, directoryChanged);
      this.notifyRenderer(inputWindow, notification);
    }
  }

  /**
   * Handle failed detection (timeout or error)
   */
  private handleFailedDetection(inputWindow: BrowserWindow | null): void {
    if (inputWindow && !inputWindow.isDestroyed()) {
      const notification = this.createTimeoutNotification();
      this.notifyRenderer(inputWindow, notification);
    }
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
    const startTime = performance.now();

    try {
      // Single stage directory detection with fd
      const result = await this.executeDirectoryDetector(TIMEOUTS.BACKGROUND_DETECTION);

      // Handle detection result
      if (result?.directory && inputWindow && !inputWindow.isDestroyed()) {
        await this.handleSuccessfulDetection(result, inputWindow, startTime);
      } else {
        this.handleFailedDetection(inputWindow);
      }
    } catch (error) {
      logger.warn('Background directory detection failed:', error);
      this.handleFailedDetection(inputWindow);
    }
  }

}

export default DirectoryDetector;
