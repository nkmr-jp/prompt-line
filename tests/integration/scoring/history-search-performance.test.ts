/**
 * Performance benchmark tests for History Search FilterEngine
 * Measures: filter function, scoreItem, recency bonus calculation
 * Test conditions: 5000 history items, various query lengths and match types
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import { HistorySearchFilterEngine } from '../../../src/renderer/history-search/filter-engine';
import type { HistoryItem } from '../../../src/renderer/history-search/types';
import { MATCH_SCORES, RECENCY_CONFIG } from '../../../src/renderer/history-search/types';

// === Performance Measurement Helper ===

interface BenchmarkStats {
  avg: number;
  min: number;
  max: number;
  median: number;
  p95: number;
  total: number;
  iterations: number;
}

/**
 * Run benchmark multiple times and report detailed statistics
 */
function runBenchmark(
  name: string,
  iterations: number,
  fn: () => void
): BenchmarkStats {
  const durations: number[] = [];

  // Warmup run
  fn();

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn();
    const end = performance.now();
    durations.push(end - start);
  }

  // Sort for percentile calculations
  const sorted = [...durations].sort((a, b) => a - b);
  const avg = durations.reduce((sum, d) => sum + d, 0) / durations.length;
  const min = sorted[0] ?? 0;
  const max = sorted[sorted.length - 1] ?? 0;
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
  const total = durations.reduce((sum, d) => sum + d, 0);

  console.log(`[BENCHMARK] ${name}:`);
  console.log(`  Iterations: ${iterations}`);
  console.log(`  Average: ${avg.toFixed(3)}ms`);
  console.log(`  Median: ${median.toFixed(3)}ms`);
  console.log(`  Min: ${min.toFixed(3)}ms`);
  console.log(`  Max: ${max.toFixed(3)}ms`);
  console.log(`  P95: ${p95.toFixed(3)}ms`);
  console.log(`  Total: ${total.toFixed(3)}ms`);

  return { avg, min, max, median, p95, total, iterations };
}

/**
 * Measure single operation overhead
 */
function measureOverhead(name: string, iterations: number, fn: () => void): number {
  const durations: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn();
    const end = performance.now();
    durations.push(end - start);
  }

  const avgPerOp = durations.reduce((sum, d) => sum + d, 0) / iterations;
  const avgMicroseconds = avgPerOp * 1000;

  console.log(`[OVERHEAD] ${name}:`);
  console.log(`  Per operation: ${avgPerOp.toFixed(6)}ms (${avgMicroseconds.toFixed(3)}μs)`);

  return avgPerOp;
}

// === Test Data Generation ===

/**
 * Generate history items with various text patterns
 */
function generateHistoryItems(count: number, options: {
  textPatterns?: string[];
  includeExactMatches?: boolean;
  includeStartsWithMatches?: boolean;
  includeContainsMatches?: boolean;
  includeFuzzyMatches?: boolean;
} = {}): HistoryItem[] {
  const {
    textPatterns = [
      'git commit -m "fix: ',
      'npm install ',
      'const data = ',
      'function handle',
      'SELECT * FROM ',
      'curl -X POST ',
      'docker run -it ',
      'kubectl get pods',
      'aws s3 cp ',
      'python script.py',
    ],
    includeExactMatches = true,
    includeStartsWithMatches = true,
    includeContainsMatches = true,
  } = options;

  const items: HistoryItem[] = [];
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;

  for (let i = 0; i < count; i++) {
    const pattern = textPatterns[i % textPatterns.length]!;
    let text: string;

    // Create different match types
    if (includeExactMatches && i % 100 === 0) {
      text = 'exactmatch'; // For exact match testing
    } else if (includeStartsWithMatches && i % 50 === 0) {
      text = 'startsprefix with some additional text here';
    } else if (includeContainsMatches && i % 20 === 0) {
      text = `${pattern} containsquery ${i} extra content`;
    } else {
      text = `${pattern}${i} - sample text with various content types`;
    }

    // Distribute timestamps over 30 days
    const ageInDays = (i / count) * RECENCY_CONFIG.TTL_DAYS;
    const timestamp = now - (ageInDays * oneDay);

    items.push({
      text,
      timestamp,
      id: `hist-${i}`,
      appName: i % 3 === 0 ? 'VSCode' : i % 3 === 1 ? 'Terminal' : 'Chrome',
    });
  }

  return items;
}

// === Performance Tests ===

