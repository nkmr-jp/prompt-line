/**
 * Benchmark tests for scoring performance
 * Measures real-world performance with actual user data
 */

import { loadRealTestData, getHistoryStats } from '../../fixtures/scoring/real-data-loader';
import { HistorySearchFilterEngine } from '../../../src/renderer/history-search/filter-engine';
import { calculateMatchScore } from '../../../src/renderer/mentions/fuzzy-matcher';
import type { FileInfo } from '../../../src/types';
import type { HistoryItem } from '../../../src/types';
import type { RealTestData } from '../../fixtures/scoring/real-data-loader';

// === Performance Thresholds ===

const PERFORMANCE_THRESHOLDS = {
  HISTORY_SEARCH: 50, // ms - 4000+ items
  FILE_SEARCH: 50, // ms - 1000+ items
  SYMBOL_SEARCH: 50, // ms - 1000+ items (future implementation)
};

// === Helper Functions ===

/**
 * Measure execution time of a function
 * @param fn - Function to measure
 * @returns [result, duration in ms]
 */
function measureTime<T>(fn: () => T): [T, number] {
  const start = performance.now();
  const result = fn();
  const end = performance.now();
  const duration = end - start;
  return [result, duration];
}

/**
 * Run benchmark multiple times and report statistics
 * @param name - Benchmark name
 * @param iterations - Number of iterations
 * @param fn - Function to benchmark
 * @returns Statistics object with avg/min/max
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

  // Output for CI visibility
  console.log(`[BENCHMARK] ${name}:`);
  console.log(`  Iterations: ${iterations}`);
  console.log(`  Average: ${avg.toFixed(2)}ms`);
  console.log(`  Min: ${min.toFixed(2)}ms`);
  console.log(`  Max: ${max.toFixed(2)}ms`);
  console.log(`  Total: ${total.toFixed(2)}ms`);

  return { avg, min, max, total };
}

/**
 * Generate synthetic file data for testing
 * @param count - Number of files to generate
 * @returns Array of FileInfo objects
 */
