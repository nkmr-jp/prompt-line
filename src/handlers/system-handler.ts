import path from 'path';
import { IpcMainInvokeEvent, shell } from 'electron';
import config from '../config/app-config';
import { logger } from '../utils/utils';
import type SettingsManager from '../managers/settings-manager';

interface IPCResult {
  success: boolean;
  error?: string;
}

interface AppInfoResult {
  name: string;
  version: string;
  description: string;
  platform: string;
  electronVersion?: string;
  nodeVersion?: string;
  isDevelopment: boolean;
}

interface ConfigData {
  shortcuts: Record<string, string>;
  history: Record<string, unknown>;
  draft: Record<string, unknown>;
  timing: Record<string, unknown>;
  app: Record<string, unknown>;
  platform: Record<string, unknown>;
  [key: string]: unknown;
}

// Constants
const VALID_CONFIG_SECTIONS = ['shortcuts', 'history', 'draft', 'timing', 'app', 'platform'];

class SystemHandler {
  private settingsManager: SettingsManager;

  constructor(settingsManager: SettingsManager) {
    this.settingsManager = settingsManager;
  }

  setupHandlers(ipcMain: typeof import('electron').ipcMain): void {
    ipcMain.handle('get-app-info', this.handleGetAppInfo.bind(this));
    ipcMain.handle('get-config', this.handleGetConfig.bind(this));
    ipcMain.handle('open-settings', this.handleOpenSettings.bind(this));
    ipcMain.handle('open-settings-directory', this.handleOpenSettingsDirectory.bind(this));
    ipcMain.handle('get-file-search-max-suggestions', this.handleGetFileSearchMaxSuggestions.bind(this));
  }

  removeHandlers(ipcMain: typeof import('electron').ipcMain): void {
    const handlers = ['get-app-info', 'get-config', 'open-settings', 'open-settings-directory', 'get-file-search-max-suggestions'];

    handlers.forEach(handler => {
      ipcMain.removeAllListeners(handler);
    });

    logger.info('System IPC handlers removed');
  }

  private async handleGetAppInfo(_event: IpcMainInvokeEvent): Promise<AppInfoResult | {}> {
    try {
      const appInfo: AppInfoResult = {
        name: config.app.name,
        version: config.app.version,
        description: config.app.description,
        platform: process.platform,
        electronVersion: process.versions.electron,
        nodeVersion: process.versions.node,
        isDevelopment: config.isDevelopment()
      };

      return appInfo;
    } catch (error) {
      logger.error('Failed to get app info:', error);
      return {};
    }
  }

  private async handleGetConfig(
    _event: IpcMainInvokeEvent,
    section: string | null = null
  ): Promise<ConfigData | Record<string, unknown> | {}> {
    try {
      if (section) {
        // セクション名の型検証を強化
        if (typeof section !== 'string') {
          logger.warn('Invalid config section type', { type: typeof section });
          return {};
        }

        // Validate section name against whitelist
        if (!VALID_CONFIG_SECTIONS.includes(section)) {
          logger.warn('Invalid config section requested', { section });
          return {};
        }

        try {
          const configData = config.get(section as keyof typeof config);
          return configData || {};
        } catch (sectionError) {
          logger.error('Failed to get config section:', { section, error: sectionError });
          return {};
        }
      } else {
        try {
          const safeConfig: ConfigData = {
            shortcuts: config.shortcuts as unknown as Record<string, string>,
            history: config.history as unknown as Record<string, unknown>,
            draft: config.draft as unknown as Record<string, unknown>,
            timing: config.timing as unknown as Record<string, unknown>,
            app: config.app as unknown as Record<string, unknown>,
            platform: config.platform as unknown as Record<string, unknown>
          };

          return safeConfig;
        } catch (configError) {
          logger.error('Failed to build full config:', configError);
          return {};
        }
      }
    } catch (error) {
      logger.error('Failed to get config:', error);
      return {};
    }
  }

  private async handleOpenSettings(_event: IpcMainInvokeEvent): Promise<IPCResult> {
    try {
      const settingsFilePath = this.settingsManager.getSettingsFilePath();
      logger.info('Opening settings file:', settingsFilePath);

      await shell.openPath(settingsFilePath);
      return { success: true };
    } catch (error) {
      logger.error('Failed to open settings file:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  private async handleOpenSettingsDirectory(_event: IpcMainInvokeEvent): Promise<IPCResult> {
    try {
      const settingsFilePath = this.settingsManager.getSettingsFilePath();
      const settingsDir = path.dirname(settingsFilePath);
      logger.info('Opening settings directory:', settingsDir);

      await shell.openPath(settingsDir);
      return { success: true };
    } catch (error) {
      logger.error('Failed to open settings directory:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Handler: get-file-search-max-suggestions
   * Returns the maximum number of suggestions for file search
   * Default: 50
   */
  private handleGetFileSearchMaxSuggestions(_event: IpcMainInvokeEvent): number {
    try {
      const fileSearchSettings = this.settingsManager.getFileSearchSettings();
      return fileSearchSettings?.maxSuggestions ?? 50;
    } catch (error) {
      logger.error('Failed to get fileSearch maxSuggestions:', error);
      return 50; // Default fallback
    }
  }
}

export default SystemHandler;
