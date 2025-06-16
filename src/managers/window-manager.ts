import { BrowserWindow, screen } from 'electron';
import { exec } from 'child_process';
import path from 'path';
import config from '../config/app-config';
import { getCurrentApp, getActiveWindowBounds, logger } from '../utils/utils';
import type { AppInfo, WindowData, StartupPosition } from '../types';

// Native tools paths
const NATIVE_TOOLS_DIR = path.join(__dirname, '..', 'native-tools');
const KEYBOARD_SIMULATOR_PATH = path.join(NATIVE_TOOLS_DIR, 'keyboard-simulator');
const TEXT_FIELD_DETECTOR_PATH = path.join(NATIVE_TOOLS_DIR, 'text-field-detector');

class WindowManager {
  private inputWindow: BrowserWindow | null = null;
  private previousApp: AppInfo | string | null = null;
  private customWindowSettings: { position?: StartupPosition; width?: number; height?: number } = {};

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
        // Always reposition for dynamic positioning modes (active-window-center, cursor)
        // or when position setting has changed
        const currentPosition = this.customWindowSettings.position || 'active-window-center';
        logger.debug('Checking repositioning conditions', { 
          currentPosition, 
          windowSettingsPosition: data.settings?.window?.position 
        });
        if (currentPosition === 'active-window-center' || 
            currentPosition === 'active-text-field' ||
            currentPosition === 'cursor' ||
            (data.settings?.window?.position && data.settings.window.position !== currentPosition)) {
          logger.debug('Repositioning window for position:', currentPosition);
          await this.positionWindow();
        }
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
      const position = this.customWindowSettings.position || 'active-window-center';

      const { x, y } = await this.calculateWindowPosition(position, windowWidth, windowHeight);
      
      this.inputWindow.setPosition(Math.round(x), Math.round(y));
      