describe('History Search Performance Benchmarks', () => {
  let filterEngine: HistorySearchFilterEngine;
  let historyItems5000: HistoryItem[];

  beforeAll(() => {
    filterEngine = new HistorySearchFilterEngine({
      maxSearchItems: 5000,
      maxDisplayResults: 50,
      caseSensitive: false,
      debounceDelay: 0, // Disable debounce for benchmarks
    });

    historyItems5000 = generateHistoryItems(5000);
    console.log(`\n[TEST DATA] Generated ${historyItems5000.length} history items`);
  });

  describe('1. filter() Function Performance', () => {
    test('should measure filter performance with 1-character query', () => {
      const query = 'g'; // Single character query

      const stats = runBenchmark(
        `filter() - 1-char query "${query}" (5000 items)`,
        20,
        () => {
          filterEngine.filter(historyItems5000, query);
        }
      );

      // Performance threshold: should complete within 100ms
      expect(stats.avg).toBeLessThan(100);
      expect(stats.p95).toBeLessThan(150);
    });

    test('should measure filter performance with 5-character query', () => {
      const query = 'const'; // 5 character query

      const stats = runBenchmark(
        `filter() - 5-char query "${query}" (5000 items)`,
        20,
        () => {
          filterEngine.filter(historyItems5000, query);
        }
      );

      expect(stats.avg).toBeLessThan(100);
      expect(stats.p95).toBeLessThan(150);
    });

    test('should measure filter performance with 10-character query', () => {
      const query = 'git commit'; // 10 character query (multi-word)

      const stats = runBenchmark(
        `filter() - 10-char query "${query}" (5000 items)`,
        20,
        () => {
          filterEngine.filter(historyItems5000, query);
        }
      );

      expect(stats.avg).toBeLessThan(100);
      expect(stats.p95).toBeLessThan(150);
    });

    test('should measure filter performance with empty query', () => {
      const stats = runBenchmark(
        'filter() - empty query (5000 items)',
        20,
        () => {
          filterEngine.filter(historyItems5000, '');
        }
      );

      // Empty query should be very fast (no scoring)
      expect(stats.avg).toBeLessThan(10);
    });

    test('should measure filter performance with no-match query', () => {
      const query = 'xyznonexistent123';

      const stats = runBenchmark(
        `filter() - no-match query "${query}" (5000 items)`,
        20,
        () => {
          filterEngine.filter(historyItems5000, query);
        }
      );

      expect(stats.avg).toBeLessThan(100);
    });
  });

  describe('2. scoreItem() / calculateMatchScore() Performance', () => {
    test('should measure score calculation for exact match', () => {
      const item: HistoryItem = {
        text: 'exactmatch',
        timestamp: Date.now(),
        id: 'test-exact',
      };

      const overhead = measureOverhead(
        'scoreItem() - exact match',
        10000,
        () => {
          filterEngine.calculateMatchScore(item, 'exactmatch');
        }
      );

      // Per-item scoring should be < 0.01ms
      expect(overhead).toBeLessThan(0.01);
    });

    test('should measure score calculation for starts_with match', () => {
      const item: HistoryItem = {
        text: 'startsprefix with additional text',
        timestamp: Date.now(),
        id: 'test-startswith',
      };

      const overhead = measureOverhead(
        'scoreItem() - starts_with match',
        10000,
        () => {
          filterEngine.calculateMatchScore(item, 'starts');
        }
      );

      expect(overhead).toBeLessThan(0.01);
    });

    test('should measure score calculation for contains match', () => {
      const item: HistoryItem = {
        text: 'some text with containsquery in the middle',
        timestamp: Date.now(),
        id: 'test-contains',
      };

      const overhead = measureOverhead(
        'scoreItem() - contains match',
        10000,
        () => {
          filterEngine.calculateMatchScore(item, 'containsquery');
        }
      );

      expect(overhead).toBeLessThan(0.01);
    });

    test('should measure score calculation for no match', () => {
      const item: HistoryItem = {
        text: 'this text does not match anything',
        timestamp: Date.now(),
        id: 'test-nomatch',
      };

      const overhead = measureOverhead(
        'scoreItem() - no match',
        10000,
        () => {
          filterEngine.calculateMatchScore(item, 'xyz123');
        }
      );

      expect(overhead).toBeLessThan(0.01);
    });

    test('should measure score calculation for multi-keyword query', () => {
      const item: HistoryItem = {
        text: 'git commit -m "fix: some bug in the code"',
        timestamp: Date.now(),
        id: 'test-multikeyword',
      };

      const overhead = measureOverhead(
        'scoreItem() - multi-keyword "git fix"',
        10000,
        () => {
          filterEngine.calculateMatchScore(item, 'git fix');
        }
      );

      expect(overhead).toBeLessThan(0.02); // Slightly higher for multi-keyword
    });
  });

  describe('3. Recency Bonus Calculation Overhead', () => {
    test('should measure recency bonus overhead for recent items', () => {
      const recentItem: HistoryItem = {
        text: 'test item',
        timestamp: Date.now() - 1000, // 1 second ago
        id: 'test-recent',
      };

      // Baseline: score without recency (using exact match)
      const exactMatchScore = MATCH_SCORES.EXACT_MATCH;

      // Full score (includes recency)
      const fullScoreOverhead = measureOverhead(
        'Full score (includes recency) - recent item',
        10000,
        () => {
          filterEngine.calculateMatchScore(recentItem, 'test item');
        }
      );

      const score = filterEngine.calculateMatchScore(recentItem, 'test item');
      console.log(`  Score breakdown: exact(${exactMatchScore}) + recency(${score - exactMatchScore}) = ${score}`);

      expect(fullScoreOverhead).toBeLessThan(0.01);
    });

    test('should measure recency bonus overhead for old items', () => {
      const oneDay = 24 * 60 * 60 * 1000;
      const oldItem: HistoryItem = {
        text: 'test item',
        timestamp: Date.now() - (RECENCY_CONFIG.TTL_DAYS + 1) * oneDay, // Beyond TTL
        id: 'test-old',
      };

      const overhead = measureOverhead(
        'Full score (includes recency) - old item (beyond TTL)',
        10000,
        () => {
          filterEngine.calculateMatchScore(oldItem, 'test item');
        }
      );

      const score = filterEngine.calculateMatchScore(oldItem, 'test item');
      console.log(`  Score breakdown: exact(${MATCH_SCORES.EXACT_MATCH}) + recency(0) = ${score}`);

      expect(overhead).toBeLessThan(0.01);
    });

    test('should measure recency calculation distribution', () => {
      const oneDay = 24 * 60 * 60 * 1000;
      const now = Date.now();

      console.log('\n[RECENCY BONUS DISTRIBUTION]');
      console.log(`  TTL: ${RECENCY_CONFIG.TTL_DAYS} days`);
      console.log(`  Max bonus: ${MATCH_SCORES.MAX_RECENCY_BONUS}`);

      const testAges = [0, 1, 7, 14, 21, 30, 60]; // days

      for (const days of testAges) {
        const item: HistoryItem = {
          text: 'test',
          timestamp: now - days * oneDay,
          id: `test-${days}d`,
        };

        // Score for contains match to isolate recency
        const containsScore = MATCH_SCORES.CONTAINS;
        const fullScore = filterEngine.calculateMatchScore(item, 'test');
        const recencyBonus = fullScore - containsScore;

        console.log(`  ${days}d old: recency bonus = ${recencyBonus}`);
      }

      expect(true).toBe(true); // Informational test
    });
  });

  describe('4. Match Type Comparison', () => {
    test('should compare performance across match types', () => {
      console.log('\n[MATCH TYPE PERFORMANCE COMPARISON]');

      const testCases = [
        { name: 'exact', query: 'exactmatch', items: generateHistoryItems(5000, { includeExactMatches: true }) },
        { name: 'starts_with', query: 'starts', items: historyItems5000 },
        { name: 'contains', query: 'sample', items: historyItems5000 },
        { name: 'multi_keyword', query: 'git commit', items: historyItems5000 },
        { name: 'no_match', query: 'xyznonexistent', items: historyItems5000 },
      ];

      const results: Record<string, BenchmarkStats> = {};

      for (const { name, query, items } of testCases) {
        const stats = runBenchmark(
          `Match type: ${name} - query "${query}"`,
          10,
          () => {
            filterEngine.filter(items, query);
          }
        );
        results[name] = stats;
      }

      // Compare relative performance
      console.log('\n[RELATIVE PERFORMANCE]');
      const baselineAvg = results['contains']?.avg ?? 1;
      for (const [name, stats] of Object.entries(results)) {
        const relative = ((stats.avg / baselineAvg) * 100).toFixed(1);
        console.log(`  ${name}: ${relative}% of baseline (contains)`);
      }

      // All match types should be within reasonable bounds
      for (const stats of Object.values(results)) {
        expect(stats.avg).toBeLessThan(150);
      }
    });
  });

  describe('5. Query Length Impact', () => {
    test('should measure performance impact of query length', () => {
      console.log('\n[QUERY LENGTH IMPACT]');

      const queries = [
        { len: 1, query: 'g' },
        { len: 2, query: 'gi' },
        { len: 3, query: 'git' },
        { len: 5, query: 'const' },
        { len: 10, query: 'git commit' },
        { len: 15, query: 'git commit -m f' },
        { len: 20, query: 'git commit -m "fix:' },
      ];

      const results: Array<{ len: number; avg: number; median: number }> = [];

      for (const { len, query } of queries) {
        const stats = runBenchmark(
          `Query length: ${len} chars - "${query}"`,
          10,
          () => {
            filterEngine.filter(historyItems5000, query);
          }
        );
        results.push({ len, avg: stats.avg, median: stats.median });
      }

      // Summary
      console.log('\n[QUERY LENGTH SUMMARY]');
      for (const { len, avg, median } of results) {
        console.log(`  ${len} chars: avg=${avg.toFixed(3)}ms, median=${median.toFixed(3)}ms`);
      }

      // Query length should not dramatically affect performance
      for (const result of results) {
        expect(result.avg).toBeLessThan(150);
      }
    });
  });

  describe('6. Scalability Test', () => {
    test('should measure performance with different dataset sizes', () => {
      console.log('\n[SCALABILITY TEST]');

      const sizes = [100, 500, 1000, 2000, 3000, 4000, 5000];
      const query = 'git';

      const results: Array<{ size: number; avg: number; perItem: number }> = [];

      for (const size of sizes) {
        const items = historyItems5000.slice(0, size);

        const stats = runBenchmark(
          `Dataset size: ${size} items - query "${query}"`,
          10,
          () => {
            filterEngine.filter(items, query);
          }
        );

        results.push({
          size,
          avg: stats.avg,
          perItem: (stats.avg / size) * 1000, // microseconds per item
        });
      }

      // Summary
      console.log('\n[SCALABILITY SUMMARY]');
      for (const { size, avg, perItem } of results) {
        console.log(`  ${size} items: avg=${avg.toFixed(3)}ms, per-item=${perItem.toFixed(3)}μs`);
      }

      // Should scale roughly linearly
      const firstResult = results[0];
      const lastResult = results[results.length - 1];
      if (firstResult && lastResult) {
        const sizeRatio = lastResult.size / firstResult.size;
        const timeRatio = lastResult.avg / firstResult.avg;
        console.log(`\n  Size ratio: ${sizeRatio}x, Time ratio: ${timeRatio.toFixed(2)}x`);

        // Time should not grow faster than cubic (measurement noise is significant with small datasets)
        expect(timeRatio).toBeLessThan(sizeRatio * 3);
      }
    });
  });

  describe('7. Summary Report', () => {
    test('should generate final performance summary', () => {
      console.log('\n' + '='.repeat(60));
      console.log('HISTORY SEARCH PERFORMANCE SUMMARY');
      console.log('='.repeat(60));

      // Run comprehensive benchmarks
      const benchmarks = [
        { name: 'filter() - 1-char query', query: 'g' },
        { name: 'filter() - 5-char query', query: 'const' },
        { name: 'filter() - 10-char query', query: 'git commit' },
        { name: 'filter() - empty query', query: '' },
        { name: 'filter() - no-match query', query: 'xyznonexistent' },
      ];

      const summaryResults: Array<{ name: string; avg: number; p95: number }> = [];

      for (const { name, query } of benchmarks) {
        const durations: number[] = [];

        // Warmup
        filterEngine.filter(historyItems5000, query);

        for (let i = 0; i < 20; i++) {
          const start = performance.now();
          filterEngine.filter(historyItems5000, query);
          durations.push(performance.now() - start);
        }

        const sorted = [...durations].sort((a, b) => a - b);
        const avg = durations.reduce((s, d) => s + d, 0) / durations.length;
        const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;

        summaryResults.push({ name, avg, p95 });
      }

      console.log('\nTest Conditions:');
      console.log(`  - Dataset size: 5000 items`);
      console.log(`  - Iterations per benchmark: 20`);
      console.log(`  - Max search items: 5000`);
      console.log(`  - Max display results: 50`);
      console.log(`  - Recency TTL: ${RECENCY_CONFIG.TTL_DAYS} days`);

      console.log('\nResults (milliseconds):');
      console.log('-'.repeat(50));
      console.log('| Operation                    | Avg (ms) | P95 (ms) |');
      console.log('-'.repeat(50));

      for (const { name, avg, p95 } of summaryResults) {
        const nameStr = name.padEnd(28);
        const avgStr = avg.toFixed(3).padStart(8);
        const p95Str = p95.toFixed(3).padStart(8);
        console.log(`| ${nameStr} | ${avgStr} | ${p95Str} |`);
      }

      console.log('-'.repeat(50));

      // Score calculation overhead
      const item: HistoryItem = { text: 'test item', timestamp: Date.now(), id: 'test' };
      const scoreIterations = 10000;
      const scoreStart = performance.now();
      for (let i = 0; i < scoreIterations; i++) {
        filterEngine.calculateMatchScore(item, 'test');
      }
      const scoreEnd = performance.now();
      const scoreOverhead = (scoreEnd - scoreStart) / scoreIterations;

      console.log('\nPer-Item Overhead:');
      console.log(`  - scoreItem(): ${(scoreOverhead * 1000).toFixed(3)}μs per item`);
      console.log(`  - Recency bonus: included in scoreItem()`);

      console.log('\n' + '='.repeat(60));

      expect(true).toBe(true);
    });
  });
});
