/**
 * Query Extraction Manager
 * Manages query extraction and pattern detection for file search
 *
 * Responsibilities:
 * - Extracting @ query at cursor position
 * - Detecting code search patterns (@ts:, @go:, etc.)
 * - Parsing symbol type filters (func:, class:, etc.)
 * - Validating query patterns
 */

import { SYMBOL_TYPE_FROM_DISPLAY } from '../../code-search/types';

// Pattern to detect code search queries (e.g., @ts:, @go:, @py:)
const CODE_SEARCH_PATTERN = /^([a-z]+):(.*)$/;

export interface QueryExtractionResult {
  query: string;
  startPos: number;
}

export interface CodeSearchQueryResult {
  language: string;
  symbolQuery: string;
  symbolTypeFilter: string | null;
}

export interface QueryExtractionCallbacks {
  getTextContent: () => string;
  getCursorPosition: () => number;
}

export class QueryExtractionManager {
  private callbacks: QueryExtractionCallbacks;

  constructor(callbacks: QueryExtractionCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Extract the @ query at the current cursor position
   * Returns null if no valid @ pattern is found
   */
  public extractQueryAtCursor(): QueryExtractionResult | null {
    const text = this.callbacks.getTextContent();
    const cursorPos = this.callbacks.getCursorPosition();

    const atPos = this.findAtPosition(text, cursorPos);
    if (atPos === -1) return null;

    if (!this.isValidAtPosition(text, atPos)) return null;

    const query = text.substring(atPos + 1, cursorPos);
    return { query, startPos: atPos };
  }

  /**
   * Find @ position before cursor
   */
  private findAtPosition(text: string, cursorPos: number): number {
    for (let i = cursorPos - 1; i >= 0; i--) {
      const char = text[i];
      if (char === undefined) break;

      if (this.isStopChar(char)) break;
      if (char === '@') return i;
    }
    return -1;
  }

  /**
   * Check if character is a stop character (whitespace or newline)
   */
  private isStopChar(char: string): boolean {
    return char === ' ' || char === '\n' || char === '\t';
  }

  /**
   * Check if @ position is valid (at start of line or after whitespace)
   */
  private isValidAtPosition(text: string, atPos: number): boolean {
    if (atPos === 0) return true;

    const prevChar = text[atPos - 1];
    if (prevChar === undefined) return false;
    return this.isStopChar(prevChar);
  }

  /**
   * Check if query matches code search pattern
   * Returns null if not a code search pattern
   */
  public parseCodeSearchQuery(query: string): CodeSearchQueryResult | null {
    const match = query.match(CODE_SEARCH_PATTERN);
    if (!match || !match[1]) return null;

    const language = match[1];
    const rawQuery = match[2] ?? '';
    const { symbolQuery, symbolTypeFilter } = this.parseSymbolTypeFilter(rawQuery);

    return { language, symbolQuery, symbolTypeFilter };
  }

  /**
   * Parse symbol type filter from query
   * E.g., "func:Create" → type="func", query="Create"
   */
  private parseSymbolTypeFilter(rawQuery: string): { symbolQuery: string; symbolTypeFilter: string | null } {
    const colonIndex = rawQuery.indexOf(':');
    if (colonIndex < 0) {
      return { symbolQuery: rawQuery, symbolTypeFilter: null };
    }

    const potentialType = rawQuery.substring(0, colonIndex).toLowerCase();
    if (SYMBOL_TYPE_FROM_DISPLAY[potentialType]) {
      return {
        symbolTypeFilter: potentialType,
        symbolQuery: rawQuery.substring(colonIndex + 1)
      };
    }

    return { symbolQuery: rawQuery, symbolTypeFilter: null };
  }

  /**
   * Check if a query is a code search pattern
   */
  public isCodeSearchPattern(query: string): boolean {
    return CODE_SEARCH_PATTERN.test(query);
  }
}
