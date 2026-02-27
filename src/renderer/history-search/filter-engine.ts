/**
 * Filter Engine for History Search
 * Provides score-based filtering with fuzzy matching and debounce support
 * Following FileSearch's fuzzy-matcher pattern
 *
 * Performance optimizations:
 * - Pre-computed normalized text cache (avoids repeated toLowerCase())
 * - Inlined scoring in hot loop (avoids function call overhead)
 * - Keywords split once per search (not per item)
 * - Date.now() cached once per search (not per item)
 * - Inline tiebreak comparison (avoids compareTiebreak overhead)
 * - Pre-computed constants in local variables (V8 optimization)
 * - Sorted match result cache (avoids re-filtering on loadMore)
 */

import type { HistoryItem } from '../types';
import type { HistorySearchConfig, SearchResult, FilterResult } from './types';
import { DEFAULT_CONFIG, MATCH_SCORES, RECENCY_CONFIG } from './types';

/** Pre-computed TTL in milliseconds */
const TTL_MS = RECENCY_CONFIG.TTL_DAYS * 86_400_000;

export class HistorySearchFilterEngine {
  private config: HistorySearchConfig;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  // Normalized text cache for avoiding repeated toLowerCase() calls
  private normalizedCache: string[] = [];
  private normalizedCacheSource: HistoryItem[] | null = null;
  private normalizedCacheLength: number = 0;

  // Sorted match result cache for loadMore optimization
  // When query is unchanged, loadMore only needs to return more items from cached results
  private resultCacheQuery: string = '';
  private resultCacheItems: HistoryItem[] | null = null;
  private resultCacheMatches: HistoryItem[] = [];
  private resultCacheTotalMatches: number = 0;

  constructor(config: Partial<HistorySearchConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<HistorySearchConfig>): void {
    this.config = { ...this.config, ...config };
    // Invalidate cache when caseSensitive changes
    this.invalidateCache();
  }

  /**
   * Get current configuration
   */
  public getConfig(): HistorySearchConfig {
    return { ...this.config };
  }

  /**
   * Invalidate the normalized text cache
   * Call when items change or config changes
   */
  public invalidateCache(): void {
    this.normalizedCacheSource = null;
    this.normalizedCacheLength = 0;
    this.resultCacheQuery = '';
    this.resultCacheItems = null;
    this.resultCacheMatches = [];
    this.resultCacheTotalMatches = 0;
  }

  /**
   * Ensure normalized text cache is up to date
   * Uses reference equality check for fast cache validation
   */
  private ensureNormalized(items: HistoryItem[]): number {
    const limit = Math.min(items.length, this.config.maxSearchItems);

    if (items === this.normalizedCacheSource && limit === this.normalizedCacheLength) {
      return limit;
    }

    this.normalizedCacheSource = items;
    this.normalizedCacheLength = limit;

    // Resize array if needed
    if (this.normalizedCache.length < limit) {
      this.normalizedCache = new Array(limit);
    }

    const caseSensitive = this.config.caseSensitive;
    for (let i = 0; i < limit; i++) {
      this.normalizedCache[i] = caseSensitive ? items[i]!.text : items[i]!.text.toLowerCase();
    }

    return limit;
  }

