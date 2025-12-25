import { execFile } from 'child_process';
import { app } from 'electron';
import type { AppInfo, WindowBounds } from '../../types';
import { TIMEOUTS } from '../../constants';
import { executeAppleScriptSafely, validateAppleScriptSecurity } from '../apple-script-sanitizer';
import { logger } from '../logger';
import { WINDOW_DETECTOR_PATH } from './paths';

// Accessibility permission check result
interface AccessibilityStatus {
  hasPermission: boolean;
  bundleId: string;
}

/**
 * Logs timing information for getCurrentApp
 */
function logTiming(label: string, duration: number): void {
  logger.debug(`${label}: ${duration.toFixed(2)}ms`);
}

/**
 * Parses the JSON response from window-detector
 */
function parseAppInfoResponse(stdout: string): AppInfo | null {
  const result = JSON.parse(stdout.trim());

  if (result.error) {
    logger.warn('Native tool returned error:', result.error);
    return null;
  }

  return {
    name: result.name,
    bundleId: result.bundleId === null ? null : result.bundleId
  };
}

/**
 * Logs error result with timing information
 */
function logErrorResult(execDuration: number, startTime: number, error: Error): void {
  logger.warn('Error getting current app (non-blocking):', error.message);
  logTiming('getCurrentApp exec (error)', execDuration);
  logTiming('Total getCurrentApp time (error)', performance.now() - startTime);
}

/**
 * Logs tool error result with timing information
 */
function logToolErrorResult(execDuration: number, startTime: number): void {
  logTiming('getCurrentApp exec (tool error)', execDuration);
  logTiming('Total getCurrentApp time (tool error)', performance.now() - startTime);
}

/**
 * Logs successful result with timing information
 */
function logSuccessResult(execDuration: number, startTime: number, appInfo: AppInfo): void {
  logTiming('getCurrentApp exec (success)', execDuration);
  logTiming('Total getCurrentApp time', performance.now() - startTime);
  logger.debug('Current app detected:', appInfo);
}

/**
 * Logs parse error result with timing information
 */
function logParseErrorResult(execDuration: number, startTime: number, parseError: unknown): void {
  logger.warn('Error parsing app info:', parseError);
  logTiming('getCurrentApp exec (parse error)', execDuration);
  logTiming('Total getCurrentApp time (parse error)', performance.now() - startTime);
}

/**
 * Handles the execution callback for getCurrentApp
 */
function handleGetCurrentAppResult(
  error: Error | null,
  stdout: string,
  execDuration: number,
  startTime: number,
  resolve: (value: AppInfo | null) => void
): void {
  if (error) {
    logErrorResult(execDuration, startTime, error);
    resolve(null);
    return;
  }

  try {
    const parseStartTime = performance.now();
    const appInfo = parseAppInfoResponse(stdout);
    logTiming('JSON parsing', performance.now() - parseStartTime);

    if (!appInfo) {
      logToolErrorResult(execDuration, startTime);
      resolve(null);
      return;
    }

    logSuccessResult(execDuration, startTime, appInfo);
    resolve(appInfo);
  } catch (parseError) {
    logParseErrorResult(execDuration, startTime, parseError);
    resolve(null);
  }
}

export function getCurrentApp(): Promise<AppInfo | null> {
  const startTime = performance.now();
  logger.debug('Starting getCurrentApp()');

  return new Promise((resolve) => {
    if (process.platform !== 'darwin') {
      logTiming('Platform check (non-darwin)', performance.now() - startTime);
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
      handleGetCurrentAppResult(error, stdout, execDuration, startTime, resolve);
    });
  });
}

/**
 * Validates window bounds numeric values
 */
function validateWindowBounds(bounds: WindowBounds): boolean {
  return !Object.values(bounds).some(val => typeof val !== 'number' || isNaN(val));
}

/**
 * Parses window bounds from JSON response
 */
function parseWindowBoundsResponse(stdout: string): WindowBounds | null {
  const result = JSON.parse(stdout.trim());

  if (result.error) {
    logger.warn('Native tool returned error for window bounds:', result.error);
    return null;
  }

  const windowBounds = {
    x: result.x,
    y: result.y,
    width: result.width,
    height: result.height
  };

  if (!validateWindowBounds(windowBounds)) {
    logger.warn('Invalid numeric values in window bounds:', result);
    return null;
  }

  return windowBounds;
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
        return;
      }

      try {
        const windowBounds = parseWindowBoundsResponse(stdout);
        if (windowBounds) {
          logger.debug('Active window bounds detected:', windowBounds);
        }
        resolve(windowBounds);
      } catch (parseError) {
        logger.warn('Error parsing window bounds:', parseError);
        resolve(null);
      }
    });
  });
}

/**
 * Gets the application's bundle ID
 */
function getAppBundleId(): string {
  const bundleId = app.getApplicationInfoForProtocol ?
    (app.getApplicationInfoForProtocol('prompt-line') as { bundleId?: string })?.bundleId :
    'com.electron.prompt-line';

  return bundleId || 'com.electron.prompt-line';
}

/**
 * Creates the AppleScript for accessibility permission check
 */
function createAccessibilityCheckScript(): string {
  return `
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
}

/**
 * Executes accessibility check script and returns result
 */
async function executeAccessibilityCheck(script: string, bundleId: string): Promise<AccessibilityStatus> {
  try {
    const stdout = await executeAppleScriptSafely(script, TIMEOUTS.ACCESSIBILITY_CHECK_TIMEOUT);
    const hasPermission = stdout.trim() === 'true';

    logger.debug('Accessibility permission check result', {
      hasPermission,
      bundleId,
      rawResult: stdout.trim()
    });

    return { hasPermission, bundleId };
  } catch (error) {
    logger.warn('Accessibility check failed with error, assuming no permission:', error);
    return { hasPermission: false, bundleId };
  }
}

/**
 * Check if the current application has accessibility permissions on macOS
 * @returns Promise<AccessibilityStatus> - Object with permission status and bundle ID
 */
export function checkAccessibilityPermission(): Promise<AccessibilityStatus> {
  return new Promise((resolve) => {
    try {
      const bundleId = getAppBundleId();
      const script = createAccessibilityCheckScript();

      // Execute security check
      const securityWarnings = validateAppleScriptSecurity(script);
      if (securityWarnings.length > 0) {
        logger.warn('AppleScript security warnings detected', { warnings: securityWarnings });
      }

      // Safe AppleScript execution
      executeAccessibilityCheck(script, bundleId)
        .then(resolve)
        .catch(() => {
          resolve({ hasPermission: false, bundleId });
        });
    } catch (error) {
      logger.error('Failed to check accessibility permission:', error);
      resolve({ hasPermission: false, bundleId: 'com.electron.prompt-line' });
    }
  });
}
