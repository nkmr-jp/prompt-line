/**
 * ManagerFactory - Factory for creating FileSearchManager's sub-managers
 *
 * Extracted from FileSearchManager to reduce constructor complexity.
 * This factory creates and wires up all sub-managers with their callbacks.
 */

import type { FileInfo, AgentItem } from '../../../types';
import type { SymbolResult, LanguageInfo } from '../../code-search/types';
import type { FileSearchCallbacks, SuggestionItem } from '../types';

import { PopupManager } from './popup-manager';
import { SettingsCacheManager } from './settings-cache-manager';
import { FileFilterManager } from './file-filter-manager';
import { TextInputPathManager } from './text-input-path-manager';
import { SymbolModeUIManager } from './symbol-mode-ui-manager';
import { AtPathBehaviorManager } from './at-path-behavior-manager';
import { ItemSelectionManager } from './item-selection-manager';
import { NavigationManager } from './navigation-manager';
import { KeyboardNavigationManager } from './keyboard-navigation-manager';
import { EventListenerManager } from './event-listener-manager';
import { QueryExtractionManager } from './query-extraction-manager';
import { SuggestionStateManager } from './suggestion-state-manager';
import { FileSearchState } from './file-search-state';

/**
 * Context for manager creation - provides access to shared state and methods
 */
export interface ManagerContext {
  state: FileSearchState;
  callbacks: FileSearchCallbacks;
  // Methods that sub-managers need to call back to
  getHighlightManager: () => { addSelectedPath: (p: string) => void; removeSelectedPath: (p: string) => void; clearFilePathHighlight: () => void; onCmdKeyDown: () => void; onCmdKeyUp: () => void; onMouseMove: (e: MouseEvent) => void } | null;
  getSuggestionListManager: () => { show: (s: SuggestionItem[], p: number, b: boolean) => void; update: (s: SuggestionItem[], b: boolean, i: number) => void; position: (p: number) => void } | null;
  getCodeSearchManager: () => {
    navigateIntoFile: (baseDir: string, relativePath: string, absolutePath: string, language: LanguageInfo) => Promise<void>;
    isInSymbolModeActive: () => boolean;
    getCurrentFileSymbols: () => SymbolResult[];
    searchSymbols: (d: string, l: string, q: string, o: { symbolTypeFilter?: string | null; refreshCache?: boolean }) => Promise<SymbolResult[]>;
    isAvailableSync: () => boolean;
    getSupportedLanguages: () => Map<string, LanguageInfo>;
  } | null;
  getPopupManager: () => PopupManager;
  getSettingsCacheManager: () => SettingsCacheManager;
  // Bound methods from FileSearchManager
  updateHighlightBackdrop: () => void;
  updateSelection: () => void;
  selectSymbol: (s: SymbolResult) => void;
  selectItem: (i: number) => void;
  getFileSearchMaxSuggestions: () => Promise<number>;
  showSuggestions: (q: string) => Promise<void>;
  hideSuggestions: () => void;
  insertFilePath: (p: string) => void;
  insertFilePathWithoutAt: (p: string) => void;
  navigateIntoFile: (r: string, a: string, l: LanguageInfo) => Promise<void>;
  getLanguageForFile: (f: string) => LanguageInfo | null;
  filterFiles: (q: string) => FileInfo[];
  mergeSuggestions: (q: string, m?: number) => SuggestionItem[];
  searchAgents: (q: string) => Promise<AgentItem[]>;
  matchesSearchPrefix: (q: string, t: 'command' | 'mention') => Promise<boolean>;
  getMaxSuggestions: (t: 'command' | 'mention') => Promise<number>;
  adjustCurrentPathToQuery: (q: string) => void;
  updateTextInputWithPath: (p: string) => void;
  checkForFileSearch: () => void;
  handleKeyDown: (e: KeyboardEvent) => void;
  handleBackspaceForAtPath: (e: KeyboardEvent) => void;
  handleCtrlEnterOpenFile: (e: KeyboardEvent) => Promise<void>;
  handleCmdClickOnAtPath: (e: MouseEvent) => Promise<void>;
  handleMouseMove: (e: MouseEvent) => void;
  syncBackdropScroll: () => void;
  updateCursorPositionHighlight: () => void;
  showSymbolSuggestions: (q: string) => Promise<void>;
  navigateIntoDirectory: (f: FileInfo) => void;
  expandCurrentDirectory: () => void;
  expandCurrentFile: () => void;
  exitSymbolMode: () => void;
  removeAtQueryText: () => void;
  openFileAndRestoreFocus: (p: string) => Promise<void>;
  isIndexBeingBuilt: () => boolean;
  showIndexingHint: () => void;
  restoreDefaultHint: () => void;
  getTotalItemCount: () => number;
}

