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

// Mock DOM elements
const createMockTextarea = () => ({
    addEventListener: jest.fn(),
    value: '',
    selectionStart: 0,
    selectionEnd: 0,
    setSelectionRange: jest.fn(),
    focus: jest.fn(),
    select: jest.fn(),
    dispatchEvent: jest.fn()
});

const createMockElement = () => ({
    textContent: '',
    style: {} as CSSStyleDeclaration,
    innerHTML: '',
    addEventListener: jest.fn(),
    querySelectorAll: jest.fn(() => []),
    dataset: {} as DOMStringMap,
    classList: {
        add: jest.fn(),
        remove: jest.fn(),
        contains: jest.fn(),
        toggle: jest.fn()
    }
});

// Mock window.require before any imports
(window as any).require = jest.fn((module: string) => {
    if (module === 'electron') {
        return { ipcRenderer: mockIpcRenderer };
    }
    return {};
});

// Set up DOM
beforeEach(() => {
    // Clear document
    document.head.innerHTML = '';
    document.body.innerHTML = '';

    // Create mock elements
    const mockTextarea = createMockTextarea();
    const mockAppName = createMockElement();
    const mockCharCount = createMockElement();
    const mockHistoryList = createMockElement();

    jest.spyOn(document, 'getElementById').mockImplementation((id: string) => {
        switch (id) {
            case 'textInput': return mockTextarea as any;
            case 'appName': return mockAppName as any;
            case 'charCount': return mockCharCount as any;
            case 'historyList': return mockHistoryList as any;
            case 'searchInput': return createMockElement() as any;
            case 'searchButton': return createMockElement() as any;
            default: return null;
        }
    });

    jest.spyOn(document, 'addEventListener').mockImplementation(() => {});
    jest.spyOn(document, 'createElement').mockImplementation(() => ({
        textContent: '',
        innerHTML: ''
    } as any));
    jest.spyOn(document, 'querySelector').mockImplementation((selector: string) => {
        if (selector === '.history-header') {
            return createMockElement() as any;
        }
        return null;
    });
    jest.spyOn(window, 'addEventListener').mockImplementation(() => {});

    // Mock config
    mockIpcRenderer.invoke.mockResolvedValue({
        draft: { saveDelay: 500 }
    });

    jest.clearAllMocks();
});


// Import the renderer class directly
import { PromptLineRenderer } from '../../src/renderer/renderer';

