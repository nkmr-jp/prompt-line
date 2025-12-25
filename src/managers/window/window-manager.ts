import { BrowserWindow } from 'electron';
import config from '../../config/app-config';
import { getCurrentApp, logger } from '../../utils/utils';
import DesktopSpaceManager from '../desktop-space-manager';
import FileCacheManager from '../file-cache-manager';
import type DirectoryManager from '../directory-manager';
import type {
  AppInfo,
  WindowData,
  StartupPosition,
  FileSearchSettings
} from '../../types';

// Import extracted modules
import WindowPositionCalculator from './position-calculator';
import NativeToolExecutor from './native-tool-executor';
import DirectoryDetector from './directory-detector';

/**
 * WindowManager coordinates window lifecycle and positioning
 *
 * This is the main coordinator that composes:
 * - WindowPositionCalculator: Calculates window positions for different modes
 * - NativeToolExecutor: Executes native macOS tools for app/text field detection
 * - DirectoryDetector: Handles directory detection and file search
 *
 * Responsibilities:
 * - Window lifecycle management (create, show, hide, destroy)
 * - Window positioning with multiple modes (active-text-field, active-window-center, cursor, center)
 * - Desktop space change detection and window recreation
 * - Settings and configuration management
 * - Event listener setup
 */
class WindowManager {
  private inputWindow: BrowserWindow | null = null;
  private customWindowSettings: { position?: StartupPosition; width?: number; height?: number } = {};
  private desktopSpaceManager: DesktopSpaceManager | null = null;
  private lastSpaceSignature: string | null = null;

  // Composed sub-managers
  private positionCalculator: WindowPositionCalculator;
  private nativeToolExecutor: NativeToolExecutor;
  private directoryDetector: DirectoryDetector;

  constructor() {
    // Initialize sub-managers
    this.positionCalculator = new WindowPositionCalculator();
    this.nativeToolExecutor = new NativeToolExecutor();
    this.directoryDetector = new DirectoryDetector(null); // FileCacheManager will be set in initialize
  }

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing WindowManager...');

      // Initialize desktop space manager
      this.desktopSpaceManager = new DesktopSpaceManager();
      await this.desktopSpaceManager.initialize();

      // Initialize file cache manager
      const fileCacheManager = new FileCacheManager();
      await fileCacheManager.initialize();

      // Pass FileCacheManager to DirectoryDetector
      this.directoryDetector = new DirectoryDetector(fileCacheManager);

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
   * Create a new input window with configuration
   * @returns Created BrowserWindow instance
   */
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

