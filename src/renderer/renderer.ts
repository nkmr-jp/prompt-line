// Import types and dependencies
import type {
  HistoryItem,
  WindowData,
  Config,
  PasteResult,
  UserSettings,
  DirectoryInfo
} from './types';
import { EventHandler } from './event-handler';
import { HistorySearchManager } from './history-search';
import { SlashCommandManager } from './slash-command-manager';
import { DomManager } from './dom-manager';
import { DraftManager } from './draft-manager';
import { HistoryUIManager } from './history-ui-manager';
import { LifecycleManager } from './lifecycle-manager';
import { SimpleSnapshotManager } from './snapshot-manager';
import { FileSearchManager } from './file-search-manager';
import { DirectoryDataHandler } from './directory-data-handler';
import {
  getElectronAPI,
  DEFAULT_DISPLAY_LIMIT,
  handleImagePaste,
  setupTextareaInputListener,
  setupContextMenuPrevention,
  setupKeypressListener,
  setupMouseListeners,
  calculateFilteredHistory,
  shouldClearHistorySelection,
  handleNonSearchLoadMore,
  createEventHandlerConfig,
  createSearchManagerConfig,
  createSlashCommandConfig,
  createFileSearchConfig,
  handleUndoWithSnapshot,
  handleWindowHide,
  handleTabKey,
  handleShiftTabKey,
  clearTextAndDraft as clearTextAndDraftHelper,
  updateHistoryAndSettingsData
} from './renderer-helpers';

