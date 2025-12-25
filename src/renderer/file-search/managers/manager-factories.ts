/**
 * Manager Factory Functions
 * Factory functions to create individual manager instances
 * Extracted from ManagerInitializer to reduce file complexity
 */

import type { FileSearchCallbacks, SuggestionItem } from '..';
import type { SymbolResult, LanguageInfo } from '../../code-search/types';
import type { FileInfo, AgentItem } from '../../../types';
import {
  PopupManager,
  SettingsCacheManager,
  FileFilterManager,
  TextInputPathManager,
  SymbolModeUIManager,
  AtPathBehaviorManager,
  ItemSelectionManager,
  NavigationManager,
  KeyboardNavigationManager,
  EventListenerManager,
  QueryExtractionManager,
  SuggestionStateManager
} from './index';
import type { ManagerState, ManagerDependencies } from './manager-initializer';

export function createPopupManager(
  getDependencies: () => ManagerDependencies,
  state: ManagerState
): PopupManager {
  return new PopupManager({
    getSelectedSuggestion: () => {
      const deps = getDependencies();
      return deps.getMergedSuggestions()[state.selectedIndex] || null;
    },
    getSuggestionsContainer: () => getDependencies().getSuggestionsContainer()
  });
}

export function createSettingsCacheManager(): SettingsCacheManager {
  return new SettingsCacheManager();
}

export function createFileFilterManager(settingsCacheManager: SettingsCacheManager): FileFilterManager {
  return new FileFilterManager({
    getDefaultMaxSuggestions: () => settingsCacheManager.getDefaultMaxSuggestions()
  });
}

export function createTextInputPathManager(
  callbacks: FileSearchCallbacks,
  getDependencies: () => ManagerDependencies,
  state: ManagerState
): TextInputPathManager {
  return new TextInputPathManager({
    getTextContent: () => callbacks.getTextContent(),
    setTextContent: (text: string) => callbacks.setTextContent(text),
    getCursorPosition: () => callbacks.getCursorPosition(),
    setCursorPosition: (pos: number) => callbacks.setCursorPosition(pos),
    replaceRangeWithUndo: callbacks.replaceRangeWithUndo
      ? (start: number, end: number, text: string) => callbacks.replaceRangeWithUndo!(start, end, text)
      : undefined,
    addSelectedPath: (path: string) => {
      state.selectedPaths.add(path);
      const deps = getDependencies();
      deps.getHighlightManager()?.addSelectedPath(path);
      console.debug('[FileSearchManager] Added path to selectedPaths:', path, 'total:', state.selectedPaths.size);
    },
    updateHighlightBackdrop: () => getDependencies().updateHighlightBackdrop()
  });
}

export function createSymbolModeUIManager(
  callbacks: FileSearchCallbacks,
  getDependencies: () => ManagerDependencies,
  state: ManagerState
): SymbolModeUIManager {
  return new SymbolModeUIManager({
    getSuggestionsContainer: () => getDependencies().getSuggestionsContainer(),
    getCurrentFileSymbols: () => getDependencies().getSymbolModeUIManager().getState().currentFileSymbols,
    setMergedSuggestions: (suggestions) => { state.mergedSuggestions = suggestions; },
    getMergedSuggestions: () => state.mergedSuggestions,
    getSelectedIndex: () => state.selectedIndex,
    setSelectedIndex: (index) => { state.selectedIndex = index; },
    setIsVisible: (visible) => { state.isVisible = visible; },
    getCurrentFilePath: () => getDependencies().getSymbolModeUIManager().getState().currentFilePath,
    getAtStartPosition: () => state.atStartPosition,
    updateSelection: () => getDependencies().updateSelection(),
    selectSymbol: (symbol) => getDependencies().selectSymbol(symbol),
    positionPopup: (atStartPos) => getDependencies().getSuggestionListManager()?.position(atStartPos),
    updateHintText: callbacks.updateHintText
      ? (text: string) => callbacks.updateHintText!(text)
      : undefined,
    getDefaultHintText: callbacks.getDefaultHintText
      ? () => callbacks.getDefaultHintText!()
      : undefined,
    getFileSearchMaxSuggestions: () => getDependencies().getFileSearchMaxSuggestions(),
    showSuggestions: (query) => getDependencies().showSuggestions(query),
    insertFilePath: (path) => getDependencies().insertFilePath(path),
    hideSuggestions: () => getDependencies().hideSuggestions(),
    onFileSelected: (path) => callbacks.onFileSelected(path),
    setCurrentQuery: (query) => { state.currentQuery = query; },
    getCurrentPath: () => state.currentPath
  });
}

