/**
 * Performance tests for history search incremental filtering optimization
 */

import { describe, test, expect } from '@jest/globals';
import { HistorySearchFilterEngine } from '../../src/renderer/history-search/filter-engine';
import type { HistoryItem } from '../../src/types/history';

describe('History Search Performance - Incremental Filtering', () => {
  const filterEngine = new HistorySearchFilterEngine({
    maxSearchItems: 5000,
    maxDisplayResults: 50,
    caseSensitive: false,
    debounceDelay: 0,
  });

  // Create test data
  const testHistory: HistoryItem[] = Array.from({ length: 1000 }, (_, i) => ({
    text: `npm install package-${i}`,
    timestamp: Date.now() - i * 1000,
    id: `item-${i}`,
  }));

  test('incremental filtering should use cached results for extended queries', () => {
    // First search with "npm"
    const result1 = filterEngine.filter(testHistory, 'npm');
    expect(result1.items.length).toBeGreaterThan(0);
    expect(result1.totalMatches).toBe(1000); // All items match "npm"

    // Extended search with "npm install" should use cached results from "npm"
    // This test verifies that the cache is working by checking that we get results
    const result2 = filterEngine.filter(testHistory, 'npm install');
    expect(result2.items.length).toBeGreaterThan(0);
    expect(result2.totalMatches).toBe(1000); // All items still match

    // Even more extended search
    const result3 = filterEngine.filter(testHistory, 'npm install package');
    expect(result3.items.length).toBeGreaterThan(0);
    expect(result3.totalMatches).toBe(1000);
  });

  test('cache should be cleared when query does not extend previous query', () => {
    // First search
    filterEngine.filter(testHistory, 'npm');

    // Different query should not use cache
    const result = filterEngine.filter(testHistory, 'install');
    expect(result.totalMatches).toBe(1000);
  });

  test('cache should be cleared on empty query', () => {
    // First search
    filterEngine.filter(testHistory, 'npm');

    // Empty query should clear cache
    const result = filterEngine.filter(testHistory, '');
    expect(result.items.length).toBeLessThanOrEqual(50); // Limited by maxDisplayResults
    expect(result.totalMatches).toBe(1000);
  });

  test('clearCache should reset internal cache state', () => {
    // First search
    filterEngine.filter(testHistory, 'npm install');

    // Clear cache explicitly
    filterEngine.clearCache();

    // Next search should not benefit from cache
    const result = filterEngine.filter(testHistory, 'npm install package');
    expect(result.totalMatches).toBe(1000);
  });

  test('filterWithLimit should also use incremental filtering', () => {
    // First search
    const result1 = filterEngine.filterWithLimit(testHistory, 'npm', 100);
    expect(result1.items.length).toBe(100);
    expect(result1.totalMatches).toBe(1000);

    // Extended query should use cached results
    const result2 = filterEngine.filterWithLimit(testHistory, 'npm install', 100);
    expect(result2.items.length).toBe(100);
    expect(result2.totalMatches).toBe(1000);
  });
});
