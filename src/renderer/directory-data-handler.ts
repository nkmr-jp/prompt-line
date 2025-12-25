/**
 * DirectoryDataHandler - Handles directory data updates and window-shown events
 * Extracted from PromptLineRenderer to reduce file size and improve maintainability
 */

import type { DirectoryInfo, AppInfo, WindowData } from './types';

// Secure electronAPI access via preload script
const electronAPI = (window as any).electronAPI;

/**
 * Format object for console output (Electron renderer -> main process)
 */
function formatLog(obj: Record<string, unknown>): string {
  const entries = Object.entries(obj)
    .map(([key, value]) => `  ${key}: ${typeof value === 'string' ? `'${value}'` : value}`)
    .join(',\n');
  return '{\n' + entries + '\n}';
}

/**
 * Callbacks for DirectoryDataHandler to interact with parent components
 */
export interface DirectoryDataHandlerCallbacks {
  // DomManager methods
  updateHintText: (text: string) => void;
  setDraggable: (enabled: boolean) => void;
  
  // FileSearchManager methods
  getFileSearchManager: () => {
    setFileSearchEnabled: (enabled: boolean) => void;
    preloadSearchPrefixesCache: () => void;
    handleCachedDirectoryData: (data: DirectoryInfo) => void;
    updateCache: (data: DirectoryInfo) => void;
    clearAtPaths: () => void;
    restoreAtPathsFromText: (checkFilesystem?: boolean) => void;
  } | null;
  
  // LifecycleManager method
  handleLifecycleWindowShown: (data: WindowData) => void;
  
  // SearchManager method
  exitSearchMode: () => void;
  
  // HistoryUIManager method
  resetHistoryScrollPosition: () => void;
  
  // Update history and settings
  updateHistoryAndSettings: (data: WindowData) => void;
  
  // Get/set default hint text
  getDefaultHintText: () => string;
  setDefaultHintText: (text: string) => void;
}

/**
 * Handles directory data updates and window-shown events for file search functionality
 */
export class DirectoryDataHandler {
  private callbacks: DirectoryDataHandlerCallbacks;

