import { exec } from 'child_process';
import { promises as fs } from 'fs';
import { app } from 'electron';
import path from 'path';
import os from 'os';
import type { 
  AppInfo, 
  LogLevel, 
  DebounceFunction,
  WindowBounds
} from '../types';
import { TIMEOUTS, TIME_CALCULATIONS } from '../constants';

// Native tools paths - handle both packaged and development modes
function getNativeToolsPath(): string {
  try {
    // Try to import app to check if packaged
     
    const { app } = require('electron');
    
    if (app && app.isPackaged) {
      // In packaged mode, native tools are in the .asar.unpacked directory
      const appPath = app.getAppPath();
      const resourcesPath = path.dirname(appPath);
      const nativeToolsPath = path.join(resourcesPath, 'app.asar.unpacked', 'dist', 'native-tools');
      
      return nativeToolsPath;
    }
  } catch {
    // App object not available (e.g., in renderer process or tests)
  }
  
  // Development mode or fallback
  return path.join(__dirname, '..', 'native-tools');
}

const NATIVE_TOOLS_DIR = getNativeToolsPath();
const WINDOW_DETECTOR_PATH = path.join(NATIVE_TOOLS_DIR, 'window-detector');
const KEYBOARD_SIMULATOR_PATH = path.join(NATIVE_TOOLS_DIR, 'keyboard-simulator');
const TEXT_FIELD_DETECTOR_PATH = path.join(NATIVE_TOOLS_DIR, 'text-field-detector');

// Accessibility permission check result
interface AccessibilityStatus {
  hasPermission: boolean;
  bundleId: string;
}

class Logger {
  private level: LogLevel = 'info';
  private enableFileLogging: boolean = true;
  private logFile: string;

  constructor() {
    // Initialize with defaults to avoid circular dependency
    this.logFile = path.join(os.homedir(), '.prompt-line', 'app.log');
    
    // Set actual config values after initialization if available
    this.initializeConfig();
  }

  private initializeConfig(): void {
    try {
       
      const config = require('../config/app-config');
      if (config && config.logging) {
        this.level = config.logging.level || 'info';
        this.enableFileLogging = config.logging.enableFileLogging !== false;
      }
      if (config && config.paths && config.paths.logFile) {
        this.logFile = config.paths.logFile;
      }
    } catch {
      // Config not available yet, use defaults
    }
  }

  log(level: LogLevel, message: string, data: unknown = null): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

    if (this.shouldLog(level)) {
      const consoleMethod = this.getConsoleMethod(level);
      if (data) {
        consoleMethod(logMessage, data);
      } else {
        consoleMethod(logMessage);
      }
    }

    if (this.enableFileLogging) {
      this.writeToFile(logMessage, data);
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = { 
      debug: 0, 
      info: 1, 
      warn: 2, 
      error: 3 
    };
    return levels[level] >= levels[this.level];
  }

  private getConsoleMethod(level: LogLevel): typeof console.log {
    switch (level) {
      case 'debug': return console.debug;
      case 'info': return console.info;
      case 'warn': return console.warn;
      case 'error': return console.error;
      default: return console.log;
    }
  }

  private writeToFile(message: string, data: unknown): void {
    const fullMessage = data ? `${message} ${JSON.stringify(data)}\n` : `${message}\n`;
    fs.appendFile(this.logFile, fullMessage).catch(err => {
      console.error('Failed to write to log file:', err);
    });
  }

  debug(message: string, data?: unknown): void { 
    this.log('debug', message, data); 
  }
  
  info(message: string, data?: unknown): void { 
    this.log('info', message, data); 
  }
  
  warn(message: string, data?: unknown): void { 
    this.log('warn', message, data); 
  }
  
  error(message: string, data?: unknown): void { 
    this.log('error', message, data); 
  }
}

const logger = new Logger();

// Log native tools path after logger initialization (only in development)
if (process.env.NODE_ENV !== 'test') {
  logger.debug('Native tools configuration', {
    nativeToolsDir: NATIVE_TOOLS_DIR,
    windowDetectorPath: WINDOW_DETECTOR_PATH,
    keyboardSimulatorPath: KEYBOARD_SIMULATOR_PATH
  });
}


function getCurrentApp(): Promise<AppInfo | null> {
  return new Promise((resolve) => {
    // Check platform directly instead of using config to avoid dependency
    if (process.platform !== 'darwin') {
      resolve(null);
      return;
    }

    const options = {
      timeout: TIMEOUTS.CURRENT_APP_TIMEOUT,
      killSignal: 'SIGTERM' as const
    };

    exec(`"${WINDOW_DETECTOR_PATH}" current-app`, options, (error, stdout) => {
      if (error) {
        logger.warn('Error getting current app (non-blocking):', error.message);
        resolve(null);
      } else {
        try {
          const result = JSON.parse(stdout.trim());
          if (result.error) {
            logger.warn('Native tool returned error:', result.error);
            resolve(null);
            return;
          }
          
          const appInfo: AppInfo = {
            name: result.name,
            bundleId: result.bundleId === null ? null : result.bundleId
          };
          logger.debug('Current app detected:', appInfo);
          resolve(appInfo);
        } catch (parseError) {
          logger.warn('Error parsing app info:', parseError);
          resolve(null);
        }
      }
    });
  });
}

