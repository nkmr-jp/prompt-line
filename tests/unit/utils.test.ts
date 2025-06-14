import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
type ExecCallback = (error: Error | null, stdout: string, stderr: string) => void;

// Mock child_process before importing utils
jest.mock('child_process', () => ({
    exec: jest.fn()
}));

// Mock fs before importing utils
jest.mock('fs', () => ({
    promises: {
        access: jest.fn(),
        mkdir: jest.fn(),
        appendFile: jest.fn(() => Promise.resolve())
    }
}));

import { 
    logger, 
    getCurrentApp, 
    pasteWithNativeTool,
    debounce,
    throttle,
    safeJsonParse,
    safeJsonStringify,
    generateId,
    formatTimeAgo,
    ensureDir,
    fileExists,
    sleep,
    getActiveWindowBounds
} from '../../src/utils/utils';

import { exec } from 'child_process';
import { promises as fs } from 'fs';

const mockedExec = jest.mocked(exec);
const mockedFs = jest.mocked(fs);

// Console capture helper
function captureConsole() {
    const logs: any[] = [];
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    const originalInfo = console.info;

    console.log = (...args: any[]) => logs.push(['log', ...args]);
    console.error = (...args: any[]) => logs.push(['error', ...args]);
    console.warn = (...args: any[]) => logs.push(['warn', ...args]);
    console.info = (...args: any[]) => logs.push(['info', ...args]);

    return {
        getLogs: () => logs,
        restore: () => {
            console.log = originalLog;
            console.error = originalError;
            console.warn = originalWarn;
            console.info = originalInfo;
        }
    };
}

