/**
 * Symbol Search Client for Renderer Process
 *
 * Provides methods to:
 * 1. Parse @<lang>:query and @<lang>:<symbolType>:query syntax
 * 2. Communicate with main process via IPC for symbol search
 * 3. Manage symbol search configuration
 */

import type { SymbolSearchResult, CodeSymbolSearchUserConfig } from '../../types';

// Default configuration when settings are unavailable
const DEFAULT_CONFIG: CodeSymbolSearchUserConfig = {
  enabled: false,
  maxResults: 50,
  timeout: 5000
};

// Regex pattern for symbol search syntax
// Matches: @lang:query or @lang:symbolType:query
const SYMBOL_SEARCH_PATTERN = /^@(\w+):(?:(\w+):)?(.*)$/;

// Simple pattern to detect if string starts with @<word>:
const SYMBOL_SEARCH_PREFIX_PATTERN = /^@\w+:/;

export interface ParsedSymbolQuery {
  language: string;
  symbolType?: string | undefined;
  query: string;
}

/**
 * Client for symbol search functionality in the renderer process
 */
export class SymbolSearchClient {
  private cachedLanguages: string[] | null = null;
  private cachedConfig: CodeSymbolSearchUserConfig | null = null;

  /**
   * Parse @<lang>:query or @<lang>:<symbolType>:query syntax
   * Returns null if the input doesn't match the expected pattern
   */
  parsePrefix(input: string): ParsedSymbolQuery | null {
    const match = input.match(SYMBOL_SEARCH_PATTERN);
    if (!match) return null;

    const [, language, symbolType, query] = match;

    // Language and query are always present (empty string for query is valid)
    if (!language) return null;

    return {
      language,
      symbolType: symbolType || undefined,
      query: query ?? ''
    };
  }

  /**
   * Check if the input is a symbol search query
   * Returns true if it matches @<lang>: pattern
   */
  isSymbolSearchQuery(input: string): boolean {
    const result = SYMBOL_SEARCH_PREFIX_PATTERN.test(input);
    console.debug('[SymbolSearchClient] isSymbolSearchQuery:', { input, pattern: SYMBOL_SEARCH_PREFIX_PATTERN.toString(), result });
    return result;
  }

  /**
   * Search for symbols using the main process
   */
  async search(
    directory: string,
    language: string,
    query: string,
    symbolType?: string
  ): Promise<SymbolSearchResult[]> {
    try {
      const results = await window.electronAPI.symbolSearch.search(
        directory,
        language,
        query,
        symbolType
      );
      return results as SymbolSearchResult[];
    } catch (error) {
      console.error('[SymbolSearchClient] Search failed:', error);
      return [];
    }
  }

  /**
   * Get list of supported programming languages
   */
  async getLanguages(): Promise<string[]> {
    if (this.cachedLanguages) {
      return this.cachedLanguages;
    }

    try {
      const languages = await window.electronAPI.symbolSearch.getLanguages();
      this.cachedLanguages = languages;
      return languages;
    } catch (error) {
      console.error('[SymbolSearchClient] Failed to get languages:', error);
      return [];
    }
  }

  /**
   * Get symbol search configuration
   */
  async getConfig(): Promise<CodeSymbolSearchUserConfig> {
    if (this.cachedConfig) {
      return this.cachedConfig;
    }

    try {
      const config = await window.electronAPI.symbolSearch.getConfig();
      this.cachedConfig = config;
      return config;
    } catch (error) {
      console.error('[SymbolSearchClient] Failed to get config:', error);
      return DEFAULT_CONFIG;
    }
  }

  /**
   * Check if symbol search is enabled
   */
  async isEnabled(): Promise<boolean> {
    console.debug('[SymbolSearchClient] isEnabled: getting config...');
    const config = await this.getConfig();
    console.debug('[SymbolSearchClient] isEnabled: config =', config);
    return config.enabled;
  }

  /**
   * Parse input and execute search in one call
   * Convenience method for FileSearchManager integration
   */
  async searchFromInput(
    directory: string,
    input: string
  ): Promise<SymbolSearchResult[]> {
    const parsed = this.parsePrefix(input);
    if (!parsed) {
      return [];
    }

    return this.search(
      directory,
      parsed.language,
      parsed.query,
      parsed.symbolType
    );
  }

  /**
   * Clear cached data (call when settings change)
   */
  clearCache(): void {
    this.cachedLanguages = null;
    this.cachedConfig = null;
  }
}
