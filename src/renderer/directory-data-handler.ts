/**
 * DirectoryDataHandler - Handles directory data updates and window-shown events
 * Extracted from PromptLineRenderer to reduce file size and improve maintainability
 */

import type { DirectoryInfo, AppInfo, WindowData } from './types';
import { formatLog } from './utils/debug-logger';
import { electronAPI } from './services/electron-api';

/**
 * DomManager callbacks for UI updates
 */
export interface DomManagerCallbacks {
  updateHintText: (text: string) => void;
  setDraggable: (enabled: boolean) => void;
}

/**
 * MentionManager callbacks for file search functionality
 */
export interface MentionManagerCallbacks {
  getMentionManager: () => {
    setFileSearchEnabled: (enabled: boolean) => void;
    setSymbolSearchEnabled: (enabled: boolean) => void;
    preloadSearchPrefixesCache: () => void;
    handleCachedDirectoryData: (data: DirectoryInfo) => void;
    updateCache: (data: DirectoryInfo) => void;
    clearAtPaths: () => void;
    restoreAtPathsFromText: (checkFilesystem?: boolean) => void;
  } | null;
}

/**
 * LifecycleManager callbacks for lifecycle events
 */
export interface LifecycleManagerCallbacks {
  handleLifecycleWindowShown: (data: WindowData) => void;
}

/**
 * SearchManager callbacks for search mode management
 */
export interface SearchManagerCallbacks {
  exitSearchMode: () => void;
}

/**
 * HistoryUIManager callbacks for history UI updates
 */
export interface HistoryUIManagerCallbacks {
  resetHistoryScrollPosition: () => void;
}

/**
 * Window data callbacks for history and settings updates
 */
export interface WindowDataCallbacks {
  updateHistoryAndSettings: (data: WindowData) => void;
}

/**
 * Hint text state management callbacks
 */
export interface HintTextStateCallbacks {
  getDefaultHintText: () => string;
  setDefaultHintText: (text: string) => void;
}

/**
 * Unified callbacks interface for DirectoryDataHandler
 * Composed of specialized callback interfaces by responsibility
 */
