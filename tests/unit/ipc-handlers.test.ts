import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import IPCHandlers from '../../src/handlers/ipc-handlers';
import { ipcMain, clipboard } from 'electron';
import type WindowManager from '../../src/managers/window';
import type HistoryManager from '../../src/managers/history-manager';
import type DraftManager from '../../src/managers/draft-manager';

// Mock dependencies
const mockWindowManager: jest.Mocked<WindowManager> = {
    hideInputWindow: jest.fn(),
    showInputWindow: jest.fn(),
    focusPreviousApp: jest.fn(() => Promise.resolve(true)),
    getInputWindow: jest.fn(),
    getPreviousApp: jest.fn(() => ({ name: 'TestApp', bundleId: 'com.test.app' })),
    isVisible: jest.fn(() => false),
    createInputWindow: jest.fn(),
    repositionWindow: jest.fn(),
    registerShortcuts: jest.fn(),
    unregisterShortcuts: jest.fn(),
    destroy: jest.fn()
} as any;

const mockHistoryManager: jest.Mocked<HistoryManager> = {
    addToHistory: jest.fn(() => Promise.resolve({ id: 'test-id', text: 'test', timestamp: Date.now() })),
    getHistory: jest.fn(() => []),
    clearHistory: jest.fn(() => Promise.resolve()),
    removeHistoryItem: jest.fn(() => Promise.resolve(true)),
    searchHistory: jest.fn(() => []),
    getHistoryStats: jest.fn(() => ({
        totalItems: 0,
        totalCharacters: 0,
        averageLength: 0,
        oldestTimestamp: null,
        newestTimestamp: null,
        maxItems: 50
    })),
    initialize: jest.fn(),
    getHistoryItem: jest.fn(),
    getRecentHistory: jest.fn(),
    exportHistory: jest.fn(),
    importHistory: jest.fn()
} as any;

const mockDraftManager: jest.Mocked<DraftManager> = {
    saveDraft: jest.fn(() => Promise.resolve()),
    saveDraftImmediately: jest.fn(() => Promise.resolve()),
    clearDraft: jest.fn(() => Promise.resolve()),
    getCurrentDraft: jest.fn(() => ''),
    getDraftStats: jest.fn(() => ({ hasContent: false, length: 0, wordCount: 0, lineCount: 0 })),
    initialize: jest.fn(),
    hasDraft: jest.fn(),
    getDraftMetadata: jest.fn(),
    updateDraft: jest.fn(),
    backupDraft: jest.fn(),
    restoreDraft: jest.fn(),
    cleanupBackups: jest.fn(),
    destroy: jest.fn(),
    setDirectory: jest.fn(),
    getDirectory: jest.fn(() => null)
} as any;

// Mock utils
jest.mock('../../src/utils/utils', () => ({
    logger: {
        info: jest.fn(),
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    },
    pasteWithNativeTool: jest.fn(() => Promise.resolve()),
    activateAndPasteWithNativeTool: jest.fn(() => Promise.resolve()),
    sleep: jest.fn(() => Promise.resolve()),
    SecureErrors: {
        INVALID_INPUT: 'Invalid input provided',
        OPERATION_FAILED: 'Operation failed',
        FILE_NOT_FOUND: 'File not found',
        PERMISSION_DENIED: 'Permission denied',
        INTERNAL_ERROR: 'An internal error occurred',
        INVALID_FORMAT: 'Invalid format',
        SIZE_LIMIT_EXCEEDED: 'Size limit exceeded'
    },
    checkAccessibilityPermission: jest.fn(() => Promise.resolve({ hasPermission: true, bundleId: 'test' }))
}));

// Mock config
jest.mock('../../src/config/app-config', () => ({
    timing: {
        windowHideDelay: 100,
        appFocusDelay: 200
    },
    platform: {
        isMac: true
    },
    app: {
        name: 'Prompt Line',
        version: '1.0.0',
        description: 'Test app'
    },
    shortcuts: { main: 'Cmd+Shift+Space' },
    history: { maxItems: 50 },
    draft: { saveDelay: 500 },
    isDevelopment: jest.fn(() => false),
    get: jest.fn((key: string) => {
        const config: any = {
            timing: { windowHideDelay: 100, appFocusDelay: 200 },
            platform: { isMac: true },
            app: { name: 'Prompt Line', version: '1.0.0', description: 'Test app' },
            shortcuts: { main: 'Cmd+Shift+Space' },
            history: { maxItems: 50 },
            draft: { saveDelay: 500 }
        };
        return config[key];
    })
}));

