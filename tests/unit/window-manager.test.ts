import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import WindowManager from '../../src/managers/window-manager';
import { BrowserWindow, screen } from 'electron';
type ExecCallback = (error: Error | null, stdout: string, stderr: string) => void;

// Mock child_process
jest.mock('child_process', () => ({
    exec: jest.fn()
}));

// Mock the utils module
jest.mock('../../src/utils/utils', () => ({
    getCurrentApp: jest.fn(),
    getActiveWindowBounds: jest.fn(() => Promise.resolve(null)),
    logger: {
        info: jest.fn(),
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    },
    KEYBOARD_SIMULATOR_PATH: '/path/to/keyboard-simulator',
    TEXT_FIELD_DETECTOR_PATH: '/path/to/text-field-detector',
    WINDOW_DETECTOR_PATH: '/path/to/window-detector'
}));

// Mock the config module
jest.mock('../../src/config/app-config', () => ({
    window: {
        width: 600,
        height: 300,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    },
    platform: {
        isMac: true
    },
    timing: {
        windowHideDelay: 100,
        appFocusDelay: 200
    },
    getInputHtmlPath: jest.fn(() => '/test/input.html')
}));

const { getCurrentApp, getActiveWindowBounds, logger } = jest.requireMock('../../src/utils/utils') as any;
// Fix getCurrentApp to return string for consistency
getCurrentApp.mockResolvedValue('TestApp');
// Make getActiveWindowBounds return null so tests fall back to cursor positioning
getActiveWindowBounds.mockResolvedValue(null);
const { exec } = jest.requireMock('child_process') as any;
const mockedExec = exec as jest.MockedFunction<typeof exec>;

