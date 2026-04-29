import { execFile } from 'child_process';
import type { AppInfo } from '../../types';
import { TIMEOUTS } from '../../constants';
import { logger } from '../logger';
import { sanitizeCommandArgument, isCommandArgumentSafe } from '../security';
import { KEYBOARD_SIMULATOR_PATH } from './paths';
import { isCmux } from './app-detection';

// cmux embeds Ghostty as a subprocess and the parent NSApplication consumes
// Cmd+V CGEvents before they reach the focused PTY. We bypass keyboard-simulator
// entirely and route activation + paste through cmux's AppleScript dictionary,
// which forwards `paste_from_clipboard` to Ghostty's native action handler.
const CMUX_PASTE_APPLESCRIPT =
  'tell application "cmux"\n' +
  '  activate\n' +
  '  perform action "paste_from_clipboard" on focused terminal of selected tab of front window\n' +
  'end tell';

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

function activateAndPasteCmux(): Promise<void> {
  return new Promise((resolve, reject) => {
    const options = {
      timeout: TIMEOUTS.ACTIVATE_PASTE_TIMEOUT,
      killSignal: 'SIGTERM' as const
    };

    execFile('osascript', ['-e', CMUX_PASTE_APPLESCRIPT], options, (error, stdout, stderr) => {
      if (error) {
        logger.error('cmux AppleScript paste failed:', {
          error: error.message,
          code: error.code,
          signal: error.signal,
          stderr
        });
        reject(error);
        return;
      }

      if (stdout.trim() !== 'true') {
        logger.warn('cmux AppleScript paste returned non-true:', { stdout, stderr });
      }
      resolve();
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

    if (isCmux(appInfo)) {
      activateAndPasteCmux().then(resolve).catch(reject);
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
    } else {
      args = ['activate-and-paste-name', appName];
    }

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
