import { BrowserWindow, screen } from 'electron';
import { execFile } from 'child_process';
import config from '../config/app-config';
import { getCurrentApp, getActiveWindowBounds, logger, KEYBOARD_SIMULATOR_PATH, TEXT_FIELD_DETECTOR_PATH, DIRECTORY_DETECTOR_PATH } from '../utils/utils';
import DesktopSpaceManager from './desktop-space-manager';
import FileCacheManager from './file-cache-manager';
import type DirectoryManager from './directory-manager';
import type { AppInfo, WindowData, StartupPosition, DirectoryInfo, FileSearchSettings, FileInfo } from '../types';

// Native tools paths are imported from utils to ensure correct paths in packaged app

class WindowManager {
  private inputWindow: BrowserWindow | null = null;
  private previousApp: AppInfo | string | null = null;
  private customWindowSettings: { position?: StartupPosition; width?: number; height?: number } = {};
  private desktopSpaceManager: DesktopSpaceManager | null = null;
  private lastSpaceSignature: string | null = null;
  private fileSearchSettings: FileSearchSettings | null = null;
  private directoryManager: DirectoryManager | null = null;
  private savedDirectory: string | null = null; // Directory from DirectoryManager for fallback
  private fileCacheManager: FileCacheManager | null = null;
  private fdCommandAvailable: boolean = true; // fd command availability
  private fdCommandChecked: boolean = false; // Whether fd check has been performed

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing WindowManager...');

      // Initialize desktop space manager
      this.desktopSpaceManager = new DesktopSpaceManager();
      await this.desktopSpaceManager.initialize();

      // Initialize file cache manager
      this.fileCacheManager = new FileCacheManager();
      await this.fileCacheManager.initialize();

      // Note: fd command availability check is deferred to showInputWindow
      // when fileSearch settings are available and enabled

      // Pre-create window for faster first-time startup
      this.createInputWindow();
      logger.debug('Pre-created input window for faster startup');

