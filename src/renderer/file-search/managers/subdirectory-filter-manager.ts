/**
 * SubdirectoryFilterManager - Handles file filtering within subdirectories
 *
 * Extracted from FileFilterManager to improve modularity.
 * Responsibilities:
 * - Filter files when browsing a subdirectory
 * - Create virtual directory entries for intermediate directories
 * - Score and sort files within subdirectories
 */

import type { FileInfo } from '../../../types';
import { getRelativePath, calculateMatchScore } from '../index';

/**
 * Callbacks for SubdirectoryFilterManager
 */
export interface SubdirectoryFilterCallbacks {
  /** Sort files with directories first */
  sortByDirectoryFirst: (files: FileInfo[]) => FileInfo[];
}

/**
 * SubdirectoryFilterManager handles file filtering within subdirectories
 */
export class SubdirectoryFilterManager {
  private callbacks: SubdirectoryFilterCallbacks;

  constructor(callbacks: SubdirectoryFilterCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Filter files when browsing a subdirectory
   */
  public filterFilesInSubdirectory(
    allFiles: FileInfo[],
    baseDir: string,
    currentPath: string,
    query: string,
    maxSuggestions: number
  ): FileInfo[] {
    const seenDirs = new Set<string>();
    const files: FileInfo[] = [];

    for (const file of allFiles) {
      const relativePath = getRelativePath(file.path, baseDir);

      // Check if file is under currentPath
      if (!relativePath.startsWith(currentPath)) {
        continue;
      }

      // Get the remaining path after currentPath
      const remainingPath = relativePath.substring(currentPath.length);
      if (!remainingPath) continue;

      const slashIndex = remainingPath.indexOf('/');

      if (slashIndex === -1) {
        // Direct file child
        files.push(file);
      } else if (slashIndex === remainingPath.length - 1) {
        // Direct directory child (already has trailing slash)
        if (!seenDirs.has(remainingPath)) {
          seenDirs.add(remainingPath);
          files.push(file);
        }
      } else {
        // Intermediate directory - create virtual entry
        const dirName = remainingPath.substring(0, slashIndex);
        if (!seenDirs.has(dirName)) {
          seenDirs.add(dirName);
          // Create virtual directory entry
          const virtualDir: FileInfo = {
            name: dirName,
            path: baseDir + '/' + currentPath + dirName,
            isDirectory: true
          };
          files.push(virtualDir);
        }
      }
    }

    if (!query) {
      // Return first N files if no query, with directories first
      return this.callbacks.sortByDirectoryFirst(files).slice(0, maxSuggestions);
    }

    // Score and filter files
    const queryLower = query.toLowerCase();
    const scored = files
      .map(file => ({
        file,
        score: calculateMatchScore(file, queryLower)
      }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxSuggestions);

    return scored.map(item => item.file);
  }
}
