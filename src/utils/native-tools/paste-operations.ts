import { execFile } from 'child_process';
import type { AppInfo } from '../../types';
import { TIMEOUTS } from '../../constants';
import { logger } from '../logger';
import { sanitizeCommandArgument, isCommandArgumentSafe } from '../security';
import { KEYBOARD_SIMULATOR_PATH } from './paths';
import { isCmux } from './app-detection';

// cmux embeds Ghostty as a subprocess and the parent NSApplication consumes
// Cmd+V CGEvents before they reach the focused PTY. We bypass keyboard-
// simulator entirely and route activation + paste through cmux's AppleScript
// dictionary, which forwards `paste_from_clipboard` to Ghostty's native
// action handler. (Ghostty/WezTerm don't need this — Cmd+V CGEvent reaches
// their PTY directly.)
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

function pasteFromClipboardCmux(): Promise<void> {
  return new Promise((resolve, reject) => {
    const options = {
      timeout: TIMEOUTS.ACTIVATE_PASTE_TIMEOUT,
      killSignal: 'SIGTERM' as const
    };

    execFile('osascript', ['-e', CMUX_PASTE_APPLESCRIPT], options, (error, _stdout, stderr) => {
      if (error) {
        logger.error('cmux AppleScript paste_from_clipboard failed:', {
          error: error.message,
          code: error.code,
          signal: error.signal,
          stderr
        });
        reject(error);
        return;
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

    // cmux requires AppleScript `paste_from_clipboard` because Cmd+V CGEvent
    // does not reach its embedded Ghostty PTY (parent NSApp consumes it).
    // Ghostty/WezTerm work fine with the standard keyboard-simulator path
    // below (same as iTerm2), so they fall through.
    if (isCmux(appInfo)) {
      pasteFromClipboardCmux().then(resolve).catch(reject);
      return;
    }

    // Only the identifier actually passed to keyboard-simulator is validated.
    // Checking the display name even when the bundle ID is used rejected apps
    // whose name has punctuation, e.g. "T3 Code (Beta)".
    if (bundleId) {
      if (!isCommandArgumentSafe(bundleId)) {
        logger.error('Bundle ID contains unsafe characters:', { bundleId });
        reject(new Error('Bundle ID contains unsafe characters'));
        return;
      }
      bundleId = sanitizeCommandArgument(bundleId, 128);
    }

    let args: string[];
    if (bundleId) {
      args = ['activate-and-paste-bundle', bundleId];
    } else {
      if (!isCommandArgumentSafe(appName)) {
        logger.error('App name contains unsafe characters:', { appName });
        reject(new Error('App name contains unsafe characters'));
        return;
      }
      appName = sanitizeCommandArgument(appName, 128);
      if (!appName) {
        logger.error('App name is empty after sanitization');
        reject(new Error('App name is required'));
        return;
      }
      args = ['activate-and-paste-name', appName];
    }

    const options = {
      timeout: TIMEOUTS.ACTIVATE_PASTE_TIMEOUT,
      killSignal: 'SIGTERM' as const
    };

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
