/**
 * ItemSelectionManager - Handles item selection logic for file search
 *
 * Extracted from FileSearchManager to improve modularity and reduce file size.
 * Responsibilities:
 * - Route selection to appropriate handler (file, agent, symbol)
 * - Handle file selection with symbol navigation
 * - Handle agent selection with input format support
 * - Handle symbol selection with path and line number
 */

import type { FileInfo, SuggestionItem, DirectoryData } from '../types';
import type { AgentItem } from '../../../types';
import type { SymbolResult, LanguageInfo } from '../../code-search/types';
import { getRelativePath } from '../index';

/**
 * Callbacks for ItemSelectionManager
 */
export interface ItemSelectionCallbacks {
  /** Get cached directory data */
  getCachedDirectoryData: () => DirectoryData | null;
  /** Get text input element */
  getTextInput: () => HTMLTextAreaElement | null;
  /** Get at start position */
  getAtStartPosition: () => number;
  /** Insert file path (with @ prefix) */
  insertFilePath: (path: string) => void;
  /** Insert file path without @ prefix */
  insertFilePathWithoutAt: (path: string) => void;
  /** Hide suggestions popup */
  hideSuggestions: () => void;
  /** Callback when file is selected */
  onFileSelected: (path: string) => void;
  /** Navigate into file to show symbols */
  navigateIntoFile: (relativePath: string, absolutePath: string, language: LanguageInfo) => Promise<void>;
  /** Get language info for file */
  getLanguageForFile: (fileName: string) => LanguageInfo | null;
  /** Check if code search is available */
  isCodeSearchAvailable: () => boolean;
  /** Replace range with undo support */
  replaceRangeWithUndo?: ((start: number, end: number, text: string) => void) | undefined;
  /** Add path to selected paths set */
  addSelectedPath: (path: string) => void;
  /** Update highlight backdrop */
  updateHighlightBackdrop: () => void;
  /** Reset code search state */
  resetCodeSearchState: () => void;
}

/**
 * ItemSelectionManager handles item selection for file, agent, and symbol
 */
export class ItemSelectionManager {
  private callbacks: ItemSelectionCallbacks;

  constructor(callbacks: ItemSelectionCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Select an item from merged suggestions
   * @param suggestion - The suggestion item to select
   */
  public selectItem(suggestion: SuggestionItem): void {
    if (!suggestion) return;

    if (suggestion.type === 'file' && suggestion.file) {
      this.selectFileByInfo(suggestion.file);
    } else if (suggestion.type === 'agent' && suggestion.agent) {
      this.selectAgentByInfo(suggestion.agent);
    } else if (suggestion.type === 'symbol' && suggestion.symbol) {
      this.selectSymbol(suggestion.symbol);
    }
  }

  /**
   * Select a file by its info
   * @param file - File info to select
   */
  public selectFileByInfo(file: FileInfo): void {
    // Get relative path from base directory
    const cachedData = this.callbacks.getCachedDirectoryData();
    const baseDir = cachedData?.directory || '';
    let relativePath = getRelativePath(file.path, baseDir);

    // Add trailing slash for directories
    if (file.isDirectory && !relativePath.endsWith('/')) {
      relativePath += '/';
    }

    // If it's a directory, just insert the path
    if (file.isDirectory) {
      this.callbacks.insertFilePath(relativePath);
      this.callbacks.hideSuggestions();
      this.callbacks.onFileSelected(relativePath);
      return;
    }

    // Check if symbol search is available for this file type
    const language = this.callbacks.getLanguageForFile(file.name);
    if (this.callbacks.isCodeSearchAvailable() && language) {
      // Navigate into file to show symbols
      this.callbacks.navigateIntoFile(relativePath, file.path, language);
      return;
    }

    // Fallback: insert the file path
    this.callbacks.insertFilePath(relativePath);
    this.callbacks.hideSuggestions();

    // Callback for external handling
    this.callbacks.onFileSelected(relativePath);
  }

  /**
   * Select an agent by its info
   * @param agent - Agent item to select
   */
  public selectAgentByInfo(agent: AgentItem): void {
    // Determine what to insert based on agent's inputFormat setting
    // Default to 'name' for agents (backward compatible behavior)
    const inputFormat = agent.inputFormat ?? 'name';

    if (inputFormat === 'path') {
      // For 'path' format, replace @ and query with just the file path (no @)
      this.callbacks.insertFilePathWithoutAt(agent.filePath);
    } else {
      // For 'name' format, keep @ and insert just the name
      this.callbacks.insertFilePath(agent.name);
    }
    this.callbacks.hideSuggestions();

    // Callback for external handling
    const insertText = inputFormat === 'path' ? agent.filePath : agent.name;
    this.callbacks.onFileSelected(inputFormat === 'name' ? `@${insertText}` : insertText);
  }

  /**
   * Select a symbol and insert its path with line number
   * @param symbol - Symbol result to select
   */
  public selectSymbol(symbol: SymbolResult): void {
    const textInput = this.callbacks.getTextInput();
    const atStartPosition = this.callbacks.getAtStartPosition();
    if (!textInput || atStartPosition < 0) return;

    // Format: relativePath:lineNumber#symbolName (keep @ prefix)
    // The @ is already at atStartPosition, so we insert path after it
    const pathWithLineAndSymbol = `${symbol.relativePath}:${symbol.lineNumber}#${symbol.name} `;

    // Get current cursor position (end of the @query)
    const cursorPos = textInput.selectionStart;

    // Save atStartPosition before replacement - replaceRangeWithUndo triggers input event
    // which calls checkForFileSearch() and may set atStartPosition to -1 via hideSuggestions()
    const savedAtStartPosition = atStartPosition;

    // Replace the lang:query part (after @) with the path:line#symbol
    // atStartPosition is the @ position, so we replace from atStartPosition + 1 to keep @
    if (this.callbacks.replaceRangeWithUndo) {
      // execCommand('insertText') sets cursor at end of inserted text automatically
      // Do NOT set cursor position after this - input event handler may have modified atStartPosition
      this.callbacks.replaceRangeWithUndo(savedAtStartPosition + 1, cursorPos, pathWithLineAndSymbol);
    } else {
      // Fallback without undo support - need to set cursor position manually
      const text = textInput.value;
      const newText = text.substring(0, savedAtStartPosition + 1) + pathWithLineAndSymbol + text.substring(cursorPos);
      textInput.value = newText;
      const newCursorPos = savedAtStartPosition + 1 + pathWithLineAndSymbol.length;
      textInput.setSelectionRange(newCursorPos, newCursorPos);
    }

    // Add to selectedPaths for highlighting and click-to-open
    // Use the full path including line number and symbol name (without trailing space)
    const pathForHighlight = `${symbol.relativePath}:${symbol.lineNumber}#${symbol.name}`;
    this.callbacks.addSelectedPath(pathForHighlight);
    console.debug('[ItemSelectionManager] Added symbol path to selectedPaths:', pathForHighlight);

    // Update highlight backdrop (this also calls rescanAtPaths internally)
    this.callbacks.updateHighlightBackdrop();

    // Notify callback
    this.callbacks.onFileSelected(pathForHighlight);

    // Reset code search state
    this.callbacks.resetCodeSearchState();

    // Hide suggestions
    this.callbacks.hideSuggestions();
  }
}
