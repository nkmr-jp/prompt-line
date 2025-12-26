/**
 * File Search Manager for renderer process
 * Manages @ file mention functionality with incremental search
 */

import type { FileInfo, DirectoryInfo, AgentItem } from '../types';
import type { SymbolResult, LanguageInfo } from './code-search/types';
import type { DirectoryData, FileSearchCallbacks, SuggestionItem } from './file-search';
import type { IInitializable } from './interfaces/initializable';
import { handleError } from './utils/error-handler';
import {
  formatLog,
  normalizePath,
  parsePathWithLineInfo,
  resolveAtPathToAbsolute
} from './file-search';
import {
  PopupManager,
  SettingsCacheManager,
  HighlightManager,
  CodeSearchManager,
  FileOpenerEventHandler,
  DirectoryCacheManager,
  FileFilterManager,
  PathManager,
  NavigationManager,
  EventListenerManager,
  QueryExtractionManager,
  SuggestionUIManager,
  FileSearchState
} from './file-search/managers';

export class FileSearchManager implements IInitializable {
  // Centralized state container
  private readonly state = new FileSearchState();
  private callbacks: FileSearchCallbacks;


  // PopupManager for frontmatter popup
  private popupManager: PopupManager;

  // SettingsCacheManager for settings caching
  private settingsCacheManager: SettingsCacheManager;

  // New modular managers (initialized in initializeElements after DOM is ready)
  private highlightManager: HighlightManager | null = null;
  private suggestionUIManager: SuggestionUIManager | null = null;
  private codeSearchManager: CodeSearchManager | null = null;
  private fileOpenerManager: FileOpenerEventHandler | null = null;
  private directoryCacheManager: DirectoryCacheManager | null = null;
  private fileFilterManager: FileFilterManager;
  private pathManager: PathManager;
  private navigationManager: NavigationManager;
  private eventListenerManager: EventListenerManager;
  private queryExtractionManager: QueryExtractionManager;

  // Symbol mode properties (delegated to CodeSearchManager)
  private get isInSymbolMode(): boolean {
    return this.codeSearchManager?.isInSymbolModeActive() || false;
  }
  private set isInSymbolMode(value: boolean) {
    this.codeSearchManager?.setInSymbolMode(value);
  }
  private get currentFilePath(): string {
    return this.codeSearchManager?.getCurrentFilePath() || '';
  }
  private set currentFilePath(value: string) {
    this.codeSearchManager?.setCurrentFilePath(value);
  }
  private get currentFileSymbols(): SymbolResult[] {
    return this.codeSearchManager?.getCurrentFileSymbols() || [];
  }
  private set currentFileSymbols(value: SymbolResult[]) {
    this.codeSearchManager?.setCurrentFileSymbols(value);
  }

