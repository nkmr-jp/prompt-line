import { app, globalShortcut, shell } from 'electron';
import config from '../config/app-config';
import { logger } from '../utils/utils';
import type SettingsManager from '../managers/settings-manager';
import { TrayManager } from './tray-manager';

export interface UISetupCallbacks {
  onShowWindow: () => Promise<void>;
  onHideWindow: () => Promise<void>;
  onOpenSettings: () => Promise<void>;
  onQuit: () => void;
}

export class UISetup {
  constructor(private settingsManager: SettingsManager) {}

  registerShortcuts(onShowWindow: () => Promise<void>): void {
    try {
      const settings = this.settingsManager.getSettings();
      const mainShortcut = settings?.shortcuts.main || config.shortcuts.main;

      const mainRegistered = globalShortcut.register(mainShortcut, async () => {
        await onShowWindow();
      });

      if (mainRegistered) {
        logger.info('Global shortcut registered:', mainShortcut);
      } else {
        logger.error('Failed to register global shortcut:', mainShortcut);
        throw new Error(`Failed to register shortcut: ${mainShortcut}`);
      }
    } catch (error) {
      logger.error('Error registering shortcuts:', error);
      throw error;
    }
  }

  async openSettingsFile(): Promise<void> {
    try {
      const settingsFilePath = this.settingsManager.getSettingsFilePath();
      logger.info('Opening settings file:', settingsFilePath);

      await shell.openPath(settingsFilePath);
    } catch (error) {
      logger.error('Failed to open settings file:', error);
    }
  }

  initializeTray(callbacks: UISetupCallbacks): TrayManager {
    const trayManager = new TrayManager(this.settingsManager, callbacks);
    trayManager.createTray();
    return trayManager;
  }

  hideDockIcon(): void {
    if (config.platform.isMac && app.dock) {
      app.dock.hide();
    }
  }
}
