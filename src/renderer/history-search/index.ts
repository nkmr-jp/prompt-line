/**
 * History Search module - Public API exports
 * Provides modular history search functionality following FileSearch patterns
 */

// Main manager class
export { HistorySearchManager } from './history-search-manager';

// Filter engine for search logic
export { HistorySearchFilterEngine } from './filter-engine';

// Highlighter for search term display
export { HistorySearchHighlighter } from './highlighter';

// Types
export type {
  HistorySearchConfig,
  HistorySearchCallbacks,
  SearchResult,
  HistorySearchState,
  HistoryItem
} from './types';

// Constants
export { DEFAULT_CONFIG, MATCH_SCORES } from './types';