describe('PromptLineRenderer', () => {
    let renderer: PromptLineRenderer;

    beforeEach(async () => {
        // Create a new renderer instance directly
        renderer = new PromptLineRenderer();
        
        // Call init method if it exists, or wait for async initialization
        if ((renderer as any).init && typeof (renderer as any).init === 'function') {
            await (renderer as any).init();
        } else {
            // Wait for any async initialization
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    });

    describe('initialization', () => {
        test('should initialize with correct DOM elements', () => {
            expect(document.getElementById).toHaveBeenCalledWith('textInput');
            expect(document.getElementById).toHaveBeenCalledWith('appName');
            expect(document.getElementById).toHaveBeenCalledWith('charCount');
            expect(document.getElementById).toHaveBeenCalledWith('historyList');
        });

        test('should set up event listeners', () => {
            expect((renderer as any).textarea.addEventListener).toHaveBeenCalledWith('input', expect.any(Function));
            expect((renderer as any).textarea.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
            // EventHandler sets up document keydown listener, not renderer
            expect((renderer as any).eventHandler.setupEventListeners).toHaveBeenCalled();
        });

        test('should set up IPC listeners', () => {
            expect(mockIpcRenderer.on).toHaveBeenCalledWith('window-shown', expect.any(Function));
        });
    });

    describe('handleKeyDown', () => {
        test.skip('should handle Cmd+Enter for paste', async () => {
            (renderer as any).textarea.value = 'test text';
            mockIpcRenderer.invoke.mockResolvedValue({ success: true });

            const event = new KeyboardEvent('keydown', {
                key: 'Enter',
                metaKey: true
            });
            event.preventDefault = jest.fn();

            await (renderer as any).handleKeyDown(event);

            expect(event.preventDefault).toHaveBeenCalled();
            expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('paste-text', 'test text');
        });

        test.skip('should clear textarea on successful paste', async () => {
            (renderer as any).textarea.value = 'test text';
            mockIpcRenderer.invoke.mockResolvedValue({ success: true });

            const event = new KeyboardEvent('keydown', {
                key: 'Enter',
                metaKey: true
            });
            event.preventDefault = jest.fn();

            await (renderer as any).handleKeyDown(event);

            expect((renderer as any).textarea.value).toBe('');
        });

        test.skip('should clear draft when paste is successful', async () => {
            (renderer as any).textarea.value = 'test text';
            mockIpcRenderer.invoke.mockResolvedValue({ success: true });

            const event = new KeyboardEvent('keydown', {
                key: 'Enter',
                metaKey: true
            });
            event.preventDefault = jest.fn();

            await (renderer as any).handleKeyDown(event);

            // Verify that clear-draft was called
            expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('clear-draft');
        });

        test('should not clear textarea on paste failure', async () => {
            (renderer as any).textarea.value = 'test text';
            mockIpcRenderer.invoke.mockResolvedValue({ 
                success: false, 
                error: 'Paste failed' 
            });

            const event = new KeyboardEvent('keydown', {
                key: 'Enter',
                metaKey: true
            });
            event.preventDefault = jest.fn();

            await (renderer as any).handleKeyDown(event);

            expect((renderer as any).textarea.value).toBe('test text');
        });

        test('should not clear textarea on paste warning', async () => {
            (renderer as any).textarea.value = 'test text';
            mockIpcRenderer.invoke.mockResolvedValue({ 
                success: true, 
                warning: 'Could not focus app' 
            });

            const event = new KeyboardEvent('keydown', {
                key: 'Enter',
                metaKey: true
            });
            event.preventDefault = jest.fn();

            await (renderer as any).handleKeyDown(event);

            expect((renderer as any).textarea.value).toBe('test text');
        });

        test.skip('should handle Escape key for save and hide', async () => {
            (renderer as any).textarea.value = 'draft text';
            mockIpcRenderer.invoke.mockResolvedValue({ success: true });

            const event = new KeyboardEvent('keydown', {
                key: 'Escape'
            });
            event.preventDefault = jest.fn();

            await (renderer as any).handleKeyDown(event);

            expect(event.preventDefault).toHaveBeenCalled();
            expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('save-draft', 'draft text', true);
            expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('hide-window', true);
        });

        test.skip('should handle Tab key insertion', async () => {
            (renderer as any).textarea.value = 'hello world';
            (renderer as any).textarea.selectionStart = 5;
            (renderer as any).textarea.selectionEnd = 5;

            const event = new KeyboardEvent('keydown', {
                key: 'Tab'
            });
            event.preventDefault = jest.fn();
            event.stopPropagation = jest.fn();
            event.stopImmediatePropagation = jest.fn();

            await (renderer as any).handleKeyDown(event);

            expect(event.preventDefault).toHaveBeenCalled();
            expect((renderer as any).textarea.value).toBe('hello\t world');
            expect((renderer as any).textarea.selectionStart).toBe(6);
            expect((renderer as any).textarea.selectionEnd).toBe(6);
        });
    });

    describe('handleWindowShown', () => {
        test('should restore draft content', () => {
            const data = {
                draft: 'restored draft',
                history: [],
                sourceApp: 'TestApp'
            };

            (renderer as any).handleWindowShown(data);

            expect((renderer as any).textarea.value).toBe('restored draft');
            expect((renderer as any).appNameEl.textContent).toBe('Paste to: TestApp (draft restored)');
        });

        test('should clear textarea when no draft', () => {
            const data = {
                draft: '',
                history: [],
                sourceApp: 'TestApp'
            };

            (renderer as any).handleWindowShown(data);

            expect((renderer as any).textarea.value).toBe('');
            expect((renderer as any).appNameEl.textContent).toBe('Paste to: TestApp');
        });

        test('should show default app name for Electron', () => {
            const data = {
                draft: '',
                history: [],
                sourceApp: 'Electron'
            };

            (renderer as any).handleWindowShown(data);

            expect((renderer as any).appNameEl.textContent).toBe('Prompt Line');
        });

        test('should show application name for app with name', () => {
            const data = {
                draft: '',
                history: [],
                sourceApp: {
                    name: 'Visual Studio Code',
                    bundleId: 'com.microsoft.VSCode'
                }
            };

            (renderer as any).handleWindowShown(data);

            expect((renderer as any).appNameEl.textContent).toBe('Paste to: Visual Studio Code');
        });

        test('should handle app with name and bundleId', () => {
            const data = {
                draft: '',
                history: [],
                sourceApp: {
                    name: 'Terminal',
                    bundleId: 'com.apple.Terminal'
                }
            };

            (renderer as any).handleWindowShown(data);

            expect((renderer as any).appNameEl.textContent).toBe('Paste to: Terminal');
        });

        test('should store user settings when provided', () => {
            const settings = {
                shortcuts: { main: 'Cmd+Space', paste: 'Enter', close: 'Escape' },
                window: { position: 'cursor', width: 800, height: 400 },
                history: { maxItems: 100, maxDisplayItems: 25 }
            };

            const data = {
                draft: '',
                history: [],
                sourceApp: 'TestApp',
                settings
            };

            (renderer as any).handleWindowShown(data);

            expect((renderer as any).userSettings).toEqual(settings);
        });

        test('should handle null settings gracefully', () => {
            const data = {
                draft: '',
                history: [],
                sourceApp: 'TestApp'
            };

            (renderer as any).handleWindowShown(data);

            expect((renderer as any).userSettings).toBeNull();
        });
    });

    describe('updateCharCount', () => {
        test('should update character count display', () => {
            (renderer as any).textarea.value = 'hello';

            (renderer as any).updateCharCount();

            expect((renderer as any).charCountEl.textContent).toBe('5 chars');
        });

        test('should show singular for single character', () => {
            (renderer as any).textarea.value = 'a';

            (renderer as any).updateCharCount();

            expect((renderer as any).charCountEl.textContent).toBe('1 char');
        });
    });

    describe('draft saving', () => {
        test('should save draft with debounce', (done) => {
            (renderer as any).config = { draft: { saveDelay: 100 } };
            (renderer as any).textarea.value = 'draft text';

            (renderer as any).saveDraftDebounced();

            setTimeout(() => {
                expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('save-draft', 'draft text');
                done();
            }, 150);
        });

        test('should cancel previous debounced save', (done) => {
            // Clear previous mock calls
            jest.clearAllMocks();
            
            (renderer as any).config = { draft: { saveDelay: 100 } };
            (renderer as any).textarea.value = 'draft text';

            (renderer as any).saveDraftDebounced();
            (renderer as any).textarea.value = 'updated draft';
            (renderer as any).saveDraftDebounced();

            setTimeout(() => {
                // Check that save-draft was called only once (not twice)
                const saveDraftCalls = mockIpcRenderer.invoke.mock.calls.filter(
                    call => call[0] === 'save-draft'
                );
                expect(saveDraftCalls.length).toBe(1);
                expect(saveDraftCalls[0]).toEqual(['save-draft', 'updated draft']);
                done();
            }, 150);
        });
    });

    describe('error handling', () => {
        test('should display error messages', () => {
            // const originalText = renderer.appNameEl.textContent;

            (renderer as any).showError('Test error message');

            expect((renderer as any).appNameEl.textContent).toBe('Error: Test error message');
            expect((renderer as any).appNameEl.style.color).toBe('#ff6b6b');
        });
    });

    describe('renderHistory - Real DOM Integration', () => {
        beforeEach(() => {
            // Clear all mocks for real DOM testing
            jest.restoreAllMocks();
            
            // Set up real DOM elements for each test
            document.body.innerHTML = `
                <textarea id="textInput"></textarea>
                <div id="appName"></div>
                <div id="charCount"></div>
                <div id="historyList"></div>
            `;
        });

        test('should render actual DOM elements with default maxDisplayItems', () => {
            const renderer = new PromptLineRenderer();
            (renderer as any).userSettings = null; // No settings, should use default

            const historyItems = Array.from({ length: 20 }, (_, i) => ({
                text: `History item ${i + 1}`,
                timestamp: Date.now() - i * 1000,
                id: `id-${i + 1}`
            }));
            (renderer as any).historyData = historyItems;
            (renderer as any).filteredHistoryData = historyItems;

            (renderer as any).renderHistory();

            // Check actual DOM elements created
            const historyList = document.getElementById('historyList');
            const historyElements = historyList?.querySelectorAll('.history-item');
            expect(historyElements?.length).toBe(20); // Default value (20 items)

            // Check that actual content is rendered
            expect(historyElements?.[0]?.textContent).toContain('History item 1');
            expect(historyElements?.[1]?.textContent).toContain('History item 2');

            // No more indicator in unlimited history mode
            const moreIndicator = historyList?.querySelector('.history-more');
            expect(moreIndicator).toBeNull();
        });

        test('should respect maxDisplayItems from user settings in real DOM', () => {
            const renderer = new PromptLineRenderer();
            (renderer as any).userSettings = {
                shortcuts: { main: 'Cmd+Space', paste: 'Enter', close: 'Escape' },
                window: { position: 'cursor', width: 800, height: 400 },
                history: { maxItems: 100, maxDisplayItems: 0 } // 0 means unlimited
            };

            const historyItems = Array.from({ length: 12 }, (_, i) => ({
                text: `Test item ${i + 1}`,
                timestamp: Date.now() - i * 1000,
                id: `test-id-${i + 1}`
            }));
            (renderer as any).historyData = historyItems;
            (renderer as any).filteredHistoryData = historyItems;

            (renderer as any).renderHistory();

            // Check actual DOM rendering - should show all 12 items
            const historyList = document.getElementById('historyList');
            const historyElements = historyList?.querySelectorAll('.history-item');
            expect(historyElements?.length).toBe(12); // All items should be shown

            // Verify actual content is correct
            expect(historyElements?.[0]?.textContent).toContain('Test item 1');
            expect(historyElements?.[11]?.textContent).toContain('Test item 12');

            // No more indicator in unlimited history mode
            const moreIndicator = historyList?.querySelector('.history-more');
            expect(moreIndicator).toBeNull();
        });

        test('should show actual empty state DOM when no history', () => {
            const renderer = new PromptLineRenderer();
            (renderer as any).historyData = [];
            (renderer as any).filteredHistoryData = [];

            (renderer as any).renderHistory();

            const historyList = document.getElementById('historyList');
            expect(historyList?.innerHTML).toContain('No history items');
            
            // Should not have any history-item elements
            const historyElements = historyList?.querySelectorAll('.history-item');
            expect(historyElements?.length).toBe(0);
        });

        test('should handle edge case maxDisplayItems = 0 in real DOM', () => {
            const renderer = new PromptLineRenderer();
            (renderer as any).userSettings = {
                shortcuts: { main: 'Cmd+Space', paste: 'Enter', close: 'Escape' },
                window: { position: 'cursor', width: 800, height: 400 },
                history: { maxItems: 100, maxDisplayItems: 0 }
            };

            const historyItems = Array.from({ length: 3 }, (_, i) => ({
                text: `Edge case item ${i + 1}`,
                timestamp: Date.now() - i * 1000,
                id: `edge-id-${i + 1}`
            }));
            (renderer as any).historyData = historyItems;
            (renderer as any).filteredHistoryData = historyItems;

            (renderer as any).renderHistory();

            const historyList = document.getElementById('historyList');
            const historyElements = historyList?.querySelectorAll('.history-item');
            // Note: This is actually a bug - the renderer uses || instead of ?? 
            // so maxDisplayItems: 0 falls back to 20. This test documents current behavior.
            expect(historyElements?.length).toBe(3); // Shows all items due to fallback

            // Should not show more indicator when all items are displayed
            const moreIndicator = historyList?.querySelector('.history-more');
            expect(moreIndicator).toBeNull();
        });

        test('should create history elements with correct structure and click handlers', () => {
            const renderer = new PromptLineRenderer();
            (renderer as any).userSettings = {
                shortcuts: { main: 'Cmd+Space', paste: 'Enter', close: 'Escape' },
                window: { position: 'cursor', width: 800, height: 400 },
                history: { maxItems: 100, maxDisplayItems: 2 }
            };

            const historyItems = [
                { text: 'Test content for clicking', timestamp: Date.now(), id: 'click-test-1' },
                { text: 'Second test item', timestamp: Date.now() - 1000, id: 'click-test-2' }
            ];
            (renderer as any).historyData = historyItems;
            (renderer as any).filteredHistoryData = historyItems;

            (renderer as any).renderHistory();

            const historyList = document.getElementById('historyList');
            const historyElements = historyList?.querySelectorAll('.history-item');
            
            expect(historyElements?.length).toBe(2);

            // Check structure of created elements
            const firstElement = historyElements?.[0] as HTMLElement;
            expect(firstElement?.classList.contains('history-item')).toBe(true);
            expect(firstElement?.dataset.text).toBe('Test content for clicking');
            expect(firstElement?.dataset.id).toBe('click-test-1');

            // Check that text and time elements exist
            const textDiv = firstElement?.querySelector('.history-text');
            const timeDiv = firstElement?.querySelector('.history-time');
            expect(textDiv?.textContent).toBe('Test content for clicking');
            expect(timeDiv?.textContent).toBe('Just now'); // Recent items show "Just now"

            // Test click handler (simulate click)
            const textarea = document.getElementById('textInput') as HTMLTextAreaElement;
            expect(textarea.value).toBe(''); // Initially empty

            // Simulate clicking the history item
            firstElement?.dispatchEvent(new Event('click'));
            expect(textarea.value).toBe('Test content for clicking');
        });

        test('should handle long text truncation in DOM', () => {
            const renderer = new PromptLineRenderer();
            (renderer as any).userSettings = {
                shortcuts: { main: 'Cmd+Space', paste: 'Enter', close: 'Escape' },
                window: { position: 'cursor', width: 800, height: 400 },
                history: { maxItems: 100, maxDisplayItems: 1 }
            };

            const longText = 'This is a very long text with multiple\nlines and\ttabs that should be handled properly in the display';
            const historyItems = [
                { text: longText, timestamp: Date.now(), id: 'long-text-test' }
            ];
            (renderer as any).historyData = historyItems;
            (renderer as any).filteredHistoryData = historyItems;

            (renderer as any).renderHistory();

            const historyList = document.getElementById('historyList');
            const historyElement = historyList?.querySelector('.history-item');
            const textDiv = historyElement?.querySelector('.history-text');
            
            // Should replace newlines with spaces for display (tabs are preserved)
            expect(textDiv?.textContent).toBe('This is a very long text with multiple lines and\ttabs that should be handled properly in the display');
            
            // But dataset should preserve original text
            expect((historyElement as HTMLElement)?.dataset.text).toBe(longText);
        });
    });

    describe('utility methods', () => {
        test('should get current text', () => {
            (renderer as any).textarea.value = 'current text';

            const text = renderer.getCurrentText();

            expect(text).toBe('current text');
        });

        test('should set text', () => {
            renderer.setText('new text');

            expect((renderer as any).textarea.value).toBe('new text');
        });

        test('should clear text', () => {
            (renderer as any).textarea.value = 'some text';

            renderer.clearText();

            expect((renderer as any).textarea.value).toBe('');
        });

        test('should focus textarea', () => {
            renderer.focus();

            expect((renderer as any).textarea.focus).toHaveBeenCalled();
        });
    });


    describe('Cmd+V paste handling', () => {
        test('should paste image path when image is in clipboard', async () => {
            // Mock successful image paste
            mockIpcRenderer.invoke.mockImplementation((channel: string) => {
                if (channel === 'paste-image') {
                    return Promise.resolve({ success: true, path: '/tmp/clipboard-image.png' });
                }
                return Promise.resolve({});
            });

            (renderer as any).textarea.value = 'existing text';
            (renderer as any).textarea.selectionStart = 8; // After "existing"
            (renderer as any).textarea.selectionEnd = 8;

            const event = new KeyboardEvent('keydown', {
                key: 'v',
                metaKey: true
            });
            event.preventDefault = jest.fn();

            await (renderer as any).handleKeyDown(event);

            // Should prevent default and insert image path
            expect(event.preventDefault).toHaveBeenCalled();
            expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('paste-image');
            expect((renderer as any).textarea.value).toBe('existing/tmp/clipboard-image.png text');
        });

        test('should not prevent default when no image in clipboard', async () => {
            // Mock no image in clipboard
            mockIpcRenderer.invoke.mockImplementation((channel: string) => {
                if (channel === 'paste-image') {
                    return Promise.resolve({ success: false, error: 'No image in clipboard' });
                }
                return Promise.resolve({});
            });

            const event = new KeyboardEvent('keydown', {
                key: 'v',
                metaKey: true
            });
            event.preventDefault = jest.fn();

            await (renderer as any).handleKeyDown(event);

            // Should not prevent default, allowing normal paste
            expect(event.preventDefault).not.toHaveBeenCalled();
            expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('paste-image');
        });

        test('should handle image paste errors gracefully', async () => {
            // Mock image paste error
            mockIpcRenderer.invoke.mockImplementation((channel: string) => {
                if (channel === 'paste-image') {
                    return Promise.resolve({ success: false, error: 'Failed to save image' });
                }
                return Promise.resolve({});
            });

            const event = new KeyboardEvent('keydown', {
                key: 'v',
                metaKey: true
            });
            event.preventDefault = jest.fn();

            await (renderer as any).handleKeyDown(event);

            // Should not prevent default on error
            expect(event.preventDefault).not.toHaveBeenCalled();
            expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('paste-image');
        });

        test('should work with Ctrl+V on non-Mac platforms', async () => {
            // Mock successful image paste
            mockIpcRenderer.invoke.mockImplementation((channel: string) => {
                if (channel === 'paste-image') {
                    return Promise.resolve({ success: true, path: '/tmp/image.jpg' });
                }
                return Promise.resolve({});
            });

            (renderer as any).textarea.value = '';

            const event = new KeyboardEvent('keydown', {
                key: 'v',
                ctrlKey: true  // Ctrl instead of Cmd
            });
            event.preventDefault = jest.fn();

            await (renderer as any).handleKeyDown(event);

            // Should handle Ctrl+V same as Cmd+V
            expect(event.preventDefault).toHaveBeenCalled();
            expect((renderer as any).textarea.value).toBe('/tmp/image.jpg');
        });

        test('should insert image path at cursor position', async () => {
            // Mock successful image paste
            mockIpcRenderer.invoke.mockImplementation((channel: string) => {
                if (channel === 'paste-image') {
                    return Promise.resolve({ success: true, path: '/images/screenshot.png' });
                }
                return Promise.resolve({});
            });

            (renderer as any).textarea.value = 'Check this  out!';
            (renderer as any).textarea.selectionStart = 11; // Between "this" and "out"
            (renderer as any).textarea.selectionEnd = 11;

            const event = new KeyboardEvent('keydown', {
                key: 'v',
                metaKey: true
            });
            event.preventDefault = jest.fn();

            await (renderer as any).handleKeyDown(event);

            expect((renderer as any).textarea.value).toBe('Check this /images/screenshot.png out!');
            // Cursor should be after the inserted path
            expect((renderer as any).textarea.selectionStart).toBe(33);
            expect((renderer as any).textarea.selectionEnd).toBe(33);
        });

        test('should replace selected text with image path', async () => {
            // Mock successful image paste
            mockIpcRenderer.invoke.mockImplementation((channel: string) => {
                if (channel === 'paste-image') {
                    return Promise.resolve({ success: true, path: '/assets/photo.png' });
                }
                return Promise.resolve({});
            });

            (renderer as any).textarea.value = 'Replace [SELECTED] with image';
            (renderer as any).textarea.selectionStart = 8; // Start of "[SELECTED]"
            (renderer as any).textarea.selectionEnd = 18; // End of "[SELECTED]"

            const event = new KeyboardEvent('keydown', {
                key: 'v',
                metaKey: true
            });
            event.preventDefault = jest.fn();

            await (renderer as any).handleKeyDown(event);

            expect((renderer as any).textarea.value).toBe('Replace /assets/photo.png with image');
        });
    });
});