// Import types and dependencies
import type {
  HistoryItem,
  WindowData,
  Config,
  PasteResult,
  ImageResult,
  UserSettings,
  DirectoryInfo,
  AppInfo
} from './types';
import { EventHandler } from './event-handler';
import { SearchManager } from './search-manager';
import { SlashCommandManager } from './slash-command-manager';
import { DomManager } from './dom-manager';
import { DraftManager } from './draft-manager';
import { HistoryUIManager } from './history-ui-manager';
import { LifecycleManager } from './lifecycle-manager';
import { SimpleSnapshotManager } from './snapshot-manager';
import { FileSearchManager } from './file-search-manager';

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

if (!electronAPI) {
  throw new Error('Electron API not available. Preload script may not be loaded correctly.');
}

// Export the renderer class for testing
export class PromptLineRenderer {
  private historyData: HistoryItem[] = [];
  private filteredHistoryData: HistoryItem[] = [];
  private config: Config = {};
  private userSettings: UserSettings | null = null;
  private eventHandler: EventHandler | null = null;
  private searchManager: SearchManager | null = null;
  private slashCommandManager: SlashCommandManager | null = null;
  private fileSearchManager: FileSearchManager | null = null;
  private domManager: DomManager;
  private draftManager: DraftManager;
  private historyUIManager: HistoryUIManager;
  private lifecycleManager: LifecycleManager;
  private snapshotManager: SimpleSnapshotManager;
  private defaultHintText: string = ''; // Default hint text (directory path)

  constructor() {
    this.domManager = new DomManager();
    this.draftManager = new DraftManager(electronAPI, () => this.domManager.getCurrentText());
    this.snapshotManager = new SimpleSnapshotManager();
    this.historyUIManager = new HistoryUIManager(
      () => this.domManager.historyList,
      (text: string) => {
        this.domManager.setText(text);
        // Clear @path highlights when setting text from history
        this.fileSearchManager?.clearAtPaths();
      },
      () => this.domManager.focusTextarea(),
      () => this.searchManager,
      () => this.domManager.getCurrentText(),
      () => this.domManager.getCursorPosition(),
      (text: string, cursorPosition: number) => {
        this.snapshotManager.saveSnapshot(text, cursorPosition);
      }
    );
    this.lifecycleManager = new LifecycleManager(
      electronAPI,
      () => this.domManager.appNameEl,
      () => this.domManager.headerShortcutsEl,
      () => this.domManager.historyShortcutsEl,
      (name: string) => this.domManager.updateAppName(name),
      (text: string) => this.domManager.setText(text),
      () => this.domManager.focusTextarea(),
      (position: number) => this.domManager.setCursorPosition(position),
      () => this.domManager.selectAll()
    );
    this.init();
  }

  private async init(): Promise<void> {
    try {
      this.domManager.initializeElements();
      this.config = await electronAPI.config.get('') as Config;
      this.draftManager.setConfig(this.config);

      this.setupEventHandler();
      this.setupSearchManager();
      this.setupSlashCommandManager();
      this.setupFileSearchManager();
      this.setupEventListeners();
      this.setupIPCListeners();
    } catch (error) {
      console.error('Failed to initialize renderer:', error);
    }
  }

  private setupEventHandler(): void {
    this.eventHandler = new EventHandler({
      onTextPaste: this.handleTextPasteCallback.bind(this),
      onWindowHide: this.handleWindowHideCallback.bind(this),
      onTabKeyInsert: this.handleTabKeyCallback.bind(this),
      onShiftTabKeyPress: this.handleShiftTabKeyCallback.bind(this),
      onHistoryNavigation: this.navigateHistory.bind(this),
      onSearchToggle: this.handleSearchToggle.bind(this),
      onUndo: this.handleUndo.bind(this)
    });

    this.eventHandler.setTextarea(this.domManager.textarea);
    this.eventHandler.setDomManager(this.domManager);
    this.eventHandler.setupEventListeners();
  }

