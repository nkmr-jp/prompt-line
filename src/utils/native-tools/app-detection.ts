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

export function getCurrentApp(): Promise<AppInfo | null> {
  return new Promise((resolve) => {
    if (process.platform !== 'darwin') {
      resolve(null);
      return;
    }

    const options = {
      timeout: TIMEOUTS.CURRENT_APP_TIMEOUT,
      killSignal: 'SIGTERM' as const
    };

    execFile(WINDOW_DETECTOR_PATH, ['current-app'], options, (error, stdout) => {
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

          resolve(appInfo);
        } catch (parseError) {
          logger.warn('Error parsing app info:', parseError);
          resolve(null);
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

          resolve(windowBounds);
        } catch (parseError) {
          logger.warn('Error parsing window bounds:', parseError);
          resolve(null);
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
