/**
 * Fuzzy matching utilities for File Search module
 * Optimized with caching for repeated string operations
 * Uses FzfScorer for improved fuzzy matching accuracy
 */

import type { FileInfo, AgentItem } from '../../types';
import { FUZZY_MATCH_SCORES } from '../../constants';
import { calculateFileMtimeBonus } from '../../lib/usage-bonus-calculator';
import { FzfScorer } from '../../lib/fzf-scorer';
import { getRelativePath } from './path-utils';
export { compareTiebreak } from '../../lib/tiebreaker';

/** Maximum mtime bonus - caps the mtime bonus to balance with match scores */
const MAX_MTIME_BONUS = 100;

/**
 * LRU Cache for lowercase strings to avoid repeated toLowerCase() calls
 * Implements Least Recently Used eviction policy with a fixed maximum size
 */
class LowercaseCache {
  private cache: Map<string, string> = new Map();
  private readonly MAX_SIZE = 2000;

  /**
   * Get lowercase version of string (cached with LRU behavior)
   * When a cached entry is accessed, it's moved to the end of the Map
   * to mark it as recently used
   */
  get(str: string): string {
    if (this.cache.has(str)) {
      // Map maintains insertion order, so delete and re-insert
      // to move this entry to the end (most recently used)
      const value = this.cache.get(str)!;
      this.cache.delete(str);
      this.cache.set(str, value);
      return value;
    }

    const lower = str.toLowerCase();
    this.cache.set(str, lower);

    // Evict oldest entry when size exceeds MAX_SIZE
    if (this.cache.size > this.MAX_SIZE) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    return lower;
  }

  /**
   * Clear cache to free memory
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache size for monitoring
   */
  size(): number {
    return this.cache.size;
  }
}

// Global lowercase cache instance
const lowercaseCache = new LowercaseCache();

// Global FzfScorer instance for improved fuzzy matching
const fzfScorer = new FzfScorer({
  caseSensitive: false,
  enableCamelCase: true,
  enableBoundaryBonus: true,
});

/**
 * Clear the lowercase cache
 * Call this when directory data changes or periodically to free memory
 */
export function clearLowercaseCache(): void {
  lowercaseCache.clear();
}

/**
 * Get cache statistics for debugging/monitoring
 */
export function getLowercaseCacheSize(): number {
  return lowercaseCache.size();
}

/**
 * Simple fuzzy matching - checks if all pattern characters appear in text in order
 * Uses FzfScorer for improved matching accuracy
 */
export function fuzzyMatch(text: string, pattern: string): boolean {
  const result = fzfScorer.score(text, pattern);
  return result.matched;
}

/**
 * Calculate additional bonuses for file scoring
 * Extracted for DRY principle and better maintainability
 *
 * @param file - File to calculate bonuses for
 * @param usageBonus - Usage history bonus
 * @param baseDir - Optional base directory for relative path calculation
 * @returns Total bonus score
 */
function calculateBonuses(file: FileInfo, usageBonus: number, baseDir?: string): number {
  let bonus = 0;

  // Bonus for files (not directories)
  if (!file.isDirectory) {
    bonus += FUZZY_MATCH_SCORES.FILE_BONUS;
  }

  // Bonus for shorter paths (calculated from relative path when baseDir is provided)
  const pathForBonus = baseDir ? getRelativePath(file.path, baseDir) : file.path;
  bonus += Math.max(0, FUZZY_MATCH_SCORES.MAX_PATH_BONUS - pathForBonus.split('/').length);

  // Add usage history bonus
  bonus += usageBonus;

  // Add file modification time bonus if mtimeMs is available
  if (file.mtimeMs !== undefined) {
    bonus += Math.min(calculateFileMtimeBonus(file.mtimeMs), MAX_MTIME_BONUS);
  }

  return bonus;
}

/**
 * Calculate match score for a file with staged matching
 * Higher score = better match
 *
 * Scoring rules:
 * - Exact name match: FUZZY_MATCH_SCORES.EXACT (1000)
 * - Name starts with query: FUZZY_MATCH_SCORES.STARTS_WITH (500)
 * - Name contains query: FUZZY_MATCH_SCORES.CONTAINS (200)
 * - Path contains query: FUZZY_MATCH_SCORES.PATH_CONTAINS (50)
 * - Fuzzy match on name: FUZZY_MATCH_SCORES.BASE_FUZZY (10)
 * - Bonus for files (not directories): FUZZY_MATCH_SCORES.FILE_BONUS (5)
 * - Bonus for shorter paths: up to FUZZY_MATCH_SCORES.MAX_PATH_BONUS (20)
 *   - When baseDir is provided, path bonus is calculated from relative path
 * - Usage history bonus: 0-150 (optional parameter)
 * - File modification time bonus: 0-500 (if mtimeMs available)
 *
 * Performance optimization: Uses staged matching with early returns to avoid expensive FzfScorer calls
 * - Stage 1: Exact match (O(1)) - immediate return
 * - Stage 2: Prefix match (O(query)) - immediate return
 * - Stage 3: Contains match (O(name)) - immediate return
 * - Stage 4: Path contains (O(path)) - immediate return
 * - Stage 5: Fuzzy match (expensive) - last resort
 *
 * @param file - File to score
 * @param queryLower - Lowercased search query
 * @param usageBonus - Optional usage history bonus (0-150)
 * @param baseDir - Optional base directory for relative path calculation
 * @returns Total score including bonuses
 */