  constructor(callbacks: FileSearchCallbacks) {
    this.callbacks = callbacks;

    // Initialize PopupManager with callbacks
    this.popupManager = new PopupManager({
      getSelectedSuggestion: () => this.state.mergedSuggestions[this.state.selectedIndex] || null,
      getSuggestionsContainer: () => this.state.suggestionsContainer
    });

    // Initialize SettingsCacheManager
    this.settingsCacheManager = new SettingsCacheManager();

    // Initialize FileFilterManager
    this.fileFilterManager = new FileFilterManager({
      getDefaultMaxSuggestions: () => this.settingsCacheManager.getDefaultMaxSuggestions()
    });

    // Initialize PathManager (unified path management)
    this.pathManager = new PathManager({
      getTextContent: () => this.callbacks.getTextContent(),
      setTextContent: (text: string) => this.callbacks.setTextContent(text),
      getCursorPosition: () => this.callbacks.getCursorPosition(),
      setCursorPosition: (pos: number) => this.callbacks.setCursorPosition(pos),
      replaceRangeWithUndo: this.callbacks.replaceRangeWithUndo,
      updateHighlightBackdrop: () => this.updateHighlightBackdrop(),
      getCachedDirectoryData: () => this.directoryCacheManager?.getCachedData() ?? null,
      isCommandEnabledSync: () => this.isCommandEnabledSync(),
      checkFileExists: async (path: string) => {
        const baseDir = this.directoryCacheManager?.getDirectory();
        if (!baseDir) return false;
        const absolutePath = resolveAtPathToAbsolute(path, baseDir, parsePathWithLineInfo, normalizePath);
        if (!absolutePath) return false;
        try {
          return await window.electronAPI?.file?.checkExists(absolutePath) || false;
        } catch {
          return false;
        }
      }
    });

    // Initialize NavigationManager (consolidated keyboard + directory/file navigation + item selection)
    this.navigationManager = new NavigationManager({
      // State getters
      getIsVisible: () => this.state.isVisible,
      getSelectedIndex: () => this.state.selectedIndex,
      getTotalItemCount: () => this.getTotalItemCount(),
      getMergedSuggestions: () => this.state.mergedSuggestions,
      getCachedDirectoryData: () => this.directoryCacheManager?.getCachedData() ?? null,
      getIsInSymbolMode: () => this.isInSymbolMode,
      getCurrentQuery: () => this.state.currentQuery,
      getIsComposing: this.callbacks.getIsComposing,
      getCurrentPath: () => this.state.currentPath,
      getCodeSearchManager: () => this.codeSearchManager,
      // State setters
      setSelectedIndex: (index: number) => { this.state.selectedIndex = index; },
      setCurrentPath: (path: string) => { this.state.currentPath = path; },
      setCurrentQuery: (query: string) => { this.state.currentQuery = query; },
      setFilteredFiles: (files: FileInfo[]) => { this.state.filteredFiles = files; },
      setFilteredAgents: (agents: never[]) => { this.state.filteredAgents = agents; },
      setMergedSuggestions: (suggestions: SuggestionItem[]) => { this.state.mergedSuggestions = suggestions; },
      setIsInSymbolMode: (value: boolean) => { this.isInSymbolMode = value; },
      setCurrentFilePath: (path: string) => { this.currentFilePath = path; },
      setCurrentFileSymbols: (symbols: SymbolResult[]) => { this.currentFileSymbols = symbols; },
      // Actions
      updateSelection: () => this.updateSelection(),
      hideSuggestions: () => this.hideSuggestions(),
      insertFilePath: (path: string) => this.insertFilePath(path),
      insertFilePathWithoutAt: (path: string) => this.insertFilePathWithoutAt(path),
      onFileSelected: (path: string) => this.callbacks.onFileSelected(path),
      exitSymbolMode: () => this.exitSymbolMode(),
      removeAtQueryText: () => this.removeAtQueryText(),
      openFileAndRestoreFocus: async (filePath: string) => {
        await this.fileOpenerManager?.openFile(filePath);
      },
      toggleAutoShowTooltip: () => this.popupManager.toggleAutoShowTooltip(),
      expandCurrentFile: () => this.expandCurrentFile(),
      // Directory/File navigation helpers
      updateTextInputWithPath: (path: string) => this.updateTextInputWithPath(path),
      filterFiles: (query: string) => this.filterFiles(query),
      mergeSuggestions: (query: string) => this.mergeSuggestions(query),
      updateSuggestionList: (suggestions: SuggestionItem[], showPath: boolean, selectedIndex: number) =>
        this.suggestionUIManager?.update(suggestions, showPath, selectedIndex),
      showTooltipForSelectedItem: () => this.popupManager.showTooltipForSelectedItem(),
      showSymbolSuggestions: (query: string) => this.showSymbolSuggestions(query),
      // Item selection helpers
      getTextInput: () => this.state.textInput,
      getAtStartPosition: () => this.state.atStartPosition,
      getLanguageForFile: (fileName: string) => this.getLanguageForFile(fileName),
      isCodeSearchAvailable: () => this.codeSearchManager?.isAvailableSync() || false,
      replaceRangeWithUndo: this.callbacks.replaceRangeWithUndo
        ? (start: number, end: number, text: string) => this.callbacks.replaceRangeWithUndo!(start, end, text)
        : undefined,
      addSelectedPath: (path: string) => {
        this.state.selectedPaths.add(path);
        this.highlightManager?.addSelectedPath(path);
      },
      updateHighlightBackdrop: () => this.updateHighlightBackdrop(),
      resetCodeSearchState: () => {
        this.state.codeSearchQuery = '';
        this.state.codeSearchLanguage = '';
        this.state.codeSearchCacheRefreshed = false;
      }
    });

    // Initialize EventListenerManager
    this.eventListenerManager = new EventListenerManager({
      checkForFileSearch: () => this.checkForFileSearch(),
      updateHighlightBackdrop: () => this.updateHighlightBackdrop(),
      updateCursorPositionHighlight: () => this.updateCursorPositionHighlight(),
      handleKeyDown: (e: KeyboardEvent) => this.handleKeyDown(e),
      handleBackspaceForAtPath: (e: KeyboardEvent) => this.handleBackspaceForAtPath(e),
      handleCtrlEnterOpenFile: (e: KeyboardEvent) => this.fileOpenerManager?.handleCtrlEnter(e),
      handleCmdClickOnAtPath: (e: MouseEvent) => this.fileOpenerManager?.handleCmdClick(e),
      handleMouseMove: (e: MouseEvent) => this.handleMouseMove(e),
      isVisible: () => this.state.isVisible,
      hideSuggestions: () => this.hideSuggestions(),
      syncBackdropScroll: () => this.syncBackdropScroll(),
      clearFilePathHighlight: () => this.highlightManager?.clearFilePathHighlight() ?? undefined,
      onCmdKeyDown: () => this.highlightManager?.onCmdKeyDown() ?? undefined,
      onCmdKeyUp: () => this.highlightManager?.onCmdKeyUp() ?? undefined,
      onMouseMove: (e: MouseEvent) => this.highlightManager?.onMouseMove(e) ?? undefined
    });

    // Initialize QueryExtractionManager
    this.queryExtractionManager = new QueryExtractionManager({
      getTextContent: () => this.callbacks.getTextContent(),
      getCursorPosition: () => this.callbacks.getCursorPosition()
    });

  }

  /**
   * Set whether file search is enabled
   */
  public setFileSearchEnabled(enabled: boolean): void {
    const previousValue = this.state.fileSearchEnabled;
    this.state.fileSearchEnabled = enabled;
    console.debug('[FileSearchManager] setFileSearchEnabled:', {
      enabled,
      previousValue,
      hasCodeSearchManager: !!this.codeSearchManager,
      hasDirectoryCacheManager: !!this.directoryCacheManager
    });
  }

  /**
   * Check if file search is enabled
   */
  public isFileSearchEnabled(): boolean {
    return this.state.fileSearchEnabled;
  }


  // ============================================
  // Directory Cache Shortcut Methods
  // ============================================

  /**
   * Get cached directory data (shortcut for directoryCacheManager?.getCachedData() ?? null)
   */
  private getCachedData(): DirectoryData | null {
    return this.directoryCacheManager?.getCachedData() ?? null;
  }

  /**
   * Get current directory path (shortcut for directoryCacheManager?.getDirectory() ?? null)
   */
  private getDirectory(): string | null {
    return this.directoryCacheManager?.getDirectory() ?? null;
  }

  /**
   * Check if cache has data
   */
  private hasCache(): boolean {
    return this.directoryCacheManager?.hasCache() ?? false;
  }

  /**
   * Get cached files
   */
  private getCachedFiles(): FileInfo[] {
    return this.directoryCacheManager?.getFiles() ?? [];
  }

  /**
   * Get maxSuggestions for a given type (cached)
   * Delegates to SettingsCacheManager
   */
  private async getMaxSuggestions(type: 'command' | 'mention'): Promise<number> {
    return this.settingsCacheManager.getMaxSuggestions(type);
  }

