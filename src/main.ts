import { app } from 'electron';

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

import WindowManager from './managers/window-manager';
import HistoryManager from './managers/history-manager';
import OptimizedHistoryManager from './managers/optimized-history-manager';
import DraftManager from './managers/draft-manager';
import DirectoryManager from './managers/directory-manager';
import SettingsManager from './managers/settings-manager';
import IPCHandlers from './handlers/ipc-handlers';
import { codeSearchHandler } from './handlers/code-search-handler';
import { TrayManager } from './main/tray-manager';
import { DirectoryDetector } from './main/directory-detector';
import { AppInitializer } from './main/initialization';
import { AppEventListener } from './main/app-events';
import { AppCleanup } from './main/cleanup';
import { UISetup } from './main/ui-setup';
import { logger } from './utils/utils';
import { LIMITS } from './constants';
import type { WindowData } from './types';

class PromptLineApp {
  private windowManager: WindowManager | null = null;
  private historyManager: HistoryManager | OptimizedHistoryManager | null = null;
  private draftManager: DraftManager | null = null;
  private directoryManager: DirectoryManager | null = null;
  private settingsManager: SettingsManager | null = null;
  private ipcHandlers: IPCHandlers | null = null;
  private trayManager: TrayManager | null = null;
  private directoryDetector: DirectoryDetector | null = null;
  private isInitialized = false;

  private initializer = new AppInitializer();
  private appCleanup = new AppCleanup();

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Prompt Line...');

      await this.initializer.ensureDataDirectories();
      await this.initializeManagers();
      this.configureWindowManager();
      this.setupHandlers();
      this.setupUIComponents();
      this.finalizeInitialization();

    } catch (error) {
      logger.error('Failed to initialize application:', error);
      throw error;
    }
  }

  private async initializeManagers(): Promise<void> {
    const managers = await this.initializer.initializeManagers();
    this.windowManager = managers.windowManager;
    this.historyManager = managers.historyManager;
    this.draftManager = managers.draftManager;
    this.directoryManager = managers.directoryManager;
    this.settingsManager = managers.settingsManager;
  }

  private configureWindowManager(): void {
    if (!this.windowManager || !this.settingsManager || !this.directoryManager) {
      throw new Error('Required managers not initialized');
    }

    this.initializer.configureWindowManager(
      this.windowManager,
      this.settingsManager,
      this.directoryManager
    );
  }

  private setupIpcHandlers(): void {
    if (!this.windowManager || !this.historyManager || !this.draftManager ||
        !this.directoryManager || !this.settingsManager) {
      throw new Error('Required managers not initialized for IPC handlers');
    }

    this.ipcHandlers = new IPCHandlers(
      this.windowManager,
      this.historyManager,
      this.draftManager,
      this.directoryManager,
      this.settingsManager
    );
  }

  private setupHandlers(): void {
    this.setupIpcHandlers();
    this.setupCodeSearchHandler();
  }

  private setupCodeSearchHandler(): void {
    if (!this.settingsManager) {
      throw new Error('Settings manager not initialized for code search handler');
    }

    codeSearchHandler.setSettingsManager(this.settingsManager);
    codeSearchHandler.register();
  }

  private setupUIComponents(): void {
    if (!this.settingsManager || !this.draftManager || !this.historyManager) {
      throw new Error('Required managers not initialized for UI setup');
    }

    this.initializeDirectoryDetector();

    const uiSetup = new UISetup(this.settingsManager);
    uiSetup.registerShortcuts(this.showInputWindow.bind(this));
    this.trayManager = uiSetup.initializeTray({
      onShowWindow: this.showInputWindow.bind(this),
      onHideWindow: this.hideInputWindow.bind(this),
      onOpenSettings: uiSetup.openSettingsFile.bind(uiSetup),
      onQuit: this.quitApp.bind(this)
    });
    uiSetup.hideDockIcon();

    const eventListener = new AppEventListener(
      this.draftManager,
      this.historyManager,
      {
        onShowWindow: this.showInputWindow.bind(this),
        onCleanup: this.cleanup.bind(this)
      }
    );
    eventListener.setupEventListeners();
  }

  private initializeDirectoryDetector(): void {
    this.directoryDetector = new DirectoryDetector();
  }

  private finalizeInitialization(): void {
    this.isInitialized = true;
    this.logInitializationSuccess();
  }

  private logInitializationSuccess(): void {
    if (!this.historyManager || !this.draftManager || !this.settingsManager) {
      return;
    }

    this.initializer.logInitializationSuccess(
      this.historyManager,
      this.draftManager,
      this.settingsManager
    );
  }

  private quitApp(): void {
    logger.info('Quit requested from tray menu');
    app.quit();
  }

  async showInputWindow(): Promise<void> {
    try {
      if (!this.isInitialized || !this.windowManager || !this.historyManager || !this.draftManager || !this.settingsManager) {
        logger.warn('App not initialized, cannot show window');
        return;
      }

      const draft = this.draftManager.getCurrentDraft();
      const settings = this.settingsManager.getSettings();
      // Use getHistoryForSearch for larger search scope (5000 items instead of 200)
      const history = await this.historyManager.getHistoryForSearch(LIMITS.MAX_SEARCH_ITEMS);

      logger.debug('Settings from settingsManager:', {
        hasFileSearch: !!settings.fileSearch,
        fileSearch: settings.fileSearch
      });

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

      // Debug: Test directory detection when editor is shown
      if (this.directoryDetector) {
        this.directoryDetector.testDirectoryDetection();
      }
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
    await this.appCleanup.cleanup({
      windowManager: this.windowManager,
      historyManager: this.historyManager,
      draftManager: this.draftManager,
      ipcHandlers: this.ipcHandlers,
      trayManager: this.trayManager
    });

    // Clear references after cleanup
    this.trayManager = null;
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