export function calculateMatchScore(
  file: FileInfo,
  queryLower: string,
  usageBonus: number = 0,
  baseDir?: string
): number {
  const nameLower = lowercaseCache.get(file.name);

  // Stage 1: Exact name match (O(1)) - immediate return
  if (nameLower === queryLower) {
    return FUZZY_MATCH_SCORES.EXACT + calculateBonuses(file, usageBonus, baseDir);
  }

  // Stage 2: Name starts with query (O(query)) - immediate return
  if (nameLower.startsWith(queryLower)) {
    return FUZZY_MATCH_SCORES.STARTS_WITH + calculateBonuses(file, usageBonus, baseDir);
  }

  // Stage 3: Name contains query (O(name)) - immediate return
  if (nameLower.includes(queryLower)) {
    return FUZZY_MATCH_SCORES.CONTAINS + calculateBonuses(file, usageBonus, baseDir);
  }

  // Stage 4: Path contains query (O(path)) - immediate return
  const pathLower = lowercaseCache.get(file.path);
  if (pathLower.includes(queryLower)) {
    return FUZZY_MATCH_SCORES.PATH_CONTAINS + calculateBonuses(file, usageBonus, baseDir);
  }

  // Stage 5: Fuzzy match on name using FzfScorer (expensive) - last resort
  // Pass original file.name to preserve CamelCase detection for position bonuses
  const fzfResult = fzfScorer.score(file.name, queryLower);
  if (fzfResult.matched) {
    // Scale FZF score to fit within score hierarchy
    // FZF scores typically range ~20-150
    // Scale to 10-100 range (under CONTAINS=200, above PATH_CONTAINS=50 for good matches)
    const scaledFzfScore = Math.min(
      FUZZY_MATCH_SCORES.MAX_FUZZY_BONUS,
      Math.max(
        FUZZY_MATCH_SCORES.BASE_FUZZY,
        Math.floor(fzfResult.score * FUZZY_MATCH_SCORES.FZF_SCALE_FACTOR)
      )
    );
    return scaledFzfScore + calculateBonuses(file, usageBonus, baseDir);
  }

  // No match found
  return 0;
}

/**
 * Calculate match score for an agent with staged matching
 * Higher score = better match
 *
 * Scoring rules:
 * - No query: FUZZY_MATCH_SCORES.AGENT_BASE (50)
 * - Exact name match: FUZZY_MATCH_SCORES.EXACT (1000)
 * - Name starts with query: FUZZY_MATCH_SCORES.STARTS_WITH (500)
 * - Name contains query: FUZZY_MATCH_SCORES.CONTAINS (200)
 * - Description contains query: FUZZY_MATCH_SCORES.PATH_CONTAINS (50)
 * - Fuzzy match on name: FUZZY_MATCH_SCORES.BASE_FUZZY (10)
 *
 * Performance optimization: Uses staged matching with early returns to avoid expensive FzfScorer calls
 * - Stage 1: Exact match (O(1)) - immediate return
 * - Stage 2: Prefix match (O(query)) - immediate return
 * - Stage 3: Contains match (O(name)) - immediate return
 * - Stage 4: Description contains (O(description)) - immediate return
 * - Stage 5: Fuzzy match (expensive) - last resort
 */
export function calculateAgentMatchScore(
  agent: AgentItem,
  queryLower: string,
  usageBonus: number = 0
): number {
  // Base score for no query (no usage bonus applied)
  if (!queryLower) return FUZZY_MATCH_SCORES.AGENT_BASE;

  const nameLower = lowercaseCache.get(agent.name);

  // Stage 1: Exact name match (O(1)) - immediate return
  if (nameLower === queryLower) {
    return FUZZY_MATCH_SCORES.EXACT + usageBonus;
  }

  // Stage 2: Name starts with query (O(query)) - immediate return
  if (nameLower.startsWith(queryLower)) {
    return FUZZY_MATCH_SCORES.STARTS_WITH + usageBonus;
  }

  // Stage 3: Name contains query (O(name)) - immediate return
  if (nameLower.includes(queryLower)) {
    return FUZZY_MATCH_SCORES.CONTAINS + usageBonus;
  }

  // Stage 4: Description contains query (O(description)) - immediate return
  const descLower = lowercaseCache.get(agent.description);
  if (descLower.includes(queryLower)) {
    return FUZZY_MATCH_SCORES.PATH_CONTAINS + usageBonus;
  }

  // Stage 5: Fuzzy match on name using FzfScorer (expensive) - last resort
  // Pass original agent.name to preserve CamelCase detection for position bonuses
  const fzfResult = fzfScorer.score(agent.name, queryLower);
  if (fzfResult.matched) {
    // Scale FZF score to fit within score hierarchy
    // FZF scores typically range ~20-150
    // Scale to 10-100 range (under CONTAINS=200, above PATH_CONTAINS=50 for good matches)
    const scaledFzfScore = Math.min(
      FUZZY_MATCH_SCORES.MAX_FUZZY_BONUS,
      Math.max(
        FUZZY_MATCH_SCORES.BASE_FUZZY,
        Math.floor(fzfResult.score * FUZZY_MATCH_SCORES.FZF_SCALE_FACTOR)
      )
    );
    return scaledFzfScore + usageBonus;
  }

  // No match found
  return usageBonus;
}
