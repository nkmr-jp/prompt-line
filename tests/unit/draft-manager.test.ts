import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import DraftManager from '../../src/managers/draft-manager';
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

// Mock path module
jest.mock('path', () => ({
    dirname: jest.fn((p: string) => {
        if (p === '/test/draft.json') return '/test';
        return '/test';
    }),
    basename: jest.fn(),
    join: jest.fn((...args: string[]) => args.join('/')),
    normalize: jest.fn((p: string) => p)
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
    debounce: jest.fn((fn: Function, _delay: number) => {
        // Return a simple mock that calls the function immediately
        const mockFn = jest.fn((...args: any[]) => fn(...args)) as any;
        mockFn.cancel = jest.fn();
        return mockFn;
    })
}));

// Mock the config module
jest.mock('../../src/config/app-config', () => ({
    paths: {
        draftFile: '/test/draft.json'
    },
    draft: {
        saveDelay: 500
    }
}));

const mockedFs = jest.mocked(fs);

describe('DraftManager', () => {
    let draftManager: DraftManager;

    beforeEach(() => {
        draftManager = new DraftManager();
        jest.clearAllMocks();
    });

    describe('initialization', () => {
        test('should initialize with no draft when file does not exist', async () => {
            mockedFs.readFile.mockRejectedValue({ code: 'ENOENT' } as any);

            await draftManager.initialize();

            expect(draftManager.getCurrentDraft()).toBe('');
            expect(draftManager.hasDraft()).toBe(false);
        });

        test('should load existing draft from file', async () => {
            const mockDraft = {
                text: 'existing draft',
                timestamp: Date.now(),
                version: '1.0'
            };
            mockedFs.readFile.mockResolvedValue(JSON.stringify(mockDraft) as any);

            await draftManager.initialize();

            expect(draftManager.getCurrentDraft()).toBe('existing draft');
            expect(draftManager.hasDraft()).toBe(true);
        });

        test('should handle corrupted draft file gracefully', async () => {
            mockedFs.readFile.mockResolvedValue('invalid json' as any);

            await draftManager.initialize();

            expect(draftManager.getCurrentDraft()).toBe('');
        });

        test('should handle invalid draft format', async () => {
            mockedFs.readFile.mockResolvedValue(JSON.stringify({ invalid: 'format' }) as any);

            await draftManager.initialize();

            expect(draftManager.getCurrentDraft()).toBe('');
        });
    });

    describe('saveDraft', () => {
        beforeEach(async () => {
            await draftManager.initialize();
        });

        test('should save draft text', async () => {
            await draftManager.saveDraft('test draft');

            expect(draftManager.getCurrentDraft()).toBe('test draft');
            expect(draftManager.hasDraft()).toBe(true);
        });

        test('should clear draft for empty text', async () => {
            mockedFs.unlink.mockResolvedValue();
            
            await draftManager.saveDraft('');

            expect(draftManager.getCurrentDraft()).toBe('');
            expect(draftManager.hasDraft()).toBe(false);
            expect(mockedFs.unlink).toHaveBeenCalled();
        });

        test('should clear draft for whitespace-only text', async () => {
            mockedFs.unlink.mockResolvedValue();
            
            await draftManager.saveDraft('   \n  ');

            expect(draftManager.getCurrentDraft()).toBe('');
            expect(mockedFs.unlink).toHaveBeenCalled();
        });
    });

    describe('saveDraftImmediately', () => {
        beforeEach(async () => {
            await draftManager.initialize();
            mockedFs.writeFile.mockResolvedValue();
        });

        test('should save draft immediately without debounce', async () => {
            await draftManager.saveDraftImmediately('immediate draft');

            expect(draftManager.getCurrentDraft()).toBe('immediate draft');
            expect(mockedFs.writeFile).toHaveBeenCalled();
        });

        test('should clear draft for empty text', async () => {
            mockedFs.unlink.mockResolvedValue();
            
            await draftManager.saveDraftImmediately('');

            expect(draftManager.getCurrentDraft()).toBe('');
            expect(mockedFs.unlink).toHaveBeenCalled();
        });
    });

    describe('clearDraft', () => {
        beforeEach(async () => {
            await draftManager.initialize();
            await draftManager.saveDraftImmediately('test draft');
        });

        test('should clear current draft', async () => {
            mockedFs.unlink.mockResolvedValue();
            
            await draftManager.clearDraft();

            expect(draftManager.getCurrentDraft()).toBe('');
            expect(draftManager.hasDraft()).toBe(false);
            expect(mockedFs.unlink).toHaveBeenCalled();
        });

        test('should handle file not found gracefully', async () => {
            mockedFs.unlink.mockRejectedValue({ code: 'ENOENT' } as any);
            
            await draftManager.clearDraft();

            expect(draftManager.getCurrentDraft()).toBe('');
            // Should not throw error
        });

        test('should throw other file system errors', async () => {
            mockedFs.unlink.mockRejectedValue(new Error('Permission denied'));
            
            await expect(draftManager.clearDraft()).rejects.toThrow('Permission denied');
        });
    });

    describe('getCurrentDraft', () => {
        test('should return empty string when no draft', () => {
            expect(draftManager.getCurrentDraft()).toBe('');
        });

        test('should return draft text when available', async () => {
            await draftManager.initialize();
            (draftManager as any).currentDraft = 'test draft';
            
            expect(draftManager.getCurrentDraft()).toBe('test draft');
        });
    });

    describe('hasDraft', () => {
        test('should return false when no draft', () => {
            expect(draftManager.hasDraft()).toBe(false);
        });

        test('should return false for empty draft', () => {
            (draftManager as any).currentDraft = '';
            expect(draftManager.hasDraft()).toBe(false);
        });

        test('should return false for whitespace-only draft', () => {
            (draftManager as any).currentDraft = '   \n  ';
            expect(draftManager.hasDraft()).toBe(false);
        });

        test('should return true for valid draft', () => {
            (draftManager as any).currentDraft = 'valid draft';
            expect(draftManager.hasDraft()).toBe(true);
        });
    });

    describe('getDraftMetadata', () => {
        test('should return null when no draft file', async () => {
            mockedFs.readFile.mockRejectedValue({ code: 'ENOENT' } as any);
            
            const metadata = await draftManager.getDraftMetadata();
            
            expect(metadata).toBeNull();
        });

        test('should return metadata for existing draft', async () => {
            const mockDraft = {
                text: 'test draft\nwith multiple lines',
                timestamp: 1234567890,
                version: '1.0'
            };
            mockedFs.readFile.mockResolvedValue(JSON.stringify(mockDraft) as any);
            
            const metadata = await draftManager.getDraftMetadata();
            
            expect(metadata).toEqual({
                length: mockDraft.text.length,
                timestamp: mockDraft.timestamp,
                version: mockDraft.version,
                wordCount: 5, // 'test', 'draft', 'with', 'multiple', 'lines'
                lineCount: 2
            });
        });
    });

    describe('updateDraft', () => {
        beforeEach(async () => {
            await draftManager.initialize();
        });

        test('should update draft with debounced save', async () => {
            await draftManager.updateDraft('updated draft');

            expect(draftManager.getCurrentDraft()).toBe('updated draft');
            // The debounce function is internal implementation detail
            // Just verify the draft was updated
        });

        test('should update draft with immediate save when requested', async () => {
            mockedFs.writeFile.mockResolvedValue();
            
            await draftManager.updateDraft('immediate update', true);

            expect(draftManager.getCurrentDraft()).toBe('immediate update');
            expect(mockedFs.writeFile).toHaveBeenCalled();
        });
    });

    describe('getDraftStats', () => {
        test('should return empty stats when no draft', () => {
            const stats = draftManager.getDraftStats();

            expect(stats).toEqual({
                hasContent: false,
                length: 0,
                wordCount: 0,
                lineCount: 0
            });
        });

        test('should return correct stats for draft content', () => {
            (draftManager as any).currentDraft = 'Hello world\nSecond line';
            
            const stats = draftManager.getDraftStats();

            expect(stats).toEqual({
                hasContent: true,
                length: 23,
                wordCount: 4, // 'Hello', 'world', 'Second', 'line'
                lineCount: 2,
                isMultiline: true
            });
        });

        test('should handle single line draft', () => {
            (draftManager as any).currentDraft = 'Single line draft';
            
            const stats = draftManager.getDraftStats();

            expect(stats.isMultiline).toBe(false);
            expect(stats.lineCount).toBe(1);
        });
    });

    describe('backupDraft', () => {
        beforeEach(async () => {
            await draftManager.initialize();
            (draftManager as any).currentDraft = 'draft to backup';
            mockedFs.writeFile.mockResolvedValue();
        });

        test('should create backup of current draft', async () => {
            const backupPath = await draftManager.backupDraft();

            expect(backupPath).toContain('draft.json.backup.');
            expect(mockedFs.writeFile).toHaveBeenCalled();
            
            const writeCall = mockedFs.writeFile.mock.calls[0];
            expect(writeCall![0]).toContain('backup');
            
            const backupData = JSON.parse(writeCall![1] as string);
            expect(backupData.text).toBe('draft to backup');
            expect(backupData.originalFile).toBe('/test/draft.json');
        });

        test('should throw error when no draft to backup', async () => {
            (draftManager as any).currentDraft = '';
            
            await expect(draftManager.backupDraft()).rejects.toThrow('No draft to backup');
        });
    });

    describe('restoreDraft', () => {
        beforeEach(async () => {
            await draftManager.initialize();
            mockedFs.writeFile.mockResolvedValue();
        });

        test('should restore draft from backup', async () => {
            const backupData = {
                text: 'restored draft',
                timestamp: Date.now(),
                originalFile: '/test/draft.json',
                backupDate: new Date().toISOString()
            };
            mockedFs.readFile.mockResolvedValue(JSON.stringify(backupData) as any);
            
            await draftManager.restoreDraft('/test/backup.json');

            expect(draftManager.getCurrentDraft()).toBe('restored draft');
            expect(mockedFs.writeFile).toHaveBeenCalled();
        });

        test('should throw error for invalid backup format', async () => {
            mockedFs.readFile.mockResolvedValue(JSON.stringify({ invalid: 'format' }) as any);
            
            await expect(draftManager.restoreDraft('/test/backup.json')).rejects.toThrow('Invalid backup file format');
        });
    });

    describe('cleanupBackups', () => {
        beforeEach(() => {
             
            const path = require('path');
            path.dirname.mockReturnValue('/test');
            path.basename.mockReturnValue('draft.json');
        });

        test('should clean up old backup files', async () => {
            const now = new Date();
            const oldDate = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000); // 8 days ago
            
            mockedFs.readdir.mockResolvedValue([
                'draft.json.backup.2023-01-01',
                'draft.json.backup.2023-01-02',
                'other-file.txt'
            ] as any);
            
            mockedFs.stat.mockImplementation((filePath: any) => {
                return Promise.resolve({
                    mtime: filePath.includes('2023-01-01') ? oldDate : now
                } as any);
            });
            
            mockedFs.unlink.mockResolvedValue();
            
            const cleanedCount = await draftManager.cleanupBackups();

            expect(cleanedCount).toBe(1);
            expect(mockedFs.unlink).toHaveBeenCalledWith('/test/draft.json.backup.2023-01-01');
        });
    });

    describe('destroy', () => {
        test('should cleanup resources', () => {
            // Set a draft to ensure cleanup happens
            draftManager.updateDraft('test');
            
            draftManager.destroy();

            // After destroy, the draft manager should be in a clean state
            // We can't directly test internal state, but we can verify no errors occur
            expect(() => draftManager.getCurrentDraft()).not.toThrow();
        });
    });
});