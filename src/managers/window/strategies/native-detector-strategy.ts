import { execFile } from 'child_process';
import config from '../../../config/app-config';
import { logger, DIRECTORY_DETECTOR_PATH, FILE_SEARCHER_PATH } from '../../../utils/utils';
import type { DirectoryInfo, FileSearchSettings, AppInfo } from '../../../types';
import type { IDirectoryDetectionStrategy } from './types';

/**
 * Native tool-based directory detection strategy
 * Uses compiled Swift binaries for macOS directory and file detection
 */
export class NativeDetectorStrategy implements IDirectoryDetectionStrategy {
  getName(): string {
    return 'Native';
  }

  isAvailable(): boolean {
    return config.platform.isMac;
  }

  async detect(
    timeout: number,
    previousApp: AppInfo | string | null,
    fileSearchSettings: FileSearchSettings | null
  ): Promise<DirectoryInfo | null> {
    const startTime = performance.now();

    // Step 1: Detect directory using directory-detector
    const detectArgs: string[] = ['detect'];

    // Add bundleId if available for accurate directory detection
    if (previousApp && typeof previousApp === 'object' && previousApp.bundleId) {
      detectArgs.push('--bundleId', previousApp.bundleId);
    }

    logger.debug('Directory detector command:', {
      executable: DIRECTORY_DETECTOR_PATH,
      args: detectArgs
    });

    const detectOptions = {
      timeout: Math.min(timeout, 3000), // Use shorter timeout for detection
      killSignal: 'SIGTERM' as const
    };

    return new Promise((resolve) => {
      execFile(DIRECTORY_DETECTOR_PATH, detectArgs, detectOptions, async (detectError: Error | null, detectStdout?: string) => {
        const detectElapsed = performance.now() - startTime;

        if (detectError) {
          logger.warn(`Directory detection failed after ${detectElapsed.toFixed(2)}ms:`, detectError);
          resolve(null);
          return;
        }

        try {
          const detectResult = JSON.parse(detectStdout?.trim() || '{}') as DirectoryInfo;

          if (detectResult.error) {
            logger.debug('Directory detection returned error:', detectResult.error);
            resolve(detectResult); // Return result with error for logging
            return;
          }

          if (!detectResult.directory) {
            logger.debug('No directory detected');
            resolve(null);
            return;
          }

          logger.debug(`⏱️  Directory detection completed in ${detectElapsed.toFixed(2)}ms`, {
            directory: detectResult.directory,
            appName: detectResult.appName,
            bundleId: detectResult.bundleId
          });

          // Step 2: List files using file-searcher
          const listArgs: string[] = ['list', detectResult.directory];

          // Apply file search settings if available
          if (fileSearchSettings) {
            this.applyFileSearchSettings(listArgs, fileSearchSettings);
          }

          logger.debug('File searcher command:', {
            executable: FILE_SEARCHER_PATH,
            args: listArgs
          });

          // Calculate remaining timeout with minimum threshold
          const remainingTimeout = Math.round(Math.max(timeout - detectElapsed, 1000));

          const listOptions = {
            timeout: remainingTimeout,
            killSignal: 'SIGTERM' as const,
            maxBuffer: 50 * 1024 * 1024 // 50MB for large file lists
          };

          logger.debug('Executing file searcher with timeout:', { remainingTimeout });

          try {
            execFile(FILE_SEARCHER_PATH, listArgs, listOptions, (listError: Error | null, listStdout?: string) => {
              const totalElapsed = performance.now() - startTime;

              // Merge results
              const result: DirectoryInfo = {
                ...detectResult
              };

              if (listError) {
                logger.warn(`File listing failed after ${totalElapsed.toFixed(2)}ms:`, listError);
                result.filesError = listError.message;
              } else {
                this.parseFileListResult(listStdout, result);
              }

              logger.debug(`⏱️  Directory detection + file listing completed in ${totalElapsed.toFixed(2)}ms`, {
                directory: result.directory,
                fileCount: result.fileCount,
                searchMode: result.searchMode
              });

              resolve(result);
            });
          } catch (execError) {
            logger.warn('Error executing file searcher:', execError);
            // Return detect result without files on file searcher error
            resolve(detectResult);
          }
        } catch (parseError) {
          logger.warn('Error parsing directory detection result:', parseError);
          resolve(null);
        }
      });
    });
  }

  /**
   * Apply file search settings to fd arguments
   */
  private applyFileSearchSettings(args: string[], settings: FileSearchSettings): void {
    if (!settings.respectGitignore) {
      args.push('--no-gitignore');
    }
    if (settings.excludePatterns && settings.excludePatterns.length > 0) {
      for (const pattern of settings.excludePatterns) {
        args.push('--exclude', pattern);
      }
    }
    if (settings.includePatterns && settings.includePatterns.length > 0) {
      for (const pattern of settings.includePatterns) {
        args.push('--include', pattern);
      }
    }
    if (settings.maxFiles) {
      args.push('--max-files', String(settings.maxFiles));
    }
    if (settings.includeHidden) {
      args.push('--include-hidden');
    }
    if (settings.maxDepth !== null && settings.maxDepth !== undefined) {
      args.push('--max-depth', String(settings.maxDepth));
    }
    if (settings.followSymlinks) {
      args.push('--follow-symlinks');
    }
  }

  /**
   * Parse file list result from file-searcher output
   */
  private parseFileListResult(stdout: string | undefined, result: DirectoryInfo): void {
    try {
      const listResult = JSON.parse(stdout?.trim() || '{}');

      if (listResult.files) {
        result.files = listResult.files;
        result.fileCount = listResult.fileCount;
      }
      if (listResult.searchMode) {
        result.searchMode = listResult.searchMode;
      }
      if (listResult.fileLimitReached) {
        result.fileLimitReached = listResult.fileLimitReached;
      }
      if (listResult.maxFiles) {
        result.maxFiles = listResult.maxFiles;
      }
      if (listResult.filesError) {
        result.filesError = listResult.filesError;
        // Add hint message if fd command is not available
        if (listResult.filesError.includes('fd required')) {
          result.hint = 'Install fd for file search: brew install fd';
          logger.warn('fd command not found. File search will not work. Install with: brew install fd');
        }
      }
    } catch (parseError) {
      logger.warn('Error parsing file list result:', parseError);
      result.filesError = 'Failed to parse file list';
    }
  }
}
