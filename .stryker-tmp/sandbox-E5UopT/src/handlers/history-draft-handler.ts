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
import type Electron from 'electron';
import { IpcMainInvokeEvent } from 'electron';
import { logger, SecureErrors } from '../utils/utils';
import type DraftManager from '../managers/draft-manager';
import type DirectoryManager from '../managers/directory-manager';
import type { HistoryItem, IHistoryManager } from '../types';
import { VALIDATION } from '../constants';
import type { IPCResult } from './handler-utils';

/**
 * HistoryDraftHandler manages all IPC communication related to history and draft operations.
 *
 * This handler provides a clean separation of concerns by isolating history and draft
 * related IPC channels from other application handlers.
 */
class HistoryDraftHandler {
  private historyManager: IHistoryManager;
  private draftManager: DraftManager;
  private directoryManager: DirectoryManager;
  constructor(historyManager: IHistoryManager, draftManager: DraftManager, directoryManager: DirectoryManager) {
    if (stryMutAct_9fa48("504")) {
      {}
    } else {
      stryCov_9fa48("504");
      this.historyManager = historyManager;
      this.draftManager = draftManager;
      this.directoryManager = directoryManager;
    }
  }

  /**
   * Registers all history and draft related IPC handlers
   */
  setupHandlers(ipcMain: Electron.IpcMain): void {
    if (stryMutAct_9fa48("505")) {
      {}
    } else {
      stryCov_9fa48("505");
      // History handlers
      ipcMain.handle(stryMutAct_9fa48("506") ? "" : (stryCov_9fa48("506"), 'get-history'), this.handleGetHistory.bind(this));
      ipcMain.handle(stryMutAct_9fa48("507") ? "" : (stryCov_9fa48("507"), 'clear-history'), this.handleClearHistory.bind(this));
      ipcMain.handle(stryMutAct_9fa48("508") ? "" : (stryCov_9fa48("508"), 'remove-history-item'), this.handleRemoveHistoryItem.bind(this));
      ipcMain.handle(stryMutAct_9fa48("509") ? "" : (stryCov_9fa48("509"), 'search-history'), this.handleSearchHistory.bind(this));

      // Draft handlers
      ipcMain.handle(stryMutAct_9fa48("510") ? "" : (stryCov_9fa48("510"), 'save-draft'), this.handleSaveDraft.bind(this));
      ipcMain.handle(stryMutAct_9fa48("511") ? "" : (stryCov_9fa48("511"), 'clear-draft'), this.handleClearDraft.bind(this));
      ipcMain.handle(stryMutAct_9fa48("512") ? "" : (stryCov_9fa48("512"), 'get-draft'), this.handleGetDraft.bind(this));
      ipcMain.handle(stryMutAct_9fa48("513") ? "" : (stryCov_9fa48("513"), 'set-draft-directory'), this.handleSetDraftDirectory.bind(this));
      ipcMain.handle(stryMutAct_9fa48("514") ? "" : (stryCov_9fa48("514"), 'get-draft-directory'), this.handleGetDraftDirectory.bind(this));
      logger.info(stryMutAct_9fa48("515") ? "" : (stryCov_9fa48("515"), 'History and Draft IPC handlers set up successfully'));
    }
  }

