# Scoring Test Cases

This directory contains test case fixtures for scoring algorithm tests across different search types.

## Files

### `file-search-cases.ts`
Test cases for file search scoring, covering:
- **Camel case priority**: `mc` → `MyConfig.ts` > `my-config.ts`
- **Recently edited file priority**: Newer files rank higher
- **Usage frequency consideration**: Frequently used files get bonus
- **Path length preference**: Shorter paths preferred
- **Basename priority**: Basename matches > directory matches

**Usage:**
```typescript
import { fileSearchTestCases } from './tests/fixtures/scoring';

fileSearchTestCases.forEach(testCase => {
  // testCase.query - search query
  // testCase.files - array of file objects with path, lastModified, usageCount
  // testCase.expected - expected order of file paths
  // testCase.description - human-readable description
});
```

### `slash-command-cases.ts`
Test cases for slash command search scoring, covering:
- **Name vs description match priority**: Name matches rank higher
- **Prefix match priority**: Commands starting with query rank high
- **Usage frequency bonus**: High usage boosts ranking
- **Camel case matching**: Recognizes camelCase patterns
- **Name length tiebreaker**: Shorter names preferred

**Usage:**
```typescript
import { slashCommandTestCases } from './tests/fixtures/scoring';

slashCommandTestCases.forEach(testCase => {
  // testCase.query - search query
  // testCase.commands - array of command objects with name, description, usageCount
  // testCase.expected - expected order of command names
  // testCase.description - human-readable description
});
```

### `history-search-cases.ts`
Test cases for history search scoring, covering:
- **Match quality vs recency balance**: Recent items with good matches rank high
- **Old but highly relevant items**: High match quality compensates for age
- **Exact match priority**: Exact matches rank highest
- **Recency gradient**: Similar matches ordered by timestamp
- **Multi-word queries**: Consecutive word matches preferred

**Usage:**
```typescript
import { historySearchTestCases } from './tests/fixtures/scoring';

historySearchTestCases.forEach(testCase => {
  // testCase.query - search query
  // testCase.history - array of history entries with text, timestamp, id
  // testCase.expected - expected order of history IDs
  // testCase.description - human-readable description
});
```

### `symbol-search-cases.ts`
Test cases for symbol (code) search scoring, covering:
- **Camel case priority**: `mc` → `MyConfig` > `matchCase`
- **Recently edited file symbols priority**: Symbols from recent files rank higher
- **Language-specific filtering**: Filter by programming language
- **Symbol type consideration**: Interface, class, function, etc.
- **Path depth tiebreaker**: Shorter paths preferred

**Usage:**
```typescript
import { symbolSearchTestCases } from './tests/fixtures/scoring';

symbolSearchTestCases.forEach(testCase => {
  // testCase.query - search query
  // testCase.symbols - array of symbol objects with name, type, filePath, language, lastModified
  // testCase.expected - expected order of symbol names
  // testCase.description - human-readable description
  // testCase.language - optional language filter
});
```

### `real-data-loader.ts`
Utilities for loading real user data from `~/.prompt-line` for realistic testing:
- `loadRealTestData()` - Loads history, file usage, slash commands, and agents
- `getHistoryStats()` - Calculates statistics on history data
- `loadJsonl()` - Generic JSONL file loader

**Usage:**
```typescript
import { loadRealTestData, getHistoryStats } from './tests/fixtures/scoring';

const realData = await loadRealTestData();
const stats = getHistoryStats(realData.history);

console.log(`Total history entries: ${stats.total}`);
console.log(`Last 24h: ${stats.last24h}`);
console.log(`Average text length: ${stats.avgTextLength}`);
```

## Design Principles

All test cases follow these principles:

1. **KISS (Keep It Simple, Stupid)**: Minimal, realistic data
2. **Realistic scenarios**: Based on actual use cases
3. **Clear expectations**: Each test has explicit expected order
4. **Descriptive names**: Test case descriptions explain what's being tested
5. **Balanced coverage**: Mix of edge cases and common scenarios

## Test Case Structure

Each test case includes:
- `query`: The search query string
- Input data specific to search type (files, commands, history, symbols)
- `expected`: Array of expected results in order
- `description`: Human-readable explanation of what's being tested

## Usage in Tests

```typescript
import {
  fileSearchTestCases,
  slashCommandTestCases,
  historySearchTestCases,
  symbolSearchTestCases
} from './tests/fixtures/scoring';

describe('FzfScorer with file search', () => {
  fileSearchTestCases.forEach(testCase => {
    it(testCase.description, () => {
      // Test implementation
      const results = scorer.scoreFiles(testCase.query, testCase.files);
      const resultPaths = results.map(r => r.path);
      expect(resultPaths).toEqual(testCase.expected);
    });
  });
});
```

## Adding New Test Cases

To add new test cases:

1. Choose the appropriate file based on search type
2. Follow the existing interface structure
3. Provide realistic data
4. Include clear `expected` order
5. Write descriptive `description`
6. Keep it minimal (KISS principle)

## Related Files

- `/src/lib/fzf-scorer.ts` - Main scoring algorithm
- `/tests/unit/fzf-scorer.test.ts` - Unit tests for scorer
- `/.claude/artifact/202601150329-impl-fzf-search-plan.md` - Implementation plan
