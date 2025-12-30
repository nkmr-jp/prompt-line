/**
 * NavigationManager - Handles navigation, selection, and keyboard events
 *
 * Consolidated from:
 * - NavigationManager: Keyboard navigation and directory/file navigation
 * - ItemSelectionManager: Item selection logic (file, agent, symbol)
 *
 * Responsibilities:
 * - Handle keyboard events for file search navigation
 * - Navigate into directories and update path
 * - Navigate into files to show symbols
 * - Expand current directory path
 * - Route selection to appropriate handler (file, agent, symbol)
 * - Handle file selection with symbol navigation
 * - Handle agent selection with input format support
 * - Handle symbol selection with path and line number
 */

import type { FileInfo, DirectoryData, SuggestionItem } from '../types';
import type { AgentItem } from '../../../types';
import { electronAPI } from '../../services/electron-api';
import type { SymbolResult, LanguageInfo } from '../../code-search/types';
import { getRelativePath, formatLog } from '../index';

/**
 * Callbacks for NavigationManager
 */
export interface NavigationCallbacks {
  // State getters
  getIsVisible: () => boolean;
  getSelectedIndex: () => number;
  getTotalItemCount: () => number;
  getMergedSuggestions: () => SuggestionItem[];
  getCachedDirectoryData: () => DirectoryData | null;
  getIsInSymbolMode: () => boolean;
  getCurrentQuery: () => string;
  getIsComposing: (() => boolean) | undefined;
  getCurrentPath: () => string;
  getCodeSearchManager: () => {
    navigateIntoFile: (baseDir: string, relativePath: string, absolutePath: string, language: LanguageInfo) => Promise<void>;
    isInSymbolModeActive: () => boolean;
    getCurrentFileSymbols: () => SymbolResult[];
  } | null;

  // State setters
  setSelectedIndex: (index: number) => void;
  setCurrentPath: (path: string) => void;
  setCurrentQuery: (query: string) => void;
  setFilteredFiles: (files: FileInfo[]) => void;
  setFilteredAgents: (agents: never[]) => void;
  setMergedSuggestions: (suggestions: SuggestionItem[]) => void;
  setIsInSymbolMode: (value: boolean) => void;
  setCurrentFilePath: (path: string) => void;
  setCurrentFileSymbols: (symbols: SymbolResult[]) => void;

  // Actions
  updateSelection: () => void;
  hideSuggestions: () => void;
  insertFilePath: (path: string) => void;
  insertFilePathWithoutAt: (path: string) => void;
  onFileSelected: (path: string) => void;
  exitSymbolMode: () => void;
  removeAtQueryText: () => void;
  openFileAndRestoreFocus: (filePath: string) => Promise<void>;
  toggleAutoShowTooltip: () => void;
  expandCurrentFile: () => void;

  // Directory/File navigation helpers
  updateTextInputWithPath: (path: string) => void;
  filterFiles: (query: string) => FileInfo[];
  mergeSuggestions: (query: string) => SuggestionItem[];
  updateSuggestionList: (suggestions: SuggestionItem[], showPath: boolean, selectedIndex: number) => void;
  showTooltipForSelectedItem: () => void;
  showSymbolSuggestions: (query: string) => Promise<void>;

  // Item selection helpers
  getTextInput: () => HTMLTextAreaElement | null;
  getAtStartPosition: () => number;
  getLanguageForFile: (fileName: string) => LanguageInfo | null;
  isCodeSearchAvailable: () => boolean;
  replaceRangeWithUndo?: ((start: number, end: number, text: string) => void) | undefined;
  addSelectedPath: (path: string) => void;
  updateHighlightBackdrop: () => void;
  resetCodeSearchState: () => void;
}

/**
 * NavigationManager handles keyboard navigation, directory/file navigation, and item selection
 */
export class NavigationManager {
  private callbacks: NavigationCallbacks;

  constructor(callbacks: NavigationCallbacks) {
    this.callbacks = callbacks;
  }

