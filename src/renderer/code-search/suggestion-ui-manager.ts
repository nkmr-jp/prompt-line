/**
 * Suggestion UI Manager
 * Handles suggestion UI rendering, positioning, and user interaction
 */

import type { SymbolResult, LanguageInfo, ParsedCodeQuery } from './types';
import { getSymbolTypeDisplay } from './types';
import { getSymbolIconSvg } from '../assets/icons/file-icons';

interface SuggestionUICallbacks {
  onSymbolSelected: (symbol: SymbolResult) => void;
  updateHintText: (text: string) => void;
  getDefaultHintText: () => string;
}

/**
 * SuggestionUIManager class
 * Manages suggestions dropdown UI and interaction
 */
export class SuggestionUIManager {
  private callbacks: SuggestionUICallbacks;
  private textInput: HTMLTextAreaElement | null = null;
  private suggestionsContainer: HTMLDivElement | null = null;
  private isVisible = false;
  private selectedIndex = 0;
  private currentSymbols: SymbolResult[] = [];
  private currentQuery: ParsedCodeQuery | null = null;

  constructor(callbacks: SuggestionUICallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Initialize UI elements
   */
  initialize(): void {
    this.textInput = document.getElementById('textInput') as HTMLTextAreaElement;
    this.createSuggestionsContainer();
    this.setupEventListeners();
  }

  /**
   * Create suggestions container element
   */
  private createSuggestionsContainer(): void {
    if (document.getElementById('code-suggestions')) return;

    this.suggestionsContainer = document.createElement('div');
    this.suggestionsContainer.id = 'code-suggestions';
    this.suggestionsContainer.className = 'code-suggestions';
    this.suggestionsContainer.style.display = 'none';

    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      mainContent.appendChild(this.suggestionsContainer);
    }
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    // Click outside to close
    document.addEventListener('click', (e) => {
      if (this.isVisible && this.suggestionsContainer &&
          !this.suggestionsContainer.contains(e.target as Node) &&
          e.target !== this.textInput) {
        this.hide();
      }
    });
  }

  /**
   * Show suggestions with symbols
   */
  show(symbols: SymbolResult[], query: ParsedCodeQuery, languageInfo: LanguageInfo | undefined): void {
    if (!this.suggestionsContainer || !this.textInput) return;

    this.currentSymbols = symbols;
    this.currentQuery = query;
    this.selectedIndex = 0;

    // Clear and render
    this.suggestionsContainer.innerHTML = '';
    symbols.forEach((symbol, index) => {
      const item = this.createSuggestionItem(symbol, index);
      this.suggestionsContainer!.appendChild(item);
    });

    // Position and display
    this.positionSuggestions();
    this.suggestionsContainer.style.display = 'block';
    this.isVisible = true;

    // Update hint
    this.callbacks.updateHintText(
      `${symbols.length} ${languageInfo?.displayName || ''} symbols`
    );
  }

  /**
   * Hide suggestions
   */
  hide(): void {
    if (this.suggestionsContainer) {
      this.suggestionsContainer.style.display = 'none';
    }
    this.isVisible = false;
    this.currentSymbols = [];
    this.currentQuery = null;
    this.callbacks.updateHintText(this.callbacks.getDefaultHintText());
  }

  /**
   * Check if suggestions are visible
   */
  visible(): boolean {
    return this.isVisible;
  }

  /**
   * Get current symbols
   */
  getSymbols(): SymbolResult[] {
    return this.currentSymbols;
  }

  /**
   * Get current query
   */
  getQuery(): ParsedCodeQuery | null {
    return this.currentQuery;
  }

  /**
   * Create a suggestion item element
   */
  private createSuggestionItem(symbol: SymbolResult, index: number): HTMLDivElement {
    const item = this.createBaseItemElement(index);
    this.appendSymbolContent(item, symbol);
    this.attachItemEventHandlers(item, index);
    return item;
  }

  /**
   * Create base item element with selection state
   */
  private createBaseItemElement(index: number): HTMLDivElement {
    const item = document.createElement('div');
    item.className = 'code-suggestion-item';
    if (index === this.selectedIndex) {
      item.classList.add('selected');
    }
    return item;
  }

  /**
   * Append symbol content (icon, name, type, path) to item
   */
  private appendSymbolContent(item: HTMLDivElement, symbol: SymbolResult): void {
    // Icon (SVG)
    const icon = this.createIconElement(symbol.type);
    item.appendChild(icon);

    // Name and type
    const nameSpan = this.createNameElement(symbol.name);
    item.appendChild(nameSpan);

    const typeSpan = this.createTypeElement(symbol.type);
    item.appendChild(typeSpan);

    // File path
    const pathSpan = this.createPathElement(symbol.relativePath, symbol.lineNumber);
    item.appendChild(pathSpan);
  }

