import { TIMEOUTS } from '../constants';
import { formatTime } from './utils/time-formatter';
import type { HistoryItem } from './types';

export class HistoryUIManager {
  private historyIndex: number = -1;
  private keyboardNavigationTimeout: NodeJS.Timeout | null = null;
  private scrollingTimeout: NodeJS.Timeout | null = null;
  private getCurrentText: () => string;
  private getCursorPosition: () => number;
  private saveSnapshotCallback: (text: string, cursorPosition: number) => void;
  private loadMoreCallback: (() => void) | null = null;
  private scrollHandler: (() => void) | null = null;
  private wheelHandler: ((e: WheelEvent) => void) | null = null;
  private mouseEnterHandler: (() => void) | null = null;
  private thumbMouseDownHandler: ((e: MouseEvent) => void) | null = null;
  private documentMouseMoveHandler: ((e: MouseEvent) => void) | null = null;
  private documentMouseUpHandler: (() => void) | null = null;
  private isDragging: boolean = false;
  private dragStartY: number = 0;
  private dragStartScrollTop: number = 0;

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
   * Setup scroll event listener for infinite scroll and scrollbar visibility
   */
  public setupScrollListener(): void {
    const historyList = this.getHistoryList();
    if (!historyList || this.scrollHandler) return;

    this.scrollHandler = () => {
      this.checkScrollPosition();
      this.showScrollbar();
    };

    historyList.addEventListener('scroll', this.scrollHandler);

    // Setup scrollbar hover interactions
    const scrollbar = document.getElementById('customScrollbar');
    const thumb = document.getElementById('customScrollbarThumb');
    if (scrollbar) {
      // Forward wheel events from scrollbar to history list
      this.wheelHandler = (e: WheelEvent) => {
        e.preventDefault();
        historyList.scrollTop += e.deltaY;
      };
      scrollbar.addEventListener('wheel', this.wheelHandler, { passive: false });

      // Update scrollbar on mouse enter (for initial display)
      this.mouseEnterHandler = () => {
        this.showScrollbar();
      };
      scrollbar.addEventListener('mouseenter', this.mouseEnterHandler);

      // Setup drag functionality on thumb
      if (thumb) {
        this.thumbMouseDownHandler = (e: MouseEvent) => {
          e.preventDefault();
          this.isDragging = true;
          this.dragStartY = e.clientY;
          this.dragStartScrollTop = historyList.scrollTop;
          scrollbar.classList.add('visible');
          document.body.style.userSelect = 'none';
        };
        thumb.addEventListener('mousedown', this.thumbMouseDownHandler);

        this.documentMouseMoveHandler = (e: MouseEvent) => {
          if (!this.isDragging) return;

          const scrollHeight = historyList.scrollHeight;
          const clientHeight = historyList.clientHeight;
          const maxScrollTop = scrollHeight - clientHeight;

          // Calculate scroll ratio based on mouse movement
          const deltaY = e.clientY - this.dragStartY;
          const thumbHeight = this.calculateThumbHeight(clientHeight, scrollHeight);
          const trackHeight = clientHeight - thumbHeight;
          const scrollRatio = deltaY / trackHeight;

          // Update scroll position
          const newScrollTop = this.dragStartScrollTop + (scrollRatio * maxScrollTop);
          historyList.scrollTop = Math.max(0, Math.min(maxScrollTop, newScrollTop));
        };
        document.addEventListener('mousemove', this.documentMouseMoveHandler);

        this.documentMouseUpHandler = () => {
          if (this.isDragging) {
            this.isDragging = false;
            document.body.style.userSelect = '';
            // Hide scrollbar after drag ends (with delay)
            this.showScrollbar();
          }
        };
        document.addEventListener('mouseup', this.documentMouseUpHandler);
      }
    }
  }

  /**
   * Calculate thumb height using logarithmic scale for better UX with large content
   */
  private calculateThumbHeight(clientHeight: number, scrollHeight: number): number {
    // Linear calculation based on content ratio (standard scrollbar behavior)
    return (clientHeight / scrollHeight) * clientHeight;
  }