describe('Utils', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Logger', () => {
        let consoleSpy: ReturnType<typeof captureConsole>;

        beforeEach(() => {
            consoleSpy = captureConsole();
        });

        afterEach(() => {
            consoleSpy.restore();
        });

        test('should log messages with correct format', () => {
            logger.info('Test message', { data: 'test' });
            
            const logs = consoleSpy.getLogs();
            expect(logs.length).toBeGreaterThan(0);
        });

        test('should log error messages', () => {
            logger.error('Error message');
            
            const logs = consoleSpy.getLogs();
            expect(logs.length).toBeGreaterThan(0);
        });
    });

    describe('getCurrentApp', () => {
        test('should return null on non-macOS platforms', async () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', { value: 'linux' });
            
            const result = await getCurrentApp();
            expect(result).toBeNull();
            
            Object.defineProperty(process, 'platform', { value: originalPlatform });
        });

        test('should handle exec errors gracefully', async () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', { value: 'darwin' });
            
            (mockedExec as any).mockImplementation((_command: string, _options: any, callback: ExecCallback) => {
                callback(new Error('Command failed'), '', '');
                return null as any;
            });

            const result = await getCurrentApp();
            expect(result).toBeNull();
            
            Object.defineProperty(process, 'platform', { value: originalPlatform });
        });

        test('should return app info on success', async () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', { value: 'darwin' });
            
            (mockedExec as any).mockImplementation((_command: string, _options: any, callback: ExecCallback) => {
                callback(null, '{"name":"TestApp","bundleId":"com.test.app"}', '');
                return null as any;
            });

            const result = await getCurrentApp();
            expect(result).toEqual({ name: 'TestApp', bundleId: 'com.test.app' });
            
            Object.defineProperty(process, 'platform', { value: originalPlatform });
        });

        test('should handle app without bundle ID', async () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', { value: 'darwin' });
            
            (mockedExec as any).mockImplementation((_command: string, _options: any, callback: ExecCallback) => {
                callback(null, '{"name":"TestApp","bundleId":null}', '');
                return null as any;
            });

            const result = await getCurrentApp();
            expect(result).toEqual({ name: 'TestApp', bundleId: null });
            
            Object.defineProperty(process, 'platform', { value: originalPlatform });
        });

        test('should handle native tool errors', async () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', { value: 'darwin' });
            
            (mockedExec as any).mockImplementation((_command: string, _options: any, callback: ExecCallback) => {
                callback(null, '{"error":"No active application found"}', '');
                return null as any;
            });

            const result = await getCurrentApp();
            expect(result).toBeNull();
            
            Object.defineProperty(process, 'platform', { value: originalPlatform });
        });
    });

    describe('pasteWithNativeTool', () => {
        test('should execute paste command on macOS', async () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', { value: 'darwin' });
            
            (mockedExec as any).mockImplementation((_command: string, _options: any, callback: ExecCallback) => {
                callback(null, '{"success":true,"command":"paste"}', '');
                return null as any;
            });

            await expect(pasteWithNativeTool()).resolves.toBeUndefined();
            
            Object.defineProperty(process, 'platform', { value: originalPlatform });
        });

        test('should handle native tool failure', async () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', { value: 'darwin' });
            
            (mockedExec as any).mockImplementation((_command: string, _options: any, callback: ExecCallback) => {
                callback(null, '{"success":false,"command":"paste"}', '');
                return null as any;
            });

            await expect(pasteWithNativeTool()).rejects.toThrow('Native paste failed');
            
            Object.defineProperty(process, 'platform', { value: originalPlatform });
        });

        test('should handle exec errors', async () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', { value: 'darwin' });
            
            (mockedExec as any).mockImplementation((_command: string, _options: any, callback: ExecCallback) => {
                callback(new Error('Command failed'), '', '');
                return null as any;
            });

            await expect(pasteWithNativeTool()).rejects.toThrow('Command failed');
            
            Object.defineProperty(process, 'platform', { value: originalPlatform });
        });

        test('should throw error on non-macOS platforms', async () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', { value: 'linux' });
            
            await expect(pasteWithNativeTool()).rejects.toThrow('Native paste only supported on macOS');
            
            Object.defineProperty(process, 'platform', { value: originalPlatform });
        });
    });

    describe('debounce', () => {
        jest.useFakeTimers();

        test('should delay function execution', () => {
            const fn = jest.fn();
            const debouncedFn = debounce(fn, 100);
            
            debouncedFn();
            expect(fn).not.toHaveBeenCalled();
            
            jest.advanceTimersByTime(100);
            expect(fn).toHaveBeenCalledTimes(1);
        });

        test('should cancel previous calls', () => {
            const fn = jest.fn();
            const debouncedFn = debounce(fn, 100);
            
            debouncedFn();
            debouncedFn();
            debouncedFn();
            
            jest.advanceTimersByTime(100);
            expect(fn).toHaveBeenCalledTimes(1);
        });

        afterEach(() => {
            jest.clearAllTimers();
        });
    });

    describe('throttle', () => {
        jest.useFakeTimers();

        test('should limit function calls', () => {
            const fn = jest.fn();
            const throttledFn = throttle(fn, 100);
            
            throttledFn();
            throttledFn();
            throttledFn();
            
            expect(fn).toHaveBeenCalledTimes(1);
            
            jest.advanceTimersByTime(100);
            throttledFn();
            
            expect(fn).toHaveBeenCalledTimes(2);
        });

        afterEach(() => {
            jest.clearAllTimers();
        });
    });

    describe('safeJsonParse', () => {
        test('should parse valid JSON', () => {
            const result = safeJsonParse('{"test": "value"}', {});
            expect(result).toEqual({ test: 'value' });
        });

        test('should return fallback for invalid JSON', () => {
            const fallback = { default: true };
            const result = safeJsonParse('invalid json', fallback);
            expect(result).toEqual(fallback);
        });
    });

    describe('safeJsonStringify', () => {
        test('should stringify objects', () => {
            const result = safeJsonStringify({ test: 'value' });
            expect(result).toBe('{\n  "test": "value"\n}');
        });

        test('should handle circular references', () => {
            const obj: any = { test: 'value' };
            obj.self = obj;
            
            // Suppress console.warn for this test
            const originalWarn = console.warn;
            console.warn = jest.fn();
            
            const result = safeJsonStringify(obj);
            expect(result).toBe('{}'); // Returns fallback value for circular references
            
            // Restore console.warn
            console.warn = originalWarn;
        });
    });

    describe('generateId', () => {
        test('should generate unique IDs', () => {
            const id1 = generateId();
            const id2 = generateId();
            
            expect(id1).toBeDefined();
            expect(id2).toBeDefined();
            expect(id1).not.toBe(id2);
        });

        test('should generate IDs with correct length', () => {
            const id = generateId();
            expect(id.length).toBeGreaterThan(0);
        });
    });

    describe('formatTimeAgo', () => {
        test('should format recent timestamps', () => {
            const now = Date.now();
            const result = formatTimeAgo(now - 30000); // 30 seconds ago
            expect(result).toBe('Just now');
        });

        test('should format minutes ago', () => {
            const now = Date.now();
            const result = formatTimeAgo(now - 120000); // 2 minutes ago
            expect(result).toBe('2m ago');
        });

        test('should format hours ago', () => {
            const now = Date.now();
            const result = formatTimeAgo(now - 7200000); // 2 hours ago
            expect(result).toBe('2h ago');
        });

        test('should format days ago', () => {
            const now = Date.now();
            const result = formatTimeAgo(now - 172800000); // 2 days ago
            expect(result).toBe('2d ago');
        });
    });

    describe('ensureDir', () => {
        test('should resolve when directory exists', async () => {
            mockedFs.access.mockResolvedValue();
            
            await expect(ensureDir('/test/path')).resolves.toBeUndefined();
            expect(mockedFs.access).toHaveBeenCalledWith('/test/path');
        });

        test('should create directory when it does not exist', async () => {
            mockedFs.access.mockRejectedValue({ code: 'ENOENT' } as any);
            mockedFs.mkdir.mockResolvedValue(undefined);
            
            await expect(ensureDir('/test/path')).resolves.toBeUndefined();
            expect(mockedFs.mkdir).toHaveBeenCalledWith('/test/path', { recursive: true });
        });

        test('should throw error for access issues other than ENOENT', async () => {
            mockedFs.access.mockRejectedValue(new Error('Permission denied'));
            
            await expect(ensureDir('/test/path')).rejects.toThrow('Permission denied');
        });
    });

    describe('fileExists', () => {
        test('should return true when file exists', async () => {
            mockedFs.access.mockResolvedValue();
            
            const result = await fileExists('/test/file.txt');
            expect(result).toBe(true);
        });

        test('should return false when file does not exist', async () => {
            mockedFs.access.mockRejectedValue({ code: 'ENOENT' } as any);
            
            const result = await fileExists('/test/file.txt');
            expect(result).toBe(false);
        });
    });

    describe('sleep', () => {
        jest.useFakeTimers();

        test('should delay execution', async () => {
            const promise = sleep(1000);
            
            jest.advanceTimersByTime(1000);
            
            await expect(promise).resolves.toBeUndefined();
        });

        afterEach(() => {
            jest.clearAllTimers();
        });
    });

    describe('getActiveWindowBounds', () => {
        
        test('should return null on non-macOS platforms', async () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', { value: 'win32' });
            
            const result = await getActiveWindowBounds();
            expect(result).toBeNull();
            
            Object.defineProperty(process, 'platform', { value: originalPlatform });
        });

        test('should handle successful native tool output', async () => {
            Object.defineProperty(process, 'platform', { value: 'darwin' });
            
            // Mock exec to return valid window bounds
            (mockedExec as any).mockImplementation((_command: string, _options: any, callback?: any) => {
                if (typeof callback === 'function') {
                    callback(null, '{"x":100,"y":200,"width":800,"height":600,"appName":"TestApp","bundleId":"com.test.app"}', '');
                }
            });

            const result = await getActiveWindowBounds();
            expect(result).toEqual({
                x: 100,
                y: 200,
                width: 800,
                height: 600
            });
        });

        test('should handle native tool error output', async () => {
            Object.defineProperty(process, 'platform', { value: 'darwin' });
            
            (mockedExec as any).mockImplementation((_command: string, _options: any, callback?: any) => {
                if (typeof callback === 'function') {
                    callback(null, '{"error":"No active window found"}', '');
                }
            });

            const result = await getActiveWindowBounds();
            expect(result).toBeNull();
        });

        test('should handle invalid JSON output', async () => {
            Object.defineProperty(process, 'platform', { value: 'darwin' });
            
            (mockedExec as any).mockImplementation((_command: string, _options: any, callback?: any) => {
                if (typeof callback === 'function') {
                    callback(null, 'invalid json', '');
                }
            });

            const result = await getActiveWindowBounds();
            expect(result).toBeNull();
        });

        test('should handle exec errors', async () => {
            Object.defineProperty(process, 'platform', { value: 'darwin' });
            
            (mockedExec as any).mockImplementation((_command: string, _options: any, callback?: any) => {
                if (typeof callback === 'function') {
                    callback(new Error('Command failed'), '', '');
                }
            });

            const result = await getActiveWindowBounds();
            expect(result).toBeNull();
        });

        test('should handle invalid numeric values', async () => {
            Object.defineProperty(process, 'platform', { value: 'darwin' });
            
            (mockedExec as any).mockImplementation((_command: string, _options: any, callback?: any) => {
                if (typeof callback === 'function') {
                    callback(null, '{"x":"abc","y":"def","width":"ghi","height":"jkl"}', '');
                }
            });

            const result = await getActiveWindowBounds();
            expect(result).toBeNull();
        });
    });
});