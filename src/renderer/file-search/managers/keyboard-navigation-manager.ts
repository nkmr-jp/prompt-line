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

    if (this.handleCtrlShortcuts(e)) return;

    this.handleKeySwitch(e);
  }

  private handleCtrlShortcuts(e: KeyboardEvent): boolean {
    if (e.ctrlKey && e.key === 'i') {
      this.handleCtrlI(e);
      return true;
    }

    if (e.ctrlKey && (e.key === 'n' || e.key === 'j')) {
      this.handleCtrlNavigationDown(e);
      return true;
    }

    if (e.ctrlKey && (e.key === 'p' || e.key === 'k')) {
      this.handleCtrlNavigationUp(e);
      return true;
    }

    return false;
  }

  private handleCtrlI(e: KeyboardEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.callbacks.toggleAutoShowTooltip();
  }

  private handleCtrlNavigationDown(e: KeyboardEvent): void {
    e.preventDefault();
    e.stopPropagation();
    const totalItems = this.callbacks.getTotalItemCount();
    this.callbacks.setSelectedIndex(Math.min(this.callbacks.getSelectedIndex() + 1, totalItems - 1));
    this.callbacks.updateSelection();
  }

  private handleCtrlNavigationUp(e: KeyboardEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.callbacks.setSelectedIndex(Math.max(this.callbacks.getSelectedIndex() - 1, 0));
    this.callbacks.updateSelection();
  }

  private handleKeySwitch(e: KeyboardEvent): void {
    const totalItems = this.callbacks.getTotalItemCount();

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
    e.preventDefault();
    e.stopPropagation();
    this.callbacks.setSelectedIndex(Math.min(this.callbacks.getSelectedIndex() + 1, totalItems - 1));
    this.callbacks.updateSelection();
  }

  private handleArrowUp(e: KeyboardEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.callbacks.setSelectedIndex(Math.max(this.callbacks.getSelectedIndex() - 1, 0));
    this.callbacks.updateSelection();
  }

  private handleEnter(e: KeyboardEvent, totalItems: number): void {
    if (e.isComposing || this.callbacks.getIsComposing?.()) return;
    if (totalItems === 0 && !this.callbacks.getIsInSymbolMode()) return;

    e.preventDefault();
    e.stopPropagation();

    const selectedIndex = this.callbacks.getSelectedIndex();

    if (selectedIndex < 0) {
      this.handleUnselectedEnter();
      return;
    }

    if (e.ctrlKey && this.handleCtrlEnter(selectedIndex)) return;
    if (this.handleFileEnter(selectedIndex)) return;

    this.callbacks.selectItem(selectedIndex);
  }

  private handleUnselectedEnter(): void {
    if (this.callbacks.getIsInSymbolMode()) {
      this.callbacks.expandCurrentFile();
    } else {
      this.callbacks.expandCurrentDirectory();
    }
  }

  private handleCtrlEnter(selectedIndex: number): boolean {
    const suggestion = this.callbacks.getMergedSuggestions()[selectedIndex];
    if (!suggestion) return false;

    const filePath = suggestion.type === 'file'
      ? suggestion.file?.path
      : suggestion.agent?.filePath;

    if (filePath) {
      this.callbacks.removeAtQueryText();
      this.callbacks.openFileAndRestoreFocus(filePath)
        .then(() => this.callbacks.hideSuggestions());
      return true;
    }
    return false;
  }

  private handleFileEnter(selectedIndex: number): boolean {
    const suggestion = this.callbacks.getMergedSuggestions()[selectedIndex];
    if (suggestion?.type !== 'file' || !suggestion.file || suggestion.file.isDirectory) {
      return false;
    }

    const baseDir = this.callbacks.getCachedDirectoryData()?.directory || '';
    const relativePath = getRelativePath(suggestion.file.path, baseDir);
    this.callbacks.insertFilePath(relativePath);
    this.callbacks.hideSuggestions();
    this.callbacks.onFileSelected(relativePath);
    return true;
  }

  private handleTab(e: KeyboardEvent, totalItems: number): void {
    if (e.isComposing || this.callbacks.getIsComposing?.()) return;
    if (totalItems === 0 && !this.callbacks.getIsInSymbolMode()) return;

    e.preventDefault();
    e.stopPropagation();

    const selectedIndex = this.callbacks.getSelectedIndex();

    if (selectedIndex < 0) {
      this.handleUnselectedTab();
      return;
    }

    if (this.tryNavigateIntoDirectory(selectedIndex)) return;

    this.callbacks.selectItem(selectedIndex);
  }

  private handleUnselectedTab(): void {
    if (this.callbacks.getIsInSymbolMode()) {
      this.callbacks.expandCurrentFile();
    } else {
      this.callbacks.expandCurrentDirectory();
    }
  }

  private tryNavigateIntoDirectory(selectedIndex: number): boolean {
    const suggestion = this.callbacks.getMergedSuggestions()[selectedIndex];
    if (suggestion?.type === 'file' && suggestion.file?.isDirectory) {
      this.callbacks.navigateIntoDirectory(suggestion.file);
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