export function createAtPathBehaviorManager(
  callbacks: FileSearchCallbacks,
  getDependencies: () => ManagerDependencies,
  state: ManagerState
): AtPathBehaviorManager {
  return new AtPathBehaviorManager({
    getTextContent: () => callbacks.getTextContent(),
    setTextContent: (text: string) => callbacks.setTextContent(text),
    getCursorPosition: () => callbacks.getCursorPosition(),
    setCursorPosition: (pos: number) => callbacks.setCursorPosition(pos),
    replaceRangeWithUndo: callbacks.replaceRangeWithUndo
      ? (start: number, end: number, text: string) => callbacks.replaceRangeWithUndo!(start, end, text)
      : undefined,
    getAtPaths: () => getDependencies().getAtPaths(),
    getSelectedPaths: () => state.selectedPaths,
    removeSelectedPath: (path: string) => {
      state.selectedPaths.delete(path);
      getDependencies().getHighlightManager()?.removeSelectedPath(path);
    },
    updateHighlightBackdrop: () => getDependencies().updateHighlightBackdrop(),
    getCachedDirectoryData: () => getDependencies().getCachedDirectoryData()
  });
}

export function createItemSelectionManager(
  callbacks: FileSearchCallbacks,
  getDependencies: () => ManagerDependencies,
  state: ManagerState
): ItemSelectionManager {
  return new ItemSelectionManager({
    getCachedDirectoryData: () => getDependencies().getCachedDirectoryData(),
    getTextInput: () => getDependencies().getTextInput(),
    getAtStartPosition: () => state.atStartPosition,
    insertFilePath: (path: string) => getDependencies().insertFilePath(path),
    insertFilePathWithoutAt: (path: string) => getDependencies().insertFilePathWithoutAt(path),
    hideSuggestions: () => getDependencies().hideSuggestions(),
    onFileSelected: (path: string) => callbacks.onFileSelected(path),
    navigateIntoFile: (relativePath: string, absolutePath: string, language: LanguageInfo) =>
      getDependencies().navigateIntoFile(relativePath, absolutePath, language),
    getLanguageForFile: (fileName: string) => getDependencies().getLanguageForFile(fileName),
    isCodeSearchAvailable: () => getDependencies().getCodeSearchManager()?.isAvailableSync() || false,
    replaceRangeWithUndo: callbacks.replaceRangeWithUndo
      ? (start: number, end: number, text: string) => callbacks.replaceRangeWithUndo!(start, end, text)
      : undefined,
    addSelectedPath: (path: string) => {
      state.selectedPaths.add(path);
      getDependencies().getHighlightManager()?.addSelectedPath(path);
    },
    updateHighlightBackdrop: () => getDependencies().updateHighlightBackdrop(),
    resetCodeSearchState: () => {
      state.codeSearchQuery = '';
      state.codeSearchLanguage = '';
      state.codeSearchCacheRefreshed = false;
    }
  });
}

