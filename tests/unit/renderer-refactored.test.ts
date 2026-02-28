// @vitest-environment jsdom

import type { Mocked, MockedFunction } from 'vitest';
import type { IpcRenderer } from 'electron';

// vi.hoisted ensures mockIpcRenderer is available when vi.mock factory runs
const { mockIpcRenderer } = vi.hoisted(() => ({
    mockIpcRenderer: {
        invoke: vi.fn(),
        on: vi.fn(),
        once: vi.fn(),
        removeListener: vi.fn(),
        removeAllListeners: vi.fn(),
        setMaxListeners: vi.fn(),
        getMaxListeners: vi.fn(),
        listeners: vi.fn(),
        rawListeners: vi.fn(),
        emit: vi.fn(),
        listenerCount: vi.fn(),
        prependListener: vi.fn(),
        prependOnceListener: vi.fn(),
        eventNames: vi.fn(),
        addListener: vi.fn(),
        off: vi.fn(),
        send: vi.fn(),
        sendSync: vi.fn(),
        postMessage: vi.fn(),
        sendToHost: vi.fn()
    } as any as Mocked<IpcRenderer>
}));

// Mock electron module
vi.mock('electron', () => ({
    ipcRenderer: mockIpcRenderer
}));

// Mock EventHandler
vi.mock('../../src/renderer/event-handler', () => ({
    EventHandler: vi.fn(function() { return {
        setTextarea: vi.fn(),
        setSearchManager: vi.fn(),
        setAgentSkillManager: vi.fn(),
        setMentionManager: vi.fn(),
        setDomManager: vi.fn(),
        setUserSettings: vi.fn(),
        setupEventListeners: vi.fn(),
        getIsComposing: vi.fn().mockReturnValue(false)
    }; })
}));

// Mock HistorySearchManager
vi.mock('../../src/renderer/history-search', () => ({
    HistorySearchManager: vi.fn(function() { return {
        initializeElements: vi.fn(),
        setupEventListeners: vi.fn(),
        updateHistoryData: vi.fn(),
        isInSearchMode: vi.fn().mockReturnValue(false),
        getSearchTerm: vi.fn().mockReturnValue(''),
        focusMainTextarea: vi.fn(),
        exitSearchMode: vi.fn(),
        highlightSearchTerms: vi.fn((text: string) => text),
        cleanup: vi.fn()
    }; })
}));

// Mock the new modular classes
vi.mock('../../src/renderer/dom-manager', () => ({
    DomManager: vi.fn(function() { return {
        initializeElements: vi.fn(),
        textarea: {
            addEventListener: vi.fn(),
            value: '',
            selectionStart: 0,
            selectionEnd: 0,
            setSelectionRange: vi.fn(),
            focus: vi.fn(),
            select: vi.fn()
        },
        appNameEl: { textContent: '', style: {} },
        charCountEl: { textContent: '' },
        historyList: {
            innerHTML: '',
            querySelectorAll: vi.fn(() => []),
            classList: { add: vi.fn(), remove: vi.fn() }
        },
        searchInput: { addEventListener: vi.fn() },
        updateCharCount: vi.fn(),
        updateAppName: vi.fn(),
        updateHintText: vi.fn(),
        showError: vi.fn(),
        insertTextAtCursor: vi.fn(),
        clearText: vi.fn(),
        setText: vi.fn(),
        getCurrentText: vi.fn(() => ''),
        focusTextarea: vi.fn(),
        selectAll: vi.fn(),
        setCursorPosition: vi.fn()
    }; })
}));

vi.mock('../../src/renderer/draft-manager-client', () => ({
    DraftManagerClient: vi.fn(function() { return {
        setConfig: vi.fn(),
        saveDraftDebounced: vi.fn(),
        saveDraftImmediate: vi.fn(),
        clearDraft: vi.fn(),
        extractDraftValue: vi.fn((draft: any) => typeof draft === 'string' ? draft : (draft?.text || '')),
        cleanup: vi.fn()
    }; })
}));

vi.mock('../../src/renderer/history-ui-manager', () => ({
    HistoryUIManager: vi.fn(function() { return {
        renderHistory: vi.fn(),
        navigateHistory: vi.fn(),
        clearHistorySelection: vi.fn(),
        setupScrollListener: vi.fn(),
        cleanup: vi.fn()
    }; })
}));

vi.mock('../../src/renderer/lifecycle-manager', () => ({
    LifecycleManager: vi.fn(function() { return {
        handleWindowShown: vi.fn(),
        handleWindowHide: vi.fn(),
        getUserSettings: vi.fn(() => null)
    }; })
}));

// Mock MentionManager (init: initializeElements, setupEventListeners; tests: clearAtPaths, destroy)
vi.mock('../../src/renderer/mention-manager', () => ({
    MentionManager: vi.fn(function() { return {
        initializeElements: vi.fn(),
        setupEventListeners: vi.fn(),
        clearAtPaths: vi.fn(),
        destroy: vi.fn()
    }; })
}));

