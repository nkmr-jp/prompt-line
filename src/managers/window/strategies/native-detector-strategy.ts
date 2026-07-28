import { execFile } from 'child_process';
import config from '../../../config/app-config';
import { logger, DIRECTORY_DETECTOR_PATH } from '../../../utils/utils';
import { listDirectory } from '../../../utils/file-search';
import type { DirectoryInfo, FileSearchSettings, AppInfo } from '../../../types';
import type { IDirectoryDetectionStrategy } from './types';
import { TIMEOUTS } from '../../../constants';

/**
 * List the files of an already-resolved directory and merge them into the
 * DirectoryInfo the renderer consumes.
 *
 * Shared by the native detection path (directory resolved by the Swift tool)
 * and the app-directory-override path (directory resolved from
 * `app-directories.json`), so both produce an identical result shape.
 * Never throws: on a file-search failure the base result is returned as-is.
 */
export async function withListedFiles(
  base: DirectoryInfo,
  fileSearchSettings: FileSearchSettings | null
): Promise<DirectoryInfo> {
  if (fileSearchSettings) {
    logger.debug('Applying file search settings:', {
      maxFiles: fileSearchSettings.maxFiles,
      respectGitignore: fileSearchSettings.respectGitignore,
      includeHidden: fileSearchSettings.includeHidden
    });
  } else {
    logger.debug('No file search settings provided, using defaults');
  }

  try {
    const listResult = await listDirectory(base.directory!, fileSearchSettings || undefined);

    // Merge results
    const result: DirectoryInfo = { ...base };

    if (listResult.error) {
      result.filesError = listResult.error;
    } else {
      // listResult.directory may differ from the kernel-canonical
      // base.directory when reverse symlink lookup recovered
      // a user-facing alias (e.g. ~/ghq/.../vault). Prefer that.
      if (listResult.directory) {
        result.directory = listResult.directory;
      }
      if (listResult.files) {
        result.files = listResult.files;
        result.fileCount = listResult.fileCount ?? listResult.files.length;
      }
      if (listResult.searchMode) {
        result.searchMode = listResult.searchMode;
      }
      if (listResult.partial !== undefined) {
        result.fileLimitReached = listResult.partial;
        if (fileSearchSettings?.maxFiles !== undefined) {
          result.maxFiles = fileSearchSettings.maxFiles;
        }
      }
    }

    // Set hint message if fd is not available
    if (listResult.fdAvailable === false) {
      result.hint = 'Install fd for file search: brew install fd';
      logger.warn('fd command not found. File search will not work. Install with: brew install fd');
    }

    return result;
  } catch (listError) {
    logger.warn('Error listing files:', listError);
    // Return base result without files on file searcher error
    return base;
  }
}

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

    const detectOptions = {
      timeout: Math.min(timeout, TIMEOUTS.NATIVE_TOOL_EXECUTION), // Use shorter timeout for detection
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
            resolve(detectResult); // Return result with error for logging
            return;
          }

          if (!detectResult.directory) {
            resolve(null);
            return;
          }

          // Step 2: List files using Node.js file-search module
          resolve(await withListedFiles(detectResult, fileSearchSettings));
        } catch (parseError) {
          logger.warn('Error parsing directory detection result:', parseError);
          resolve(null);
        }
      });
    });
  }

}
