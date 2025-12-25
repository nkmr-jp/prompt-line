import { logger } from '../../utils/utils';
import type { DirectoryInfo } from '../../types';

/**
 * Parse file searcher JSON result
 */
export function parseFileSearcherResult(stdout: string | undefined, totalElapsed: number): Partial<DirectoryInfo> {
  try {
    const listResult = JSON.parse(stdout?.trim() || '{}');
    const result = buildDirectoryInfo(listResult);

    logCompletion(totalElapsed, result);
    return result;
  } catch (parseError) {
    logger.warn('Error parsing file list result:', parseError);
    return { filesError: 'Failed to parse file list' };
  }
}

/**
 * Build DirectoryInfo from parsed JSON
 */
function buildDirectoryInfo(listResult: any): Partial<DirectoryInfo> {
  const result: Partial<DirectoryInfo> = {};

  addFileData(result, listResult);
  addSearchMode(result, listResult);
  addFileLimitInfo(result, listResult);
  addErrorInfo(result, listResult);

  return result;
}

/**
 * Add file data to result
 */
function addFileData(result: Partial<DirectoryInfo>, listResult: any): void {
  if (listResult.files) {
    result.files = listResult.files;
    result.fileCount = listResult.fileCount;
  }
}

/**
 * Add search mode to result
 */
function addSearchMode(result: Partial<DirectoryInfo>, listResult: any): void {
  if (listResult.searchMode) {
    result.searchMode = listResult.searchMode;
  }
}

/**
 * Add file limit information to result
 */
function addFileLimitInfo(result: Partial<DirectoryInfo>, listResult: any): void {
  if (listResult.fileLimitReached) {
    result.fileLimitReached = listResult.fileLimitReached;
  }

  if (listResult.maxFiles) {
    result.maxFiles = listResult.maxFiles;
  }
}

/**
 * Add error information to result
 */
function addErrorInfo(result: Partial<DirectoryInfo>, listResult: any): void {
  if (listResult.filesError) {
    result.filesError = listResult.filesError;

    if (isFdCommandError(listResult.filesError)) {
      result.hint = 'Install fd for file search: brew install fd';
      logger.warn('fd command not found. File search will not work. Install with: brew install fd');
    }
  }
}

/**
 * Check if error is related to fd command
 */
function isFdCommandError(errorMessage: string): boolean {
  return errorMessage.includes('fd required');
}

/**
 * Log completion with timing information
 */
function logCompletion(totalElapsed: number, result: Partial<DirectoryInfo>): void {
  logger.debug(`⏱️  Directory detection + file listing completed in ${totalElapsed.toFixed(2)}ms`, {
    fileCount: result.fileCount,
    searchMode: result.searchMode
  });
}