// Secure electronAPI access via preload script
const electronAPI = getElectronAPI();

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
  private fileSearchManager: FileSearchManager | null = null;
  private directoryDataHandler: DirectoryDataHandler;
  private domManager: DomManager;
  private draftManager: DraftManager;
  private historyUIManager: HistoryUIManager;
  private lifecycleManager: LifecycleManager;
  private snapshotManager: SimpleSnapshotManager;
  private defaultHintText: string = 'Multi-line text and Image supported'; // Default hint text

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
      () => this.domManager.selectAll()
    );
    this.directoryDataHandler = new DirectoryDataHandler({
      updateHintText: (text: string) => this.domManager.updateHintText(text),
      setDraggable: (enabled: boolean) => this.domManager.setDraggable(enabled),
      getFileSearchManager: () => this.fileSearchManager,
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
      this.setupFileSearchManager();
      // Code search is now integrated into FileSearchManager
      // await this.setupCodeSearchManager();
      this.setupEventListeners();
      // Note: setupIPCListeners() is now called in constructor to prevent race condition
    } catch (error) {
      console.error('Failed to initialize renderer:', error);
    }
  }

  private setupEventHandler(): void {
    this.eventHandler = new EventHandler(createEventHandlerConfig({
      onTextPaste: this.handleTextPasteCallback.bind(this),
      onWindowHide: this.handleWindowHideCallback.bind(this),
      onTabKeyInsert: this.handleTabKeyCallback.bind(this),
      onShiftTabKeyPress: this.handleShiftTabKeyCallback.bind(this),
      onHistoryNavigation: this.navigateHistory.bind(this),
      onSearchToggle: this.handleSearchToggle.bind(this),
      onUndo: this.handleUndo.bind(this)
    }));

    this.eventHandler.setTextarea(this.domManager.textarea);
    this.eventHandler.setDomManager(this.domManager);
    this.eventHandler.setupEventListeners();
  }

  private setupSearchManager(): void {
    this.searchManager = new HistorySearchManager(
      createSearchManagerConfig(this.handleSearchStateChange.bind(this))
    );

    this.searchManager.initializeElements();
    this.searchManager.setupEventListeners();
    this.historyUIManager.setupScrollListener();

    if (this.eventHandler) {
      this.eventHandler.setSearchManager(this.searchManager);
    }
  }

  private setupSlashCommandManager(): void {
    this.slashCommandManager = new SlashCommandManager(createSlashCommandConfig({
      onCommandSelect: (command: string) => this.handleTextPasteCallback(command),
      onCommandInsert: (_command: string) => {
        // Command already inserted by SlashCommandManager
      },
      onBeforeOpenFile: () => {
        this.eventHandler?.setSuppressBlurHide(true);
      },
      setDraggable: (enabled: boolean) => {
        this.domManager.setDraggable(enabled);
      }
    }));

    this.slashCommandManager.initializeElements();
    this.slashCommandManager.setupEventListeners();

    if (this.eventHandler) {
      this.eventHandler.setSlashCommandManager(this.slashCommandManager);
    }

    this.slashCommandManager.loadCommands();
  }

  private setupFileSearchManager(): void {
    this.fileSearchManager = new FileSearchManager(createFileSearchConfig({
      onFileSelected: (_filePath: string) => {
        this.draftManager.saveDraftDebounced();
      },
      getTextContent: () => this.domManager.getCurrentText(),
      setTextContent: (text: string) => this.domManager.setText(text),
      getCursorPosition: () => this.domManager.getCursorPosition(),
      setCursorPosition: (position: number) => this.domManager.setCursorPosition(position),
      onBeforeOpenFile: () => {
        this.eventHandler?.setSuppressBlurHide(true);
      },
      updateHintText: (text: string) => {
        this.domManager.updateHintText(text);
      },
      getDefaultHintText: () => this.defaultHintText,
      setDraggable: (enabled: boolean) => {
        this.domManager.setDraggable(enabled);
      },
      replaceRangeWithUndo: (start: number, end: number, newText: string) => {
        this.domManager.replaceRangeWithUndo(start, end, newText);
      },
      getIsComposing: () => this.eventHandler?.getIsComposing() ?? false
    }));

    this.fileSearchManager.initializeElements();
    this.fileSearchManager.setupEventListeners();

    if (this.eventHandler) {
      this.eventHandler.setFileSearchManager(this.fileSearchManager);
    }
  }

  private setupEventListeners(): void {
    if (!this.domManager.textarea) return;

    setupTextareaInputListener(
      this.domManager.textarea,
      () => this.domManager.updateCharCount(),
      () => this.draftManager.saveDraftDebounced(),
      () => this.historyUIManager.clearHistorySelection(),
      this.snapshotManager
    );

    this.domManager.textarea.addEventListener('keydown', (e) => {
      this.handleKeyDown(e);
    });

    setupContextMenuPrevention();
    setupKeypressListener(this.domManager.textarea);
    setupMouseListeners(() => this.historyUIManager.clearHistorySelection());

    // Search navigation in search input
    this.setupSearchInputNavigation();
  }

  private setupSearchInputNavigation(): void {
    if (this.domManager.searchInput) {
      this.domManager.searchInput.addEventListener('keydown', (e) => {
        if (this.eventHandler && this.userSettings?.shortcuts) {
          const handled = this.eventHandler.handleHistoryNavigationShortcuts(e, (direction) => {
            this.navigateHistory(e, direction);
          });
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
        const textBeforePaste = this.domManager.getCurrentText();
        const cursorPosition = this.domManager.textarea.selectionStart;

        setTimeout(async () => {
          await handleImagePaste(
            textBeforePaste,
            cursorPosition,
            (text) => this.domManager.setText(text),
            (pos) => this.domManager.setCursorPosition(pos),
            (text) => this.domManager.insertTextAtCursor(text),
            () => this.draftManager.saveDraftDebounced()
          );
        }, 0);
        return;
      }

      // Skip shortcuts if IME is active
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
    return handleUndoWithSnapshot(
      this.snapshotManager,
      (text) => this.domManager.setText(text),
      (pos) => this.domManager.setCursorPosition(pos),
      () => this.domManager.focusTextarea()
    );
  }

  private async handleWindowHideCallback(): Promise<void> {
    await handleWindowHide(() => this.draftManager.saveDraftImmediate());
  }

  private handleTabKeyCallback(e: KeyboardEvent): void {
    handleTabKey(
      e,
      (text) => this.domManager.insertTextAtCursor(text),
      () => this.draftManager.saveDraftDebounced()
    );
  }

  private handleShiftTabKeyCallback(e: KeyboardEvent): void {
    handleShiftTabKey(
      e,
      () => this.domManager.outdentAtCursor(),
      () => this.draftManager.saveDraftDebounced()
    );
  }

  private async clearTextAndDraft(): Promise<void> {
    await clearTextAndDraftHelper(
      () => this.domManager.clearText(),
      () => this.draftManager.clearDraft(),
      this.fileSearchManager
    );
  }

  private async handleWindowShown(data: WindowData): Promise<void> {
    await this.directoryDataHandler.handleWindowShown(data);
  }

  private async handleDirectoryDataUpdated(data: DirectoryInfo): Promise<void> {
    await this.directoryDataHandler.handleDirectoryDataUpdated(data);
  }

  private updateHistoryAndSettings(data: WindowData): void {
    const result = updateHistoryAndSettingsData(
      data,
      this.searchManager,
      this.eventHandler
    );

    this.historyData = result.historyData;
    this.nonSearchDisplayLimit = DEFAULT_DISPLAY_LIMIT;
    this.filteredHistoryData = result.filteredHistoryData;
    this.totalMatchCount = result.totalMatchCount;
    if (result.userSettings) {
      this.userSettings = result.userSettings;
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
    const shouldClear = shouldClearHistorySelection(isSearchMode, filteredData, this.filteredHistoryData);

    const result = calculateFilteredHistory(
      isSearchMode,
      filteredData,
      this.historyData,
      this.nonSearchDisplayLimit
    );

    if (isSearchMode) {
      this.filteredHistoryData = filteredData;
      this.totalMatchCount = totalMatches;
    } else {
      this.nonSearchDisplayLimit = DEFAULT_DISPLAY_LIMIT;
      this.filteredHistoryData = result.filtered;
      this.totalMatchCount = result.total;
    }

    this.renderHistory();

    if (shouldClear) {
      this.historyUIManager.clearHistorySelection();
    }

    if (!isSearchMode) {
      this.searchManager?.focusMainTextarea();
    }
  }

  private handleLoadMore(): void {
    if (this.searchManager?.isInSearchMode()) {
      this.searchManager.loadMore();
    } else {
      const result = handleNonSearchLoadMore(
        this.nonSearchDisplayLimit,
        this.historyData,
        this.filteredHistoryData
      );
      if (result) {
        this.nonSearchDisplayLimit = result.newLimit;
        this.filteredHistoryData = result.newFiltered;
        this.renderHistory();
      }
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