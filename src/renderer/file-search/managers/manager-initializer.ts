/**
 * Manager Initializer
 * Handles initialization of all sub-managers for FileSearchManager
 * Extracts complex constructor logic into a dedicated initialization layer
 */

import type { FileSearchCallbacks, DirectoryData, SuggestionItem, AtPathRange } from '..';
import type { SymbolResult, LanguageInfo } from '../../code-search/types';
import type { FileInfo, AgentItem } from '../../../types';
import type { HighlightManager } from './highlight-manager';
import type { SuggestionListManager } from './suggestion-list-manager';
import type { CodeSearchManager } from './code-search-manager';
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
import * as factories from './manager-factories';

export interface ManagerState {
  selectedPaths: Set<string>;
  selectedIndex: number;
  currentQuery: string;
  currentPath: string;
  filteredFiles: FileInfo[];
  filteredAgents: AgentItem[];
  mergedSuggestions: SuggestionItem[];
  isVisible: boolean;
  atStartPosition: number;
  codeSearchQuery: string;
  codeSearchLanguage: string;
  codeSearchCacheRefreshed: boolean;
}

export interface InitializedManagers {
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

export class ManagerInitializer {
  private callbacks: FileSearchCallbacks;
  private state: ManagerState;
  private getDependencies: () => ManagerDependencies;

  constructor(
    callbacks: FileSearchCallbacks,
    state: ManagerState,
    getDependencies: () => ManagerDependencies
  ) {
    this.callbacks = callbacks;
    this.state = state;
    this.getDependencies = getDependencies;
  }

  /**
   * Initialize all managers
   */
  public initializeAll(): InitializedManagers {
    const popupManager = factories.createPopupManager(this.getDependencies, this.state);
    const settingsCacheManager = factories.createSettingsCacheManager();
    const fileFilterManager = factories.createFileFilterManager(settingsCacheManager);
    const textInputPathManager = factories.createTextInputPathManager(this.callbacks, this.getDependencies, this.state);
    const symbolModeUIManager = factories.createSymbolModeUIManager(this.callbacks, this.getDependencies, this.state);
    const atPathBehaviorManager = factories.createAtPathBehaviorManager(this.callbacks, this.getDependencies, this.state);
    const itemSelectionManager = factories.createItemSelectionManager(this.callbacks, this.getDependencies, this.state);
    const navigationManager = factories.createNavigationManager(this.callbacks, this.getDependencies, this.state);
    const keyboardNavigationManager = factories.createKeyboardNavigationManager(this.callbacks, this.getDependencies, this.state);
    const eventListenerManager = factories.createEventListenerManager(this.getDependencies, this.state);
    const queryExtractionManager = factories.createQueryExtractionManager(this.callbacks);
    const suggestionStateManager = factories.createSuggestionStateManager(this.getDependencies, this.state);

    return {
      popupManager,
      settingsCacheManager,
      fileFilterManager,
      textInputPathManager,
      symbolModeUIManager,
      atPathBehaviorManager,
      itemSelectionManager,
      navigationManager,
      keyboardNavigationManager,
      eventListenerManager,
      queryExtractionManager,
      suggestionStateManager
    };
  }
}

/**
 * Dependencies interface for manager initialization
 * This allows managers to access methods from the parent FileSearchManager
 */
export interface ManagerDependencies {
  getSuggestionsContainer: () => HTMLElement | null;
  getMergedSuggestions: () => SuggestionItem[];
  getHighlightManager: () => HighlightManager | null;
  getSymbolModeUIManager: () => SymbolModeUIManager;
  getSuggestionListManager: () => SuggestionListManager | null;
  getCodeSearchManager: () => CodeSearchManager | null;
  getPopupManager: () => PopupManager;
  getTextInput: () => HTMLTextAreaElement | null;
  getCachedDirectoryData: () => DirectoryData | null;
  getAtPaths: () => AtPathRange[];
  updateHighlightBackdrop: () => void;
  updateSelection: () => void;
  selectSymbol: (symbol: SymbolResult) => void;
  selectItem: (index: number) => void;
  getFileSearchMaxSuggestions: () => Promise<number>;
  showSuggestions: (query: string) => Promise<void>;
  insertFilePath: (path: string) => void;
  insertFilePathWithoutAt: (path: string) => void;
  hideSuggestions: () => void;
  navigateIntoFile: (relativePath: string, absolutePath: string, language: LanguageInfo) => Promise<void>;
  getLanguageForFile: (fileName: string) => LanguageInfo | null;
  updateTextInputWithPath: (path: string) => void;
  filterFiles: (query: string) => FileInfo[];
  mergeSuggestions: (query: string, maxSuggestions?: number) => SuggestionItem[];
  showSymbolSuggestions: (query: string) => Promise<void>;
  setIsInSymbolMode: (value: boolean) => void;
  setCurrentFilePath: (path: string) => void;
  setCurrentFileSymbols: (symbols: SymbolResult[]) => void;
  getIsInSymbolMode: () => boolean;
  navigateIntoDirectory: (file: FileInfo) => void;
  expandCurrentDirectory: () => void;
  expandCurrentFile: () => void;
  exitSymbolMode: () => void;
  removeAtQueryText: () => void;
  openFileAndRestoreFocus: (filePath: string) => Promise<void>;
  checkForFileSearch: () => void;
  updateCursorPositionHighlight: () => void;
  handleKeyDown: (e: KeyboardEvent) => void;
  handleBackspaceForAtPath: (e: KeyboardEvent) => void;
  handleCtrlEnterOpenFile: (e: KeyboardEvent) => Promise<void>;
  handleCmdClickOnAtPath: (e: MouseEvent) => Promise<void>;
  handleMouseMove: (e: MouseEvent) => void;
  syncBackdropScroll: () => void;
  adjustCurrentPathToQuery: (query: string) => void;
  searchAgents: (query: string) => Promise<AgentItem[]>;
  isIndexBeingBuilt: () => boolean;
  showIndexingHint: () => void;
  matchesSearchPrefix: (query: string, type: 'command' | 'mention') => Promise<boolean>;
  getMaxSuggestions: (type: 'command' | 'mention') => Promise<number>;
  restoreDefaultHint: () => void;
}
