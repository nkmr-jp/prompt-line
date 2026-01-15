/**
 * FZF score normalization utilities.
 * Normalizes raw fzf scores to a configurable range for consistent score comparison.
 *
 * @see fzf-scorer.ts for the scoring implementation and fzf license attribution
 */

/**
 * Minimum fzf raw score threshold (scores below this are treated as 0)
 */
export const MIN_FZF = 40;

/**
 * Maximum fzf raw score threshold (scores above this get max normalized score)
 */
export const MAX_FZF = 150;

/**
 * Normalize a raw fzf score to a specified maximum score.
 * Performs linear interpolation between MIN_FZF and MAX_FZF.
 *
 * @param rawScore - Raw fzf score to normalize
 * @param maxNormalizedScore - Maximum score to normalize to
 * @returns Normalized score in range [0, maxNormalizedScore]
 *
 * @example
 * ```typescript
 * // Normalize to 100-point scale
 * normalizeFzfScore(40, 100);  // Returns 0
 * normalizeFzfScore(95, 100);  // Returns 50
 * normalizeFzfScore(150, 100); // Returns 100
 * ```
 */
export function normalizeFzfScore(rawScore: number, maxNormalizedScore: number): number {
  // Scores at or below minimum threshold get 0
  if (rawScore <= MIN_FZF) {
    return 0;
  }

  // Scores at or above maximum threshold get max normalized score
  if (rawScore >= MAX_FZF) {
    return maxNormalizedScore;
  }

  // Linear interpolation between MIN_FZF and MAX_FZF
  const range = MAX_FZF - MIN_FZF;
  const normalizedRatio = (rawScore - MIN_FZF) / range;
  return normalizedRatio * maxNormalizedScore;
}
