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
import type { AgentItem, FileInfo } from '../../../types';

export interface SuggestionStateCallbacks {
  // State getters
  getCachedDirectoryData: () => DirectoryData | null;
  getAtStartPosition: () => number;
  getCurrentPath: () => string;
  getCurrentQuery: () => string;
  getFilteredFiles: () => FileInfo[];
  getFilteredAgents: () => AgentItem[];
  getMergedSuggestions: () => SuggestionItem[];
  getSelectedIndex: () => number;

  // State setters
  setCurrentPath: (path: string) => void;
  setCurrentQuery: (query: string) => void;
  setFilteredFiles: (files: FileInfo[]) => void;
  setFilteredAgents: (agents: AgentItem[]) => void;
  setMergedSuggestions: (suggestions: SuggestionItem[]) => void;
  setSelectedIndex: (index: number) => void;
  setIsVisible: (visible: boolean) => void;

  // Operations
  adjustCurrentPathToQuery: (query: string) => void;
  filterFiles: (query: string) => FileInfo[];
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
    this.logShowSuggestionsStart(query);

    const matchesPrefix = await this.callbacks.matchesSearchPrefix(query, 'mention');
    this.updateCurrentPath(query, matchesPrefix);

    const searchTerm = this.extractSearchTerm(query);
    this.callbacks.setCurrentQuery(searchTerm);

    await this.fetchAndFilterData(searchTerm, matchesPrefix);

    const merged = await this.mergeAndPrepareSuggestions(searchTerm);
    const isIndexBuilding = this.callbacks.isIndexBeingBuilt();

    this.updateVisibilityAndHints(isIndexBuilding, matchesPrefix);
    this.logShowSuggestionsFiltered(searchTerm, merged, isIndexBuilding, matchesPrefix);

    this.renderSuggestions(merged, isIndexBuilding && !matchesPrefix);

    this.logShowSuggestionsComplete();
  }

  /**
   * Log start of showSuggestions
   */
  private logShowSuggestionsStart(query: string): void {
    console.debug('[SuggestionStateManager] showSuggestions called', {
      query,
      currentPath: this.callbacks.getCurrentPath(),
      hasCachedData: !!this.callbacks.getCachedDirectoryData()
    });
  }

  /**
   * Update current path based on query and prefix match
   */
  private updateCurrentPath(query: string, matchesPrefix: boolean): void {
    if (!matchesPrefix) {
      this.callbacks.adjustCurrentPathToQuery(query);
    } else {
      this.callbacks.setCurrentPath('');
    }
  }

  /**
   * Extract search term from query
   */
  private extractSearchTerm(query: string): string {
    const currentPath = this.callbacks.getCurrentPath();
    return currentPath ? query.substring(currentPath.length) : query;
  }

  /**
   * Fetch agents and filter files
   */
  private async fetchAndFilterData(searchTerm: string, matchesPrefix: boolean): Promise<void> {
    await this.fetchAgents(searchTerm);
    this.filterFiles(searchTerm, matchesPrefix);
  }

  /**
   * Fetch agents if at root level
   */
  private async fetchAgents(searchTerm: string): Promise<void> {
    const currentPath = this.callbacks.getCurrentPath();
    if (!currentPath) {
      const agents = await this.callbacks.searchAgents(searchTerm);
      this.callbacks.setFilteredAgents(agents);
    } else {
      this.callbacks.setFilteredAgents([]);
    }
  }

  /**
   * Filter files based on search term
   */
  private filterFiles(searchTerm: string, matchesPrefix: boolean): void {
    if (matchesPrefix) {
      this.callbacks.setFilteredFiles([]);
    } else if (this.callbacks.getCachedDirectoryData()) {
      const filtered = this.callbacks.filterFiles(searchTerm);
      this.callbacks.setFilteredFiles(filtered);
    } else {
      this.callbacks.setFilteredFiles([]);
    }
  }

  /**
   * Merge suggestions and prepare for display
   */
  private async mergeAndPrepareSuggestions(searchTerm: string): Promise<SuggestionItem[]> {
    const maxSuggestions = await this.callbacks.getMaxSuggestions('mention');
    const merged = this.callbacks.mergeSuggestions(searchTerm, maxSuggestions);
    this.callbacks.setMergedSuggestions(merged);
    return merged;
  }

  /**
   * Update visibility and hints
   */
  private updateVisibilityAndHints(isIndexBuilding: boolean, matchesPrefix: boolean): void {
    this.callbacks.setSelectedIndex(0);
    this.callbacks.setIsVisible(true);

    if (isIndexBuilding && !matchesPrefix) {
      this.callbacks.showIndexingHint();
    }
  }

  /**
   * Log filtered results
   */
  private logShowSuggestionsFiltered(
    searchTerm: string,
    merged: SuggestionItem[],
    isIndexBuilding: boolean,
    matchesPrefix: boolean
  ): void {
    console.debug('[SuggestionStateManager] showSuggestions: filtered', {
      agents: this.callbacks.getFilteredAgents().length,
      files: this.callbacks.getFilteredFiles().length,
      merged: merged.length,
      searchTerm,
      isIndexBuilding,
      matchesPrefix
    });
  }

  /**
   * Render suggestions and update tooltip
   */
  private renderSuggestions(merged: SuggestionItem[], showPath: boolean): void {
    this.callbacks.showSuggestionList(merged, this.callbacks.getAtStartPosition(), showPath);
    this.callbacks.showTooltipForSelectedItem();
  }

  /**
   * Log completion of showSuggestions
   */
  private logShowSuggestionsComplete(): void {
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
