/**
 * MentionInitializer
 * Responsible for initializing all managers and DOM elements for MentionManager
 * Extracts initialization logic to reduce MentionManager complexity
 */

import type { FileInfo, AgentItem } from '../../../types';
import type { SymbolResult } from '../code-search/types';
import type { MentionCallbacks, SuggestionItem } from '..';
import { electronAPI } from '../../services/electron-api';
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
  MentionState
} from './index';

export interface MentionManagerDependencies {
  state: MentionState;
  callbacks: MentionCallbacks;
  popupManager: PopupManager;
  settingsCacheManager: SettingsCacheManager;
  fileFilterManager: FileFilterManager;
  pathManager: PathManager;
  navigationManager: NavigationManager;
  eventListenerManager: EventListenerManager;
  queryExtractionManager: QueryExtractionManager;
}

export interface InitializedManagers {
  highlightManager: HighlightManager;
  suggestionUIManager: SuggestionUIManager;
  codeSearchManager: CodeSearchManager;
  fileOpenerManager: FileOpenerEventHandler;
  directoryCacheManager: DirectoryCacheManager;
}

export interface MentionInitializerCallbacks {
  // State accessors
  isCommandEnabledSync: () => boolean;
  checkFileExistsAbsolute: (path: string) => Promise<boolean>;
  buildValidPathsSet: () => Set<string> | null;
  getTotalItemCount: () => number;
  _getFileSearchMaxSuggestions: () => Promise<number>;
  getCommandSource?: (commandName: string) => string | undefined;

  // Actions
  updateHighlightBackdrop: () => void;
  updateSelection: () => void;
  hideSuggestions: () => void;
  insertFilePath: (path: string) => void;
  insertFilePathWithoutAt: (path: string) => void;
  exitSymbolMode: () => void | undefined;
  removeAtQueryText: () => void;
  expandCurrentFile: () => void;
  updateTextInputWithPath: (path: string) => void;
  filterFiles: (query: string) => FileInfo[];
  mergeSuggestions: (query: string, maxSuggestions?: number) => SuggestionItem[];
  showSuggestions: (query: string) => void;
  _selectSymbol: (symbol: SymbolResult) => void;
  refreshSuggestions: () => void;
  restoreDefaultHint: () => void;
  selectItem: (index: number) => void;
  navigateIntoDirectory: (file: FileInfo) => void;
  countFilesInDirectory: (path: string) => number;
  adjustCurrentPathToQuery: (query: string) => void;
  searchAgents: (query: string) => Promise<AgentItem[]>;
  isIndexBeingBuilt: () => boolean;
  showIndexingHint: () => void;
  matchesSearchPrefix: (query: string, type: 'command' | 'mention') => Promise<boolean>;
  getMaxSuggestions: (type: 'command' | 'mention') => Promise<number>;

  // Getter/Setter wrappers for code search
  getIsInSymbolMode: () => boolean;
  setIsInSymbolMode: (value: boolean) => void;
  getCurrentFilePath: () => string;
  setCurrentFilePath: (path: string) => void;
  getCurrentFileSymbols: () => SymbolResult[];
  setCurrentFileSymbols: (symbols: SymbolResult[]) => void;
}

/**
 * MentionInitializer handles initialization of all MentionManager components
 */
export class MentionInitializer {
  private deps: MentionManagerDependencies;
  private callbacks: MentionInitializerCallbacks;

  constructor(
    deps: MentionManagerDependencies,
    callbacks: MentionInitializerCallbacks
  ) {
    this.deps = deps;
    this.callbacks = callbacks;
  }

  /**
   * Initialize all managers and DOM elements
   */
  public initializeAll(): InitializedManagers {
    this.initializeDOMElements();
    this.deps.popupManager.initialize();

    const codeSearchManager = this.initializeCodeSearchManager();
    const directoryCacheManager = this.initializeDirectoryCacheManager();
    const highlightManager = this.initializeHighlightManager();
    const fileOpenerManager = this.initializeFileOpenerManager();
    const suggestionUIManager = this.initializeSuggestionUIManager();

    return {
      highlightManager,
      suggestionUIManager,
      codeSearchManager,
      fileOpenerManager,
      directoryCacheManager
    };
  }