  /**
   * Get maxSuggestions for file search (cached)
   * Delegates to SettingsCacheManager
   */
  private async _getFileSearchMaxSuggestions(): Promise<number> {
    return this.settingsCacheManager.getFileSearchMaxSuggestions();
  }

  /**
   * Check if query matches any searchPrefix for the given type
   * Delegates to SettingsCacheManager
   */
  private async matchesSearchPrefix(query: string, type: 'command' | 'mention'): Promise<boolean> {
    return this.settingsCacheManager.matchesSearchPrefix(query, type);
  }

  /**
   * Synchronously check if command type is enabled (from cache)
   * Delegates to SettingsCacheManager
   */
  private isCommandEnabledSync(): boolean {
    return this.settingsCacheManager.isCommandEnabledSync();
  }

  /**
   * Synchronously check if query matches any searchPrefix for the given type (from cache)
   * Delegates to SettingsCacheManager
   */
  private matchesSearchPrefixSync(query: string, type: 'command' | 'mention'): boolean {
    return this.settingsCacheManager.matchesSearchPrefixSync(query, type);
  }

  /**
   * Preload searchPrefixes cache for command and mention types
   * Delegates to SettingsCacheManager
   */
  public async preloadSearchPrefixesCache(): Promise<void> {
    return this.settingsCacheManager.preloadSearchPrefixesCache();
  }

  /**
   * マネージャーを初期化する（IInitializable実装）
   * - DOM要素の取得
   * - イベントリスナーの設定
   */
  public initialize(): void {
    this.initializeElements();
    this.setupEventListeners();
  }