const { logger, pasteWithNativeTool, activateAndPasteWithNativeTool } = jest.requireMock('../../src/utils/utils') as any;

/**
 * Helper function to get a registered IPC handler from the mock
 * After IPCHandlers is instantiated, we can retrieve handlers from ipcMain.handle mock calls
 */
type HandlerFunction = (event: any, ...args: any[]) => Promise<any>;
function getHandler(channel: string): HandlerFunction | null {
    const calls = (ipcMain.handle as jest.Mock).mock.calls as [string, HandlerFunction][];
    const call = calls.find((c) => c[0] === channel);
    return call ? call[1] : null;
}

describe('IPCHandlers', () => {
    let ipcHandlers: IPCHandlers;
    let mockSettingsManager: any;
    let mockDirectoryManager: any;

    beforeEach(() => {
        jest.clearAllMocks();
        (ipcMain.handle as jest.Mock).mockClear();

        mockSettingsManager = {
            getSettings: jest.fn(() => ({
                shortcuts: { main: 'Ctrl+Space', paste: 'Enter', close: 'Escape' },
                window: { position: 'cursor', width: 600, height: 300 }
            })),
            updateSettings: jest.fn(),
            resetSettings: jest.fn()
        };

        mockDirectoryManager = {
            getDirectory: jest.fn(() => null),
            setDirectory: jest.fn(),
            saveDirectory: jest.fn()
        };

        ipcHandlers = new IPCHandlers(
            mockWindowManager,
            mockHistoryManager,
            mockDraftManager,
            mockDirectoryManager,
            mockSettingsManager
        );
    });

    describe('initialization', () => {
        test('should register all IPC handlers', () => {
            expect(ipcMain.handle).toHaveBeenCalledWith('paste-text', expect.any(Function));
            expect(ipcMain.handle).toHaveBeenCalledWith('get-history', expect.any(Function));
            expect(ipcMain.handle).toHaveBeenCalledWith('clear-history', expect.any(Function));
            expect(ipcMain.handle).toHaveBeenCalledWith('save-draft', expect.any(Function));
            expect(ipcMain.handle).toHaveBeenCalledWith('hide-window', expect.any(Function));
            expect(logger.info).toHaveBeenCalledWith('All IPC handlers set up successfully via coordinator');
        });
    });

    describe('handlePasteText', () => {
        test('should handle successful paste operation', async () => {
            const handler = getHandler('paste-text');
            expect(handler).not.toBeNull();

            (clipboard.writeText as jest.Mock).mockImplementation(() => {});
            mockWindowManager.hideInputWindow.mockResolvedValue();
            mockWindowManager.focusPreviousApp.mockResolvedValue(true);
            activateAndPasteWithNativeTool.mockResolvedValue();

            const result = await handler!(null, 'test text');

            expect(result.success).toBe(true);
            expect(mockHistoryManager.addToHistory).toHaveBeenCalledWith('test text', 'TestApp', undefined);
            expect(mockDraftManager.clearDraft).toHaveBeenCalled();
            expect(clipboard.writeText).toHaveBeenCalledWith('test text');
            expect(mockWindowManager.hideInputWindow).toHaveBeenCalled();
        });

        test('should handle empty text', async () => {
            const handler = getHandler('paste-text');
            expect(handler).not.toBeNull();

            const result = await handler!(null, '   ');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Invalid input provided');
            expect(mockHistoryManager.addToHistory).not.toHaveBeenCalled();
        });

        test('should handle paste errors gracefully', async () => {
            const handler = getHandler('paste-text');
            expect(handler).not.toBeNull();

            (clipboard.writeText as jest.Mock).mockImplementation(() => {});
            mockWindowManager.hideInputWindow.mockResolvedValue();
            mockWindowManager.getPreviousApp.mockReturnValue({ name: 'TestApp', bundleId: 'com.test.app' });
            activateAndPasteWithNativeTool.mockRejectedValue(new Error('Paste failed'));

            const result = await handler!(null, 'test text');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Operation failed');
        });

        test('should handle focus app failure', async () => {
            const handler = getHandler('paste-text');
            expect(handler).not.toBeNull();

            (clipboard.writeText as jest.Mock).mockImplementation(() => {});
            mockWindowManager.hideInputWindow.mockResolvedValue();
            mockWindowManager.getPreviousApp.mockReturnValue(null); // No previous app
            mockWindowManager.focusPreviousApp.mockResolvedValue(false);
            pasteWithNativeTool.mockResolvedValue();

            const result = await handler!(null, 'test text');

            expect(result.success).toBe(true);
            expect(result.warning).toBe('Could not focus previous application');
        });

        test('should clear draft when paste is successful', async () => {
            const handler = getHandler('paste-text');
            expect(handler).not.toBeNull();

            (clipboard.writeText as jest.Mock).mockImplementation(() => {});
            mockWindowManager.hideInputWindow.mockResolvedValue();
            mockWindowManager.focusPreviousApp.mockResolvedValue(true);
            pasteWithNativeTool.mockResolvedValue();
            // Reset getPreviousApp to return the default mock value
            mockWindowManager.getPreviousApp.mockReturnValue({ name: 'TestApp', bundleId: 'com.test.app' });

            await handler!(null, 'test text');

            expect(mockDraftManager.clearDraft).toHaveBeenCalledTimes(1);
            expect(mockHistoryManager.addToHistory).toHaveBeenCalledWith('test text', 'TestApp', undefined);
        });

        test('should clear draft even when paste fails', async () => {
            const handler = getHandler('paste-text');
            expect(handler).not.toBeNull();

            (clipboard.writeText as jest.Mock).mockImplementation(() => {});
            mockWindowManager.hideInputWindow.mockResolvedValue();
            mockWindowManager.focusPreviousApp.mockResolvedValue(true);
            pasteWithNativeTool.mockRejectedValue(new Error('Paste script failed'));
            // Reset getPreviousApp to return the default mock value
            mockWindowManager.getPreviousApp.mockReturnValue({ name: 'TestApp', bundleId: 'com.test.app' });

            const result = await handler!(null, 'test text');

            expect(result.success).toBe(false);
            expect(mockDraftManager.clearDraft).toHaveBeenCalledTimes(1);
            expect(mockHistoryManager.addToHistory).toHaveBeenCalledWith('test text', 'TestApp', undefined);
        });

        test('should not clear draft when text is empty', async () => {
            const handler = getHandler('paste-text');
            expect(handler).not.toBeNull();

            const result = await handler!(null, '   ');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Invalid input provided');
            expect(mockDraftManager.clearDraft).not.toHaveBeenCalled();
            expect(mockHistoryManager.addToHistory).not.toHaveBeenCalled();
        });
    });

    describe('handleGetHistory', () => {
        test('should return history from manager', async () => {
            const handler = getHandler('get-history');
            expect(handler).not.toBeNull();

            const testHistory = [{ text: 'test', timestamp: Date.now(), id: 'test-id' }];
            mockHistoryManager.getHistory.mockReturnValue(testHistory);

            const result = await handler!(null);

            expect(result).toEqual(testHistory);
            expect(mockHistoryManager.getHistory).toHaveBeenCalled();
        });

        test('should handle errors gracefully', async () => {
            const handler = getHandler('get-history');
            expect(handler).not.toBeNull();

            mockHistoryManager.getHistory.mockImplementation(() => {
                throw new Error('History error');
            });

            const result = await handler!(null);

            expect(result).toEqual([]);
            expect(logger.error).toHaveBeenCalled();
        });
    });

    describe('handleClearHistory', () => {
        test('should clear history successfully', async () => {
            const handler = getHandler('clear-history');
            expect(handler).not.toBeNull();

            mockHistoryManager.clearHistory.mockResolvedValue();

            const result = await handler!(null);

            expect(result.success).toBe(true);
            expect(mockHistoryManager.clearHistory).toHaveBeenCalled();
        });

        test('should handle clear history errors', async () => {
            const handler = getHandler('clear-history');
            expect(handler).not.toBeNull();

            mockHistoryManager.clearHistory.mockRejectedValue(new Error('Clear failed'));

            const result = await handler!(null);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Operation failed');
        });
    });

    describe('handleRemoveHistoryItem', () => {
        test('should remove history item successfully', async () => {
            const handler = getHandler('remove-history-item');
            expect(handler).not.toBeNull();

            mockHistoryManager.removeHistoryItem.mockResolvedValue(true);

            const result = await handler!(null, 'testid123');

            expect(result.success).toBe(true);
            expect(mockHistoryManager.removeHistoryItem).toHaveBeenCalledWith('testid123');
        });

        test('should handle item not found', async () => {
            const handler = getHandler('remove-history-item');
            expect(handler).not.toBeNull();

            mockHistoryManager.removeHistoryItem.mockResolvedValue(false);

            const result = await handler!(null, 'non-existent');

            expect(result.success).toBe(false);
        });
    });

    describe('handleSearchHistory', () => {
        test('should search history with query', async () => {
            const handler = getHandler('search-history');
            expect(handler).not.toBeNull();

            const searchResults = [{ text: 'matching text', timestamp: Date.now(), id: 'match-1' }];
            mockHistoryManager.searchHistory.mockReturnValue(searchResults);

            const result = await handler!(null, 'matching', 5);

            expect(result).toEqual(searchResults);
            expect(mockHistoryManager.searchHistory).toHaveBeenCalledWith('matching', 5);
        });

        test('should use default limit when not provided', async () => {
            const handler = getHandler('search-history');
            expect(handler).not.toBeNull();

            mockHistoryManager.searchHistory.mockReturnValue([]);

            await handler!(null, 'query');

            expect(mockHistoryManager.searchHistory).toHaveBeenCalledWith('query', 10);
        });
    });

    describe('handleSaveDraft', () => {
        test('should save draft normally', async () => {
            const handler = getHandler('save-draft');
            expect(handler).not.toBeNull();

            const result = await handler!(null, 'test draft', false);

            expect(result.success).toBe(true);
            expect(mockDraftManager.saveDraft).toHaveBeenCalledWith('test draft');
            expect(mockDraftManager.saveDraftImmediately).not.toHaveBeenCalled();
        });

        test('should save draft immediately when requested', async () => {
            const handler = getHandler('save-draft');
            expect(handler).not.toBeNull();

            const result = await handler!(null, 'test draft', true);

            expect(result.success).toBe(true);
            expect(mockDraftManager.saveDraftImmediately).toHaveBeenCalledWith('test draft');
            expect(mockDraftManager.saveDraft).not.toHaveBeenCalled();
        });

        test('should handle save draft errors', async () => {
            const handler = getHandler('save-draft');
            expect(handler).not.toBeNull();

            mockDraftManager.saveDraft.mockRejectedValue(new Error('Save failed'));

            const result = await handler!(null, 'test draft');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Operation failed');
        });
    });

    describe('handleClearDraft', () => {
        test('should clear draft successfully', async () => {
            const handler = getHandler('clear-draft');
            expect(handler).not.toBeNull();

            const result = await handler!(null);

            expect(result.success).toBe(true);
            expect(mockDraftManager.clearDraft).toHaveBeenCalled();
        });
    });

    describe('handleGetDraft', () => {
        test('should return current draft', async () => {
            const handler = getHandler('get-draft');
            expect(handler).not.toBeNull();

            mockDraftManager.getCurrentDraft.mockReturnValue('current draft');

            const result = await handler!(null);

            expect(result).toBe('current draft');
        });

        test('should handle errors gracefully', async () => {
            const handler = getHandler('get-draft');
            expect(handler).not.toBeNull();

            mockDraftManager.getCurrentDraft.mockImplementation(() => {
                throw new Error('Draft error');
            });

            const result = await handler!(null);

            expect(result).toBe('');
        });
    });

    describe('handleHideWindow', () => {
        test('should hide window successfully', async () => {
            const handler = getHandler('hide-window');
            expect(handler).not.toBeNull();

            const result = await handler!(null);

            expect(result.success).toBe(true);
            expect(mockWindowManager.hideInputWindow).toHaveBeenCalled();
        });

        test('should focus previous app after hiding window on macOS', async () => {
            const handler = getHandler('hide-window');
            expect(handler).not.toBeNull();

            const { sleep } = jest.requireMock('../../src/utils/utils') as any;

            const result = await handler!(null);

            expect(result.success).toBe(true);
            expect(mockWindowManager.hideInputWindow).toHaveBeenCalled();
            expect(sleep).toHaveBeenCalledWith(100); // Using config.timing.windowHideDelay
            expect(mockWindowManager.focusPreviousApp).toHaveBeenCalled();
        });

        test('should handle errors when focusing previous app fails', async () => {
            const handler = getHandler('hide-window');
            expect(handler).not.toBeNull();

            mockWindowManager.focusPreviousApp.mockRejectedValue(new Error('Focus failed'));

            const result = await handler!(null);

            expect(result.success).toBe(true); // Should still succeed even if focus fails
            expect(mockWindowManager.hideInputWindow).toHaveBeenCalled();
            expect(mockWindowManager.focusPreviousApp).toHaveBeenCalled();
            expect(result.error).toBeUndefined(); // Error should be caught silently
        });

        test('should not focus previous app when restoreFocus is false', async () => {
            const handler = getHandler('hide-window');
            expect(handler).not.toBeNull();

            const result = await handler!(null, false);

            expect(result.success).toBe(true);
            expect(mockWindowManager.hideInputWindow).toHaveBeenCalled();
            expect(mockWindowManager.focusPreviousApp).not.toHaveBeenCalled();
        });

        test('should focus previous app when restoreFocus is explicitly true', async () => {
            const handler = getHandler('hide-window');
            expect(handler).not.toBeNull();

            const { sleep } = jest.requireMock('../../src/utils/utils') as any;

            const result = await handler!(null, true);

            expect(result.success).toBe(true);
            expect(mockWindowManager.hideInputWindow).toHaveBeenCalled();
            expect(sleep).toHaveBeenCalledWith(100);
            expect(mockWindowManager.focusPreviousApp).toHaveBeenCalled();
        });
    });

    describe('handleShowWindow', () => {
        test('should show window with data', async () => {
            const handler = getHandler('show-window');
            expect(handler).not.toBeNull();

            const testData = { history: [], draft: '' };

            const result = await handler!(null, testData);

            expect(result.success).toBe(true);
            expect(mockWindowManager.showInputWindow).toHaveBeenCalledWith(testData);
        });

        test('should pass settings to window when provided', async () => {
            const handler = getHandler('show-window');
            expect(handler).not.toBeNull();

            mockWindowManager.showInputWindow.mockResolvedValue();

            const windowData = {
                history: [{ text: 'test', timestamp: Date.now(), id: 'test-1' }],
                settings: {
                    shortcuts: { main: 'Cmd+Space', paste: 'Enter', close: 'Escape', historyNext: 'ArrowDown', historyPrev: 'ArrowUp', search: 'Cmd+f' },
                    window: { position: 'cursor' as const, width: 800, height: 400 }
                }
            };

            const result = await handler!(null, windowData);

            expect(result.success).toBe(true);
            expect(mockWindowManager.showInputWindow).toHaveBeenCalledWith(windowData);
        });

        test('should handle show window errors', async () => {
            const handler = getHandler('show-window');
            expect(handler).not.toBeNull();

            mockWindowManager.showInputWindow.mockRejectedValue(new Error('Show failed'));

            const result = await handler!(null, {});

            expect(result.success).toBe(false);
            expect(result.error).toBe('Show failed');
        });
    });

    describe('handleGetAppInfo', () => {
        test('should return application information', async () => {
            const handler = getHandler('get-app-info');
            expect(handler).not.toBeNull();

            const result = await handler!(null);

            expect(result).toEqual(expect.objectContaining({
                name: 'Prompt Line',
                version: '1.0.0',
                platform: process.platform,
                electronVersion: process.versions.electron,
                nodeVersion: process.versions.node,
                isDevelopment: false
            }));
        });
    });

    describe('handleGetConfig', () => {
        test('should return full safe config when no section specified', async () => {
            const handler = getHandler('get-config');
            expect(handler).not.toBeNull();

            const result = await handler!(null);

            expect(result).toHaveProperty('shortcuts');
            expect(result).toHaveProperty('history');
            expect(result).toHaveProperty('draft');
            expect(result).toHaveProperty('timing');
            expect(result).toHaveProperty('app');
            expect(result).toHaveProperty('platform');
        });

        test('should return specific config section', async () => {
            const handler = getHandler('get-config');
            expect(handler).not.toBeNull();

            const config = jest.requireMock('../../src/config/app-config') as any;
            config.get = jest.fn(() => ({ maxItems: 50 }));

            const result = await handler!(null, 'history');

            expect(config.get).toHaveBeenCalledWith('history');
            expect(result).toEqual({ maxItems: 50 });
        });
    });

    describe('removeAllHandlers', () => {
        test('should remove all registered handlers', () => {
            (ipcMain.removeAllListeners as jest.Mock).mockClear();

            ipcHandlers.removeAllHandlers();

            // Should be called for each handler (count: 31 handlers)
            // paste-handler: 2, window-handler: 3, history-draft-handler: 13 (includes 2 at-path cache handlers)
            // system-handler: 4, file-handler: 3, mdsearch-handler: 6
            expect(ipcMain.removeAllListeners).toHaveBeenCalledTimes(31);
            expect(logger.info).toHaveBeenCalledWith('All IPC handlers removed via coordinator');
        });
    });

    describe('getHandlerStats', () => {
        test('should return handler statistics', () => {
            (ipcMain.eventNames as jest.Mock).mockReturnValue(['paste-text', 'get-history', 'hide-window']);

            const stats = ipcHandlers.getHandlerStats();

            expect(stats).toEqual({
                totalHandlers: 3,
                registeredHandlers: ['paste-text', 'get-history', 'hide-window'],
                timestamp: expect.any(Number)
            });
        });
    });
});
