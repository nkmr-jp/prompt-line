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
      // fileSearch is optional - defaults below are applied when accessing
      fileSearch: {
        respectGitignore: true,
        excludePatterns: [],
        includePatterns: [],
        maxFiles: 5000,
        includeHidden: true,
        maxDepth: null,
        followSymlinks: false
      },
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
      await fs.mkdir(path.dirname(this.settingsFile), { recursive: true });

      try {
        const data = await fs.readFile(this.settingsFile, 'utf8');
        const parsed = yaml.load(data) as UserSettings;
        
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
      fileSearch: {
        ...this.defaultSettings.fileSearch,
        ...userSettings.fileSearch
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

    return result;
  }

  async saveSettings(): Promise<void> {
    try {
      const settingsWithComments = this.addCommentsToSettings(this.currentSettings);
      
      await fs.writeFile(this.settingsFile, settingsWithComments, 'utf8');
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
    maxSuggestions: ${entry.maxSuggestions ?? 20}${entry.searchPrefix ? `\n    searchPrefix: "${entry.searchPrefix}"` : ''}`).join('\n');
    };

    // Build excludePatterns section
    const excludePatternsSection = settings.fileSearch?.excludePatterns && settings.fileSearch.excludePatterns.length > 0
      ? `excludePatterns:${formatArrayAsList(settings.fileSearch.excludePatterns)}  # Additional exclude patterns`
      : `#excludePatterns:                  # Additional exclude patterns (uncomment to enable)
  #  - "*.log"
  #  - "*.tmp"`;

    // Build includePatterns section
    const includePatternsSection = settings.fileSearch?.includePatterns && settings.fileSearch.includePatterns.length > 0
      ? `includePatterns:${formatArrayAsList(settings.fileSearch.includePatterns)}  # Force include patterns (override .gitignore)`
      : `#includePatterns:                  # Force include patterns (uncomment to enable)
  #  - "dist/**/*.js"`;

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
#  - name: "{basename}"
#    type: command                     # 'command' for / or 'mention' for @
#    description: "{frontmatter@description}"
#    path: ~/.claude/commands
#    pattern: "*.md"                   # Glob pattern: *.md, **/*.md, SKILL.md
#    argumentHint: "{frontmatter@argument-hint}"  # Optional hint after selection
#    maxSuggestions: 20                # Max number of suggestions (default: 20)
#  - name: "agent-{basename}"
#    type: mention
#    description: "{frontmatter@description}"
#    path: ~/.claude/agents
#    pattern: "*.md"
#    maxSuggestions: 20
#    searchPrefix: "agent:"            # Require @agent: prefix for this entry (optional)`;

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
# FILE SEARCH SETTINGS (@ mentions)
# ============================================================================
# Note: fd command is required for file search (install: brew install fd)

fileSearch:
  respectGitignore: ${settings.fileSearch?.respectGitignore ?? true}    # Respect .gitignore files
  includeHidden: ${settings.fileSearch?.includeHidden ?? true}          # Include hidden files (starting with .)
  maxFiles: ${settings.fileSearch?.maxFiles ?? 5000}                    # Maximum files to return
  maxDepth: ${settings.fileSearch?.maxDepth ?? 'null'}                  # Directory depth limit (null = unlimited)
  followSymlinks: ${settings.fileSearch?.followSymlinks ?? false}       # Follow symbolic links
  ${excludePatternsSection}
  ${includePatternsSection}

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

  getFileSearchSettings(): FileSearchSettings {
    return {
      ...this.defaultSettings.fileSearch,
      ...this.currentSettings.fileSearch
    } as FileSearchSettings;
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