  public initializeElements(): void {
    this.state.textInput = document.getElementById('textInput') as HTMLTextAreaElement;
    this.state.highlightBackdrop = document.getElementById('highlightBackdrop') as HTMLDivElement;
    console.debug('[FileSearchManager] initializeElements: textInput found:', !!this.state.textInput, 'highlightBackdrop found:', !!this.state.highlightBackdrop);

    // Create suggestions container if it doesn't exist
    this.state.suggestionsContainer = document.getElementById('fileSuggestions');
    if (!this.state.suggestionsContainer) {
      this.state.suggestionsContainer = document.createElement('div');
      this.state.suggestionsContainer.id = 'fileSuggestions';
      this.state.suggestionsContainer.className = 'file-suggestions';
      this.state.suggestionsContainer.setAttribute('role', 'listbox');
      this.state.suggestionsContainer.setAttribute('aria-label', 'File suggestions');

      // Insert into main-content (allows suggestions to span across input-section and history-section)
      const mainContent = document.querySelector('.main-content');
      if (mainContent) {
        mainContent.appendChild(this.state.suggestionsContainer);
        console.debug('[FileSearchManager] initializeElements: suggestionsContainer created and appended to main-content');
      } else {
        console.warn('[FileSearchManager] initializeElements: .main-content not found!');
      }
    } else {
      console.debug('[FileSearchManager] initializeElements: suggestionsContainer already exists');
    }

    // Initialize popup manager
    this.popupManager.initialize();

    // Initialize CodeSearchManager (replaces inline code search initialization)
    // Note: Some callbacks reference other managers that are initialized later,
    // so we use arrow functions to defer the access.
    this.codeSearchManager = new CodeSearchManager({
      updateHintText: (text: string) => this.callbacks.updateHintText?.(text),
      getDefaultHintText: () => this.callbacks.getDefaultHintText?.() || '',
      getCachedDirectoryData: () => this.directoryCacheManager?.getCachedData() ?? null,
      getAtStartPosition: () => this.state.atStartPosition,
      hideSuggestions: () => this.hideSuggestions(),
      // State setters
      setFilteredSymbols: (symbols: SymbolResult[]) => { this.state.filteredSymbols = symbols; },
      setFilteredFiles: (files: never[]) => { this.state.filteredFiles = files; },
      setFilteredAgents: (agents: never[]) => { this.state.filteredAgents = agents; },
      setMergedSuggestions: (suggestions: SuggestionItem[]) => { this.state.mergedSuggestions = suggestions; },
      getMergedSuggestions: () => this.state.mergedSuggestions,
      setSelectedIndex: (index: number) => { this.state.selectedIndex = index; },
      getSelectedIndex: () => this.state.selectedIndex,
      setIsVisible: (visible: boolean) => { this.state.isVisible = visible; },
      // UI dependencies
      getSuggestionsContainer: () => this.state.suggestionsContainer,
      getCurrentFileSymbols: () => this.currentFileSymbols,
      getCurrentFilePath: () => this.currentFilePath,
      updateSelection: () => this.updateSelection(),
      selectSymbol: (symbol: SymbolResult) => this._selectSymbol(symbol),
      positionPopup: (atStartPos: number) => this.suggestionUIManager?.position(atStartPos),
      getFileSearchMaxSuggestions: () => this._getFileSearchMaxSuggestions(),
      showSuggestions: (query: string) => this.showSuggestions(query),
      insertFilePath: (path: string) => this.insertFilePath(path),
      onFileSelected: (path: string) => this.callbacks.onFileSelected(path),
      setCurrentQuery: (query: string) => { this.state.currentQuery = query; },
      getCurrentPath: () => this.state.currentPath,
      showTooltipForSelectedItem: () => this.popupManager.showTooltipForSelectedItem(),
      renderSuggestions: (suggestions: SuggestionItem[]) => this.suggestionUIManager?.update(suggestions, false)
    });

    // Initialize DirectoryCacheManager
    this.directoryCacheManager = new DirectoryCacheManager({
      onIndexingStatusChange: (isBuilding: boolean, hint?: string) => {
        if (isBuilding && hint) {
          this.callbacks.updateHintText?.(hint);
        }
      },
      onCacheUpdated: () => {
        // Refresh suggestions if visible and not actively searching
        if (this.state.isVisible && !this.state.currentQuery) {
          this.refreshSuggestions();
        }
      },
      updateHintText: (text: string) => this.callbacks.updateHintText?.(text)
    });

    // Initialize HighlightManager (requires textInput, highlightBackdrop, and pathManager)
    if (this.state.textInput && this.state.highlightBackdrop) {
      this.highlightManager = new HighlightManager(
        this.state.textInput,
        this.state.highlightBackdrop,
        {
          getTextContent: () => this.state.textInput?.value || '',
          getCursorPosition: () => this.state.textInput?.selectionStart || 0,
          updateHintText: (text: string) => this.callbacks.updateHintText?.(text),
          getDefaultHintText: () => this.callbacks.getDefaultHintText?.() || '',
          isFileSearchEnabled: () => this.state.fileSearchEnabled,
          isCommandEnabledSync: () => this.isCommandEnabledSync(),
          checkFileExists: async (path: string) => {
            try {
              return await window.electronAPI.file.checkExists(path);
            } catch {
              return false;
            }
          }
        },
        this.pathManager  // Pass PathManager for unified path management
      );
      // Set up valid paths builder for @path validation
      this.highlightManager.setValidPathsBuilder(() => this.buildValidPathsSet());
    }

    // Initialize FileOpenerEventHandler
    this.fileOpenerManager = new FileOpenerEventHandler({
      onBeforeOpenFile: () => {
        // Cleanup before opening file
        this.hideSuggestions();
      },
      setDraggable: (enabled: boolean) => {
        this.callbacks.setDraggable?.(enabled);
      },
      getTextContent: () => this.state.textInput?.value || '',
      setTextContent: (text: string) => {
        if (this.state.textInput) {
          this.state.textInput.value = text;
        }
      },
      getCursorPosition: () => this.state.textInput?.selectionStart || 0,
      setCursorPosition: (position: number) => {
        if (this.state.textInput) {
          this.state.textInput.selectionStart = position;
          this.state.textInput.selectionEnd = position;
        }
      },
      getCurrentDirectory: () => this.directoryCacheManager?.getDirectory() ?? null,
      isCommandEnabledSync: () => this.isCommandEnabledSync(),
      hideWindow: () => {
        window.electronAPI.window.hide();
      },
      restoreDefaultHint: () => this.restoreDefaultHint()
    });

    // Initialize SuggestionUIManager (consolidated from SuggestionListManager and SuggestionStateManager)
    if (this.state.textInput) {
      this.suggestionUIManager = new SuggestionUIManager(
        this.state.textInput,
        {
          // Selection and navigation
          onItemSelected: (index: number) => this.selectItem(index),
          onNavigateIntoDirectory: (file: FileInfo) => this.navigateIntoDirectory(file),
          onEscape: () => this.hideSuggestions(),
          onOpenFileInEditor: async (filePath: string) => {
            await window.electronAPI.file.openInEditor(filePath);
          },
          // Input state
          getIsComposing: () => this.callbacks.getIsComposing?.() || false,
          // Display context
          getCurrentPath: () => this.state.currentPath,
          getBaseDir: () => this.directoryCacheManager?.getDirectory() ?? '',
          getCurrentQuery: () => this.state.currentQuery,
          getCodeSearchQuery: () => this.state.codeSearchQuery,
          countFilesInDirectory: (path: string) => this.countFilesInDirectory(path),
          // Popup interactions
          onMouseEnterInfo: (suggestion: SuggestionItem, target: HTMLElement) => {
            if (suggestion.type === 'agent' && suggestion.agent) {
              this.popupManager.showFrontmatterPopup(suggestion.agent, target);
            }
          },
          onMouseLeaveInfo: () => {
            this.popupManager.hideFrontmatterPopup();
          },
          // State management (from SuggestionStateManager)
          getCachedDirectoryData: () => this.directoryCacheManager?.getCachedData() ?? null,
          getAtStartPosition: () => this.state.atStartPosition,
          adjustCurrentPathToQuery: (query: string) => this.adjustCurrentPathToQuery(query),
          filterFiles: (query: string) => this.filterFiles(query),
          mergeSuggestions: (query: string, maxSuggestions?: number) => this.mergeSuggestions(query, maxSuggestions),
          searchAgents: (query: string) => this.searchAgents(query),
          isIndexBeingBuilt: () => this.isIndexBeingBuilt(),
          showIndexingHint: () => this.showIndexingHint(),
          restoreDefaultHint: () => this.restoreDefaultHint(),
          matchesSearchPrefix: (query: string, type: 'command' | 'mention') => this.matchesSearchPrefix(query, type),
          getMaxSuggestions: (type: 'command' | 'mention') => this.getMaxSuggestions(type),
          showTooltipForSelectedItem: () => this.popupManager.showTooltipForSelectedItem(),
          // State setters
          setCurrentPath: (path: string) => { this.state.currentPath = path; },
          setCurrentQuery: (query: string) => { this.state.currentQuery = query; },
          setFilteredFiles: (files: FileInfo[]) => { this.state.filteredFiles = files; },
          setFilteredAgents: (agents: AgentItem[]) => { this.state.filteredAgents = agents; },
          setMergedSuggestions: (suggestions: SuggestionItem[]) => { this.state.mergedSuggestions = suggestions; },
          setSelectedIndex: (index: number) => { this.state.selectedIndex = index; },
          setIsVisible: (visible: boolean) => { this.state.isVisible = visible; }
        }
      );
    }

    // CodeSearchManager is initialized in initializeElements, no separate init needed
  }