  /**
   * Removes all history and draft related IPC handlers
   */
  removeHandlers(ipcMain: Electron.IpcMain): void {
    if (stryMutAct_9fa48("516")) {
      {}
    } else {
      stryCov_9fa48("516");
      const handlers = stryMutAct_9fa48("517") ? [] : (stryCov_9fa48("517"), [stryMutAct_9fa48("518") ? "" : (stryCov_9fa48("518"), 'get-history'), stryMutAct_9fa48("519") ? "" : (stryCov_9fa48("519"), 'clear-history'), stryMutAct_9fa48("520") ? "" : (stryCov_9fa48("520"), 'remove-history-item'), stryMutAct_9fa48("521") ? "" : (stryCov_9fa48("521"), 'search-history'), stryMutAct_9fa48("522") ? "" : (stryCov_9fa48("522"), 'save-draft'), stryMutAct_9fa48("523") ? "" : (stryCov_9fa48("523"), 'clear-draft'), stryMutAct_9fa48("524") ? "" : (stryCov_9fa48("524"), 'get-draft'), stryMutAct_9fa48("525") ? "" : (stryCov_9fa48("525"), 'set-draft-directory'), stryMutAct_9fa48("526") ? "" : (stryCov_9fa48("526"), 'get-draft-directory')]);
      handlers.forEach(handler => {
        if (stryMutAct_9fa48("527")) {
          {}
        } else {
          stryCov_9fa48("527");
          ipcMain.removeAllListeners(handler);
        }
      });
      logger.info(stryMutAct_9fa48("528") ? "" : (stryCov_9fa48("528"), 'History and Draft IPC handlers removed'));
    }
  }

  // History handlers