/**
 * Created managers container
 */
export interface CreatedManagers {
  popupManager: PopupManager;
  settingsCacheManager: SettingsCacheManager;
  fileFilterManager: FileFilterManager;
  textInputPathManager: TextInputPathManager;
  symbolModeUIManager: SymbolModeUIManager;
  atPathBehaviorManager: AtPathBehaviorManager;
  itemSelectionManager: ItemSelectionManager;
  navigationManager: NavigationManager;
  keyboardNavigationManager: KeyboardNavigationManager;
  eventListenerManager: EventListenerManager;
  queryExtractionManager: QueryExtractionManager;
  suggestionStateManager: SuggestionStateManager;
}

/**
 * Factory class for creating FileSearchManager's sub-managers
 */
export class ManagerFactory {
  /**
   * Create core managers (PopupManager, SettingsCacheManager, FileFilterManager)
   */
  static createCoreManagers(ctx: ManagerContext): Pick<CreatedManagers, 'popupManager' | 'settingsCacheManager' | 'fileFilterManager'> {
    const popupManager = new PopupManager({
      getSelectedSuggestion: () => ctx.state.mergedSuggestions[ctx.state.selectedIndex] || null,
      getSuggestionsContainer: () => ctx.state.suggestionsContainer
    });

    const settingsCacheManager = new SettingsCacheManager();

    const fileFilterManager = new FileFilterManager({
      getDefaultMaxSuggestions: () => settingsCacheManager.getDefaultMaxSuggestions()
    });

    return { popupManager, settingsCacheManager, fileFilterManager };
  }

  /**
   * Create input managers (TextInputPathManager, AtPathBehaviorManager)
   */
  static createInputManagers(ctx: ManagerContext): Pick<CreatedManagers, 'textInputPathManager' | 'atPathBehaviorManager'> {
    const textInputPathManager = new TextInputPathManager({
      getTextContent: () => ctx.callbacks.getTextContent(),
      setTextContent: (text: string) => ctx.callbacks.setTextContent(text),
      getCursorPosition: () => ctx.callbacks.getCursorPosition(),
      setCursorPosition: (pos: number) => ctx.callbacks.setCursorPosition(pos),
      replaceRangeWithUndo: ctx.callbacks.replaceRangeWithUndo
        ? (start: number, end: number, text: string) => ctx.callbacks.replaceRangeWithUndo!(start, end, text)
        : undefined,
      addSelectedPath: (path: string) => {
        ctx.state.addSelectedPath(path);
        ctx.getHighlightManager()?.addSelectedPath(path);
      },
      updateHighlightBackdrop: () => ctx.updateHighlightBackdrop()
    });

    const atPathBehaviorManager = new AtPathBehaviorManager({
      getTextContent: () => ctx.callbacks.getTextContent(),
      setTextContent: (text: string) => ctx.callbacks.setTextContent(text),
      getCursorPosition: () => ctx.callbacks.getCursorPosition(),
      setCursorPosition: (pos: number) => ctx.callbacks.setCursorPosition(pos),
      replaceRangeWithUndo: ctx.callbacks.replaceRangeWithUndo
        ? (start: number, end: number, text: string) => ctx.callbacks.replaceRangeWithUndo!(start, end, text)
        : undefined,
      getAtPaths: () => ctx.state.atPaths,
      getSelectedPaths: () => ctx.state.selectedPaths,
      removeSelectedPath: (path: string) => {
        ctx.state.removeSelectedPath(path);
        ctx.getHighlightManager()?.removeSelectedPath(path);
      },
      updateHighlightBackdrop: () => ctx.updateHighlightBackdrop(),
      getCachedDirectoryData: () => ctx.state.cachedDirectoryData
    });

    return { textInputPathManager, atPathBehaviorManager };
  }

