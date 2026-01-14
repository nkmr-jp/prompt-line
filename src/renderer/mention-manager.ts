/**
 * Mention Manager for renderer process
 * Manages @ mention functionality with incremental search
 * Supports: files, code symbols, agents, and agent skills
 */

import type { FileInfo, DirectoryInfo, AgentItem } from '../types';
import type { SymbolResult, LanguageInfo } from './mentions/code-search/types';
import type { DirectoryData, MentionCallbacks, SuggestionItem } from './mentions';
import type { IInitializable } from './interfaces/initializable';
import { handleError } from './utils/error-handler';
import { electronAPI } from './services/electron-api';
import {
  normalizePath,
  parsePathWithLineInfo,
  resolveAtPathToAbsolute
} from './mentions';
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
  MentionState,
  MentionInitializer
} from './mentions/managers';

export class MentionManager implements IInitializable {
  // Centralized state container
  private readonly state = new MentionState();
  private callbacks: MentionCallbacks;


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

  constructor(callbacks: MentionCallbacks) {
    this.callbacks = callbacks;

    // Initialize PopupManager with callbacks
    this.popupManager = new PopupManager({
      getSelectedSuggestion: () => this.state.mergedSuggestions[this.state.selectedIndex] || null,
      getSuggestionsContainer: () => this.state.suggestionsContainer,
      onBeforeOpenFile: () => callbacks.onBeforeOpenFile?.(),
      setDraggable: (value: boolean) => callbacks.setDraggable?.(value),
      onSelectAgent: (agent: AgentItem) => {
        // Find the agent in merged suggestions and select it
        const agentIndex = this.state.mergedSuggestions.findIndex(
          s => s.type === 'agent' && s.agent?.name === agent.name
        );
        if (agentIndex >= 0) {
          this.selectItem(agentIndex);
        }
      }
    });

    // Initialize SettingsCacheManager
    this.settingsCacheManager = new SettingsCacheManager();

    // Initialize FileFilterManager
    this.fileFilterManager = new FileFilterManager({
      getDefaultMaxSuggestions: () => this.settingsCacheManager.getDefaultMaxSuggestions(),
      getAgentUsageBonuses: () => this.state.agentUsageBonuses
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
      checkFileExists: (path: string) => this.checkFileExistsAbsolute(path),
      getKnownCommandNames: () => this.callbacks.getKnownCommandNames?.() ?? []
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
      setFilteredAgents: (agents: AgentItem[]) => { this.state.filteredAgents = agents; },
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
      exitSymbolMode: () => this.codeSearchManager?.exitSymbolMode(),
      removeAtQueryText: () => this.removeAtQueryText(),
      openFileAndRestoreFocus: async (filePath: string) => {
        await this.fileOpenerManager?.openFile(filePath);
      },
      toggleAutoShowTooltip: () => this.popupManager.toggleAutoShowTooltip(),
      expandCurrentFile: () => this.expandCurrentFile(),
      // Directory/File navigation helpers
      updateTextInputWithPath: (path: string) => this.updateTextInputWithPath(path),
      filterFiles: (query: string, usageBonuses?: Record<string, number>) => this.filterFiles(query, usageBonuses),
      mergeSuggestions: (query: string, maxSuggestions?: number, usageBonuses?: Record<string, number>) => this.mergeSuggestions(query, maxSuggestions, usageBonuses),
      updateSuggestionList: (suggestions: SuggestionItem[], showPath: boolean, selectedIndex: number) =>
        this.suggestionUIManager?.update(suggestions, showPath, selectedIndex),
      showTooltipForSelectedItem: () => this.popupManager.showTooltipForSelectedItem(),
      showSymbolSuggestions: async (query: string) => await this.codeSearchManager?.showSymbolSuggestions(query),
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
      handleBackspaceForSlashCommand: (e: KeyboardEvent) => this.handleBackspaceForSlashCommand(e),
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

    // Connect PathManager to EventListenerManager for listener suspension during @path deletion
    this.pathManager.setEventListenerCallbacks(
      () => this.eventListenerManager.suspendInputListeners(),
      () => this.eventListenerManager.resumeInputListeners()
    );

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
    this.state.fileSearchEnabled = enabled;
  }

  /**
   * Check if file search is enabled
   */
  public isFileSearchEnabled(): boolean {
    return this.state.fileSearchEnabled;
  }

  /**
   * Set whether symbol search is enabled
   */
  public setSymbolSearchEnabled(enabled: boolean): void {
    this.state.symbolSearchEnabled = enabled;
  }

  /**
   * Check if symbol search is enabled
   */
  public isSymbolSearchEnabled(): boolean {
    return this.state.symbolSearchEnabled;
  }


  // ============================================
  // State Update Helpers
  // ============================================

  /**
   * Update filter state with new data
   */
  private updateFilterState(files: FileInfo[], agents: AgentItem[], suggestions: SuggestionItem[]): void {
    this.state.filteredFiles = files;
    this.state.filteredAgents = agents;
    this.state.mergedSuggestions = suggestions;
  }

  /**
   * Check if file exists at absolute path
   */
  private async checkFileExistsAbsolute(path: string): Promise<boolean> {
    const baseDir = this.directoryCacheManager?.getDirectory();
    if (!baseDir) return false;

    const absolutePath = resolveAtPathToAbsolute(path, baseDir, parsePathWithLineInfo, normalizePath);
    if (!absolutePath) return false;

    try {
      return await electronAPI?.file?.checkExists(absolutePath) || false;
    } catch {
      return false;
    }
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
    const initializer = new MentionInitializer(
      {
        state: this.state,
        callbacks: this.callbacks,
        popupManager: this.popupManager,
        settingsCacheManager: this.settingsCacheManager,
        fileFilterManager: this.fileFilterManager,
        pathManager: this.pathManager,
        navigationManager: this.navigationManager,
        eventListenerManager: this.eventListenerManager,
        queryExtractionManager: this.queryExtractionManager
      },
      {
        isCommandEnabledSync: () => this.isCommandEnabledSync(),
        checkFileExistsAbsolute: (path: string) => this.checkFileExistsAbsolute(path),
        buildValidPathsSet: () => this.getValidPathsSet(),
        getTotalItemCount: () => this.getTotalItemCount(),
        _getFileSearchMaxSuggestions: () => this._getFileSearchMaxSuggestions(),
        ...(this.callbacks.getCommandSource && {
          getCommandSource: (commandName: string) => this.callbacks.getCommandSource?.(commandName)
        }),
        ...(this.callbacks.getCommandColor && {
          getCommandColor: (commandName: string) => this.callbacks.getCommandColor?.(commandName)
        }),
        ...(this.callbacks.getKnownCommandNames && {
          getKnownCommandNames: () => this.callbacks.getKnownCommandNames?.() ?? []
        }),
        invalidateValidPathsCache: () => this.invalidateValidPathsCache(),
        updateHighlightBackdrop: () => this.updateHighlightBackdrop(),
        updateSelection: () => this.updateSelection(),
        hideSuggestions: () => this.hideSuggestions(),
        insertFilePath: (path: string) => this.insertFilePath(path),
        insertFilePathWithoutAt: (path: string) => this.insertFilePathWithoutAt(path),
        exitSymbolMode: () => this.codeSearchManager?.exitSymbolMode(),
        removeAtQueryText: () => this.removeAtQueryText(),
        expandCurrentFile: () => this.expandCurrentFile(),
        updateTextInputWithPath: (path: string) => this.updateTextInputWithPath(path),
        filterFiles: (query: string, usageBonuses?: Record<string, number>) => this.filterFiles(query, usageBonuses),
        mergeSuggestions: (query: string, maxSuggestions?: number, usageBonuses?: Record<string, number>) => this.mergeSuggestions(query, maxSuggestions, usageBonuses),
        getFileUsageBonuses: async () => await this.getFileUsageBonuses(),
        showSuggestions: (query: string) => this.showSuggestions(query),
        _selectSymbol: (symbol: SymbolResult) => this._selectSymbol(symbol),
        refreshSuggestions: () => this.refreshSuggestions(),
        restoreDefaultHint: () => this.restoreDefaultHint(),
        selectItem: (index: number) => this.selectItem(index),
        navigateIntoDirectory: (file: FileInfo) => this.navigateIntoDirectory(file),
        countFilesInDirectory: (path: string) => this.countFilesInDirectory(path),
        adjustCurrentPathToQuery: (query: string) => this.adjustCurrentPathToQuery(query),
        searchAgents: (query: string) => this.searchAgents(query),
        isIndexBeingBuilt: () => this.isIndexBeingBuilt(),
        showIndexingHint: () => this.showIndexingHint(),
        matchesSearchPrefix: (query: string, type: 'command' | 'mention') => this.matchesSearchPrefix(query, type),
        getMaxSuggestions: (type: 'command' | 'mention') => this.getMaxSuggestions(type),
        getIsInSymbolMode: () => this.isInSymbolMode,
        setIsInSymbolMode: (value: boolean) => { this.isInSymbolMode = value; },
        getCurrentFilePath: () => this.currentFilePath,
        setCurrentFilePath: (path: string) => { this.currentFilePath = path; },
        getCurrentFileSymbols: () => this.currentFileSymbols,
        setCurrentFileSymbols: (symbols: SymbolResult[]) => { this.currentFileSymbols = symbols; }
      }
    );

    const managers = initializer.initializeAll();
    this.highlightManager = managers.highlightManager;
    this.suggestionUIManager = managers.suggestionUIManager;
    this.codeSearchManager = managers.codeSearchManager;
    this.fileOpenerManager = managers.fileOpenerManager;
    this.directoryCacheManager = managers.directoryCacheManager;

    // Wire up cross-manager dependencies
    initializer.wireDependencies(managers);
  }

  /**
   * Handle cached directory data from window-shown event
   * This enables instant file search when window opens
   */
  public handleCachedDirectoryData(data: DirectoryInfo | undefined): void {
    // Delegate to DirectoryCacheManager
    // The manager will notify via onCacheUpdated callback to sync local copy
    this.directoryCacheManager?.handleCachedDirectoryData(data);

    // Load registered at-paths (supports symbols with spaces and mdSearch agents)
    // Always load global paths; load project paths only if directory is available
    this.loadRegisteredAtPaths(data?.directory ?? null);
  }

  /**
   * Load registered at-paths from persistent cache
   * These paths may contain spaces (e.g., symbol names with spaces)
   * Loads both project-specific paths and global paths (for mdSearch agents)
   * @param directory - Project directory (null if not available)
   */
  private async loadRegisteredAtPaths(directory: string | null): Promise<void> {
    try {
      if (!electronAPI?.atPathCache) {
        return;
      }

      // Load project-specific paths (only if directory is available)
      const projectPaths = (directory && electronAPI.atPathCache.getPaths)
        ? await electronAPI.atPathCache.getPaths(directory)
        : [];

      // Load global paths (for mdSearch agents and other project-independent items)
      const globalPaths = electronAPI.atPathCache.getGlobalPaths
        ? await electronAPI.atPathCache.getGlobalPaths()
        : [];

      // Merge both path sets (deduplicated)
      const allPaths = [...new Set([...projectPaths, ...globalPaths])];

      if (allPaths.length > 0) {
        this.highlightManager?.setRegisteredAtPaths(allPaths);
      }
    } catch (error) {
      console.warn('[MentionManager] Failed to load registered at-paths:', error);
    }
  }

  public setupEventListeners(): void {
    if (!this.state.textInput) {
      console.warn('[MentionManager] setupEventListeners: textInput is null, skipping');
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
    this.pathManager.invalidateValidPathsCache();
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
   * Returns true if file search should proceed
   */
  private shouldProcessFileSearch(): boolean {
    // Skip if already in symbol mode (navigating into file for symbol search)
    // This prevents input event from interrupting symbol search
    if (this.isInSymbolMode) {
      return false;
    }
    const hasCache = this.directoryCacheManager?.hasCache() ?? false;
    return this.state.fileSearchEnabled && !!this.state.textInput && hasCache;
  }

  /**
   * Try to handle query as code search
   * @returns true if handled as code search (whether successful or not)
   */
  private tryCodeSearch(query: string, startPos: number): boolean {
    // Skip code search if symbol search is disabled (rg not available)
    if (!this.state.symbolSearchEnabled) {
      return false;
    }

    const parsedCodeSearch = this.queryExtractionManager.parseCodeSearchQuery(query);

    if (!parsedCodeSearch || this.matchesSearchPrefixSync(query, 'mention')) {
      return false;
    }

    const { language, symbolQuery, symbolTypeFilter } = parsedCodeSearch;
    return this.handleCodeSearch(language, symbolQuery, symbolTypeFilter, startPos);
  }

  /**
   * Handle code search pattern
   * @returns true if handled (whether successful or not)
   */
  private handleCodeSearch(
    language: string,
    symbolQuery: string,
    symbolTypeFilter: string | null,
    startPos: number
  ): boolean {
    if (!this.codeSearchManager) {
      this.callbacks.updateHintText?.('Code search not available');
      return true;
    }

    const supportedLanguages = this.codeSearchManager.getSupportedLanguages();
    const rgAvailable = this.codeSearchManager.isAvailableSync();

    // Wait for initialization if needed
    if (!supportedLanguages || supportedLanguages.size === 0) {
      this.handleCodeSearchInitializing();
      return true;
    }

    // Execute code search if language is supported
    if (rgAvailable && supportedLanguages.has(language)) {
      void this.executeCodeSearch(language, symbolQuery, symbolTypeFilter, startPos);
      return true;
    }

    // Show error for unsupported language or missing rg
    this.showCodeSearchError(rgAvailable, language, supportedLanguages);
    return true;
  }

  /**
   * Handle code search initialization state
   */
  private handleCodeSearchInitializing(): void {
    this.callbacks.updateHintText?.('Loading language support...');
    this.hideSuggestions();
    this.codeSearchManager?.isAvailable().then(() => {
      if (this.state.textInput?.value.includes('@')) {
        this.checkForFileSearch();
      }
    });
  }

  /**
   * Execute code search with symbol query
   */
  private async executeCodeSearch(
    language: string,
    symbolQuery: string,
    symbolTypeFilter: string | null,
    startPos: number
  ): Promise<void> {
    this.state.atStartPosition = startPos;
    this.state.codeSearchQuery = symbolQuery;

    const shouldRefresh = !this.state.codeSearchCacheRefreshed || this.state.codeSearchLanguage !== language;
    this.state.codeSearchLanguage = language;
    this.state.codeSearchCacheRefreshed = shouldRefresh || this.state.codeSearchCacheRefreshed;

    this.hideUIContainer();
    await this.codeSearchManager?.searchSymbolsWithUI(language, symbolQuery, symbolTypeFilter, shouldRefresh);
  }

  /**
   * Show code search error message
   */
  private showCodeSearchError(rgAvailable: boolean, language: string, supportedLanguages: Map<string, unknown>): void {
    if (!rgAvailable) {
      this.callbacks.updateHintText?.('ripgrep (rg) not found. Install: brew install ripgrep');
    } else if (!supportedLanguages.has(language)) {
      this.callbacks.updateHintText?.(`Unknown language: ${language}`);
    }
    this.hideSuggestions();
  }

  /**
   * Handle normal file search
   */
  private handleFileSearch(query: string, startPos: number): void {
    this.state.atStartPosition = startPos;
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
   * Show file suggestions based on the query
   * Delegates to CodeSearchManager for symbol mode, SuggestionUIManager for file mode
   */
  public async showSuggestions(query: string): Promise<void> {
    if (!this.state.suggestionsContainer) {
      return;
    }

    // Delegate to CodeSearchManager for symbol mode handling
    await this.codeSearchManager?.handleShowSuggestions(query, async () => {
      // Fallback to file suggestions if not in symbol mode
      await this.suggestionUIManager?.showSuggestions(query);
    });
  }

  /**
   * Search agents via IPC
   */
  private async searchAgents(query: string): Promise<AgentItem[]> {
    try {
      if (electronAPI?.agents?.get) {
        const agents = await electronAPI.agents.get(query);
        const maxSuggestions = await this.getMaxSuggestions('mention');

        // Fetch agent usage bonuses for scoring
        const agentNames = agents.map(a => a.name);
        const agentBonuses = await this.getAgentUsageBonuses(agentNames);

        // Store bonuses in state for use during scoring
        this.state.agentUsageBonuses = agentBonuses;

        return agents.slice(0, maxSuggestions);
      }
    } catch (error) {
      handleError('MentionManager.searchAgents', error);
    }
    return [];
  }

  /**
   * Get usage bonuses for agents
   */
  private async getAgentUsageBonuses(agentNames: string[]): Promise<Record<string, number>> {
    try {
      if (electronAPI?.usageHistory?.getAgentUsageBonuses) {
        return await electronAPI.usageHistory.getAgentUsageBonuses(agentNames);
      }
    } catch (error) {
      handleError('MentionManager.getAgentUsageBonuses', error);
    }
    return {};
  }

  /**
   * Adjust currentPath to match the query
   * Delegates to FileFilterManager
   */
  private adjustCurrentPathToQuery(query: string): void {
    const newPath = this.fileFilterManager.adjustCurrentPathToQuery(this.state.currentPath, query);
    if (newPath !== this.state.currentPath) {
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
    this.updateFilterState([], [], []);
    this.state.filteredSymbols = [];
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
   * Delegates to CodeSearchManager
   */
  private resetSymbolModeState(): void {
    this.codeSearchManager?.resetSymbolModeState();
  }

  /**
   * Remove the @query text from the textarea without inserting a file path
   * Used when opening a file with Ctrl+Enter
   * Delegates to PathManager
   */
  private removeAtQueryText(): void {
    this.pathManager.removeAtQueryText(this.state.atStartPosition);
  }

  // Cached usage bonuses to avoid repeated IPC calls
  private cachedFileUsageBonuses: Record<string, number> = {};
  private usageBonusesCacheTime: number = 0;
  private readonly USAGE_BONUSES_CACHE_TTL = 5000; // 5 seconds

  /**
   * Get file usage bonuses (cached for performance)
   */
  private async getFileUsageBonuses(): Promise<Record<string, number>> {
    const now = Date.now();
    if (now - this.usageBonusesCacheTime < this.USAGE_BONUSES_CACHE_TTL) {
      return this.cachedFileUsageBonuses;
    }

    try {
      const cachedData = this.directoryCacheManager?.getCachedData() ?? null;
      if (!cachedData?.files || cachedData.files.length === 0) {
        return {};
      }

      // Get all file paths
      const filePaths = cachedData.files.map(f => f.path);

      // Fetch bonuses via IPC
      const bonuses = await electronAPI?.usageHistory?.getFileUsageBonuses(filePaths) ?? {};

      // Update cache
      this.cachedFileUsageBonuses = bonuses;
      this.usageBonusesCacheTime = now;

      return bonuses;
    } catch (error) {
      console.warn('[MentionManager] Failed to fetch file usage bonuses:', error);
      return {};
    }
  }

  /**
   * Filter files based on query (fuzzy matching) and currentPath
   * Delegates to FileFilterManager
   */
  public filterFiles(query: string, usageBonuses?: Record<string, number>): FileInfo[] {
    const cachedData = this.directoryCacheManager?.getCachedData() ?? null;
    return this.fileFilterManager.filterFiles(cachedData, this.state.currentPath, query, usageBonuses);
  }

  /**
   * Count files in a directory (direct children only)
   * Delegates to FileFilterManager
   */
  private countFilesInDirectory(dirPath: string): number {
    const cachedData = this.directoryCacheManager?.getCachedData() ?? null;
    return this.fileFilterManager.countFilesInDirectory(cachedData, dirPath);
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
  private mergeSuggestions(query: string, maxSuggestions?: number, usageBonuses?: Record<string, number>): SuggestionItem[] {
    return this.fileFilterManager.mergeSuggestions(
      this.state.filteredFiles,
      this.state.filteredAgents,
      query,
      maxSuggestions,
      usageBonuses
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
        // Use 'instant' to ensure scroll completes before popup positioning
        item.scrollIntoView({ block: 'nearest', behavior: 'instant' });
      } else {
        item.classList.remove('selected');
        item.setAttribute('aria-selected', 'false');
      }
    });

    // Update tooltip if auto-show is enabled
    // Use requestAnimationFrame to ensure scroll position is settled before calculating popup position
    requestAnimationFrame(() => {
      this.popupManager.showTooltipForSelectedItem();
    });
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
  private handleBackspaceForAtPath(e: KeyboardEvent): boolean {
    return this.pathManager.handleBackspaceForAtPath(e);
  }

  /**
   * Handle backspace key to delete entire slash command if cursor is at the end
   * Delegates to PathManager
   */
  private handleBackspaceForSlashCommand(e: KeyboardEvent): boolean {
    return this.pathManager.handleBackspaceForSlashCommand(e);
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
   * Get valid paths set (uses cached value if available)
   */
  private getValidPathsSet(): Set<string> | null {
    return this.pathManager.getValidPathsSet();
  }

  /**
   * Invalidate valid paths cache (call when directory data changes)
   */
  private invalidateValidPathsCache(): void {
    this.pathManager.invalidateValidPathsCache();
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
    const cachedData = this.directoryCacheManager?.getCachedData() ?? null;

    // Delegate to HighlightManager
    if (this.highlightManager) {
      await this.highlightManager.restoreAtPathsFromText(checkFilesystem, cachedData);
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
