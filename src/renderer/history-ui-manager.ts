import { LIMITS, TIMEOUTS } from '../constants';
import { formatTime } from './utils/time-formatter';
import type { HistoryItem } from './types';

// Default display limit when not configured (fallback)
const DEFAULT_DISPLAY_LIMIT = 20;

export class HistoryUIManager {
  private historyIndex: number = -1;
  private keyboardNavigationTimeout: NodeJS.Timeout | null = null;
  private displayLimit: number = DEFAULT_DISPLAY_LIMIT;
  private getCurrentText: () => string;
  private getCursorPosition: () => number;
  private saveSnapshotCallback: (text: string, cursorPosition: number) => void;

  constructor(
    private getHistoryList: () => HTMLElement | null,
    private setTextCallback: (text: string) => void,
    private focusTextCallback: () => void,
    private getSearchManager: () => { isInSearchMode(): boolean; getSearchTerm(): string; highlightSearchTerms(text: string, term: string): string } | null,
    getCurrentText: () => string,
    getCursorPosition: () => number,
    saveSnapshotCallback: (text: string, cursorPosition: number) => void
  ) {
    this.getCurrentText = getCurrentText;
    this.getCursorPosition = getCursorPosition;
    this.saveSnapshotCallback = saveSnapshotCallback;
  }

  /**
   * Set the maximum number of history items to display
   * @param limit - Maximum items to show (0 = unlimited)
   */
  public setDisplayLimit(limit: number): void {
    this.displayLimit = limit;
  }

  /**
   * Get the effective display limit, accounting for 0 meaning unlimited
   * Uses LIMITS.MAX_VISIBLE_ITEMS as the hard cap for performance
   */
  private getEffectiveDisplayLimit(): number {
    // 0 means unlimited, but still cap at MAX_VISIBLE_ITEMS for performance
    if (this.displayLimit === 0) {
      return LIMITS.MAX_VISIBLE_ITEMS;
    }
    // Use the smaller of displayLimit and MAX_VISIBLE_ITEMS
    return Math.min(this.displayLimit, LIMITS.MAX_VISIBLE_ITEMS);
  }

  public renderHistory(historyData: HistoryItem[]): void {
    try {
      const historyList = this.getHistoryList();
      if (!historyList) return;

      const dataToRender = historyData;
      const searchManager = this.getSearchManager();
      const isSearchMode = searchManager?.isInSearchMode() || false;

      if (!dataToRender || dataToRender.length === 0) {
        const emptyMessage = isSearchMode ? 'No matching items found' : 'No history items';
        historyList.innerHTML = `<div class="history-empty">${emptyMessage}</div>`;
        return;
      }

      // Get effective display limit (0 = unlimited, but capped at MAX_VISIBLE_ITEMS)
      const effectiveLimit = this.getEffectiveDisplayLimit();
      const visibleItems = dataToRender.slice(0, effectiveLimit);
      const fragment = document.createDocumentFragment();

      visibleItems.forEach((item) => {
        const historyItem = this.createHistoryElement(item);
        fragment.appendChild(historyItem);
      });

      historyList.innerHTML = '';
      historyList.appendChild(fragment);

      if (dataToRender.length > effectiveLimit) {
        const moreIndicator = document.createElement('div');
        moreIndicator.className = 'history-more';
        moreIndicator.textContent = `+${dataToRender.length - effectiveLimit} more items`;
        historyList.appendChild(moreIndicator);
      }

    } catch (error) {
      console.error('Error rendering history:', error);
      const historyList = this.getHistoryList();
      if (historyList) {
        historyList.innerHTML = '<div class="history-empty">Error loading history</div>';
      }
    }
  }

  private createHistoryElement(item: HistoryItem): HTMLElement {
    const historyItem = document.createElement('div');
    historyItem.className = 'history-item';
    historyItem.dataset.text = item.text;
    historyItem.dataset.id = item.id;

    const textDiv = document.createElement('div');
    textDiv.className = 'history-text';
    
    // Apply search highlighting if in search mode
    const displayText = item.text.replace(/\n/g, ' ');
    const searchManager = this.getSearchManager();
    const isSearchMode = searchManager?.isInSearchMode() || false;
    const searchTerm = searchManager?.getSearchTerm() || '';
    
    if (isSearchMode && searchTerm) {
      textDiv.innerHTML = searchManager?.highlightSearchTerms(displayText, searchTerm) || displayText;
    } else {
      textDiv.textContent = displayText;
    }

    const timeDiv = document.createElement('div');
    timeDiv.className = 'history-time';
    timeDiv.textContent = formatTime(item.timestamp);

    historyItem.appendChild(textDiv);
    historyItem.appendChild(timeDiv);

    historyItem.addEventListener('click', () => {
      this.selectHistoryItemFromClick(item.text);
    });

    return historyItem;
  }

