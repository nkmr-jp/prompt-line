import { Tray, Menu, shell } from 'electron';
import type { NativeImage } from 'electron';
import { nativeImage } from 'electron';
import fs from 'fs';
import path from 'path';
import config from '../config/app-config';
import type SettingsManager from '../managers/settings-manager';
import { logger } from '../utils/utils';

interface TrayManagerOptions {
  onShowWindow: () => Promise<void>;
  onHideWindow: () => Promise<void>;
  onOpenSettings: () => Promise<void>;
  onQuit: () => void;
}

export class TrayManager {
  private tray: Tray | null = null;
  private options: TrayManagerOptions;
  private settingsManager: SettingsManager;

  constructor(settingsManager: SettingsManager, options: TrayManagerOptions) {
    this.settingsManager = settingsManager;
    this.options = options;
  }

  createTray(): void {
    try {
      const icon = this.createTrayIcon();
      this.tray = new Tray(icon);

      const contextMenu = this.buildContextMenu();
      this.tray.setContextMenu(contextMenu);

      const settings = this.settingsManager.getSettings();
      const shortcut = settings?.shortcuts.main || config.shortcuts.main;
      this.tray.setToolTip('Prompt Line - Press ' + shortcut + ' to open');

      this.tray.on('double-click', async () => {
        await this.options.onShowWindow();
      });

      logger.info('System tray created successfully');
    } catch (error) {
      logger.error('Failed to create system tray:', error);
      throw error;
    }
  }

  private createTrayIcon(): NativeImage {
    const iconPath22 = path.join(__dirname, '..', 'assets', 'icon-tray-22.png');
    const iconPath44 = path.join(__dirname, '..', 'assets', 'icon-tray-44.png');
    const iconPath88 = path.join(__dirname, '..', 'assets', 'icon-tray-88.png');

    const icon = nativeImage.createEmpty();

    this.addIconRepresentation(icon, iconPath22, 1.0, 22, 22);
    this.addIconRepresentation(icon, iconPath44, 2.0, 44, 44);
    this.addIconRepresentation(icon, iconPath88, 4.0, 88, 88);

    icon.setTemplateImage(true);
    return icon;
  }

  private addIconRepresentation(
    icon: NativeImage,
    iconPath: string,
    scaleFactor: number,
    width: number,
    height: number
  ): void {
    if (fs.existsSync(iconPath)) {
      icon.addRepresentation({
        scaleFactor,
        width,
        height,
        buffer: fs.readFileSync(iconPath)
      });
    }
  }

  private buildContextMenu(): Menu {
    return Menu.buildFromTemplate([
      {
        label: 'Show Prompt Line',
        click: async () => {
          await this.options.onShowWindow();
        }
      },
      {
        label: 'Hide Window',
        click: async () => {
          await this.options.onHideWindow();
        }
      },
      { type: 'separator' },
      {
        label: 'Settings',
        click: async () => {
          await this.options.onOpenSettings();
        }
      },
      { type: 'separator' },
      {
        label: `Version ${config.app.version}`,
        enabled: false
      },
      {
        label: 'Release Notes',
        click: () => {
          shell.openExternal('https://github.com/nkmr-jp/prompt-line/blob/main/CHANGELOG.md');
        }
      },
      { type: 'separator' },
      {
        label: 'Quit Prompt Line',
        click: () => {
          this.options.onQuit();
        }
      }
    ]);
  }

  destroy(): void {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
      logger.debug('System tray destroyed');
    }
  }
}
