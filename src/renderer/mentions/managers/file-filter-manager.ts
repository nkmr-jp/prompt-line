/**
 * FileFilterManager - Handles file filtering, scoring, and suggestion merging
 *
 * Consolidated from MentionManager, SubdirectoryFilterManager, and RootFilterManager.
 * This manager now handles all file filtering logic in one place.
 *
 * Responsibilities:
 * - Filter files based on query (fuzzy matching)
 * - Filter files in subdirectories
 * - Filter files at root level with recursive search
 * - Count files in directories
 * - Adjust current path based on query navigation
 * - Merge and sort file/agent suggestions
 */

import type { FileInfo, AgentItem } from '../../../types';
import type { DirectoryData, SuggestionItem } from '../types';
import { getRelativePath, calculateMatchScore, calculateAgentMatchScore, compareTiebreak } from '../index';

/**
 * Callbacks for FileFilterManager
 */
export interface FileFilterCallbacks {
  /** Get default max suggestions limit */
  getDefaultMaxSuggestions: () => number;
  /** Get agent usage bonuses */
  getAgentUsageBonuses?: () => Record<string, number>;
}

/**
 * FileFilterManager handles all file filtering and suggestion merging logic
 */
export class FileFilterManager {
  private callbacks: FileFilterCallbacks;
  private lastQuery: string = '';
  private lastResults: FileInfo[] = [];
  private lastWasTruncated: boolean = false;
  // Optimization 3: Cache for relativePath computations
  private relativePathCache: Map<string, Map<string, string>> = new Map();

