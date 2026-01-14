/**
 * FZF-like scoring engine for fuzzy string matching.
 * Implements scoring algorithms similar to fzf for high-quality fuzzy matching.
 */

/**
 * FZF scoring constants (fzf-compatible values)
 */
export const FZF_SCORES = {
  // Basic match scores
  CHAR_MATCH: 16, // Each character match
  GAP_START: -3, // Gap start penalty
  GAP_EXTENSION: -1, // Gap extension penalty

  // Bonuses
  BOUNDARY: 8, // Word boundary
  BOUNDARY_WHITE: 10, // After whitespace
  BOUNDARY_DELIMITER: 9, // After delimiter (/,:,;,|,-,_)
  CAMEL_CASE: 7, // CamelCase transition
  CONSECUTIVE: 4, // Consecutive match
  FIRST_CHAR_MULTIPLIER: 2, // First character multiplier
} as const;

/**
 * Result of fzf matching operation
 */
export interface FzfMatchResult {
  /** Whether the pattern matched the text */
  matched: boolean;
  /** Computed match score */
  score: number;
  /** Positions of matched characters (for highlighting) */
  positions: number[];
  /** Count of consecutive character matches */
  consecutiveCount: number;
}

/**
 * Options for FzfScorer configuration
 */
export interface FzfScorerOptions {
  /** Enable case-sensitive matching (default: false) */
  caseSensitive?: boolean;
  /** Enable CamelCase bonus detection (default: true) */
  enableCamelCase?: boolean;
  /** Enable boundary bonus detection (default: true) */
  enableBoundaryBonus?: boolean;
}

/**
 * Character classification for boundary detection
 */
enum CharClass {
  WHITE, // Whitespace
  DELIMITER, // /,:,;,|,-,_
  LOWER, // Lowercase letter
  UPPER, // Uppercase letter
  DIGIT, // Digit
  OTHER, // Other characters
}

// Delimiter characters set for fast lookup
const DELIMITERS = new Set(['/', ':', ',', ';', '|', '-', '_']);

/**
 * FZF-like scoring engine for fuzzy string matching.
 *
 * @example
 * ```typescript
 * const scorer = new FzfScorer();
 * const result = scorer.score('MyClassName', 'mcn');
 * console.log(result.score); // High score due to CamelCase matching
 * ```
 */
export class FzfScorer {
  private readonly caseSensitive: boolean;
  private readonly enableCamelCase: boolean;
  private readonly enableBoundaryBonus: boolean;

  /**
   * Create a new FzfScorer instance.
   *
   * @param options - Scorer configuration options
   */
  constructor(options?: FzfScorerOptions) {
    this.caseSensitive = options?.caseSensitive ?? false;
    this.enableCamelCase = options?.enableCamelCase ?? true;
    this.enableBoundaryBonus = options?.enableBoundaryBonus ?? true;
  }

