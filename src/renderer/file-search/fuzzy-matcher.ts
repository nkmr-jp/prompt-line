/**
 * Fuzzy matching module for file and agent search
 * Extracted from FileSearchManager for improved modularity and testability
 */

import type { FileInfo, AgentItem } from '../../types';
import type { DirectoryData, SuggestionItem } from './types';

export class FileSearchFuzzyMatcher {
  private getCachedDirectoryData: () => DirectoryData | null;
  private DEFAULT_MAX_SUGGESTIONS: number;

  constructor(
    getCachedDirectoryData: () => DirectoryData | null,
    DEFAULT_MAX_SUGGESTIONS: number
  ) {
    this.getCachedDirectoryData = getCachedDirectoryData;
    this.DEFAULT_MAX_SUGGESTIONS = DEFAULT_MAX_SUGGESTIONS;
  }

  /**
   * Filter files based on query and current path
   * Handles directory navigation and fuzzy matching
   */
  public filterFiles(query: string, currentPath: string): FileInfo[] {
    const cachedDirectoryData = this.getCachedDirectoryData();
    if (!cachedDirectoryData?.files) return [];

    const baseDir = cachedDirectoryData.directory;
    const allFiles = cachedDirectoryData.files;
    let files: FileInfo[] = [];

    // If we're in a subdirectory, filter to show only direct children
    // Also create virtual directory entries for intermediate directories
    if (currentPath) {
      const seenDirs = new Set<string>();

      for (const file of allFiles) {
        const relativePath = this.getRelativePath(file.path, baseDir);

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
        const sorted = [...files].sort((a, b) => {
          // Directories come first
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          // Then sort by name
          return a.name.localeCompare(b.name);
        });
        return sorted.slice(0, this.DEFAULT_MAX_SUGGESTIONS);
      }

      const queryLower = query.toLowerCase();

      // Score and filter files
      const scored = files
        .map(file => ({
          file,
          score: this.calculateMatchScore(file, queryLower)
        }))
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, this.DEFAULT_MAX_SUGGESTIONS);

      return scored.map(item => item.file);
    }

