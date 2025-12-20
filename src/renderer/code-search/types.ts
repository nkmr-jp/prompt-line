/**
 * Types for Code Search functionality in Renderer
 */

// Symbol types from native tool
export type SymbolType = 'function' | 'method' | 'class' | 'struct' | 'interface' | 'type';

// Symbol result from search
export interface SymbolResult {
  name: string;
  type: SymbolType;
  filePath: string;
  relativePath: string;
  lineNumber: number;
  lineContent: string;
  language: string;
}

// Language info (from native tool)
export interface LanguageInfo {
  key: string;
  displayName: string;
  extension: string;
}

// Response types
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

export interface RgCheckResponse {
  rgAvailable: boolean;
  rgPath: string | null;
}

export interface LanguagesResponse {
  languages: LanguageInfo[];
}

// Code search configuration
export interface CodeSearchConfig {
  enabled: boolean;
  maxSuggestions: number;
}

// Parsed query from input
export interface ParsedCodeQuery {
  language: string;  // e.g., 'go', 'ts'
  query: string;     // e.g., 'Handle'
  startIndex: number;
  endIndex: number;
}

// Callbacks for CodeSearchManager
export interface CodeSearchCallbacks {
  onSymbolSelected: (symbol: SymbolResult) => void;
  getTextContent: () => string;
  setTextContent: (text: string) => void;
  getCursorPosition: () => number;
  setCursorPosition: (position: number) => void;
  updateHintText: (text: string) => void;
  getDefaultHintText: () => string;
  replaceRangeWithUndo: (start: number, end: number, newText: string) => void;
  getIsComposing: () => boolean;
}

// Symbol icon mapping for display
export const SYMBOL_ICONS: Record<SymbolType, string> = {
  function: '𝑓',
  method: '𝑚',
  class: '𝒞',
  struct: '𝒮',
  interface: '𝒾',
  type: '𝒯'
};

// Get display name for symbol type
export function getSymbolTypeDisplay(type: SymbolType): string {
  switch (type) {
    case 'function': return 'func';
    case 'method': return 'method';
    case 'class': return 'class';
    case 'struct': return 'struct';
    case 'interface': return 'iface';
    case 'type': return 'type';
    default: return type;
  }
}