  /**
   * Core optimized filter implementation
   * Shared between filter() and filterWithLimit()
   */
  private filterCore(items: HistoryItem[], query: string, displayLimit: number): FilterResult {
    const limit = this.ensureNormalized(items);

    if (!query.trim()) {
      // Clear result cache for empty query
      this.resultCacheQuery = '';
      const resultLimit = Math.min(limit, displayLimit);
      const result: HistoryItem[] = new Array(resultLimit);
      for (let i = 0; i < resultLimit; i++) {
        result[i] = items[i]!;
      }
      return { items: result, totalMatches: limit };
    }

    const queryNormalized = this.config.caseSensitive
      ? query.trim()
      : query.trim().toLowerCase();

    // Result cache hit: same query + same items → just return more/fewer from cached sorted results
    // This makes loadMore() essentially free (no re-filtering, no re-sorting)
    if (queryNormalized === this.resultCacheQuery && items === this.resultCacheItems) {
      const resultLimit = Math.min(this.resultCacheTotalMatches, displayLimit);
      const displayItems: HistoryItem[] = new Array(resultLimit);
      for (let i = 0; i < resultLimit; i++) {
        displayItems[i] = this.resultCacheMatches[i]!;
      }
      return { items: displayItems, totalMatches: this.resultCacheTotalMatches };
    }

    // Split keywords once per search
    const keywords = this.splitKeywordsOptimized(queryNormalized);
    if (keywords.length === 0) {
      return { items: [], totalMatches: 0 };
    }

    // Pre-compute constants in local variables for V8 optimization
    const now = Date.now();
    const maxRecency = MATCH_SCORES.MAX_RECENCY_BONUS;
    const exactScore = MATCH_SCORES.EXACT_MATCH;
    const startsScore = MATCH_SCORES.STARTS_WITH;
    const containsScore = MATCH_SCORES.CONTAINS;
    const keywordCount = keywords.length;
    const normalizedCache = this.normalizedCache;

    // Single pass: score and collect matches
    const matches: Array<{ item: HistoryItem; score: number; index: number }> = [];

    for (let i = 0; i < limit; i++) {
      const textNormalized = normalizedCache[i]!;

      // Inline scoring: all keywords must match (AND logic)
      let totalScore = 0;
      let allMatch = true;

      for (let k = 0; k < keywordCount; k++) {
        const keyword = keywords[k]!;

        if (textNormalized === keyword) {
          totalScore += exactScore;
        } else if (textNormalized.startsWith(keyword)) {
          totalScore += startsScore;
        } else if (textNormalized.includes(keyword)) {
          totalScore += containsScore;
        } else {
          allMatch = false;
          break;
        }
      }

      if (!allMatch) continue;

      // Inline recency bonus calculation
      const age = now - items[i]!.timestamp;
      if (age <= TTL_MS) {
        totalScore += Math.floor((1 - age / TTL_MS) * maxRecency);
      }

      matches.push({ item: items[i]!, score: totalScore, index: i });
    }

    // Sort by score descending, then by index ascending (inline tiebreak)
    matches.sort((a, b) => {
      const scoreDiff = b.score - a.score;
      if (scoreDiff !== 0) return scoreDiff;
      return a.index - b.index;
    });

    // Cache sorted results for loadMore optimization
    const sortedItems: HistoryItem[] = new Array(matches.length);
    for (let i = 0; i < matches.length; i++) {
      sortedItems[i] = matches[i]!.item;
    }
    this.resultCacheQuery = queryNormalized;
    this.resultCacheItems = items;
    this.resultCacheMatches = sortedItems;
    this.resultCacheTotalMatches = matches.length;

    const resultLimit = Math.min(matches.length, displayLimit);
    const displayItems: HistoryItem[] = new Array(resultLimit);
    for (let i = 0; i < resultLimit; i++) {
      displayItems[i] = sortedItems[i]!;
    }

    return { items: displayItems, totalMatches: matches.length };
  }

  /**
   * Filter and score history items based on query
   * Searches through up to maxSearchItems, returns up to maxDisplayResults
   * Returns both filtered items and total match count
   */
  public filter(items: HistoryItem[], query: string): FilterResult {
    return this.filterCore(items, query, this.config.maxDisplayResults);
  }

  /**
   * Filter with custom display limit (for pagination/load more)
   */
  public filterWithLimit(items: HistoryItem[], query: string, displayLimit: number): FilterResult {
    return this.filterCore(items, query, displayLimit);
  }

  /**
   * Split query into keywords (space-separated)
   * Optimized: avoids regex and filter for common cases
   */
  private splitKeywordsOptimized(query: string): string[] {
    // Fast path: no spaces in query (single keyword)
    if (query.indexOf(' ') === -1) {
      return query.length > 0 ? [query] : [];
    }
    return query.split(/\s+/).filter(k => k.length > 0);
  }

  /**
   * Split query into keywords (space-separated)
   * Filters out empty strings
   */
  private splitKeywords(query: string): string[] {
    return query.split(/\s+/).filter(k => k.length > 0);
  }

  /**
   * Score a single keyword against text using simple contains matching
   * Returns 0 if no match
   */
  private scoreKeyword(
    textNormalized: string,
    keyword: string
  ): { score: number; positions: number[] } {
    // Exact match is highest priority
    if (textNormalized === keyword) {
      return { score: MATCH_SCORES.EXACT_MATCH, positions: [] };
    }

    // Starts with match
    if (textNormalized.startsWith(keyword)) {
      return { score: MATCH_SCORES.STARTS_WITH, positions: [] };
    }

    // Contains match
    if (textNormalized.includes(keyword)) {
      return { score: MATCH_SCORES.CONTAINS, positions: [] };
    }

    // No match
    return { score: 0, positions: [] };
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
   * More recent items get higher bonus (0-1500 points)
   * Linear decay from now to TTL_DAYS (no 24h plateau)
   * TTL is configurable via RECENCY_CONFIG.TTL_DAYS (default: 30 days)
   */
  private calculateRecencyBonus(timestamp: number): number {
    const now = Date.now();
    const age = now - timestamp;

    // Items older than TTL get no bonus
    if (age > TTL_MS) {
      return 0;
    }

    // Linear decay from MAX_RECENCY_BONUS to 0 over TTL period
    // No 24h plateau - decay starts immediately
    const ratio = 1 - age / TTL_MS;
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
   * Cleanup resources
   */
  public cleanup(): void {
    this.cancelPendingSearch();
    this.invalidateCache();
  }
}
