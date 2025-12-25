/**
 * File Search Manager for renderer process
 * Manages @ file mention functionality with incremental search
 */

import type { FileInfo, DirectoryInfo, AgentItem } from '../types';
import type { SymbolResult, LanguageInfo } from './code-search/types';
import type { DirectoryData, FileSearchCallbacks, AtPathRange, SuggestionItem } from './file-search';
import {
  formatLog,
  normalizePath,
  parsePathWithLineInfo,
  findAtPathAtPosition,
  findUrlAtPosition,
  findSlashCommandAtPosition,
  findAbsolutePathAtPosition,
  resolveAtPathToAbsolute
} from './file-search';
import {
  PopupManager,
  SettingsCacheManager,
  HighlightManager,
  SuggestionListManager,
  CodeSearchManager,
  FileOpenerManager,
  DirectoryCacheManager,
  FileFilterManager,
  TextInputPathManager,
  SymbolModeUIManager,
  AtPathBehaviorManager,
  ItemSelectionManager,
  NavigationManager,
  KeyboardNavigationManager,
  EventListenerManager,
  QueryExtractionManager,
  SuggestionStateManager,
  ManagerInitializer
} from './file-search/managers';
import type { ManagerState, ManagerDependencies } from './file-search/managers';

export class FileSearchManager {
  private suggestionsContainer: HTMLElement | null = null;
  private textInput: HTMLTextAreaElement | null = null;
  private highlightBackdrop: HTMLDivElement | null = null;
  private cachedDirectoryData: DirectoryData | null = null;
  private selectedIndex: number = 0;
  private filteredFiles: FileInfo[] = [];
  private filteredAgents: AgentItem[] = []; // Agents matching the query
  private mergedSuggestions: SuggestionItem[] = []; // Merged and sorted suggestions
  private isVisible: boolean = false;
  private currentQuery: string = '';
  private atStartPosition: number = -1;
  private callbacks: FileSearchCallbacks;
  private currentPath: string = ''; // Current directory path being browsed (relative from root)
  private mirrorDiv: HTMLDivElement | null = null; // Hidden div for caret position calculation
  private atPaths: AtPathRange[] = []; // Tracked @paths in the text (computed from selectedPaths)
  private selectedPaths: Set<string> = new Set(); // Set of path strings that should be highlighted

  // PopupManager for frontmatter popup
  private popupManager!: PopupManager;

  // SettingsCacheManager for settings caching
  private settingsCacheManager!: SettingsCacheManager;

  // New modular managers (initialized in initializeElements after DOM is ready)
  private highlightManager: HighlightManager | null = null;
  private suggestionListManager: SuggestionListManager | null = null;
  private codeSearchManager: CodeSearchManager | null = null;
  private fileOpenerManager: FileOpenerManager | null = null;
  private directoryCacheManager: DirectoryCacheManager | null = null;
  private fileFilterManager!: FileFilterManager;
  private textInputPathManager!: TextInputPathManager;
  private symbolModeUIManager!: SymbolModeUIManager;
  private atPathBehaviorManager!: AtPathBehaviorManager;
  private itemSelectionManager!: ItemSelectionManager;
  private navigationManager!: NavigationManager;
  private keyboardNavigationManager!: KeyboardNavigationManager;
  private eventListenerManager!: EventListenerManager;
  private queryExtractionManager!: QueryExtractionManager;
  private suggestionStateManager!: SuggestionStateManager;

  // Whether file search feature is enabled (from settings)
  private fileSearchEnabled: boolean = false;

  // Code/Symbol search properties
  private filteredSymbols: SymbolResult[] = [];
  private codeSearchQuery: string = '';
  private codeSearchLanguage: string = ''; // Current language for code search
  private codeSearchCacheRefreshed: boolean = false; // Whether cache refresh has been triggered for this session

  // Symbol mode properties (delegated to SymbolModeUIManager, kept for compatibility)
  private get isInSymbolMode(): boolean {
    return this.symbolModeUIManager.isInSymbolMode();
  }
  private set isInSymbolMode(value: boolean) {
    this.symbolModeUIManager.setState({ isInSymbolMode: value });
  }
  private get currentFilePath(): string {
    return this.symbolModeUIManager.getState().currentFilePath;
  }
  private set currentFilePath(value: string) {
    this.symbolModeUIManager.setState({ currentFilePath: value });
  }
  private get currentFileSymbols(): SymbolResult[] {
    return this.symbolModeUIManager.getState().currentFileSymbols;
  }
  private set currentFileSymbols(value: SymbolResult[]) {
    this.symbolModeUIManager.setState({ currentFileSymbols: value });
  }

  constructor(callbacks: FileSearchCallbacks) {
    this.callbacks = callbacks;
    const state = this.createManagerState();
    const managers = this.initializeManagers(callbacks, state);
    this.assignManagers(managers);
  }

  /**
   * Create state object for manager initialization
   */
  private createManagerState(): ManagerState {
    return {
      selectedPaths: this.selectedPaths,
      selectedIndex: this.selectedIndex,
      currentQuery: this.currentQuery,
      currentPath: this.currentPath,
      filteredFiles: this.filteredFiles,
      filteredAgents: this.filteredAgents,
      mergedSuggestions: this.mergedSuggestions,
      isVisible: this.isVisible,
      atStartPosition: this.atStartPosition,
      codeSearchQuery: this.codeSearchQuery,
      codeSearchLanguage: this.codeSearchLanguage,
      codeSearchCacheRefreshed: this.codeSearchCacheRefreshed
    };
  }