  /**
   * Create UI managers (SymbolModeUIManager, ItemSelectionManager, NavigationManager)
   */
  static createUIManagers(ctx: ManagerContext, symbolModeUIManager: SymbolModeUIManager): Pick<CreatedManagers, 'symbolModeUIManager' | 'itemSelectionManager' | 'navigationManager'> {
    const itemSelectionManager = new ItemSelectionManager({
      getCachedDirectoryData: () => ctx.state.cachedDirectoryData,
      getTextInput: () => ctx.state.textInput,
      getAtStartPosition: () => ctx.state.atStartPosition,
      insertFilePath: (path: string) => ctx.insertFilePath(path),
      insertFilePathWithoutAt: (path: string) => ctx.insertFilePathWithoutAt(path),
      hideSuggestions: () => ctx.hideSuggestions(),
      onFileSelected: (path: string) => ctx.callbacks.onFileSelected(path),
      navigateIntoFile: (relativePath: string, absolutePath: string, language: LanguageInfo) =>
        ctx.navigateIntoFile(relativePath, absolutePath, language),
      getLanguageForFile: (fileName: string) => ctx.getLanguageForFile(fileName),
      isCodeSearchAvailable: () => ctx.getCodeSearchManager()?.isAvailableSync() || false,
      replaceRangeWithUndo: ctx.callbacks.replaceRangeWithUndo
        ? (start: number, end: number, text: string) => ctx.callbacks.replaceRangeWithUndo!(start, end, text)
        : undefined,
      addSelectedPath: (path: string) => {
        ctx.state.addSelectedPath(path);
        ctx.getHighlightManager()?.addSelectedPath(path);
      },
      updateHighlightBackdrop: () => ctx.updateHighlightBackdrop(),
      resetCodeSearchState: () => ctx.state.resetCodeSearchState()
    });

    const navigationManager = new NavigationManager({
      getCachedDirectoryData: () => ctx.state.cachedDirectoryData,
      getCodeSearchManager: () => ctx.getCodeSearchManager(),
      updateTextInputWithPath: (path: string) => ctx.updateTextInputWithPath(path),
      filterFiles: (query: string) => ctx.filterFiles(query),
      mergeSuggestions: (query: string) => ctx.mergeSuggestions(query),
      updateSuggestionList: (suggestions: SuggestionItem[], showPath: boolean, selectedIndex: number) =>
        ctx.getSuggestionListManager()?.update(suggestions, showPath, selectedIndex),
      showTooltipForSelectedItem: () => ctx.getPopupManager().showTooltipForSelectedItem(),
      insertFilePath: (path: string) => ctx.insertFilePath(path),
      hideSuggestions: () => ctx.hideSuggestions(),
      onFileSelected: (path: string) => ctx.callbacks.onFileSelected(path),
      showSymbolSuggestions: (query: string) => ctx.showSymbolSuggestions(query),
      setCurrentPath: (path: string) => { ctx.state.currentPath = path; },
      setCurrentQuery: (query: string) => { ctx.state.currentQuery = query; },
      setSelectedIndex: (index: number) => { ctx.state.selectedIndex = index; },
      setFilteredFiles: (files: FileInfo[]) => { ctx.state.filteredFiles = files; },
      setFilteredAgents: (agents: never[]) => { ctx.state.filteredAgents = agents; },
      setMergedSuggestions: (suggestions: SuggestionItem[]) => { ctx.state.mergedSuggestions = suggestions; },
      setIsInSymbolMode: (value: boolean) => { symbolModeUIManager.setState({ isInSymbolMode: value }); },
      setCurrentFilePath: (path: string) => { symbolModeUIManager.setState({ currentFilePath: path }); },
      setCurrentFileSymbols: (symbols: SymbolResult[]) => { symbolModeUIManager.setState({ currentFileSymbols: symbols }); }
    });

    return { symbolModeUIManager, itemSelectionManager, navigationManager };
  }