  /**
   * Handle cached directory data from window-shown event
   * This enables instant file search when window opens
   */
  public handleCachedDirectoryData(data: DirectoryInfo | undefined): void {
    console.debug('[FileSearchManager] handleCachedDirectoryData:', {
      hasData: !!data,
      directory: data?.directory,
      fileCount: data?.files?.length,
      fromDraft: data?.fromDraft,
      fromCache: data?.fromCache,
      hasDirectoryCacheManager: !!this.directoryCacheManager
    });
    // Delegate to DirectoryCacheManager
    // The manager will notify via onCacheUpdated callback to sync local copy
    this.directoryCacheManager?.handleCachedDirectoryData(data);

    // Load registered at-paths for this directory (supports symbols with spaces)
    if (data?.directory) {
      this.loadRegisteredAtPaths(data.directory);
    }

    // Log cached data after update
    setTimeout(() => {
      console.debug('[FileSearchManager] after handleCachedDirectoryData:', {
        hasCachedData: this.hasCache(),
        cachedDirectory: this.getDirectory()
      });
    }, 100);
  }

  /**
   * Load registered at-paths from persistent cache
   * These paths may contain spaces (e.g., symbol names with spaces)
   */
  private async loadRegisteredAtPaths(directory: string): Promise<void> {
    try {
      if (!window.electronAPI?.atPathCache?.getPaths) {
        console.debug('[FileSearchManager] atPathCache API not available');
        return;
      }

      const paths = await window.electronAPI.atPathCache.getPaths(directory);
      if (paths && paths.length > 0) {
        this.highlightManager?.setRegisteredAtPaths(paths);
        console.debug('[FileSearchManager] Loaded registered at-paths:', {
          directory,
          count: paths.length
        });
      }
    } catch (error) {
      console.warn('[FileSearchManager] Failed to load registered at-paths:', error);
    }
  }

  public setupEventListeners(): void {
    if (!this.state.textInput) {
      console.warn('[FileSearchManager] setupEventListeners: textInput is null, skipping');
      return;
    }

    // Initialize EventListenerManager with DOM elements and delegate setup
    this.eventListenerManager.initialize(this.state.textInput, this.state.suggestionsContainer);
    this.eventListenerManager.setupEventListeners();
  }

  /**
   * Handle mouse move for Cmd+hover link style
   */
  private handleMouseMove(e: MouseEvent): void {
    // Delegate to HighlightManager
    this.highlightManager?.onMouseMove(e);
  }

  /**
   * Update cursor position highlight (called when cursor moves)
   * Only highlights absolute file paths and URLs, not @paths (which already have their own highlight)
   * Also updates hint text to show Ctrl+Enter shortcut when on a clickable path or URL
   */
  private updateCursorPositionHighlight(): void {
    // Delegate to HighlightManager
    this.highlightManager?.updateCursorPositionHighlight();
  }

  /**
   * Restore the default hint text (directory path)
   */
  private restoreDefaultHint(): void {
    if (this.callbacks.updateHintText && this.callbacks.getDefaultHintText) {
      this.callbacks.updateHintText(this.callbacks.getDefaultHintText());
    }
  }

  /**
   * Check if file index is being built
   * Returns true if directory data is not yet available or is from draft fallback with no files
   */
  private isIndexBeingBuilt(): boolean {
    // Delegate to DirectoryCacheManager
    return this.directoryCacheManager?.isIndexBeingBuilt() ?? true;
  }

  /**
   * Show hint that file index is being built
   */
  private showIndexingHint(): void {
    // Don't show "Building Index" if there's a more important hint (e.g., fd not installed)
    if (this.directoryCacheManager?.getHint()) {
      return;
    }
    if (this.callbacks.updateHintText) {
      this.callbacks.updateHintText('Building file index...');
    }
  }

  /**
   * Update cache with new data from directory-data-updated event (Stage 2 recursive data)
   * Handles both full updates (with files) and directory-only updates (for code search)
   */
  public updateCache(data: DirectoryInfo | DirectoryData): void {
    // Delegate to DirectoryCacheManager
    // The manager will notify via onCacheUpdated callback to sync local copy
    // and trigger refreshSuggestions if needed
    this.directoryCacheManager?.updateCache(data);
  }

  /**
   * Clear the cached directory data
   */
  public clearCache(): void {
    this.directoryCacheManager?.clearCache();
    this.hideSuggestions();
  }

  /**
   * Refresh suggestions with current cached data
   * Called when cache is updated in background
   */
  private refreshSuggestions(): void {
    if (!this.state.isVisible) return;

    // Re-filter with current query
    if (this.state.currentQuery) {
      this.filterFiles(this.state.currentQuery);
    }
    // Delegate rendering to SuggestionListManager (position remains unchanged)
    this.suggestionUIManager?.update(this.state.mergedSuggestions, false);
  }

  /**
   * Check if file search should be triggered based on cursor position
   */
  public checkForFileSearch(): void {
    if (!this.shouldProcessFileSearch()) {
      return;
    }

    const result = this.extractQueryAtCursor();
    console.debug('[FileSearchManager] extractQueryAtCursor result:', result ? formatLog(result as Record<string, unknown>) : 'null');

    if (!result) {
      this.hideSuggestions();
      return;
    }

    const { query, startPos } = result;

    // Try code search first
    if (this.tryCodeSearch(query, startPos)) {
      return;
    }

    // Normal file search
    this.handleFileSearch(query, startPos);
  }

  /**
   * Check if file search should be processed
   * @returns true if file search should proceed
   */
  private shouldProcessFileSearch(): boolean {
    console.debug('[FileSearchManager] shouldProcessFileSearch:', {
      fileSearchEnabled: this.state.fileSearchEnabled,
      hasTextInput: !!this.state.textInput,
      hasCachedData: this.hasCache(),
      hasDirectoryCacheManager: !!this.directoryCacheManager,
      cachedDirectory: this.getDirectory(),
      cachedFileCount: this.getCachedFiles().length
    });

    if (!this.state.fileSearchEnabled) {
      console.debug('[FileSearchManager] shouldProcessFileSearch: fileSearchEnabled is false');
      return false;
    }

    if (!this.state.textInput) {
      console.debug('[FileSearchManager] shouldProcessFileSearch: textInput is null');
      return false;
    }

    // For code search, we only need the directory (not the file list)
    // hasCache() returns true if directoryCacheManager has ANY cached data
    if (!this.hasCache()) {
      console.debug('[FileSearchManager] shouldProcessFileSearch: no cached data');
      return false;
    }

    return true;
  }

