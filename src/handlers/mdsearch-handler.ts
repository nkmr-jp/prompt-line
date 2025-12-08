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
    this.mdSearchLoader = mdSearchLoader;
    this.settingsManager = settingsManager;
  }

  /**
   * Register all MD search related IPC handlers
   */
  setupHandlers(ipcMain: typeof import('electron').ipcMain): void {
    ipcMain.handle('get-slash-commands', this.handleGetSlashCommands.bind(this));
    ipcMain.handle('get-slash-command-file-path', this.handleGetSlashCommandFilePath.bind(this));
    ipcMain.handle('get-agents', this.handleGetAgents.bind(this));
    ipcMain.handle('get-agent-file-path', this.handleGetAgentFilePath.bind(this));
    ipcMain.handle('get-md-search-max-suggestions', this.handleGetMdSearchMaxSuggestions.bind(this));
    ipcMain.handle('get-md-search-prefixes', this.handleGetMdSearchPrefixes.bind(this));

    logger.info('MdSearch IPC handlers set up successfully');
  }

  /**
   * Remove all MD search related IPC handlers
   */
  removeHandlers(ipcMain: typeof import('electron').ipcMain): void {
    const handlers = [
      'get-slash-commands',
      'get-slash-command-file-path',
      'get-agents',
      'get-agent-file-path',
      'get-md-search-max-suggestions',
      'get-md-search-prefixes'
    ];

    handlers.forEach(handler => {
      ipcMain.removeAllListeners(handler);
    });

    logger.info('MdSearch IPC handlers removed');
  }

  /**
   * Update MdSearchLoader configuration with latest settings
   */
  private updateConfig(): void {
    const settings = this.settingsManager.getSettings();
    if (settings.mdSearch) {
      this.mdSearchLoader.updateConfig(settings.mdSearch);
    }
  }

  /**
   * Handler: get-slash-commands
   * Retrieves slash commands with optional query filtering
   */
  private async handleGetSlashCommands(
    _event: IpcMainInvokeEvent,
    query?: string
  ): Promise<SlashCommandItem[]> {
    try {
      // Refresh config from settings in case they changed
      this.updateConfig();

      // Get commands from MdSearchLoader
      const items = query
        ? await this.mdSearchLoader.searchItems('command', query)
        : await this.mdSearchLoader.getItems('command');

      // Convert MdSearchItem to SlashCommandItem for backward compatibility
      const commands: SlashCommandItem[] = items.map(item => {
        const cmd: SlashCommandItem = {
          name: item.name,
          description: item.description,
          filePath: item.filePath,
        };
        if (item.argumentHint) {
          cmd.argumentHint = item.argumentHint;
        }
        if (item.frontmatter) {
          cmd.frontmatter = item.frontmatter;
        }
        return cmd;
      });

      logger.debug('Slash commands requested', { query, count: commands.length });
      return commands;
    } catch (error) {
      logger.error('Failed to get slash commands:', error);
      return [];
    }
  }

  /**
   * Handler: get-slash-command-file-path
   * Resolves the file path for a specific slash command
   */
  private async handleGetSlashCommandFilePath(
    _event: IpcMainInvokeEvent,
    commandName: string
  ): Promise<string | null> {
    try {
      if (!commandName || typeof commandName !== 'string') {
        return null;
      }

      // Refresh config from settings in case they changed
      this.updateConfig();

      const items = await this.mdSearchLoader.getItems('command');
      const command = items.find(c => c.name === commandName);

      if (command) {
        logger.debug('Slash command file path resolved', { commandName, filePath: command.filePath });
        return command.filePath;
      }

      logger.debug('Slash command not found', { commandName });
      return null;
    } catch (error) {
      logger.error('Failed to get slash command file path:', error);
      return null;
    }
  }

  /**
   * Handler: get-agents
   * Retrieves agents with optional query filtering
   */
  private async handleGetAgents(
    _event: IpcMainInvokeEvent,
    query?: string
  ): Promise<AgentItem[]> {
    try {
      // Refresh config from settings in case they changed
      this.updateConfig();

      // Get mentions (agents) from MdSearchLoader
      // Always use searchItems to apply searchPrefix filtering, even for empty query
      const items = await this.mdSearchLoader.searchItems('mention', query ?? '');

      // Convert MdSearchItem to AgentItem for backward compatibility
      const agents: AgentItem[] = items.map(item => {
        const agent: AgentItem = {
          name: item.name,
          description: item.description,
          filePath: item.filePath,
        };
        if (item.frontmatter) {
          agent.frontmatter = item.frontmatter;
        }
        return agent;
      });

      logger.debug('Agents requested', { query, count: agents.length });
      return agents;
    } catch (error) {
      logger.error('Failed to get agents:', error);
      return [];
    }
  }

  /**
   * Handler: get-agent-file-path
   * Resolves the file path for a specific agent
   */
  private async handleGetAgentFilePath(
    _event: IpcMainInvokeEvent,
    agentName: string
  ): Promise<string | null> {
    try {
      if (!agentName || typeof agentName !== 'string') {
        return null;
      }

      // Refresh config from settings in case they changed
      this.updateConfig();

      const items = await this.mdSearchLoader.getItems('mention');
      const agent = items.find(a => a.name === agentName);

      if (agent) {
        logger.debug('Agent file path resolved', { agentName, filePath: agent.filePath });
        return agent.filePath;
      }

      logger.debug('Agent not found', { agentName });
      return null;
    } catch (error) {
      logger.error('Failed to get agent file path:', error);
      return null;
    }
  }

  /**
   * Handler: get-md-search-max-suggestions
   * Returns the maximum number of suggestions for a given search type
   */
  private handleGetMdSearchMaxSuggestions(
    _event: IpcMainInvokeEvent,
    type: 'command' | 'mention'
  ): number {
    try {
      // Refresh config from settings in case they changed
      this.updateConfig();

      const maxSuggestions = this.mdSearchLoader.getMaxSuggestions(type);
      logger.debug('MdSearch maxSuggestions requested', { type, maxSuggestions });
      return maxSuggestions;
    } catch (error) {
      logger.error('Failed to get MdSearch maxSuggestions:', error);
      return 20; // Default fallback
    }
  }

  /**
   * Handler: get-md-search-prefixes
   * Returns the search prefixes for a given search type
   */
  private handleGetMdSearchPrefixes(
    _event: IpcMainInvokeEvent,
    type: 'command' | 'mention'
  ): string[] {
    try {
      // Refresh config from settings in case they changed
      this.updateConfig();

      const prefixes = this.mdSearchLoader.getSearchPrefixes(type);
      logger.debug('MdSearch searchPrefixes requested', { type, prefixes });
      return prefixes;
    } catch (error) {
      logger.error('Failed to get MdSearch searchPrefixes:', error);
      return []; // Default fallback
    }
  }
}

export default MdSearchHandler;
