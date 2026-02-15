/**
 * Code Search Manager
 * Manages code/symbol search functionality (@<language>: syntax)
 *
 * Consolidated from:
 * - CodeSearchManager: Core code search functionality
 * - SymbolSearchHandler: Symbol search operations
 * - SymbolModeUIManager: Symbol mode UI rendering
 *
 * Responsibilities:
 * - Check ripgrep availability and initialize languages
 * - Search for symbols in codebase
 * - Navigate into files to show symbols
 * - Render symbol suggestions UI
 * - Handle symbol mode state
 */

import { electronAPI } from '../../services/electron-api';
import type {
  SymbolResult,
  LanguageInfo,
  SymbolSearchResponse
} from '../code-search/types';
import { getSymbolTypeDisplay } from '../code-search/types';
import type { DirectoryData, SuggestionItem } from '../types';
import { getSymbolIconSvg } from '../../assets/icons/file-icons';
import { insertSvgIntoElement } from '../index';
import { handleError } from '../../utils/error-handler';

/**
 * Callbacks interface for CodeSearchManager
 */
export interface CodeSearchManagerCallbacks {
  updateHintText?: (text: string) => void;
  getDefaultHintText?: () => string;
  getCachedDirectoryData?: () => DirectoryData | null;
  getAtStartPosition?: () => number;
  hideSuggestions?: () => void;

  // State setters
  setFilteredSymbols?: (symbols: SymbolResult[]) => void;
  setFilteredFiles?: (files: never[]) => void;
  setFilteredAgents?: (agents: never[]) => void;
  setMergedSuggestions?: (suggestions: SuggestionItem[]) => void;
  getMergedSuggestions?: () => SuggestionItem[];
  setSelectedIndex?: (index: number) => void;
  getSelectedIndex?: () => number;
  setIsVisible?: (visible: boolean) => void;

  // UI dependencies (optional for UI rendering)
  getSuggestionsContainer?: () => HTMLElement | null;
  getCurrentFileSymbols?: () => SymbolResult[];
  getCurrentFilePath?: () => string;
  updateSelection?: () => void;
  selectSymbol?: (symbol: SymbolResult) => void;
  positionPopup?: (atStartPosition: number) => void;
  getFileSearchMaxSuggestions?: () => Promise<number>;
  showSuggestions?: (query: string) => void;
  insertFilePath?: (path: string) => void;
  onFileSelected?: (path: string) => void;
  setCurrentQuery?: (query: string) => void;
  getCurrentPath?: () => string;
  showTooltipForSelectedItem?: () => void;
  renderSuggestions?: (suggestions: SuggestionItem[]) => void;
}

export class CodeSearchManager {
  // Ripgrep availability state
  private rgAvailable: boolean = false;

  // Supported programming languages map (key -> LanguageInfo)
  private supportedLanguages: Map<string, LanguageInfo> = new Map();

  // Initialization promise for async setup
  private codeSearchInitPromise: Promise<void> | null = null;

  // Cache refresh state (for first entry to code search mode)
  private codeSearchCacheRefreshed: boolean = false;

  // Current code search state
  private codeSearchQuery: string = '';
  private codeSearchLanguage: string = '';

  // Symbol mode properties (for navigating into file to show symbols)
  private isInSymbolMode: boolean = false;
  private currentFilePath: string = '';
  private currentFileSymbols: SymbolResult[] = [];

  // Callbacks for external interaction
  private callbacks: CodeSearchManagerCallbacks;

  constructor(callbacks: CodeSearchManagerCallbacks) {
    this.callbacks = callbacks;
    // Start initialization immediately
    this.codeSearchInitPromise = this.initializeCodeSearch();
  }

