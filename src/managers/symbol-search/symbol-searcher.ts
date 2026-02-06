/**
 * Symbol Searcher - Cross-platform symbol search using ripgrep
 * Uses Node.js implementation instead of Swift binary
 */

import { logger } from '../../utils/utils';
import type {
  SymbolSearchResponse,
  RgCheckResponse,
  LanguagesResponse,
  SymbolSearchOptions
} from './types';
import { TIMEOUTS } from '../../constants';
import {
  checkRgAvailable as checkRgNode,
  getSupportedLanguages as getLanguagesNode,
  searchSymbols as searchSymbolsNode
} from '../../utils/symbol-search';

// Default search options (exported for use by handlers)
export const DEFAULT_MAX_SYMBOLS = 200000;
export const DEFAULT_SEARCH_TIMEOUT = TIMEOUTS.SYMBOL_SEARCH;
export const DEFAULT_MAX_BUFFER = 100 * 1024 * 1024; // 100MB buffer for large codebases

/**
 * Check if ripgrep (rg) is available
 */
export async function checkRgAvailable(): Promise<RgCheckResponse> {
  return checkRgNode();
}

/**
 * Get list of supported programming languages
 */
export async function getSupportedLanguages(): Promise<LanguagesResponse> {
  return getLanguagesNode();
}

/**
 * Search for symbols in a directory for a specific language
 * @param directory - The directory to search in
 * @param language - The language key (e.g., 'ts', 'go', 'py')
 * @param options - Optional search options
 */
export async function searchSymbols(
  directory: string,
  language: string,
  options: SymbolSearchOptions = {}
): Promise<SymbolSearchResponse> {
  return searchSymbolsNode(directory, language, options);
}
