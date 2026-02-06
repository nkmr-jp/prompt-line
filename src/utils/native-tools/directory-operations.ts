import { execFile } from 'child_process';
import type { DirectoryInfo, FileSearchSettings } from '../../types';
import { TIMEOUTS } from '../../constants';
import { logger } from '../logger';
import { DIRECTORY_DETECTOR_PATH } from './paths';
import { listDirectory as listDirectoryNode } from '../file-search';

/**
 * Options for directory detection with source app override
 */
export interface DirectoryDetectionOptions {
  /** Source app PID (for when Prompt Line window is in front) */
  pid?: number;
  /** Source app bundle ID */
  bundleId?: string;
  /** File search settings for file listing */
  fileSearchSettings?: FileSearchSettings;
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
 * List files in a specified directory using Node.js file-searcher implementation
 * @param directoryPath - Path to the directory to list
 * @param fileSearchSettings - Optional file search settings
 * @returns Promise<DirectoryInfo> - Object with file list or error
 */
export async function listDirectory(directoryPath: string, fileSearchSettings?: FileSearchSettings): Promise<DirectoryInfo> {
  // Use Node.js implementation (cross-platform)
  return listDirectoryNode(directoryPath, fileSearchSettings);
}

/**
 * Detect current directory from active terminal and list files
 * Uses separated tools: directory-detector for CWD, file-searcher for file listing
 * @param options - Optional PID, bundleId, and fileSearchSettings
 * @returns Promise<DirectoryInfo> - Object with directory info and file list
 */
export async function detectCurrentDirectoryWithFiles(options?: DirectoryDetectionOptions): Promise<DirectoryInfo> {
  if (process.platform !== 'darwin') {
    return { error: 'Directory detection only supported on macOS' };
  }

  // Debug: Log the options being passed
  if (options?.fileSearchSettings) {
    logger.debug('detectCurrentDirectoryWithFiles called with fileSearchSettings:', {
      maxFiles: options.fileSearchSettings.maxFiles,
      respectGitignore: options.fileSearchSettings.respectGitignore,
      includeHidden: options.fileSearchSettings.includeHidden
    });
  } else {
    logger.debug('detectCurrentDirectoryWithFiles called without fileSearchSettings');
  }

  // Step 1: Detect current directory using directory-detector
  const dirResult = await detectCurrentDirectory(options);
  if (dirResult.error || !dirResult.directory) {
    return dirResult;
  }

  // Step 2: List files using file-searcher with optional settings
  const fileResult = await listDirectory(dirResult.directory, options?.fileSearchSettings);
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