export function createNavigationManager(
  callbacks: FileSearchCallbacks,
  getDependencies: () => ManagerDependencies,
  state: ManagerState
): NavigationManager {
  return new NavigationManager({
    getCachedDirectoryData: () => getDependencies().getCachedDirectoryData(),
    getCodeSearchManager: () => getDependencies().getCodeSearchManager(),
    updateTextInputWithPath: (path: string) => getDependencies().updateTextInputWithPath(path),
    filterFiles: (query: string) => getDependencies().filterFiles(query),
    mergeSuggestions: (query: string) => getDependencies().mergeSuggestions(query),
    updateSuggestionList: (suggestions: SuggestionItem[], showPath: boolean, selectedIndex: number) =>
      getDependencies().getSuggestionListManager()?.update(suggestions, showPath, selectedIndex),
    showTooltipForSelectedItem: () => getDependencies().getPopupManager().showTooltipForSelectedItem(),
    insertFilePath: (path: string) => getDependencies().insertFilePath(path),
    hideSuggestions: () => getDependencies().hideSuggestions(),
    onFileSelected: (path: string) => callbacks.onFileSelected(path),
    showSymbolSuggestions: (query: string) => getDependencies().showSymbolSuggestions(query),
    setCurrentPath: (path: string) => { state.currentPath = path; },
    setCurrentQuery: (query: string) => { state.currentQuery = query; },
    setSelectedIndex: (index: number) => { state.selectedIndex = index; },
    setFilteredFiles: (files: FileInfo[]) => { state.filteredFiles = files; },
    setFilteredAgents: (agents: never[]) => { state.filteredAgents = agents; },
    setMergedSuggestions: (suggestions: SuggestionItem[]) => { state.mergedSuggestions = suggestions; },
    setIsInSymbolMode: (value: boolean) => getDependencies().setIsInSymbolMode(value),
    setCurrentFilePath: (path: string) => getDependencies().setCurrentFilePath(path),
    setCurrentFileSymbols: (symbols: SymbolResult[]) => getDependencies().setCurrentFileSymbols(symbols)
  });
}

export function createKeyboardNavigationManager(
  callbacks: FileSearchCallbacks,
  getDependencies: () => ManagerDependencies,
  state: ManagerState
): KeyboardNavigationManager {
  return new KeyboardNavigationManager({
    getIsVisible: () => state.isVisible,
    getSelectedIndex: () => state.selectedIndex,
    getTotalItemCount: () => state.mergedSuggestions.length,
    getMergedSuggestions: () => state.mergedSuggestions,
    getCachedDirectoryData: () => getDependencies().getCachedDirectoryData(),
    getIsInSymbolMode: () => getDependencies().getIsInSymbolMode(),
    getCurrentQuery: () => state.currentQuery,
    getIsComposing: callbacks.getIsComposing,
    setSelectedIndex: (index: number) => { state.selectedIndex = index; },
    updateSelection: () => getDependencies().updateSelection(),
    selectItem: (index: number) => getDependencies().selectItem(index),
    hideSuggestions: () => getDependencies().hideSuggestions(),
    expandCurrentDirectory: () => getDependencies().expandCurrentDirectory(),
    expandCurrentFile: () => getDependencies().expandCurrentFile(),
    navigateIntoDirectory: (file: FileInfo) => getDependencies().navigateIntoDirectory(file),
    exitSymbolMode: () => getDependencies().exitSymbolMode(),
    removeAtQueryText: () => getDependencies().removeAtQueryText(),
    openFileAndRestoreFocus: (filePath: string) => getDependencies().openFileAndRestoreFocus(filePath),
    insertFilePath: (path: string) => getDependencies().insertFilePath(path),
    onFileSelected: (path: string) => callbacks.onFileSelected(path),
    toggleAutoShowTooltip: () => getDependencies().getPopupManager().toggleAutoShowTooltip()
  });
}

