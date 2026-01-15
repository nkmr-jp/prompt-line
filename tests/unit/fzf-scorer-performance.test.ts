/**
 * FZF Scorer Performance Benchmark Tests
 *
 * Measures performance of FzfScorer and calculateMatchScore functions
 * with various file name lengths and query lengths.
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import { FzfScorer } from '../../src/lib/fzf-scorer';
import { calculateMatchScore, clearLowercaseCache } from '../../src/renderer/mentions/fuzzy-matcher';
import type { FileInfo } from '../../src/types';

// === Performance Measurement Helper ===

interface BenchmarkResult {
  avg: number;
  min: number;
  max: number;
  total: number;
  perItem: number;
  iterations: number;
}

/**
 * Run benchmark multiple times and report statistics
 */
function runBenchmark(
  name: string,
  iterations: number,
  fn: () => void
): BenchmarkResult {
  const durations: number[] = [];

  // Warmup run
  fn();

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn();
    const end = performance.now();
    durations.push(end - start);
  }

  const avg = durations.reduce((sum, d) => sum + d, 0) / durations.length;
  const min = Math.min(...durations);
  const max = Math.max(...durations);
  const total = durations.reduce((sum, d) => sum + d, 0);

  console.log(`[BENCHMARK] ${name}:`);
  console.log(`  Iterations: ${iterations}`);
  console.log(`  Average: ${avg.toFixed(3)}ms`);
  console.log(`  Min: ${min.toFixed(3)}ms`);
  console.log(`  Max: ${max.toFixed(3)}ms`);
  console.log(`  Total: ${total.toFixed(3)}ms`);

  return { avg, min, max, total, perItem: avg, iterations };
}

// === Test Data Generators ===

/**
 * Generate random string of specified length
 */
function generateRandomString(length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate file name with CamelCase pattern
 */
function generateCamelCaseFileName(length: number): string {
  const words = ['my', 'file', 'component', 'manager', 'handler', 'utils', 'test', 'config'];
  let result = '';
  let i = 0;
  while (result.length < length) {
    const word = words[i % words.length]!;
    result += i === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1);
    i++;
  }
  return result.slice(0, length) + '.ts';
}

/**
 * Generate file data for performance testing
 */
function generateFileData(count: number, nameLength: number): FileInfo[] {
  const files: FileInfo[] = [];
  const extensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go'];
  const directories = ['src', 'lib', 'components', 'utils', 'tests'];

  for (let i = 0; i < count; i++) {
    const dir = directories[i % directories.length]!;
    const ext = extensions[i % extensions.length]!;
    const baseName = generateRandomString(nameLength - ext.length);
    const name = baseName + ext;
    const path = `/${dir}/${name}`;

    files.push({
      name,
      path,
      isDirectory: false,
      mtimeMs: Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000,
    });
  }

  return files;
}

/**
 * Generate CamelCase file data for performance testing
 */
function generateCamelCaseFileData(count: number, nameLength: number): FileInfo[] {
  const files: FileInfo[] = [];
  const directories = ['src', 'lib', 'components', 'utils', 'tests'];

  for (let i = 0; i < count; i++) {
    const dir = directories[i % directories.length]!;
    const name = generateCamelCaseFileName(nameLength);
    const path = `/${dir}/${name}`;

    files.push({
      name,
      path,
      isDirectory: false,
      mtimeMs: Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000,
    });
  }

  return files;
}

// === Performance Tests ===