      logger.debug('Window positioned', { x: Math.round(x), y: Math.round(y), position });
    } catch (error) {
      logger.error('Failed to position window:', error);
    }
  }

  private async calculateWindowPosition(
    position: string,
    windowWidth: number,
    windowHeight: number
  ): Promise<{ x: number; y: number }> {
    switch (position) {
      case 'active-display-center':
        return this.calculateActiveDisplayCenterPosition(windowWidth, windowHeight);
      
      case 'active-window-center':
        return this.calculateActiveWindowCenterPosition(windowWidth, windowHeight);
      
      case 'active-text-field':
        return this.calculateActiveTextFieldPosition(windowWidth, windowHeight);
      
      case 'cursor':
        return this.calculateCursorPosition(windowWidth, windowHeight);
      
      default:
        logger.warn('Invalid position value, falling back to active-window-center', { position });
        return this.calculateActiveWindowCenterPosition(windowWidth, windowHeight);
    }
  }

  private calculateActiveDisplayCenterPosition(windowWidth: number, windowHeight: number): { x: number; y: number } {
    // Get the display where the mouse cursor is currently located (active display)
    const cursorPoint = screen.getCursorScreenPoint();
    const display = screen.getDisplayNearestPoint(cursorPoint);
    const bounds = display.bounds;
    return {
      x: bounds.x + (bounds.width - windowWidth) / 2,
      y: bounds.y + (bounds.height - windowHeight) / 2 - 100
    };
  }

  private async calculateActiveWindowCenterPosition(
    windowWidth: number,
    windowHeight: number
  ): Promise<{ x: number; y: number }> {
    try {
      const activeWindowBounds = await getActiveWindowBounds();
      if (activeWindowBounds) {
        const x = activeWindowBounds.x + (activeWindowBounds.width - windowWidth) / 2;
        const y = activeWindowBounds.y + (activeWindowBounds.height - windowHeight) / 2;
        
        const point = { 
          x: activeWindowBounds.x + activeWindowBounds.width / 2, 
          y: activeWindowBounds.y + activeWindowBounds.height / 2 
        };
        
        return this.constrainToScreenBounds({ x, y }, windowWidth, windowHeight, point);
      } else {
        logger.warn('Could not get active window bounds, falling back to active display center position');
        return this.calculateActiveDisplayCenterPosition(windowWidth, windowHeight);
      }
    } catch (error) {
      logger.warn('Error getting active window bounds, falling back to active display center position:', error);
      return this.calculateActiveDisplayCenterPosition(windowWidth, windowHeight);
    }
  }

  private calculateCursorPosition(windowWidth: number, windowHeight: number): { x: number; y: number } {
    const point = screen.getCursorScreenPoint();
    const x = point.x - (windowWidth / 2);
    const y = point.y - (windowHeight / 2);
    
    return this.constrainToScreenBounds({ x, y }, windowWidth, windowHeight, point);
  }

  private async calculateActiveTextFieldPosition(
    windowWidth: number,
    windowHeight: number
  ): Promise<{ x: number; y: number }> {
    try {
      const textFieldBounds = await this.getActiveTextFieldBounds();
      if (textFieldBounds) {
        // Position the window at the center of the text field (or its visible container)
        const x = textFieldBounds.x + (textFieldBounds.width - windowWidth) / 2;
        const y = textFieldBounds.y + (textFieldBounds.height - windowHeight) / 2;
        
        return this.constrainToScreenBounds({ x, y }, windowWidth, windowHeight, { 
          x: textFieldBounds.x + textFieldBounds.width / 2, 
          y: textFieldBounds.y + textFieldBounds.height / 2 
        });
      } else {
        logger.warn('Could not get active text field bounds, falling back to active-window-center');
        return this.calculateActiveWindowCenterPosition(windowWidth, windowHeight);
      }
    } catch (error) {
      logger.warn('Error getting active text field bounds, falling back to active-window-center:', error);
      return this.calculateActiveWindowCenterPosition(windowWidth, windowHeight);
    }
  }

  private async getActiveTextFieldBounds(): Promise<{ x: number; y: number; width: number; height: number } | null> {
    if (!config.platform.isMac) {
      logger.debug('Text field detection only supported on macOS');
      return null;
    }

    const options = {
      timeout: 3000,
      killSignal: 'SIGTERM' as const
    };

    return new Promise((resolve) => {
      exec(`"${TEXT_FIELD_DETECTOR_PATH}" text-field-bounds`, options, (error: Error | null, stdout?: string) => {
        if (error) {
          logger.debug('Error getting text field bounds via native tool:', error);
          resolve(null);
          return;
        }

        try {
          const result = JSON.parse(stdout?.trim() || '{}');
          logger.debug('Text field detector result:', result);
          
          if (result.error) {
            logger.debug('Text field detector error:', result.error);
            resolve(null);
            return;
          }

          if (result.success && typeof result.x === 'number' && typeof result.y === 'number' &&
              typeof result.width === 'number' && typeof result.height === 'number') {
            
            let bounds = {
              x: result.x,
              y: result.y,
              width: result.width,
              height: result.height
            };
            
            // Use parent container bounds if available for better positioning with scrollable content
            if (result.parent && result.parent.isVisibleContainer && 
                typeof result.parent.x === 'number' && typeof result.parent.y === 'number' &&
                typeof result.parent.width === 'number' && typeof result.parent.height === 'number') {
              logger.debug('Using parent container bounds for scrollable text field:', result.parent);
              bounds = {
                x: result.parent.x,
                y: result.parent.y,
                width: result.parent.width,
                height: result.parent.height
              };
            }
            
            logger.debug('Text field bounds found:', bounds);
            resolve(bounds);
            return;
          }

          logger.debug('Invalid text field bounds data received');
          resolve(null);
        } catch (parseError) {
          logger.debug('Error parsing text field detector output:', parseError);
          resolve(null);
        }
      });
    });
  }

  private constrainToScreenBounds(
    position: { x: number; y: number },
    windowWidth: number,
    windowHeight: number,
    referencePoint: { x: number; y: number }
  ): { x: number; y: number } {
    const display = screen.getDisplayNearestPoint(referencePoint);
    const bounds = display.bounds;
    
    return {
      x: Math.max(bounds.x, Math.min(position.x, bounds.x + bounds.width - windowWidth)),
      y: Math.max(bounds.y, Math.min(position.y, bounds.y + bounds.height - windowHeight))
    };
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

  updateWindowSettings(settings: { position?: StartupPosition; width?: number; height?: number }): void {
    this.customWindowSettings = { ...this.customWindowSettings, ...settings };
    logger.debug('Window settings updated', settings);
  }

  getWindowSettings(): { position?: StartupPosition; width?: number; height?: number } {
    return { ...this.customWindowSettings };
  }
}

export default WindowManager;