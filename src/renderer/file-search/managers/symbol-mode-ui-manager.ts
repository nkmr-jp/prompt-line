/**
 * SymbolModeUIManager - Handles symbol mode UI rendering and interactions
 *
 * Extracted from FileSearchManager to improve modularity and reduce file size.
 * Responsibilities:
 * - Show symbol suggestions in a file
 * - Render symbol items with icons and metadata
 * - Exit symbol mode and restore file suggestions
 * - Expand current file (insert file path)
 */

import type { SuggestionItem } from '../types';
import type { SymbolResult } from '../../code-search/types';
import { getSymbolTypeDisplay } from '../../code-search/types';
import { getSymbolIconSvg } from '../../assets/icons/file-icons';
import { insertSvgIntoElement } from '../index';

/**
 * Callbacks for SymbolModeUIManager
 */
export interface SymbolModeUICallbacks {
  /** Get the suggestions container element */
  getSuggestionsContainer: () => HTMLElement | null;
  /** Get the current file symbols */
  getCurrentFileSymbols: () => SymbolResult[];
  /** Set merged suggestions */
  setMergedSuggestions: (suggestions: SuggestionItem[]) => void;
  /** Get merged suggestions */
  getMergedSuggestions: () => SuggestionItem[];
  /** Get selected index */
  getSelectedIndex: () => number;
  /** Set selected index */
  setSelectedIndex: (index: number) => void;
  /** Set visibility */
  setIsVisible: (visible: boolean) => void;
  /** Get current file path */
  getCurrentFilePath: () => string;
  /** Get at start position */
  getAtStartPosition: () => number;
  /** Update selection (highlight) */
  updateSelection: () => void;
  /** Select a symbol */
  selectSymbol: (symbol: SymbolResult) => void;
  /** Position popup via SuggestionListManager */
  positionPopup: (atStartPosition: number) => void;
  /** Update hint text */
  updateHintText?: ((text: string) => void) | undefined;
  /** Get default hint text */
  getDefaultHintText?: (() => string) | undefined;
  /** Get file search max suggestions */
  getFileSearchMaxSuggestions: () => Promise<number>;
  /** Show file suggestions (for exiting symbol mode) */
  showSuggestions: (query: string) => void;
  /** Insert file path */
  insertFilePath: (path: string) => void;
  /** Hide suggestions */
  hideSuggestions: () => void;
  /** Notify file selected */
  onFileSelected: (path: string) => void;
  /** Set current query */
  setCurrentQuery: (query: string) => void;
  /** Get current path */
  getCurrentPath: () => string;
}

/**
 * State for symbol mode
 */
export interface SymbolModeState {
  isInSymbolMode: boolean;
  currentFilePath: string;
  currentFileSymbols: SymbolResult[];
}

/**
 * SymbolModeUIManager handles symbol mode UI rendering and interactions
 */
export class SymbolModeUIManager {
  private callbacks: SymbolModeUICallbacks;
  private state: SymbolModeState;

  constructor(callbacks: SymbolModeUICallbacks) {
    this.callbacks = callbacks;
    this.state = {
      isInSymbolMode: false,
      currentFilePath: '',
      currentFileSymbols: []
    };
  }

  /**
   * Get symbol mode state
   */
  public getState(): SymbolModeState {
    return this.state;
  }

  /**
   * Set symbol mode state
   */
  public setState(newState: Partial<SymbolModeState>): void {
    this.state = { ...this.state, ...newState };
  }

  /**
   * Check if in symbol mode
   */
  public isInSymbolMode(): boolean {
    return this.state.isInSymbolMode;
  }

