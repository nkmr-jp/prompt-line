/**
 * Performance benchmark tests for FileFilterManager
 * Measures execution time for file filtering operations
 */

import { FileFilterManager } from '../../src/renderer/mentions/managers/file-filter-manager';
import type { DirectoryData } from '../../src/renderer/mentions/types';
import type { FileInfo } from '../../src/types';

// === Performance Thresholds ===
const PERFORMANCE_THRESHOLDS = {
  FULL_SEARCH_5000: 100,        // ms - Full search on 5000 files
  INCREMENTAL_SEARCH: 50,       // ms - Incremental search (extending query)
  CACHE_RESET_PENALTY: 150,     // ms - After cache reset (expected to be slower)
  SUBDIRECTORY_SEARCH: 50,      // ms - Search within subdirectory
};

// === Helper Functions ===

/**
 * Measure execution time of a function
 */
function measureTime<T>(fn: () => T): [T, number] {
  const start = performance.now();
  const result = fn();
  const end = performance.now();
  return [result, end - start];
}

/**
 * Run benchmark multiple times and report statistics
 */
function runBenchmark(
  name: string,
  iterations: number,
  fn: () => void
): { avg: number; min: number; max: number; total: number } {
  const durations: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const [, duration] = measureTime(fn);
    durations.push(duration);
  }

  const avg = durations.reduce((sum, d) => sum + d, 0) / durations.length;
  const min = Math.min(...durations);
  const max = Math.max(...durations);
  const total = durations.reduce((sum, d) => sum + d, 0);

  console.log(`[BENCHMARK] ${name}:`);
  console.log(`  Iterations: ${iterations}`);
  console.log(`  Average: ${avg.toFixed(2)}ms`);
  console.log(`  Min: ${min.toFixed(2)}ms`);
  console.log(`  Max: ${max.toFixed(2)}ms`);
  console.log(`  Total: ${total.toFixed(2)}ms`);

  return { avg, min, max, total };
}

/**
 * Generate realistic file data for testing
 * Simulates a typical project structure with various file types and depths
 */
function generateFileData(count: number, baseDir: string = '/project'): FileInfo[] {
  const files: FileInfo[] = [];
  const extensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java', '.css', '.html', '.json', '.md'];
  const directories = ['src', 'lib', 'components', 'utils', 'tests', 'docs', 'config', 'scripts', 'assets', 'styles'];
  const subDirectories = ['api', 'hooks', 'context', 'models', 'services', 'helpers', 'types', 'constants'];
  const prefixes = ['index', 'App', 'Main', 'User', 'Auth', 'Data', 'Config', 'Utils', 'Helper', 'Service'];

  for (let i = 0; i < count; i++) {
    const dir = directories[i % directories.length]!;
    const ext = extensions[i % extensions.length]!;
    const prefix = prefixes[i % prefixes.length]!;

    // Create varied path depths
    let path: string;
    const depth = i % 4; // 0-3 levels deep

    if (depth === 0) {
      // Root level file
      path = `${baseDir}/${prefix}-${i}${ext}`;
    } else if (depth === 1) {
      // One level deep
      path = `${baseDir}/${dir}/${prefix}-${i}${ext}`;
    } else if (depth === 2) {
      // Two levels deep
      const subDir = subDirectories[i % subDirectories.length]!;
      path = `${baseDir}/${dir}/${subDir}/${prefix}-${i}${ext}`;
    } else {
      // Three levels deep
      const subDir1 = subDirectories[i % subDirectories.length]!;
      const subDir2 = subDirectories[(i + 3) % subDirectories.length]!;
      path = `${baseDir}/${dir}/${subDir1}/${subDir2}/${prefix}-${i}${ext}`;
    }

    const name = path.split('/').pop()!;

    files.push({
      name,
      path,
      isDirectory: false,
      mtimeMs: Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000, // Random time within 30 days
    });
  }

  return files;
}

/**
 * Create DirectoryData from files
 */
function createDirectoryData(files: FileInfo[], directory: string): DirectoryData {
  return {
    directory,
    files,
    timestamp: Date.now(),
    partial: false,
    searchMode: 'recursive',
  };
}

