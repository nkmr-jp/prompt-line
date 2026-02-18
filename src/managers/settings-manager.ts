import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import * as yaml from 'js-yaml';
import { EventEmitter } from 'events';
import chokidar, { type FSWatcher } from 'chokidar';
import { logger } from '../utils/utils';
import { defaultSettings as sharedDefaultSettings } from '../config/default-settings';
import { generateSettingsYaml } from '../config/settings-yaml-generator';
import type {
  UserSettings,
  FileSearchSettings,
  SymbolSearchUserSettings,
  SlashCommandEntry,
  MentionEntry,
  CustomSearchEntry
} from '../types';

class SettingsManager extends EventEmitter {
  private settingsFile: string;
  private currentSettings: UserSettings;
  private defaultSettings: UserSettings;
  private watcher: FSWatcher | null = null;
  private reloadDebounceTimer: NodeJS.Timeout | null = null;
  private readonly RELOAD_DEBOUNCE_MS = 300;

  constructor() {
    super();
    this.settingsFile = path.join(os.homedir(), '.prompt-line', 'settings.yml');

    // Use shared default settings from config/default-settings.ts
    this.defaultSettings = sharedDefaultSettings;

    this.currentSettings = { ...this.defaultSettings };
  }

  async init(): Promise<void> {
    try {
      await this.loadSettings();
      this.startWatching();
    } catch (error) {
      logger.error('Failed to initialize settings manager:', error);
      throw error;
    }
  }