  /**
   * Show symbol suggestions for the current file
   * @param query - Search query to filter symbols
   */
  public async showSymbolSuggestions(query: string): Promise<void> {
    const suggestionsContainer = this.callbacks.getSuggestionsContainer();
    if (!suggestionsContainer) return;

    // Filter symbols by query
    let filtered = this.state.currentFileSymbols;
    if (query) {
      const lowerQuery = query.toLowerCase();
      filtered = this.state.currentFileSymbols.filter(s =>
        s.name.toLowerCase().includes(lowerQuery) ||
        s.lineContent.toLowerCase().includes(lowerQuery)
      );

      // Sort by relevance
      filtered.sort((a, b) => {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();
        const aStarts = aName.startsWith(lowerQuery);
        const bStarts = bName.startsWith(lowerQuery);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return aName.localeCompare(bName);
      });
    }

    // Limit results using fileSearch settings (not mdSearch)
    const maxSuggestions = await this.callbacks.getFileSearchMaxSuggestions();
    filtered = filtered.slice(0, maxSuggestions);

    // Convert to SuggestionItem
    const mergedSuggestions: SuggestionItem[] = filtered.map((symbol, index) => ({
      type: 'symbol' as const,
      symbol,
      score: 1000 - index
    }));
    this.callbacks.setMergedSuggestions(mergedSuggestions);

    // Set selectedIndex = -1 (unselected state, like directory navigation)
    // Tab/Enter will insert file path when nothing is selected
    this.callbacks.setSelectedIndex(-1);

    // Clear and render
    suggestionsContainer.innerHTML = '';
    const fragment = document.createDocumentFragment();

    // Add file path header (like directory header in renderSuggestions)
    const currentFilePath = this.state.currentFilePath;
    if (currentFilePath) {
      const header = document.createElement('div');
      header.className = 'file-suggestion-header';
      header.textContent = currentFilePath;
      fragment.appendChild(header);
    }

    if (mergedSuggestions.length === 0) {
      this.callbacks.updateHintText?.(`No symbols matching "${query}" in ${currentFilePath}`);
    }

    // Render symbol items
    mergedSuggestions.forEach((suggestion, index) => {
      if (suggestion.symbol) {
        const item = this.renderSymbolItem(suggestion.symbol, index);
        fragment.appendChild(item);
      }
    });

    suggestionsContainer.appendChild(fragment);

    // Update hint
    if (mergedSuggestions.length > 0) {
      this.callbacks.updateHintText?.(`${mergedSuggestions.length} symbols in ${currentFilePath}`);
    }

    // Position and show (delegate positioning to SuggestionListManager)
    this.callbacks.positionPopup(this.callbacks.getAtStartPosition());
    suggestionsContainer.style.display = 'block';
    this.callbacks.setIsVisible(true);
  }

  /**
   * Render a single symbol item
   * @param symbol - Symbol to render
   * @param index - Index in the list
   * @returns The rendered HTMLElement
   */
  public renderSymbolItem(symbol: SymbolResult, index: number): HTMLElement {
    const item = document.createElement('div');
    item.className = 'file-suggestion-item symbol-item';
    item.dataset.index = String(index);

    if (index === this.callbacks.getSelectedIndex()) {
      item.classList.add('selected');
    }

    // Symbol type icon
    const iconSpan = document.createElement('span');
    iconSpan.className = 'file-icon symbol-icon';
    const iconSvg = getSymbolIconSvg(symbol.type);
    insertSvgIntoElement(iconSpan, iconSvg);
    item.appendChild(iconSpan);

    // Symbol name
    const nameSpan = document.createElement('span');
    nameSpan.className = 'file-name';
    nameSpan.textContent = symbol.name;
    item.appendChild(nameSpan);

    // Symbol type badge
    const typeBadge = document.createElement('span');
    typeBadge.className = 'file-suggestion-type';
    typeBadge.textContent = getSymbolTypeDisplay(symbol.type);
    item.appendChild(typeBadge);

    // Line number
    const lineSpan = document.createElement('span');
    lineSpan.className = 'file-path';
    lineSpan.textContent = `:${symbol.lineNumber}`;
    item.appendChild(lineSpan);

    // Mouse events
    item.addEventListener('mousemove', () => {
      this.callbacks.setSelectedIndex(index);
      this.callbacks.updateSelection();
    });

    item.addEventListener('click', () => {
      this.callbacks.selectSymbol(symbol);
    });

    return item;
  }

  /**
   * Exit symbol mode and restore file suggestions
   */
  public exitSymbolMode(): void {
    this.state.isInSymbolMode = false;
    this.state.currentFilePath = '';
    this.state.currentFileSymbols = [];
    this.callbacks.setCurrentQuery('');

    // Restore default hint text
    if (this.callbacks.getDefaultHintText) {
      this.callbacks.updateHintText?.(this.callbacks.getDefaultHintText());
    }

    // Re-show file suggestions
    this.callbacks.showSuggestions(this.callbacks.getCurrentPath() || '');
  }

  /**
   * Expand current file (insert file path without selecting a symbol)
   */
  public expandCurrentFile(): void {
    const currentFilePath = this.state.currentFilePath;
    if (!currentFilePath) return;

    // Insert file path (with trailing space)
    this.callbacks.insertFilePath(currentFilePath);
    this.callbacks.hideSuggestions();

    // Callback for external handling
    this.callbacks.onFileSelected(currentFilePath);
  }
}