  // ========================================
  // Keyboard Navigation Methods
  // ========================================

  /**
   * Handle keyboard events for file search navigation
   */
  public handleKeyDown(e: KeyboardEvent): void {
    if (!this.callbacks.getIsVisible()) return;

    // Ctrl+i: Toggle auto-show tooltip
    if (e.ctrlKey && e.key === 'i') {
      e.preventDefault();
      e.stopPropagation();
      this.callbacks.toggleAutoShowTooltip();
      return;
    }

    const totalItems = this.callbacks.getTotalItemCount();

    // Ctrl+n or Ctrl+j: Move down (same as ArrowDown)
    if (e.ctrlKey && (e.key === 'n' || e.key === 'j')) {
      this.moveSelection(e, 1, totalItems);
      return;
    }

    // Ctrl+p or Ctrl+k: Move up (same as ArrowUp)
    if (e.ctrlKey && (e.key === 'p' || e.key === 'k')) {
      this.moveSelection(e, -1, totalItems);
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        this.handleArrowDown(e, totalItems);
        break;

      case 'ArrowUp':
        this.handleArrowUp(e);
        break;

      case 'Enter':
        this.handleEnter(e, totalItems);
        break;

      case 'Tab':
        this.handleTab(e, totalItems);
        break;

      case 'Escape':
        this.handleEscape(e);
        break;

      case 'Backspace':
        this.handleBackspace(e);
        break;
    }
  }

  private handleArrowDown(e: KeyboardEvent, totalItems: number): void {
    this.moveSelection(e, 1, totalItems);
  }

  private handleArrowUp(e: KeyboardEvent): void {
    this.moveSelection(e, -1, this.callbacks.getTotalItemCount());
  }

  /**
   * Move selection by delta amount, clamping to valid range
   */
  private moveSelection(e: KeyboardEvent, delta: number, totalItems: number): void {
    e.preventDefault();
    e.stopPropagation();
    const currentIndex = this.callbacks.getSelectedIndex();
    const newIndex = delta > 0
      ? Math.min(currentIndex + delta, totalItems - 1)
      : Math.max(currentIndex + delta, 0);
    this.callbacks.setSelectedIndex(newIndex);
    this.callbacks.updateSelection();
  }

  private handleEnter(e: KeyboardEvent, totalItems: number): void {
    // Skip Enter key if IME is active to let IME handle it (for Japanese input confirmation)
    if (e.isComposing || this.callbacks.getIsComposing?.()) {
      return;
    }

    // Enter: Select the currently highlighted item (agent or file)
    // Ctrl+Enter: Open the file in editor
    if (totalItems > 0 || this.callbacks.getIsInSymbolMode()) {
      e.preventDefault();
      e.stopPropagation();

      const selectedIndex = this.callbacks.getSelectedIndex();

      // 未選択状態（selectedIndex < 0）の場合
      if (this.handleUnselectedState(selectedIndex)) return;

      if (e.ctrlKey) {
        // Ctrl+Enterでエディタで開く（@検索テキストは削除、パス挿入なし）
        const suggestion = this.callbacks.getMergedSuggestions()[selectedIndex];
        if (suggestion) {
          const filePath = suggestion.type === 'file'
            ? suggestion.file?.path
            : suggestion.agent?.filePath;
          if (filePath) {
            // Remove @query text without inserting file path
            this.callbacks.removeAtQueryText();
            this.callbacks.openFileAndRestoreFocus(filePath)
              .then(() => this.callbacks.hideSuggestions());
            return;
          }
        }
      }

      // For files (not directories), Enter inserts path directly (like directories)
      // Tab navigates into file to show symbols
      const suggestion = this.callbacks.getMergedSuggestions()[selectedIndex];
      if (suggestion?.type === 'file' && suggestion.file && !suggestion.file.isDirectory) {
        // Insert file path directly (don't navigate into symbols)
        const baseDir = this.callbacks.getCachedDirectoryData()?.directory || '';
        const relativePath = getRelativePath(suggestion.file.path, baseDir);
        this.callbacks.insertFilePath(relativePath);
        this.callbacks.hideSuggestions();
        this.callbacks.onFileSelected(relativePath);
        return;
      }

      this.selectItem(selectedIndex);
    }
  }