function generateFileData(count: number): FileInfo[] {
  const files: FileInfo[] = [];
  const extensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java'];
  const directories = ['src', 'lib', 'components', 'utils', 'tests', 'docs'];

  for (let i = 0; i < count; i++) {
    const dir = directories[i % directories.length];
    const ext = extensions[i % extensions.length];
    const name = `file-${i}${ext}`;
    const path = `/${dir}/${name}`;

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
 * Generate synthetic symbol data for testing (future implementation)
 * @param count - Number of symbols to generate
 * @returns Array of symbol objects
 */
function generateSymbolData(count: number): Array<{ name: string; type: string; path: string }> {
  const symbols: Array<{ name: string; type: string; path: string }> = [];
  const types = ['function', 'class', 'interface', 'type', 'constant'];
  const prefixes = ['get', 'set', 'create', 'update', 'delete', 'fetch', 'process', 'handle'];

  for (let i = 0; i < count; i++) {
    const prefix = prefixes[i % prefixes.length]!; // Safe: array has fixed length
    const type = types[i % types.length]!; // Safe: array has fixed length
    const name = `${prefix}Data${i}`;
    const path = `/src/file-${Math.floor(i / 10)}.ts`;

    symbols.push({ name, type, path });
  }

  return symbols;
}

// === Benchmark Tests ===

describe('Scoring Performance Benchmarks', () => {
  let realData: RealTestData | null = null;
  let hasRealData = false;

  // Load real data before all tests
  beforeAll(async () => {
    try {
      realData = await loadRealTestData();
      hasRealData =
        realData.history.length >= 100 || // At least some history data
        realData.fileUsage.length > 0;

      if (hasRealData) {
        const stats = getHistoryStats(realData.history);
        console.log('\n[REAL DATA LOADED]');
        console.log(`  History entries: ${stats.total}`);
        console.log(`  File usage entries: ${realData.fileUsage.length}`);
        console.log(`  Agent skills: ${realData.agentSkills.length}`);
        console.log(`  Agents: ${realData.agents.length}`);
        console.log(`  Last 24h: ${stats.last24h}`);
        console.log(`  Last 7d: ${stats.last7d}`);
        console.log(`  Last 30d: ${stats.last30d}`);
        console.log(`  Avg text length: ${stats.avgTextLength} chars\n`);
      } else {
        console.log('\n[REAL DATA NOT AVAILABLE - Using synthetic data]\n');
      }
    } catch (_error) {
      console.log('\n[REAL DATA LOAD FAILED - Using synthetic data]\n');
      hasRealData = false;
    }
  });

  describe('History Search Performance', () => {
    test('should search 4000+ items within 50ms threshold', () => {
      // Use real data or generate synthetic data
      let historyData: HistoryItem[];

      if (hasRealData && realData && realData.history.length >= 1000) {
        historyData = realData.history.slice(0, 4000);
        console.log(`\n[Using real history data: ${historyData.length} items]`);
      } else {
        // Generate synthetic history data
        historyData = Array.from({ length: 4000 }, (_, i) => ({
          text: `Sample history item ${i} with some descriptive text about this entry`,
          timestamp: Date.now() - i * 60000, // 1 minute apart
          id: `hist-${i}`,
          appName: i % 2 === 0 ? 'VSCode' : 'Terminal',
        }));
        console.log('\n[Using synthetic history data: 4000 items]');
      }

      const filterEngine = new HistorySearchFilterEngine({
        maxSearchItems: 5000,
        maxDisplayResults: 50,
        caseSensitive: false,
        debounceDelay: 0, // No debounce for benchmark
      });

      // Test queries
      const queries = ['sample', 'text', 'entry', 'vscode', 'terminal'];

      for (const query of queries) {
        const stats = runBenchmark(`History search: "${query}" (${historyData.length} items)`, 10, () => {
          filterEngine.filter(historyData, query);
        });

        // Assert performance threshold
        expect(stats.avg).toBeLessThan(PERFORMANCE_THRESHOLDS.HISTORY_SEARCH);
      }
    });

    test('should handle empty query efficiently', () => {
      const historyData: HistoryItem[] = Array.from({ length: 4000 }, (_, i) => ({
        text: `Item ${i}`,
        timestamp: Date.now() - i * 60000,
        id: `hist-${i}`,
      }));

      const filterEngine = new HistorySearchFilterEngine();

      const stats = runBenchmark('History search: empty query (4000 items)', 10, () => {
        filterEngine.filter(historyData, '');
      });

      // Empty query should be very fast (no scoring needed)
      expect(stats.avg).toBeLessThan(10);
    });

    test('should handle multi-keyword search efficiently', () => {
      const historyData: HistoryItem[] = Array.from({ length: 2000 }, (_, i) => ({
        text: `Sample item ${i} with multiple keywords for testing search functionality`,
        timestamp: Date.now() - i * 60000,
        id: `hist-${i}`,
      }));

      const filterEngine = new HistorySearchFilterEngine();

      const stats = runBenchmark('History search: multi-keyword "sample testing" (2000 items)', 10, () => {
        filterEngine.filter(historyData, 'sample testing');
      });

      expect(stats.avg).toBeLessThan(PERFORMANCE_THRESHOLDS.HISTORY_SEARCH);
    });
  });

  describe('File Search Performance', () => {
    test('should search 1000+ files within 50ms threshold', () => {
      const fileData = generateFileData(1000);
      console.log(`\n[Using synthetic file data: ${fileData.length} items]`);

      // Test queries
      const queries = ['file', 'component', '.ts', 'src/', 'test'];

      for (const query of queries) {
        const stats = runBenchmark(`File search: "${query}" (${fileData.length} files)`, 10, () => {
          // Simulate file search: filter and score files
          const queryLower = query.toLowerCase();
          const results = fileData
            .map(file => ({
              file,
              score: calculateMatchScore(file, queryLower, 0),
            }))
            .filter(r => r.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 50);

          return results;
        });

        expect(stats.avg).toBeLessThan(PERFORMANCE_THRESHOLDS.FILE_SEARCH);
      }
    });

    test('should handle large file lists efficiently', () => {
      const fileData = generateFileData(5000);

      const stats = runBenchmark('File search: "component" (5000 files)', 10, () => {
        const queryLower = 'component';
        const results = fileData
          .map(file => ({
            file,
            score: calculateMatchScore(file, queryLower, 0),
          }))
          .filter(r => r.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 50);

        return results;
      });

      // Large file lists should still be reasonably fast
      expect(stats.avg).toBeLessThan(100); // Slightly higher threshold for 5000 files
    });

    test('should handle exact match searches efficiently', () => {
      const fileData = generateFileData(1000);

      const stats = runBenchmark('File search: exact match "file-500.ts" (1000 files)', 10, () => {
        const queryLower = 'file-500.ts';
        const results = fileData
          .map(file => ({
            file,
            score: calculateMatchScore(file, queryLower, 0),
          }))
          .filter(r => r.score > 0)
          .sort((a, b) => b.score - a.score);

        return results;
      });

      // Exact match should be very fast
      expect(stats.avg).toBeLessThan(PERFORMANCE_THRESHOLDS.FILE_SEARCH);
    });
  });

  describe('Symbol Search Performance (Simulated)', () => {
    test('should search 1000+ symbols within 50ms threshold', () => {
      const symbolData = generateSymbolData(1000);
      console.log(`\n[Using synthetic symbol data: ${symbolData.length} items]`);

      // Test queries
      const queries = ['get', 'Data', 'create', 'Handler', 'Config'];

      for (const query of queries) {
        const stats = runBenchmark(`Symbol search: "${query}" (${symbolData.length} symbols)`, 10, () => {
          // Simulate symbol search: simple string matching
          const queryLower = query.toLowerCase();
          const results = symbolData
            .filter(sym => sym.name.toLowerCase().includes(queryLower))
            .sort((a, b) => {
              // Simple scoring: prefer exact match > starts with > contains
              const aLower = a.name.toLowerCase();
              const bLower = b.name.toLowerCase();

              if (aLower === queryLower && bLower !== queryLower) return -1;
              if (bLower === queryLower && aLower !== queryLower) return 1;
              if (aLower.startsWith(queryLower) && !bLower.startsWith(queryLower)) return -1;
              if (bLower.startsWith(queryLower) && !aLower.startsWith(queryLower)) return 1;

              return a.name.localeCompare(b.name);
            })
            .slice(0, 50);

          return results;
        });

        expect(stats.avg).toBeLessThan(PERFORMANCE_THRESHOLDS.SYMBOL_SEARCH);
      }
    });

    test('should handle camelCase searches efficiently', () => {
      const symbolData = generateSymbolData(1000);

      const stats = runBenchmark('Symbol search: camelCase "getData" (1000 symbols)', 10, () => {
        const queryLower = 'getdata';
        const results = symbolData
          .filter(sym => sym.name.toLowerCase().includes(queryLower))
          .slice(0, 50);

        return results;
      });

      expect(stats.avg).toBeLessThan(PERFORMANCE_THRESHOLDS.SYMBOL_SEARCH);
    });
  });

  describe('Score Calculation Overhead', () => {
    test('should measure score calculation performance for history items', () => {
      const filterEngine = new HistorySearchFilterEngine();
      const sampleItem: HistoryItem = {
        text: 'Sample text for scoring performance measurement',
        timestamp: Date.now(),
        id: 'test-item',
      };

      const stats = runBenchmark('Score calculation: single history item', 1000, () => {
        filterEngine.calculateMatchScore(sampleItem, 'sample');
      });

      // Single item scoring should be extremely fast (<1ms per item)
      expect(stats.avg).toBeLessThan(1);
      console.log(`  Per-item cost: ${(stats.avg / 1000).toFixed(4)}ms`);
    });

    test('should measure score calculation performance for files', () => {
      const sampleFile: FileInfo = {
        name: 'sample-file.ts',
        path: '/src/components/sample-file.ts',
        isDirectory: false,
        mtimeMs: Date.now(),
      };

      const stats = runBenchmark('Score calculation: single file', 1000, () => {
        calculateMatchScore(sampleFile, 'sample', 0);
      });

      // Single file scoring should be extremely fast (<1ms per file)
      expect(stats.avg).toBeLessThan(1);
      console.log(`  Per-file cost: ${(stats.avg / 1000).toFixed(4)}ms`);
    });
  });

  describe('Memory Usage (Optional)', () => {
    test('should report memory usage for large datasets', () => {
      // This test only reports memory usage, doesn't assert thresholds
      const initialMemory = process.memoryUsage();

      // Create large dataset
      const historyData: HistoryItem[] = Array.from({ length: 10000 }, (_, i) => ({
        text: `Large dataset item ${i} with extended text content for memory testing purposes. This simulates real-world history entries with varying lengths.`,
        timestamp: Date.now() - i * 60000,
        id: `hist-${i}`,
      }));

      const filterEngine = new HistorySearchFilterEngine({
        maxSearchItems: 10000,
      });

      // Perform search
      filterEngine.filter(historyData, 'dataset');

      const finalMemory = process.memoryUsage();

      console.log('\n[MEMORY USAGE]');
      console.log(`  Heap used: ${((finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  Total heap: ${(finalMemory.heapTotal / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  RSS: ${(finalMemory.rss / 1024 / 1024).toFixed(2)}MB`);

      // No assertion - just informational
      expect(true).toBe(true);
    });
  });
});
