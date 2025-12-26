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
import { IpcMainInvokeEvent } from 'electron';
import { logger } from '../utils/utils';
import type MdSearchLoader from '../managers/md-search-loader';
import type SettingsManager from '../managers/settings-manager';
import type { SlashCommandItem, AgentItem } from '../types';

/**
 * MdSearchHandler manages all IPC handlers related to MD search functionality.
 * This includes slash commands, agents, and search configuration.
 */
class MdSearchHandler {
  private mdSearchLoader: MdSearchLoader;
  private settingsManager: SettingsManager;
  constructor(mdSearchLoader: MdSearchLoader, settingsManager: SettingsManager) {
    if (stryMutAct_9fa48("651")) {
      {}
    } else {
      stryCov_9fa48("651");
      this.mdSearchLoader = mdSearchLoader;
      this.settingsManager = settingsManager;
    }
  }

  /**
   * Register all MD search related IPC handlers
   */
  setupHandlers(ipcMain: typeof import('electron').ipcMain): void {
    if (stryMutAct_9fa48("652")) {
      {}
    } else {
      stryCov_9fa48("652");
      ipcMain.handle(stryMutAct_9fa48("653") ? "" : (stryCov_9fa48("653"), 'get-slash-commands'), this.handleGetSlashCommands.bind(this));
      ipcMain.handle(stryMutAct_9fa48("654") ? "" : (stryCov_9fa48("654"), 'get-slash-command-file-path'), this.handleGetSlashCommandFilePath.bind(this));
      ipcMain.handle(stryMutAct_9fa48("655") ? "" : (stryCov_9fa48("655"), 'get-agents'), this.handleGetAgents.bind(this));
      ipcMain.handle(stryMutAct_9fa48("656") ? "" : (stryCov_9fa48("656"), 'get-agent-file-path'), this.handleGetAgentFilePath.bind(this));
      ipcMain.handle(stryMutAct_9fa48("657") ? "" : (stryCov_9fa48("657"), 'get-md-search-max-suggestions'), this.handleGetMdSearchMaxSuggestions.bind(this));
      ipcMain.handle(stryMutAct_9fa48("658") ? "" : (stryCov_9fa48("658"), 'get-md-search-prefixes'), this.handleGetMdSearchPrefixes.bind(this));
      logger.info(stryMutAct_9fa48("659") ? "" : (stryCov_9fa48("659"), 'MdSearch IPC handlers set up successfully'));
    }
  }

  /**
   * Remove all MD search related IPC handlers
   */
  removeHandlers(ipcMain: typeof import('electron').ipcMain): void {
    if (stryMutAct_9fa48("660")) {
      {}
    } else {
      stryCov_9fa48("660");
      const handlers = stryMutAct_9fa48("661") ? [] : (stryCov_9fa48("661"), [stryMutAct_9fa48("662") ? "" : (stryCov_9fa48("662"), 'get-slash-commands'), stryMutAct_9fa48("663") ? "" : (stryCov_9fa48("663"), 'get-slash-command-file-path'), stryMutAct_9fa48("664") ? "" : (stryCov_9fa48("664"), 'get-agents'), stryMutAct_9fa48("665") ? "" : (stryCov_9fa48("665"), 'get-agent-file-path'), stryMutAct_9fa48("666") ? "" : (stryCov_9fa48("666"), 'get-md-search-max-suggestions'), stryMutAct_9fa48("667") ? "" : (stryCov_9fa48("667"), 'get-md-search-prefixes')]);
      handlers.forEach(handler => {
        if (stryMutAct_9fa48("668")) {
          {}
        } else {
          stryCov_9fa48("668");
          ipcMain.removeAllListeners(handler);
        }
      });
      logger.info(stryMutAct_9fa48("669") ? "" : (stryCov_9fa48("669"), 'MdSearch IPC handlers removed'));
    }
  }

  /**
   * Update MdSearchLoader configuration with latest settings
   */
  private updateConfig(): void {
    if (stryMutAct_9fa48("670")) {
      {}
    } else {
      stryCov_9fa48("670");
      const settings = this.settingsManager.getSettings();
      if (stryMutAct_9fa48("672") ? false : stryMutAct_9fa48("671") ? true : (stryCov_9fa48("671", "672"), settings.mdSearch)) {
        if (stryMutAct_9fa48("673")) {
          {}
        } else {
          stryCov_9fa48("673");
          this.mdSearchLoader.updateConfig(settings.mdSearch);
        }
      }
    }
  }