  /**
   * Try to handle query as code search
   * @returns true if handled as code search (whether successful or not)
   */
  private tryCodeSearch(query: string, startPos: number): boolean {
    const matchesSearchPrefix = this.matchesSearchPrefixSync(query, 'mention');
    const parsedCodeSearch = this.queryExtractionManager.parseCodeSearchQuery(query);

    console.debug('[FileSearchManager] tryCodeSearch: query=', query, 'parsedCodeSearch=', parsedCodeSearch, 'matchesSearchPrefix=', matchesSearchPrefix);

    if (!parsedCodeSearch || matchesSearchPrefix) {
      return false;
    }

    const { language, symbolQuery, symbolTypeFilter } = parsedCodeSearch;
    return this.handleCodeSearch(language, symbolQuery, symbolTypeFilter, query, startPos);
  }

  /**
   * Handle code search pattern
   * @returns true if handled (whether successful or not)
   */
  private handleCodeSearch(
    language: string,
    symbolQuery: string,
    symbolTypeFilter: string | null,
    query: string,
    startPos: number
  ): boolean {
    console.debug('[FileSearchManager] handleCodeSearch:', {
      language,
      symbolQuery,
      symbolTypeFilter,
      query,
      startPos,
      hasCodeSearchManager: !!this.codeSearchManager,
      hasDirectoryCacheManager: !!this.directoryCacheManager,
      hasCachedData: this.hasCache(),
      cachedDirectory: this.getDirectory()
    });

    if (!this.codeSearchManager) {
      console.error('[FileSearchManager] handleCodeSearch: codeSearchManager is null!');
      this.callbacks.updateHintText?.('Code search not available');
      return true;
    }

    const supportedLanguages = this.codeSearchManager.getSupportedLanguages();
    const rgAvailable = this.codeSearchManager.isAvailableSync();

    console.debug('[FileSearchManager] handleCodeSearch:', {
      rgAvailable,
      supportedLanguagesSize: supportedLanguages?.size,
      languageSupported: supportedLanguages?.has(language),
      allLanguages: Array.from(supportedLanguages?.keys() || []).join(',')
    });

    // Wait for code search initialization if needed
    if (!supportedLanguages || supportedLanguages.size === 0) {
      console.debug('[FileSearchManager] handleCodeSearch: waiting for code search initialization...');
      this.callbacks.updateHintText?.('Loading language support...');
      // IMPORTANT: Hide any existing suggestions (e.g., from previous file search)
      // to prevent stale file suggestions from showing during initialization wait
      this.hideSuggestions();
      this.codeSearchManager.isAvailable().then(() => {
        console.debug('[FileSearchManager] handleCodeSearch: initialization complete, retrying...');
        if (this.state.textInput && this.state.textInput.value.includes(`@${query}`)) {
          this.checkForFileSearch();
        }
      });
      return true;
    }

    // Execute code search if language is supported
    if (rgAvailable && supportedLanguages.has(language)) {
      console.debug('[FileSearchManager] handleCodeSearch: executing code search for', language);
      this.state.atStartPosition = startPos;
      this.state.currentQuery = query;
      this.state.codeSearchQuery = symbolQuery;

      const shouldRefresh = !this.state.codeSearchCacheRefreshed || this.state.codeSearchLanguage !== language;
      this.state.codeSearchLanguage = language;
      if (shouldRefresh) {
        this.state.codeSearchCacheRefreshed = true;
        console.debug('[FileSearchManager] handleCodeSearch: triggering cache refresh for language:', language);
      }

      // IMPORTANT: Hide any existing file suggestions BEFORE starting async code search.
      // Without this, old file suggestions from typing @ts (before the :) would remain
      // visible while the async symbol search is running.
      // Note: We only hide the UI container, not reset the state, because we need
      // atStartPosition for positioning the symbol suggestions when they arrive.
      this.hideUIContainer();
      this.searchSymbols(language, symbolQuery, symbolTypeFilter, shouldRefresh);
      return true;
    }

    // Unknown language or rg not available
    console.debug('[FileSearchManager] handleCodeSearch: code search not available', {
      rgAvailable,
      languageSupported: supportedLanguages.has(language)
    });

    if (!rgAvailable) {
      this.callbacks.updateHintText?.('ripgrep (rg) not found. Install: brew install ripgrep');
    } else if (!supportedLanguages.has(language)) {
      this.callbacks.updateHintText?.(`Unknown language: ${language}`);
    }
    this.hideSuggestions();
    return true;
  }

  /**
   * Handle normal file search
   */
  private handleFileSearch(query: string, startPos: number): void {
    this.state.atStartPosition = startPos;
    this.state.currentQuery = query;
    console.debug('[FileSearchManager] handleFileSearch: showing suggestions for query:', query);
    this.showSuggestions(query);
  }

  /**
   * Extract the @ query at the current cursor position
   * Returns null if no valid @ pattern is found
   * Delegates to QueryExtractionManager
   */
  public extractQueryAtCursor(): { query: string; startPos: number } | null {
    return this.queryExtractionManager.extractQueryAtCursor();
  }

  /**
   * Search for symbols using ripgrep
   * Delegates to CodeSearchManager
   */
  private async searchSymbols(language: string, query: string, symbolTypeFilter: string | null = null, refreshCache: boolean = false): Promise<void> {
    await this.codeSearchManager?.searchSymbolsWithUI(language, query, symbolTypeFilter, refreshCache);
  }

