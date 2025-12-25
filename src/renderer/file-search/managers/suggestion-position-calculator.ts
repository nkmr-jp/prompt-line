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

    const coordinates = this.getCaretCoordinates(textInput, atPosition);
    if (!coordinates) return;

    const mainContentRect = this.getMainContentRect();
    if (!mainContentRect) return;

    this.applyPositioning(suggestionsContainer, coordinates, mainContentRect);
  }

  /**
   * Get caret coordinates
   */
  private getCaretCoordinates(
    textInput: HTMLTextAreaElement,
    atPosition: number
  ): { top: number; left: number } | null {
    if (!this.mirrorDiv) {
      this.mirrorDiv = createMirrorDiv();
    }

    return getCaretCoordinates(textInput, this.mirrorDiv, atPosition);
  }

  /**
   * Get main content rectangle
   */
  private getMainContentRect(): DOMRect | null {
    const mainContent = document.querySelector('.main-content');
    return mainContent ? mainContent.getBoundingClientRect() : null;
  }

  /**
   * Apply positioning to container
   */
  private applyPositioning(
    container: HTMLElement,
    coordinates: { top: number; left: number },
    mainContentRect: DOMRect
  ): void {
    const { top: caretTop, left: caretLeft } = coordinates;
    const viewportHeight = window.innerHeight;

    const { showAbove, availableHeight } = this.calculateVerticalPosition(
      caretTop,
      mainContentRect.top,
      viewportHeight
    );

    const { top, maxHeight } = this.calculateTopAndHeight(
      caretTop,
      showAbove,
      availableHeight,
      container
    );

    const { left, maxWidth } = this.calculateLeftAndWidth(
      caretLeft,
      mainContentRect.width
    );

    this.applyStyles(container, top, left, maxHeight, maxWidth);
  }

  /**
   * Calculate vertical position (above or below)
   */
  private calculateVerticalPosition(
    caretTop: number,
    mainContentTop: number,
    viewportHeight: number
  ): { showAbove: boolean; availableHeight: number } {
    const spaceBelow = viewportHeight - caretTop - 20;
    const spaceAbove = caretTop - mainContentTop;
    const showAbove = spaceBelow < 200 && spaceAbove > spaceBelow;
    const availableHeight = showAbove ? spaceAbove - 8 : spaceBelow - 8;

    return { showAbove, availableHeight };
  }

  /**
   * Calculate top position and max height
   */
  private calculateTopAndHeight(
    caretTop: number,
    showAbove: boolean,
    availableHeight: number,
    container: HTMLElement
  ): { top: number; maxHeight: number } {
    const maxHeight = Math.max(100, availableHeight);

    if (!showAbove) {
      return { top: caretTop + 20, maxHeight };
    }

    const menuHeight = Math.min(container.scrollHeight || maxHeight, maxHeight);
    const top = Math.max(0, caretTop - menuHeight - 4);

    return { top, maxHeight };
  }

  /**
   * Calculate left position and max width
   */
  private calculateLeftAndWidth(
    caretLeft: number,
    mainContentWidth: number
  ): { left: number; maxWidth: number } {
    const minMenuWidth = 500;
    const rightMargin = 8;
    let availableWidth = mainContentWidth - caretLeft - rightMargin;
    let adjustedLeft = caretLeft;

    if (availableWidth < minMenuWidth) {
      const shiftAmount = minMenuWidth - availableWidth;
      adjustedLeft = Math.max(8, caretLeft - shiftAmount);
      availableWidth = mainContentWidth - adjustedLeft - rightMargin;
    }

    const maxWidth = Math.max(minMenuWidth, availableWidth);

    return { left: adjustedLeft, maxWidth };
  }

  /**
   * Apply calculated styles to container
   */
  private applyStyles(
    container: HTMLElement,
    top: number,
    left: number,
    maxHeight: number,
    maxWidth: number
  ): void {
    container.style.maxHeight = `${maxHeight}px`;
    container.style.maxWidth = `${maxWidth}px`;
    container.style.top = `${top}px`;
    container.style.left = `${left}px`;
    container.style.right = 'auto';
    container.style.bottom = 'auto';
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