  /**
   * Handler: get-slash-commands
   * Retrieves slash commands with optional query filtering
   */
  private async handleGetSlashCommands(_event: IpcMainInvokeEvent, query?: string): Promise<SlashCommandItem[]> {
    if (stryMutAct_9fa48("674")) {
      {}
    } else {
      stryCov_9fa48("674");
      try {
        if (stryMutAct_9fa48("675")) {
          {}
        } else {
          stryCov_9fa48("675");
          // Refresh config from settings in case they changed
          this.updateConfig();

          // Get commands from MdSearchLoader
          const items = query ? await this.mdSearchLoader.searchItems(stryMutAct_9fa48("676") ? "" : (stryCov_9fa48("676"), 'command'), query) : await this.mdSearchLoader.getItems(stryMutAct_9fa48("677") ? "" : (stryCov_9fa48("677"), 'command'));

          // Convert MdSearchItem to SlashCommandItem for backward compatibility
          const commands: SlashCommandItem[] = items.map(item => {
            if (stryMutAct_9fa48("678")) {
              {}
            } else {
              stryCov_9fa48("678");
              const cmd: SlashCommandItem = stryMutAct_9fa48("679") ? {} : (stryCov_9fa48("679"), {
                name: item.name,
                description: item.description,
                filePath: item.filePath
              });
              if (stryMutAct_9fa48("681") ? false : stryMutAct_9fa48("680") ? true : (stryCov_9fa48("680", "681"), item.argumentHint)) {
                if (stryMutAct_9fa48("682")) {
                  {}
                } else {
                  stryCov_9fa48("682");
                  cmd.argumentHint = item.argumentHint;
                }
              }
              if (stryMutAct_9fa48("684") ? false : stryMutAct_9fa48("683") ? true : (stryCov_9fa48("683", "684"), item.frontmatter)) {
                if (stryMutAct_9fa48("685")) {
                  {}
                } else {
                  stryCov_9fa48("685");
                  cmd.frontmatter = item.frontmatter;
                }
              }
              if (stryMutAct_9fa48("687") ? false : stryMutAct_9fa48("686") ? true : (stryCov_9fa48("686", "687"), item.inputFormat)) {
                if (stryMutAct_9fa48("688")) {
                  {}
                } else {
                  stryCov_9fa48("688");
                  cmd.inputFormat = item.inputFormat;
                }
              }
              return cmd;
            }
          });
          logger.debug(stryMutAct_9fa48("689") ? "" : (stryCov_9fa48("689"), 'Slash commands requested'), stryMutAct_9fa48("690") ? {} : (stryCov_9fa48("690"), {
            query,
            count: commands.length
          }));
          return commands;
        }
      } catch (error) {
        if (stryMutAct_9fa48("691")) {
          {}
        } else {
          stryCov_9fa48("691");
          logger.error(stryMutAct_9fa48("692") ? "" : (stryCov_9fa48("692"), 'Failed to get slash commands:'), error);
          return stryMutAct_9fa48("693") ? ["Stryker was here"] : (stryCov_9fa48("693"), []);
        }
      }
    }
  }

  /**
   * Handler: get-slash-command-file-path
   * Resolves the file path for a specific slash command
   */
  private async handleGetSlashCommandFilePath(_event: IpcMainInvokeEvent, commandName: string): Promise<string | null> {
    if (stryMutAct_9fa48("694")) {
      {}
    } else {
      stryCov_9fa48("694");
      try {
        if (stryMutAct_9fa48("695")) {
          {}
        } else {
          stryCov_9fa48("695");
          if (stryMutAct_9fa48("698") ? !commandName && typeof commandName !== 'string' : stryMutAct_9fa48("697") ? false : stryMutAct_9fa48("696") ? true : (stryCov_9fa48("696", "697", "698"), (stryMutAct_9fa48("699") ? commandName : (stryCov_9fa48("699"), !commandName)) || (stryMutAct_9fa48("701") ? typeof commandName === 'string' : stryMutAct_9fa48("700") ? false : (stryCov_9fa48("700", "701"), typeof commandName !== (stryMutAct_9fa48("702") ? "" : (stryCov_9fa48("702"), 'string')))))) {
            if (stryMutAct_9fa48("703")) {
              {}
            } else {
              stryCov_9fa48("703");
              return null;
            }
          }

          // Refresh config from settings in case they changed
          this.updateConfig();
          const items = await this.mdSearchLoader.getItems(stryMutAct_9fa48("704") ? "" : (stryCov_9fa48("704"), 'command'));
          const command = items.find(stryMutAct_9fa48("705") ? () => undefined : (stryCov_9fa48("705"), c => stryMutAct_9fa48("708") ? c.name !== commandName : stryMutAct_9fa48("707") ? false : stryMutAct_9fa48("706") ? true : (stryCov_9fa48("706", "707", "708"), c.name === commandName)));
          if (stryMutAct_9fa48("710") ? false : stryMutAct_9fa48("709") ? true : (stryCov_9fa48("709", "710"), command)) {
            if (stryMutAct_9fa48("711")) {
              {}
            } else {
              stryCov_9fa48("711");
              logger.debug(stryMutAct_9fa48("712") ? "" : (stryCov_9fa48("712"), 'Slash command file path resolved'), stryMutAct_9fa48("713") ? {} : (stryCov_9fa48("713"), {
                commandName,
                filePath: command.filePath
              }));
              return command.filePath;
            }
          }
          logger.debug(stryMutAct_9fa48("714") ? "" : (stryCov_9fa48("714"), 'Slash command not found'), stryMutAct_9fa48("715") ? {} : (stryCov_9fa48("715"), {
            commandName
          }));
          return null;
        }
      } catch (error) {
        if (stryMutAct_9fa48("716")) {
          {}
        } else {
          stryCov_9fa48("716");
          logger.error(stryMutAct_9fa48("717") ? "" : (stryCov_9fa48("717"), 'Failed to get slash command file path:'), error);
          return null;
        }
      }
    }
  }

