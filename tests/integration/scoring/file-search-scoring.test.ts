/**
 * Integration tests for file search scoring
 * Tests calculateMatchScore from fuzzy-matcher with scoring verification
 */

import { describe, test, expect } from '@jest/globals';
import { calculateMatchScore } from '../../../src/renderer/mentions/fuzzy-matcher';
import { fileSearchTestCases } from '../../fixtures/scoring/file-search-cases';
import type { FileInfo } from '../../../src/types/file-search';

// MAX_MTIME_BONUS constant from fuzzy-matcher
const MAX_MTIME_BONUS = 100;

describe('File Search Scoring', () => {
  describe('CamelCase matches', () => {
    test('camelCase matches score higher than simple contains', () => {
      const testCase = fileSearchTestCases.find(tc =>
        tc.description.includes('Camel case match (MyConfig) should rank higher')
      );
      expect(testCase).toBeDefined();

      const files: FileInfo[] = testCase!.files.map(f => ({
        name: f.path.split('/').pop()!,
        path: f.path,
        isDirectory: false,
        ...(f.lastModified !== undefined ? { mtimeMs: f.lastModified } : {}),
      }));

      const queryLower = testCase!.query.toLowerCase();
      const scored = files.map(file => ({
        path: file.path,
        score: calculateMatchScore(file, queryLower, 0),
      }));

      // Sort by score descending
      scored.sort((a, b) => b.score - a.score);

      // MyConfig.ts should be first (camelCase match)
      expect(scored[0]?.path).toBe('src/MyConfig.ts');
    });

    test('FzfScorer camelCase match preferred', () => {
      const testCase = fileSearchTestCases.find(tc =>
        tc.description.includes('Camel case FzfScorer should rank higher')
      );
      expect(testCase).toBeDefined();

      const files: FileInfo[] = testCase!.files.map(f => ({
        name: f.path.split('/').pop()!,
        path: f.path,
        isDirectory: false,
        ...(f.lastModified !== undefined ? { mtimeMs: f.lastModified } : {}),
      }));

      const queryLower = testCase!.query.toLowerCase();
      const scored = files.map(file => ({
        path: file.path,
        score: calculateMatchScore(file, queryLower, 0),
      }));

      // Sort by score descending
      scored.sort((a, b) => b.score - a.score);

      // FzfScorer.ts should be first
      expect(scored[0]?.path).toBe('src/lib/FzfScorer.ts');
    });
  });

  describe('Mtime bonus', () => {
    test('mtime bonus is capped at MAX_MTIME_BONUS (500)', () => {
      const recentFile: FileInfo = {
        name: 'recent.ts',
        path: '/src/recent.ts',
        isDirectory: false,
        mtimeMs: Date.now() - 1000, // Just now
      };

      const oldFile: FileInfo = {
        name: 'old.ts',
        path: '/src/old.ts',
        isDirectory: false,
        mtimeMs: Date.now() - 60 * 24 * 60 * 60 * 1000, // 60 days ago
      };

      const recentScore = calculateMatchScore(recentFile, 'recent', 0);
      const oldScore = calculateMatchScore(oldFile, 'old', 0);

      // Both are exact matches on name, so base scores are equal
      // Difference should be at most MAX_MTIME_BONUS
      const scoreDiff = recentScore - oldScore;
      expect(scoreDiff).toBeLessThanOrEqual(MAX_MTIME_BONUS);
    });

    test('recently edited files score higher with mtime bonus', () => {
      // Use direct test data instead of fixture
      const recentFile: FileInfo = {
        name: 'config.ts',
        path: '/src/config.ts',
        isDirectory: false,
        mtimeMs: Date.now() - 10 * 60 * 1000, // 10 minutes ago
      };

      const oldFile: FileInfo = {
        name: 'config.ts',
        path: '/src/old-config.ts',
        isDirectory: false,
        mtimeMs: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 days ago
      };

      const recentScore = calculateMatchScore(recentFile, 'config', 0);
      const oldScore = calculateMatchScore(oldFile, 'config', 0);

      // Recent file should have higher score due to mtime bonus
      expect(recentScore).toBeGreaterThan(oldScore);
    });
  });

  describe('Usage frequency bonus', () => {
    test('usage frequency bonus is applied correctly', () => {
      const file: FileInfo = {
        name: 'utils.ts',
        path: '/src/utils.ts',
        isDirectory: false,
      };

      const scoreWithoutBonus = calculateMatchScore(file, 'util', 0);
      const scoreWithBonus = calculateMatchScore(file, 'util', 100);

      expect(scoreWithBonus - scoreWithoutBonus).toBe(100);
    });

    test('frequently used files rank higher', () => {
      const testCase = fileSearchTestCases.find(tc =>
        tc.description.includes('Frequently used files should rank higher')
      );
      expect(testCase).toBeDefined();

      const files: FileInfo[] = testCase!.files.map(f => ({
        name: f.path.split('/').pop()!,
        path: f.path,
        isDirectory: false,
      }));

      const queryLower = testCase!.query.toLowerCase();

      // Apply usage bonus from test case
      const scored = files.map(file => {
        const testFile = testCase!.files.find(f => f.path === file.path);
        const usageBonus = testFile?.usageCount ? testFile.usageCount * 2 : 0;
        return {
          path: file.path,
          score: calculateMatchScore(file, queryLower, usageBonus),
        };
      });

      // Sort by score descending
      scored.sort((a, b) => b.score - a.score);

      // utils.ts should be first (highest usage count)
      expect(scored[0]?.path).toBe('src/utils.ts');
    });
  });

  describe('Path length preference', () => {
    test('shorter paths preferred', () => {
      const testCase = fileSearchTestCases.find(tc =>
        tc.description.includes('Shorter paths should be preferred')
      );
      expect(testCase).toBeDefined();

      const files: FileInfo[] = testCase!.files.map(f => ({
        name: f.path.split('/').pop()!,
        path: f.path,
        isDirectory: false,
      }));

      const queryLower = testCase!.query.toLowerCase();
      const scored = files.map(file => ({
        path: file.path,
        score: calculateMatchScore(file, queryLower, 0),
      }));

      // Sort by score descending
      scored.sort((a, b) => b.score - a.score);

      // Shortest path should be first
      expect(scored[0]?.path).toBe('src/manager.ts');
    });
  });

  describe('Basename priority', () => {
    test('basename matches rank higher than directory matches', () => {
      const testCase = fileSearchTestCases.find(tc =>
        tc.description.includes('Basename matches should rank higher')
      );
      expect(testCase).toBeDefined();

      const files: FileInfo[] = testCase!.files.map(f => ({
        name: f.path.split('/').pop()!,
        path: f.path,
        isDirectory: false,
      }));

      const queryLower = testCase!.query.toLowerCase();
      const scored = files.map(file => ({
        path: file.path,
        score: calculateMatchScore(file, queryLower, 0),
      }));

      // Sort by score descending
      scored.sort((a, b) => b.score - a.score);

      // test.ts should be first (exact basename match)
      expect(scored[0]?.path).toBe('src/test.ts');
    });
  });
});
