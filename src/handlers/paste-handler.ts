import { ipcMain, clipboard, IpcMainInvokeEvent } from 'electron';
import path from 'path';
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
import {
  validatePasteInput,
  extractAppName,
  setClipboardAsync,
  getPreviousAppAsync,
  showAccessibilityWarning,
  ensureImageDirectory,
  generateImageFilename,
  validateImageFilename,
  buildAndValidateImagePath,
  saveImage
} from './paste-helpers';

interface PasteResult {
  success: boolean;
  error?: string;
  warning?: string;
}

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

      const validationResult = validatePasteInput(text);
      if ('error' in validationResult) {
        return { success: false, error: validationResult.error };
      }

      const previousApp = await getPreviousAppAsync(this.windowManager);
      const appName = extractAppName(previousApp);
      const directory = this.directoryManager.getDirectory() || undefined;

      await this.performDataOperations(text, appName, directory);
      await this.hideWindowAndWait();

      return await this.executePasteOperation(previousApp);
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to handle paste text:', { message: err.message, stack: err.stack });
      return { success: false, error: SecureErrors.OPERATION_FAILED };
    }
  }

  private async performDataOperations(
    text: string,
    appName: string | undefined,
    directory: string | undefined
  ): Promise<void> {
    await Promise.all([
      this.historyManager.addToHistory(text, appName, directory),
      this.draftManager.clearDraft(),
      setClipboardAsync(text)
    ]);
  }

  private async hideWindowAndWait(): Promise<void> {
    await this.windowManager.hideInputWindow();
    await sleep(Math.max(config.timing.windowHideDelay, 5));
  }

  private async executePasteOperation(previousApp: AppInfo | string | null): Promise<PasteResult> {
    try {
      if (previousApp && config.platform.isMac) {
        return await this.executeActivateAndPaste(previousApp);
      }

      if (config.platform.isMac) {
        return await this.executeFocusAndPaste();
      }

      logger.warn('Auto-paste not supported on this platform');
      return { success: true, warning: 'Auto-paste not supported on this platform' };
    } catch (pasteError) {
      return await this.handlePasteError(pasteError as Error);
    }
  }

  private async executeActivateAndPaste(previousApp: AppInfo | string): Promise<PasteResult> {
    await activateAndPasteWithNativeTool(previousApp);
    logger.info('Activate and paste operation completed successfully');
    return { success: true };
  }

  private async executeFocusAndPaste(): Promise<PasteResult> {
    const focusSuccess = await this.windowManager.focusPreviousApp();

    if (focusSuccess) {
      await sleep(config.timing.appFocusDelay);
      await pasteWithNativeTool();
      logger.info('Paste operation completed successfully');
      return { success: true };
    }

    await pasteWithNativeTool();
    logger.warn('Paste attempted without focus confirmation');
    return { success: true, warning: 'Could not focus previous application' };
  }

  private async handlePasteError(error: Error): Promise<PasteResult> {
    logger.error('Paste operation failed:', { message: error.message, stack: error.stack });

    if (config.platform.isMac) {
      const permissionResult = await this.checkAndHandleAccessibilityPermission();
      if (permissionResult) {
        return permissionResult;
      }
    }

    return { success: false, error: SecureErrors.OPERATION_FAILED };
  }

  private async checkAndHandleAccessibilityPermission(): Promise<PasteResult | null> {
    try {
      const { hasPermission, bundleId } = await checkAccessibilityPermission();

      if (!hasPermission) {
        logger.warn('Paste failed - accessibility permission not granted', { bundleId });
        showAccessibilityWarning(bundleId);
        return { success: false, error: SecureErrors.PERMISSION_DENIED };
      }
    } catch (accessibilityError) {
      const accErr = accessibilityError as Error;
      logger.error('Failed to check accessibility permission after paste failure:', {
        message: accErr.message
      });
    }

    return null;
  }

  private async handlePasteImage(_event: IpcMainInvokeEvent): Promise<{ success: boolean; error?: string; path?: string }> {
    try {
      logger.info('Paste image requested');

      const image = clipboard.readImage();
      if (image.isEmpty()) {
        return { success: false, error: 'No image in clipboard' };
      }

      const prepareResult = await this.prepareImageStorage();
      if (!prepareResult.success) {
        return { success: false, error: prepareResult.error || 'Failed to prepare image storage' };
      }

      await this.saveAndCleanup(image, prepareResult.normalizedPath!);

      const result: { success: boolean; error?: string; path?: string } = {
        success: true,
        path: prepareResult.publicPath!
      };
      return result;
    } catch (error) {
      logger.error('Failed to handle paste image:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  private async prepareImageStorage(): Promise<{ success: boolean; error?: string; normalizedPath?: string; publicPath?: string }> {
    await ensureImageDirectory();

    const filename = generateImageFilename();
    const filenameValidation = validateImageFilename(filename);
    if ('error' in filenameValidation) {
      return { success: false, error: filenameValidation.error };
    }

    const normalizedPath = await this.prepareImagePath(filename);
    if (!normalizedPath) {
      return { success: false, error: 'Invalid file path' };
    }

    const imagesDir = config.paths.imagesDir;
    return {
      success: true,
      normalizedPath,
      publicPath: path.join(imagesDir, filename)
    };
  }

  private async prepareImagePath(filename: string): Promise<string | null> {
    const imagesDir = config.paths.imagesDir;
    return buildAndValidateImagePath(imagesDir, filename);
  }

  private async saveAndCleanup(image: any, filepath: string): Promise<void> {
    await saveImage(image, filepath);
    clipboard.writeText('');
    logger.info('Image saved successfully', { filepath });
  }
}

export default PasteHandler;
