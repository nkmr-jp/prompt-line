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
import { IpcMainInvokeEvent, shell } from 'electron';
import config from '../config/app-config';
import { logger } from '../utils/utils';
import type SettingsManager from '../managers/settings-manager';
interface IPCResult {
  success: boolean;
  error?: string;
}
interface AppInfoResult {
  name: string;
  version: string;
  description: string;
  platform: string;
  electronVersion?: string;
  nodeVersion?: string;
  isDevelopment: boolean;
}
interface ConfigData {
  shortcuts: Record<string, string>;
  history: Record<string, unknown>;
  draft: Record<string, unknown>;
  timing: Record<string, unknown>;
  app: Record<string, unknown>;
  platform: Record<string, unknown>;
  [key: string]: unknown;
}

// Constants
const VALID_CONFIG_SECTIONS = stryMutAct_9fa48("975") ? [] : (stryCov_9fa48("975"), [stryMutAct_9fa48("976") ? "" : (stryCov_9fa48("976"), 'shortcuts'), stryMutAct_9fa48("977") ? "" : (stryCov_9fa48("977"), 'history'), stryMutAct_9fa48("978") ? "" : (stryCov_9fa48("978"), 'draft'), stryMutAct_9fa48("979") ? "" : (stryCov_9fa48("979"), 'timing'), stryMutAct_9fa48("980") ? "" : (stryCov_9fa48("980"), 'app'), stryMutAct_9fa48("981") ? "" : (stryCov_9fa48("981"), 'platform')]);
class SystemHandler {
  private settingsManager: SettingsManager;
  constructor(settingsManager: SettingsManager) {
    if (stryMutAct_9fa48("982")) {
      {}
    } else {
      stryCov_9fa48("982");
      this.settingsManager = settingsManager;
    }
  }
  setupHandlers(ipcMain: typeof import('electron').ipcMain): void {
    if (stryMutAct_9fa48("983")) {
      {}
    } else {
      stryCov_9fa48("983");
      ipcMain.handle(stryMutAct_9fa48("984") ? "" : (stryCov_9fa48("984"), 'get-app-info'), this.handleGetAppInfo.bind(this));
      ipcMain.handle(stryMutAct_9fa48("985") ? "" : (stryCov_9fa48("985"), 'get-config'), this.handleGetConfig.bind(this));
      ipcMain.handle(stryMutAct_9fa48("986") ? "" : (stryCov_9fa48("986"), 'open-settings'), this.handleOpenSettings.bind(this));
      ipcMain.handle(stryMutAct_9fa48("987") ? "" : (stryCov_9fa48("987"), 'get-file-search-max-suggestions'), this.handleGetFileSearchMaxSuggestions.bind(this));
      logger.info(stryMutAct_9fa48("988") ? "" : (stryCov_9fa48("988"), 'System IPC handlers set up successfully'));
    }
  }
  removeHandlers(ipcMain: typeof import('electron').ipcMain): void {
    if (stryMutAct_9fa48("989")) {
      {}
    } else {
      stryCov_9fa48("989");
      const handlers = stryMutAct_9fa48("990") ? [] : (stryCov_9fa48("990"), [stryMutAct_9fa48("991") ? "" : (stryCov_9fa48("991"), 'get-app-info'), stryMutAct_9fa48("992") ? "" : (stryCov_9fa48("992"), 'get-config'), stryMutAct_9fa48("993") ? "" : (stryCov_9fa48("993"), 'open-settings'), stryMutAct_9fa48("994") ? "" : (stryCov_9fa48("994"), 'get-file-search-max-suggestions')]);
      handlers.forEach(handler => {
        if (stryMutAct_9fa48("995")) {
          {}
        } else {
          stryCov_9fa48("995");
          ipcMain.removeAllListeners(handler);
        }
      });
      logger.info(stryMutAct_9fa48("996") ? "" : (stryCov_9fa48("996"), 'System IPC handlers removed'));
    }
  }
  private async handleGetAppInfo(_event: IpcMainInvokeEvent): Promise<AppInfoResult | {}> {
    if (stryMutAct_9fa48("997")) {
      {}
    } else {
      stryCov_9fa48("997");
      try {
        if (stryMutAct_9fa48("998")) {
          {}
        } else {
          stryCov_9fa48("998");
          const appInfo: AppInfoResult = stryMutAct_9fa48("999") ? {} : (stryCov_9fa48("999"), {
            name: config.app.name,
            version: config.app.version,
            description: config.app.description,
            platform: process.platform,
            electronVersion: process.versions.electron,
            nodeVersion: process.versions.node,
            isDevelopment: config.isDevelopment()
          });
          logger.debug(stryMutAct_9fa48("1000") ? "" : (stryCov_9fa48("1000"), 'App info requested'));
          return appInfo;
        }
      } catch (error) {
        if (stryMutAct_9fa48("1001")) {
          {}
        } else {
          stryCov_9fa48("1001");
          logger.error(stryMutAct_9fa48("1002") ? "" : (stryCov_9fa48("1002"), 'Failed to get app info:'), error);
          return {};
        }
      }
    }
  }
  private async handleGetConfig(_event: IpcMainInvokeEvent, section: string | null = null): Promise<ConfigData | Record<string, unknown> | {}> {
    if (stryMutAct_9fa48("1003")) {
      {}
    } else {
      stryCov_9fa48("1003");
      try {
        if (stryMutAct_9fa48("1004")) {
          {}
        } else {
          stryCov_9fa48("1004");
          if (stryMutAct_9fa48("1006") ? false : stryMutAct_9fa48("1005") ? true : (stryCov_9fa48("1005", "1006"), section)) {
            if (stryMutAct_9fa48("1007")) {
              {}
            } else {
              stryCov_9fa48("1007");
              // セクション名の型検証を強化
              if (stryMutAct_9fa48("1010") ? typeof section === 'string' : stryMutAct_9fa48("1009") ? false : stryMutAct_9fa48("1008") ? true : (stryCov_9fa48("1008", "1009", "1010"), typeof section !== (stryMutAct_9fa48("1011") ? "" : (stryCov_9fa48("1011"), 'string')))) {
                if (stryMutAct_9fa48("1012")) {
                  {}
                } else {
                  stryCov_9fa48("1012");
                  logger.warn(stryMutAct_9fa48("1013") ? "" : (stryCov_9fa48("1013"), 'Invalid config section type'), stryMutAct_9fa48("1014") ? {} : (stryCov_9fa48("1014"), {
                    type: typeof section
                  }));
                  return {};
                }
              }

              // Validate section name against whitelist
              if (stryMutAct_9fa48("1017") ? false : stryMutAct_9fa48("1016") ? true : stryMutAct_9fa48("1015") ? VALID_CONFIG_SECTIONS.includes(section) : (stryCov_9fa48("1015", "1016", "1017"), !VALID_CONFIG_SECTIONS.includes(section))) {
                if (stryMutAct_9fa48("1018")) {
                  {}
                } else {
                  stryCov_9fa48("1018");
                  logger.warn(stryMutAct_9fa48("1019") ? "" : (stryCov_9fa48("1019"), 'Invalid config section requested'), stryMutAct_9fa48("1020") ? {} : (stryCov_9fa48("1020"), {
                    section
                  }));
                  return {};
                }
              }
              try {
                if (stryMutAct_9fa48("1021")) {
                  {}
                } else {
                  stryCov_9fa48("1021");
                  const configData = config.get(section as keyof typeof config);
                  logger.debug(stryMutAct_9fa48("1022") ? "" : (stryCov_9fa48("1022"), 'Config section requested'), stryMutAct_9fa48("1023") ? {} : (stryCov_9fa48("1023"), {
                    section
                  }));
                  return stryMutAct_9fa48("1026") ? configData && {} : stryMutAct_9fa48("1025") ? false : stryMutAct_9fa48("1024") ? true : (stryCov_9fa48("1024", "1025", "1026"), configData || {});
                }
              } catch (sectionError) {
                if (stryMutAct_9fa48("1027")) {
                  {}
                } else {
                  stryCov_9fa48("1027");
                  logger.error(stryMutAct_9fa48("1028") ? "" : (stryCov_9fa48("1028"), 'Failed to get config section:'), stryMutAct_9fa48("1029") ? {} : (stryCov_9fa48("1029"), {
                    section,
                    error: sectionError
                  }));
                  return {};
                }
              }
            }
          } else {
            if (stryMutAct_9fa48("1030")) {
              {}
            } else {
              stryCov_9fa48("1030");
              try {
                if (stryMutAct_9fa48("1031")) {
                  {}
                } else {
                  stryCov_9fa48("1031");
                  const safeConfig: ConfigData = stryMutAct_9fa48("1032") ? {} : (stryCov_9fa48("1032"), {
                    shortcuts: config.shortcuts as unknown as Record<string, string>,
                    history: config.history as unknown as Record<string, unknown>,
                    draft: config.draft as unknown as Record<string, unknown>,
                    timing: config.timing as unknown as Record<string, unknown>,
                    app: config.app as unknown as Record<string, unknown>,
                    platform: config.platform as unknown as Record<string, unknown>
                  });
                  logger.debug(stryMutAct_9fa48("1033") ? "" : (stryCov_9fa48("1033"), 'Full config requested'));
                  return safeConfig;
                }
              } catch (configError) {
                if (stryMutAct_9fa48("1034")) {
                  {}
                } else {
                  stryCov_9fa48("1034");
                  logger.error(stryMutAct_9fa48("1035") ? "" : (stryCov_9fa48("1035"), 'Failed to build full config:'), configError);
                  return {};
                }
              }
            }
          }
        }
      } catch (error) {
        if (stryMutAct_9fa48("1036")) {
          {}
        } else {
          stryCov_9fa48("1036");
          logger.error(stryMutAct_9fa48("1037") ? "" : (stryCov_9fa48("1037"), 'Failed to get config:'), error);
          return {};
        }
      }
    }
  }
  private async handleOpenSettings(_event: IpcMainInvokeEvent): Promise<IPCResult> {
    if (stryMutAct_9fa48("1038")) {
      {}
    } else {
      stryCov_9fa48("1038");
      try {
        if (stryMutAct_9fa48("1039")) {
          {}
        } else {
          stryCov_9fa48("1039");
          const settingsFilePath = this.settingsManager.getSettingsFilePath();
          logger.info(stryMutAct_9fa48("1040") ? "" : (stryCov_9fa48("1040"), 'Opening settings file:'), settingsFilePath);
          await shell.openPath(settingsFilePath);
          return stryMutAct_9fa48("1041") ? {} : (stryCov_9fa48("1041"), {
            success: stryMutAct_9fa48("1042") ? false : (stryCov_9fa48("1042"), true)
          });
        }
      } catch (error) {
        if (stryMutAct_9fa48("1043")) {
          {}
        } else {
          stryCov_9fa48("1043");
          logger.error(stryMutAct_9fa48("1044") ? "" : (stryCov_9fa48("1044"), 'Failed to open settings file:'), error);
          return stryMutAct_9fa48("1045") ? {} : (stryCov_9fa48("1045"), {
            success: stryMutAct_9fa48("1046") ? true : (stryCov_9fa48("1046"), false),
            error: (error as Error).message
          });
        }
      }
    }
  }

