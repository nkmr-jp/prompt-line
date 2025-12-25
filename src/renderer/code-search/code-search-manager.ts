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
import { SuggestionUIManager } from './suggestion-ui-manager';
import { SymbolFilterManager } from './symbol-filter-manager';
import { InputStateManager } from './input-state-manager';

/**
 * CodeSearchManager class
 * Manages code/symbol search functionality triggered by @<ext>:<query> pattern
 */
export class CodeSearchManager {
  private callbacks: CodeSearchCallbacks;
  private suggestionUI: SuggestionUIManager;
  private symbolFilter: SymbolFilterManager;
  private inputState: InputStateManager;
  private currentDirectory: string | null = null;
  private rgAvailable = false;
  private supportedLanguages: Map<string, LanguageInfo> = new Map();
  private isEnabled = false;

  constructor(callbacks: CodeSearchCallbacks) {
    this.callbacks = callbacks;
    this.symbolFilter = new SymbolFilterManager();

    // Setup suggestion UI callbacks
    this.suggestionUI = new SuggestionUIManager({
      onSymbolSelected: (symbol) => this.handleSymbolSelected(symbol),
      updateHintText: (text) => this.callbacks.updateHintText(text),
      getDefaultHintText: () => this.callbacks.getDefaultHintText()
    });

    // Setup input state callbacks
    this.inputState = new InputStateManager({
      onPatternDetected: (language, rawQuery, startIndex, endIndex) =>
        this.handlePatternDetected(language, rawQuery, startIndex, endIndex),
      onPatternCleared: () => this.suggestionUI.hide(),
      getTextContent: () => this.callbacks.getTextContent(),
      setTextContent: (text) => this.callbacks.setTextContent(text),
      getCursorPosition: () => this.callbacks.getCursorPosition(),
      setCursorPosition: (position) => this.callbacks.setCursorPosition(position),
      getIsComposing: () => this.callbacks.getIsComposing()
    });
  }

  /**
   * Initialize elements and check prerequisites
   */
  async initialize(): Promise<void> {
    this.suggestionUI.initialize();
    this.inputState.initialize();

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
   * Set up event listeners (placeholder for keyboard events)
   */
  setupEventListeners(): void {
    console.debug('[CodeSearchManager] setupEventListeners called', {
      isEnabled: this.isEnabled
    });
    // Input event listeners are managed by InputStateManager
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
    return this.suggestionUI.visible();
  }

  /**
   * Handle keydown event (called from parent)
   */
  handleKeyDown(e: KeyboardEvent): void {
    if (!this.suggestionUI.visible()) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.suggestionUI.selectNext();
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.suggestionUI.selectPrevious();
        break;
      case 'Enter':
      case 'Tab':
        if (this.suggestionUI.getSymbols().length > 0) {
          e.preventDefault();
          this.suggestionUI.selectCurrent();
        }
        break;
      case 'Escape':
        e.preventDefault();
        this.suggestionUI.hide();
        break;
    }
  }

  /**
   * Hide suggestions (public API)
   */
  hideSuggestions(): void {
    this.suggestionUI.hide();
  }

  /**
   * Handle pattern detected from InputStateManager
   */
  private async handlePatternDetected(
    language: string,
    rawQuery: string,
    startIndex: number,
    endIndex: number
  ): Promise<void> {
    console.debug('[CodeSearchManager] handlePatternDetected', {
      language,
      rawQuery,
      currentDirectory: this.currentDirectory
    });

    if (!this.currentDirectory) {
      console.debug('[CodeSearchManager] handlePatternDetected: no directory set');
      return;
    }

    // Validate language
    if (!this.supportedLanguages.has(language)) {
      this.callbacks.updateHintText(`Unknown language: ${language}`);
      this.suggestionUI.hide();
      return;
    }

    // Parse query: extract symbol type filter and search query
    const { symbolTypeFilter, query } = this.symbolFilter.parseQuery(rawQuery);

    const currentQuery: ParsedCodeQuery = { language, query, startIndex, endIndex };

    // Search symbols with optional type filter
    await this.searchSymbols(currentQuery, symbolTypeFilter);
  }

  /**
   * Search for symbols
   * @param currentQuery - Parsed query information
   * @param symbolTypeFilter - Optional symbol type filter (e.g., "func" for functions only)
   */
  private async searchSymbols(currentQuery: ParsedCodeQuery, symbolTypeFilter: string | null = null): Promise<void> {
    if (!this.currentDirectory) return;

    try {
      const response = await this.invokeSearchSymbols(
        this.currentDirectory,
        currentQuery.language,
        { useCache: true }
      );

      if (!response.success) {
        this.handleSearchFailure(response.error);
        return;
      }

      const filtered = this.symbolFilter.filterSymbols(
        response.symbols,
        currentQuery.query,
        symbolTypeFilter
      );

      this.displaySearchResults(filtered, currentQuery, symbolTypeFilter);
    } catch (error) {
      console.error('[CodeSearchManager] Search error:', error);
      this.suggestionUI.hide();
    }
  }

  /**
   * Handle search failure
   */
  private handleSearchFailure(error: string | undefined): void {
    console.warn('[CodeSearchManager] Search failed:', error);
    this.callbacks.updateHintText(error || 'Search failed');
    this.suggestionUI.hide();
  }

  /**
   * Display search results or no-results message
   */
  private displaySearchResults(
    filtered: SymbolResult[],
    currentQuery: ParsedCodeQuery,
    symbolTypeFilter: string | null
  ): void {
    if (filtered.length > 0) {
      const langInfo = this.supportedLanguages.get(currentQuery.language);
      this.suggestionUI.show(filtered, currentQuery, langInfo);
    } else {
      const filterDesc = symbolTypeFilter ? ` (${symbolTypeFilter})` : '';
      this.callbacks.updateHintText(`No symbols found for "${currentQuery.query}"${filterDesc}`);
      this.suggestionUI.hide();
    }
  }

  /**
   * Handle symbol selected from SuggestionUIManager
   */
  private handleSymbolSelected(symbol: SymbolResult): void {
    const currentQuery = this.suggestionUI.getQuery();
    if (!currentQuery) return;

    // Format: relativePath:lineNumber#symbolName + space (keep @ prefix)
    // The @ is at startIndex, so we insert path after it
    const pathWithLineAndSymbol = `${symbol.relativePath}:${symbol.lineNumber}#${symbol.name} `;

    // Replace the lang:query part (after @) with the path:line#symbol
    // startIndex is the @ position, so we replace from startIndex + 1 to keep @
    this.callbacks.replaceRangeWithUndo(
      currentQuery.startIndex + 1,
      currentQuery.endIndex,
      pathWithLineAndSymbol
    );

    // Set cursor position after the inserted text (@ + path + space)
    const newCursorPos = currentQuery.startIndex + 1 + pathWithLineAndSymbol.length;
    this.callbacks.setCursorPosition(newCursorPos);

    // Notify callback
    this.callbacks.onSymbolSelected(symbol);
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
        maxSymbols: options?.maxSymbols ?? 0, // Error response - actual value unknown
        error: String(error)
      };
    }
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.inputState.destroy();
    this.suggestionUI.destroy();
  }
}
