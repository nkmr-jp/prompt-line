import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import * as yaml from 'js-yaml';
import { logger } from '../utils/utils';
import type {
  UserSettings,
  FileSearchSettings,
  FileSearchUserSettings,
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

    this.defaultSettings = {
      shortcuts: {
        main: 'Cmd+Shift+Space',
        paste: 'Cmd+Enter',
        close: 'Escape',
        historyNext: 'Ctrl+j',
        historyPrev: 'Ctrl+k',
        search: 'Cmd+f'
      },
      window: {
        position: 'active-text-field',
        width: 600,
        height: 300
      },
      fileOpener: {
        extensions: {},
        defaultEditor: null
      }
      // slashCommands is optional - contains builtIn and userDefined
      // mentions is optional - contains fileSearch, symbolSearch, userDefined
    };

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
          await this.saveSettings();
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          logger.info('Settings file not found, creating with defaults');
          await this.saveSettings();
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
  private convertLegacyMdSearch(mdSearch: MdSearchEntry[]): { userDefined: SlashCommandEntry[]; mentions: MentionEntry[] } {
    const userDefined: SlashCommandEntry[] = [];
    const mentions: MentionEntry[] = [];

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
        userDefined.push(cmd);
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
        mentions.push(mention);
      }
    }

    return { userDefined, mentions };
  }

  private mergeWithDefaults(userSettings: Partial<UserSettings>): UserSettings {
    const result: UserSettings = {
      shortcuts: {
        ...this.defaultSettings.shortcuts,
        ...userSettings.shortcuts
      },
      window: {
        ...this.defaultSettings.window,
        ...userSettings.window
      },
      fileOpener: {
        ...this.defaultSettings.fileOpener,
        ...userSettings.fileOpener,
        // Deep merge for extensions object
        extensions: {
          ...this.defaultSettings.fileOpener?.extensions,
          ...userSettings.fileOpener?.extensions
        }
      }
    };

    // Handle new mentions structure (fileSearch, symbolSearch, userDefined)
    if (userSettings.mentions) {
      result.mentions = {
        ...userSettings.mentions
      };
    }

    // Handle slashCommands
    if (userSettings.slashCommands) {
      result.slashCommands = userSettings.slashCommands;
    }

    // Handle legacy fileSearch -> mentions.fileSearch
    if (userSettings.fileSearch) {
      if (!result.mentions) {
        result.mentions = {};
      }
      result.mentions.fileSearch = userSettings.fileSearch;
      // Keep legacy for backward compatibility
      result.fileSearch = userSettings.fileSearch;
    }

    // Handle legacy symbolSearch -> mentions.symbolSearch
    if (userSettings.symbolSearch) {
      if (!result.mentions) {
        result.mentions = {};
      }
      result.mentions.symbolSearch = userSettings.symbolSearch;
      // Keep legacy for backward compatibility
      result.symbolSearch = userSettings.symbolSearch;
    }

    // Handle legacy settings (mdSearch, builtInCommands) for backward compatibility
    if (userSettings.mdSearch && userSettings.mdSearch.length > 0) {
      const converted = this.convertLegacyMdSearch(userSettings.mdSearch);

      // If slashCommands not set, use converted userDefined
      if (!result.slashCommands && converted.userDefined.length > 0) {
        result.slashCommands = {
          userDefined: converted.userDefined
        };
      }
      // If mentions.userDefined not set, use converted mentions
      if (converted.mentions.length > 0) {
        if (!result.mentions) {
          result.mentions = {};
        }
        if (!result.mentions.userDefined || result.mentions.userDefined.length === 0) {
          result.mentions.userDefined = converted.mentions;
        }
      }

      // Keep legacy mdSearch for backward compatibility
      result.mdSearch = userSettings.mdSearch;
    }

    // Handle legacy builtInCommands
    if (userSettings.builtInCommands) {
      // Merge into slashCommands.builtIn
      if (!result.slashCommands) {
        result.slashCommands = {};
      }
      result.slashCommands.builtIn = userSettings.builtInCommands;

      // Keep legacy builtInCommands for backward compatibility
      result.builtInCommands = userSettings.builtInCommands;
    }

    return result;
  }

  async saveSettings(): Promise<void> {
    try {
      const settingsWithComments = this.addCommentsToSettings(this.currentSettings);
      
      // Set restrictive file permissions (owner read/write only)
      await fs.writeFile(this.settingsFile, settingsWithComments, { encoding: 'utf8', mode: 0o600 });
    } catch (error) {
      logger.error('Failed to save settings:', error);
      throw error;
    }
  }

  private addCommentsToSettings(settings: UserSettings): string {
    // Helper to format arrays for YAML output (list format)
    const formatArrayAsList = (arr: unknown[] | undefined, indent: string = '      '): string => {
      if (!arr || arr.length === 0) return '';
      return arr.map(item => `\n${indent}- "${item}"`).join('');
    };

    // Helper to format extensions object for YAML output (list format)
    const formatExtensionsAsList = (ext: Record<string, string> | undefined): string => {
      if (!ext || Object.keys(ext).length === 0) return '';
      return Object.entries(ext).map(([key, val]) => `\n    ${key}: "${val}"`).join('');
    };

    // Helper to format user-defined slash command entries
    const formatUserDefinedCommands = (commands: SlashCommandEntry[] | undefined): string => {
      if (!commands || commands.length === 0) return '';
      return '\n' + commands.map(entry => `    - name: "${entry.name}"
      description: "${entry.description || ''}"
      path: ${entry.path}
      pattern: "${entry.pattern}"${entry.argumentHint ? `\n      argumentHint: "${entry.argumentHint}"` : ''}
      maxSuggestions: ${entry.maxSuggestions ?? 20}`).join('\n');
    };

    // Helper to format userDefined mention entries (for mentions.userDefined)
    const formatUserDefinedMentions = (mentions: MentionEntry[] | undefined): string => {
      if (!mentions || mentions.length === 0) return '';
      return '\n' + mentions.map(entry => `    - name: "${entry.name}"
      description: "${entry.description || ''}"
      path: ${entry.path}
      pattern: "${entry.pattern}"
      maxSuggestions: ${entry.maxSuggestions ?? 20}${entry.searchPrefix ? `\n      searchPrefix: "${entry.searchPrefix}"` : ''}${entry.inputFormat ? `\n      inputFormat: ${entry.inputFormat}` : ''}`).join('\n');
    };

    // Get fileSearch settings from mentions.fileSearch or legacy fileSearch
    const getFileSearchSettings = (): FileSearchUserSettings | undefined => {
      return settings.mentions?.fileSearch || settings.fileSearch;
    };

    // Get symbolSearch settings from mentions.symbolSearch or legacy symbolSearch
    const getSymbolSearchSettings = (): SymbolSearchUserSettings | undefined => {
      return settings.mentions?.symbolSearch || settings.symbolSearch;
    };

    // Get userDefined mentions from mentions.userDefined
    const getUserDefinedMentions = (): MentionEntry[] | undefined => {
      return settings.mentions?.userDefined;
    };

    // Build extensions section
    const extensionsSection = settings.fileOpener?.extensions && Object.keys(settings.fileOpener.extensions).length > 0
      ? `extensions:${formatExtensionsAsList(settings.fileOpener.extensions)}`
      : `#extensions:                       # Extension-specific apps (uncomment to enable)
  #  ts: "WebStorm"
  #  md: "Typora"
  #  pdf: "Preview"`;

    // Build slashCommands section
    const buildSlashCommandsSection = (): string => {
      const hasBuiltIn = settings.slashCommands?.builtIn;
      const hasUserDefined = settings.slashCommands?.userDefined && settings.slashCommands.userDefined.length > 0;

      if (!hasBuiltIn && !hasUserDefined) {
        // No slash commands configured - output commented template
        return `#slashCommands:
#  # Built-in commands (Claude, Codex, Gemini, etc.)
#  builtIn:
#    enabled: true                     # Enable built-in slash commands
#    tools:                            # List of tools to enable
#      - claude
#      - codex
#      - gemini
#
#  # User-defined slash commands from markdown files
#  userDefined:
#    - name: "{basename}"
#      description: "{frontmatter@description}"
#      path: ~/.claude/commands
#      pattern: "*.md"
#      argumentHint: "{frontmatter@argument-hint}"
#      maxSuggestions: 20`;
      }

      // Build the section with actual values
      let section = 'slashCommands:\n';

      // Built-in section
      if (hasBuiltIn) {
        const tools = settings.slashCommands!.builtIn!.tools;
        const toolsSection = tools && tools.length > 0
          ? `tools:${tools.map(t => `\n      - ${t}`).join('')}`
          : `#tools:                            # List of tools to enable (all available when omitted)
    #  - claude
    #  - codex
    #  - gemini`;

        section += `  builtIn:
    enabled: ${settings.slashCommands!.builtIn!.enabled ?? false}
    ${toolsSection}`;
      } else {
        section += `  #builtIn:
  #  enabled: true
  #  tools:
  #    - claude`;
      }

      // User-defined section
      if (hasUserDefined) {
        section += `\n  userDefined:${formatUserDefinedCommands(settings.slashCommands!.userDefined)}`;
      } else {
        section += `
  #userDefined:
  #  - name: "{basename}"
  #    description: "{frontmatter@description}"
  #    path: ~/.claude/commands
  #    pattern: "*.md"`;
      }

      return section;
    };

    const slashCommandsSection = buildSlashCommandsSection();

    // Build unified mentions section (fileSearch, symbolSearch, userDefined)
    const buildMentionsSection = (): string => {
      const fileSearch = getFileSearchSettings();
      const symbolSearch = getSymbolSearchSettings();
      const userDefined = getUserDefinedMentions();

      const hasAnyMentionSettings = fileSearch || symbolSearch || (userDefined && userDefined.length > 0);

      if (!hasAnyMentionSettings) {
        // No mentions configured - output commented template
        return `#mentions:
#  # File search settings (@path/to/file completion)
#  # Note: fd command required (brew install fd)
#  fileSearch:
#    respectGitignore: true           # Respect .gitignore files
#    includeHidden: true              # Include hidden files
#    maxFiles: 5000                   # Maximum files to return
#    maxDepth: null                   # Directory depth (null = unlimited)
#    maxSuggestions: 50               # Suggestions to show
#    followSymlinks: false            # Follow symbolic links
#    #fdPath: null                    # Custom path to fd
#
#  # Symbol search settings (@ts:Config, @go:Handler)
#  # Note: ripgrep required (brew install ripgrep)
#  symbolSearch:
#    maxSymbols: 20000                # Maximum symbols to return
#    timeout: 5000                    # Search timeout in ms
#    #rgPaths:                        # Custom paths to rg
#    #  - /opt/homebrew/bin/rg
#
#  # User-defined mentions from markdown files
#  userDefined:
#    - name: "agent-{basename}"
#      description: "{frontmatter@description}"
#      path: ~/.claude/agents
#      pattern: "*.md"
#      searchPrefix: "agent:"`;
      }

      let section = 'mentions:\n';

      // File search subsection
      if (fileSearch) {
        const excludePatternsSection = fileSearch.excludePatterns && fileSearch.excludePatterns.length > 0
          ? `excludePatterns:${formatArrayAsList(fileSearch.excludePatterns)}`
          : `#excludePatterns:                # Additional exclude patterns
      #  - "*.log"`;

        const includePatternsSection = fileSearch.includePatterns && fileSearch.includePatterns.length > 0
          ? `includePatterns:${formatArrayAsList(fileSearch.includePatterns)}`
          : `#includePatterns:                # Force include patterns
      #  - "dist/**/*.js"`;

        const fdPathSection = fileSearch.fdPath
          ? `fdPath: "${fileSearch.fdPath}"`
          : `#fdPath: null                    # Custom path to fd`;

        section += `  # File search settings (@path/to/file completion)
  fileSearch:
    respectGitignore: ${fileSearch.respectGitignore ?? true}
    includeHidden: ${fileSearch.includeHidden ?? true}
    maxFiles: ${fileSearch.maxFiles ?? 5000}
    maxDepth: ${fileSearch.maxDepth ?? 'null'}
    maxSuggestions: ${fileSearch.maxSuggestions ?? 50}
    followSymlinks: ${fileSearch.followSymlinks ?? false}
    ${fdPathSection}
    ${excludePatternsSection}
    ${includePatternsSection}
`;
      } else {
        section += `  # File search settings (@path/to/file completion)
  # Note: Uncomment fileSearch section to enable file search
  #fileSearch:
  #  respectGitignore: true
  #  includeHidden: true
  #  maxFiles: 5000
  #  maxDepth: null
  #  maxSuggestions: 50
`;
      }

      // Symbol search subsection
      if (symbolSearch) {
        const rgPathsSection = symbolSearch.rgPaths && symbolSearch.rgPaths.length > 0
          ? `rgPaths:${symbolSearch.rgPaths.map(p => `\n      - ${p}`).join('')}`
          : `#rgPaths:                        # Custom paths to rg
    #  - /opt/homebrew/bin/rg`;

        section += `
  # Symbol search settings (@ts:Config, @go:Handler)
  symbolSearch:
    maxSymbols: ${symbolSearch.maxSymbols ?? 20000}
    timeout: ${symbolSearch.timeout ?? 5000}
    ${rgPathsSection}
`;
      } else {
        section += `
  # Symbol search settings (@ts:Config, @go:Handler)
  symbolSearch:
    maxSymbols: 20000
    timeout: 5000
    #rgPaths:
    #  - /opt/homebrew/bin/rg
`;
      }

      // User-defined mentions subsection
      if (userDefined && userDefined.length > 0) {
        section += `
  # User-defined mentions from markdown files
  userDefined:${formatUserDefinedMentions(userDefined)}`;
      } else {
        section += `
  # User-defined mentions from markdown files
  #userDefined:
  #  - name: "agent-{basename}"
  #    description: "{frontmatter@description}"
  #    path: ~/.claude/agents
  #    pattern: "*.md"
  #    searchPrefix: "agent:"`;
      }

      return section;
    };

    const mentionsSection = buildMentionsSection();

    return `# Prompt Line Settings Configuration
# This file is automatically generated but can be manually edited

# ============================================================================
# KEYBOARD SHORTCUTS
# ============================================================================
# Format: Modifier+Key (e.g., Cmd+Shift+Space, Ctrl+Alt+Space)
# Available modifiers: Cmd, Ctrl, Alt, Shift

shortcuts:
  main: ${settings.shortcuts.main}           # Show/hide the input window (global)
  paste: ${settings.shortcuts.paste}         # Paste text and close window
  close: ${settings.shortcuts.close}              # Close window without pasting
  historyNext: ${settings.shortcuts.historyNext}          # Navigate to next history item
  historyPrev: ${settings.shortcuts.historyPrev}          # Navigate to previous history item
  search: ${settings.shortcuts.search}            # Enable search mode in history

# ============================================================================
# WINDOW SETTINGS
# ============================================================================
# Position options:
#   - active-text-field: Near focused text field (default, falls back to active-window-center)
#   - active-window-center: Center within active window
#   - cursor: At mouse cursor location
#   - center: Center on primary display

window:
  position: ${settings.window.position}
  width: ${settings.window.width}                      # Recommended: 400-800 pixels
  height: ${settings.window.height}                     # Recommended: 200-400 pixels

# ============================================================================
# FILE OPENER SETTINGS
# ============================================================================
# Configure which applications to use when opening file links
# When defaultEditor is null, system default application is used

fileOpener:
  # Default editor for all files (null = use system default application)
  # Example values: "Visual Studio Code", "Sublime Text", "WebStorm"
  defaultEditor: ${settings.fileOpener?.defaultEditor === null || settings.fileOpener?.defaultEditor === undefined ? 'null' : `"${settings.fileOpener.defaultEditor}"`}
  # Extension-specific applications (overrides defaultEditor)
  ${extensionsSection}

# ============================================================================
# SLASH COMMAND SETTINGS
# ============================================================================
# Configure slash commands (/) for quick actions
# Template variables: {basename}, {frontmatter@fieldName}

${slashCommandsSection}

# ============================================================================
# MENTION SETTINGS (@ mentions)
# ============================================================================
# Configure @ mention sources: fileSearch, symbolSearch, userDefined
# Template variables for userDefined: {basename}, {frontmatter@fieldName}

${mentionsSection}
`;
  }

  getSettings(): UserSettings {
    return { ...this.currentSettings };
  }

  async updateSettings(newSettings: Partial<UserSettings>): Promise<void> {
    try {
      this.currentSettings = this.mergeWithDefaults({
        ...this.currentSettings,
        ...newSettings
      });

      await this.saveSettings();
      logger.info('Settings updated successfully');
    } catch (error) {
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
    return {
      shortcuts: { ...this.defaultSettings.shortcuts },
      window: { ...this.defaultSettings.window },
      fileOpener: {
        extensions: { ...this.defaultSettings.fileOpener?.extensions },
        defaultEditor: this.defaultSettings.fileOpener?.defaultEditor ?? null
      }
    };
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
          ...currentMentions.fileSearch,
          ...fileSearch
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
   * Get user-defined mentions for @ syntax
   * Returns from mentions.userDefined (new structure)
   */
  getUserDefinedMentions(): MentionEntry[] | undefined {
    return this.currentSettings.mentions?.userDefined;
  }

  /**
   * Get built-in commands settings
   * Returns from slashCommands.builtIn (new) or builtInCommands (legacy)
   */
  getBuiltInCommandsSettings(): { enabled?: boolean; tools?: string[] } | undefined {
    return this.currentSettings.slashCommands?.builtIn || this.currentSettings.builtInCommands;
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

    // Convert userDefined slash commands
    if (this.currentSettings.slashCommands?.userDefined) {
      for (const cmd of this.currentSettings.slashCommands.userDefined) {
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
        entries.push(entry);
      }
    }

    // Convert userDefined mentions (from mentions.userDefined)
    const userDefined = this.currentSettings.mentions?.userDefined;
    if (userDefined) {
      for (const mention of userDefined) {
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