/**
 * History search test cases for scoring tests
 * Tests match quality vs recency balance and old but highly relevant items
 */

export interface HistorySearchTestCase {
  query: string;
  history: Array<{
    text: string;
    timestamp: number; // Unix timestamp (ms)
    id: string;
  }>;
  expected: string[]; // Expected order of history IDs
  description: string;
}

/**
 * Test cases for history search scoring
 */
export const historySearchTestCases: HistorySearchTestCase[] = [
  // === Match Quality vs Recency Balance ===
  {
    query: 'config',
    history: [
      {
        text: 'Update configuration settings',
        timestamp: Date.now() - 1 * 60 * 60 * 1000, // 1 hour ago
        id: 'recent-partial',
      },
      {
        text: 'config',
        timestamp: Date.now() - 7 * 24 * 60 * 60 * 1000, // 7 days ago
        id: 'old-exact',
      },
      {
        text: 'Check the config file for errors',
        timestamp: Date.now() - 30 * 60 * 1000, // 30 minutes ago
        id: 'very-recent-partial',
      },
    ],
    expected: [
      'very-recent-partial', // Very recent + good match quality
      'recent-partial', // Recent + partial match
      'old-exact', // Old but exact match
    ],
    description: 'Very recent items should rank high even with partial match',
  },

  // === Old but Highly Relevant Items ===
  {
    query: 'implement user authentication',
    history: [
      {
        text: 'implement user authentication with JWT tokens',
        timestamp: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 days ago
        id: 'old-perfect',
      },
      {
        text: 'user login implementation',
        timestamp: Date.now() - 2 * 60 * 60 * 1000, // 2 hours ago
        id: 'recent-partial',
      },
      {
        text: 'Fix bug in authentication flow',
        timestamp: Date.now() - 1 * 24 * 60 * 60 * 1000, // 1 day ago
        id: 'medium-partial',
      },
    ],
    expected: [
      'old-perfect', // High match quality despite age
      'medium-partial', // Medium recency + partial match
      'recent-partial', // Recent but weaker match
    ],
    description: 'Old items with very high match quality should still rank well',
  },

  // === Exact Match Priority ===
  {
    query: 'npm install',
    history: [
      {
        text: 'npm install dependencies',
        timestamp: Date.now() - 5 * 60 * 1000, // 5 minutes ago
        id: 'recent-prefix',
      },
      {
        text: 'npm install',
        timestamp: Date.now() - 10 * 24 * 60 * 60 * 1000, // 10 days ago
        id: 'old-exact',
      },
      {
        text: 'Run npm install after updating package.json',
        timestamp: Date.now() - 1 * 60 * 60 * 1000, // 1 hour ago
        id: 'recent-contains',
      },
    ],
    expected: [
      'old-exact', // Exact match trumps age
      'recent-prefix', // Very recent + prefix match
      'recent-contains', // Recent + contains match
    ],
    description: 'Exact match should rank highest even when old',
  },

  // === Recency Gradient ===
  {
    query: 'test',
    history: [
      {
        text: 'Run test suite',
        timestamp: Date.now() - 1 * 60 * 1000, // 1 minute ago
        id: 'very-recent',
      },
      {
        text: 'Fix test failures',
        timestamp: Date.now() - 1 * 60 * 60 * 1000, // 1 hour ago
        id: 'recent',
      },
      {
        text: 'Add test cases',
        timestamp: Date.now() - 1 * 24 * 60 * 60 * 1000, // 1 day ago
        id: 'medium',
      },
      {
        text: 'Update test configuration',
        timestamp: Date.now() - 7 * 24 * 60 * 60 * 1000, // 7 days ago
        id: 'old',
      },
    ],
    expected: [
      'very-recent', // Most recent
      'recent', // Recent
      'medium', // Medium age
      'old', // Oldest
    ],
    description: 'Items with similar match quality should be ordered by recency',
  },

  // === Word Boundary Match ===
  {
    query: 'mc',
    history: [
      {
        text: 'MyConfig class implementation',
        timestamp: Date.now() - 1 * 60 * 60 * 1000, // 1 hour ago
        id: 'camel-case',
      },
      {
        text: 'main-controller setup',
        timestamp: Date.now() - 30 * 60 * 1000, // 30 minutes ago
        id: 'word-boundary',
      },
      {
        text: 'microservice architecture',
        timestamp: Date.now() - 10 * 60 * 1000, // 10 minutes ago
        id: 'partial',
      },
    ],
    expected: [
      'word-boundary', // Recent + word boundary match
      'camel-case', // Camel case match
      'partial', // Very recent but weaker match
    ],
    description: 'Word boundary and camel case matches should rank well',
  },

  // === Long Text vs Short Text ===
  {
    query: 'fix bug',
    history: [
      {
        text: 'fix bug',
        timestamp: Date.now() - 2 * 60 * 60 * 1000, // 2 hours ago
        id: 'exact-short',
      },
      {
        text: 'fix bug in authentication module with proper error handling and validation',
        timestamp: Date.now() - 1 * 60 * 60 * 1000, // 1 hour ago
        id: 'prefix-long',
      },
      {
        text: 'Need to fix bug ASAP',
        timestamp: Date.now() - 30 * 60 * 1000, // 30 minutes ago
        id: 'contains-recent',
      },
    ],
    expected: [
      'exact-short', // Exact match preferred
      'contains-recent', // Very recent + contains
      'prefix-long', // Long text + prefix match
    ],
    description: 'Exact short match should rank higher than partial long match',
  },

  // === Case Insensitive Match ===
  {
    query: 'config',
    history: [
      {
        text: 'CONFIG settings updated',
        timestamp: Date.now() - 1 * 60 * 60 * 1000, // 1 hour ago
        id: 'uppercase',
      },
      {
        text: 'Configuration file changed',
        timestamp: Date.now() - 2 * 60 * 60 * 1000, // 2 hours ago
        id: 'mixed-case',
      },
      {
        text: 'config',
        timestamp: Date.now() - 3 * 60 * 60 * 1000, // 3 hours ago
        id: 'lowercase',
      },
    ],
    expected: [
      'uppercase', // Most recent + exact match (case insensitive)
      'lowercase', // Exact match (lowercase)
      'mixed-case', // Prefix match
    ],
    description: 'Case insensitive matching should work correctly',
  },

  // === Edge Case: Empty Query ===
  {
    query: '',
    history: [
      {
        text: 'First entry',
        timestamp: Date.now() - 3000, // 3 seconds ago
        id: 'third',
      },
      {
        text: 'Second entry',
        timestamp: Date.now() - 2000, // 2 seconds ago
        id: 'second',
      },
      {
        text: 'Third entry',
        timestamp: Date.now() - 1000, // 1 second ago
        id: 'first',
      },
    ],
    expected: [
      'first', // Most recent
      'second', // Second most recent
      'third', // Oldest
    ],
    description: 'Empty query should return all items sorted by recency',
  },

  // === Multi-Word Query ===
  {
    query: 'git commit message',
    history: [
      {
        text: 'git commit message format updated',
        timestamp: Date.now() - 1 * 60 * 60 * 1000, // 1 hour ago
        id: 'exact-prefix',
      },
      {
        text: 'Update commit message for git repository',
        timestamp: Date.now() - 30 * 60 * 1000, // 30 minutes ago
        id: 'all-words-scattered',
      },
      {
        text: 'git push with commit',
        timestamp: Date.now() - 10 * 60 * 1000, // 10 minutes ago
        id: 'partial-words',
      },
    ],
    expected: [
      'exact-prefix', // All words in order + prefix
      'all-words-scattered', // All words present + more recent
      'partial-words', // Some words + very recent
    ],
    description: 'Multi-word queries should prefer consecutive word matches',
  },

  // === Numeric Content ===
  {
    query: '123',
    history: [
      {
        text: 'Issue #123 resolved',
        timestamp: Date.now() - 1 * 60 * 60 * 1000, // 1 hour ago
        id: 'issue-number',
      },
      {
        text: 'Version 1.2.3 released',
        timestamp: Date.now() - 30 * 60 * 1000, // 30 minutes ago
        id: 'version',
      },
      {
        text: '123',
        timestamp: Date.now() - 2 * 60 * 60 * 1000, // 2 hours ago
        id: 'exact-number',
      },
    ],
    expected: [
      'exact-number', // Exact match
      'issue-number', // Contains match + recent
      'version', // Contains digits + most recent
    ],
    description: 'Numeric queries should match correctly',
  },
];
