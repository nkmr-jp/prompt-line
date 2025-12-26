// @ts-nocheck
function stryNS_9fa48() {
  var g = typeof globalThis === 'object' && globalThis && globalThis.Math === Math && globalThis || new Function("return this")();
  var ns = g.__stryker__ || (g.__stryker__ = {});
  if (ns.activeMutant === undefined && g.process && g.process.env && g.process.env.__STRYKER_ACTIVE_MUTANT__) {
    ns.activeMutant = g.process.env.__STRYKER_ACTIVE_MUTANT__;
  }
  function retrieveNS() {
    return ns;
  }
  stryNS_9fa48 = retrieveNS;
  return retrieveNS();
}
stryNS_9fa48();
function stryCov_9fa48() {
  var ns = stryNS_9fa48();
  var cov = ns.mutantCoverage || (ns.mutantCoverage = {
    static: {},
    perTest: {}
  });
  function cover() {
    var c = cov.static;
    if (ns.currentTestId) {
      c = cov.perTest[ns.currentTestId] = cov.perTest[ns.currentTestId] || {};
    }
    var a = arguments;
    for (var i = 0; i < a.length; i++) {
      c[a[i]] = (c[a[i]] || 0) + 1;
    }
  }
  stryCov_9fa48 = cover;
  cover.apply(null, arguments);
}
function stryMutAct_9fa48(id) {
  var ns = stryNS_9fa48();
  function isActive(id) {
    if (ns.activeMutant === id) {
      if (ns.hitCount !== void 0 && ++ns.hitCount > ns.hitLimit) {
        throw new Error('Stryker: Hit count limit reached (' + ns.hitCount + ')');
      }
      return true;
    }
    return false;
  }
  stryMutAct_9fa48 = isActive;
  return isActive(id);
}
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
export function withIPCErrorHandling<T extends unknown[]>(handler: (event: IpcMainInvokeEvent, ...args: T) => Promise<IPCResult>, errorMessage: string, useSecureError = stryMutAct_9fa48("428") ? true : (stryCov_9fa48("428"), false)): (event: IpcMainInvokeEvent, ...args: T) => Promise<IPCResult> {
  if (stryMutAct_9fa48("429")) {
    {}
  } else {
    stryCov_9fa48("429");
    return async (event: IpcMainInvokeEvent, ...args: T): Promise<IPCResult> => {
      if (stryMutAct_9fa48("430")) {
        {}
      } else {
        stryCov_9fa48("430");
        try {
          if (stryMutAct_9fa48("431")) {
            {}
          } else {
            stryCov_9fa48("431");
            return await handler(event, ...args);
          }
        } catch (error) {
          if (stryMutAct_9fa48("432")) {
            {}
          } else {
            stryCov_9fa48("432");
            const err = error as Error;
            logger.error(stryMutAct_9fa48("433") ? `` : (stryCov_9fa48("433"), `${errorMessage}:`), stryMutAct_9fa48("434") ? {} : (stryCov_9fa48("434"), {
              message: err.message,
              stack: err.stack
            }));
            return stryMutAct_9fa48("435") ? {} : (stryCov_9fa48("435"), {
              success: stryMutAct_9fa48("436") ? true : (stryCov_9fa48("436"), false),
              error: useSecureError ? SecureErrors.OPERATION_FAILED : err.message
            });
          }
        }
      }
    };
  }
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
export function withIPCDataHandler<T, R extends unknown[]>(handler: (event: IpcMainInvokeEvent, ...args: R) => Promise<T>, errorMessage: string, defaultValue: T): (event: IpcMainInvokeEvent, ...args: R) => Promise<T> {
  if (stryMutAct_9fa48("437")) {
    {}
  } else {
    stryCov_9fa48("437");
    return async (event: IpcMainInvokeEvent, ...args: R): Promise<T> => {
      if (stryMutAct_9fa48("438")) {
        {}
      } else {
        stryCov_9fa48("438");
        try {
          if (stryMutAct_9fa48("439")) {
            {}
          } else {
            stryCov_9fa48("439");
            return await handler(event, ...args);
          }
        } catch (error) {
          if (stryMutAct_9fa48("440")) {
            {}
          } else {
            stryCov_9fa48("440");
            logger.error(stryMutAct_9fa48("441") ? `` : (stryCov_9fa48("441"), `${errorMessage}:`), error);
            return defaultValue;
          }
        }
      }
    };
  }
}

/**
 * Expands ~ to home directory and resolves relative paths.
 *
 * @param filePath - The file path to expand
 * @param baseDir - Optional base directory for resolving relative paths
 * @returns Expanded and resolved absolute path
 */
export function expandPath(filePath: string, baseDir?: string): string {
  if (stryMutAct_9fa48("442")) {
    {}
  } else {
    stryCov_9fa48("442");
    // Expand ~ to home directory
    let expandedPath = filePath;
    if (stryMutAct_9fa48("445") ? filePath.endsWith('~/') : stryMutAct_9fa48("444") ? false : stryMutAct_9fa48("443") ? true : (stryCov_9fa48("443", "444", "445"), filePath.startsWith(stryMutAct_9fa48("446") ? "" : (stryCov_9fa48("446"), '~/')))) {
      if (stryMutAct_9fa48("447")) {
        {}
      } else {
        stryCov_9fa48("447");
        expandedPath = path.join(os.homedir(), stryMutAct_9fa48("448") ? filePath : (stryCov_9fa48("448"), filePath.slice(2)));
      }
    } else if (stryMutAct_9fa48("451") ? filePath !== '~' : stryMutAct_9fa48("450") ? false : stryMutAct_9fa48("449") ? true : (stryCov_9fa48("449", "450", "451"), filePath === (stryMutAct_9fa48("452") ? "" : (stryCov_9fa48("452"), '~')))) {
      if (stryMutAct_9fa48("453")) {
        {}
      } else {
        stryCov_9fa48("453");
        expandedPath = os.homedir();
      }
    }

    // Convert to absolute path if relative
    if (stryMutAct_9fa48("455") ? false : stryMutAct_9fa48("454") ? true : (stryCov_9fa48("454", "455"), path.isAbsolute(expandedPath))) {
      if (stryMutAct_9fa48("456")) {
        {}
      } else {
        stryCov_9fa48("456");
        return expandedPath;
      }
    } else {
      if (stryMutAct_9fa48("457")) {
        {}
      } else {
        stryCov_9fa48("457");
        // Use baseDir if provided, otherwise fallback to process.cwd()
        const base = stryMutAct_9fa48("460") ? baseDir && process.cwd() : stryMutAct_9fa48("459") ? false : stryMutAct_9fa48("458") ? true : (stryCov_9fa48("458", "459", "460"), baseDir || process.cwd());
        return path.join(base, expandedPath);
      }
    }
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
  if (stryMutAct_9fa48("461")) {
    {}
  } else {
    stryCov_9fa48("461");
    const absolutePath = expandPath(filePath, baseDir);
    const normalizedPath = path.normalize(absolutePath);

    // If baseDir is provided, validate that the normalized path stays within it
    if (stryMutAct_9fa48("463") ? false : stryMutAct_9fa48("462") ? true : (stryCov_9fa48("462", "463"), baseDir)) {
      if (stryMutAct_9fa48("464")) {
        {}
      } else {
        stryCov_9fa48("464");
        const normalizedBase = path.normalize(baseDir);
        if (stryMutAct_9fa48("467") ? false : stryMutAct_9fa48("466") ? true : stryMutAct_9fa48("465") ? normalizedPath.startsWith(normalizedBase) : (stryCov_9fa48("465", "466", "467"), !(stryMutAct_9fa48("468") ? normalizedPath.endsWith(normalizedBase) : (stryCov_9fa48("468"), normalizedPath.startsWith(normalizedBase))))) {
          if (stryMutAct_9fa48("469")) {
            {}
          } else {
            stryCov_9fa48("469");
            logger.error(stryMutAct_9fa48("470") ? "" : (stryCov_9fa48("470"), 'Attempted path traversal detected'), stryMutAct_9fa48("471") ? {} : (stryCov_9fa48("471"), {
              filePath,
              baseDir,
              normalizedPath,
              timestamp: Date.now()
            }));
            throw new Error(stryMutAct_9fa48("472") ? "" : (stryCov_9fa48("472"), 'Invalid file path - path traversal detected'));
          }
        }
      }
    }
    return normalizedPath;
  }
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
  if (stryMutAct_9fa48("473")) {
    {}
  } else {
    stryCov_9fa48("473");
    if (stryMutAct_9fa48("476") ? !id && typeof id !== 'string' : stryMutAct_9fa48("475") ? false : stryMutAct_9fa48("474") ? true : (stryCov_9fa48("474", "475", "476"), (stryMutAct_9fa48("477") ? id : (stryCov_9fa48("477"), !id)) || (stryMutAct_9fa48("479") ? typeof id === 'string' : stryMutAct_9fa48("478") ? false : (stryCov_9fa48("478", "479"), typeof id !== (stryMutAct_9fa48("480") ? "" : (stryCov_9fa48("480"), 'string')))))) {
      if (stryMutAct_9fa48("481")) {
        {}
      } else {
        stryCov_9fa48("481");
        return stryMutAct_9fa48("482") ? true : (stryCov_9fa48("482"), false);
      }
    }
    if (stryMutAct_9fa48("485") ? false : stryMutAct_9fa48("484") ? true : stryMutAct_9fa48("483") ? id.match(/^[a-z0-9]+$/) : (stryCov_9fa48("483", "484", "485"), !id.match(stryMutAct_9fa48("489") ? /^[^a-z0-9]+$/ : stryMutAct_9fa48("488") ? /^[a-z0-9]$/ : stryMutAct_9fa48("487") ? /^[a-z0-9]+/ : stryMutAct_9fa48("486") ? /[a-z0-9]+$/ : (stryCov_9fa48("486", "487", "488", "489"), /^[a-z0-9]+$/)))) {
      if (stryMutAct_9fa48("490")) {
        {}
      } else {
        stryCov_9fa48("490");
        return stryMutAct_9fa48("491") ? true : (stryCov_9fa48("491"), false);
      }
    }
    if (stryMutAct_9fa48("495") ? id.length <= VALIDATION.MAX_ID_LENGTH : stryMutAct_9fa48("494") ? id.length >= VALIDATION.MAX_ID_LENGTH : stryMutAct_9fa48("493") ? false : stryMutAct_9fa48("492") ? true : (stryCov_9fa48("492", "493", "494", "495"), id.length > VALIDATION.MAX_ID_LENGTH)) {
      if (stryMutAct_9fa48("496")) {
        {}
      } else {
        stryCov_9fa48("496");
        return stryMutAct_9fa48("497") ? true : (stryCov_9fa48("497"), false);
      }
    }
    return stryMutAct_9fa48("498") ? false : (stryCov_9fa48("498"), true);
  }
}

/**
 * Updates MdSearchLoader configuration from user settings.
 *
 * @param loader - The MdSearchLoader instance to update
 * @param settings - User settings containing mdSearch configuration
 */
export function updateMdSearchConfig(loader: MdSearchLoader, settings: UserSettings): void {
  if (stryMutAct_9fa48("499")) {
    {}
  } else {
    stryCov_9fa48("499");
    if (stryMutAct_9fa48("501") ? false : stryMutAct_9fa48("500") ? true : (stryCov_9fa48("500", "501"), settings.mdSearch)) {
      if (stryMutAct_9fa48("502")) {
        {}
      } else {
        stryCov_9fa48("502");
        loader.updateConfig(settings.mdSearch);
        logger.info(stryMutAct_9fa48("503") ? "" : (stryCov_9fa48("503"), 'MdSearch config updated from settings'));
      }
    }
  }
}