  /**
   * Initialize all managers using ManagerInitializer
   */
  private initializeManagers(callbacks: FileSearchCallbacks, state: ManagerState) {
    const getDependencies = (): ManagerDependencies => this.createDependencies();
    const initializer = new ManagerInitializer(callbacks, state, getDependencies);
    return initializer.initializeAll();
  }

  /**
   * Assign initialized managers to instance properties
   */
  private assignManagers(managers: ReturnType<ManagerInitializer['initializeAll']>): void {
    this.popupManager = managers.popupManager;
    this.settingsCacheManager = managers.settingsCacheManager;
    this.fileFilterManager = managers.fileFilterManager;
    this.textInputPathManager = managers.textInputPathManager;
    this.symbolModeUIManager = managers.symbolModeUIManager;
    this.atPathBehaviorManager = managers.atPathBehaviorManager;
    this.itemSelectionManager = managers.itemSelectionManager;
    this.navigationManager = managers.navigationManager;
    this.keyboardNavigationManager = managers.keyboardNavigationManager;
    this.eventListenerManager = managers.eventListenerManager;
    this.queryExtractionManager = managers.queryExtractionManager;
    this.suggestionStateManager = managers.suggestionStateManager;
  }

  /**
   * Create dependencies object for managers
   */
  private createDependencies(): ManagerDependencies {
    return {
      ...this.createGetterDependencies(),
      ...this.createActionDependencies(),
      ...this.createEventHandlerDependencies()
    };
  }

  /**
   * Create getter dependencies for managers
   */
  private createGetterDependencies() {
    return {
      getSuggestionsContainer: () => this.suggestionsContainer,
      getMergedSuggestions: () => this.mergedSuggestions,
      getHighlightManager: () => this.highlightManager,
      getSymbolModeUIManager: () => this.symbolModeUIManager,
      getSuggestionListManager: () => this.suggestionListManager,
      getCodeSearchManager: () => this.codeSearchManager,
      getPopupManager: () => this.popupManager,
      getTextInput: () => this.textInput,
      getCachedDirectoryData: () => this.cachedDirectoryData,
      getAtPaths: () => this.atPaths,
      getLanguageForFile: (fileName: string) => this.getLanguageForFile(fileName),
      getFileSearchMaxSuggestions: () => this.getFileSearchMaxSuggestions(),
      getIsInSymbolMode: () => this.isInSymbolMode,
      getMaxSuggestions: (type: 'command' | 'mention') => this.getMaxSuggestions(type),
      isIndexBeingBuilt: () => this.isIndexBeingBuilt(),
      matchesSearchPrefix: (query: string, type: 'command' | 'mention') => this.matchesSearchPrefix(query, type)
    };
  }

  /**
   * Create action dependencies for managers
   */
  private createActionDependencies() {
    return {
      updateHighlightBackdrop: () => this.updateHighlightBackdrop(),
      updateSelection: () => this.updateSelection(),
      selectSymbol: (symbol: SymbolResult) => this.selectSymbol(symbol),
      selectItem: (index: number) => this.selectItem(index),
      showSuggestions: (query: string) => this.showSuggestions(query),
      insertFilePath: (path: string) => this.insertFilePath(path),
      insertFilePathWithoutAt: (path: string) => this.insertFilePathWithoutAt(path),
      hideSuggestions: () => this.hideSuggestions(),
      navigateIntoFile: (relativePath: string, absolutePath: string, language: unknown) =>
        this.navigateIntoFile(relativePath, absolutePath, language as LanguageInfo),
      updateTextInputWithPath: (path: string) => this.updateTextInputWithPath(path),
      filterFiles: (query: string) => this.filterFiles(query),
      mergeSuggestions: (query: string, maxSuggestions?: number) => this.mergeSuggestions(query, maxSuggestions),
      showSymbolSuggestions: (query: string) => this.showSymbolSuggestions(query),
      setIsInSymbolMode: (value: boolean) => { this.isInSymbolMode = value; },
      setCurrentFilePath: (path: string) => { this.currentFilePath = path; },
      setCurrentFileSymbols: (symbols: SymbolResult[]) => { this.currentFileSymbols = symbols; },
      navigateIntoDirectory: (file: FileInfo) => this.navigateIntoDirectory(file),
      expandCurrentDirectory: () => this.expandCurrentDirectory(),
      expandCurrentFile: () => this.expandCurrentFile(),
      exitSymbolMode: () => this.exitSymbolMode(),
      removeAtQueryText: () => this.removeAtQueryText(),
      openFileAndRestoreFocus: (filePath: string) => this.openFileAndRestoreFocus(filePath),
      checkForFileSearch: () => this.checkForFileSearch(),
      updateCursorPositionHighlight: () => this.updateCursorPositionHighlight(),
      syncBackdropScroll: () => this.syncBackdropScroll(),
      adjustCurrentPathToQuery: (query: string) => this.adjustCurrentPathToQuery(query),
      searchAgents: (query: string) => this.searchAgents(query),
      showIndexingHint: () => this.showIndexingHint(),
      restoreDefaultHint: () => this.restoreDefaultHint()
    };
  }

