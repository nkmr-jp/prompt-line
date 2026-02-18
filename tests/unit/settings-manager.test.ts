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
    // Handle different YAML content for tests
    if (data.includes('main: Alt+Space')) {
      return {
        shortcuts: { main: 'Alt+Space', paste: 'Enter', close: 'Escape', search: 'Cmd+f' },
        window: { position: 'center', width: 800, height: 400 }
      };
    }
    if (data.includes('main: Ctrl+Space')) {
      return {
        shortcuts: { main: 'Ctrl+Space', paste: 'Enter', close: 'Escape' },
        window: { position: 'cursor', width: 700, height: 350 }
      };
    }
    if (data.includes('invalid: yaml:')) {
      // Simulate invalid YAML that throws an error
      throw new Error('Invalid YAML format');
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
  }),
  JSON_SCHEMA: {}  // Mock the JSON_SCHEMA constant
}));

// Mock chokidar file watcher
jest.mock('chokidar', () => ({
  watch: jest.fn(() => ({
    on: jest.fn(function(this: any, event: string, callback: Function) {
      // Store callbacks for manual triggering in tests
      if (!this.callbacks) this.callbacks = {};
      this.callbacks[event] = callback;
      return this;
    }),
    close: jest.fn(() => Promise.resolve()),
    callbacks: {}
  }))
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

      // includes all default values: shortcuts, window, fileOpener, builtInCommands, agentSkills, mentions
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
        builtInCommands: ['claude'],
        agentSkills: [
          {
            name: '{basename}',
            description: '{frontmatter@description}',
            path: '~/.claude/commands/*.md',
            label: 'command',
            color: 'purple',
            argumentHint: '{frontmatter@argument-hint}',
            maxSuggestions: 20
          },
          {
            name: '{frontmatter@name}',
            description: '{frontmatter@description}',
            path: '~/.claude/skills/**/*/SKILL.md',
            label: 'skill',
            color: 'purple',
            maxSuggestions: 20
          },
          {
            name: '{prefix}:{basename}',
            description: '{frontmatter@description}',
            path: '~/.claude/plugins/cache/**/commands/*.md',
            prefixPattern: '**/.claude-plugin/*.json@name',
            label: 'command',
            color: 'teal',
            argumentHint: '{frontmatter@argument-hint}',
            maxSuggestions: 20
          },
          {
            name: '{prefix}:{frontmatter@name}',
            description: '{frontmatter@description}',
            path: '~/.claude/plugins/cache/**/*/SKILL.md',
            prefixPattern: '**/.claude-plugin/*.json@name',
            label: 'skill',
            color: 'teal',
            argumentHint: '{frontmatter@argument-hint}',
            maxSuggestions: 20
          }
        ],
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
          customSearch: [
            {
              name: '{basename}(agent)',
              description: '{frontmatter@description}',
              path: '~/.claude/agents/*.md',
              searchPrefix: 'agent'
            },
            {
              name: '{prefix}:{basename}(agent)',
              description: '{frontmatter@description}',
              path: '~/.claude/plugins/cache/**/agents/*.md',
              prefixPattern: '**/.claude-plugin/*.json@name',
              searchPrefix: 'agent'
            },
            {
              name: '{basename}',
              description: '{dirname:2}',
              path: '~/.claude/teams/**/inboxes/*.json',
              searchPrefix: 'team'
            },
            {
              name: '{json@name}',
              description: '{dirname:2}',
              path: '~/.claude/teams/**/config.json@.members',
              searchPrefix: 'member'
            },
            {
              name: '{basename}',
              description: '',
              path: '~/.claude/plans/*.md',
              searchPrefix: 'plan',
              inputFormat: 'path'
            },
            {
              name: '{basename}',
              description: '{dirname}',
              path: '~/.claude/tasks/**/*/*.md',
              searchPrefix: 'task',
              inputFormat: 'path'
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

      // includes all default values: shortcuts, window, fileOpener, builtInCommands, agentSkills, mentions
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
        builtInCommands: ['claude'],
        agentSkills: [
          {
            name: '{basename}',
            description: '{frontmatter@description}',
            path: '~/.claude/commands/*.md',
            label: 'command',
            color: 'purple',
            argumentHint: '{frontmatter@argument-hint}',
            maxSuggestions: 20
          },
          {
            name: '{frontmatter@name}',
            description: '{frontmatter@description}',
            path: '~/.claude/skills/**/*/SKILL.md',
            label: 'skill',
            color: 'purple',
            maxSuggestions: 20
          },
          {
            name: '{prefix}:{basename}',
            description: '{frontmatter@description}',
            path: '~/.claude/plugins/cache/**/commands/*.md',
            prefixPattern: '**/.claude-plugin/*.json@name',
            label: 'command',
            color: 'teal',
            argumentHint: '{frontmatter@argument-hint}',
            maxSuggestions: 20
          },
          {
            name: '{prefix}:{frontmatter@name}',
            description: '{frontmatter@description}',
            path: '~/.claude/plugins/cache/**/*/SKILL.md',
            prefixPattern: '**/.claude-plugin/*.json@name',
            label: 'skill',
            color: 'teal',
            argumentHint: '{frontmatter@argument-hint}',
            maxSuggestions: 20
          }
        ],
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
          customSearch: [
            {
              name: '{basename}(agent)',
              description: '{frontmatter@description}',
              path: '~/.claude/agents/*.md',
              searchPrefix: 'agent'
            },
            {
              name: '{prefix}:{basename}(agent)',
              description: '{frontmatter@description}',
              path: '~/.claude/plugins/cache/**/agents/*.md',
              prefixPattern: '**/.claude-plugin/*.json@name',
              searchPrefix: 'agent'
            },
            {
              name: '{basename}',
              description: '{dirname:2}',
              path: '~/.claude/teams/**/inboxes/*.json',
              searchPrefix: 'team'
            },
            {
              name: '{json@name}',
              description: '{dirname:2}',
              path: '~/.claude/teams/**/config.json@.members',
              searchPrefix: 'member'
            },
            {
              name: '{basename}',
              description: '',
              path: '~/.claude/plans/*.md',
              searchPrefix: 'plan',
              inputFormat: 'path'
            },
            {
              name: '{basename}',
              description: '{dirname}',
              path: '~/.claude/tasks/**/*/*.md',
              searchPrefix: 'task',
              inputFormat: 'path'
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

    it('should migrate legacy builtInCommands.tools to root-level builtInCommands', async () => {
      // Simulate a fresh settings load where user only has legacyBuiltInCommands (no root builtInCommands)
      // This tests the mergeWithDefaults migration logic directly
      const legacyManager = new SettingsManager();

      // Mock readFile to return YAML that js-yaml.load will parse
      // We need to simulate a user config that only has legacyBuiltInCommands
      const yamlLoad = require('js-yaml').load;
      yamlLoad.mockReturnValueOnce({
        shortcuts: { main: 'Cmd+Shift+Space', paste: 'Cmd+Enter', close: 'Escape' },
        window: { position: 'active-text-field', width: 600, height: 300 },
        legacyBuiltInCommands: {
          tools: ['claude', 'custom-tool']
        }
      });
      mockedFs.readFile.mockResolvedValueOnce('mock yaml content');
      mockedFs.mkdir.mockResolvedValue(undefined);
      mockedFs.writeFile.mockResolvedValue();

      await legacyManager.init();
      const settings = legacyManager.getSettings();

      // Check that legacy builtInCommands.tools was migrated to root-level builtInCommands
      expect(settings.builtInCommands).toEqual(['claude', 'custom-tool']);
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

  describe('getCustomSearchEntries', () => {
    it('should convert agentSkills with enable/disable filters', async () => {
      const userSettings: Partial<UserSettings> = {
        agentSkills: [
          {
            name: '{prefix}:{basename}',
            description: '{frontmatter@description}',
            path: '~/.claude/plugins',
            pattern: '**/commands/*.md',
            prefixPattern: '**/.claude-plugin/plugin.json@name',
            enable: ['ralph-loop:help*'],
            disable: ['ralph-loop:cancel']
          }
        ]
      };

      await settingsManager.updateSettings(userSettings);
      const entries = settingsManager.getCustomSearchEntries();

      // Find the entry with enable/disable filters
      const filteredEntry = entries?.find(e => e.enable !== undefined || e.disable !== undefined);
      expect(filteredEntry).toBeDefined();
      expect(filteredEntry?.type).toBe('command');
      expect(filteredEntry?.enable).toEqual(['ralph-loop:help*']);
      expect(filteredEntry?.disable).toEqual(['ralph-loop:cancel']);
    });

    it('should convert mentions.customSearch with enable/disable filters', async () => {
      const userSettings: Partial<UserSettings> = {
        mentions: {
          customSearch: [
            {
              name: 'agent-{basename}',
              description: '{frontmatter@description}',
              path: '~/.claude/agents',
              pattern: '*.md',
              searchPrefix: 'agent',
              enable: ['agent-*'],
              disable: ['agent-legacy']
            }
          ]
        }
      };

      await settingsManager.updateSettings(userSettings);
      const entries = settingsManager.getCustomSearchEntries();

      // Find the mention entry with enable/disable filters
      const filteredEntry = entries?.find(e => e.type === 'mention' && (e.enable !== undefined || e.disable !== undefined));
      expect(filteredEntry).toBeDefined();
      expect(filteredEntry?.enable).toEqual(['agent-*']);
      expect(filteredEntry?.disable).toEqual(['agent-legacy']);
    });

    it('should convert mentions.customSearch with prefixPattern', async () => {
      const userSettings: Partial<UserSettings> = {
        mentions: {
          customSearch: [
            {
              name: 'agent-{prefix}:{basename}',
              description: '{frontmatter@description}',
              path: '~/.claude/plugins/cache',
              pattern: '**/agents/*.md',
              searchPrefix: 'agent',
              prefixPattern: '**/.claude-plugin/plugin.json@name'
            }
          ]
        }
      };

      await settingsManager.updateSettings(userSettings);
      const entries = settingsManager.getCustomSearchEntries();

      const entryWithPrefix = entries?.find(e => e.type === 'mention' && e.prefixPattern !== undefined);
      expect(entryWithPrefix).toBeDefined();
      expect(entryWithPrefix?.prefixPattern).toBe('**/.claude-plugin/plugin.json@name');
    });
  });

  describe('hot reload functionality', () => {
    let chokidar: any;
    let mockWatcher: any;

    beforeEach(async () => {
      // Enable fake timers for debouncing tests
      jest.useFakeTimers();

      // Get the mocked chokidar module
      chokidar = require('chokidar');

      // Initialize settings manager
      mockedFs.readFile.mockRejectedValue({ code: 'ENOENT' });
      mockedFs.mkdir.mockResolvedValue(undefined);
      mockedFs.writeFile.mockResolvedValue();

      await settingsManager.init();

      // Get the mock watcher instance created during init
      mockWatcher = chokidar.watch.mock.results[chokidar.watch.mock.results.length - 1]?.value;
    });

    afterEach(async () => {
      // Clean up timers
      jest.clearAllTimers();
      jest.useRealTimers();
    });

    it('should call startWatching() during init()', async () => {
      // Create a new instance to test init behavior
      const newSettingsManager = new SettingsManager();

      // Clear previous calls
      chokidar.watch.mockClear();

      // Initialize
      mockedFs.readFile.mockRejectedValue({ code: 'ENOENT' });
      mockedFs.mkdir.mockResolvedValue(undefined);
      mockedFs.writeFile.mockResolvedValue();
      await newSettingsManager.init();

      // Verify that chokidar.watch was called
      expect(chokidar.watch).toHaveBeenCalledWith(
        settingsPath,
        expect.objectContaining({
          persistent: true,
          ignoreInitial: true,
          awaitWriteFinish: expect.objectContaining({
            stabilityThreshold: 100,
            pollInterval: 50
          })
        })
      );

      await newSettingsManager.destroy();
    });

    it('should emit settings-changed event when file changes', async () => {
      // Set up spy for the event
      const settingsChangedHandler = jest.fn();
      settingsManager.on('settings-changed', settingsChangedHandler);

      // Mock updated file content
      const updatedYaml = `shortcuts:
  main: Ctrl+Space
  paste: Enter
  close: Escape
window:
  position: cursor
  width: 700
  height: 350`;

      mockedFs.readFile.mockResolvedValue(updatedYaml);

      // Trigger file change event
      if (mockWatcher?.callbacks?.change) {
        mockWatcher.callbacks.change();
      }

      // Fast-forward timers to trigger debounced reload (300ms)
      await jest.advanceTimersByTimeAsync(300);

      // Verify event was emitted with new and previous settings
      expect(settingsChangedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          shortcuts: expect.objectContaining({
            main: 'Ctrl+Space'
          }),
          window: expect.objectContaining({
            position: 'cursor',
            width: 700,
            height: 350
          })
        }),
        expect.objectContaining({
          shortcuts: expect.objectContaining({
            main: 'Cmd+Shift+Space'
          })
        })
      );

      settingsManager.off('settings-changed', settingsChangedHandler);
    });

    it('should properly debounce file changes', async () => {
      const settingsChangedHandler = jest.fn();
      settingsManager.on('settings-changed', settingsChangedHandler);

      const updatedYaml = `shortcuts:
  main: Ctrl+Space
  paste: Enter
  close: Escape
window:
  position: cursor
  width: 700
  height: 350`;

      mockedFs.readFile.mockResolvedValue(updatedYaml);

      // Trigger multiple file changes rapidly
      if (mockWatcher?.callbacks?.change) {
        mockWatcher.callbacks.change();
        jest.advanceTimersByTime(100); // 100ms

        mockWatcher.callbacks.change();
        jest.advanceTimersByTime(100); // 200ms total

        mockWatcher.callbacks.change();
        // Final advance to trigger the debounced callback
        await jest.advanceTimersByTimeAsync(300); // 300ms from last change
      }

      // Verify event was emitted only once (debounced)
      expect(settingsChangedHandler).toHaveBeenCalledTimes(1);

      settingsManager.off('settings-changed', settingsChangedHandler);
    });

    it('should maintain existing settings when reload fails due to invalid YAML', async () => {
      // Get initial settings
      const initialSettings = settingsManager.getSettings();

      const settingsChangedHandler = jest.fn();
      settingsManager.on('settings-changed', settingsChangedHandler);

      // Mock invalid YAML that will cause parsing to fail
      mockedFs.readFile.mockResolvedValue('invalid: yaml: content: [unclosed');

      // Trigger file change
      if (mockWatcher?.callbacks?.change) {
        mockWatcher.callbacks.change();
      }

      // Fast-forward timers
      await jest.advanceTimersByTimeAsync(300);

      // Verify that event was NOT emitted (reload failed)
      expect(settingsChangedHandler).not.toHaveBeenCalled();

      // Verify settings remain unchanged
      const currentSettings = settingsManager.getSettings();
      expect(currentSettings).toEqual(initialSettings);

      settingsManager.off('settings-changed', settingsChangedHandler);
    });

    it('should properly close watcher on destroy()', async () => {
      const closeSpy = jest.fn(() => Promise.resolve());

      if (mockWatcher) {
        mockWatcher.close = closeSpy;
      }

      await settingsManager.destroy();

      // Verify watcher was closed
      expect(closeSpy).toHaveBeenCalled();
    });

    it('should clear debounce timer on destroy()', async () => {
      const settingsChangedHandler = jest.fn();
      settingsManager.on('settings-changed', settingsChangedHandler);

      const updatedYaml = `shortcuts:
  main: Ctrl+Space
  paste: Enter
  close: Escape
window:
  position: cursor
  width: 700
  height: 350`;

      mockedFs.readFile.mockResolvedValue(updatedYaml);

      // Trigger file change but don't wait for debounce
      if (mockWatcher?.callbacks?.change) {
        mockWatcher.callbacks.change();
      }

      // Destroy before debounce timer fires
      jest.advanceTimersByTime(150); // Only 150ms, not the full 300ms
      await settingsManager.destroy();

      // Fast-forward remaining time
      await jest.advanceTimersByTimeAsync(200);

      // Verify event was NOT emitted (timer was cleared)
      expect(settingsChangedHandler).not.toHaveBeenCalled();

      settingsManager.off('settings-changed', settingsChangedHandler);
    });

    it('should handle watcher errors gracefully', async () => {
      const errorHandler = jest.fn();

      // Mock logger.error to verify error handling
      const { logger } = require('../../src/utils/utils');
      const originalError = logger.error;
      logger.error = errorHandler;

      // Trigger watcher error
      const testError = new Error('Watcher error');
      if (mockWatcher?.callbacks?.error) {
        mockWatcher.callbacks.error(testError);
      }

      // Verify error was logged
      expect(errorHandler).toHaveBeenCalledWith(
        'Settings file watcher error:',
        testError
      );

      // Restore original logger
      logger.error = originalError;
    });

    it('should not start multiple watchers on repeated init calls', async () => {
      // Clear previous watch calls
      chokidar.watch.mockClear();

      // Call init again (already initialized in beforeEach)
      await settingsManager.init();

      // Verify watch was not called again (already watching)
      // The first call was in the beforeEach, so this should not add another
      // Note: The implementation checks if watcher already exists
      expect(chokidar.watch).not.toHaveBeenCalled();
    });
  });

});