  /**
   * Calculate fzf-style match score for pattern against text.
   *
   * @param text - The text to search in
   * @param pattern - The pattern to search for
   * @returns Match result with score and positions
   */
  score(text: string, pattern: string): FzfMatchResult {
    // Handle empty cases
    if (!pattern) {
      return { matched: true, score: 0, positions: [], consecutiveCount: 0 };
    }
    if (!text) {
      return { matched: false, score: 0, positions: [], consecutiveCount: 0 };
    }

    // Normalize case if case-insensitive
    const searchText = this.caseSensitive ? text : text.toLowerCase();
    const searchPattern = this.caseSensitive ? pattern : pattern.toLowerCase();

    // Find all match positions using greedy forward matching
    const positions: number[] = [];
    let patternIdx = 0;

    for (let textIdx = 0; textIdx < searchText.length && patternIdx < searchPattern.length; textIdx++) {
      if (searchText[textIdx] === searchPattern[patternIdx]) {
        positions.push(textIdx);
        patternIdx++;
      }
    }

    // Check if full pattern matched
    if (patternIdx !== searchPattern.length) {
      return { matched: false, score: 0, positions: [], consecutiveCount: 0 };
    }

    // Calculate score
    let totalScore = 0;
    let totalConsecutive = 0;
    let prevMatchPos = -2; // Initialize to impossible position

    for (let i = 0; i < positions.length; i++) {
      const pos = positions[i]!; // Safe: i is always within array bounds
      const isFirstChar = i === 0;

      // Base character match score
      totalScore += FZF_SCORES.CHAR_MATCH;

      // Gap penalty calculation
      if (i > 0) {
        const gap = pos - prevMatchPos - 1;
        if (gap > 0) {
          // Gap exists - apply penalty
          totalScore += FZF_SCORES.GAP_START;
          totalScore += FZF_SCORES.GAP_EXTENSION * (gap - 1);
        } else {
          // Consecutive match
          totalConsecutive++;
          totalScore += FZF_SCORES.CONSECUTIVE;
        }
      }

      // Position bonus calculation
      if (this.enableBoundaryBonus || this.enableCamelCase) {
        const prevChar = pos > 0 ? text[pos - 1]! : ''; // Safe: pos > 0 check guarantees valid index
        const prevClass = pos > 0 ? this.getCharClass(prevChar) : CharClass.WHITE;
        const bonus = this.calculatePositionBonus(text, pos, prevClass, isFirstChar);
        totalScore += bonus;
      }

      prevMatchPos = pos;
    }

    return {
      matched: true,
      score: totalScore,
      positions,
      consecutiveCount: totalConsecutive,
    };
  }

  /**
   * Classify a character for boundary detection.
   *
   * @param char - Single character to classify
   * @returns Character class
   */
  private getCharClass(char: string): CharClass {
    if (!char) return CharClass.OTHER;

    // Whitespace check
    if (char === ' ' || char === '\t' || char === '\n' || char === '\r') {
      return CharClass.WHITE;
    }

    // Delimiter check
    if (DELIMITERS.has(char)) {
      return CharClass.DELIMITER;
    }

    // Letter case check
    const code = char.charCodeAt(0);

    // Uppercase A-Z
    if (code >= 65 && code <= 90) {
      return CharClass.UPPER;
    }

    // Lowercase a-z
    if (code >= 97 && code <= 122) {
      return CharClass.LOWER;
    }

    // Digit 0-9
    if (code >= 48 && code <= 57) {
      return CharClass.DIGIT;
    }

    return CharClass.OTHER;
  }

  /**
   * Calculate position-specific bonus for a matched character.
   *
   * @param text - Original text
   * @param position - Position of matched character
   * @param prevClass - Character class of previous character
   * @param isFirstChar - Whether this is the first pattern character
   * @returns Bonus score for this position
   */
  private calculatePositionBonus(
    text: string,
    position: number,
    prevClass: CharClass,
    isFirstChar: boolean
  ): number {
    const currChar = text[position] ?? ''; // Safe: position is always valid from caller
    const currClass = this.getCharClass(currChar);
    let bonus = 0;

    // Word boundary bonuses
    if (this.enableBoundaryBonus) {
      if (prevClass === CharClass.WHITE) {
        bonus = FZF_SCORES.BOUNDARY_WHITE;
      } else if (prevClass === CharClass.DELIMITER) {
        bonus = FZF_SCORES.BOUNDARY_DELIMITER;
      } else if (prevClass !== currClass && currClass !== CharClass.OTHER) {
        // Generic boundary between different character classes
        if (
          !(prevClass === CharClass.LOWER && currClass === CharClass.UPPER) &&
          !(prevClass !== CharClass.DIGIT && currClass === CharClass.DIGIT)
        ) {
          bonus = FZF_SCORES.BOUNDARY;
        }
      }
    }

    // CamelCase transition bonus
    if (this.enableCamelCase && bonus === 0) {
      if (
        (prevClass === CharClass.LOWER && currClass === CharClass.UPPER) ||
        (prevClass !== CharClass.DIGIT && currClass === CharClass.DIGIT)
      ) {
        bonus = FZF_SCORES.CAMEL_CASE;
      }
    }

    // First character multiplier
    if (isFirstChar && bonus > 0) {
      bonus *= FZF_SCORES.FIRST_CHAR_MULTIPLIER;
    }

    return bonus;
  }
}
