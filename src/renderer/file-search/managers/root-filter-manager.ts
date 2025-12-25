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
        // Top-level file
        files.push(file);
      } else {
        // Has subdirectory - create virtual directory for top-level
        const dirName = relativePath.substring(0, slashIndex);
        if (!seenDirs.has(dirName)) {
          seenDirs.add(dirName);
          // Check if we already have this directory in allFiles
          const existingDir = allFiles.find(f =>
            f.isDirectory && getRelativePath(f.path, baseDir) === dirName
          );
          if (existingDir) {
            files.push(existingDir);
          } else {
            // Create virtual directory entry
            const virtualDir: FileInfo = {
              name: dirName,
              path: baseDir + '/' + dirName,
              isDirectory: true
            };
            files.push(virtualDir);
          }
        }
      }
    }

    return this.callbacks.sortByDirectoryFirst(files).slice(0, maxSuggestions);
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
    const seenDirs = new Set<string>();
    const seenDirNames = new Map<string, { path: string; depth: number }>();
    const matchingDirs: FileInfo[] = [];

    // Find all matching files (from anywhere in the tree)
    const scoredFiles = allFiles
      .filter(file => !file.isDirectory)
      .map(file => ({
        file,
        score: calculateMatchScore(file, queryLower),
        relativePath: getRelativePath(file.path, baseDir)
      }))
      .filter(item => item.score > 0);

    // Find matching directories (by path containing the query)
    for (const file of allFiles) {
      const relativePath = getRelativePath(file.path, baseDir);
      const pathParts = relativePath.split('/').filter(p => p);

      // Check each directory in the path (except the last part which is the file name)
      for (let i = 0; i < pathParts.length - 1; i++) {
        const dirPath = pathParts.slice(0, i + 1).join('/');
        const dirName = pathParts[i] || '';

        if (!dirName || seenDirs.has(dirPath)) continue;

        // Check if directory name or path matches query
        if (dirName.toLowerCase().includes(queryLower) || dirPath.toLowerCase().includes(queryLower)) {
          seenDirs.add(dirPath);

          // Prefer shorter paths (likely the original, not symlink-resolved)
          const depth = pathParts.length;
          const existing = seenDirNames.get(dirName);
          if (existing && existing.depth <= depth) {
            continue;
          }

          seenDirNames.set(dirName, { path: dirPath, depth });
          const virtualDir: FileInfo = {
            name: dirName,
            path: baseDir + '/' + dirPath,
            isDirectory: true
          };
          matchingDirs.push(virtualDir);
        }
      }
    }

    // Remove duplicate directories by name (keep shortest path)
    const uniqueDirs = Array.from(seenDirNames.entries()).map(([name, info]) => {
      return matchingDirs.find(d => d.name === name && d.path === baseDir + '/' + info.path);
    }).filter((d): d is FileInfo => d !== undefined);

    // Score directories
    const scoredDirs = uniqueDirs.map(dir => ({
      file: dir,
      score: calculateMatchScore(dir, queryLower),
      relativePath: getRelativePath(dir.path, baseDir)
    }));

    // Combine and sort by score
    const allScored = [...scoredFiles, ...scoredDirs]
      .sort((a, b) => b.score - a.score)
      .slice(0, maxSuggestions);

    return allScored.map(item => item.file);
  }
}
