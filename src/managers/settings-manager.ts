import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import * as yaml from 'js-yaml';
import { logger } from '../utils/utils';
import type { UserSettings } from '../types';

class SettingsManager {
  private settingsFile: string;
  private currentSettings: UserSettings;
  private defaultSettings: UserSettings;

  constructor() {
    this.settingsFile = path.join(os.homedir(), '.prompt-line', 'settings.yaml');
    
    this.defaultSettings = {
      shortcuts: {
        main: 'Cmd+Shift+Space',
        paste: 'Cmd+Enter',
        close: 'Escape',
        historyNext: 'Ctrl+j',
        historyPrev: 'Ctrl+k'
      },
      window: {
        width: 600,
        height: 300
      }
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
    return {
      shortcuts: {
        ...this.defaultSettings.shortcuts,
        ...userSettings.shortcuts
      },
      window: {
        ...this.defaultSettings.window,
        ...userSettings.window
      }
    };
  }

  async saveSettings(): Promise<void> {
    try {
      const yamlString = yaml.dump(this.currentSettings, {
        indent: 2,
        lineWidth: -1,
        noRefs: true
      });

      await fs.writeFile(this.settingsFile, yamlString, 'utf8');
      logger.debug('Settings saved to YAML file', { file: this.settingsFile });
    } catch (error) {
      logger.error('Failed to save settings:', error);
      throw error;
    }
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
      window: { ...this.defaultSettings.window }
    };
  }

  getSettingsFilePath(): string {
    return this.settingsFile;
  }
}

export default SettingsManager;