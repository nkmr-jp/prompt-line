/**
 * Keyboard Navigation Manager
 * Handles keyboard navigation for file search suggestions
 */

import type { FileInfo } from '../../../types';
import type { SuggestionItem } from '../types';
import { getRelativePath } from '../path-utils';

export interface KeyboardNavigationCallbacks {
  // State getters
  getIsVisible: () => boolean;
  getSelectedIndex: () => number;
  getTotalItemCount: () => number;
  getMergedSuggestions: () => SuggestionItem[];
  getCachedDirectoryData: () => { directory?: string } | null;
  getIsInSymbolMode: () => boolean;
  getCurrentQuery: () => string;
  getIsComposing: (() => boolean) | undefined;

  // State setters
  setSelectedIndex: (index: number) => void;

  // Actions
  updateSelection: () => void;
  selectItem: (index: number) => void;
  hideSuggestions: () => void;
  expandCurrentDirectory: () => void;
  expandCurrentFile: () => void;
  navigateIntoDirectory: (file: FileInfo) => void;
  exitSymbolMode: () => void;
  removeAtQueryText: () => void;
  openFileAndRestoreFocus: (filePath: string) => Promise<void>;
  insertFilePath: (path: string) => void;
  onFileSelected: (path: string) => void;
  toggleAutoShowTooltip: () => void;
}

export class KeyboardNavigationManager {
  private callbacks: KeyboardNavigationCallbacks;

  constructor(callbacks: KeyboardNavigationCallbacks) {
    this.callbacks = callbacks;
  }

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

      this.callbacks.selectItem(selectedIndex);
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
        this.callbacks.navigateIntoDirectory(suggestion.file);
        return;
      }

      // Otherwise select the item (file or agent)
      this.callbacks.selectItem(selectedIndex);
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
      this.callbacks.expandCurrentDirectory();
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
}
