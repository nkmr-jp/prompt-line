import type { Mocked, Mock } from 'vitest';
import IPCHandlers from '../../src/handlers/ipc-handlers';
import { ipcMain, clipboard } from 'electron';
import type WindowManager from '../../src/managers/window';
import type HistoryManager from '../../src/managers/history-manager';
import type DraftManager from '../../src/managers/draft-manager';
import * as utils from '../../src/utils/utils';
import * as appConfig from '../../src/config/app-config';

// Unmock path module (needed for prefix-resolver)
vi.unmock('path');

// Mock glob module
vi.mock('glob', () => ({
  glob: vi.fn()
}));

// Mock dependencies
const mockWindowManager: Mocked<WindowManager> = {
    hideInputWindow: vi.fn(),
    showInputWindow: vi.fn(),
    focusPreviousApp: vi.fn(() => Promise.resolve(true)),
    getInputWindow: vi.fn(),
    getPreviousApp: vi.fn(() => ({ name: 'TestApp', bundleId: 'com.test.app' })),
    isVisible: vi.fn(() => false),
    createInputWindow: vi.fn(),
    repositionWindow: vi.fn(),
    registerShortcuts: vi.fn(),
    unregisterShortcuts: vi.fn(),
    destroy: vi.fn()
} as any;

const mockHistoryManager: Mocked<HistoryManager> = {
    addToHistory: vi.fn(() => Promise.resolve({ id: 'test-id', text: 'test', timestamp: Date.now() })),
    getHistory: vi.fn(() => []),
    clearHistory: vi.fn(() => Promise.resolve()),
    removeHistoryItem: vi.fn(() => Promise.resolve(true)),
    searchHistory: vi.fn(() => []),
    getHistoryStats: vi.fn(() => ({
        totalItems: 0,
        totalCharacters: 0,
        averageLength: 0,
        oldestTimestamp: null,
        newestTimestamp: null,
        maxItems: 50
    })),
    initialize: vi.fn(),
    getHistoryItem: vi.fn(),
    getRecentHistory: vi.fn(),
    exportHistory: vi.fn(),
    importHistory: vi.fn()
} as any;

const mockDraftManager: Mocked<DraftManager> = {
    saveDraft: vi.fn(() => Promise.resolve()),
    saveDraftImmediately: vi.fn(() => Promise.resolve()),
    clearDraft: vi.fn(() => Promise.resolve()),
    getCurrentDraft: vi.fn(() => ''),
    getDraftStats: vi.fn(() => ({ hasContent: false, length: 0, wordCount: 0, lineCount: 0 })),
    initialize: vi.fn(),
    hasDraft: vi.fn(),
    getDraftMetadata: vi.fn(),
    updateDraft: vi.fn(),
    backupDraft: vi.fn(),
    restoreDraft: vi.fn(),
    cleanupBackups: vi.fn(),
    destroy: vi.fn(),
    setDirectory: vi.fn(),
    getDirectory: vi.fn(() => null)
} as any;

// Mock utils
vi.mock('../../src/utils/utils', () => ({
    logger: {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    },
    pasteWithNativeTool: vi.fn(() => Promise.resolve()),
    activateAndPasteWithNativeTool: vi.fn(() => Promise.resolve()),
    sleep: vi.fn(() => Promise.resolve()),
    SecureErrors: {
        INVALID_INPUT: 'Invalid input provided',
        OPERATION_FAILED: 'Operation failed',
        FILE_NOT_FOUND: 'File not found',
        PERMISSION_DENIED: 'Permission denied',
        INTERNAL_ERROR: 'An internal error occurred',
        INVALID_FORMAT: 'Invalid format',
        SIZE_LIMIT_EXCEEDED: 'Size limit exceeded'
    },
    checkAccessibilityPermission: vi.fn(() => Promise.resolve({ hasPermission: true, bundleId: 'test' }))
}));

