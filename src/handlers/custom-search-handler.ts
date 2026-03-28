import { IpcMainInvokeEvent, BrowserWindow } from 'electron';
import { logger } from '../utils/utils';
import type CustomSearchLoader from '../managers/custom-search-loader';
import type SettingsManager from '../managers/settings-manager';
import type PluginManager from '../managers/plugin-manager';
import type { AgentSkillItem, AgentItem } from '../types';
import type { CommandExecutionResult } from '../types/ipc';
import { exec } from 'child_process';
import { promisify } from 'util';
import pluginLoader from '../lib/plugin-loader';
import { agentSkillCacheManager } from '../managers/agent-skill-cache-manager';
import type { IPCResult } from './handler-utils';

/**
 * CustomSearchHandler manages all IPC handlers related to MD search functionality.
 * This includes slash commands, agents, and search configuration.
 */
class CustomSearchHandler {
  private customSearchLoader: CustomSearchLoader;
  private settingsManager: SettingsManager;

  constructor(
    customSearchLoader: CustomSearchLoader,
    settingsManager: SettingsManager,
    pluginManagerInstance: PluginManager
  ) {
    this.customSearchLoader = customSearchLoader;
    this.settingsManager = settingsManager;

    // Subscribe to settings changes for hot reload
    settingsManager.on('settings-changed', () => {
      pluginLoader.clearCache();
      this.updateConfig();
      logger.debug('CustomSearch config updated via hot reload');
    });

    // Subscribe to plugin/standalone file changes for hot reload
    pluginManagerInstance.on('plugins-changed', () => {
      pluginLoader.clearCache();
      this.customSearchLoader.invalidateCache();
      this.updateConfig();
      logger.debug('Plugins updated via hot reload');
      this.notifyRenderer();
    });

    // Subscribe to custom search source file changes for hot reload
    customSearchLoader.on('source-changed', () => {
      logger.debug('CustomSearch source files changed via hot reload');
      this.notifyRenderer();
    });

    // Initial config load
    this.updateConfig();
  }

  /**
   * Register all MD search related IPC handlers
   */
  setupHandlers(ipcMain: typeof import('electron').ipcMain): void {
    ipcMain.handle('get-agent-skills', this.handleGetAgentSkills.bind(this));
    ipcMain.handle('get-agent-skill-file-path', this.handleGetAgentSkillFilePath.bind(this));
    ipcMain.handle('has-command-file', this.handleHasCommandFile.bind(this));
    ipcMain.handle('get-agents', this.handleGetAgents.bind(this));
    ipcMain.handle('get-agent-file-path', this.handleGetAgentFilePath.bind(this));
    ipcMain.handle('get-custom-search-max-suggestions', this.handleGetCustomSearchMaxSuggestions.bind(this));
    ipcMain.handle('get-custom-search-prefixes', this.handleGetCustomSearchPrefixes.bind(this));
    // Cache invalidation handler (called by renderer on window-shown)
    ipcMain.handle('invalidate-custom-search', this.handleInvalidateCustomSearch.bind(this));
    // Last change timestamp (for conditional invalidation)
    ipcMain.handle('get-custom-search-last-change', this.handleGetLastChange.bind(this));
    // Agent skill cache handlers
    ipcMain.handle('register-global-agent-skill', this.handleRegisterGlobalAgentSkill.bind(this));
    ipcMain.handle('get-global-agent-skills', this.handleGetGlobalAgentSkills.bind(this));
    ipcMain.handle('get-usage-bonuses', this.handleGetUsageBonuses.bind(this));
    ipcMain.handle('execute-custom-search-command', this.handleExecuteCustomSearchCommand.bind(this));
  }

  /**
   * Remove all MD search related IPC handlers
   */
  removeHandlers(ipcMain: typeof import('electron').ipcMain): void {
    const handlers = [
      'get-agent-skills',
      'get-agent-skill-file-path',
      'has-command-file',
      'get-agents',
      'get-agent-file-path',
      'get-custom-search-max-suggestions',
      'get-custom-search-prefixes',
      'invalidate-custom-search',
      'get-custom-search-last-change',
      'register-global-agent-skill',
      'get-global-agent-skills',
      'get-usage-bonuses',
      'execute-custom-search-command'
    ];

    handlers.forEach(handler => {
      ipcMain.removeAllListeners(handler);
    });

    logger.info('CustomSearch IPC handlers removed');
  }

  /**
   * Update CustomSearchLoader configuration with latest settings
   * Uses getCustomSearchEntries to support both new and legacy settings format
   */
  private updateConfig(): void {
    const customSearchEntries = this.settingsManager.getCustomSearchEntries();
    if (customSearchEntries && customSearchEntries.length > 0) {
      this.customSearchLoader.updateConfig(customSearchEntries);
    }
  }


