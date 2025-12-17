/**
 * Filter Engine for History Search
 * Provides score-based filtering with fuzzy matching and debounce support
 * Following FileSearch's fuzzy-matcher pattern
 */

import type { HistoryItem } from '../types';
import type { HistorySearchConfig, SearchResult } from './types';
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
   * Returns items sorted by score (highest first)
   */
  public filter(items: HistoryItem[], query: string): HistoryItem[] {
    if (!query.trim()) {
      // Return all items when query is empty, limited by maxResults
      return items.slice(0, this.config.maxResults);
    }

    const queryNormalized = this.config.caseSensitive
      ? query.trim()
      : query.trim().toLowerCase();

    // Score and filter items
    const scored = items
      .map(item => this.scoreItem(item, queryNormalized))
      .filter(result => result.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, this.config.maxResults);

    return scored.map(result => result.item);
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
    callback: (results: HistoryItem[]) => void
  ): void {
    // Cancel any pending search
    this.cancelPendingSearch();

    // Schedule new search
    this.debounceTimer = setTimeout(() => {
      const results = this.filter(items, query);
      callback(results);
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
  public searchImmediate(items: HistoryItem[], query: string): HistoryItem[] {
    this.cancelPendingSearch();
    return this.filter(items, query);
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    this.cancelPendingSearch();
  }
}