  /**
   * Initialize DOM elements
   */
  private initializeDOMElements(): void {
    this.deps.state.textInput = document.getElementById('textInput') as HTMLTextAreaElement;
    this.deps.state.highlightBackdrop = document.getElementById('highlightBackdrop') as HTMLDivElement;

    this.initializeSuggestionsContainer();
  }

  /**
   * Initialize suggestions container
   */
  private initializeSuggestionsContainer(): void {
    this.deps.state.suggestionsContainer = document.getElementById('fileSuggestions');
    if (!this.deps.state.suggestionsContainer) {
      this.deps.state.suggestionsContainer = document.createElement('div');
      this.deps.state.suggestionsContainer.id = 'fileSuggestions';
      this.deps.state.suggestionsContainer.className = 'file-suggestions';
      this.deps.state.suggestionsContainer.setAttribute('role', 'listbox');
      this.deps.state.suggestionsContainer.setAttribute('aria-label', 'File suggestions');

      const mainContent = document.querySelector('.main-content');
      if (mainContent) {
        mainContent.appendChild(this.deps.state.suggestionsContainer);
      } else {
        console.warn('[MentionInitializer] .main-content not found!');
      }
    }
  }

  /**
   * Initialize CodeSearchManager
   */
  private initializeCodeSearchManager(): CodeSearchManager {
    return new CodeSearchManager({
      updateHintText: (text: string) => this.deps.callbacks.updateHintText?.(text),
      getDefaultHintText: () => this.deps.callbacks.getDefaultHintText?.() || '',
      getCachedDirectoryData: () => null, // Will be set after directoryCacheManager is initialized
      getAtStartPosition: () => this.deps.state.atStartPosition,
      hideSuggestions: () => this.callbacks.hideSuggestions(),
      setFilteredSymbols: (symbols: SymbolResult[]) => { this.deps.state.filteredSymbols = symbols; },
      setFilteredFiles: (files: FileInfo[]) => { this.deps.state.filteredFiles = files; },
      setFilteredAgents: (agents: AgentItem[]) => { this.deps.state.filteredAgents = agents; },
      setMergedSuggestions: (suggestions: SuggestionItem[]) => { this.deps.state.mergedSuggestions = suggestions; },
      getMergedSuggestions: () => this.deps.state.mergedSuggestions,
      setSelectedIndex: (index: number) => { this.deps.state.selectedIndex = index; },
      getSelectedIndex: () => this.deps.state.selectedIndex,
      setIsVisible: (visible: boolean) => { this.deps.state.isVisible = visible; },
      getSuggestionsContainer: () => this.deps.state.suggestionsContainer,
      getCurrentFileSymbols: () => this.callbacks.getCurrentFileSymbols(),
      getCurrentFilePath: () => this.callbacks.getCurrentFilePath(),
      updateSelection: () => this.callbacks.updateSelection(),
      selectSymbol: (symbol: SymbolResult) => this.callbacks._selectSymbol(symbol),
      positionPopup: (_atStartPos: number) => null, // Will be set after suggestionUIManager is initialized
      getFileSearchMaxSuggestions: async () => this.callbacks._getFileSearchMaxSuggestions(),
      showSuggestions: (query: string) => this.callbacks.showSuggestions(query),
      insertFilePath: (path: string) => this.callbacks.insertFilePath(path),
      onFileSelected: (path: string) => this.deps.callbacks.onFileSelected(path),
      setCurrentQuery: (query: string) => { this.deps.state.currentQuery = query; },
      getCurrentPath: () => this.deps.state.currentPath,
      showTooltipForSelectedItem: () => this.deps.popupManager.showTooltipForSelectedItem(),
      renderSuggestions: (_suggestions: SuggestionItem[]) => null // Will be set after suggestionUIManager is initialized
    });
  }

