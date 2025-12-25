/**
 * File Search Manager for renderer process
 * Manages @ file mention functionality with incremental search
 */

import type { FileInfo, DirectoryInfo, AgentItem } from '../types';
import type { SymbolResult, LanguageInfo } from './code-search/types';
import { SYMBOL_TYPE_FROM_DISPLAY } from './code-search/types';
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
  KeyboardNavigationManager
} from './file-search/managers';

// Pattern to detect code search queries (e.g., @ts:, @go:, @py:)
const CODE_SEARCH_PATTERN = /^([a-z]+):(.*)$/;

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
  private popupManager: PopupManager;

  // SettingsCacheManager for settings caching
  private settingsCacheManager: SettingsCacheManager;

  // New modular managers (initialized in initializeElements after DOM is ready)
  private highlightManager: HighlightManager | null = null;
  private suggestionListManager: SuggestionListManager | null = null;
  private codeSearchManager: CodeSearchManager | null = null;
  private fileOpenerManager: FileOpenerManager | null = null;
  private directoryCacheManager: DirectoryCacheManager | null = null;
  private fileFilterManager: FileFilterManager;
  private textInputPathManager: TextInputPathManager;
  private symbolModeUIManager: SymbolModeUIManager;
  private atPathBehaviorManager: AtPathBehaviorManager;
  private itemSelectionManager: ItemSelectionManager;
  private navigationManager: NavigationManager;
  private keyboardNavigationManager: KeyboardNavigationManager;

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

    // Initialize PopupManager with callbacks
    this.popupManager = new PopupManager({
      getSelectedSuggestion: () => this.mergedSuggestions[this.selectedIndex] || null,
      getSuggestionsContainer: () => this.suggestionsContainer
    });

    // Initialize SettingsCacheManager
    this.settingsCacheManager = new SettingsCacheManager();

    // Initialize FileFilterManager
    this.fileFilterManager = new FileFilterManager({
      getDefaultMaxSuggestions: () => this.settingsCacheManager.getDefaultMaxSuggestions()
    });

    // Initialize TextInputPathManager
    this.textInputPathManager = new TextInputPathManager({
      getTextContent: () => this.callbacks.getTextContent(),
      setTextContent: (text: string) => this.callbacks.setTextContent(text),
      getCursorPosition: () => this.callbacks.getCursorPosition(),
      setCursorPosition: (pos: number) => this.callbacks.setCursorPosition(pos),
      replaceRangeWithUndo: this.callbacks.replaceRangeWithUndo
        ? (start: number, end: number, text: string) => this.callbacks.replaceRangeWithUndo!(start, end, text)
        : undefined,
      addSelectedPath: (path: string) => {
        this.selectedPaths.add(path);
        this.highlightManager?.addSelectedPath(path);
        console.debug('[FileSearchManager] Added path to selectedPaths:', path, 'total:', this.selectedPaths.size);
      },
      updateHighlightBackdrop: () => this.updateHighlightBackdrop()
    });

    // Initialize SymbolModeUIManager
    this.symbolModeUIManager = new SymbolModeUIManager({
      getSuggestionsContainer: () => this.suggestionsContainer,
      getCurrentFileSymbols: () => this.symbolModeUIManager.getState().currentFileSymbols,
      setMergedSuggestions: (suggestions) => { this.mergedSuggestions = suggestions; },
      getMergedSuggestions: () => this.mergedSuggestions,
      getSelectedIndex: () => this.selectedIndex,
      setSelectedIndex: (index) => { this.selectedIndex = index; },
      setIsVisible: (visible) => { this.isVisible = visible; },
      getCurrentFilePath: () => this.symbolModeUIManager.getState().currentFilePath,
      getAtStartPosition: () => this.atStartPosition,
      updateSelection: () => this.updateSelection(),
      selectSymbol: (symbol) => this.selectSymbol(symbol),
      positionPopup: (atStartPos) => this.suggestionListManager?.position(atStartPos),
      updateHintText: this.callbacks.updateHintText
        ? (text: string) => this.callbacks.updateHintText!(text)
        : undefined,
      getDefaultHintText: this.callbacks.getDefaultHintText
        ? () => this.callbacks.getDefaultHintText!()
        : undefined,
      getFileSearchMaxSuggestions: () => this.getFileSearchMaxSuggestions(),
      showSuggestions: (query) => this.showSuggestions(query),
      insertFilePath: (path) => this.insertFilePath(path),
      hideSuggestions: () => this.hideSuggestions(),
      onFileSelected: (path) => this.callbacks.onFileSelected(path),
      setCurrentQuery: (query) => { this.currentQuery = query; },
      getCurrentPath: () => this.currentPath
    });

    // Initialize AtPathBehaviorManager
    this.atPathBehaviorManager = new AtPathBehaviorManager({
      getTextContent: () => this.callbacks.getTextContent(),
      setTextContent: (text: string) => this.callbacks.setTextContent(text),
      getCursorPosition: () => this.callbacks.getCursorPosition(),
      setCursorPosition: (pos: number) => this.callbacks.setCursorPosition(pos),
      replaceRangeWithUndo: this.callbacks.replaceRangeWithUndo
        ? (start: number, end: number, text: string) => this.callbacks.replaceRangeWithUndo!(start, end, text)
        : undefined,
      getAtPaths: () => this.atPaths,
      getSelectedPaths: () => this.selectedPaths,
      removeSelectedPath: (path: string) => {
        this.selectedPaths.delete(path);
        this.highlightManager?.removeSelectedPath(path);
      },
      updateHighlightBackdrop: () => this.updateHighlightBackdrop(),
      getCachedDirectoryData: () => this.cachedDirectoryData
    });

    // Initialize ItemSelectionManager
    this.itemSelectionManager = new ItemSelectionManager({
      getCachedDirectoryData: () => this.cachedDirectoryData,
      getTextInput: () => this.textInput,
      getAtStartPosition: () => this.atStartPosition,
      insertFilePath: (path: string) => this.insertFilePath(path),
      insertFilePathWithoutAt: (path: string) => this.insertFilePathWithoutAt(path),
      hideSuggestions: () => this.hideSuggestions(),
      onFileSelected: (path: string) => this.callbacks.onFileSelected(path),
      navigateIntoFile: (relativePath: string, absolutePath: string, language: LanguageInfo) =>
        this.navigateIntoFile(relativePath, absolutePath, language),
      getLanguageForFile: (fileName: string) => this.getLanguageForFile(fileName),
      isCodeSearchAvailable: () => this.codeSearchManager?.isAvailableSync() || false,
      replaceRangeWithUndo: this.callbacks.replaceRangeWithUndo
        ? (start: number, end: number, text: string) => this.callbacks.replaceRangeWithUndo!(start, end, text)
        : undefined,
      addSelectedPath: (path: string) => {
        this.selectedPaths.add(path);
        this.highlightManager?.addSelectedPath(path);
      },
      updateHighlightBackdrop: () => this.updateHighlightBackdrop(),
      resetCodeSearchState: () => {
        this.codeSearchQuery = '';
        this.codeSearchLanguage = '';
        this.codeSearchCacheRefreshed = false;
      }
    });

    // Initialize NavigationManager
    this.navigationManager = new NavigationManager({
      getCachedDirectoryData: () => this.cachedDirectoryData,
      getCodeSearchManager: () => this.codeSearchManager,
      updateTextInputWithPath: (path: string) => this.updateTextInputWithPath(path),
      filterFiles: (query: string) => this.filterFiles(query),
      mergeSuggestions: (query: string) => this.mergeSuggestions(query),
      updateSuggestionList: (suggestions: SuggestionItem[], showPath: boolean, selectedIndex: number) =>
        this.suggestionListManager?.update(suggestions, showPath, selectedIndex),
      showTooltipForSelectedItem: () => this.popupManager.showTooltipForSelectedItem(),
      insertFilePath: (path: string) => this.insertFilePath(path),
      hideSuggestions: () => this.hideSuggestions(),
      onFileSelected: (path: string) => this.callbacks.onFileSelected(path),
      showSymbolSuggestions: (query: string) => this.showSymbolSuggestions(query),
      setCurrentPath: (path: string) => { this.currentPath = path; },
      setCurrentQuery: (query: string) => { this.currentQuery = query; },
      setSelectedIndex: (index: number) => { this.selectedIndex = index; },
      setFilteredFiles: (files: FileInfo[]) => { this.filteredFiles = files; },
      setFilteredAgents: (agents: never[]) => { this.filteredAgents = agents; },
      setMergedSuggestions: (suggestions: SuggestionItem[]) => { this.mergedSuggestions = suggestions; },
      setIsInSymbolMode: (value: boolean) => { this.isInSymbolMode = value; },
      setCurrentFilePath: (path: string) => { this.currentFilePath = path; },
      setCurrentFileSymbols: (symbols: SymbolResult[]) => { this.currentFileSymbols = symbols; }
    });

    // Initialize KeyboardNavigationManager
    this.keyboardNavigationManager = new KeyboardNavigationManager({
      getIsVisible: () => this.isVisible,
      getSelectedIndex: () => this.selectedIndex,
      getTotalItemCount: () => this.getTotalItemCount(),
      getMergedSuggestions: () => this.mergedSuggestions,
      getCachedDirectoryData: () => this.cachedDirectoryData,
      getIsInSymbolMode: () => this.isInSymbolMode,
      getCurrentQuery: () => this.currentQuery,
      getIsComposing: this.callbacks.getIsComposing,
      setSelectedIndex: (index: number) => { this.selectedIndex = index; },
      updateSelection: () => this.updateSelection(),
      selectItem: (index: number) => this.selectItem(index),
      hideSuggestions: () => this.hideSuggestions(),
      expandCurrentDirectory: () => this.expandCurrentDirectory(),
      expandCurrentFile: () => this.expandCurrentFile(),
      navigateIntoDirectory: (file: FileInfo) => this.navigateIntoDirectory(file),
      exitSymbolMode: () => this.exitSymbolMode(),
      removeAtQueryText: () => this.removeAtQueryText(),
      openFileAndRestoreFocus: (filePath: string) => this.openFileAndRestoreFocus(filePath),
      insertFilePath: (path: string) => this.insertFilePath(path),
      onFileSelected: (path: string) => this.callbacks.onFileSelected(path),
      toggleAutoShowTooltip: () => this.popupManager.toggleAutoShowTooltip()
    });
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
    this.textInput = document.getElementById('textInput') as HTMLTextAreaElement;
    this.highlightBackdrop = document.getElementById('highlightBackdrop') as HTMLDivElement;
    console.debug('[FileSearchManager] initializeElements: textInput found:', !!this.textInput, 'highlightBackdrop found:', !!this.highlightBackdrop);

    // Create suggestions container if it doesn't exist
    this.suggestionsContainer = document.getElementById('fileSuggestions');
    if (!this.suggestionsContainer) {
      this.suggestionsContainer = document.createElement('div');
      this.suggestionsContainer.id = 'fileSuggestions';
      this.suggestionsContainer.className = 'file-suggestions';
      this.suggestionsContainer.setAttribute('role', 'listbox');
      this.suggestionsContainer.setAttribute('aria-label', 'File suggestions');

      // Insert into main-content (allows suggestions to span across input-section and history-section)
      const mainContent = document.querySelector('.main-content');
      if (mainContent) {
        mainContent.appendChild(this.suggestionsContainer);
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
    this.codeSearchManager = new CodeSearchManager({
      updateHintText: (text: string) => this.callbacks.updateHintText?.(text),
      getDefaultHintText: () => this.callbacks.getDefaultHintText?.() || ''
    });

    // Initialize DirectoryCacheManager
    this.directoryCacheManager = new DirectoryCacheManager({
      onIndexingStatusChange: (isBuilding: boolean, hint?: string) => {
        if (isBuilding && hint) {
          this.callbacks.updateHintText?.(hint);
        }
      },
      onCacheUpdated: (data) => {
        // Sync local copy for backward compatibility
        this.cachedDirectoryData = data;
        // Refresh suggestions if visible and not actively searching
        if (this.isVisible && !this.currentQuery) {
          this.refreshSuggestions();
        }
      },
      updateHintText: (text: string) => this.callbacks.updateHintText?.(text)
    });

    // Initialize HighlightManager (requires textInput and highlightBackdrop)
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
      // Set up valid paths builder for @path validation
      this.highlightManager.setValidPathsBuilder(() => this.buildValidPathsSet());
    }

    // Initialize FileOpenerManager
    this.fileOpenerManager = new FileOpenerManager({
      onBeforeOpenFile: () => {
        // Cleanup before opening file
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

    // Initialize SuggestionListManager (requires textInput)
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
            // Only show frontmatter popup for agent items
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

    // CodeSearchManager is initialized in constructor, no separate init needed
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

    console.debug('[FileSearchManager] setupEventListeners: setting up event listeners');

    // Listen for input changes to detect @ mentions and update highlights
    this.textInput.addEventListener('input', () => {
      console.debug('[FileSearchManager] input event fired');
      this.checkForFileSearch();
      this.updateHighlightBackdrop();
      // Update cursor position highlight after input
      this.updateCursorPositionHighlight();
    });

    // Listen for keydown for navigation and backspace handling
    this.textInput.addEventListener('keydown', (e) => {
      if (this.isVisible) {
        this.handleKeyDown(e);
      } else if (e.key === 'Backspace') {
        // Don't override Shift+Backspace or when text is selected
        if (e.shiftKey) return;
        if (this.textInput && this.textInput.selectionStart !== this.textInput.selectionEnd) return;
        // Handle backspace to delete entire @path if cursor is at the end of one
        this.handleBackspaceForAtPath(e);
      } else if (e.key === 'Enter' && e.ctrlKey) {
        // Ctrl+Enter: open file at cursor position
        this.handleCtrlEnterOpenFile(e);
      }
    });

    // Listen for cursor position changes (click, arrow keys)
    this.textInput.addEventListener('click', () => {
      this.updateCursorPositionHighlight();
    });

    this.textInput.addEventListener('keyup', (e) => {
      // Update on arrow keys that move cursor
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
        this.updateCursorPositionHighlight();
      }
    });

    // Also listen for selectionchange on document (handles all cursor movements)
    document.addEventListener('selectionchange', () => {
      if (document.activeElement === this.textInput) {
        this.updateCursorPositionHighlight();
      }
    });

    // Sync scroll position between textarea and backdrop
    this.textInput.addEventListener('scroll', () => {
      this.syncBackdropScroll();
    });

    // Hide suggestions on blur (with small delay to allow click selection)
    this.textInput.addEventListener('blur', () => {
      setTimeout(() => {
        if (!this.suggestionsContainer?.contains(document.activeElement)) {
          this.hideSuggestions();
        }
      }, 150);
    });

    // Handle click outside
    document.addEventListener('click', (e) => {
      if (this.isVisible &&
          !this.suggestionsContainer?.contains(e.target as Node) &&
          !this.textInput?.contains(e.target as Node)) {
        this.hideSuggestions();
      }
    });

    // Handle Cmd+click on @path in textarea to open in editor
    this.textInput.addEventListener('click', (e) => {
      if (e.metaKey) {
        this.handleCmdClickOnAtPath(e);
      }
    });

    // Handle Cmd+hover for link style on @paths
    this.textInput.addEventListener('mousemove', (e) => {
      this.handleMouseMove(e);
    });

    // Clear link style when mouse leaves textarea
    this.textInput.addEventListener('mouseleave', () => {
      // Delegate to HighlightManager
      this.highlightManager?.clearFilePathHighlight();
    });

    // Handle Cmd key press/release for link style
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Meta') {
        // Delegate to HighlightManager
        this.highlightManager?.onCmdKeyDown();
      }
    });

    document.addEventListener('keyup', (e) => {
      if (e.key === 'Meta') {
        // Delegate to HighlightManager
        this.highlightManager?.onCmdKeyUp();
      }
    });

    // Clear on window blur (Cmd key release detection may fail)
    window.addEventListener('blur', () => {
      // Delegate to HighlightManager
      this.highlightManager?.onCmdKeyUp();
    });
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

    // Check for URL first
    const url = findUrlAtPosition(text, cursorPos);
    if (url) {
      await this.openUrlInBrowser(url.url);
      return true;
    }

    // Check for slash command (like /commit, /help) - only if command type is enabled
    if (this.isCommandEnabledSync()) {
      const slashCommand = findSlashCommandAtPosition(text, cursorPos);
      if (slashCommand) {
        try {
          const commandFilePath = await window.electronAPI.slashCommands.getFilePath(slashCommand.command);
          if (commandFilePath) {
            await this.openFileAndRestoreFocus(commandFilePath);
            return true;
          }
        } catch (err) {
          console.error('Failed to resolve slash command file path:', err);
        }
        return true; // Return true even on error to prevent event propagation
      }
    }

    // Find @path at cursor position
    const atPath = findAtPathAtPosition(text, cursorPos);
    if (atPath) {
      const looksLikeFilePath = atPath.includes('/') || atPath.includes('.');

      // Try to resolve as file path first if it looks like one
      if (looksLikeFilePath) {
        const filePath = resolveAtPathToAbsolute(atPath, this.cachedDirectoryData?.directory, parsePathWithLineInfo, normalizePath);
        if (filePath) {
          await this.openFileAndRestoreFocus(filePath);
          return true;
        }
      }

      // Try to resolve as agent name (for names like @backend-architect)
      try {
        const agentFilePath = await window.electronAPI.agents.getFilePath(atPath);
        if (agentFilePath) {
          await this.openFileAndRestoreFocus(agentFilePath);
          return true;
        }
      } catch (err) {
        console.error('Failed to resolve agent file path:', err);
      }

      // Fallback: try to open as file path if it wasn't already tried
      if (!looksLikeFilePath) {
        const filePath = resolveAtPathToAbsolute(atPath, this.cachedDirectoryData?.directory, parsePathWithLineInfo, normalizePath);
        if (filePath) {
          await this.openFileAndRestoreFocus(filePath);
          return true;
        }
      }
      return true; // Return true even if nothing opened to prevent event propagation
    }

    // Find absolute path at cursor position
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
    // Skip if file search is disabled
    if (!this.fileSearchEnabled) {
      return;
    }

    console.debug('[FileSearchManager] checkForFileSearch called', formatLog({
      hasTextInput: !!this.textInput,
      hasCachedData: !!this.cachedDirectoryData,
      cachedDirectory: this.cachedDirectoryData?.directory,
      cachedFileCount: this.cachedDirectoryData?.files?.length
    }));

    if (!this.textInput || !this.cachedDirectoryData) {
      console.debug('[FileSearchManager] checkForFileSearch: early return - missing textInput or cachedDirectoryData');
      return;
    }

    const result = this.extractQueryAtCursor();
    console.debug('[FileSearchManager] extractQueryAtCursor result:', result ? formatLog(result as Record<string, unknown>) : 'null');

    if (result) {
      const { query, startPos } = result;

      // Check if query matches code search pattern (e.g., "ts:", "go:", "py:")
      // BUT skip if query matches a searchPrefix (e.g., "agent:", "skill:")
      const matchesSearchPrefix = this.matchesSearchPrefixSync(query, 'mention');
      const codeSearchMatch = query.match(CODE_SEARCH_PATTERN);
      console.debug('[FileSearchManager] checkForFileSearch: query=', query, 'codeSearchMatch=', codeSearchMatch, 'matchesSearchPrefix=', matchesSearchPrefix);
      if (codeSearchMatch && codeSearchMatch[1] && !matchesSearchPrefix) {
        const language = codeSearchMatch[1];
        // Parse query: "func:Create" → symbolTypeFilter="func", symbolQuery="Create"
        // Parse query: "func:" → symbolTypeFilter="func", symbolQuery=""
        // Parse query: "Handle" → symbolTypeFilter=null, symbolQuery="Handle"
        const rawQuery = codeSearchMatch[2] ?? '';
        const colonIndex = rawQuery.indexOf(':');
        let symbolTypeFilter: string | null = null;
        let symbolQuery: string;

        if (colonIndex >= 0) {
          const potentialType = rawQuery.substring(0, colonIndex).toLowerCase();
          if (SYMBOL_TYPE_FROM_DISPLAY[potentialType]) {
            symbolTypeFilter = potentialType;
            symbolQuery = rawQuery.substring(colonIndex + 1);
          } else {
            // Not a valid symbol type, treat entire string as query
            symbolQuery = rawQuery;
          }
        } else {
          symbolQuery = rawQuery;
        }

        console.debug('[FileSearchManager] checkForFileSearch: code pattern matched, language=', language, 'symbolTypeFilter=', symbolTypeFilter, 'symbolQuery=', symbolQuery);

        const supportedLanguages = this.codeSearchManager?.getSupportedLanguages();
        const rgAvailable = this.codeSearchManager?.isAvailableSync() ?? false;

        console.debug('[FileSearchManager] checkForFileSearch: rgAvailable=', rgAvailable, 'supportedLanguages.size=', supportedLanguages?.size, 'supportedLanguages.has(language)=', supportedLanguages?.has(language));

        // If code search not yet initialized, wait for it
        if (this.codeSearchManager && (!supportedLanguages || supportedLanguages.size === 0)) {
          console.debug('[FileSearchManager] checkForFileSearch: waiting for code search initialization...');
          this.codeSearchManager.isAvailable().then(() => {
            // Re-check after initialization (only if cursor position hasn't changed)
            if (this.textInput && this.textInput.value.includes(`@${query}`)) {
              this.checkForFileSearch();
            }
          });
          return;
        }

        // Check if language is supported
        if (rgAvailable && supportedLanguages?.has(language)) {
          console.debug('[FileSearchManager] checkForFileSearch: code search pattern detected:', language, symbolQuery);
          this.atStartPosition = startPos;
          this.currentQuery = query;
          this.codeSearchQuery = symbolQuery;

          // Determine if we need to refresh cache:
          // - First time entering code search mode for this language
          // - Language has changed
          const shouldRefresh = !this.codeSearchCacheRefreshed || this.codeSearchLanguage !== language;
          this.codeSearchLanguage = language;
          if (shouldRefresh) {
            this.codeSearchCacheRefreshed = true;
            console.debug('[FileSearchManager] checkForFileSearch: triggering cache refresh for language:', language);
          }

          this.searchSymbols(language, symbolQuery, symbolTypeFilter, shouldRefresh);
          return;
        } else {
          // Unknown language or rg not available - show hint and hide suggestions
          console.debug('[FileSearchManager] checkForFileSearch: code search not available, rgAvailable=', rgAvailable);
          const langInfo = supportedLanguages?.get(language);
          if (!langInfo && rgAvailable) {
            this.callbacks.updateHintText?.(`Unknown language: ${language}`);
          }
          this.hideSuggestions();
          return;
        }
      }

      // Normal file search
      this.atStartPosition = startPos;
      this.currentQuery = query;
      console.debug('[FileSearchManager] showing suggestions for query:', query);
      this.showSuggestions(query);
    } else {
      this.hideSuggestions();
    }
  }

  /**
   * Extract the @ query at the current cursor position
   * Returns null if no valid @ pattern is found
   */
  public extractQueryAtCursor(): { query: string; startPos: number } | null {
    if (!this.textInput) return null;

    const text = this.textInput.value;
    const cursorPos = this.textInput.selectionStart;

    // Find the @ before cursor
    let atPos = -1;
    for (let i = cursorPos - 1; i >= 0; i--) {
      const char = text[i];

      // Stop at whitespace or newline
      if (char === ' ' || char === '\n' || char === '\t') {
        break;
      }

      // Found @
      if (char === '@') {
        atPos = i;
        break;
      }
    }

    if (atPos === -1) return null;

    // Check that @ is at start of line or after whitespace
    if (atPos > 0) {
      const prevChar = text[atPos - 1];
      if (prevChar !== ' ' && prevChar !== '\n' && prevChar !== '\t') {
        return null; // @ is part of something else (like email)
      }
    }

    // Extract query (text after @ up to cursor)
    const query = text.substring(atPos + 1, cursorPos);

    return { query, startPos: atPos };
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

    // Delegate filtering/sorting to CodeSearchManager
    const filtered = await this.codeSearchManager.searchSymbols(
      this.cachedDirectoryData.directory,
      language,
      query,
      { symbolTypeFilter, refreshCache }
    );

    // Limit results and update state
    const maxSuggestions = 20;
    this.filteredSymbols = filtered.slice(0, maxSuggestions);
    this.filteredFiles = [];
    this.filteredAgents = [];

    // Convert to SuggestionItems
    this.mergedSuggestions = this.filteredSymbols.map((symbol, index) => ({
      type: 'symbol' as const,
      symbol,
      score: 1000 - index
    }));

    this.selectedIndex = 0;
    this.isVisible = true;

    if (this.mergedSuggestions.length > 0) {
      this.suggestionListManager?.show(this.mergedSuggestions, this.atStartPosition, false);
      this.popupManager.showTooltipForSelectedItem();
      const langInfo = this.codeSearchManager.getSupportedLanguages().get(language);
      this.callbacks.updateHintText?.(`${this.filteredSymbols.length} ${langInfo?.displayName || language} symbols`);
    } else {
      this.callbacks.updateHintText?.(`No symbols found for "${query}"`);
      this.hideSuggestions();
    }
  }

  /**
   * Show file suggestions based on the query
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

    // Check if query matches any searchPrefix for mention type
    // If so, skip file search and only show agents
    const matchesPrefix = await this.matchesSearchPrefix(query, 'mention');

    // Adjust currentPath based on query
    // If query doesn't start with currentPath, navigate up to the matching level
    // Skip path navigation when searchPrefix is matched (agents don't use paths)
    if (!matchesPrefix) {
      this.adjustCurrentPathToQuery(query);
    } else {
      this.currentPath = '';
    }

    // Extract search term (part after currentPath)
    const searchTerm = this.currentPath ? query.substring(this.currentPath.length) : query;

    this.currentQuery = searchTerm;

    // Fetch agents matching the query (only at root level without path navigation)
    if (!this.currentPath) {
      this.filteredAgents = await this.searchAgents(searchTerm);
    } else {
      this.filteredAgents = [];
    }

    // Check if index is being built
    const isIndexBuilding = this.isIndexBeingBuilt();

    // Filter files if directory data is available
    // Skip file search when searchPrefix is matched (show only agents)
    if (matchesPrefix) {
      this.filteredFiles = [];
    } else if (this.cachedDirectoryData) {
      this.filteredFiles = this.filterFiles(searchTerm);
    } else {
      this.filteredFiles = [];
    }

    // Get maxSuggestions setting for merged list
    const maxSuggestions = await this.getMaxSuggestions('mention');

    // Merge files and agents into a single sorted list
    this.mergedSuggestions = this.mergeSuggestions(searchTerm, maxSuggestions);

    this.selectedIndex = 0;
    this.isVisible = true;

    // Show indexing hint if index is being built (not relevant when prefix matched)
    if (isIndexBuilding && !matchesPrefix) {
      this.showIndexingHint();
    }

    console.debug('[FileSearchManager] showSuggestions: filtered', formatLog({
      agents: this.filteredAgents.length,
      files: this.filteredFiles.length,
      merged: this.mergedSuggestions.length,
      searchTerm,
      isIndexBuilding,
      matchesPrefix
    }));
    // Delegate rendering and positioning to SuggestionListManager
    this.suggestionListManager?.show(this.mergedSuggestions, this.atStartPosition, isIndexBuilding && !matchesPrefix);
    // Update popup tooltip for selected item
    this.popupManager.showTooltipForSelectedItem();
    console.debug('[FileSearchManager] showSuggestions: render complete, isVisible:', this.isVisible);
  }

  /**
   * Search agents via IPC
   */
  private async searchAgents(query: string): Promise<AgentItem[]> {
    try {
      const electronAPI = (window as any).electronAPI;
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

    // Delegate UI hiding to SuggestionListManager
    this.suggestionListManager?.hide();

    // Also handle local state (for backward compatibility during refactoring)
    this.isVisible = false;
    this.suggestionsContainer.style.display = 'none';
    // Clear container safely
    while (this.suggestionsContainer.firstChild) {
      this.suggestionsContainer.removeChild(this.suggestionsContainer.firstChild);
    }
    this.filteredFiles = [];
    this.filteredAgents = [];
    this.filteredSymbols = [];
    this.mergedSuggestions = [];
    this.currentQuery = '';
    this.atStartPosition = -1;
    this.currentPath = ''; // Reset directory navigation state

    // Reset code search state
    this.codeSearchQuery = '';
    this.codeSearchLanguage = '';
    this.codeSearchCacheRefreshed = false;

    // Reset symbol mode state
    this.isInSymbolMode = false;
    this.currentFilePath = '';
    this.currentFileSymbols = [];

    // Restore default hint text
    this.restoreDefaultHint();

    // Hide frontmatter popup
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
   * Get total count of merged suggestion items
   */
  private getTotalItemCount(): number {
    return this.mergedSuggestions.length;
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
