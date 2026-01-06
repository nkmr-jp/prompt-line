// Import types and dependencies
import type {
  HistoryItem,
  WindowData,
  Config,
  PasteResult,
  ImageResult,
  UserSettings,
  DirectoryInfo
} from './types';
import { EventHandler } from './event-handler';
import { HistorySearchManager } from './history-search';
import { SlashCommandManager } from './slash-command-manager';
import { DomManager } from './dom-manager';
import { DraftManagerClient } from './draft-manager-client';
import { HistoryUIManager } from './history-ui-manager';
import { LifecycleManager } from './lifecycle-manager';
import { SimpleSnapshotManager } from './snapshot-manager';
import { MentionManager } from './mention-manager';
import { DirectoryDataHandler } from './directory-data-handler';
import { rendererLogger } from './utils/logger';
import { electronAPI } from './services/electron-api';

// Default display limit for history items
const DEFAULT_DISPLAY_LIMIT = 50;

// Export the renderer class for testing
export class PromptLineRenderer {
  private historyData: HistoryItem[] = [];
  private filteredHistoryData: HistoryItem[] = [];
  private totalMatchCount: number | undefined = undefined;
  private nonSearchDisplayLimit: number = DEFAULT_DISPLAY_LIMIT;
  private config: Config = {};
  private userSettings: UserSettings | null = null;
  private eventHandler: EventHandler | null = null;
  private searchManager: HistorySearchManager | null = null;
  private slashCommandManager: SlashCommandManager | null = null;
  private fileSearchManager: MentionManager | null = null;
  private directoryDataHandler: DirectoryDataHandler;
  private domManager: DomManager;
  private draftManager: DraftManagerClient;
  private historyUIManager: HistoryUIManager;
  private lifecycleManager: LifecycleManager;
  private snapshotManager: SimpleSnapshotManager;
  private defaultHintText: string = 'Multi-line text and Image supported'; // Default hint text
  // Queue for pending window-shown data to handle race condition with init()
  private pendingWindowData: WindowData | null = null;
  private initCompleted: boolean = false;

