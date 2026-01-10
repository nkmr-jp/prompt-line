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
import { calculatePopupPosition, applyPopupPosition } from '../../utils/popup-position-calculator';
import { UI_TIMING } from '../../../constants';

/**
 * Callbacks for PopupManager to communicate with parent
 */
export interface PopupManagerCallbacks {
  /** Get the currently selected suggestion */
  getSelectedSuggestion: () => { type: string; agent?: AgentItem } | null;
  /** Get the suggestions container element */
  getSuggestionsContainer: () => HTMLElement | null;
  /** Called before opening a file in the editor */
  onBeforeOpenFile?: () => void;
  /** Set whether the window is draggable */
  setDraggable?: (value: boolean) => void;
  /** Called when agent is selected for insertion */
  onSelectAgent?: (agent: AgentItem) => void;
}

/**
 * PopupManager class for frontmatter popup handling
 */
export class PopupManager {
  private frontmatterPopup: HTMLDivElement | null = null;
  private popupHideTimeout: ReturnType<typeof setTimeout> | null = null;
  private autoShowTooltip: boolean = false;
  private callbacks: PopupManagerCallbacks;

  // Row hover tracking for tooltip persistence
  private currentRowElement: Element | null = null;
  private boundRowMouseEnter: (() => void) | null = null;
  private boundRowMouseLeave: (() => void) | null = null;

  private static readonly POPUP_HIDE_DELAY = UI_TIMING.POPUP_HIDE_DELAY; // ms delay before hiding popup

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
    }
  }

  /**
   * Add file path line to the frontmatter content
   */
  private async addFilePathLine(contentDiv: HTMLElement, agentName: string): Promise<void> {
    try {
      const filePath = await window.electronAPI?.agents?.getFilePath?.(agentName);
      if (!filePath) return;

      // Replace home directory with ~ for display
      const displayPath = filePath.replace(/^\/Users\/[^/]+/, '~');

      // Create frontmatter line for file path
      const lineDiv = document.createElement('div');
      lineDiv.className = 'frontmatter-line';

      // Add key
      const keySpan = document.createElement('span');
      keySpan.className = 'frontmatter-key';
      keySpan.textContent = 'file: ';
      lineDiv.appendChild(keySpan);

      // Create clickable link
      const link = document.createElement('a');
      link.className = 'frontmatter-link';
      link.textContent = displayPath;
      link.title = filePath; // Show full path on hover
      link.href = '#';

      // Handle click to open in editor
      link.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        try {
          // First, get the agent and insert it into textarea
          const suggestion = this.callbacks.getSelectedSuggestion?.();
          if (suggestion?.type === 'agent' && suggestion.agent && this.callbacks.onSelectAgent) {
            this.callbacks.onSelectAgent(suggestion.agent);
          }

          // Then, open the file in editor
          this.callbacks.onBeforeOpenFile?.();
          this.callbacks.setDraggable?.(true);
          const result = await window.electronAPI?.file?.openInEditor?.(filePath);

          if (!result?.success && result?.error) {
            console.error('Failed to open file:', result.error);
            this.callbacks.setDraggable?.(false);
          }
          // Note: Do not restore focus to PromptLine window
          // The opened file's application should stay in foreground
        } catch (err) {
          console.error('Failed to open file in editor:', err);
          this.callbacks.setDraggable?.(false);
        }
      });

      lineDiv.appendChild(link);
      contentDiv.appendChild(lineDiv);
    } catch (error) {
      // Silently fail - file link is optional
      console.error('Failed to add file path line:', error);
    }
  }

  /**
   * Show frontmatter popup for an agent
   * Position: to the left of the info icon
   */
  public async showFrontmatterPopup(agent: AgentItem, targetElement: HTMLElement): Promise<void> {
    const suggestionsContainer = this.callbacks.getSuggestionsContainer();
    if (!this.frontmatterPopup || !agent.frontmatter || !suggestionsContainer) return;

    // Cancel any pending hide
    this.cancelPopupHide();

    // Clear previous content using safe DOM method
    while (this.frontmatterPopup.firstChild) {
      this.frontmatterPopup.removeChild(this.frontmatterPopup.firstChild);
    }

    // Create content container (using textContent for XSS safety)
    const contentDiv = document.createElement('div');
    contentDiv.className = 'frontmatter-content';
    contentDiv.textContent = agent.frontmatter;

    // Add file path line after frontmatter content
    await this.addFilePathLine(contentDiv, agent.name);

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

    // Set up row listeners for tooltip persistence
    this.setupRowListeners(targetElement);
  }

  /**
   * Hide frontmatter popup
   */
  public hideFrontmatterPopup(): void {
    if (this.frontmatterPopup) {
      this.frontmatterPopup.style.display = 'none';
    }
    // Clean up row listeners when popup is hidden
    this.cleanupRowListeners();
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
   * Clean up row event listeners
   */
  private cleanupRowListeners(): void {
    if (this.currentRowElement && this.boundRowMouseEnter && this.boundRowMouseLeave) {
      this.currentRowElement.removeEventListener('mouseenter', this.boundRowMouseEnter);
      this.currentRowElement.removeEventListener('mouseleave', this.boundRowMouseLeave);
    }
    this.currentRowElement = null;
    this.boundRowMouseEnter = null;
    this.boundRowMouseLeave = null;
  }

  /**
   * Set up row event listeners for tooltip persistence
   */
  private setupRowListeners(targetElement: HTMLElement): void {
    // Clean up previous row listeners
    this.cleanupRowListeners();

    // Find the parent row element
    const rowElement = targetElement.closest('.suggestion-item, .file-suggestion-item');
    if (!rowElement) return;

    // Create bound handlers
    this.boundRowMouseEnter = () => this.cancelPopupHide();
    this.boundRowMouseLeave = () => this.schedulePopupHide();

    // Add listeners to the row
    rowElement.addEventListener('mouseenter', this.boundRowMouseEnter);
    rowElement.addEventListener('mouseleave', this.boundRowMouseLeave);
    this.currentRowElement = rowElement;
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
  public async showTooltipForSelectedItem(): Promise<void> {
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
      await this.showFrontmatterPopup(suggestion.agent, infoIcon);
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
    this.cleanupRowListeners();
    if (this.frontmatterPopup && this.frontmatterPopup.parentNode) {
      this.frontmatterPopup.parentNode.removeChild(this.frontmatterPopup);
      this.frontmatterPopup = null;
    }
  }
}
