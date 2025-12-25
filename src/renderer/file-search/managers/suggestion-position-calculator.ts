/**
 * SuggestionPositionCalculator - Calculates optimal position for suggestion dropdown
 *
 * Responsibilities:
 * - Calculates dropdown position based on cursor location
 * - Handles boundary constraints (viewport edges)
 * - Manages dynamic sizing based on available space
 * - Determines whether to show above or below cursor
 */

import { getCaretCoordinates, createMirrorDiv } from '../dom-utils';

export interface SuggestionPositionCallbacks {
  getContainer: () => HTMLElement | null;
  getTextInput: () => HTMLTextAreaElement;
}

/**
 * Calculates and applies positioning for suggestion dropdown
 */
export class SuggestionPositionCalculator {
  private callbacks: SuggestionPositionCallbacks;
  private mirrorDiv: HTMLDivElement | null = null;

  constructor(callbacks: SuggestionPositionCallbacks) {
    this.callbacks = callbacks;
    this.mirrorDiv = createMirrorDiv();
  }

  /**
   * Position the suggestions container near the @ position
   */
  public position(atPosition: number): void {
    const suggestionsContainer = this.callbacks.getContainer();
    const textInput = this.callbacks.getTextInput();

    if (!suggestionsContainer || !textInput || atPosition < 0) return;

    if (!this.mirrorDiv) {
      this.mirrorDiv = createMirrorDiv();
    }

    // Get caret position
    const coordinates = getCaretCoordinates(textInput, this.mirrorDiv, atPosition);
    if (!coordinates) return;

    const { top: caretTop, left: caretLeft } = coordinates;

    // Get main-content bounds for positioning
    const mainContent = document.querySelector('.main-content');
    if (!mainContent) return;

    const mainContentRect = mainContent.getBoundingClientRect();
    const viewportHeight = window.innerHeight;

    // Calculate available space
    const spaceBelow = viewportHeight - caretTop - 20; // 20px for line height
    const spaceAbove = caretTop - mainContentRect.top;
    const showAbove = spaceBelow < 200 && spaceAbove > spaceBelow;

    // Calculate position
    let top: number;
    let left = caretLeft;
    const availableHeight = showAbove ? spaceAbove - 8 : spaceBelow - 8;

    if (!showAbove) {
      top = caretTop + 20; // Below cursor
    } else {
      // Will be calculated after setting max-height
      top = 0;
    }

    // Set dynamic max-height based on available space
    const dynamicMaxHeight = Math.max(100, availableHeight);
    suggestionsContainer.style.maxHeight = `${dynamicMaxHeight}px`;

    // If showing above, calculate top position
    if (showAbove) {
      const menuHeight = Math.min(suggestionsContainer.scrollHeight || dynamicMaxHeight, dynamicMaxHeight);
      top = caretTop - menuHeight - 4;
      if (top < 0) top = 0;
    }

    // Calculate dynamic max-width and adjust left position
    // minMenuWidth = 500 for readable descriptions
    const minMenuWidth = 500;
    const rightMargin = 8;
    let availableWidth = mainContentRect.width - left - rightMargin;
    let adjustedLeft = left;

    if (availableWidth < minMenuWidth) {
      const shiftAmount = minMenuWidth - availableWidth;
      adjustedLeft = Math.max(8, left - shiftAmount);
      availableWidth = mainContentRect.width - adjustedLeft - rightMargin;
    }

    const dynamicMaxWidth = Math.max(minMenuWidth, availableWidth);
    suggestionsContainer.style.maxWidth = `${dynamicMaxWidth}px`;

    suggestionsContainer.style.top = `${top}px`;
    suggestionsContainer.style.left = `${adjustedLeft}px`;
    suggestionsContainer.style.right = 'auto';
    suggestionsContainer.style.bottom = 'auto';
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    if (this.mirrorDiv && this.mirrorDiv.parentNode) {
      this.mirrorDiv.parentNode.removeChild(this.mirrorDiv);
      this.mirrorDiv = null;
    }
  }
}
