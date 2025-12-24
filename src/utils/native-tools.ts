import { execFile } from 'child_process';
import { app } from 'electron';
import path from 'path';
import type { AppInfo, WindowBounds, DirectoryInfo } from '../types';
import { TIMEOUTS } from '../constants';
import { executeAppleScriptSafely, validateAppleScriptSecurity } from './apple-script-sanitizer';
import { logger } from './logger';
import { sanitizeCommandArgument, isCommandArgumentSafe } from './security';

// Accessibility permission check result
interface AccessibilityStatus {
  hasPermission: boolean;
  bundleId: string;
}

/**
 * Options for directory detection with source app override
 */
export interface DirectoryDetectionOptions {
  /** Source app PID (for when Prompt Line window is in front) */
  pid?: number;
  /** Source app bundle ID */
  bundleId?: string;
}

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
export const WINDOW_DETECTOR_PATH = path.join(NATIVE_TOOLS_DIR, 'window-detector');
export const KEYBOARD_SIMULATOR_PATH = path.join(NATIVE_TOOLS_DIR, 'keyboard-simulator');
export const TEXT_FIELD_DETECTOR_PATH = path.join(NATIVE_TOOLS_DIR, 'text-field-detector');
export const DIRECTORY_DETECTOR_PATH = path.join(NATIVE_TOOLS_DIR, 'directory-detector');
export const FILE_SEARCHER_PATH = path.join(NATIVE_TOOLS_DIR, 'file-searcher');
export const SYMBOL_SEARCHER_PATH = path.join(NATIVE_TOOLS_DIR, 'symbol-searcher');

// Log native tools path after logger initialization (only in development)
if (process.env.NODE_ENV !== 'test') {
  logger.debug('Native tools configuration', {
    nativeToolsDir: NATIVE_TOOLS_DIR,
    windowDetectorPath: WINDOW_DETECTOR_PATH,
    keyboardSimulatorPath: KEYBOARD_SIMULATOR_PATH
  });
}

export function getCurrentApp(): Promise<AppInfo | null> {
  const startTime = performance.now();
  logger.debug('Starting getCurrentApp()');

  return new Promise((resolve) => {
    // Check platform directly instead of using config to avoid dependency
    if (process.platform !== 'darwin') {
      logger.debug(`Platform check (non-darwin): ${(performance.now() - startTime).toFixed(2)}ms`);
      resolve(null);
      return;
    }

    const options = {
      timeout: TIMEOUTS.CURRENT_APP_TIMEOUT,
      killSignal: 'SIGTERM' as const
    };

    const execStartTime = performance.now();
    execFile(WINDOW_DETECTOR_PATH, ['current-app'], options, (error, stdout) => {
      const execDuration = performance.now() - execStartTime;

      if (error) {
        logger.warn('Error getting current app (non-blocking):', error.message);
        logger.debug(`getCurrentApp exec (error): ${execDuration.toFixed(2)}ms`);
        logger.debug(`Total getCurrentApp time (error): ${(performance.now() - startTime).toFixed(2)}ms`);
        resolve(null);
      } else {
        try {
          const parseStartTime = performance.now();
          const result = JSON.parse(stdout.trim());
          logger.debug(`JSON parsing: ${(performance.now() - parseStartTime).toFixed(2)}ms`);

          if (result.error) {
            logger.warn('Native tool returned error:', result.error);
            logger.debug(`getCurrentApp exec (tool error): ${execDuration.toFixed(2)}ms`);
            logger.debug(`Total getCurrentApp time (tool error): ${(performance.now() - startTime).toFixed(2)}ms`);
            resolve(null);
            return;
          }

          const appInfo: AppInfo = {
            name: result.name,
            bundleId: result.bundleId === null ? null : result.bundleId
          };

          logger.debug(`getCurrentApp exec (success): ${execDuration.toFixed(2)}ms`);
          logger.debug(`Total getCurrentApp time: ${(performance.now() - startTime).toFixed(2)}ms`);
          logger.debug('Current app detected:', appInfo);
          resolve(appInfo);
        } catch (parseError) {
          logger.warn('Error parsing app info:', parseError);
          logger.debug(`getCurrentApp exec (parse error): ${execDuration.toFixed(2)}ms`);
          logger.debug(`Total getCurrentApp time (parse error): ${(performance.now() - startTime).toFixed(2)}ms`);
          resolve(null);
        }
      }
    });
  });
}

