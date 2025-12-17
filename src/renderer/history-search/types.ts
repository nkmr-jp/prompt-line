/**
 * Type definitions for History Search module
 * Following FileSearch's modular architecture pattern
 */

import type { HistoryItem } from '../types';

/**
 * Configuration for history search behavior
 */
export interface HistorySearchConfig {
  /** Debounce delay in milliseconds (default: 150ms) */
  debounceDelay: number;
  /** Enable fuzzy matching (default: true) */
  enableFuzzyMatch: boolean;
  /** Maximum number of results to display (default: 200) */
  maxResults: number;
  /** Case sensitive search (default: false) */
  caseSensitive: boolean;
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: HistorySearchConfig = {
  debounceDelay: 150,
  enableFuzzyMatch: true,
  maxResults: 200,
  caseSensitive: false
};

/**
 * Callbacks for history search state changes
 */
export interface HistorySearchCallbacks {
  /** Called when search state or results change */
  onSearchStateChange: (isSearchMode: boolean, filteredData: HistoryItem[]) => void;
  /** Optional callback for result count updates */
  onResultCountChange?: (count: number, total: number) => void;
}

/**
 * Search result with scoring information
 */
export interface SearchResult {
  /** The history item */
  item: HistoryItem;
  /** Match score (higher = better match) */
  score: number;
  /** Positions of matched characters (for future highlight enhancement) */
  matchPositions?: number[];
}

/**
 * Current state of the search
 */
export interface HistorySearchState {
  /** Whether search mode is active */
  isSearchMode: boolean;
  /** Current search query */
  query: string;
  /** Number of results matching the query */
  resultCount: number;
  /** Total number of history items */
  totalCount: number;
}

/**
 * Match score constants
 * Following FileSearch's scoring pattern
 */
export const MATCH_SCORES = {
  /** Exact match bonus */
  EXACT_MATCH: 1000,
  /** Text starts with query bonus */
  STARTS_WITH: 500,
  /** Text contains query bonus */
  CONTAINS: 200,
  /** Fuzzy match bonus */
  FUZZY_MATCH: 10,
  /** Maximum recency bonus (0-50 based on timestamp) */
  MAX_RECENCY_BONUS: 50
} as const;

// Re-export HistoryItem for convenience
export type { HistoryItem };
