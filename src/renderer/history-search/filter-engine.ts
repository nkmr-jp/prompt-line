/**
 * Filter Engine for History Search
 * Provides score-based filtering with fuzzy matching and debounce support
 * Following FileSearch's fuzzy-matcher pattern
 */

import type { HistoryItem } from '../types';
import type { HistorySearchConfig, SearchResult, FilterResult } from './types';
import { DEFAULT_CONFIG, MATCH_SCORES, RECENCY_CONFIG } from './types';

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
    // Sort by score descending, then by timestamp descending (newest first) for same score
    const allMatches = searchItems
      .map(item => this.scoreItem(item, queryNormalized))
      .filter(result => result.score > 0)
      .sort((a, b) => b.score - a.score || b.item.timestamp - a.item.timestamp);

    const displayItems = allMatches
      .slice(0, this.config.maxDisplayResults)
      .map(result => result.item);

    return {
      items: displayItems,
      totalMatches: allMatches.length
    };
  }

  /**
   * Split query into keywords (space-separated)
   * Filters out empty strings
   */
  private splitKeywords(query: string): string[] {
    return query.split(/\s+/).filter(k => k.length > 0);
  }

  /**
   * Score a single keyword against text
   * Returns 0 if no match
   */
  private scoreKeyword(
    textNormalized: string,
    keyword: string
  ): { score: number; positions: number[] } {
    const matchPositions: number[] = [];
    let score = 0;

    // Exact match (highest priority)
    if (textNormalized === keyword) {
      score = MATCH_SCORES.EXACT_MATCH;
    }
    // Starts with keyword
    else if (textNormalized.startsWith(keyword)) {
      score = MATCH_SCORES.STARTS_WITH;
    }
    // Contains keyword
    else if (textNormalized.includes(keyword)) {
      score = MATCH_SCORES.CONTAINS;
      const matchIndex = textNormalized.indexOf(keyword);
      for (let i = 0; i < keyword.length; i++) {
        matchPositions.push(matchIndex + i);
      }
    }
    // Fuzzy match (if enabled)
    else if (this.config.enableFuzzyMatch) {
      const fuzzyResult = this.fuzzyMatch(textNormalized, keyword);
      if (fuzzyResult.matched) {
        score = MATCH_SCORES.FUZZY_MATCH;
        matchPositions.push(...fuzzyResult.positions);
      }
    }

    return { score, positions: matchPositions };
  }

  /**
   * Score a single history item against the query
   * Supports multiple keywords (space-separated, AND logic)
   */
  private scoreItem(item: HistoryItem, queryNormalized: string): SearchResult {
    const textNormalized = this.config.caseSensitive
      ? item.text
      : item.text.toLowerCase();

    const keywords = this.splitKeywords(queryNormalized);
    if (keywords.length === 0) {
      return { item, score: 0, matchPositions: [] };
    }

    let totalScore = 0;
    const allPositions: number[] = [];

    // All keywords must match (AND logic)
    for (const keyword of keywords) {
      const result = this.scoreKeyword(textNormalized, keyword);
      if (result.score === 0) {
        // Keyword not found, no match
        return { item, score: 0, matchPositions: [] };
      }
      totalScore += result.score;
      allPositions.push(...result.positions);
    }

    // Add recency bonus (newer items get higher scores)
    totalScore += this.calculateRecencyBonus(item.timestamp);

    return { item, score: totalScore, matchPositions: allPositions };
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
   * More recent items get higher bonus (0-200 points)
   * TTL is configurable via RECENCY_CONFIG.TTL_DAYS (default: 30 days)
   */
  private calculateRecencyBonus(timestamp: number): number {
    const now = Date.now();
    const age = now - timestamp;
    const oneDay = 24 * 60 * 60 * 1000;

    // Items within last 24 hours get full bonus
    if (age < oneDay) {
      return MATCH_SCORES.MAX_RECENCY_BONUS;
    }

    // Calculate TTL from config
    const ttlMs = RECENCY_CONFIG.TTL_DAYS * oneDay;

    // Items older than TTL get no bonus
    if (age > ttlMs) {
      return 0;
    }

    // Linear decay from MAX_RECENCY_BONUS to 0 over TTL period
    const ratio = 1 - (age - oneDay) / (ttlMs - oneDay);
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

    // Sort by score descending, then by timestamp descending (newest first) for same score
    const allMatches = searchItems
      .map(item => this.scoreItem(item, queryNormalized))
      .filter(result => result.score > 0)
      .sort((a, b) => b.score - a.score || b.item.timestamp - a.item.timestamp);

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