  constructor(callbacks: FileFilterCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Get cached relative path or compute and cache it
   * Optimization 3: Avoid repeated relativePath calculations
   */
  private getCachedRelativePath(fullPath: string, baseDir: string): string {
    let baseDirCache = this.relativePathCache.get(baseDir);
    if (!baseDirCache) {
      baseDirCache = new Map<string, string>();
      this.relativePathCache.set(baseDir, baseDirCache);
    }

    let relativePath = baseDirCache.get(fullPath);
    if (relativePath === undefined) {
      relativePath = getRelativePath(fullPath, baseDir);
      baseDirCache.set(fullPath, relativePath);
    }

    return relativePath;
  }

  /**
   * Clear all caches - call when switching to a different base directory
   * Optimization 3: Cache management for directory changes
   */
  public clearCache(): void {
    this.lastQuery = '';
    this.lastResults = [];
    this.lastWasTruncated = false;
    this.relativePathCache.clear();
  }

  /**
   * Adjust currentPath to match the query
   * If query is shorter than currentPath, navigate up to the matching level
   * @param currentPath - Current directory path being browsed
   * @param query - Current search query
   * @returns New path after adjustment
   */
  public adjustCurrentPathToQuery(currentPath: string, query: string): string {
    if (!currentPath) return '';

    // If query starts with currentPath, we're searching within the current directory
    if (query.startsWith(currentPath)) {
      return currentPath;
    }

    // Query doesn't match currentPath, need to navigate up
    // Find the longest common prefix that ends with /
    let newPath = '';
    const parts = currentPath.split('/').filter(p => p);

    for (let i = 0; i < parts.length; i++) {
      const testPath = parts.slice(0, i + 1).join('/') + '/';
      if (query.startsWith(testPath)) {
        newPath = testPath;
      } else {
        break;
      }
    }

    return newPath;
  }

  /**
   * Filter files based on query (fuzzy matching) and currentPath
   * When there's a query at root level, search recursively across all files
   * @param cachedData - Cached directory data
   * @param currentPath - Current directory path being browsed (relative from root)
   * @param query - Search query
   * @param usageBonuses - Optional map of file paths to usage bonuses (only applied during merge, not filter)
   * @returns Filtered files (without scores - scoring happens in mergeSuggestions)
   */
  public filterFiles(
    cachedData: DirectoryData | null,
    currentPath: string,
    query: string,
    usageBonuses?: Record<string, number>
  ): FileInfo[] {
    if (!cachedData?.files) return [];

    const baseDir = cachedData.directory;
    const allFiles = cachedData.files;
    const maxSuggestions = this.callbacks.getDefaultMaxSuggestions();

    // Clear cache when switching between subdirectory and root level
    // or when currentPath changes
    if (currentPath) {
      // In subdirectory - clear incremental search cache (only works at root level)
      this.lastQuery = '';
      this.lastResults = [];
      this.lastWasTruncated = false;
      // Note: Keep relativePathCache as it's valid across directory navigation within same baseDir
      return this.filterFilesInSubdirectory(allFiles, baseDir, currentPath, query, maxSuggestions, usageBonuses);
    }

    // At root level
    return this.filterFilesAtRoot(allFiles, baseDir, query, maxSuggestions, usageBonuses);
  }

  /**
   * Filter files when browsing a subdirectory
   * (Inlined from SubdirectoryFilterManager)
   */
  private filterFilesInSubdirectory(
    allFiles: FileInfo[],
    baseDir: string,
    currentPath: string,
    query: string,
    maxSuggestions: number,
    usageBonuses?: Record<string, number>
  ): FileInfo[] {
    const seenDirs = new Set<string>();
    const files: FileInfo[] = [];

    for (const file of allFiles) {
      const relativePath = this.getCachedRelativePath(file.path, baseDir);

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
      return this.sortByDirectoryFirstAndUsage(files, usageBonuses).slice(0, maxSuggestions);
    }

    // Score and filter files
    const queryLower = query.toLowerCase();
    const scored = files
      .map(file => {
        const bonus = usageBonuses?.[file.path] ?? 0;
        return {
          file,
          score: calculateMatchScore(file, queryLower, bonus, baseDir)
        };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => {
        const scoreDiff = b.score - a.score;
        if (scoreDiff !== 0) return scoreDiff;
        // Tiebreaker: prefer shorter names, then shallower paths
        return compareTiebreak(a.file, b.file, { criteria: ['length', 'pathname'] }, {
          length: (item) => item.name.length,
          pathname: (item) => item.path,
        });
      })
      .slice(0, maxSuggestions);

    return scored.map(item => item.file);
  }

  /**
   * Filter files at root level
   * (Inlined from RootFilterManager)
   */
  private filterFilesAtRoot(
    allFiles: FileInfo[],
    baseDir: string,
    query: string,
    maxSuggestions: number,
    usageBonuses?: Record<string, number>
  ): FileInfo[] {
    if (!query) {
      // No query - clear cache and show top-level files and directories only
      this.lastQuery = '';
      this.lastResults = [];
      this.lastWasTruncated = false;
      return this.getTopLevelFiles(allFiles, baseDir, maxSuggestions, usageBonuses);
    }

    // With query at root level - search ALL files recursively
    return this.searchAllFiles(allFiles, baseDir, query, maxSuggestions, usageBonuses);
  }

  /**
   * Get top-level files and directories (no query)
   * (Inlined from RootFilterManager)
   * Optimization: Pre-build directory map for O(1) lookup
   */
  private getTopLevelFiles(
    allFiles: FileInfo[],
    baseDir: string,
    maxSuggestions: number,
    usageBonuses?: Record<string, number>
  ): FileInfo[] {
    const seenDirs = new Set<string>();
    const files: FileInfo[] = [];

    // Optimization 1: Pre-build directory map for O(1) lookup instead of O(n) find()
    const dirMap = new Map<string, FileInfo>();
    for (const file of allFiles) {
      if (file.isDirectory) {
        dirMap.set(this.getCachedRelativePath(file.path, baseDir), file);
      }
    }

    for (const file of allFiles) {
      const relativePath = this.getCachedRelativePath(file.path, baseDir);
      const slashIndex = relativePath.indexOf('/');

      if (slashIndex === -1) {
        // Top-level file
        files.push(file);
      } else {
        // Has subdirectory - create virtual directory for top-level
        const dirName = relativePath.substring(0, slashIndex);
        if (!seenDirs.has(dirName)) {
          seenDirs.add(dirName);
          // O(1) lookup from pre-built map
          const existingDir = dirMap.get(dirName);
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

    return this.sortByDirectoryFirstAndUsage(files, usageBonuses).slice(0, maxSuggestions);
  }

  /**
   * Search all files recursively with query
   * (Inlined from RootFilterManager)
   * Optimized with incremental search: when query extends previous query,
   * search only in previous results instead of all files.
   * Incremental search is disabled if previous results were truncated to prevent missing candidates.
   */
  private searchAllFiles(
    allFiles: FileInfo[],
    baseDir: string,
    query: string,
    maxSuggestions: number,
    usageBonuses?: Record<string, number>
  ): FileInfo[] {
    // Check if we can use incremental search
    // Query extends previous query AND we have previous results AND previous results were NOT truncated
    const canUseIncrementalSearch = query.startsWith(this.lastQuery) &&
                                    this.lastQuery.length > 0 &&
                                    this.lastResults.length > 0 &&
                                    !this.lastWasTruncated;

    // Select source files: previous results or all files
    const sourceFiles = canUseIncrementalSearch ? this.lastResults : allFiles;

    const queryLower = query.toLowerCase();
    const seenDirs = new Set<string>();
    const seenDirNames = new Map<string, { path: string; depth: number }>();
    const matchingDirs: FileInfo[] = [];

    // Find all matching files (from source files)
    const scoredFiles = sourceFiles
      .filter(file => !file.isDirectory)
      .map(file => {
        const bonus = usageBonuses?.[file.path] ?? 0;
        return {
          file,
          score: calculateMatchScore(file, queryLower, bonus, baseDir),
          relativePath: this.getCachedRelativePath(file.path, baseDir)
        };
      })
      .filter(item => item.score > 0);

    // Find matching directories (by path containing the query)
    // Optimization 2: Use incremental string building instead of slice().join()
    for (const file of sourceFiles) {

      const relativePath = this.getCachedRelativePath(file.path, baseDir);
      const pathParts = relativePath.split('/').filter(p => p);

      // Check each directory in the path (except the last part which is the file name)
      let dirPath = '';
      for (let i = 0; i < pathParts.length - 1; i++) {
        // Incremental path building: O(1) instead of O(m) slice().join()
        if (dirPath) dirPath += '/';
        dirPath += pathParts[i];

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
    const scoredDirs = uniqueDirs.map(dir => {
      const bonus = usageBonuses?.[dir.path] ?? 0;
      return {
        file: dir,
        score: calculateMatchScore(dir, queryLower, bonus, baseDir),
        relativePath: this.getCachedRelativePath(dir.path, baseDir)
      };
    });

    // Combine and sort by score, with tiebreaker for equal scores
    const allScored = [...scoredFiles, ...scoredDirs]
      .sort((a, b) => {
        const scoreDiff = b.score - a.score;
        if (scoreDiff !== 0) return scoreDiff;
        // Tiebreaker: prefer shorter names, then shallower paths
        return compareTiebreak(a.file, b.file, { criteria: ['length', 'pathname'] }, {
          length: (item) => item.name.length,
          pathname: (item) => item.path,
        });
      });

    // Store full results before truncation
    const fullResults = allScored.map(item => item.file);
    const wasTruncated = fullResults.length > maxSuggestions;

    // Cache query and full results (before slice) for next incremental search
    this.lastQuery = query;
    this.lastResults = fullResults;
    this.lastWasTruncated = wasTruncated;

    // Return truncated results
    return fullResults.slice(0, maxSuggestions);
  }

  /**
   * Sort files with directories first, then by usage bonus + name
   */
  private sortByDirectoryFirstAndUsage(files: FileInfo[], usageBonuses?: Record<string, number>): FileInfo[] {
    return [...files].sort((a, b) => {
      // Directories come first
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      // Then sort by usage bonus (higher first)
      const bonusA = usageBonuses?.[a.path] ?? 0;
      const bonusB = usageBonuses?.[b.path] ?? 0;
      if (bonusA !== bonusB) return bonusB - bonusA;
      // Then sort by name
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Count files in a directory (direct children only)
   * @param cachedData - Cached directory data
   * @param dirPath - Directory path to count files in
   * @returns Number of direct children
   */
  public countFilesInDirectory(cachedData: DirectoryData | null, dirPath: string): number {
    if (!cachedData?.files) return 0;

    const baseDir = cachedData.directory;
    const dirRelativePath = this.getCachedRelativePath(dirPath, baseDir);
    const dirPrefix = dirRelativePath.endsWith('/') ? dirRelativePath : dirRelativePath + '/';

    let count = 0;
    const seenChildren = new Set<string>();

    for (const file of cachedData.files) {
      const relativePath = this.getCachedRelativePath(file.path, baseDir);

      if (!relativePath.startsWith(dirPrefix)) continue;

      const remainingPath = relativePath.substring(dirPrefix.length);
      if (!remainingPath) continue;

      // Get the direct child name
      const slashIndex = remainingPath.indexOf('/');
      const childName = slashIndex === -1 ? remainingPath : remainingPath.substring(0, slashIndex);

      if (!seenChildren.has(childName)) {
        seenChildren.add(childName);
        count++;
      }
    }

    return count;
  }

  /**
   * Merge files and agents into a single sorted list based on match score
   * When query is empty, prioritize directories first
   *
   * OPTIMIZATION: Only fetches usage bonuses for top candidates (after initial filtering)
   * This reduces IPC calls from all files to just maxSuggestions items.
   *
   * @param filteredFiles - Pre-filtered files (without scores)
   * @param filteredAgents - Pre-filtered agents
   * @param query - Search query
   * @param maxSuggestions - Maximum suggestions to return
   * @param usageBonuses - Optional map of file paths to usage bonuses (applied to top candidates only)
   * @param baseDir - Optional base directory for relative path calculation
   * @returns Merged and sorted suggestions with scores
   */
  public mergeSuggestions(
    filteredFiles: FileInfo[],
    filteredAgents: AgentItem[],
    query: string,
    maxSuggestions?: number,
    usageBonuses?: Record<string, number>,
    baseDir?: string
  ): SuggestionItem[] {
    const items: SuggestionItem[] = [];
    const queryLower = query.toLowerCase();
    const limit = maxSuggestions ?? this.callbacks.getDefaultMaxSuggestions();

    // OPTIMIZATION: Calculate scores WITHOUT usage bonuses first
    // This allows us to identify top candidates before expensive IPC calls
    const fileItems = filteredFiles.map(file => ({
      type: 'file' as const,
      file,
      score: calculateMatchScore(file, queryLower, 0, baseDir) // No bonus yet
    }));

    // Get agent usage bonuses
    const agentBonuses = this.callbacks.getAgentUsageBonuses?.() ?? {};

    // Add agents with scores (including usage bonuses)
    const agentItems = filteredAgents.map(agent => ({
      type: 'agent' as const,
      agent,
      score: calculateAgentMatchScore(agent, queryLower, agentBonuses[agent.name] ?? 0)
    }));

    // Merge all items
    items.push(...fileItems, ...agentItems);

    // Sort: when no query, directories first then by name; otherwise by score
    if (!query) {
      items.sort((a, b) => {
        // Directories first
        const aIsDir = a.type === 'file' && a.file?.isDirectory;
        const bIsDir = b.type === 'file' && b.file?.isDirectory;
        if (aIsDir && !bIsDir) return -1;
        if (!aIsDir && bIsDir) return 1;

        // Then by name alphabetically
        const aName = a.type === 'file' ? a.file?.name || '' : a.agent?.name || '';
        const bName = b.type === 'file' ? b.file?.name || '' : a.agent?.name || '';
        return aName.localeCompare(bName);
      });
    } else {
      // Sort by score descending (without bonuses first)
      items.sort((a, b) => b.score - a.score);
    }

    // OPTIMIZATION: Take top candidates BEFORE applying usage bonuses
    const topCandidates = items.slice(0, limit);

    // OPTIMIZATION: Apply usage bonuses ONLY to top candidates
    if (usageBonuses && Object.keys(usageBonuses).length > 0) {
      for (const item of topCandidates) {
        if (item.type === 'file' && item.file) {
          const bonus = usageBonuses[item.file.path] ?? 0;
          if (bonus > 0) {
            // Recalculate score with bonus
            item.score = calculateMatchScore(item.file, queryLower, bonus, baseDir);
          }
        }
      }

      // Re-sort top candidates with bonuses applied
      if (query) {
        topCandidates.sort((a, b) => b.score - a.score);
      } else {
        // For no query, re-sort by bonus then name
        topCandidates.sort((a, b) => {
          const aIsDir = a.type === 'file' && a.file?.isDirectory;
          const bIsDir = b.type === 'file' && b.file?.isDirectory;
          if (aIsDir && !bIsDir) return -1;
          if (!aIsDir && bIsDir) return 1;

          // Compare bonuses (higher first)
          const bonusDiff = b.score - a.score;
          if (bonusDiff !== 0) return bonusDiff;

          const aName = a.type === 'file' ? a.file?.name || '' : a.agent?.name || '';
          const bName = b.type === 'file' ? b.file?.name || '' : a.agent?.name || '';
          return aName.localeCompare(bName);
        });
      }
    }

    return topCandidates;
  }
}
