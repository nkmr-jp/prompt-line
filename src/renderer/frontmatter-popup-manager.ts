/**
 * FrontmatterPopupManager - Manages frontmatter popup display for slash commands
 * Extracted from SlashCommandManager to reduce file size and improve maintainability
 */

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
  private static readonly POPUP_HIDE_DELAY = 100; // ms delay before hiding popup

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

    // Create content container (using textContent for XSS safety)
    const contentDiv = document.createElement('div');
    contentDiv.className = 'frontmatter-content';
    contentDiv.textContent = command.frontmatter;
    this.frontmatterPopup.appendChild(contentDiv);

    // Add hint message at the bottom
    const hintDiv = document.createElement('div');
    hintDiv.className = 'frontmatter-hint';
    hintDiv.textContent = this.autoShowTooltip ? 'Ctrl+i: hide tooltip' : 'Ctrl+i: auto-show tooltip';
    this.frontmatterPopup.appendChild(hintDiv);

    // Get the info icon and container rectangles for positioning
    const iconRect = targetElement.getBoundingClientRect();
    const containerRect = suggestionsContainer.getBoundingClientRect();

    // Position popup to the left of the info icon
    const popupWidth = containerRect.width - 40;
    const horizontalGap = 8;
    const right = window.innerWidth - iconRect.left + horizontalGap;

    // Gap between popup and icon
    const verticalGap = 4;

    // Calculate available space below and above the icon
    const spaceBelow = window.innerHeight - iconRect.bottom - 10;
    const spaceAbove = iconRect.top - 10;
    const minPopupHeight = 80;

    // Decide whether to show popup above or below the icon
    const showAbove = spaceBelow < minPopupHeight && spaceAbove > spaceBelow;

    let top: number;
    let maxHeight: number;

    if (showAbove) {
      // Position above the icon (bottom of popup aligns with top of icon)
      maxHeight = Math.max(minPopupHeight, Math.min(150, spaceAbove - verticalGap));
      top = iconRect.top - maxHeight - verticalGap;
    } else {
      // Position below the icon (top of popup aligns with bottom of icon)
      top = iconRect.bottom + verticalGap;
      maxHeight = Math.max(minPopupHeight, Math.min(150, spaceBelow - verticalGap));
    }

    this.frontmatterPopup.style.right = `${right}px`;
    this.frontmatterPopup.style.left = 'auto';
    this.frontmatterPopup.style.top = `${top}px`;
    this.frontmatterPopup.style.width = `${popupWidth}px`;
    this.frontmatterPopup.style.maxHeight = `${maxHeight}px`;

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