  private startWatching(): void {
    if (this.watcher) {
      logger.debug('Settings file watcher already initialized');
      return;
    }

    this.watcher = chokidar.watch(this.settingsFile, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50
      }
    });

    this.watcher.on('change', () => {
      logger.debug('Settings file changed, scheduling reload');
      this.handleFileChange();
    });

    this.watcher.on('error', (error: unknown) => {
      logger.error('Settings file watcher error:', error);
    });

    logger.info('Settings file watcher started');
  }

  private async handleFileChange(): Promise<void> {
    if (this.reloadDebounceTimer) {
      clearTimeout(this.reloadDebounceTimer);
    }

    this.reloadDebounceTimer = setTimeout(async () => {
      const previousSettings = { ...this.currentSettings };
      try {
        await this.loadSettings();
        this.emit('settings-changed', this.currentSettings, previousSettings);
        logger.info('Settings reloaded from file change');
      } catch (error) {
        logger.error('Failed to reload settings after file change:', error);
        // Keep existing settings on error
      }
    }, this.RELOAD_DEBOUNCE_MS);
  }

  private async loadSettings(): Promise<void> {
    try {
      // Set restrictive directory permissions (owner read/write/execute only)
      await fs.mkdir(path.dirname(this.settingsFile), { recursive: true, mode: 0o700 });

      try {
        const data = await fs.readFile(this.settingsFile, 'utf8');
        // Use JSON_SCHEMA to prevent arbitrary code execution from malicious YAML
        // JSON_SCHEMA only allows JSON-compatible types (strings, numbers, booleans, null, arrays, objects)
        // which prevents JavaScript-specific type coercion attacks
        const parsed = yaml.load(data, { schema: yaml.JSON_SCHEMA }) as UserSettings;
        
        if (parsed && typeof parsed === 'object') {
          this.currentSettings = this.mergeWithDefaults(parsed);
        } else {
          logger.warn('Invalid settings file format, using defaults');
          try {
            await this.saveSettings();
          } catch (saveError) {
            logger.error('Failed to save default settings after invalid format:', saveError);
            // Continue with defaults in memory
          }
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          logger.info('Settings file not found, creating with defaults');
          try {
            await this.saveSettings();
          } catch (saveError) {
            logger.error('Failed to create default settings file:', saveError);
            // Continue with defaults in memory
          }
        } else {
          logger.error('Failed to read settings file:', error);
          throw error;
        }
      }
    } catch (error) {
      logger.error('Failed to load settings:', error);
      throw error;
    }
  }

  /**
   * Convert legacy mdSearch entries to new format
   * Separates command entries (/) and mention entries (@)
   */
  private convertLegacyCustomSearch(mdSearch: CustomSearchEntry[]): { custom: SlashCommandEntry[]; customSearchMentions: MentionEntry[] } {
    const custom: SlashCommandEntry[] = [];
    const customSearchMentions: MentionEntry[] = [];

    for (const entry of mdSearch) {
      if (entry.type === 'command') {
        // Convert to SlashCommandEntry (without type field)
        const cmd: SlashCommandEntry = {
          name: entry.name,
          description: entry.description,
          path: entry.path,
        };
        if (entry.argumentHint) cmd.argumentHint = entry.argumentHint;
        if (entry.maxSuggestions) cmd.maxSuggestions = entry.maxSuggestions;
        if (entry.orderBy) cmd.orderBy = entry.orderBy;
        if (entry.prefixPattern) cmd.prefixPattern = entry.prefixPattern;
        custom.push(cmd);
      } else if (entry.type === 'mention') {
        // Convert to MentionEntry (without type field)
        const mention: MentionEntry = {
          name: entry.name,
          description: entry.description,
          path: entry.path,
        };
        if (entry.maxSuggestions) mention.maxSuggestions = entry.maxSuggestions;
        if (entry.searchPrefix) mention.searchPrefix = entry.searchPrefix;
        if (entry.orderBy) mention.orderBy = entry.orderBy;
        if (entry.inputFormat) mention.inputFormat = entry.inputFormat;
        customSearchMentions.push(mention);
      }
    }

    return { custom, customSearchMentions };
  }

  private mergeWithDefaults(userSettings: Partial<UserSettings>): UserSettings {
    const result: UserSettings = {
      shortcuts: {
        ...this.defaultSettings.shortcuts,
        ...(userSettings.shortcuts || {})
      },
      window: {
        ...this.defaultSettings.window,
        ...(userSettings.window || {})
      },
      fileOpener: {
        ...this.defaultSettings.fileOpener,
        ...(userSettings.fileOpener || {}),
        // Deep merge for extensions object
        extensions: {
          ...this.defaultSettings.fileOpener?.extensions,
          ...(userSettings.fileOpener?.extensions || {})
        }
      }
    };

    // Handle mentions structure with deep merge (fileSearch, symbolSearch, customSearch)
    result.mentions = {
      fileSearch: {
        ...this.defaultSettings.mentions?.fileSearch,
        ...(userSettings.mentions?.fileSearch || {})
      },
      symbolSearch: {
        ...this.defaultSettings.mentions?.symbolSearch,
        ...(userSettings.mentions?.symbolSearch || {})
      }
    };
    // customSearch: use user settings if provided (new key first, then legacy mdSearch), otherwise use defaults
    const customSearch = userSettings.mentions?.customSearch ?? userSettings.mentions?.mdSearch ?? this.defaultSettings.mentions?.customSearch;
    if (customSearch) {
      result.mentions.customSearch = customSearch;
    }

    // Handle builtInCommands at root level
    // Priority: root builtInCommands > legacy agentSkills.builtInCommands > legacy builtInCommands.tools > defaults
    const rawAgentSkills = userSettings.agentSkills as unknown;

    const defaultBuiltInCommands = this.defaultSettings.builtInCommands ?? ['claude'];
    const defaultAgentSkills = this.defaultSettings.agentSkills ?? [];

    if (Array.isArray(userSettings.builtInCommands)) {
      // New format: root-level builtInCommands as string[]
      result.builtInCommands = userSettings.builtInCommands;
    } else if (rawAgentSkills && !Array.isArray(rawAgentSkills) && typeof rawAgentSkills === 'object') {
      // Legacy: agentSkills is an object with builtInCommands
      const legacySkills = rawAgentSkills as Record<string, unknown>;
      if (Array.isArray(legacySkills.builtInCommands)) {
        result.builtInCommands = legacySkills.builtInCommands as string[];
      } else if (Array.isArray(legacySkills.builtIn)) {
        result.builtInCommands = legacySkills.builtIn as string[];
      } else {
        result.builtInCommands = defaultBuiltInCommands;
      }
    } else if (userSettings.slashCommands?.builtInCommands) {
      // Legacy: slashCommands.builtInCommands
      result.builtInCommands = userSettings.slashCommands.builtInCommands;
    } else if ((userSettings as Record<string, unknown>).legacyBuiltInCommands) {
      // Legacy: builtInCommands.tools format
      const legacy = (userSettings as Record<string, unknown>).legacyBuiltInCommands as { tools?: string[] };
      if (legacy.tools) {
        result.builtInCommands = legacy.tools;
      } else {
        result.builtInCommands = defaultBuiltInCommands;
      }
    } else {
      result.builtInCommands = defaultBuiltInCommands;
    }

    // Handle agentSkills as flat array
    // Priority: flat array > legacy object.custom > legacy slashCommands.custom > defaults
    if (Array.isArray(userSettings.agentSkills)) {
      // New format: agentSkills is already a flat array
      result.agentSkills = userSettings.agentSkills;
    } else if (rawAgentSkills && !Array.isArray(rawAgentSkills) && typeof rawAgentSkills === 'object') {
      // Legacy: agentSkills is an object with custom property
      const legacySkills = rawAgentSkills as Record<string, unknown>;
      if (Array.isArray(legacySkills.custom)) {
        result.agentSkills = legacySkills.custom as SlashCommandEntry[];
      } else {
        result.agentSkills = defaultAgentSkills;
      }
    } else if (userSettings.slashCommands?.custom) {
      // Legacy: slashCommands.custom
      result.agentSkills = userSettings.slashCommands.custom;
    } else {
      result.agentSkills = defaultAgentSkills;
    }

    // Handle legacy fileSearch -> mentions.fileSearch (with deep merge)
    if (userSettings.fileSearch) {
      result.mentions = result.mentions || {};
      result.mentions.fileSearch = {
        ...this.defaultSettings.mentions?.fileSearch,
        ...(result.mentions.fileSearch || {}),
        ...(userSettings.fileSearch || {})
      };
      // Keep legacy for backward compatibility
      result.fileSearch = userSettings.fileSearch;
    }

    // Handle legacy symbolSearch -> mentions.symbolSearch (with deep merge)
    if (userSettings.symbolSearch) {
      result.mentions = result.mentions || {};
      result.mentions.symbolSearch = {
        ...this.defaultSettings.mentions?.symbolSearch,
        ...(result.mentions.symbolSearch || {}),
        ...(userSettings.symbolSearch || {})
      };
      // Keep legacy for backward compatibility
      result.symbolSearch = userSettings.symbolSearch;
    }

    // Handle legacy settings (mdSearch) for backward compatibility
    if (userSettings.mdSearch && userSettings.mdSearch.length > 0) {
      const converted = this.convertLegacyCustomSearch(userSettings.mdSearch);

      // If agentSkills not set, use converted custom
      if (!result.agentSkills && converted.custom.length > 0) {
        result.agentSkills = converted.custom;
      }
      // If mentions.customSearch not set, use converted customSearchMentions
      if (converted.customSearchMentions.length > 0) {
        if (!result.mentions) {
          result.mentions = {};
        }
        if (!result.mentions.customSearch || result.mentions.customSearch.length === 0) {
          result.mentions.customSearch = converted.customSearchMentions;
        }
      }

      // Keep legacy mdSearch for backward compatibility
      result.mdSearch = userSettings.mdSearch;
    }

    return result;
  }

  async saveSettings(): Promise<void> {
    try {
      // Use shared YAML generator (single source of truth)
      // Include commented examples for better UX (shows available options)
      const settingsYaml = generateSettingsYaml(this.currentSettings, { includeCommentedExamples: true });

      // Set restrictive file permissions (owner read/write only)
      await fs.writeFile(this.settingsFile, settingsYaml, { encoding: 'utf8', mode: 0o600 });
    } catch (error) {
      logger.error('Failed to save settings:', error);
      throw error;
    }
  }

  getSettings(): UserSettings {
    return { ...this.currentSettings };
  }

  async updateSettings(newSettings: Partial<UserSettings>): Promise<void> {
    const previousSettings = this.currentSettings;
    try {
      this.currentSettings = this.mergeWithDefaults({
        ...this.currentSettings,
        ...newSettings
      });

      await this.saveSettings();
      logger.info('Settings updated successfully');
    } catch (error) {
      // Rollback to previous state if save fails
      this.currentSettings = previousSettings;
      logger.error('Failed to update settings:', error);
      throw error;
    }
  }

  async resetSettings(): Promise<void> {
    try {
      this.currentSettings = { ...this.defaultSettings };
      await this.saveSettings();
      logger.info('Settings reset to defaults');
    } catch (error) {
      logger.error('Failed to reset settings:', error);
      throw error;
    }
  }

  getShortcuts(): UserSettings['shortcuts'] {
    return { ...this.currentSettings.shortcuts };
  }

  async updateShortcuts(shortcuts: Partial<UserSettings['shortcuts']>): Promise<void> {
    await this.updateSettings({
      shortcuts: {
        ...this.currentSettings.shortcuts,
        ...shortcuts
      }
    });
  }

  getWindowSettings(): UserSettings['window'] {
    return { ...this.currentSettings.window };
  }

  async updateWindowSettings(window: Partial<UserSettings['window']>): Promise<void> {
    await this.updateSettings({
      window: {
        ...this.currentSettings.window,
        ...window
      }
    });
  }


  getDefaultSettings(): UserSettings {
    return structuredClone(this.defaultSettings);
  }

  /**
   * Get file search settings
   * Returns from mentions.fileSearch (new) or fileSearch (legacy)
   */
  getFileSearchSettings(): FileSearchSettings | undefined {
    // Check new structure first
    const fileSearch = this.currentSettings.mentions?.fileSearch || this.currentSettings.fileSearch;
    if (!fileSearch) {
      return undefined;
    }
    return fileSearch as FileSearchSettings;
  }

  /**
   * Check if file search is enabled
   * Checks both mentions.fileSearch (new) and fileSearch (legacy)
   */
  isFileSearchEnabled(): boolean {
    return !!(this.currentSettings.mentions?.fileSearch || this.currentSettings.fileSearch);
  }

  /**
   * Get symbol search settings
   * Returns from mentions.symbolSearch (new) or symbolSearch (legacy)
   */
  getSymbolSearchSettings(): SymbolSearchUserSettings | undefined {
    return this.currentSettings.mentions?.symbolSearch || this.currentSettings.symbolSearch;
  }

  async updateFileSearchSettings(fileSearch: Partial<NonNullable<UserSettings['fileSearch']>>): Promise<void> {
    // Update in new structure (mentions.fileSearch)
    const currentMentions = this.currentSettings.mentions || {};
    await this.updateSettings({
      mentions: {
        ...currentMentions,
        fileSearch: {
          ...(currentMentions.fileSearch || {}),
          ...(fileSearch || {})
        }
      }
    });
  }

  getAgentSkillsSettings(): UserSettings['agentSkills'] {
    return this.currentSettings.agentSkills;
  }

  /** @deprecated Use getAgentSkillsSettings instead */
  getSlashCommandsSettings(): UserSettings['agentSkills'] {
    return this.getAgentSkillsSettings();
  }

  getMentionsSettings(): UserSettings['mentions'] {
    return this.currentSettings.mentions;
  }

  /**
   * Get customSearch mentions for @ syntax
   * Returns from mentions.customSearch (new structure), fallback to mentions.mdSearch
   */
  getCustomSearchMentions(): MentionEntry[] | undefined {
    return this.currentSettings.mentions?.customSearch ?? this.currentSettings.mentions?.mdSearch;
  }

  /**
   * Get built-in commands settings
   * Returns from root-level builtInCommands
   */
  getBuiltInCommandsSettings(): string[] | undefined {
    return this.currentSettings.builtInCommands;
  }

  /**
   * Convert current settings to CustomSearchEntry format for backward compatibility
   * This is used by CustomSearchLoader
   */
  getCustomSearchEntries(): UserSettings['customSearch'] {
    // If legacy customSearch or mdSearch exists, use it
    if (this.currentSettings.customSearch && this.currentSettings.customSearch.length > 0) {
      return this.currentSettings.customSearch;
    }
    if (this.currentSettings.mdSearch && this.currentSettings.mdSearch.length > 0) {
      return this.currentSettings.mdSearch;
    }

    // Convert new format to legacy CustomSearchEntry format
    const entries: CustomSearchEntry[] = [];

    // Convert agent skills (flat array of slash command entries)
    const agentSkills = this.currentSettings.agentSkills;
    if (agentSkills && agentSkills.length > 0) {
      for (const cmd of agentSkills) {
        const entry: CustomSearchEntry = {
          type: 'command',
          name: cmd.name,
          description: cmd.description,
          path: cmd.path,
        };
        // Only add optional properties if defined
        if (cmd.argumentHint !== undefined) entry.argumentHint = cmd.argumentHint;
        if (cmd.maxSuggestions !== undefined) entry.maxSuggestions = cmd.maxSuggestions;
        if (cmd.orderBy !== undefined) entry.orderBy = cmd.orderBy;
        if (cmd.label !== undefined) entry.label = cmd.label;
        if (cmd.color !== undefined) entry.color = cmd.color;
        if (cmd.icon !== undefined) entry.icon = cmd.icon;
        if (cmd.prefixPattern !== undefined) entry.prefixPattern = cmd.prefixPattern;
        if (cmd.enable !== undefined) entry.enable = cmd.enable;
        if (cmd.disable !== undefined) entry.disable = cmd.disable;
        entries.push(entry);
      }
    }

    // Convert customSearch mentions (from mentions.customSearch, fallback to mentions.mdSearch)
    const customSearchMentions = this.currentSettings.mentions?.customSearch ?? this.currentSettings.mentions?.mdSearch;
    if (customSearchMentions) {
      for (const mention of customSearchMentions) {
        const entry: CustomSearchEntry = {
          type: 'mention',
          name: mention.name,
          description: mention.description,
          path: mention.path,
        };
        // Only add optional properties if defined
        if (mention.maxSuggestions !== undefined) entry.maxSuggestions = mention.maxSuggestions;
        if (mention.searchPrefix !== undefined) entry.searchPrefix = mention.searchPrefix;
        if (mention.orderBy !== undefined) entry.orderBy = mention.orderBy;
        if (mention.inputFormat !== undefined) entry.inputFormat = mention.inputFormat;
        if (mention.prefixPattern !== undefined) entry.prefixPattern = mention.prefixPattern;
        if (mention.color !== undefined) entry.color = mention.color;
        if (mention.icon !== undefined) entry.icon = mention.icon;
        if (mention.enable !== undefined) entry.enable = mention.enable;
        if (mention.disable !== undefined) entry.disable = mention.disable;
        entries.push(entry);
      }
    }

    return entries;
  }

  getSettingsFilePath(): string {
    return this.settingsFile;
  }

  async destroy(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
      logger.info('Settings file watcher closed');
    }

    if (this.reloadDebounceTimer) {
      clearTimeout(this.reloadDebounceTimer);
      this.reloadDebounceTimer = null;
    }

    this.removeAllListeners();
  }
}

export default SettingsManager;