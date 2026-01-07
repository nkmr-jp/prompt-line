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
import { checkRgAvailable } from '../symbol-search';

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
    try {
      // Update settings from data
      if (data.settings?.window) {
        this.updateWindowSettings(data.settings.window);
      }
      if (data.settings?.fileSearch) {
        this.directoryDetector.updateFileSearchSettings(data.settings.fileSearch as FileSearchSettings);
      }

      // Get current app and space information in parallel
      const [currentAppResult, currentSpaceResult] = await Promise.allSettled([
        getCurrentApp(),
        this.desktopSpaceManager && this.desktopSpaceManager.isReady()
          ? this.desktopSpaceManager.getCurrentSpaceInfo(null)
          : Promise.resolve(null)
      ]);

      // Process current app result
      let previousApp: AppInfo | string | null = null;
      let isPromptLineFocused = false;
      if (currentAppResult.status === 'fulfilled') {
        const currentApp = currentAppResult.value;

        // Skip if the current app is Prompt Line itself
        // This prevents the issue where double-triggering the shortcut makes Prompt Line the paste target
        if (!this.isPromptLineApp(currentApp)) {
          previousApp = currentApp;
          this.nativeToolExecutor.setPreviousApp(previousApp);
          this.directoryDetector.updatePreviousApp(previousApp);
        } else {
          // Keep the existing previousApp when Prompt Line is focused
          isPromptLineFocused = true;
          previousApp = this.nativeToolExecutor.getPreviousApp();
          logger.debug('Prompt Line is focused, keeping existing previousApp:', previousApp);
        }
      } else {
        logger.error('Failed to get current app:', currentAppResult.reason);
      }

      // Process space information and determine if window recreation is needed
      let currentSpaceInfo = null;
      let needsWindowRecreation = false;

      if (currentSpaceResult.status === 'fulfilled' && currentSpaceResult.value) {
        currentSpaceInfo = currentSpaceResult.value;

        // Update space info with actual app information
        if (previousApp && this.desktopSpaceManager) {
          try {
            currentSpaceInfo = await this.desktopSpaceManager.getCurrentSpaceInfo(previousApp);
          } catch {
            // Failed to update space info with app - continue with existing info
          }
        }

        // Check if desktop space has changed
        if (this.lastSpaceSignature !== currentSpaceInfo.signature) {
          needsWindowRecreation = true;
        }

        this.lastSpaceSignature = currentSpaceInfo.signature;
      } else {
        // If space detection is not available, use simple logic
        needsWindowRecreation = !this.inputWindow || this.inputWindow.isDestroyed();
        if (currentSpaceResult.status === 'rejected') {
          logger.warn('Failed to get current space info:', currentSpaceResult.reason);
        }
      }

      // Handle window creation/reuse based on space changes
      if (needsWindowRecreation && this.inputWindow && !this.inputWindow.isDestroyed()) {
        this.inputWindow.destroy();
        this.inputWindow = null;
      }

      if (!this.inputWindow || this.inputWindow.isDestroyed()) {
        this.createInputWindow();
        await this.positionWindow();
      } else {
        // Reuse existing window but reposition if needed
        // Skip repositioning when Prompt Line itself is focused (double-trigger scenario)
        // This prevents the window from drifting when detecting Prompt Line's own text field
        if (!isPromptLineFocused) {
          const currentPosition = this.customWindowSettings.position || 'active-window-center';
          if (currentPosition === 'active-window-center' ||
              currentPosition === 'active-text-field' ||
              currentPosition === 'cursor' ||
              (data.settings?.window?.position && data.settings.window.position !== currentPosition)) {
            await this.positionWindow();
          }
        }
      }

      // Prepare window data with directory information
      const windowData = await this.prepareWindowData(data, previousApp, currentSpaceInfo);

      // Display window with prepared data
      await this.displayWindow(windowData);

      // Background directory detection (non-blocking) - runs AFTER window is shown
      // Skip if fd command is not available (file search is disabled)
      if (this.isFileSearchEnabled() && this.directoryDetector.isFdCommandAvailable()) {
        setImmediate(() => {
          this.directoryDetector.executeBackgroundDirectoryDetection(this.inputWindow).catch(error => {
            logger.warn('Background directory detection error:', error);
          });
        });
      }
    } catch (error) {
      logger.error('Failed to show input window:', error);
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
      symbolSearchEnabled: true, // Default to true, will be set to false if rg is not available
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

      // Disable file search and show hint if fd command is not available
      if (!this.directoryDetector.isFdCommandAvailable()) {
        windowData.fileSearchEnabled = false;
        if (!windowData.directoryData) {
          windowData.directoryData = { success: false };
        }
        windowData.directoryData.hint = 'Install fd for file search: brew install fd';
      } else {
        // Check rg command availability (only if fd is available)
        const rgCheck = await checkRgAvailable();
        if (!rgCheck.rgAvailable) {
          windowData.symbolSearchEnabled = false;
          if (!windowData.directoryData) {
            windowData.directoryData = { success: true };
          }
          // Only set rg hint if fd hint is not already set
          if (!windowData.directoryData.hint) {
            windowData.directoryData.hint = 'Install ripgrep for symbol search: brew install ripgrep';
          }
        }
      }
    }

    return windowData;
  }

  /**
   * Display window with data
   * @private
   */
  private async displayWindow(windowData: WindowData): Promise<void> {
    if (this.inputWindow!.isVisible()) {
      // Window is already visible, just update data and focus
      this.inputWindow!.webContents.send('window-shown', windowData);
      this.inputWindow!.focus();
    } else if (this.inputWindow!.webContents.isLoading()) {
      // Window is loading, wait for completion
      this.inputWindow!.webContents.once('did-finish-load', () => {
        this.inputWindow!.webContents.send('window-shown', windowData);
        this.inputWindow!.show();
        this.inputWindow!.focus();
      });
    } else {
      // Window is ready, show it
      this.inputWindow!.webContents.send('window-shown', windowData);
      this.inputWindow!.show();
      this.inputWindow!.focus();
    }
  }

  /**
   * Hide the input window
   */
  async hideInputWindow(): Promise<void> {
    try {
      if (this.inputWindow && this.inputWindow.isVisible()) {
        this.inputWindow.hide();
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
    try {
      if (!this.inputWindow) return;

      const windowWidth = this.customWindowSettings.width || config.window.width;
      const windowHeight = this.customWindowSettings.height || config.window.height;
      const position = this.customWindowSettings.position || 'active-window-center';

      const { x, y } = await this.positionCalculator.calculateWindowPosition(position, windowWidth, windowHeight);
      this.inputWindow.setPosition(Math.round(x), Math.round(y));
    } catch (error) {
      logger.error('Failed to position window:', error);
    }
  }

  /**
   * Check if the given app is Prompt Line itself
   * Handles both production (com.electron.prompt-line) and development (com.github.Electron) bundle IDs
   * @private
   */
  private isPromptLineApp(app: AppInfo | string | null): boolean {
    if (!app) return false;

    if (typeof app === 'string') {
      return app === 'Prompt Line' || app === 'Electron';
    }

    // Production build uses com.electron.prompt-line
    // Development build (npm start) uses com.github.Electron
    return app.name === 'Prompt Line' ||
           app.name === 'Electron' ||
           app.bundleId === 'com.electron.prompt-line' ||
           app.bundleId === 'com.github.Electron';
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
      }

      if (this.desktopSpaceManager) {
        this.desktopSpaceManager.destroy();
        this.desktopSpaceManager = null;
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
  }

  /**
   * Update window settings (position, width, height)
   */
  updateWindowSettings(settings: { position?: StartupPosition; width?: number; height?: number }): void {
    this.customWindowSettings = { ...this.customWindowSettings, ...settings };
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
  }
}

export default WindowManager;
