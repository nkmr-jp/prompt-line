import config from '../config/app-config';
import WindowManager from '../managers/window-manager';
import HistoryManager from '../managers/history-manager';
import OptimizedHistoryManager from '../managers/optimized-history-manager';
import DraftManager from '../managers/draft-manager';
import DirectoryManager from '../managers/directory-manager';
import SettingsManager from '../managers/settings-manager';
import { logger, ensureDir } from '../utils/utils';

export interface Managers {
  windowManager: WindowManager;
  historyManager: HistoryManager | OptimizedHistoryManager;
  draftManager: DraftManager;
  directoryManager: DirectoryManager;
  settingsManager: SettingsManager;
}

export class AppInitializer {
  async ensureDataDirectories(): Promise<void> {
    await ensureDir(config.paths.userDataDir);
    await ensureDir(config.paths.imagesDir);
    logger.info('Data directories ensured at:', config.paths.userDataDir);
  }

  async initializeManagers(): Promise<Managers> {
    const windowManager = new WindowManager();
    const draftManager = new DraftManager();
    const directoryManager = new DirectoryManager();
    const settingsManager = new SettingsManager();

    await windowManager.initialize();
    await draftManager.initialize();
    await directoryManager.initialize();
    await settingsManager.init();

    logger.info('Using OptimizedHistoryManager (unlimited history by default)');
    const historyManager = new OptimizedHistoryManager();
    await historyManager.initialize();

    return {
      windowManager,
      historyManager,
      draftManager,
      directoryManager,
      settingsManager
    };
  }

  configureWindowManager(
    windowManager: WindowManager,
    settingsManager: SettingsManager,
    directoryManager: DirectoryManager
  ): void {
    const userSettings = settingsManager.getSettings();
    windowManager.updateWindowSettings(userSettings.window);

    const fileSearchSettings = settingsManager.getFileSearchSettings();
    if (fileSearchSettings) {
      windowManager.updateFileSearchSettings(fileSearchSettings);
    }

    windowManager.setDirectoryManager(directoryManager);
  }

  logInitializationSuccess(
    historyManager: HistoryManager | OptimizedHistoryManager,
    draftManager: DraftManager,
    settingsManager: SettingsManager
  ): void {
    const historyStats = historyManager.getHistoryStats();
    const settings = settingsManager.getSettings();

    logger.info('Prompt Line initialized successfully', {
      historyItems: historyStats.totalItems,
      hasDraft: draftManager.hasDraft(),
      platform: process.platform
    });

    console.log('\n=== Prompt Line ===');
    console.log(`Shortcut: ${settings.shortcuts.main}`);
    console.log('Usage: Enter text and press Cmd+Enter to paste');
    console.log(`History: ${historyStats.totalItems} items loaded`);
    console.log('Exit: Ctrl+C\n');
  }
}