  /**
   * Handler: get-agents
   * Retrieves agents with optional query filtering
   */
  private async handleGetAgents(_event: IpcMainInvokeEvent, query?: string): Promise<AgentItem[]> {
    if (stryMutAct_9fa48("718")) {
      {}
    } else {
      stryCov_9fa48("718");
      try {
        if (stryMutAct_9fa48("719")) {
          {}
        } else {
          stryCov_9fa48("719");
          // Refresh config from settings in case they changed
          this.updateConfig();

          // Get mentions (agents) from MdSearchLoader
          // Always use searchItems to apply searchPrefix filtering, even for empty query
          const items = await this.mdSearchLoader.searchItems(stryMutAct_9fa48("720") ? "" : (stryCov_9fa48("720"), 'mention'), stryMutAct_9fa48("721") ? query && '' : (stryCov_9fa48("721"), query ?? (stryMutAct_9fa48("722") ? "Stryker was here!" : (stryCov_9fa48("722"), ''))));

          // Convert MdSearchItem to AgentItem for backward compatibility
          const agents: AgentItem[] = items.map(item => {
            if (stryMutAct_9fa48("723")) {
              {}
            } else {
              stryCov_9fa48("723");
              const agent: AgentItem = stryMutAct_9fa48("724") ? {} : (stryCov_9fa48("724"), {
                name: item.name,
                description: item.description,
                filePath: item.filePath
              });
              if (stryMutAct_9fa48("726") ? false : stryMutAct_9fa48("725") ? true : (stryCov_9fa48("725", "726"), item.frontmatter)) {
                if (stryMutAct_9fa48("727")) {
                  {}
                } else {
                  stryCov_9fa48("727");
                  agent.frontmatter = item.frontmatter;
                }
              }
              if (stryMutAct_9fa48("729") ? false : stryMutAct_9fa48("728") ? true : (stryCov_9fa48("728", "729"), item.inputFormat)) {
                if (stryMutAct_9fa48("730")) {
                  {}
                } else {
                  stryCov_9fa48("730");
                  agent.inputFormat = item.inputFormat;
                }
              }
              return agent;
            }
          });
          logger.debug(stryMutAct_9fa48("731") ? "" : (stryCov_9fa48("731"), 'Agents requested'), stryMutAct_9fa48("732") ? {} : (stryCov_9fa48("732"), {
            query,
            count: agents.length
          }));
          return agents;
        }
      } catch (error) {
        if (stryMutAct_9fa48("733")) {
          {}
        } else {
          stryCov_9fa48("733");
          logger.error(stryMutAct_9fa48("734") ? "" : (stryCov_9fa48("734"), 'Failed to get agents:'), error);
          return stryMutAct_9fa48("735") ? ["Stryker was here"] : (stryCov_9fa48("735"), []);
        }
      }
    }
  }

