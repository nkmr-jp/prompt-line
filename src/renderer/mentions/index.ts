/**
 * Mentions module - utilities for @ mention functionality (files, code symbols, agents)
 *
 * This module provides:
 * - Type definitions for mention data structures (files, symbols, agents)
 * - Path manipulation utilities
 * - Fuzzy matching and scoring algorithms
 * - Text finding utilities for cursor position detection
 * - DOM utilities for highlighting and caret position calculation
 * - Code symbol search functionality
 */

// Type definitions
export type {
  DirectoryData,
  MentionCallbacks,
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
  calculateAgentMatchScore,
  clearLowercaseCache,
  getLowercaseCacheSize,
  compareTiebreak
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
  findAgentSkillAtPosition,
  findAbsolutePathAtPosition,
  findClickablePathAtPosition,
  findAllUrls,
  findAllAbsolutePaths,
  resolveAtPathToAbsolute
} from './text-finder';

// DOM utilities
export {
  insertHighlightedText,
  getCaretCoordinates,
  createMirrorDiv
} from './dom-utils';

// Manager classes
export {
  PopupManager,
  SettingsCacheManager,
  DirectoryCacheManager,
  SuggestionUIManager,
  HighlightManager,
  FileOpenerEventHandler,
  CodeSearchManager
} from './managers';

export type {
  PopupManagerCallbacks,
  DirectoryCacheCallbacks,
  SuggestionUICallbacks,
  HighlightManagerCallbacks,
  DirectoryDataForHighlight,
  FileOpenerCallbacks
} from './managers';
