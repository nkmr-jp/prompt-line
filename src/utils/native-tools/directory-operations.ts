import { execFile } from 'child_process';
import type { DirectoryInfo } from '../../types';
import { TIMEOUTS } from '../../constants';
import { logger } from '../logger';
import { DIRECTORY_DETECTOR_PATH, FILE_SEARCHER_PATH } from './paths';

/**
 * Options for directory detection with source app override
 */
export interface DirectoryDetectionOptions {
  /** Source app PID (for when Prompt Line window is in front) */
  pid?: number;
  /** Source app bundle ID */
  bundleId?: string;
}

/**
 * Detect current directory from active terminal (Terminal.app or iTerm2)
 * @param options - Optional PID and bundleId to override frontmost app detection
 * @returns Promise<DirectoryInfo> - Object with directory info or error
 */
export function detectCurrentDirectory(options?: DirectoryDetectionOptions): Promise<DirectoryInfo> {
  return new Promise((resolve) => {
    if (process.platform !== 'darwin') {
      resolve({ error: 'Directory detection only supported on macOS' });
      return;
    }

    const execOptions = {
      timeout: TIMEOUTS.WINDOW_BOUNDS_TIMEOUT,
      killSignal: 'SIGTERM' as const
    };

    // Build args array with optional PID and/or bundleId arguments
    // bundleId alone is supported - Swift will look up the PID
    const args: string[] = ['detect'];
    if (options?.bundleId) {
      args.push('--bundleId', options.bundleId);
      if (options?.pid) {
        args.push('--pid', String(options.pid));
      }
    }

    execFile(DIRECTORY_DETECTOR_PATH, args, execOptions, (error, stdout) => {
      if (error) {
        logger.warn('Error detecting current directory (non-blocking):', error.message);
        resolve({ error: error.message });
      } else {
        try {
          const result = JSON.parse(stdout.trim()) as DirectoryInfo;
          resolve(result);
        } catch (parseError) {
          logger.warn('Error parsing directory detection result:', parseError);
          resolve({ error: 'Failed to parse directory detection result' });
        }
      }
    });
  });
}

/**
 * List files in a specified directory using file-searcher native tool
 * @param directoryPath - Path to the directory to list
 * @returns Promise<DirectoryInfo> - Object with file list or error
 */
export function listDirectory(directoryPath: string): Promise<DirectoryInfo> {
  return new Promise((resolve) => {
    if (process.platform !== 'darwin') {
      resolve({ error: 'Directory listing only supported on macOS' });
      return;
    }

    // Validate path input
    if (!directoryPath || typeof directoryPath !== 'string') {
      resolve({ error: 'Invalid directory path' });
      return;
    }

    // Sanitize path to prevent command injection
    const sanitizedPath = directoryPath
      .replace(/[;&|`$(){}[\]<>"'\\*?~^]/g, '')
      .replace(/\x00/g, '')
      .replace(/[\r\n]/g, '')
      .trim();

    if (sanitizedPath.length === 0) {
      resolve({ error: 'Directory path is empty after sanitization' });
      return;
    }

    const options = {
      timeout: TIMEOUTS.WINDOW_BOUNDS_TIMEOUT,
      killSignal: 'SIGTERM' as const
    };

    // Use file-searcher native tool for file listing
    execFile(FILE_SEARCHER_PATH, ['list', sanitizedPath], options, (error, stdout) => {
      if (error) {
        logger.warn('Error listing directory (non-blocking):', error.message);
        resolve({ error: error.message });
      } else {
        try {
          const result = JSON.parse(stdout.trim()) as DirectoryInfo;
          resolve(result);
        } catch (parseError) {
          logger.warn('Error parsing directory listing result:', parseError);
          resolve({ error: 'Failed to parse directory listing result' });
        }
      }
    });
  });
}

/**
 * Detect current directory from active terminal and list files
 * Uses separated tools: directory-detector for CWD, file-searcher for file listing
 * @param options - Optional PID and bundleId to override frontmost app detection
 * @returns Promise<DirectoryInfo> - Object with directory info and file list
 */
export async function detectCurrentDirectoryWithFiles(options?: DirectoryDetectionOptions): Promise<DirectoryInfo> {
  if (process.platform !== 'darwin') {
    return { error: 'Directory detection only supported on macOS' };
  }

  // Step 1: Detect current directory using directory-detector
  const dirResult = await detectCurrentDirectory(options);
  if (dirResult.error || !dirResult.directory) {
    return dirResult;
  }

  // Step 2: List files using file-searcher
  const fileResult = await listDirectory(dirResult.directory);
  if (fileResult.error) {
    // Return directory info without files if file listing fails
    logger.warn('File listing failed, returning directory only:', fileResult.error);
    return dirResult;
  }

  // Combine results - only add file properties if they exist
  const result: DirectoryInfo = { ...dirResult };
  if (fileResult.files) result.files = fileResult.files;
  if (fileResult.fileCount !== undefined) result.fileCount = fileResult.fileCount;
  if (fileResult.searchMode) result.searchMode = fileResult.searchMode;
  if (fileResult.partial !== undefined) result.partial = fileResult.partial;

  return result;
}
