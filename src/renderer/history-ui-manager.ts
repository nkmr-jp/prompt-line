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
  private clickDelegationHandler: ((e: MouseEvent) => void) | null = null;
  private scrollRAFId: number | null = null;
  // Cached scrollbar DOM elements (avoid repeated getElementById per scroll event)
  private scrollbarElement: HTMLElement | null = null;
  private thumbElement: HTMLElement | null = null;
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

    // RAF-throttled scroll handler: limits to once per frame (16.67ms at 60fps)
    this.scrollHandler = () => {
      if (this.scrollRAFId !== null) return;
      this.scrollRAFId = requestAnimationFrame(() => {
        this.checkScrollPosition();
        this.showScrollbar();
        this.scrollRAFId = null;
      });
    };

    historyList.addEventListener('scroll', this.scrollHandler, { passive: true });

    // Setup click delegation (single handler instead of per-item)
    if (!this.clickDelegationHandler) {
      this.clickDelegationHandler = (e: MouseEvent) => {
        const target = (e.target as HTMLElement).closest('.history-item') as HTMLElement;
        if (target?.dataset.text !== undefined) {
          this.selectHistoryItemFromClick(target.dataset.text);
        }
      };
      historyList.addEventListener('click', this.clickDelegationHandler);
    }

    // Cache scrollbar DOM elements (used frequently in scroll handler)
    this.scrollbarElement = document.getElementById('customScrollbar');
    this.thumbElement = document.getElementById('customScrollbarThumb');

    // Setup scrollbar hover interactions
    const scrollbar = this.scrollbarElement;
    const thumb = this.thumbElement;
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
    // Multiply by 3 for larger thumb size
    const thumbHeight = (clientHeight / scrollHeight) * clientHeight * 3;
    return Math.max(20, thumbHeight);
  }

  /**
   * Show custom scrollbar while scrolling, hide after scrolling stops
   */
  private showScrollbar(): void {
    const historyList = this.getHistoryList();
    if (!historyList) return;

    const scrollbar = this.scrollbarElement;
    const thumb = this.thumbElement;
    if (!scrollbar || !thumb) return;

    // Batch read operations first to avoid layout thrashing
    const scrollHeight = historyList.scrollHeight;
    const clientHeight = historyList.clientHeight;
    const scrollTop = historyList.scrollTop;

    // Only show scrollbar if content is scrollable
    if (scrollHeight <= clientHeight) {
      scrollbar.classList.remove('visible');
      return;
    }

    // Calculate thumb dimensions (no DOM operations)
    const thumbHeight = this.calculateThumbHeight(clientHeight, scrollHeight);
    const maxScrollTop = scrollHeight - clientHeight;
    const thumbTop = (scrollTop / maxScrollTop) * (clientHeight - thumbHeight);

    // Write operations (already inside RAF from scroll handler)
    thumb.style.height = `${thumbHeight}px`;
    thumb.style.transform = `translateY(${thumbTop}px)`;
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

    const thumb = this.thumbElement;
    if (!thumb) return;

    // Batch read operations first to avoid layout thrashing
    const scrollHeight = historyList.scrollHeight;
    const clientHeight = historyList.clientHeight;
    const scrollTop = historyList.scrollTop;

    // Only update if content is scrollable
    if (scrollHeight <= clientHeight) return;

    // Calculate dimensions (no DOM operations)
    const thumbHeight = this.calculateThumbHeight(clientHeight, scrollHeight);
    const maxScrollTop = scrollHeight - clientHeight;
    const thumbTop = (scrollTop / maxScrollTop) * (clientHeight - thumbHeight);

    // Batch write operations
    thumb.style.height = `${thumbHeight}px`;
    thumb.style.transform = `translateY(${thumbTop}px)`;
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

      // Hoist search state once (avoids per-item getSearchManager() calls)
      const searchTerm = isSearchMode ? (searchManager?.getSearchTerm() || '') : '';
      // Cache Date.now() once for all items (avoids 50x Date.now() calls)
      const now = Date.now();

      // DOM recycling: reuse existing elements instead of full rebuild
      const existingItems = historyList.querySelectorAll('.history-item');
      const existingCount = existingItems.length;
      const newCount = dataToRender.length;

      if (existingCount > 0) {
        // Recycle path: update existing DOM elements in-place
        const updateCount = Math.min(existingCount, newCount);
        for (let i = 0; i < updateCount; i++) {
          this.updateHistoryElement(existingItems[i] as HTMLElement, dataToRender[i]!, isSearchMode, searchTerm, searchManager, now);
        }

        // Add new elements if needed
        if (newCount > existingCount) {
          const fragment = document.createDocumentFragment();
          for (let i = existingCount; i < newCount; i++) {
            fragment.appendChild(this.createHistoryElement(dataToRender[i]!, isSearchMode, searchTerm, searchManager, now));
          }
          const countIndicator = historyList.querySelector('.history-more');
          if (countIndicator) {
            historyList.insertBefore(fragment, countIndicator);
          } else {
            historyList.appendChild(fragment);
          }
        }

        // Remove excess elements if needed
        if (existingCount > newCount) {
          for (let i = existingCount - 1; i >= newCount; i--) {
            existingItems[i]!.remove();
          }
        }

        // Update count indicator in-place
        this.updateCountIndicator(historyList, dataToRender.length, totalMatches);

        // Only update scrollbar if item count changed
        if (existingCount !== newCount) {
          requestAnimationFrame(() => {
            this.updateScrollbarAfterRender();
          });
        }
      } else {
        // Full build path: no existing elements to recycle (first render or after empty state)
        const fragment = document.createDocumentFragment();
        for (let i = 0; i < newCount; i++) {
          fragment.appendChild(this.createHistoryElement(dataToRender[i]!, isSearchMode, searchTerm, searchManager, now));
        }

        // Create count indicator
        const totalCount = totalMatches !== undefined ? totalMatches : dataToRender.length;
        const countIndicator = document.createElement('div');
        countIndicator.className = 'history-more';
        if (totalCount > dataToRender.length) {
          countIndicator.textContent = `+${totalCount - dataToRender.length} more items`;
        } else {
          countIndicator.textContent = `${totalCount} items`;
        }
        fragment.appendChild(countIndicator);

        historyList.replaceChildren(fragment);

        requestAnimationFrame(() => {
          this.updateScrollbarAfterRender();
        });
      }

    } catch (error) {
      console.error('Error rendering history:', error);
      const historyList = this.getHistoryList();
      if (historyList) {
        historyList.innerHTML = '<div class="history-empty">Error loading history</div>';
      }
    }
  }

  /**
   * Append new items to existing history list (for loadMore)
   * Avoids full DOM rebuild by only creating and appending new elements
   */
  public appendHistoryItems(newItems: HistoryItem[], totalMatches?: number): void {
    const historyList = this.getHistoryList();
    if (!historyList || newItems.length === 0) return;

    const searchManager = this.getSearchManager();
    const isSearchMode = searchManager?.isInSearchMode() || false;
    const searchTerm = isSearchMode ? (searchManager?.getSearchTerm() || '') : '';

    // Create fragment for new items only
    const now = Date.now();
    const fragment = document.createDocumentFragment();
    for (const item of newItems) {
      fragment.appendChild(this.createHistoryElement(item, isSearchMode, searchTerm, searchManager, now));
    }

    // Remove existing count indicator
    const existingMore = historyList.querySelector('.history-more');
    if (existingMore) {
      existingMore.remove();
    }

    // Create updated count indicator
    const displayedCount = historyList.querySelectorAll('.history-item').length + newItems.length;
    const totalCount = totalMatches !== undefined ? totalMatches : displayedCount;
    const countIndicator = document.createElement('div');
    countIndicator.className = 'history-more';
    if (totalCount > displayedCount) {
      countIndicator.textContent = `+${totalCount - displayedCount} more items`;
    } else {
      countIndicator.textContent = `${totalCount} items`;
    }
    fragment.appendChild(countIndicator);

    // Append only new items (existing DOM untouched)
    historyList.appendChild(fragment);

    // Update scrollbar
    requestAnimationFrame(() => {
      this.updateScrollbarAfterRender();
    });
  }

  /**
   * Update an existing DOM element in-place (avoids createElement overhead)
   */
  private updateHistoryElement(
    element: HTMLElement,
    item: HistoryItem,
    isSearchMode: boolean,
    searchTerm: string,
    searchManager: { highlightSearchTerms(text: string, term: string): string } | null,
    now: number
  ): void {
    // Update data attributes
    element.dataset.text = item.text;
    element.dataset.id = item.id;

    // Update text (access children directly for speed, avoid querySelector)
    const textDiv = element.children[0] as HTMLElement;
    const displayText = item.text.replace(/\n/g, ' ');
    if (isSearchMode && searchTerm) {
      textDiv.innerHTML = searchManager?.highlightSearchTerms(displayText, searchTerm) || displayText;
    } else {
      textDiv.textContent = displayText;
    }

    // Update time
    const timeDiv = element.children[1] as HTMLElement;
    timeDiv.textContent = formatTime(item.timestamp, now);
  }

  /**
   * Update the count indicator element in-place
   */
  private updateCountIndicator(historyList: HTMLElement, displayedCount: number, totalMatches?: number): void {
    let countIndicator = historyList.querySelector('.history-more') as HTMLElement | null;
    if (!countIndicator) {
      countIndicator = document.createElement('div');
      countIndicator.className = 'history-more';
      historyList.appendChild(countIndicator);
    }
    const totalCount = totalMatches !== undefined ? totalMatches : displayedCount;
    if (totalCount > displayedCount) {
      countIndicator.textContent = `+${totalCount - displayedCount} more items`;
    } else {
      countIndicator.textContent = `${totalCount} items`;
    }
  }

  private createHistoryElement(
    item: HistoryItem,
    isSearchMode: boolean,
    searchTerm: string,
    searchManager: { highlightSearchTerms(text: string, term: string): string } | null,
    now?: number
  ): HTMLElement {
    const historyItem = document.createElement('div');
    historyItem.className = 'history-item';
    historyItem.dataset.text = item.text;
    historyItem.dataset.id = item.id;

    const textDiv = document.createElement('div');
    textDiv.className = 'history-text';

    // Apply search highlighting if in search mode
    const displayText = item.text.replace(/\n/g, ' ');

    if (isSearchMode && searchTerm) {
      textDiv.innerHTML = searchManager?.highlightSearchTerms(displayText, searchTerm) || displayText;
    } else {
      textDiv.textContent = displayText;
    }

    const timeDiv = document.createElement('div');
    timeDiv.className = 'history-time';
    timeDiv.textContent = formatTime(item.timestamp, now);

    historyItem.appendChild(textDiv);
    historyItem.appendChild(timeDiv);

    // Click handling is done via event delegation on the historyList
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
    const selectedItem = historyItems[this.historyIndex] as HTMLElement;

    if (!selectedItem) return;

    // Batch read and write operations in requestAnimationFrame to avoid layout thrashing
    requestAnimationFrame(() => {
      // Clear all existing flash effects (write operation)
      historyItems.forEach(item => {
        item.classList.remove('flash');
      });

      // Force reflow to ensure the removal takes effect before adding
      void selectedItem.offsetHeight;

      // Add flash class to selected item
      selectedItem.classList.add('flash');

      // Remove flash class after animation
      setTimeout(() => {
        selectedItem.classList.remove('flash');
      }, TIMEOUTS.FLASH_ANIMATION_DURATION);
    });
  }

  public clearHistorySelection(): void {
    // Skip DOM operations if no selection is active
    if (this.historyIndex === -1 && !this.keyboardNavigationTimeout) return;

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

    if (!selectedItem) return;

    // Use requestAnimationFrame to separate read/write operations
    requestAnimationFrame(() => {
      selectedItem.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      });
    });
  }

  public cleanup(): void {
    if (this.scrollRAFId !== null) {
      cancelAnimationFrame(this.scrollRAFId);
      this.scrollRAFId = null;
    }

    if (this.keyboardNavigationTimeout) {
      clearTimeout(this.keyboardNavigationTimeout);
      this.keyboardNavigationTimeout = null;
    }

    if (this.scrollingTimeout) {
      clearTimeout(this.scrollingTimeout);
      this.scrollingTimeout = null;
    }

    // Remove scroll event listener
    if (this.scrollHandler || this.clickDelegationHandler) {
      const historyList = this.getHistoryList();
      if (historyList) {
        if (this.scrollHandler) {
          historyList.removeEventListener('scroll', this.scrollHandler);
        }
        if (this.clickDelegationHandler) {
          historyList.removeEventListener('click', this.clickDelegationHandler);
        }
      }
      this.scrollHandler = null;
      this.clickDelegationHandler = null;
    }

    // Remove scrollbar event listeners
    const scrollbar = this.scrollbarElement;
    const thumb = this.thumbElement;
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
    this.scrollbarElement = null;
    this.thumbElement = null;
  }
}