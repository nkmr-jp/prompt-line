/**
 * File search test cases for scoring tests
 * Tests camel case priority, recently edited files, and usage frequency
 */

export interface FileSearchTestCase {
  query: string;
  files: Array<{
    path: string;
    lastModified?: number; // Unix timestamp (ms)
    usageCount?: number;
  }>;
  expected: string[]; // Expected order of file paths
  description: string;
}

/**
 * Test cases for file search scoring
 */
export const fileSearchTestCases: FileSearchTestCase[] = [
  // === Camel Case Priority ===
  {
    query: 'mc',
    files: [
      { path: 'src/MyConfig.ts' },
      { path: 'src/my-config.ts' },
      { path: 'src/main-controller.ts' },
    ],
    expected: [
      'src/MyConfig.ts', // Camel case match should be first
      'src/main-controller.ts', // Word boundary match
      'src/my-config.ts', // Simple match
    ],
    description: 'Camel case match (MyConfig) should rank higher than hyphenated match (my-config)',
  },

  {
    query: 'fzf',
    files: [
      { path: 'src/lib/FzfScorer.ts' },
      { path: 'src/lib/fuzzy-filter.ts' },
      { path: 'src/tests/fzf-test.ts' },
    ],
    expected: [
      'src/lib/FzfScorer.ts', // Exact camel case match
      'src/tests/fzf-test.ts', // Exact word boundary match
      'src/lib/fuzzy-filter.ts', // Partial match
    ],
    description: 'Camel case FzfScorer should rank higher than fuzzy-filter',
  },

  // === Recently Edited File Priority ===
  {
    query: 'config',
    files: [
      { path: 'src/old-config.ts', lastModified: Date.now() - 30 * 24 * 60 * 60 * 1000 }, // 30 days old
      { path: 'src/config.ts', lastModified: Date.now() - 1 * 60 * 60 * 1000 }, // 1 hour ago
      { path: 'src/new-config.ts', lastModified: Date.now() - 10 * 60 * 1000 }, // 10 minutes ago
    ],
    expected: [
      'src/new-config.ts', // Most recently edited
      'src/config.ts', // Recently edited
      'src/old-config.ts', // Older file
    ],
    description: 'Recently edited files should rank higher than older files with same match quality',
  },

  // === Usage Frequency Consideration ===
  {
    query: 'util',
    files: [
      { path: 'src/utils.ts', usageCount: 50 },
      { path: 'src/util-helper.ts', usageCount: 5 },
      { path: 'src/utilities.ts', usageCount: 0 },
    ],
    expected: [
      'src/utils.ts', // High usage frequency
      'src/util-helper.ts', // Some usage
      'src/utilities.ts', // No usage
    ],
    description: 'Frequently used files should rank higher when match quality is similar',
  },

  // === Combined: Camel Case + Recency ===
  {
    query: 'hm',
    files: [
      { path: 'src/HistoryManager.ts', lastModified: Date.now() - 1 * 60 * 60 * 1000 },
      { path: 'src/history-manager.ts', lastModified: Date.now() - 5 * 60 * 1000 },
      { path: 'src/helper-methods.ts', lastModified: Date.now() - 2 * 60 * 60 * 1000 },
    ],
    expected: [
      'src/history-manager.ts', // Recent + word boundary
      'src/HistoryManager.ts', // Camel case but older
      'src/helper-methods.ts', // Word boundary but oldest
    ],
    description: 'Recency should outweigh camel case bonus when recency difference is significant',
  },

  // === Path Length Preference (Shorter Paths) ===
  {
    query: 'manager',
    files: [
      { path: 'src/manager.ts' },
      { path: 'src/core/manager.ts' },
      { path: 'src/modules/advanced/manager.ts' },
    ],
    expected: [
      'src/manager.ts', // Shortest path
      'src/core/manager.ts', // Medium path
      'src/modules/advanced/manager.ts', // Longest path
    ],
    description: 'Shorter paths should be preferred when match quality is identical',
  },

  // === Basename Priority ===
  {
    query: 'test',
    files: [
      { path: 'src/test.ts' },
      { path: 'tests/utils.ts' },
      { path: 'src/modules/test-helper.ts' },
    ],
    expected: [
      'src/test.ts', // Exact basename match
      'src/modules/test-helper.ts', // Basename starts with query
      'tests/utils.ts', // Directory name match
    ],
    description: 'Basename matches should rank higher than directory name matches',
  },

  // === Edge Case: Empty Query ===
  {
    query: '',
    files: [
      { path: 'src/a.ts', lastModified: Date.now() - 1000 },
      { path: 'src/b.ts', lastModified: Date.now() - 2000 },
      { path: 'src/c.ts', lastModified: Date.now() - 3000 },
    ],
    expected: [
      'src/a.ts', // Most recent
      'src/b.ts',
      'src/c.ts', // Oldest
    ],
    description: 'Empty query should return files sorted by recency',
  },
];
