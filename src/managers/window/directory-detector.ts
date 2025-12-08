import { execFile } from 'child_process';
import type { BrowserWindow } from 'electron';
import config from '../../config/app-config';
import { logger, DIRECTORY_DETECTOR_PATH } from '../../utils/utils';
import FileCacheManager from '../file-cache-manager';
import type DirectoryManager from '../directory-manager';
import type { AppInfo, DirectoryInfo, FileSearchSettings, FileInfo } from '../../types';

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
  private directoryManager: DirectoryManager | null = null;
  private savedDirectory: string | null = null;
  private fileCacheManager: FileCacheManager | null = null;
  private fdCommandAvailable: boolean = true;
  private fdCommandChecked: boolean = false;
  private previousApp: AppInfo | string | null = null;

  constructor(fileCacheManager: FileCacheManager | null) {
    this.fileCacheManager = fileCacheManager;
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

    const fs = require('fs');

    // Check custom fdPath from settings first
    const customFdPath = this.fileSearchSettings?.fdPath;
    if (customFdPath) {
      if (fs.existsSync(customFdPath)) {
        this.fdCommandAvailable = true;
        logger.debug(`fd command found at custom path: ${customFdPath}`);
        return;
      } else {
        logger.warn(`Custom fdPath "${customFdPath}" does not exist, falling back to auto-detect`);
      }
    }

    // Check common fd installation paths directly
    // This avoids PATH issues when Electron is launched outside of shell
    const fdPaths = [
      '/opt/homebrew/bin/fd',  // Apple Silicon Homebrew
      '/usr/local/bin/fd',     // Intel Homebrew
      '/usr/bin/fd'            // System
    ];

    for (const fdPath of fdPaths) {
      if (fs.existsSync(fdPath)) {
        this.fdCommandAvailable = true;
        logger.debug(`fd command found at: ${fdPath}`);
        return;
      }
    }

    this.fdCommandAvailable = false;
    logger.warn('fd command is not available. File search will not work. Install with: brew install fd');
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
    // Root directory
    if (directory === '/') return true;

    // Well-known root-owned system directories
    const rootOwnedDirs = [
      '/Library',
      '/System',
      '/Applications',
      '/bin',
      '/sbin',
      '/usr',
      '/var',
      '/etc',
      '/private',
      '/tmp',
      '/cores',
      '/opt'
    ];

    // Check if directory starts with any root-owned directory
    for (const rootDir of rootOwnedDirs) {
      if (directory === rootDir || directory.startsWith(rootDir + '/')) {
        return true;
      }
    }

    return false;
  }

  /**
   * Load cached files for window show - provides instant file search availability
   * Priority: savedDirectory cache > lastUsedDirectory cache
   */
  async loadCachedFilesForWindow(): Promise<DirectoryInfo | null> {
    if (!this.fileCacheManager) return null;

    try {
      // Priority 1: Try to load cache for savedDirectory (from DirectoryManager)
      if (this.savedDirectory) {
        // Check if this directory has file search disabled
        if (this.isFileSearchDisabledDirectory(this.savedDirectory)) {
          return {
            success: true,
            directory: this.savedDirectory,
            files: [],
            fileCount: 0,
            partial: false,
            fromCache: true,
            searchMode: 'recursive',
            filesDisabled: true,
            filesDisabledReason: 'File search is disabled for root directory'
          };
        }

        const cached = await this.fileCacheManager.loadCache(this.savedDirectory);
        if (cached && this.fileCacheManager.isCacheValid(cached.metadata)) {
          const result: DirectoryInfo = {
            success: true,
            directory: cached.directory,
            files: cached.files,
            fileCount: cached.files.length,
            partial: false,
            fromCache: true,
            cacheAge: Date.now() - new Date(cached.metadata.updatedAt).getTime(),
            searchMode: 'recursive'
          };
          return result;
        }
      }

      // Priority 2: Try to load cache for lastUsedDirectory
      const lastUsedDir = await this.fileCacheManager.getLastUsedDirectory();
      if (lastUsedDir && lastUsedDir !== this.savedDirectory) {
        // Check if this directory has file search disabled
        if (this.isFileSearchDisabledDirectory(lastUsedDir)) {
          return {
            success: true,
            directory: lastUsedDir,
            files: [],
            fileCount: 0,
            partial: false,
            fromCache: true,
            searchMode: 'recursive',
            filesDisabled: true,
            filesDisabledReason: 'File search is disabled for root directory'
          };
        }

        const cached = await this.fileCacheManager.loadCache(lastUsedDir);
        if (cached && this.fileCacheManager.isCacheValid(cached.metadata)) {
          const result: DirectoryInfo = {
            success: true,
            directory: cached.directory,
            files: cached.files,
            fileCount: cached.files.length,
            partial: false,
            fromCache: true,
            cacheAge: Date.now() - new Date(cached.metadata.updatedAt).getTime(),
            searchMode: 'recursive'
          };
          return result;
        }
      }

      return null;
    } catch (error) {
      logger.error('Failed to load cached files:', error);
      return null;
    }
  }

  /**
   * Execute directory-detector native tool with fd (single stage)
   * fd is required - always uses recursive search mode
   * @param timeout Timeout in milliseconds
   * @returns DirectoryInfo or null on error
   */
  async executeDirectoryDetector(
    timeout: number
  ): Promise<DirectoryInfo | null> {
    if (!config.platform.isMac) {
      logger.debug('Directory detection only supported on macOS');
      return null;
    }

    const startTime = performance.now();

    // Build args array with settings (fd is always used, single stage)
    const args: string[] = ['detect-with-files'];

    // Apply file search settings if available
    if (this.fileSearchSettings) {
      if (!this.fileSearchSettings.respectGitignore) {
        args.push('--no-gitignore');
      }
      if (this.fileSearchSettings.excludePatterns && this.fileSearchSettings.excludePatterns.length > 0) {
        for (const pattern of this.fileSearchSettings.excludePatterns) {
          args.push('--exclude', pattern);
        }
      }
      if (this.fileSearchSettings.includePatterns && this.fileSearchSettings.includePatterns.length > 0) {
        for (const pattern of this.fileSearchSettings.includePatterns) {
          args.push('--include', pattern);
        }
      }
      if (this.fileSearchSettings.maxFiles) {
        args.push('--max-files', String(this.fileSearchSettings.maxFiles));
      }
      if (this.fileSearchSettings.includeHidden) {
        args.push('--include-hidden');
      }
      if (this.fileSearchSettings.maxDepth !== null && this.fileSearchSettings.maxDepth !== undefined) {
        args.push('--max-depth', String(this.fileSearchSettings.maxDepth));
      }
      if (this.fileSearchSettings.followSymlinks) {
        args.push('--follow-symlinks');
      }
    }

    // Add bundleId if available for accurate directory detection
    if (this.previousApp && typeof this.previousApp === 'object' && this.previousApp.bundleId) {
      args.push('--bundleId', this.previousApp.bundleId);
    }

    logger.debug('Directory detector command:', {
      executable: DIRECTORY_DETECTOR_PATH,
      args,
      fileSearchSettings: this.fileSearchSettings
    });

    const options = {
      timeout,
      killSignal: 'SIGTERM' as const,
      // Increase maxBuffer for large file lists (default is 1MB)
      // 50,000 files × ~200 bytes/file = ~10MB, so use 50MB for safety
      maxBuffer: 50 * 1024 * 1024
    };

    return new Promise((resolve) => {
      execFile(DIRECTORY_DETECTOR_PATH, args, options, (error: Error | null, stdout?: string) => {
        const elapsed = performance.now() - startTime;

        if (error) {
          logger.warn(`Directory detection failed after ${elapsed.toFixed(2)}ms:`, error);
          resolve(null);
          return;
        }

        try {
          const result = JSON.parse(stdout?.trim() || '{}') as DirectoryInfo;

          if (result.error) {
            logger.debug('Directory detection returned error:', result.error);
            resolve(null);
            return;
          }

          // Add hint message if fd command is not available
          if (result.filesError && result.filesError.includes('fd required')) {
            result.hint = 'Install fd for file search: brew install fd';
            logger.warn('fd command not found. File search will not work. Install with: brew install fd');
          }

          logger.debug(`⏱️  Directory detection completed in ${elapsed.toFixed(2)}ms`, {
            directory: result.directory,
            fileCount: result.fileCount,
            searchMode: result.searchMode,
            isGitRepository: result.isGitRepository
          });

          resolve(result);
        } catch (parseError) {
          logger.warn('Error parsing directory detection result:', parseError);
          resolve(null);
        }
      });
    });
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

        // Check if file list has changed compared to cache
        let hasChanges = true;

        // Skip cache operations for directories with file search disabled (e.g., root directory)
        const isFileSearchDisabled = this.isFileSearchDisabledDirectory(detectedDirectory) || result.filesDisabled;

        if (this.fileCacheManager && result.files && !isFileSearchDisabled) {
          const existingCache = await this.fileCacheManager.loadCache(detectedDirectory);
          if (existingCache) {
            hasChanges = this.hasFileListChanges(existingCache.files, result.files);
          }

          // Update lastUsedDirectory
          await this.fileCacheManager.setLastUsedDirectory(detectedDirectory);

          if (hasChanges) {
            // Save updated cache
            await this.fileCacheManager.saveCache(
              detectedDirectory,
              result.files,
              { searchMode: 'recursive' }
            );
            logger.debug(`Cache updated for ${detectedDirectory}, ${result.files.length} files`);
          } else {
            // Just update timestamp
            await this.fileCacheManager.updateCacheTimestamp(detectedDirectory);
            logger.debug(`Cache timestamp updated for ${detectedDirectory}, no file changes`);
          }
        } else if (isFileSearchDisabled) {
          // Clear any existing cache for this directory
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

  /**
   * Check if file list has changed (for cache update decision)
   */
  private hasFileListChanges(
    oldFiles: FileInfo[] | undefined,
    newFiles: FileInfo[]
  ): boolean {
    if (!oldFiles) return true;
    if (oldFiles.length !== newFiles.length) return true;

    // Create path sets for comparison (order-independent)
    const oldPaths = new Set(oldFiles.map(f => f.path));
    const newPaths = new Set(newFiles.map(f => f.path));

    if (oldPaths.size !== newPaths.size) return true;

    for (const path of newPaths) {
      if (!oldPaths.has(path)) return true;
    }

    return false;
  }
}

export default DirectoryDetector;