  /**
   * Initialize DirectoryCacheManager
   */
  private initializeDirectoryCacheManager(): DirectoryCacheManager {
    return new DirectoryCacheManager({
      onIndexingStatusChange: (isBuilding: boolean, hint?: string) => {
        if (isBuilding && hint) {
          this.deps.callbacks.updateHintText?.(hint);
        }
      },
      onCacheUpdated: () => {
        if (this.deps.state.isVisible && !this.deps.state.currentQuery) {
          this.callbacks.refreshSuggestions();
        }
      },
      updateHintText: (text: string) => this.deps.callbacks.updateHintText?.(text)
    });
  }

  /**
   * Initialize HighlightManager
   */
  private initializeHighlightManager(): HighlightManager {
    if (!this.deps.state.textInput || !this.deps.state.highlightBackdrop) {
      throw new Error('Cannot initialize HighlightManager: textInput or highlightBackdrop is null');
    }

    const highlightManager = new HighlightManager(
      this.deps.state.textInput,
      this.deps.state.highlightBackdrop,
      {
        getTextContent: () => this.deps.state.textInput?.value || '',
        getCursorPosition: () => this.deps.state.textInput?.selectionStart || 0,
        updateHintText: (text: string) => this.deps.callbacks.updateHintText?.(text),
        getDefaultHintText: () => this.deps.callbacks.getDefaultHintText?.() || '',
        isFileSearchEnabled: () => this.deps.state.fileSearchEnabled,
        isCommandEnabledSync: () => this.callbacks.isCommandEnabledSync(),
        checkFileExists: async (path: string) => {
          try {
            return await electronAPI.file.checkExists(path);
          } catch {
            return false;
          }
        },
        ...(this.callbacks.getCommandSource && {
          getCommandSource: (commandName: string) => this.callbacks.getCommandSource?.(commandName)
        })
      },
      this.deps.pathManager
    );
    highlightManager.setValidPathsBuilder(() => this.callbacks.buildValidPathsSet() ?? new Set());
    return highlightManager;
  }

  /**
   * Initialize FileOpenerEventHandler
   */
  private initializeFileOpenerManager(): FileOpenerEventHandler {
    return new FileOpenerEventHandler({
      onBeforeOpenFile: () => this.callbacks.hideSuggestions(),
      setDraggable: (enabled: boolean) => this.deps.callbacks.setDraggable?.(enabled),
      getTextContent: () => this.deps.state.textInput?.value || '',
      setTextContent: (text: string) => {
        if (this.deps.state.textInput) {
          this.deps.state.textInput.value = text;
        }
      },
      getCursorPosition: () => this.deps.state.textInput?.selectionStart || 0,
      setCursorPosition: (position: number) => {
        if (this.deps.state.textInput) {
          this.deps.state.textInput.selectionStart = position;
          this.deps.state.textInput.selectionEnd = position;
        }
      },
      getCurrentDirectory: () => null, // Will be set after directoryCacheManager is initialized
      isCommandEnabledSync: () => this.callbacks.isCommandEnabledSync(),
      hideWindow: () => electronAPI.window.hide(),
      restoreDefaultHint: () => this.callbacks.restoreDefaultHint(),
      showError: (message: string) => this.deps.callbacks.showError?.(message)
    });
  }