  private async handleGetHistory(_event: IpcMainInvokeEvent): Promise<HistoryItem[]> {
    if (stryMutAct_9fa48("529")) {
      {}
    } else {
      stryCov_9fa48("529");
      try {
        if (stryMutAct_9fa48("530")) {
          {}
        } else {
          stryCov_9fa48("530");
          const history = await this.historyManager.getHistory();
          logger.debug(stryMutAct_9fa48("531") ? "" : (stryCov_9fa48("531"), 'History requested'), stryMutAct_9fa48("532") ? {} : (stryCov_9fa48("532"), {
            count: history.length
          }));
          return history;
        }
      } catch (error) {
        if (stryMutAct_9fa48("533")) {
          {}
        } else {
          stryCov_9fa48("533");
          logger.error(stryMutAct_9fa48("534") ? "" : (stryCov_9fa48("534"), 'Failed to get history:'), error);
          return stryMutAct_9fa48("535") ? ["Stryker was here"] : (stryCov_9fa48("535"), []);
        }
      }
    }
  }
  private async handleClearHistory(_event: IpcMainInvokeEvent): Promise<IPCResult> {
    if (stryMutAct_9fa48("536")) {
      {}
    } else {
      stryCov_9fa48("536");
      try {
        if (stryMutAct_9fa48("537")) {
          {}
        } else {
          stryCov_9fa48("537");
          await this.historyManager.clearHistory();
          logger.info(stryMutAct_9fa48("538") ? "" : (stryCov_9fa48("538"), 'History cleared via IPC'));
          return stryMutAct_9fa48("539") ? {} : (stryCov_9fa48("539"), {
            success: stryMutAct_9fa48("540") ? false : (stryCov_9fa48("540"), true)
          });
        }
      } catch (error) {
        if (stryMutAct_9fa48("541")) {
          {}
        } else {
          stryCov_9fa48("541");
          const err = error as Error;
          logger.error(stryMutAct_9fa48("542") ? "" : (stryCov_9fa48("542"), 'Failed to clear history:'), stryMutAct_9fa48("543") ? {} : (stryCov_9fa48("543"), {
            message: err.message,
            stack: err.stack
          }));
          return stryMutAct_9fa48("544") ? {} : (stryCov_9fa48("544"), {
            success: stryMutAct_9fa48("545") ? true : (stryCov_9fa48("545"), false),
            error: SecureErrors.OPERATION_FAILED
          });
        }
      }
    }
  }
  private async handleRemoveHistoryItem(_event: IpcMainInvokeEvent, id: string): Promise<IPCResult> {
    if (stryMutAct_9fa48("546")) {
      {}
    } else {
      stryCov_9fa48("546");
      try {
        if (stryMutAct_9fa48("547")) {
          {}
        } else {
          stryCov_9fa48("547");
          // Validate ID format (must match generateId() output: lowercase alphanumeric)
          // NOTE: This regex is coupled with utils.generateId() - update both if ID format changes
          if (stryMutAct_9fa48("550") ? (!id || typeof id !== 'string' || !id.match(/^[a-z0-9]+$/)) && id.length > VALIDATION.MAX_ID_LENGTH : stryMutAct_9fa48("549") ? false : stryMutAct_9fa48("548") ? true : (stryCov_9fa48("548", "549", "550"), (stryMutAct_9fa48("552") ? (!id || typeof id !== 'string') && !id.match(/^[a-z0-9]+$/) : stryMutAct_9fa48("551") ? false : (stryCov_9fa48("551", "552"), (stryMutAct_9fa48("554") ? !id && typeof id !== 'string' : stryMutAct_9fa48("553") ? false : (stryCov_9fa48("553", "554"), (stryMutAct_9fa48("555") ? id : (stryCov_9fa48("555"), !id)) || (stryMutAct_9fa48("557") ? typeof id === 'string' : stryMutAct_9fa48("556") ? false : (stryCov_9fa48("556", "557"), typeof id !== (stryMutAct_9fa48("558") ? "" : (stryCov_9fa48("558"), 'string')))))) || (stryMutAct_9fa48("559") ? id.match(/^[a-z0-9]+$/) : (stryCov_9fa48("559"), !id.match(stryMutAct_9fa48("563") ? /^[^a-z0-9]+$/ : stryMutAct_9fa48("562") ? /^[a-z0-9]$/ : stryMutAct_9fa48("561") ? /^[a-z0-9]+/ : stryMutAct_9fa48("560") ? /[a-z0-9]+$/ : (stryCov_9fa48("560", "561", "562", "563"), /^[a-z0-9]+$/)))))) || (stryMutAct_9fa48("566") ? id.length <= VALIDATION.MAX_ID_LENGTH : stryMutAct_9fa48("565") ? id.length >= VALIDATION.MAX_ID_LENGTH : stryMutAct_9fa48("564") ? false : (stryCov_9fa48("564", "565", "566"), id.length > VALIDATION.MAX_ID_LENGTH)))) {
            if (stryMutAct_9fa48("567")) {
              {}
            } else {
              stryCov_9fa48("567");
              logger.warn(stryMutAct_9fa48("568") ? "" : (stryCov_9fa48("568"), 'Invalid history item ID format'), stryMutAct_9fa48("569") ? {} : (stryCov_9fa48("569"), {
                id
              }));
              return stryMutAct_9fa48("570") ? {} : (stryCov_9fa48("570"), {
                success: stryMutAct_9fa48("571") ? true : (stryCov_9fa48("571"), false),
                error: SecureErrors.INVALID_FORMAT
              });
            }
          }
          const removed = await this.historyManager.removeHistoryItem(id);
          logger.info(stryMutAct_9fa48("572") ? "" : (stryCov_9fa48("572"), 'History item removal requested'), stryMutAct_9fa48("573") ? {} : (stryCov_9fa48("573"), {
            id,
            removed
          }));
          return stryMutAct_9fa48("574") ? {} : (stryCov_9fa48("574"), {
            success: removed
          });
        }
      } catch (error) {
        if (stryMutAct_9fa48("575")) {
          {}
        } else {
          stryCov_9fa48("575");
          const err = error as Error;
          logger.error(stryMutAct_9fa48("576") ? "" : (stryCov_9fa48("576"), 'Failed to remove history item:'), stryMutAct_9fa48("577") ? {} : (stryCov_9fa48("577"), {
            message: err.message,
            stack: err.stack
          }));
          return stryMutAct_9fa48("578") ? {} : (stryCov_9fa48("578"), {
            success: stryMutAct_9fa48("579") ? true : (stryCov_9fa48("579"), false),
            error: SecureErrors.OPERATION_FAILED
          });
        }
      }
    }
  }
  private async handleSearchHistory(_event: IpcMainInvokeEvent, query: string, limit = 10): Promise<HistoryItem[]> {
    if (stryMutAct_9fa48("580")) {
      {}
    } else {
      stryCov_9fa48("580");
      try {
        if (stryMutAct_9fa48("581")) {
          {}
        } else {
          stryCov_9fa48("581");
          const results = await this.historyManager.searchHistory(query, limit);
          logger.debug(stryMutAct_9fa48("582") ? "" : (stryCov_9fa48("582"), 'History search requested'), stryMutAct_9fa48("583") ? {} : (stryCov_9fa48("583"), {
            query,
            results: results.length
          }));
          return results;
        }
      } catch (error) {
        if (stryMutAct_9fa48("584")) {
          {}
        } else {
          stryCov_9fa48("584");
          logger.error(stryMutAct_9fa48("585") ? "" : (stryCov_9fa48("585"), 'Failed to search history:'), error);
          return stryMutAct_9fa48("586") ? ["Stryker was here"] : (stryCov_9fa48("586"), []);
        }
      }
    }
  }

