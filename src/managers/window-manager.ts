import { BrowserWindow, screen } from 'electron';
import { exec } from 'child_process';
import config from '../config/app-config';
import { getCurrentApp, getActiveWindowBounds, logger, KEYBOARD_SIMULATOR_PATH, TEXT_FIELD_DETECTOR_PATH } from '../utils/utils';
import DesktopSpaceManager from './desktop-space-manager';
import type { AppInfo, WindowData, StartupPosition } from '../types';

// Native tools paths are imported from utils to ensure correct paths in packaged app

class WindowManager {
  private inputWindow: BrowserWindow | null = null;
  private previousApp: AppInfo | string | null = null;
  private customWindowSettings: { position?: StartupPosition; width?: number; height?: number } = {};
  private desktopSpaceManager: DesktopSpaceManager | null = null;
  private lastSpaceSignature: string | null = null;

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing WindowManager...');
      
      // Initialize desktop space manager
      this.desktopSpaceManager = new DesktopSpaceManager();
      await this.desktopSpaceManager.initialize();
      
      // Pre-create window for faster first-time startup
      this.createInputWindow();
      logger.debug('Pre-created input window for faster startup');
      
      logger.info('WindowManager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize WindowManager:', error);
      throw error;
    }
  }

  createInputWindow(): BrowserWindow {
    try {
      this.inputWindow = new BrowserWindow({
        ...config.window,
        width: this.customWindowSettings.width || config.window.width,
        height: this.customWindowSettings.height || config.window.height,
        show: false
      });

      // Note: Desktop space configuration moved to showInputWindow for better control

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
    const startTime = performance.now();
    logger.debug('🕐 Starting showInputWindow()');
    
    try {
      // Update window settings from data if provided
      const settingsStartTime = performance.now();
      if (data.settings?.window) {
        this.updateWindowSettings(data.settings.window);
      }
      logger.debug(`⏱️  Window settings update: ${(performance.now() - settingsStartTime).toFixed(2)}ms`);
      
      // Get current app and space information in parallel for better performance
      const appSpaceStartTime = performance.now();
      const [currentAppResult, currentSpaceResult] = await Promise.allSettled([
        getCurrentApp(),
        this.desktopSpaceManager && this.desktopSpaceManager.isReady() 
          ? this.desktopSpaceManager.getCurrentSpaceInfo(null) // We'll update with actual app later
          : Promise.resolve(null)
      ]);
      logger.debug(`⏱️  App + Space detection (parallel): ${(performance.now() - appSpaceStartTime).toFixed(2)}ms`);

      // Process current app result
      if (currentAppResult.status === 'fulfilled') {
        this.previousApp = currentAppResult.value;
      } else {
        logger.error('Failed to get current app:', currentAppResult.reason);
        this.previousApp = null;
      }

      // Process space information result
      const spaceProcessStartTime = performance.now();
      let currentSpaceInfo = null;
      let needsWindowRecreation = false;
      
      if (currentSpaceResult.status === 'fulfilled' && currentSpaceResult.value) {
        currentSpaceInfo = currentSpaceResult.value;
        
        // Update space info with actual app information
        if (this.previousApp && this.desktopSpaceManager) {
          try {
            const spaceUpdateStartTime = performance.now();
            currentSpaceInfo = await this.desktopSpaceManager.getCurrentSpaceInfo(this.previousApp);
            logger.debug(`⏱️  Space info update with app: ${(performance.now() - spaceUpdateStartTime).toFixed(2)}ms`);
          } catch (error) {
            logger.debug('Failed to update space info with app:', error);
          }
        }
        
        logger.debug('Current space info:', {
          signature: currentSpaceInfo.signature,
          appCount: currentSpaceInfo.appCount,
          method: currentSpaceInfo.method
        });
        
        // Check if desktop space has changed
        if (this.lastSpaceSignature !== currentSpaceInfo.signature) {
          needsWindowRecreation = true;
          logger.debug('Desktop space changed, window recreation needed', {
            lastSignature: this.lastSpaceSignature,
            currentSignature: currentSpaceInfo.signature
          });
        }
        
        this.lastSpaceSignature = currentSpaceInfo.signature;
      } else {
        // If space detection is not available, use simple logic
        needsWindowRecreation = !this.inputWindow || this.inputWindow.isDestroyed();
        if (currentSpaceResult.status === 'rejected') {
          logger.warn('Failed to get current space info:', currentSpaceResult.reason);
        }
      }
      logger.debug(`⏱️  Space processing: ${(performance.now() - spaceProcessStartTime).toFixed(2)}ms`);

      // Handle window creation/reuse based on space changes
      const windowMgmtStartTime = performance.now();
      
      if (needsWindowRecreation && this.inputWindow && !this.inputWindow.isDestroyed()) {
        const destroyStartTime = performance.now();
        this.inputWindow.destroy();
        this.inputWindow = null;
        logger.debug(`⏱️  Window destruction: ${(performance.now() - destroyStartTime).toFixed(2)}ms`);
        logger.debug('Destroyed existing window due to desktop space change');
      }
      
      if (!this.inputWindow || this.inputWindow.isDestroyed()) {
        const createStartTime = performance.now();
        this.createInputWindow();
        logger.debug(`⏱️  Window creation: ${(performance.now() - createStartTime).toFixed(2)}ms`);
        
        const positionStartTime = performance.now();
        await this.positionWindow();
        logger.debug(`⏱️  Window positioning: ${(performance.now() - positionStartTime).toFixed(2)}ms`);
        
        logger.debug('New window created on current desktop space');
      } else {
        // Reuse existing window but reposition if needed
        const currentPosition = this.customWindowSettings.position || 'active-window-center';
        if (currentPosition === 'active-window-center' || 
            currentPosition === 'active-text-field' ||
            currentPosition === 'cursor' ||
            (data.settings?.window?.position && data.settings.window.position !== currentPosition)) {
          logger.debug('Repositioning existing window for position:', currentPosition);
          const repositionStartTime = performance.now();
          await this.positionWindow();
          logger.debug(`⏱️  Window repositioning: ${(performance.now() - repositionStartTime).toFixed(2)}ms`);
        }
        logger.debug('Reusing existing window on same desktop space');
      }
      
      logger.debug(`⏱️  Window management total: ${(performance.now() - windowMgmtStartTime).toFixed(2)}ms`);
      
      const windowData: WindowData = {
        sourceApp: this.previousApp,
        currentSpaceInfo,
        ...data
      };
      
      // Note: Desktop space is handled by creating window at the right time

      // Handle window display efficiently
      const displayStartTime = performance.now();
      
      if (this.inputWindow!.isVisible()) {
        // Window is already visible, just update data and focus
        const updateStartTime = performance.now();
        this.inputWindow!.webContents.send('window-shown', windowData);
        this.inputWindow!.focus();
        logger.debug(`⏱️  Window data update + focus: ${(performance.now() - updateStartTime).toFixed(2)}ms`);
        logger.debug('Updated existing visible window');
      } else if (this.inputWindow!.webContents.isLoading()) {
        // Window is loading, wait for completion
        logger.debug('⏱️  Window waiting for load completion...');
        this.inputWindow!.webContents.once('did-finish-load', () => {
          const loadCompleteStartTime = performance.now();
          this.inputWindow!.webContents.send('window-shown', windowData);
          this.inputWindow!.show();
          this.inputWindow!.focus();
          logger.debug(`⏱️  Window load completion handling: ${(performance.now() - loadCompleteStartTime).toFixed(2)}ms`);
        });
      } else {
        // Window is ready, show it
        const showStartTime = performance.now();
        this.inputWindow!.webContents.send('window-shown', windowData);
        this.inputWindow!.show();
        this.inputWindow!.focus();
        logger.debug(`⏱️  Window show + focus: ${(performance.now() - showStartTime).toFixed(2)}ms`);
      }
      
      logger.debug(`⏱️  Display handling: ${(performance.now() - displayStartTime).toFixed(2)}ms`);
      logger.debug(`🏁 Total showInputWindow time: ${(performance.now() - startTime).toFixed(2)}ms`);
      logger.debug('Input window shown', { sourceApp: this.previousApp });
    } catch (error) {
      logger.error('Failed to show input window:', error);
      logger.error(`❌ Failed after ${(performance.now() - startTime).toFixed(2)}ms`);
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
    const positionStartTime = performance.now();
    logger.debug('🕐 Starting positionWindow()');
    
    try {
      if (!this.inputWindow) return;

      const configStartTime = performance.now();
      const windowWidth = this.customWindowSettings.width || config.window.width;
      const windowHeight = this.customWindowSettings.height || config.window.height;
      const position = this.customWindowSettings.position || 'active-window-center';
      logger.debug(`⏱️  Position config: ${(performance.now() - configStartTime).toFixed(2)}ms`);

      const calcStartTime = performance.now();
      const { x, y } = await this.calculateWindowPosition(position, windowWidth, windowHeight);
      logger.debug(`⏱️  Position calculation: ${(performance.now() - calcStartTime).toFixed(2)}ms`);
      
      const setStartTime = performance.now();
      this.inputWindow.setPosition(Math.round(x), Math.round(y));
      logger.debug(`⏱️  Position setting: ${(performance.now() - setStartTime).toFixed(2)}ms`);
      
      logger.debug(`🏁 Total positionWindow time: ${(performance.now() - positionStartTime).toFixed(2)}ms`);
      logger.debug('Window positioned', { x: Math.round(x), y: Math.round(y), position });
    } catch (error) {
      logger.error('Failed to position window:', error);
      logger.error(`❌ Position failed after ${(performance.now() - positionStartTime).toFixed(2)}ms`);
    }
  }

  private async calculateWindowPosition(
    position: string,
    windowWidth: number,
    windowHeight: number
  ): Promise<{ x: number; y: number }> {
    const methodStartTime = performance.now();
    logger.debug(`🕐 Calculating position for: ${position}`);
    
    let result: { x: number; y: number };
    
    switch (position) {
      case 'center': {
        const centerStartTime = performance.now();
        result = this.calculateCenterPosition(windowWidth, windowHeight);
        logger.debug(`⏱️  Center calculation: ${(performance.now() - centerStartTime).toFixed(2)}ms`);
        break;
      }
      
      case 'active-window-center': {
        const awcStartTime = performance.now();
        result = await this.calculateActiveWindowCenterPosition(windowWidth, windowHeight);
        logger.debug(`⏱️  Active window center calculation: ${(performance.now() - awcStartTime).toFixed(2)}ms`);
        break;
      }
      
      case 'active-text-field': {
        const atfStartTime = performance.now();
        result = await this.calculateActiveTextFieldPosition(windowWidth, windowHeight);
        logger.debug(`⏱️  Active text field calculation: ${(performance.now() - atfStartTime).toFixed(2)}ms`);
        break;
      }
      
      case 'cursor': {
        const cursorStartTime = performance.now();
        result = this.calculateCursorPosition(windowWidth, windowHeight);
        logger.debug(`⏱️  Cursor calculation: ${(performance.now() - cursorStartTime).toFixed(2)}ms`);
        break;
      }
      
      default: {
        logger.warn('Invalid position value, falling back to active-window-center', { position });
        const fallbackStartTime = performance.now();
        result = await this.calculateActiveWindowCenterPosition(windowWidth, windowHeight);
        logger.debug(`⏱️  Fallback calculation: ${(performance.now() - fallbackStartTime).toFixed(2)}ms`);
        break;
      }
    }
    
    logger.debug(`🏁 Total position calculation (${position}): ${(performance.now() - methodStartTime).toFixed(2)}ms`);
    return result;
  }

  private calculateCenterPosition(windowWidth: number, windowHeight: number): { x: number; y: number } {
    const display = screen.getPrimaryDisplay();
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
        logger.warn('Could not get active window bounds, falling back to center position');
        return this.calculateCenterPosition(windowWidth, windowHeight);
      }
    } catch (error) {
      logger.warn('Error getting active window bounds, falling back to center position:', error);
      return this.calculateCenterPosition(windowWidth, windowHeight);
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
        // If text field is narrower than window, align to left edge of text field
        // Otherwise, center the window horizontally within the text field
        let x: number;
        if (textFieldBounds.width < windowWidth) {
          x = textFieldBounds.x;
        } else {
          x = textFieldBounds.x + (textFieldBounds.width - windowWidth) / 2;
        }
        
        // Always center vertically
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
              logger.debug('Using parent container bounds for scrollable text field');
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

      if (this.desktopSpaceManager) {
        this.desktopSpaceManager.destroy();
        this.desktopSpaceManager = null;
        logger.debug('Desktop space manager destroyed');
      }
    } catch (error) {
      logger.error('Failed to destroy window manager:', error);
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