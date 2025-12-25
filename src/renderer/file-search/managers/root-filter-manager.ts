/**
 * RootFilterManager - Handles file filtering at root level
 *
 * Extracted from FileFilterManager to improve modularity.
 * Responsibilities:
 * - Get top-level files and directories (no query)
 * - Search all files recursively with query
 * - Create virtual directory entries
 */

import type { FileInfo } from '../../../types';
import { getRelativePath, calculateMatchScore } from '../index';

/**
 * Callbacks for RootFilterManager
 */
export interface RootFilterCallbacks {
  /** Sort files with directories first */
  sortByDirectoryFirst: (files: FileInfo[]) => FileInfo[];
}

/**
 * RootFilterManager handles file filtering at root level
 */
export class RootFilterManager {
  private callbacks: RootFilterCallbacks;

  constructor(callbacks: RootFilterCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Filter files at root level
   */
  public filterFilesAtRoot(
    allFiles: FileInfo[],
    baseDir: string,
    query: string,
    maxSuggestions: number
  ): FileInfo[] {
    if (!query) {
      // No query - show top-level files and directories only
      return this.getTopLevelFiles(allFiles, baseDir, maxSuggestions);
    }

    // With query at root level - search ALL files recursively
    return this.searchAllFiles(allFiles, baseDir, query, maxSuggestions);
  }

  /**
   * Get top-level files and directories (no query)
   */
  private getTopLevelFiles(
    allFiles: FileInfo[],
    baseDir: string,
    maxSuggestions: number
  ): FileInfo[] {
    const seenDirs = new Set<string>();
    const files: FileInfo[] = [];

    for (const file of allFiles) {
      const relativePath = getRelativePath(file.path, baseDir);
      const slashIndex = relativePath.indexOf('/');

      if (slashIndex === -1) {
        files.push(file);
      } else {
        this.addTopLevelDirectory(relativePath, slashIndex, allFiles, baseDir, seenDirs, files);
      }
    }

    return this.callbacks.sortByDirectoryFirst(files).slice(0, maxSuggestions);
  }

  /**
   * Add top-level directory (existing or virtual)
   */
  private addTopLevelDirectory(
    relativePath: string,
    slashIndex: number,
    allFiles: FileInfo[],
    baseDir: string,
    seenDirs: Set<string>,
    files: FileInfo[]
  ): void {
    const dirName = relativePath.substring(0, slashIndex);
    if (seenDirs.has(dirName)) return;

    seenDirs.add(dirName);
    const existingDir = this.findExistingDirectory(allFiles, baseDir, dirName);

    if (existingDir) {
      files.push(existingDir);
    } else {
      files.push(this.createVirtualDirectory(baseDir, dirName));
    }
  }

  /**
   * Find existing directory in file list
   */
  private findExistingDirectory(allFiles: FileInfo[], baseDir: string, dirName: string): FileInfo | undefined {
    return allFiles.find(f =>
      f.isDirectory && getRelativePath(f.path, baseDir) === dirName
    );
  }

  /**
   * Search all files recursively with query
   */
  private searchAllFiles(
    allFiles: FileInfo[],
    baseDir: string,
    query: string,
    maxSuggestions: number
  ): FileInfo[] {
    const queryLower = query.toLowerCase();
    const scoredFiles = this.findMatchingFiles(allFiles, baseDir, queryLower);
    const scoredDirs = this.findMatchingDirectories(allFiles, baseDir, queryLower);

    const allScored = [...scoredFiles, ...scoredDirs]
      .sort((a, b) => b.score - a.score)
      .slice(0, maxSuggestions);

    return allScored.map(item => item.file);
  }

  /**
   * Find all matching files
   */
  private findMatchingFiles(
    allFiles: FileInfo[],
    baseDir: string,
    queryLower: string
  ): Array<{ file: FileInfo; score: number; relativePath: string }> {
    return allFiles
      .filter(file => !file.isDirectory)
      .map(file => ({
        file,
        score: calculateMatchScore(file, queryLower),
        relativePath: getRelativePath(file.path, baseDir)
      }))
      .filter(item => item.score > 0);
  }

  /**
   * Find all matching directories
   */
  private findMatchingDirectories(
    allFiles: FileInfo[],
    baseDir: string,
    queryLower: string
  ): Array<{ file: FileInfo; score: number; relativePath: string }> {
    const { uniqueDirs } = this.collectMatchingDirectories(allFiles, baseDir, queryLower);

    return uniqueDirs.map(dir => ({
      file: dir,
      score: calculateMatchScore(dir, queryLower),
      relativePath: getRelativePath(dir.path, baseDir)
    }));
  }

  /**
   * Collect matching directories from all file paths
   */
  private collectMatchingDirectories(
    allFiles: FileInfo[],
    baseDir: string,
    queryLower: string
  ): { uniqueDirs: FileInfo[] } {
    const seenDirs = new Set<string>();
    const seenDirNames = new Map<string, { path: string; depth: number }>();
    const matchingDirs: FileInfo[] = [];

    for (const file of allFiles) {
      this.processFilePathForDirectories(file, baseDir, queryLower, seenDirs, seenDirNames, matchingDirs);
    }

    const uniqueDirs = this.deduplicateDirectories(seenDirNames, matchingDirs, baseDir);
    return { uniqueDirs };
  }

  /**
   * Process file path to extract matching directories
   */
  private processFilePathForDirectories(
    file: FileInfo,
    baseDir: string,
    queryLower: string,
    seenDirs: Set<string>,
    seenDirNames: Map<string, { path: string; depth: number }>,
    matchingDirs: FileInfo[]
  ): void {
    const relativePath = getRelativePath(file.path, baseDir);
    const pathParts = relativePath.split('/').filter(p => p);

    for (let i = 0; i < pathParts.length - 1; i++) {
      this.checkDirectoryMatch(pathParts, i, baseDir, queryLower, seenDirs, seenDirNames, matchingDirs);
    }
  }

  /**
   * Check if directory matches query and add if valid
   */
  private checkDirectoryMatch(
    pathParts: string[],
    index: number,
    baseDir: string,
    queryLower: string,
    seenDirs: Set<string>,
    seenDirNames: Map<string, { path: string; depth: number }>,
    matchingDirs: FileInfo[]
  ): void {
    const dirPath = pathParts.slice(0, index + 1).join('/');
    const dirName = pathParts[index] || '';

    if (!dirName || seenDirs.has(dirPath)) return;

    if (this.directoryMatchesQuery(dirName, dirPath, queryLower)) {
      this.addMatchingDirectory(dirName, dirPath, pathParts.length, baseDir, seenDirs, seenDirNames, matchingDirs);
    }
  }

  /**
   * Check if directory name or path matches query
   */
  private directoryMatchesQuery(dirName: string, dirPath: string, queryLower: string): boolean {
    return dirName.toLowerCase().includes(queryLower) || dirPath.toLowerCase().includes(queryLower);
  }

  /**
   * Add matching directory (prefer shorter paths)
   */
  private addMatchingDirectory(
    dirName: string,
    dirPath: string,
    depth: number,
    baseDir: string,
    seenDirs: Set<string>,
    seenDirNames: Map<string, { path: string; depth: number }>,
    matchingDirs: FileInfo[]
  ): void {
    seenDirs.add(dirPath);

    const existing = seenDirNames.get(dirName);
    if (existing && existing.depth <= depth) return;

    seenDirNames.set(dirName, { path: dirPath, depth });
    matchingDirs.push(this.createVirtualDirectory(baseDir, dirPath));
  }

  /**
   * Remove duplicate directories by name (keep shortest path)
   */
  private deduplicateDirectories(
    seenDirNames: Map<string, { path: string; depth: number }>,
    matchingDirs: FileInfo[],
    baseDir: string
  ): FileInfo[] {
    return Array.from(seenDirNames.entries())
      .map(([name, info]) => matchingDirs.find(d => d.name === name && d.path === baseDir + '/' + info.path))
      .filter((d): d is FileInfo => d !== undefined);
  }

  /**
   * Create virtual directory entry
   */
  private createVirtualDirectory(baseDir: string, dirPath: string): FileInfo {
    const dirName = dirPath.includes('/') ? dirPath.split('/').pop()! : dirPath;
    return {
      name: dirName,
      path: baseDir + '/' + dirPath,
      isDirectory: true
    };
  }
}
