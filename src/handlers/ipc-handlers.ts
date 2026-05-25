import { ipcMain, IpcMainEvent } from 'electron';
import { logger } from '../utils/utils';
import type WindowManager from '../managers/window';
import type DraftManager from '../managers/draft-manager';
import type DirectoryManager from '../managers/directory-manager';
import type SettingsManager from '../managers/settings-manager';
import type PluginManager from '../managers/plugin-manager';
import type { IHistoryManager, HandlerStats } from '../types';
import CustomSearchLoader from '../managers/custom-search-loader';
import { FileOpenerManager } from '../managers/file-opener-manager';

// Import specialized handlers
import PasteHandler from './paste-handler';
import HistoryDraftHandler from './history-draft-handler';
import WindowHandler from './window-handler';
import SystemHandler from './system-handler';
import CustomSearchHandler from './custom-search-handler';
import FileHandler from './file-handler';
import UsageHistoryHandler from './usage-history-handler';

const ALLOWED_PERF_TRACE_EVENTS = new Set([
  'renderer-window-shown',
  'renderer-prefetch-skills',
]);
const PERF_TRACE_MAX_KEYS = 16;

function perfTraceReportListener(_event: IpcMainEvent, payload: unknown): void {
  try {
    if (!payload || typeof payload !== 'object') return;
    const { event, ms, ...rest } = payload as Record<string, unknown>;
    if (typeof event !== 'string' || !ALLOWED_PERF_TRACE_EVENTS.has(event)) return;
    if (typeof ms !== 'number' || !Number.isFinite(ms)) return;
    if (Object.keys(rest).length > PERF_TRACE_MAX_KEYS) return;
    logger.info(event, { ms, ...rest });
  } catch (error) {
    logger.warn('Failed to log perf trace from renderer:', error);
  }
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
    pluginManager: PluginManager
  ) {
    const { customSearchLoader, fileOpenerManager } =
      this.initDependencies(settingsManager);

    this.pasteHandler = new PasteHandler(
      windowManager,
      historyManager,
      draftManager,
      directoryManager,
      settingsManager
    );
    this.historyDraftHandler = new HistoryDraftHandler(
      historyManager,
      draftManager,
      directoryManager,
      windowManager
    );
    this.windowHandler = new WindowHandler(windowManager);
    this.systemHandler = new SystemHandler(settingsManager, directoryManager);
    // Connect DirectoryManager to CustomSearchLoader for {projectdir} template variable
    customSearchLoader.setProjectdirGetter(() => directoryManager.getDirectory());
    this.customSearchHandler = new CustomSearchHandler(
      customSearchLoader,
      settingsManager,
      pluginManager,
      directoryManager
    );
    this.fileHandler = new FileHandler(fileOpenerManager, directoryManager);
    this.usageHistoryHandler = new UsageHistoryHandler();

    this.setupHandlers();
  }

  private initDependencies(settingsManager: SettingsManager): {
    customSearchLoader: CustomSearchLoader;
    fileOpenerManager: FileOpenerManager;
  } {
    const settings = settingsManager.getSettings();
    const customSearchEntries = settingsManager.getCustomSearchEntries();
    const customSearchLoader = new CustomSearchLoader(
      customSearchEntries,
      settings
    );
    const fileOpenerManager = new FileOpenerManager(settingsManager);

    if (customSearchEntries && customSearchEntries.length > 0) {
      customSearchLoader.updateConfig(customSearchEntries);
      customSearchLoader.updateSettings(settings);
      logger.info('CustomSearch config updated from settings');
    }

    return { customSearchLoader, fileOpenerManager };
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
    this.setupPerfTraceReceiver();
  }

  private setupPerfTraceReceiver(): void {
    ipcMain.on('perf-trace-report', perfTraceReportListener);
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
    ipcMain.removeAllListeners('perf-trace-report');

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