  /**
   * Initialize code search functionality
   * Checks ripgrep availability and loads supported languages
   */
  private async initializeCodeSearch(): Promise<void> {
    try {
      // Check if ripgrep is available
      const rgCheck = await electronAPI.codeSearch.checkRg();
      this.rgAvailable = rgCheck.rgAvailable;

      if (!this.rgAvailable) {
        return;
      }

      // Load supported languages
      const langResponse = await electronAPI.codeSearch.getSupportedLanguages();
      for (const lang of langResponse.languages) {
        this.supportedLanguages.set(lang.key, lang);
      }
    } catch (error) {
      handleError('CodeSearchManager.initializeCodeSearch', error);
    }
  }

  /**
   * Check if ripgrep is available (async-safe)
   */
  public async isAvailable(): Promise<boolean> {
    // Wait for initialization to complete
    if (this.codeSearchInitPromise) {
      await this.codeSearchInitPromise;
    }
    return this.rgAvailable;
  }

  /**
   * Check if ripgrep is available (synchronous)
   */
  public isAvailableSync(): boolean {
    return this.rgAvailable;
  }

  /**
   * Get supported languages map
   */
  public getSupportedLanguages(): Map<string, LanguageInfo> {
    return this.supportedLanguages;
  }

  /**
   * Get language info for a file based on its extension or filename
   */
  public getLanguageForFile(filename: string): LanguageInfo | null {
    const lowerFilename = filename.toLowerCase();

    // Special case: Makefile (no extension)
    // supportedLanguages map is keyed by key (make, mk), not extension
    if (lowerFilename === 'makefile' || lowerFilename === 'gnumakefile') {
      return this.supportedLanguages.get('make') || this.supportedLanguages.get('mk') || null;
    }

    const ext = filename.substring(filename.lastIndexOf('.') + 1).toLowerCase();
    return this.supportedLanguages.get(ext) || null;
  }

  // ========================================
  // Symbol Search Methods (from SymbolSearchHandler)
  // ========================================

  /**
   * Search for symbols in a directory for a specific language
   * Filtering is performed on Main process for better performance with large symbol sets
   * @param directory - Directory to search
   * @param language - Language key (e.g., 'go', 'ts')
   * @param query - Search query for filtering symbols
   * @param options - Search options
   * @returns Filtered symbol results (already filtered by Main process)
   */
  public async searchSymbols(
    directory: string,
    language: string,
    query: string,
    options?: {
      symbolTypeFilter?: string | null;
      refreshCache?: boolean;
      maxResults?: number;
    }
  ): Promise<SymbolResult[]> {
    const { symbolTypeFilter = null, refreshCache = false, maxResults = 50 } = options || {};

    try {
      // Code search (@go:) - pass query to Main process for filtering
      // This avoids transferring all symbols over IPC and filtering in Renderer
      const response: SymbolSearchResponse = await electronAPI.codeSearch.searchSymbols(
        directory,
        language,
        {
          useCache: true,
          refreshCache,
          query,
          symbolTypeFilter,
          maxResults
        }
      );

      if (!response.success) {
        console.warn('[CodeSearchManager] Symbol search failed:', response.error);
        this.callbacks.updateHintText?.(response.error || 'Search failed');
        return [];
      }

      // Symbols are already filtered and sorted by Main process
      return response.symbols;
    } catch (error) {
      handleError('CodeSearchManager.searchSymbols', error);
      return [];
    }
  }

