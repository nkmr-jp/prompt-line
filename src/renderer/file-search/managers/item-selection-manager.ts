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
    const cachedData = this.callbacks.getCachedDirectoryData();
    const baseDir = cachedData?.directory || '';
    const relativePath = this.getRelativePathWithTrailingSlash(file, baseDir);

    if (file.isDirectory) {
      this.handleDirectorySelection(relativePath);
      return;
    }

    if (this.tryNavigateIntoFileForSymbols(file, relativePath)) {
      return;
    }

    this.handleFileSelection(relativePath);
  }

  /**
   * Get relative path with trailing slash for directories
   */
  private getRelativePathWithTrailingSlash(file: FileInfo, baseDir: string): string {
    let relativePath = getRelativePath(file.path, baseDir);
    if (file.isDirectory && !relativePath.endsWith('/')) {
      relativePath += '/';
    }
    return relativePath;
  }

  /**
   * Handle directory selection
   */
  private handleDirectorySelection(relativePath: string): void {
    this.callbacks.insertFilePath(relativePath);
    this.callbacks.hideSuggestions();
    this.callbacks.onFileSelected(relativePath);
  }

  /**
   * Try to navigate into file for symbol search
   * @returns true if navigation started
   */
  private tryNavigateIntoFileForSymbols(file: FileInfo, relativePath: string): boolean {
    const language = this.callbacks.getLanguageForFile(file.name);
    if (this.callbacks.isCodeSearchAvailable() && language) {
      this.callbacks.navigateIntoFile(relativePath, file.path, language);
      return true;
    }
    return false;
  }

  /**
   * Handle regular file selection
   */
  private handleFileSelection(relativePath: string): void {
    this.callbacks.insertFilePath(relativePath);
    this.callbacks.hideSuggestions();
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

    const pathWithLineAndSymbol = `${symbol.relativePath}:${symbol.lineNumber}#${symbol.name} `;
    const pathForHighlight = `${symbol.relativePath}:${symbol.lineNumber}#${symbol.name}`;

    this.replaceTextWithSymbolPath(textInput, atStartPosition, pathWithLineAndSymbol);
    this.updateSymbolPathState(pathForHighlight);
  }

  /**
   * Replace text with symbol path
   */
  private replaceTextWithSymbolPath(
    textInput: HTMLTextAreaElement,
    atStartPosition: number,
    pathWithLineAndSymbol: string
  ): void {
    const cursorPos = textInput.selectionStart;
    const savedAtStartPosition = atStartPosition;

    if (this.callbacks.replaceRangeWithUndo) {
      this.callbacks.replaceRangeWithUndo(savedAtStartPosition + 1, cursorPos, pathWithLineAndSymbol);
    } else {
      this.fallbackReplaceText(textInput, savedAtStartPosition, cursorPos, pathWithLineAndSymbol);
    }
  }

  /**
   * Fallback text replacement without undo support
   */
  private fallbackReplaceText(
    textInput: HTMLTextAreaElement,
    atStartPosition: number,
    cursorPos: number,
    pathWithLineAndSymbol: string
  ): void {
    const text = textInput.value;
    const newText = text.substring(0, atStartPosition + 1) + pathWithLineAndSymbol + text.substring(cursorPos);
    textInput.value = newText;
    const newCursorPos = atStartPosition + 1 + pathWithLineAndSymbol.length;
    textInput.setSelectionRange(newCursorPos, newCursorPos);
  }

  /**
   * Update state after symbol selection
   */
  private updateSymbolPathState(pathForHighlight: string): void {
    this.callbacks.addSelectedPath(pathForHighlight);
    console.debug('[ItemSelectionManager] Added symbol path to selectedPaths:', pathForHighlight);
    this.callbacks.updateHighlightBackdrop();
    this.callbacks.onFileSelected(pathForHighlight);
    this.callbacks.resetCodeSearchState();
    this.callbacks.hideSuggestions();
  }
}