// Mock config
vi.mock('../../src/config/app-config', () => {
    const configObj = {
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
        paths: {
            builtInCommandsDir: '/test/.prompt-line/built-in-commands'
        },
        shortcuts: { main: 'Cmd+Shift+Space' },
        history: { maxItems: 50 },
        draft: { saveDelay: 500 },
        isDevelopment: vi.fn(() => false),
        get: vi.fn((key: string) => {
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
    };
    return { ...configObj, default: configObj };
});

const { logger, pasteWithNativeTool, activateAndPasteWithNativeTool } = utils as any;

/**
 * Helper function to get a registered IPC handler from the mock
 * After IPCHandlers is instantiated, we can retrieve handlers from ipcMain.handle mock calls
 */
type HandlerFunction = (event: any, ...args: any[]) => Promise<any>;
function getHandler(channel: string): HandlerFunction | null {
    const calls = (ipcMain.handle as Mock).mock.calls as [string, HandlerFunction][];
    const call = calls.find((c) => c[0] === channel);
    return call ? call[1] : null;
}

describe('IPCHandlers', () => {
    let ipcHandlers: IPCHandlers;
    let mockSettingsManager: any;
    let mockDirectoryManager: any;

    beforeEach(() => {
        vi.clearAllMocks();
        (ipcMain.handle as Mock).mockClear();

        mockSettingsManager = {
            getSettings: vi.fn(() => ({
                shortcuts: { main: 'Ctrl+Space', paste: 'Enter', close: 'Escape' },
                window: { position: 'cursor', width: 600, height: 300 }
            })),
            updateSettings: vi.fn(),
            resetSettings: vi.fn(),
            getCustomSearchEntries: vi.fn(() => []),
            getBuiltInCommandsSettings: vi.fn(() => undefined),
            // EventEmitter methods for hot reload
            on: vi.fn(),
            off: vi.fn(),
            emit: vi.fn(),
            removeAllListeners: vi.fn()
        };

        mockDirectoryManager = {
            getDirectory: vi.fn(() => null),
            setDirectory: vi.fn(),
            saveDirectory: vi.fn()
        };

        const mockBuiltInCommandsManager = {
            initialize: vi.fn(),
            destroy: vi.fn(),
            getTargetDirectory: vi.fn(() => '/test/built-in-commands'),
            on: vi.fn(),
            emit: vi.fn()
        };

        ipcHandlers = new IPCHandlers(
            mockWindowManager,
            mockHistoryManager,
            mockDraftManager,
            mockDirectoryManager,
            mockSettingsManager,
            mockBuiltInCommandsManager as any
        );
    });

    describe('initialization', () => {
        test('should register all IPC handlers', () => {
            expect(ipcMain.handle).toHaveBeenCalledWith('paste-text', expect.any(Function));
            expect(ipcMain.handle).toHaveBeenCalledWith('get-history', expect.any(Function));
            expect(ipcMain.handle).toHaveBeenCalledWith('clear-history', expect.any(Function));
            expect(ipcMain.handle).toHaveBeenCalledWith('save-draft', expect.any(Function));
            expect(ipcMain.handle).toHaveBeenCalledWith('hide-window', expect.any(Function));
        });
    });

    describe('handlePasteText', () => {
        test('should handle successful paste operation', async () => {
            const handler = getHandler('paste-text');
            expect(handler).not.toBeNull();

            (clipboard.writeText as Mock).mockImplementation(() => {});
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

            (clipboard.writeText as Mock).mockImplementation(() => {});
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

            (clipboard.writeText as Mock).mockImplementation(() => {});
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

            (clipboard.writeText as Mock).mockImplementation(() => {});
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

            (clipboard.writeText as Mock).mockImplementation(() => {});
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

            const result = await handler!(null, 'test draft', 0, false);

            expect(result.success).toBe(true);
            expect(mockDraftManager.saveDraft).toHaveBeenCalledWith('test draft', 0);
            expect(mockDraftManager.saveDraftImmediately).not.toHaveBeenCalled();
        });

        test('should save draft immediately when requested', async () => {
            const handler = getHandler('save-draft');
            expect(handler).not.toBeNull();

            const result = await handler!(null, 'test draft', 100, true);

            expect(result.success).toBe(true);
            expect(mockDraftManager.saveDraftImmediately).toHaveBeenCalledWith('test draft', 100);
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

            const { sleep } = utils as any;

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

            const { sleep } = utils as any;

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

            const config = (appConfig as any).default;
            config.get = vi.fn(() => ({ maxItems: 50 }));

            const result = await handler!(null, 'history');

            expect(config.get).toHaveBeenCalledWith('history');
            expect(result).toEqual({ maxItems: 50 });
        });
    });

    describe('removeAllHandlers', () => {
        test('should remove all registered handlers', () => {
            (ipcMain.removeAllListeners as Mock).mockClear();

            ipcHandlers.removeAllHandlers();

            // Should be called for each handler (count: 44 handlers)
            // paste-handler: 2, window-handler: 3, history-draft-handler: 14 (includes 2 at-path cache handlers + save-draft-to-history)
            // system-handler: 5, file-handler: 4 (includes reveal-in-finder), custom-search-handler: 10 (includes has-command-file + 3 slash command cache handlers), code-search-handler: 1
            // usage-history-handler: 6 (record/get bonuses for file, symbol, agent)
            expect(ipcMain.removeAllListeners).toHaveBeenCalledTimes(44);
            expect(logger.info).toHaveBeenCalledWith('All IPC handlers removed via coordinator');
        });
    });

    describe('getHandlerStats', () => {
        test('should return handler statistics', () => {
            (ipcMain.eventNames as Mock).mockReturnValue(['paste-text', 'get-history', 'hide-window']);

            const stats = ipcHandlers.getHandlerStats();

            expect(stats).toEqual({
                totalHandlers: 3,
                registeredHandlers: ['paste-text', 'get-history', 'hide-window'],
                timestamp: expect.any(Number)
            });
        });
    });
});
