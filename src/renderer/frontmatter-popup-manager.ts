/**
 * FrontmatterPopupManager - Manages frontmatter popup display for slash commands
 * Extracted from SlashCommandManager to reduce file size and improve maintainability
 */

import { calculatePopupPosition, applyPopupPosition } from './utils/popup-position-calculator';
import { UI_TIMING } from '../constants';

interface SlashCommandItemLike {
  name: string;
  frontmatter?: string;
}

/**
 * Callbacks for FrontmatterPopupManager to interact with parent components
 */
export interface FrontmatterPopupCallbacks {
  getSuggestionsContainer: () => HTMLElement | null;
  getFilteredCommands: () => SlashCommandItemLike[];
  getSelectedIndex: () => number;
}

/**
 * Manages frontmatter popup display for slash command items
 */
export class FrontmatterPopupManager {
  private static readonly POPUP_HIDE_DELAY = UI_TIMING.POPUP_HIDE_DELAY; // ms delay before hiding popup

  private frontmatterPopup: HTMLElement | null = null;
  private popupHideTimeout: ReturnType<typeof setTimeout> | null = null;
  private isPopupVisible: boolean = false;
  private autoShowTooltip: boolean = false;
  private callbacks: FrontmatterPopupCallbacks;

  constructor(callbacks: FrontmatterPopupCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Create the frontmatter popup element for slash command hover display
   */
  public createPopup(): void {
    if (this.frontmatterPopup) return;

    this.frontmatterPopup = document.createElement('div');
    this.frontmatterPopup.id = 'slashCommandFrontmatterPopup';
    this.frontmatterPopup.className = 'frontmatter-popup';
    this.frontmatterPopup.style.display = 'none';

    // Prevent popup from closing when hovering over it
    this.frontmatterPopup.addEventListener('mouseenter', () => {
      this.cancelHide();
    });

    this.frontmatterPopup.addEventListener('mouseleave', () => {
      this.scheduleHide();
    });

    // Capture wheel events on document when popup is visible
    document.addEventListener('wheel', (e) => {
      if (this.isPopupVisible && this.frontmatterPopup) {
        // Prevent default scrolling behavior
        e.preventDefault();
        // Scroll the popup instead
        this.frontmatterPopup.scrollTop += e.deltaY;
      }
    }, { passive: false });

    // Append to main-content
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      mainContent.appendChild(this.frontmatterPopup);
    }
  }

  /**
   * Render frontmatter content with clickable reference links
   */
  private renderFrontmatter(container: HTMLElement, frontmatter: string): void {
    const lines = frontmatter.split('\n');

    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) {
        // Plain text line
        const textNode = document.createTextNode(line);
        container.appendChild(textNode);
        container.appendChild(document.createElement('br'));
        continue;
      }

      const key = line.substring(0, colonIndex).trim();
      const value = line.substring(colonIndex + 1).trim();

      // Create line container
      const lineDiv = document.createElement('div');
      lineDiv.className = 'frontmatter-line';

      // Add key
      const keySpan = document.createElement('span');
      keySpan.className = 'frontmatter-key';
      keySpan.textContent = key + ': ';
      lineDiv.appendChild(keySpan);

      // Check if value is a URL (for reference field)
      if (key === 'reference' && value.startsWith('http')) {
        const link = document.createElement('a');
        link.href = value;
        link.textContent = value;
        link.className = 'frontmatter-link';
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        // Handle click to open in external browser
        link.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          window.electronAPI?.shell?.openExternal?.(value);
        });
        lineDiv.appendChild(link);
      } else {
        const valueSpan = document.createElement('span');
        valueSpan.className = 'frontmatter-value';
        valueSpan.textContent = value;
        lineDiv.appendChild(valueSpan);
      }

      container.appendChild(lineDiv);
    }
  }

  /**
   * Show the frontmatter popup for a command
   */
  public show(command: SlashCommandItemLike, targetElement: HTMLElement): void {
    const suggestionsContainer = this.callbacks.getSuggestionsContainer();
    if (!this.frontmatterPopup || !command.frontmatter || !suggestionsContainer) return;

    // Cancel any pending hide
    this.cancelHide();

    // Clear previous content using safe DOM method
    while (this.frontmatterPopup.firstChild) {
      this.frontmatterPopup.removeChild(this.frontmatterPopup.firstChild);
    }

    // Create content container with parsed frontmatter
    const contentDiv = document.createElement('div');
    contentDiv.className = 'frontmatter-content';
    this.renderFrontmatter(contentDiv, command.frontmatter);
    this.frontmatterPopup.appendChild(contentDiv);

    // Add hint message at the bottom
    const hintDiv = document.createElement('div');
    hintDiv.className = 'frontmatter-hint';
    hintDiv.textContent = this.autoShowTooltip ? 'Ctrl+i: hide tooltip' : 'Ctrl+i: auto-show tooltip';
    this.frontmatterPopup.appendChild(hintDiv);

    // Calculate popup position using shared utility
    const position = calculatePopupPosition({
      targetRect: targetElement.getBoundingClientRect(),
      containerRect: suggestionsContainer.getBoundingClientRect()
    });

    // Apply position to popup
    applyPopupPosition(this.frontmatterPopup, position);

    this.frontmatterPopup.style.display = 'block';
    this.isPopupVisible = true;
  }

  /**
   * Hide the frontmatter popup
   */
  public hide(): void {
    if (this.frontmatterPopup) {
      this.frontmatterPopup.style.display = 'none';
    }
    this.isPopupVisible = false;
  }

  /**
   * Schedule popup hide with delay
   */
  public scheduleHide(): void {
    this.cancelHide();
    this.popupHideTimeout = setTimeout(() => {
      this.hide();
    }, FrontmatterPopupManager.POPUP_HIDE_DELAY);
  }

  /**
   * Cancel pending popup hide
   */
  public cancelHide(): void {
    if (this.popupHideTimeout) {
      clearTimeout(this.popupHideTimeout);
      this.popupHideTimeout = null;
    }
  }

  /**
   * Show tooltip for the currently selected item (if auto-show is enabled)
   */
  public showForSelectedItem(): void {
    const suggestionsContainer = this.callbacks.getSuggestionsContainer();
    if (!this.autoShowTooltip || !suggestionsContainer) return;

    const filteredCommands = this.callbacks.getFilteredCommands();
    const selectedIndex = this.callbacks.getSelectedIndex();
    const selectedCommand = filteredCommands[selectedIndex];
    if (!selectedCommand?.frontmatter) {
      this.hide();
      return;
    }

    // Find the info icon element for the selected item
    const selectedItem = suggestionsContainer.querySelector('.slash-suggestion-item.selected');
    const infoIcon = selectedItem?.querySelector('.frontmatter-info-icon') as HTMLElement;
    if (infoIcon) {
      this.show(selectedCommand, infoIcon);
    }
  }

  /**
   * Toggle auto-show tooltip mode
   */
  public toggleAutoShow(): void {
    this.autoShowTooltip = !this.autoShowTooltip;
    if (this.autoShowTooltip) {
      this.showForSelectedItem();
    } else {
      this.hide();
    }
  }

  /**
   * Get whether auto-show tooltip is enabled
   */
  public isAutoShowEnabled(): boolean {
    return this.autoShowTooltip;
  }

  /**
   * Get whether popup is currently visible
   */
  public getIsVisible(): boolean {
    return this.isPopupVisible;
  }
}
