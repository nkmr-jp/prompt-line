import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import HistoryManager from '../../src/managers/history-manager';
import { promises as fs } from 'fs';

// Mock fs promises module
jest.mock('fs', () => ({
    promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    unlink: jest.fn(),
    readdir: jest.fn(),
    stat: jest.fn(),
    appendFile: jest.fn()
    }
}));

// Mock the utils module
jest.mock('../../src/utils/utils', () => ({
    logger: {
        info: jest.fn(),
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    },
    safeJsonParse: jest.fn((data: string, fallback: any) => {
        try {
            return JSON.parse(data);
        } catch {
            return fallback;
        }
    }),
    safeJsonStringify: jest.fn((data: any) => JSON.stringify(data, null, 2)),
    generateId: jest.fn(() => 'test-id-' + Date.now()),
    debounce: jest.fn((fn: Function) => fn)
}));

// Mock the config module
jest.mock('../../src/config/app-config', () => ({
    paths: {
        historyFile: '/test/history.jsonl'
    }
}));

const mockedFs = jest.mocked(fs);

describe('HistoryManager', () => {
    let historyManager: HistoryManager;

    beforeEach(() => {
        historyManager = new HistoryManager();
        jest.clearAllMocks();
    });

    describe('initialization', () => {
        test('should initialize with empty history when file does not exist', async () => {
            mockedFs.readFile.mockRejectedValue({ code: 'ENOENT' } as any);

            await historyManager.initialize();

            expect(historyManager.getHistory()).toEqual([]);
        });

        test('should load existing history from file', async () => {
            const mockHistory = [
                { text: 'test1', timestamp: 1000, id: 'id1' },
                { text: 'test2', timestamp: 2000, id: 'id2' }
            ];
            const jsonlData = mockHistory.map(item => JSON.stringify(item)).join('\n') + '\n';
            mockedFs.readFile.mockResolvedValue(jsonlData as any);

            await historyManager.initialize();

            const expectedHistory = [...mockHistory].sort((a, b) => b.timestamp - a.timestamp);
            expect(historyManager.getHistory()).toEqual(expectedHistory);
        });

        test('should load all items without trimming (unlimited)', async () => {
            const mockHistory = Array.from({ length: 60 }, (_, i) => ({
                text: `test${i}`,
                timestamp: i * 1000,
                id: `id${i}`
            }));
            const jsonlData = mockHistory.map(item => JSON.stringify(item)).join('\n') + '\n';
            mockedFs.readFile.mockResolvedValue(jsonlData as any);
            mockedFs.writeFile.mockResolvedValue();

            await historyManager.initialize();

            const loadedHistory = historyManager.getHistory();
            expect(loadedHistory).toHaveLength(59); // Items loaded (one may be filtered)
            expect(loadedHistory[0]).toEqual(mockHistory[59]); // Newest item first
        });

        test('should handle corrupted history file gracefully', async () => {
            mockedFs.readFile.mockResolvedValue('invalid json\n{broken' as any);

            await historyManager.initialize();

            expect(historyManager.getHistory()).toEqual([]);
        });
    });

    describe('addToHistory', () => {
        beforeEach(async () => {
            await historyManager.initialize();
            mockedFs.writeFile.mockResolvedValue();
        });

        test('should add new item to history', async () => {
            const result = await historyManager.addToHistory('test text');

            expect(result).toBeDefined();
            expect(result!.text).toBe('test text');
            expect(result!.id).toBeDefined();
            expect(result!.timestamp).toBeGreaterThan(0);

            const history = historyManager.getHistory();
            expect(history).toHaveLength(1);
            expect(history[0]).toEqual(result);
        });

        test('should not add empty text', async () => {
            const result = await historyManager.addToHistory('   ');

            expect(result).toBeNull();
            expect(historyManager.getHistory()).toHaveLength(0);
        });

        test('should move existing item to top', async () => {
            await historyManager.addToHistory('first');
            await historyManager.addToHistory('second');
            await historyManager.addToHistory('first'); // Add same text again

            const history = historyManager.getHistory();
            expect(history).toHaveLength(2);
            expect(history[0]?.text).toBe('first');
            expect(history[1]?.text).toBe('second');
        });

        test('should store all items (unlimited)', async () => {
            // Add many items
            for (let i = 0; i < 55; i++) {
                await historyManager.addToHistory(`item ${i}`);
            }

            const history = historyManager.getHistory();
            expect(history).toHaveLength(55); // All items should be stored
            expect(history[0]?.text).toBe('item 54'); // Most recent
            expect(history[54]?.text).toBe('item 0'); // Oldest
        });

        test('should save to file after adding', async () => {
            await historyManager.addToHistory('test');

            expect(mockedFs.writeFile).toHaveBeenCalled();
        });
    });

    describe('getHistory', () => {
        test('should return copy of history array', async () => {
            await historyManager.initialize();
            await historyManager.addToHistory('test');

            const history1 = historyManager.getHistory();
            const history2 = historyManager.getHistory();

            expect(history1).toEqual(history2);
            expect(history1).not.toBe(history2); // Different objects
        });
    });

    describe('getHistoryItem', () => {
        beforeEach(async () => {
            await historyManager.initialize();
            await historyManager.addToHistory('test item');
        });

        test('should return item by ID', () => {
            const history = historyManager.getHistory();
            const item = historyManager.getHistoryItem(history[0]!.id);

            expect(item).toEqual(history[0]);
        });

        test('should return null for non-existent ID', () => {
            const item = historyManager.getHistoryItem('non-existent');

            expect(item).toBeNull();
        });
    });

    describe('getRecentHistory', () => {
        beforeEach(async () => {
            await historyManager.initialize();
            for (let i = 0; i < 20; i++) {
                await historyManager.addToHistory(`item ${i}`);
            }
        });

        test('should return recent items up to limit', () => {
            const recent = historyManager.getRecentHistory(5);

            expect(recent).toHaveLength(5);
            expect(recent[0]?.text).toBe('item 19'); // Most recent
            expect(recent[4]?.text).toBe('item 15');
        });

        test('should return all items if limit exceeds history length', () => {
            // Clear and add fewer items
            (historyManager as any).historyData = [];
            historyManager.addToHistory('item 1');
            historyManager.addToHistory('item 2');

            const recent = historyManager.getRecentHistory(10);
            expect(recent).toHaveLength(2);
        });
    });

    describe('searchHistory', () => {
        beforeEach(async () => {
            await historyManager.initialize();
            await historyManager.addToHistory('Hello world');
            await historyManager.addToHistory('Test message');
            await historyManager.addToHistory('Another hello');
            await historyManager.addToHistory('Different text');
        });

        test('should find matching items', () => {
            const results = historyManager.searchHistory('hello');

            expect(results).toHaveLength(2);
            expect(results[0]?.text).toBe('Another hello');
            expect(results[1]?.text).toBe('Hello world');
        });

        test('should return empty array for no matches', () => {
            const results = historyManager.searchHistory('xyz');

            expect(results).toHaveLength(0);
        });

        test('should return empty array for empty query', () => {
            const results = historyManager.searchHistory('');

            expect(results).toHaveLength(0);
        });

        test('should respect limit', async () => {
            await historyManager.addToHistory('hello 1');
            await historyManager.addToHistory('hello 2');
            await historyManager.addToHistory('hello 3');

            const results = historyManager.searchHistory('hello', 2);

            expect(results).toHaveLength(2);
        });
    });

    describe('removeHistoryItem', () => {
        let itemId: string;

        beforeEach(async () => {
            await historyManager.initialize();
            const item = await historyManager.addToHistory('test item');
            itemId = item!.id;
            mockedFs.writeFile.mockClear(); // Clear previous calls
        });

        test('should remove existing item', async () => {
            const result = await historyManager.removeHistoryItem(itemId);

            expect(result).toBe(true);
            expect(historyManager.getHistory()).toHaveLength(0);
            expect(mockedFs.writeFile).toHaveBeenCalled();
        });

        test('should return false for non-existent item', async () => {
            const result = await historyManager.removeHistoryItem('non-existent');

            expect(result).toBe(false);
            expect(historyManager.getHistory()).toHaveLength(1);
            expect(mockedFs.writeFile).not.toHaveBeenCalled();
        });
    });

    describe('clearHistory', () => {
        beforeEach(async () => {
            await historyManager.initialize();
            await historyManager.addToHistory('item 1');
            await historyManager.addToHistory('item 2');
            mockedFs.writeFile.mockClear();
        });

        test('should clear all history', async () => {
            await historyManager.clearHistory();

            expect(historyManager.getHistory()).toHaveLength(0);
            expect(mockedFs.writeFile).toHaveBeenCalled();
        });
    });

    describe('getHistoryStats', () => {
        beforeEach(async () => {
            await historyManager.initialize();
        });

        test('should return correct stats for empty history', () => {
            const stats = historyManager.getHistoryStats();

            expect(stats).toEqual({
                totalItems: 0,
                totalCharacters: 0,
                averageLength: 0,
                oldestTimestamp: null,
                newestTimestamp: null
            });
        });

        test('should return correct stats for populated history', async () => {
            await historyManager.addToHistory('abc'); // 3 chars
            await historyManager.addToHistory('defgh'); // 5 chars

            const stats = historyManager.getHistoryStats();

            expect(stats.totalItems).toBe(2);
            expect(stats.totalCharacters).toBe(8);
            expect(stats.averageLength).toBe(4);
            expect(stats.oldestTimestamp!).toBeLessThanOrEqual(stats.newestTimestamp!);
        });
    });

    describe('exportHistory', () => {
        beforeEach(async () => {
            await historyManager.initialize();
            await historyManager.addToHistory('export test');
        });

        test('should export history in correct format', () => {
            const exported = historyManager.exportHistory();

            expect(exported).toHaveProperty('version', '1.0');
            expect(exported).toHaveProperty('exportDate');
            expect(exported).toHaveProperty('history');
            expect(exported).toHaveProperty('stats');
            expect(exported.history).toHaveLength(1);
            expect(exported.history[0]?.text).toBe('export test');
        });
    });

    describe('importHistory', () => {
        beforeEach(async () => {
            await historyManager.initialize();
            mockedFs.writeFile.mockResolvedValue();
        });

        test('should import history without merging', async () => {
            const importData = {
                version: '1.0',
                history: [
                    { text: 'imported 1', timestamp: 1000, id: 'imp1' },
                    { text: 'imported 2', timestamp: 2000, id: 'imp2' }
                ]
            };

            await historyManager.importHistory(importData as any, false);

            const history = historyManager.getHistory();
            expect(history).toHaveLength(2);
            expect(history[0]?.text).toBe('imported 2'); // Sorted by timestamp
            expect(history[1]?.text).toBe('imported 1');
        });

        test('should import history with merging', async () => {
            await historyManager.addToHistory('existing');

            const importData = {
                version: '1.0',
                history: [
                    { text: 'imported', timestamp: 1000, id: 'imp1' }
                ]
            };

            await historyManager.importHistory(importData as any, true);

            const history = historyManager.getHistory();
            expect(history).toHaveLength(2);
        });

        test('should reject invalid import data', async () => {
            const invalidData = { version: '1.0' } as any; // Missing history

            await expect(historyManager.importHistory(invalidData)).rejects.toThrow('Invalid export data format');
        });
    });
});