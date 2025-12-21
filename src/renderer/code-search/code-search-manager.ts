/**
 * Code Search Manager
 * Handles @<ext>:<query> pattern detection and symbol search
 * Example: @go:Handle, @ts:Manager
 */

import type {
  SymbolResult,
  LanguageInfo,
  ParsedCodeQuery,
  CodeSearchCallbacks,
  SymbolSearchResponse,
  RgCheckResponse,
  LanguagesResponse
} from './types';
import { SYMBOL_ICONS, getSymbolTypeDisplay } from './types';

// Constants
const CODE_SEARCH_PATTERN = /@([a-z]+):(\S*)$/;
const MAX_SUGGESTIONS = 20;
const DEBOUNCE_DELAY = 150;

/**
 * CodeSearchManager class
 * Manages code/symbol search functionality triggered by @<ext>:<query> pattern
 */
export class CodeSearchManager {
  private callbacks: CodeSearchCallbacks;
  private textInput: HTMLTextAreaElement | null = null;
  private suggestionsContainer: HTMLDivElement | null = null;
  private isVisible = false;
  private selectedIndex = 0;
  private currentSymbols: SymbolResult[] = [];
  private currentQuery: ParsedCodeQuery | null = null;
  private currentDirectory: string | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private rgAvailable = false;
  private supportedLanguages: Map<string, LanguageInfo> = new Map();
  private isEnabled = false;

