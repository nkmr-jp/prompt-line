/**
 * FileFilterManager - Handles file filtering, scoring, and suggestion merging
 *
 * Extracted from FileSearchManager to improve modularity and reduce file size.
 * Responsibilities:
 * - Filter files based on query (fuzzy matching)
 * - Count files in directories
 * - Adjust current path based on query navigation
 * - Merge and sort file/agent suggestions
 *
 * Delegates to:
 * - SubdirectoryFilterManager: Subdirectory filtering logic
 * - RootFilterManager: Root-level filtering and search
 */

import type { FileInfo, AgentItem } from '../../../types';
import type { DirectoryData, SuggestionItem } from '../types';
import { getRelativePath, calculateMatchScore, calculateAgentMatchScore } from '../index';
import { SubdirectoryFilterManager } from './subdirectory-filter-manager';
import { RootFilterManager } from './root-filter-manager';

/**
 * Callbacks for FileFilterManager
 */
export interface FileFilterCallbacks {
  /** Get default max suggestions limit */
  getDefaultMaxSuggestions: () => number;
}

/**
 * FileFilterManager handles all file filtering and suggestion merging logic
 */
export class FileFilterManager {
  private callbacks: FileFilterCallbacks;
  private subdirectoryFilterManager: SubdirectoryFilterManager;
  private rootFilterManager: RootFilterManager;

  constructor(callbacks: FileFilterCallbacks) {
    this.callbacks = callbacks;
    
    // Initialize delegated managers with required callbacks
    this.subdirectoryFilterManager = new SubdirectoryFilterManager({
      sortByDirectoryFirst: this.sortByDirectoryFirst.bind(this)
    });
    
    this.rootFilterManager = new RootFilterManager({
      sortByDirectoryFirst: this.sortByDirectoryFirst.bind(this)
    });
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
   * @returns Filtered and scored files
   */
  public filterFiles(
    cachedData: DirectoryData | null,
    currentPath: string,
    query: string
  ): FileInfo[] {
    if (!cachedData?.files) return [];

    const baseDir = cachedData.directory;
    const allFiles = cachedData.files;
    const maxSuggestions = this.callbacks.getDefaultMaxSuggestions();

    // If we're in a subdirectory, filter to show only direct children
    if (currentPath) {
      return this.subdirectoryFilterManager.filterFilesInSubdirectory(
        allFiles,
        baseDir,
        currentPath,
        query,
        maxSuggestions
      );
    }

    // At root level
    return this.rootFilterManager.filterFilesAtRoot(allFiles, baseDir, query, maxSuggestions);
  }

  /**
   * Sort files with directories first, then by name
   * Used as callback for delegated managers
   */
  private sortByDirectoryFirst(files: FileInfo[]): FileInfo[] {
    return [...files].sort((a, b) => {
      // Directories come first
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
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
    const dirRelativePath = getRelativePath(dirPath, baseDir);
    const dirPrefix = dirRelativePath.endsWith('/') ? dirRelativePath : dirRelativePath + '/';

    let count = 0;
    const seenChildren = new Set<string>();

    for (const file of cachedData.files) {
      const relativePath = getRelativePath(file.path, baseDir);

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
   * @param filteredFiles - Pre-filtered files
   * @param filteredAgents - Pre-filtered agents
   * @param query - Search query
   * @param maxSuggestions - Maximum suggestions to return
   * @returns Merged and sorted suggestions
   */
  public mergeSuggestions(
    filteredFiles: FileInfo[],
    filteredAgents: AgentItem[],
    query: string,
    maxSuggestions?: number
  ): SuggestionItem[] {
    const items: SuggestionItem[] = [];
    const queryLower = query.toLowerCase();

    // Add files with scores
    for (const file of filteredFiles) {
      const score = calculateMatchScore(file, queryLower);
      items.push({ type: 'file', file, score });
    }

    // Add agents with scores
    for (const agent of filteredAgents) {
      const score = calculateAgentMatchScore(agent, queryLower);
      items.push({ type: 'agent', agent, score });
    }

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
        const bName = b.type === 'file' ? b.file?.name || '' : b.agent?.name || '';
        return aName.localeCompare(bName);
      });
    } else {
      // Sort by score descending
      items.sort((a, b) => b.score - a.score);
    }

    // Limit to maxSuggestions
    const limit = maxSuggestions ?? this.callbacks.getDefaultMaxSuggestions();
    return items.slice(0, limit);
  }
}
