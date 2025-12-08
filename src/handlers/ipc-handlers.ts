import { ipcMain } from 'electron';
import { logger } from '../utils/utils';
import type WindowManager from '../managers/window-manager';
import type DraftManager from '../managers/draft-manager';
import type DirectoryManager from '../managers/directory-manager';
import type SettingsManager from '../managers/settings-manager';
import type { IHistoryManager } from '../types';
import MdSearchLoader from '../managers/md-search-loader';
import FileOpenerManager from '../managers/file-opener-manager';

// Import specialized handlers
import PasteHandler from './paste-handler';
import HistoryDraftHandler from './history-draft-handler';
import WindowHandler from './window-handler';
import SystemHandler from './system-handler';
import MdSearchHandler from './mdsearch-handler';
import FileHandler from './file-handler';

interface HandlerStats {
  totalHandlers: number;
  registeredHandlers: string[];
  timestamp: number;
}

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
 * - MdSearchHandler: Manages slash commands and agent operations
 * - FileHandler: Handles file operations and external URLs
 */
class IPCHandlers {
  private pasteHandler: PasteHandler;
  private historyDraftHandler: HistoryDraftHandler;
  private windowHandler: WindowHandler;
  private systemHandler: SystemHandler;
  private mdSearchHandler: MdSearchHandler;
  private fileHandler: FileHandler;

  constructor(
    windowManager: WindowManager,
    historyManager: IHistoryManager,
    draftManager: DraftManager,
    directoryManager: DirectoryManager,
    settingsManager: SettingsManager
  ) {
    // Initialize MdSearchLoader and FileOpenerManager
    const mdSearchLoader = new MdSearchLoader();
    const fileOpenerManager = new FileOpenerManager(settingsManager);

    // Initialize MdSearchLoader with settings
    const settings = settingsManager.getSettings();
    if (settings.mdSearch) {
      mdSearchLoader.updateConfig(settings.mdSearch);
      logger.info('MdSearch config updated from settings');
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
      directoryManager
    );
    this.windowHandler = new WindowHandler(windowManager);
    this.systemHandler = new SystemHandler(settingsManager);
    this.mdSearchHandler = new MdSearchHandler(mdSearchLoader, settingsManager);
    this.fileHandler = new FileHandler(fileOpenerManager, directoryManager);

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
    this.mdSearchHandler.setupHandlers(ipcMain);
    this.fileHandler.setupHandlers(ipcMain);

    logger.info('All IPC handlers set up successfully via coordinator');
  }

  /**
   * Remove all IPC handlers by delegating to specialized handler modules
   */
  removeAllHandlers(): void {
    this.pasteHandler.removeHandlers(ipcMain);
    this.historyDraftHandler.removeHandlers(ipcMain);
    this.windowHandler.removeHandlers(ipcMain);
    this.systemHandler.removeHandlers(ipcMain);
    this.mdSearchHandler.removeHandlers(ipcMain);
    this.fileHandler.removeHandlers(ipcMain);

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