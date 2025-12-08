import { ipcMain, clipboard, IpcMainInvokeEvent, dialog } from 'electron';
import { execFile } from 'child_process';
import config from '../config/app-config';
import {
  logger,
  pasteWithNativeTool,
  activateAndPasteWithNativeTool,
  sleep,
  checkAccessibilityPermission,
  SecureErrors
} from '../utils/utils';
import type WindowManager from '../managers/window-manager';
import type DraftManager from '../managers/draft-manager';
import type DirectoryManager from '../managers/directory-manager';
import type { AppInfo, IHistoryManager } from '../types';

interface PasteResult {
  success: boolean;
  error?: string;
  warning?: string;
}

// Constants
const MAX_PASTE_TEXT_LENGTH_BYTES = 1024 * 1024; // 1MB limit for paste text

class PasteHandler {
  private windowManager: WindowManager;
  private historyManager: IHistoryManager;
  private draftManager: DraftManager;
  private directoryManager: DirectoryManager;

  constructor(
    windowManager: WindowManager,
    historyManager: IHistoryManager,
    draftManager: DraftManager,
    directoryManager: DirectoryManager
  ) {
    this.windowManager = windowManager;
    this.historyManager = historyManager;
    this.draftManager = draftManager;
    this.directoryManager = directoryManager;
  }

  setupHandlers(ipcMainInstance: typeof ipcMain): void {
    ipcMainInstance.handle('paste-text', this.handlePasteText.bind(this));
    ipcMainInstance.handle('paste-image', this.handlePasteImage.bind(this));
    logger.info('Paste handlers set up successfully');
  }

  removeHandlers(ipcMainInstance: typeof ipcMain): void {
    ipcMainInstance.removeAllListeners('paste-text');
    ipcMainInstance.removeAllListeners('paste-image');
    logger.info('Paste handlers removed');
  }

  private async handlePasteText(_event: IpcMainInvokeEvent, text: string): Promise<PasteResult> {
    try {
      logger.info('Paste text requested', { length: text.length });

      // Validate input
      if (typeof text !== 'string') {
        logger.warn('Invalid input type for paste text', { type: typeof text });
        return { success: false, error: SecureErrors.INVALID_INPUT };
      }

      if (!text.trim()) {
        logger.debug('Empty text provided for paste');
        return { success: false, error: SecureErrors.INVALID_INPUT };
      }

      // Add reasonable length limit (1MB) to prevent DoS attacks
      // Use Buffer.byteLength for accurate byte-based limit instead of character count
      if (Buffer.byteLength(text, 'utf8') > MAX_PASTE_TEXT_LENGTH_BYTES) {
        logger.warn('Text size exceeds limit', { size: Buffer.byteLength(text, 'utf8'), limit: MAX_PASTE_TEXT_LENGTH_BYTES });
        return { success: false, error: SecureErrors.SIZE_LIMIT_EXCEEDED };
      }

      // Get previous app info before hiding window
      const previousApp = await this.getPreviousAppAsync();

      // Extract app name for history
      let appName: string | undefined;
      if (previousApp) {
        if (typeof previousApp === 'string') {
          appName = previousApp;
        } else if (previousApp.name) {
          appName = previousApp.name;
        }
      }

      // Get directory from directory manager
      const directory = this.directoryManager.getDirectory() || undefined;

      await Promise.all([
        this.historyManager.addToHistory(text, appName, directory),
        this.draftManager.clearDraft(),
        this.setClipboardAsync(text)
      ]);

      const hideWindowPromise = this.windowManager.hideInputWindow();
      await hideWindowPromise;

      await sleep(Math.max(config.timing.windowHideDelay, 5));

      try {
        if (previousApp && config.platform.isMac) {
          await activateAndPasteWithNativeTool(previousApp);
          logger.info('Activate and paste operation completed successfully');
          return { success: true };
        } else if (config.platform.isMac) {
          const focusSuccess = await this.windowManager.focusPreviousApp();

          if (focusSuccess) {
            await sleep(config.timing.appFocusDelay);
            await pasteWithNativeTool();
            logger.info('Paste operation completed successfully');
            return { success: true };
          } else {
            await pasteWithNativeTool();
            logger.warn('Paste attempted without focus confirmation');
            return { success: true, warning: 'Could not focus previous application' };
          }
        } else {
          logger.warn('Auto-paste not supported on this platform');
          return { success: true, warning: 'Auto-paste not supported on this platform' };
        }
      } catch (pasteError) {
        const err = pasteError as Error;
        logger.error('Paste operation failed:', { message: err.message, stack: err.stack });

        // Check accessibility permission after paste failure on macOS
        if (config.platform.isMac) {
          try {
            const { hasPermission, bundleId } = await checkAccessibilityPermission();

            if (!hasPermission) {
              logger.warn('Paste failed - accessibility permission not granted', { bundleId });
              this.showAccessibilityWarning(bundleId);
              return { success: false, error: SecureErrors.PERMISSION_DENIED };
            }
          } catch (accessibilityError) {
            const accErr = accessibilityError as Error;
            logger.error('Failed to check accessibility permission after paste failure:', { message: accErr.message });
          }
        }

        return { success: false, error: SecureErrors.OPERATION_FAILED };
      }
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to handle paste text:', { message: err.message, stack: err.stack });
      return { success: false, error: SecureErrors.OPERATION_FAILED };
    }
  }

  private async handlePasteImage(_event: IpcMainInvokeEvent): Promise<{ success: boolean; error?: string; path?: string }> {
    try {
      logger.info('Paste image requested');

      const image = clipboard.readImage();

      if (image.isEmpty()) {
        return { success: false, error: 'No image in clipboard' };
      }

      return { success: false, error: 'Image paste not implemented in PasteHandler yet' };
    } catch (error) {
      logger.error('Failed to handle paste image:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  private async setClipboardAsync(text: string): Promise<void> {
    return new Promise((resolve) => {
      try {
        clipboard.writeText(text);
        resolve();
      } catch (error) {
        logger.warn('Clipboard write failed:', error);
        resolve();
      }
    });
  }

  private async getPreviousAppAsync(): Promise<AppInfo | string | null> {
    try {
      return this.windowManager.getPreviousApp();
    } catch (error) {
      logger.warn('Failed to get previous app info:', error);
      return null;
    }
  }

  private showAccessibilityWarning(bundleId: string): void {
    dialog.showMessageBox({
      type: 'warning',
      title: 'Accessibility Permission Required',
      message: 'Prompt Line needs accessibility permission to function properly.',
      detail: `To enable paste functionality:\n\n1. Open System Preferences\n2. Go to Security & Privacy → Privacy\n3. Select "Accessibility"\n4. Add "Prompt Line" and enable it\n\nBundle ID: ${bundleId}`,
      buttons: ['Open System Preferences', 'Set Up Later'],
      defaultId: 0,
      cancelId: 1
    }).then((result: { response: number }) => {
      if (result.response === 0) {
        // Open System Preferences accessibility settings
        execFile('open', ['x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility']);
      }
    }).catch((error: Error) => {
      logger.error('Failed to show accessibility warning dialog:', error);
    });
  }
}

export default PasteHandler;
