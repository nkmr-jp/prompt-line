import { BrowserWindow, screen } from 'electron';
import { exec } from 'child_process';
import path from 'path';
import config from '../config/app-config';
import { getCurrentApp, getActiveWindowBounds, logger } from '../utils/utils';
import type { AppInfo, WindowData } from '../types';

// Native tools paths
const NATIVE_TOOLS_DIR = path.join(__dirname, '..', 'native-tools');
const KEYBOARD_SIMULATOR_PATH = path.join(NATIVE_TOOLS_DIR, 'keyboard-simulator');

class WindowManager {
  private inputWindow: BrowserWindow | null = null;
  private previousApp: AppInfo | string | null = null;
  private customWindowSettings: { width?: number; height?: number } = {};

  createInputWindow(): BrowserWindow {
    try {
      this.inputWindow = new BrowserWindow({
        ...config.window,
        width: this.customWindowSettings.width || config.window.width,
        height: this.customWindowSettings.height || config.window.height,
        show: false
      });

      this.inputWindow.loadFile(config.getInputHtmlPath());
      
      this.inputWindow.webContents.on('context-menu', (e) => {
        e.preventDefault();
      });
      
      this.inputWindow.webContents.on('before-input-event', (event, input) => {
        if (input.key === 'Tab') {
          event.preventDefault();
        }
      });

      logger.debug('Input window created successfully');
      return this.inputWindow;
    } catch (error) {
      logger.error('Failed to create input window:', error);
      throw error;
    }
  }

  async showInputWindow(data: WindowData = {}): Promise<void> {
    try {
      // Update window settings from data if provided
      if (data.settings?.window) {
        this.updateWindowSettings(data.settings.window);
      }
      
      // If window already exists and is visible, just focus it
      if (this.inputWindow && !this.inputWindow.isDestroyed() && this.inputWindow.isVisible()) {
        this.inputWindow.focus();
        logger.debug('Window already visible, just focusing');
        return;
      }
      
      // Get current app before showing window
      try {
        this.previousApp = await getCurrentApp();
      } catch (error) {
        logger.error('Failed to get current app:', error);
        this.previousApp = null;
      }
      
      // If window exists but is hidden, reposition and show it
      if (this.inputWindow && !this.inputWindow.isDestroyed() && !this.inputWindow.isVisible()) {
        // Always reposition for active-window-center to get current active window
        await this.positionWindow();
        this.inputWindow.show();
        this.inputWindow.focus();
      } else if (!this.inputWindow || this.inputWindow.isDestroyed()) {
        // Create new window if needed
        this.createInputWindow();
        await this.positionWindow();
      }
      
      const windowData: WindowData = {
        sourceApp: this.previousApp,
        ...data
      };
      
      if (this.inputWindow!.webContents.isLoading()) {
        this.inputWindow!.webContents.once('did-finish-load', () => {
          this.inputWindow!.webContents.send('window-shown', windowData);
          this.inputWindow!.show();
          this.inputWindow!.focus();
        });
      } else {
        this.inputWindow!.webContents.send('window-shown', windowData);
        this.inputWindow!.show();
        this.inputWindow!.focus();
      }
      
      logger.debug('Input window shown', { sourceApp: this.previousApp });
    } catch (error) {
      logger.error('Failed to show input window:', error);
      throw error;
    }
  }

  async hideInputWindow(): Promise<void> {
    try {
      if (this.inputWindow && this.inputWindow.isVisible()) {
        this.inputWindow.hide();
        logger.debug('Input window hidden');
      }
    } catch (error) {
      logger.error('Failed to hide input window:', error);
      throw error;
    }
  }

