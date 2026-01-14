import { describe, test, expect } from '@jest/globals';
import { normalizeFzfScore, MIN_FZF, MAX_FZF } from '../../src/lib/fzf-normalizer';

describe('fzf-normalizer', () => {
  describe('Constants', () => {
    test('should have correct MIN_FZF value', () => {
      expect(MIN_FZF).toBe(40);
    });

    test('should have correct MAX_FZF value', () => {
      expect(MAX_FZF).toBe(150);
    });
  });

  describe('normalizeFzfScore - Below MIN_FZF', () => {
    test('should return 0 for score at MIN_FZF (40)', () => {
      const result = normalizeFzfScore(40, 500);
      expect(result).toBe(0);
    });

    test('should return 0 for score below MIN_FZF (39)', () => {
      const result = normalizeFzfScore(39, 500);
      expect(result).toBe(0);
    });

    test('should return 0 for score = 0', () => {
      const result = normalizeFzfScore(0, 500);
      expect(result).toBe(0);
    });

    test('should return 0 for negative score', () => {
      const result = normalizeFzfScore(-10, 500);
      expect(result).toBe(0);
    });

    test('should return 0 for score = 1', () => {
      const result = normalizeFzfScore(1, 500);
      expect(result).toBe(0);
    });
  });

  describe('normalizeFzfScore - At or Above MAX_FZF', () => {
    test('should return maxNormalizedScore for score at MAX_FZF (150)', () => {
      const result = normalizeFzfScore(150, 500);
      expect(result).toBe(500);
    });

    test('should return maxNormalizedScore for score above MAX_FZF (151)', () => {
      const result = normalizeFzfScore(151, 500);
      expect(result).toBe(500);
    });

    test('should return maxNormalizedScore for score = 200', () => {
      const result = normalizeFzfScore(200, 500);
      expect(result).toBe(500);
    });

    test('should return maxNormalizedScore for score = 1000', () => {
      const result = normalizeFzfScore(1000, 500);
      expect(result).toBe(500);
    });
  });

  describe('normalizeFzfScore - Linear Interpolation', () => {
    test('should return half of maxNormalizedScore for midpoint score (95)', () => {
      // Midpoint between MIN_FZF (40) and MAX_FZF (150) is 95
      // (95 - 40) / (150 - 40) = 55 / 110 = 0.5
      const result = normalizeFzfScore(95, 500);
      expect(result).toBe(250);
    });

    test('should return quarter of maxNormalizedScore for score = 67.5', () => {
      // 25% point: 40 + (150 - 40) * 0.25 = 40 + 27.5 = 67.5
      // (67.5 - 40) / 110 = 0.25
      const result = normalizeFzfScore(67.5, 500);
      expect(result).toBe(125);
    });

    test('should return three-quarters of maxNormalizedScore for score = 122.5', () => {
      // 75% point: 40 + (150 - 40) * 0.75 = 40 + 82.5 = 122.5
      // (122.5 - 40) / 110 = 0.75
      const result = normalizeFzfScore(122.5, 500);
      expect(result).toBe(375);
    });

    test('should return approximately 10% of maxNormalizedScore for score = 51', () => {
      // (51 - 40) / 110 = 11 / 110 = 0.1
      const result = normalizeFzfScore(51, 500);
      expect(result).toBe(50);
    });

    test('should return approximately 90% of maxNormalizedScore for score = 139', () => {
      // (139 - 40) / 110 = 99 / 110 = 0.9
      const result = normalizeFzfScore(139, 500);
      expect(result).toBe(450);
    });

    test('should handle score just above MIN_FZF (41)', () => {
      // (41 - 40) / 110 = 1 / 110 ≈ 0.00909
      // 0.00909 * 500 ≈ 4.545
      const result = normalizeFzfScore(41, 500);
      expect(result).toBeCloseTo(4.545, 2);
    });

    test('should handle score just below MAX_FZF (149)', () => {
      // (149 - 40) / 110 = 109 / 110 ≈ 0.99090
      // 0.99090 * 500 ≈ 495.454
      const result = normalizeFzfScore(149, 500);
      expect(result).toBeCloseTo(495.454, 2);
    });
  });

  describe('normalizeFzfScore - Default maxNormalizedScore (500)', () => {
    test('should use default maxNormalizedScore of 500 for midpoint', () => {
      const result = normalizeFzfScore(95, 500);
      expect(result).toBe(250);
    });

    test('should use default maxNormalizedScore of 500 for MAX_FZF', () => {
      const result = normalizeFzfScore(150, 500);
      expect(result).toBe(500);
    });

    test('should use default maxNormalizedScore of 500 for MIN_FZF', () => {
      const result = normalizeFzfScore(40, 500);
      expect(result).toBe(0);
    });
  });

  describe('normalizeFzfScore - Custom maxNormalizedScore Values', () => {
    test('should work with maxNormalizedScore = 100', () => {
      expect(normalizeFzfScore(40, 100)).toBe(0);
      expect(normalizeFzfScore(95, 100)).toBe(50);
      expect(normalizeFzfScore(150, 100)).toBe(100);
    });

    test('should work with maxNormalizedScore = 250', () => {
      expect(normalizeFzfScore(40, 250)).toBe(0);
      expect(normalizeFzfScore(95, 250)).toBe(125);
      expect(normalizeFzfScore(150, 250)).toBe(250);
    });

    test('should work with maxNormalizedScore = 300', () => {
      expect(normalizeFzfScore(40, 300)).toBe(0);
      expect(normalizeFzfScore(95, 300)).toBe(150);
      expect(normalizeFzfScore(150, 300)).toBe(300);
    });

    test('should work with maxNormalizedScore = 1000', () => {
      expect(normalizeFzfScore(40, 1000)).toBe(0);
      expect(normalizeFzfScore(95, 1000)).toBe(500);
      expect(normalizeFzfScore(150, 1000)).toBe(1000);
    });

    test('should work with maxNormalizedScore = 10', () => {
      expect(normalizeFzfScore(40, 10)).toBe(0);
      expect(normalizeFzfScore(95, 10)).toBe(5);
      expect(normalizeFzfScore(150, 10)).toBe(10);
    });
  });

  describe('normalizeFzfScore - Edge Cases', () => {
    test('should handle fractional scores between MIN and MAX', () => {
      const result = normalizeFzfScore(95.5, 500);
      // (95.5 - 40) / 110 = 55.5 / 110 ≈ 0.50454
      // 0.50454 * 500 ≈ 252.27
      expect(result).toBeCloseTo(252.27, 2);
    });

    test('should handle very small maxNormalizedScore (1)', () => {
      expect(normalizeFzfScore(40, 1)).toBe(0);
      expect(normalizeFzfScore(95, 1)).toBe(0.5);
      expect(normalizeFzfScore(150, 1)).toBe(1);
    });

    test('should handle maxNormalizedScore = 0', () => {
      expect(normalizeFzfScore(40, 0)).toBe(0);
      expect(normalizeFzfScore(95, 0)).toBe(0);
      expect(normalizeFzfScore(150, 0)).toBe(0);
    });

    test('should handle negative maxNormalizedScore', () => {
      // Edge case: negative max should still interpolate
      expect(normalizeFzfScore(40, -100)).toBe(0);
      expect(normalizeFzfScore(95, -100)).toBe(-50);
      expect(normalizeFzfScore(150, -100)).toBe(-100);
    });
  });

  describe('normalizeFzfScore - Monotonic Behavior', () => {
    test('should increase monotonically as rawScore increases', () => {
      const maxScore = 500;
      const scores = [41, 60, 80, 100, 120, 140, 149];
      const results = scores.map(score => normalizeFzfScore(score, maxScore));

      for (let i = 1; i < results.length; i++) {
        expect(results[i]).toBeGreaterThan(results[i - 1] as number);
      }
    });

    test('should scale proportionally with maxNormalizedScore', () => {
      const rawScore = 95;
      const result100 = normalizeFzfScore(rawScore, 100);
      const result200 = normalizeFzfScore(rawScore, 200);
      const result500 = normalizeFzfScore(rawScore, 500);

      // All should be at 50% of their respective maxes
      expect(result100).toBe(50);
      expect(result200).toBe(100);
      expect(result500).toBe(250);
      expect(result200).toBe(result100 * 2);
      expect(result500).toBe(result100 * 5);
    });
  });

  describe('normalizeFzfScore - Real-world Scenarios', () => {
    test('should normalize typical fzf scores to 500 scale', () => {
      const scenarios = [
        { raw: 45, expected: 22.727 },  // Weak match
        { raw: 70, expected: 136.363 }, // Fair match
        { raw: 100, expected: 272.727 }, // Good match
        { raw: 130, expected: 409.090 }, // Strong match
      ];

      scenarios.forEach(({ raw, expected }) => {
        const result = normalizeFzfScore(raw, 500);
        expect(result).toBeCloseTo(expected, 2);
      });
    });

    test('should handle boundary values consistently', () => {
      expect(normalizeFzfScore(MIN_FZF - 1, 500)).toBe(0);
      expect(normalizeFzfScore(MIN_FZF, 500)).toBe(0);
      expect(normalizeFzfScore(MIN_FZF + 1, 500)).toBeGreaterThan(0);

      expect(normalizeFzfScore(MAX_FZF - 1, 500)).toBeLessThan(500);
      expect(normalizeFzfScore(MAX_FZF, 500)).toBe(500);
      expect(normalizeFzfScore(MAX_FZF + 1, 500)).toBe(500);
    });
  });
});
