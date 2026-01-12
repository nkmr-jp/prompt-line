import { IpcMainInvokeEvent } from 'electron';
import { logger } from '../utils/utils';
import type MdSearchLoader from '../managers/md-search-loader';
import type SettingsManager from '../managers/settings-manager';
import type { SlashCommandItem, AgentItem } from '../types';
import builtInCommandsLoader from '../lib/built-in-commands-loader';
import { slashCommandCacheManager } from '../managers/slash-command-cache-manager';
import type { IPCResult } from './handler-utils';

/**
 * MdSearchHandler manages all IPC handlers related to MD search functionality.
 * This includes slash commands, agents, and search configuration.
 */
class MdSearchHandler {
  private mdSearchLoader: MdSearchLoader;
  private settingsManager: SettingsManager;
  private lastConfigUpdate: number = 0;
  private readonly CONFIG_CACHE_TTL = 5000; // 5 seconds cache TTL

  constructor(mdSearchLoader: MdSearchLoader, settingsManager: SettingsManager) {
    this.mdSearchLoader = mdSearchLoader;
    this.settingsManager = settingsManager;

    // Subscribe to settings changes for hot reload
    settingsManager.on('settings-changed', () => {
      this.updateConfig();
      logger.debug('MdSearch config updated via hot reload');
    });

    // Initial config load
    this.updateConfig();
  }

  /**
   * Register all MD search related IPC handlers
   */
  setupHandlers(ipcMain: typeof import('electron').ipcMain): void {
    ipcMain.handle('get-slash-commands', this.handleGetSlashCommands.bind(this));
    ipcMain.handle('get-slash-command-file-path', this.handleGetSlashCommandFilePath.bind(this));
    ipcMain.handle('has-command-file', this.handleHasCommandFile.bind(this));
    ipcMain.handle('get-agents', this.handleGetAgents.bind(this));
    ipcMain.handle('get-agent-file-path', this.handleGetAgentFilePath.bind(this));
    ipcMain.handle('get-md-search-max-suggestions', this.handleGetMdSearchMaxSuggestions.bind(this));
    ipcMain.handle('get-md-search-prefixes', this.handleGetMdSearchPrefixes.bind(this));
    // Slash command cache handlers
    ipcMain.handle('register-global-slash-command', this.handleRegisterGlobalSlashCommand.bind(this));
    ipcMain.handle('get-global-slash-commands', this.handleGetGlobalSlashCommands.bind(this));
  }

  /**
   * Remove all MD search related IPC handlers
   */
  removeHandlers(ipcMain: typeof import('electron').ipcMain): void {
    const handlers = [
      'get-slash-commands',
      'get-slash-command-file-path',
      'has-command-file',
      'get-agents',
      'get-agent-file-path',
      'get-md-search-max-suggestions',
      'get-md-search-prefixes',
      'register-global-slash-command',
      'get-global-slash-commands'
    ];

    handlers.forEach(handler => {
      ipcMain.removeAllListeners(handler);
    });

    logger.info('MdSearch IPC handlers removed');
  }

  /**
   * Update MdSearchLoader configuration with latest settings
   * Uses getMdSearchEntries to support both new and legacy settings format
   */
  private updateConfig(): void {
    const mdSearchEntries = this.settingsManager.getMdSearchEntries();
    if (mdSearchEntries && mdSearchEntries.length > 0) {
      this.mdSearchLoader.updateConfig(mdSearchEntries);
    }
    this.lastConfigUpdate = Date.now();
  }

  /**
   * Check if the configuration cache is still valid
   */
  private isConfigCacheValid(): boolean {
    return Date.now() - this.lastConfigUpdate < this.CONFIG_CACHE_TTL;
  }

  /**
   * Update configuration only if cache has expired
   * This prevents redundant config updates during rapid successive calls
   */
  private updateConfigIfNeeded(): void {
    if (!this.isConfigCacheValid()) {
      this.updateConfig();
    }
  }

