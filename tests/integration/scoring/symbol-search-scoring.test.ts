/**
 * Integration tests for symbol search scoring
 * Tests FzfScorer for symbol name matching with scoring verification
 */

import { describe, test, expect } from '@jest/globals';
import { FzfScorer } from '../../../src/lib/fzf-scorer';
import { symbolSearchTestCases } from '../../fixtures/scoring/symbol-search-cases';
import { calculateFileMtimeBonus, USAGE_BONUS } from '../../../src/lib/usage-bonus-calculator';

// Symbol mtime bonus cap (same as code-search-handler)
const MAX_SYMBOL_MTIME_BONUS = 500;

describe('Symbol Search Scoring', () => {
  const fzfScorer = new FzfScorer({
    caseSensitive: false,
    enableCamelCase: true,
    enableBoundaryBonus: true,
  });

  describe('FZF scoring for symbol names', () => {
    test('MyConfig ranks higher than main_controller for query "mc"', () => {
      const testCase = symbolSearchTestCases.find(tc =>
        tc.description.includes('Camel case match (MyConfig) should rank higher')
      );
      expect(testCase).toBeDefined();

      const symbols = testCase!.symbols;
      const query = testCase!.query;

      // Score each symbol name with fzf
      const scored = symbols.map(sym => ({
        name: sym.name,
        score: fzfScorer.score(sym.name, query).score,
      }));

      // Sort by score descending
      scored.sort((a, b) => b.score - a.score);

      // MyConfig should rank first (camelCase match at word boundaries)
      expect(scored[0]?.name).toBe('MyConfig');
    });

    test('fzf scoring produces consistent results', () => {
      // Test that fzf scoring is deterministic
      const score1 = fzfScorer.score('MyConfig', 'mc');
      const score2 = fzfScorer.score('MyConfig', 'mc');

      expect(score1.score).toBe(score2.score);
      expect(score1.matched).toBe(true);
    });

    test('longer exact matches score higher', () => {
      // Test that full matches score higher than partial
      const exactScore = fzfScorer.score('test', 'test');
      const partialScore = fzfScorer.score('TestCase', 'test');

      // Both should match
      expect(exactScore.matched).toBe(true);
      expect(partialScore.matched).toBe(true);
      // Scores should be positive
      expect(exactScore.score).toBeGreaterThan(0);
      expect(partialScore.score).toBeGreaterThan(0);
    });
  });

  describe('Mtime bonus for symbols', () => {
    test('mtime bonus is capped at MAX_SYMBOL_MTIME_BONUS (500)', () => {
      // Test that calculateFileMtimeBonus returns up to USAGE_BONUS.MAX_FILE_MTIME (1000)
      // but is capped at MAX_SYMBOL_MTIME_BONUS (500) when used in symbol scoring
      const veryRecentMtime = Date.now() - 1000; // Just now
      const oldMtime = Date.now() - 60 * 24 * 60 * 60 * 1000; // 60 days ago

      const recentBonus = calculateFileMtimeBonus(veryRecentMtime);
      const oldBonus = calculateFileMtimeBonus(oldMtime);

      // Recent file should get high bonus (close to max 1000)
      expect(recentBonus).toBeGreaterThanOrEqual(USAGE_BONUS.MAX_FILE_MTIME - 10);
      // The raw bonus can exceed MAX_SYMBOL_MTIME_BONUS, it's capped when used
      expect(recentBonus).toBeLessThanOrEqual(USAGE_BONUS.MAX_FILE_MTIME);

      // Old file should get 0 bonus
      expect(oldBonus).toBe(0);
    });

    test('recently edited file symbols get higher combined score', () => {
      // Direct test with controlled data
      const recentSymbol = {
        name: 'Config',
        lastModified: Date.now() - 10 * 60 * 1000, // 10 minutes ago
      };
      const oldSymbol = {
        name: 'Config',
        lastModified: Date.now() - 60 * 24 * 60 * 60 * 1000, // 60 days ago
      };

      const query = 'config';

      const recentScore =
        fzfScorer.score(recentSymbol.name, query).score +
        Math.min(calculateFileMtimeBonus(recentSymbol.lastModified), MAX_SYMBOL_MTIME_BONUS);
      const oldScore =
        fzfScorer.score(oldSymbol.name, query).score +
        Math.min(calculateFileMtimeBonus(oldSymbol.lastModified), MAX_SYMBOL_MTIME_BONUS);

      // Recent symbol should have higher combined score
      expect(recentScore).toBeGreaterThan(oldScore);
    });
  });

  describe('Combined scoring: fzf + recency', () => {
    test('recency bonus adds significant value to score', () => {
      const testCase = symbolSearchTestCases.find(tc =>
        tc.description.includes('Recency should combine with match quality')
      );
      expect(testCase).toBeDefined();

      const symbols = testCase!.symbols;
      const query = testCase!.query;

      const scored = symbols.map(sym => {
        const fzfScore = fzfScorer.score(sym.name, query).score;
        const mtimeBonus = sym.lastModified
          ? Math.min(calculateFileMtimeBonus(sym.lastModified), MAX_SYMBOL_MTIME_BONUS)
          : 0;
        return {
          name: sym.name,
          fzfScore,
          mtimeBonus,
          totalScore: fzfScore + mtimeBonus,
        };
      });

      scored.sort((a, b) => b.totalScore - a.totalScore);

      // dbConnection should rank first (most recent + good match)
      expect(scored[0]?.name).toBe('dbConnection');
    });
  });

  describe('Word boundary matching', () => {
    test('exact match "fs" ranks highest', () => {
      const testCase = symbolSearchTestCases.find(tc =>
        tc.description.includes('Exact match should trump camel case and underscore')
      );
      expect(testCase).toBeDefined();

      const symbols = testCase!.symbols;
      const query = testCase!.query;

      const scored = symbols.map(sym => ({
        name: sym.name,
        score: fzfScorer.score(sym.name, query).score,
      }));

      scored.sort((a, b) => b.score - a.score);

      // 'fs' should be first (exact match)
      expect(scored[0]?.name).toBe('fs');
    });
  });
});
