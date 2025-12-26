/**
 * Fuzzy matching utilities for File Search module
 * Pure functions for file matching and scoring
 */

import type { FileInfo, AgentItem } from '../../types';
import { FUZZY_MATCH_SCORES } from '../../constants';

/**
 * Simple fuzzy matching - checks if all pattern characters appear in text in order
 */
export function fuzzyMatch(text: string, pattern: string): boolean {
  let patternIdx = 0;

  for (let i = 0; i < text.length && patternIdx < pattern.length; i++) {
    if (text[i] === pattern[patternIdx]) {
      patternIdx++;
    }
  }

  return patternIdx === pattern.length;
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
 */
export function calculateMatchScore(file: FileInfo, queryLower: string): number {
  const nameLower = file.name.toLowerCase();
  const pathLower = file.path.toLowerCase();

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
  // Fuzzy match on name
  else if (fuzzyMatch(nameLower, queryLower)) {
    score += FUZZY_MATCH_SCORES.BASE_FUZZY;
  }

  // Bonus for files (not directories)
  if (!file.isDirectory) {
    score += FUZZY_MATCH_SCORES.FILE_BONUS;
  }

  // Bonus for shorter paths
  score += Math.max(0, FUZZY_MATCH_SCORES.MAX_PATH_BONUS - pathLower.split('/').length);

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
 */
export function calculateAgentMatchScore(agent: AgentItem, queryLower: string): number {
  if (!queryLower) return FUZZY_MATCH_SCORES.AGENT_BASE; // Base score for no query

  const nameLower = agent.name.toLowerCase();
  const descLower = agent.description.toLowerCase();

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

  return score;
}
