/**
 * Symbol Search Handler
 * Handles symbol search operations and UI updates
 */

import type { SymbolResult } from '../../code-search/types';
import type { DirectoryData, SuggestionItem } from '../types';
import type { CodeSearchManager } from './code-search-manager';
import type { SuggestionUIManager } from './suggestion-ui-manager';
import type { PopupManager } from './popup-manager';

/**
 * Dependencies required by SymbolSearchHandler
 */
export interface SymbolSearchDependencies {
  codeSearchManager: CodeSearchManager | null;
  suggestionUIManager: SuggestionUIManager | null;
  popupManager: PopupManager;
  getCachedDirectoryData: () => DirectoryData | null;
  getAtStartPosition: () => number;
  updateHintText?: (text: string) => void;
  hideSuggestions: () => void;
  // State setters
  setFilteredSymbols: (symbols: SymbolResult[]) => void;
  setFilteredFiles: (files: never[]) => void;
  setFilteredAgents: (agents: never[]) => void;
  setMergedSuggestions: (suggestions: SuggestionItem[]) => void;
  setSelectedIndex: (index: number) => void;
  setIsVisible: (visible: boolean) => void;
}

/**
 * Handles symbol search operations
 */
export class SymbolSearchHandler {
  constructor(private readonly deps: SymbolSearchDependencies) {}

  /**
   * Search for symbols using ripgrep
   * Delegates filtering logic to CodeSearchManager
   */
  public async searchSymbols(
    language: string,
    query: string,
    symbolTypeFilter: string | null = null,
    refreshCache: boolean = false
  ): Promise<void> {
    const cachedData = this.deps.getCachedDirectoryData();
    if (!cachedData?.directory || !this.deps.codeSearchManager) {
      console.debug('[SymbolSearchHandler] searchSymbols: no directory or manager');
      return;
    }

    // Delegate filtering/sorting to CodeSearchManager
    const filtered = await this.deps.codeSearchManager.searchSymbols(
      cachedData.directory,
      language,
      query,
      { symbolTypeFilter, refreshCache }
    );

    // Limit results and update state
    const maxSuggestions = 20;
    this.deps.setFilteredSymbols(filtered.slice(0, maxSuggestions));
    this.deps.setFilteredFiles([]);
    this.deps.setFilteredAgents([]);

    // Convert to SuggestionItems
    const mergedSuggestions = filtered.slice(0, maxSuggestions).map((symbol, index) => ({
      type: 'symbol' as const,
      symbol,
      score: 1000 - index
    }));
    this.deps.setMergedSuggestions(mergedSuggestions);

    this.deps.setSelectedIndex(0);
    this.deps.setIsVisible(true);

    if (mergedSuggestions.length > 0) {
      this.deps.suggestionUIManager?.show(
        mergedSuggestions,
        this.deps.getAtStartPosition(),
        false
      );
      this.deps.popupManager.showTooltipForSelectedItem();
      const langInfo = this.deps.codeSearchManager.getSupportedLanguages().get(language);
      this.deps.updateHintText?.(
        `${filtered.slice(0, maxSuggestions).length} ${langInfo?.displayName || language} symbols`
      );
    } else {
      this.deps.updateHintText?.(`No symbols found for "${query}"`);
      this.deps.hideSuggestions();
    }
  }
}