  /**
   * Search for symbols and update UI
   * Integrated from SymbolSearchHandler
   */
  public async searchSymbolsWithUI(
    language: string,
    query: string,
    symbolTypeFilter: string | null = null,
    refreshCache: boolean = false
  ): Promise<void> {
    const cachedData = this.callbacks.getCachedDirectoryData?.();

    if (!cachedData?.directory) {
      // Show user feedback that directory is required
      this.callbacks.updateHintText?.('No directory detected for symbol search');
      // IMPORTANT: Hide any existing suggestions (e.g., from previous file search)
      // Without this, old file suggestions would remain visible when code search fails
      this.callbacks.hideSuggestions?.();
      return;
    }

    // Delegate filtering/sorting to searchSymbols
    const filtered = await this.searchSymbols(
      cachedData.directory,
      language,
      query,
      { symbolTypeFilter, refreshCache }
    );

    // Limit results and update state
    const maxSuggestions = 20;
    this.callbacks.setFilteredSymbols?.(filtered.slice(0, maxSuggestions));
    this.callbacks.setFilteredFiles?.([]);
    this.callbacks.setFilteredAgents?.([]);

    // Convert to SuggestionItems
    const mergedSuggestions = filtered.slice(0, maxSuggestions).map((symbol, index) => ({
      type: 'symbol' as const,
      symbol,
      score: 1000 - index
    }));
    this.callbacks.setMergedSuggestions?.(mergedSuggestions);

    this.callbacks.setSelectedIndex?.(0);
    this.callbacks.setIsVisible?.(true);

    if (mergedSuggestions.length > 0) {
      // Render suggestions into the DOM
      this.callbacks.renderSuggestions?.(mergedSuggestions);

      // Show suggestions via UI callbacks
      const atStartPosition = this.callbacks.getAtStartPosition?.() ?? -1;
      this.callbacks.positionPopup?.(atStartPosition);
      const suggestionsContainer = this.callbacks.getSuggestionsContainer?.();
      if (suggestionsContainer) {
        suggestionsContainer.style.display = 'block';
      }
      this.callbacks.showTooltipForSelectedItem?.();
      const langInfo = this.supportedLanguages.get(language);
      this.callbacks.updateHintText?.(
        `${filtered.slice(0, maxSuggestions).length} ${langInfo?.displayName || language} symbols`
      );
    } else {
      this.callbacks.updateHintText?.(`No symbols found for "${query}"`);
      this.callbacks.hideSuggestions?.();
    }
  }

  /**
   * Try to load symbols for a file without changing UI state.
   * This is a "quiet" search that only returns symbols without side effects.
   * Use this to check if symbols exist before committing to symbol mode.
   * @param directory - Base directory for symbol search
   * @param relativePath - Relative path of the file
   * @param language - Language info for the file
   * @returns Array of symbols found in the file, or empty array if none
   */
  public async tryLoadSymbols(
    directory: string,
    relativePath: string,
    language: LanguageInfo
  ): Promise<SymbolResult[]> {
    try {
      // Search for symbols in the directory for this language
      // relativePath option enables Main process filtering
      let response = await electronAPI.codeSearch.searchSymbols(
        directory,
        language.key,
        { useCache: true, relativePath }
      );

      if (!response.success) {
        console.warn('[CodeSearchManager] Symbol search failed:', response.error);
        return [];
      }

      // Symbols are already filtered by Main process
      let symbols = response.symbols;

      // If no symbols found, retry without cache when:
      // 1. Using cached results AND
      // 2. Either symbolCount > 0 (old condition for backward compatibility) OR
      //    unfilteredCount > 0 (new condition - symbols exist but filtered out by relativePath)
      // This handles cases where:
      // - Cache might be stale (symbolCount > 0)
      // - relativePath filtering removed all symbols (unfilteredCount > 0)
      if (symbols.length === 0 && response.searchMode === 'cached') {
        const shouldRetry = response.symbolCount > 0 || (response.unfilteredCount !== undefined && response.unfilteredCount > 0);

        if (shouldRetry) {
          response = await electronAPI.codeSearch.searchSymbols(
            directory,
            language.key,
            { useCache: false, relativePath }
          );

          if (response.success) {
            symbols = response.symbols;
          }
        }
      }

      return symbols;
    } catch (error) {
      handleError('CodeSearchManager.tryLoadSymbols', error);
      return [];
    }
  }