  /**
   * Create icon element
   */
  private createIconElement(symbolType: string): HTMLSpanElement {
    const icon = document.createElement('span');
    icon.className = 'code-suggestion-icon';
    icon.innerHTML = getSymbolIconSvg(symbolType);
    return icon;
  }

  /**
   * Create name element
   */
  private createNameElement(name: string): HTMLSpanElement {
    const nameSpan = document.createElement('span');
    nameSpan.className = 'code-suggestion-name';
    nameSpan.textContent = name;
    return nameSpan;
  }

  /**
   * Create type element
   */
  private createTypeElement(symbolType: string): HTMLSpanElement {
    const typeSpan = document.createElement('span');
    typeSpan.className = 'code-suggestion-type';
    typeSpan.textContent = getSymbolTypeDisplay(symbolType as import('./types').SymbolType);
    return typeSpan;
  }

  /**
   * Create path element
   */
  private createPathElement(relativePath: string, lineNumber: number): HTMLSpanElement {
    const pathSpan = document.createElement('span');
    pathSpan.className = 'code-suggestion-path';
    pathSpan.textContent = `${relativePath}:${lineNumber}`;
    return pathSpan;
  }

  /**
   * Attach event handlers to item
   */
  private attachItemEventHandlers(item: HTMLDivElement, index: number): void {
    item.addEventListener('mouseenter', () => {
      this.selectedIndex = index;
      this.updateSelection();
    });

    item.addEventListener('click', () => {
      this.selectSymbol(index);
    });
  }

  /**
   * Position suggestions dropdown
   * Uses main-content as positioning reference
   */
  private positionSuggestions(): void {
    if (!this.suggestionsContainer || !this.textInput) return;

    // Get main-content for relative positioning
    const mainContent = this.textInput.closest('.main-content');
    if (!mainContent) return;

    const mainContentRect = mainContent.getBoundingClientRect();
    const inputRect = this.textInput.getBoundingClientRect();

    // Calculate position relative to main-content
    const inputTop = inputRect.top - mainContentRect.top;

    // Calculate available space above the input
    const spaceAbove = inputTop - 8; // 8px margin
    const dynamicMaxHeight = Math.max(100, Math.min(300, spaceAbove));

    // Position above input
    const menuHeight = Math.min(this.suggestionsContainer.scrollHeight || dynamicMaxHeight, dynamicMaxHeight);
    const top = Math.max(0, inputTop - menuHeight - 4);

    this.suggestionsContainer.style.maxHeight = `${dynamicMaxHeight}px`;
    this.suggestionsContainer.style.top = `${top}px`;
    this.suggestionsContainer.style.left = '8px';
    this.suggestionsContainer.style.right = '8px';
    this.suggestionsContainer.style.bottom = 'auto';
  }

  /**
   * Select next suggestion
   */
  selectNext(): void {
    if (this.currentSymbols.length === 0) return;
    this.selectedIndex = (this.selectedIndex + 1) % this.currentSymbols.length;
    this.updateSelection();
  }

  /**
   * Select previous suggestion
   */
  selectPrevious(): void {
    if (this.currentSymbols.length === 0) return;
    this.selectedIndex = (this.selectedIndex - 1 + this.currentSymbols.length) % this.currentSymbols.length;
    this.updateSelection();
  }

  /**
   * Select current symbol
   */
  selectCurrent(): void {
    if (this.currentSymbols.length > 0) {
      this.selectSymbol(this.selectedIndex);
    }
  }

  /**
   * Update visual selection
   */
  private updateSelection(): void {
    if (!this.suggestionsContainer) return;

    const items = this.suggestionsContainer.querySelectorAll('.code-suggestion-item');
    items.forEach((item, index) => {
      if (index === this.selectedIndex) {
        item.classList.add('selected');
        item.scrollIntoView({ block: 'nearest' });
      } else {
        item.classList.remove('selected');
      }
    });
  }

  /**
   * Select a symbol and notify callback
   */
  private selectSymbol(index: number): void {
    const symbol = this.currentSymbols[index];
    if (!symbol) return;

    this.callbacks.onSymbolSelected(symbol);
    this.hide();
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.suggestionsContainer) {
      this.suggestionsContainer.remove();
    }
  }
}