describe('FZF Scorer Performance Benchmarks', () => {
  let scorer: FzfScorer;

  beforeAll(() => {
    scorer = new FzfScorer({
      caseSensitive: false,
      enableCamelCase: true,
      enableBoundaryBonus: true,
    });
  });

  describe('1. FzfScorer.score() Single Execution Time', () => {
    const fileNameLengths = [10, 50, 100];
    const queryLengths = [3, 10, 20];

    for (const fileNameLength of fileNameLengths) {
      for (const queryLength of queryLengths) {
        test(`File name: ${fileNameLength} chars, Query: ${queryLength} chars`, () => {
          const fileName = generateRandomString(fileNameLength);
          const query = fileName.slice(0, queryLength).toLowerCase();

          const result = runBenchmark(
            `FzfScorer.score() - file:${fileNameLength} query:${queryLength}`,
            10000,
            () => {
              scorer.score(fileName, query);
            }
          );

          console.log(`  Per-call: ${(result.avg).toFixed(6)}ms`);

          // Each call should be extremely fast (< 0.1ms)
          expect(result.avg).toBeLessThan(0.1);
        });
      }
    }

    test('CamelCase file names with various query lengths', () => {
      const testCases = [
        { name: 'MyComponentManager', query: 'mcm' },
        { name: 'UserAuthenticationHandler', query: 'uah' },
        { name: 'DatabaseConnectionPoolManager', query: 'dcpm' },
      ];

      for (const { name, query } of testCases) {
        const result = runBenchmark(
          `FzfScorer.score() CamelCase - "${name}" / "${query}"`,
          10000,
          () => {
            scorer.score(name, query);
          }
        );

        console.log(`  Per-call: ${(result.avg).toFixed(6)}ms`);
        expect(result.avg).toBeLessThan(0.1);
      }
    });
  });

  describe('2. FZF Score Calculation for 5000 Files', () => {
    const queryLengths = [3, 10, 20];

    for (const queryLength of queryLengths) {
      test(`5000 files with ${queryLength}-char query`, () => {
        const files = generateFileData(5000, 50);
        const query = generateRandomString(queryLength).toLowerCase();

        clearLowercaseCache();

        const result = runBenchmark(
          `5000 files - query length ${queryLength}`,
          10,
          () => {
            for (const file of files) {
              scorer.score(file.name, query);
            }
          }
        );

        console.log(`  Per-file: ${(result.avg / 5000).toFixed(6)}ms`);
        console.log(`  Total time: ${result.avg.toFixed(3)}ms`);

        // 5000 files should be processed within 50ms
        expect(result.avg).toBeLessThan(100);
      });
    }

    test('5000 CamelCase files with abbreviation query', () => {
      const files = generateCamelCaseFileData(5000, 30);
      const query = 'mch'; // MyComponentHandler-like abbreviation

      clearLowercaseCache();

      const result = runBenchmark(
        '5000 CamelCase files - abbreviation query',
        10,
        () => {
          for (const file of files) {
            scorer.score(file.name, query);
          }
        }
      );

      console.log(`  Per-file: ${(result.avg / 5000).toFixed(6)}ms`);
      console.log(`  Total time: ${result.avg.toFixed(3)}ms`);

      expect(result.avg).toBeLessThan(100);
    });
  });

  describe('3. Match Type Comparison: EXACT vs STARTS_WITH vs CONTAINS vs FZF', () => {
    const FILE_COUNT = 5000;

    test('EXACT match performance', () => {
      const files = generateFileData(FILE_COUNT, 20);
      // Create query that exactly matches first file
      const query = files[0]!.name.toLowerCase();

      clearLowercaseCache();

      const result = runBenchmark(
        `EXACT match - ${FILE_COUNT} files`,
        10,
        () => {
          for (const file of files) {
            const nameLower = file.name.toLowerCase();
            if (nameLower === query) {
              // EXACT match
            }
          }
        }
      );

      console.log(`  Total time: ${result.avg.toFixed(3)}ms`);
      expect(result.avg).toBeLessThan(50);
    });

    test('STARTS_WITH match performance', () => {
      const files = generateFileData(FILE_COUNT, 20);
      const query = 'fil'; // Common prefix

      clearLowercaseCache();

      const result = runBenchmark(
        `STARTS_WITH match - ${FILE_COUNT} files`,
        10,
        () => {
          for (const file of files) {
            const nameLower = file.name.toLowerCase();
            if (nameLower.startsWith(query)) {
              // STARTS_WITH match
            }
          }
        }
      );

      console.log(`  Total time: ${result.avg.toFixed(3)}ms`);
      expect(result.avg).toBeLessThan(50);
    });

    test('CONTAINS match performance', () => {
      const files = generateFileData(FILE_COUNT, 20);
      const query = 'abc'; // Random substring

      clearLowercaseCache();

      const result = runBenchmark(
        `CONTAINS match - ${FILE_COUNT} files`,
        10,
        () => {
          for (const file of files) {
            const nameLower = file.name.toLowerCase();
            if (nameLower.includes(query)) {
              // CONTAINS match
            }
          }
        }
      );

      console.log(`  Total time: ${result.avg.toFixed(3)}ms`);
      expect(result.avg).toBeLessThan(50);
    });

    test('FZF match performance (fuzzy)', () => {
      const files = generateFileData(FILE_COUNT, 20);
      const query = 'abc';

      clearLowercaseCache();

      const result = runBenchmark(
        `FZF fuzzy match - ${FILE_COUNT} files`,
        10,
        () => {
          for (const file of files) {
            scorer.score(file.name, query);
          }
        }
      );

      console.log(`  Total time: ${result.avg.toFixed(3)}ms`);
      expect(result.avg).toBeLessThan(100);
    });

    test('Full calculateMatchScore() with all match types', () => {
      const files = generateFileData(FILE_COUNT, 30);
      const queries = ['exact-match', 'fil', 'abc', 'xyz'];

      for (const query of queries) {
        clearLowercaseCache();
        const queryLower = query.toLowerCase();

        const result = runBenchmark(
          `calculateMatchScore() - query "${query}" - ${FILE_COUNT} files`,
          10,
          () => {
            for (const file of files) {
              calculateMatchScore(file, queryLower, 0);
            }
          }
        );

        console.log(`  Total time: ${result.avg.toFixed(3)}ms`);
        expect(result.avg).toBeLessThan(200);
      }
    });
  });

  describe('4. Detailed Performance by File Name Length', () => {
    const nameLengths = [10, 50, 100];
    const query = 'abc';
    const FILE_COUNT = 1000;

    for (const nameLength of nameLengths) {
      test(`File name length: ${nameLength} chars`, () => {
        const files = generateFileData(FILE_COUNT, nameLength);

        clearLowercaseCache();

        const result = runBenchmark(
          `FzfScorer.score() - name length ${nameLength} - ${FILE_COUNT} files`,
          10,
          () => {
            for (const file of files) {
              scorer.score(file.name, query);
            }
          }
        );

        console.log(`  Per-file: ${(result.avg / FILE_COUNT).toFixed(6)}ms`);
        console.log(`  Total time: ${result.avg.toFixed(3)}ms`);

        expect(result.avg).toBeLessThan(50);
      });
    }
  });

  describe('5. Detailed Performance by Query Length', () => {
    const queryLengths = [3, 10, 20];
    const FILE_COUNT = 1000;
    const nameLength = 50;

    for (const queryLength of queryLengths) {
      test(`Query length: ${queryLength} chars`, () => {
        const files = generateFileData(FILE_COUNT, nameLength);
        const query = generateRandomString(queryLength).toLowerCase();

        clearLowercaseCache();

        const result = runBenchmark(
          `FzfScorer.score() - query length ${queryLength} - ${FILE_COUNT} files`,
          10,
          () => {
            for (const file of files) {
              scorer.score(file.name, query);
            }
          }
        );

        console.log(`  Per-file: ${(result.avg / FILE_COUNT).toFixed(6)}ms`);
        console.log(`  Total time: ${result.avg.toFixed(3)}ms`);

        expect(result.avg).toBeLessThan(50);
      });
    }
  });

  describe('6. Real-world Scenario: Full File Search Pipeline', () => {
    test('5000 files with scoring, filtering, and sorting', () => {
      const files = generateFileData(5000, 40);
      const query = 'comp';
      const queryLower = query.toLowerCase();

      clearLowercaseCache();

      const result = runBenchmark(
        'Full pipeline: 5000 files (score + filter + sort)',
        10,
        () => {
          const results = files
            .map(file => ({
              file,
              score: calculateMatchScore(file, queryLower, 0),
            }))
            .filter(r => r.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 50);

          return results;
        }
      );

      console.log(`  Total time: ${result.avg.toFixed(3)}ms`);

      // Full pipeline should complete within 200ms
      expect(result.avg).toBeLessThan(200);
    });
  });
});
