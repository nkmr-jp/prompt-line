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

    const filtered = await this.filterAndLimitSymbols(query);
    const mergedSuggestions = this.convertToSuggestionItems(filtered);

    this.callbacks.setMergedSuggestions(mergedSuggestions);
    this.callbacks.setSelectedIndex(-1);

    this.renderSymbolList(suggestionsContainer, mergedSuggestions, query);
    this.showSuggestionPopup();
  }

  /**
   * Filter and limit symbols based on query
   * @param query - Search query
   * @returns Filtered and limited symbols
   */
  private async filterAndLimitSymbols(query: string): Promise<SymbolResult[]> {
    let filtered = this.state.currentFileSymbols;

    if (query) {
      filtered = this.filterSymbolsByQuery(query);
    }

    const maxSuggestions = await this.callbacks.getFileSearchMaxSuggestions();
    return filtered.slice(0, maxSuggestions);
  }

  /**
   * Filter symbols by query
   * @param query - Search query
   * @returns Filtered symbols sorted by relevance
   */
  private filterSymbolsByQuery(query: string): SymbolResult[] {
    const lowerQuery = query.toLowerCase();
    const filtered = this.state.currentFileSymbols.filter(s =>
      s.name.toLowerCase().includes(lowerQuery) ||
      s.lineContent.toLowerCase().includes(lowerQuery)
    );

    filtered.sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();
      const aStarts = aName.startsWith(lowerQuery);
      const bStarts = bName.startsWith(lowerQuery);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return aName.localeCompare(bName);
    });

    return filtered;
  }

  /**
   * Convert symbols to suggestion items
   * @param symbols - Filtered symbols
   * @returns Array of suggestion items
   */
  private convertToSuggestionItems(symbols: SymbolResult[]): SuggestionItem[] {
    return symbols.map((symbol, index) => ({
      type: 'symbol' as const,
      symbol,
      score: 1000 - index
    }));
  }

  /**
   * Render symbol list in container
   * @param container - Container element
   * @param suggestions - Suggestions to render
   * @param query - Search query for hint text
   */
  private renderSymbolList(
    container: HTMLElement,
    suggestions: SuggestionItem[],
    query: string
  ): void {
    container.innerHTML = '';
    const fragment = document.createDocumentFragment();

    this.addFilePathHeader(fragment);

    if (suggestions.length === 0) {
      this.updateNoResultsHint(query);
    } else {
      this.renderSymbolItems(fragment, suggestions);
      this.updateResultsHint(suggestions.length);
    }

    container.appendChild(fragment);
  }

  /**
   * Add file path header to fragment
   * @param fragment - Document fragment
   */
  private addFilePathHeader(fragment: DocumentFragment): void {
    const currentFilePath = this.state.currentFilePath;
    if (currentFilePath) {
      const header = document.createElement('div');
      header.className = 'file-suggestion-header';
      header.textContent = currentFilePath;
      fragment.appendChild(header);
    }
  }

  /**
   * Render symbol items into fragment
   * @param fragment - Document fragment
   * @param suggestions - Suggestions to render
   */
  private renderSymbolItems(fragment: DocumentFragment, suggestions: SuggestionItem[]): void {
    suggestions.forEach((suggestion, index) => {
      if (suggestion.symbol) {
        const item = this.renderSymbolItem(suggestion.symbol, index);
        fragment.appendChild(item);
      }
    });
  }

  /**
   * Update hint text for no results
   * @param query - Search query
   */
  private updateNoResultsHint(query: string): void {
    this.callbacks.updateHintText?.(
      `No symbols matching "${query}" in ${this.state.currentFilePath}`
    );
  }

  /**
   * Update hint text for results
   * @param count - Number of results
   */
  private updateResultsHint(count: number): void {
    this.callbacks.updateHintText?.(
      `${count} symbols in ${this.state.currentFilePath}`
    );
  }

  /**
   * Show suggestion popup
   */
  private showSuggestionPopup(): void {
    const container = this.callbacks.getSuggestionsContainer();
    if (!container) return;

    this.callbacks.positionPopup(this.callbacks.getAtStartPosition());
    container.style.display = 'block';
    this.callbacks.setIsVisible(true);
  }

  /**
   * Render a single symbol item
   * @param symbol - Symbol to render
   * @param index - Index in the list
   * @returns The rendered HTMLElement
   */
  public renderSymbolItem(symbol: SymbolResult, index: number): HTMLElement {
    const item = this.createSymbolItemElement(index);
    this.appendSymbolContent(item, symbol);
    this.attachSymbolItemEvents(item, symbol, index);
    return item;
  }

  /**
   * Create symbol item element with base properties
   * @param index - Index in the list
   * @returns Base symbol item element
   */
  private createSymbolItemElement(index: number): HTMLElement {
    const item = document.createElement('div');
    item.className = 'file-suggestion-item symbol-item';
    item.dataset.index = String(index);

    if (index === this.callbacks.getSelectedIndex()) {
      item.classList.add('selected');
    }

    return item;
  }

  /**
   * Append symbol content elements to item
   * @param item - Item element
   * @param symbol - Symbol data
   */
  private appendSymbolContent(item: HTMLElement, symbol: SymbolResult): void {
    item.appendChild(this.createSymbolIcon(symbol));
    item.appendChild(this.createSymbolName(symbol));
    item.appendChild(this.createSymbolTypeBadge(symbol));
    item.appendChild(this.createSymbolLineNumber(symbol));
  }

  /**
   * Create symbol icon element
   * @param symbol - Symbol data
   * @returns Icon span element
   */
  private createSymbolIcon(symbol: SymbolResult): HTMLElement {
    const iconSpan = document.createElement('span');
    iconSpan.className = 'file-icon symbol-icon';
    const iconSvg = getSymbolIconSvg(symbol.type);
    insertSvgIntoElement(iconSpan, iconSvg);
    return iconSpan;
  }

  /**
   * Create symbol name element
   * @param symbol - Symbol data
   * @returns Name span element
   */
  private createSymbolName(symbol: SymbolResult): HTMLElement {
    const nameSpan = document.createElement('span');
    nameSpan.className = 'file-name';
    nameSpan.textContent = symbol.name;
    return nameSpan;
  }

  /**
   * Create symbol type badge element
   * @param symbol - Symbol data
   * @returns Type badge element
   */
  private createSymbolTypeBadge(symbol: SymbolResult): HTMLElement {
    const typeBadge = document.createElement('span');
    typeBadge.className = 'file-suggestion-type';
    typeBadge.textContent = getSymbolTypeDisplay(symbol.type);
    return typeBadge;
  }

  /**
   * Create symbol line number element
   * @param symbol - Symbol data
   * @returns Line number span element
   */
  private createSymbolLineNumber(symbol: SymbolResult): HTMLElement {
    const lineSpan = document.createElement('span');
    lineSpan.className = 'file-path';
    lineSpan.textContent = `:${symbol.lineNumber}`;
    return lineSpan;
  }

  /**
   * Attach mouse events to symbol item
   * @param item - Item element
   * @param symbol - Symbol data
   * @param index - Index in the list
   */
  private attachSymbolItemEvents(item: HTMLElement, symbol: SymbolResult, index: number): void {
    item.addEventListener('mousemove', () => {
      this.callbacks.setSelectedIndex(index);
      this.callbacks.updateSelection();
    });

    item.addEventListener('click', () => {
      this.callbacks.selectSymbol(symbol);
    });
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
