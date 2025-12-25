/**
 * Suggestion State Manager
 * Manages suggestion display state and coordination
 *
 * Responsibilities:
 * - Managing suggestion visibility state
 * - Coordinating suggestion display workflow
 * - Managing current query and path state
 * - Handling suggestion list updates
 * - Coordinating with other managers for display
 */

import type { SuggestionItem, DirectoryData } from '../types';
import type { AgentItem } from '../../../types';

export interface SuggestionStateCallbacks {
  // State getters
  getCachedDirectoryData: () => DirectoryData | null;
  getAtStartPosition: () => number;
  getCurrentPath: () => string;
  getCurrentQuery: () => string;
  getFilteredFiles: () => unknown[];
  getFilteredAgents: () => AgentItem[];
  getMergedSuggestions: () => SuggestionItem[];
  getSelectedIndex: () => number;

  // State setters
  setCurrentPath: (path: string) => void;
  setCurrentQuery: (query: string) => void;
  setFilteredFiles: (files: unknown[]) => void;
  setFilteredAgents: (agents: AgentItem[]) => void;
  setMergedSuggestions: (suggestions: SuggestionItem[]) => void;
  setSelectedIndex: (index: number) => void;
  setIsVisible: (visible: boolean) => void;

  // Operations
  adjustCurrentPathToQuery: (query: string) => void;
  filterFiles: (query: string) => unknown[];
  mergeSuggestions: (query: string, maxSuggestions?: number) => SuggestionItem[];
  searchAgents: (query: string) => Promise<AgentItem[]>;
  isIndexBeingBuilt: () => boolean;
  showIndexingHint: () => void;
  showSuggestionList: (suggestions: SuggestionItem[], atPosition: number, showPath: boolean) => void;
  updateSuggestionList: (suggestions: SuggestionItem[], showPath: boolean, selectedIndex: number) => void;
  showTooltipForSelectedItem: () => void;
  matchesSearchPrefix: (query: string, type: 'command' | 'mention') => Promise<boolean>;
  getMaxSuggestions: (type: 'command' | 'mention') => Promise<number>;
  restoreDefaultHint: () => void;
}

export class SuggestionStateManager {
  private callbacks: SuggestionStateCallbacks;

  constructor(callbacks: SuggestionStateCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Show file suggestions based on the query
   */
  public async showSuggestions(query: string): Promise<void> {
    console.debug('[SuggestionStateManager] showSuggestions called', {
      query,
      currentPath: this.callbacks.getCurrentPath(),
      hasCachedData: !!this.callbacks.getCachedDirectoryData()
    });

    // Check if query matches any searchPrefix for mention type
    // If so, skip file search and only show agents
    const matchesPrefix = await this.callbacks.matchesSearchPrefix(query, 'mention');

    // Adjust currentPath based on query
    // Skip path navigation when searchPrefix is matched (agents don't use paths)
    if (!matchesPrefix) {
      this.callbacks.adjustCurrentPathToQuery(query);
    } else {
      this.callbacks.setCurrentPath('');
    }

    // Extract search term (part after currentPath)
    const currentPath = this.callbacks.getCurrentPath();
    const searchTerm = currentPath ? query.substring(currentPath.length) : query;

    this.callbacks.setCurrentQuery(searchTerm);

    // Fetch agents matching the query (only at root level without path navigation)
    if (!currentPath) {
      const agents = await this.callbacks.searchAgents(searchTerm);
      this.callbacks.setFilteredAgents(agents);
    } else {
      this.callbacks.setFilteredAgents([]);
    }

    // Check if index is being built
    const isIndexBuilding = this.callbacks.isIndexBeingBuilt();

    // Filter files if directory data is available
    // Skip file search when searchPrefix is matched (show only agents)
    if (matchesPrefix) {
      this.callbacks.setFilteredFiles([]);
    } else if (this.callbacks.getCachedDirectoryData()) {
      const filtered = this.callbacks.filterFiles(searchTerm);
      this.callbacks.setFilteredFiles(filtered);
    } else {
      this.callbacks.setFilteredFiles([]);
    }

    // Get maxSuggestions setting for merged list
    const maxSuggestions = await this.callbacks.getMaxSuggestions('mention');

    // Merge files and agents into a single sorted list
    const merged = this.callbacks.mergeSuggestions(searchTerm, maxSuggestions);
    this.callbacks.setMergedSuggestions(merged);

    this.callbacks.setSelectedIndex(0);
    this.callbacks.setIsVisible(true);

    // Show indexing hint if index is being built (not relevant when prefix matched)
    if (isIndexBuilding && !matchesPrefix) {
      this.callbacks.showIndexingHint();
    }

    console.debug('[SuggestionStateManager] showSuggestions: filtered', {
      agents: this.callbacks.getFilteredAgents().length,
      files: this.callbacks.getFilteredFiles().length,
      merged: merged.length,
      searchTerm,
      isIndexBuilding,
      matchesPrefix
    });

    // Delegate rendering and positioning to SuggestionListManager
    // Use show() for initial display (includes positioning) instead of update()
    this.callbacks.showSuggestionList(merged, this.callbacks.getAtStartPosition(), isIndexBuilding && !matchesPrefix);

    // Update popup tooltip for selected item
    this.callbacks.showTooltipForSelectedItem();

    console.debug('[SuggestionStateManager] showSuggestions: render complete, isVisible:', true);
  }

  /**
   * Hide the suggestions dropdown
   */
  public hideSuggestions(): void {
    this.callbacks.setIsVisible(false);
    this.callbacks.setFilteredFiles([]);
    this.callbacks.setFilteredAgents([]);
    this.callbacks.setMergedSuggestions([]);
    this.callbacks.setCurrentQuery('');
    this.callbacks.setCurrentPath('');
    this.callbacks.setSelectedIndex(0);

    // Restore default hint text
    this.callbacks.restoreDefaultHint();
  }
}
