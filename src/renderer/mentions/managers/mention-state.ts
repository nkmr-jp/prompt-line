/**
 * MentionState - Shared state management for MentionManager
 *
 * Extracts state properties from MentionManager to:
 * 1. Reduce MentionManager's line count
 * 2. Allow sub-managers to directly access/modify state
 * 3. Simplify callback patterns
 */

import type { FileInfo, AgentItem } from '../../../types';
import type { SymbolResult } from '../code-search/types';
import type { AtPathRange, SuggestionItem } from '../types';

/**
 * Centralized state container for file search functionality
 */
export class MentionState {
  // Core state
  suggestionsContainer: HTMLElement | null = null;
  textInput: HTMLTextAreaElement | null = null;
  highlightBackdrop: HTMLDivElement | null = null;
  mirrorDiv: HTMLDivElement | null = null;

  // Directory data is now managed by DirectoryCacheManager
  // cachedDirectoryData removed - use directoryCacheManager.getCachedData() instead

  // Selection and navigation
  selectedIndex: number = 0;
  currentPath: string = '';
  currentQuery: string = '';
  atStartPosition: number = -1;

  // Visibility
  isVisible: boolean = false;
  fileSearchEnabled: boolean = false;

  // Filtered results
  filteredFiles: FileInfo[] = [];
  filteredAgents: AgentItem[] = [];
  filteredSymbols: SymbolResult[] = [];
  mergedSuggestions: SuggestionItem[] = [];

  // Path tracking
  atPaths: AtPathRange[] = [];
  selectedPaths: Set<string> = new Set();

  // Code search state
  codeSearchQuery: string = '';
  codeSearchLanguage: string = '';
  codeSearchCacheRefreshed: boolean = false;

  /**
   * Reset search state to initial values
   */
  resetSearchState(): void {
    this.selectedIndex = 0;
    this.currentPath = '';
    this.currentQuery = '';
    this.isVisible = false;
    this.filteredFiles = [];
    this.filteredAgents = [];
    this.filteredSymbols = [];
    this.mergedSuggestions = [];
  }

  /**
   * Reset code search state
   */
  resetCodeSearchState(): void {
    this.codeSearchQuery = '';
    this.codeSearchLanguage = '';
    this.codeSearchCacheRefreshed = false;
  }

  /**
   * Add a path to selected paths
   */
  addSelectedPath(path: string): void {
    this.selectedPaths.add(path);
  }

  /**
   * Remove a path from selected paths
   */
  removeSelectedPath(path: string): void {
    this.selectedPaths.delete(path);
  }

  /**
   * Clear all selected paths
   */
  clearSelectedPaths(): void {
    this.selectedPaths.clear();
  }

  /**
   * Get total item count across all suggestion types
   */
  getTotalItemCount(): number {
    return this.mergedSuggestions.length;
  }
}

export default MentionState;
