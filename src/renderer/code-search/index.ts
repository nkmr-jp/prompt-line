/**
 * Code Search Module
 * Provides symbol search functionality triggered by @<ext>:<query> pattern
 */

export { CodeSearchManager } from './code-search-manager';
export type {
  SymbolType,
  SymbolResult,
  LanguageInfo,
  ParsedCodeQuery,
  CodeSearchCallbacks,
  SymbolSearchResponse,
  RgCheckResponse,
  LanguagesResponse,
  CodeSearchConfig
} from './types';
export { getSymbolTypeDisplay } from './types';