  /**
   * Handler: get-slash-commands
   * Retrieves slash commands with optional query filtering
   * Merges built-in commands (from YAML) with user commands (from MD files)
   */
  private async handleGetSlashCommands(
    _event: IpcMainInvokeEvent,
    query?: string
  ): Promise<SlashCommandItem[]> {
    try {
      // Refresh config from settings if cache expired
      this.updateConfigIfNeeded();

      // Get built-in commands settings (supports both new and legacy format)
      const builtInSettings = this.settingsManager.getBuiltInCommandsSettings();

      // Get built-in commands from YAML files (respects enabled/tools settings)
      const builtInCommands = builtInCommandsLoader.searchCommands(query, builtInSettings);

      // Get user commands from MdSearchLoader (MD files)
      const items = query
        ? await this.mdSearchLoader.searchItems('command', query)
        : await this.mdSearchLoader.getItems('command');

      // Convert MdSearchItem to SlashCommandItem for backward compatibility
      const userCommands: SlashCommandItem[] = items.map(item => {
        const cmd: SlashCommandItem = {
          name: item.name,
          description: item.description,
          filePath: item.filePath,
          source: 'custom',      // Mark as custom slash command
          displayName: 'custom', // Display "custom" badge
        };
        if (item.label) {
          cmd.label = item.label;
        }
        if (item.color) {
          cmd.color = item.color;
        }
        if (item.argumentHint) {
          cmd.argumentHint = item.argumentHint;
        }
        if (item.frontmatter) {
          cmd.frontmatter = item.frontmatter;
        }
        if (item.inputFormat) {
          cmd.inputFormat = item.inputFormat;
        }
        return cmd;
      });

      // Merge: built-in commands first, then custom commands
      // Commands with same name but different sources are kept (use name+source as key)
      const commandMap = new Map<string, SlashCommandItem>();

      // Add built-in commands first
      for (const cmd of builtInCommands) {
        const key = `${cmd.name}:${cmd.source || ''}`;
        commandMap.set(key, cmd);
      }

      // Add custom commands (same name with different source is kept)
      for (const cmd of userCommands) {
        const key = `${cmd.name}:${cmd.source || ''}`;
        commandMap.set(key, cmd);
      }

      // Sort by name, then by source
      return Array.from(commandMap.values()).sort((a, b) => {
        const nameCompare = a.name.localeCompare(b.name);
        if (nameCompare !== 0) return nameCompare;
        return (a.source || '').localeCompare(b.source || '');
      });
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

      // Refresh config from settings if cache expired
      this.updateConfigIfNeeded();

      const items = await this.mdSearchLoader.getItems('command');
      const command = items.find(c => c.name === commandName);

      if (command) {
        return command.filePath;
      }

      return null;
    } catch (error) {
      logger.error('Failed to get slash command file path:', error);
      return null;
    }
  }

  /**
   * Handler: has-command-file
   * Checks if a command has an individual file (user-defined commands only)
   * Built-in commands share a YAML file, so they don't have individual files
   */
  private async handleHasCommandFile(
    _event: IpcMainInvokeEvent,
    commandName: string
  ): Promise<boolean> {
    try {
      if (!commandName || typeof commandName !== 'string') {
        return false;
      }

      // Refresh config from settings if cache expired
      this.updateConfigIfNeeded();

      // Check if this is a built-in command
      const builtInSettings = this.settingsManager.getBuiltInCommandsSettings();
      if (builtInSettings) {
        const builtInCommands = builtInCommandsLoader.searchCommands(undefined, builtInSettings);
        const isBuiltIn = builtInCommands.some(cmd => cmd.name === commandName);
        if (isBuiltIn) {
          return false; // Built-in commands don't have individual files
        }
      }

      // Check if this is a user-defined command (custom)
      const items = await this.mdSearchLoader.getItems('command');
      const command = items.find(c => c.name === commandName);

      return !!command; // Has file if found in mdSearchLoader
    } catch (error) {
      logger.error('Failed to check command file:', error);
      return false;
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
      // Refresh config from settings if cache expired
      this.updateConfigIfNeeded();

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
        if (item.inputFormat) {
          agent.inputFormat = item.inputFormat;
        }
        return agent;
      });

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

      // Refresh config from settings if cache expired
      this.updateConfigIfNeeded();

      const items = await this.mdSearchLoader.getItems('mention');
      const agent = items.find(a => a.name === agentName);

      if (agent) {
        return agent.filePath;
      }

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
      // Refresh config from settings if cache expired
      this.updateConfigIfNeeded();

      return this.mdSearchLoader.getMaxSuggestions(type);
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
      // Refresh config from settings if cache expired
      this.updateConfigIfNeeded();

      return this.mdSearchLoader.getSearchPrefixes(type);
    } catch (error) {
      logger.error('Failed to get MdSearch searchPrefixes:', error);
      return []; // Default fallback
    }
  }

  // Slash command cache handlers

  /**
   * Handler: register-global-slash-command
   * Registers a slash command to the global cache for quick access
   */
  private async handleRegisterGlobalSlashCommand(
    _event: IpcMainInvokeEvent,
    commandName: string
  ): Promise<IPCResult> {
    try {
      if (!commandName || typeof commandName !== 'string') {
        return { success: false, error: 'Invalid command name' };
      }

      await slashCommandCacheManager.addGlobalCommand(commandName);
      return { success: true };
    } catch (error) {
      logger.error('Failed to register global slash command:', error);
      return { success: false, error: 'Operation failed' };
    }
  }

  /**
   * Handler: get-global-slash-commands
   * Retrieves recently used slash commands from global cache
   */
  private async handleGetGlobalSlashCommands(
    _event: IpcMainInvokeEvent
  ): Promise<string[]> {
    try {
      return await slashCommandCacheManager.loadGlobalCommands();
    } catch (error) {
      logger.error('Failed to get global slash commands:', error);
      return [];
    }
  }
}

export default MdSearchHandler;
