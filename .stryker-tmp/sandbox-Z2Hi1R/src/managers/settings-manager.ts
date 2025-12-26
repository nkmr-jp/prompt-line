// @ts-nocheck
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import * as yaml from 'js-yaml';
import { logger } from '../utils/utils';
import type { UserSettings, FileSearchSettings } from '../types';

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
      // commands is optional - not set by default
      // fileSearch is optional - when undefined, file search feature is disabled
      // fileOpener is optional - when undefined, uses system default
      fileOpener: {
        extensions: {},
        defaultEditor: null
      },
      mdSearch: []
    };

    this.currentSettings = { ...this.defaultSettings };
  }

  async init(): Promise<void> {
    try {
      await this.loadSettings();
      logger.debug('Settings manager initialized successfully');
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
          logger.debug('Settings loaded from YAML file', { 
            file: this.settingsFile
          });
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
      // Use user's mdSearch if provided, otherwise use default (empty array)
      mdSearch: userSettings.mdSearch ?? this.defaultSettings.mdSearch ?? []
    };

    // Only set fileSearch if it exists in user settings (feature is disabled when undefined)
    if (userSettings.fileSearch) {
      result.fileSearch = userSettings.fileSearch;
    }

    // Set symbolSearch if it exists in user settings
    if (userSettings.symbolSearch) {
      result.symbolSearch = userSettings.symbolSearch;
    }

    return result;
  }

  async saveSettings(): Promise<void> {
    try {
      const settingsWithComments = this.addCommentsToSettings(this.currentSettings);
      
      // Set restrictive file permissions (owner read/write only)
      await fs.writeFile(this.settingsFile, settingsWithComments, { encoding: 'utf8', mode: 0o600 });
      logger.debug('Settings saved to YAML file', { file: this.settingsFile });
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

    // Helper to format mdSearch array
    const formatMdSearch = (mdSearch: UserSettings['mdSearch']): string => {
      if (!mdSearch || mdSearch.length === 0) return '';
      return '\n' + mdSearch.map(entry => `  - name: "${entry.name}"
    type: ${entry.type}
    description: "${entry.description || ''}"
    path: ${entry.path}
    pattern: "${entry.pattern}"${entry.argumentHint ? `\n    argumentHint: "${entry.argumentHint}"` : ''}
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

    // Build mdSearch section
    const mdSearchSection = settings.mdSearch && settings.mdSearch.length > 0
      ? `mdSearch:${formatMdSearch(settings.mdSearch)}`
      : `#mdSearch:                         # Slash commands & mentions (uncomment to enable)
#  # Pattern examples:
#  #   "*.md"                  - Root directory only
#  #   "**/*.md"               - All subdirectories (recursive)
#  #   "**/commands/*.md"      - Any "commands" subdirectory
#  #   "**/*/SKILL.md"         - SKILL.md in any subdirectory
#  #   "**/{cmd,agent}/*.md"   - Brace expansion (cmd or agent dirs)
#  #   "test-*.md"             - Wildcard prefix
#
#  - name: "{basename}"
#    type: command                     # 'command' for / or 'mention' for @
#    description: "{frontmatter@description}"
#    path: ~/.claude/commands
#    pattern: "*.md"
#    argumentHint: "{frontmatter@argument-hint}"  # Optional hint after selection
#    maxSuggestions: 20                # Max number of suggestions (default: 20)
#    inputFormat: name                 # 'name' for name only, 'path' for file path (default: name)
#
#  - name: "agent-{basename}"
#    type: mention
#    description: "{frontmatter@description}"
#    path: ~/.claude/agents
#    pattern: "*.md"
#    maxSuggestions: 20
#    searchPrefix: "agent:"            # Require @agent: prefix for this entry (optional)
#    inputFormat: path                 # 'name' for name only, 'path' for file path
#
#  - name: "{frontmatter@name}"
#    type: mention
#    description: "{frontmatter@description}"
#    path: ~/.claude/plugins
#    pattern: "**/*/SKILL.md"          # Match SKILL.md in any plugin subdirectory
#    maxSuggestions: 20
#    searchPrefix: "skill:"            # Require @skill: prefix for this entry`;

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
# MARKDOWN SEARCH SETTINGS (Slash Commands & Mentions)
# ============================================================================
# Configure sources for slash commands (/) and mentions (@)
# Template variables: {basename}, {frontmatter@fieldName}

${mdSearchSection}
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

  getSettingsFilePath(): string {
    return this.settingsFile;
  }
}

export default SettingsManager;