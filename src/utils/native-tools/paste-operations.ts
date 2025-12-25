import { execFile, type ExecFileException } from 'child_process';
import type { AppInfo } from '../../types';
import { TIMEOUTS } from '../../constants';
import { logger } from '../logger';
import { sanitizeCommandArgument, isCommandArgumentSafe } from '../security';
import { KEYBOARD_SIMULATOR_PATH, NATIVE_TOOLS_DIR } from './paths';

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

/**
 * Normalizes app info to name and bundle ID
 */
function normalizeAppInfo(appInfo: AppInfo | string): { appName: string; bundleId: string | null } {
  if (typeof appInfo === 'string') {
    return { appName: appInfo, bundleId: null };
  }

  if (appInfo && typeof appInfo === 'object') {
    return { appName: appInfo.name, bundleId: appInfo.bundleId || null };
  }

  throw new Error('Invalid app info provided');
}

/**
 * Validates app name and bundle ID
 */
function validateAppCredentials(appName: string, bundleId: string | null): void {
  if (!isCommandArgumentSafe(appName)) {
    logger.error('App name contains unsafe characters:', { appName });
    throw new Error('App name contains unsafe characters');
  }

  if (bundleId && !isCommandArgumentSafe(bundleId)) {
    logger.error('Bundle ID contains unsafe characters:', { bundleId });
    throw new Error('Bundle ID contains unsafe characters');
  }
}

/**
 * Sanitizes app credentials
 */
function sanitizeAppCredentials(appName: string, bundleId: string | null): { appName: string; bundleId: string | null } {
  try {
    const sanitizedName = sanitizeCommandArgument(appName, 128);
    const sanitizedBundleId = bundleId ? sanitizeCommandArgument(bundleId, 128) : null;

    if (!sanitizedName || sanitizedName.length === 0) {
      logger.error('App name is empty after sanitization');
      throw new Error('App name is required');
    }

    return { appName: sanitizedName, bundleId: sanitizedBundleId };
  } catch (sanitizeError) {
    logger.error('Failed to sanitize command arguments:', sanitizeError);
    throw new Error('Invalid characters in app information');
  }
}

/**
 * Builds command arguments for activation
 */
function buildActivationArgs(appName: string, bundleId: string | null): string[] {
  if (bundleId && bundleId.length > 0) {
    logger.debug('Using sanitized bundle ID for app activation and paste:', { appName, bundleId });
    return ['activate-and-paste-bundle', bundleId];
  }

  logger.debug('Using sanitized app name for app activation and paste:', { appName });
  return ['activate-and-paste-name', appName];
}

/**
 * Handles the execFile callback for activate and paste operation
 */
function handleActivatePasteResult(
  error: ExecFileException | null,
  stdout: string,
  stderr: string,
  args: string[],
  appName: string,
  bundleId: string | null,
  resolve: (value: void | PromiseLike<void>) => void,
  reject: (reason?: unknown) => void
): void {
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
    return;
  }

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

export function activateAndPasteWithNativeTool(appInfo: AppInfo | string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (process.platform !== 'darwin') {
      reject(new Error('Native paste only supported on macOS'));
      return;
    }

    try {
      // Normalize, validate, and sanitize
      let { appName, bundleId } = normalizeAppInfo(appInfo);
      validateAppCredentials(appName, bundleId);
      ({ appName, bundleId } = sanitizeAppCredentials(appName, bundleId));

      // Build arguments and execute
      const args = buildActivationArgs(appName, bundleId);
      const options = {
        timeout: TIMEOUTS.ACTIVATE_PASTE_TIMEOUT,
        killSignal: 'SIGTERM' as const
      };

      logger.debug('Executing native activate and paste command', {
        executable: KEYBOARD_SIMULATOR_PATH,
        args,
        nativeToolsDir: NATIVE_TOOLS_DIR,
        appName,
        bundleId
      });

      execFile(KEYBOARD_SIMULATOR_PATH, args, options, (error, stdout, stderr) => {
        handleActivatePasteResult(error, stdout, stderr, args, appName, bundleId, resolve, reject);
      });
    } catch (error) {
      reject(error);
    }
  });
}
