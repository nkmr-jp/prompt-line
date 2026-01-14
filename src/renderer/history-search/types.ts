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
  /** Maximum number of items to search through (default: 5000) */
  maxSearchItems: number;
  /** Maximum number of results to display (default: 200) */
  maxDisplayResults: number;
  /** Case sensitive search (default: false) */
  caseSensitive: boolean;
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: HistorySearchConfig = {
  debounceDelay: 150,
  enableFuzzyMatch: false,
  maxSearchItems: 5000,
  maxDisplayResults: 50,
  caseSensitive: false
};

/**
 * Callbacks for history search state changes
 */
export interface HistorySearchCallbacks {
  /** Called when search state or results change */
  onSearchStateChange: (isSearchMode: boolean, filteredData: HistoryItem[], totalMatches?: number) => void;
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
 * Filter result with items and total match count
 */
export interface FilterResult {
  /** Filtered items (limited to maxDisplayResults) */
  items: HistoryItem[];
  /** Total number of items that matched (before display limit) */
  totalMatches: number;
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
  /** Maximum recency bonus (0-200 based on timestamp) */
  MAX_RECENCY_BONUS: 200
} as const;

/**
 * Recency calculation configuration
 */
export const RECENCY_CONFIG = {
  /** Time-to-live in days for recency bonus (after this, bonus becomes 0) */
  TTL_DAYS: 30
} as const;

// Re-export HistoryItem for convenience
export type { HistoryItem };
