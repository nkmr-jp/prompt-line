import type { BrowserWindow } from 'electron';
import { logger } from '../../utils/utils';
import type { WindowData } from '../../types';

/**
 * WindowDisplayManager handles window display operations
 * Extracted from WindowManager to reduce file complexity
 */
export class WindowDisplayManager {
  /**
   * Display window with data
   */
  async displayWindow(inputWindow: BrowserWindow, windowData: WindowData): Promise<void> {
    const displayStartTime = performance.now();

    if (inputWindow.isVisible()) {
      this.updateVisibleWindow(inputWindow, windowData);
    } else if (inputWindow.webContents.isLoading()) {
      this.waitForWindowLoad(inputWindow, windowData);
    } else {
      this.showReadyWindow(inputWindow, windowData);
    }

    logger.debug(`⏱️  Display handling: ${(performance.now() - displayStartTime).toFixed(2)}ms`);
  }

  /**
   * Update already visible window
   * @private
   */
  private updateVisibleWindow(inputWindow: BrowserWindow, windowData: WindowData): void {
    const updateStartTime = performance.now();
    inputWindow.webContents.send('window-shown', windowData);
    inputWindow.focus();
    logger.debug(`⏱️  Window data update + focus: ${(performance.now() - updateStartTime).toFixed(2)}ms`);
    logger.debug('Updated existing visible window');
  }

  /**
   * Wait for window to finish loading
   * @private
   */
  private waitForWindowLoad(inputWindow: BrowserWindow, windowData: WindowData): void {
    logger.debug('⏱️  Window waiting for load completion...');
    inputWindow.webContents.once('did-finish-load', () => {
      const loadCompleteStartTime = performance.now();
      inputWindow.webContents.send('window-shown', windowData);
      inputWindow.show();
      inputWindow.focus();
      logger.debug(`⏱️  Window load completion handling: ${(performance.now() - loadCompleteStartTime).toFixed(2)}ms`);
    });
  }

  /**
   * Show ready window
   * @private
   */
  private showReadyWindow(inputWindow: BrowserWindow, windowData: WindowData): void {
    const showStartTime = performance.now();
    inputWindow.webContents.send('window-shown', windowData);
    inputWindow.show();
    inputWindow.focus();
    logger.debug(`⏱️  Window show + focus: ${(performance.now() - showStartTime).toFixed(2)}ms`);
  }
}

export default WindowDisplayManager;
