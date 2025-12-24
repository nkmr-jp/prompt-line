/**
 * NavigationManager - Handles directory and file navigation for file search
 *
 * Extracted from FileSearchManager to improve modularity and reduce file size.
 * Responsibilities:
 * - Navigate into directories and update path
 * - Navigate into files to show symbols
 * - Expand current directory path
 */

import type { FileInfo, DirectoryData, SuggestionItem } from '../types';
import type { SymbolResult, LanguageInfo } from '../../code-search/types';
import { getRelativePath, formatLog } from '../index';

/**
 * Callbacks for NavigationManager
 */
export interface NavigationCallbacks {
  /** Get cached directory data */
  getCachedDirectoryData: () => DirectoryData | null;
  /** Get CodeSearchManager */
  getCodeSearchManager: () => {
    navigateIntoFile: (baseDir: string, relativePath: string, absolutePath: string, language: LanguageInfo) => Promise<void>;
    isInSymbolModeActive: () => boolean;
    getCurrentFileSymbols: () => SymbolResult[];
  } | null;
  /** Update text input with path */
  updateTextInputWithPath: (path: string) => void;
  /** Filter files by query */
  filterFiles: (query: string) => FileInfo[];
  /** Merge suggestions */
  mergeSuggestions: (query: string) => SuggestionItem[];
  /** Update suggestion list */
  updateSuggestionList: (suggestions: SuggestionItem[], showPath: boolean, selectedIndex: number) => void;
  /** Show tooltip for selected item */
  showTooltipForSelectedItem: () => void;
  /** Insert file path */
  insertFilePath: (path: string) => void;
  /** Hide suggestions */
  hideSuggestions: () => void;
  /** Callback when file is selected */
  onFileSelected: (path: string) => void;
  /** Show symbol suggestions */
  showSymbolSuggestions: (query: string) => Promise<void>;
  /** Set current path */
  setCurrentPath: (path: string) => void;
  /** Set current query */
  setCurrentQuery: (query: string) => void;
  /** Set selected index */
  setSelectedIndex: (index: number) => void;
  /** Set filtered files */
  setFilteredFiles: (files: FileInfo[]) => void;
  /** Set filtered agents */
  setFilteredAgents: (agents: never[]) => void;
  /** Set merged suggestions */
  setMergedSuggestions: (suggestions: SuggestionItem[]) => void;
  /** Set symbol mode state */
  setIsInSymbolMode: (value: boolean) => void;
  /** Set current file path (for symbol mode) */
  setCurrentFilePath: (path: string) => void;
  /** Set current file symbols */
  setCurrentFileSymbols: (symbols: SymbolResult[]) => void;
}

/**
 * NavigationManager handles directory and file navigation
 */
export class NavigationManager {
  private callbacks: NavigationCallbacks;

  constructor(callbacks: NavigationCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Navigate into a directory to show its contents
   * @param directory - Directory to navigate into
   * @param currentPath - Current path (will be updated)
   */
  public navigateIntoDirectory(directory: FileInfo): void {
    const cachedData = this.callbacks.getCachedDirectoryData();
    if (!directory.isDirectory || !cachedData) return;

    const baseDir = cachedData.directory;
    const relativePath = getRelativePath(directory.path, baseDir);

    // Update current path to the selected directory
    const newPath = relativePath.endsWith('/') ? relativePath : relativePath + '/';
    this.callbacks.setCurrentPath(newPath);

    console.debug('[NavigationManager] navigateIntoDirectory:', formatLog({
      directory: directory.name,
      currentPath: newPath
    }));

    // Update the text input to show the current path after @
    this.callbacks.updateTextInputWithPath(newPath);

    // Clear the query and show files in the new directory
    // selectedIndex = -1 for unselected state (Tab/Enter can expand directory itself)
    this.callbacks.setCurrentQuery('');
    this.callbacks.setSelectedIndex(-1);
    const filteredFiles = this.callbacks.filterFiles('');
    this.callbacks.setFilteredFiles(filteredFiles);
    this.callbacks.setFilteredAgents([]); // No agents when navigating into subdirectory
    const mergedSuggestions = this.callbacks.mergeSuggestions('');
    this.callbacks.setMergedSuggestions(mergedSuggestions);

    // Delegate rendering to SuggestionListManager (position remains unchanged)
    this.callbacks.updateSuggestionList(mergedSuggestions, false, -1);
    // Update popup tooltip for selected item
    this.callbacks.showTooltipForSelectedItem();
  }

  /**
   * Navigate into a file to show its symbols
   * @param relativePath - Relative path of the file
   * @param absolutePath - Absolute path of the file
   * @param language - Language info for symbol search
   */
  public async navigateIntoFile(relativePath: string, absolutePath: string, language: LanguageInfo): Promise<void> {
    const cachedData = this.callbacks.getCachedDirectoryData();
    const codeSearchManager = this.callbacks.getCodeSearchManager();
    if (!cachedData || !codeSearchManager) return;

    // Update local state for UI
    this.callbacks.setIsInSymbolMode(true);
    this.callbacks.setCurrentFilePath(relativePath);
    this.callbacks.setCurrentQuery('');
    this.callbacks.setCurrentPath(relativePath);

    console.debug('[NavigationManager] navigateIntoFile:', formatLog({
      file: relativePath,
      language: language.key
    }));

    // Update text input to show the file path
    this.callbacks.updateTextInputWithPath(relativePath);

    // Delegate symbol loading to CodeSearchManager
    await codeSearchManager.navigateIntoFile(
      cachedData.directory,
      relativePath,
      absolutePath,
      language
    );

    // Check if CodeSearchManager successfully loaded symbols
    if (!codeSearchManager.isInSymbolModeActive()) {
      // No symbols found - insert file path directly
      this.callbacks.setIsInSymbolMode(false);
      this.callbacks.insertFilePath(relativePath);
      this.callbacks.hideSuggestions();
      this.callbacks.onFileSelected(relativePath);
      return;
    }

    // Get symbols from CodeSearchManager
    const symbols = codeSearchManager.getCurrentFileSymbols();
    this.callbacks.setCurrentFileSymbols(symbols);

    // Show symbols with selectedIndex = -1 (like directory navigation)
    this.callbacks.setSelectedIndex(-1);
    await this.callbacks.showSymbolSuggestions('');
  }

  /**
   * Expand current directory path (insert path with trailing slash)
   * @param currentPath - Current path to expand
   */
  public expandCurrentDirectory(currentPath: string): void {
    if (!currentPath) return;

    // Add trailing slash and insert path
    const pathWithSlash = currentPath.endsWith('/') ? currentPath : currentPath + '/';
    this.callbacks.insertFilePath(pathWithSlash);
    this.callbacks.hideSuggestions();

    // Callback for external handling
    this.callbacks.onFileSelected(pathWithSlash);
  }
}