  /**
   * Enter symbol mode with pre-loaded symbols.
   * Call this after tryLoadSymbols returns symbols.
   * @param relativePath - Relative path of the file
   * @param symbols - Pre-loaded symbols from tryLoadSymbols
   */
  public enterSymbolMode(relativePath: string, symbols: SymbolResult[]): void {
    this.isInSymbolMode = true;
    this.currentFilePath = relativePath;
    this.currentFileSymbols = symbols;
  }

  /**
   * Navigate into a file to show its symbols (similar to directory navigation in file search)
   * @param relativePath - Relative path of the file
   * @param absolutePath - Absolute path of the file
   * @param language - Language info for the file
   * @deprecated Use tryLoadSymbols + enterSymbolMode for flicker-free navigation
   */
  public async navigateIntoFile(
    directory: string,
    relativePath: string,
    _absolutePath: string,
    language: LanguageInfo
  ): Promise<void> {
    // Load symbols without UI changes
    const symbols = await this.tryLoadSymbols(directory, relativePath, language);

    if (symbols.length === 0) {
      // No symbols found - stay in current state
      this.isInSymbolMode = false;
      return;
    }

    // Symbols found - enter symbol mode
    this.enterSymbolMode(relativePath, symbols);
  }

  /**
   * Exit symbol mode and return to file list
   */
  public exitSymbolMode(): void {
    this.isInSymbolMode = false;
    this.currentFilePath = '';
    this.currentFileSymbols = [];

    // Restore default hint text
    if (this.callbacks.getDefaultHintText) {
      this.callbacks.updateHintText?.(this.callbacks.getDefaultHintText());
    }

    // Re-show file suggestions
    this.callbacks.setCurrentQuery?.('');
    this.callbacks.showSuggestions?.(this.callbacks.getCurrentPath?.() || '');
  }

  /**
   * Check if currently in symbol mode
   */
  public isInSymbolModeActive(): boolean {
    return this.isInSymbolMode;
  }

  /**
   * Get current file path in symbol mode
   */
  public getCurrentFilePath(): string {
    return this.currentFilePath;
  }

  /**
   * Get symbols for the current file in symbol mode
   */
  public getCurrentFileSymbols(): SymbolResult[] {
    return this.currentFileSymbols;
  }

  /**
   * Set symbol mode active state
   */
  public setInSymbolMode(value: boolean): void {
    this.isInSymbolMode = value;
  }

  /**
   * Set current file path in symbol mode
   */
  public setCurrentFilePath(value: string): void {
    this.currentFilePath = value;
  }

  /**
   * Set symbols for the current file in symbol mode
   */
  public setCurrentFileSymbols(symbols: SymbolResult[]): void {
    this.currentFileSymbols = symbols;
  }

  /**
   * Reset cache refresh flag (call when entering code search mode)
   */
  public resetCacheRefreshed(): void {
    this.codeSearchCacheRefreshed = false;
  }

  /**
   * Mark cache as refreshed (call after first cache refresh)
   */
  public markCacheRefreshed(): void {
    this.codeSearchCacheRefreshed = true;
  }

  /**
   * Check if cache has been refreshed in current session
   */
  public isCacheRefreshed(): boolean {
    return this.codeSearchCacheRefreshed;
  }

  /**
   * Set current code search state
   */
  public setCodeSearchState(language: string, query: string): void {
    this.codeSearchLanguage = language;
    this.codeSearchQuery = query;
  }

  /**
   * Get current code search language
   */
  public getCodeSearchLanguage(): string {
    return this.codeSearchLanguage;
  }

  /**
   * Get current code search query
   */
  public getCodeSearchQuery(): string {
    return this.codeSearchQuery;
  }

  /**
   * Handle show suggestions - checks if in symbol mode and delegates appropriately
   * @param query - The query string
   * @param fallbackHandler - Function to call if not in symbol mode
   * @returns true if handled by symbol mode, false otherwise
   */
  public async handleShowSuggestions(query: string, fallbackHandler: () => Promise<void>): Promise<boolean> {
    if (this.isInSymbolMode) {
      this.callbacks.setCurrentQuery?.(query);
      await this.showSymbolSuggestions(query);
      return true;
    }
    await fallbackHandler();
    return false;
  }

