/**
 * PopupManager - Manages frontmatter popup display for agents
 *
 * Responsibilities:
 * - Creating and managing the frontmatter popup element
 * - Showing/hiding popup with proper positioning
 * - Auto-show tooltip feature management
 * - Popup hide scheduling with delay
 */

import type { AgentItem } from '../../../types';

/**
 * Callbacks for PopupManager to communicate with parent
 */
export interface PopupManagerCallbacks {
  /** Get the currently selected suggestion */
  getSelectedSuggestion: () => { type: string; agent?: AgentItem } | null;
  /** Get the suggestions container element */
  getSuggestionsContainer: () => HTMLElement | null;
}

/**
 * PopupManager class for frontmatter popup handling
 */
export class PopupManager {
  private frontmatterPopup: HTMLDivElement | null = null;
  private popupHideTimeout: ReturnType<typeof setTimeout> | null = null;
  private autoShowTooltip: boolean = false;
  private callbacks: PopupManagerCallbacks;

  private static readonly POPUP_HIDE_DELAY = 100; // ms delay before hiding popup

  constructor(callbacks: PopupManagerCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Initialize the popup element
   * Should be called after DOM is ready
   */
  public initialize(): void {
    this.createFrontmatterPopup();
  }

  /**
   * Create the frontmatter popup element for agent hover display
   */
  private createFrontmatterPopup(): void {
    if (this.frontmatterPopup) return;

    this.frontmatterPopup = document.createElement('div');
    this.frontmatterPopup.id = 'frontmatterPopup';
    this.frontmatterPopup.className = 'frontmatter-popup';
    this.frontmatterPopup.style.display = 'none';

    // Prevent popup from closing when hovering over it
    this.frontmatterPopup.addEventListener('mouseenter', () => {
      this.cancelPopupHide();
    });

    this.frontmatterPopup.addEventListener('mouseleave', () => {
      this.schedulePopupHide();
    });

    // Handle wheel events on popup element only (scroll popup content)
    this.frontmatterPopup.addEventListener('wheel', (e) => {
      // Only prevent default when popup can scroll
      const popup = this.frontmatterPopup;
      if (popup) {
        const canScrollDown = popup.scrollTop < popup.scrollHeight - popup.clientHeight;
        const canScrollUp = popup.scrollTop > 0;
        const scrollingDown = e.deltaY > 0;
        const scrollingUp = e.deltaY < 0;

        // Only prevent default if we're actually scrolling the popup content
        if ((scrollingDown && canScrollDown) || (scrollingUp && canScrollUp)) {
          e.preventDefault();
          e.stopPropagation();
          popup.scrollTop += e.deltaY;
        }
      }
    }, { passive: false });

    // Append to main-content
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      mainContent.appendChild(this.frontmatterPopup);
      console.debug('[PopupManager] Popup element created');
    }
  }

  /**
   * Show frontmatter popup for an agent
   * Position: to the left of the info icon
   */
  public showFrontmatterPopup(agent: AgentItem, targetElement: HTMLElement): void {
    const suggestionsContainer = this.callbacks.getSuggestionsContainer();
    if (!this.frontmatterPopup || !agent.frontmatter || !suggestionsContainer) return;

    this.cancelPopupHide();
    this.clearPopupContent();
    this.createPopupContent(agent.frontmatter);
    this.positionPopup(targetElement, suggestionsContainer);
    this.frontmatterPopup.style.display = 'block';
  }

  /**
   * Clear popup content using safe DOM method
   */
  private clearPopupContent(): void {
    if (!this.frontmatterPopup) return;
    while (this.frontmatterPopup.firstChild) {
      this.frontmatterPopup.removeChild(this.frontmatterPopup.firstChild);
    }
  }

  /**
   * Create popup content with frontmatter and hint
   */
  private createPopupContent(frontmatter: string): void {
    if (!this.frontmatterPopup) return;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'frontmatter-content';
    contentDiv.textContent = frontmatter;
    this.frontmatterPopup.appendChild(contentDiv);

    const hintDiv = document.createElement('div');
    hintDiv.className = 'frontmatter-hint';
    hintDiv.textContent = this.autoShowTooltip ? 'Ctrl+i: hide tooltip' : 'Ctrl+i: auto-show tooltip';
    this.frontmatterPopup.appendChild(hintDiv);
  }