export function createEventListenerManager(
  getDependencies: () => ManagerDependencies,
  state: ManagerState
): EventListenerManager {
  return new EventListenerManager({
    checkForFileSearch: () => getDependencies().checkForFileSearch(),
    updateHighlightBackdrop: () => getDependencies().updateHighlightBackdrop(),
    updateCursorPositionHighlight: () => getDependencies().updateCursorPositionHighlight(),
    handleKeyDown: (e: KeyboardEvent) => getDependencies().handleKeyDown(e),
    handleBackspaceForAtPath: (e: KeyboardEvent) => getDependencies().handleBackspaceForAtPath(e),
    handleCtrlEnterOpenFile: (e: KeyboardEvent) => getDependencies().handleCtrlEnterOpenFile(e),
    handleCmdClickOnAtPath: (e: MouseEvent) => getDependencies().handleCmdClickOnAtPath(e),
    handleMouseMove: (e: MouseEvent) => getDependencies().handleMouseMove(e),
    isVisible: () => state.isVisible,
    hideSuggestions: () => getDependencies().hideSuggestions(),
    syncBackdropScroll: () => getDependencies().syncBackdropScroll(),
    clearFilePathHighlight: () => getDependencies().getHighlightManager()?.clearFilePathHighlight() ?? undefined,
    onCmdKeyDown: () => getDependencies().getHighlightManager()?.onCmdKeyDown() ?? undefined,
    onCmdKeyUp: () => getDependencies().getHighlightManager()?.onCmdKeyUp() ?? undefined,
    onMouseMove: (e: MouseEvent) => getDependencies().getHighlightManager()?.onMouseMove(e) ?? undefined
  });
}

export function createQueryExtractionManager(callbacks: FileSearchCallbacks): QueryExtractionManager {
  return new QueryExtractionManager({
    getTextContent: () => callbacks.getTextContent(),
    getCursorPosition: () => callbacks.getCursorPosition()
  });
}

export function createSuggestionStateManager(
  getDependencies: () => ManagerDependencies,
  state: ManagerState
): SuggestionStateManager {
  return new SuggestionStateManager({
    getCachedDirectoryData: () => getDependencies().getCachedDirectoryData(),
    getAtStartPosition: () => state.atStartPosition,
    getCurrentPath: () => state.currentPath,
    getCurrentQuery: () => state.currentQuery,
    getFilteredFiles: () => state.filteredFiles,
    getFilteredAgents: () => state.filteredAgents,
    getMergedSuggestions: () => state.mergedSuggestions,
    getSelectedIndex: () => state.selectedIndex,
    setCurrentPath: (path: string) => { state.currentPath = path; },
    setCurrentQuery: (query: string) => { state.currentQuery = query; },
    setFilteredFiles: (files: FileInfo[]) => { state.filteredFiles = files; },
    setFilteredAgents: (agents: AgentItem[]) => { state.filteredAgents = agents; },
    setMergedSuggestions: (suggestions: SuggestionItem[]) => { state.mergedSuggestions = suggestions; },
    setSelectedIndex: (index: number) => { state.selectedIndex = index; },
    setIsVisible: (visible: boolean) => { state.isVisible = visible; },
    adjustCurrentPathToQuery: (query: string) => getDependencies().adjustCurrentPathToQuery(query),
    filterFiles: (query: string) => getDependencies().filterFiles(query),
    mergeSuggestions: (query: string, maxSuggestions?: number) => getDependencies().mergeSuggestions(query, maxSuggestions),
    searchAgents: (query: string) => getDependencies().searchAgents(query),
    isIndexBeingBuilt: () => getDependencies().isIndexBeingBuilt(),
    showIndexingHint: () => getDependencies().showIndexingHint(),
    showSuggestionList: (suggestions: SuggestionItem[], atPosition: number, showPath: boolean) =>
      getDependencies().getSuggestionListManager()?.show(suggestions, atPosition, showPath),
    updateSuggestionList: (suggestions: SuggestionItem[], showPath: boolean, selectedIndex: number) =>
      getDependencies().getSuggestionListManager()?.update(suggestions, showPath, selectedIndex),
    showTooltipForSelectedItem: () => getDependencies().getPopupManager().showTooltipForSelectedItem(),
    matchesSearchPrefix: (query: string, type: 'command' | 'mention') => getDependencies().matchesSearchPrefix(query, type),
    getMaxSuggestions: (type: 'command' | 'mention') => getDependencies().getMaxSuggestions(type),
    restoreDefaultHint: () => getDependencies().restoreDefaultHint()
  });
}