  /**
   * Handler: get-agent-file-path
   * Resolves the file path for a specific agent
   */
  private async handleGetAgentFilePath(_event: IpcMainInvokeEvent, agentName: string): Promise<string | null> {
    if (stryMutAct_9fa48("736")) {
      {}
    } else {
      stryCov_9fa48("736");
      try {
        if (stryMutAct_9fa48("737")) {
          {}
        } else {
          stryCov_9fa48("737");
          if (stryMutAct_9fa48("740") ? !agentName && typeof agentName !== 'string' : stryMutAct_9fa48("739") ? false : stryMutAct_9fa48("738") ? true : (stryCov_9fa48("738", "739", "740"), (stryMutAct_9fa48("741") ? agentName : (stryCov_9fa48("741"), !agentName)) || (stryMutAct_9fa48("743") ? typeof agentName === 'string' : stryMutAct_9fa48("742") ? false : (stryCov_9fa48("742", "743"), typeof agentName !== (stryMutAct_9fa48("744") ? "" : (stryCov_9fa48("744"), 'string')))))) {
            if (stryMutAct_9fa48("745")) {
              {}
            } else {
              stryCov_9fa48("745");
              return null;
            }
          }

          // Refresh config from settings in case they changed
          this.updateConfig();
          const items = await this.mdSearchLoader.getItems(stryMutAct_9fa48("746") ? "" : (stryCov_9fa48("746"), 'mention'));
          const agent = items.find(stryMutAct_9fa48("747") ? () => undefined : (stryCov_9fa48("747"), a => stryMutAct_9fa48("750") ? a.name !== agentName : stryMutAct_9fa48("749") ? false : stryMutAct_9fa48("748") ? true : (stryCov_9fa48("748", "749", "750"), a.name === agentName)));
          if (stryMutAct_9fa48("752") ? false : stryMutAct_9fa48("751") ? true : (stryCov_9fa48("751", "752"), agent)) {
            if (stryMutAct_9fa48("753")) {
              {}
            } else {
              stryCov_9fa48("753");
              logger.debug(stryMutAct_9fa48("754") ? "" : (stryCov_9fa48("754"), 'Agent file path resolved'), stryMutAct_9fa48("755") ? {} : (stryCov_9fa48("755"), {
                agentName,
                filePath: agent.filePath
              }));
              return agent.filePath;
            }
          }
          logger.debug(stryMutAct_9fa48("756") ? "" : (stryCov_9fa48("756"), 'Agent not found'), stryMutAct_9fa48("757") ? {} : (stryCov_9fa48("757"), {
            agentName
          }));
          return null;
        }
      } catch (error) {
        if (stryMutAct_9fa48("758")) {
          {}
        } else {
          stryCov_9fa48("758");
          logger.error(stryMutAct_9fa48("759") ? "" : (stryCov_9fa48("759"), 'Failed to get agent file path:'), error);
          return null;
        }
      }
    }
  }

  /**
   * Handler: get-md-search-max-suggestions
   * Returns the maximum number of suggestions for a given search type
   */
  private handleGetMdSearchMaxSuggestions(_event: IpcMainInvokeEvent, type: 'command' | 'mention'): number {
    if (stryMutAct_9fa48("760")) {
      {}
    } else {
      stryCov_9fa48("760");
      try {
        if (stryMutAct_9fa48("761")) {
          {}
        } else {
          stryCov_9fa48("761");
          // Refresh config from settings in case they changed
          this.updateConfig();
          const maxSuggestions = this.mdSearchLoader.getMaxSuggestions(type);
          logger.debug(stryMutAct_9fa48("762") ? "" : (stryCov_9fa48("762"), 'MdSearch maxSuggestions requested'), stryMutAct_9fa48("763") ? {} : (stryCov_9fa48("763"), {
            type,
            maxSuggestions
          }));
          return maxSuggestions;
        }
      } catch (error) {
        if (stryMutAct_9fa48("764")) {
          {}
        } else {
          stryCov_9fa48("764");
          logger.error(stryMutAct_9fa48("765") ? "" : (stryCov_9fa48("765"), 'Failed to get MdSearch maxSuggestions:'), error);
          return 20; // Default fallback
        }
      }
    }
  }

  /**
   * Handler: get-md-search-prefixes
   * Returns the search prefixes for a given search type
   */
  private handleGetMdSearchPrefixes(_event: IpcMainInvokeEvent, type: 'command' | 'mention'): string[] {
    if (stryMutAct_9fa48("766")) {
      {}
    } else {
      stryCov_9fa48("766");
      try {
        if (stryMutAct_9fa48("767")) {
          {}
        } else {
          stryCov_9fa48("767");
          // Refresh config from settings in case they changed
          this.updateConfig();
          const prefixes = this.mdSearchLoader.getSearchPrefixes(type);
          logger.debug(stryMutAct_9fa48("768") ? "" : (stryCov_9fa48("768"), 'MdSearch searchPrefixes requested'), stryMutAct_9fa48("769") ? {} : (stryCov_9fa48("769"), {
            type,
            prefixes
          }));
          return prefixes;
        }
      } catch (error) {
        if (stryMutAct_9fa48("770")) {
          {}
        } else {
          stryCov_9fa48("770");
          logger.error(stryMutAct_9fa48("771") ? "" : (stryCov_9fa48("771"), 'Failed to get MdSearch searchPrefixes:'), error);
          return stryMutAct_9fa48("772") ? ["Stryker was here"] : (stryCov_9fa48("772"), []); // Default fallback
        }
      }
    }
  }
}
export default MdSearchHandler;