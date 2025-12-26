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
// @ts-nocheck


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

    // Find the @ before cursor
    let atPos = -1;
    for (let i = cursorPos - 1; i >= 0; i--) {
      const char = text[i];

      // Stop at whitespace or newline
      if (char === ' ' || char === '\n' || char === '\t') {
        break;
      }

      // Found @
      if (char === '@') {
        atPos = i;
        break;
      }
    }

    if (atPos === -1) return null;

    // Check that @ is at start of line or after whitespace
    if (atPos > 0) {
      const prevChar = text[atPos - 1];
      if (prevChar !== ' ' && prevChar !== '\n' && prevChar !== '\t') {
        return null; // @ is part of something else (like email)
      }
    }

    // Extract query (text after @ up to cursor)
    const query = text.substring(atPos + 1, cursorPos);

    return { query, startPos: atPos };
  }

  /**
   * Check if query matches code search pattern
   * Returns null if not a code search pattern
   */
  public parseCodeSearchQuery(query: string): CodeSearchQueryResult | null {
    const match = query.match(CODE_SEARCH_PATTERN);
    if (!match || !match[1]) {
      return null;
    }

    const language = match[1];
    const rawQuery = match[2] ?? '';

    // Parse symbol type filter (e.g., "func:Create" → type="func", query="Create")
    const colonIndex = rawQuery.indexOf(':');
    let symbolTypeFilter: string | null = null;
    let symbolQuery: string;

    if (colonIndex >= 0) {
      const potentialType = rawQuery.substring(0, colonIndex).toLowerCase();
      if (SYMBOL_TYPE_FROM_DISPLAY[potentialType]) {
        symbolTypeFilter = potentialType;
        symbolQuery = rawQuery.substring(colonIndex + 1);
      } else {
        // Not a valid symbol type, treat entire string as query
        symbolQuery = rawQuery;
      }
    } else {
      symbolQuery = rawQuery;
    }

    return {
      language,
      symbolQuery,
      symbolTypeFilter
    };
  }

  /**
   * Check if a query is a code search pattern
   */
  public isCodeSearchPattern(query: string): boolean {
    return CODE_SEARCH_PATTERN.test(query);
  }
}
