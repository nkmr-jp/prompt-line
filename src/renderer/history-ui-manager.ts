import { TIMEOUTS } from '../constants';
import { formatTime } from './utils/time-formatter';
import type { HistoryItem } from './types';

export class HistoryUIManager {
  private historyIndex: number = -1;
  private keyboardNavigationTimeout: NodeJS.Timeout | null = null;
  private getCurrentText: () => string;
  private getCursorPosition: () => number;
  private saveSnapshotCallback: (text: string, cursorPosition: number) => void;
  private loadMoreCallback: (() => void) | null = null;
  private scrollHandler: (() => void) | null = null;

  constructor(
    private getHistoryList: () => HTMLElement | null,
    private setTextCallback: (text: string) => void,
    private focusTextCallback: () => void,
    private getSearchManager: () => { isInSearchMode(): boolean; getSearchTerm(): string; highlightSearchTerms(text: string, term: string): string } | null,
    getCurrentText: () => string,
    getCursorPosition: () => number,
    saveSnapshotCallback: (text: string, cursorPosition: number) => void,
    loadMoreCallback?: () => void
  ) {
    this.getCurrentText = getCurrentText;
    this.getCursorPosition = getCursorPosition;
    this.saveSnapshotCallback = saveSnapshotCallback;
    this.loadMoreCallback = loadMoreCallback || null;
  }

  /**
   * Setup scroll event listener for infinite scroll
   */
  public setupScrollListener(): void {
    const historyList = this.getHistoryList();
    if (!historyList || this.scrollHandler) return;

    this.scrollHandler = () => {
      this.checkScrollPosition();
    };

    historyList.addEventListener('scroll', this.scrollHandler);
  }

  /**
   * Check if scrolled to bottom and trigger load more
   */
  private checkScrollPosition(): void {
    const historyList = this.getHistoryList();
    if (!historyList || !this.loadMoreCallback) return;

    // Check if scrolled near bottom (within 50px)
    const scrollTop = historyList.scrollTop;
    const scrollHeight = historyList.scrollHeight;
    const clientHeight = historyList.clientHeight;

    if (scrollTop + clientHeight >= scrollHeight - 50) {
      this.loadMoreCallback();
    }
  }

  public renderHistory(historyData: HistoryItem[], totalMatches?: number): void {
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

      // Items are already limited by filter engine, render all provided items
      const fragment = document.createDocumentFragment();

      dataToRender.forEach((item) => {
        const historyItem = this.createHistoryElement(item);
        fragment.appendChild(historyItem);
      });

      historyList.innerHTML = '';
      historyList.appendChild(fragment);

      // Show item count indicator
      // Use totalMatches for search mode (total matches before display limit)
      // Use dataToRender.length for non-search mode (total items)
      const totalCount = totalMatches !== undefined ? totalMatches : dataToRender.length;
      const countIndicator = document.createElement('div');
      countIndicator.className = 'history-more';
      if (totalCount > dataToRender.length) {
        countIndicator.textContent = `+${totalCount - dataToRender.length} more items`;
      } else {
        countIndicator.textContent = `${totalCount} items`;
      }
      historyList.appendChild(countIndicator);

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
    const visibleItemsCount = dataToNavigate.length;

    if (direction === 'next') {
      if (this.historyIndex === -1) {
        // From initial state, go to first item
        this.historyIndex = 0;
      } else if (this.historyIndex < visibleItemsCount - 1) {
        this.historyIndex = this.historyIndex + 1;
      } else if (this.historyIndex === visibleItemsCount - 1 && this.loadMoreCallback) {
        // At last item, try to load more
        this.loadMoreCallback();
        return;
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

    // Remove scroll event listener
    if (this.scrollHandler) {
      const historyList = this.getHistoryList();
      if (historyList) {
        historyList.removeEventListener('scroll', this.scrollHandler);
      }
      this.scrollHandler = null;
    }
  }
}