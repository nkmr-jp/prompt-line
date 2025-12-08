/**
 * File Search Module
 *
 * Handles @ file mention functionality with incremental search.
 * This module is split into multiple submodules for maintainability:
 *
 * - types.ts: Type definitions and utilities
 * - cache-manager.ts: Directory data caching
 * - fuzzy-matcher.ts: File filtering and fuzzy matching
 * - path-utils.ts: Path detection and coordinate calculation
 * - highlighter.ts: @path highlighting in text
 * - file-search-manager.ts: Main orchestration
 */

// Main export
export { FileSearchManager } from './file-search-manager';

// Type exports for external use
export type {
  DirectoryData,
  FileSearchCallbacks,
  AtPathRange,
  SuggestionItem
} from './types';

// Utility exports (for testing or direct use)
export { formatLog, insertSvgIntoElement } from './types';

// Submodule exports (for advanced usage)
export { FileSearchCacheManager } from './cache-manager';
export { FileSearchFuzzyMatcher } from './fuzzy-matcher';
export { FileSearchHighlighter } from './highlighter';
export {
  CaretPositionCalculator,
  findAtPathAtPosition,
  findUrlAtPosition,
  findSlashCommandAtPosition,
  findAbsolutePathAtPosition,
  findClickablePathAtPosition,
  normalizePath,
  resolveAtPathToAbsolute,
  openUrlInBrowser,
  openFileAndRestoreFocus
} from './path-utils';
