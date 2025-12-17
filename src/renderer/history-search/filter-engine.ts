/**
 * Filter Engine for History Search
 * Provides score-based filtering with fuzzy matching and debounce support
 * Following FileSearch's fuzzy-matcher pattern
 */

import type { HistoryItem } from '../types';
import type { HistorySearchConfig, SearchResult, FilterResult } from './types';
import { DEFAULT_CONFIG, MATCH_SCORES } from './types';

export class HistorySearchFilterEngine {
  private config: HistorySearchConfig;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(config: Partial<HistorySearchConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<HistorySearchConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  public getConfig(): HistorySearchConfig {
    return { ...this.config };
  }

  /**
   * Filter and score history items based on query
   * Searches through up to maxSearchItems, returns up to maxDisplayResults
   * Returns both filtered items and total match count
   */
  public filter(items: HistoryItem[], query: string): FilterResult {
    // Limit search scope to maxSearchItems
    const searchItems = items.slice(0, this.config.maxSearchItems);

    if (!query.trim()) {
      // Return items when query is empty, limited by maxDisplayResults
      return {
        items: searchItems.slice(0, this.config.maxDisplayResults),
        totalMatches: searchItems.length
      };
    }

    const queryNormalized = this.config.caseSensitive
      ? query.trim()
      : query.trim().toLowerCase();

    // Score and filter items from the search scope
    const allMatches = searchItems
      .map(item => this.scoreItem(item, queryNormalized))
      .filter(result => result.score > 0)
      .sort((a, b) => b.score - a.score);

    const displayItems = allMatches
      .slice(0, this.config.maxDisplayResults)
      .map(result => result.item);

    return {
      items: displayItems,
      totalMatches: allMatches.length
    };
  }

  /**
   * Score a single history item against the query
   */
  private scoreItem(item: HistoryItem, queryNormalized: string): SearchResult {
    const textNormalized = this.config.caseSensitive
      ? item.text
      : item.text.toLowerCase();

    let score = 0;
    const matchPositions: number[] = [];

    // Exact match (highest priority)
    if (textNormalized === queryNormalized) {
      score += MATCH_SCORES.EXACT_MATCH;
    }
    // Starts with query
    else if (textNormalized.startsWith(queryNormalized)) {
      score += MATCH_SCORES.STARTS_WITH;
    }
    // Contains query
    else if (textNormalized.includes(queryNormalized)) {
      score += MATCH_SCORES.CONTAINS;
      // Record match position for potential future use
      const matchIndex = textNormalized.indexOf(queryNormalized);
      for (let i = 0; i < queryNormalized.length; i++) {
        matchPositions.push(matchIndex + i);
      }
    }
    // Fuzzy match (if enabled)
    else if (this.config.enableFuzzyMatch) {
      const fuzzyResult = this.fuzzyMatch(textNormalized, queryNormalized);
      if (fuzzyResult.matched) {
        score += MATCH_SCORES.FUZZY_MATCH;
        matchPositions.push(...fuzzyResult.positions);
      }
    }

    // Add recency bonus (newer items get higher scores)
    if (score > 0) {
      score += this.calculateRecencyBonus(item.timestamp);
    }

    return { item, score, matchPositions };
  }

  /**
   * Calculate match score for a history item (public for testing)
   * Higher score = better match
   */
  public calculateMatchScore(item: HistoryItem, query: string): number {
    const queryNormalized = this.config.caseSensitive
      ? query.trim()
      : query.trim().toLowerCase();

    return this.scoreItem(item, queryNormalized).score;
  }

  /**
   * Fuzzy match implementation
   * Characters must appear in order but not necessarily consecutively
   */
  public fuzzyMatch(text: string, pattern: string): { matched: boolean; positions: number[] } {
    const positions: number[] = [];
    let patternIdx = 0;

    for (let i = 0; i < text.length && patternIdx < pattern.length; i++) {
      if (text[i] === pattern[patternIdx]) {
        positions.push(i);
        patternIdx++;
      }
    }

    return {
      matched: patternIdx === pattern.length,
      positions
    };
  }

  /**
   * Calculate recency bonus based on timestamp
   * More recent items get higher bonus (0-50 points)
   */
  private calculateRecencyBonus(timestamp: number): number {
    const now = Date.now();
    const age = now - timestamp;
    const oneDay = 24 * 60 * 60 * 1000;

    // Items within last 24 hours get full bonus
    if (age < oneDay) {
      return MATCH_SCORES.MAX_RECENCY_BONUS;
    }

    // Decay over 7 days
    const sevenDays = 7 * oneDay;
    if (age > sevenDays) {
      return 0;
    }

    // Linear decay from MAX_RECENCY_BONUS to 0 over 7 days
    const ratio = 1 - (age - oneDay) / (sevenDays - oneDay);
    return Math.floor(ratio * MATCH_SCORES.MAX_RECENCY_BONUS);
  }

  /**
   * Execute search with debounce
   * Cancels any pending search and schedules a new one
   */
  public searchDebounced(
    items: HistoryItem[],
    query: string,
    callback: (result: FilterResult) => void
  ): void {
    // Cancel any pending search
    this.cancelPendingSearch();

    // Schedule new search
    this.debounceTimer = setTimeout(() => {
      const result = this.filter(items, query);
      callback(result);
      this.debounceTimer = null;
    }, this.config.debounceDelay);
  }

  /**
   * Cancel any pending debounced search
   */
  public cancelPendingSearch(): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  /**
   * Execute search immediately (bypass debounce)
   */
  public searchImmediate(items: HistoryItem[], query: string): FilterResult {
    this.cancelPendingSearch();
    return this.filter(items, query);
  }

  /**
   * Filter with custom display limit (for pagination/load more)
   */
  public filterWithLimit(items: HistoryItem[], query: string, displayLimit: number): FilterResult {
    // Limit search scope to maxSearchItems
    const searchItems = items.slice(0, this.config.maxSearchItems);

    if (!query.trim()) {
      return {
        items: searchItems.slice(0, displayLimit),
        totalMatches: searchItems.length
      };
    }

    const queryNormalized = this.config.caseSensitive
      ? query.trim()
      : query.trim().toLowerCase();

    const allMatches = searchItems
      .map(item => this.scoreItem(item, queryNormalized))
      .filter(result => result.score > 0)
      .sort((a, b) => b.score - a.score);

    return {
      items: allMatches.slice(0, displayLimit).map(result => result.item),
      totalMatches: allMatches.length
    };
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    this.cancelPendingSearch();
  }
}