  private selectHistoryItem(text: string): void {
    // Save snapshot before overwriting text
    const currentText = this.getCurrentText();
    const cursorPosition = this.getCursorPosition();
    this.saveSnapshotCallback(currentText, cursorPosition);

    // Set history text
    this.setTextCallback(text);
    this.focusTextCallback();
  }

  private selectHistoryItemFromClick(text: string): void {
    this.selectHistoryItem(text);
    this.clearHistorySelection();
  }

  public navigateHistory(e: KeyboardEvent, direction: 'next' | 'prev', dataToNavigate: HistoryItem[]): void {
    e.preventDefault();

    if (!dataToNavigate || dataToNavigate.length === 0) return;

    // Enable keyboard navigation mode and disable hover effects
    this.enableKeyboardNavigation();
    const effectiveLimit = this.getEffectiveDisplayLimit();
    const visibleItemsCount = Math.min(dataToNavigate.length, effectiveLimit);

    if (direction === 'next') {
      if (this.historyIndex === -1) {
        // From initial state, go to first item
        this.historyIndex = 0;
      } else if (this.historyIndex < visibleItemsCount - 1) {
        this.historyIndex = this.historyIndex + 1;
      }
    } else {
      if (this.historyIndex === -1) {
        // From initial state, go to last item
        this.historyIndex = visibleItemsCount - 1;
      } else if (this.historyIndex > 0) {
        this.historyIndex = this.historyIndex - 1;
      }
    }

    const selectedItem = dataToNavigate[this.historyIndex];
    if (selectedItem) {
      this.selectHistoryItem(selectedItem.text);
      this.flashHistoryItem();
      this.scrollToSelectedItem();
    }
  }

  private flashHistoryItem(): void {
    const historyList = this.getHistoryList();
    if (!historyList || this.historyIndex < 0) return;

    const historyItems = historyList.querySelectorAll('.history-item');
    
    // Clear all existing flash effects
    historyItems.forEach(item => {
      item.classList.remove('flash');
    });

    const selectedItem = historyItems[this.historyIndex] as HTMLElement;
    
    if (selectedItem) {
      // Force reflow to ensure the removal takes effect before adding
      void selectedItem.offsetHeight;
      
      // Use requestAnimationFrame to ensure proper timing
      requestAnimationFrame(() => {
        selectedItem.classList.add('flash');
        
        // Remove flash class after animation
        setTimeout(() => {
          selectedItem.classList.remove('flash');
        }, TIMEOUTS.FLASH_ANIMATION_DURATION);
      });
    }
  }

  public clearHistorySelection(): void {
    this.historyIndex = -1;
    
    // Clear all flash effects
    const historyList = this.getHistoryList();
    if (historyList) {
      const historyItems = historyList.querySelectorAll('.history-item');
      historyItems.forEach(item => {
        item.classList.remove('flash');
      });
    }

    // Disable keyboard navigation mode when clearing selection
    this.disableKeyboardNavigation();
  }

  private enableKeyboardNavigation(): void {
    const historyList = this.getHistoryList();
    if (historyList) {
      historyList.classList.add('keyboard-navigation');
    }

    // Clear any existing timeout
    if (this.keyboardNavigationTimeout) {
      clearTimeout(this.keyboardNavigationTimeout);
    }

    // Auto-disable keyboard navigation after a period of inactivity
    this.keyboardNavigationTimeout = setTimeout(() => {
      this.disableKeyboardNavigation();
    }, TIMEOUTS.KEYBOARD_NAVIGATION_TIMEOUT);
  }

  private disableKeyboardNavigation(): void {
    const historyList = this.getHistoryList();
    if (historyList) {
      historyList.classList.remove('keyboard-navigation');
    }

    // Clear the timeout
    if (this.keyboardNavigationTimeout) {
      clearTimeout(this.keyboardNavigationTimeout);
      this.keyboardNavigationTimeout = null;
    }
  }

  private scrollToSelectedItem(): void {
    const historyList = this.getHistoryList();
    if (!historyList || this.historyIndex < 0) return;

    const historyItems = historyList.querySelectorAll('.history-item');
    const selectedItem = historyItems[this.historyIndex] as HTMLElement;
    
    if (selectedItem) {
      selectedItem.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'nearest' 
      });
    }
  }

  public cleanup(): void {
    if (this.keyboardNavigationTimeout) {
      clearTimeout(this.keyboardNavigationTimeout);
      this.keyboardNavigationTimeout = null;
    }
  }
}