  /**
   * Handler: get-agent-skills
   * Retrieves agent skills with optional query filtering
   * Merges built-in commands (from YAML) with user commands (from MD files)
   */
  private async handleGetAgentSkills(
    _event: IpcMainInvokeEvent,
    query?: string
  ): Promise<AgentSkillItem[]> {
    try {
      const enabledPlugins = this.settingsManager.getPluginSettings();
      const pluginCommands = pluginLoader.searchBuiltInCommands(enabledPlugins, query);
      const legacyCommands = pluginLoader.searchLegacyBuiltInCommands(this.settingsManager.getBuiltInCommandsSettings(), query);
      const builtInCommands = [...pluginCommands, ...legacyCommands];

      // Get user commands from CustomSearchLoader (MD files)
      const items = query
        ? await this.customSearchLoader.searchItems('command', query)
        : await this.customSearchLoader.getItems('command');

      // Convert CustomSearchItem to AgentSkillItem for backward compatibility
      const userCommands: AgentSkillItem[] = items.map(item => {
        const cmd: AgentSkillItem = {
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
        if (item.icon) {
          cmd.icon = item.icon;
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
        if (item.inputText) {
          cmd.inputText = item.inputText;
        }
        if (item.updatedAt) {
          cmd.updatedAt = item.updatedAt;
        }
        if (item.triggers) {
          cmd.triggers = item.triggers;
        }
        return cmd;
      });

      // Merge: built-in commands first, then custom commands
      // Commands with same name but different sources or labels are kept
      const commandMap = new Map<string, AgentSkillItem>();

      // Add built-in commands first
      for (const cmd of builtInCommands) {
        const key = `${cmd.name}:${cmd.source || ''}:${cmd.label || ''}`;
        commandMap.set(key, cmd);
      }

      // Add custom commands (same name with different source or label is kept)
      for (const cmd of userCommands) {
        const key = `${cmd.name}:${cmd.source || ''}:${cmd.label || ''}`;
        commandMap.set(key, cmd);
      }

      // Sort by name, then by source
      return Array.from(commandMap.values()).sort((a, b) => {
        const nameCompare = a.name.localeCompare(b.name);
        if (nameCompare !== 0) return nameCompare;
        return (a.source || '').localeCompare(b.source || '');
      });
    } catch (error) {
      logger.error('Failed to get agent skills:', error);
      return [];
    }
  }

  /**
   * Handler: get-agent-skill-file-path
   * Resolves the file path for a specific agent skill
   */
  private async handleGetAgentSkillFilePath(
    _event: IpcMainInvokeEvent,
    commandName: string
  ): Promise<string | null> {
    try {
      if (!commandName || typeof commandName !== 'string') {
        return null;
      }

      const items = await this.customSearchLoader.getItems('command');
      const command = items.find(c => c.name === commandName);

      if (command) {
        return command.filePath;
      }

      return null;
    } catch (error) {
      logger.error('Failed to get agent skill file path:', error);
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

      const enabledPlugins = this.settingsManager.getPluginSettings();
      const pluginCommands = pluginLoader.searchBuiltInCommands(enabledPlugins);
      const legacyCommands = pluginLoader.searchLegacyBuiltInCommands(this.settingsManager.getBuiltInCommandsSettings());
      const isBuiltIn = [...pluginCommands, ...legacyCommands].some(cmd => cmd.name === commandName);
      if (isBuiltIn) {
        return false; // Built-in commands don't have individual files
      }

      // Check if this is a user-defined command (custom)
      const items = await this.customSearchLoader.getItems('command');
      const command = items.find(c => c.name === commandName);

      return !!command; // Has file if found in customSearchLoader
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
      // Get mentions (agents) from CustomSearchLoader
      // Always use searchItems to apply searchPrefix filtering, even for empty query
      const items = await this.customSearchLoader.searchItems('mention', query ?? '');
      // Convert CustomSearchItem to AgentItem for backward compatibility
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
        if (item.inputText) {
          agent.inputText = item.inputText;
        }
        if (item.color) {
          agent.color = item.color;
        }
        if (item.icon) {
          agent.icon = item.icon;
        }
        if (item.label) {
          agent.label = item.label;
        }
        if (item.updatedAt) {
          agent.updatedAt = item.updatedAt;
        }
        if (item.displayTime !== undefined) {
          agent.displayTime = item.displayTime;
        }
        if (item.command) {
          agent.command = item.command;
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

      const items = await this.customSearchLoader.getItems('mention');
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
   * Handler: get-custom-search-max-suggestions
   * Returns the maximum number of suggestions for a given search type
   */
  private handleGetCustomSearchMaxSuggestions(
    _event: IpcMainInvokeEvent,
    type: 'command' | 'mention'
  ): number {
    try {
      return this.customSearchLoader.getMaxSuggestions(type);
    } catch (error) {
      logger.error('Failed to get CustomSearch maxSuggestions:', error);
      return 20; // Default fallback
    }
  }

  /**
   * Handler: get-custom-search-prefixes
   * Returns the search prefixes for a given search type
   */
  private handleGetCustomSearchPrefixes(
    _event: IpcMainInvokeEvent,
    type: 'command' | 'mention'
  ): string[] {
    try {
      return this.customSearchLoader.getSearchPrefixes(type);
    } catch (error) {
      logger.error('Failed to get CustomSearch searchPrefixes:', error);
      return []; // Default fallback
    }
  }

  /**
   * Handler: invalidate-custom-search
   * Invalidates CustomSearchLoader cache and triggers background preload.
   * Called by renderer on window-shown for fresh data loading.
   */
  private async handleInvalidateCustomSearch(): Promise<void> {
    this.customSearchLoader.invalidateCache();
    // Background preload: trigger loadAll without awaiting
    this.customSearchLoader.getItems('command').catch(err => {
      logger.debug('Background preload failed:', err);
    });
    logger.debug('CustomSearch cache invalidated via IPC (background preload started)');
  }

  /**
   * Handler: get-custom-search-last-change
   * Returns the timestamp of the last cache invalidation.
   * Used by renderer to skip unnecessary invalidation on window-shown.
   */
  private handleGetLastChange(): number {
    return this.customSearchLoader.getLastChangeTimestamp();
  }

  /**
   * Notify renderer that custom search data has changed
   */
  private notifyRenderer(): void {
    BrowserWindow.getAllWindows().forEach(win => {
      if (!win.isDestroyed()) {
        win.webContents.send('custom-search-updated');
      }
    });
  }

  // Agent skill cache handlers

  /**
   * Handler: register-global-agent-skill
   * Registers an agent skill to the global cache for quick access
   */
  private async handleRegisterGlobalAgentSkill(
    _event: IpcMainInvokeEvent,
    commandName: string
  ): Promise<IPCResult> {
    try {
      if (!commandName || typeof commandName !== 'string') {
        return { success: false, error: 'Invalid command name' };
      }

      await agentSkillCacheManager.addGlobalSkill(commandName);
      return { success: true };
    } catch (error) {
      logger.error('Failed to register global agent skill:', error);
      return { success: false, error: 'Operation failed' };
    }
  }

  /**
   * Handler: get-global-agent-skills
   * Retrieves recently used agent skills from global cache
   */
  private async handleGetGlobalAgentSkills(
    _event: IpcMainInvokeEvent
  ): Promise<string[]> {
    try {
      return await agentSkillCacheManager.loadGlobalSkills();
    } catch (error) {
      logger.error('Failed to get global agent skills:', error);
      return [];
    }
  }

  /**
   * Handler: get-usage-bonuses
   * Calculates usage bonuses for multiple agent skills
   * Used for sorting search results with usage frequency and recency
   */
  private async handleGetUsageBonuses(
    _event: IpcMainInvokeEvent,
    commandNames: string[]
  ): Promise<Record<string, number>> {
    try {
      if (!Array.isArray(commandNames)) {
        logger.warn('Invalid commandNames parameter for get-usage-bonuses');
        return {};
      }

      const bonuses: Record<string, number> = {};

      // Calculate bonus for each command
      await Promise.all(
        commandNames.map(async (name) => {
          if (typeof name === 'string') {
            const bonus = await agentSkillCacheManager.calculateBonus(name);
            bonuses[name] = bonus;
          }
        })
      );

      return bonuses;
    } catch (error) {
      logger.error('Failed to get usage bonuses:', error);
      return {};
    }
  }
  /**
   * Handler: execute-custom-search-command
   * Executes a shell command defined in customSearch entry's command field
   */
  private async handleExecuteCustomSearchCommand(
    _event: IpcMainInvokeEvent,
    command: string
  ): Promise<CommandExecutionResult> {
    try {
      if (!command || typeof command !== 'string') {
        return { success: false, error: 'Invalid command' };
      }

      // Security: verify command matches a loaded custom search item's command
      // This prevents a compromised renderer from executing arbitrary commands
      // Check both mention and command types since either can have a command field
      const [mentionItems, commandItems] = await Promise.all([
        this.customSearchLoader.getItems('mention'),
        this.customSearchLoader.getItems('command'),
      ]);
      const isAuthorized = mentionItems.some(item => item.command === command)
        || commandItems.some(item => item.command === command);
      if (!isAuthorized) {
        logger.warn('Unauthorized command execution attempt blocked', { commandLength: command.length });
        return { success: false, error: 'Command not authorized' };
      }

      const execAsync = promisify(exec);
      const { stdout, stderr } = await execAsync(command, {
        timeout: 30000,
        env: { ...process.env },
      });

      const output = (stdout || '').trimEnd();
      logger.info('Custom search command executed', { outputLength: output.length });
      return { success: true, output: output || undefined, error: stderr ? stderr.trimEnd() : undefined };
    } catch (error) {
      const execError = error as { message: string; stderr?: string; signal?: string };
      const errorMsg = execError.signal === 'SIGTERM'
        ? 'Command timed out (30s)'
        : (execError.stderr || execError.message);
      logger.error('Custom search command failed', { error: errorMsg });
      return { success: false, error: errorMsg };
    }
  }
}

export default CustomSearchHandler;
