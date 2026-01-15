/**
 * Symbol search test cases for scoring tests
 * Tests camel case priority, recently edited file symbols, and language-specific filtering
 */

export interface SymbolSearchTestCase {
  query: string;
  symbols: Array<{
    name: string;
    type: string; // function, class, interface, etc.
    filePath: string;
    language: string;
    lastModified?: number; // Unix timestamp (ms)
  }>;
  expected: string[]; // Expected order of symbol names
  description: string;
  language?: string; // Optional language filter
}

/**
 * Test cases for symbol search scoring
 */
export const symbolSearchTestCases: SymbolSearchTestCase[] = [
  // === Camel Case Priority ===
  {
    query: 'mc',
    symbols: [
      {
        name: 'MyConfig',
        type: 'class',
        filePath: 'src/config/MyConfig.ts',
        language: 'typescript',
      },
      {
        name: 'matchCase',
        type: 'function',
        filePath: 'src/utils/string.ts',
        language: 'typescript',
      },
      {
        name: 'main_controller',
        type: 'class',
        filePath: 'src/controller.py',
        language: 'python',
      },
    ],
    expected: [
      'MyConfig', // Camel case match at start
      'matchCase', // Camel case match in middle
      'main_controller', // Word boundary match
    ],
    description: 'Camel case match (MyConfig) should rank higher than other patterns',
  },

  {
    query: 'hm',
    symbols: [
      {
        name: 'HistoryManager',
        type: 'class',
        filePath: 'src/managers/HistoryManager.ts',
        language: 'typescript',
      },
      {
        name: 'handleMessage',
        type: 'method',
        filePath: 'src/handlers/message.ts',
        language: 'typescript',
      },
      {
        name: 'http_method',
        type: 'variable',
        filePath: 'src/http/client.go',
        language: 'go',
      },
    ],
    expected: [
      'HistoryManager', // Exact camel case match
      'handleMessage', // Camel case match
      'http_method', // Underscore match
    ],
    description: 'Camel case symbols should consistently rank higher',
  },

  // === Recently Edited File Symbols Priority ===
  {
    query: 'config',
    symbols: [
      {
        name: 'OldConfig',
        type: 'class',
        filePath: 'src/old-config.ts',
        language: 'typescript',
        lastModified: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 days old
      },
      {
        name: 'Config',
        type: 'interface',
        filePath: 'src/config.ts',
        language: 'typescript',
        lastModified: Date.now() - 1 * 60 * 60 * 1000, // 1 hour ago
      },
      {
        name: 'NewConfig',
        type: 'class',
        filePath: 'src/new-config.ts',
        language: 'typescript',
        lastModified: Date.now() - 10 * 60 * 1000, // 10 minutes ago
      },
    ],
    expected: [
      'NewConfig', // Most recently edited file
      'Config', // Recently edited file
      'OldConfig', // Old file
    ],
    description: 'Symbols from recently edited files should rank higher',
  },

  // === Language-Specific Filtering ===
  {
    query: 'handler',
    language: 'typescript',
    symbols: [
      {
        name: 'Handler',
        type: 'interface',
        filePath: 'src/handler.ts',
        language: 'typescript',
      },
      {
        name: 'handler',
        type: 'function',
        filePath: 'src/handler.go',
        language: 'go',
      },
      {
        name: 'handleRequest',
        type: 'method',
        filePath: 'src/request.ts',
        language: 'typescript',
      },
    ],
    expected: [
      'Handler', // TypeScript + exact match
      'handleRequest', // TypeScript + partial match
      // 'handler' should be filtered out (Go)
    ],
    description: 'Language filter should exclude non-matching languages',
  },

  {
    query: 'parse',
    language: 'go',
    symbols: [
      {
        name: 'Parse',
        type: 'function',
        filePath: 'pkg/parser/parse.go',
        language: 'go',
      },
      {
        name: 'parseJSON',
        type: 'function',
        filePath: 'src/json.ts',
        language: 'typescript',
      },
      {
        name: 'Parser',
        type: 'struct',
        filePath: 'pkg/parser/parser.go',
        language: 'go',
      },
    ],
    expected: [
      'Parse', // Go + exact match
      'Parser', // Go + contains match
      // 'parseJSON' should be filtered out (TypeScript)
    ],
    description: 'Go language filter should only return Go symbols',
  },

  // === Symbol Type Priority ===
  {
    query: 'user',
    symbols: [
      {
        name: 'User',
        type: 'interface',
        filePath: 'src/types/user.ts',
        language: 'typescript',
      },
      {
        name: 'User',
        type: 'class',
        filePath: 'src/models/user.ts',
        language: 'typescript',
      },
      {
        name: 'getUser',
        type: 'function',
        filePath: 'src/api/user.ts',
        language: 'typescript',
      },
    ],
    expected: [
      'User', // Exact match (interface or class - both equal priority)
      'User', // Exact match (the other one)
      'getUser', // Prefix match
    ],
    description: 'Exact matches should rank higher regardless of symbol type',
  },

  // === File Path Depth ===
  {
    query: 'manager',
    symbols: [
      {
        name: 'Manager',
        type: 'class',
        filePath: 'src/manager.ts',
        language: 'typescript',
      },
      {
        name: 'Manager',
        type: 'class',
        filePath: 'src/core/manager.ts',
        language: 'typescript',
      },
      {
        name: 'Manager',
        type: 'class',
        filePath: 'src/modules/advanced/manager.ts',
        language: 'typescript',
      },
    ],
    expected: [
      'Manager', // Shortest path
      'Manager', // Medium path
      'Manager', // Longest path
    ],
    description: 'Symbols from shorter paths should rank higher when names match',
  },

  // === Multi-Language Results ===
  {
    query: 'config',
    symbols: [
      {
        name: 'Config',
        type: 'interface',
        filePath: 'src/config.ts',
        language: 'typescript',
      },
      {
        name: 'Config',
        type: 'struct',
        filePath: 'pkg/config/config.go',
        language: 'go',
      },
      {
        name: 'Configuration',
        type: 'class',
        filePath: 'src/configuration.py',
        language: 'python',
      },
    ],
    expected: [
      'Config', // Exact match (TypeScript)
      'Config', // Exact match (Go)
      'Configuration', // Prefix match (Python)
    ],
    description: 'Multi-language results should be ordered by match quality',
  },

  // === Exact Match vs Partial Match ===
  {
    query: 'test',
    symbols: [
      {
        name: 'test',
        type: 'function',
        filePath: 'src/test.ts',
        language: 'typescript',
      },
      {
        name: 'TestCase',
        type: 'class',
        filePath: 'src/test-case.ts',
        language: 'typescript',
      },
      {
        name: 'runTests',
        type: 'function',
        filePath: 'src/runner.ts',
        language: 'typescript',
      },
    ],
    expected: [
      'test', // Exact match
      'TestCase', // Prefix match (camel case)
      'runTests', // Contains match
    ],
    description: 'Exact match should rank highest',
  },

  // === Underscore vs Camel Case ===
  {
    query: 'fs',
    symbols: [
      {
        name: 'FileSystem',
        type: 'class',
        filePath: 'src/fs/FileSystem.ts',
        language: 'typescript',
      },
      {
        name: 'file_system',
        type: 'module',
        filePath: 'src/fs/__init__.py',
        language: 'python',
      },
      {
        name: 'fs',
        type: 'variable',
        filePath: 'src/index.ts',
        language: 'typescript',
      },
    ],
    expected: [
      'fs', // Exact match
      'FileSystem', // Camel case match
      'file_system', // Underscore match
    ],
    description: 'Exact match should trump camel case and underscore patterns',
  },

  // === Combined: Recency + Camel Case ===
  {
    query: 'db',
    symbols: [
      {
        name: 'DatabaseManager',
        type: 'class',
        filePath: 'src/database.ts',
        language: 'typescript',
        lastModified: Date.now() - 1 * 60 * 60 * 1000, // 1 hour ago
      },
      {
        name: 'dbConnection',
        type: 'variable',
        filePath: 'src/db.ts',
        language: 'typescript',
        lastModified: Date.now() - 10 * 60 * 1000, // 10 minutes ago
      },
      {
        name: 'debug',
        type: 'function',
        filePath: 'src/logger.ts',
        language: 'typescript',
        lastModified: Date.now() - 2 * 60 * 60 * 1000, // 2 hours ago
      },
    ],
    expected: [
      'dbConnection', // Most recent + prefix match
      'DatabaseManager', // Camel case match + recent
      'debug', // Prefix match + older
    ],
    description: 'Recency should combine with match quality',
  },

  // === Edge Case: Empty Query ===
  {
    query: '',
    symbols: [
      {
        name: 'Alpha',
        type: 'class',
        filePath: 'src/alpha.ts',
        language: 'typescript',
        lastModified: Date.now() - 3000,
      },
      {
        name: 'Beta',
        type: 'class',
        filePath: 'src/beta.ts',
        language: 'typescript',
        lastModified: Date.now() - 2000,
      },
      {
        name: 'Gamma',
        type: 'class',
        filePath: 'src/gamma.ts',
        language: 'typescript',
        lastModified: Date.now() - 1000,
      },
    ],
    expected: [
      'Gamma', // Most recent
      'Beta', // Medium recency
      'Alpha', // Oldest
    ],
    description: 'Empty query should return symbols sorted by file recency',
  },

  // === Special Characters ===
  {
    query: 'get_user',
    symbols: [
      {
        name: 'get_user',
        type: 'function',
        filePath: 'src/api.py',
        language: 'python',
      },
      {
        name: 'getUser',
        type: 'method',
        filePath: 'src/api.ts',
        language: 'typescript',
      },
      {
        name: 'GetUser',
        type: 'function',
        filePath: 'pkg/api/user.go',
        language: 'go',
      },
    ],
    expected: [
      'get_user', // Exact match
      'getUser', // Camel case variant
      'GetUser', // Pascal case variant
    ],
    description: 'Exact match including underscores should rank highest',
  },
];
