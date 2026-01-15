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
 * Cache for lowercase strings to avoid repeated toLowerCase() calls
 */
class LowercaseCache {
  private cache: Map<string, string> = new Map();

  /**
   * Get lowercase version of string (cached)
   */
  get(str: string): string {
    const cached = this.cache.get(str);
    if (cached !== undefined) return cached;

    const lower = str.toLowerCase();
    this.cache.set(str, lower);
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
 * Calculate match score for a file
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
  const pathLower = lowercaseCache.get(file.path);

  let score = 0;

  // Exact name match
  if (nameLower === queryLower) {
    score += FUZZY_MATCH_SCORES.EXACT;
  }
  // Name starts with query
  else if (nameLower.startsWith(queryLower)) {
    score += FUZZY_MATCH_SCORES.STARTS_WITH;
  }
  // Name contains query
  else if (nameLower.includes(queryLower)) {
    score += FUZZY_MATCH_SCORES.CONTAINS;
  }
  // Path contains query
  else if (pathLower.includes(queryLower)) {
    score += FUZZY_MATCH_SCORES.PATH_CONTAINS;
  }
  // Fuzzy match on name using FzfScorer
  // Pass original file.name to preserve CamelCase detection for position bonuses
  else {
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
      score += scaledFzfScore;
    }
  }

  // Bonus for files (not directories)
  if (!file.isDirectory) {
    score += FUZZY_MATCH_SCORES.FILE_BONUS;
  }

  // Bonus for shorter paths (calculated from relative path when baseDir is provided)
  const pathForBonus = baseDir ? getRelativePath(file.path, baseDir) : file.path;
  score += Math.max(0, FUZZY_MATCH_SCORES.MAX_PATH_BONUS - pathForBonus.split('/').length);

  // Add usage history bonus
  score += usageBonus;

  // Add file modification time bonus if mtimeMs is available
  if (file.mtimeMs !== undefined) {
    score += Math.min(calculateFileMtimeBonus(file.mtimeMs), MAX_MTIME_BONUS);
  }

  return score;
}

/**
 * Calculate match score for an agent
 * Higher score = better match
 *
 * Scoring rules:
 * - No query: FUZZY_MATCH_SCORES.AGENT_BASE (50)
 * - Exact name match: FUZZY_MATCH_SCORES.EXACT (1000)
 * - Name starts with query: FUZZY_MATCH_SCORES.STARTS_WITH (500)
 * - Name contains query: FUZZY_MATCH_SCORES.CONTAINS (200)
 * - Description contains query: FUZZY_MATCH_SCORES.PATH_CONTAINS (50)
 * - Fuzzy match on name: FUZZY_MATCH_SCORES.BASE_FUZZY (10)
 */
export function calculateAgentMatchScore(
  agent: AgentItem,
  queryLower: string,
  usageBonus: number = 0
): number {
  if (!queryLower) return FUZZY_MATCH_SCORES.AGENT_BASE; // Base score for no query

  const nameLower = lowercaseCache.get(agent.name);
  const descLower = lowercaseCache.get(agent.description);

  let score = 0;

  // Exact name match
  if (nameLower === queryLower) {
    score += FUZZY_MATCH_SCORES.EXACT;
  }
  // Name starts with query
  else if (nameLower.startsWith(queryLower)) {
    score += FUZZY_MATCH_SCORES.STARTS_WITH;
  }
  // Name contains query
  else if (nameLower.includes(queryLower)) {
    score += FUZZY_MATCH_SCORES.CONTAINS;
  }
  // Description contains query
  else if (descLower.includes(queryLower)) {
    score += FUZZY_MATCH_SCORES.PATH_CONTAINS;
  }
  // Fuzzy match on name using FzfScorer
  // Pass original agent.name to preserve CamelCase detection for position bonuses
  else {
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
      score += scaledFzfScore;
    }
  }

  // Add usage history bonus
  score += usageBonus;

  return score;
}