  /**
   * Show custom scrollbar while scrolling, hide after scrolling stops
   */
  private showScrollbar(): void {
    const historyList = this.getHistoryList();
    if (!historyList) return;

    const scrollbar = document.getElementById('customScrollbar');
    const thumb = document.getElementById('customScrollbarThumb');
    if (!scrollbar || !thumb) return;

    // Calculate scrollbar thumb size and position
    const scrollHeight = historyList.scrollHeight;
    const clientHeight = historyList.clientHeight;
    const scrollTop = historyList.scrollTop;

    // Only show scrollbar if content is scrollable
    if (scrollHeight <= clientHeight) {
      scrollbar.classList.remove('visible');
      return;
    }

    // Calculate thumb height using logarithmic scale
    const thumbHeight = this.calculateThumbHeight(clientHeight, scrollHeight);

    // Calculate thumb position
    const maxScrollTop = scrollHeight - clientHeight;
    const thumbTop = (scrollTop / maxScrollTop) * (clientHeight - thumbHeight);

    // Update thumb style
    thumb.style.height = `${thumbHeight}px`;
    thumb.style.transform = `translateY(${thumbTop}px)`;

    // Show scrollbar
    scrollbar.classList.add('visible');

    // Clear existing timeout
    if (this.scrollingTimeout) {
      clearTimeout(this.scrollingTimeout);
    }

    // Hide scrollbar after scrolling stops (500ms delay)
    this.scrollingTimeout = setTimeout(() => {
      scrollbar.classList.remove('visible');
    }, 500);
  }

  /**
   * Update scrollbar thumb size after content changes (e.g., infinite scroll load)
   * Unlike showScrollbar, this only updates the size without showing/hiding
   */
  private updateScrollbarAfterRender(): void {
    const historyList = this.getHistoryList();
    if (!historyList) return;

    const thumb = document.getElementById('customScrollbarThumb');
    if (!thumb) return;

    const scrollHeight = historyList.scrollHeight;
    const clientHeight = historyList.clientHeight;

    // Only update if content is scrollable
    if (scrollHeight <= clientHeight) return;

    // Calculate and update thumb height using logarithmic scale
    const thumbHeight = this.calculateThumbHeight(clientHeight, scrollHeight);
    thumb.style.height = `${thumbHeight}px`;

    // Also update thumb position based on current scroll
    const scrollTop = historyList.scrollTop;
    const maxScrollTop = scrollHeight - clientHeight;
    const thumbTop = (scrollTop / maxScrollTop) * (clientHeight - thumbHeight);
    thumb.style.transform = `translateY(${thumbTop}px)`;

    console.debug('[updateScrollbarAfterRender] scrollHeight:', scrollHeight, 'clientHeight:', clientHeight, 'thumbHeight:', thumbHeight);
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

      // Update scrollbar after content is rendered
      // Use requestAnimationFrame to ensure DOM layout is complete
      requestAnimationFrame(() => {
        this.updateScrollbarAfterRender();
      });

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

    if (this.scrollingTimeout) {
      clearTimeout(this.scrollingTimeout);
      this.scrollingTimeout = null;
    }

    // Remove scroll event listener
    if (this.scrollHandler) {
      const historyList = this.getHistoryList();
      if (historyList) {
        historyList.removeEventListener('scroll', this.scrollHandler);
      }
      this.scrollHandler = null;
    }

    // Remove scrollbar event listeners
    const scrollbar = document.getElementById('customScrollbar');
    const thumb = document.getElementById('customScrollbarThumb');
    if (scrollbar) {
      if (this.wheelHandler) {
        scrollbar.removeEventListener('wheel', this.wheelHandler);
        this.wheelHandler = null;
      }
      if (this.mouseEnterHandler) {
        scrollbar.removeEventListener('mouseenter', this.mouseEnterHandler);
        this.mouseEnterHandler = null;
      }
    }
    if (thumb && this.thumbMouseDownHandler) {
      thumb.removeEventListener('mousedown', this.thumbMouseDownHandler);
      this.thumbMouseDownHandler = null;
    }
    if (this.documentMouseMoveHandler) {
      document.removeEventListener('mousemove', this.documentMouseMoveHandler);
      this.documentMouseMoveHandler = null;
    }
    if (this.documentMouseUpHandler) {
      document.removeEventListener('mouseup', this.documentMouseUpHandler);
      this.documentMouseUpHandler = null;
    }
    this.isDragging = false;
  }
}