import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import * as yaml from 'js-yaml';
import { EventEmitter } from 'events';
import chokidar, { type FSWatcher } from 'chokidar';
import { logger } from '../utils/utils';
import { defaultSettings as sharedDefaultSettings } from '../config/default-settings';
import { generateSettingsYaml } from '../config/settings-yaml-generator';
import pluginLoader from '../lib/plugin-loader';
import type {
  UserSettings,
  FileSearchSettings,
  SymbolSearchUserSettings,
  AgentSkillEntry,
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
      await this.readAndApplySettingsFile();
    } catch (error) {
      logger.error('Failed to load settings:', error);
      throw error;
    }
  }

  private async readAndApplySettingsFile(): Promise<void> {
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
        await this.trySaveSettings('Failed to save default settings after invalid format:');
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        logger.info('Settings file not found, creating with defaults');
        await this.trySaveSettings('Failed to create default settings file:');
      } else {
        logger.error('Failed to read settings file:', error);
        throw error;
      }
    }
  }

  private async trySaveSettings(errorMessage: string): Promise<void> {
    try {
      await this.saveSettings();
    } catch (saveError) {
      logger.error(errorMessage, saveError);
      // Continue with defaults in memory
    }
  }

  /**
   * Convert legacy mdSearch entries to new format
   * Separates command entries (/) and mention entries (@)
   */
  private convertLegacyCommandEntry(entry: CustomSearchEntry): AgentSkillEntry {
    const cmd: AgentSkillEntry = {
      name: entry.name,
      description: entry.description,
      path: entry.path,
      pattern: entry.pattern,
    };
    if (entry.argumentHint) cmd.argumentHint = entry.argumentHint;
    if (entry.maxSuggestions) cmd.maxSuggestions = entry.maxSuggestions;
    if (entry.orderBy) cmd.orderBy = entry.orderBy;
    if (entry.values) cmd.values = entry.values;
    if (entry.prefixPattern) cmd.prefixPattern = entry.prefixPattern;
    return cmd;
  }

  private convertLegacyMentionEntry(entry: CustomSearchEntry): MentionEntry {
    const mention: MentionEntry = {
      name: entry.name,
      description: entry.description,
      path: entry.path,
      pattern: entry.pattern,
    };
    if (entry.maxSuggestions) mention.maxSuggestions = entry.maxSuggestions;
    if (entry.searchPrefix) mention.searchPrefix = entry.searchPrefix;
    if (entry.orderBy) mention.orderBy = entry.orderBy;
    if (entry.displayTime !== undefined) mention.displayTime = entry.displayTime;
    if (entry.inputFormat) mention.inputFormat = entry.inputFormat;
    return mention;
  }

  private convertLegacyCustomSearch(mdSearch: CustomSearchEntry[]): { custom: AgentSkillEntry[]; customSearchMentions: MentionEntry[] } {
    const custom: AgentSkillEntry[] = [];
    const customSearchMentions: MentionEntry[] = [];

    for (const entry of mdSearch) {
      if (entry.type === 'command') {
        custom.push(this.convertLegacyCommandEntry(entry));
      } else if (entry.type === 'mention') {
        customSearchMentions.push(this.convertLegacyMentionEntry(entry));
      }
    }

    return { custom, customSearchMentions };
  }

  private resolveBuiltInCommands(userSettings: Partial<UserSettings>, rawAgentSkills: unknown): string[] {
    const defaultBuiltInCommands = this.defaultSettings.builtInCommands ?? ['claude'];

    if (Array.isArray(userSettings.builtInCommands)) {
      return userSettings.builtInCommands;
    }
    if (rawAgentSkills && !Array.isArray(rawAgentSkills) && typeof rawAgentSkills === 'object') {
      // Legacy: agentSkills is an object with builtInCommands
      const legacySkills = rawAgentSkills as Record<string, unknown>;
      if (Array.isArray(legacySkills.builtInCommands)) return legacySkills.builtInCommands as string[];
      if (Array.isArray(legacySkills.builtIn)) return legacySkills.builtIn as string[];
      return defaultBuiltInCommands;
    }
    if (userSettings.slashCommands?.builtInCommands) {
      return userSettings.slashCommands.builtInCommands;
    }
    const legacyBuiltIn = (userSettings as Record<string, unknown>).legacyBuiltInCommands as { tools?: string[] } | undefined;
    if (legacyBuiltIn) {
      return legacyBuiltIn.tools ?? defaultBuiltInCommands;
    }
    return defaultBuiltInCommands;
  }

  private resolveAgentSkills(userSettings: Partial<UserSettings>, rawAgentSkills: unknown): AgentSkillEntry[] {
    const defaultAgentSkills = this.defaultSettings.agentSkills ?? [];

    if (Array.isArray(userSettings.agentSkills)) {
      return userSettings.agentSkills;
    }
    if (rawAgentSkills && !Array.isArray(rawAgentSkills) && typeof rawAgentSkills === 'object') {
      // Legacy: agentSkills is an object with custom property
      const legacySkills = rawAgentSkills as Record<string, unknown>;
      if (Array.isArray(legacySkills.custom)) return legacySkills.custom as AgentSkillEntry[];
      return defaultAgentSkills;
    }
    if (userSettings.slashCommands?.custom) {
      return userSettings.slashCommands.custom;
    }
    return defaultAgentSkills;
  }

  private resolveLegacyMdSearch(result: UserSettings, mdSearch: CustomSearchEntry[]): void {
    const converted = this.convertLegacyCustomSearch(mdSearch);

    if (!result.agentSkills && converted.custom.length > 0) {
      result.agentSkills = converted.custom;
    }
    if (converted.customSearchMentions.length > 0 && (!result.customSearch || result.customSearch.length === 0)) {
      result.customSearch = converted.customSearchMentions;
    }
    result.mdSearch = mdSearch;
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
        },
        // Directories is an array - user setting replaces default entirely
        directories: userSettings.fileOpener?.directories ?? this.defaultSettings.fileOpener?.directories ?? []
      }
    };

    // Handle fileSearch with deep merge (top-level primary, mentions.fileSearch as legacy fallback)
    result.fileSearch = {
      ...this.defaultSettings.fileSearch,
      ...(userSettings.fileSearch || userSettings.mentions?.fileSearch || {})
    };

    // Handle symbolSearch with deep merge (top-level primary, mentions.symbolSearch as legacy fallback)
    result.symbolSearch = {
      ...this.defaultSettings.symbolSearch,
      ...(userSettings.symbolSearch || userSettings.mentions?.symbolSearch || {})
    };

    // Handle customSearch (top-level primary, mentions.customSearch/mdSearch as legacy fallback)
    const resolvedCustomSearch = userSettings.customSearch
      ?? userSettings.mentions?.customSearch
      ?? userSettings.mentions?.mdSearch
      ?? this.defaultSettings.customSearch;
    if (resolvedCustomSearch) {
      result.customSearch = resolvedCustomSearch;
    }

    // Handle mentionEnable/mentionDisable (top-level primary, mentions.enable/disable as legacy fallback)
    const resolvedMentionEnable = userSettings.mentionEnable ?? userSettings.mentions?.enable;
    if (resolvedMentionEnable) result.mentionEnable = resolvedMentionEnable;
    const resolvedMentionDisable = userSettings.mentionDisable ?? userSettings.mentions?.disable;
    if (resolvedMentionDisable) result.mentionDisable = resolvedMentionDisable;

    // Handle builtInCommands and agentSkills
    // Priority: root builtInCommands > legacy agentSkills.builtInCommands > legacy builtInCommands.tools > defaults
    const rawAgentSkills = userSettings.agentSkills as unknown;
    result.builtInCommands = this.resolveBuiltInCommands(userSettings, rawAgentSkills);
    result.agentSkills = this.resolveAgentSkills(userSettings, rawAgentSkills);

    // Handle legacy settings (mdSearch) for backward compatibility
    if (userSettings.mdSearch && userSettings.mdSearch.length > 0) {
      this.resolveLegacyMdSearch(result, userSettings.mdSearch);
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
   */
  getFileSearchSettings(): FileSearchSettings | undefined {
    const fileSearch = this.currentSettings.fileSearch;
    if (!fileSearch) {
      return undefined;
    }
    return fileSearch as FileSearchSettings;
  }

  /**
   * Check if file search is enabled
   */
  isFileSearchEnabled(): boolean {
    return !!this.currentSettings.fileSearch;
  }

  /**
   * Get symbol search settings
   */
  getSymbolSearchSettings(): SymbolSearchUserSettings | undefined {
    return this.currentSettings.symbolSearch;
  }

  async updateFileSearchSettings(fileSearch: Partial<NonNullable<UserSettings['fileSearch']>>): Promise<void> {
    await this.updateSettings({
      fileSearch: {
        ...(this.currentSettings.fileSearch || {}),
        ...(fileSearch || {})
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

  /** @deprecated Use getFileSearchSettings, getSymbolSearchSettings, getCustomSearchMentions instead */
  getMentionsSettings(): UserSettings['mentions'] {
    // Build legacy MentionsSettings from top-level fields for backward compatibility
    const result: NonNullable<UserSettings['mentions']> = {};
    if (this.currentSettings.fileSearch) result.fileSearch = this.currentSettings.fileSearch;
    if (this.currentSettings.symbolSearch) result.symbolSearch = this.currentSettings.symbolSearch;
    if (this.currentSettings.customSearch) result.customSearch = this.currentSettings.customSearch;
    if (this.currentSettings.mentionEnable) result.enable = this.currentSettings.mentionEnable;
    if (this.currentSettings.mentionDisable) result.disable = this.currentSettings.mentionDisable;
    return result;
  }

  /**
   * Get customSearch mentions for @ syntax
   */
  getCustomSearchMentions(): MentionEntry[] | undefined {
    return this.currentSettings.customSearch;
  }

  /**
   * Get built-in commands settings
   * Returns from root-level builtInCommands
   */
  getBuiltInCommandsSettings(): string[] | undefined {
    return this.currentSettings.builtInCommands;
  }

  private agentSkillToEntry(cmd: AgentSkillEntry): CustomSearchEntry {
    const entry: CustomSearchEntry = {
      type: 'command',
      name: cmd.name,
      description: cmd.description,
      path: cmd.path,
      pattern: cmd.pattern,
    };
    if (cmd.argumentHint !== undefined) entry.argumentHint = cmd.argumentHint;
    if (cmd.maxSuggestions !== undefined) entry.maxSuggestions = cmd.maxSuggestions;
    if (cmd.orderBy !== undefined) entry.orderBy = cmd.orderBy;
    if (cmd.label !== undefined) entry.label = cmd.label;
    if (cmd.color !== undefined) entry.color = cmd.color;
    if (cmd.icon !== undefined) entry.icon = cmd.icon;
    if (cmd.values !== undefined) entry.values = cmd.values;
    if (cmd.prefixPattern !== undefined) entry.prefixPattern = cmd.prefixPattern;
    if (cmd.triggers !== undefined) entry.triggers = cmd.triggers;
    if (cmd.enable !== undefined) entry.enable = cmd.enable;
    if (cmd.disable !== undefined) entry.disable = cmd.disable;
    return entry;
  }

  private mentionToEntry(mention: MentionEntry): CustomSearchEntry {
    const entry: CustomSearchEntry = {
      type: 'mention',
      name: mention.name,
      description: mention.description,
      path: mention.path,
      pattern: mention.pattern,
    };
    if (mention.maxSuggestions !== undefined) entry.maxSuggestions = mention.maxSuggestions;
    if (mention.searchPrefix !== undefined) entry.searchPrefix = mention.searchPrefix;
    if (mention.orderBy !== undefined) entry.orderBy = mention.orderBy;
    if (mention.displayTime !== undefined) entry.displayTime = mention.displayTime;
    if (mention.inputFormat !== undefined) entry.inputFormat = mention.inputFormat;
    if (mention.label !== undefined) entry.label = mention.label;
    if (mention.values !== undefined) entry.values = mention.values;
    if (mention.prefixPattern !== undefined) entry.prefixPattern = mention.prefixPattern;
    if (mention.color !== undefined) entry.color = mention.color;
    if (mention.icon !== undefined) entry.icon = mention.icon;
    if (mention.enable !== undefined) entry.enable = mention.enable;
    if (mention.disable !== undefined) entry.disable = mention.disable;
    if (mention.command !== undefined) entry.command = mention.command;
    return entry;
  }

  /**
   * Convert current settings to CustomSearchEntry format for backward compatibility
   * This is used by CustomSearchLoader
   */
  getCustomSearchEntries(): CustomSearchEntry[] {
    // If legacy mdSearch exists, use it
    if (this.currentSettings.legacyCustomSearch && this.currentSettings.legacyCustomSearch.length > 0) {
      return this.currentSettings.legacyCustomSearch;
    }
    if (this.currentSettings.mdSearch && this.currentSettings.mdSearch.length > 0) {
      return this.currentSettings.mdSearch;
    }

    // Convert current format to CustomSearchEntry format
    const entries: CustomSearchEntry[] = [];

    // Load entries from plugin YAML files (agent-skills and custom-search only)
    const enabledPlugins = this.getPluginSettings();
    if (enabledPlugins.length > 0) {
      const pluginEntries = pluginLoader.loadPluginEntries(enabledPlugins);
      entries.push(...pluginEntries);
    }

    // Merge inline settings entries (these take precedence for backward compatibility)
    const agentSkills = this.currentSettings.agentSkills;
    if (agentSkills && agentSkills.length > 0) {
      entries.push(...agentSkills.map(cmd => this.agentSkillToEntry(cmd)));
    }

    const customSearchMentions = this.currentSettings.customSearch;
    if (customSearchMentions) {
      entries.push(...customSearchMentions.map(mention => this.mentionToEntry(mention)));
    }

    return entries;
  }

  /**
   * Get enabled plugin paths from settings
   * Returns the plugins array or defaults if not configured
   */
  getPluginSettings(): string[] {
    return this.currentSettings.plugins || [];
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