      logger.debug('Input window created successfully');
      return this.inputWindow;
    } catch (error) {
      logger.error('Failed to create input window:', error);
      throw error;
    }
  }

  /**
   * Show input window with positioning and directory detection
   * Coordinates all sub-managers for window display
   */
  async showInputWindow(data: WindowData = {}): Promise<void> {
    const startTime = performance.now();
    logger.debug('🕐 Starting showInputWindow()');

    try {
      // Update settings from data
      const settingsStartTime = performance.now();
      if (data.settings?.window) {
        this.updateWindowSettings(data.settings.window);
      }
      if (data.settings?.fileSearch) {
        this.directoryDetector.updateFileSearchSettings(data.settings.fileSearch as FileSearchSettings);
      }
      logger.debug(`⏱️  Window settings update: ${(performance.now() - settingsStartTime).toFixed(2)}ms`);

      // Get current app and space information in parallel
      const appSpaceStartTime = performance.now();
      const [currentAppResult, currentSpaceResult] = await Promise.allSettled([
        getCurrentApp(),
        this.desktopSpaceManager && this.desktopSpaceManager.isReady()
          ? this.desktopSpaceManager.getCurrentSpaceInfo(null)
          : Promise.resolve(null)
      ]);
      logger.debug(`⏱️  App + Space detection (parallel): ${(performance.now() - appSpaceStartTime).toFixed(2)}ms`);

      // Process current app result
      let previousApp: AppInfo | string | null = null;
      if (currentAppResult.status === 'fulfilled') {
        previousApp = currentAppResult.value;
        this.nativeToolExecutor.setPreviousApp(previousApp);
        this.directoryDetector.updatePreviousApp(previousApp);
      } else {
        logger.error('Failed to get current app:', currentAppResult.reason);
      }

      // Process space information and determine if window recreation is needed
      const spaceProcessStartTime = performance.now();
      let currentSpaceInfo = null;
      let needsWindowRecreation = false;

      if (currentSpaceResult.status === 'fulfilled' && currentSpaceResult.value) {
        currentSpaceInfo = currentSpaceResult.value;

        // Update space info with actual app information
        if (previousApp && this.desktopSpaceManager) {
          try {
            const spaceUpdateStartTime = performance.now();
            currentSpaceInfo = await this.desktopSpaceManager.getCurrentSpaceInfo(previousApp);
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

      // Prepare window data with directory information
      const windowData = await this.prepareWindowData(data, previousApp, currentSpaceInfo);

      // Display window with prepared data
      await this.displayWindow(windowData);

      logger.debug(`🏁 Total showInputWindow time: ${(performance.now() - startTime).toFixed(2)}ms`);
      logger.debug('Input window shown', { sourceApp: previousApp });

      // Background directory detection (non-blocking) - runs AFTER window is shown
      if (this.isFileSearchEnabled()) {
        setImmediate(() => {
          this.directoryDetector.executeBackgroundDirectoryDetection(this.inputWindow).catch(error => {
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
   * Prepare window data with directory information
   * @private
   */
  private async prepareWindowData(
    data: WindowData,
    previousApp: AppInfo | string | null,
    currentSpaceInfo: any
  ): Promise<WindowData> {
    // Get saved directory from DirectoryManager for fallback feature
    const savedDirectory = this.directoryDetector.getSavedDirectory();
    this.directoryDetector.updateSavedDirectory(savedDirectory);

    const windowData: WindowData = {
      sourceApp: previousApp,
      currentSpaceInfo,
      fileSearchEnabled: this.isFileSearchEnabled(),
      ...data
    };

    // Only load directory data and check fd when fileSearch is enabled
    if (this.isFileSearchEnabled()) {
      // Check fd command availability
      await this.directoryDetector.checkFdCommandAvailability();

      // Load cached file data for immediate file search availability
      const cachedData = await this.directoryDetector.loadCachedFilesForWindow();
      if (cachedData) {
        windowData.directoryData = cachedData;
        logger.debug('Loaded cached directory data', {
          directory: cachedData.directory,
          fileCount: cachedData.fileCount,
          fromCache: cachedData.fromCache
        });
      } else if (savedDirectory) {
        // Fallback to draft directory with empty files if no cache
        const isRootDirectory = this.directoryDetector.isFileSearchDisabledDirectory(savedDirectory);
        windowData.directoryData = {
          success: true,
          directory: savedDirectory,
          files: [],
          fileCount: 0,
          partial: false,
          searchMode: 'recursive',
          fromDraft: true,
          ...(isRootDirectory ? {
            filesDisabled: true,
            filesDisabledReason: 'File search is disabled for root directory'
          } : {})
        };
      }

      // Add hint message if fd command is not available
      if (!this.directoryDetector.isFdCommandAvailable()) {
        if (!windowData.directoryData) {
          windowData.directoryData = { success: false };
        }
        windowData.directoryData.hint = 'Install fd for file search: brew install fd';
        logger.debug('Added fd not available hint to directoryData');
      }
    }

    return windowData;
  }

  /**
   * Display window with data
   * @private
   */
  private async displayWindow(windowData: WindowData): Promise<void> {
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
  }

  /**
   * Hide the input window
   */
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

  /**
   * Focus the input window
   */
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

  /**
   * Position window using the position calculator
   * @private
   */
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
      const { x, y } = await this.positionCalculator.calculateWindowPosition(position, windowWidth, windowHeight);
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

  /**
   * Focus the previously active application
   * Delegates to NativeToolExecutor
   */
  async focusPreviousApp(): Promise<boolean> {
    return this.nativeToolExecutor.focusPreviousApp();
  }

  /**
   * Get the input window instance
   */
  getInputWindow(): BrowserWindow | null {
    return this.inputWindow;
  }

  /**
   * Get the previously active app
   */
  getPreviousApp(): AppInfo | string | null {
    return this.nativeToolExecutor.getPreviousApp();
  }

  /**
   * Set the previously active app (for testing and internal use)
   * Delegates to NativeToolExecutor
   */
  setPreviousApp(app: AppInfo | string | null): void {
    this.nativeToolExecutor.setPreviousApp(app);
  }

  /**
   * Destroy window and cleanup resources
   */
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

  /**
   * Check if window is visible
   */
  isVisible(): boolean {
    return this.inputWindow ? this.inputWindow.isVisible() : false;
  }

  /**
   * Setup event listeners for window events
   */
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

  /**
   * Update window settings (position, width, height)
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
   * Update file search settings
   * Delegates to DirectoryDetector
   */
  updateFileSearchSettings(settings: FileSearchSettings | null | undefined): void {
    this.directoryDetector.updateFileSearchSettings(settings);
  }

  /**
   * Check if file search is enabled
   * Returns true only when file search settings have been configured
   */
  isFileSearchEnabled(): boolean {
    return this.directoryDetector.isEnabled();
  }

  /**
   * Set DirectoryManager reference for directory fallback feature
   * Delegates to DirectoryDetector
   */
  setDirectoryManager(directoryManager: DirectoryManager): void {
    this.directoryDetector.setDirectoryManager(directoryManager);
    // Update saved directory from DirectoryManager
    const savedDirectory = directoryManager.getDirectory();
    this.directoryDetector.updateSavedDirectory(savedDirectory);
    logger.debug('DirectoryManager reference set in WindowManager');
  }
}

export default WindowManager;
