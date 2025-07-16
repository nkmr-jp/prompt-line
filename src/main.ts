import { app, globalShortcut, Tray, Menu, nativeImage, shell } from 'electron';
import fs from 'fs';
import path from 'path';

// Optimized macOS configuration for performance and IMK error prevention
if (process.platform === 'darwin') {
  app.commandLine.appendSwitch('disable-features', 'HardwareMediaKeyHandling');
  
  // Security warnings: enabled in all environments for better security
  // Note: Security warnings help identify potential security issues
  // Explicitly enable security warnings in all environments
  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'false';
  
  process.env.ELECTRON_ENABLE_LOGGING = 'false';
  process.noDeprecation = true;
}

import config from './config/app-config';
import WindowManager from './managers/window-manager';
import HistoryManager from './managers/history-manager';
import OptimizedHistoryManager from './managers/optimized-history-manager';
import DraftManager from './managers/draft-manager';
import SettingsManager from './managers/settings-manager';
import IPCHandlers from './handlers/ipc-handlers';
import { logger, ensureDir } from './utils/utils';
import type { WindowData } from './types';

class PromptLineApp {
  private windowManager: WindowManager | null = null;
  private historyManager: HistoryManager | OptimizedHistoryManager | null = null;
  private draftManager: DraftManager | null = null;
  private settingsManager: SettingsManager | null = null;
  private ipcHandlers: IPCHandlers | null = null;
  private tray: Tray | null = null;
  private isInitialized = false;

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Prompt Line...');

      await ensureDir(config.paths.userDataDir);
      await ensureDir(config.paths.imagesDir);
      logger.info('Data directories ensured at:', config.paths.userDataDir);

      this.windowManager = new WindowManager();
      this.draftManager = new DraftManager();
      this.settingsManager = new SettingsManager();

      await this.windowManager.initialize();
      await this.draftManager.initialize();
      await this.settingsManager.init();

      const userSettings = this.settingsManager.getSettings();
      
      // デフォルトで無制限履歴機能（OptimizedHistoryManager）を使用
      logger.info('Using OptimizedHistoryManager (unlimited history by default)');
      this.historyManager = new OptimizedHistoryManager();
      
      await this.historyManager.initialize();
      
      this.windowManager.updateWindowSettings(userSettings.window);

      this.ipcHandlers = new IPCHandlers(
        this.windowManager,
        this.historyManager,
        this.draftManager,
        this.settingsManager
      );


      // Note: Window is now pre-created during WindowManager initialization
      this.registerShortcuts();
      this.createTray();
      this.setupAppEventListeners();

      if (config.platform.isMac && app.dock) {
        app.dock.hide();
      }

      this.isInitialized = true;

      const historyStats = this.historyManager.getHistoryStats();
      const settings = this.settingsManager.getSettings();
      
      logger.info('Prompt Line initialized successfully', {
        historyItems: historyStats.totalItems,
        hasDraft: this.draftManager.hasDraft(),
        platform: process.platform
      });