  constructor(callbacks: CodeSearchCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Initialize elements and check prerequisites
   */
  async initialize(): Promise<void> {
    this.textInput = document.getElementById('textInput') as HTMLTextAreaElement;
    this.createSuggestionsContainer();

    // Check if ripgrep is available
    const rgCheck = await this.checkRgAvailable();
    this.rgAvailable = rgCheck.rgAvailable;

    if (!this.rgAvailable) {
      console.debug('[CodeSearchManager] ripgrep not available, code search disabled');
      return;
    }

    // Load supported languages
    const langResponse = await this.getSupportedLanguages();
    for (const lang of langResponse.languages) {
      this.supportedLanguages.set(lang.key, lang);
    }

    this.isEnabled = true;
    console.debug('[CodeSearchManager] Initialized with languages:', Array.from(this.supportedLanguages.keys()));
  }

  /**
   * Set up event listeners
   */
  setupEventListeners(): void {
    console.debug('[CodeSearchManager] setupEventListeners called', {
      hasTextInput: !!this.textInput,
      isEnabled: this.isEnabled
    });

    if (!this.textInput) {
      console.warn('[CodeSearchManager] setupEventListeners: textInput is null, skipping');
      return;
    }

    this.textInput.addEventListener('input', () => this.handleInput());
    this.textInput.addEventListener('keydown', (e) => this.handleKeyDown(e));
    console.debug('[CodeSearchManager] setupEventListeners: event listeners attached');

    // Click outside to close
    document.addEventListener('click', (e) => {
      if (this.isVisible && this.suggestionsContainer &&
          !this.suggestionsContainer.contains(e.target as Node) &&
          e.target !== this.textInput) {
        this.hideSuggestions();
      }
    });
  }

  /**
   * Update current directory (called when window is shown)
   */
  setDirectory(directory: string | null): void {
    this.currentDirectory = directory;
    console.debug('[CodeSearchManager] Directory set:', directory);
  }

  /**
   * Check if code search is active
   */
  isActive(): boolean {
    return this.isVisible;
  }

  /**
   * Create suggestions container
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
   * Handle input event
   */
  private handleInput(): void {
    console.debug('[CodeSearchManager] handleInput called', {
      isEnabled: this.isEnabled,
      hasTextInput: !!this.textInput,
      isComposing: this.callbacks.getIsComposing()
    });

    if (!this.isEnabled || !this.textInput || this.callbacks.getIsComposing()) {
      console.debug('[CodeSearchManager] handleInput: early return');
      return;
    }

    // Debounce input handling
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.checkForCodeSearch();
    }, DEBOUNCE_DELAY);
  }

  /**
   * Handle keydown event
   */
  private handleKeyDown(e: KeyboardEvent): void {
    if (!this.isVisible) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.selectNext();
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.selectPrevious();
        break;
      case 'Enter':
      case 'Tab':
        if (this.currentSymbols.length > 0) {
          e.preventDefault();
          this.selectSymbol(this.selectedIndex);
        }
        break;
      case 'Escape':
        e.preventDefault();
        this.hideSuggestions();
        break;
    }
  }

  /**
   * Check for @<ext>:<query> pattern and trigger search
   */
  private async checkForCodeSearch(): Promise<void> {
    console.debug('[CodeSearchManager] checkForCodeSearch called', {
      hasTextInput: !!this.textInput,
      currentDirectory: this.currentDirectory
    });

    if (!this.textInput || !this.currentDirectory) {
      console.debug('[CodeSearchManager] checkForCodeSearch: early return - missing textInput or directory');
      return;
    }

    const text = this.callbacks.getTextContent();
    const cursorPos = this.callbacks.getCursorPosition();

    // Get text before cursor
    const textBeforeCursor = text.substring(0, cursorPos);
    console.debug('[CodeSearchManager] checkForCodeSearch: textBeforeCursor:', textBeforeCursor);

    // Check for pattern
    const match = textBeforeCursor.match(CODE_SEARCH_PATTERN);
    console.debug('[CodeSearchManager] checkForCodeSearch: pattern match:', match);
    if (!match || !match[1]) {
      this.hideSuggestions();
      return;
    }

    const language = match[1];
    const query = match[2] ?? '';
    const startIndex = textBeforeCursor.lastIndexOf('@');
    const endIndex = cursorPos;

    // Validate language
    if (!this.supportedLanguages.has(language)) {
      this.callbacks.updateHintText(`Unknown language: ${language}`);
      this.hideSuggestions();
      return;
    }

    this.currentQuery = { language, query, startIndex, endIndex };

    // Search symbols
    await this.searchSymbols(language, query);
  }

  /**
   * Search for symbols
   */
  private async searchSymbols(language: string, query: string): Promise<void> {
    if (!this.currentDirectory) return;

    try {
      const response = await this.invokeSearchSymbols(
        this.currentDirectory,
        language,
        { maxSymbols: 20000, useCache: true }
      );

      if (!response.success) {
        console.warn('[CodeSearchManager] Search failed:', response.error);
        this.callbacks.updateHintText(response.error || 'Search failed');
        this.hideSuggestions();
        return;
      }

      // Filter symbols by query
      let filtered = response.symbols;
      if (query) {
        const lowerQuery = query.toLowerCase();
        filtered = response.symbols.filter(s =>
          s.name.toLowerCase().includes(lowerQuery)
        );

        // Sort by match relevance
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

      // Limit results
      this.currentSymbols = filtered.slice(0, MAX_SUGGESTIONS);
      this.selectedIndex = 0;

      if (this.currentSymbols.length > 0) {
        this.showSuggestions();
      } else {
        this.callbacks.updateHintText(`No symbols found for "${query}"`);
        this.hideSuggestions();
      }
    } catch (error) {
      console.error('[CodeSearchManager] Search error:', error);
      this.hideSuggestions();
    }
  }

  /**
   * Show suggestions dropdown
   */
  private showSuggestions(): void {
    if (!this.suggestionsContainer || !this.textInput) return;

    // Clear container
    this.suggestionsContainer.innerHTML = '';

    // Render symbols
    this.currentSymbols.forEach((symbol, index) => {
      const item = this.createSuggestionItem(symbol, index);
      this.suggestionsContainer!.appendChild(item);
    });

    // Position and show
    this.positionSuggestions();
    this.suggestionsContainer.style.display = 'block';
    this.isVisible = true;

    // Update hint
    const langInfo = this.supportedLanguages.get(this.currentQuery?.language || '');
    this.callbacks.updateHintText(
      `${this.currentSymbols.length} ${langInfo?.displayName || ''} symbols`
    );
  }

  /**
   * Create a suggestion item element
   */
  private createSuggestionItem(symbol: SymbolResult, index: number): HTMLDivElement {
    const item = document.createElement('div');
    item.className = 'code-suggestion-item';
    if (index === this.selectedIndex) {
      item.classList.add('selected');
    }

    // Icon
    const icon = document.createElement('span');
    icon.className = 'code-suggestion-icon';
    icon.textContent = SYMBOL_ICONS[symbol.type] || '?';
    item.appendChild(icon);

    // Name and type
    const nameSpan = document.createElement('span');
    nameSpan.className = 'code-suggestion-name';
    nameSpan.textContent = symbol.name;
    item.appendChild(nameSpan);

    const typeSpan = document.createElement('span');
    typeSpan.className = 'code-suggestion-type';
    typeSpan.textContent = getSymbolTypeDisplay(symbol.type);
    item.appendChild(typeSpan);

    // File path
    const pathSpan = document.createElement('span');
    pathSpan.className = 'code-suggestion-path';
    pathSpan.textContent = `${symbol.relativePath}:${symbol.lineNumber}`;
    item.appendChild(pathSpan);

    // Event handlers
    item.addEventListener('mouseenter', () => {
      this.selectedIndex = index;
      this.updateSelection();
    });

    item.addEventListener('click', () => {
      this.selectSymbol(index);
    });

    return item;
  }

  /**
   * Position suggestions dropdown
   * Uses main-content as positioning reference (same as FileSearchManager)
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
   * Hide suggestions dropdown
   */
  hideSuggestions(): void {
    if (this.suggestionsContainer) {
      this.suggestionsContainer.style.display = 'none';
    }
    this.isVisible = false;
    this.currentSymbols = [];
    this.currentQuery = null;
    this.callbacks.updateHintText(this.callbacks.getDefaultHintText());
  }

  /**
   * Select next suggestion
   */
  private selectNext(): void {
    if (this.currentSymbols.length === 0) return;
    this.selectedIndex = (this.selectedIndex + 1) % this.currentSymbols.length;
    this.updateSelection();
  }

  /**
   * Select previous suggestion
   */
  private selectPrevious(): void {
    if (this.currentSymbols.length === 0) return;
    this.selectedIndex = (this.selectedIndex - 1 + this.currentSymbols.length) % this.currentSymbols.length;
    this.updateSelection();
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
   * Select a symbol and insert it (with @ prefix for highlighting)
   */
  private selectSymbol(index: number): void {
    const symbol = this.currentSymbols[index];
    if (!symbol || !this.currentQuery) return;

    // Format: relativePath:lineNumber#symbolName (keep @ prefix)
    // The @ is at startIndex, so we insert path after it
    const pathWithLineAndSymbol = `${symbol.relativePath}:${symbol.lineNumber}#${symbol.name} `;

    // Replace the lang:query part (after @) with the path:line#symbol
    // startIndex is the @ position, so we replace from startIndex + 1 to keep @
    this.callbacks.replaceRangeWithUndo(
      this.currentQuery.startIndex + 1,
      this.currentQuery.endIndex,
      pathWithLineAndSymbol
    );

    // Notify callback
    this.callbacks.onSymbolSelected(symbol);

    // Hide suggestions
    this.hideSuggestions();
  }

  /**
   * IPC: Check if ripgrep is available
   */
  private async checkRgAvailable(): Promise<RgCheckResponse> {
    try {
      return await window.electronAPI.codeSearch.checkRg();
    } catch (error) {
      console.error('[CodeSearchManager] Failed to check rg:', error);
      return { rgAvailable: false, rgPath: null };
    }
  }

  /**
   * IPC: Get supported languages
   */
  private async getSupportedLanguages(): Promise<LanguagesResponse> {
    try {
      return await window.electronAPI.codeSearch.getSupportedLanguages();
    } catch (error) {
      console.error('[CodeSearchManager] Failed to get languages:', error);
      return { languages: [] };
    }
  }

  /**
   * IPC: Search symbols
   */
  private async invokeSearchSymbols(
    directory: string,
    language: string,
    options?: { maxSymbols?: number; useCache?: boolean }
  ): Promise<SymbolSearchResponse> {
    try {
      return await window.electronAPI.codeSearch.searchSymbols(directory, language, options);
    } catch (error) {
      console.error('[CodeSearchManager] Failed to search symbols:', error);
      return {
        success: false,
        symbols: [],
        symbolCount: 0,
        searchMode: 'full',
        partial: false,
        maxSymbols: 20000,
        error: String(error)
      };
    }
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    if (this.suggestionsContainer) {
      this.suggestionsContainer.remove();
    }
  }
}