export interface DirectoryDataHandlerCallbacks extends
  DomManagerCallbacks,
  MentionManagerCallbacks,
  LifecycleManagerCallbacks,
  SearchManagerCallbacks,
  HistoryUIManagerCallbacks,
  WindowDataCallbacks,
  HintTextStateCallbacks {}

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
      console.debug('[DirectoryDataHandler] handleWindowShown called', formatLog({
        hasDirectoryData: !!data.directoryData,
        directoryDataDirectory: data.directoryData?.directory,
        directoryDataFileCount: data.directoryData?.files?.length,
        directoryDataFromDraft: data.directoryData?.fromDraft,
        hasMentionManager: !!this.callbacks.getMentionManager(),
        fileSearchEnabled: data.fileSearchEnabled
      }));

      this.callbacks.handleLifecycleWindowShown(data);
      this.callbacks.updateHistoryAndSettings(data);

      const fileSearchManager = this.callbacks.getMentionManager();

      // Update file search enabled state in MentionManager
      fileSearchManager?.setFileSearchEnabled(data.fileSearchEnabled ?? false);

      // Update symbol search enabled state in MentionManager (disabled when rg is not available)
      fileSearchManager?.setSymbolSearchEnabled(data.symbolSearchEnabled ?? true);

      // Preload searchPrefixes cache for command/mention (enables sync checks for agent skill hints)
      fileSearchManager?.preloadSearchPrefixesCache();

      // Reset search mode and scroll position when window is shown
      this.callbacks.exitSearchMode();
      this.callbacks.resetHistoryScrollPosition();

      // Reset draggable state when window is shown (new session)
      this.callbacks.setDraggable(false);

      // Show hint message if fd command is not available (even when fileSearch is disabled)
      if (!data.fileSearchEnabled && data.directoryData?.hint) {
        console.debug('[DirectoryDataHandler] fileSearch disabled, showing hint:', data.directoryData.hint);
        this.callbacks.setDefaultHintText(data.directoryData.hint);
        this.callbacks.updateHintText(data.directoryData.hint);
      // Cache directory data for file search (from cache, Stage 1, or draft fallback)
      // Only process directory data and show directory path when fileSearch is enabled
      } else if (data.fileSearchEnabled && data.directoryData) {
        console.debug('[DirectoryDataHandler] caching directory data for file search', {
          fromDraft: data.directoryData.fromDraft,
          fromCache: data.directoryData.fromCache,
          cacheAge: data.directoryData.cacheAge
        });
        fileSearchManager?.handleCachedDirectoryData(data.directoryData);

        // Update hint text with formatted directory path
        // But prioritize hint message (e.g., fd not installed) over directory path
        if (data.directoryData.hint) {
          // Show hint message (e.g., "Install fd for file search: brew install fd")
          this.callbacks.setDefaultHintText(data.directoryData.hint);
          this.callbacks.updateHintText(data.directoryData.hint);
        } else if (data.directoryData.directory) {
          const formattedPath = this.formatDirectoryPath(data.directoryData.directory);
          // If file limit reached, show limit message instead of path
          if (data.directoryData.fileLimitReached) {
            const limitMessage = `Over ${data.directoryData.maxFiles || 5000} files (adjust settings.yml)`;
            this.callbacks.setDefaultHintText(limitMessage);
            this.callbacks.updateHintText(limitMessage);
          } else {
            this.callbacks.setDefaultHintText(formattedPath); // Save as default hint
            this.callbacks.updateHintText(formattedPath);
          }

          // Only save directory to draft if it's NOT already from draft
          // (to avoid redundant IPC call when directory is from draft fallback)
          if (!data.directoryData.fromDraft) {
            await electronAPI.invoke('set-draft-directory', data.directoryData.directory);
          }
        }
      } else if (data.fileSearchEnabled) {
        console.debug('[DirectoryDataHandler] no directory data in window-shown event');
        // Show loading message only for apps that support directory detection
        // Otherwise, keep the default hint text
        if (this.isDirectoryDetectionCapable(data.sourceApp)) {
          this.callbacks.updateHintText('Detecting directory...');
        }
        // If not directory-capable, leave the default hint text unchanged
      } else {
        console.debug('[DirectoryDataHandler] fileSearch is disabled, skipping directory hint display');
      }

      // Restore @paths highlighting for restored draft text (after small delay to ensure text is set)
      // When directory is from draft fallback, @paths should be restored with filesystem check
      // (file list is empty, so check actual filesystem for file existence)
      const checkFilesystem = data.directoryData?.fromDraft || false;
      setTimeout(() => {
        fileSearchManager?.restoreAtPathsFromText(checkFilesystem);
      }, 50);
    } catch (error) {
      console.error('Error handling window shown:', error);
    }
  }

  /**
   * Handle directory data updates (Stage 1 and Stage 2)
   */
  public async handleDirectoryDataUpdated(data: DirectoryInfo): Promise<void> {
    try {
      console.debug('[DirectoryDataHandler] handleDirectoryDataUpdated called', {
        directory: data.directory,
        fileCount: data.files?.length,
        directoryChanged: data.directoryChanged,
        previousDirectory: data.previousDirectory
      });

      const fileSearchManager = this.callbacks.getMentionManager();

      // If directory changed from draft directory, clear @path highlights first
      // This prevents stale highlights from wrong directory
      if (data.directoryChanged) {
        console.debug('[DirectoryDataHandler] Directory changed from draft, clearing @path highlights', {
          from: data.previousDirectory,
          to: data.directory
        });
        fileSearchManager?.clearAtPaths();
      }

      // Handle timeout case - show hint about large directories (no directory path displayed)
      if (data.detectionTimedOut) {
        console.debug('[DirectoryDataHandler] Directory detection timed out', {
          directory: data.directory
        });
        const timeoutMessage = 'Open terminal in editor for directory detection';
        // this.callbacks.setDefaultHintText(timeoutMessage);
        this.callbacks.updateHintText(timeoutMessage);
        return;
      }

      // Update cache with directory data (handles both Stage 1 and Stage 2)
      fileSearchManager?.updateCache(data);

      // Update hint text with formatted directory path
      // But prioritize hint message (e.g., fd not installed) over directory path
      if (data.hint) {
        // Show hint message (e.g., "Install fd for file search: brew install fd")
        this.callbacks.setDefaultHintText(data.hint);
        this.callbacks.updateHintText(data.hint);
      } else if (data.directory) {
        const formattedPath = this.formatDirectoryPath(data.directory);
        // If file limit reached, show limit message instead of path
        if (data.fileLimitReached) {
          const limitMessage = `Over ${data.maxFiles || 5000} files (adjust settings.yml)`;
          this.callbacks.setDefaultHintText(limitMessage);
          this.callbacks.updateHintText(limitMessage);
        } else {
          this.callbacks.setDefaultHintText(formattedPath); // Save as default hint
          this.callbacks.updateHintText(formattedPath);
        }

        // Save directory to draft for history recording
        await electronAPI.invoke('set-draft-directory', data.directory);

        // Try to restore @paths now that we have directory data
        // This handles the case where directory detection completes after initial window shown
        // Only restore if directory didn't change (otherwise @paths are from wrong directory)
        if (!data.directoryChanged) {
          fileSearchManager?.restoreAtPathsFromText();
        }
      }
    } catch (error) {
      console.error('Error handling directory data update:', error);
    }
  }

  /**
   * Format directory path for display in hint area
   * Truncates long paths while keeping the basename visible
   */
  public formatDirectoryPath(dirPath: string): string {
    // Remove trailing slash
    let path = dirPath.replace(/\/+$/, '');

    // Replace user home directory with ~ (macOS: /Users/xxx, Linux: /home/xxx)
    const homePattern = /^\/(?:Users|home)\/[^/]+/;
    path = path.replace(homePattern, '~');

    const maxLength = 35; // Max characters that can fit in the hint area

    if (path.length <= maxLength) {
      return path;
    }

    // Truncate from left, keeping the basename visible
    const parts = path.split('/');
    const basename = parts.pop() || path;

    // If basename alone is too long, just show basename (will be truncated by CSS)
    if (basename.length >= maxLength - 3) {
      return basename;
    }

    // Build path from right, adding as many parent directories as fit
    let result = basename;
    for (let i = parts.length - 1; i >= 0; i--) {
      const candidate = parts[i] + '/' + result;
      if (candidate.length + 3 > maxLength) { // +3 for "..."
        break;
      }
      result = candidate;
    }

    // Add ellipsis if we truncated
    if (result !== path) {
      result = '...' + result;
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
