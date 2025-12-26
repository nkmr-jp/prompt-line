import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { logger, sleep } from '../utils/utils';
import type WindowManager from '../managers/window';
import type { WindowData } from '../types';
import config from '../config/app-config';

interface IPCResult {
  success: boolean;
  error?: string;
}

/**
 * WindowHandler manages window-related IPC communication
 * Handles show, hide, and focus operations for the input window
 */
class WindowHandler {
  private windowManager: WindowManager;

  constructor(windowManager: WindowManager) {
    this.windowManager = windowManager;
  }

  /**
   * Register all window-related IPC handlers
   */
  setupHandlers(ipcMainInstance: typeof ipcMain): void {
    ipcMainInstance.handle('hide-window', this.handleHideWindow.bind(this));
    ipcMainInstance.handle('show-window', this.handleShowWindow.bind(this));
    ipcMainInstance.handle('focus-window', this.handleFocusWindow.bind(this));
    logger.info('Window IPC handlers registered');
  }

  /**
   * Remove all window-related IPC handlers
   */
  removeHandlers(ipcMainInstance: typeof ipcMain): void {
    ipcMainInstance.removeAllListeners('hide-window');
    ipcMainInstance.removeAllListeners('show-window');
    ipcMainInstance.removeAllListeners('focus-window');
    logger.info('Window IPC handlers removed');
  }

  private async handleHideWindow(_event: IpcMainInvokeEvent, restoreFocus: boolean = true): Promise<IPCResult> {
    try {
      logger.debug('Window hide requested, restoreFocus:', restoreFocus);

      await this.windowManager.hideInputWindow();

      // Focus the previous app when hiding the window (only if restoreFocus is true)
      if (config.platform.isMac && restoreFocus) {
        try {
          // Wait for window hide animation to complete
          await sleep(config.timing.windowHideDelay || 150);

          // Attempt to focus previous app
          const focusSuccess = await this.windowManager.focusPreviousApp();

          if (!focusSuccess) {
            logger.warn('Failed to focus previous app via native tools - no fallback available for security reasons');
          } else {
            logger.debug('Successfully focused previous app');
          }
        } catch (focusError) {
          // Log but don't fail the operation if focus fails
          logger.warn('Failed to focus previous app:', focusError);
        }
      }

      return { success: true };
    } catch (error) {
      logger.error('Failed to hide window:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  private async handleShowWindow(
    _event: IpcMainInvokeEvent,
    data: WindowData = {}
  ): Promise<IPCResult> {
    try {
      await this.windowManager.showInputWindow(data);
      logger.debug('Window show requested');
      return { success: true };
    } catch (error) {
      logger.error('Failed to show window:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  private async handleFocusWindow(_event: IpcMainInvokeEvent): Promise<IPCResult> {
    try {
      this.windowManager.focusWindow();
      logger.debug('Window focus requested');
      return { success: true };
    } catch (error) {
      logger.error('Failed to focus window:', error);
      return { success: false, error: (error as Error).message };
    }
  }
}

export default WindowHandler;
