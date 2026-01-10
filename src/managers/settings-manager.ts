import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import * as yaml from 'js-yaml';
import { logger } from '../utils/utils';
import { defaultSettings as sharedDefaultSettings } from '../config/default-settings';
import { generateSettingsYaml } from '../config/settings-yaml-generator';
import type {
  UserSettings,
  FileSearchSettings,
  SymbolSearchUserSettings,
  SlashCommandEntry,
  MentionEntry,
  MdSearchEntry
} from '../types';

class SettingsManager {
  private settingsFile: string;
  private currentSettings: UserSettings;
  private defaultSettings: UserSettings;

  constructor() {
    this.settingsFile = path.join(os.homedir(), '.prompt-line', 'settings.yml');

    // Use shared default settings from config/default-settings.ts
    this.defaultSettings = sharedDefaultSettings;

    this.currentSettings = { ...this.defaultSettings };
  }

  async init(): Promise<void> {
    try {
      await this.loadSettings();
    } catch (error) {
      logger.error('Failed to initialize settings manager:', error);
      throw error;
    }
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
  private convertLegacyMdSearch(mdSearch: MdSearchEntry[]): { custom: SlashCommandEntry[]; mdSearchMentions: MentionEntry[] } {
    const custom: SlashCommandEntry[] = [];
    const mdSearchMentions: MentionEntry[] = [];

    for (const entry of mdSearch) {
      if (entry.type === 'command') {
        // Convert to SlashCommandEntry (without type field)
        const cmd: SlashCommandEntry = {
          name: entry.name,
          description: entry.description,
          path: entry.path,
          pattern: entry.pattern,
        };
        if (entry.argumentHint) cmd.argumentHint = entry.argumentHint;
        if (entry.maxSuggestions) cmd.maxSuggestions = entry.maxSuggestions;
        if (entry.sortOrder) cmd.sortOrder = entry.sortOrder;
        if (entry.prefixPattern) cmd.prefixPattern = entry.prefixPattern;
        custom.push(cmd);
      } else if (entry.type === 'mention') {
        // Convert to MentionEntry (without type field)
        const mention: MentionEntry = {
          name: entry.name,
          description: entry.description,
          path: entry.path,
          pattern: entry.pattern,
        };
        if (entry.maxSuggestions) mention.maxSuggestions = entry.maxSuggestions;
        if (entry.searchPrefix) mention.searchPrefix = entry.searchPrefix;
        if (entry.sortOrder) mention.sortOrder = entry.sortOrder;
        if (entry.inputFormat) mention.inputFormat = entry.inputFormat;
        mdSearchMentions.push(mention);
      }
    }

    return { custom, mdSearchMentions };
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

    // Handle mentions structure with deep merge (fileSearch, symbolSearch, mdSearch)
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
    // mdSearch: use user settings if provided, otherwise use defaults
    const mdSearch = userSettings.mentions?.mdSearch ?? this.defaultSettings.mentions?.mdSearch;
    if (mdSearch) {
      result.mentions.mdSearch = mdSearch;
    }

    // Handle slashCommands: use user settings if provided, otherwise use defaults
    const slashCommands = userSettings.slashCommands ?? this.defaultSettings.slashCommands;
    if (slashCommands) {
      result.slashCommands = slashCommands;
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

    // Handle legacy settings (mdSearch, builtInCommands) for backward compatibility
    if (userSettings.mdSearch && userSettings.mdSearch.length > 0) {
      const converted = this.convertLegacyMdSearch(userSettings.mdSearch);

      // If slashCommands not set, use converted custom
      if (!result.slashCommands && converted.custom.length > 0) {
        result.slashCommands = {
          custom: converted.custom
        };
      }
      // If mentions.mdSearch not set, use converted mdSearchMentions
      if (converted.mdSearchMentions.length > 0) {
        if (!result.mentions) {
          result.mentions = {};
        }
        if (!result.mentions.mdSearch || result.mentions.mdSearch.length === 0) {
          result.mentions.mdSearch = converted.mdSearchMentions;
        }
      }

      // Keep legacy mdSearch for backward compatibility
      result.mdSearch = userSettings.mdSearch;
    }

    // Handle legacy builtInCommands
    if (userSettings.builtInCommands?.tools) {
      // Merge into slashCommands.builtIn (convert tools array to direct builtIn array)
      if (!result.slashCommands) {
        result.slashCommands = {};
      }
      result.slashCommands.builtIn = userSettings.builtInCommands.tools;

      // Keep legacy builtInCommands for backward compatibility
      result.builtInCommands = userSettings.builtInCommands;
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

  getSlashCommandsSettings(): UserSettings['slashCommands'] {
    return this.currentSettings.slashCommands;
  }

  getMentionsSettings(): UserSettings['mentions'] {
    return this.currentSettings.mentions;
  }

  /**
   * Get mdSearch mentions for @ syntax
   * Returns from mentions.mdSearch (new structure)
   */
  getMdSearchMentions(): MentionEntry[] | undefined {
    return this.currentSettings.mentions?.mdSearch;
  }

  /**
   * Get built-in commands settings
   * Returns from slashCommands.builtIn (new) or builtInCommands.tools (legacy)
   */
  getBuiltInCommandsSettings(): string[] | undefined {
    return this.currentSettings.slashCommands?.builtIn || this.currentSettings.builtInCommands?.tools;
  }

  /**
   * Convert current settings to MdSearchEntry format for backward compatibility
   * This is used by MdSearchLoader
   */
  getMdSearchEntries(): UserSettings['mdSearch'] {
    // If legacy mdSearch exists, use it
    if (this.currentSettings.mdSearch && this.currentSettings.mdSearch.length > 0) {
      return this.currentSettings.mdSearch;
    }

    // Convert new format to legacy MdSearchEntry format
    const entries: MdSearchEntry[] = [];

    // Convert custom slash commands
    if (this.currentSettings.slashCommands?.custom) {
      for (const cmd of this.currentSettings.slashCommands.custom) {
        const entry: MdSearchEntry = {
          type: 'command',
          name: cmd.name,
          description: cmd.description,
          path: cmd.path,
          pattern: cmd.pattern,
        };
        // Only add optional properties if defined
        if (cmd.argumentHint !== undefined) entry.argumentHint = cmd.argumentHint;
        if (cmd.maxSuggestions !== undefined) entry.maxSuggestions = cmd.maxSuggestions;
        if (cmd.sortOrder !== undefined) entry.sortOrder = cmd.sortOrder;
        if (cmd.label !== undefined) entry.label = cmd.label;
        if (cmd.color !== undefined) entry.color = cmd.color;
        if (cmd.prefixPattern !== undefined) entry.prefixPattern = cmd.prefixPattern;
        entries.push(entry);
      }
    }

    // Convert mdSearch mentions (from mentions.mdSearch)
    const mdSearchMentions = this.currentSettings.mentions?.mdSearch;
    if (mdSearchMentions) {
      for (const mention of mdSearchMentions) {
        const entry: MdSearchEntry = {
          type: 'mention',
          name: mention.name,
          description: mention.description,
          path: mention.path,
          pattern: mention.pattern,
        };
        // Only add optional properties if defined
        if (mention.maxSuggestions !== undefined) entry.maxSuggestions = mention.maxSuggestions;
        if (mention.searchPrefix !== undefined) entry.searchPrefix = mention.searchPrefix;
        if (mention.sortOrder !== undefined) entry.sortOrder = mention.sortOrder;
        if (mention.inputFormat !== undefined) entry.inputFormat = mention.inputFormat;
        entries.push(entry);
      }
    }

    return entries;
  }

  getSettingsFilePath(): string {
    return this.settingsFile;
  }
}

export default SettingsManager;