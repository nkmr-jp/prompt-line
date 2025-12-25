/**
 * Code Search Manager
 * Manages code/symbol search functionality (@<language>: syntax)
 */

import type {
  SymbolResult,
  LanguageInfo,
  SymbolSearchResponse
} from '../../code-search/types';
import { SYMBOL_TYPE_FROM_DISPLAY } from '../../code-search/types';

/**
 * Callbacks interface for CodeSearchManager
 * Only includes callbacks actually used by this manager
 */
export interface CodeSearchManagerCallbacks {
  updateHintText?: (text: string) => void;
  getDefaultHintText?: () => string;
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
    console.debug('[CodeSearchManager] initializeCodeSearch: starting...');
    try {
      // Check if ripgrep is available
      const rgCheck = await window.electronAPI.codeSearch.checkRg();
      console.debug('[CodeSearchManager] initializeCodeSearch: rgCheck result:', rgCheck);
      this.rgAvailable = rgCheck.rgAvailable;

      if (!this.rgAvailable) {
        console.debug('[CodeSearchManager] ripgrep not available, code search disabled');
        return;
      }

      // Load supported languages
      const langResponse = await window.electronAPI.codeSearch.getSupportedLanguages();
      console.debug('[CodeSearchManager] initializeCodeSearch: languages loaded:', langResponse.languages.length);
      for (const lang of langResponse.languages) {
        this.supportedLanguages.set(lang.key, lang);
      }

      console.debug('[CodeSearchManager] Code search initialized with languages:', Array.from(this.supportedLanguages.keys()));
    } catch (error) {
      console.error('[CodeSearchManager] Failed to initialize code search:', error);
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

  /**
   * Search for symbols in a directory for a specific language
   * @param directory - Directory to search
   * @param language - Language key (e.g., 'go', 'ts')
   * @param query - Search query for filtering symbols
   * @param options - Search options
   * @returns Filtered symbol results
   */
  public async searchSymbols(
    directory: string,
    language: string,
    query: string,
    options?: {
      symbolTypeFilter?: string | null;
      refreshCache?: boolean;
    }
  ): Promise<SymbolResult[]> {
    const { symbolTypeFilter = null, refreshCache = false } = options || {};

    try {
      const response = await this.fetchSymbols(directory, language, refreshCache);
      if (!response.success) {
        console.warn('[CodeSearchManager] Symbol search failed:', response.error);
        this.callbacks.updateHintText?.(response.error || 'Search failed');
        return [];
      }

      let filtered = response.symbols;
      filtered = this.applySymbolTypeFilter(filtered, symbolTypeFilter);
      filtered = this.applyQueryFilter(filtered, query);

      return filtered;
    } catch (error) {
      console.error('[CodeSearchManager] Error searching symbols:', error);
      return [];
    }
  }

  /**
   * Fetch symbols from main process
   */
  private async fetchSymbols(
    directory: string,
    language: string,
    refreshCache: boolean
  ): Promise<SymbolSearchResponse> {
    return window.electronAPI.codeSearch.searchSymbols(
      directory,
      language,
      { useCache: true, refreshCache }
    );
  }

  /**
   * Filter symbols by type (e.g., @go:func: → only functions)
   */
  private applySymbolTypeFilter(
    symbols: SymbolResult[],
    symbolTypeFilter: string | null
  ): SymbolResult[] {
    if (!symbolTypeFilter) return symbols;

    const targetType = SYMBOL_TYPE_FROM_DISPLAY[symbolTypeFilter];
    if (!targetType) return symbols;

    return symbols.filter((s: SymbolResult) => s.type === targetType);
  }

  /**
   * Filter and sort symbols by query
   */
  private applyQueryFilter(
    symbols: SymbolResult[],
    query: string
  ): SymbolResult[] {
    if (!query) return symbols;

    const lowerQuery = query.toLowerCase();
    const filtered = symbols.filter((s: SymbolResult) =>
      s.name.toLowerCase().includes(lowerQuery) ||
      s.lineContent.toLowerCase().includes(lowerQuery)
    );

    return this.sortByRelevance(filtered, lowerQuery);
  }

  /**
   * Sort symbols by relevance (starts with query first, then alphabetical)
   */
  private sortByRelevance(
    symbols: SymbolResult[],
    lowerQuery: string
  ): SymbolResult[] {
    return symbols.sort((a: SymbolResult, b: SymbolResult) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();
      const aStarts = aName.startsWith(lowerQuery);
      const bStarts = bName.startsWith(lowerQuery);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return aName.localeCompare(bName);
    });
  }