  /**
   * Create event handler dependencies for managers
   */
  private createEventHandlerDependencies() {
    return {
      handleKeyDown: (e: KeyboardEvent) => this.handleKeyDown(e),
      handleBackspaceForAtPath: (e: KeyboardEvent) => this.handleBackspaceForAtPath(e),
      handleCtrlEnterOpenFile: (e: KeyboardEvent) => this.handleCtrlEnterOpenFile(e),
      handleCmdClickOnAtPath: (e: MouseEvent) => this.handleCmdClickOnAtPath(e),
      handleMouseMove: (e: MouseEvent) => this.handleMouseMove(e)
    };
  }

  /**
   * Set whether file search is enabled
   */
  public setFileSearchEnabled(enabled: boolean): void {
    this.fileSearchEnabled = enabled;
    console.debug('[FileSearchManager] File search enabled:', enabled);
  }

  /**
   * Check if file search is enabled
   */
  public isFileSearchEnabled(): boolean {
    return this.fileSearchEnabled;
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
  private async getFileSearchMaxSuggestions(): Promise<number> {
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

  public initializeElements(): void {
    this.initializeDOMElements();
    this.initializePopupManager();
    this.initializeSearchManagers();
    this.initializeFileOpenerManager();
    this.initializeSuggestionListManager();
  }

  /**
   * Initialize DOM elements
   */
  private initializeDOMElements(): void {
    this.textInput = document.getElementById('textInput') as HTMLTextAreaElement;
    this.highlightBackdrop = document.getElementById('highlightBackdrop') as HTMLDivElement;
    console.debug('[FileSearchManager] initializeElements: textInput found:', !!this.textInput, 'highlightBackdrop found:', !!this.highlightBackdrop);

    this.initializeSuggestionsContainer();
  }

  /**
   * Create suggestions container if it doesn't exist
   */
  private initializeSuggestionsContainer(): void {
    this.suggestionsContainer = document.getElementById('fileSuggestions');
    if (!this.suggestionsContainer) {
      this.createSuggestionsContainer();
    } else {
      console.debug('[FileSearchManager] initializeElements: suggestionsContainer already exists');
    }
  }

  /**
   * Create and append suggestions container to DOM
   */
  private createSuggestionsContainer(): void {
    this.suggestionsContainer = document.createElement('div');
    this.suggestionsContainer.id = 'fileSuggestions';
    this.suggestionsContainer.className = 'file-suggestions';
    this.suggestionsContainer.setAttribute('role', 'listbox');
    this.suggestionsContainer.setAttribute('aria-label', 'File suggestions');

    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      mainContent.appendChild(this.suggestionsContainer);
      console.debug('[FileSearchManager] initializeElements: suggestionsContainer created and appended to main-content');
    } else {
      console.warn('[FileSearchManager] initializeElements: .main-content not found!');
    }
  }

  /**
   * Initialize popup manager
   */
  private initializePopupManager(): void {
    this.popupManager.initialize();
  }

  /**
   * Initialize search-related managers
   */
  private initializeSearchManagers(): void {
    this.initializeCodeSearchManager();
    this.initializeDirectoryCacheManager();
    this.initializeHighlightManager();
  }

  /**
   * Initialize CodeSearchManager
   */
  private initializeCodeSearchManager(): void {
    this.codeSearchManager = new CodeSearchManager({
      updateHintText: (text: string) => this.callbacks.updateHintText?.(text),
      getDefaultHintText: () => this.callbacks.getDefaultHintText?.() || ''
    });
  }

  /**
   * Initialize DirectoryCacheManager
   */
  private initializeDirectoryCacheManager(): void {
    this.directoryCacheManager = new DirectoryCacheManager({
      onIndexingStatusChange: (isBuilding: boolean, hint?: string) => {
        if (isBuilding && hint) {
          this.callbacks.updateHintText?.(hint);
        }
      },
      onCacheUpdated: (data) => {
        this.cachedDirectoryData = data;
        if (this.isVisible && !this.currentQuery) {
          this.refreshSuggestions();
        }
      },
      updateHintText: (text: string) => this.callbacks.updateHintText?.(text)
    });
  }

  /**
   * Initialize HighlightManager
   */
  private initializeHighlightManager(): void {
    if (this.textInput && this.highlightBackdrop) {
      this.highlightManager = new HighlightManager(
        this.textInput,
        this.highlightBackdrop,
        {
          getTextContent: () => this.textInput?.value || '',
          getCursorPosition: () => this.textInput?.selectionStart || 0,
          updateHintText: (text: string) => this.callbacks.updateHintText?.(text),
          getDefaultHintText: () => this.callbacks.getDefaultHintText?.() || '',
          isFileSearchEnabled: () => this.fileSearchEnabled,
          isCommandEnabledSync: () => this.isCommandEnabledSync(),
          checkFileExists: async (path: string) => {
            try {
              return await window.electronAPI.file.checkExists(path);
            } catch {
              return false;
            }
          }
        }
      );
      this.highlightManager.setValidPathsBuilder(() => this.buildValidPathsSet());
    }
  }

  /**
   * Initialize FileOpenerManager
   */
  private initializeFileOpenerManager(): void {
    this.fileOpenerManager = new FileOpenerManager({
      onBeforeOpenFile: () => {
        this.hideSuggestions();
      },
      setDraggable: (enabled: boolean) => {
        this.callbacks.setDraggable?.(enabled);
      },
      getTextContent: () => this.textInput?.value || '',
      setTextContent: (text: string) => {
        if (this.textInput) {
          this.textInput.value = text;
        }
      },
      getCursorPosition: () => this.textInput?.selectionStart || 0,
      setCursorPosition: (position: number) => {
        if (this.textInput) {
          this.textInput.selectionStart = position;
          this.textInput.selectionEnd = position;
        }
      },
      getCurrentDirectory: () => this.cachedDirectoryData?.directory || null,
      hideWindow: () => {
        window.electronAPI.window.hide();
      },
      restoreDefaultHint: () => this.restoreDefaultHint()
    });
  }

  /**
   * Initialize SuggestionListManager
   */
  private initializeSuggestionListManager(): void {
    if (this.textInput) {
      this.suggestionListManager = new SuggestionListManager(
        this.textInput,
        {
          onItemSelected: (index: number) => this.selectItem(index),
          onNavigateIntoDirectory: (file: FileInfo) => this.navigateIntoDirectory(file),
          onEscape: () => this.hideSuggestions(),
          onOpenFileInEditor: async (filePath: string) => {
            await window.electronAPI.file.openInEditor(filePath);
          },
          getIsComposing: () => this.callbacks.getIsComposing?.() || false,
          getCurrentPath: () => this.currentPath,
          getBaseDir: () => this.cachedDirectoryData?.directory || '',
          getCurrentQuery: () => this.currentQuery,
          getCodeSearchQuery: () => this.codeSearchQuery,
          countFilesInDirectory: (path: string) => this.countFilesInDirectory(path),
          onMouseEnterInfo: (suggestion: SuggestionItem, target: HTMLElement) => {
            if (suggestion.type === 'agent' && suggestion.agent) {
              this.popupManager.showFrontmatterPopup(suggestion.agent, target);
            }
          },
          onMouseLeaveInfo: () => {
            this.popupManager.hideFrontmatterPopup();
          }
        }
      );
    }
  }

  /**
   * Handle cached directory data from window-shown event
   * This enables instant file search when window opens
   */
  public handleCachedDirectoryData(data: DirectoryInfo | undefined): void {
    // Delegate to DirectoryCacheManager
    // The manager will notify via onCacheUpdated callback to sync local copy
    this.directoryCacheManager?.handleCachedDirectoryData(data);
  }

  public setupEventListeners(): void {
    if (!this.textInput) {
      console.warn('[FileSearchManager] setupEventListeners: textInput is null, skipping');
      return;
    }

    // Initialize EventListenerManager with DOM elements and delegate setup
    this.eventListenerManager.initialize(this.textInput, this.suggestionsContainer);
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
    if (this.cachedDirectoryData?.hint) {
      return;
    }
    if (this.callbacks.updateHintText) {
      this.callbacks.updateHintText('Building file index...');
    }
  }

  /**
   * Handle Ctrl+Enter to open file or URL at cursor position
   */
  private async handleCtrlEnterOpenFile(e: KeyboardEvent): Promise<void> {
    const handled = await this.findAndOpenItemAtCursor();
    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  /**
   * Handle Cmd+click on @path, absolute path, or URL in textarea
   * Supports: URLs, file paths, agent names, and absolute paths (including ~)
   */
  private async handleCmdClickOnAtPath(e: MouseEvent): Promise<void> {
    const handled = await this.findAndOpenItemAtCursor();
    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  /**
   * Find and open URL, slash command, @path, or absolute path at cursor position
   * Common logic for both Ctrl+Enter and Cmd+click handlers
   * @returns true if something was found and opened, false otherwise
   */
  private async findAndOpenItemAtCursor(): Promise<boolean> {
    if (!this.textInput) return false;

    const text = this.textInput.value;
    const cursorPos = this.textInput.selectionStart;

    return await this.tryOpenUrl(text, cursorPos)
      || await this.tryOpenSlashCommand(text, cursorPos)
      || await this.tryOpenAtPath(text, cursorPos)
      || await this.tryOpenAbsolutePath(text, cursorPos);
  }

  /**
   * Try to open URL at cursor position
   */
  private async tryOpenUrl(text: string, cursorPos: number): Promise<boolean> {
    const url = findUrlAtPosition(text, cursorPos);
    if (url) {
      await this.openUrlInBrowser(url.url);
      return true;
    }
    return false;
  }

  /**
   * Try to open slash command at cursor position
   */
  private async tryOpenSlashCommand(text: string, cursorPos: number): Promise<boolean> {
    if (!this.isCommandEnabledSync()) return false;

    const slashCommand = findSlashCommandAtPosition(text, cursorPos);
    if (!slashCommand) return false;

    try {
      const commandFilePath = await window.electronAPI.slashCommands.getFilePath(slashCommand.command);
      if (commandFilePath) {
        await this.openFileAndRestoreFocus(commandFilePath);
      }
    } catch (err) {
      console.error('Failed to resolve slash command file path:', err);
    }
    return true; // Return true even on error to prevent event propagation
  }

  /**
   * Try to open @path at cursor position
   */
  private async tryOpenAtPath(text: string, cursorPos: number): Promise<boolean> {
    const atPath = findAtPathAtPosition(text, cursorPos);
    if (!atPath) return false;

    const looksLikeFilePath = atPath.includes('/') || atPath.includes('.');

    if (looksLikeFilePath && await this.tryOpenAsFilePath(atPath)) {
      return true;
    }

    if (await this.tryOpenAsAgentName(atPath)) {
      return true;
    }

    if (!looksLikeFilePath && await this.tryOpenAsFilePath(atPath)) {
      return true;
    }

    return true; // Return true even if nothing opened to prevent event propagation
  }

  /**
   * Try to open path as file path
   */
  private async tryOpenAsFilePath(atPath: string): Promise<boolean> {
    const filePath = resolveAtPathToAbsolute(atPath, this.cachedDirectoryData?.directory, parsePathWithLineInfo, normalizePath);
    if (filePath) {
      await this.openFileAndRestoreFocus(filePath);
      return true;
    }
    return false;
  }

  /**
   * Try to open path as agent name
   */
  private async tryOpenAsAgentName(atPath: string): Promise<boolean> {
    try {
      const agentFilePath = await window.electronAPI.agents.getFilePath(atPath);
      if (agentFilePath) {
        await this.openFileAndRestoreFocus(agentFilePath);
        return true;
      }
    } catch (err) {
      console.error('Failed to resolve agent file path:', err);
    }
    return false;
  }

  /**
   * Try to open absolute path at cursor position
   */
  private async tryOpenAbsolutePath(text: string, cursorPos: number): Promise<boolean> {
    const absolutePath = findAbsolutePathAtPosition(text, cursorPos);
    if (absolutePath) {
      await this.openFileAndRestoreFocus(absolutePath);
      return true;
    }
    return false;
  }

  /**
   * Open URL in external browser and restore focus to PromptLine window
   * Enables window dragging during URL open operation (same behavior as file open)
   * @param url - URL to open
   */
  private async openUrlInBrowser(url: string): Promise<void> {
    // Delegate to FileOpenerManager
    await this.fileOpenerManager?.openUrl(url);
  }

  /**
   * Open file in editor
   * The opened file's application will be brought to foreground
   * @param filePath - Path to the file to open
   */
  private async openFileAndRestoreFocus(filePath: string): Promise<void> {
    // Delegate to FileOpenerManager
    await this.fileOpenerManager?.openFile(filePath);
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
    this.cachedDirectoryData = null;
    this.hideSuggestions();
  }

  /**
   * Refresh suggestions with current cached data
   * Called when cache is updated in background
   */
  private refreshSuggestions(): void {
    if (!this.isVisible) return;

    // Re-filter with current query
    if (this.currentQuery) {
      this.filterFiles(this.currentQuery);
    }
    // Delegate rendering to SuggestionListManager (position remains unchanged)
    this.suggestionListManager?.update(this.mergedSuggestions, false);
  }

  /**
   * Check if file search should be triggered based on cursor position
   */
  public checkForFileSearch(): void {
    if (!this.isFileSearchReady()) {
      return;
    }

    const result = this.extractQueryAtCursor();
    console.debug('[FileSearchManager] extractQueryAtCursor result:', result ? formatLog(result as Record<string, unknown>) : 'null');

    if (result) {
      this.processFileSearchQuery(result);
    } else {
      this.hideSuggestions();
    }
  }

  /**
   * Check if file search is ready to be triggered
   */
  private isFileSearchReady(): boolean {
    if (!this.fileSearchEnabled) {
      return false;
    }

    console.debug('[FileSearchManager] checkForFileSearch called', formatLog({
      hasTextInput: !!this.textInput,
      hasCachedData: !!this.cachedDirectoryData,
      cachedDirectory: this.cachedDirectoryData?.directory,
      cachedFileCount: this.cachedDirectoryData?.files?.length
    }));

    if (!this.textInput || !this.cachedDirectoryData) {
      console.debug('[FileSearchManager] checkForFileSearch: early return - missing textInput or cachedDirectoryData');
      return false;
    }

    return true;
  }

  /**
   * Process file search query - delegates to code search or normal file search
   */
  private processFileSearchQuery(result: { query: string; startPos: number }): void {
    const { query, startPos } = result;

    const matchesSearchPrefix = this.matchesSearchPrefixSync(query, 'mention');
    const parsedCodeSearch = this.queryExtractionManager.parseCodeSearchQuery(query);
    console.debug('[FileSearchManager] checkForFileSearch: query=', query, 'parsedCodeSearch=', parsedCodeSearch, 'matchesSearchPrefix=', matchesSearchPrefix);

    if (parsedCodeSearch && !matchesSearchPrefix) {
      this.handleCodeSearchQuery(parsedCodeSearch, startPos);
    } else {
      this.handleNormalFileSearch(query, startPos);
    }
  }

  /**
   * Handle code search query (e.g., "ts:", "go:", "py:")
   */
  private handleCodeSearchQuery(
    parsedCodeSearch: { language: string; symbolQuery: string; symbolTypeFilter: string | null },
    startPos: number
  ): void {
    const { language, symbolQuery, symbolTypeFilter } = parsedCodeSearch;

    console.debug('[FileSearchManager] checkForFileSearch: code pattern matched, language=', language, 'symbolTypeFilter=', symbolTypeFilter, 'symbolQuery=', symbolQuery);

    const supportedLanguages = this.codeSearchManager?.getSupportedLanguages();
    const rgAvailable = this.codeSearchManager?.isAvailableSync() ?? false;

    console.debug('[FileSearchManager] checkForFileSearch: rgAvailable=', rgAvailable, 'supportedLanguages.size=', supportedLanguages?.size, 'supportedLanguages.has(language)=', supportedLanguages?.has(language));

    if (this.shouldWaitForCodeSearchInit(supportedLanguages)) {
      this.waitForCodeSearchInit();
      return;
    }

    if (this.isCodeSearchSupported(rgAvailable, supportedLanguages, language)) {
      this.executeCodeSearch(language, symbolQuery, symbolTypeFilter, startPos);
    } else {
      this.handleUnsupportedCodeSearch(rgAvailable, supportedLanguages, language);
    }
  }

  /**
   * Check if we should wait for code search initialization
   */
  private shouldWaitForCodeSearchInit(supportedLanguages: Map<string, unknown> | undefined): boolean {
    return this.codeSearchManager !== null && (!supportedLanguages || supportedLanguages.size === 0);
  }

  /**
   * Wait for code search initialization and re-check
   */
  private waitForCodeSearchInit(): void {
    console.debug('[FileSearchManager] checkForFileSearch: waiting for code search initialization...');
    this.codeSearchManager?.isAvailable().then(() => {
      if (this.textInput && this.textInput.value.includes(`@${this.currentQuery}`)) {
        this.checkForFileSearch();
      }
    });
  }

  /**
   * Check if code search is supported for the given language
   */
  private isCodeSearchSupported(
    rgAvailable: boolean,
    supportedLanguages: Map<string, unknown> | undefined,
    language: string
  ): boolean {
    return rgAvailable && supportedLanguages !== undefined && supportedLanguages.has(language);
  }

  /**
   * Execute code search with the given parameters
   */
  private executeCodeSearch(
    language: string,
    symbolQuery: string,
    symbolTypeFilter: string | null,
    startPos: number
  ): void {
    console.debug('[FileSearchManager] checkForFileSearch: code search pattern detected:', language, symbolQuery);
    this.atStartPosition = startPos;
    this.currentQuery = `${language}:${symbolQuery}`;
    this.codeSearchQuery = symbolQuery;

    const shouldRefresh = this.shouldRefreshCodeSearchCache(language);
    this.codeSearchLanguage = language;
    if (shouldRefresh) {
      this.codeSearchCacheRefreshed = true;
      console.debug('[FileSearchManager] checkForFileSearch: triggering cache refresh for language:', language);
    }

    this.searchSymbols(language, symbolQuery, symbolTypeFilter, shouldRefresh);
  }

  /**
   * Determine if code search cache should be refreshed
   */
  private shouldRefreshCodeSearchCache(language: string): boolean {
    return !this.codeSearchCacheRefreshed || this.codeSearchLanguage !== language;
  }

  /**
   * Handle unsupported code search language
   */
  private handleUnsupportedCodeSearch(
    rgAvailable: boolean,
    supportedLanguages: Map<string, unknown> | undefined,
    language: string
  ): void {
    console.debug('[FileSearchManager] checkForFileSearch: code search not available, rgAvailable=', rgAvailable);
    const langInfo = supportedLanguages?.get(language);
    if (!langInfo && rgAvailable) {
      this.callbacks.updateHintText?.(`Unknown language: ${language}`);
    }
    this.hideSuggestions();
  }

  /**
   * Handle normal file search (non-code search)
   */
  private handleNormalFileSearch(query: string, startPos: number): void {
    this.atStartPosition = startPos;
    this.currentQuery = query;
    console.debug('[FileSearchManager] showing suggestions for query:', query);
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
   * Delegates filtering logic to CodeSearchManager
   */
  private async searchSymbols(language: string, query: string, symbolTypeFilter: string | null = null, refreshCache: boolean = false): Promise<void> {
    if (!this.cachedDirectoryData?.directory || !this.codeSearchManager) {
      console.debug('[FileSearchManager] searchSymbols: no directory or manager');
      return;
    }

    const filtered = await this.codeSearchManager.searchSymbols(
      this.cachedDirectoryData.directory,
      language,
      query,
      { symbolTypeFilter, refreshCache }
    );

    this.updateSymbolSearchResults(filtered, language, query);
  }

  /**
   * Update state and UI with symbol search results
   */
  private updateSymbolSearchResults(filtered: SymbolResult[], language: string, query: string): void {
    const maxSuggestions = 20;
    this.filteredSymbols = filtered.slice(0, maxSuggestions);
    this.filteredFiles = [];
    this.filteredAgents = [];

    this.mergedSuggestions = this.filteredSymbols.map((symbol, index) => ({
      type: 'symbol' as const,
      symbol,
      score: 1000 - index
    }));

    this.selectedIndex = 0;
    this.isVisible = true;

    this.displaySymbolResults(language, query);
  }

  /**
   * Display symbol search results or show empty state
   */
  private displaySymbolResults(language: string, query: string): void {
    if (this.mergedSuggestions.length > 0) {
      this.showSymbolSuggestionsUI(language);
    } else {
      this.showNoSymbolsFound(query);
    }
  }

  /**
   * Show symbol suggestions UI
   */
  private showSymbolSuggestionsUI(language: string): void {
    this.suggestionListManager?.show(this.mergedSuggestions, this.atStartPosition, false);
    this.popupManager.showTooltipForSelectedItem();
    const langInfo = this.codeSearchManager?.getSupportedLanguages().get(language);
    this.callbacks.updateHintText?.(`${this.filteredSymbols.length} ${langInfo?.displayName || language} symbols`);
  }

  /**
   * Show no symbols found message
   */
  private showNoSymbolsFound(query: string): void {
    this.callbacks.updateHintText?.(`No symbols found for "${query}"`);
    this.hideSuggestions();
  }

  /**
   * Show file suggestions based on the query
   * Delegates to SuggestionStateManager for state management
   */
  public async showSuggestions(query: string): Promise<void> {
    console.debug('[FileSearchManager] showSuggestions called', formatLog({
      query,
      currentPath: this.currentPath,
      hasSuggestionsContainer: !!this.suggestionsContainer,
      hasCachedData: !!this.cachedDirectoryData,
      isInSymbolMode: this.isInSymbolMode
    }));

    if (!this.suggestionsContainer) {
      console.debug('[FileSearchManager] showSuggestions: early return - missing container');
      return;
    }

    // If in symbol mode, show filtered symbols instead of files
    if (this.isInSymbolMode) {
      this.currentQuery = query;
      await this.showSymbolSuggestions(query);
      return;
    }

    // Delegate to SuggestionStateManager
    await this.suggestionStateManager.showSuggestions(query);
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
      console.error('[FileSearchManager] Failed to search agents:', error);
    }
    return [];
  }

  /**
   * Adjust currentPath to match the query
   * Delegates to FileFilterManager
   */
  private adjustCurrentPathToQuery(query: string): void {
    const newPath = this.fileFilterManager.adjustCurrentPathToQuery(this.currentPath, query);
    if (newPath !== this.currentPath) {
      console.debug('[FileSearchManager] adjustCurrentPathToQuery: navigating', formatLog({
        from: this.currentPath,
        to: newPath,
        query
      }));
      this.currentPath = newPath;
    }
  }

  /**
   * Hide the suggestions dropdown
   */
  public hideSuggestions(): void {
    if (!this.suggestionsContainer) return;

    this.hideUIComponents();
    this.clearLocalState();
    this.resetSearchState();
    this.resetSymbolState();
    this.hidePopups();
  }

  /**
   * Hide UI components
   */
  private hideUIComponents(): void {
    this.suggestionListManager?.hide();
    this.suggestionStateManager.hideSuggestions();

    this.isVisible = false;
    if (this.suggestionsContainer) {
      this.suggestionsContainer.style.display = 'none';
      this.clearSuggestionsContainer();
    }
  }

  /**
   * Clear suggestions container DOM
   */
  private clearSuggestionsContainer(): void {
    if (!this.suggestionsContainer) return;
    while (this.suggestionsContainer.firstChild) {
      this.suggestionsContainer.removeChild(this.suggestionsContainer.firstChild);
    }
  }

  /**
   * Clear local state arrays
   */
  private clearLocalState(): void {
    this.filteredFiles = [];
    this.filteredAgents = [];
    this.filteredSymbols = [];
    this.mergedSuggestions = [];
    this.currentQuery = '';
    this.atStartPosition = -1;
    this.currentPath = '';
  }

  /**
   * Reset code search state
   */
  private resetSearchState(): void {
    this.codeSearchQuery = '';
    this.codeSearchLanguage = '';
    this.codeSearchCacheRefreshed = false;
  }

  /**
   * Reset symbol mode state
   */
  private resetSymbolState(): void {
    this.isInSymbolMode = false;
    this.currentFilePath = '';
    this.currentFileSymbols = [];
  }

  /**
   * Hide popup components
   */
  private hidePopups(): void {
    this.popupManager.hideFrontmatterPopup();
    this.popupManager.cancelPopupHide();
  }

  /**
   * Remove the @query text from the textarea without inserting a file path
   * Used when opening a file with Ctrl+Enter
   * Delegates to TextInputPathManager
   */
  private removeAtQueryText(): void {
    this.textInputPathManager.removeAtQueryText(this.atStartPosition);
  }

  /**
   * Filter files based on query (fuzzy matching) and currentPath
   * Delegates to FileFilterManager
   */
  public filterFiles(query: string): FileInfo[] {
    return this.fileFilterManager.filterFiles(this.cachedDirectoryData, this.currentPath, query);
  }

  /**
   * Count files in a directory (direct children only)
   * Delegates to FileFilterManager
   */
  private countFilesInDirectory(dirPath: string): number {
    return this.fileFilterManager.countFilesInDirectory(this.cachedDirectoryData, dirPath);
  }

  /**
   * Merge files and agents into a single sorted list based on match score
   * Delegates to FileFilterManager
   */
  private mergeSuggestions(query: string, maxSuggestions?: number): SuggestionItem[] {
    return this.fileFilterManager.mergeSuggestions(
      this.filteredFiles,
      this.filteredAgents,
      query,
      maxSuggestions
    );
  }

  /**
   * Select an item from merged suggestions by index
   * Delegates to ItemSelectionManager
   */
  private selectItem(index: number): void {
    const suggestion = this.mergedSuggestions[index];
    if (suggestion) {
      this.itemSelectionManager.selectItem(suggestion);
    }
  }

  /**
   * Select a symbol and insert its path:lineNumber#symbolName
   * Delegates to ItemSelectionManager
   */
  private selectSymbol(symbol: SymbolResult): void {
    this.itemSelectionManager.selectSymbol(symbol);
  }

  /**
   * Handle keyboard navigation
   * Supports: ArrowDown/Ctrl+n/Ctrl+j (next), ArrowUp/Ctrl+p/Ctrl+k (previous), Enter/Tab (select), Escape (close), Ctrl+i (toggle tooltip)
   */
  public handleKeyDown(e: KeyboardEvent): void {
    this.keyboardNavigationManager.handleKeyDown(e);
  }

  /**
   * Update visual selection state
   */
  private updateSelection(): void {
    if (!this.suggestionsContainer) return;

    const items = this.suggestionsContainer.querySelectorAll('.file-suggestion-item');
    items.forEach((item, index) => {
      if (index === this.selectedIndex) {
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
  private expandCurrentDirectory(): void {
    this.navigationManager.expandCurrentDirectory(this.currentPath);
  }

  /**
   * Expand current file path (for Enter/Tab when no symbol is selected in symbol mode)
   * Delegates to SymbolModeUIManager
   */
  private expandCurrentFile(): void {
    this.symbolModeUIManager.expandCurrentFile();
  }

  /**
   * Update text input with the current path (keeps @ and updates the path after it)
   * Delegates to TextInputPathManager
   */
  private updateTextInputWithPath(path: string): void {
    this.textInputPathManager.updateTextInputWithPath(path, this.atStartPosition);
  }

  /**
   * Get language info for a file based on its extension or filename
   */
  private getLanguageForFile(filename: string): LanguageInfo | null {
    // Delegate to CodeSearchManager
    return this.codeSearchManager?.getLanguageForFile(filename) || null;
  }

  /**
   * Navigate into a file to show its symbols (similar to navigateIntoDirectory)
   * Delegates to NavigationManager
   */
  private async navigateIntoFile(relativePath: string, absolutePath: string, language: LanguageInfo): Promise<void> {
    await this.navigationManager.navigateIntoFile(relativePath, absolutePath, language);
  }

  /**
   * Show symbol suggestions for the current file
   * Delegates to SymbolModeUIManager
   */
  private async showSymbolSuggestions(query: string): Promise<void> {
    await this.symbolModeUIManager.showSymbolSuggestions(query);
  }

  /**
   * Exit symbol mode and return to file list
   * Delegates to SymbolModeUIManager
   */
  private exitSymbolMode(): void {
    this.symbolModeUIManager.exitSymbolMode();
  }

  /**
   * Insert file path, keeping the @ and replacing only the query part
   * Delegates to TextInputPathManager
   */
  public insertFilePath(path: string): void {
    this.atStartPosition = this.textInputPathManager.insertFilePath(path, this.atStartPosition);
  }

  /**
   * Insert file path without the @ symbol
   * Replaces both @ and query with just the path
   * Delegates to TextInputPathManager
   */
  private insertFilePathWithoutAt(path: string): void {
    this.atStartPosition = this.textInputPathManager.insertFilePathWithoutAt(path, this.atStartPosition);
  }

  /**
   * Handle backspace key to delete entire @path if cursor is at the end
   * Delegates to AtPathBehaviorManager
   */
  private handleBackspaceForAtPath(e: KeyboardEvent): void {
    this.atPathBehaviorManager.handleBackspaceForAtPath(e);
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
      this.atPaths = this.highlightManager.getAtPaths();
    }
  }

  /**
   * Build a set of valid paths from cached directory data
   */
  private buildValidPathsSet(): Set<string> | null {
    return this.atPathBehaviorManager.buildValidPathsSet();
  }

  /**
   * Clear all tracked @paths (called when text is cleared)
   */
  public clearAtPaths(): void {
    this.atPaths = [];
    this.selectedPaths.clear();
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
      hasTextInput: !!this.textInput,
      hasHighlightManager: !!this.highlightManager,
      hasCachedData: !!this.cachedDirectoryData,
      cachedFileCount: this.cachedDirectoryData?.files?.length || 0,
      checkFilesystem
    }));

    // Delegate to HighlightManager
    if (this.highlightManager) {
      await this.highlightManager.restoreAtPathsFromText(checkFilesystem, this.cachedDirectoryData);
      // Sync local state with HighlightManager
      this.atPaths = this.highlightManager.getAtPaths();
      this.selectedPaths = this.highlightManager.getSelectedPaths();
    }
  }

  /**
   * Check if suggestions are currently visible
   */
  public isActive(): boolean {
    return this.isVisible;
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    this.hideSuggestions();
    this.cachedDirectoryData = null;

    // Clean up mirror div
    if (this.mirrorDiv && this.mirrorDiv.parentNode) {
      this.mirrorDiv.parentNode.removeChild(this.mirrorDiv);
      this.mirrorDiv = null;
    }

    // Clean up modular managers
    this.highlightManager = null;
    this.suggestionListManager = null;
    this.codeSearchManager = null;
    this.fileOpenerManager = null;
    this.directoryCacheManager = null;
  }
}