  /**
   * Initialize SuggestionUIManager
   */
  private initializeSuggestionUIManager(): SuggestionUIManager {
    if (!this.deps.state.textInput) {
      throw new Error('Cannot initialize SuggestionUIManager: textInput is null');
    }

    return new SuggestionUIManager(
      this.deps.state.textInput,
      {
        onItemSelected: (index: number) => this.callbacks.selectItem(index),
        onNavigateIntoDirectory: (file: FileInfo) => this.callbacks.navigateIntoDirectory(file),
        onEscape: () => this.callbacks.hideSuggestions(),
        onOpenFileInEditor: async (filePath: string) => {
          await electronAPI.file.openInEditor(filePath);
        },
        getIsComposing: () => this.deps.callbacks.getIsComposing?.() || false,
        getCurrentPath: () => this.deps.state.currentPath,
        getBaseDir: () => '', // Will be set after directoryCacheManager is initialized
        getCurrentQuery: () => this.deps.state.currentQuery,
        getCodeSearchQuery: () => this.deps.state.codeSearchQuery,
        countFilesInDirectory: (path: string) => this.callbacks.countFilesInDirectory(path),
        onMouseEnterInfo: (suggestion: SuggestionItem, target: HTMLElement) => {
          if (suggestion.type === 'agent' && suggestion.agent) {
            this.deps.popupManager.showFrontmatterPopup(suggestion.agent, target);
          }
        },
        onMouseLeaveInfo: () => this.deps.popupManager.hideFrontmatterPopup(),
        getCachedDirectoryData: () => null, // Will be set after directoryCacheManager is initialized
        getAtStartPosition: () => this.deps.state.atStartPosition,
        adjustCurrentPathToQuery: (query: string) => this.callbacks.adjustCurrentPathToQuery(query),
        filterFiles: (query: string) => this.callbacks.filterFiles(query),
        mergeSuggestions: (query: string, maxSuggestions?: number) => this.callbacks.mergeSuggestions(query, maxSuggestions),
        searchAgents: async (query: string) => this.callbacks.searchAgents(query),
        isIndexBeingBuilt: () => this.callbacks.isIndexBeingBuilt(),
        showIndexingHint: () => this.callbacks.showIndexingHint(),
        restoreDefaultHint: () => this.callbacks.restoreDefaultHint(),
        matchesSearchPrefix: async (query: string, type: 'command' | 'mention') => this.callbacks.matchesSearchPrefix(query, type),
        getMaxSuggestions: async (type: 'command' | 'mention') => this.callbacks.getMaxSuggestions(type),
        showTooltipForSelectedItem: () => this.deps.popupManager.showTooltipForSelectedItem(),
        setCurrentPath: (path: string) => { this.deps.state.currentPath = path; },
        setCurrentQuery: (query: string) => { this.deps.state.currentQuery = query; },
        setFilteredFiles: (files: FileInfo[]) => { this.deps.state.filteredFiles = files; },
        setFilteredAgents: (agents: AgentItem[]) => { this.deps.state.filteredAgents = agents; },
        setMergedSuggestions: (suggestions: SuggestionItem[]) => { this.deps.state.mergedSuggestions = suggestions; },
        setSelectedIndex: (index: number) => { this.deps.state.selectedIndex = index; },
        setIsVisible: (visible: boolean) => { this.deps.state.isVisible = visible; }
      }
    );
  }

  /**
   * Wire up cross-manager dependencies after all managers are initialized
   */
  public wireDependencies(managers: InitializedManagers): void {
    // Update CodeSearchManager callbacks that depend on other managers
    const codeSearchCallbacks = managers.codeSearchManager as any;
    codeSearchCallbacks.callbacks.getCachedDirectoryData = () =>
      managers.directoryCacheManager.getCachedData() ?? null;
    codeSearchCallbacks.callbacks.positionPopup = (atStartPos: number) =>
      managers.suggestionUIManager.position(atStartPos);
    codeSearchCallbacks.callbacks.renderSuggestions = (suggestions: SuggestionItem[]) =>
      managers.suggestionUIManager.update(suggestions, false);

    // Update FileOpenerEventHandler callbacks
    const fileOpenerCallbacks = managers.fileOpenerManager as any;
    fileOpenerCallbacks.callbacks.getCurrentDirectory = () =>
      managers.directoryCacheManager.getDirectory() ?? null;

    // Update SuggestionUIManager callbacks
    const suggestionUICallbacks = managers.suggestionUIManager as any;
    suggestionUICallbacks.callbacks.getBaseDir = () =>
      managers.directoryCacheManager.getDirectory() ?? '';
    suggestionUICallbacks.callbacks.getCachedDirectoryData = () =>
      managers.directoryCacheManager.getCachedData() ?? null;
  }
}