  private async positionWindow(): Promise<void> {
    try {
      if (!this.inputWindow) return;

      const windowWidth = this.customWindowSettings.width || config.window.width;
      const windowHeight = this.customWindowSettings.height || config.window.height;

      let x: number, y: number;

      // Always use active-window-center positioning
      try {
        const activeWindowBounds = await getActiveWindowBounds();
        if (activeWindowBounds) {
          x = activeWindowBounds.x + (activeWindowBounds.width - windowWidth) / 2;
          y = activeWindowBounds.y + (activeWindowBounds.height - windowHeight) / 2;
          
          const point = { x: activeWindowBounds.x + activeWindowBounds.width / 2, y: activeWindowBounds.y + activeWindowBounds.height / 2 };
          const display = screen.getDisplayNearestPoint(point);
          const bounds = display.bounds;
          x = Math.max(bounds.x, Math.min(x, bounds.x + bounds.width - windowWidth));
          y = Math.max(bounds.y, Math.min(y, bounds.y + bounds.height - windowHeight));
        } else {
          logger.warn('Could not get active window bounds, falling back to center position');
          const display = screen.getPrimaryDisplay();
          const bounds = display.bounds;
          x = bounds.x + (bounds.width - windowWidth) / 2;
          y = bounds.y + (bounds.height - windowHeight) / 2 - 100;
        }
      } catch (error) {
        logger.warn('Error getting active window bounds, falling back to center position:', error);
        const display = screen.getPrimaryDisplay();
        const bounds = display.bounds;
        x = bounds.x + (bounds.width - windowWidth) / 2;
        y = bounds.y + (bounds.height - windowHeight) / 2 - 100;
      }
      
      this.inputWindow.setPosition(Math.round(x), Math.round(y));
      
      logger.debug('Window positioned', { x: Math.round(x), y: Math.round(y), position: 'active-window-center' });
    } catch (error) {
      logger.error('Failed to position window:', error);
    }
  }

  async focusPreviousApp(): Promise<boolean> {
    try {
      if (!this.previousApp || !config.platform.isMac) {
        logger.debug('No previous app to focus or not on macOS');
        return false;
      }

      let appName: string;
      let bundleId: string | null = null;
      
      if (typeof this.previousApp === 'string') {
        appName = this.previousApp;
      } else if (this.previousApp && typeof this.previousApp === 'object') {
        appName = this.previousApp.name;
        bundleId = this.previousApp.bundleId || null;
      } else {
        logger.error('Invalid previousApp format:', this.previousApp);
        return false;
      }

      const options = {
        timeout: 3000,
        killSignal: 'SIGTERM' as const
      };

      let command: string;
      if (bundleId) {
        command = `"${KEYBOARD_SIMULATOR_PATH}" activate-bundle "${bundleId}"`;
        logger.debug('Using bundle ID for app activation:', { appName, bundleId });
      } else {
        command = `"${KEYBOARD_SIMULATOR_PATH}" activate-name "${appName}"`;
        logger.debug('Using app name for activation:', { appName });
      }
      
      return new Promise((resolve) => {
        exec(command, options, (error: Error | null, stdout?: string) => {
          if (error) {
            logger.error('Error focusing previous app:', error);
            resolve(false);
          } else {
            try {
              const result = JSON.parse(stdout?.trim() || '{}');
              if (result.success) {
                logger.debug('Successfully focused previous app:', { appName, bundleId });
                resolve(true);
              } else {
                logger.warn('Native tool failed to focus app:', result);
                resolve(false);
              }
            } catch (parseError) {
              logger.warn('Error parsing focus app result:', parseError);
              resolve(false);
            }
          }
        });
      });
    } catch (error) {
      logger.error('Failed to focus previous app:', error);
      return false;
    }
  }

  getInputWindow(): BrowserWindow | null {
    return this.inputWindow;
  }

  getPreviousApp(): AppInfo | string | null {
    return this.previousApp;
  }

  destroy(): void {
    try {
      if (this.inputWindow) {
        this.inputWindow.destroy();
        this.inputWindow = null;
        logger.debug('Input window destroyed');
      }
    } catch (error) {
      logger.error('Failed to destroy input window:', error);
    }
  }

  isVisible(): boolean {
    return this.inputWindow ? this.inputWindow.isVisible() : false;
  }

  setupEventListeners(onBlur?: () => void, onClosed?: () => void): void {
    if (!this.inputWindow) {
      logger.warn('Cannot setup event listeners: no input window');
      return;
    }

    if (onBlur) {
      this.inputWindow.on('blur', onBlur);
    }

    if (onClosed) {
      this.inputWindow.on('closed', onClosed);
    }

    logger.debug('Window event listeners set up');
  }

  updateWindowSettings(settings: { width?: number; height?: number }): void {
    this.customWindowSettings = { ...this.customWindowSettings, ...settings };
    logger.debug('Window settings updated', settings);
  }

  getWindowSettings(): { width?: number; height?: number } {
    return { ...this.customWindowSettings };
  }
}

export default WindowManager;