  constructor(callbacks: DirectoryDataHandlerCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Handle window-shown event with directory data initialization
   */
  public async handleWindowShown(data: WindowData): Promise<void> {
    try {
      this.logWindowShownDebugInfo(data);
      this.initializeWindowState(data);
      await this.processFileSearchData(data);
      this.scheduleAtPathRestoration(data);
    } catch (error) {
      console.error('Error handling window shown:', error);
    }
  }

  /**
   * Log debug information for window-shown event
   */
  private logWindowShownDebugInfo(data: WindowData): void {
    console.debug('[DirectoryDataHandler] handleWindowShown called', formatLog({
      hasDirectoryData: !!data.directoryData,
      directoryDataDirectory: data.directoryData?.directory,
      directoryDataFileCount: data.directoryData?.files?.length,
      directoryDataFromDraft: data.directoryData?.fromDraft,
      hasFileSearchManager: !!this.callbacks.getFileSearchManager(),
      fileSearchEnabled: data.fileSearchEnabled
    }));
  }

  /**
   * Initialize window state (lifecycle, history, settings)
   */
  private initializeWindowState(data: WindowData): void {
    this.callbacks.handleLifecycleWindowShown(data);
    this.callbacks.updateHistoryAndSettings(data);

    const fileSearchManager = this.callbacks.getFileSearchManager();
    fileSearchManager?.setFileSearchEnabled(data.fileSearchEnabled ?? false);
    fileSearchManager?.preloadSearchPrefixesCache();

    this.callbacks.exitSearchMode();
    this.callbacks.resetHistoryScrollPosition();
    this.callbacks.setDraggable(false);
  }

  /**
   * Process file search data and update hint text
   */
  private async processFileSearchData(data: WindowData): Promise<void> {
    if (!data.fileSearchEnabled) {
      console.debug('[DirectoryDataHandler] fileSearch is disabled, skipping directory hint display');
      return;
    }

    const fileSearchManager = this.callbacks.getFileSearchManager();

    if (data.directoryData) {
      await this.processDirectoryData(data.directoryData, fileSearchManager);
    } else {
      this.handleMissingDirectoryData(data);
    }
  }

  /**
   * Process directory data from window-shown event
   */
  private async processDirectoryData(
    directoryData: DirectoryInfo,
    fileSearchManager: ReturnType<typeof this.callbacks.getFileSearchManager>
  ): Promise<void> {
    console.debug('[DirectoryDataHandler] caching directory data for file search', {
      fromDraft: directoryData.fromDraft,
      fromCache: directoryData.fromCache,
      cacheAge: directoryData.cacheAge
    });

    fileSearchManager?.handleCachedDirectoryData(directoryData);
    await this.updateHintTextForDirectory(directoryData);
  }

  /**
   * Update hint text based on directory data
   */
  private async updateHintTextForDirectory(directoryData: DirectoryInfo): Promise<void> {
    if (directoryData.hint) {
      this.setHintText(directoryData.hint);
    } else if (directoryData.directory) {
      await this.updateHintTextForValidDirectory(directoryData);
    }
  }

  /**
   * Update hint text for valid directory
   */
  private async updateHintTextForValidDirectory(directoryData: DirectoryInfo): Promise<void> {
    if (!directoryData.directory) {
      return;
    }

    const formattedPath = this.formatDirectoryPath(directoryData.directory);

    if (directoryData.fileLimitReached) {
      const limitMessage = `Over ${directoryData.maxFiles || 5000} files (adjust settings.yml)`;
      this.setHintText(limitMessage);
    } else {
      this.setHintText(formattedPath);
    }

    if (!directoryData.fromDraft) {
      await electronAPI.invoke('set-draft-directory', directoryData.directory);
    }
  }

  /**
   * Set hint text (both default and current)
   */
  private setHintText(text: string): void {
    this.callbacks.setDefaultHintText(text);
    this.callbacks.updateHintText(text);
  }

  /**
   * Handle missing directory data
   */
  private handleMissingDirectoryData(data: WindowData): void {
    console.debug('[DirectoryDataHandler] no directory data in window-shown event');

    if (this.isDirectoryDetectionCapable(data.sourceApp)) {
      this.callbacks.updateHintText('Detecting directory...');
    }
  }

  /**
   * Schedule @path restoration after delay
   */
  private scheduleAtPathRestoration(data: WindowData): void {
    const checkFilesystem = data.directoryData?.fromDraft || false;
    const fileSearchManager = this.callbacks.getFileSearchManager();

    setTimeout(() => {
      fileSearchManager?.restoreAtPathsFromText(checkFilesystem);
    }, 50);
  }

  /**
   * Handle directory data updates (Stage 1 and Stage 2)
   */
  public async handleDirectoryDataUpdated(data: DirectoryInfo): Promise<void> {
    try {
      this.logDirectoryDataUpdate(data);
      this.handleDirectoryChange(data);

      if (this.handleDetectionTimeout(data)) {
        return;
      }

      await this.updateCacheAndHints(data);
    } catch (error) {
      console.error('Error handling directory data update:', error);
    }
  }

  private logDirectoryDataUpdate(data: DirectoryInfo): void {
    console.debug('[DirectoryDataHandler] handleDirectoryDataUpdated called', {
      directory: data.directory,
      fileCount: data.files?.length,
      directoryChanged: data.directoryChanged,
      previousDirectory: data.previousDirectory
    });
  }

  private handleDirectoryChange(data: DirectoryInfo): void {
    if (!data.directoryChanged) return;

    console.debug('[DirectoryDataHandler] Directory changed from draft, clearing @path highlights', {
      from: data.previousDirectory,
      to: data.directory
    });
    this.callbacks.getFileSearchManager()?.clearAtPaths();
  }

  private handleDetectionTimeout(data: DirectoryInfo): boolean {
    if (!data.detectionTimedOut) return false;

    console.debug('[DirectoryDataHandler] Directory detection timed out', {
      directory: data.directory
    });
    const timeoutMessage = 'Large directory (adjust settings.yml)';
    this.setHintText(timeoutMessage);
    return true;
  }

  private async updateCacheAndHints(data: DirectoryInfo): Promise<void> {
    const fileSearchManager = this.callbacks.getFileSearchManager();
    fileSearchManager?.updateCache(data);

    if (data.hint) {
      this.setHintText(data.hint);
    } else if (data.directory) {
      await this.updateHintsForDirectory(data);
    }
  }

  private async updateHintsForDirectory(data: DirectoryInfo): Promise<void> {
    const formattedPath = this.formatDirectoryPath(data.directory!);

    if (data.fileLimitReached) {
      const limitMessage = `Over ${data.maxFiles || 5000} files (adjust settings.yml)`;
      this.setHintText(limitMessage);
    } else {
      this.setHintText(formattedPath);
    }

    await electronAPI.invoke('set-draft-directory', data.directory);

    if (!data.directoryChanged) {
      this.callbacks.getFileSearchManager()?.restoreAtPathsFromText();
    }
  }

  /**
   * Format directory path for display in hint area
   * Truncates long paths while keeping the basename visible
   */
  public formatDirectoryPath(dirPath: string): string {
    const path = this.normalizeDirectoryPath(dirPath);
    const maxLength = 35;

    if (path.length <= maxLength) {
      return path;
    }

    return this.truncateDirectoryPath(path, maxLength);
  }

  private normalizeDirectoryPath(dirPath: string): string {
    const pathWithoutSlash = dirPath.replace(/\/+$/, '');
    const homePattern = /^\/(?:Users|home)\/[^/]+/;
    return pathWithoutSlash.replace(homePattern, '~');
  }

  private truncateDirectoryPath(path: string, maxLength: number): string {
    const parts = path.split('/');
    const basename = parts.pop() || path;

    if (basename.length >= maxLength - 3) {
      return basename;
    }

    const result = this.buildTruncatedPath(parts, basename, maxLength);
    return result !== path ? '...' + result : result;
  }

  private buildTruncatedPath(parts: string[], basename: string, maxLength: number): string {
    let result = basename;
    for (let i = parts.length - 1; i >= 0; i--) {
      const candidate = parts[i] + '/' + result;
      if (candidate.length + 3 > maxLength) {
        break;
      }
      result = candidate;
    }
    return result;
  }

  /**
   * Check if the source app supports directory detection
   * (terminals and IDEs)
   */
  public isDirectoryDetectionCapable(sourceApp: AppInfo | string | null | undefined): boolean {
    if (!sourceApp) return false;

    // Extract app name
    const appName = typeof sourceApp === 'string' ? sourceApp : sourceApp.name;
    if (!appName) return false;

    // List of apps that support directory detection (terminals and IDEs)
    const directoryCapableApps = [
      // Terminal emulators
      'terminal',
      'iterm',
      'iterm2',
      'hyper',
      'alacritty',
      'kitty',
      'warp',
      'tabby',
      'wezterm',
      // IDEs and editors
      'visual studio code',
      'code',
      'vscode',
      'goland',
      'intellij',
      'webstorm',
      'phpstorm',
      'pycharm',
      'rubymine',
      'rider',
      'clion',
      'datagrip',
      'android studio',
      'xcode',
      'sublime text',
      'atom',
      'vim',
      'neovim',
      'emacs',
      'cursor',
      'zed'
    ];

    const lowerAppName = appName.toLowerCase();
    return directoryCapableApps.some(app => lowerAppName.includes(app));
  }
}