  /**
   * Navigate into a file to show its symbols (similar to directory navigation in file search)
   * @param relativePath - Relative path of the file
   * @param absolutePath - Absolute path of the file
   * @param language - Language info for the file
   */
  public async navigateIntoFile(
    directory: string,
    relativePath: string,
    _absolutePath: string,
    language: LanguageInfo
  ): Promise<void> {
    this.enterSymbolMode(relativePath, language);
    this.callbacks.updateHintText?.(`Loading symbols from ${relativePath}...`);

    try {
      const symbols = await this.loadFileSymbols(directory, relativePath, language);

      if (symbols.length === 0) {
        this.handleNoSymbolsFound(relativePath);
        return;
      }

      this.currentFileSymbols = symbols;
      console.debug('[CodeSearchManager] Symbol navigation complete, symbols ready for display');
    } catch (error) {
      console.error('[CodeSearchManager] Error searching symbols:', error);
      this.isInSymbolMode = false;
    }
  }

  /**
   * Enter symbol mode with initial state setup
   */
  private enterSymbolMode(relativePath: string, language: LanguageInfo): void {
    this.isInSymbolMode = true;
    this.currentFilePath = relativePath;
    console.debug('[CodeSearchManager] navigateIntoFile:', {
      file: relativePath,
      language: language.key
    });
  }

  /**
   * Load symbols for a specific file, with cache refresh fallback
   */
  private async loadFileSymbols(
    directory: string,
    relativePath: string,
    language: LanguageInfo
  ): Promise<SymbolResult[]> {
    let response = await window.electronAPI.codeSearch.searchSymbols(
      directory,
      language.key,
      { useCache: true }
    );

    if (!response.success) {
      console.warn('[CodeSearchManager] Symbol search failed:', response.error);
      this.isInSymbolMode = false;
      return [];
    }

    let symbols = this.filterSymbolsByFile(response.symbols, relativePath);
    console.debug('[CodeSearchManager] Found symbols in file:',
      symbols.length, 'out of', response.symbolCount);

    if (symbols.length === 0 && response.symbolCount > 0) {
      symbols = await this.refreshAndFilterSymbols(directory, relativePath, language);
    }

    return symbols;
  }

  /**
   * Filter symbols to only those in the specified file
   */
  private filterSymbolsByFile(
    symbols: SymbolResult[],
    relativePath: string
  ): SymbolResult[] {
    return symbols.filter((s: SymbolResult) => s.relativePath === relativePath);
  }

  /**
   * Refresh cache and filter symbols for the specified file
   */
  private async refreshAndFilterSymbols(
    directory: string,
    relativePath: string,
    language: LanguageInfo
  ): Promise<SymbolResult[]> {
    console.debug('[CodeSearchManager] No symbols for file in cache, retrying without cache');
    this.callbacks.updateHintText?.(`Refreshing symbols for ${relativePath}...`);

    const response = await window.electronAPI.codeSearch.searchSymbols(
      directory,
      language.key,
      { useCache: false }
    );

    if (!response.success) {
      return [];
    }

    const symbols = this.filterSymbolsByFile(response.symbols, relativePath);
    console.debug('[CodeSearchManager] After refresh, found symbols:',
      symbols.length, 'out of', response.symbolCount);

    return symbols;
  }

  /**
   * Handle case when no symbols are found in the file
   */
  private handleNoSymbolsFound(relativePath: string): void {
    this.callbacks.updateHintText?.(`No symbols found in ${relativePath}`);
    this.isInSymbolMode = false;
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
   * Clear code search state
   */
  public clearCodeSearchState(): void {
    this.codeSearchLanguage = '';
    this.codeSearchQuery = '';
  }
}
