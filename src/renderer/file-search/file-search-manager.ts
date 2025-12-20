/**
 * File Search Manager (Refactored Orchestration Layer)
 * Manages @ file mention functionality with incremental search
 *
 * This is the main orchestration class that coordinates the split modules:
 * - CacheManager: Directory data caching and settings management
 * - FuzzyMatcher: File filtering and agent searching
 * - Highlighter: @path highlighting in textarea
 * - PathUtils: Path detection and manipulation utilities
 * - CaretPositionCalculator: Caret coordinate calculations
 *
 * Total: ~950 lines (thin orchestration layer)
 */

import type { FileInfo, DirectoryInfo, AgentItem } from '../../types';
import { getFileIconSvg, getMentionIconSvg } from '../assets/icons/file-icons';
import type { DirectoryData, FileSearchCallbacks, AtPathRange, SuggestionItem } from './types';
import { formatLog, insertSvgIntoElement } from './types';
import { FileSearchCacheManager } from './cache-manager';
import { FileSearchFuzzyMatcher } from './fuzzy-matcher';
import { FileSearchHighlighter } from './highlighter';
import {
  CaretPositionCalculator,
  findAtPathAtPosition,
  findUrlAtPosition,
  findSlashCommandAtPosition,
  findAbsolutePathAtPosition,
  findClickablePathAtPosition,
  openUrlInBrowser,
  openFileAndRestoreFocus,
  resolveAtPathToAbsolute
} from './path-utils';

export class FileSearchManager {
  // Composed modules
  private cacheManager: FileSearchCacheManager;
  private fuzzyMatcher: FileSearchFuzzyMatcher;
  private highlighter: FileSearchHighlighter;
  private caretCalculator: CaretPositionCalculator;

  // DOM elements
  private suggestionsContainer: HTMLElement | null = null;
  private textInput: HTMLTextAreaElement | null = null;
  private highlightBackdrop: HTMLDivElement | null = null;

  // UI State
  private selectedIndex: number = 0;
  private filteredFiles: FileInfo[] = [];
  private filteredAgents: AgentItem[] = [];
  private mergedSuggestions: SuggestionItem[] = [];
  private isVisible: boolean = false;
  private currentQuery: string = '';
  private atStartPosition: number = -1;
  private currentPath: string = '';

  // Popup state
  private frontmatterPopup: HTMLDivElement | null = null;
  private popupHideTimeout: ReturnType<typeof setTimeout> | null = null;
  private autoShowTooltip: boolean = false;
  private static readonly POPUP_HIDE_DELAY = 100;

  // Mouse tracking
  private lastMouseX: number = 0;
  private lastMouseY: number = 0;

  // Callbacks
  private callbacks: FileSearchCallbacks;

  constructor(callbacks: FileSearchCallbacks) {
    this.callbacks = callbacks;

    // Initialize cache manager
    this.cacheManager = new FileSearchCacheManager(callbacks);

    // Initialize fuzzy matcher with cache accessor
    this.fuzzyMatcher = new FileSearchFuzzyMatcher(
      () => this.cacheManager.getCachedDirectoryData(),
      FileSearchCacheManager.DEFAULT_MAX_SUGGESTIONS
    );

    // Initialize highlighter with accessors
    this.highlighter = new FileSearchHighlighter(
      () => this.textInput,
      () => this.highlightBackdrop,
      callbacks,
      () => this.cacheManager.getCachedDirectoryData(),
      (fullPath: string, baseDir: string) => this.fuzzyMatcher.getRelativePath(fullPath, baseDir)
    );

    // Initialize caret calculator
    this.caretCalculator = new CaretPositionCalculator();
  }

  // ============================================================================
  // Initialization and Setup
  // ============================================================================

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

