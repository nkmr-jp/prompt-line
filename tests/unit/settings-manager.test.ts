import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import SettingsManager from '../../src/managers/settings-manager';
import type { UserSettings } from '../../src/types';

// Mock fs module
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn()
  }
}));

// Mock utils
jest.mock('../../src/utils/utils', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

// Mock js-yaml
jest.mock('js-yaml', () => ({
  load: jest.fn((data: string) => {
    if (data.includes('main: Alt+Space')) {
      return {
        shortcuts: { main: 'Alt+Space', paste: 'Enter', close: 'Escape', search: 'Cmd+f' },
        window: { position: 'center', width: 800, height: 400 }
      };
    }
    return null;
  }),
  dump: jest.fn((data: unknown) => {
    const yaml = `shortcuts:
  main: ${(data as any).shortcuts.main}
  paste: ${(data as any).shortcuts.paste}
  close: ${(data as any).shortcuts.close}
window:
  position: ${(data as any).window.position}
  width: ${(data as any).window.width}
  height: ${(data as any).window.height}`;
    return yaml;
  })
}));

const mockedFs = fs as jest.Mocked<typeof fs>;

describe('SettingsManager', () => {
  let settingsManager: SettingsManager;
  const settingsPath = path.join(os.homedir(), '.prompt-line', 'settings.yml');

  beforeEach(() => {
    jest.clearAllMocks();
    settingsManager = new SettingsManager();
  });

  describe('initialization', () => {
    it('should create settings directory and initialize with defaults when no file exists', async () => {
      mockedFs.readFile.mockRejectedValue({ code: 'ENOENT' });
      mockedFs.mkdir.mockResolvedValue(undefined);
      mockedFs.writeFile.mockResolvedValue();

      await settingsManager.init();

      expect(mockedFs.mkdir).toHaveBeenCalledWith(path.dirname(settingsPath), { recursive: true, mode: 0o700 });
      expect(mockedFs.writeFile).toHaveBeenCalled();
    });

    it('should load existing settings file', async () => {
      mockedFs.mkdir.mockResolvedValue(undefined);
      const yamlSettings = `shortcuts:
  main: Alt+Space
  paste: Enter
  close: Escape
window:
  position: center
  width: 800
  height: 400`;
      mockedFs.readFile.mockResolvedValue(yamlSettings);

      await settingsManager.init();

      const settings = settingsManager.getSettings();
      expect(settings.shortcuts.main).toBe('Alt+Space');
      expect(settings.window.position).toBe('center');
    });

    it('should handle corrupted settings file and use defaults', async () => {
      mockedFs.mkdir.mockResolvedValue(undefined);
      mockedFs.readFile.mockResolvedValue('invalid json');
      mockedFs.writeFile.mockResolvedValue();

      await settingsManager.init();

      const settings = settingsManager.getSettings();
      expect(settings.shortcuts.main).toBe('Cmd+Shift+Space');
      expect(settings.window.position).toBe('active-text-field');
    });
  });

  describe('settings management', () => {
    beforeEach(async () => {
      mockedFs.readFile.mockRejectedValue({ code: 'ENOENT' });
      mockedFs.mkdir.mockResolvedValue(undefined);
      mockedFs.writeFile.mockResolvedValue();
      await settingsManager.init();
    });

    it('should return default settings', () => {
      const settings = settingsManager.getSettings();

      // includes all default values: shortcuts, window, fileOpener, slashCommands, mentions
      expect(settings).toEqual({
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
          extensions: {
            png: 'Preview',
            pdf: 'Preview'
          },
          defaultEditor: null
        },
        slashCommands: {
          builtIn: ['claude'],
          custom: [
            {
              name: '{basename}',
              description: '{frontmatter@description}',
              path: '~/.claude/commands',
              pattern: '*.md',
              argumentHint: '{frontmatter@argument-hint}',
              maxSuggestions: 20
            },
            {
              name: '{prefix}:{basename}',
              description: '{frontmatter@description}',
              path: '~/.claude/plugins/cache',
              pattern: '**/commands/*.md',
              prefixPattern: '**/.claude-plugin/plugin.json@name',
              label: 'plugin',
              color: 'red',
              argumentHint: '{frontmatter@argument-hint}',
              maxSuggestions: 20
            },
            {
              name: '{frontmatter@name}',
              description: '{frontmatter@description}',
              path: '~/.claude/skills',
              label: 'skill',
              color: 'teal',
              pattern: '**/*/SKILL.md'
            }
          ]
        },
        mentions: {
          fileSearch: {
            respectGitignore: true,
            includeHidden: true,
            maxFiles: 5000,
            maxDepth: null,
            maxSuggestions: 50,
            followSymlinks: false,
            includePatterns: [],
            excludePatterns: []
          },
          symbolSearch: {
            maxSymbols: 200000,
            timeout: 60000,
            includePatterns: [],
            excludePatterns: []
          },
          mdSearch: [
            {
              name: 'agent-{basename}',
              description: '{frontmatter@description}',
              path: '~/.claude/agents',
              pattern: '*.md',
              searchPrefix: 'agent'
            }
          ]
        }
      });
    });

    it('should update settings partially', async () => {
      const partialUpdate: Partial<UserSettings> = {
        shortcuts: {
          main: 'Ctrl+Shift+P',
          paste: 'Enter',
          close: 'Escape',
          historyNext: 'Ctrl+j',
          historyPrev: 'Ctrl+k',
          search: 'Cmd+f'
        }
      };

      await settingsManager.updateSettings(partialUpdate);

      const settings = settingsManager.getSettings();
      expect(settings.shortcuts.main).toBe('Ctrl+Shift+P');
      expect(settings.window.width).toBe(600); // Should remain unchanged
    });

    it('should reset settings to defaults', async () => {
      // First update settings
      await settingsManager.updateSettings({
        window: { position: 'center', width: 800, height: 400 }
      });

      // Then reset
      await settingsManager.resetSettings();

      const settings = settingsManager.getSettings();
      expect(settings.window.position).toBe('active-text-field');
      expect(settings.window.width).toBe(600);
    });
  });

  describe('specific settings sections', () => {
    beforeEach(async () => {
      mockedFs.readFile.mockRejectedValue({ code: 'ENOENT' });
      mockedFs.mkdir.mockResolvedValue(undefined);
      mockedFs.writeFile.mockResolvedValue();
      await settingsManager.init();
    });

    it('should get and update shortcuts', async () => {
      const shortcuts = settingsManager.getShortcuts();
      expect(shortcuts.main).toBe('Cmd+Shift+Space');

      await settingsManager.updateShortcuts({ main: 'Alt+Space' });
      
      const updatedShortcuts = settingsManager.getShortcuts();
      expect(updatedShortcuts.main).toBe('Alt+Space');
    });

    it('should get and update window settings', async () => {
      const windowSettings = settingsManager.getWindowSettings();
      expect(windowSettings.position).toBe('active-text-field');

      await settingsManager.updateWindowSettings({ position: 'center', width: 800 });
      
      const updatedWindowSettings = settingsManager.getWindowSettings();
      expect(updatedWindowSettings.position).toBe('center');
      expect(updatedWindowSettings.width).toBe(800);
      expect(updatedWindowSettings.height).toBe(300); // Should remain unchanged
    });

  });

  describe('utility methods', () => {
    beforeEach(async () => {
      mockedFs.readFile.mockRejectedValue({ code: 'ENOENT' });
      mockedFs.mkdir.mockResolvedValue(undefined);
      mockedFs.writeFile.mockResolvedValue();
      await settingsManager.init();
    });

    it('should return default settings copy', () => {
      const defaults = settingsManager.getDefaultSettings();

      // includes all default values: shortcuts, window, fileOpener, slashCommands, mentions
      expect(defaults).toEqual({
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
          extensions: {
            png: 'Preview',
            pdf: 'Preview'
          },
          defaultEditor: null
        },
        slashCommands: {
          builtIn: ['claude'],
          custom: [
            {
              name: '{basename}',
              description: '{frontmatter@description}',
              path: '~/.claude/commands',
              pattern: '*.md',
              argumentHint: '{frontmatter@argument-hint}',
              maxSuggestions: 20
            },
            {
              name: '{prefix}:{basename}',
              description: '{frontmatter@description}',
              path: '~/.claude/plugins/cache',
              pattern: '**/commands/*.md',
              prefixPattern: '**/.claude-plugin/plugin.json@name',
              label: 'plugin',
              color: 'red',
              argumentHint: '{frontmatter@argument-hint}',
              maxSuggestions: 20
            },
            {
              name: '{frontmatter@name}',
              description: '{frontmatter@description}',
              path: '~/.claude/skills',
              label: 'skill',
              color: 'teal',
              pattern: '**/*/SKILL.md'
            }
          ]
        },
        mentions: {
          fileSearch: {
            respectGitignore: true,
            includeHidden: true,
            maxFiles: 5000,
            maxDepth: null,
            maxSuggestions: 50,
            followSymlinks: false,
            includePatterns: [],
            excludePatterns: []
          },
          symbolSearch: {
            maxSymbols: 200000,
            timeout: 60000,
            includePatterns: [],
            excludePatterns: []
          },
          mdSearch: [
            {
              name: 'agent-{basename}',
              description: '{frontmatter@description}',
              path: '~/.claude/agents',
              pattern: '*.md',
              searchPrefix: 'agent'
            }
          ]
        }
      });

      // Ensure it's a copy and not reference
      const originalMain = defaults.shortcuts.main;
      defaults.shortcuts.main = 'modified';
      const newDefaults = settingsManager.getDefaultSettings();
      expect(newDefaults.shortcuts.main).toBe(originalMain);
    });

    it('should return settings file path', () => {
      const filePath = settingsManager.getSettingsFilePath();
      expect(filePath).toBe(settingsPath);
    });
  });

  describe('error handling', () => {
    it('should handle file write errors during update', async () => {
      mockedFs.readFile.mockRejectedValue({ code: 'ENOENT' });
      mockedFs.mkdir.mockResolvedValue(undefined);
      mockedFs.writeFile.mockResolvedValue(); // First initialization succeeds

      await settingsManager.init();

      // Now make write fail for update
      mockedFs.writeFile.mockRejectedValue(new Error('Write failed'));

      await expect(settingsManager.updateSettings({
        window: { position: 'center', width: 800, height: 400 }
      })).rejects.toThrow('Write failed');
    });

    it('should handle directory creation errors', async () => {
      mockedFs.mkdir.mockRejectedValue(new Error('Permission denied'));

      await expect(settingsManager.init()).rejects.toThrow('Permission denied');
    });
  });

  describe('deep merge functionality', () => {
    beforeEach(async () => {
      mockedFs.readFile.mockRejectedValue({ code: 'ENOENT' });
      mockedFs.mkdir.mockResolvedValue(undefined);
      mockedFs.writeFile.mockResolvedValue();
      await settingsManager.init();
    });

    it('should deep merge mentions.fileSearch with defaults', async () => {
      // User only specifies maxFiles, should get all other defaults
      const userSettings: Partial<UserSettings> = {
        mentions: {
          fileSearch: {
            maxFiles: 1000
          }
        }
      };

      await settingsManager.updateSettings(userSettings);
      const settings = settingsManager.getSettings();

      // Check that maxFiles was updated
      expect(settings.mentions?.fileSearch?.maxFiles).toBe(1000);

      // Check that all other defaults are preserved
      expect(settings.mentions?.fileSearch?.respectGitignore).toBe(true);
      expect(settings.mentions?.fileSearch?.includeHidden).toBe(true);
      expect(settings.mentions?.fileSearch?.maxDepth).toBeNull();
      expect(settings.mentions?.fileSearch?.maxSuggestions).toBe(50);
      expect(settings.mentions?.fileSearch?.followSymlinks).toBe(false);
      expect(settings.mentions?.fileSearch?.includePatterns).toEqual([]);
      expect(settings.mentions?.fileSearch?.excludePatterns).toEqual([]);
    });

    it('should deep merge mentions.symbolSearch with defaults', async () => {
      // User only specifies timeout, should get maxSymbols from defaults
      const userSettings: Partial<UserSettings> = {
        mentions: {
          symbolSearch: {
            timeout: 3000
          }
        }
      };

      await settingsManager.updateSettings(userSettings);
      const settings = settingsManager.getSettings();

      // Check that timeout was updated
      expect(settings.mentions?.symbolSearch?.timeout).toBe(3000);

      // Check that maxSymbols defaults are preserved
      expect(settings.mentions?.symbolSearch?.maxSymbols).toBe(200000);
    });

    it('should migrate legacy fileSearch to mentions.fileSearch with deep merge', async () => {
      // User has old fileSearch format, should migrate and merge with defaults
      const userSettings: Partial<UserSettings> = {
        fileSearch: {
          maxFiles: 1000,
          respectGitignore: false
        }
      };

      await settingsManager.updateSettings(userSettings);
      const settings = settingsManager.getSettings();

      // Check that legacy fileSearch was migrated to mentions.fileSearch
      expect(settings.mentions?.fileSearch?.maxFiles).toBe(1000);
      expect(settings.mentions?.fileSearch?.respectGitignore).toBe(false);

      // Check that other defaults are preserved
      expect(settings.mentions?.fileSearch?.includeHidden).toBe(true);
      expect(settings.mentions?.fileSearch?.maxSuggestions).toBe(50);
      expect(settings.mentions?.fileSearch?.followSymlinks).toBe(false);

      // Check that legacy fileSearch is kept for backward compatibility
      expect(settings.fileSearch).toEqual({
        maxFiles: 1000,
        respectGitignore: false
      });
    });

    it('should migrate builtInCommands.tools to slashCommands.builtIn', async () => {
      // User has builtInCommands: { tools: ['claude'] }
      // Should convert to slashCommands.builtIn: ['claude']
      const userSettings: Partial<UserSettings> = {
        builtInCommands: {
          tools: ['claude', 'custom-tool']
        }
      };

      await settingsManager.updateSettings(userSettings);
      const settings = settingsManager.getSettings();

      // Check that builtInCommands.tools was migrated to slashCommands.builtIn
      expect(settings.slashCommands?.builtIn).toEqual(['claude', 'custom-tool']);

      // Check that legacy builtInCommands is kept for backward compatibility
      expect(settings.builtInCommands).toEqual({
        tools: ['claude', 'custom-tool']
      });
    });

    it('should deep merge multiple fileSearch properties', async () => {
      // User specifies multiple properties
      const userSettings: Partial<UserSettings> = {
        mentions: {
          fileSearch: {
            maxFiles: 2000,
            respectGitignore: false,
            includeHidden: false,
            maxSuggestions: 100
          }
        }
      };

      await settingsManager.updateSettings(userSettings);
      const settings = settingsManager.getSettings();

      // Check that all user-specified properties were updated
      expect(settings.mentions?.fileSearch?.maxFiles).toBe(2000);
      expect(settings.mentions?.fileSearch?.respectGitignore).toBe(false);
      expect(settings.mentions?.fileSearch?.includeHidden).toBe(false);
      expect(settings.mentions?.fileSearch?.maxSuggestions).toBe(100);

      // Check that non-specified defaults are preserved
      expect(settings.mentions?.fileSearch?.maxDepth).toBeNull();
      expect(settings.mentions?.fileSearch?.followSymlinks).toBe(false);
      expect(settings.mentions?.fileSearch?.includePatterns).toEqual([]);
      expect(settings.mentions?.fileSearch?.excludePatterns).toEqual([]);
    });

    it('should handle partial symbolSearch updates while preserving other mentions settings', async () => {
      // First set fileSearch settings
      await settingsManager.updateSettings({
        mentions: {
          fileSearch: {
            maxFiles: 1000
          }
        }
      });

      // Get current settings to preserve fileSearch
      const currentSettings = settingsManager.getSettings();
      const currentFileSearch = currentSettings.mentions?.fileSearch;

      // Then update symbolSearch while preserving fileSearch
      if (currentFileSearch) {
        await settingsManager.updateSettings({
          mentions: {
            fileSearch: currentFileSearch,
            symbolSearch: {
              timeout: 8000
            }
          }
        });
      }

      const settings = settingsManager.getSettings();

      // Check that symbolSearch was updated
      expect(settings.mentions?.symbolSearch?.timeout).toBe(8000);
      expect(settings.mentions?.symbolSearch?.maxSymbols).toBe(200000);

      // Check that fileSearch was preserved
      expect(settings.mentions?.fileSearch?.maxFiles).toBe(1000);
      expect(settings.mentions?.fileSearch?.respectGitignore).toBe(true);
    });

    it('should deep merge legacy symbolSearch to mentions.symbolSearch', async () => {
      // User has old symbolSearch format
      const userSettings: Partial<UserSettings> = {
        symbolSearch: {
          maxSymbols: 10000
        }
      };

      await settingsManager.updateSettings(userSettings);
      const settings = settingsManager.getSettings();

      // Check that legacy symbolSearch was migrated to mentions.symbolSearch
      expect(settings.mentions?.symbolSearch?.maxSymbols).toBe(10000);

      // Check that timeout defaults are preserved
      expect(settings.mentions?.symbolSearch?.timeout).toBe(60000);

      // Check that legacy symbolSearch is kept for backward compatibility
      expect(settings.symbolSearch).toEqual({
        maxSymbols: 10000
      });
    });
  });

});