// Mock AgentSkillManager (init: initializeElements, setupEventListeners, loadSkills; tests: invalidateCache)
vi.mock('../../src/renderer/agent-skill-manager', () => ({
    AgentSkillManager: vi.fn(function() { return {
        initializeElements: vi.fn(),
        setupEventListeners: vi.fn(),
        loadSkills: vi.fn(),
        invalidateCache: vi.fn(),
        getSkillSource: vi.fn(),
        getSkillColor: vi.fn(),
        getKnownSkillNames: vi.fn().mockReturnValue([])
    }; })
}));

// Mock SimpleSnapshotManager (tests: clearSnapshot, saveSnapshot, hasSnapshot, restore)
vi.mock('../../src/renderer/snapshot-manager', () => ({
    SimpleSnapshotManager: vi.fn(function() { return {
        saveSnapshot: vi.fn(),
        clearSnapshot: vi.fn(),
        hasSnapshot: vi.fn().mockReturnValue(false),
        restore: vi.fn()
    }; })
}));

// Mock DirectoryDataHandler (tests: handleWindowShown)
vi.mock('../../src/renderer/directory-data-handler', () => ({
    DirectoryDataHandler: vi.fn(function() { return {
        handleWindowShown: vi.fn(),
        handleDirectoryDataUpdated: vi.fn()
    }; })
}));

// Mock window.require before any imports
(window as any).require = vi.fn((module: string) => {
    if (module === 'electron') {
        return { ipcRenderer: mockIpcRenderer };
    }
    return {};
});

// Mock window.electronAPI
const mockPasteText = vi.fn() as MockedFunction<any>;
const mockPasteImage = vi.fn() as MockedFunction<any>;
mockPasteText.mockResolvedValue({ success: true });
mockPasteImage.mockResolvedValue({ success: true, path: '/tmp/image.png' });

(window as any).electronAPI = {
    pasteText: mockPasteText,
    pasteImage: mockPasteImage,
    invoke: vi.fn(),
    on: vi.fn(),
    paste: {
        text: vi.fn(),
        image: vi.fn()
    },
    draft: {
        save: vi.fn(),
        clear: vi.fn(),
        get: vi.fn()
    },
    history: {
        get: vi.fn(),
        clear: vi.fn(),
        remove: vi.fn(),
        search: vi.fn()
    },
    window: {
        hide: vi.fn(),
        show: vi.fn()
    },
    config: {
        get: vi.fn()
    },
    app: {
        getInfo: vi.fn()
    }
};

// Set up DOM
beforeEach(() => {
    // Clear document
    document.head.innerHTML = '';
    document.body.innerHTML = '';

    vi.spyOn(document, 'getElementById').mockImplementation(() => null);
    vi.spyOn(document, 'addEventListener').mockImplementation(() => {});
    vi.spyOn(window, 'addEventListener').mockImplementation(() => {});

    // Mock config
    mockIpcRenderer.invoke.mockResolvedValue({
        draft: { saveDelay: 500 }
    });

    // Setup electronAPI.invoke to delegate to mockIpcRenderer.invoke
    (window as any).electronAPI.invoke = mockIpcRenderer.invoke;

    vi.clearAllMocks();
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
            const mockEvent = { preventDefault: vi.fn() } as any;
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
                (renderer as any).filteredHistoryData,
                (renderer as any).totalMatchCount
            );
        });
    });

    describe('window lifecycle', () => {
        test('should delegate window shown to directoryDataHandler', () => {
            const windowData = {
                draft: 'test draft',
                history: [],
                sourceApp: 'TestApp'
            };

            // Set initCompleted to true to allow immediate processing
            // (otherwise the data is queued for later processing)
            (renderer as any).initCompleted = true;

            (renderer as any).handleWindowShown(windowData);

            expect((renderer as any).directoryDataHandler.handleWindowShown).toHaveBeenCalledWith(windowData);
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
            (renderer as any).domManager.getCurrentText = vi.fn().mockReturnValue('initial text');
            (renderer as any).domManager.setCursorPosition = vi.fn();

            const event = new KeyboardEvent('keydown', {
                key: 'v',
                metaKey: true
            });
            event.preventDefault = vi.fn();

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
            event.preventDefault = vi.fn();

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
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            (window as any).electronAPI.pasteText.mockResolvedValue({
                success: false,
                error: 'Paste failed'
            });

            await (renderer as any).handleTextPasteCallback('test text');

            expect((renderer as any).domManager.showError).toHaveBeenCalledWith('Paste failed: Paste failed');
            consoleSpy.mockRestore();
        });
    });

    describe('search state handling', () => {
        test('should update filtered data and render history', () => {
            const filteredData = [{ text: 'filtered', timestamp: Date.now(), id: '1' }];
            const totalMatches = 100;

            (renderer as any).handleSearchStateChange(true, filteredData, totalMatches);

            expect((renderer as any).filteredHistoryData).toBe(filteredData);
            expect((renderer as any).totalMatchCount).toBe(totalMatches);
            expect((renderer as any).historyUIManager.renderHistory).toHaveBeenCalledWith(filteredData, totalMatches);
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
                preventDefault: vi.fn(),
                stopPropagation: vi.fn(),
                stopImmediatePropagation: vi.fn()
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