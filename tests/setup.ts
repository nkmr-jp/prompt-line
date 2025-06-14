/**
 * Jest test setup file
 */

import { jest } from '@jest/globals';
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
jest.mock('electron', () => ({
    app: {
        getPath: jest.fn((name: string) => {
            const paths: Record<string, string> = {
                userData: '/tmp/test-prompt-line',
                home: '/tmp/test-home'
            };
            return paths[name] || '/tmp/test-path';
        }),
        whenReady: jest.fn(() => Promise.resolve()),
        isReady: jest.fn(() => true),
        dock: {
            hide: jest.fn()
        },
        on: jest.fn(),
        quit: jest.fn(),
        requestSingleInstanceLock: jest.fn(() => true)
    },
    BrowserWindow: jest.fn().mockImplementation((): Partial<BrowserWindow> => {
        const mockWindow: any = {
            loadFile: jest.fn(() => Promise.resolve()),
            show: jest.fn(),
            hide: jest.fn(),
            focus: jest.fn(),
            destroy: jest.fn(),
            isDestroyed: jest.fn(() => false),
            isVisible: jest.fn(() => false),
            setPosition: jest.fn(),
            on: jest.fn(() => mockWindow),
            webContents: {
                send: jest.fn(),
                on: jest.fn()
            }
        };
        return mockWindow;
    }),
    screen: {
        getCursorScreenPoint: jest.fn(() => ({ x: 100, y: 100 })),
        getDisplayNearestPoint: jest.fn(() => ({
            bounds: { x: 0, y: 0, width: 1920, height: 1080 }
        }))
    },
    globalShortcut: {
        register: jest.fn(() => true),
        unregisterAll: jest.fn()
    },
    ipcMain: {
        handle: jest.fn(),
        on: jest.fn(),
        removeAllListeners: jest.fn(),
        eventNames: jest.fn(() => [])
    },
    clipboard: {
        writeText: jest.fn(),
        readText: jest.fn(() => '')
    }
}));

// Mock child_process for platform-specific operations
jest.mock('child_process', () => ({
    exec: jest.fn((_command: string, callback: (error: Error | null, stdout?: string) => void) => {
        // Mock successful execution
        callback(null, 'mocked output');
    })
}));

// Mock fs/promises for file operations
jest.mock('fs/promises', () => ({
    readFile: jest.fn(),
    writeFile: jest.fn(),
    unlink: jest.fn(),
    access: jest.fn(),
    mkdir: jest.fn(),
    readdir: jest.fn(() => []),
    stat: jest.fn(() => ({ mtime: new Date() }))
}));

// Mock path module
jest.mock('path', () => ({
    join: jest.fn((...parts: string[]) => parts.join('/')),
    dirname: jest.fn((filePath: string) => filePath.split('/').slice(0, -1).join('/')),
    basename: jest.fn((filePath: string) => filePath.split('/').pop())
}));

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

// Clean up after each test
afterEach(() => {
    jest.clearAllMocks();
});

// Set up console capture for tests
const originalConsole = { ...console };
(global as any).captureConsole = (): ConsoleCapture => {
    const logs: Array<[string, ...any[]]> = [];
    console.log = jest.fn((...args) => logs.push(['log', ...args]));
    console.error = jest.fn((...args) => logs.push(['error', ...args]));
    console.warn = jest.fn((...args) => logs.push(['warn', ...args]));
    console.info = jest.fn((...args) => logs.push(['info', ...args]));
    console.debug = jest.fn((...args) => logs.push(['debug', ...args]));
    
    return {
        getLogs: () => logs,
        restore: () => {
            Object.assign(console, originalConsole);
        }
    };
};

// Test timeout configuration
jest.setTimeout(10000);