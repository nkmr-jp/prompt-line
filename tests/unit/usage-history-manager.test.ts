import { describe, test, expect, beforeEach, jest, afterEach } from '@jest/globals';
import { UsageHistoryManager } from '../../src/managers/usage-history-manager';
import fs from 'fs/promises';

// Mock fs/promises module
jest.mock('fs/promises', () => ({
  default: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
  },
  readFile: jest.fn(),
  writeFile: jest.fn(),
}));

// Mock path module
jest.mock('path', () => ({
  dirname: jest.fn((p: string) => {
    const parts = p.split('/');
    parts.pop();
    return parts.join('/');
  }),
  join: jest.fn((...args: string[]) => args.join('/')),
}));

// Mock the logger
jest.mock('../../src/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock file-utils
jest.mock('../../src/utils/file-utils', () => ({
  ensureDir: jest.fn(() => Promise.resolve()),
}));

// Mock usage bonus calculator
jest.mock('../../src/lib/usage-bonus-calculator', () => ({
  calculateFrequencyBonus: jest.fn((count: number) => {
    if (count <= 0) return 0;
    const logCount = Math.log10(count + 1);
    const bonus = Math.floor(logCount * 50);
    return Math.min(bonus, 100);
  }),
  calculateUsageRecencyBonus: jest.fn((lastUsed: number) => {
    const now = Date.now();
    const age = now - lastUsed;
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    const TTL_DAYS = 7;

    if (age < ONE_DAY_MS) {
      return 50;
    }

    const ttlMs = TTL_DAYS * ONE_DAY_MS;
    if (age > ttlMs) {
      return 0;
    }

    const ratio = 1 - (age - ONE_DAY_MS) / (ttlMs - ONE_DAY_MS);
    return Math.floor(ratio * 50);
  }),
}));

const mockedFs = jest.mocked(fs);

describe('UsageHistoryManager', () => {
  let manager: UsageHistoryManager;
  const testFilePath = '/test/usage-history.jsonl';

  beforeEach(() => {
    jest.clearAllMocks();
    // Use fake timers for time-based testing
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-15T12:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('constructor', () => {
    test('should initialize with default config', () => {
      manager = new UsageHistoryManager(testFilePath);
      expect(manager).toBeDefined();
    });

    test('should initialize with custom config', () => {
      manager = new UsageHistoryManager(testFilePath, {
        maxEntries: 100,
        ttlDays: 7,
      });
      expect(manager).toBeDefined();
    });
  });

  describe('initialize()', () => {
    test('should load entries from JSONL file into cache', async () => {
      manager = new UsageHistoryManager(testFilePath);

      const mockContent = [
        '{"key":"test1","count":5,"lastUsed":1705320000000,"firstUsed":1705233600000}',
        '{"key":"test2","count":3,"lastUsed":1705319000000,"firstUsed":1705232600000}',
      ].join('\n');

      mockedFs.readFile.mockResolvedValue(mockContent as any);

      await manager.initialize();

      const entry1 = manager.getEntry('test1');
      const entry2 = manager.getEntry('test2');

      expect(entry1).toEqual({
        key: 'test1',
        count: 5,
        lastUsed: 1705320000000,
        firstUsed: 1705233600000,
      });

      expect(entry2).toEqual({
        key: 'test2',
        count: 3,
        lastUsed: 1705319000000,
        firstUsed: 1705232600000,
      });
    });

    test('should handle file not found (ENOENT) gracefully', async () => {
      manager = new UsageHistoryManager(testFilePath);

      const error = new Error('File not found') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      mockedFs.readFile.mockRejectedValue(error);

      await manager.initialize();

      expect(manager.getAllEntries()).toEqual([]);
    });

    test('should skip invalid JSON lines', async () => {
      manager = new UsageHistoryManager(testFilePath);

      const mockContent = [
        '{"key":"test1","count":5,"lastUsed":1705320000000,"firstUsed":1705233600000}',
        'invalid json line',
        '{"key":"test2","count":3,"lastUsed":1705319000000,"firstUsed":1705232600000}',
        '',
        'another invalid line',
      ].join('\n');

      mockedFs.readFile.mockResolvedValue(mockContent as any);

      await manager.initialize();

      const entries = manager.getAllEntries();
      expect(entries).toHaveLength(2);
      expect(entries.map((e) => e.key)).toEqual(expect.arrayContaining(['test1', 'test2']));
    });

    test('should only initialize once', async () => {
      manager = new UsageHistoryManager(testFilePath);

      mockedFs.readFile.mockResolvedValue('{"key":"test","count":1,"lastUsed":1705320000000,"firstUsed":1705320000000}' as any);

      await manager.initialize();
      await manager.initialize();
      await manager.initialize();

      expect(mockedFs.readFile).toHaveBeenCalledTimes(1);
    });

    test('should throw error on non-ENOENT file errors', async () => {
      manager = new UsageHistoryManager(testFilePath);

      const error = new Error('Permission denied') as NodeJS.ErrnoException;
      error.code = 'EACCES';
      mockedFs.readFile.mockRejectedValue(error);

      await expect(manager.initialize()).rejects.toThrow();
    });
  });

  describe('recordUsage()', () => {
    beforeEach(() => {
      manager = new UsageHistoryManager(testFilePath);
      mockedFs.readFile.mockResolvedValue('' as any);
      mockedFs.writeFile.mockResolvedValue(undefined as any);
    });

    test('should create new entry for first usage', async () => {
      await manager.recordUsage('test-key');

      const entry = manager.getEntry('test-key');
      expect(entry).toEqual({
        key: 'test-key',
        count: 1,
        lastUsed: Date.now(),
        firstUsed: Date.now(),
      });

      expect(mockedFs.writeFile).toHaveBeenCalled();
    });

    test('should increment count for existing entry', async () => {
      await manager.recordUsage('test-key');

      jest.advanceTimersByTime(1000);

      await manager.recordUsage('test-key');

      const entry = manager.getEntry('test-key');
      expect(entry?.count).toBe(2);
      expect(entry?.lastUsed).toBe(Date.now());
      expect(entry?.firstUsed).toBe(Date.now() - 1000);
    });

    test('should update lastUsed timestamp', async () => {
      await manager.recordUsage('test-key');

      const firstTimestamp = Date.now();
      jest.advanceTimersByTime(5000);

      await manager.recordUsage('test-key');

      const entry = manager.getEntry('test-key');
      expect(entry?.lastUsed).toBe(firstTimestamp + 5000);
      expect(entry?.firstUsed).toBe(firstTimestamp);
    });

    test('should auto-initialize if not already initialized', async () => {
      manager = new UsageHistoryManager(testFilePath);
      // Don't call initialize manually

      mockedFs.readFile.mockResolvedValue('' as any);

      await manager.recordUsage('test-key');

      expect(mockedFs.readFile).toHaveBeenCalled();
      expect(manager.getEntry('test-key')).toBeDefined();
    });

    test('should prune old entries beyond TTL', async () => {
      manager = new UsageHistoryManager(testFilePath, { ttlDays: 30 });

      // Add entry at current time
      await manager.recordUsage('recent-key');

      // Advance time by 31 days
      jest.advanceTimersByTime(31 * 24 * 60 * 60 * 1000);

      // Add new entry (this will trigger pruning)
      await manager.recordUsage('new-key');

      const recentEntry = manager.getEntry('recent-key');
      const newEntry = manager.getEntry('new-key');

      expect(recentEntry).toBeUndefined(); // Should be pruned
      expect(newEntry).toBeDefined();
    });

    test('should prune entries exceeding maxEntries', async () => {
      manager = new UsageHistoryManager(testFilePath, { maxEntries: 3 });

      await manager.recordUsage('key1');
      jest.advanceTimersByTime(1000);

      await manager.recordUsage('key2');
      jest.advanceTimersByTime(1000);

      await manager.recordUsage('key3');
      jest.advanceTimersByTime(1000);

      await manager.recordUsage('key4');

      const entries = manager.getAllEntries();
      expect(entries).toHaveLength(3);

      // key1 should be removed (oldest)
      expect(manager.getEntry('key1')).toBeUndefined();
      expect(manager.getEntry('key2')).toBeDefined();
      expect(manager.getEntry('key3')).toBeDefined();
      expect(manager.getEntry('key4')).toBeDefined();
    });

    test('should save entries to file after recording', async () => {
      await manager.recordUsage('test-key');

      expect(mockedFs.writeFile).toHaveBeenCalledWith(
        testFilePath,
        expect.stringContaining('"key":"test-key"'),
        'utf8'
      );
    });
  });

  describe('calculateBonus()', () => {
    beforeEach(async () => {
      manager = new UsageHistoryManager(testFilePath);
      mockedFs.readFile.mockResolvedValue('' as any);
      mockedFs.writeFile.mockResolvedValue(undefined as any);
      await manager.initialize();
    });

    test('should return 0 for unknown key', () => {
      const bonus = manager.calculateBonus('unknown-key');
      expect(bonus).toBe(0);
    });

    test('should return frequency + recency bonus for known key', async () => {
      await manager.recordUsage('test-key');
      await manager.recordUsage('test-key');
      await manager.recordUsage('test-key');

      const bonus = manager.calculateBonus('test-key');

      // Should be sum of frequency and recency bonus
      // Within 24h: recency = 50
      // count=3: frequency bonus based on log calculation
      expect(bonus).toBeGreaterThan(0);
      expect(typeof bonus).toBe('number');
    });

    test('should calculate higher bonus for frequently used items', async () => {
      await manager.recordUsage('frequent-key');
      await manager.recordUsage('frequent-key');
      await manager.recordUsage('frequent-key');
      await manager.recordUsage('frequent-key');
      await manager.recordUsage('frequent-key');

      await manager.recordUsage('rare-key');

      const frequentBonus = manager.calculateBonus('frequent-key');
      const rareBonus = manager.calculateBonus('rare-key');

      expect(frequentBonus).toBeGreaterThan(rareBonus);
    });

    test('should calculate lower bonus for old items', async () => {
      await manager.recordUsage('recent-key');

      // Advance time by 6 days (still within 7-day TTL)
      jest.advanceTimersByTime(6 * 24 * 60 * 60 * 1000);

      await manager.recordUsage('old-key');

      const recentBonus = manager.calculateBonus('recent-key');
      const oldBonus = manager.calculateBonus('old-key');

      // Old key is recent, recent key is old now
      expect(oldBonus).toBeGreaterThan(recentBonus);
    });
  });

  describe('getEntry() / getAllEntries()', () => {
    beforeEach(async () => {
      manager = new UsageHistoryManager(testFilePath);
      mockedFs.readFile.mockResolvedValue('' as any);
      mockedFs.writeFile.mockResolvedValue(undefined as any);
      await manager.initialize();
    });

    test('should return correct entry for known key', async () => {
      await manager.recordUsage('test-key');

      const entry = manager.getEntry('test-key');

      expect(entry).toEqual({
        key: 'test-key',
        count: 1,
        lastUsed: Date.now(),
        firstUsed: Date.now(),
      });
    });

    test('should return undefined for unknown key', () => {
      const entry = manager.getEntry('unknown-key');
      expect(entry).toBeUndefined();
    });

    test('should return all entries', async () => {
      await manager.recordUsage('key1');
      await manager.recordUsage('key2');
      await manager.recordUsage('key3');

      const entries = manager.getAllEntries();

      expect(entries).toHaveLength(3);
      expect(entries.map((e) => e.key)).toEqual(expect.arrayContaining(['key1', 'key2', 'key3']));
    });

    test('should return empty array when no entries', () => {
      const entries = manager.getAllEntries();
      expect(entries).toEqual([]);
    });
  });

  describe('clearCache()', () => {
    beforeEach(async () => {
      manager = new UsageHistoryManager(testFilePath);
      mockedFs.readFile.mockResolvedValue('' as any);
      mockedFs.writeFile.mockResolvedValue(undefined as any);
      await manager.initialize();
    });

    test('should clear all entries', async () => {
      await manager.recordUsage('key1');
      await manager.recordUsage('key2');

      expect(manager.getAllEntries()).toHaveLength(2);

      await manager.clearCache();

      expect(manager.getAllEntries()).toEqual([]);
    });

    test('should persist empty file', async () => {
      await manager.recordUsage('key1');

      await manager.clearCache();

      expect(mockedFs.writeFile).toHaveBeenCalledWith(testFilePath, '', 'utf8');
    });

    test('should allow adding entries after clear', async () => {
      await manager.recordUsage('key1');
      await manager.clearCache();

      await manager.recordUsage('key2');

      const entries = manager.getAllEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0]?.key).toBe('key2');
    });
  });

  describe('edge cases and error handling', () => {
    test('should handle empty file', async () => {
      manager = new UsageHistoryManager(testFilePath);
      mockedFs.readFile.mockResolvedValue('' as any);

      await manager.initialize();

      expect(manager.getAllEntries()).toEqual([]);
    });

    test('should handle file with only newlines', async () => {
      manager = new UsageHistoryManager(testFilePath);
      mockedFs.readFile.mockResolvedValue('\n\n\n' as any);

      await manager.initialize();

      expect(manager.getAllEntries()).toEqual([]);
    });

    test('should handle file write errors', async () => {
      manager = new UsageHistoryManager(testFilePath);
      mockedFs.readFile.mockResolvedValue('' as any);
      mockedFs.writeFile.mockRejectedValue(new Error('Write failed'));

      await expect(manager.recordUsage('test-key')).rejects.toThrow('Write failed');
    });

    test('should prune entries during initialization', async () => {
      manager = new UsageHistoryManager(testFilePath, { ttlDays: 30 });

      const now = Date.now();
      const oldTimestamp = now - 31 * 24 * 60 * 60 * 1000;

      const mockContent = [
        `{"key":"old-key","count":5,"lastUsed":${oldTimestamp},"firstUsed":${oldTimestamp}}`,
        `{"key":"recent-key","count":3,"lastUsed":${now},"firstUsed":${now}}`,
      ].join('\n');

      mockedFs.readFile.mockResolvedValue(mockContent as any);

      await manager.initialize();

      const entries = manager.getAllEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0]?.key).toBe('recent-key');
    });

    test('should handle duplicate keys in file (last one wins)', async () => {
      manager = new UsageHistoryManager(testFilePath);

      const mockContent = [
        '{"key":"test","count":1,"lastUsed":1705320000000,"firstUsed":1705320000000}',
        '{"key":"test","count":5,"lastUsed":1705330000000,"firstUsed":1705320000000}',
      ].join('\n');

      mockedFs.readFile.mockResolvedValue(mockContent as any);

      await manager.initialize();

      const entry = manager.getEntry('test');
      expect(entry?.count).toBe(5);
      expect(entry?.lastUsed).toBe(1705330000000);
    });
  });

  describe('pruning logic', () => {
    test('should keep entries within TTL', async () => {
      manager = new UsageHistoryManager(testFilePath, { ttlDays: 7 });
      mockedFs.readFile.mockResolvedValue('' as any);
      mockedFs.writeFile.mockResolvedValue(undefined as any);

      await manager.recordUsage('key1');

      // Advance by 6 days (within TTL)
      jest.advanceTimersByTime(6 * 24 * 60 * 60 * 1000);

      await manager.recordUsage('key2');

      expect(manager.getEntry('key1')).toBeDefined();
      expect(manager.getEntry('key2')).toBeDefined();
    });

    test('should remove oldest entries when exceeding maxEntries', async () => {
      manager = new UsageHistoryManager(testFilePath, { maxEntries: 2 });
      mockedFs.readFile.mockResolvedValue('' as any);
      mockedFs.writeFile.mockResolvedValue(undefined as any);

      await manager.recordUsage('key1');
      jest.advanceTimersByTime(1000);

      await manager.recordUsage('key2');
      jest.advanceTimersByTime(1000);

      await manager.recordUsage('key3');

      const entries = manager.getAllEntries();
      expect(entries).toHaveLength(2);
      expect(manager.getEntry('key1')).toBeUndefined();
    });

    test('should prune by TTL before pruning by count', async () => {
      manager = new UsageHistoryManager(testFilePath, { maxEntries: 5, ttlDays: 7 });
      mockedFs.readFile.mockResolvedValue('' as any);
      mockedFs.writeFile.mockResolvedValue(undefined as any);

      await manager.recordUsage('old-key');

      // Advance by 8 days (beyond TTL)
      jest.advanceTimersByTime(8 * 24 * 60 * 60 * 1000);

      await manager.recordUsage('key1');
      await manager.recordUsage('key2');
      await manager.recordUsage('key3');

      const entries = manager.getAllEntries();
      expect(entries).toHaveLength(3);
      expect(manager.getEntry('old-key')).toBeUndefined();
    });
  });
});
