import { execFile } from 'child_process';
import type { AppInfo } from '../../types';
import { TIMEOUTS } from '../../constants';
import { logger } from '../logger';
import { sanitizeCommandArgument, isCommandArgumentSafe } from '../security';
import { KEYBOARD_SIMULATOR_PATH } from './paths';
import { isCmux, isGhostty, isWezTerm } from './app-detection';

const WEZTERM_BINARY_PATH = '/Applications/WezTerm.app/Contents/MacOS/wezterm';

// cmux (`CmuxPfAc`) and Ghostty (`GhstPfAc`) both expose `perform action`
// with the `paste_from_clipboard` action string. We use this rather than
// `input text` because `input text` does NOT wrap with bracketed paste
// markers (`ESC[200~`/`ESC[201~`), causing TUI apps like Claude Code to
// interpret embedded newlines as Enter and submit prematurely — chopping
// off everything after the first newline. `paste_from_clipboard` is
// equivalent to a real Cmd+V and goes through the terminal's standard
// paste pipeline, which respects bracketed paste mode.
//
// The image-residue issue that motivated bypassing the clipboard is now
// handled by `clipboard.clear()` in paste-handler.ts before each paste.
const PASTE_FROM_CLIPBOARD_APPLESCRIPT = (appName: string): string =>
  `tell application "${appName}"\n` +
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

function pasteFromClipboardInTerminal(targetApp: 'cmux' | 'Ghostty'): Promise<void> {
  return new Promise((resolve, reject) => {
    const options = {
      timeout: TIMEOUTS.ACTIVATE_PASTE_TIMEOUT,
      killSignal: 'SIGTERM' as const
    };

    const script = PASTE_FROM_CLIPBOARD_APPLESCRIPT(targetApp);
    execFile('osascript', ['-e', script], options, (error, _stdout, stderr) => {
      if (error) {
        logger.error(`${targetApp} AppleScript paste_from_clipboard failed:`, {
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

// `wezterm cli send-text` reads text from stdin and sends it to the active
// pane. It uses bracketed paste when the pane has the mode enabled, which is
// what Claude Code and other TUI apps need to keep embedded newlines from
// being treated as Enter.
function pasteToWezTerm(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const options = {
      timeout: TIMEOUTS.ACTIVATE_PASTE_TIMEOUT,
      killSignal: 'SIGTERM' as const
    };

    execFile('osascript', ['-e', 'tell application "WezTerm" to activate'], { timeout: 1000, killSignal: 'SIGTERM' as const }, (activateErr) => {
      if (activateErr) {
        logger.warn('WezTerm activate failed (continuing with paste):', activateErr.message);
      }

      const proc = execFile(WEZTERM_BINARY_PATH, ['cli', 'send-text'], options, (error, _stdout, stderr) => {
        if (error) {
          logger.error('WezTerm cli send-text failed:', {
            error: error.message,
            code: error.code,
            signal: error.signal,
            stderr,
            executable: WEZTERM_BINARY_PATH
          });
          reject(error);
          return;
        }
        resolve();
      });
      proc.stdin?.end(text, 'utf8');
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

    // cmux/Ghostty: AppleScript `paste_from_clipboard` action runs through
    // the terminal's standard paste pipeline and is wrapped in bracketed
    // paste markers. WezTerm: `wezterm cli send-text` does the same via
    // stdin. Both routes are required because direct CGEvent Cmd+V into
    // these apps has been observed to skip bracketed paste, causing TUI
    // apps (e.g. Claude Code) to interpret embedded newlines as Enter and
    // truncate the paste at the first newline.
    if (isCmux(appInfo)) {
      pasteFromClipboardInTerminal('cmux').then(resolve).catch(reject);
      return;
    }
    if (isGhostty(appInfo)) {
      pasteFromClipboardInTerminal('Ghostty').then(resolve).catch(reject);
      return;
    }
    if (isWezTerm(appInfo)) {
      pasteToWezTerm(text).then(resolve).catch(reject);
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