function pasteWithNativeTool(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (process.platform !== 'darwin') {
      reject(new Error('Native paste only supported on macOS'));
      return;
    }

    const options = {
      timeout: TIMEOUTS.NATIVE_PASTE_TIMEOUT,
      killSignal: 'SIGTERM' as const
    };

    const command = `"${KEYBOARD_SIMULATOR_PATH}" paste`;
    logger.debug('Executing native paste command', { 
      command, 
      keyboardSimulatorPath: KEYBOARD_SIMULATOR_PATH,
      nativeToolsDir: NATIVE_TOOLS_DIR
    });

    exec(command, options, (error, stdout, stderr) => {
      if (error) {
        if (error.killed) {
          logger.warn('Native paste timed out (non-critical)');
          resolve();
        } else {
          logger.error('Native paste error:', {
            error: error.message,
            code: error.code,
            signal: error.signal,
            stderr,
            command
          });
          reject(error);
        }
      } else {
        try {
          const result = JSON.parse(stdout.trim());
          if (result.success) {
            logger.debug('Native paste successful');
            resolve();
          } else {
            logger.error('Native paste failed:', result);
            reject(new Error('Native paste failed'));
          }
        } catch (parseError) {
          logger.warn('Error parsing native paste result:', parseError);
          resolve();
        }
      }
    });
  });
}

function debounce<T extends unknown[]>(
  func: (...args: T) => void, 
  wait: number, 
  immediate = false
): DebounceFunction<T> {
  let timeout: NodeJS.Timeout | undefined;
  
  const debouncedFunction = function(this: unknown, ...args: T) {
    const later = () => {
      timeout = undefined;
      if (!immediate) func.apply(this, args);
    };
    const callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) func.apply(this, args);
  };

  return debouncedFunction;
}

function throttle<T extends unknown[]>(
  func: (...args: T) => void, 
  wait: number
): (...args: T) => void {
  let timeout: NodeJS.Timeout | undefined;
  let lastRan: number | undefined;
  
  return function(this: unknown, ...args: T) {
    if (!lastRan) {
      func.apply(this, args);
      lastRan = Date.now();
    } else {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        if (lastRan && (Date.now() - lastRan) >= wait) {
          func.apply(this, args);
          lastRan = Date.now();
        }
      }, wait - (Date.now() - lastRan));
    }
  };
}

function safeJsonParse<T = unknown>(jsonString: string, fallback?: T): T | null {
  try {
    return JSON.parse(jsonString) as T;
  } catch (error) {
    logger.warn('Failed to parse JSON:', error);
    return fallback ?? null;
  }
}

function safeJsonStringify(obj: unknown, fallback = '{}'): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch (error) {
    logger.warn('Failed to stringify object:', error);
    return fallback;
  }
}

// Generates lowercase alphanumeric ID (a-z0-9)
// NOTE: ID validation in ipc-handlers.ts depends on this format - update both if changed
function generateId(): string {
  return Date.now().toString(TIME_CALCULATIONS.TIMESTAMP_BASE) + Math.random().toString(TIME_CALCULATIONS.TIMESTAMP_BASE).substring(TIME_CALCULATIONS.RANDOM_ID_START, TIME_CALCULATIONS.RANDOM_ID_END);
}

function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / TIME_CALCULATIONS.MILLISECONDS_PER_MINUTE);
  const hours = Math.floor(diff / TIME_CALCULATIONS.MILLISECONDS_PER_HOUR);
  const days = Math.floor(diff / TIME_CALCULATIONS.MILLISECONDS_PER_DAY);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

