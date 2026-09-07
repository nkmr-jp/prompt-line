/**
 * Vitest test setup file
 */

import type { BrowserWindow } from 'electron';

// Define types for test utilities
interface MockHistoryItem {
    text: string;
    timestamp: number;
    id: string;
}

interface MockDraft {
    text: string;
    timestamp: number;
    version: string;
}

interface ConsoleCapture {
    getLogs: () => Array<[string, ...any[]]>;
    restore: () => void;
}

// Mock Electron modules for testing
vi.mock('electron', () => ({
    app: {
        getPath: vi.fn((name: string) => {
            const paths: Record<string, string> = {
                userData: '/tmp/test-prompt-line',
                home: '/tmp/test-home'
            };
            return paths[name] || '/tmp/test-path';
        }),
        whenReady: vi.fn(() => Promise.resolve()),
        isReady: vi.fn(() => true),
        dock: {
            hide: vi.fn()
        },
        on: vi.fn(),
        quit: vi.fn(),
        requestSingleInstanceLock: vi.fn(() => true)
    },
    BrowserWindow: vi.fn(function(): Partial<BrowserWindow> {
        const mockWindow: any = {
            loadFile: vi.fn(() => Promise.resolve()),
            show: vi.fn(),
            hide: vi.fn(),
            focus: vi.fn(),
            destroy: vi.fn(),
            isDestroyed: vi.fn(() => false),
            isVisible: vi.fn(() => false),
            setPosition: vi.fn(),
            on: vi.fn(() => mockWindow),
            webContents: {
                send: vi.fn(),
                on: vi.fn()
            }
        };
        return mockWindow;
    }),
    screen: {
        getCursorScreenPoint: vi.fn(() => ({ x: 100, y: 100 })),
        getDisplayNearestPoint: vi.fn(() => ({
            bounds: { x: 0, y: 0, width: 1920, height: 1080 }
        }))
    },
    globalShortcut: {
        register: vi.fn(() => true),
        unregisterAll: vi.fn()
    },
    ipcMain: {
        handle: vi.fn(),
        on: vi.fn(),
        removeAllListeners: vi.fn(),
        eventNames: vi.fn(() => [])
    },
    clipboard: {
        // Electron 44's W3C-modelled clipboard: writeText/read are async and
        // read() returns ClipboardItem-likes rather than a NativeImage.
        writeText: vi.fn(async () => {}),
        readText: vi.fn(async () => ''),
        clear: vi.fn(),
        read: vi.fn(async () => [])
    },
    nativeImage: {
        createFromBuffer: vi.fn(() => ({ isEmpty: () => true, toPNG: () => Buffer.alloc(0) })),
        createEmpty: vi.fn(() => ({ isEmpty: () => true, toPNG: () => Buffer.alloc(0) }))
    }
}));

// Mock child_process for platform-specific operations
vi.mock('child_process', () => ({
    exec: vi.fn((_command: string, callback: (error: Error | null, stdout?: string) => void) => {
        // Mock successful execution
        callback(null, 'mocked output');
    }),
    execFile: vi.fn((_file: string, _args: string[], _options: unknown, callback: (error: Error | null, stdout?: string, stderr?: string) => void) => {
        // Mock successful execution
        if (typeof _options === 'function') {
            // Handle case where options is omitted and callback is in options position
            (_options as (error: Error | null, stdout?: string, stderr?: string) => void)(null, 'mocked output', '');
        } else if (callback) {
            callback(null, 'mocked output', '');
        }
    })
}));

// Mock fs/promises for file operations
vi.mock('fs/promises', () => ({
    readFile: vi.fn(),
    writeFile: vi.fn(),
    unlink: vi.fn(),
    access: vi.fn(),
    mkdir: vi.fn(),
    readdir: vi.fn(() => []),
    stat: vi.fn(() => ({ mtime: new Date() }))
}));

// Mock path module
// Use the real POSIX path implementation rather than a hand-rolled stand-in.
// The previous fake diverged from Node on trailing slashes and on ".."
// climbing past the root, which is exactly the shape of input the image-path
// traversal guard exists to reject — so a fake made that guard untestable and
// hid a real bug. The same idiom is already used in file-searcher.test.ts and
// plugin-loader.test.ts. posix (not the platform default) keeps these tests
// deterministic.
vi.mock('path', async () => {
    const actual = await vi.importActual<typeof import('path')>('path');
    return { ...actual.posix, default: actual.posix };
});

// Set up test environment variables
process.env.NODE_ENV = 'test';

// Global test utilities
declare global {
    function createMockHistoryItem(text: string, timestamp?: number): MockHistoryItem;
    function createMockDraft(text: string, timestamp?: number): MockDraft;
    function captureConsole(): ConsoleCapture;
}

(global as any).createMockHistoryItem = (text: string, timestamp: number = Date.now()): MockHistoryItem => ({
    text,
    timestamp,
    id: `test-${timestamp}-${Math.random().toString(36).substr(2, 9)}`
});

(global as any).createMockDraft = (text: string, timestamp: number = Date.now()): MockDraft => ({
    text,
    timestamp,
    version: '1.0'
});

// Note: vi.clearAllMocks() is handled automatically by vitest.config.ts clearMocks: true

// Set up console capture for tests
const originalConsole = { ...console };
(global as any).captureConsole = (): ConsoleCapture => {
    const logs: Array<[string, ...any[]]> = [];
    console.log = vi.fn((...args) => logs.push(['log', ...args]));
    console.error = vi.fn((...args) => logs.push(['error', ...args]));
    console.warn = vi.fn((...args) => logs.push(['warn', ...args]));
    console.info = vi.fn((...args) => logs.push(['info', ...args]));
    console.debug = vi.fn((...args) => logs.push(['debug', ...args]));
    
    return {
        getLogs: () => logs,
        restore: () => {
            Object.assign(console, originalConsole);
        }
    };
};