  /**
   * Show file suggestions based on the query
   * Delegates to SuggestionUIManager for state management
   */
  public async showSuggestions(query: string): Promise<void> {
    console.debug('[FileSearchManager] showSuggestions called', formatLog({
      query,
      currentPath: this.state.currentPath,
      hasSuggestionsContainer: !!this.state.suggestionsContainer,
      hasCachedData: this.hasCache(),
      isInSymbolMode: this.isInSymbolMode
    }));

    if (!this.state.suggestionsContainer) {
      console.debug('[FileSearchManager] showSuggestions: early return - missing container');
      return;
    }

    // If in symbol mode, show filtered symbols instead of files
    if (this.isInSymbolMode) {
      this.state.currentQuery = query;
      await this.showSymbolSuggestions(query);
      return;
    }

    // Delegate to SuggestionStateManager
    await this.suggestionUIManager?.showSuggestions(query);
  }

  /**
   * Search agents via IPC
   */
  private async searchAgents(query: string): Promise<AgentItem[]> {
    try {
      const electronAPI = (window as unknown as { electronAPI?: { agents?: { get?: (query: string) => Promise<AgentItem[]> } } }).electronAPI;
      if (electronAPI?.agents?.get) {
        const agents = await electronAPI.agents.get(query);
        const maxSuggestions = await this.getMaxSuggestions('mention');
        return agents.slice(0, maxSuggestions);
      }
    } catch (error) {
      handleError('FileSearchManager.searchAgents', error);
    }
    return [];
  }

  /**
   * Adjust currentPath to match the query
   * Delegates to FileFilterManager
   */
  private adjustCurrentPathToQuery(query: string): void {
    const newPath = this.fileFilterManager.adjustCurrentPathToQuery(this.state.currentPath, query);
    if (newPath !== this.state.currentPath) {
      console.debug('[FileSearchManager] adjustCurrentPathToQuery: navigating', formatLog({
        from: this.state.currentPath,
        to: newPath,
        query
      }));
      this.state.currentPath = newPath;
    }
  }

  /**
   * Hide the suggestions dropdown
   */
  public hideSuggestions(): void {
    if (!this.state.suggestionsContainer) return;

    // Delegate UI hiding to managers
    this.suggestionUIManager?.hide();
    this.suggestionUIManager?.hideSuggestions();

    // Hide UI container
    this.hideUIContainer();

    // Reset all state
    this.resetFilterState();
    this.resetSearchState();
    this.resetSymbolModeState();

    // Hide frontmatter popup
    this.popupManager.hideFrontmatterPopup();
    this.popupManager.cancelPopupHide();
  }


  /**
   * Hide the UI container element
   */
  private hideUIContainer(): void {
    if (!this.state.suggestionsContainer) return;

    this.state.isVisible = false;
    this.state.suggestionsContainer.style.display = 'none';

    // Clear container safely
    while (this.state.suggestionsContainer.firstChild) {
      this.state.suggestionsContainer.removeChild(this.state.suggestionsContainer.firstChild);
    }
  }

  /**
   * Reset filter-related state
   */
  private resetFilterState(): void {
    this.state.filteredFiles = [];
    this.state.filteredAgents = [];
    this.state.filteredSymbols = [];
    this.state.mergedSuggestions = [];
  }

  /**
   * Reset search-related state (query, position, path, code search)
   */
  private resetSearchState(): void {
    this.state.currentQuery = '';
    this.state.atStartPosition = -1;
    this.state.currentPath = '';

    // Reset code search state
    this.state.codeSearchQuery = '';
    this.state.codeSearchLanguage = '';
    this.state.codeSearchCacheRefreshed = false;
  }

  /**
   * Reset symbol mode state
   */
  private resetSymbolModeState(): void {
    this.isInSymbolMode = false;
    this.currentFilePath = '';
    this.currentFileSymbols = [];
  }

  /**
   * Remove the @query text from the textarea without inserting a file path
   * Used when opening a file with Ctrl+Enter
   * Delegates to PathManager
   */
  private removeAtQueryText(): void {
    this.pathManager.removeAtQueryText(this.state.atStartPosition);
  }

  /**
   * Filter files based on query (fuzzy matching) and currentPath
   * Delegates to FileFilterManager
   */
  public filterFiles(query: string): FileInfo[] {
    return this.fileFilterManager.filterFiles(this.getCachedData(), this.state.currentPath, query);
  }

  /**
   * Count files in a directory (direct children only)
   * Delegates to FileFilterManager
   */
  private countFilesInDirectory(dirPath: string): number {
    return this.fileFilterManager.countFilesInDirectory(this.getCachedData(), dirPath);
  }

  /**
   * Get total count of merged suggestion items
   */
  private getTotalItemCount(): number {
    return this.state.mergedSuggestions.length;
  }

  /**
   * Merge files and agents into a single sorted list based on match score
   * Delegates to FileFilterManager
   */
  private mergeSuggestions(query: string, maxSuggestions?: number): SuggestionItem[] {
    return this.fileFilterManager.mergeSuggestions(
      this.state.filteredFiles,
      this.state.filteredAgents,
      query,
      maxSuggestions
    );
  }

  /**
   * Select an item from merged suggestions by index
   * Delegates to NavigationManager
   */
  private selectItem(index: number): void {
    this.navigationManager.selectItem(index);
  }

  /**
   * Select a symbol and insert its path:lineNumber#symbolName
   * Delegates to NavigationManager
   */
  private _selectSymbol(symbol: SymbolResult): void {
    this.navigationManager.selectSymbol(symbol);
  }

  /**
   * Handle keyboard navigation
   * Supports: ArrowDown/Ctrl+n/Ctrl+j (next), ArrowUp/Ctrl+p/Ctrl+k (previous), Enter/Tab (select), Escape (close), Ctrl+i (toggle tooltip)
   * Delegates to NavigationManager
   */
  public handleKeyDown(e: KeyboardEvent): void {
    this.navigationManager.handleKeyDown(e);
  }