  private handleTab(e: KeyboardEvent, totalItems: number): void {
    // Skip Tab key if IME is active to let IME handle it
    if (e.isComposing || this.callbacks.getIsComposing?.()) {
      return;
    }

    // Tab: Navigate into directory (for files), or select item (for agents/files)
    if (totalItems > 0 || this.callbacks.getIsInSymbolMode()) {
      e.preventDefault();
      e.stopPropagation();

      const selectedIndex = this.callbacks.getSelectedIndex();

      // 未選択状態（selectedIndex < 0）の場合
      if (this.handleUnselectedState(selectedIndex)) return;

      // Check if current selection is a directory (for navigation)
      const suggestion = this.callbacks.getMergedSuggestions()[selectedIndex];
      if (suggestion?.type === 'file' && suggestion.file?.isDirectory) {
        // Navigate into directory
        this.navigateIntoDirectory(suggestion.file);
        return;
      }

      // Otherwise select the item (file or agent)
      this.selectItem(selectedIndex);
    }
  }

  /**
   * Handle unselected state (selectedIndex < 0)
   * @returns true if handled (caller should return), false otherwise
   */
  private handleUnselectedState(selectedIndex: number): boolean {
    if (selectedIndex < 0) {
      // シンボルモードの場合はファイルパス自体を挿入
      if (this.callbacks.getIsInSymbolMode()) {
        this.callbacks.expandCurrentFile();
        return true;
      }
      // ディレクトリモードの場合はディレクトリパスを展開
      this.expandCurrentDirectory();
      return true;
    }
    return false;
  }

  private handleEscape(e: KeyboardEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.callbacks.hideSuggestions();
  }

  private handleBackspace(e: KeyboardEvent): void {
    // In symbol mode with empty query, exit symbol mode
    if (this.callbacks.getIsInSymbolMode() && this.callbacks.getCurrentQuery() === '') {
      e.preventDefault();
      e.stopPropagation();
      this.callbacks.exitSymbolMode();
    }
  }

  // ========================================
  // Directory/File Navigation Methods
  // ========================================

  /**
   * Navigate into a directory to show its contents
   * @param directory - Directory to navigate into
   */
  public navigateIntoDirectory(directory: FileInfo): void {
    const cachedData = this.callbacks.getCachedDirectoryData();
    if (!directory.isDirectory || !cachedData) return;

    const baseDir = cachedData.directory;
    const relativePath = getRelativePath(directory.path, baseDir);

    // Update current path to the selected directory
    const newPath = relativePath.endsWith('/') ? relativePath : relativePath + '/';
    this.callbacks.setCurrentPath(newPath);

    console.debug('[NavigationManager] navigateIntoDirectory:', formatLog({
      directory: directory.name,
      currentPath: newPath
    }));

    // Update the text input to show the current path after @
    this.callbacks.updateTextInputWithPath(newPath);

    // Clear the query and show files in the new directory
    // selectedIndex = -1 for unselected state (Tab/Enter can expand directory itself)
    this.callbacks.setCurrentQuery('');
    this.callbacks.setSelectedIndex(-1);
    const filteredFiles = this.callbacks.filterFiles('');
    this.callbacks.setFilteredFiles(filteredFiles);
    this.callbacks.setFilteredAgents([]); // No agents when navigating into subdirectory
    const mergedSuggestions = this.callbacks.mergeSuggestions('');
    this.callbacks.setMergedSuggestions(mergedSuggestions);

    // Delegate rendering to SuggestionListManager (position remains unchanged)
    this.callbacks.updateSuggestionList(mergedSuggestions, false, -1);
    // Update popup tooltip for selected item
    this.callbacks.showTooltipForSelectedItem();
  }

