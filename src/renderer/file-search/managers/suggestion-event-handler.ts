/**
 * SuggestionEventHandler - Handles keyboard and mouse events for suggestions
 *
 * Responsibilities:
 * - Keyboard navigation (arrow keys, Ctrl shortcuts)
 * - Selection with Enter/Tab keys
 * - Mouse hover and click interactions
 * - Cmd+click to open in editor
 * - Cmd+Enter to open in editor
 */

import type { SuggestionItem } from '../types';

export interface SuggestionEventCallbacks {
  onItemSelected: (index: number) => void;
  onNavigateIntoDirectory: (index: number) => void;
  onEscape: () => void;
  onOpenFileInEditor?: (index: number) => Promise<void>;
  getIsComposing?: () => boolean;
  getSelectedIndex: () => number;
  setSelectedIndex: (index: number) => void;
  getTotalItemCount: () => number;
  getSuggestion: (index: number) => SuggestionItem | null;
  updateSelection: () => void;
  hide: () => void;
}

/**
 * Handles all event interactions for suggestion dropdown
 */
export class SuggestionEventHandler {
  private callbacks: SuggestionEventCallbacks;

  constructor(callbacks: SuggestionEventCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Handle keyboard navigation
   * @returns true if event was handled, false otherwise
   */
  public handleKeyDown(e: KeyboardEvent): boolean {
    const totalItems = this.callbacks.getTotalItemCount();
    const currentIndex = this.callbacks.getSelectedIndex();

    // Ctrl+n or Ctrl+j: Move down (same as ArrowDown)
    if (e.ctrlKey && (e.key === 'n' || e.key === 'j')) {
      e.preventDefault();
      e.stopPropagation();
      this.callbacks.setSelectedIndex(Math.min(currentIndex + 1, totalItems - 1));
      this.callbacks.updateSelection();
      return true;
    }

    // Ctrl+p or Ctrl+k: Move up (same as ArrowUp)
    if (e.ctrlKey && (e.key === 'p' || e.key === 'k')) {
      e.preventDefault();
      e.stopPropagation();
      this.callbacks.setSelectedIndex(Math.max(currentIndex - 1, 0));
      this.callbacks.updateSelection();
      return true;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        e.stopPropagation();
        this.callbacks.setSelectedIndex(Math.min(currentIndex + 1, totalItems - 1));
        this.callbacks.updateSelection();
        return true;

      case 'ArrowUp':
        e.preventDefault();
        e.stopPropagation();
        this.callbacks.setSelectedIndex(Math.max(currentIndex - 1, 0));
        this.callbacks.updateSelection();
        return true;

      case 'Enter':
        return this.handleEnterKey(e, totalItems, currentIndex);

      case 'Tab':
        return this.handleTabKey(e, totalItems, currentIndex);

      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        this.callbacks.onEscape();
        return true;

      default:
        return false;
    }
  }

  /**
   * Handle Enter key press
   */
  private handleEnterKey(e: KeyboardEvent, totalItems: number, currentIndex: number): boolean {
    // Skip Enter key if IME is active to let IME handle it
    if (e.isComposing || this.callbacks.getIsComposing?.()) {
      return false;
    }

    if (totalItems > 0) {
      e.preventDefault();
      e.stopPropagation();

      // Ctrl+Enter: Open file in editor
      if (e.ctrlKey && currentIndex >= 0 && this.callbacks.onOpenFileInEditor) {
        this.callbacks.onOpenFileInEditor(currentIndex)
          .then(() => this.callbacks.hide());
        return true;
      }

      // Normal Enter: select item
      if (currentIndex >= 0) {
        this.callbacks.onItemSelected(currentIndex);
        return true;
      }
    }
    return false;
  }

  /**
   * Handle Tab key press
   */
  private handleTabKey(e: KeyboardEvent, totalItems: number, currentIndex: number): boolean {
    // Skip Tab key if IME is active
    if (e.isComposing || this.callbacks.getIsComposing?.()) {
      return false;
    }

    if (totalItems > 0) {
      e.preventDefault();
      e.stopPropagation();

      // Check if current selection is a directory
      if (currentIndex >= 0) {
        const suggestion = this.callbacks.getSuggestion(currentIndex);
        if (suggestion?.type === 'file' && suggestion.file?.isDirectory) {
          this.callbacks.onNavigateIntoDirectory(currentIndex);
          return true;
        }
      }

      // Otherwise select the item
      if (currentIndex >= 0) {
        this.callbacks.onItemSelected(currentIndex);
        return true;
      }
    }
    return false;
  }

  /**
   * Attach event listeners to a suggestion item
   */
  public attachItemEventListeners(
    item: HTMLElement,
    index: number,
    container: HTMLElement
  ): void {
    // Click handler
    item.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Cmd+click: Open file in editor
      if (e.metaKey && this.callbacks.onOpenFileInEditor) {
        await this.callbacks.onOpenFileInEditor(index);
        this.callbacks.hide();
        return;
      }

      // Normal click: select item
      this.callbacks.onItemSelected(index);
    });

    // Mouse move handler - only highlight when mouse actually moves
    item.addEventListener('mousemove', () => {
      const allItems = container.querySelectorAll('.file-suggestion-item');
      allItems?.forEach(el => el.classList.remove('hovered'));
      item.classList.add('hovered');
    });

    // Remove hover when mouse leaves
    item.addEventListener('mouseleave', () => {
      item.classList.remove('hovered');
    });
  }
}