    // At root level
    if (!query) {
      // No query - show top-level files and directories only
      const seenDirs = new Set<string>();

      for (const file of allFiles) {
        const relativePath = this.getRelativePath(file.path, baseDir);
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
              f.isDirectory && this.getRelativePath(f.path, baseDir) === dirName
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

      // Return first N files if no query, with directories first
      const sorted = [...files].sort((a, b) => {
        // Directories come first
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        // Then sort by name
        return a.name.localeCompare(b.name);
      });
      return sorted.slice(0, this.DEFAULT_MAX_SUGGESTIONS);
    }

    // With query at root level - search ALL files recursively and show matching ones
    // Also include matching directories
    const queryLower = query.toLowerCase();
    const seenDirs = new Set<string>();
    const matchingDirs: FileInfo[] = [];

    // First, find all matching files (from anywhere in the tree)
    const scoredFiles = allFiles
      .filter(file => !file.isDirectory)
      .map(file => ({
        file,
        score: this.calculateMatchScore(file, queryLower),
        relativePath: this.getRelativePath(file.path, baseDir)
      }))
      .filter(item => item.score > 0);

    // Also find matching directories (by path containing the query)
    // Track seen directory names to avoid duplicates from symlinks
    const seenDirNames = new Map<string, { path: string; depth: number }>();

    for (const file of allFiles) {
      const relativePath = this.getRelativePath(file.path, baseDir);
      const pathParts = relativePath.split('/').filter(p => p);

      // Check each directory in the path (except the last part which is the file name)
      for (let i = 0; i < pathParts.length - 1; i++) {
        const dirPath = pathParts.slice(0, i + 1).join('/');
        const dirName = pathParts[i] || '';

        if (!dirName || seenDirs.has(dirPath)) continue;

        // Check if directory name or path matches query
        if (dirName.toLowerCase().includes(queryLower) || dirPath.toLowerCase().includes(queryLower)) {
          seenDirs.add(dirPath);

          // Check if we already have a directory with the same name
          // Prefer the one with shorter path (likely the original, not symlink-resolved)
          const depth = pathParts.length;
          const existing = seenDirNames.get(dirName);
          if (existing && existing.depth <= depth) {
            continue; // Skip this one, we already have a shorter path
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

    // Score directories (use uniqueDirs to avoid duplicates from symlinks)
    const scoredDirs = uniqueDirs.map(dir => ({
      file: dir,
      score: this.calculateMatchScore(dir, queryLower),
      relativePath: this.getRelativePath(dir.path, baseDir)
    }));

    // Combine and sort by score
    const allScored = [...scoredFiles, ...scoredDirs]
      .sort((a, b) => b.score - a.score)
      .slice(0, this.DEFAULT_MAX_SUGGESTIONS);

    return allScored.map(item => item.file);
  }

  /**
   * Calculate match score for a file
   * Higher score = better match
   */
  public calculateMatchScore(file: FileInfo, queryLower: string): number {
    const nameLower = file.name.toLowerCase();
    const pathLower = file.path.toLowerCase();

    let score = 0;

    // Exact name match
    if (nameLower === queryLower) {
      score += 1000;
    }
    // Name starts with query
    else if (nameLower.startsWith(queryLower)) {
      score += 500;
    }
    // Name contains query
    else if (nameLower.includes(queryLower)) {
      score += 200;
    }
    // Path contains query
    else if (pathLower.includes(queryLower)) {
      score += 50;
    }
    // Fuzzy match on name
    else if (this.fuzzyMatch(nameLower, queryLower)) {
      score += 10;
    }

    // Bonus for files (not directories)
    if (!file.isDirectory) {
      score += 5;
    }

    // Bonus for shorter paths
    score += Math.max(0, 20 - pathLower.split('/').length);

    return score;
  }

  /**
   * Simple fuzzy matching
   */
  public fuzzyMatch(text: string, pattern: string): boolean {
    let patternIdx = 0;

    for (let i = 0; i < text.length && patternIdx < pattern.length; i++) {
      if (text[i] === pattern[patternIdx]) {
        patternIdx++;
      }
    }

    return patternIdx === pattern.length;
  }

  /**
   * Count files in a directory (direct children only)
   */
  public countFilesInDirectory(dirPath: string): number {
    const cachedDirectoryData = this.getCachedDirectoryData();
    if (!cachedDirectoryData?.files) return 0;

    const baseDir = cachedDirectoryData.directory;
    const dirRelativePath = this.getRelativePath(dirPath, baseDir);
    const dirPrefix = dirRelativePath.endsWith('/') ? dirRelativePath : dirRelativePath + '/';

    let count = 0;
    const seenChildren = new Set<string>();

    for (const file of cachedDirectoryData.files) {
      const relativePath = this.getRelativePath(file.path, baseDir);

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
   * @param maxSuggestions - Optional limit for results (uses DEFAULT_MAX_SUGGESTIONS if not provided)
   */
  public mergeSuggestions(
    query: string,
    filteredFiles: FileInfo[],
    filteredAgents: AgentItem[],
    calculateAgentScore: (agent: AgentItem, query: string) => number,
    maxSuggestions?: number
  ): SuggestionItem[] {
    const items: SuggestionItem[] = [];
    const queryLower = query.toLowerCase();

    // Add files with scores
    for (const file of filteredFiles) {
      const score = this.calculateMatchScore(file, queryLower);
      items.push({ type: 'file', file, score });
    }

    // Add agents with scores
    for (const agent of filteredAgents) {
      const score = calculateAgentScore(agent, queryLower);
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

    // Limit to maxSuggestions (use provided value or fallback to DEFAULT_MAX_SUGGESTIONS)
    const limit = maxSuggestions ?? this.DEFAULT_MAX_SUGGESTIONS;
    return items.slice(0, limit);
  }

  /**
   * Calculate match score for an agent
   */
  public calculateAgentMatchScore(agent: AgentItem, queryLower: string): number {
    if (!queryLower) return 50; // Base score for no query

    const nameLower = agent.name.toLowerCase();
    const descLower = agent.description.toLowerCase();

    let score = 0;

    // Exact name match
    if (nameLower === queryLower) {
      score += 1000;
    }
    // Name starts with query
    else if (nameLower.startsWith(queryLower)) {
      score += 500;
    }
    // Name contains query
    else if (nameLower.includes(queryLower)) {
      score += 200;
    }
    // Description contains query
    else if (descLower.includes(queryLower)) {
      score += 50;
    }

    return score;
  }

  /**
   * Get relative path from base directory
   */
  public getRelativePath(fullPath: string, baseDir: string): string {
    // If baseDir is empty or root '/', return fullPath as-is (it's already absolute)
    if (!baseDir || baseDir === '/') {
      return fullPath;
    }
    if (fullPath.startsWith(baseDir)) {
      const relative = fullPath.substring(baseDir.length);
      return relative.startsWith('/') ? relative.substring(1) : relative;
    }
    return fullPath;
  }

  /**
   * Search agents via IPC
   */
  public async searchAgents(query: string, getMaxSuggestions: () => Promise<number>): Promise<AgentItem[]> {
    try {
      const electronAPI = (window as any).electronAPI;
      if (electronAPI?.agents?.get) {
        const agents = await electronAPI.agents.get(query);
        const maxSuggestions = await getMaxSuggestions();
        return agents.slice(0, maxSuggestions);
      }
    } catch (error) {
      console.error('[FileSearchFuzzyMatcher] Failed to search agents:', error);
    }
    return [];
  }
}
