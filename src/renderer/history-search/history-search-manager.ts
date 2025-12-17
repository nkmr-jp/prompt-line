/**
 * History Search Manager - Orchestration Layer
 * Coordinates search functionality by delegating to specialized modules
 * Following FileSearch's modular architecture pattern
 */

import type { HistoryItem } from '../types';
import type { HistorySearchConfig, HistorySearchCallbacks } from './types';
import { HistorySearchFilterEngine } from './filter-engine';
import { HistorySearchHighlighter } from './highlighter';

export class HistorySearchManager {
  // Sub-modules
  private filterEngine: HistorySearchFilterEngine;
  private highlighter: HistorySearchHighlighter;

  // DOM elements
  private searchButton: HTMLElement | null = null;
  private searchInput: HTMLInputElement | null = null;
  private searchClose: HTMLElement | null = null;
  private historyHeader: HTMLElement | null = null;

  // State
  private isSearchMode: boolean = false;
  private historyData: HistoryItem[] = [];

  // Callbacks
  private callbacks: HistorySearchCallbacks;

  constructor(
    callbacks: HistorySearchCallbacks,
    config: Partial<HistorySearchConfig> = {}
  ) {
    this.callbacks = callbacks;
    this.filterEngine = new HistorySearchFilterEngine(config);
    this.highlighter = new HistorySearchHighlighter();
  }

  /**
   * Initialize DOM element references
   */
  public initializeElements(): void {
    this.searchButton = document.getElementById('searchButton');
    this.searchInput = document.getElementById('searchInput') as HTMLInputElement;
    this.searchClose = document.getElementById('searchClose');
    this.historyHeader = document.querySelector('.history-header');
  }

  /**
   * Setup event listeners for search functionality
   */
  public setupEventListeners(): void {
    // Search button click
    if (this.searchButton) {
      this.searchButton.addEventListener('click', () => {
        this.toggleSearchMode();
      });
    }

    // Search input events
    if (this.searchInput) {
      this.searchInput.addEventListener('input', () => {
        this.performSearch();
      });

      this.searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          this.exitSearchMode();
          return;
        }
      });
    }

    // Search close button events
    if (this.searchClose) {
      // Use mousedown for more reliable triggering
      this.searchClose.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        this.exitSearchMode();
      });

      this.searchClose.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      });

      this.searchClose.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        this.exitSearchMode();
      });

      // Make focusable for accessibility
      this.searchClose.setAttribute('tabindex', '0');

      // Keyboard support
      this.searchClose.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          this.exitSearchMode();
        }
      });
    }
  }

  /**
   * Update history data for filtering
   */
  public updateHistoryData(historyData: HistoryItem[]): void {
    this.historyData = historyData;
  }

  /**
   * Toggle search mode on/off
   */
  public toggleSearchMode(): void {
    if (this.isSearchMode) {
      // If already in search mode, just focus the search input
      this.searchInput?.focus();
    } else {
      // Enter search mode
      this.enterSearchMode();
    }
  }

  /**
   * Enter search mode
   */
  public enterSearchMode(): void {
    if (!this.historyHeader || !this.searchButton || !this.searchInput) return;

    this.isSearchMode = true;
    this.historyHeader.classList.add('search-mode');
    this.searchButton.classList.add('active');

    // Focus on search input with slight delay for animation
    setTimeout(() => {
      this.searchInput?.focus();
    }, 100);

    // Initialize with all items - use filter to get proper result with totalMatches
    const result = this.filterEngine.filter(this.historyData, '');
    this.callbacks.onSearchStateChange(true, result.items, result.totalMatches);
    this.notifyResultCount(result.items.length, result.totalMatches);
  }

  /**
   * Exit search mode
   */
  public exitSearchMode(): void {
    if (!this.historyHeader || !this.searchButton || !this.searchInput) {
      return;
    }

    this.isSearchMode = false;
    this.historyHeader.classList.remove('search-mode');
    this.searchButton.classList.remove('active');
    this.searchInput.value = '';

    // Cancel any pending search
    this.filterEngine.cancelPendingSearch();

    // Reset to show all history items (no totalMatches when not searching)
    this.callbacks.onSearchStateChange(false, [...this.historyData]);
  }

  /**
   * Perform search with debounce
   */
  private performSearch(): void {
    if (!this.searchInput || !this.isSearchMode) return;

    const query = this.searchInput.value.trim();

    // Use debounced search
    this.filterEngine.searchDebounced(
      this.historyData,
      query,
      (result) => {
        this.callbacks.onSearchStateChange(true, result.items, result.totalMatches);
        this.notifyResultCount(result.items.length, result.totalMatches);
      }
    );
  }

  /**
   * Notify result count change
   */
  private notifyResultCount(count: number, total: number): void {
    if (this.callbacks.onResultCountChange) {
      this.callbacks.onResultCountChange(count, total);
    }
  }

  /**
   * Highlight search terms in text
   * Delegates to highlighter module
   */
  public highlightSearchTerms(text: string, searchTerm: string): string {
    return this.highlighter.highlightSearchTerms(text, searchTerm);
  }

  /**
   * Get current search term
   */
  public getSearchTerm(): string {
    return this.searchInput?.value.trim() || '';
  }

  /**
   * Check if search mode is active
   */
  public isInSearchMode(): boolean {
    return this.isSearchMode;
  }

  /**
   * Focus main textarea
   */
  public focusMainTextarea(): void {
    const textarea = document.getElementById('textInput') as HTMLTextAreaElement;
    textarea?.focus();
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<HistorySearchConfig>): void {
    this.filterEngine.updateConfig(config);
  }

  /**
   * Get current configuration
   */
  public getConfig(): HistorySearchConfig {
    return this.filterEngine.getConfig();
  }

  /**
   * Get filter engine for advanced operations
   */
  public getFilterEngine(): HistorySearchFilterEngine {
    return this.filterEngine;
  }

  /**
   * Get highlighter for advanced operations
   */
  public getHighlighter(): HistorySearchHighlighter {
    return this.highlighter;
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    this.filterEngine.cleanup();
  }
}