export function pasteWithNativeTool(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (process.platform !== 'darwin') {
      reject(new Error('Native paste only supported on macOS'));
      return;
    }

    const options = {
      timeout: TIMEOUTS.NATIVE_PASTE_TIMEOUT,
      killSignal: 'SIGTERM' as const
    };

    const args = ['paste'];
    logger.debug('Executing native paste command', {
      executable: KEYBOARD_SIMULATOR_PATH,
      args,
      nativeToolsDir: NATIVE_TOOLS_DIR
    });

    execFile(KEYBOARD_SIMULATOR_PATH, args, options, (error, stdout, stderr) => {
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
            executable: KEYBOARD_SIMULATOR_PATH,
            args
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

export function getActiveWindowBounds(): Promise<WindowBounds | null> {
  return new Promise((resolve) => {
    if (process.platform !== 'darwin') {
      resolve(null);
      return;
    }

    const options = {
      timeout: TIMEOUTS.WINDOW_BOUNDS_TIMEOUT,
      killSignal: 'SIGTERM' as const
    };

    execFile(WINDOW_DETECTOR_PATH, ['window-bounds'], options, (error, stdout) => {
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

export function activateAndPasteWithNativeTool(appInfo: AppInfo | string): Promise<void> {
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

    // Validate inputs before sanitization
    if (!isCommandArgumentSafe(appName)) {
      logger.error('App name contains unsafe characters:', { appName });
      reject(new Error('App name contains unsafe characters'));
      return;
    }

    if (bundleId && !isCommandArgumentSafe(bundleId)) {
      logger.error('Bundle ID contains unsafe characters:', { bundleId });
      reject(new Error('Bundle ID contains unsafe characters'));
      return;
    }

    // Sanitize inputs to prevent command injection
    try {
      appName = sanitizeCommandArgument(appName, 128);
      if (bundleId) {
        bundleId = sanitizeCommandArgument(bundleId, 128);
      }
    } catch (sanitizeError) {
      logger.error('Failed to sanitize command arguments:', sanitizeError);
      reject(new Error('Invalid characters in app information'));
      return;
    }

    // Additional validation for empty values after sanitization
    if (!appName || appName.length === 0) {
      logger.error('App name is empty after sanitization');
      reject(new Error('App name is required'));
      return;
    }

    const options = {
      timeout: TIMEOUTS.ACTIVATE_PASTE_TIMEOUT,
      killSignal: 'SIGTERM' as const
    };

    let args: string[];
    if (bundleId && bundleId.length > 0) {
      args = ['activate-and-paste-bundle', bundleId];
      logger.debug('Using sanitized bundle ID for app activation and paste:', { appName, bundleId });
    } else {
      args = ['activate-and-paste-name', appName];
      logger.debug('Using sanitized app name for app activation and paste:', { appName });
    }

    logger.debug('Executing native activate and paste command', {
      executable: KEYBOARD_SIMULATOR_PATH,
      args,
      nativeToolsDir: NATIVE_TOOLS_DIR,
      appName,
      bundleId
    });

    execFile(KEYBOARD_SIMULATOR_PATH, args, options, (error, stdout, stderr) => {
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
            executable: KEYBOARD_SIMULATOR_PATH,
            args,
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

/**
 * Check if the current application has accessibility permissions on macOS
 * @returns Promise<AccessibilityStatus> - Object with permission status and bundle ID
 */
export function checkAccessibilityPermission(): Promise<AccessibilityStatus> {
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

      // Execute security check
      const securityWarnings = validateAppleScriptSecurity(script);
      if (securityWarnings.length > 0) {
        logger.warn('AppleScript security warnings detected', { warnings: securityWarnings });
      }

      // Safe AppleScript execution
      executeAppleScriptSafely(script, TIMEOUTS.ACCESSIBILITY_CHECK_TIMEOUT)
        .then((stdout) => {
          const result = stdout.trim();
          const hasPermission = result === 'true';

          logger.debug('Accessibility permission check result', {
            hasPermission,
            bundleId: actualBundleId,
            rawResult: result
          });

          resolve({ hasPermission, bundleId: actualBundleId });
        })
        .catch((error) => {
          logger.warn('Accessibility check failed with error, assuming no permission:', error);
          resolve({ hasPermission: false, bundleId: actualBundleId });
        });
    } catch (error) {
      logger.error('Failed to check accessibility permission:', error);
      resolve({ hasPermission: false, bundleId: 'com.electron.prompt-line' });
    }
  });
}

/**
 * Detect current directory from active terminal (Terminal.app or iTerm2)
 * @param options - Optional PID and bundleId to override frontmost app detection
 * @returns Promise<DirectoryInfo> - Object with directory info or error
 */
export function detectCurrentDirectory(options?: DirectoryDetectionOptions): Promise<DirectoryInfo> {
  return new Promise((resolve) => {
    if (process.platform !== 'darwin') {
      resolve({ error: 'Directory detection only supported on macOS' });
      return;
    }

    const execOptions = {
      timeout: TIMEOUTS.WINDOW_BOUNDS_TIMEOUT,
      killSignal: 'SIGTERM' as const
    };

    // Build args array with optional PID and/or bundleId arguments
    // bundleId alone is supported - Swift will look up the PID
    const args: string[] = ['detect'];
    if (options?.bundleId) {
      args.push('--bundleId', options.bundleId);
      if (options?.pid) {
        args.push('--pid', String(options.pid));
      }
    }

    execFile(DIRECTORY_DETECTOR_PATH, args, execOptions, (error, stdout) => {
      if (error) {
        logger.warn('Error detecting current directory (non-blocking):', error.message);
        resolve({ error: error.message });
      } else {
        try {
          const result = JSON.parse(stdout.trim()) as DirectoryInfo;
          if (result.error) {
            logger.debug('Directory detection returned error:', result.error);
          } else {
            logger.debug('Current directory detected:', result.directory);
          }
          resolve(result);
        } catch (parseError) {
          logger.warn('Error parsing directory detection result:', parseError);
          resolve({ error: 'Failed to parse directory detection result' });
        }
      }
    });
  });
}

/**
 * List files in a specified directory using file-searcher native tool
 * @param directoryPath - Path to the directory to list
 * @returns Promise<DirectoryInfo> - Object with file list or error
 */
export function listDirectory(directoryPath: string): Promise<DirectoryInfo> {
  return new Promise((resolve) => {
    if (process.platform !== 'darwin') {
      resolve({ error: 'Directory listing only supported on macOS' });
      return;
    }

    // Validate path input
    if (!directoryPath || typeof directoryPath !== 'string') {
      resolve({ error: 'Invalid directory path' });
      return;
    }

    // Sanitize path to prevent command injection
    const sanitizedPath = directoryPath
      .replace(/[;&|`$(){}[\]<>"'\\*?~^]/g, '')
      .replace(/\x00/g, '')
      .replace(/[\r\n]/g, '')
      .trim();

    if (sanitizedPath.length === 0) {
      resolve({ error: 'Directory path is empty after sanitization' });
      return;
    }

    const options = {
      timeout: TIMEOUTS.WINDOW_BOUNDS_TIMEOUT,
      killSignal: 'SIGTERM' as const
    };

    // Use file-searcher native tool for file listing
    execFile(FILE_SEARCHER_PATH, ['list', sanitizedPath], options, (error, stdout) => {
      if (error) {
        logger.warn('Error listing directory (non-blocking):', error.message);
        resolve({ error: error.message });
      } else {
        try {
          const result = JSON.parse(stdout.trim()) as DirectoryInfo;
          if (result.error) {
            logger.debug('Directory listing returned error:', result.error);
          } else {
            logger.debug('Directory listed:', {
              directory: result.directory,
              fileCount: result.fileCount
            });
          }
          resolve(result);
        } catch (parseError) {
          logger.warn('Error parsing directory listing result:', parseError);
          resolve({ error: 'Failed to parse directory listing result' });
        }
      }
    });
  });
}

/**
 * Detect current directory from active terminal and list files
 * Uses separated tools: directory-detector for CWD, file-searcher for file listing
 * @param options - Optional PID and bundleId to override frontmost app detection
 * @returns Promise<DirectoryInfo> - Object with directory info and file list
 */
export async function detectCurrentDirectoryWithFiles(options?: DirectoryDetectionOptions): Promise<DirectoryInfo> {
  if (process.platform !== 'darwin') {
    return { error: 'Directory detection only supported on macOS' };
  }

  // Step 1: Detect current directory using directory-detector
  const dirResult = await detectCurrentDirectory(options);
  if (dirResult.error || !dirResult.directory) {
    return dirResult;
  }

  // Step 2: List files using file-searcher
  const fileResult = await listDirectory(dirResult.directory);
  if (fileResult.error) {
    // Return directory info without files if file listing fails
    logger.warn('File listing failed, returning directory only:', fileResult.error);
    return dirResult;
  }

  // Combine results - only add file properties if they exist
  const result: DirectoryInfo = { ...dirResult };
  if (fileResult.files) result.files = fileResult.files;
  if (fileResult.fileCount !== undefined) result.fileCount = fileResult.fileCount;
  if (fileResult.searchMode) result.searchMode = fileResult.searchMode;
  if (fileResult.partial !== undefined) result.partial = fileResult.partial;

  return result;
}
