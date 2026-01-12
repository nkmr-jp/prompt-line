import type Electron from 'electron';
import { IpcMainInvokeEvent } from 'electron';
import { logger, SecureErrors } from '../utils/utils';
import type DraftManager from '../managers/draft-manager';
import type DirectoryManager from '../managers/directory-manager';
import type WindowManager from '../managers/window';
import type { AppInfo, HistoryItem, IHistoryManager } from '../types';
import { VALIDATION } from '../constants';
import type { IPCResult } from './handler-utils';
import { atPathCacheManager } from '../managers/at-path-cache-manager';

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
  private windowManager: WindowManager;

  constructor(
    historyManager: IHistoryManager,
    draftManager: DraftManager,
    directoryManager: DirectoryManager,
    windowManager: WindowManager
  ) {
    this.historyManager = historyManager;
    this.draftManager = draftManager;
    this.directoryManager = directoryManager;
    this.windowManager = windowManager;
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

    // At-path cache handlers (for highlighting symbols with spaces)
    ipcMain.handle('register-at-path', this.handleRegisterAtPath.bind(this));
    ipcMain.handle('get-registered-at-paths', this.handleGetRegisteredAtPaths.bind(this));

    // Global at-path cache handlers (for mdSearch agents and other project-independent items)
    ipcMain.handle('register-global-at-path', this.handleRegisterGlobalAtPath.bind(this));
    ipcMain.handle('get-global-at-paths', this.handleGetGlobalAtPaths.bind(this));

    // Draft to history handler
    ipcMain.handle('save-draft-to-history', this.handleSaveDraftToHistory.bind(this));
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
      'get-draft-directory',
      'register-at-path',
      'get-registered-at-paths',
      'register-global-at-path',
      'get-global-at-paths',
      'save-draft-to-history'
    ];

    handlers.forEach(handler => {
      ipcMain.removeAllListeners(handler);
    });

    logger.info('History and Draft IPC handlers removed');
  }

  // History handlers

  private async handleGetHistory(
    _event: IpcMainInvokeEvent,
    options?: { limit?: number; offset?: number }
  ): Promise<HistoryItem[]> {
    try {
      // limitがundefinedの場合はそのまま渡す（後方互換性のため全キャッシュを返す）
      const limit = options?.limit;
      const offset = options?.offset ?? 0;
      return await this.historyManager.getHistory(limit, offset);
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
      if (!id || typeof id !== 'string' || !id.match(/^[a-z0-9]+$/) || id.length > VALIDATION.MAX_ID_LENGTH) {
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
      return await this.historyManager.searchHistory(query, limit);
    } catch (error) {
      logger.error('Failed to search history:', error);
      return [];
    }
  }

  // Draft handlers

  private async handleSaveDraft(
    _event: IpcMainInvokeEvent,
    text: string,
    scrollTop = 0,
    immediate = false
  ): Promise<IPCResult> {
    try {
      if (immediate) {
        await this.draftManager.saveDraftImmediately(text, scrollTop);
      } else {
        await this.draftManager.saveDraft(text, scrollTop);
      }

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
      return this.draftManager.getCurrentDraft();
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
      return { success: true };
    } catch (error) {
      logger.error('Failed to set directory:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  private async handleGetDraftDirectory(_event: IpcMainInvokeEvent): Promise<string | null> {
    try {
      return this.directoryManager.getDirectory();
    } catch (error) {
      logger.error('Failed to get directory:', error);
      return null;
    }
  }

  // At-path cache handlers

  private async handleRegisterAtPath(
    _event: IpcMainInvokeEvent,
    directory: string,
    atPath: string
  ): Promise<IPCResult> {
    try {
      if (!directory || typeof directory !== 'string') {
        return { success: false, error: 'Invalid directory' };
      }
      if (!atPath || typeof atPath !== 'string') {
        return { success: false, error: 'Invalid path' };
      }

      await atPathCacheManager.addPath(directory, atPath);
      return { success: true };
    } catch (error) {
      logger.error('Failed to register at-path:', error);
      return { success: false, error: SecureErrors.OPERATION_FAILED };
    }
  }

  private async handleGetRegisteredAtPaths(
    _event: IpcMainInvokeEvent,
    directory: string
  ): Promise<string[]> {
    try {
      if (!directory || typeof directory !== 'string') {
        return [];
      }

      return await atPathCacheManager.loadPaths(directory);
    } catch (error) {
      logger.error('Failed to get registered at-paths:', error);
      return [];
    }
  }

  // Global at-path cache handlers (for mdSearch agents and other project-independent items)

  private async handleRegisterGlobalAtPath(
    _event: IpcMainInvokeEvent,
    atPath: string
  ): Promise<IPCResult> {
    try {
      if (!atPath || typeof atPath !== 'string') {
        return { success: false, error: 'Invalid path' };
      }

      await atPathCacheManager.addGlobalPath(atPath);
      return { success: true };
    } catch (error) {
      logger.error('Failed to register global at-path:', error);
      return { success: false, error: SecureErrors.OPERATION_FAILED };
    }
  }

  private async handleGetGlobalAtPaths(
    _event: IpcMainInvokeEvent
  ): Promise<string[]> {
    try {
      return await atPathCacheManager.loadGlobalPaths();
    } catch (error) {
      logger.error('Failed to get global at-paths:', error);
      return [];
    }
  }

  // Draft to history handler

  /**
   * Extract app name from AppInfo or string
   */
  private extractAppName(previousApp: AppInfo | string | null): string | undefined {
    if (!previousApp) return undefined;
    if (typeof previousApp === 'string') return previousApp;
    return previousApp.name || undefined;
  }

  private async handleSaveDraftToHistory(
    _event: IpcMainInvokeEvent,
    text: string
  ): Promise<{ success: boolean; item?: HistoryItem; error?: string }> {
    try {
      if (!text || typeof text !== 'string') {
        return { success: false, error: 'Invalid text' };
      }

      const trimmedText = text.trim();
      if (!trimmedText) {
        return { success: false, error: 'Empty text' };
      }

      // Get appName and directory (same as paste operation)
      const previousApp = this.windowManager.getPreviousApp();
      const appName = this.extractAppName(previousApp);
      const directory = this.directoryManager.getDirectory() || undefined;

      // Add to history with appName and directory
      const item = await this.historyManager.addToHistory(trimmedText, appName, directory);
      if (!item) {
        return { success: false, error: 'Failed to add to history' };
      }

      logger.info('Draft saved to history via Cmd+S', { id: item.id, appName, directory });
      return { success: true, item };
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to save draft to history:', { message: err.message, stack: err.stack });
      return { success: false, error: SecureErrors.OPERATION_FAILED };
    }
  }
}

export default HistoryDraftHandler;
