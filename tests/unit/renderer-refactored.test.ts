/**
 * @jest-environment jsdom
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import type { IpcRenderer } from 'electron';

// Mock electron before importing renderer
const mockIpcRenderer: jest.Mocked<IpcRenderer> = {
    invoke: jest.fn(),
    on: jest.fn(),
    once: jest.fn(),
    removeListener: jest.fn(),
    removeAllListeners: jest.fn(),
    setMaxListeners: jest.fn(),
    getMaxListeners: jest.fn(),
    listeners: jest.fn(),
    rawListeners: jest.fn(),
    emit: jest.fn(),
    listenerCount: jest.fn(),
    prependListener: jest.fn(),
    prependOnceListener: jest.fn(),
    eventNames: jest.fn(),
    addListener: jest.fn(),
    off: jest.fn(),
    send: jest.fn(),
    sendSync: jest.fn(),
    postMessage: jest.fn(),
    sendToHost: jest.fn()
} as any;

// Mock electron module
jest.mock('electron', () => ({
    ipcRenderer: mockIpcRenderer
}));

// Mock EventHandler
jest.mock('../../src/renderer/event-handler', () => ({
    EventHandler: jest.fn().mockImplementation(() => ({
        setTextarea: jest.fn(),
        setSearchManager: jest.fn(),
        setupEventListeners: jest.fn(),
        getIsComposing: jest.fn().mockReturnValue(false)
    }))
}));

// Mock SearchManager
jest.mock('../../src/renderer/search-manager', () => ({
    SearchManager: jest.fn().mockImplementation(() => ({
        initializeElements: jest.fn(),
        setupEventListeners: jest.fn(),
        updateHistoryData: jest.fn(),
        isInSearchMode: jest.fn().mockReturnValue(false),
        getSearchTerm: jest.fn().mockReturnValue(''),
        focusMainTextarea: jest.fn()
    }))
}));

// Mock the new modular classes
jest.mock('../../src/renderer/dom-manager', () => ({
    DomManager: jest.fn().mockImplementation(() => ({
        initializeElements: jest.fn(),
        textarea: { 
            addEventListener: jest.fn(), 
            value: '', 
            selectionStart: 0, 
            selectionEnd: 0, 
            setSelectionRange: jest.fn(), 
            focus: jest.fn(), 
            select: jest.fn() 
        },
        appNameEl: { textContent: '', style: {} },
        charCountEl: { textContent: '' },
        historyList: { 
            innerHTML: '', 
            querySelectorAll: jest.fn(() => []), 
            classList: { add: jest.fn(), remove: jest.fn() } 
        },
        searchInput: { addEventListener: jest.fn() },
        updateCharCount: jest.fn(),
        updateAppName: jest.fn(),
        showError: jest.fn(),
        insertTextAtCursor: jest.fn(),
        clearText: jest.fn(),
        setText: jest.fn(),
        getCurrentText: jest.fn(() => ''),
        focusTextarea: jest.fn(),
        selectAll: jest.fn(),
        setCursorPosition: jest.fn()
    }))
}));

jest.mock('../../src/renderer/draft-manager', () => ({
    DraftManager: jest.fn().mockImplementation(() => ({
        setConfig: jest.fn(),
        saveDraftDebounced: jest.fn(),
        saveDraftImmediate: jest.fn(),
        clearDraft: jest.fn(),
        extractDraftValue: jest.fn((draft: any) => typeof draft === 'string' ? draft : (draft?.text || '')),
        cleanup: jest.fn()
    }))
}));

jest.mock('../../src/renderer/history-ui-manager', () => ({
    HistoryUIManager: jest.fn().mockImplementation(() => ({
        renderHistory: jest.fn(),
        navigateHistory: jest.fn(),
        clearHistorySelection: jest.fn(),
        cleanup: jest.fn()
    }))
}));

jest.mock('../../src/renderer/lifecycle-manager', () => ({
    LifecycleManager: jest.fn().mockImplementation(() => ({
        handleWindowShown: jest.fn(),
        handleWindowHide: jest.fn(),
        getUserSettings: jest.fn(() => null)
    }))
}));

// Mock window.require before any imports
(window as any).require = jest.fn((module: string) => {
    if (module === 'electron') {
        return { ipcRenderer: mockIpcRenderer };
    }
    return {};
});

// Mock window.electronAPI
const mockPasteText = jest.fn() as jest.MockedFunction<any>;
const mockPasteImage = jest.fn() as jest.MockedFunction<any>;
mockPasteText.mockResolvedValue({ success: true });
mockPasteImage.mockResolvedValue({ success: true, path: '/tmp/image.png' });

(window as any).electronAPI = {
    pasteText: mockPasteText,
    pasteImage: mockPasteImage,
    invoke: jest.fn(),
    on: jest.fn(),
    paste: {
        text: jest.fn(),
        image: jest.fn()
    },
    draft: {
        save: jest.fn(),
        clear: jest.fn(),
        get: jest.fn()
    },
    history: {
        get: jest.fn(),
        clear: jest.fn(),
        remove: jest.fn(),
        search: jest.fn()
    },
    window: {
        hide: jest.fn(),
        show: jest.fn()
    },
    config: {
        get: jest.fn()
    },
    app: {
        getInfo: jest.fn()
    }
};

// Set up DOM
beforeEach(() => {
    // Clear document
    document.head.innerHTML = '';
    document.body.innerHTML = '';

    jest.spyOn(document, 'getElementById').mockImplementation(() => null);
    jest.spyOn(document, 'addEventListener').mockImplementation(() => {});
    jest.spyOn(window, 'addEventListener').mockImplementation(() => {});

    // Mock config
    mockIpcRenderer.invoke.mockResolvedValue({
        draft: { saveDelay: 500 }
    });

    // Setup electronAPI.invoke to delegate to mockIpcRenderer.invoke
    (window as any).electronAPI.invoke = mockIpcRenderer.invoke;

    jest.clearAllMocks();
});

// Import the renderer class directly - moved after mocks are set up
let PromptLineRenderer: any;
beforeAll(async () => {
    // Dynamically import after mocks are set up
    const rendererModule = await import('../../src/renderer/renderer');
    PromptLineRenderer = rendererModule.PromptLineRenderer;
});

describe('PromptLineRenderer (Refactored)', () => {
    let renderer: any;

    beforeEach(async () => {
        renderer = new PromptLineRenderer();
        
        // Wait for async initialization
        await new Promise(resolve => setTimeout(resolve, 0));
    });

    afterEach(() => {
        // Clean up any timers to prevent Jest from hanging
        if (renderer) {
            renderer.cleanup();
        }
    });

    describe('initialization', () => {
        test('should initialize with manager pattern', () => {
            expect((renderer as any).domManager).toBeDefined();
            expect((renderer as any).draftManager).toBeDefined();
            expect((renderer as any).historyUIManager).toBeDefined();
            expect((renderer as any).lifecycleManager).toBeDefined();
        });

        test('should set up event handlers and search manager', () => {
            expect((renderer as any).eventHandler).toBeDefined();
            expect((renderer as any).searchManager).toBeDefined();
        });

        test('should call domManager initializeElements', () => {
            expect((renderer as any).domManager.initializeElements).toHaveBeenCalled();
        });

        test('should configure draft manager with config', () => {
            expect((renderer as any).draftManager.setConfig).toHaveBeenCalled();
        });
    });

    describe('public API delegation', () => {
        test('should delegate getCurrentText to domManager', () => {
            renderer.getCurrentText();
            expect((renderer as any).domManager.getCurrentText).toHaveBeenCalled();
        });

        test('should delegate setText to domManager', () => {
            renderer.setText('test text');
            expect((renderer as any).domManager.setText).toHaveBeenCalledWith('test text');
        });

        test('should delegate clearText to domManager', () => {
            renderer.clearText();
            expect((renderer as any).domManager.clearText).toHaveBeenCalled();
        });

        test('should delegate focus to domManager', () => {
            renderer.focus();
            expect((renderer as any).domManager.focusTextarea).toHaveBeenCalled();
        });
    });

    describe('event handling delegation', () => {
        test('should call historyUIManager for history navigation', () => {
            const mockEvent = { preventDefault: jest.fn() } as any;
            (renderer as any).navigateHistory(mockEvent, 'next');
            
            expect((renderer as any).historyUIManager.navigateHistory).toHaveBeenCalledWith(
                mockEvent, 
                'next', 
                (renderer as any).filteredHistoryData
            );
        });

        test('should call historyUIManager for rendering', () => {
            (renderer as any).renderHistory();
            
            expect((renderer as any).historyUIManager.renderHistory).toHaveBeenCalledWith(
                (renderer as any).filteredHistoryData
            );
        });
    });

    describe('window lifecycle', () => {
        test('should delegate window shown to lifecycleManager', () => {
            const windowData = {
                draft: 'test draft',
                history: [],
                sourceApp: 'TestApp'
            };

            (renderer as any).handleWindowShown(windowData);

            expect((renderer as any).lifecycleManager.handleWindowShown).toHaveBeenCalledWith(windowData);
        });

        test('should delegate window hide to draftManager', async () => {
            await (renderer as any).handleWindowHideCallback();

            expect((renderer as any).draftManager.saveDraftImmediate).toHaveBeenCalled();
        });
    });

    describe('image paste handling', () => {
        test('should handle image paste with domManager', async () => {
            mockIpcRenderer.invoke.mockImplementation((channel: string) => {
                if (channel === 'paste-image') {
                    return Promise.resolve({ success: true, path: '/tmp/image.png' });
                }
                return Promise.resolve({});
            });

            // Mock textarea properties for the new implementation
            (renderer as any).domManager.textarea.selectionStart = 0;
            (renderer as any).domManager.getCurrentText = jest.fn().mockReturnValue('initial text');
            (renderer as any).domManager.setCursorPosition = jest.fn();

            const event = new KeyboardEvent('keydown', {
                key: 'v',
                metaKey: true
            });
            event.preventDefault = jest.fn();

            // Handle the keydown event (which sets up the setTimeout)
            await (renderer as any).handleKeyDown(event);

            // Wait for the setTimeout to execute
            await new Promise(resolve => setTimeout(resolve, 10));

            // With the new implementation, the image paste restores original text then inserts image path
            expect((renderer as any).domManager.setText).toHaveBeenCalledWith('initial text');
            expect((renderer as any).domManager.setCursorPosition).toHaveBeenCalledWith(0);
            expect((renderer as any).domManager.insertTextAtCursor).toHaveBeenCalledWith('/tmp/image.png');
            expect((renderer as any).draftManager.saveDraftDebounced).toHaveBeenCalled();
        });

        test('should not prevent default when no image', async () => {
            mockIpcRenderer.invoke.mockImplementation((channel: string) => {
                if (channel === 'paste-image') {
                    return Promise.resolve({ success: false });
                }
                return Promise.resolve({});
            });

            const event = new KeyboardEvent('keydown', {
                key: 'v',
                metaKey: true
            });
            event.preventDefault = jest.fn();

            await (renderer as any).handleKeyDown(event);

            expect(event.preventDefault).not.toHaveBeenCalled();
        });
    });

    describe('text paste callback', () => {
        test('should clear text and draft on successful paste', async () => {
            (window as any).electronAPI.pasteText.mockResolvedValue({ success: true });

            await (renderer as any).handleTextPasteCallback('test text');

            expect((renderer as any).domManager.clearText).toHaveBeenCalled();
            expect((renderer as any).draftManager.clearDraft).toHaveBeenCalled();
            expect((renderer as any).historyUIManager.clearHistorySelection).toHaveBeenCalled();
        });

        test('should show error on paste failure', async () => {
            (window as any).electronAPI.pasteText.mockResolvedValue({ 
                success: false, 
                error: 'Paste failed' 
            });

            await (renderer as any).handleTextPasteCallback('test text');

            expect((renderer as any).domManager.showError).toHaveBeenCalledWith('Paste failed: Paste failed');
        });
    });

    describe('search state handling', () => {
        test('should update filtered data and render history', () => {
            const filteredData = [{ text: 'filtered', timestamp: Date.now(), id: '1' }];

            (renderer as any).handleSearchStateChange(true, filteredData);

            expect((renderer as any).filteredHistoryData).toBe(filteredData);
            expect((renderer as any).historyUIManager.renderHistory).toHaveBeenCalledWith(filteredData);
        });

        test('should focus main textarea when exiting search', () => {
            const filteredData: any[] = [];

            (renderer as any).handleSearchStateChange(false, filteredData);

            expect((renderer as any).searchManager.focusMainTextarea).toHaveBeenCalled();
        });
    });

    describe('cleanup', () => {
        test('should call cleanup on all managers', () => {
            renderer.cleanup();

            expect((renderer as any).draftManager.cleanup).toHaveBeenCalled();
            expect((renderer as any).historyUIManager.cleanup).toHaveBeenCalled();
        });
    });

    describe('tab key handling', () => {
        test('should insert tab and save draft', () => {
            const event = {
                preventDefault: jest.fn(),
                stopPropagation: jest.fn(),
                stopImmediatePropagation: jest.fn()
            } as any;

            (renderer as any).handleTabKeyCallback(event);

            expect(event.preventDefault).toHaveBeenCalled();
            expect(event.stopPropagation).toHaveBeenCalled();
            expect(event.stopImmediatePropagation).toHaveBeenCalled();
            expect((renderer as any).domManager.insertTextAtCursor).toHaveBeenCalledWith('\t');
            expect((renderer as any).draftManager.saveDraftDebounced).toHaveBeenCalled();
        });
    });
});