      console.log('\n=== Prompt Line ===');
      console.log(`Shortcut: ${settings.shortcuts.main}`);
      console.log('Usage: Enter text and press Cmd+Enter to paste');
      console.log(`History: ${historyStats.totalItems} items loaded`);
      console.log('Exit: Ctrl+C\n');

    } catch (error) {
      logger.error('Failed to initialize application:', error);
      throw error;
    }
  }

  private registerShortcuts(): void {
    try {
      const settings = this.settingsManager?.getSettings();
      const mainShortcut = settings?.shortcuts.main || config.shortcuts.main;
      
      const mainRegistered = globalShortcut.register(mainShortcut, async () => {
        await this.showInputWindow();
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

  private async openSettingsFile(): Promise<void> {
    try {
      if (!this.settingsManager) {
        logger.warn('Settings manager not initialized');
        return;
      }

      const settingsFilePath = this.settingsManager.getSettingsFilePath();
      logger.info('Opening settings file:', settingsFilePath);
      
      await shell.openPath(settingsFilePath);
    } catch (error) {
      logger.error('Failed to open settings file:', error);
    }
  }

  private createTray(): void {
    try {
      // Create icon from multiple resolutions for better display quality
      const iconPath22 = path.join(__dirname, '..', 'assets', 'icon-tray-22.png');
      const iconPath44 = path.join(__dirname, '..', 'assets', 'icon-tray-44.png');
      const iconPath88 = path.join(__dirname, '..', 'assets', 'icon-tray-88.png');
      
      // Create empty image and add representations
      const icon = nativeImage.createEmpty();
      
      // Check if files exist and add representations
      if (fs.existsSync(iconPath22)) {
        icon.addRepresentation({
          scaleFactor: 1.0,
          width: 22,
          height: 22,
          buffer: fs.readFileSync(iconPath22)
        });
      }
      
      if (fs.existsSync(iconPath44)) {
        icon.addRepresentation({
          scaleFactor: 2.0,
          width: 44,
          height: 44,
          buffer: fs.readFileSync(iconPath44)
        });
      }
      
      if (fs.existsSync(iconPath88)) {
        icon.addRepresentation({
          scaleFactor: 4.0,
          width: 88,
          height: 88,
          buffer: fs.readFileSync(iconPath88)
        });
      }
      
      icon.setTemplateImage(true); // Make it a template image for proper macOS menu bar appearance
      this.tray = new Tray(icon);
      
      const contextMenu = Menu.buildFromTemplate([
        {
          label: 'Show Prompt Line',
          click: async () => {
            await this.showInputWindow();
          }
        },
        {
          label: 'Hide Window',
          click: async () => {
            await this.hideInputWindow();
          }
        },
        { type: 'separator' },
        {
          label: 'Settings',
          click: async () => {
            await this.openSettingsFile();
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
            this.quitApp();
          }
        }
      ]);

      this.tray.setContextMenu(contextMenu);
      const settings = this.settingsManager?.getSettings();
      const shortcut = settings?.shortcuts.main || config.shortcuts.main;
      this.tray.setToolTip('Prompt Line - Press ' + shortcut + ' to open');
      
      this.tray.on('double-click', async () => {
        await this.showInputWindow();
      });

      logger.info('System tray created successfully');
    } catch (error) {
      logger.error('Failed to create system tray:', error);
      throw error;
    }
  }

  private quitApp(): void {
    logger.info('Quit requested from tray menu');
    app.quit();
  }

  private setupAppEventListeners(): void {
    app.on('will-quit', (event) => {
      event.preventDefault();
      this.cleanup().finally(() => {
        app.exit(0);
      });
    });

    app.on('window-all-closed', () => {
      logger.debug('All windows closed, keeping app running in background');
    });

    app.on('activate', async () => {
      if (config.platform.isMac) {
        await this.showInputWindow();
      }
    });

    app.on('before-quit', async (_event) => {
      logger.info('Application is about to quit');
      
      const savePromises: Promise<unknown>[] = [];
      
      if (this.draftManager && this.draftManager.hasDraft()) {
        savePromises.push(
          this.draftManager.saveDraftImmediately(this.draftManager.getCurrentDraft())
        );
      }
      
      if (this.historyManager) {
        savePromises.push(this.historyManager.flushPendingSaves());
      }
      
      try {
        await Promise.allSettled(savePromises);
        logger.info('Critical data saved before quit');
      } catch (error) {
        logger.error('Error saving critical data before quit:', error);
      }
    });
  }

  async showInputWindow(): Promise<void> {
    try {
      if (!this.isInitialized || !this.windowManager || !this.historyManager || !this.draftManager || !this.settingsManager) {
        logger.warn('App not initialized, cannot show window');
        return;
      }

      const draft = this.draftManager.getCurrentDraft();
      const settings = this.settingsManager.getSettings();
      const history = this.historyManager.getHistory();
      const windowData: WindowData = {
        history,
        draft: draft || null,
        settings
      };

      await this.windowManager.showInputWindow(windowData);
      logger.debug('Input window shown with data', {
        historyItems: windowData.history?.length || 0,
        hasDraft: !!windowData.draft
      });
    } catch (error) {
      logger.error('Failed to show input window:', error);
    }
  }

  async hideInputWindow(): Promise<void> {
    try {
      if (this.windowManager) {
        await this.windowManager.hideInputWindow();
        logger.debug('Input window hidden');
      }
    } catch (error) {
      logger.error('Failed to hide input window:', error);
    }
  }

  private async cleanup(): Promise<void> {
    try {
      logger.info('Cleaning up application resources...');

      const cleanupPromises: Promise<unknown>[] = [];

      globalShortcut.unregisterAll();

      if (this.tray) {
        this.tray.destroy();
        this.tray = null;
        logger.debug('System tray destroyed');
      }

      if (this.ipcHandlers) {
        cleanupPromises.push(
          Promise.resolve(this.ipcHandlers.removeAllHandlers())
        );
      }

      if (this.draftManager) {
        cleanupPromises.push(this.draftManager.destroy());
      }

      if (this.historyManager) {
        cleanupPromises.push(this.historyManager.destroy());
      }

      if (this.windowManager) {
        cleanupPromises.push(
          Promise.resolve(this.windowManager.destroy())
        );
      }

      await Promise.allSettled(cleanupPromises);

      logger.info('Application cleanup completed (optimized)');
    } catch (error) {
      logger.error('Error during cleanup:', error);
    }
  }

  async restart(): Promise<void> {
    try {
      logger.info('Restarting application...');
      await this.cleanup();
      await this.initialize();
      logger.info('Application restarted successfully');
    } catch (error) {
      logger.error('Failed to restart application:', error);
      throw error;
    }
  }

  isReady(): boolean {
    return this.isInitialized && app.isReady();
  }

}

const promptLineApp = new PromptLineApp();

app.whenReady().then(async () => {
  try {
    await promptLineApp.initialize();
  } catch (error) {
    logger.error('Application failed to start:', error);
    console.error('❌ Application failed to start:', error);
    app.quit();
  }
});

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  logger.warn('Another instance is already running, quitting...');
  app.quit();
} else {
  app.on('second-instance', async () => {
    logger.info('Second instance detected, showing main window');
    await promptLineApp.showInputWindow();
  });
}

export default promptLineApp;