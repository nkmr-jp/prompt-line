import type { DirectoryInfo, FileInfo } from '../../types';

/**
 * Create directory info for disabled directory (root or system directories)
 */
export function createDisabledDirectoryInfo(directory: string): DirectoryInfo {
  return {
    success: true,
    directory,
    files: [],
    fileCount: 0,
    partial: false,
    fromCache: true,
    searchMode: 'recursive',
    filesDisabled: true,
    filesDisabledReason: 'File search is disabled for root directory'
  };
}

/**
 * Create directory info from cached data
 */
export function createCachedDirectoryInfo(cached: any): DirectoryInfo {
  return {
    success: true,
    directory: cached.directory,
    files: cached.files,
    fileCount: cached.files.length,
    partial: false,
    fromCache: true,
    cacheAge: Date.now() - new Date(cached.metadata.updatedAt).getTime(),
    searchMode: 'recursive'
  };
}

/**
 * Create timeout/error directory info
 */
export function createTimeoutDirectoryInfo(savedDirectory: string | null): DirectoryInfo {
  const info: DirectoryInfo = {
    success: false,
    detectionTimedOut: true
  };

  if (savedDirectory) {
    info.directory = savedDirectory;
  }

  return info;
}

/**
 * Create directory info with change flags
 */
export function createDirectoryInfoWithFlags(
  result: DirectoryInfo,
  directoryChanged: boolean,
  savedDirectory: string | null
): DirectoryInfo {
  const resultWithFlags: DirectoryInfo = {
    ...result,
    directoryChanged
  };

  if (directoryChanged && savedDirectory !== null && savedDirectory !== result.directory) {
    resultWithFlags.previousDirectory = savedDirectory;
  }

  return resultWithFlags;
}

/**
 * Check if file list has changed (for cache update decision)
 */
export function hasFileListChanges(
  oldFiles: FileInfo[] | undefined,
  newFiles: FileInfo[]
): boolean {
  if (!oldFiles) return true;
  if (oldFiles.length !== newFiles.length) return true;

  // Create path sets for comparison (order-independent)
  const oldPaths = new Set(oldFiles.map(f => f.path));
  const newPaths = new Set(newFiles.map(f => f.path));

  if (oldPaths.size !== newPaths.size) return true;

  // Use Array.from for compatibility
  const newPathsArray = Array.from(newPaths);
  for (const path of newPathsArray) {
    if (!oldPaths.has(path)) return true;
  }

  return false;
}
