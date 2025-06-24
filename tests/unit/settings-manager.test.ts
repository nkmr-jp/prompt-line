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

      expect(mockedFs.mkdir).toHaveBeenCalledWith(path.dirname(settingsPath), { recursive: true });
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
    it('should handle file write errors', async () => {
      mockedFs.readFile.mockRejectedValue({ code: 'ENOENT' });
      mockedFs.mkdir.mockResolvedValue(undefined);
      mockedFs.writeFile.mockRejectedValue(new Error('Write failed'));

      await expect(settingsManager.init()).rejects.toThrow('Write failed');
    });

    it('should handle directory creation errors', async () => {
      mockedFs.mkdir.mockRejectedValue(new Error('Permission denied'));

      await expect(settingsManager.init()).rejects.toThrow('Permission denied');
    });
  });

});