/**
 * Slash command search test cases for scoring tests
 * Tests name vs description match priority and usage frequency bonus
 */

export interface SlashCommandTestCase {
  query: string;
  commands: Array<{
    name: string;
    description: string;
    usageCount?: number;
  }>;
  expected: string[]; // Expected order of command names
  description: string;
}

/**
 * Test cases for slash command search scoring
 */
export const slashCommandTestCases: SlashCommandTestCase[] = [
  // === Name Match vs Description Match ===
  {
    query: 'commit',
    commands: [
      { name: 'commit', description: 'Create a git commit' },
      { name: 'push', description: 'Push commits to remote' },
      { name: 'msg', description: 'Generate commit message' },
    ],
    expected: [
      'commit', // Exact name match
      'push', // Description contains 'commit'
      'msg', // Description contains 'commit'
    ],
    description: 'Name match should rank higher than description match',
  },

  {
    query: 'test',
    commands: [
      { name: 'test', description: 'Run test suite' },
      { name: 'coverage', description: 'Generate test coverage report' },
      { name: 'lint', description: 'Run linter' },
    ],
    expected: [
      'test', // Exact name match
      'coverage', // Description contains 'test'
      'lint', // No match
    ],
    description: 'Name match should be strongly preferred over description match',
  },

  // === Prefix Match Priority ===
  {
    query: 'com',
    commands: [
      { name: 'commit', description: 'Create commit' },
      { name: 'compile', description: 'Build project' },
      { name: 'compare', description: 'Compare branches' },
    ],
    expected: [
      'commit', // Prefix match (alphabetically first)
      'compare', // Prefix match
      'compile', // Prefix match
    ],
    description: 'Prefix matches should rank high, with alphabetical tiebreaker',
  },

  // === Usage Frequency Bonus ===
  {
    query: 'push',
    commands: [
      { name: 'push', description: 'Push to remote', usageCount: 100 },
      { name: 'push-force', description: 'Force push', usageCount: 5 },
      { name: 'pull', description: 'Pull from remote', usageCount: 50 },
    ],
    expected: [
      'push', // Exact match + high usage
      'push-force', // Prefix match + lower usage
      'pull', // No exact match
    ],
    description: 'Usage frequency should boost ranking for similar match quality',
  },

  {
    query: 'build',
    commands: [
      { name: 'build', description: 'Build project', usageCount: 10 },
      { name: 'rebuild', description: 'Clean and build', usageCount: 50 },
      { name: 'build-dev', description: 'Development build', usageCount: 2 },
    ],
    expected: [
      'build', // Exact match despite lower usage
      'rebuild', // High usage + contains match
      'build-dev', // Prefix match + low usage
    ],
    description: 'Exact match should still outweigh usage frequency bonus',
  },

  // === Camel Case Match ===
  {
    query: 'gc',
    commands: [
      { name: 'gitCommit', description: 'Create git commit' },
      { name: 'get-config', description: 'Get configuration' },
      { name: 'global-cache', description: 'Clear global cache' },
    ],
    expected: [
      'gitCommit', // Camel case match
      'get-config', // Word boundary match
      'global-cache', // Word boundary match
    ],
    description: 'Camel case match should be recognized and ranked high',
  },

  // === Short vs Long Names ===
  {
    query: 'run',
    commands: [
      { name: 'run', description: 'Execute command' },
      { name: 'run-tests', description: 'Run all tests' },
      { name: 'run-dev-server', description: 'Start dev server' },
    ],
    expected: [
      'run', // Exact match + shortest
      'run-tests', // Prefix match + medium length
      'run-dev-server', // Prefix match + longest
    ],
    description: 'Shorter names should be preferred when match quality is similar',
  },

  // === No Match Case ===
  {
    query: 'xyz',
    commands: [
      { name: 'commit', description: 'Create commit' },
      { name: 'push', description: 'Push to remote' },
      { name: 'pull', description: 'Pull from remote' },
    ],
    expected: [],
    description: 'Commands with no match should not be returned',
  },

  // === Combined: Name Match + High Usage ===
  {
    query: 'lint',
    commands: [
      { name: 'lint', description: 'Run linter', usageCount: 200 },
      { name: 'lint-fix', description: 'Auto-fix lint errors', usageCount: 150 },
      { name: 'format', description: 'Format code with linter', usageCount: 50 },
    ],
    expected: [
      'lint', // Exact name match + highest usage
      'lint-fix', // Prefix match + high usage
      'format', // Description match + lower usage
    ],
    description: 'Name match + high usage should rank highest',
  },

  // === Edge Case: Empty Query ===
  {
    query: '',
    commands: [
      { name: 'commit', description: 'Create commit', usageCount: 50 },
      { name: 'push', description: 'Push to remote', usageCount: 100 },
      { name: 'pull', description: 'Pull from remote', usageCount: 25 },
    ],
    expected: [
      'push', // Highest usage
      'commit', // Medium usage
      'pull', // Lowest usage
    ],
    description: 'Empty query should return commands sorted by usage frequency',
  },
];
