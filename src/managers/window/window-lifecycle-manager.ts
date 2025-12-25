import type { BrowserWindow } from 'electron';
import { logger } from '../../utils/utils';
import config from '../../config/app-config';
import type { WindowData, StartupPosition } from '../../types';
import WindowPositionCalculator from './position-calculator';

/**
 * WindowLifecycleManager handles window creation, destruction, and positioning
 * Extracted from WindowManager to reduce file complexity
 */
export class WindowLifecycleManager {
  private positionCalculator: WindowPositionCalculator;
  private customWindowSettings: { position?: StartupPosition; width?: number; height?: number } = {};

  constructor(positionCalculator: WindowPositionCalculator) {
    this.positionCalculator = positionCalculator;
  }

  /**
   * Update window settings
   */
  updateWindowSettings(settings: { position?: StartupPosition; width?: number; height?: number }): void {
    this.customWindowSettings = { ...this.customWindowSettings, ...settings };
    logger.debug('Window settings updated', settings);
  }

  /**
   * Get current window settings
   */
  getWindowSettings(): { position?: StartupPosition; width?: number; height?: number } {
    return { ...this.customWindowSettings };
  }

  /**
   * Create a new input window
   */
  createInputWindow(): BrowserWindow {
    try {
      const BrowserWindow = require('electron').BrowserWindow;
      const window = new BrowserWindow({
        ...config.window,
        width: this.customWindowSettings.width || config.window.width,
        height: this.customWindowSettings.height || config.window.height,
        show: false
      });

      window.loadFile(config.getInputHtmlPath());

      window.webContents.on('context-menu', (e: any) => {
        e.preventDefault();
      });

      logger.debug('Input window created successfully');
      return window;
    } catch (error) {
      logger.error('Failed to create input window:', error);
      throw error;
    }
  }

  /**
   * Position window using the position calculator
   */
  async positionWindow(inputWindow: BrowserWindow): Promise<void> {
    const positionStartTime = performance.now();
    logger.debug('🕐 Starting positionWindow()');

    try {
      const config = this.getPositionConfig();
      const { x, y } = await this.calculatePosition(config);
      this.setWindowPosition(inputWindow, x, y);

      logger.debug(`🏁 Total positionWindow time: ${(performance.now() - positionStartTime).toFixed(2)}ms`);
      logger.debug('Window positioned', { x: Math.round(x), y: Math.round(y), position: config.position });
    } catch (error) {
      logger.error('Failed to position window:', error);
      logger.error(`❌ Position failed after ${(performance.now() - positionStartTime).toFixed(2)}ms`);
    }
  }

  /**
   * Get position configuration
   * @private
   */
  private getPositionConfig(): {
    windowWidth: number;
    windowHeight: number;
    position: StartupPosition;
  } {
    const configStartTime = performance.now();
    const config = {
      windowWidth: this.customWindowSettings.width || require('../../config/app-config').default.window.width,
      windowHeight: this.customWindowSettings.height || require('../../config/app-config').default.window.height,
      position: (this.customWindowSettings.position || 'active-window-center') as StartupPosition
    };
    logger.debug(`⏱️  Position config: ${(performance.now() - configStartTime).toFixed(2)}ms`);
    return config;
  }

  /**
   * Calculate window position
   * @private
   */
  private async calculatePosition(config: {
    windowWidth: number;
    windowHeight: number;
    position: StartupPosition;
  }): Promise<{ x: number; y: number }> {
    const calcStartTime = performance.now();
    const position = await this.positionCalculator.calculateWindowPosition(
      config.position,
      config.windowWidth,
      config.windowHeight
    );
    logger.debug(`⏱️  Position calculation: ${(performance.now() - calcStartTime).toFixed(2)}ms`);
    return position;
  }

  /**
   * Set window position
   * @private
   */
  private setWindowPosition(inputWindow: BrowserWindow, x: number, y: number): void {
    const setStartTime = performance.now();
    inputWindow.setPosition(Math.round(x), Math.round(y));
    logger.debug(`⏱️  Position setting: ${(performance.now() - setStartTime).toFixed(2)}ms`);
  }

  /**
   * Destroy current window
   */
  destroyWindow(inputWindow: BrowserWindow): void {
    const destroyStartTime = performance.now();
    inputWindow.destroy();
    logger.debug(`⏱️  Window destruction: ${(performance.now() - destroyStartTime).toFixed(2)}ms`);
    logger.debug('Destroyed existing window due to desktop space change');
  }

  /**
   * Create and position new window
   */
  async createAndPositionWindow(): Promise<BrowserWindow> {
    const createStartTime = performance.now();
    const window = this.createInputWindow();
    logger.debug(`⏱️  Window creation: ${(performance.now() - createStartTime).toFixed(2)}ms`);

    const positionStartTime = performance.now();
    await this.positionWindow(window);
    logger.debug(`⏱️  Window positioning: ${(performance.now() - positionStartTime).toFixed(2)}ms`);

    logger.debug('New window created on current desktop space');
    return window;
  }

  /**
   * Check if window should be repositioned
   */
  shouldRepositionWindow(currentPosition: StartupPosition, data: WindowData): boolean {
    const hasPositionChange = data.settings?.window?.position !== undefined &&
                              data.settings.window.position !== currentPosition;
    const needsDynamicPosition = currentPosition === 'active-window-center' ||
                                 currentPosition === 'active-text-field' ||
                                 currentPosition === 'cursor';

    return needsDynamicPosition || hasPositionChange;
  }
}

export default WindowLifecycleManager;
