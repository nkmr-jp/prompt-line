import { BrowserWindow } from 'electron';
import { logger } from '../../utils/utils';
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
import WindowLifecycleManager from './window-lifecycle-manager';
import WindowDisplayManager from './window-display-manager';
import WindowDataPreparer from './window-data-preparer';
import AppSpaceDetector from './app-space-detector';

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
  private desktopSpaceManager: DesktopSpaceManager | null = null;

  // Composed sub-managers
  private lifecycleManager: WindowLifecycleManager;
  private displayManager: WindowDisplayManager;
  private nativeToolExecutor: NativeToolExecutor;
  private directoryDetector: DirectoryDetector;
  private dataPreparer: WindowDataPreparer | null = null;
  private appSpaceDetector: AppSpaceDetector | null = null;

  constructor() {
    // Initialize sub-managers
    const positionCalculator = new WindowPositionCalculator();
    this.lifecycleManager = new WindowLifecycleManager(positionCalculator);
    this.displayManager = new WindowDisplayManager();
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

      // Initialize data preparer with directory detector
      this.dataPreparer = new WindowDataPreparer(this.directoryDetector);

      // Initialize app space detector
      this.appSpaceDetector = new AppSpaceDetector(
        this.desktopSpaceManager,
        this.nativeToolExecutor,
        this.directoryDetector
      );

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
    this.inputWindow = this.lifecycleManager.createInputWindow();
    return this.inputWindow;
  }

  /**
   * Show input window with positioning and directory detection
   * Coordinates all sub-managers for window display
   */
  async showInputWindow(data: WindowData = {}): Promise<void> {
    const startTime = performance.now();
    logger.debug('🕐 Starting showInputWindow()');

    try {
      // Update settings
      this.applySettings(data);

      // Get app and space info
      const { previousApp, currentSpaceInfo } = await this.appSpaceDetector!.detectAppAndSpace();

      // Handle window lifecycle
      const needsRecreation = this.appSpaceDetector!.determineWindowRecreation(currentSpaceInfo, this.inputWindow);
      await this.manageWindowLifecycle(needsRecreation, data);

      // Prepare and display window
      const windowData = await this.prepareWindowData(data, previousApp, currentSpaceInfo);
      await this.displayWindow(windowData);

      logger.debug(`🏁 Total showInputWindow time: ${(performance.now() - startTime).toFixed(2)}ms`);
      logger.debug('Input window shown', { sourceApp: previousApp });

      // Background directory detection (non-blocking)
      this.startBackgroundDirectoryDetection();
    } catch (error) {
      logger.error('Failed to show input window:', error);
      logger.error(`❌ Failed after ${(performance.now() - startTime).toFixed(2)}ms`);
      throw error;
    }
  }

  /**
   * Apply settings from window data
   * @private
   */
  private applySettings(data: WindowData): void {
    const settingsStartTime = performance.now();
    if (data.settings?.window) {
      this.updateWindowSettings(data.settings.window);
    }
    if (data.settings?.fileSearch) {
      this.directoryDetector.updateFileSearchSettings(data.settings.fileSearch as FileSearchSettings);
    }
    logger.debug(`⏱️  Window settings update: ${(performance.now() - settingsStartTime).toFixed(2)}ms`);
  }


  /**
   * Manage window lifecycle (create/reuse/reposition)
   * @private
   */
  private async manageWindowLifecycle(
    needsRecreation: boolean,
    data: WindowData
  ): Promise<void> {
    const windowMgmtStartTime = performance.now();

    if (needsRecreation && this.inputWindow && !this.inputWindow.isDestroyed()) {
      this.destroyCurrentWindow();
    }

    if (!this.inputWindow || this.inputWindow.isDestroyed()) {
      await this.createAndPositionWindow();
    } else {
      await this.repositionIfNeeded(data);
    }

    logger.debug(`⏱️  Window management total: ${(performance.now() - windowMgmtStartTime).toFixed(2)}ms`);
  }

  /**
   * Destroy current window
   * @private
   */
  private destroyCurrentWindow(): void {
    this.lifecycleManager.destroyWindow(this.inputWindow!);
    this.inputWindow = null;
  }

  /**
   * Create and position new window
   * @private
   */
  private async createAndPositionWindow(): Promise<void> {
    this.inputWindow = await this.lifecycleManager.createAndPositionWindow();
  }

  /**
   * Reposition window if needed
   * @private
   */
  private async repositionIfNeeded(data: WindowData): Promise<void> {
    const currentPosition = this.lifecycleManager.getWindowSettings().position || 'active-window-center';
    const needsReposition = this.lifecycleManager.shouldRepositionWindow(currentPosition, data);

    if (needsReposition) {
      logger.debug('Repositioning existing window for position:', currentPosition);
      const repositionStartTime = performance.now();
      await this.lifecycleManager.positionWindow(this.inputWindow!);
      logger.debug(`⏱️  Window repositioning: ${(performance.now() - repositionStartTime).toFixed(2)}ms`);
    }

    logger.debug('Reusing existing window on same desktop space');
  }

  /**
   * Start background directory detection
   * @private
   */
  private startBackgroundDirectoryDetection(): void {
    if (this.isFileSearchEnabled()) {
      setImmediate(() => {
        this.directoryDetector.executeBackgroundDirectoryDetection(this.inputWindow).catch(error => {
          logger.warn('Background directory detection error:', error);
        });
      });
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
    return await this.dataPreparer!.prepareWindowData(data, previousApp, currentSpaceInfo);
  }

  /**
   * Display window with data
   * @private
   */
  private async displayWindow(windowData: WindowData): Promise<void> {
    await this.displayManager.displayWindow(this.inputWindow!, windowData);
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
    this.lifecycleManager.updateWindowSettings(settings);
  }

  /**
   * Get current window settings
   */
  getWindowSettings(): { position?: StartupPosition; width?: number; height?: number } {
    return this.lifecycleManager.getWindowSettings();
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