  /**
   * Navigate into a file to show its symbols
   * @param relativePath - Relative path of the file
   * @param absolutePath - Absolute path of the file
   * @param language - Language info for symbol search
   */
  public async navigateIntoFile(relativePath: string, absolutePath: string, language: LanguageInfo): Promise<void> {
    const cachedData = this.callbacks.getCachedDirectoryData();
    const codeSearchManager = this.callbacks.getCodeSearchManager();
    if (!cachedData || !codeSearchManager) return;

    // Update local state for UI
    this.callbacks.setIsInSymbolMode(true);
    this.callbacks.setCurrentFilePath(relativePath);
    this.callbacks.setCurrentQuery('');
    this.callbacks.setCurrentPath(relativePath);

    console.debug('[NavigationManager] navigateIntoFile:', formatLog({
      file: relativePath,
      language: language.key
    }));

    // Update text input to show the file path
    this.callbacks.updateTextInputWithPath(relativePath);

    // Delegate symbol loading to CodeSearchManager
    await codeSearchManager.navigateIntoFile(
      cachedData.directory,
      relativePath,
      absolutePath,
      language
    );

    // Check if CodeSearchManager successfully loaded symbols
    if (!codeSearchManager.isInSymbolModeActive()) {
      // No symbols found - insert file path directly
      this.callbacks.setIsInSymbolMode(false);
      this.callbacks.insertFilePath(relativePath);
      this.callbacks.hideSuggestions();
      this.callbacks.onFileSelected(relativePath);
      return;
    }

    // Get symbols from CodeSearchManager
    const symbols = codeSearchManager.getCurrentFileSymbols();
    this.callbacks.setCurrentFileSymbols(symbols);

    // Show symbols with selectedIndex = -1 (like directory navigation)
    this.callbacks.setSelectedIndex(-1);
    await this.callbacks.showSymbolSuggestions('');
  }

  /**
   * Expand current directory path (insert path with trailing slash)
   */
  public expandCurrentDirectory(): void {
    const currentPath = this.callbacks.getCurrentPath();
    if (!currentPath) return;

    // Add trailing slash and insert path
    const pathWithSlash = currentPath.endsWith('/') ? currentPath : currentPath + '/';
    this.callbacks.insertFilePath(pathWithSlash);
    this.callbacks.hideSuggestions();

    // Callback for external handling
    this.callbacks.onFileSelected(pathWithSlash);
  }

  // ========================================
  // Item Selection Methods (from ItemSelectionManager)
  // ========================================

  /**
   * Select an item by index from merged suggestions
   * @param index - Index in merged suggestions
   */
  public selectItem(index: number): void {
    const suggestions = this.callbacks.getMergedSuggestions();
    const suggestion = suggestions[index];
    if (!suggestion) return;

    this.selectSuggestionItem(suggestion);
  }

  /**
   * Select an item from merged suggestions
   * @param suggestion - The suggestion item to select
   */
  public selectSuggestionItem(suggestion: SuggestionItem): void {
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
      this.navigateIntoFile(relativePath, file.path, language);
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

      // Register agent name in global cache for persistent highlighting
      // Agents are project-independent (mdSearch items)
      if (electronAPI?.atPathCache?.registerGlobal) {
        electronAPI.atPathCache.registerGlobal(agent.name)
          .catch((error) => console.warn('[NavigationManager] Failed to register global at-path:', error));
      }
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
    console.debug('[NavigationManager] Added symbol path to selectedPaths:', pathForHighlight);

    // Register at-path in cache for persistent highlighting (supports symbols with spaces)
    const directoryData = this.callbacks.getCachedDirectoryData();
    if (directoryData?.directory && electronAPI?.atPathCache) {
      electronAPI.atPathCache.register(directoryData.directory, pathForHighlight)
        .catch((error) => console.warn('[NavigationManager] Failed to register at-path:', error));
    }

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
