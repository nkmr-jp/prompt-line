/**
 * Types for Symbol Search functionality
 * Used by both Main Process and IPC communication
 */

// Symbol types that can be detected
export type SymbolType = 'function' | 'method' | 'class' | 'struct' | 'interface' | 'type';

// A single symbol search result
export interface SymbolResult {
  name: string;
  type: SymbolType;
  filePath: string;
  relativePath: string;
  lineNumber: number;
  lineContent: string;
  language: string;
}

// Response from symbol search command
export interface SymbolSearchResponse {
  success: boolean;
  directory?: string;
  language?: string;
  symbols: SymbolResult[];
  symbolCount: number;
  searchMode: 'full' | 'cached';
  partial: boolean;
  maxSymbols: number;
  error?: string;
}

// Response from check-rg command
export interface RgCheckResponse {
  rgAvailable: boolean;
  rgPath: string | null;
}

// Language info for list-languages command
export interface LanguageInfo {
  key: string;
  extension: string;
  displayName: string;
}

// Response from list-languages command
export interface LanguagesResponse {
  languages: LanguageInfo[];
}

// Symbol search options
export interface SymbolSearchOptions {
  maxSymbols?: number;
  timeout?: number;
  rgPath?: string | null;
  excludePatterns?: string[];
  includePatterns?: string[];
}

// Symbol cache metadata for a language
export interface LanguageCacheMetadata {
  symbolCount: number;
  searchMode: 'full' | 'quick';
}

// Symbol cache metadata
export interface SymbolCacheMetadata {
  version: string;
  directory: string;
  createdAt: string;
  updatedAt: string;
  languages: Record<string, LanguageCacheMetadata>;
  totalSymbolCount: number;
  ttlSeconds: number;
}
