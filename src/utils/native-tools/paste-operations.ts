import { execFile } from 'child_process';
import type { AppInfo } from '../../types';
import { TIMEOUTS } from '../../constants';
import { logger } from '../logger';
import { sanitizeCommandArgument, isCommandArgumentSafe } from '../security';
import { KEYBOARD_SIMULATOR_PATH } from './paths';
import { isCmux, isGhostty } from './app-detection';

// Both cmux (`CmuxInTx`) and Ghostty (`GhstInTx`) expose an `input text` AppleScript
// command that pastes text directly into the focused terminal as if it were
// a paste, without consulting the system clipboard. We use this instead of
// `paste_from_clipboard` (cmux's prior path) or CGEvent Cmd+V (Ghostty's
// prior path) because macOS NSPasteboard can retain image formats (TIFF/PNG/
// AVIF…) after Electron's `clipboard.writeText('')`, causing the terminal
// to receive stale image data — or nothing — when the user pastes a prompt
// that contains an image path. Sending the text via `input text` sidesteps
// the clipboard entirely.
//
// We pass the user's text via osascript's `argv` rather than embedding it in
// the script body so that backslashes, quotes, and newlines do not need to
// be re-escaped by us — AppleScript receives them verbatim.
const INPUT_TEXT_APPLESCRIPT = (appName: string): string =>
  'on run argv\n' +
  `  tell application "${appName}"\n` +
  '    activate\n' +
  '    input text (item 1 of argv) to focused terminal of selected tab of front window\n' +
  '  end tell\n' +
  'end run';

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

function inputTextToTerminal(targetApp: 'cmux' | 'Ghostty', text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const options = {
      timeout: TIMEOUTS.ACTIVATE_PASTE_TIMEOUT,
      killSignal: 'SIGTERM' as const
    };

    const script = INPUT_TEXT_APPLESCRIPT(targetApp);
    execFile('osascript', ['-e', script, '--', text], options, (error, _stdout, stderr) => {
      if (error) {
        logger.error(`${targetApp} AppleScript input text failed:`, {
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

export function activateAndPasteWithNativeTool(appInfo: AppInfo | string, text: string): Promise<void> {
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

    // cmux and Ghostty: route through AppleScript `input text` to bypass the
    // system pasteboard. macOS retains image formats on NSPasteboard even after
    // `clipboard.writeText('')`, which can cause Cmd+V / paste_from_clipboard to
    // deliver the residual image instead of the prompt text.
    if (isCmux(appInfo)) {
      inputTextToTerminal('cmux', text).then(resolve).catch(reject);
      return;
    }
    if (isGhostty(appInfo)) {
      inputTextToTerminal('Ghostty', text).then(resolve).catch(reject);
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
