import { IpcMainInvokeEvent } from 'electron';
import { logger, SecureErrors } from '../utils/utils';
import type DraftManager from '../managers/draft-manager';
import type DirectoryManager from '../managers/directory-manager';
import type { HistoryItem, IHistoryManager } from '../types';

interface IPCResult {
  success: boolean;
  error?: string;
}

// Constants
const MAX_ID_LENGTH = 32; // Must match utils.generateId() output

/**
 * HistoryDraftHandler manages all IPC communication related to history and draft operations.
 *
 * This handler provides a clean separation of concerns by isolating history and draft
 * related IPC channels from other application handlers.
 */
class HistoryDraftHandler {
  private historyManager: IHistoryManager;
  private draftManager: DraftManager;
  private directoryManager: DirectoryManager;

  constructor(
    historyManager: IHistoryManager,
    draftManager: DraftManager,
    directoryManager: DirectoryManager
  ) {
    this.historyManager = historyManager;
    this.draftManager = draftManager;
    this.directoryManager = directoryManager;
  }

  /**
   * Registers all history and draft related IPC handlers
   */
  setupHandlers(ipcMain: Electron.IpcMain): void {
    // History handlers
    ipcMain.handle('get-history', this.handleGetHistory.bind(this));
    ipcMain.handle('clear-history', this.handleClearHistory.bind(this));
    ipcMain.handle('remove-history-item', this.handleRemoveHistoryItem.bind(this));
    ipcMain.handle('search-history', this.handleSearchHistory.bind(this));

    // Draft handlers
    ipcMain.handle('save-draft', this.handleSaveDraft.bind(this));
    ipcMain.handle('clear-draft', this.handleClearDraft.bind(this));
    ipcMain.handle('get-draft', this.handleGetDraft.bind(this));
    ipcMain.handle('set-draft-directory', this.handleSetDraftDirectory.bind(this));
    ipcMain.handle('get-draft-directory', this.handleGetDraftDirectory.bind(this));

    logger.info('History and Draft IPC handlers set up successfully');
  }

  /**
   * Removes all history and draft related IPC handlers
   */
  removeHandlers(ipcMain: Electron.IpcMain): void {
    const handlers = [
      'get-history',
      'clear-history',
      'remove-history-item',
      'search-history',
      'save-draft',
      'clear-draft',
      'get-draft',
      'set-draft-directory',
      'get-draft-directory'
    ];

    handlers.forEach(handler => {
      ipcMain.removeAllListeners(handler);
    });

    logger.info('History and Draft IPC handlers removed');
  }

  // History handlers

  private async handleGetHistory(_event: IpcMainInvokeEvent): Promise<HistoryItem[]> {
    try {
      const history = await this.historyManager.getHistory();
      logger.debug('History requested', { count: history.length });
      return history;
    } catch (error) {
      logger.error('Failed to get history:', error);
      return [];
    }
  }

  private async handleClearHistory(_event: IpcMainInvokeEvent): Promise<IPCResult> {
    try {
      await this.historyManager.clearHistory();
      logger.info('History cleared via IPC');
      return { success: true };
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to clear history:', { message: err.message, stack: err.stack });
      return { success: false, error: SecureErrors.OPERATION_FAILED };
    }
  }

  private async handleRemoveHistoryItem(_event: IpcMainInvokeEvent, id: string): Promise<IPCResult> {
    try {
      // Validate ID format (must match generateId() output: lowercase alphanumeric)
      // NOTE: This regex is coupled with utils.generateId() - update both if ID format changes
      if (!id || typeof id !== 'string' || !id.match(/^[a-z0-9]+$/) || id.length > MAX_ID_LENGTH) {
        logger.warn('Invalid history item ID format', { id });
        return { success: false, error: SecureErrors.INVALID_FORMAT };
      }

      const removed = await this.historyManager.removeHistoryItem(id);
      logger.info('History item removal requested', { id, removed });
      return { success: removed };
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to remove history item:', { message: err.message, stack: err.stack });
      return { success: false, error: SecureErrors.OPERATION_FAILED };
    }
  }

  private async handleSearchHistory(
    _event: IpcMainInvokeEvent,
    query: string,
    limit = 10
  ): Promise<HistoryItem[]> {
    try {
      const results = await this.historyManager.searchHistory(query, limit);
      logger.debug('History search requested', { query, results: results.length });
      return results;
    } catch (error) {
      logger.error('Failed to search history:', error);
      return [];
    }
  }

  // Draft handlers

  private async handleSaveDraft(
    _event: IpcMainInvokeEvent,
    text: string,
    immediate = false
  ): Promise<IPCResult> {
    try {
      if (immediate) {
        await this.draftManager.saveDraftImmediately(text);
      } else {
        await this.draftManager.saveDraft(text);
      }

      logger.debug('Draft save requested', { length: text.length, immediate });
      return { success: true };
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to save draft:', { message: err.message, stack: err.stack });
      return { success: false, error: SecureErrors.OPERATION_FAILED };
    }
  }

  private async handleClearDraft(_event: IpcMainInvokeEvent): Promise<IPCResult> {
    try {
      await this.draftManager.clearDraft();
      logger.info('Draft cleared via IPC');
      return { success: true };
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to clear draft:', { message: err.message, stack: err.stack });
      return { success: false, error: SecureErrors.OPERATION_FAILED };
    }
  }

  private async handleGetDraft(_event: IpcMainInvokeEvent): Promise<string> {
    try {
      const draft = this.draftManager.getCurrentDraft();
      logger.debug('Draft requested', { length: draft.length });
      return draft;
    } catch (error) {
      logger.error('Failed to get draft:', error);
      return '';
    }
  }

  private async handleSetDraftDirectory(
    _event: IpcMainInvokeEvent,
    directory: string | null
  ): Promise<IPCResult> {
    try {
      if (directory) {
        await this.directoryManager.saveDirectory(directory);
      } else {
        this.directoryManager.setDirectory(null);
      }
      logger.debug('Directory set via IPC', { directory });
      return { success: true };
    } catch (error) {
      logger.error('Failed to set directory:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  private async handleGetDraftDirectory(_event: IpcMainInvokeEvent): Promise<string | null> {
    try {
      const directory = this.directoryManager.getDirectory();
      logger.debug('Directory requested', { directory });
      return directory;
    } catch (error) {
      logger.error('Failed to get directory:', error);
      return null;
    }
  }
}

export default HistoryDraftHandler;
