/**
 * Fuzzy matching utilities for File Search module
 * Optimized with caching for repeated string operations
 */

import type { FileInfo, AgentItem } from '../../types';
import { FUZZY_MATCH_SCORES } from '../../constants';
import { calculateFileMtimeBonus } from '../../lib/usage-bonus-calculator';
import { getRelativePath } from './path-utils';
import { splitKeywords } from '../utils/highlight-utils';
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
 * Simple fuzzy matching - checks if pattern appears in text
 */
export function fuzzyMatch(text: string, pattern: string): boolean {
  // Simple substring match (case-insensitive)
  return text.toLowerCase().includes(pattern.toLowerCase());
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
 * @param preSplitKeywords - Optional pre-split keywords to avoid repeated splitting in hot loops
 * @returns Total score including bonuses
 */
export function calculateMatchScore(
  file: FileInfo,
  queryLower: string,
  usageBonus: number = 0,
  baseDir?: string,
  preSplitKeywords?: string[]
): number {
  const nameLower = lowercaseCache.get(file.name);
  const pathLower = lowercaseCache.get(file.path);

  const keywords = preSplitKeywords ?? splitKeywords(queryLower);

  let matchScore = 0;

  if (keywords.length > 0) {
    let totalKwScore = 0;
    for (const kw of keywords) {
      let kwScore = 0;
      if (nameLower === kw) kwScore = FUZZY_MATCH_SCORES.EXACT;
      else if (nameLower.startsWith(kw)) kwScore = FUZZY_MATCH_SCORES.STARTS_WITH;
      else if (nameLower.includes(kw)) kwScore = FUZZY_MATCH_SCORES.CONTAINS;
      else if (pathLower.includes(kw)) kwScore = FUZZY_MATCH_SCORES.PATH_CONTAINS;
      // nameLower.includes(kw) already covers fuzzyMatch's substring check
      // so this branch is unreachable — kept as a no-op safety net

      if (kwScore === 0) return 0; // AND condition: all keywords must match
      totalKwScore += kwScore;
    }
    matchScore = totalKwScore / keywords.length;
  }

  let score = matchScore;

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
  usageBonus: number = 0,
  preSplitKeywords?: string[]
): number {
  if (!queryLower) return FUZZY_MATCH_SCORES.AGENT_BASE; // Base score for no query

  const nameLower = lowercaseCache.get(agent.name);
  const descLower = lowercaseCache.get(agent.description);

  const keywords = preSplitKeywords ?? splitKeywords(queryLower);
  if (keywords.length === 0) return FUZZY_MATCH_SCORES.AGENT_BASE;

  let totalKwScore = 0;
  for (const kw of keywords) {
    let kwScore = 0;
    if (nameLower === kw) kwScore = FUZZY_MATCH_SCORES.EXACT;
    else if (nameLower.startsWith(kw)) kwScore = FUZZY_MATCH_SCORES.STARTS_WITH;
    else if (nameLower.includes(kw)) kwScore = FUZZY_MATCH_SCORES.CONTAINS;
    else if (descLower.includes(kw)) kwScore = FUZZY_MATCH_SCORES.PATH_CONTAINS;
    // nameLower.includes(kw) already covers fuzzyMatch's substring check

    if (kwScore === 0) return 0; // AND condition: all keywords must match
    totalKwScore += kwScore;
  }

  let score = totalKwScore / keywords.length;

  // Add usage history bonus
  score += usageBonus;

  return score;
}