  // Draft handlers

  private async handleSaveDraft(_event: IpcMainInvokeEvent, text: string, immediate = stryMutAct_9fa48("587") ? true : (stryCov_9fa48("587"), false)): Promise<IPCResult> {
    if (stryMutAct_9fa48("588")) {
      {}
    } else {
      stryCov_9fa48("588");
      try {
        if (stryMutAct_9fa48("589")) {
          {}
        } else {
          stryCov_9fa48("589");
          if (stryMutAct_9fa48("591") ? false : stryMutAct_9fa48("590") ? true : (stryCov_9fa48("590", "591"), immediate)) {
            if (stryMutAct_9fa48("592")) {
              {}
            } else {
              stryCov_9fa48("592");
              await this.draftManager.saveDraftImmediately(text);
            }
          } else {
            if (stryMutAct_9fa48("593")) {
              {}
            } else {
              stryCov_9fa48("593");
              await this.draftManager.saveDraft(text);
            }
          }
          logger.debug(stryMutAct_9fa48("594") ? "" : (stryCov_9fa48("594"), 'Draft save requested'), stryMutAct_9fa48("595") ? {} : (stryCov_9fa48("595"), {
            length: text.length,
            immediate
          }));
          return stryMutAct_9fa48("596") ? {} : (stryCov_9fa48("596"), {
            success: stryMutAct_9fa48("597") ? false : (stryCov_9fa48("597"), true)
          });
        }
      } catch (error) {
        if (stryMutAct_9fa48("598")) {
          {}
        } else {
          stryCov_9fa48("598");
          const err = error as Error;
          logger.error(stryMutAct_9fa48("599") ? "" : (stryCov_9fa48("599"), 'Failed to save draft:'), stryMutAct_9fa48("600") ? {} : (stryCov_9fa48("600"), {
            message: err.message,
            stack: err.stack
          }));
          return stryMutAct_9fa48("601") ? {} : (stryCov_9fa48("601"), {
            success: stryMutAct_9fa48("602") ? true : (stryCov_9fa48("602"), false),
            error: SecureErrors.OPERATION_FAILED
          });
        }
      }
    }
  }
  private async handleClearDraft(_event: IpcMainInvokeEvent): Promise<IPCResult> {
    if (stryMutAct_9fa48("603")) {
      {}
    } else {
      stryCov_9fa48("603");
      try {
        if (stryMutAct_9fa48("604")) {
          {}
        } else {
          stryCov_9fa48("604");
          await this.draftManager.clearDraft();
          logger.info(stryMutAct_9fa48("605") ? "" : (stryCov_9fa48("605"), 'Draft cleared via IPC'));
          return stryMutAct_9fa48("606") ? {} : (stryCov_9fa48("606"), {
            success: stryMutAct_9fa48("607") ? false : (stryCov_9fa48("607"), true)
          });
        }
      } catch (error) {
        if (stryMutAct_9fa48("608")) {
          {}
        } else {
          stryCov_9fa48("608");
          const err = error as Error;
          logger.error(stryMutAct_9fa48("609") ? "" : (stryCov_9fa48("609"), 'Failed to clear draft:'), stryMutAct_9fa48("610") ? {} : (stryCov_9fa48("610"), {
            message: err.message,
            stack: err.stack
          }));
          return stryMutAct_9fa48("611") ? {} : (stryCov_9fa48("611"), {
            success: stryMutAct_9fa48("612") ? true : (stryCov_9fa48("612"), false),
            error: SecureErrors.OPERATION_FAILED
          });
        }
      }
    }
  }
  private async handleGetDraft(_event: IpcMainInvokeEvent): Promise<string> {
    if (stryMutAct_9fa48("613")) {
      {}
    } else {
      stryCov_9fa48("613");
      try {
        if (stryMutAct_9fa48("614")) {
          {}
        } else {
          stryCov_9fa48("614");
          const draft = this.draftManager.getCurrentDraft();
          logger.debug(stryMutAct_9fa48("615") ? "" : (stryCov_9fa48("615"), 'Draft requested'), stryMutAct_9fa48("616") ? {} : (stryCov_9fa48("616"), {
            length: draft.length
          }));
          return draft;
        }
      } catch (error) {
        if (stryMutAct_9fa48("617")) {
          {}
        } else {
          stryCov_9fa48("617");
          logger.error(stryMutAct_9fa48("618") ? "" : (stryCov_9fa48("618"), 'Failed to get draft:'), error);
          return stryMutAct_9fa48("619") ? "Stryker was here!" : (stryCov_9fa48("619"), '');
        }
      }
    }
  }
  private async handleSetDraftDirectory(_event: IpcMainInvokeEvent, directory: string | null): Promise<IPCResult> {
    if (stryMutAct_9fa48("620")) {
      {}
    } else {
      stryCov_9fa48("620");
      try {
        if (stryMutAct_9fa48("621")) {
          {}
        } else {
          stryCov_9fa48("621");
          if (stryMutAct_9fa48("623") ? false : stryMutAct_9fa48("622") ? true : (stryCov_9fa48("622", "623"), directory)) {
            if (stryMutAct_9fa48("624")) {
              {}
            } else {
              stryCov_9fa48("624");
              await this.directoryManager.saveDirectory(directory);
            }
          } else {
            if (stryMutAct_9fa48("625")) {
              {}
            } else {
              stryCov_9fa48("625");
              this.directoryManager.setDirectory(null);
            }
          }
          logger.debug(stryMutAct_9fa48("626") ? "" : (stryCov_9fa48("626"), 'Directory set via IPC'), stryMutAct_9fa48("627") ? {} : (stryCov_9fa48("627"), {
            directory
          }));
          return stryMutAct_9fa48("628") ? {} : (stryCov_9fa48("628"), {
            success: stryMutAct_9fa48("629") ? false : (stryCov_9fa48("629"), true)
          });
        }
      } catch (error) {
        if (stryMutAct_9fa48("630")) {
          {}
        } else {
          stryCov_9fa48("630");
          logger.error(stryMutAct_9fa48("631") ? "" : (stryCov_9fa48("631"), 'Failed to set directory:'), error);
          return stryMutAct_9fa48("632") ? {} : (stryCov_9fa48("632"), {
            success: stryMutAct_9fa48("633") ? true : (stryCov_9fa48("633"), false),
            error: (error as Error).message
          });
        }
      }
    }
  }
  private async handleGetDraftDirectory(_event: IpcMainInvokeEvent): Promise<string | null> {
    if (stryMutAct_9fa48("634")) {
      {}
    } else {
      stryCov_9fa48("634");
      try {
        if (stryMutAct_9fa48("635")) {
          {}
        } else {
          stryCov_9fa48("635");
          const directory = this.directoryManager.getDirectory();
          logger.debug(stryMutAct_9fa48("636") ? "" : (stryCov_9fa48("636"), 'Directory requested'), stryMutAct_9fa48("637") ? {} : (stryCov_9fa48("637"), {
            directory
          }));
          return directory;
        }
      } catch (error) {
        if (stryMutAct_9fa48("638")) {
          {}
        } else {
          stryCov_9fa48("638");
          logger.error(stryMutAct_9fa48("639") ? "" : (stryCov_9fa48("639"), 'Failed to get directory:'), error);
          return null;
        }
      }
    }
  }
}
export default HistoryDraftHandler;