  /**
   * Reset symbol mode state
   */
  public resetSymbolModeState(): void {
    this.isInSymbolMode = false;
    this.currentFilePath = '';
    this.currentFileSymbols = [];
  }

  /**
   * Clear code search state
   */
  public clearCodeSearchState(): void {
    this.codeSearchLanguage = '';
    this.codeSearchQuery = '';
  }

  // ========================================
  // Symbol Mode UI Methods (from SymbolModeUIManager)
  // ========================================

  /**
   * Set symbol mode state
   */
  public setSymbolModeState(isInMode: boolean, filePath: string = '', symbols: SymbolResult[] = []): void {
    this.isInSymbolMode = isInMode;
    this.currentFilePath = filePath;
    this.currentFileSymbols = symbols;
  }

  /**
   * Show symbol suggestions for the current file
   * @param query - Search query to filter symbols
   */
  public async showSymbolSuggestions(query: string): Promise<void> {
    const suggestionsContainer = this.callbacks.getSuggestionsContainer?.();
    if (!suggestionsContainer) return;

    // Filter symbols by query
    let filtered = this.currentFileSymbols;
    if (query) {
      const lowerQuery = query.toLowerCase();
      filtered = this.currentFileSymbols.filter(s =>
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

    // Limit results using fileSearch settings (not customSearch)
    const maxSuggestions = await (this.callbacks.getFileSearchMaxSuggestions?.() ?? Promise.resolve(20));
    filtered = filtered.slice(0, maxSuggestions);

    // Convert to SuggestionItem
    const mergedSuggestions: SuggestionItem[] = filtered.map((symbol, index) => ({
      type: 'symbol' as const,
      symbol,
      score: 1000 - index
    }));
    this.callbacks.setMergedSuggestions?.(mergedSuggestions);

    // Set selectedIndex = -1 (unselected state, like directory navigation)
    // Tab/Enter will insert file path when nothing is selected
    this.callbacks.setSelectedIndex?.(-1);

    // Clear and render
    suggestionsContainer.innerHTML = '';
    const fragment = document.createDocumentFragment();

    // Add file path header (like directory header in renderSuggestions)
    if (this.currentFilePath) {
      const header = document.createElement('div');
      header.className = 'file-suggestion-header';
      header.textContent = this.currentFilePath;
      fragment.appendChild(header);
    }

    if (mergedSuggestions.length === 0) {
      this.callbacks.updateHintText?.(`No symbols matching "${query}" in ${this.currentFilePath}`);
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
      this.callbacks.updateHintText?.(`${mergedSuggestions.length} symbols in ${this.currentFilePath}`);
    }

    // Position and show (delegate positioning to SuggestionListManager)
    const atStartPosition = this.callbacks.getAtStartPosition?.() ?? -1;
    this.callbacks.positionPopup?.(atStartPosition);
    suggestionsContainer.style.display = 'block';
    this.callbacks.setIsVisible?.(true);
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

    const selectedIndex = this.callbacks.getSelectedIndex?.() ?? -1;
    if (index === selectedIndex) {
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
      this.callbacks.setSelectedIndex?.(index);
      this.callbacks.updateSelection?.();
    });

    item.addEventListener('click', () => {
      this.callbacks.selectSymbol?.(symbol);
    });

    return item;
  }

  /**
   * Expand current file (insert file path without selecting a symbol)
   */
  public expandCurrentFile(): void {
    if (!this.currentFilePath) return;

    // Insert file path (with trailing space)
    this.callbacks.insertFilePath?.(this.currentFilePath);
    this.callbacks.hideSuggestions?.();

    // Callback for external handling
    this.callbacks.onFileSelected?.(this.currentFilePath);
  }
}