  /**
   * Handler: get-file-search-max-suggestions
   * Returns the maximum number of suggestions for file search
   * Default: 50
   */
  private handleGetFileSearchMaxSuggestions(_event: IpcMainInvokeEvent): number {
    if (stryMutAct_9fa48("1047")) {
      {}
    } else {
      stryCov_9fa48("1047");
      try {
        if (stryMutAct_9fa48("1048")) {
          {}
        } else {
          stryCov_9fa48("1048");
          const fileSearchSettings = this.settingsManager.getFileSearchSettings();
          const maxSuggestions = stryMutAct_9fa48("1049") ? fileSearchSettings?.maxSuggestions && 50 : (stryCov_9fa48("1049"), (stryMutAct_9fa48("1050") ? fileSearchSettings.maxSuggestions : (stryCov_9fa48("1050"), fileSearchSettings?.maxSuggestions)) ?? 50);
          logger.debug(stryMutAct_9fa48("1051") ? "" : (stryCov_9fa48("1051"), 'FileSearch maxSuggestions requested'), stryMutAct_9fa48("1052") ? {} : (stryCov_9fa48("1052"), {
            maxSuggestions
          }));
          return maxSuggestions;
        }
      } catch (error) {
        if (stryMutAct_9fa48("1053")) {
          {}
        } else {
          stryCov_9fa48("1053");
          logger.error(stryMutAct_9fa48("1054") ? "" : (stryCov_9fa48("1054"), 'Failed to get fileSearch maxSuggestions:'), error);
          return 50; // Default fallback
        }
      }
    }
  }
}
export default SystemHandler;