      logger.info('WindowManager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize WindowManager:', error);
      throw error;
    }
  }

  /**
   * Check if fd command is available on the system (only once)
   */
  private async checkFdCommandAvailability(): Promise<void> {
    // Only check once
    if (this.fdCommandChecked) {
      return;
    }
    this.fdCommandChecked = true;

    const fs = require('fs');

    // Check custom fdPath from settings first
    const customFdPath = this.fileSearchSettings?.fdPath;
    if (customFdPath) {
      if (fs.existsSync(customFdPath)) {
        this.fdCommandAvailable = true;
        logger.debug(`fd command found at custom path: ${customFdPath}`);
        return;
      } else {
        logger.warn(`Custom fdPath "${customFdPath}" does not exist, falling back to auto-detect`);
      }
    }

    // Check common fd installation paths directly
    // This avoids PATH issues when Electron is launched outside of shell
    const fdPaths = [
      '/opt/homebrew/bin/fd',  // Apple Silicon Homebrew
      '/usr/local/bin/fd',     // Intel Homebrew
      '/usr/bin/fd'            // System
    ];

    for (const fdPath of fdPaths) {
      if (fs.existsSync(fdPath)) {
        this.fdCommandAvailable = true;
        logger.debug(`fd command found at: ${fdPath}`);
        return;
      }
    }

    this.fdCommandAvailable = false;
    logger.warn('fd command is not available. File search will not work. Install with: brew install fd');
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

      // Note: Tab key handling is done in renderer process to support IME state detection
      // Previously, Tab key was blocked here with event.preventDefault(), which prevented
      // renderer from receiving Tab key events. Now renderer handles Tab key properly.

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
      // Update file search settings if provided
      logger.debug('File search settings from data:', {
        hasSettings: !!data.settings,
        hasFileSearch: !!data.settings?.fileSearch,
        fileSearch: data.settings?.fileSearch
      });
      if (data.settings?.fileSearch) {
        this.updateFileSearchSettings(data.settings.fileSearch as FileSearchSettings);
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

      // Get saved directory from DirectoryManager for fallback feature
      // This directory will be used as initial value and as fallback if detection fails
      this.savedDirectory = this.directoryManager?.getDirectory() || null;
      logger.debug('Saved directory for fallback:', { savedDirectory: this.savedDirectory });

      // Prepare window data with draft directory as initial directoryData (if available)
      // This enables @path highlighting immediately on window show
      const windowData: WindowData = {
        sourceApp: this.previousApp,
        currentSpaceInfo,
        fileSearchEnabled: this.isFileSearchEnabled(),
        ...data
      };

      // Only load directory data and check fd when fileSearch is enabled
      if (this.isFileSearchEnabled()) {
        // Check fd command availability (only when fileSearch is enabled)
        // This is deferred from initialize() since settings aren't available there
        await this.checkFdCommandAvailability();

        // Load cached file data for immediate file search availability
        const cachedData = await this.loadCachedFilesForWindow();
        if (cachedData) {
          windowData.directoryData = cachedData;
          logger.debug('Loaded cached directory data', {
            directory: cachedData.directory,
            fileCount: cachedData.fileCount,
            fromCache: cachedData.fromCache
          });
        } else if (this.savedDirectory) {
          // Fallback to draft directory with empty files if no cache
          windowData.directoryData = {
            success: true,
            directory: this.savedDirectory,
            files: [],
            fileCount: 0,
            partial: false,  // Always false (single stage with fd)
            searchMode: 'recursive',  // Always recursive (fd is required)
            fromDraft: true
          };
        }

        // Add hint message if fd command is not available
        if (!this.fdCommandAvailable) {
          if (!windowData.directoryData) {
            windowData.directoryData = { success: false };
          }
          windowData.directoryData.hint = 'Install fd for file search: brew install fd';
          logger.debug('Added fd not available hint to directoryData');
        }
      }

      // Handle window display efficiently - show window FIRST before directory detection
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

      // Background directory detection (non-blocking) - runs AFTER window is shown
      // Only execute when fileSearch is enabled
      if (this.isFileSearchEnabled()) {
        // Use setImmediate to ensure this doesn't block the main thread
        setImmediate(() => {
          this.executeBackgroundDirectoryDetection().catch(error => {
            logger.warn('Background directory detection error:', error);
          });
        });
      }
    } catch (error) {
      logger.error('Failed to show input window:', error);
      logger.error(`❌ Failed after ${(performance.now() - startTime).toFixed(2)}ms`);
      throw error;
    }
  }

  /**
   * Load cached files for window show - provides instant file search availability
   * Priority: savedDirectory cache > lastUsedDirectory cache
   */
  private async loadCachedFilesForWindow(): Promise<DirectoryInfo | null> {
    if (!this.fileCacheManager) return null;

    try {
      // Priority 1: Try to load cache for savedDirectory (from DirectoryManager)
      if (this.savedDirectory) {
        const cached = await this.fileCacheManager.loadCache(this.savedDirectory);
        if (cached && this.fileCacheManager.isCacheValid(cached.metadata)) {
          const result: DirectoryInfo = {
            success: true,
            directory: cached.directory,
            files: cached.files,
            fileCount: cached.files.length,
            partial: false,
            fromCache: true,
            cacheAge: Date.now() - new Date(cached.metadata.updatedAt).getTime(),
            searchMode: 'recursive'
          };
          return result;
        }
      }

      // Priority 2: Try to load cache for lastUsedDirectory
      const lastUsedDir = await this.fileCacheManager.getLastUsedDirectory();
      if (lastUsedDir && lastUsedDir !== this.savedDirectory) {
        const cached = await this.fileCacheManager.loadCache(lastUsedDir);
        if (cached && this.fileCacheManager.isCacheValid(cached.metadata)) {
          const result: DirectoryInfo = {
            success: true,
            directory: cached.directory,
            files: cached.files,
            fileCount: cached.files.length,
            partial: false,
            fromCache: true,
            cacheAge: Date.now() - new Date(cached.metadata.updatedAt).getTime(),
            searchMode: 'recursive'
          };
          return result;
        }
      }

      return null;
    } catch (error) {
      logger.error('Failed to load cached files:', error);
      return null;
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

  focusWindow(): void {
    try {
      if (this.inputWindow) {
        this.inputWindow.focus();
        logger.debug('Input window focused');
      }
    } catch (error) {
      logger.error('Failed to focus input window:', error);
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
      execFile(TEXT_FIELD_DETECTOR_PATH, ['text-field-bounds'], options, (error: Error | null, stdout?: string) => {
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

      let args: string[];
      if (bundleId) {
        args = ['activate-bundle', bundleId];
        logger.debug('Using bundle ID for app activation:', { appName, bundleId });
      } else {
        args = ['activate-name', appName];
        logger.debug('Using app name for activation:', { appName });
      }

      return new Promise((resolve) => {
        execFile(KEYBOARD_SIMULATOR_PATH, args, options, (error: Error | null, stdout?: string) => {
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

  updateFileSearchSettings(settings: FileSearchSettings | null | undefined): void {
    this.fileSearchSettings = settings ?? null;
    logger.debug('File search settings updated', { enabled: settings !== null && settings !== undefined, settings });
  }

  isFileSearchEnabled(): boolean {
    return this.fileSearchSettings !== null;
  }

  /**
   * Set DirectoryManager reference for directory fallback feature
   */
  setDirectoryManager(directoryManager: DirectoryManager): void {
    this.directoryManager = directoryManager;
    logger.debug('DirectoryManager reference set in WindowManager');
  }

  /**
   * Execute directory-detector native tool with fd (single stage)
   * fd is required - always uses recursive search mode
   * @param timeout Timeout in milliseconds
   * @returns DirectoryInfo or null on error
   */
  private async executeDirectoryDetector(
    timeout: number
  ): Promise<DirectoryInfo | null> {
    if (!config.platform.isMac) {
      logger.debug('Directory detection only supported on macOS');
      return null;
    }

    const startTime = performance.now();

    // Build args array with settings (fd is always used, single stage)
    const args: string[] = ['detect-with-files'];

    // Apply file search settings if available
    if (this.fileSearchSettings) {
      if (!this.fileSearchSettings.respectGitignore) {
        args.push('--no-gitignore');
      }
      if (this.fileSearchSettings.excludePatterns && this.fileSearchSettings.excludePatterns.length > 0) {
        for (const pattern of this.fileSearchSettings.excludePatterns) {
          args.push('--exclude', pattern);
        }
      }
      if (this.fileSearchSettings.includePatterns && this.fileSearchSettings.includePatterns.length > 0) {
        for (const pattern of this.fileSearchSettings.includePatterns) {
          args.push('--include', pattern);
        }
      }
      if (this.fileSearchSettings.maxFiles) {
        args.push('--max-files', String(this.fileSearchSettings.maxFiles));
      }
      if (this.fileSearchSettings.includeHidden) {
        args.push('--include-hidden');
      }
      if (this.fileSearchSettings.maxDepth !== null && this.fileSearchSettings.maxDepth !== undefined) {
        args.push('--max-depth', String(this.fileSearchSettings.maxDepth));
      }
      if (this.fileSearchSettings.followSymlinks) {
        args.push('--follow-symlinks');
      }
    }

    // Add bundleId if available for accurate directory detection
    if (this.previousApp && typeof this.previousApp === 'object' && this.previousApp.bundleId) {
      args.push('--bundleId', this.previousApp.bundleId);
    }

    logger.debug('Directory detector command:', { executable: DIRECTORY_DETECTOR_PATH, args, fileSearchSettings: this.fileSearchSettings });

    const options = {
      timeout,
      killSignal: 'SIGTERM' as const,
      // Increase maxBuffer for large file lists (default is 1MB)
      // 50,000 files × ~200 bytes/file = ~10MB, so use 50MB for safety
      maxBuffer: 50 * 1024 * 1024
    };

    return new Promise((resolve) => {
      execFile(DIRECTORY_DETECTOR_PATH, args, options, (error: Error | null, stdout?: string) => {
        const elapsed = performance.now() - startTime;

        if (error) {
          logger.warn(`Directory detection failed after ${elapsed.toFixed(2)}ms:`, error);
          resolve(null);
          return;
        }

        try {
          const result = JSON.parse(stdout?.trim() || '{}') as DirectoryInfo;

          if (result.error) {
            logger.debug('Directory detection returned error:', result.error);
            resolve(null);
            return;
          }

          // Add hint message if fd command is not available
          if (result.filesError && result.filesError.includes('fd required')) {
            result.hint = 'Install fd for file search: brew install fd';
            logger.warn('fd command not found. File search will not work. Install with: brew install fd');
          }

          logger.debug(`⏱️  Directory detection completed in ${elapsed.toFixed(2)}ms`, {
            directory: result.directory,
            fileCount: result.fileCount,
            searchMode: result.searchMode
          });

          resolve(result);
        } catch (parseError) {
          logger.warn('Error parsing directory detection result:', parseError);
          resolve(null);
        }
      });
    });
  }

  /**
   * Execute directory detection in background (single stage with fd)
   * This ensures window shows immediately without waiting for directory detection
   *
   * Draft Directory Fallback Logic:
   * - If detection succeeds: update draft directory and send result with directoryChanged flag
   * - If detection fails: keep using draft directory (do nothing)
   * - directoryChanged flag is true when detected directory differs from saved draft directory
   *
   * Cache Integration:
   * - Background detection always runs to catch file changes
   * - If files changed, update cache and notify renderer
   * - If no changes, just update cache timestamp (no renderer notification)
   */
  private async executeBackgroundDirectoryDetection(): Promise<void> {
    try {
      const startTime = performance.now();
      logger.debug('🔄 Starting background directory detection...', {
        savedDirectory: this.savedDirectory
      });

      // Single stage directory detection with fd (5 second timeout)
      const result = await this.executeDirectoryDetector(5000);

      if (result && result.directory && this.inputWindow && !this.inputWindow.isDestroyed()) {
        // Detection succeeded - check if directory changed from draft
        const detectedDirectory = result.directory;
        const directoryChanged = this.savedDirectory !== null && detectedDirectory !== this.savedDirectory;

        // Check if file list has changed compared to cache
        let hasChanges = true;

        if (this.fileCacheManager && result.files) {
          const existingCache = await this.fileCacheManager.loadCache(detectedDirectory);
          if (existingCache) {
            hasChanges = this.hasFileListChanges(existingCache.files, result.files);
          }

          // Update lastUsedDirectory
          await this.fileCacheManager.setLastUsedDirectory(detectedDirectory);

          if (hasChanges) {
            // Save updated cache
            await this.fileCacheManager.saveCache(
              detectedDirectory,
              result.files,
              { searchMode: 'recursive' }
            );
            logger.debug(`Cache updated for ${detectedDirectory}, ${result.files.length} files`);
          } else {
            // Just update timestamp
            await this.fileCacheManager.updateCacheTimestamp(detectedDirectory);
            logger.debug(`Cache timestamp updated for ${detectedDirectory}, no file changes`);
          }
        }

        // Update directory manager with detected directory (detection succeeded)
        if (this.directoryManager) {
          this.directoryManager.setDirectory(detectedDirectory);
          this.savedDirectory = detectedDirectory; // Update local reference
        }

        // Notify renderer if there are changes, directory changed, or hint exists
        // hint needs to be sent even without file changes (e.g., fd not installed)
        if (hasChanges || directoryChanged || result.hint) {
          // Add directoryChanged flag to result
          const resultWithFlags: DirectoryInfo = {
            ...result,
            directoryChanged
          };
          // Only add previousDirectory if directory actually changed
          if (directoryChanged && this.savedDirectory !== null && this.savedDirectory !== detectedDirectory) {
            resultWithFlags.previousDirectory = this.savedDirectory;
          }

          this.inputWindow.webContents.send('directory-data-updated', resultWithFlags);
          logger.debug(`✅ Directory detection completed in ${(performance.now() - startTime).toFixed(2)}ms`, {
            directory: detectedDirectory,
            fileCount: result.fileCount,
            directoryChanged,
            hasChanges,
            hint: result.hint
          });
        } else {
          logger.debug(`✅ Directory detection completed, no changes detected, skipping renderer notification`, {
            directory: detectedDirectory,
            fileCount: result.fileCount
          });
        }
      } else {
        // Detection failed (likely timeout) - keep using draft directory (fallback)
        // Notify renderer about timeout so it can show hint
        logger.debug('Background directory detection: no result or window not available, keeping draft directory', {
          savedDirectory: this.savedDirectory
        });

        // Send timeout notification to renderer if window is available
        if (this.inputWindow && !this.inputWindow.isDestroyed()) {
          const timeoutInfo: DirectoryInfo = {
            success: false,
            detectionTimedOut: true
          };
          if (this.savedDirectory) {
            timeoutInfo.directory = this.savedDirectory;
          }
          this.inputWindow.webContents.send('directory-data-updated', timeoutInfo);
        }
      }

      logger.debug(`🏁 Total background directory detection time: ${(performance.now() - startTime).toFixed(2)}ms`);
    } catch (error) {
      logger.warn('Background directory detection failed:', error);
      // Detection failed - keep using draft directory (fallback)
      // Notify renderer about failure
      if (this.inputWindow && !this.inputWindow.isDestroyed()) {
        const errorInfo: DirectoryInfo = {
          success: false,
          detectionTimedOut: true
        };
        if (this.savedDirectory) {
          errorInfo.directory = this.savedDirectory;
        }
        this.inputWindow.webContents.send('directory-data-updated', errorInfo);
      }
    }
  }

  /**
   * Check if file list has changed (for cache update decision)
   */
  private hasFileListChanges(
    oldFiles: FileInfo[] | undefined,
    newFiles: FileInfo[]
  ): boolean {
    if (!oldFiles) return true;
    if (oldFiles.length !== newFiles.length) return true;

    // Create path sets for comparison (order-independent)
    const oldPaths = new Set(oldFiles.map(f => f.path));
    const newPaths = new Set(newFiles.map(f => f.path));

    if (oldPaths.size !== newPaths.size) return true;

    for (const path of newPaths) {
      if (!oldPaths.has(path)) return true;
    }

    return false;
  }
}

export default WindowManager;