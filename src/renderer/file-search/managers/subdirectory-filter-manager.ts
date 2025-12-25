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
    const files = this.collectFilesInSubdirectory(allFiles, baseDir, currentPath);

    if (!query) {
      return this.callbacks.sortByDirectoryFirst(files).slice(0, maxSuggestions);
    }

    return this.scoreAndFilterFiles(files, query, maxSuggestions);
  }

  /**
   * Collect files under the current path
   */
  private collectFilesInSubdirectory(
    allFiles: FileInfo[],
    baseDir: string,
    currentPath: string
  ): FileInfo[] {
    const seenDirs = new Set<string>();
    const files: FileInfo[] = [];

    for (const file of allFiles) {
      const relativePath = getRelativePath(file.path, baseDir);
      if (!relativePath.startsWith(currentPath)) continue;

      const remainingPath = relativePath.substring(currentPath.length);
      if (!remainingPath) continue;

      this.processFileOrDirectory(file, remainingPath, baseDir, currentPath, seenDirs, files);
    }

    return files;
  }

  /**
   * Process a file or directory entry
   */
  private processFileOrDirectory(
    file: FileInfo,
    remainingPath: string,
    baseDir: string,
    currentPath: string,
    seenDirs: Set<string>,
    files: FileInfo[]
  ): void {
    const slashIndex = remainingPath.indexOf('/');

    if (slashIndex === -1) {
      files.push(file);
    } else if (slashIndex === remainingPath.length - 1) {
      this.addDirectChildDirectory(remainingPath, file, seenDirs, files);
    } else {
      this.addIntermediateDirectory(remainingPath, slashIndex, baseDir, currentPath, seenDirs, files);
    }
  }

  /**
   * Add direct directory child
   */
  private addDirectChildDirectory(
    remainingPath: string,
    file: FileInfo,
    seenDirs: Set<string>,
    files: FileInfo[]
  ): void {
    if (!seenDirs.has(remainingPath)) {
      seenDirs.add(remainingPath);
      files.push(file);
    }
  }

  /**
   * Add intermediate directory (virtual entry)
   */
  private addIntermediateDirectory(
    remainingPath: string,
    slashIndex: number,
    baseDir: string,
    currentPath: string,
    seenDirs: Set<string>,
    files: FileInfo[]
  ): void {
    const dirName = remainingPath.substring(0, slashIndex);
    if (seenDirs.has(dirName)) return;

    seenDirs.add(dirName);
    const virtualDir: FileInfo = {
      name: dirName,
      path: `${baseDir}/${currentPath}${dirName}`,
      isDirectory: true
    };
    files.push(virtualDir);
  }

  /**
   * Score and filter files by query
   */
  private scoreAndFilterFiles(
    files: FileInfo[],
    query: string,
    maxSuggestions: number
  ): FileInfo[] {
    const queryLower = query.toLowerCase();
    const scored = files
      .map(file => ({ file, score: calculateMatchScore(file, queryLower) }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxSuggestions);

    return scored.map(item => item.file);
  }
}
