import { ipcMain } from 'electron';
import { logger } from '../utils/utils';
import type WindowManager from '../managers/window';
import type DraftManager from '../managers/draft-manager';
import type DirectoryManager from '../managers/directory-manager';
import type SettingsManager from '../managers/settings-manager';
import type BuiltInCommandsManager from '../managers/built-in-commands-manager';
import type { IHistoryManager, HandlerStats } from '../types';
import CustomSearchLoader from '../managers/custom-search-loader';
import FileOpenerManager from '../managers/file-opener-manager';

// Import specialized handlers
import PasteHandler from './paste-handler';
import HistoryDraftHandler from './history-draft-handler';
import WindowHandler from './window-handler';
import SystemHandler from './system-handler';
import CustomSearchHandler from './custom-search-handler';
import FileHandler from './file-handler';
import UsageHistoryHandler from './usage-history-handler';

/**
 * IPCHandlers Coordinator
 *
 * This class coordinates all IPC handlers by delegating to specialized handler modules.
 * It maintains the same public API as the original monolithic IPCHandlers class,
 * ensuring backward compatibility while providing better separation of concerns.
 *
 * Architecture:
 * - PasteHandler: Handles paste operations (text and images)
 * - HistoryDraftHandler: Manages history and draft operations
 * - WindowHandler: Controls window visibility and focus
 * - SystemHandler: Provides system info, config, and settings
 * - CustomSearchHandler: Manages slash commands and agent operations
 * - FileHandler: Handles file operations and external URLs
 * - UsageHistoryHandler: Manages usage history tracking for files, symbols, and agents
 */
class IPCHandlers {
  private pasteHandler: PasteHandler;
  private historyDraftHandler: HistoryDraftHandler;
  private windowHandler: WindowHandler;
  private systemHandler: SystemHandler;
  private customSearchHandler: CustomSearchHandler;
  private fileHandler: FileHandler;
  private usageHistoryHandler: UsageHistoryHandler;

  constructor(
    windowManager: WindowManager,
    historyManager: IHistoryManager,
    draftManager: DraftManager,
    directoryManager: DirectoryManager,
    settingsManager: SettingsManager,
    builtInCommandsManager: BuiltInCommandsManager
  ) {
    // Initialize CustomSearchLoader and FileOpenerManager
    const settings = settingsManager.getSettings();
    const customSearchLoader = new CustomSearchLoader(
      settings.customSearch ?? settings.mdSearch,
      settings
    );
    const fileOpenerManager = new FileOpenerManager(settingsManager);

    // Initialize CustomSearchLoader with settings
    const customSearchConfig = settings.customSearch ?? settings.mdSearch;
    if (customSearchConfig) {
      customSearchLoader.updateConfig(customSearchConfig);
      customSearchLoader.updateSettings(settings);
      logger.info('CustomSearch config updated from settings');
    }

    // Instantiate specialized handler classes
    this.pasteHandler = new PasteHandler(
      windowManager,
      historyManager,
      draftManager,
      directoryManager
    );
    this.historyDraftHandler = new HistoryDraftHandler(
      historyManager,
      draftManager,
      directoryManager,
      windowManager
    );
    this.windowHandler = new WindowHandler(windowManager);
    this.systemHandler = new SystemHandler(settingsManager);
    this.customSearchHandler = new CustomSearchHandler(
      customSearchLoader,
      settingsManager,
      builtInCommandsManager
    );
    this.fileHandler = new FileHandler(fileOpenerManager, directoryManager);
    this.usageHistoryHandler = new UsageHistoryHandler();

    // Setup all handlers
    this.setupHandlers();
  }

  /**
   * Setup all IPC handlers by delegating to specialized handler modules
   */
  private setupHandlers(): void {
    this.pasteHandler.setupHandlers(ipcMain);
    this.historyDraftHandler.setupHandlers(ipcMain);
    this.windowHandler.setupHandlers(ipcMain);
    this.systemHandler.setupHandlers(ipcMain);
    this.customSearchHandler.setupHandlers(ipcMain);
    this.fileHandler.setupHandlers(ipcMain);
    this.usageHistoryHandler.setupHandlers(ipcMain);
  }

  /**
   * Remove all IPC handlers by delegating to specialized handler modules
   */
  removeAllHandlers(): void {
    this.pasteHandler.removeHandlers(ipcMain);
    this.historyDraftHandler.removeHandlers(ipcMain);
    this.windowHandler.removeHandlers(ipcMain);
    this.systemHandler.removeHandlers(ipcMain);
    this.customSearchHandler.removeHandlers(ipcMain);
    this.fileHandler.removeHandlers(ipcMain);
    this.usageHistoryHandler.removeHandlers(ipcMain);

    logger.info('All IPC handlers removed via coordinator');
  }

  /**
   * Get statistics about registered IPC handlers
   */
  getHandlerStats(): HandlerStats {
    const handlers = ipcMain.eventNames() as string[];
    return {
      totalHandlers: handlers.length,
      registeredHandlers: handlers,
      timestamp: Date.now()
    };
  }
}

export default IPCHandlers;