    // Create frontmatter popup element
    this.createFrontmatterPopup();
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
      this.highlighter.syncBackdropScroll();
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
      this.clearFilePathHighlight();
    });

    // Handle Cmd key press/release for link style
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Meta' && !this.highlighter.getIsCmdHoverActive()) {
        this.highlighter.setIsCmdHoverActive(true);
        // Re-check current mouse position for @path
        this.updateHoverStateAtLastPosition();
      }
    });

    document.addEventListener('keyup', (e) => {
      if (e.key === 'Meta' && this.highlighter.getIsCmdHoverActive()) {
        this.highlighter.setIsCmdHoverActive(false);
        this.clearFilePathHighlight();
      }
    });

    // Clear on window blur (Cmd key release detection may fail)
    window.addEventListener('blur', () => {
      this.highlighter.setIsCmdHoverActive(false);
      this.clearFilePathHighlight();
    });
  }

  // ============================================================================
  // Delegation to CacheManager
  // ============================================================================

  public setFileSearchEnabled(enabled: boolean): void {
    this.cacheManager.setFileSearchEnabled(enabled);
  }

  public isFileSearchEnabled(): boolean {
    return this.cacheManager.isFileSearchEnabled();
  }

  public handleCachedDirectoryData(data: DirectoryInfo | undefined): void {
    this.cacheManager.handleCachedDirectoryData(data);
  }

  public cacheDirectoryData(data: DirectoryInfo | DirectoryData): void {
    this.cacheManager.cacheDirectoryData(data);
  }

  public updateCache(data: DirectoryInfo | DirectoryData): void {
    this.cacheManager.updateCache(data);
  }

  public clearCache(): void {
    this.cacheManager.clearCache();
  }

  public getCacheStatus(): { fromCache: boolean; cacheAge?: number | undefined; directory?: string | undefined } | null {
    return this.cacheManager.getCacheStatus();
  }

  public hasCachedData(): boolean {
    return this.cacheManager.hasCachedData();
  }

  public getCachedDirectory(): string | null {
    return this.cacheManager.getCachedDirectory();
  }

  public clearMaxSuggestionsCache(): void {
    this.cacheManager.clearMaxSuggestionsCache();
  }

  public clearSearchPrefixesCache(): void {
    this.cacheManager.clearSearchPrefixesCache();
  }

  public async preloadSearchPrefixesCache(): Promise<void> {
    await this.cacheManager.preloadSearchPrefixesCache();
  }

  // ============================================================================
  // Delegation to Highlighter
  // ============================================================================

  public updateHighlightBackdrop(): void {
    this.highlighter.updateHighlightBackdrop();
  }

  public clearAtPaths(): void {
    this.highlighter.clearAtPaths();
  }

  public async restoreAtPathsFromText(checkFilesystem = false): Promise<void> {
    await this.highlighter.restoreAtPathsFromText(checkFilesystem);
  }

  // ============================================================================
  // UI Methods - File Search Suggestions
  // ============================================================================

  /**
   * Check for @ mention and show file search if found
   */
  public checkForFileSearch(): void {
    if (!this.textInput || !this.cacheManager.isFileSearchEnabled()) {
      console.debug('[FileSearchManager] checkForFileSearch: skip - textInput null or file search disabled');
      return;
    }

    const result = this.extractQueryAtCursor();

    // If we extracted a query, show suggestions
    if (result) {
      const { query, start } = result;
      this.atStartPosition = start;
      this.currentQuery = query;
      console.debug('[FileSearchManager] checkForFileSearch: showing suggestions for query:', query);
      this.showSuggestions(query);
    } else if (this.isVisible) {
      // Hide if visible and no @ found
      console.debug('[FileSearchManager] checkForFileSearch: hiding suggestions (no @ found)');
      this.hideSuggestions();
    }
  }

  /**
   * Extract query at cursor position if @ is found
   */
  private extractQueryAtCursor(): { query: string; start: number } | null {
    if (!this.textInput) return null;

    const cursorPos = this.callbacks.getCursorPosition();
    const text = this.callbacks.getTextContent();

    // Look backwards from cursor to find @
    let atPos = -1;
    for (let i = cursorPos - 1; i >= 0; i--) {
      const char = text[i];
      if (char === '@') {
        // Found @, check if it's at start or after whitespace/newline
        if (i === 0 || text[i - 1] === ' ' || text[i - 1] === '\n' || text[i - 1] === '\t') {
          atPos = i;
          break;
        }
      } else if (char === ' ' || char === '\n' || char === '\t') {
        // Hit whitespace before @, not a valid @ mention
        break;
      }
    }

    if (atPos === -1) {
      return null;
    }

    // Extract query from @ to cursor (excluding @)
    const query = text.substring(atPos + 1, cursorPos);
    return { query, start: atPos };
  }

  /**
   * Show file suggestions with mixed file and agent results
   */
  private async showSuggestions(query: string): Promise<void> {
    if (!this.suggestionsContainer || !this.cacheManager.isFileSearchEnabled()) {
      console.debug('[FileSearchManager] showSuggestions: skip - no container or disabled');
      return;
    }

    // Check if we should show agent suggestions (query starts with searchPrefix for 'mention' type)
    const shouldShowAgents = await this.cacheManager.matchesSearchPrefix(query, 'mention');

    // Extract the actual search query (after prefix if present)
    let searchQuery = query;
    if (shouldShowAgents) {
      const prefixes = await this.cacheManager.getSearchPrefixes('mention');
      for (const prefix of prefixes) {
        if (query.startsWith(prefix)) {
          searchQuery = query.substring(prefix.length);
          break;
        }
      }
    }

    // Filter files
    this.filteredFiles = this.fuzzyMatcher.filterFiles(searchQuery, this.currentPath);

    // Search agents if enabled
    this.filteredAgents = shouldShowAgents
      ? await this.fuzzyMatcher.searchAgents(searchQuery, () => this.cacheManager.getMaxSuggestions('mention'))
      : [];

    // Get maxSuggestions setting for merged list
    const maxSuggestions = await this.cacheManager.getMaxSuggestions('mention');

    // Merge and sort suggestions
    this.mergedSuggestions = this.fuzzyMatcher.mergeSuggestions(
      searchQuery,
      this.filteredFiles,
      this.filteredAgents,
      (agent, q) => this.fuzzyMatcher.calculateAgentMatchScore(agent, q.toLowerCase()),
      maxSuggestions
    );

    // Reset selection
    this.selectedIndex = 0;

    // Check if index is being built
    const isIndexBuilding = this.cacheManager.isIndexBeingBuilt();

    // Render suggestions
    this.renderSuggestions(isIndexBuilding);

    // Position the dropdown
    this.positionSuggestions();

    this.isVisible = true;
    this.suggestionsContainer.style.display = 'block';

    console.debug('[FileSearchManager] showSuggestions:', formatLog({
      query: searchQuery,
      fileCount: this.filteredFiles.length,
      agentCount: this.filteredAgents.length,
      mergedCount: this.mergedSuggestions.length,
      isIndexBuilding
    }));
  }

  /**
   * Hide file suggestions
   */
  public hideSuggestions(): void {
    if (this.suggestionsContainer) {
      this.suggestionsContainer.style.display = 'none';
      this.isVisible = false;
      this.filteredFiles = [];
      this.filteredAgents = [];
      this.mergedSuggestions = [];
      this.currentPath = '';
      this.currentQuery = '';
      console.debug('[FileSearchManager] hideSuggestions');
    }

    // Hide frontmatter popup
    this.hideFrontmatterPopup();
  }

  /**
   * Position suggestions dropdown above textarea
   */
  private positionSuggestions(): void {
    if (!this.suggestionsContainer || !this.textInput) return;

    const coords = this.caretCalculator.getCaretCoordinates(this.textInput, this.atStartPosition);
    if (!coords) return;

    // Position above the @ character with some spacing
    const verticalSpacing = 8;
    const suggestionsRect = this.suggestionsContainer.getBoundingClientRect();
    const top = coords.top - suggestionsRect.height - verticalSpacing;

    this.suggestionsContainer.style.top = `${top}px`;
    this.suggestionsContainer.style.left = `${coords.left}px`;
  }

  /**
   * Render suggestions with mixed file and agent items
   */
  private renderSuggestions(isIndexBuilding: boolean): void {
    if (!this.suggestionsContainer) return;

    // Clear existing content
    while (this.suggestionsContainer.firstChild) {
      this.suggestionsContainer.removeChild(this.suggestionsContainer.firstChild);
    }

    // Show "Building file index..." message if no data yet
    if (isIndexBuilding) {
      const messageDiv = document.createElement('div');
      messageDiv.className = 'file-suggestion-message';
      messageDiv.textContent = 'Building file index...';
      this.suggestionsContainer.appendChild(messageDiv);
      return;
    }

    // Show "No files found" if no suggestions
    if (this.mergedSuggestions.length === 0) {
      const messageDiv = document.createElement('div');
      messageDiv.className = 'file-suggestion-message';
      messageDiv.textContent = 'No files found';
      this.suggestionsContainer.appendChild(messageDiv);
      return;
    }

    // Render each suggestion (file or agent)
    this.mergedSuggestions.forEach((suggestion, index) => {
      const item = document.createElement('div');
      item.className = 'file-suggestion-item';
      if (index === this.selectedIndex) {
        item.classList.add('selected');
      }

      if (suggestion.type === 'file' && suggestion.file) {
        this.renderFileItem(item, suggestion.file);
      } else if (suggestion.type === 'agent' && suggestion.agent) {
        this.renderAgentItem(item, suggestion.agent);
      }

      // Handle click
      item.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.selectedIndex = index;
        this.selectCurrentItem();
      });

      // Handle mouse hover for frontmatter popup (agents only)
      if (suggestion.type === 'agent' && suggestion.agent?.frontmatter) {
        const infoIcon = item.querySelector('.frontmatter-info-icon') as HTMLElement;
        if (infoIcon) {
          infoIcon.addEventListener('mouseenter', () => {
            this.showFrontmatterPopup(suggestion.agent!, infoIcon);
          });

          infoIcon.addEventListener('mouseleave', () => {
            this.schedulePopupHide();
          });
        }
      }

      this.suggestionsContainer!.appendChild(item);
    });
  }

  /**
   * Render file suggestion item
   */
  private renderFileItem(item: HTMLElement, file: FileInfo): void {
    const cachedData = this.cacheManager.getCachedDirectoryData();
    const baseDir = cachedData?.directory || '';

    // Icon
    const iconSpan = document.createElement('span');
    iconSpan.className = 'file-icon';
    const iconSvg = getFileIconSvg(file.name, file.isDirectory || false);
    insertSvgIntoElement(iconSpan, iconSvg);
    item.appendChild(iconSpan);

    // File name and path
    const textSpan = document.createElement('span');
    textSpan.className = 'file-info';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'file-name';
    nameSpan.textContent = file.name + (file.isDirectory ? '/' : '');
    textSpan.appendChild(nameSpan);

    // Show relative path if available
    const relativePath = this.fuzzyMatcher.getRelativePath(file.path, baseDir);
    if (relativePath !== file.name && relativePath !== file.name + '/') {
      const pathSpan = document.createElement('span');
      pathSpan.className = 'file-path';
      pathSpan.textContent = relativePath;
      textSpan.appendChild(pathSpan);
    }

    item.appendChild(textSpan);

    // For directories, show file count
    if (file.isDirectory) {
      const count = this.fuzzyMatcher.countFilesInDirectory(file.path);
      if (count > 0) {
        const countSpan = document.createElement('span');
        countSpan.className = 'file-count';
        countSpan.textContent = `${count}`;
        item.appendChild(countSpan);
      }
    }
  }

  /**
   * Render agent suggestion item
   */
  private renderAgentItem(item: HTMLElement, agent: AgentItem): void {
    // Icon
    const iconSpan = document.createElement('span');
    iconSpan.className = 'file-icon';
    const iconSvg = getMentionIconSvg();
    insertSvgIntoElement(iconSpan, iconSvg);
    item.appendChild(iconSpan);

    // Agent name and description
    const textSpan = document.createElement('span');
    textSpan.className = 'file-info';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'file-name';
    nameSpan.textContent = agent.name;
    textSpan.appendChild(nameSpan);

    if (agent.description) {
      const descSpan = document.createElement('span');
      descSpan.className = 'file-path';
      descSpan.textContent = agent.description;
      textSpan.appendChild(descSpan);
    }

    item.appendChild(textSpan);

    // Info icon if agent has frontmatter
    if (agent.frontmatter) {
      const infoIcon = document.createElement('span');
      infoIcon.className = 'frontmatter-info-icon';
      infoIcon.textContent = 'ℹ';
      infoIcon.title = 'Hover to see details';
      item.appendChild(infoIcon);
    }
  }

  /**
   * Handle keyboard navigation in suggestions
   */
  private handleKeyDown(e: KeyboardEvent): void {
    if (!this.isVisible || this.mergedSuggestions.length === 0) return;

    // Ignore if we're showing "Building file index..." message
    if (this.cacheManager.isIndexBeingBuilt()) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.selectedIndex = (this.selectedIndex + 1) % this.mergedSuggestions.length;
      this.updateSelection();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.selectedIndex = (this.selectedIndex - 1 + this.mergedSuggestions.length) % this.mergedSuggestions.length;
      this.updateSelection();
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      // Skip Enter/Tab key if IME is active to let IME handle it (for Japanese input confirmation)
      if (e.isComposing || this.callbacks.getIsComposing?.()) {
        return;
      }
      e.preventDefault();
      this.selectCurrentItem();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      this.hideSuggestions();
    } else if (e.key === 'Backspace') {
      // Don't override Shift+Backspace or when text is selected
      if (e.shiftKey) return;
      if (this.textInput && this.textInput.selectionStart !== this.textInput.selectionEnd) return;

      // Navigate up directory when backspace on empty query with path
      if (this.currentQuery === '' && this.currentPath) {
        e.preventDefault();
        this.navigateUpDirectory();
      } else {
        // Handle backspace to delete entire @path if cursor is at the end of one
        this.handleBackspaceForAtPath(e);
      }
    } else if (e.key === 'i' && e.ctrlKey) {
      // Ctrl+i: toggle auto-show tooltip
      e.preventDefault();
      this.toggleAutoShowTooltip();
    }
  }

  /**
   * Update selection UI
   */
  private updateSelection(): void {
    if (!this.suggestionsContainer) return;

    const items = this.suggestionsContainer.querySelectorAll('.file-suggestion-item');
    items.forEach((item, index) => {
      if (index === this.selectedIndex) {
        item.classList.add('selected');
        // Scroll into view if needed
        item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else {
        item.classList.remove('selected');
      }
    });

    // Update tooltip if auto-show is enabled
    if (this.autoShowTooltip) {
      this.showTooltipForSelectedItem();
    }
  }

  /**
   * Select current item (file or agent)
   */
  private selectCurrentItem(): void {
    const suggestion = this.mergedSuggestions[this.selectedIndex];
    if (!suggestion) return;

    if (suggestion.type === 'file' && suggestion.file) {
      this.selectFileByInfo(suggestion.file);
    } else if (suggestion.type === 'agent' && suggestion.agent) {
      this.selectAgent(suggestion.agent);
    }
  }

  /**
   * Select a file from suggestions
   */
  private selectFileByInfo(file: FileInfo): void {
    const cachedData = this.cacheManager.getCachedDirectoryData();
    if (!cachedData) {
      console.error('[FileSearchManager] selectFileByInfo: no cached data');
      return;
    }

    const baseDir = cachedData.directory;
    const relativePath = this.fuzzyMatcher.getRelativePath(file.path, baseDir);

    // If it's a directory, navigate into it
    if (file.isDirectory) {
      this.navigateIntoDirectory(relativePath);
      return;
    }

    // Insert file path (with @ prefix)
    this.insertFilePath(relativePath);

    // Hide suggestions
    this.hideSuggestions();
  }

  /**
   * Select an agent from suggestions
   */
  private selectAgent(agent: AgentItem): void {
    // Determine what to insert based on agent's inputFormat setting
    // Default to 'name' for agents (backward compatible behavior)
    const inputFormat = agent.inputFormat ?? 'name';

    if (inputFormat === 'path') {
      // For 'path' format, replace @ and query with just the file path (no @)
      this.insertFilePathWithoutAt(agent.filePath);
    } else {
      // For 'name' format, keep @ and insert just the name
      this.insertFilePath(agent.name);
    }

    // Hide suggestions
    this.hideSuggestions();
  }

  /**
   * Insert file path into textarea
   */
  private insertFilePath(path: string): void {
    this.highlighter.insertFilePath(
      path,
      this.atStartPosition,
      () => this.callbacks.getCursorPosition(),
      this.callbacks.replaceRangeWithUndo,
      () => this.callbacks.getTextContent(),
      (text: string) => this.callbacks.setTextContent(text)
    );

    // Set cursor position after insertion
    const newCursorPos = this.atStartPosition + 1 + path.length + 1; // @ + path + space
    this.callbacks.setCursorPosition(newCursorPos);
  }

  /**
   * Insert file path without the @ symbol
   * Replaces both @ and query with just the path
   */
  private insertFilePathWithoutAt(path: string): void {
    this.highlighter.insertFilePathWithoutAt(
      path,
      this.atStartPosition,
      () => this.callbacks.getCursorPosition(),
      this.callbacks.replaceRangeWithUndo,
      () => this.callbacks.getTextContent(),
      (text: string) => this.callbacks.setTextContent(text)
    );

    // Set cursor position after insertion (no @ prefix, just path + space)
    const newCursorPos = this.atStartPosition + path.length + 1; // path + space
    this.callbacks.setCursorPosition(newCursorPos);

    // Reset state
    this.atStartPosition = -1;
  }

  /**
   * Navigate into a directory
   */
  private navigateIntoDirectory(dirPath: string): void {
    // Update current path
    this.currentPath = dirPath.endsWith('/') ? dirPath : dirPath + '/';

    // Update query to empty (show all files in directory)
    this.currentQuery = '';

    // Re-show suggestions for new directory
    this.showSuggestions(this.currentQuery);
  }

  /**
   * Navigate up one directory level
   */
  private navigateUpDirectory(): void {
    if (!this.currentPath) return;

    // Remove trailing slash
    let path = this.currentPath.endsWith('/') ? this.currentPath.slice(0, -1) : this.currentPath;

    // Find parent directory
    const lastSlash = path.lastIndexOf('/');
    if (lastSlash === -1) {
      // At root, clear path
      this.currentPath = '';
    } else {
      // Go up one level
      this.currentPath = path.substring(0, lastSlash + 1);
    }

    // Re-show suggestions for parent directory
    this.showSuggestions(this.currentQuery);
  }

  // ============================================================================
  // Frontmatter Popup Methods
  // ============================================================================

  private createFrontmatterPopup(): void {
    if (this.frontmatterPopup) return;

    this.frontmatterPopup = document.createElement('div');
    this.frontmatterPopup.id = 'frontmatterPopup';
    this.frontmatterPopup.className = 'frontmatter-popup';
    this.frontmatterPopup.style.display = 'none';

    // Prevent popup from closing when hovering over it
    this.frontmatterPopup.addEventListener('mouseenter', () => {
      this.cancelPopupHide();
    });

    this.frontmatterPopup.addEventListener('mouseleave', () => {
      this.schedulePopupHide();
    });

    // Handle wheel events on popup element only (scroll popup content)
    this.frontmatterPopup.addEventListener('wheel', (e) => {
      // Only prevent default when popup can scroll
      const popup = this.frontmatterPopup;
      if (popup) {
        const canScrollDown = popup.scrollTop < popup.scrollHeight - popup.clientHeight;
        const canScrollUp = popup.scrollTop > 0;
        const scrollingDown = e.deltaY > 0;
        const scrollingUp = e.deltaY < 0;

        // Only prevent default if we're actually scrolling the popup content
        if ((scrollingDown && canScrollDown) || (scrollingUp && canScrollUp)) {
          e.preventDefault();
          e.stopPropagation();
          popup.scrollTop += e.deltaY;
        }
      }
    }, { passive: false });

    // Append to main-content
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      mainContent.appendChild(this.frontmatterPopup);
      console.debug('[FileSearchManager] createFrontmatterPopup: popup created');
    }
  }

  private showFrontmatterPopup(agent: AgentItem, targetElement: HTMLElement): void {
    if (!this.frontmatterPopup || !agent.frontmatter || !this.suggestionsContainer) return;

    // Cancel any pending hide
    this.cancelPopupHide();

    // Clear previous content using safe DOM method
    while (this.frontmatterPopup.firstChild) {
      this.frontmatterPopup.removeChild(this.frontmatterPopup.firstChild);
    }

    // Create content container (using textContent for XSS safety)
    const contentDiv = document.createElement('div');
    contentDiv.className = 'frontmatter-content';
    contentDiv.textContent = agent.frontmatter;
    this.frontmatterPopup.appendChild(contentDiv);

    // Add hint message at the bottom
    const hintDiv = document.createElement('div');
    hintDiv.className = 'frontmatter-hint';
    hintDiv.textContent = this.autoShowTooltip ? 'Ctrl+i: hide tooltip' : 'Ctrl+i: auto-show tooltip';
    this.frontmatterPopup.appendChild(hintDiv);

    // Get the info icon and container rectangles for positioning
    const iconRect = targetElement.getBoundingClientRect();
    const containerRect = this.suggestionsContainer.getBoundingClientRect();

    // Position popup to the left of the info icon
    const popupWidth = containerRect.width - 40;
    const horizontalGap = 8;
    const right = window.innerWidth - iconRect.left + horizontalGap;

    // Gap between popup and icon
    const verticalGap = 4;

    // Calculate available space below and above the icon
    const spaceBelow = window.innerHeight - iconRect.bottom - 10;
    const spaceAbove = iconRect.top - 10;
    const minPopupHeight = 80;

    // Decide whether to show popup above or below the icon
    const showAbove = spaceBelow < minPopupHeight && spaceAbove > spaceBelow;

    let top: number;
    let maxHeight: number;

    if (showAbove) {
      // Position above the icon
      maxHeight = Math.max(minPopupHeight, Math.min(150, spaceAbove - verticalGap));
      top = iconRect.top - maxHeight - verticalGap;
    } else {
      // Position below the icon
      top = iconRect.bottom + verticalGap;
      maxHeight = Math.max(minPopupHeight, Math.min(150, spaceBelow - verticalGap));
    }

    this.frontmatterPopup.style.right = `${right}px`;
    this.frontmatterPopup.style.left = 'auto';
    this.frontmatterPopup.style.top = `${top}px`;
    this.frontmatterPopup.style.width = `${popupWidth}px`;
    this.frontmatterPopup.style.maxHeight = `${maxHeight}px`;

    this.frontmatterPopup.style.display = 'block';
  }

  private hideFrontmatterPopup(): void {
    if (this.frontmatterPopup) {
      this.frontmatterPopup.style.display = 'none';
    }
  }

  private schedulePopupHide(): void {
    this.cancelPopupHide();
    this.popupHideTimeout = setTimeout(() => {
      this.hideFrontmatterPopup();
    }, FileSearchManager.POPUP_HIDE_DELAY);
  }

  private cancelPopupHide(): void {
    if (this.popupHideTimeout) {
      clearTimeout(this.popupHideTimeout);
      this.popupHideTimeout = null;
    }
  }

  private toggleAutoShowTooltip(): void {
    this.autoShowTooltip = !this.autoShowTooltip;
    if (this.autoShowTooltip) {
      // Show tooltip for currently selected item
      this.showTooltipForSelectedItem();
    } else {
      // Hide tooltip
      this.hideFrontmatterPopup();
    }
  }

  private showTooltipForSelectedItem(): void {
    if (!this.autoShowTooltip || !this.suggestionsContainer) return;

    const suggestion = this.mergedSuggestions[this.selectedIndex];
    if (!suggestion || suggestion.type !== 'agent' || !suggestion.agent?.frontmatter) {
      this.hideFrontmatterPopup();
      return;
    }

    // Find the info icon element for the selected item
    const selectedItem = this.suggestionsContainer.querySelector('.file-suggestion-item.selected');
    const infoIcon = selectedItem?.querySelector('.frontmatter-info-icon') as HTMLElement;
    if (infoIcon) {
      this.showFrontmatterPopup(suggestion.agent, infoIcon);
    }
  }

  // ============================================================================
  // Mouse and Hover Handling
  // ============================================================================

  private handleMouseMove(e: MouseEvent): void {
    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;

    if (!e.metaKey) {
      if (this.highlighter.getHoveredAtPath()) {
        this.clearFilePathHighlight();
      }
      return;
    }

    this.highlighter.setIsCmdHoverActive(true);
    this.checkAndHighlightAtPath(e.clientX, e.clientY);
  }

  private updateHoverStateAtLastPosition(): void {
    if (this.lastMouseX && this.lastMouseY) {
      this.checkAndHighlightAtPath(this.lastMouseX, this.lastMouseY);
    }
  }

  private checkAndHighlightAtPath(clientX: number, clientY: number): void {
    if (!this.textInput) return;

    const text = this.textInput.value;
    const charPos = this.caretCalculator.getCharPositionFromCoordinates(this.textInput, clientX, clientY);

    if (charPos === null) {
      this.clearFilePathHighlight();
      return;
    }

    // Check for @path first
    const atPath = findAtPathAtPosition(text, charPos);
    if (atPath) {
      // Find the AtPathRange that contains this position
      const atPathRange = this.highlighter.findAtPathRangeAtPosition(charPos);
      if (atPathRange && atPathRange !== this.highlighter.getHoveredAtPath()) {
        this.highlighter.setHoveredAtPath(atPathRange);
        this.highlighter.renderFilePathHighlight();
      }
      return;
    }

    // Check for URL
    const url = findUrlAtPosition(text, charPos);
    if (url) {
      // Create a temporary AtPathRange for the URL
      const tempRange: AtPathRange = { start: url.start, end: url.end };
      const hoveredPath = this.highlighter.getHoveredAtPath();
      if (!hoveredPath || hoveredPath.start !== tempRange.start || hoveredPath.end !== tempRange.end) {
        this.highlighter.setHoveredAtPath(tempRange);
        this.highlighter.renderFilePathHighlight();
      }
      return;
    }

    // Check for slash command (like /commit, /help) - only if command type is enabled
    if (this.cacheManager.isCommandEnabledSync()) {
      const slashCommand = findSlashCommandAtPosition(text, charPos);
      if (slashCommand) {
        // Create a temporary AtPathRange for the slash command
        const tempRange: AtPathRange = { start: slashCommand.start, end: slashCommand.end };
        const hoveredPath = this.highlighter.getHoveredAtPath();
        if (!hoveredPath || hoveredPath.start !== tempRange.start || hoveredPath.end !== tempRange.end) {
          this.highlighter.setHoveredAtPath(tempRange);
          this.highlighter.renderFilePathHighlight();
        }
        return;
      }
    }

    // Check for absolute path (starting with /)
    const clickablePath = findClickablePathAtPosition(text, charPos);
    if (clickablePath) {
      // Create a temporary AtPathRange for the absolute path
      const tempRange: AtPathRange = { start: clickablePath.start, end: clickablePath.end };
      const hoveredPath = this.highlighter.getHoveredAtPath();
      if (!hoveredPath || hoveredPath.start !== tempRange.start || hoveredPath.end !== tempRange.end) {
        this.highlighter.setHoveredAtPath(tempRange);
        this.highlighter.renderFilePathHighlight();
      }
      return;
    }

    this.clearFilePathHighlight();
  }

  private clearFilePathHighlight(): void {
    this.highlighter.clearFilePathHighlight();
  }

  // ============================================================================
  // Keyboard Handling - Backspace and Ctrl+Enter
  // ============================================================================

  private handleBackspaceForAtPath(e: KeyboardEvent): void {
    this.highlighter.handleBackspaceForAtPath(
      e,
      () => this.callbacks.getCursorPosition(),
      () => this.callbacks.getTextContent(),
      (pos: number) => this.callbacks.setCursorPosition(pos)
    );
  }

  private handleCtrlEnterOpenFile(e: KeyboardEvent): void {
    if (!this.textInput) return;

    const cursorPos = this.callbacks.getCursorPosition();
    const text = this.callbacks.getTextContent();

    // Check for @path at cursor
    const atPath = findAtPathAtPosition(text, cursorPos);
    if (atPath) {
      e.preventDefault();
      const absolutePath = resolveAtPathToAbsolute(atPath, this.cacheManager.getCachedDirectory());
      if (absolutePath) {
        openFileAndRestoreFocus(absolutePath, {
          ...(this.callbacks.onBeforeOpenFile && { onBeforeOpenFile: this.callbacks.onBeforeOpenFile }),
          ...(this.callbacks.setDraggable && { setDraggable: this.callbacks.setDraggable })
        });
      }
      return;
    }

    // Check for URL at cursor
    const url = findUrlAtPosition(text, cursorPos);
    if (url) {
      e.preventDefault();
      openUrlInBrowser(url.url, {
        ...(this.callbacks.onBeforeOpenFile && { onBeforeOpenFile: this.callbacks.onBeforeOpenFile }),
        ...(this.callbacks.setDraggable && { setDraggable: this.callbacks.setDraggable })
      });
      return;
    }

    // Check for absolute path at cursor
    const absolutePath = findAbsolutePathAtPosition(text, cursorPos);
    if (absolutePath) {
      e.preventDefault();
      openFileAndRestoreFocus(absolutePath, {
        ...(this.callbacks.onBeforeOpenFile && { onBeforeOpenFile: this.callbacks.onBeforeOpenFile }),
        ...(this.callbacks.setDraggable && { setDraggable: this.callbacks.setDraggable })
      });
    }
  }

  private handleCmdClickOnAtPath(e: MouseEvent): void {
    if (!this.textInput) return;

    const text = this.textInput.value;
    const charPos = this.caretCalculator.getCharPositionFromCoordinates(this.textInput, e.clientX, e.clientY);

    if (charPos === null) return;

    // Check for @path
    const atPath = findAtPathAtPosition(text, charPos);
    if (atPath) {
      e.preventDefault();
      const absolutePath = resolveAtPathToAbsolute(atPath, this.cacheManager.getCachedDirectory());
      if (absolutePath) {
        openFileAndRestoreFocus(absolutePath, {
          ...(this.callbacks.onBeforeOpenFile && { onBeforeOpenFile: this.callbacks.onBeforeOpenFile }),
          ...(this.callbacks.setDraggable && { setDraggable: this.callbacks.setDraggable })
        });
      }
      return;
    }

    // Check for URL
    const url = findUrlAtPosition(text, charPos);
    if (url) {
      e.preventDefault();
      openUrlInBrowser(url.url, {
        ...(this.callbacks.onBeforeOpenFile && { onBeforeOpenFile: this.callbacks.onBeforeOpenFile }),
        ...(this.callbacks.setDraggable && { setDraggable: this.callbacks.setDraggable })
      });
      return;
    }

    // Check for absolute path
    const clickablePath = findClickablePathAtPosition(text, charPos);
    if (clickablePath) {
      e.preventDefault();
      openFileAndRestoreFocus(clickablePath.path, {
        ...(this.callbacks.onBeforeOpenFile && { onBeforeOpenFile: this.callbacks.onBeforeOpenFile }),
        ...(this.callbacks.setDraggable && { setDraggable: this.callbacks.setDraggable })
      });
    }
  }

  // ============================================================================
  // Cursor Position Highlighting
  // ============================================================================

  private updateCursorPositionHighlight(): void {
    if (!this.textInput) return;

    const text = this.textInput.value;
    const cursorPos = this.callbacks.getCursorPosition();

    // Find clickable path at cursor position (absolute paths only, not @paths)
    const clickablePath = findClickablePathAtPosition(text, cursorPos);
    if (clickablePath) {
      // Only highlight absolute paths (not @paths)
      const isAtPath = text[clickablePath.start] === '@';
      if (!isAtPath) {
        const tempRange: AtPathRange = { start: clickablePath.start, end: clickablePath.end };
        this.highlighter.setCursorPositionPath(tempRange);
        this.highlighter.renderHighlightBackdropWithCursor();
        return;
      }
    }

    // Clear cursor position highlight if no path found
    this.highlighter.setCursorPositionPath(null);
    this.highlighter.renderHighlightBackdropWithCursor();
  }

  // ============================================================================
  // Public API
  // ============================================================================

  public isActive(): boolean {
    return this.isVisible;
  }

  public destroy(): void {
    // Cleanup caret calculator
    this.caretCalculator.destroy();

    // Clear timeouts
    if (this.popupHideTimeout) {
      clearTimeout(this.popupHideTimeout);
    }

    // Remove DOM elements
    if (this.frontmatterPopup && this.frontmatterPopup.parentNode) {
      this.frontmatterPopup.parentNode.removeChild(this.frontmatterPopup);
    }
  }
}