  /**
   * Create SymbolModeUIManager separately (needed before createUIManagers)
   */
  static createSymbolModeUIManager(ctx: ManagerContext): SymbolModeUIManager {
    return new SymbolModeUIManager({
      getSuggestionsContainer: () => ctx.state.suggestionsContainer,
      getCurrentFileSymbols: () => {
        // Will be set properly after initialization
        return [];
      },
      setMergedSuggestions: (suggestions) => { ctx.state.mergedSuggestions = suggestions; },
      getMergedSuggestions: () => ctx.state.mergedSuggestions,
      getSelectedIndex: () => ctx.state.selectedIndex,
      setSelectedIndex: (index) => { ctx.state.selectedIndex = index; },
      setIsVisible: (visible) => { ctx.state.isVisible = visible; },
      getCurrentFilePath: () => '',  // Will be overridden
      getAtStartPosition: () => ctx.state.atStartPosition,
      updateSelection: () => ctx.updateSelection(),
      selectSymbol: (symbol) => ctx.selectSymbol(symbol),
      positionPopup: (atStartPos) => ctx.getSuggestionListManager()?.position(atStartPos),
      updateHintText: ctx.callbacks.updateHintText
        ? (text: string) => ctx.callbacks.updateHintText!(text)
        : undefined,
      getDefaultHintText: ctx.callbacks.getDefaultHintText
        ? () => ctx.callbacks.getDefaultHintText!()
        : undefined,
      getFileSearchMaxSuggestions: () => ctx.getFileSearchMaxSuggestions(),
      showSuggestions: (query) => ctx.showSuggestions(query),
      insertFilePath: (path) => ctx.insertFilePath(path),
      hideSuggestions: () => ctx.hideSuggestions(),
      onFileSelected: (path) => ctx.callbacks.onFileSelected(path),
      setCurrentQuery: (query) => { ctx.state.currentQuery = query; },
      getCurrentPath: () => ctx.state.currentPath
    });
  }

  /**
   * Create keyboard and event managers
   */
  static createEventManagers(ctx: ManagerContext, symbolModeUIManager: SymbolModeUIManager): Pick<CreatedManagers, 'keyboardNavigationManager' | 'eventListenerManager'> {
    const keyboardNavigationManager = new KeyboardNavigationManager({
      getIsVisible: () => ctx.state.isVisible,
      getSelectedIndex: () => ctx.state.selectedIndex,
      getTotalItemCount: () => ctx.getTotalItemCount(),
      getMergedSuggestions: () => ctx.state.mergedSuggestions,
      getCachedDirectoryData: () => ctx.state.cachedDirectoryData,
      getIsInSymbolMode: () => symbolModeUIManager.isInSymbolMode(),
      getCurrentQuery: () => ctx.state.currentQuery,
      getIsComposing: ctx.callbacks.getIsComposing,
      setSelectedIndex: (index: number) => { ctx.state.selectedIndex = index; },
      updateSelection: () => ctx.updateSelection(),
      selectItem: (index: number) => ctx.selectItem(index),
      hideSuggestions: () => ctx.hideSuggestions(),
      expandCurrentDirectory: () => ctx.expandCurrentDirectory(),
      expandCurrentFile: () => ctx.expandCurrentFile(),
      navigateIntoDirectory: (file: FileInfo) => ctx.navigateIntoDirectory(file),
      exitSymbolMode: () => ctx.exitSymbolMode(),
      removeAtQueryText: () => ctx.removeAtQueryText(),
      openFileAndRestoreFocus: (filePath: string) => ctx.openFileAndRestoreFocus(filePath),
      insertFilePath: (path: string) => ctx.insertFilePath(path),
      onFileSelected: (path: string) => ctx.callbacks.onFileSelected(path),
      toggleAutoShowTooltip: () => ctx.getPopupManager().toggleAutoShowTooltip()
    });

    const eventListenerManager = new EventListenerManager({
      checkForFileSearch: () => ctx.checkForFileSearch(),
      updateHighlightBackdrop: () => ctx.updateHighlightBackdrop(),
      updateCursorPositionHighlight: () => ctx.updateCursorPositionHighlight(),
      handleKeyDown: (e: KeyboardEvent) => ctx.handleKeyDown(e),
      handleBackspaceForAtPath: (e: KeyboardEvent) => ctx.handleBackspaceForAtPath(e),
      handleCtrlEnterOpenFile: (e: KeyboardEvent) => ctx.handleCtrlEnterOpenFile(e),
      handleCmdClickOnAtPath: (e: MouseEvent) => ctx.handleCmdClickOnAtPath(e),
      handleMouseMove: (e: MouseEvent) => ctx.handleMouseMove(e),
      isVisible: () => ctx.state.isVisible,
      hideSuggestions: () => ctx.hideSuggestions(),
      syncBackdropScroll: () => ctx.syncBackdropScroll(),
      clearFilePathHighlight: () => ctx.getHighlightManager()?.clearFilePathHighlight() ?? undefined,
      onCmdKeyDown: () => ctx.getHighlightManager()?.onCmdKeyDown() ?? undefined,
      onCmdKeyUp: () => ctx.getHighlightManager()?.onCmdKeyUp() ?? undefined,
      onMouseMove: (e: MouseEvent) => ctx.getHighlightManager()?.onMouseMove(e) ?? undefined
    });

    return { keyboardNavigationManager, eventListenerManager };
  }

