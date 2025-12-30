import { logger } from '../../utils/utils';
import type { FileInfo } from '../../types';

/**
 * Utility functions for DirectoryDetector
 */
export class DirectoryDetectorUtils {
  /**
   * Check if a directory should have file search disabled
   * Root directory (/) and root-owned system directories are excluded for security
   */
  static isFileSearchDisabledDirectory(directory: string): boolean {
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
   * Check if file list has changed (for cache update decision)
   */
  static hasFileListChanges(
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

  /**
   * Check if fd command is available on the system
   * @param customFdPath Optional custom fd path from settings
   * @returns true if fd is available, false otherwise
   */
  static checkFdCommandAvailability(customFdPath?: string): boolean {
    const fs = require('fs');

    // Check custom fdPath from settings first
    if (customFdPath) {
      if (fs.existsSync(customFdPath)) {
        return true;
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
        return true;
      }
    }

    logger.warn('fd command is not available. File search will not work. Install with: brew install fd');
    return false;
  }
}
