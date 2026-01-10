import { app, globalShortcut, Tray, Menu, nativeImage, shell, NativeImage, BrowserWindow } from 'electron';
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
import WindowManager from './managers/window';
import HistoryManager from './managers/history-manager';
import DraftManager from './managers/draft-manager';
import DirectoryManager from './managers/directory-manager';
import SettingsManager from './managers/settings-manager';
import BuiltInCommandsManager from './managers/built-in-commands-manager';
import IPCHandlers from './handlers/ipc-handlers';
import { codeSearchHandler } from './handlers/code-search-handler';
import { logger, ensureDir, detectCurrentDirectoryWithFiles } from './utils/utils';
import { LIMITS } from './constants';
import type { WindowData, UserSettings } from './types';

class PromptLineApp {
  private windowManager: WindowManager | null = null;
  private historyManager: HistoryManager | null = null;
  private draftManager: DraftManager | null = null;
  private directoryManager: DirectoryManager | null = null;
  private settingsManager: SettingsManager | null = null;
  private builtInCommandsManager: BuiltInCommandsManager | null = null;
  private ipcHandlers: IPCHandlers | null = null;
  private tray: Tray | null = null;
  private isInitialized = false;

  async initialize(): Promise<void> {
    try {
      await this.initializeDirectories();
      await this.initializeManagers();
      this.setupUI();

      this.isInitialized = true;
      this.logStartupInfo();

    } catch (error) {
      logger.error('Failed to initialize application:', error);
      throw error;
    }
  }

  /**
   * Initialize data directories
   */
  private async initializeDirectories(): Promise<void> {
    await ensureDir(config.paths.userDataDir);
    await ensureDir(config.paths.imagesDir);

    // Initialize built-in commands (copy to user data directory)
    this.builtInCommandsManager = new BuiltInCommandsManager();
    await this.builtInCommandsManager.initialize();
  }

  /**
   * Initialize all managers and handlers
   */
  private async initializeManagers(): Promise<void> {
    this.windowManager = new WindowManager();
    this.draftManager = new DraftManager();
    this.directoryManager = new DirectoryManager();
    this.settingsManager = new SettingsManager();

    await this.windowManager.initialize();
    await this.draftManager.initialize();
    await this.directoryManager.initialize();
    await this.settingsManager.init();

    const userSettings = this.settingsManager.getSettings();

    this.historyManager = new HistoryManager();
    await this.historyManager.initialize();

    this.windowManager.updateWindowSettings(userSettings.window);
    const fileSearchSettings = this.settingsManager.getFileSearchSettings();
    if (fileSearchSettings) {
      this.windowManager.updateFileSearchSettings(fileSearchSettings);
    }
    this.windowManager.setDirectoryManager(this.directoryManager);

    this.ipcHandlers = new IPCHandlers(
      this.windowManager,
      this.historyManager,
      this.draftManager,
      this.directoryManager,
      this.settingsManager
    );

    codeSearchHandler.setSettingsManager(this.settingsManager);
    codeSearchHandler.register();

    // Register settings change listener for hot reload
    this.settingsManager.on('settings-changed', (newSettings: UserSettings) => {
      if (this.windowManager && this.settingsManager) {
        this.windowManager.updateWindowSettings(newSettings.window);
        const fileSearchSettings = this.settingsManager.getFileSearchSettings();
        if (fileSearchSettings) {
          this.windowManager.updateFileSearchSettings(fileSearchSettings);
        }
      }

      // Notify renderer process about settings change
      BrowserWindow.getAllWindows().forEach(win => {
        if (!win.isDestroyed()) {
          win.webContents.send('settings-updated', newSettings);
        }
      });

      logger.info('Settings updated via hot reload');
    });
  }

  /**
   * Setup UI components (shortcuts, tray, event listeners)
   */
  private setupUI(): void {
    this.registerShortcuts();
    this.createTray();
    this.setupAppEventListeners();

    if (config.platform.isMac && app.dock) {
      app.dock.hide();
    }
  }

  /**
   * Log startup information to console
   */
  private logStartupInfo(): void {
    if (!this.historyManager || !this.draftManager || !this.settingsManager) return;

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
  }

