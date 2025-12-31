import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import * as yaml from 'js-yaml';
import { logger } from '../utils/utils';
import type {
  UserSettings,
  FileSearchSettings,
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
      // fileSearch is optional - when undefined, file search feature is disabled
      // fileOpener is optional - when undefined, uses system default
      fileOpener: {
        extensions: {},
        defaultEditor: null
      },
      // New settings structure
      // slashCommands is optional - contains builtIn and userDefined
      // mentions is optional - @ mention sources
      mentions: []
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
        if (entry.inputFormat) cmd.inputFormat = entry.inputFormat;
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
      },
      // Initialize mentions with empty array
      mentions: []
    };

    // Only set fileSearch if it exists in user settings (feature is disabled when undefined)
    if (userSettings.fileSearch) {
      result.fileSearch = userSettings.fileSearch;
    }

    // Set symbolSearch if it exists in user settings
    if (userSettings.symbolSearch) {
      result.symbolSearch = userSettings.symbolSearch;
    }

    // Handle new settings structure (slashCommands, mentions)
    if (userSettings.slashCommands) {
      result.slashCommands = userSettings.slashCommands;
    }
    if (userSettings.mentions && userSettings.mentions.length > 0) {
      result.mentions = userSettings.mentions;
    }

    // Handle legacy settings (mdSearch, builtInCommands) for backward compatibility
    // Only convert if new settings are not provided
    if (userSettings.mdSearch && userSettings.mdSearch.length > 0) {
      const converted = this.convertLegacyMdSearch(userSettings.mdSearch);

      // If slashCommands not set, use converted userDefined
      if (!result.slashCommands && converted.userDefined.length > 0) {
        result.slashCommands = {
          userDefined: converted.userDefined
        };
      }
      // If mentions not set, use converted mentions
      if ((!result.mentions || result.mentions.length === 0) && converted.mentions.length > 0) {
        result.mentions = converted.mentions;
      }

      // Keep legacy mdSearch for backward compatibility with existing code
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
    const formatArrayAsList = (arr: unknown[] | undefined, indent: string = '    '): string => {
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
      maxSuggestions: ${entry.maxSuggestions ?? 20}${entry.inputFormat ? `\n      inputFormat: ${entry.inputFormat}` : ''}`).join('\n');
    };

    // Helper to format mention entries
    const formatMentions = (mentions: MentionEntry[] | undefined): string => {
      if (!mentions || mentions.length === 0) return '';
      return '\n' + mentions.map(entry => `  - name: "${entry.name}"
    description: "${entry.description || ''}"
    path: ${entry.path}
    pattern: "${entry.pattern}"
    maxSuggestions: ${entry.maxSuggestions ?? 20}${entry.searchPrefix ? `\n    searchPrefix: "${entry.searchPrefix}"` : ''}${entry.inputFormat ? `\n    inputFormat: ${entry.inputFormat}` : ''}`).join('\n');
    };

    // Build fileSearch section - if fileSearch is defined, output values; otherwise comment out entire section
    const buildFileSearchSection = (): string => {
      if (!settings.fileSearch) {
        // Feature is disabled - output commented template
        return `#fileSearch:                        # File search for @ mentions (uncomment to enable)
#  respectGitignore: true             # Respect .gitignore files
#  includeHidden: true                # Include hidden files (starting with .)
#  maxFiles: 5000                     # Maximum files to return
#  maxDepth: null                     # Directory depth limit (null = unlimited)
#  maxSuggestions: 50                 # Maximum suggestions to show (default: 50)
#  followSymlinks: false              # Follow symbolic links
#  fdPath: null                       # Custom path to fd command (null = auto-detect)
#  #excludePatterns:                  # Additional exclude patterns
#  #  - "*.log"
#  #  - "*.tmp"
#  #includePatterns:                  # Force include patterns (override .gitignore)
#  #  - "dist/**/*.js"`;
      }

      // Feature is enabled - output actual values
      const excludePatternsSection = settings.fileSearch.excludePatterns && settings.fileSearch.excludePatterns.length > 0
        ? `excludePatterns:${formatArrayAsList(settings.fileSearch.excludePatterns)}  # Additional exclude patterns`
        : `#excludePatterns:                  # Additional exclude patterns (uncomment to enable)
  #  - "*.log"
  #  - "*.tmp"`;

      const includePatternsSection = settings.fileSearch.includePatterns && settings.fileSearch.includePatterns.length > 0
        ? `includePatterns:${formatArrayAsList(settings.fileSearch.includePatterns)}  # Force include patterns (override .gitignore)`
        : `#includePatterns:                  # Force include patterns (uncomment to enable)
  #  - "dist/**/*.js"`;

      const fdPathSection = settings.fileSearch.fdPath
        ? `fdPath: "${settings.fileSearch.fdPath}"                       # Custom path to fd command`
        : `#fdPath: null                       # Custom path to fd command (null = auto-detect)`;

      return `fileSearch:
  respectGitignore: ${settings.fileSearch.respectGitignore ?? true}    # Respect .gitignore files
  includeHidden: ${settings.fileSearch.includeHidden ?? true}          # Include hidden files (starting with .)
  maxFiles: ${settings.fileSearch.maxFiles ?? 5000}                    # Maximum files to return
  maxDepth: ${settings.fileSearch.maxDepth ?? 'null'}                  # Directory depth limit (null = unlimited)
  maxSuggestions: ${settings.fileSearch.maxSuggestions ?? 50}          # Maximum suggestions to show (default: 50)
  followSymlinks: ${settings.fileSearch.followSymlinks ?? false}       # Follow symbolic links
  ${fdPathSection}
  ${excludePatternsSection}
  ${includePatternsSection}`;
    };

    const fileSearchSection = buildFileSearchSection();

    // Build symbolSearch section
    const buildSymbolSearchSection = (): string => {
      if (!settings.symbolSearch) {
        // Feature uses defaults - output commented template with default values
        return `symbolSearch:
  maxSymbols: 20000                   # Maximum symbols to return (default: 20000)
  timeout: 5000                       # Search timeout in milliseconds (default: 5000)
  #rgPaths:                           # Custom paths to rg command (uncomment to override auto-detection)
  #  - /opt/homebrew/bin/rg
  #  - /usr/local/bin/rg`;
      }

      // Feature has custom settings - output actual values
      const rgPathsSection = settings.symbolSearch.rgPaths && settings.symbolSearch.rgPaths.length > 0
        ? `rgPaths:${settings.symbolSearch.rgPaths.map(p => `\n    - ${p}`).join('')}`
        : `#rgPaths:                           # Custom paths to rg command (uncomment to override auto-detection)
  #  - /opt/homebrew/bin/rg
  #  - /usr/local/bin/rg`;

      return `symbolSearch:
  maxSymbols: ${settings.symbolSearch.maxSymbols ?? 20000}                   # Maximum symbols to return (default: 20000)
  timeout: ${settings.symbolSearch.timeout ?? 5000}                       # Search timeout in milliseconds (default: 5000)
  ${rgPathsSection}`;
    };

    const symbolSearchSection = buildSymbolSearchSection();

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
#      maxSuggestions: 20
#      inputFormat: name               # 'name' for name only, 'path' for file path`;
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

    // Build mentions section
    const buildMentionsSection = (): string => {
      if (!settings.mentions || settings.mentions.length === 0) {
        // No mentions configured - output commented template
        return `#mentions:
#  - name: "agent-{basename}"
#    description: "{frontmatter@description}"
#    path: ~/.claude/agents
#    pattern: "*.md"
#    maxSuggestions: 20
#    searchPrefix: "agent:"            # Require @agent: prefix for this entry
#    inputFormat: path
#
#  - name: "{frontmatter@name}"
#    description: "{frontmatter@description}"
#    path: ~/.claude/plugins
#    pattern: "**/*/SKILL.md"
#    maxSuggestions: 20
#    searchPrefix: "skill:"`;
      }

      return `mentions:${formatMentions(settings.mentions)}`;
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
# FILE SEARCH SETTINGS (@ mentions)
# ============================================================================
# Note: fd command is required for file search (install: brew install fd)
# When this section is commented out, file search feature is disabled

${fileSearchSection}

# ============================================================================
# SYMBOL SEARCH SETTINGS (Code Search)
# ============================================================================
# Configure symbol search behavior for @<language>:<query> syntax
# Note: ripgrep (rg) command is required (install: brew install ripgrep)
# Note: File search must be enabled for symbol search to work

${symbolSearchSection}

# ============================================================================
# SLASH COMMAND SETTINGS
# ============================================================================
# Configure slash commands (/) for quick actions
# Template variables: {basename}, {frontmatter@fieldName}

${slashCommandsSection}

# ============================================================================
# MENTION SETTINGS (@ mentions)
# ============================================================================
# Configure mention sources for @ syntax (e.g., @agent:, @skill:)
# Template variables: {basename}, {frontmatter@fieldName}

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
      fileSearch: { ...this.defaultSettings.fileSearch },
      fileOpener: {
        extensions: { ...this.defaultSettings.fileOpener?.extensions },
        defaultEditor: this.defaultSettings.fileOpener?.defaultEditor ?? null
      }
    };
  }

  getFileSearchSettings(): FileSearchSettings | undefined {
    // Return undefined if fileSearch is not configured (feature disabled)
    if (!this.currentSettings.fileSearch) {
      return undefined;
    }
    return this.currentSettings.fileSearch as FileSearchSettings;
  }

  isFileSearchEnabled(): boolean {
    return this.currentSettings.fileSearch !== undefined;
  }

  getSymbolSearchSettings(): UserSettings['symbolSearch'] {
    return this.currentSettings.symbolSearch;
  }

  async updateFileSearchSettings(fileSearch: Partial<NonNullable<UserSettings['fileSearch']>>): Promise<void> {
    await this.updateSettings({
      fileSearch: {
        ...this.currentSettings.fileSearch,
        ...fileSearch
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
        if (cmd.inputFormat !== undefined) entry.inputFormat = cmd.inputFormat;
        entries.push(entry);
      }
    }

    // Convert mentions
    if (this.currentSettings.mentions) {
      for (const mention of this.currentSettings.mentions) {
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