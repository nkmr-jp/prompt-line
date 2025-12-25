/**
 * Symbol Filter Manager
 * Handles symbol filtering, sorting, and ranking logic
 */

import type { SymbolResult } from './types';
import { SYMBOL_TYPE_FROM_DISPLAY } from './types';

const MAX_SUGGESTIONS = 20;

/**
 * SymbolFilterManager class
 * Manages symbol filtering and sorting algorithms
 */
export class SymbolFilterManager {
  /**
   * Filter and sort symbols based on query and optional type filter
   * @param symbols - All symbols to filter
   * @param query - Search query string
   * @param symbolTypeFilter - Optional symbol type filter (e.g., "func" for functions only)
   * @returns Filtered and sorted symbols (limited to MAX_SUGGESTIONS)
   */
  filterSymbols(
    symbols: SymbolResult[],
    query: string,
    symbolTypeFilter: string | null = null
  ): SymbolResult[] {
    let filtered = symbols;

    // Filter by symbol type first (e.g., @go:func: → only functions)
    if (symbolTypeFilter) {
      const targetType = SYMBOL_TYPE_FROM_DISPLAY[symbolTypeFilter];
      if (targetType) {
        filtered = filtered.filter(s => s.type === targetType);
      }
    }

    // Filter symbols by query (search in both name and lineContent)
    if (query) {
      const lowerQuery = query.toLowerCase();
      filtered = filtered.filter(s =>
        s.name.toLowerCase().includes(lowerQuery) ||
        s.lineContent.toLowerCase().includes(lowerQuery)
      );

      // Sort by match relevance (name match takes priority)
      filtered = this.sortByRelevance(filtered, lowerQuery);
    }

    // Limit results
    return filtered.slice(0, MAX_SUGGESTIONS);
  }

  /**
   * Parse query to extract symbol type filter and search query
   * Examples:
   *   "func:Create" → { symbolTypeFilter: "func", query: "Create" }
   *   "func:" → { symbolTypeFilter: "func", query: "" }
   *   "Handle" → { symbolTypeFilter: null, query: "Handle" }
   */
  parseQuery(rawQuery: string): { symbolTypeFilter: string | null; query: string } {
    const colonIndex = rawQuery.indexOf(':');
    let symbolTypeFilter: string | null = null;
    let query: string;

    if (colonIndex >= 0) {
      const potentialType = rawQuery.substring(0, colonIndex).toLowerCase();
      if (SYMBOL_TYPE_FROM_DISPLAY[potentialType]) {
        symbolTypeFilter = potentialType;
        query = rawQuery.substring(colonIndex + 1);
      } else {
        // Not a valid symbol type, treat entire string as query
        query = rawQuery;
      }
    } else {
      query = rawQuery;
    }

    return { symbolTypeFilter, query };
  }

  /**
   * Sort symbols by match relevance
   * Priority: name match > line content match
   * Within name matches: starts with > contains
   */
  private sortByRelevance(symbols: SymbolResult[], lowerQuery: string): SymbolResult[] {
    return symbols.sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();
      const aNameMatch = aName.includes(lowerQuery);
      const bNameMatch = bName.includes(lowerQuery);

      // Name match takes priority over lineContent match
      if (aNameMatch && !bNameMatch) return -1;
      if (!aNameMatch && bNameMatch) return 1;

      // Within name matches, prefer starts with
      const aStarts = aName.startsWith(lowerQuery);
      const bStarts = bName.startsWith(lowerQuery);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;

      return aName.localeCompare(bName);
    });
  }
}
