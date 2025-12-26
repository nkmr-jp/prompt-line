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
import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { logger, sleep } from '../utils/utils';
import type WindowManager from '../managers/window';
import type { WindowData } from '../types';
import config from '../config/app-config';
interface IPCResult {
  success: boolean;
  error?: string;
}

/**
 * WindowHandler manages window-related IPC communication
 * Handles show, hide, and focus operations for the input window
 */
class WindowHandler {
  private windowManager: WindowManager;
  constructor(windowManager: WindowManager) {
    if (stryMutAct_9fa48("1055")) {
      {}
    } else {
      stryCov_9fa48("1055");
      this.windowManager = windowManager;
    }
  }

  /**
   * Register all window-related IPC handlers
   */
  setupHandlers(ipcMainInstance: typeof ipcMain): void {
    if (stryMutAct_9fa48("1056")) {
      {}
    } else {
      stryCov_9fa48("1056");
      ipcMainInstance.handle(stryMutAct_9fa48("1057") ? "" : (stryCov_9fa48("1057"), 'hide-window'), this.handleHideWindow.bind(this));
      ipcMainInstance.handle(stryMutAct_9fa48("1058") ? "" : (stryCov_9fa48("1058"), 'show-window'), this.handleShowWindow.bind(this));
      ipcMainInstance.handle(stryMutAct_9fa48("1059") ? "" : (stryCov_9fa48("1059"), 'focus-window'), this.handleFocusWindow.bind(this));
      logger.info(stryMutAct_9fa48("1060") ? "" : (stryCov_9fa48("1060"), 'Window IPC handlers registered'));
    }
  }

