/**
 * Fuzzy matching utilities for File Search module
 * Pure functions for file matching and scoring
 */

import type { FileInfo, AgentItem } from '../../types';

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
 * - Exact name match: 1000
 * - Name starts with query: 500
 * - Name contains query: 200
 * - Path contains query: 50
 * - Fuzzy match on name: 10
 * - Bonus for files (not directories): 5
 * - Bonus for shorter paths: up to 20
 */
export function calculateMatchScore(file: FileInfo, queryLower: string): number {
  const nameLower = file.name.toLowerCase();
  const pathLower = file.path.toLowerCase();

  let score = 0;

  // Exact name match
  if (nameLower === queryLower) {
    score += 1000;
  }
  // Name starts with query
  else if (nameLower.startsWith(queryLower)) {
    score += 500;
  }
  // Name contains query
  else if (nameLower.includes(queryLower)) {
    score += 200;
  }
  // Path contains query
  else if (pathLower.includes(queryLower)) {
    score += 50;
  }
  // Fuzzy match on name
  else if (fuzzyMatch(nameLower, queryLower)) {
    score += 10;
  }

  // Bonus for files (not directories)
  if (!file.isDirectory) {
    score += 5;
  }

  // Bonus for shorter paths
  score += Math.max(0, 20 - pathLower.split('/').length);

  return score;
}

/**
 * Calculate match score for an agent
 * Higher score = better match
 *
 * Scoring rules:
 * - No query: 50 (base score)
 * - Exact name match: 1000
 * - Name starts with query: 500
 * - Name contains query: 200
 * - Description contains query: 50
 */
export function calculateAgentMatchScore(agent: AgentItem, queryLower: string): number {
  if (!queryLower) return 50; // Base score for no query

  const nameLower = agent.name.toLowerCase();
  const descLower = agent.description.toLowerCase();

  let score = 0;

  // Exact name match
  if (nameLower === queryLower) {
    score += 1000;
  }
  // Name starts with query
  else if (nameLower.startsWith(queryLower)) {
    score += 500;
  }
  // Name contains query
  else if (nameLower.includes(queryLower)) {
    score += 200;
  }
  // Description contains query
  else if (descLower.includes(queryLower)) {
    score += 50;
  }

  return score;
}