describe('WindowManager', () => {
    let windowManager: WindowManager;
    let mockWindow: any;

    beforeEach(() => {
        windowManager = new WindowManager();
        
        // Create mock BrowserWindow instance
        mockWindow = {
            loadFile: jest.fn(),
            show: jest.fn(),
            hide: jest.fn(),
            focus: jest.fn(),
            destroy: jest.fn(),
            isVisible: jest.fn(() => false),
            isDestroyed: jest.fn(() => false),
            setPosition: jest.fn(),
            on: jest.fn(),
            webContents: {
                send: jest.fn(),
                on: jest.fn(),
                isLoading: jest.fn(() => false),
                once: jest.fn()
            }
        };
        
        (BrowserWindow as jest.MockedClass<typeof BrowserWindow>).mockReturnValue(mockWindow);
        
        jest.clearAllMocks();
    });

    describe('createInputWindow', () => {
        test('should create a BrowserWindow with correct configuration', () => {
            const window = windowManager.createInputWindow();

            expect(BrowserWindow).toHaveBeenCalledWith(
                expect.objectContaining({
                    width: 600,
                    height: 300,
                    frame: false,
                    transparent: true,
                    show: false
                })
            );
            expect(window).toBe(mockWindow);
            expect(mockWindow.loadFile).toHaveBeenCalledWith('/test/input.html');
        });

        test('should set up event listeners on the window', () => {
            windowManager.createInputWindow();

            expect(mockWindow.webContents.on).toHaveBeenCalledWith('context-menu', expect.any(Function));
            expect(mockWindow.webContents.on).toHaveBeenCalledWith('before-input-event', expect.any(Function));
        });

        test('should handle window creation errors', () => {
            (BrowserWindow as jest.MockedClass<typeof BrowserWindow>).mockImplementation(() => {
                throw new Error('Window creation failed');
            });

            expect(() => windowManager.createInputWindow()).toThrow('Window creation failed');
        });
    });

    describe('showInputWindow', () => {
        beforeEach(() => {
            windowManager.createInputWindow();
            getCurrentApp.mockResolvedValue('TestApp');
            
            // Mock screen methods
            (screen.getCursorScreenPoint as jest.Mock).mockReturnValue({ x: 500, y: 300 });
            (screen.getDisplayNearestPoint as jest.Mock).mockReturnValue({
                bounds: { x: 0, y: 0, width: 1920, height: 1080 }
            });
        });

        test('should show window and send data to renderer', async () => {
            jest.useFakeTimers();
            const testData = { history: [], draft: 'test draft' };
            // Make sure isLoading returns false so send is called immediately
            mockWindow.webContents.isLoading.mockReturnValue(false);

            await windowManager.showInputWindow(testData);

            expect(getCurrentApp).toHaveBeenCalled();
            expect(mockWindow.show).toHaveBeenCalled();
            expect(mockWindow.focus).toHaveBeenCalled();
            
            // Advance timers to trigger the setTimeout
            jest.advanceTimersByTime(50);
            
            expect(mockWindow.webContents.send).toHaveBeenCalledWith('window-shown', {
                sourceApp: 'TestApp',
                currentSpaceInfo: null,
                history: [],
                draft: 'test draft'
            });
            
            jest.useRealTimers();
        });

        test('should create window if it does not exist', async () => {
            (windowManager as any).inputWindow = null;

            await windowManager.showInputWindow();

            expect(BrowserWindow).toHaveBeenCalled();
            expect(mockWindow.show).toHaveBeenCalled();
        });

        test('should position window at cursor location', async () => {
            // Ensure no existing window so it creates a new one and positions it
            (windowManager as any).inputWindow = null;
            // Reset mocks to ensure clean state
            jest.clearAllMocks();
            // Force cursor positioning
            (windowManager as any).customWindowSettings = { position: 'cursor' };
            
            await windowManager.showInputWindow();

            // Window should be positioned near cursor (500, 300) minus half window size
            expect(mockWindow.setPosition).toHaveBeenCalledWith(200, 150);
        });

        test('should keep window within screen bounds', async () => {
            // Cursor near edge of screen
            (screen.getCursorScreenPoint as jest.Mock).mockReturnValue({ x: 1900, y: 1000 });
            // Ensure no existing window so it creates a new one and positions it
            (windowManager as any).inputWindow = null;
            // Reset mocks to ensure clean state
            jest.clearAllMocks();
            // Force cursor positioning
            (windowManager as any).customWindowSettings = { position: 'cursor' };

            await windowManager.showInputWindow();

            // Window should be adjusted to stay within bounds
            expect(mockWindow.setPosition).toHaveBeenCalledWith(1320, 780);
        });

        test('should handle errors gracefully', async () => {
            getCurrentApp.mockImplementation(() => Promise.reject(new Error('Failed to get app')));

            await windowManager.showInputWindow();

            // Should still try to show window
            expect(mockWindow.show).toHaveBeenCalled();
            // Note: logger.error might be called asynchronously
        });
    });

    describe('hideInputWindow', () => {
        beforeEach(() => {
            windowManager.createInputWindow();
            mockWindow.isVisible.mockReturnValue(true);
        });

        test('should hide visible window', async () => {
            await windowManager.hideInputWindow();

            expect(mockWindow.hide).toHaveBeenCalled();
        });

        test('should not hide if window is not visible', async () => {
            mockWindow.isVisible.mockReturnValue(false);

            await windowManager.hideInputWindow();

            expect(mockWindow.hide).not.toHaveBeenCalled();
        });

        test('should handle case when window does not exist', async () => {
            (windowManager as any).inputWindow = null;

            await windowManager.hideInputWindow();

            // Should not throw error
            expect(mockWindow.hide).not.toHaveBeenCalled();
        });
    });

    describe('focusPreviousApp', () => {
        beforeEach(() => {
            (windowManager as any).previousApp = 'TestApp';
            const config = jest.requireMock('../../src/config/app-config') as any;
            config.platform.isMac = true;
        });

        test('should focus previous app on macOS', async () => {
            mockedExec.mockImplementation((_command: string, _options: any, callback: ExecCallback) => {
                callback(null, '{"success":true,"command":"activate-name"}', '');
                return null as any;
            });

            const result = await windowManager.focusPreviousApp();

            expect(result).toBe(true);
            expect(mockedExec).toHaveBeenCalledWith(
                expect.stringContaining('keyboard-simulator'),
                expect.any(Object),
                expect.any(Function)
            );
        });

        test('should return false when no previous app', async () => {
            (windowManager as any).previousApp = null;

            const result = await windowManager.focusPreviousApp();

            expect(result).toBe(false);
        });

        test('should return false on non-macOS platforms', async () => {
            const config = jest.requireMock('../../src/config/app-config') as any;
            config.platform.isMac = false;

            const result = await windowManager.focusPreviousApp();

            expect(result).toBe(false);
        });

        test('should handle native tool errors', async () => {
            mockedExec.mockImplementation((_command: string, _options: any, callback: ExecCallback) => {
                callback(new Error('Command failed'), '', '');
                return null as any;
            });

            const result = await windowManager.focusPreviousApp();

            expect(result).toBe(false);
        });

        test('should handle native tool failure response', async () => {
            mockedExec.mockImplementation((_command: string, _options: any, callback: ExecCallback) => {
                callback(null, '{"success":false,"command":"activate-name"}', '');
                return null as any;
            });

            const result = await windowManager.focusPreviousApp();

            expect(result).toBe(false);
        });

        test('should focus app with bundle ID', async () => {
            (windowManager as any).previousApp = { name: 'TestApp', bundleId: 'com.test.app' };
            
            mockedExec.mockImplementation((_command: string, _options: any, callback: ExecCallback) => {
                callback(null, '{"success":true,"command":"activate-bundle"}', '');
                return null as any;
            });

            const result = await windowManager.focusPreviousApp();

            expect(result).toBe(true);
            expect(mockedExec).toHaveBeenCalledWith(
                expect.stringContaining('activate-bundle'),
                expect.any(Object),
                expect.any(Function)
            );
        });

        test('should handle invalid JSON response', async () => {
            mockedExec.mockImplementation((_command: string, _options: any, callback: ExecCallback) => {
                callback(null, 'invalid json', '');
                return null as any;
            });

            const result = await windowManager.focusPreviousApp();

            expect(result).toBe(false);
        });
    });

    describe('getInputWindow', () => {
        test('should return the input window instance', () => {
            windowManager.createInputWindow();

            const window = windowManager.getInputWindow();

            expect(window).toBe(mockWindow);
        });

        test('should return null when no window exists', () => {
            const window = windowManager.getInputWindow();

            expect(window).toBeNull();
        });
    });

    describe('getPreviousApp', () => {
        test('should return the previous app name', () => {
            (windowManager as any).previousApp = 'TestApp';

            const app = windowManager.getPreviousApp();

            expect(app).toBe('TestApp');
        });

        test('should return null when no previous app', () => {
            const app = windowManager.getPreviousApp();

            expect(app).toBeNull();
        });
    });

    describe('destroy', () => {
        test('should destroy the window if it exists', () => {
            windowManager.createInputWindow();

            windowManager.destroy();

            expect(mockWindow.destroy).toHaveBeenCalled();
            expect((windowManager as any).inputWindow).toBeNull();
        });

        test('should handle case when window does not exist', () => {
            windowManager.destroy();

            // Should not throw error
            expect(mockWindow.destroy).not.toHaveBeenCalled();
        });

        test('should handle destruction errors', () => {
            windowManager.createInputWindow();
            mockWindow.destroy.mockImplementation(() => {
                throw new Error('Destruction failed');
            });

            windowManager.destroy();

            expect(logger.error).toHaveBeenCalled();
        });
    });

    describe('isVisible', () => {
        test('should return true when window is visible', () => {
            windowManager.createInputWindow();
            mockWindow.isVisible.mockReturnValue(true);

            const visible = windowManager.isVisible();

            expect(visible).toBe(true);
        });

        test('should return false when window is not visible', () => {
            windowManager.createInputWindow();
            mockWindow.isVisible.mockReturnValue(false);

            const visible = windowManager.isVisible();

            expect(visible).toBe(false);
        });

        test('should return false when no window exists', () => {
            const visible = windowManager.isVisible();

            expect(visible).toBe(false);
        });
    });

    describe('setupEventListeners', () => {
        test('should set up event listeners when window exists', () => {
            windowManager.createInputWindow();
            const onBlur = jest.fn();
            const onClosed = jest.fn();

            (windowManager as any).setupEventListeners(onBlur, onClosed);

            expect(mockWindow.on).toHaveBeenCalledWith('blur', onBlur);
            expect(mockWindow.on).toHaveBeenCalledWith('closed', onClosed);
        });

        test('should handle case when window does not exist', () => {
            const onBlur = jest.fn();
            const onClosed = jest.fn();

            (windowManager as any).setupEventListeners(onBlur, onClosed);

            expect(logger.warn).toHaveBeenCalled();
        });

        test('should work with null callbacks', () => {
            windowManager.createInputWindow();

            (windowManager as any).setupEventListeners(null, null);

            // Should not set up listeners for null callbacks
            expect(mockWindow.on).not.toHaveBeenCalled();
        });
    });
});