  private setupSearchManager(): void {
    this.searchManager = new SearchManager({
      onSearchStateChange: this.handleSearchStateChange.bind(this)
    });

    this.searchManager.initializeElements();
    this.searchManager.setupEventListeners();

    // Set SearchManager reference in EventHandler
    if (this.eventHandler) {
      this.eventHandler.setSearchManager(this.searchManager);
    }
  }

  private setupSlashCommandManager(): void {
    this.slashCommandManager = new SlashCommandManager({
      onCommandSelect: async (command: string) => {
        console.debug('Slash command selected (Enter):', command);
        // Paste the selected command immediately
        if (command) {
          await this.handleTextPasteCallback(command);
        }
      },
      onCommandInsert: (command: string) => {
        console.debug('Slash command inserted (Tab):', command);
        // Just insert into textarea for editing, don't paste
        // The command is already inserted by SlashCommandManager
      }
    });

    this.slashCommandManager.initializeElements();
    this.slashCommandManager.setupEventListeners();

    // Set SlashCommandManager reference in EventHandler
    if (this.eventHandler) {
      this.eventHandler.setSlashCommandManager(this.slashCommandManager);
    }

    // Pre-load commands
    this.slashCommandManager.loadCommands();
  }

  private setupFileSearchManager(): void {
    this.fileSearchManager = new FileSearchManager({
      onFileSelected: (filePath: string) => {
        console.debug('[FileSearchManager] File selected:', filePath);
        // File path is already inserted by FileSearchManager
        this.draftManager.saveDraftDebounced();
      },
      getTextContent: () => this.domManager.getCurrentText(),
      setTextContent: (text: string) => this.domManager.setText(text),
      getCursorPosition: () => this.domManager.getCursorPosition(),
      setCursorPosition: (position: number) => this.domManager.setCursorPosition(position),
      onBeforeOpenFile: () => {
        // Suppress blur event to prevent window from closing when opening file
        this.eventHandler?.setSuppressBlurHide(true);
      },
      updateHintText: (text: string) => {
        this.domManager.updateHintText(text);
      },
      getDefaultHintText: () => this.defaultHintText,
      setDraggable: (enabled: boolean) => {
        // Enable/disable draggable state on header during file open
        this.domManager.setDraggable(enabled);
      }
    });

    this.fileSearchManager.initializeElements();
    this.fileSearchManager.setupEventListeners();

    // Set FileSearchManager reference in EventHandler
    if (this.eventHandler) {
      this.eventHandler.setFileSearchManager(this.fileSearchManager);
    }
  }

