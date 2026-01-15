import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { calculateMatchScore, calculateAgentMatchScore } from '../../src/renderer/mentions/fuzzy-matcher';
import type { FileInfo } from '../../src/types/file-search';
import type { AgentItem } from '../../src/types/window';
import { FUZZY_MATCH_SCORES } from '../../src/constants';
import { USAGE_BONUS } from '../../src/lib/usage-bonus-calculator';

describe('fuzzy-matcher usage bonus integration', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // Set system time to a fixed point: 2024-01-15 12:00:00 UTC
    jest.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('calculateMatchScore with usageBonus', () => {
    test('should calculate base score without usageBonus (default 0)', () => {
      const file: FileInfo = {
        name: 'config',
        path: 'src/config',
        isDirectory: false
      };
      const queryLower = 'config';

      const score = calculateMatchScore(file, queryLower);

      // Exact match: 1000 + File bonus: 5 + Path bonus (based on depth)
      expect(score).toBeGreaterThanOrEqual(FUZZY_MATCH_SCORES.EXACT);
      expect(score).toBeLessThan(FUZZY_MATCH_SCORES.EXACT + 100); // No usage bonus
    });

    test('should add usageBonus=100 to base score', () => {
      const file: FileInfo = {
        name: 'config',
        path: 'src/config',
        isDirectory: false
      };
      const queryLower = 'config';
      const usageBonus = 100;

      const baseScore = calculateMatchScore(file, queryLower);
      const scoreWithBonus = calculateMatchScore(file, queryLower, usageBonus);

      expect(scoreWithBonus).toBe(baseScore + usageBonus);
    });

    test('should add usageBonus=50 to starts-with match', () => {
      const file: FileInfo = {
        name: 'configuration',
        path: 'src/configuration',
        isDirectory: false
      };
      const queryLower = 'config';
      const usageBonus = 50;

      const baseScore = calculateMatchScore(file, queryLower);
      const scoreWithBonus = calculateMatchScore(file, queryLower, usageBonus);

      expect(scoreWithBonus).toBe(baseScore + usageBonus);
      expect(scoreWithBonus).toBeGreaterThanOrEqual(FUZZY_MATCH_SCORES.STARTS_WITH + usageBonus);
    });

    test('should add usageBonus=150 to contains match', () => {
      const file: FileInfo = {
        name: 'app-config',
        path: 'src/app-config',
        isDirectory: false
      };
      const queryLower = 'config';
      const usageBonus = 150;

      const baseScore = calculateMatchScore(file, queryLower);
      const scoreWithBonus = calculateMatchScore(file, queryLower, usageBonus);

      expect(scoreWithBonus).toBe(baseScore + usageBonus);
      expect(scoreWithBonus).toBeGreaterThanOrEqual(FUZZY_MATCH_SCORES.CONTAINS + usageBonus);
    });

    test('should handle usageBonus=0 explicitly (same as default)', () => {
      const file: FileInfo = {
        name: 'index',
        path: 'src/index',
        isDirectory: false
      };
      const queryLower = 'index';

      const scoreDefault = calculateMatchScore(file, queryLower);
      const scoreExplicitZero = calculateMatchScore(file, queryLower, 0);

      expect(scoreExplicitZero).toBe(scoreDefault);
    });

    test('should work with directory items and usageBonus', () => {
      const directory: FileInfo = {
        name: 'components',
        path: 'src/components',
        isDirectory: true
      };

      const file: FileInfo = {
        name: 'components',
        path: 'src/components',
        isDirectory: false
      };

      const queryLower = 'components';
      const usageBonus = 75;

      const dirBaseScore = calculateMatchScore(directory, queryLower);
      const dirScoreWithBonus = calculateMatchScore(directory, queryLower, usageBonus);
      const fileBaseScore = calculateMatchScore(file, queryLower);

      expect(dirScoreWithBonus).toBe(dirBaseScore + usageBonus);
      // Directory should NOT have FILE_BONUS, so file score should be higher by exactly FILE_BONUS
      expect(fileBaseScore).toBe(dirBaseScore + FUZZY_MATCH_SCORES.FILE_BONUS);
    });
  });

  describe('calculateMatchScore with mtimeMs', () => {
    test('should add mtime bonus for recently modified file (within 24h)', () => {
      const now = Date.now();
      const twoHoursAgo = now - (2 * 60 * 60 * 1000); // 2 hours ago

      const fileWithMtime: FileInfo = {
        name: 'recent',
        path: 'src/recent',
        isDirectory: false,
        mtimeMs: twoHoursAgo
      };

      const fileWithoutMtime: FileInfo = {
        name: 'recent',
        path: 'src/recent',
        isDirectory: false
      };

      const queryLower = 'recent';

      const scoreWithMtime = calculateMatchScore(fileWithMtime, queryLower);
      const scoreWithoutMtime = calculateMatchScore(fileWithoutMtime, queryLower);

      // calculateFileMtimeBonus returns ~158 for 2 hours ago (exponential decay, 200 scale)
      // floor(200 * 2^(-2/6)) = floor(200 * 0.794) = 158
      const expectedMtimeBonus = 158;
      expect(scoreWithMtime).toBe(scoreWithoutMtime + expectedMtimeBonus);
    });

    test('should add reduced mtime bonus for file modified 3 days ago', () => {
      const now = Date.now();
      const threeDaysAgo = now - (3 * 24 * 60 * 60 * 1000); // 3 days ago

      const fileWithMtime: FileInfo = {
        name: 'old',
        path: 'src/old',
        isDirectory: false,
        mtimeMs: threeDaysAgo
      };

      const fileWithoutMtime: FileInfo = {
        name: 'old',
        path: 'src/old',
        isDirectory: false
      };

      const queryLower = 'old';

      const scoreWithMtime = calculateMatchScore(fileWithMtime, queryLower);
      const scoreWithoutMtime = calculateMatchScore(fileWithoutMtime, queryLower);

      // Should include reduced mtime bonus
      // At 3 days (72h): floor(200 * 2^(-72/6)) = floor(200 * 2^(-12)) = floor(200 * 0.000244) = 0
      // But using the decay formula, at 3 days it should be around floor(200 * 2^(-3/0.25)) ≈ 25
      const mtimeBonus = scoreWithMtime - scoreWithoutMtime;
      expect(mtimeBonus).toBeGreaterThan(0);
      expect(mtimeBonus).toBeLessThan(USAGE_BONUS.MAX_FILE_MTIME);
      expect(mtimeBonus).toBeGreaterThanOrEqual(20); // At 4 days (96h) = 20
    });

    test('should add no mtime bonus for file modified 7+ days ago', () => {
      const now = Date.now();
      const tenDaysAgo = now - (10 * 24 * 60 * 60 * 1000); // 10 days ago

      const fileWithOldMtime: FileInfo = {
        name: 'ancient',
        path: 'src/ancient',
        isDirectory: false,
        mtimeMs: tenDaysAgo
      };

      const fileWithoutMtime: FileInfo = {
        name: 'ancient',
        path: 'src/ancient',
        isDirectory: false
      };

      const queryLower = 'ancient';

      const scoreWithOldMtime = calculateMatchScore(fileWithOldMtime, queryLower);
      const scoreWithoutMtime = calculateMatchScore(fileWithoutMtime, queryLower);

      // Old mtime should give 0 bonus, same as no mtime
      expect(scoreWithOldMtime).toBe(scoreWithoutMtime);
    });

    test('should not add mtime bonus when mtimeMs is undefined', () => {
      const file: FileInfo = {
        name: 'no-mtime',
        path: 'src/no-mtime',
        isDirectory: false
        // mtimeMs is undefined
      };
      const queryLower = 'no-mtime';

      const score = calculateMatchScore(file, queryLower);

      // Should only include exact match + file bonus + path bonus (no mtime bonus)
      const expectedMaxScore = FUZZY_MATCH_SCORES.EXACT + FUZZY_MATCH_SCORES.FILE_BONUS + FUZZY_MATCH_SCORES.MAX_PATH_BONUS + 1;
      expect(score).toBeLessThan(expectedMaxScore);
    });
  });

  describe('calculateMatchScore with combined bonuses', () => {
    test('should combine usageBonus and mtimeMs bonuses', () => {
      const now = Date.now();
      const recentTime = now - (1 * 60 * 60 * 1000); // 1 hour ago

      const fileWithMtime: FileInfo = {
        name: 'popular',
        path: 'src/popular',
        isDirectory: false,
        mtimeMs: recentTime
      };

      const fileWithoutMtime: FileInfo = {
        name: 'popular',
        path: 'src/popular',
        isDirectory: false
      };

      const queryLower = 'popular';
      const usageBonus = 100;

      const scoreWithBothBonuses = calculateMatchScore(fileWithMtime, queryLower, usageBonus);
      const scoreWithoutBonuses = calculateMatchScore(fileWithoutMtime, queryLower, 0);

      // Should add both usage bonus (100) and mtime bonus
      // 1h ago exponential bonus: floor(200 * 2^(-1/6)) = 178
      const expectedMtimeBonus = 178;
      expect(scoreWithBothBonuses).toBe(scoreWithoutBonuses + usageBonus + expectedMtimeBonus);
    });

    test('should combine usageBonus with reduced mtimeMs bonus', () => {
      const now = Date.now();
      const oldTime = now - (20 * 24 * 60 * 60 * 1000); // 20 days ago

      const file: FileInfo = {
        name: 'semi-old',
        path: 'src/semi-old',
        isDirectory: false,
        mtimeMs: oldTime
      };
      const queryLower = 'semi-old';
      const usageBonus = 75;

      const scoreWithBonuses = calculateMatchScore(file, queryLower, usageBonus);
      const scoreWithoutUsageBonus = calculateMatchScore(file, queryLower, 0);

      // Should add usage bonus (75) + no mtime bonus (20 days is beyond TTL)
      // The mtime bonus is 0 for files beyond 7-day TTL
      const difference = scoreWithBonuses - scoreWithoutUsageBonus;
      expect(difference).toBe(usageBonus); // Only usage bonus, no mtime bonus
    });
  });

  describe('calculateAgentMatchScore with usageBonus', () => {
    test('should calculate base score without usageBonus (default 0)', () => {
      const agent: AgentItem = {
        name: 'claude',
        description: 'AI assistant',
        filePath: '/agents/claude.md'
      };
      const queryLower = 'claude';

      const score = calculateAgentMatchScore(agent, queryLower);

      // Exact match: 1000
      expect(score).toBe(FUZZY_MATCH_SCORES.EXACT);
    });

    test('should add usageBonus=100 to exact match', () => {
      const agent: AgentItem = {
        name: 'codex',
        description: 'Code review agent',
        filePath: '/agents/codex.md'
      };
      const queryLower = 'codex';
      const usageBonus = 100;

      const baseScore = calculateAgentMatchScore(agent, queryLower);
      const scoreWithBonus = calculateAgentMatchScore(agent, queryLower, usageBonus);

      expect(baseScore).toBe(FUZZY_MATCH_SCORES.EXACT);
      expect(scoreWithBonus).toBe(FUZZY_MATCH_SCORES.EXACT + usageBonus);
    });

    test('should add usageBonus=50 to starts-with match', () => {
      const agent: AgentItem = {
        name: 'code-reviewer',
        description: 'Reviews your code',
        filePath: '/agents/code-reviewer.md'
      };
      const queryLower = 'code';
      const usageBonus = 50;

      const baseScore = calculateAgentMatchScore(agent, queryLower);
      const scoreWithBonus = calculateAgentMatchScore(agent, queryLower, usageBonus);

      expect(baseScore).toBe(FUZZY_MATCH_SCORES.STARTS_WITH);
      expect(scoreWithBonus).toBe(FUZZY_MATCH_SCORES.STARTS_WITH + usageBonus);
    });

    test('should add usageBonus=150 to contains match', () => {
      const agent: AgentItem = {
        name: 'test-code-helper',
        description: 'Helps with testing',
        filePath: '/agents/test-code-helper.md'
      };
      const queryLower = 'code';
      const usageBonus = 150;

      const baseScore = calculateAgentMatchScore(agent, queryLower);
      const scoreWithBonus = calculateAgentMatchScore(agent, queryLower, usageBonus);

      expect(baseScore).toBe(FUZZY_MATCH_SCORES.CONTAINS);
      expect(scoreWithBonus).toBe(FUZZY_MATCH_SCORES.CONTAINS + usageBonus);
    });

    test('should add usageBonus=75 to description match', () => {
      const agent: AgentItem = {
        name: 'helper',
        description: 'A friendly code assistant',
        filePath: '/agents/helper.md'
      };
      const queryLower = 'code';
      const usageBonus = 75;

      const baseScore = calculateAgentMatchScore(agent, queryLower);
      const scoreWithBonus = calculateAgentMatchScore(agent, queryLower, usageBonus);

      expect(baseScore).toBe(FUZZY_MATCH_SCORES.PATH_CONTAINS);
      expect(scoreWithBonus).toBe(FUZZY_MATCH_SCORES.PATH_CONTAINS + usageBonus);
    });

    test('should return AGENT_BASE when query is empty (usageBonus not applied)', () => {
      const agent: AgentItem = {
        name: 'any-agent',
        description: 'Any description',
        filePath: '/agents/any-agent.md'
      };
      const queryLower = '';
      const usageBonus = 100;

      const scoreWithoutBonus = calculateAgentMatchScore(agent, queryLower);
      const scoreWithBonus = calculateAgentMatchScore(agent, queryLower, usageBonus);

      // Note: Current implementation returns AGENT_BASE immediately for empty query,
      // without adding usageBonus. This is a known limitation.
      expect(scoreWithoutBonus).toBe(FUZZY_MATCH_SCORES.AGENT_BASE);
      expect(scoreWithBonus).toBe(FUZZY_MATCH_SCORES.AGENT_BASE); // usageBonus not added
    });

    test('should handle usageBonus=0 explicitly (same as default)', () => {
      const agent: AgentItem = {
        name: 'test-agent',
        description: 'Test description',
        filePath: '/agents/test-agent.md'
      };
      const queryLower = 'test';

      const scoreDefault = calculateAgentMatchScore(agent, queryLower);
      const scoreExplicitZero = calculateAgentMatchScore(agent, queryLower, 0);

      expect(scoreExplicitZero).toBe(scoreDefault);
    });
  });

  describe('sorting with usage bonuses', () => {
    test('should rank files with higher usageBonus above same match type', () => {
      const file1: FileInfo = {
        name: 'config.ts',
        path: 'src/config.ts',
        isDirectory: false
      };

      const file2: FileInfo = {
        name: 'config.js',
        path: 'lib/config.js',
        isDirectory: false
      };

      const queryLower = 'config';
      const highUsageBonus = 150;
      const lowUsageBonus = 10;

      const score1 = calculateMatchScore(file1, queryLower, highUsageBonus);
      const score2 = calculateMatchScore(file2, queryLower, lowUsageBonus);

      // Both have exact match, but file1 has higher usage bonus
      expect(score1).toBeGreaterThan(score2);
    });

    test('should allow high usageBonus to overcome lower match quality', () => {
      const exactMatchFile: FileInfo = {
        name: 'test',
        path: 'src/test',
        isDirectory: false
      };

      const startsWithFile: FileInfo = {
        name: 'testing',
        path: 'src/testing',
        isDirectory: false
      };

      const queryLower = 'test';
      const noBonus = 0;
      const highBonus = 600; // Enough to overcome exact vs starts-with difference (1000 - 500 = 500)

      const exactScore = calculateMatchScore(exactMatchFile, queryLower, noBonus);
      const startsWithScore = calculateMatchScore(startsWithFile, queryLower, highBonus);

      // High usage bonus on starts-with should beat exact match with no bonus
      expect(startsWithScore).toBeGreaterThan(exactScore);
    });

    test('should allow mtime bonus to influence ranking between equal matches', () => {
      const now = Date.now();
      const recentTime = now - (1 * 60 * 60 * 1000); // 1 hour ago
      const oldTime = now - (60 * 24 * 60 * 60 * 1000); // 60 days ago

      const recentFile: FileInfo = {
        name: 'utils.ts',
        path: 'src/utils.ts',
        isDirectory: false,
        mtimeMs: recentTime
      };

      const oldFile: FileInfo = {
        name: 'utils.js',
        path: 'lib/utils.js',
        isDirectory: false,
        mtimeMs: oldTime
      };

      const queryLower = 'utils';

      const recentScore = calculateMatchScore(recentFile, queryLower);
      const oldScore = calculateMatchScore(oldFile, queryLower);

      // Recent file should rank higher due to mtime bonus
      expect(recentScore).toBeGreaterThan(oldScore);
    });

    test('should combine multiple bonuses for strong ranking signals', () => {
      const now = Date.now();
      const recentTime = now - (1 * 60 * 60 * 1000); // 1 hour ago

      const popularRecentFile: FileInfo = {
        name: 'index.ts',
        path: 'src/index.ts',
        isDirectory: false,
        mtimeMs: recentTime
      };

      const unpopularOldFile: FileInfo = {
        name: 'index.js',
        path: 'old/deep/nested/index.js',
        isDirectory: false,
        mtimeMs: now - (100 * 24 * 60 * 60 * 1000) // 100 days ago
      };

      const queryLower = 'index';
      const highUsageBonus = 150;
      const noUsageBonus = 0;

      const popularScore = calculateMatchScore(popularRecentFile, queryLower, highUsageBonus);
      const unpopularScore = calculateMatchScore(unpopularOldFile, queryLower, noUsageBonus);

      // Popular + recent should significantly outrank unpopular + old
      expect(popularScore).toBeGreaterThan(unpopularScore + 100);
    });

    test('should rank agents with higher usageBonus above same match type', () => {
      const agent1: AgentItem = {
        name: 'claude',
        description: 'AI assistant',
        filePath: '/agents/claude.md'
      };

      const agent2: AgentItem = {
        name: 'claude-pro',
        description: 'Pro version',
        filePath: '/agents/claude-pro.md'
      };

      const queryLower = 'claude';
      const highUsageBonus = 150;
      const lowUsageBonus = 10;

      const score1 = calculateAgentMatchScore(agent1, queryLower, highUsageBonus);
      const score2 = calculateAgentMatchScore(agent2, queryLower, lowUsageBonus);

      // agent1: exact match (1000) + high bonus (150) = 1150
      // agent2: starts-with (500) + low bonus (10) = 510
      expect(score1).toBeGreaterThan(score2);
    });
  });

  describe('edge cases and boundary conditions', () => {
    test('should handle very large usageBonus values', () => {
      const file: FileInfo = {
        name: 'test.ts',
        path: 'test.ts',
        isDirectory: false
      };
      const queryLower = 'test';
      const veryLargeBonus = 10000;

      const score = calculateMatchScore(file, queryLower, veryLargeBonus);

      expect(score).toBeGreaterThan(10000);
    });

    test('should handle negative usageBonus gracefully', () => {
      const file: FileInfo = {
        name: 'test.ts',
        path: 'test.ts',
        isDirectory: false
      };
      const queryLower = 'test';
      const negativeBonus = -50;

      const baseScore = calculateMatchScore(file, queryLower, 0);
      const scoreWithNegative = calculateMatchScore(file, queryLower, negativeBonus);

      // Negative bonus should reduce score
      expect(scoreWithNegative).toBe(baseScore + negativeBonus);
      expect(scoreWithNegative).toBeLessThan(baseScore);
    });

    test('should handle fractional usageBonus values', () => {
      const file: FileInfo = {
        name: 'test.ts',
        path: 'test.ts',
        isDirectory: false
      };
      const queryLower = 'test';
      const fractionalBonus = 25.5;

      const baseScore = calculateMatchScore(file, queryLower, 0);
      const scoreWithFractional = calculateMatchScore(file, queryLower, fractionalBonus);

      expect(scoreWithFractional).toBe(baseScore + fractionalBonus);
    });

    test('should handle zero mtimeMs (epoch time)', () => {
      const file: FileInfo = {
        name: 'ancient.ts',
        path: 'ancient.ts',
        isDirectory: false,
        mtimeMs: 0 // Unix epoch
      };
      const queryLower = 'ancient';

      const score = calculateMatchScore(file, queryLower);

      // Should work without errors, mtime bonus will be 0 for such old files
      expect(score).toBeGreaterThan(0);
    });

    test('should handle future mtimeMs gracefully', () => {
      const now = Date.now();
      const futureTime = now + (24 * 60 * 60 * 1000); // 1 day in future

      const fileWithFutureMtime: FileInfo = {
        name: 'future',
        path: 'future',
        isDirectory: false,
        mtimeMs: futureTime
      };

      const fileWithoutMtime: FileInfo = {
        name: 'future',
        path: 'future',
        isDirectory: false
      };

      const queryLower = 'future';

      const scoreWithFutureMtime = calculateMatchScore(fileWithFutureMtime, queryLower);
      const scoreWithoutMtime = calculateMatchScore(fileWithoutMtime, queryLower);

      // calculateFileMtimeBonus returns MAX_FILE_MTIME (200) for future times
      const MAX_MTIME_BONUS = 200;
      expect(scoreWithFutureMtime).toBe(scoreWithoutMtime + MAX_MTIME_BONUS);
    });
  });
});