// === Benchmark Tests ===

describe('FileFilterManager Performance Benchmarks', () => {
  let manager: FileFilterManager;
  const baseDir = '/project';
  const DEFAULT_MAX_SUGGESTIONS = 20;

  beforeEach(() => {
    manager = new FileFilterManager({
      getDefaultMaxSuggestions: () => DEFAULT_MAX_SUGGESTIONS,
    });
  });

  describe('1. filterFiles - Full Search Performance', () => {
    test('should search 5000 files within threshold', () => {
      const files = generateFileData(5000, baseDir);
      const cachedData = createDirectoryData(files, baseDir);

      console.log(`\n[File count: ${files.length}]`);

      // Test various query patterns
      const queries = [
        'App',           // Common prefix
        'User',          // Another prefix
        'index',         // Very common
        '.ts',           // Extension search
        'src/',          // Directory prefix
        'component',     // Partial match
        'xyz',           // No match (worst case)
        'Config',        // CamelCase
        'helper',        // Lowercase
      ];

      for (const query of queries) {
        const stats = runBenchmark(
          `Full search: "${query}" (5000 files)`,
          10,
          () => {
            // Simulate fresh search by creating new manager instance
            const freshManager = new FileFilterManager({
              getDefaultMaxSuggestions: () => DEFAULT_MAX_SUGGESTIONS,
            });
            freshManager.filterFiles(cachedData, '', query);
          }
        );

        expect(stats.avg).toBeLessThan(PERFORMANCE_THRESHOLDS.FULL_SEARCH_5000);
      }
    });

    test('should handle empty query efficiently', () => {
      const files = generateFileData(5000, baseDir);
      const cachedData = createDirectoryData(files, baseDir);

      const stats = runBenchmark('Empty query (5000 files)', 10, () => {
        const freshManager = new FileFilterManager({
          getDefaultMaxSuggestions: () => DEFAULT_MAX_SUGGESTIONS,
        });
        freshManager.filterFiles(cachedData, '', '');
      });

      // Empty query should be faster (only returns top-level files)
      expect(stats.avg).toBeLessThan(50);
    });
  });

  describe('2. Incremental Search Performance', () => {
    test('should benefit from incremental search when extending query', () => {
      const files = generateFileData(5000, baseDir);
      const cachedData = createDirectoryData(files, baseDir);

      // First search to populate cache
      manager.filterFiles(cachedData, '', 'App');

      // Measure full search baseline
      const fullSearchStats = runBenchmark(
        'Full search: "App" (5000 files, fresh)',
        10,
        () => {
          const freshManager = new FileFilterManager({
            getDefaultMaxSuggestions: () => DEFAULT_MAX_SUGGESTIONS,
          });
          freshManager.filterFiles(cachedData, '', 'App');
        }
      );

      // Measure incremental search (extending query)
      // Need to do first search then extend
      const incrementalSearchStats = runBenchmark(
        'Incremental search: "App" -> "AppCo" (5000 files)',
        10,
        () => {
          // Reset manager for clean state
          const testManager = new FileFilterManager({
            getDefaultMaxSuggestions: () => DEFAULT_MAX_SUGGESTIONS,
          });
          // First search populates cache
          testManager.filterFiles(cachedData, '', 'App');
          // Second search should be incremental
          testManager.filterFiles(cachedData, '', 'AppCo');
        }
      );

      console.log(`\n[Incremental Search Comparison]`);
      console.log(`  Full search avg: ${fullSearchStats.avg.toFixed(2)}ms`);
      console.log(`  Incremental (2 searches) avg: ${incrementalSearchStats.avg.toFixed(2)}ms`);

      // Incremental should be within threshold
      expect(incrementalSearchStats.avg).toBeLessThan(PERFORMANCE_THRESHOLDS.INCREMENTAL_SEARCH * 2);
    });

    test('should measure incremental vs full search speedup', () => {
      const files = generateFileData(5000, baseDir);
      const cachedData = createDirectoryData(files, baseDir);

      // Measure single full search
      const singleFullStats: number[] = [];
      for (let i = 0; i < 10; i++) {
        const freshManager = new FileFilterManager({
          getDefaultMaxSuggestions: () => DEFAULT_MAX_SUGGESTIONS,
        });
        const [, duration] = measureTime(() => {
          freshManager.filterFiles(cachedData, '', 'User');
        });
        singleFullStats.push(duration);
      }

      // Measure single incremental search (after first search)
      const singleIncrementalStats: number[] = [];
      for (let i = 0; i < 10; i++) {
        const testManager = new FileFilterManager({
          getDefaultMaxSuggestions: () => DEFAULT_MAX_SUGGESTIONS,
        });
        testManager.filterFiles(cachedData, '', 'User');
        const [, duration] = measureTime(() => {
          testManager.filterFiles(cachedData, '', 'UserAuth');
        });
        singleIncrementalStats.push(duration);
      }

      const avgFull = singleFullStats.reduce((a, b) => a + b, 0) / singleFullStats.length;
      const avgIncremental = singleIncrementalStats.reduce((a, b) => a + b, 0) / singleIncrementalStats.length;

      console.log(`\n[Incremental Search Speedup]`);
      console.log(`  Single full search avg: ${avgFull.toFixed(2)}ms`);
      console.log(`  Single incremental search avg: ${avgIncremental.toFixed(2)}ms`);
      console.log(`  Speedup: ${(avgFull / avgIncremental).toFixed(2)}x`);

      expect(avgIncremental).toBeLessThan(PERFORMANCE_THRESHOLDS.INCREMENTAL_SEARCH);
    });
  });

  describe('3. Cache Reset Cost (currentPath Change)', () => {
    test('should measure performance impact when currentPath changes', () => {
      const files = generateFileData(5000, baseDir);
      const cachedData = createDirectoryData(files, baseDir);

      // Simulate normal incremental search
      manager.filterFiles(cachedData, '', 'App');
      const incrementalTimes: number[] = [];
      for (let i = 0; i < 10; i++) {
        const [, duration] = measureTime(() => {
          manager.filterFiles(cachedData, '', 'AppConfig');
        });
        incrementalTimes.push(duration);
      }
      const avgIncremental = incrementalTimes.reduce((a, b) => a + b, 0) / incrementalTimes.length;

      // Simulate currentPath change (forces cache reset)
      const cacheResetTimes: number[] = [];
      for (let i = 0; i < 10; i++) {
        const testManager = new FileFilterManager({
          getDefaultMaxSuggestions: () => DEFAULT_MAX_SUGGESTIONS,
        });
        // Search at root level first
        testManager.filterFiles(cachedData, '', 'App');
        // Switch to subdirectory (cache reset)
        testManager.filterFiles(cachedData, 'src/', 'App');
        // Switch back to root (cache reset again)
        const [, duration] = measureTime(() => {
          testManager.filterFiles(cachedData, '', 'App');
        });
        cacheResetTimes.push(duration);
      }
      const avgCacheReset = cacheResetTimes.reduce((a, b) => a + b, 0) / cacheResetTimes.length;

      console.log(`\n[Cache Reset Cost]`);
      console.log(`  Incremental (no reset) avg: ${avgIncremental.toFixed(2)}ms`);
      console.log(`  After cache reset avg: ${avgCacheReset.toFixed(2)}ms`);
      console.log(`  Penalty: ${(avgCacheReset - avgIncremental).toFixed(2)}ms`);

      expect(avgCacheReset).toBeLessThan(PERFORMANCE_THRESHOLDS.CACHE_RESET_PENALTY);
    });

    test('should compare root vs subdirectory search performance', () => {
      const files = generateFileData(5000, baseDir);
      const cachedData = createDirectoryData(files, baseDir);

      // Root level search
      const rootStats = runBenchmark(
        'Root level search: "App" (5000 files)',
        10,
        () => {
          const freshManager = new FileFilterManager({
            getDefaultMaxSuggestions: () => DEFAULT_MAX_SUGGESTIONS,
          });
          freshManager.filterFiles(cachedData, '', 'App');
        }
      );

      // Subdirectory search
      const subdirStats = runBenchmark(
        'Subdirectory search: "src/", "App" (5000 files)',
        10,
        () => {
          const freshManager = new FileFilterManager({
            getDefaultMaxSuggestions: () => DEFAULT_MAX_SUGGESTIONS,
          });
          freshManager.filterFiles(cachedData, 'src/', 'App');
        }
      );

      console.log(`\n[Root vs Subdirectory Comparison]`);
      console.log(`  Root search avg: ${rootStats.avg.toFixed(2)}ms`);
      console.log(`  Subdirectory search avg: ${subdirStats.avg.toFixed(2)}ms`);

      expect(subdirStats.avg).toBeLessThan(PERFORMANCE_THRESHOLDS.SUBDIRECTORY_SEARCH);
    });
  });

  describe('Query Pattern Performance Comparison', () => {
    test('should compare performance across different query patterns', () => {
      const files = generateFileData(5000, baseDir);
      const cachedData = createDirectoryData(files, baseDir);

      const queryPatterns = [
        { name: 'Single char', query: 'A' },
        { name: 'Short (3 chars)', query: 'App' },
        { name: 'Medium (6 chars)', query: 'Config' },
        { name: 'Long (10 chars)', query: 'AppConfig1' },
        { name: 'Extension', query: '.tsx' },
        { name: 'Path prefix', query: 'src/components' },
        { name: 'No match', query: 'xyznonexistent' },
        { name: 'Numbers', query: '123' },
        { name: 'CamelCase', query: 'UserAuth' },
      ];

      console.log(`\n[Query Pattern Performance Summary]`);
      console.log(`  File count: 5000`);
      console.log(`  Iterations per query: 10\n`);

      const results: Array<{ pattern: string; avg: number }> = [];

      for (const { name, query } of queryPatterns) {
        const stats = runBenchmark(
          `Pattern "${name}": "${query}"`,
          10,
          () => {
            const freshManager = new FileFilterManager({
              getDefaultMaxSuggestions: () => DEFAULT_MAX_SUGGESTIONS,
            });
            freshManager.filterFiles(cachedData, '', query);
          }
        );
        results.push({ pattern: name, avg: stats.avg });
      }

      // Print summary table
      console.log(`\n[Summary Table]`);
      console.log('  Pattern            | Avg (ms)');
      console.log('  -------------------|----------');
      for (const { pattern, avg } of results) {
        console.log(`  ${pattern.padEnd(18)} | ${avg.toFixed(2)}`);
      }

      // All patterns should be under threshold
      for (const { avg } of results) {
        expect(avg).toBeLessThan(PERFORMANCE_THRESHOLDS.FULL_SEARCH_5000);
      }
    });
  });

  describe('Scalability Test', () => {
    test('should measure performance scaling with file count', () => {
      const fileCounts = [1000, 2000, 3000, 5000, 7000, 10000];
      const results: Array<{ count: number; avg: number }> = [];

      console.log(`\n[Scalability Test - "App" query]`);

      for (const count of fileCounts) {
        const files = generateFileData(count, baseDir);
        const cachedData = createDirectoryData(files, baseDir);

        const stats = runBenchmark(
          `${count} files`,
          5,
          () => {
            const freshManager = new FileFilterManager({
              getDefaultMaxSuggestions: () => DEFAULT_MAX_SUGGESTIONS,
            });
            freshManager.filterFiles(cachedData, '', 'App');
          }
        );
        results.push({ count, avg: stats.avg });
      }

      // Print scalability summary
      console.log(`\n[Scalability Summary]`);
      console.log('  File Count | Avg (ms) | Per 1000 files');
      console.log('  -----------|----------|---------------');
      for (const { count, avg } of results) {
        const per1000 = (avg / count) * 1000;
        console.log(`  ${count.toString().padEnd(10)} | ${avg.toFixed(2).padStart(8)} | ${per1000.toFixed(2)}ms`);
      }

      // Performance should scale roughly linearly
      // 5000 files should be under threshold
      const result5000 = results.find(r => r.count === 5000);
      if (result5000) {
        expect(result5000.avg).toBeLessThan(PERFORMANCE_THRESHOLDS.FULL_SEARCH_5000);
      }
    });
  });
});
