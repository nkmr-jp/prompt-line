/**
 * Type definitions and utilities for File Search module
 */
// @ts-nocheck


import type { FileInfo, AgentItem } from '../../types';
import type { SymbolResult } from '../code-search/types';

// Re-export formatLog from debug-logger for backwards compatibility
export { formatLog } from '../utils/debug-logger';

// Re-export FileInfo for internal use in managers
export type { FileInfo };

// Directory data for file search (cached in renderer)
export interface DirectoryData {
  directory: string;
  files: FileInfo[];
  timestamp: number;
  partial?: boolean;          // Always false (single stage with fd)
  searchMode?: 'recursive';   // Always 'recursive' (single stage with fd)
  fromCache?: boolean;        // true if data was loaded from disk cache
  cacheAge?: number;          // milliseconds since cache was updated
  fromDraft?: boolean;        // true if this is from draft fallback (empty files)
  hint?: string;              // hint message to display to user (e.g., "Install fd: brew install fd")
  filesDisabled?: boolean;    // true if file search is disabled for this directory
  filesDisabledReason?: string; // reason why file search is disabled
}

export interface FileSearchCallbacks {
  onFileSelected: (filePath: string) => void;
  getTextContent: () => string;
  setTextContent: (text: string) => void;
  getCursorPosition: () => number;
  setCursorPosition: (position: number) => void;
  onBeforeOpenFile?: () => void; // Called before opening file in editor to suppress blur
  updateHintText?: (text: string) => void; // Update hint text in footer
  getDefaultHintText?: () => string; // Get default hint text (directory path)
  setDraggable?: (enabled: boolean) => void; // Enable/disable window dragging during file open
  replaceRangeWithUndo?: (start: number, end: number, newText: string) => void; // Replace text range with undo support
  getIsComposing?: () => boolean; // Check if IME is active to avoid conflicts with Japanese input
}

// Represents a tracked @path in the text
export interface AtPathRange {
  start: number;              // Position of @
  end: number;                // Position after the last character of the path
  path?: string | undefined;  // The path content (without @) for highlighting
}

// Unified suggestion item (file, agent, or symbol) with score for mixed sorting
export interface SuggestionItem {
  type: 'file' | 'agent' | 'symbol';
  file?: FileInfo;
  agent?: AgentItem;
  symbol?: SymbolResult;
  score: number;
}

// Parsed path with optional line and symbol info
export interface ParsedPathInfo {
  path: string;
  lineNumber?: number;
  symbolName?: string;
}


/**
 * Safely parse and insert SVG content using DOMParser
 * This avoids innerHTML for security while allowing SVG insertion
 */
export function insertSvgIntoElement(element: HTMLElement, svgString: string): void {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  const svgElement = doc.documentElement;

  // Check for parsing errors
  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    console.warn('[FileSearchManager] SVG parse error, using fallback');
    element.textContent = '📄';
    return;
  }

  // Clear existing content and append SVG
  element.textContent = '';
  element.appendChild(element.ownerDocument.importNode(svgElement, true));
}
