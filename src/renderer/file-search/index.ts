/**
 * File Search module - utilities for @ mention file search functionality
 *
 * This module provides:
 * - Type definitions for file search data structures
 * - Path manipulation utilities
 * - Fuzzy matching and scoring algorithms
 * - Text finding utilities for cursor position detection
 */

// Type definitions
export type {
  DirectoryData,
  FileSearchCallbacks,
  AtPathRange,
  SuggestionItem,
  ParsedPathInfo
} from './types';

export { formatLog, insertSvgIntoElement } from './types';

// Path utilities
export {
  normalizePath,
  parsePathWithLineInfo,
  getRelativePath,
  getDirectoryFromPath
} from './path-utils';

// Fuzzy matching and scoring
export {
  fuzzyMatch,
  calculateMatchScore,
  calculateAgentMatchScore
} from './fuzzy-matcher';

// Text finding utilities
export type {
  TextMatch,
  UrlMatch,
  CommandMatch,
  PathMatch
} from './text-finder';

export {
  findAtPathAtPosition,
  findUrlAtPosition,
  findSlashCommandAtPosition,
  findAbsolutePathAtPosition,
  findClickablePathAtPosition,
  resolveAtPathToAbsolute
} from './text-finder';
