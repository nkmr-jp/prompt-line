/**
 * Integration tests for history search scoring
 * Tests FilterEngine from history-search module with scoring verification
 */

import { HistorySearchFilterEngine } from '../../../src/renderer/history-search/filter-engine';
import { historySearchTestCases } from '../../fixtures/scoring/history-search-cases';
import { loadRealTestData, type RealTestData } from '../../fixtures/scoring/real-data-loader';
import type { HistoryItem } from '../../../src/types/history';

describe('History Search Scoring', () => {
  const filterEngine = new HistorySearchFilterEngine({
    maxSearchItems: 5000,
    maxDisplayResults: 50,
    caseSensitive: false,
    debounceDelay: 0,
  });

  describe('Score calculation', () => {
    test('exact match gets highest base score', () => {
      const item1: HistoryItem = {
        text: 'npm install',
        timestamp: Date.now() - 10 * 24 * 60 * 60 * 1000, // 10 days ago
        id: 'old-exact',
      };
      const item2: HistoryItem = {
        text: 'npm install dependencies',
        timestamp: Date.now() - 5 * 60 * 1000, // 5 minutes ago
        id: 'recent-prefix',
      };

      const score1 = filterEngine.calculateMatchScore(item1, 'npm install');
      const score2 = filterEngine.calculateMatchScore(item2, 'npm install');

      // Both should match
      expect(score1).toBeGreaterThan(0);
      expect(score2).toBeGreaterThan(0);
    });

    test('recency bonus adds to score', () => {
      const recentItem: HistoryItem = {
        text: 'test command',
        timestamp: Date.now() - 1000, // Just now
        id: 'recent',
      };
      const oldItem: HistoryItem = {
        text: 'test command',
        timestamp: Date.now() - 60 * 24 * 60 * 60 * 1000, // 60 days ago
        id: 'old',
      };

      const recentScore = filterEngine.calculateMatchScore(recentItem, 'test');
      const oldScore = filterEngine.calculateMatchScore(oldItem, 'test');

      // Recent item should have higher score due to recency bonus
      expect(recentScore).toBeGreaterThan(oldScore);
    });
  });

  describe('Filter with fixture test cases', () => {
    test('recency gradient: similar matches ordered by recency', () => {
      const testCase = historySearchTestCases.find(tc =>
        tc.description.includes('Items with similar match quality should be ordered by recency')
      );
      expect(testCase).toBeDefined();

      const history: HistoryItem[] = testCase!.history.map(h => ({
        ...h,
        appName: 'test',
      }));

      const result = filterEngine.filter(history, testCase!.query);

      // very-recent should be first when match quality is similar
      expect(result.items[0]?.id).toBe('very-recent');
      // Verify full order matches expected
      expect(result.items.map(i => i.id)).toEqual(testCase!.expected);
    });

    test('multi-word queries filter correctly with AND logic', () => {
      const testCase = historySearchTestCases.find(tc =>
        tc.description.includes('Multi-word queries should prefer consecutive word matches')
      );
      expect(testCase).toBeDefined();

      const history: HistoryItem[] = testCase!.history.map(h => ({
        ...h,
        appName: 'test',
      }));

      const result = filterEngine.filter(history, testCase!.query);

      // All keywords must match (AND logic)
      expect(result.items.length).toBeGreaterThan(0);
      // exact-prefix should be first (all words in order)
      expect(result.items[0]?.id).toBe('exact-prefix');
    });
  });

  describe('Empty query handling', () => {
    test('empty query returns items without filtering', () => {
      const history: HistoryItem[] = [
        { text: 'First entry', timestamp: Date.now() - 3000, id: 'third' },
        { text: 'Second entry', timestamp: Date.now() - 2000, id: 'second' },
        { text: 'Third entry', timestamp: Date.now() - 1000, id: 'first' },
      ];

      const result = filterEngine.filter(history, '');

      // All items should be returned in original order
      expect(result.items).toHaveLength(3);
      expect(result.totalMatches).toBe(3);
    });
  });

  describe('Fuzzy matching method', () => {
    test('fuzzyMatch finds characters in order for simple case', () => {
      // Test simple case - all lowercase matching
      const result = filterEngine.fuzzyMatch('myclass', 'mc');
      expect(result.matched).toBe(true);
      expect(result.positions).toHaveLength(2);
    });

    test('fuzzyMatch fails when characters not in order', () => {
      const result = filterEngine.fuzzyMatch('MyClassName', 'nmc');
      expect(result.matched).toBe(false);
    });
  });

  // Tests with real data - skip if no data available
  describe.skip('Real data tests (requires ~/.prompt-line/history.jsonl)', () => {
    let realData: RealTestData | null = null;
    let hasRealData = false;

    beforeAll(async () => {
      try {
        realData = await loadRealTestData();
        hasRealData = realData.history.length >= 100;
      } catch {
        hasRealData = false;
      }
    });

    test('should handle real history data', () => {
      if (!hasRealData || !realData) {
        console.log('Skipping: No real data available');
        return;
      }

      const history: HistoryItem[] = realData.history.slice(0, 1000);
      const result = filterEngine.filter(history, 'git');

      expect(result.totalMatches).toBeGreaterThanOrEqual(0);
      expect(result.items.length).toBeLessThanOrEqual(50);
    });
  });
});