  /**
   * Create query managers
   */
  static createQueryManagers(ctx: ManagerContext): Pick<CreatedManagers, 'queryExtractionManager' | 'suggestionStateManager'> {
    const queryExtractionManager = new QueryExtractionManager({
      getTextContent: () => ctx.callbacks.getTextContent(),
      getCursorPosition: () => ctx.callbacks.getCursorPosition()
    });

    const suggestionStateManager = new SuggestionStateManager({
      getCachedDirectoryData: () => ctx.state.cachedDirectoryData,
      getAtStartPosition: () => ctx.state.atStartPosition,
      getCurrentPath: () => ctx.state.currentPath,
      getCurrentQuery: () => ctx.state.currentQuery,
      getFilteredFiles: () => ctx.state.filteredFiles,
      getFilteredAgents: () => ctx.state.filteredAgents,
      getMergedSuggestions: () => ctx.state.mergedSuggestions,
      getSelectedIndex: () => ctx.state.selectedIndex,
      setCurrentPath: (path: string) => { ctx.state.currentPath = path; },
      setCurrentQuery: (query: string) => { ctx.state.currentQuery = query; },
      setFilteredFiles: (files: unknown[]) => { ctx.state.filteredFiles = files as FileInfo[]; },
      setFilteredAgents: (agents: AgentItem[]) => { ctx.state.filteredAgents = agents; },
      setMergedSuggestions: (suggestions: SuggestionItem[]) => { ctx.state.mergedSuggestions = suggestions; },
      setSelectedIndex: (index: number) => { ctx.state.selectedIndex = index; },
      setIsVisible: (visible: boolean) => { ctx.state.isVisible = visible; },
      adjustCurrentPathToQuery: (query: string) => ctx.adjustCurrentPathToQuery(query),
      filterFiles: (query: string) => ctx.filterFiles(query),
      mergeSuggestions: (query: string, maxSuggestions?: number) => ctx.mergeSuggestions(query, maxSuggestions),
      searchAgents: (query: string) => ctx.searchAgents(query),
      isIndexBeingBuilt: () => ctx.isIndexBeingBuilt(),
      showIndexingHint: () => ctx.showIndexingHint(),
      showSuggestionList: (suggestions: SuggestionItem[], atPosition: number, showPath: boolean) =>
        ctx.getSuggestionListManager()?.show(suggestions, atPosition, showPath),
      updateSuggestionList: (suggestions: SuggestionItem[], showPath: boolean, selectedIndex: number) =>
        ctx.getSuggestionListManager()?.update(suggestions, showPath, selectedIndex),
      showTooltipForSelectedItem: () => ctx.getPopupManager().showTooltipForSelectedItem(),
      matchesSearchPrefix: (query: string, type: 'command' | 'mention') => ctx.matchesSearchPrefix(query, type),
      getMaxSuggestions: (type: 'command' | 'mention') => ctx.getMaxSuggestions(type),
      restoreDefaultHint: () => ctx.restoreDefaultHint()
    });

    return { queryExtractionManager, suggestionStateManager };
  }
}

export default ManagerFactory;
