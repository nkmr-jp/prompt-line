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
      // Code search (@go:) - only refresh cache when explicitly requested (first entry to code search mode)
      // Don't pass maxSymbols - let the handler use settings value
      const response: SymbolSearchResponse = await window.electronAPI.codeSearch.searchSymbols(
        directory,
        language,
        { useCache: true, refreshCache }
      );

      if (!response.success) {
        console.warn('[CodeSearchManager] Symbol search failed:', response.error);
        this.callbacks.updateHintText?.(response.error || 'Search failed');
        return [];
      }

      let filtered: SymbolResult[] = response.symbols;

      // Filter by symbol type first (e.g., @go:func: → only functions)
      if (symbolTypeFilter) {
        const targetType = SYMBOL_TYPE_FROM_DISPLAY[symbolTypeFilter];
        if (targetType) {
          filtered = filtered.filter((s: SymbolResult) => s.type === targetType);
        }
      }

      // Filter symbols by query (search in both name and lineContent)
      if (query) {
        const lowerQuery = query.toLowerCase();
        filtered = filtered.filter((s: SymbolResult) =>
          s.name.toLowerCase().includes(lowerQuery) ||
          s.lineContent.toLowerCase().includes(lowerQuery)
        );

        // Sort by relevance (symbols starting with query first, then alphabetical)
        filtered.sort((a: SymbolResult, b: SymbolResult) => {
          const aName = a.name.toLowerCase();
          const bName = b.name.toLowerCase();
          const aStarts = aName.startsWith(lowerQuery);
          const bStarts = bName.startsWith(lowerQuery);
          if (aStarts && !bStarts) return -1;
          if (!aStarts && bStarts) return 1;
          return aName.localeCompare(bName);
        });
      }

      return filtered;
    } catch (error) {
      console.error('[CodeSearchManager] Error searching symbols:', error);
      return [];
    }
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
    // Update state to symbol mode
    this.isInSymbolMode = true;
    this.currentFilePath = relativePath;

    console.debug('[CodeSearchManager] navigateIntoFile:', {
      file: relativePath,
      language: language.key
    });

    // Show loading state
    this.callbacks.updateHintText?.(`Loading symbols from ${relativePath}...`);

    try {
      // Search for symbols in the directory for this language
      // Don't pass maxSymbols - let the handler use settings value
      let response = await window.electronAPI.codeSearch.searchSymbols(
        directory,
        language.key,
        { useCache: true }
      );

      if (!response.success) {
        console.warn('[CodeSearchManager] Symbol search failed:', response.error);
        // Fallback: stay on current state with file path shown
        this.isInSymbolMode = false;
        return;
      }

      // Filter symbols to only those in the selected file
      this.currentFileSymbols = response.symbols.filter(
        (s: SymbolResult) => s.relativePath === relativePath
      );

      console.debug('[CodeSearchManager] Found symbols in file:',
        this.currentFileSymbols.length, 'out of', response.symbolCount);

      // If no symbols found in cached results, retry without cache
      // (cache might be stale)
      if (this.currentFileSymbols.length === 0 && response.symbolCount > 0) {
        console.debug('[CodeSearchManager] No symbols for file in cache, retrying without cache');
        this.callbacks.updateHintText?.(`Refreshing symbols for ${relativePath}...`);

        // Don't pass maxSymbols - let the handler use settings value
        response = await window.electronAPI.codeSearch.searchSymbols(
          directory,
          language.key,
          { useCache: false }
        );

        if (response.success) {
          this.currentFileSymbols = response.symbols.filter(
            (s: SymbolResult) => s.relativePath === relativePath
          );
          console.debug('[CodeSearchManager] After refresh, found symbols:',
            this.currentFileSymbols.length, 'out of', response.symbolCount);
        }
      }

      if (this.currentFileSymbols.length === 0) {
        // No symbols found - notify callback
        this.callbacks.updateHintText?.(`No symbols found in ${relativePath}`);
        this.isInSymbolMode = false;
        return;
      }

      // Successfully loaded symbols - callback can now retrieve them via getCurrentFileSymbols()
      console.debug('[CodeSearchManager] Symbol navigation complete, symbols ready for display');
    } catch (error) {
      console.error('[CodeSearchManager] Error searching symbols:', error);
      this.isInSymbolMode = false;
    }
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