async function ensureDir(dirPath: string): Promise<void> {
  try {
    await fs.access(dirPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      await fs.mkdir(dirPath, { recursive: true });
      logger.debug('Created directory:', dirPath);
    } else {
      throw error;
    }
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if the current application has accessibility permissions on macOS
 * @returns Promise<AccessibilityStatus> - Object with permission status and bundle ID
 */
function checkAccessibilityPermission(): Promise<AccessibilityStatus> {
  return new Promise((resolve) => {
    try {
      // Get current app's bundle ID
      const bundleId = app.getApplicationInfoForProtocol ? 
        (app.getApplicationInfoForProtocol('prompt-line') as { bundleId?: string })?.bundleId : 
        'com.electron.prompt-line';
      
      const actualBundleId = bundleId || 'com.electron.prompt-line';
      
      // AppleScript to check if our app has accessibility permission
      const script = `
        tell application "System Events"
          try
            -- Try to get accessibility status of our app
            set accessibilityEnabled to (accessibility enabled of application process "Prompt Line")
            return "true"
          on error errorMessage
            -- If we get a permission error, we don't have accessibility access
            if errorMessage contains "not allowed assistive access" or errorMessage contains "accessibility access" then
              return "false"
            else
              -- Other errors might indicate app not running or other issues
              -- Try a different approach by testing actual accessibility function
              try
                set frontApp to first application process whose frontmost is true
                return "true"
              on error
                return "false"
              end try
            end if
          end try
        end tell
      `;

      exec(`osascript -e '${script.replace(/'/g, "\\'")}'`, { timeout: TIMEOUTS.ACCESSIBILITY_CHECK_TIMEOUT }, (error, stdout) => {
        if (error) {
          logger.warn('Accessibility check failed with error, assuming no permission:', error);
          resolve({ hasPermission: false, bundleId: actualBundleId });
          return;
        }

        const result = stdout.trim();
        const hasPermission = result === 'true';
        
        logger.debug('Accessibility permission check result', { 
          hasPermission, 
          bundleId: actualBundleId,
          rawResult: result 
        });

        resolve({ hasPermission, bundleId: actualBundleId });
      });
    } catch (error) {
      logger.error('Failed to check accessibility permission:', error);
      resolve({ hasPermission: false, bundleId: 'com.electron.prompt-line' });
    }
  });
}

function getActiveWindowBounds(): Promise<WindowBounds | null> {
  return new Promise((resolve) => {
    if (process.platform !== 'darwin') {
      resolve(null);
      return;
    }

    const options = {
      timeout: TIMEOUTS.WINDOW_BOUNDS_TIMEOUT,
      killSignal: 'SIGTERM' as const
    };

    exec(`"${WINDOW_DETECTOR_PATH}" window-bounds`, options, (error, stdout) => {
      if (error) {
        logger.warn('Error getting active window bounds (non-blocking):', error.message);
        resolve(null);
      } else {
        try {
          const result = JSON.parse(stdout.trim());
          if (result.error) {
            logger.warn('Native tool returned error for window bounds:', result.error);
            resolve(null);
            return;
          }
          
          const windowBounds = {
            x: result.x,
            y: result.y,
            width: result.width,
            height: result.height
          };
          
          if (Object.values(windowBounds).some(val => typeof val !== 'number' || isNaN(val))) {
            logger.warn('Invalid numeric values in window bounds:', result);
            resolve(null);
            return;
          }
          
          logger.debug('Active window bounds detected:', windowBounds);
          resolve(windowBounds);
        } catch (parseError) {
          logger.warn('Error parsing window bounds:', parseError);
          resolve(null);
        }
      }
    });
  });
}

function activateAndPasteWithNativeTool(appInfo: AppInfo | string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (process.platform !== 'darwin') {
      reject(new Error('Native paste only supported on macOS'));
      return;
    }

    let appName: string;
    let bundleId: string | null;
    
    if (typeof appInfo === 'string') {
      appName = appInfo;
      bundleId = null;
    } else if (appInfo && typeof appInfo === 'object') {
      appName = appInfo.name;
      bundleId = appInfo.bundleId || null;
    } else {
      reject(new Error('Invalid app info provided'));
      return;
    }

    const options = {
      timeout: TIMEOUTS.ACTIVATE_PASTE_TIMEOUT,
      killSignal: 'SIGTERM' as const
    };

    let command: string;
    if (bundleId) {
      command = `"${KEYBOARD_SIMULATOR_PATH}" activate-and-paste-bundle "${bundleId}"`;
      logger.debug('Using bundle ID for app activation and paste:', { appName, bundleId });
    } else {
      command = `"${KEYBOARD_SIMULATOR_PATH}" activate-and-paste-name "${appName}"`;
      logger.debug('Using app name for app activation and paste:', { appName });
    }

    logger.debug('Executing native activate and paste command', { 
      command, 
      keyboardSimulatorPath: KEYBOARD_SIMULATOR_PATH,
      nativeToolsDir: NATIVE_TOOLS_DIR,
      appName,
      bundleId
    });

    exec(command, options, (error, stdout, stderr) => {
      if (error) {
        if (error.killed) {
          logger.warn('Native activate+paste timed out, attempting graceful fallback');
          pasteWithNativeTool().then(resolve).catch(reject);
        } else {
          logger.error('Native activate and paste error:', {
            error: error.message,
            code: error.code,
            signal: error.signal,
            stderr,
            command,
            appName,
            bundleId
          });
          reject(error);
        }
      } else {
        try {
          const result = JSON.parse(stdout.trim());
          if (result.success) {
            logger.debug('Native activate and paste successful', { appName, bundleId });
            resolve();
          } else {
            logger.error('Native activate and paste failed:', result);
            reject(new Error('Native activate and paste failed'));
          }
        } catch (parseError) {
          logger.warn('Error parsing native activate+paste result:', parseError);
          resolve();
        }
      }
    });
  });
}

export {
  logger,
  getCurrentApp,
  getActiveWindowBounds,
  pasteWithNativeTool,
  activateAndPasteWithNativeTool,
  checkAccessibilityPermission,
  debounce,
  throttle,
  safeJsonParse,
  safeJsonStringify,
  generateId,
  formatTimeAgo,
  ensureDir,
  fileExists,
  sleep,
  KEYBOARD_SIMULATOR_PATH,
  TEXT_FIELD_DETECTOR_PATH,
  WINDOW_DETECTOR_PATH
};