  /**
   * Position popup relative to target element
   */
  private positionPopup(targetElement: HTMLElement, suggestionsContainer: HTMLElement): void {
    if (!this.frontmatterPopup) return;

    const iconRect = targetElement.getBoundingClientRect();
    const containerRect = suggestionsContainer.getBoundingClientRect();
    const { right, top, maxHeight } = this.calculatePopupPosition(iconRect, containerRect);

    this.frontmatterPopup.style.right = `${right}px`;
    this.frontmatterPopup.style.left = 'auto';
    this.frontmatterPopup.style.top = `${top}px`;
    this.frontmatterPopup.style.width = `${containerRect.width - 40}px`;
    this.frontmatterPopup.style.maxHeight = `${maxHeight}px`;
  }

  /**
   * Calculate popup position (right, top, maxHeight)
   */
  private calculatePopupPosition(
    iconRect: DOMRect,
    _containerRect: DOMRect
  ): { right: number; top: number; maxHeight: number } {
    const horizontalGap = 8;
    const verticalGap = 4;
    const minPopupHeight = 80;

    const right = window.innerWidth - iconRect.left + horizontalGap;
    const { showAbove, spaceBelow, spaceAbove } = this.calculateVerticalSpace(iconRect, minPopupHeight);

    if (showAbove) {
      const maxHeight = Math.max(minPopupHeight, Math.min(150, spaceAbove - verticalGap));
      const top = iconRect.top - maxHeight - verticalGap;
      return { right, top, maxHeight };
    } else {
      const top = iconRect.bottom + verticalGap;
      const maxHeight = Math.max(minPopupHeight, Math.min(150, spaceBelow - verticalGap));
      return { right, top, maxHeight };
    }
  }

  /**
   * Calculate vertical space and determine if popup should show above
   */
  private calculateVerticalSpace(
    iconRect: DOMRect,
    minPopupHeight: number
  ): { showAbove: boolean; spaceBelow: number; spaceAbove: number } {
    const spaceBelow = window.innerHeight - iconRect.bottom - 10;
    const spaceAbove = iconRect.top - 10;
    const showAbove = spaceBelow < minPopupHeight && spaceAbove > spaceBelow;
    return { showAbove, spaceBelow, spaceAbove };
  }

  /**
   * Hide frontmatter popup
   */
  public hideFrontmatterPopup(): void {
    if (this.frontmatterPopup) {
      this.frontmatterPopup.style.display = 'none';
    }
  }

  /**
   * Schedule popup hide with delay
   */
  public schedulePopupHide(): void {
    this.cancelPopupHide();
    this.popupHideTimeout = setTimeout(() => {
      this.hideFrontmatterPopup();
    }, PopupManager.POPUP_HIDE_DELAY);
  }

  /**
   * Cancel scheduled popup hide
   */
  public cancelPopupHide(): void {
    if (this.popupHideTimeout) {
      clearTimeout(this.popupHideTimeout);
      this.popupHideTimeout = null;
    }
  }

  /**
   * Toggle auto-show tooltip feature
   */
  public toggleAutoShowTooltip(): void {
    this.autoShowTooltip = !this.autoShowTooltip;
    if (this.autoShowTooltip) {
      // Show tooltip for currently selected item
      this.showTooltipForSelectedItem();
    } else {
      // Hide tooltip
      this.hideFrontmatterPopup();
    }
  }

  /**
   * Show tooltip for the currently selected item (agent only)
   */
  public showTooltipForSelectedItem(): void {
    const suggestionsContainer = this.callbacks.getSuggestionsContainer();
    if (!this.autoShowTooltip || !suggestionsContainer) return;

    const suggestion = this.callbacks.getSelectedSuggestion();
    if (!suggestion || suggestion.type !== 'agent' || !suggestion.agent?.frontmatter) {
      this.hideFrontmatterPopup();
      return;
    }

    // Find the info icon element for the selected item
    const selectedItem = suggestionsContainer.querySelector('.file-suggestion-item.selected');
    const infoIcon = selectedItem?.querySelector('.frontmatter-info-icon') as HTMLElement;
    if (infoIcon) {
      this.showFrontmatterPopup(suggestion.agent, infoIcon);
    }
  }

  /**
   * Check if auto-show tooltip is enabled
   */
  public isAutoShowTooltipEnabled(): boolean {
    return this.autoShowTooltip;
  }

  /**
   * Clean up resources
   */
  public destroy(): void {
    this.cancelPopupHide();
    if (this.frontmatterPopup && this.frontmatterPopup.parentNode) {
      this.frontmatterPopup.parentNode.removeChild(this.frontmatterPopup);
      this.frontmatterPopup = null;
    }
  }
}