  /**
   * Remove all window-related IPC handlers
   */
  removeHandlers(ipcMainInstance: typeof ipcMain): void {
    if (stryMutAct_9fa48("1061")) {
      {}
    } else {
      stryCov_9fa48("1061");
      ipcMainInstance.removeAllListeners(stryMutAct_9fa48("1062") ? "" : (stryCov_9fa48("1062"), 'hide-window'));
      ipcMainInstance.removeAllListeners(stryMutAct_9fa48("1063") ? "" : (stryCov_9fa48("1063"), 'show-window'));
      ipcMainInstance.removeAllListeners(stryMutAct_9fa48("1064") ? "" : (stryCov_9fa48("1064"), 'focus-window'));
      logger.info(stryMutAct_9fa48("1065") ? "" : (stryCov_9fa48("1065"), 'Window IPC handlers removed'));
    }
  }
  private async handleHideWindow(_event: IpcMainInvokeEvent, restoreFocus: boolean = stryMutAct_9fa48("1066") ? false : (stryCov_9fa48("1066"), true)): Promise<IPCResult> {
    if (stryMutAct_9fa48("1067")) {
      {}
    } else {
      stryCov_9fa48("1067");
      try {
        if (stryMutAct_9fa48("1068")) {
          {}
        } else {
          stryCov_9fa48("1068");
          logger.debug(stryMutAct_9fa48("1069") ? "" : (stryCov_9fa48("1069"), 'Window hide requested, restoreFocus:'), restoreFocus);
          await this.windowManager.hideInputWindow();

          // Focus the previous app when hiding the window (only if restoreFocus is true)
          if (stryMutAct_9fa48("1072") ? config.platform.isMac || restoreFocus : stryMutAct_9fa48("1071") ? false : stryMutAct_9fa48("1070") ? true : (stryCov_9fa48("1070", "1071", "1072"), config.platform.isMac && restoreFocus)) {
            if (stryMutAct_9fa48("1073")) {
              {}
            } else {
              stryCov_9fa48("1073");
              try {
                if (stryMutAct_9fa48("1074")) {
                  {}
                } else {
                  stryCov_9fa48("1074");
                  // Wait for window hide animation to complete
                  await sleep(stryMutAct_9fa48("1077") ? config.timing.windowHideDelay && 150 : stryMutAct_9fa48("1076") ? false : stryMutAct_9fa48("1075") ? true : (stryCov_9fa48("1075", "1076", "1077"), config.timing.windowHideDelay || 150));

                  // Attempt to focus previous app
                  const focusSuccess = await this.windowManager.focusPreviousApp();
                  if (stryMutAct_9fa48("1080") ? false : stryMutAct_9fa48("1079") ? true : stryMutAct_9fa48("1078") ? focusSuccess : (stryCov_9fa48("1078", "1079", "1080"), !focusSuccess)) {
                    if (stryMutAct_9fa48("1081")) {
                      {}
                    } else {
                      stryCov_9fa48("1081");
                      logger.warn(stryMutAct_9fa48("1082") ? "" : (stryCov_9fa48("1082"), 'Failed to focus previous app via native tools - no fallback available for security reasons'));
                    }
                  } else {
                    if (stryMutAct_9fa48("1083")) {
                      {}
                    } else {
                      stryCov_9fa48("1083");
                      logger.debug(stryMutAct_9fa48("1084") ? "" : (stryCov_9fa48("1084"), 'Successfully focused previous app'));
                    }
                  }
                }
              } catch (focusError) {
                if (stryMutAct_9fa48("1085")) {
                  {}
                } else {
                  stryCov_9fa48("1085");
                  // Log but don't fail the operation if focus fails
                  logger.warn(stryMutAct_9fa48("1086") ? "" : (stryCov_9fa48("1086"), 'Failed to focus previous app:'), focusError);
                }
              }
            }
          }
          return stryMutAct_9fa48("1087") ? {} : (stryCov_9fa48("1087"), {
            success: stryMutAct_9fa48("1088") ? false : (stryCov_9fa48("1088"), true)
          });
        }
      } catch (error) {
        if (stryMutAct_9fa48("1089")) {
          {}
        } else {
          stryCov_9fa48("1089");
          logger.error(stryMutAct_9fa48("1090") ? "" : (stryCov_9fa48("1090"), 'Failed to hide window:'), error);
          return stryMutAct_9fa48("1091") ? {} : (stryCov_9fa48("1091"), {
            success: stryMutAct_9fa48("1092") ? true : (stryCov_9fa48("1092"), false),
            error: (error as Error).message
          });
        }
      }
    }
  }
  private async handleShowWindow(_event: IpcMainInvokeEvent, data: WindowData = {}): Promise<IPCResult> {
    if (stryMutAct_9fa48("1093")) {
      {}
    } else {
      stryCov_9fa48("1093");
      try {
        if (stryMutAct_9fa48("1094")) {
          {}
        } else {
          stryCov_9fa48("1094");
          await this.windowManager.showInputWindow(data);
          logger.debug(stryMutAct_9fa48("1095") ? "" : (stryCov_9fa48("1095"), 'Window show requested'));
          return stryMutAct_9fa48("1096") ? {} : (stryCov_9fa48("1096"), {
            success: stryMutAct_9fa48("1097") ? false : (stryCov_9fa48("1097"), true)
          });
        }
      } catch (error) {
        if (stryMutAct_9fa48("1098")) {
          {}
        } else {
          stryCov_9fa48("1098");
          logger.error(stryMutAct_9fa48("1099") ? "" : (stryCov_9fa48("1099"), 'Failed to show window:'), error);
          return stryMutAct_9fa48("1100") ? {} : (stryCov_9fa48("1100"), {
            success: stryMutAct_9fa48("1101") ? true : (stryCov_9fa48("1101"), false),
            error: (error as Error).message
          });
        }
      }
    }
  }
  private async handleFocusWindow(_event: IpcMainInvokeEvent): Promise<IPCResult> {
    if (stryMutAct_9fa48("1102")) {
      {}
    } else {
      stryCov_9fa48("1102");
      try {
        if (stryMutAct_9fa48("1103")) {
          {}
        } else {
          stryCov_9fa48("1103");
          this.windowManager.focusWindow();
          logger.debug(stryMutAct_9fa48("1104") ? "" : (stryCov_9fa48("1104"), 'Window focus requested'));
          return stryMutAct_9fa48("1105") ? {} : (stryCov_9fa48("1105"), {
            success: stryMutAct_9fa48("1106") ? false : (stryCov_9fa48("1106"), true)
          });
        }
      } catch (error) {
        if (stryMutAct_9fa48("1107")) {
          {}
        } else {
          stryCov_9fa48("1107");
          logger.error(stryMutAct_9fa48("1108") ? "" : (stryCov_9fa48("1108"), 'Failed to focus window:'), error);
          return stryMutAct_9fa48("1109") ? {} : (stryCov_9fa48("1109"), {
            success: stryMutAct_9fa48("1110") ? true : (stryCov_9fa48("1110"), false),
            error: (error as Error).message
          });
        }
      }
    }
  }
}
export default WindowHandler;