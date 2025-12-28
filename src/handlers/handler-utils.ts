import path from 'path';
import os from 'os';
import { logger, SecureErrors } from '../utils/utils';
import MdSearchLoader from '../managers/md-search-loader';
import type { UserSettings } from '../types';
import type { IpcMainInvokeEvent } from 'electron';
import { VALIDATION } from '../constants';

/**
 * Standard IPC result type for success/failure responses
 */
export interface IPCResult {
  success: boolean;
  error?: string;
}

/**
 * Higher-order function for wrapping IPC handlers with standardized error handling.
 * Reduces boilerplate try-catch blocks across handlers.
 *
 * @param handler - The async handler function to wrap
 * @param errorMessage - The error message prefix for logging
 * @param useSecureError - Whether to use SecureErrors.OPERATION_FAILED instead of actual error message
 * @returns Wrapped handler with error handling
 *
 * @example
 * // Before:
 * private async handleSomething(_event: IpcMainInvokeEvent): Promise<IPCResult> {
 *   try {
 *     await this.doSomething();
 *     return { success: true };
 *   } catch (error) {
 *     logger.error('Failed to do something:', error);
 *     return { success: false, error: (error as Error).message };
 *   }
 * }
 *
 * // After:
 * private handleSomething = withIPCErrorHandling(
 *   async (_event: IpcMainInvokeEvent) => {
 *     await this.doSomething();
 *     return { success: true };
 *   },
 *   'Failed to do something'
 * );
 */
export function withIPCErrorHandling<T extends unknown[]>(
  handler: (event: IpcMainInvokeEvent, ...args: T) => Promise<IPCResult>,
  errorMessage: string,
  useSecureError = false
): (event: IpcMainInvokeEvent, ...args: T) => Promise<IPCResult> {
  return async (event: IpcMainInvokeEvent, ...args: T): Promise<IPCResult> => {
    try {
      return await handler(event, ...args);
    } catch (error) {
      const err = error as Error;
      logger.error(`${errorMessage}:`, { message: err.message, stack: err.stack });
      return {
        success: false,
        error: useSecureError ? SecureErrors.OPERATION_FAILED : err.message
      };
    }
  };
}

/**
 * Higher-order function for wrapping IPC handlers that return data (not IPCResult).
 * Returns a default value on error.
 *
 * @param handler - The async handler function to wrap
 * @param errorMessage - The error message prefix for logging
 * @param defaultValue - The default value to return on error
 * @returns Wrapped handler with error handling
 *
 * @example
 * private handleGetHistory = withIPCDataHandler(
 *   async (_event: IpcMainInvokeEvent) => {
 *     return await this.historyManager.getHistory();
 *   },
 *   'Failed to get history',
 *   []
 * );
 */
export function withIPCDataHandler<T, R extends unknown[]>(
  handler: (event: IpcMainInvokeEvent, ...args: R) => Promise<T>,
  errorMessage: string,
  defaultValue: T
): (event: IpcMainInvokeEvent, ...args: R) => Promise<T> {
  return async (event: IpcMainInvokeEvent, ...args: R): Promise<T> => {
    try {
      return await handler(event, ...args);
    } catch (error) {
      logger.error(`${errorMessage}:`, error);
      return defaultValue;
    }
  };
}

/**
 * Expands ~ to home directory and resolves relative paths.
 *
 * @param filePath - The file path to expand
 * @param baseDir - Optional base directory for resolving relative paths
 * @returns Expanded and resolved absolute path
 */
export function expandPath(filePath: string, baseDir?: string): string {
  // Expand ~ to home directory
  let expandedPath = filePath;
  if (filePath.startsWith('~/')) {
    expandedPath = path.join(os.homedir(), filePath.slice(2));
  } else if (filePath === '~') {
    expandedPath = os.homedir();
  }

  // Convert to absolute path if relative
  if (path.isAbsolute(expandedPath)) {
    return expandedPath;
  } else {
    // Use baseDir if provided, otherwise fallback to process.cwd()
    const base = baseDir || process.cwd();
    return path.join(base, expandedPath);
  }
}

/**
 * Normalizes and validates file paths to prevent path traversal attacks.
 *
 * @param filePath - The file path to normalize and validate
 * @param baseDir - Optional base directory for validation
 * @returns Normalized path
 * @throws Error if path validation fails
 */
export function normalizeAndValidatePath(filePath: string, baseDir?: string): string {
  const absolutePath = expandPath(filePath, baseDir);
  const normalizedPath = path.normalize(absolutePath);

  // If baseDir is provided, validate that the normalized path stays within it
  if (baseDir) {
    const normalizedBase = path.normalize(baseDir);
    if (!normalizedPath.startsWith(normalizedBase)) {
      logger.error('Attempted path traversal detected', {
        filePath,
        baseDir,
        normalizedPath,
        timestamp: Date.now()
      });
      throw new Error('Invalid file path - path traversal detected');
    }
  }

  return normalizedPath;
}

/**
 * Validates history item ID format.
 * ID must be lowercase alphanumeric with maximum length of 32 characters.
 *
 * NOTE: This validation is coupled with utils.generateId() - update both if ID format changes.
 *
 * @param id - The history item ID to validate
 * @returns true if valid, false otherwise
 */
export function validateHistoryId(id: string): boolean {
  if (!id || typeof id !== 'string') {
    return false;
  }

  if (!id.match(/^[a-z0-9]+$/)) {
    return false;
  }

  if (id.length > VALIDATION.MAX_ID_LENGTH) {
    return false;
  }

  return true;
}

/**
 * Updates MdSearchLoader configuration from user settings.
 *
 * @param loader - The MdSearchLoader instance to update
 * @param settings - User settings containing mdSearch configuration
 */
export function updateMdSearchConfig(loader: MdSearchLoader, settings: UserSettings): void {
  if (settings.mdSearch) {
    loader.updateConfig(settings.mdSearch);
    logger.info('MdSearch config updated from settings');
  }
}
