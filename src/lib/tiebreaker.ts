/**
 * Tiebreaker utility for determining priority when scores are equal.
 * Provides configurable criteria for sorting items with the same score.
 */

/**
 * Tiebreak criteria type.
 * - 'length': Prefer shorter items
 * - 'index': Prefer lower index (original order)
 * - 'pathname': Prefer shallower path depth
 * - 'begin': Prefer line-start matches (reserved for future use)
 */
export type TiebreakCriteria = 'length' | 'index' | 'pathname' | 'begin';

/**
 * Options for tiebreak comparison.
 */
export interface TiebreakOptions {
  /** Criteria to apply in priority order */
  criteria: TiebreakCriteria[];
}

/**
 * Getters for extracting values from items for comparison.
 */
export interface TiebreakGetters<T> {
  /** Get item length (e.g., name length) */
  length?: (item: T) => number;
  /** Get item index (e.g., original array index) */
  index?: (item: T) => number;
  /** Get item pathname for depth comparison */
  pathname?: (item: T) => string;
  /** Get begin offset for line-start matching */
  begin?: (item: T) => number;
}

/**
 * Compare two items using tiebreak criteria.
 * Returns negative if a should come first, positive if b should come first, 0 if equal.
 *
 * @param a - First item to compare
 * @param b - Second item to compare
 * @param options - Tiebreak options with criteria in priority order
 * @param getters - Functions to extract values from items
 * @returns Comparison result: negative (a first), positive (b first), 0 (equal)
 *
 * @example
 * // File search: prefer shorter names, then shallower paths
 * items.sort((a, b) => {
 *   const scoreDiff = b.score - a.score;
 *   if (scoreDiff !== 0) return scoreDiff;
 *   return compareTiebreak(a, b, { criteria: ['length', 'pathname'] }, {
 *     length: (item) => item.name.length,
 *     pathname: (item) => item.path,
 *   });
 * });
 *
 * @example
 * // History search: preserve original order
 * items.sort((a, b) => {
 *   const scoreDiff = b.score - a.score;
 *   if (scoreDiff !== 0) return scoreDiff;
 *   return compareTiebreak(a, b, { criteria: ['index'] }, {
 *     index: (item) => item.originalIndex,
 *   });
 * });
 */
export function compareTiebreak<T>(
  a: T,
  b: T,
  options: TiebreakOptions,
  getters: TiebreakGetters<T>
): number {
  for (const criterion of options.criteria) {
    let diff = 0;

    switch (criterion) {
      case 'length':
        // Prefer shorter items
        diff = (getters.length?.(a) ?? 0) - (getters.length?.(b) ?? 0);
        break;

      case 'index':
        // Prefer lower index (original order)
        diff = (getters.index?.(a) ?? 0) - (getters.index?.(b) ?? 0);
        break;

      case 'pathname': {
        // Prefer shallower path depth
        const aPath = getters.pathname?.(a) ?? '';
        const bPath = getters.pathname?.(b) ?? '';
        diff = aPath.split('/').length - bPath.split('/').length;
        break;
      }

      case 'begin':
        // Prefer earlier begin offset (line-start matches)
        diff = (getters.begin?.(a) ?? 0) - (getters.begin?.(b) ?? 0);
        break;
    }

    if (diff !== 0) return diff;
  }

  return 0;
}