  constructor() {
    this.domManager = new DomManager();
    this.draftManager = new DraftManagerClient(
      electronAPI,
      () => this.domManager.getCurrentText(),
      () => this.domManager.getScrollTop()
    );
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
      },
      () => this.handleLoadMore()
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
      () => this.domManager.selectAll(),
      (scrollTop: number) => this.domManager.setScrollTop(scrollTop)
    );
    this.directoryDataHandler = new DirectoryDataHandler({
      updateHintText: (text: string) => this.domManager.updateHintText(text),
      setDraggable: (enabled: boolean) => this.domManager.setDraggable(enabled),
      getMentionManager: () => this.fileSearchManager,
      handleLifecycleWindowShown: (data) => this.lifecycleManager.handleWindowShown(data),
      exitSearchMode: () => this.searchManager?.exitSearchMode(),
      resetHistoryScrollPosition: () => this.resetHistoryScrollPosition(),
      updateHistoryAndSettings: (data) => this.updateHistoryAndSettings(data),
      getDefaultHintText: () => this.defaultHintText,
      setDefaultHintText: (text: string) => { this.defaultHintText = text; }
    });
    // CRITICAL: Register IPC listeners BEFORE any async operations
    // to prevent race condition when window-shown event is sent
    this.setupIPCListeners();
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
      this.setupMentionManager();
      // Code search is now integrated into MentionManager
      // await this.setupCodeSearchManager();
      this.setupEventListeners();
      // Note: setupIPCListeners() is now called in constructor to prevent race condition

      // Mark initialization as complete
      this.initCompleted = true;
      console.debug('[PromptLineRenderer] Initialization completed');

      // Process any pending window-shown data that arrived before init completed
      if (this.pendingWindowData) {
        console.debug('[PromptLineRenderer] Processing pending window-shown data');
        await this.directoryDataHandler.handleWindowShown(this.pendingWindowData);
        this.pendingWindowData = null;
      }
    } catch (error) {
      rendererLogger.error('Failed to initialize renderer:', error);
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
      onUndo: this.handleUndo.bind(this),
      onSaveDraftToHistory: this.handleSaveDraftToHistory.bind(this)
    });

    this.eventHandler.setTextarea(this.domManager.textarea);
    this.eventHandler.setDomManager(this.domManager);
    this.eventHandler.setupEventListeners();
  }

  private setupSearchManager(): void {
    this.searchManager = new HistorySearchManager({
      onSearchStateChange: this.handleSearchStateChange.bind(this)
    });

    this.searchManager.initializeElements();
    this.searchManager.setupEventListeners();

    // Setup scroll listener for infinite scroll
    this.historyUIManager.setupScrollListener();

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
      },
      onBeforeOpenFile: () => {
        // Suppress blur event to prevent window from closing when opening file
        this.eventHandler?.setSuppressBlurHide(true);
      },
      setDraggable: (enabled: boolean) => {
        // Enable/disable draggable state on header during file open
        this.domManager.setDraggable(enabled);
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

  private setupMentionManager(): void {
    this.fileSearchManager = new MentionManager({
      onFileSelected: (_filePath: string) => {
        // File path is already inserted by MentionManager
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
      },
      replaceRangeWithUndo: (start: number, end: number, newText: string) => {
        // Replace text range with native Undo/Redo support
        this.domManager.replaceRangeWithUndo(start, end, newText);
      },
      getIsComposing: () => this.eventHandler?.getIsComposing() ?? false,
      showError: (message: string) => this.domManager.showError(message)
    });

    this.fileSearchManager.initializeElements();
    this.fileSearchManager.setupEventListeners();

    // Set MentionManager reference in EventHandler
    if (this.eventHandler) {
      this.eventHandler.setMentionManager(this.fileSearchManager);
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
            const result = (await electronAPI.invoke('paste-image')) as unknown as ImageResult;
            if (result.success && result.path) {
              // Image paste successful - remove any text that was pasted and insert image path
              this.domManager.setText(textBeforePaste);
              this.domManager.setCursorPosition(cursorPosition);
              this.domManager.insertTextAtCursor(result.path);
              this.draftManager.saveDraftDebounced();
            }
            // If no image, the default text paste behavior is preserved
          } catch (error) {
            rendererLogger.error('Error handling image paste:', error);
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
      rendererLogger.error('Error handling keydown:', error);
    }
  }


  private async handleTextPasteCallback(text: string): Promise<void> {
    const result = await electronAPI.pasteText(text) as PasteResult;
    if (!result.success) {
      rendererLogger.error('Paste error:', result.error);
      this.domManager.showError('Paste failed: ' + result.error);
    } else if (result.warning) {
      rendererLogger.warn('Paste warning:', result.warning);
    } else {
      // Clear snapshot after successful paste
      this.snapshotManager.clearSnapshot();
      await this.clearTextAndDraft();
      this.historyUIManager.clearHistorySelection();
    }
  }

  /**
   * Handle Cmd+S to save current draft to history
   */
  private async handleSaveDraftToHistory(): Promise<void> {
    const text = this.domManager.getCurrentText();
    const trimmedText = text.trim();
    if (!trimmedText) {
      rendererLogger.info('No text to save to history');
      return;
    }

    // Skip if same as latest history item
    if (this.historyData.length > 0 && this.historyData[0]?.text === trimmedText) {
      rendererLogger.info('Text is same as latest history, skipping');
      return;
    }

    try {
      const result = await electronAPI.invoke('save-draft-to-history', text) as unknown as { success: boolean; item?: HistoryItem; error?: string };
      if (result.success && result.item) {
        // Add item to local history data and re-render UI
        this.historyData.unshift(result.item);
        this.filteredHistoryData = this.historyData.slice(0, this.nonSearchDisplayLimit);
        this.totalMatchCount = this.historyData.length;
        this.renderHistory();
        rendererLogger.info('Draft saved to history via Cmd+S');
      } else {
        rendererLogger.error('Failed to save draft to history:', result.error);
      }
    } catch (error) {
      rendererLogger.error('Error saving draft to history:', error);
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
      rendererLogger.error('Error handling window hide:', error);
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
    // If init hasn't completed yet, queue the data for later processing
    // This prevents race condition where window-shown arrives before fileSearchManager is initialized
    if (!this.initCompleted) {
      console.debug('[PromptLineRenderer] Queueing window-shown data (init not complete)');
      this.pendingWindowData = data;
      return;
    }
    await this.directoryDataHandler.handleWindowShown(data);
  }

  private async handleDirectoryDataUpdated(data: DirectoryInfo): Promise<void> {
    await this.directoryDataHandler.handleDirectoryDataUpdated(data);
  }


  private updateHistoryAndSettings(data: WindowData): void {
    this.historyData = data.history || [];
    // Reset display limit and limit initial display
    this.nonSearchDisplayLimit = DEFAULT_DISPLAY_LIMIT;
    this.filteredHistoryData = this.historyData.slice(0, this.nonSearchDisplayLimit);
    this.totalMatchCount = this.historyData.length;
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
    this.historyUIManager.renderHistory(this.filteredHistoryData, this.totalMatchCount);
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

  private handleSearchStateChange(isSearchMode: boolean, filteredData: HistoryItem[], totalMatches?: number): void {
    // Only clear history selection when entering search mode or when items are filtered down (not when loading more)
    const isLoadingMore = filteredData.length > this.filteredHistoryData.length;
    const shouldClearSelection = !isSearchMode || (filteredData.length !== this.filteredHistoryData.length && !isLoadingMore);

    if (isSearchMode) {
      // In search mode: use filtered data from search manager
      this.filteredHistoryData = filteredData;
      this.totalMatchCount = totalMatches;
    } else {
      // Not in search mode: apply non-search display limit
      this.nonSearchDisplayLimit = DEFAULT_DISPLAY_LIMIT;
      this.filteredHistoryData = this.historyData.slice(0, this.nonSearchDisplayLimit);
      this.totalMatchCount = this.historyData.length;
    }
    this.renderHistory();

    if (shouldClearSelection) {
      this.historyUIManager.clearHistorySelection();
    }

    if (!isSearchMode) {
      // Return focus to main textarea when exiting search
      this.searchManager?.focusMainTextarea();
    }
  }

  private handleLoadMore(): void {
    if (this.searchManager?.isInSearchMode()) {
      this.searchManager.loadMore();
    } else {
      // Non-search mode: load more items from historyData
      if (this.filteredHistoryData.length >= this.historyData.length) {
        // Already showing all items
        return;
      }
      this.nonSearchDisplayLimit += DEFAULT_DISPLAY_LIMIT;
      this.filteredHistoryData = this.historyData.slice(0, this.nonSearchDisplayLimit);
      this.renderHistory();
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