  /**
   * Update visual selection state
   */
  private updateSelection(): void {
    if (!this.state.suggestionsContainer) return;

    const items = this.state.suggestionsContainer.querySelectorAll('.file-suggestion-item');
    items.forEach((item, index) => {
      if (index === this.state.selectedIndex) {
        item.classList.add('selected');
        item.setAttribute('aria-selected', 'true');
        item.scrollIntoView({ block: 'nearest' });
      } else {
        item.classList.remove('selected');
        item.setAttribute('aria-selected', 'false');
      }
    });

    // Update tooltip if auto-show is enabled
    this.popupManager.showTooltipForSelectedItem();
  }

  /**
   * Navigate into a directory (for Tab key on directories)
   * Delegates to NavigationManager
   */
  private navigateIntoDirectory(directory: FileInfo): void {
    this.navigationManager.navigateIntoDirectory(directory);
  }

  /**
   * Expand current directory path (for Enter/Tab when no item is selected)
   * Delegates to NavigationManager
   */
  public expandCurrentDirectory(): void {
    this.navigationManager.expandCurrentDirectory();
  }

  /**
   * Expand current file path (for Enter/Tab when no symbol is selected in symbol mode)
   * Delegates to CodeSearchManager
   */
  private expandCurrentFile(): void {
    this.codeSearchManager?.expandCurrentFile();
  }

  /**
   * Update text input with the current path (keeps @ and updates the path after it)
   * Delegates to PathManager
   */
  private updateTextInputWithPath(path: string): void {
    this.pathManager.updateTextInputWithPath(path, this.state.atStartPosition);
  }

  /**
   * Get language info for a file based on its extension or filename
   */
  private getLanguageForFile(filename: string): LanguageInfo | null {
    // Delegate to CodeSearchManager
    return this.codeSearchManager?.getLanguageForFile(filename) || null;
  }

  /**
   * Show symbol suggestions for the current file
   * Delegates to CodeSearchManager
   */
  private async showSymbolSuggestions(query: string): Promise<void> {
    await this.codeSearchManager?.showSymbolSuggestions(query);
  }

  /**
   * Exit symbol mode and return to file list
   * Delegates to CodeSearchManager
   */
  private exitSymbolMode(): void {
    this.codeSearchManager?.exitSymbolMode();
  }

  /**
   * Insert file path, keeping the @ and replacing only the query part
   * Delegates to PathManager
   */
  public insertFilePath(path: string): void {
    this.state.atStartPosition = this.pathManager.insertFilePath(path, this.state.atStartPosition);
  }

  /**
   * Insert file path without the @ symbol
   * Replaces both @ and query with just the path
   * Delegates to PathManager
   */
  private insertFilePathWithoutAt(path: string): void {
    this.state.atStartPosition = this.pathManager.insertFilePathWithoutAt(path, this.state.atStartPosition);
  }

  /**
   * Handle backspace key to delete entire @path if cursor is at the end
   * Delegates to PathManager
   */
  private handleBackspaceForAtPath(e: KeyboardEvent): void {
    this.pathManager.handleBackspaceForAtPath(e);
  }

  /**
   * Sync the scroll position of the highlight backdrop with the textarea
   */
  private syncBackdropScroll(): void {
    // Delegate to HighlightManager
    this.highlightManager?.syncBackdropScroll();
  }

  /**
   * Update the highlight backdrop to show @path highlights
   */
  public updateHighlightBackdrop(): void {
    // Delegate to HighlightManager
    this.highlightManager?.updateHighlightBackdrop();
    // Sync local atPaths from manager for backward compatibility
    if (this.highlightManager) {
      this.state.atPaths = this.highlightManager.getAtPaths();
    }
  }

  /**
   * Build a set of valid paths from cached directory data
   */
  private buildValidPathsSet(): Set<string> | null {
    return this.pathManager.buildValidPathsSet();
  }

  /**
   * Clear all tracked @paths (called when text is cleared)
   */
  public clearAtPaths(): void {
    this.state.atPaths = [];
    this.state.selectedPaths.clear();
    this.highlightManager?.clearAtPaths();
    this.updateHighlightBackdrop();
  }

  /**
   * Restore @paths from text (called when draft is restored or directory data is updated)
   * This auto-detects @paths in the text and adds them to tracking
   * Only highlights @paths that actually exist (checked against cached file list or filesystem)
   *
   * @param checkFilesystem - If true, checks filesystem for file existence when cached file list is empty.
   *                          Use this when restoring from draft with empty file list (fromDraft).
   */
  public async restoreAtPathsFromText(checkFilesystem = false): Promise<void> {
    console.debug('[FileSearchManager] restoreAtPathsFromText called:', formatLog({
      hasTextInput: !!this.state.textInput,
      hasHighlightManager: !!this.highlightManager,
      hasCachedData: this.hasCache(),
      cachedFileCount: this.getCachedFiles().length,
      checkFilesystem
    }));

    // Delegate to HighlightManager
    if (this.highlightManager) {
      await this.highlightManager.restoreAtPathsFromText(checkFilesystem, this.getCachedData());
      // Sync local state with HighlightManager
      this.state.atPaths = this.highlightManager.getAtPaths();
      // Clear and copy selectedPaths from HighlightManager
      this.state.clearSelectedPaths();
      for (const path of this.highlightManager.getSelectedPaths()) {
        this.state.addSelectedPath(path);
      }
    }
  }

  /**
   * Check if suggestions are currently visible
   */
  public isActive(): boolean {
    return this.state.isVisible;
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    this.hideSuggestions();
    this.directoryCacheManager?.clearCache();

    // Clean up mirror div
    if (this.state.mirrorDiv && this.state.mirrorDiv.parentNode) {
      this.state.mirrorDiv.parentNode.removeChild(this.state.mirrorDiv);
      this.state.mirrorDiv = null;
    }

    // Clean up modular managers
    this.highlightManager = null;
    this.suggestionUIManager = null;
    this.codeSearchManager = null;
    this.fileOpenerManager = null;
    this.directoryCacheManager = null;
  }
}