  private setupEventListeners(): void {
    if (!this.domManager.textarea) return;

    this.domManager.textarea.addEventListener('input', () => {
      this.domManager.updateCharCount();
      this.draftManager.saveDraftDebounced();
      this.historyUIManager.clearHistorySelection();

      // 編集開始時にスナップショットをクリア
      if (this.snapshotManager.hasSnapshot()) {
        this.snapshotManager.clearSnapshot();
        console.debug('Snapshot cleared on text edit');
      }
    });

    this.domManager.textarea.addEventListener('keydown', (e) => {
      this.handleKeyDown(e);
    });

    document.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });

    this.domManager.textarea.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) {
        e.stopPropagation();
      }
    });

    // Add mouse event listeners to disable keyboard navigation mode on mouse interaction
    document.addEventListener('mousemove', () => {
      this.historyUIManager.clearHistorySelection();
    });

    document.addEventListener('mousedown', () => {
      this.historyUIManager.clearHistorySelection();
    });

    // Search navigation in search input (allow history navigation shortcuts even when search input is focused)
    if (this.domManager.searchInput) {
      this.domManager.searchInput.addEventListener('keydown', (e) => {
        // Use eventHandler's user settings if available
        if (this.eventHandler && this.userSettings?.shortcuts) {
          const handled = this.eventHandler.handleHistoryNavigationShortcuts(e, (direction) => {
            this.navigateHistory(e, direction);
          });
          // Prevent event propagation to avoid duplicate handling by document listener
          if (handled) {
            e.stopPropagation();
            e.stopImmediatePropagation();
          }
        }
      });
    }
  }

  private setupIPCListeners(): void {
    electronAPI.on('window-shown', (...args: unknown[]) => {
      const data = args[0] as WindowData;
      this.handleWindowShown(data);
    });

    // Listen for Stage 2 directory data updates
    electronAPI.on('directory-data-updated', (...args: unknown[]) => {
      const data = args[0] as DirectoryInfo;
      this.handleDirectoryDataUpdated(data);
    });
  }

  private async handleKeyDown(e: KeyboardEvent): Promise<void> {
    try {
      if (!this.domManager.textarea) return;

      if (e.key === 'v' && (e.metaKey || e.ctrlKey)) {
        // Store current text content before paste operation
        const textBeforePaste = this.domManager.getCurrentText();
        const cursorPosition = this.domManager.textarea.selectionStart;
        
        // Let default paste happen first, then check if we need to handle image
        setTimeout(async () => {
          try {
            const result = await electronAPI.invoke('paste-image') as ImageResult;
            if (result.success && result.path) {
              // Image paste successful - remove any text that was pasted and insert image path
              this.domManager.setText(textBeforePaste);
              this.domManager.setCursorPosition(cursorPosition);
              this.domManager.insertTextAtCursor(result.path);
              this.draftManager.saveDraftDebounced();
            }
            // If no image, the default text paste behavior is preserved
          } catch (error) {
            console.error('Error handling image paste:', error);
          }
        }, 0);
        return;
      }

      // Skip shortcuts if IME is active to avoid conflicts with Japanese input
      const isComposing = this.eventHandler?.getIsComposing() || e.isComposing;
      if (isComposing) {
        return;
      }
    } catch (error) {
      console.error('Error handling keydown:', error);
    }
  }


  private async handleTextPasteCallback(text: string): Promise<void> {
    const result = await electronAPI.pasteText(text) as PasteResult;
    if (!result.success) {
      console.error('Paste error:', result.error);
      this.domManager.showError('Paste failed: ' + result.error);
    } else if (result.warning) {
      console.warn('Paste warning:', result.warning);
    } else {
      // Clear snapshot after successful paste
      this.snapshotManager.clearSnapshot();
      await this.clearTextAndDraft();
      this.historyUIManager.clearHistorySelection();
    }
  }

  /**
   * Handle Cmd+Z undo operation
   * @returns true if snapshot was restored, false otherwise
   */
  private handleUndo(): boolean {
    if (this.snapshotManager.hasSnapshot()) {
      const snapshot = this.snapshotManager.restore();
      if (snapshot) {
        this.domManager.setText(snapshot.text);
        this.domManager.setCursorPosition(snapshot.cursorPosition);
        this.domManager.focusTextarea();
        console.debug('Snapshot restored successfully');
        return true;
      }
    }
    // Let browser handle default undo
    console.debug('No snapshot, using browser default undo');
    return false;
  }

  private async handleWindowHideCallback(): Promise<void> {
    try {
      await this.draftManager.saveDraftImmediate();
      await electronAPI.window.hide();
    } catch (error) {
      console.error('Error handling window hide:', error);
    }
  }

  private handleTabKeyCallback(e: KeyboardEvent): void {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    this.domManager.insertTextAtCursor('\t');
    this.draftManager.saveDraftDebounced();
  }

  private handleShiftTabKeyCallback(e: KeyboardEvent): void {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    this.domManager.outdentAtCursor();
    this.draftManager.saveDraftDebounced();
  }


  private async clearTextAndDraft(): Promise<void> {
    this.domManager.clearText();
    await this.draftManager.clearDraft();
    // Clear tracked @paths when text is cleared
    this.fileSearchManager?.clearAtPaths();
  }



  private async handleWindowShown(data: WindowData): Promise<void> {
    try {
      console.debug('[Renderer] handleWindowShown called', formatLog({
        hasDirectoryData: !!data.directoryData,
        directoryDataDirectory: data.directoryData?.directory,
        directoryDataFileCount: data.directoryData?.files?.length,
        directoryDataFromDraft: data.directoryData?.fromDraft,
        hasFileSearchManager: !!this.fileSearchManager
      }));

      this.lifecycleManager.handleWindowShown(data);
      this.updateHistoryAndSettings(data);

      // Reset search mode and scroll position when window is shown
      this.searchManager?.exitSearchMode();
      this.resetHistoryScrollPosition();

      // Reset draggable state when window is shown (new session)
      this.domManager.setDraggable(false);

      // Cache directory data for file search (from cache, Stage 1, or draft fallback)
      if (data.directoryData) {
        console.debug('[Renderer] caching directory data for file search', {
          fromDraft: data.directoryData.fromDraft,
          fromCache: data.directoryData.fromCache,
          cacheAge: data.directoryData.cacheAge
        });
        this.fileSearchManager?.handleCachedDirectoryData(data.directoryData);

        // Update hint text with formatted directory path
        if (data.directoryData.directory) {
          const formattedPath = this.formatDirectoryPath(data.directoryData.directory);
          // If file limit reached, show limit message instead of path
          if (data.directoryData.fileLimitReached) {
            const limitMessage = `Over ${data.directoryData.maxFiles || 5000} files (adjust settings.yml)`;
            this.defaultHintText = limitMessage;
            this.domManager.updateHintText(limitMessage);
          } else {
            this.defaultHintText = formattedPath; // Save as default hint
            this.domManager.updateHintText(formattedPath);
          }

          // Only save directory to draft if it's NOT already from draft
          // (to avoid redundant IPC call when directory is from draft fallback)
          if (!data.directoryData.fromDraft) {
            await electronAPI.invoke('set-draft-directory', data.directoryData.directory);
          }
        }
      } else {
        console.debug('[Renderer] no directory data in window-shown event');
        // Show loading message only for apps that support directory detection
        // Otherwise, keep the default hint text
        if (this.isDirectoryDetectionCapable(data.sourceApp)) {
          this.domManager.updateHintText('Detecting directory...');
        }
        // If not directory-capable, leave the default hint text unchanged
      }

      // Restore @paths highlighting for restored draft text (after small delay to ensure text is set)
      // When directory is from draft fallback, @paths should be restored with filesystem check
      // (file list is empty, so check actual filesystem for file existence)
      const checkFilesystem = data.directoryData?.fromDraft || false;
      setTimeout(() => {
        this.fileSearchManager?.restoreAtPathsFromText(checkFilesystem);
      }, 50);
    } catch (error) {
      console.error('Error handling window shown:', error);
    }
  }

  private async handleDirectoryDataUpdated(data: DirectoryInfo): Promise<void> {
    try {
      console.debug('[Renderer] handleDirectoryDataUpdated called', {
        directory: data.directory,
        fileCount: data.files?.length,
        directoryChanged: data.directoryChanged,
        previousDirectory: data.previousDirectory
      });

      // If directory changed from draft directory, clear @path highlights first
      // This prevents stale highlights from wrong directory
      if (data.directoryChanged) {
        console.debug('[Renderer] Directory changed from draft, clearing @path highlights', {
          from: data.previousDirectory,
          to: data.directory
        });
        this.fileSearchManager?.clearAtPaths();
      }

      // Handle timeout case - show hint about large directories (no directory path displayed)
      if (data.detectionTimedOut) {
        console.debug('[Renderer] Directory detection timed out', {
          directory: data.directory
        });
        const timeoutMessage = 'Large directory (adjust settings.yml)';
        this.defaultHintText = timeoutMessage;
        this.domManager.updateHintText(timeoutMessage);
        return;
      }

      // Update cache with directory data (handles both Stage 1 and Stage 2)
      this.fileSearchManager?.updateCache(data);

      // Update hint text with formatted directory path
      if (data.directory) {
        const formattedPath = this.formatDirectoryPath(data.directory);
        // If file limit reached, show limit message instead of path
        if (data.fileLimitReached) {
          const limitMessage = `Over ${data.maxFiles || 5000} files (adjust settings.yml)`;
          this.defaultHintText = limitMessage;
          this.domManager.updateHintText(limitMessage);
        } else {
          this.defaultHintText = formattedPath; // Save as default hint
          this.domManager.updateHintText(formattedPath);
        }

        // Save directory to draft for history recording
        await electronAPI.invoke('set-draft-directory', data.directory);

        // Try to restore @paths now that we have directory data
        // This handles the case where directory detection completes after initial window shown
        // Only restore if directory didn't change (otherwise @paths are from wrong directory)
        if (!data.directoryChanged) {
          this.fileSearchManager?.restoreAtPathsFromText();
        }
      }
    } catch (error) {
      console.error('Error handling directory data update:', error);
    }
  }


  /**
   * Check if the source app supports directory detection
   * Terminal emulators and IDEs typically support detecting the current working directory
   */
  private isDirectoryDetectionCapable(sourceApp: AppInfo | string | null | undefined): boolean {
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

  /**
   * Format directory path for display in hint text
   * - Replace user home directory with ~
   * - Remove trailing slash
   * - Truncate from left if too long, always showing basename
   */
  private formatDirectoryPath(dirPath: string): string {
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

  private updateHistoryAndSettings(data: WindowData): void {
    this.historyData = data.history || [];
    this.filteredHistoryData = [...this.historyData];
    this.searchManager?.updateHistoryData(this.historyData);
    
    // Update user settings if provided
    if (data.settings) {
      this.userSettings = data.settings;
      // Pass settings to event handler
      if (this.eventHandler) {
        this.eventHandler.setUserSettings(data.settings);
      }
    }
    
    this.renderHistory();
  }





  private renderHistory(): void {
    this.historyUIManager.renderHistory(this.filteredHistoryData);
  }




  private navigateHistory(e: KeyboardEvent, direction: 'next' | 'prev'): void {
    this.historyUIManager.navigateHistory(e, direction, this.filteredHistoryData);
  }





  // Public API methods
  public getCurrentText(): string {
    return this.domManager.getCurrentText();
  }

  public setText(text: string): void {
    this.domManager.setText(text);
  }

  public clearText(): void {
    this.domManager.clearText();
  }

  public focus(): void {
    this.domManager.focusTextarea();
  }

  // Search functionality callbacks
  private handleSearchToggle(): void {
    this.searchManager?.toggleSearchMode();
  }

  private handleSearchStateChange(isSearchMode: boolean, filteredData: HistoryItem[]): void {
    // Only clear history selection when entering search mode or when filter actually changes data length
    const shouldClearSelection = !isSearchMode || filteredData.length !== this.filteredHistoryData.length;
    
    this.filteredHistoryData = filteredData;
    this.renderHistory();

    if (shouldClearSelection) {
      this.historyUIManager.clearHistorySelection();
    }

    if (!isSearchMode) {
      // Return focus to main textarea when exiting search
      this.searchManager?.focusMainTextarea();
    }
  }

  private resetHistoryScrollPosition(): void {
    if (this.domManager.historyList) {
      this.domManager.historyList.scrollTop = 0;
    }
  }

  // Cleanup method
  public cleanup(): void {
    this.draftManager.cleanup();
    this.historyUIManager.cleanup();
    this.fileSearchManager?.destroy();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  (window as any).promptLineRenderer = new PromptLineRenderer();
});