  /**
   * Test directory detection feature (for debugging)
   * @param bundleId Optional bundle ID of the previous app to detect from
   */
  private async testDirectoryDetection(bundleId?: string): Promise<void> {
    try {
      logger.debug('Testing directory detection feature...');
      const startTime = performance.now();

      // Get file search settings from settings manager (if available)
      const fileSearchSettings = this.settingsManager?.getFileSearchSettings();
      // Build options conditionally to avoid passing undefined values
      const options: Parameters<typeof detectCurrentDirectoryWithFiles>[0] = {};
      if (fileSearchSettings) {
        options.fileSearchSettings = fileSearchSettings;
      }
      if (bundleId) {
        options.bundleId = bundleId;
      }
      const result = await detectCurrentDirectoryWithFiles(options);
      const duration = performance.now() - startTime;

      if (result.error) {
        logger.debug('Directory detection result (error):', {
          error: result.error,
          appName: result.appName,
          bundleId: result.bundleId,
          duration: `${duration.toFixed(2)}ms`
        });
      } else {
        logger.debug('Directory detection result (success):', {
          directory: result.directory,
          fileCount: result.fileCount,
          method: result.method,
          tty: result.tty,
          pid: result.pid,
          idePid: result.idePid,
          appName: result.appName,
          bundleId: result.bundleId,
          duration: `${duration.toFixed(2)}ms`
        });

        // Log first 5 files as sample
        if (result.files && result.files.length > 0) {
          const sampleFiles = result.files.slice(0, 5).map(f => ({
            name: f.name,
            isDirectory: f.isDirectory
          }));
          logger.debug('Sample files:', sampleFiles);
        }
      }
    } catch (error) {
      logger.warn('Directory detection test failed:', error);
    }
  }

  private registerShortcuts(): void {
    try {
      const settings = this.settingsManager?.getSettings();
      const mainShortcut = settings?.shortcuts.main || config.shortcuts.main;
      
      const mainRegistered = globalShortcut.register(mainShortcut, async () => {
        await this.showInputWindow();
      });

      if (!mainRegistered) {
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
      const icon = this.createTrayIcon();
      this.tray = new Tray(icon);

      const contextMenu = this.createTrayContextMenu();
      this.tray.setContextMenu(contextMenu);

      const settings = this.settingsManager?.getSettings();
      const shortcut = settings?.shortcuts.main || config.shortcuts.main;
      this.tray.setToolTip('Prompt Line - Press ' + shortcut + ' to open');

      this.tray.on('double-click', async () => {
        await this.showInputWindow();
      });
    } catch (error) {
      logger.error('Failed to create system tray:', error);
      throw error;
    }
  }

  /**
   * Create tray icon with multiple resolutions
   */
  private createTrayIcon(): NativeImage {
    const iconPath22 = path.join(__dirname, '..', 'assets', 'icon-tray-22.png');
    const iconPath44 = path.join(__dirname, '..', 'assets', 'icon-tray-44.png');
    const iconPath88 = path.join(__dirname, '..', 'assets', 'icon-tray-88.png');

    const icon = nativeImage.createEmpty();

    this.addIconRepresentation(icon, iconPath22, 1.0, 22);
    this.addIconRepresentation(icon, iconPath44, 2.0, 44);
    this.addIconRepresentation(icon, iconPath88, 4.0, 88);

    icon.setTemplateImage(true);
    return icon;
  }

  /**
   * Add icon representation if file exists
   */
  private addIconRepresentation(
    icon: NativeImage,
    iconPath: string,
    scaleFactor: number,
    size: number
  ): void {
    if (fs.existsSync(iconPath)) {
      icon.addRepresentation({
        scaleFactor,
        width: size,
        height: size,
        buffer: fs.readFileSync(iconPath)
      });
    }
  }

  /**
   * Create tray context menu
   */
  private createTrayContextMenu(): Menu {
    return Menu.buildFromTemplate([
      {
        label: 'Show Prompt Line',
        click: async () => { await this.showInputWindow(); }
      },
      {
        label: 'Hide Window',
        click: async () => { await this.hideInputWindow(); }
      },
      { type: 'separator' },
      {
        label: 'Settings',
        click: async () => { await this.openSettingsFile(); }
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
        click: () => { this.quitApp(); }
      }
    ]);
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

      const draftData = this.draftManager.getDraftWithScrollTop();
      const settings = this.settingsManager.getSettings();
      // Use getHistoryForSearch for larger search scope (5000 items instead of 200)
      const history = await this.historyManager.getHistoryForSearch(LIMITS.MAX_SEARCH_ITEMS);

      logger.debug('Settings from settingsManager:', {
        hasFileSearch: !!settings.fileSearch,
        fileSearch: settings.fileSearch
      });

      const windowData: WindowData = {
        history,
        draft: draftData.text ? {
          text: draftData.text,
          scrollTop: draftData.scrollTop,
          timestamp: Date.now(),
          saved: true
        } : null,
        settings
      };

      await this.windowManager.showInputWindow(windowData);
      logger.debug('Input window shown with data', {
        historyItems: windowData.history?.length || 0,
        hasDraft: !!windowData.draft
      });

      // Debug: Test directory detection with the previously detected app's bundleId
      const previousApp = this.windowManager.getPreviousApp();
      const bundleId = previousApp && typeof previousApp === 'object' && previousApp.bundleId ? previousApp.bundleId : undefined;
      this.testDirectoryDetection(bundleId);
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

      if (this.settingsManager) {
        cleanupPromises.push(this.settingsManager.destroy());
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