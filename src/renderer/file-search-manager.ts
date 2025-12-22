/**
 * File Search Manager for renderer process
 * Manages @ file mention functionality with incremental search
 */

import type { FileInfo, DirectoryInfo, AgentItem } from '../types';
import { getFileIconSvg, getMentionIconSvg, getSymbolIconSvg } from './assets/icons/file-icons';
import type { SymbolResult, LanguageInfo } from './code-search/types';
import { getSymbolTypeDisplay, SYMBOL_TYPE_FROM_DISPLAY } from './code-search/types';

// Pattern to detect code search queries (e.g., @ts:, @go:, @py:)
const CODE_SEARCH_PATTERN = /^([a-z]+):(.*)$/;

/**
 * Format object for console output (Electron renderer -> main process)
 * Outputs in a format similar to the main process logger
 */
function formatLog(obj: Record<string, unknown>): string {
  const entries = Object.entries(obj)
    .map(([key, value]) => `  ${key}: ${typeof value === 'string' ? `'${value}'` : value}`)
    .join(',\n');
  return '{\n' + entries + '\n}';
}

/**
 * Safely parse and insert SVG content using DOMParser
 * This avoids innerHTML for security while allowing SVG insertion
 */
function insertSvgIntoElement(element: HTMLElement, svgString: string): void {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  const svgElement = doc.documentElement;

  // Check for parsing errors
  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    console.warn('[FileSearchManager] SVG parse error, using fallback');
    element.textContent = '📄';
    return;
  }

  // Clear existing content and append SVG
  element.textContent = '';
  element.appendChild(element.ownerDocument.importNode(svgElement, true));
}

// Directory data for file search (cached in renderer)
interface DirectoryData {
  directory: string;
  files: FileInfo[];
  timestamp: number;
  partial?: boolean;          // Always false (single stage with fd)
  searchMode?: 'recursive';   // Always 'recursive' (single stage with fd)
  fromCache?: boolean;        // true if data was loaded from disk cache
  cacheAge?: number;          // milliseconds since cache was updated
  fromDraft?: boolean;        // true if this is from draft fallback (empty files)
  hint?: string;              // hint message to display to user (e.g., "Install fd: brew install fd")
  filesDisabled?: boolean;    // true if file search is disabled for this directory
  filesDisabledReason?: string; // reason why file search is disabled
}

interface FileSearchCallbacks {
  onFileSelected: (filePath: string) => void;
  getTextContent: () => string;
  setTextContent: (text: string) => void;
  getCursorPosition: () => number;
  setCursorPosition: (position: number) => void;
  onBeforeOpenFile?: () => void; // Called before opening file in editor to suppress blur
  updateHintText?: (text: string) => void; // Update hint text in footer
  getDefaultHintText?: () => string; // Get default hint text (directory path)
  setDraggable?: (enabled: boolean) => void; // Enable/disable window dragging during file open
  replaceRangeWithUndo?: (start: number, end: number, newText: string) => void; // Replace text range with undo support
  getIsComposing?: () => boolean; // Check if IME is active to avoid conflicts with Japanese input
}

// Represents a tracked @path in the text
interface AtPathRange {
  start: number;              // Position of @
  end: number;                // Position after the last character of the path
  path?: string | undefined;  // The path content (without @) for highlighting
}

// Unified suggestion item (file, agent, or symbol) with score for mixed sorting
interface SuggestionItem {
  type: 'file' | 'agent' | 'symbol';
  file?: FileInfo;
  agent?: AgentItem;
  symbol?: SymbolResult;
  score: number;
}

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

  // Frontmatter popup elements
  private frontmatterPopup: HTMLDivElement | null = null;
  private popupHideTimeout: ReturnType<typeof setTimeout> | null = null;
  private static readonly POPUP_HIDE_DELAY = 100; // ms delay before hiding popup
  private autoShowTooltip: boolean = false; // Auto-show tooltip for selected item

  // Cmd+hover state for file path link
  private isCmdHoverActive: boolean = false;
  private hoveredAtPath: AtPathRange | null = null;

  // Cursor position state for file path link
  private cursorPositionPath: AtPathRange | null = null;

  // Constants
  private static readonly DEFAULT_MAX_SUGGESTIONS = 20;

  // Cached maxSuggestions per type
  private maxSuggestionsCache: Map<string, number> = new Map();

  // Cached searchPrefixes per type
  private searchPrefixesCache: Map<string, string[]> = new Map();

  // Whether file search feature is enabled (from settings)
  private fileSearchEnabled: boolean = false;

  // Code/Symbol search properties
  private filteredSymbols: SymbolResult[] = [];
  private codeSearchQuery: string = '';
  private codeSearchLanguage: string = ''; // Current language for code search
  private codeSearchCacheRefreshed: boolean = false; // Whether cache refresh has been triggered for this session
  private rgAvailable: boolean = false;
  private supportedLanguages: Map<string, LanguageInfo> = new Map();
  private codeSearchInitPromise: Promise<void> | null = null;

  // Symbol mode properties (for navigating into file to show symbols)
  private isInSymbolMode: boolean = false;
  private currentFilePath: string = ''; // Path of the file being viewed for symbols
  private currentFileSymbols: SymbolResult[] = []; // Symbols in the current file

  constructor(callbacks: FileSearchCallbacks) {
    this.callbacks = callbacks;
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
   */
  private async getMaxSuggestions(type: 'command' | 'mention'): Promise<number> {
    // Check cache first
    if (this.maxSuggestionsCache.has(type)) {
      return this.maxSuggestionsCache.get(type)!;
    }

    try {
      const electronAPI = (window as any).electronAPI;
      if (electronAPI?.mdSearch?.getMaxSuggestions) {
        const maxSuggestions = await electronAPI.mdSearch.getMaxSuggestions(type);
        this.maxSuggestionsCache.set(type, maxSuggestions);
        return maxSuggestions;
      }
    } catch (error) {
      console.error('[FileSearchManager] Failed to get maxSuggestions:', error);
    }

    return FileSearchManager.DEFAULT_MAX_SUGGESTIONS;
  }

  /**
   * Clear maxSuggestions cache (call when settings might have changed)
   */
  public clearMaxSuggestionsCache(): void {
    this.maxSuggestionsCache.clear();
  }

  /**
   * Get searchPrefixes for a given type (cached)
   */
  private async getSearchPrefixes(type: 'command' | 'mention'): Promise<string[]> {
    // Check cache first
    if (this.searchPrefixesCache.has(type)) {
      return this.searchPrefixesCache.get(type)!;
    }

    try {
      const electronAPI = (window as any).electronAPI;
      if (electronAPI?.mdSearch?.getSearchPrefixes) {
        const prefixes = await electronAPI.mdSearch.getSearchPrefixes(type);
        this.searchPrefixesCache.set(type, prefixes);
        return prefixes;
      }
    } catch (error) {
      console.error('[FileSearchManager] Failed to get searchPrefixes:', error);
    }

    return [];
  }

  /**
   * Clear searchPrefixes cache (call when settings might have changed)
   */
  public clearSearchPrefixesCache(): void {
    this.searchPrefixesCache.clear();
  }

  /**
   * Check if query matches any searchPrefix for the given type
   */
  private async matchesSearchPrefix(query: string, type: 'command' | 'mention'): Promise<boolean> {
    const prefixes = await this.getSearchPrefixes(type);
    return prefixes.some(prefix => query.startsWith(prefix));
  }

  /**
   * Synchronously check if command type is enabled (from cache)
   * Returns false if cache is not populated yet
   */
  private isCommandEnabledSync(): boolean {
    const prefixes = this.searchPrefixesCache.get('command');
    return prefixes !== undefined && prefixes.length > 0;
  }

  /**
   * Synchronously check if query matches any searchPrefix for the given type (from cache)
   * Returns false if cache is not populated yet
   */
  private matchesSearchPrefixSync(query: string, type: 'command' | 'mention'): boolean {
    const prefixes = this.searchPrefixesCache.get(type);
    if (!prefixes) {
      return false;
    }
    return prefixes.some(prefix => query.startsWith(prefix));
  }

  /**
   * Preload searchPrefixes cache for command and mention types
   * Call this early (e.g., on window-shown) to populate cache for sync checks
   */
  public async preloadSearchPrefixesCache(): Promise<void> {
    try {
      // Load both command and mention prefixes in parallel
      await Promise.all([
        this.getSearchPrefixes('command'),
        this.getSearchPrefixes('mention')
      ]);
      console.debug('[FileSearchManager] SearchPrefixes cache preloaded');
    } catch (error) {
      console.error('[FileSearchManager] Failed to preload searchPrefixes cache:', error);
    }
  }

  /**
   * Calculate the pixel position of a character in the textarea
   * Uses a mirror div technique to measure text position
   */
  private getCaretCoordinates(position: number): { top: number; left: number } | null {
    if (!this.textInput) return null;

    // Create mirror div if it doesn't exist
    if (!this.mirrorDiv) {
      this.mirrorDiv = document.createElement('div');
      this.mirrorDiv.style.cssText = `
        position: absolute;
        visibility: hidden;
        white-space: pre-wrap;
        word-wrap: break-word;
        overflow: hidden;
      `;
      document.body.appendChild(this.mirrorDiv);
    }

    // Copy textarea styles to mirror div
    const style = window.getComputedStyle(this.textInput);
    const properties = [
      'fontFamily', 'fontSize', 'fontWeight', 'fontStyle',
      'letterSpacing', 'textTransform', 'wordSpacing',
      'textIndent', 'whiteSpace', 'lineHeight',
      'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
      'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
      'boxSizing', 'width'
    ];

    properties.forEach(prop => {
      const value = style.getPropertyValue(prop.replace(/([A-Z])/g, '-$1').toLowerCase());
      if (value) {
        this.mirrorDiv!.style.setProperty(prop.replace(/([A-Z])/g, '-$1').toLowerCase(), value);
      }
    });

    // Get text up to the position and add a span marker
    const text = this.textInput.value.substring(0, position);
    const textNode = document.createTextNode(text);
    const marker = document.createElement('span');
    marker.textContent = '@'; // Use @ as marker

    this.mirrorDiv.innerHTML = '';
    this.mirrorDiv.appendChild(textNode);
    this.mirrorDiv.appendChild(marker);

    // Get marker position relative to mirror div
    const markerRect = marker.getBoundingClientRect();
    const mirrorRect = this.mirrorDiv.getBoundingClientRect();

    // Calculate position relative to textarea
    const textareaRect = this.textInput.getBoundingClientRect();

    return {
      top: markerRect.top - mirrorRect.top + textareaRect.top - this.textInput.scrollTop,
      left: markerRect.left - mirrorRect.left + textareaRect.left - this.textInput.scrollLeft
    };
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

    // Create frontmatter popup element
    this.createFrontmatterPopup();

    // Initialize code search (async, but store promise for later await)
    this.codeSearchInitPromise = this.initializeCodeSearch();
  }

  /**
   * Initialize code search functionality
   * Checks ripgrep availability and loads supported languages
   */
  private async initializeCodeSearch(): Promise<void> {
    console.debug('[FileSearchManager] initializeCodeSearch: starting...');
    try {
      // Check if ripgrep is available
      const rgCheck = await window.electronAPI.codeSearch.checkRg();
      console.debug('[FileSearchManager] initializeCodeSearch: rgCheck result:', rgCheck);
      this.rgAvailable = rgCheck.rgAvailable;

      if (!this.rgAvailable) {
        console.debug('[FileSearchManager] ripgrep not available, code search disabled');
        return;
      }

      // Load supported languages
      const langResponse = await window.electronAPI.codeSearch.getSupportedLanguages();
      console.debug('[FileSearchManager] initializeCodeSearch: languages loaded:', langResponse.languages.length);
      for (const lang of langResponse.languages) {
        this.supportedLanguages.set(lang.key, lang);
      }

      console.debug('[FileSearchManager] Code search initialized with languages:', Array.from(this.supportedLanguages.keys()));
    } catch (error) {
      console.error('[FileSearchManager] Failed to initialize code search:', error);
    }
  }

  /**
   * Handle cached directory data from window-shown event
   * This enables instant file search when window opens
   */
  public handleCachedDirectoryData(data: DirectoryInfo | undefined): void {
    if (!data || !data.directory) {
      console.debug('[FileSearchManager] No cached directory data');
      return;
    }

    // Check if this is from cache or just draft fallback
    const fromCache = data.fromCache === true;
    const fromDraft = data.fromDraft === true;

    if (fromDraft && (!data.files || data.files.length === 0)) {
      // Draft fallback with no files - just store directory for later
      console.debug('[FileSearchManager] Draft directory fallback:', data.directory);
      // Don't cache empty data, but remember the directory
      this.cachedDirectoryData = {
        directory: data.directory,
        files: [],
        timestamp: Date.now(),
        partial: false,  // Always false (single stage with fd)
        searchMode: 'recursive',  // Always recursive (fd is required)
        fromDraft: true
      };
      return;
    }

    // Cache the data with appropriate flags
    this.cachedDirectoryData = {
      directory: data.directory,
      files: data.files || [],
      timestamp: Date.now(),
      partial: false,  // Always false (single stage with fd)
      searchMode: 'recursive',  // Always recursive (fd is required)
      ...(fromCache ? { fromCache: true } : {}),
      ...(data.cacheAge !== undefined ? { cacheAge: data.cacheAge } : {}),
      ...(data.hint ? { hint: data.hint } : {}),
      ...(data.filesDisabled ? { filesDisabled: data.filesDisabled, filesDisabledReason: data.filesDisabledReason } : {})
    };

    // Show hint message in footer if present (e.g., fd not installed)
    if (data.hint && this.callbacks.updateHintText) {
      this.callbacks.updateHintText(data.hint);
      console.warn('[FileSearchManager] Hint:', data.hint);
    }

    console.debug('[FileSearchManager] handleCachedDirectoryData:', formatLog({
      directory: data.directory,
      fileCount: this.cachedDirectoryData.files.length,
      fromCache: fromCache,
      cacheAge: data.cacheAge,
      searchMode: data.searchMode,
      hint: data.hint
    }));
  }

  /**
   * Create the frontmatter popup element for agent hover display
   */
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

  /**
   * Show frontmatter popup for an agent
   * Position: to the left of the info icon (same as slash command popup)
   */
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

    // Position popup to the left of the info icon (same as slash command popup)
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
      // Position above the icon (bottom of popup aligns with top of icon)
      maxHeight = Math.max(minPopupHeight, Math.min(150, spaceAbove - verticalGap));
      top = iconRect.top - maxHeight - verticalGap;
    } else {
      // Position below the icon (top of popup aligns with bottom of icon)
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

  /**
   * Hide frontmatter popup
   */
  private hideFrontmatterPopup(): void {
    if (this.frontmatterPopup) {
      this.frontmatterPopup.style.display = 'none';
    }
  }

  /**
   * Schedule popup hide with delay
   */
  private schedulePopupHide(): void {
    this.cancelPopupHide();
    this.popupHideTimeout = setTimeout(() => {
      this.hideFrontmatterPopup();
    }, FileSearchManager.POPUP_HIDE_DELAY);
  }

  /**
   * Cancel scheduled popup hide
   */
  private cancelPopupHide(): void {
    if (this.popupHideTimeout) {
      clearTimeout(this.popupHideTimeout);
      this.popupHideTimeout = null;
    }
  }

  /**
   * Toggle auto-show tooltip feature
   */
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

  /**
   * Show tooltip for the currently selected item (agent only)
   */
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
      this.clearFilePathHighlight();
    });

    // Handle Cmd key press/release for link style
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Meta' && !this.isCmdHoverActive) {
        this.isCmdHoverActive = true;
        // Re-check current mouse position for @path
        this.updateHoverStateAtLastPosition();
      }
    });

    document.addEventListener('keyup', (e) => {
      if (e.key === 'Meta' && this.isCmdHoverActive) {
        this.isCmdHoverActive = false;
        this.clearFilePathHighlight();
      }
    });

    // Clear on window blur (Cmd key release detection may fail)
    window.addEventListener('blur', () => {
      this.isCmdHoverActive = false;
      this.clearFilePathHighlight();
    });
  }

  // Track last mouse position for Cmd key press detection
  private lastMouseX: number = 0;
  private lastMouseY: number = 0;

  /**
   * Handle mouse move for Cmd+hover link style
   */
  private handleMouseMove(e: MouseEvent): void {
    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;

    if (!e.metaKey) {
      if (this.hoveredAtPath) {
        this.clearFilePathHighlight();
      }
      return;
    }

    this.isCmdHoverActive = true;
    this.checkAndHighlightAtPath(e.clientX, e.clientY);
  }

  /**
   * Update hover state when Cmd key is pressed
   */
  private updateHoverStateAtLastPosition(): void {
    if (this.lastMouseX && this.lastMouseY) {
      this.checkAndHighlightAtPath(this.lastMouseX, this.lastMouseY);
    }
  }

  /**
   * Check if mouse is over an @path, absolute path, or URL and highlight it
   */
  private checkAndHighlightAtPath(clientX: number, clientY: number): void {
    if (!this.textInput) return;

    const text = this.textInput.value;
    const charPos = this.getCharPositionFromCoordinates(clientX, clientY);

    if (charPos === null) {
      this.clearFilePathHighlight();
      return;
    }

    // Check for @path first
    const atPath = this.findAtPathAtPosition(text, charPos);
    if (atPath) {
      // Find the AtPathRange that contains this position
      const atPathRange = this.findAtPathRangeAtPosition(charPos);
      if (atPathRange && atPathRange !== this.hoveredAtPath) {
        this.hoveredAtPath = atPathRange;
        this.renderFilePathHighlight();
      }
      return;
    }

    // Check for URL
    const url = this.findUrlAtPosition(text, charPos);
    if (url) {
      // Create a temporary AtPathRange for the URL
      const tempRange: AtPathRange = { start: url.start, end: url.end };
      if (!this.hoveredAtPath || this.hoveredAtPath.start !== tempRange.start || this.hoveredAtPath.end !== tempRange.end) {
        this.hoveredAtPath = tempRange;
        this.renderFilePathHighlight();
      }
      return;
    }

    // Check for slash command (like /commit, /help) - only if command type is enabled
    if (this.isCommandEnabledSync()) {
      const slashCommand = this.findSlashCommandAtPosition(text, charPos);
      if (slashCommand) {
        // Create a temporary AtPathRange for the slash command
        const tempRange: AtPathRange = { start: slashCommand.start, end: slashCommand.end };
        if (!this.hoveredAtPath || this.hoveredAtPath.start !== tempRange.start || this.hoveredAtPath.end !== tempRange.end) {
          this.hoveredAtPath = tempRange;
          this.renderFilePathHighlight();
        }
        return;
      }
    }

    // Check for absolute path (starting with /)
    const clickablePath = this.findClickablePathAtPosition(text, charPos);
    if (clickablePath) {
      // Create a temporary AtPathRange for the absolute path
      const tempRange: AtPathRange = { start: clickablePath.start, end: clickablePath.end };
      if (!this.hoveredAtPath || this.hoveredAtPath.start !== tempRange.start || this.hoveredAtPath.end !== tempRange.end) {
        this.hoveredAtPath = tempRange;
        this.renderFilePathHighlight();
      }
      return;
    }

    this.clearFilePathHighlight();
  }

  /**
   * Find AtPathRange at the given position
   */
  private findAtPathRangeAtPosition(charPos: number): AtPathRange | null {
    for (const atPath of this.atPaths) {
      if (charPos >= atPath.start && charPos < atPath.end) {
        return atPath;
      }
    }
    return null;
  }

  /**
   * Get character position from mouse coordinates using mirror div
   */
  private getCharPositionFromCoordinates(clientX: number, clientY: number): number | null {
    if (!this.textInput) return null;

    const textareaRect = this.textInput.getBoundingClientRect();
    const relativeX = clientX - textareaRect.left + this.textInput.scrollLeft;
    const relativeY = clientY - textareaRect.top + this.textInput.scrollTop;

    // Simple approximation based on line height and character width
    const style = window.getComputedStyle(this.textInput);
    const lineHeight = parseFloat(style.lineHeight) || 20;
    const fontSize = parseFloat(style.fontSize) || 15;
    const charWidth = fontSize * 0.55; // Approximate character width

    const paddingTop = parseFloat(style.paddingTop) || 0;
    const paddingLeft = parseFloat(style.paddingLeft) || 0;

    const text = this.textInput.value;
    const lines = text.split('\n');

    // Calculate which line
    const lineIndex = Math.floor((relativeY - paddingTop) / lineHeight);
    if (lineIndex < 0 || lineIndex >= lines.length) return null;

    // Calculate position within line
    let charIndex = Math.floor((relativeX - paddingLeft) / charWidth);
    charIndex = Math.max(0, Math.min(charIndex, lines[lineIndex]?.length || 0));

    // Calculate absolute position
    let absolutePos = 0;
    for (let i = 0; i < lineIndex; i++) {
      absolutePos += (lines[i]?.length || 0) + 1; // +1 for newline
    }
    absolutePos += charIndex;

    return Math.min(absolutePos, text.length);
  }

  /**
   * Render file path highlight (link style) while preserving @path highlights
   */
  private renderFilePathHighlight(): void {
    if (!this.highlightBackdrop || !this.textInput || !this.hoveredAtPath) return;

    const text = this.textInput.value;

    // Re-scan for @paths
    this.rescanAtPaths(text);

    // Check if hoveredAtPath is an @path or an absolute path
    const isHoveredAtPathInAtPaths = this.atPaths.some(
      ap => ap.start === this.hoveredAtPath?.start && ap.end === this.hoveredAtPath?.end
    );

    // Merge @paths and hoveredAtPath (if it's an absolute path not in atPaths)
    const allHighlightRanges: Array<AtPathRange & { isAtPath: boolean; isHovered: boolean }> = [];

    // Add @paths
    for (const atPath of this.atPaths) {
      const isHovered = this.hoveredAtPath !== null &&
        atPath.start === this.hoveredAtPath.start &&
        atPath.end === this.hoveredAtPath.end;
      allHighlightRanges.push({ ...atPath, isAtPath: true, isHovered });
    }

    // Add absolute path if not already in @paths
    if (!isHoveredAtPathInAtPaths && this.hoveredAtPath) {
      allHighlightRanges.push({
        start: this.hoveredAtPath.start,
        end: this.hoveredAtPath.end,
        isAtPath: false,
        isHovered: true
      });
    }

    // Sort by start position
    allHighlightRanges.sort((a, b) => a.start - b.start);

    // Build highlighted content with link style on hovered path
    const fragment = document.createDocumentFragment();
    let lastEnd = 0;

    for (const range of allHighlightRanges) {
      // Add text before this range
      if (range.start > lastEnd) {
        fragment.appendChild(document.createTextNode(text.substring(lastEnd, range.start)));
      }

      // Add highlighted span
      const span = document.createElement('span');

      if (range.isAtPath) {
        span.className = 'at-path-highlight';
      }

      // Add link style if this is the hovered path
      if (range.isHovered) {
        span.classList.add('file-path-link');
      }

      span.textContent = text.substring(range.start, range.end);
      fragment.appendChild(span);

      lastEnd = range.end;
    }

    // Add remaining text
    if (lastEnd < text.length) {
      fragment.appendChild(document.createTextNode(text.substring(lastEnd)));
    }

    // Clear existing content using DOM methods (avoid innerHTML for security)
    while (this.highlightBackdrop.firstChild) {
      this.highlightBackdrop.removeChild(this.highlightBackdrop.firstChild);
    }
    this.highlightBackdrop.appendChild(fragment);

    // Sync scroll
    this.syncBackdropScroll();
  }

  /**
   * Clear file path highlight (link style) while preserving @path highlights
   */
  private clearFilePathHighlight(): void {
    this.hoveredAtPath = null;
    // Re-render without link style (just @path highlights, with cursor highlight)
    this.renderHighlightBackdropWithCursor();
  }

  /**
   * Update cursor position highlight (called when cursor moves)
   * Only highlights absolute file paths and URLs, not @paths (which already have their own highlight)
   * Also updates hint text to show Ctrl+Enter shortcut when on a clickable path or URL
   */
  private updateCursorPositionHighlight(): void {
    if (!this.textInput) return;

    const text = this.textInput.value;
    const cursorPos = this.textInput.selectionStart;

    // First check if cursor is on an @path - still show hint but no extra highlight
    const atPath = this.findAtPathAtPosition(text, cursorPos);
    if (atPath) {
      // Show hint for @path too
      this.showFileOpenHint();
      if (this.cursorPositionPath) {
        this.cursorPositionPath = null;
        this.renderHighlightBackdropWithCursor();
      }
      return;
    }

    // Check if cursor is on a URL
    const url = this.findUrlAtPosition(text, cursorPos);
    if (url) {
      // Show hint for URL
      this.showUrlOpenHint();
      const newRange: AtPathRange = { start: url.start, end: url.end };
      // Only update if position changed
      if (!this.cursorPositionPath ||
          this.cursorPositionPath.start !== newRange.start ||
          this.cursorPositionPath.end !== newRange.end) {
        this.cursorPositionPath = newRange;
        this.renderHighlightBackdropWithCursor();
      }
      return;
    }

    // Check if cursor is on a slash command (only if command type is enabled)
    if (this.isCommandEnabledSync()) {
      const slashCommand = this.findSlashCommandAtPosition(text, cursorPos);
      if (slashCommand) {
        // Show hint for slash command
        this.showSlashCommandOpenHint();
        const newRange: AtPathRange = { start: slashCommand.start, end: slashCommand.end };
        // Only update if position changed
        if (!this.cursorPositionPath ||
            this.cursorPositionPath.start !== newRange.start ||
            this.cursorPositionPath.end !== newRange.end) {
          this.cursorPositionPath = newRange;
          this.renderHighlightBackdropWithCursor();
        }
        return;
      }
    }

    // Find absolute path at cursor position (paths starting with / or ~)
    const absolutePath = this.findAbsolutePathAtPosition(text, cursorPos);

    if (absolutePath) {
      // Show hint for absolute path
      this.showFileOpenHint();
      // Get the range for the absolute path
      const pathInfo = this.findClickablePathAtPosition(text, cursorPos);
      if (pathInfo && !pathInfo.path.startsWith('@')) {
        const newRange: AtPathRange = { start: pathInfo.start, end: pathInfo.end };
        // Only update if position changed
        if (!this.cursorPositionPath ||
            this.cursorPositionPath.start !== newRange.start ||
            this.cursorPositionPath.end !== newRange.end) {
          this.cursorPositionPath = newRange;
          this.renderHighlightBackdropWithCursor();
        }
      }
    } else {
      // Restore default hint when not on a clickable path
      this.restoreDefaultHint();
      if (this.cursorPositionPath) {
        // Clear cursor highlight
        this.cursorPositionPath = null;
        this.renderHighlightBackdropWithCursor();
      }
    }
  }

  /**
   * Show hint for opening file with Ctrl+Enter
   */
  private showFileOpenHint(): void {
    // Skip hint if file search is disabled
    if (!this.fileSearchEnabled) {
      return;
    }
    if (this.callbacks.updateHintText) {
      this.callbacks.updateHintText('Ctrl + ↵ to open');
    }
  }

  /**
   * Show hint for opening URL with Ctrl+Enter
   */
  private showUrlOpenHint(): void {
    if (this.callbacks.updateHintText) {
      this.callbacks.updateHintText('Ctrl + ↵ to open URL in browser');
    }
  }

  /**
   * Show hint for opening slash command file with Ctrl+Enter
   */
  private showSlashCommandOpenHint(): void {
    if (this.callbacks.updateHintText) {
      this.callbacks.updateHintText('Ctrl + ↵ to open command file');
    }
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
    // No cached data at all - index is being built
    if (!this.cachedDirectoryData) {
      return true;
    }

    // File search is disabled for this directory (e.g., root directory) - not building
    if (this.cachedDirectoryData.filesDisabled) {
      return false;
    }

    // Draft fallback with no files - index is being built
    if (this.cachedDirectoryData.fromDraft && this.cachedDirectoryData.files.length === 0) {
      return true;
    }

    return false;
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
   * Render highlight backdrop with cursor position highlight
   * @paths get their own highlight, absolute paths get cursor highlight
   */
  private renderHighlightBackdropWithCursor(): void {
    if (!this.highlightBackdrop || !this.textInput) return;

    const text = this.textInput.value;

    // Re-scan for @paths
    this.rescanAtPaths(text);

    // If there's an active Cmd+hover, use the full link style rendering
    if (this.hoveredAtPath) {
      this.renderFilePathHighlight();
      return;
    }

    // Collect all highlight ranges: @paths and cursor position (for absolute paths only)
    const allHighlightRanges: Array<AtPathRange & { isAtPath: boolean; isCursorHighlight: boolean }> = [];

    // Add @paths (no cursor highlight for @paths - they have their own style)
    for (const atPath of this.atPaths) {
      allHighlightRanges.push({ ...atPath, isAtPath: true, isCursorHighlight: false });
    }

    // Add cursor position path for absolute paths (not @paths)
    if (this.cursorPositionPath) {
      allHighlightRanges.push({
        start: this.cursorPositionPath.start,
        end: this.cursorPositionPath.end,
        isAtPath: false,
        isCursorHighlight: true
      });
    }

    // Sort by start position
    allHighlightRanges.sort((a, b) => a.start - b.start);

    // Build highlighted content
    const fragment = document.createDocumentFragment();
    let lastEnd = 0;

    for (const range of allHighlightRanges) {
      // Add text before this range
      if (range.start > lastEnd) {
        fragment.appendChild(document.createTextNode(text.substring(lastEnd, range.start)));
      }

      // Add highlighted span
      const span = document.createElement('span');

      if (range.isAtPath) {
        span.className = 'at-path-highlight';
      } else if (range.isCursorHighlight) {
        span.className = 'file-path-cursor-highlight';
      }

      span.textContent = text.substring(range.start, range.end);
      fragment.appendChild(span);

      lastEnd = range.end;
    }

    // Add remaining text
    if (lastEnd < text.length) {
      fragment.appendChild(document.createTextNode(text.substring(lastEnd)));
    }

    // Clear existing content using DOM methods (avoid innerHTML for security)
    while (this.highlightBackdrop.firstChild) {
      this.highlightBackdrop.removeChild(this.highlightBackdrop.firstChild);
    }
    this.highlightBackdrop.appendChild(fragment);

    // Sync scroll
    this.syncBackdropScroll();
  }

  /**
   * Handle Ctrl+Enter to open file or URL at cursor position
   */
  private async handleCtrlEnterOpenFile(e: KeyboardEvent): Promise<void> {
    if (!this.textInput) return;

    const text = this.textInput.value;
    const cursorPos = this.textInput.selectionStart;

    // Check for URL first
    const url = this.findUrlAtPosition(text, cursorPos);
    if (url) {
      e.preventDefault();
      e.stopPropagation();

      await this.openUrlInBrowser(url.url);
      return;
    }

    // Check for slash command (like /commit, /help) - only if command type is enabled
    if (this.isCommandEnabledSync()) {
      const slashCommand = this.findSlashCommandAtPosition(text, cursorPos);
      if (slashCommand) {
        e.preventDefault();
        e.stopPropagation();

        try {
          const commandFilePath = await window.electronAPI.slashCommands.getFilePath(slashCommand.command);
          if (commandFilePath) {
            await this.openFileAndRestoreFocus(commandFilePath);
            return;
          }
        } catch (err) {
          console.error('Failed to resolve slash command file path:', err);
        }
        return;
      }
    }

    // Find @path at cursor position
    const atPath = this.findAtPathAtPosition(text, cursorPos);
    if (atPath) {
      e.preventDefault();
      e.stopPropagation();

      const looksLikeFilePath = atPath.includes('/') || atPath.includes('.');

      if (looksLikeFilePath) {
        const filePath = this.resolveAtPathToAbsolute(atPath);
        if (filePath) {
          await this.openFileAndRestoreFocus(filePath);
          return;
        }
      }

      // Try as agent name
      try {
        const agentFilePath = await window.electronAPI.agents.getFilePath(atPath);
        if (agentFilePath) {
          await this.openFileAndRestoreFocus(agentFilePath);
          return;
        }
      } catch (err) {
        console.error('Failed to resolve agent file path:', err);
      }

      // Fallback
      if (!looksLikeFilePath) {
        const filePath = this.resolveAtPathToAbsolute(atPath);
        if (filePath) {
          await this.openFileAndRestoreFocus(filePath);
        }
      }
      return;
    }

    // Find absolute path at cursor position
    const absolutePath = this.findAbsolutePathAtPosition(text, cursorPos);
    if (absolutePath) {
      e.preventDefault();
      e.stopPropagation();

      await this.openFileAndRestoreFocus(absolutePath);
    }
  }

  /**
   * Handle Cmd+click on @path, absolute path, or URL in textarea
   * Supports: URLs, file paths, agent names, and absolute paths (including ~)
   */
  private async handleCmdClickOnAtPath(e: MouseEvent): Promise<void> {
    if (!this.textInput) return;

    const text = this.textInput.value;
    const cursorPos = this.textInput.selectionStart;

    // Check for URL first
    const url = this.findUrlAtPosition(text, cursorPos);
    if (url) {
      e.preventDefault();
      e.stopPropagation();

      await this.openUrlInBrowser(url.url);
      return;
    }

    // Check for slash command (like /commit, /help) - only if command type is enabled
    if (this.isCommandEnabledSync()) {
      const slashCommand = this.findSlashCommandAtPosition(text, cursorPos);
      if (slashCommand) {
        e.preventDefault();
        e.stopPropagation();

        try {
          const commandFilePath = await window.electronAPI.slashCommands.getFilePath(slashCommand.command);
          if (commandFilePath) {
            await this.openFileAndRestoreFocus(commandFilePath);
            return;
          }
        } catch (err) {
          console.error('Failed to resolve slash command file path:', err);
        }
        return;
      }
    }

    // Find @path at or near cursor position
    const atPath = this.findAtPathAtPosition(text, cursorPos);
    if (atPath) {
      e.preventDefault();
      e.stopPropagation();

      // Check if it looks like a file path (contains / or . in the original input)
      const looksLikeFilePath = atPath.includes('/') || atPath.includes('.');

      if (looksLikeFilePath) {
        // Resolve as file path first
        const filePath = this.resolveAtPathToAbsolute(atPath);
        if (filePath) {
          await this.openFileAndRestoreFocus(filePath);
          return;
        }
      }

      // Try to resolve as agent name (for names like @backend-architect)
      try {
        const agentFilePath = await window.electronAPI.agents.getFilePath(atPath);
        if (agentFilePath) {
          await this.openFileAndRestoreFocus(agentFilePath);
          return;
        }
      } catch (err) {
        console.error('Failed to resolve agent file path:', err);
      }

      // Fallback: try to open as file path if it wasn't already tried
      if (!looksLikeFilePath) {
        const filePath = this.resolveAtPathToAbsolute(atPath);
        if (filePath) {
          await this.openFileAndRestoreFocus(filePath);
        }
      }
      return;
    }

    // Find absolute path at cursor position
    const absolutePath = this.findAbsolutePathAtPosition(text, cursorPos);
    if (absolutePath) {
      e.preventDefault();
      e.stopPropagation();

      await this.openFileAndRestoreFocus(absolutePath);
    }
  }

  /**
   * Find @path at the given cursor position
   * Returns the path (without @) if found, null otherwise
   */
  private findAtPathAtPosition(text: string, cursorPos: number): string | null {
    // Pattern to match @path (file paths after @)
    const atPathPattern = /@([^\s@]+)/g;
    let match;

    while ((match = atPathPattern.exec(text)) !== null) {
      const start = match.index;
      const end = start + match[0].length;

      // Check if cursor is within this @path
      if (cursorPos >= start && cursorPos <= end) {
        return match[1] ?? null; // Return path without @
      }
    }

    return null;
  }

  /**
   * Find URL at the given cursor position
   * Returns { url, start, end } if found, null otherwise
   * Supports both http:// and https:// URLs including query parameters
   */
  private findUrlAtPosition(text: string, cursorPos: number): { url: string; start: number; end: number } | null {
    // Pattern to match URLs starting with http:// or https://
    // Includes query parameters (?key=value) and fragments (#section)
    const urlPattern = /https?:\/\/[^\s"'<>|*\n]+/gi;
    let match;

    while ((match = urlPattern.exec(text)) !== null) {
      const start = match.index;
      const end = start + match[0].length;

      // Check if cursor is within this URL
      if (cursorPos >= start && cursorPos <= end) {
        return { url: match[0], start, end };
      }
    }

    return null;
  }

  /**
   * Find slash command at the given cursor position
   * Returns { command, start, end } if found, null otherwise
   * Slash commands are like /commit, /help (single word after /)
   */
  private findSlashCommandAtPosition(text: string, cursorPos: number): { command: string; start: number; end: number } | null {
    // Pattern to match slash commands: /word (no slashes in the middle)
    // This matches /commit, /help, etc. but not /path/to/file
    const slashCommandPattern = /\/([a-zA-Z][a-zA-Z0-9_-]*)/g;
    let match;

    while ((match = slashCommandPattern.exec(text)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      const commandName = match[1] ?? '';

      // Check if cursor is within this slash command
      if (cursorPos >= start && cursorPos <= end) {
        // Make sure it's at the start of text or after whitespace (not part of a path)
        const prevChar = start > 0 ? text[start - 1] : ' ';
        if (prevChar === ' ' || prevChar === '\n' || prevChar === '\t' || start === 0) {
          return { command: commandName, start, end };
        }
      }
    }

    return null;
  }

  /**
   * Find absolute file path at the given cursor position
   * Returns the path if found, null otherwise
   * Supports both / and ~ (home directory) prefixed paths
   */
  private findAbsolutePathAtPosition(text: string, cursorPos: number): string | null {
    // Pattern to match absolute paths starting with / or ~
    // Matches paths like /Users/name/.prompt-line/images/file.png
    // or ~/.prompt-line/images/file.png
    const absolutePathPattern = /(?:\/|~\/)[^\s"'<>|*?\n]+/g;
    let match;

    while ((match = absolutePathPattern.exec(text)) !== null) {
      const start = match.index;
      const end = start + match[0].length;

      // Check if path is at start of text or preceded by whitespace
      // This prevents matching paths like "ghq/github.com/..." as absolute paths
      const prevChar = start > 0 ? text[start - 1] : '';
      if (prevChar !== '' && prevChar !== ' ' && prevChar !== '\t' && prevChar !== '\n') {
        continue; // Skip - not a standalone absolute path
      }

      // Check if cursor is within this path
      if (cursorPos >= start && cursorPos <= end) {
        return match[0]; // Return the full path
      }
    }

    return null;
  }

  /**
   * Find any clickable file path at the given position
   * Returns { path, start, end } if found
   * Excludes slash commands (e.g., /commit) from absolute path detection
   */
  private findClickablePathAtPosition(text: string, cursorPos: number): { path: string; start: number; end: number } | null {
    // First check @path
    const atPathPattern = /@([^\s@]+)/g;
    let match;

    while ((match = atPathPattern.exec(text)) !== null) {
      const start = match.index;
      const end = start + match[0].length;

      if (cursorPos >= start && cursorPos <= end) {
        return { path: match[1] ?? '', start, end };
      }
    }

    // Then check absolute paths (including ~ for home directory)
    // Excludes single-level paths like /commit (slash commands)
    const absolutePathPattern = /(?:\/(?:[^\s"'<>|*?\n/]+\/)+[^\s"'<>|*?\n]*|~\/[^\s"'<>|*?\n]+)/g;
    while ((match = absolutePathPattern.exec(text)) !== null) {
      const start = match.index;
      const end = start + match[0].length;

      // Check if path is at start of text or preceded by whitespace
      // This prevents matching paths like "ghq/github.com/..." as absolute paths
      const prevChar = start > 0 ? text[start - 1] : '';
      if (prevChar !== '' && prevChar !== ' ' && prevChar !== '\t' && prevChar !== '\n') {
        continue; // Skip - not a standalone absolute path
      }

      if (cursorPos >= start && cursorPos <= end) {
        return { path: match[0], start, end };
      }
    }

    return null;
  }

  /**
   * Normalize a path by resolving . and .. segments
   * This is a browser-compatible implementation since Node's path module isn't available
   */
  private normalizePath(filePath: string): string {
    const parts = filePath.split('/');
    const result: string[] = [];

    for (const part of parts) {
      if (part === '..') {
        // Go up one directory (remove last segment)
        if (result.length > 0 && result[result.length - 1] !== '') {
          result.pop();
        }
      } else if (part !== '.' && part !== '') {
        // Skip current directory marker and empty parts (except for leading empty for absolute paths)
        result.push(part);
      } else if (part === '' && result.length === 0) {
        // Preserve leading empty string for absolute paths (e.g., /Users/...)
        result.push(part);
      }
    }

    return result.join('/') || '/';
  }

  /**
   * Parse a path that may contain line number and symbol name suffix
   * Format: path:lineNumber#symbolName
   * Returns: { path: string, lineNumber?: number, symbolName?: string }
   */
  private parsePathWithLineInfo(pathStr: string): { path: string; lineNumber?: number; symbolName?: string } {
    // Match pattern: path:lineNumber#symbolName or path:lineNumber
    const match = pathStr.match(/^(.+?):(\d+)(#(.+))?$/);
    if (match && match[1] && match[2]) {
      const result: { path: string; lineNumber?: number; symbolName?: string } = {
        path: match[1],
        lineNumber: parseInt(match[2], 10)
      };
      if (match[4]) {
        result.symbolName = match[4];
      }
      return result;
    }
    // No line number suffix
    return { path: pathStr };
  }

  /**
   * Resolve a relative file path to absolute path
   * Handles paths with line number and symbol suffix: path:lineNumber#symbolName
   * Preserves line number and symbol suffix in the returned path
   */
  private resolveAtPathToAbsolute(relativePath: string): string | null {
    // Parse the path to extract line number/symbol suffix
    const parsed = this.parsePathWithLineInfo(relativePath);
    const cleanPath = parsed.path;

    const baseDir = this.cachedDirectoryData?.directory;
    let absolutePath: string;

    if (!baseDir) {
      // If no base directory, try to use the path as-is
      absolutePath = cleanPath;
    } else if (cleanPath.startsWith('/')) {
      // Already an absolute path
      absolutePath = cleanPath;
    } else {
      // Combine with base directory and normalize (handles ../ etc.)
      const combined = `${baseDir}/${cleanPath}`;
      absolutePath = this.normalizePath(combined);
    }

    // Re-append line number and symbol suffix if they were present
    if (parsed.lineNumber !== undefined) {
      absolutePath = `${absolutePath}:${parsed.lineNumber}`;
      if (parsed.symbolName) {
        absolutePath = `${absolutePath}#${parsed.symbolName}`;
      }
    }

    return absolutePath;
  }

  /**
   * Open URL in external browser and restore focus to PromptLine window
   * Enables window dragging during URL open operation (same behavior as file open)
   * @param url - URL to open
   */
  private async openUrlInBrowser(url: string): Promise<void> {
    try {
      this.callbacks.onBeforeOpenFile?.();
      // Enable draggable state while URL is opening
      this.callbacks.setDraggable?.(true);
      const result = await window.electronAPI.shell.openExternal(url);
      if (!result.success) {
        console.error('Failed to open URL in browser:', result.error);
        // Disable draggable state on error
        this.callbacks.setDraggable?.(false);
      } else {
        console.log('URL opened successfully in browser:', url);
        // Restore focus to PromptLine window after a short delay
        // Keep draggable state enabled so user can move window while browser is open
        setTimeout(() => {
          window.electronAPI.window.focus().catch((err: Error) =>
            console.error('Failed to restore focus:', err)
          );
        }, 100);
      }
    } catch (err) {
      console.error('Failed to open URL in browser:', err);
      // Disable draggable state on error
      this.callbacks.setDraggable?.(false);
    }
  }

  /**
   * Open file in editor
   * The opened file's application will be brought to foreground
   * @param filePath - Path to the file to open
   */
  private async openFileAndRestoreFocus(filePath: string): Promise<void> {
    try {
      this.callbacks.onBeforeOpenFile?.();
      // Enable draggable state while file is opening
      this.callbacks.setDraggable?.(true);
      await window.electronAPI.file.openInEditor(filePath);
      // Note: Do not restore focus to PromptLine window
      // The opened file's application should stay in foreground
    } catch (err) {
      console.error('Failed to open file in editor:', err);
      // Disable draggable state on error
      this.callbacks.setDraggable?.(false);
    }
  }

  /**
   * Cache directory data from window-shown event (Stage 1 quick data)
   * @deprecated Use handleCachedDirectoryData instead for better cache support
   */
  public cacheDirectoryData(data: DirectoryInfo | DirectoryData): void {
    // Forward to new method for consistency
    this.handleCachedDirectoryData(data);
  }

  /**
   * Update cache with new data from directory-data-updated event (Stage 2 recursive data)
   * Handles both full updates (with files) and directory-only updates (for code search)
   */
  public updateCache(data: DirectoryInfo | DirectoryData): void {
    if (!data.directory) {
      console.debug('[FileSearchManager] updateCache: no directory in data');
      return;
    }

    // Get hint and filesDisabled from DirectoryInfo if available
    const hint = 'hint' in data ? (data as DirectoryInfo).hint : undefined;
    const filesDisabled = 'filesDisabled' in data ? (data as DirectoryInfo).filesDisabled : undefined;
    const filesDisabledReason = 'filesDisabledReason' in data ? (data as DirectoryInfo).filesDisabledReason : undefined;

    // Check if this is an update to the same directory
    const isSameDirectory = this.cachedDirectoryData?.directory === data.directory;

    // Handle directory-only updates (no files - e.g., file listing failed)
    // This is important for code search which only needs the directory
    if (!data.files) {
      // For directory-only updates, only update if directory changed
      if (!isSameDirectory) {
        console.debug('[FileSearchManager] updateCache: directory-only update (directory changed)', {
          from: this.cachedDirectoryData?.directory,
          to: data.directory
        });
        this.cachedDirectoryData = {
          directory: data.directory,
          files: [],  // Empty files - code search will work, file search won't
          timestamp: Date.now(),
          partial: false,
          searchMode: 'recursive',
          ...(hint ? { hint } : {}),
          ...(filesDisabled && filesDisabledReason ? { filesDisabled, filesDisabledReason } : filesDisabled ? { filesDisabled } : {})
        };

        // Show hint message if present
        if (hint && this.callbacks.updateHintText) {
          this.callbacks.updateHintText(hint);
          console.warn('[FileSearchManager] Hint:', hint);
        }
      } else {
        console.debug('[FileSearchManager] updateCache: skipping directory-only update (same directory)');
      }
      return;
    }

    // Full update with files - only update if we have more complete data
    const shouldUpdate = !this.cachedDirectoryData ||
      !isSameDirectory ||
      (data.searchMode === 'recursive') ||
      (data.files.length > (this.cachedDirectoryData?.files.length || 0));

    if (!shouldUpdate) {
      console.debug('[FileSearchManager] updateCache: skipping update, existing data is sufficient');
      return;
    }

    this.cachedDirectoryData = {
      directory: data.directory,
      files: data.files,
      timestamp: Date.now(),
      partial: false,  // Always false (single stage with fd)
      searchMode: 'recursive',  // Always recursive (fd is required)
      // Cache flags (fromCache, cacheAge) are intentionally omitted for fresh data
      ...(hint ? { hint } : {}),
      ...(filesDisabled && filesDisabledReason ? { filesDisabled, filesDisabledReason } : filesDisabled ? { filesDisabled } : {})
    };

    // Show hint message in footer if present (e.g., fd not installed)
    if (hint && this.callbacks.updateHintText) {
      this.callbacks.updateHintText(hint);
      console.warn('[FileSearchManager] Hint:', hint);
    }

    console.debug('[FileSearchManager] updateCache:', formatLog({
      directory: data.directory,
      fileCount: data.files.length,
      searchMode: 'recursive',
      hint
    }));

    // If suggestions are currently visible and not actively searching, refresh them
    if (this.isVisible && !this.currentQuery) {
      this.refreshSuggestions();
    }
  }

  /**
   * Clear the cached directory data
   */
  public clearCache(): void {
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
    this.renderSuggestions();
  }

  /**
   * Get cache status for display (e.g., in footer hint)
   */
  public getCacheStatus(): { fromCache: boolean; cacheAge?: number | undefined; directory?: string | undefined } | null {
    if (!this.cachedDirectoryData) return null;

    const status: { fromCache: boolean; cacheAge?: number | undefined; directory?: string | undefined } = {
      fromCache: this.cachedDirectoryData.fromCache || false
    };

    if (this.cachedDirectoryData.cacheAge !== undefined) {
      status.cacheAge = this.cachedDirectoryData.cacheAge;
    }

    if (this.cachedDirectoryData.directory !== undefined) {
      status.directory = this.cachedDirectoryData.directory;
    }

    return status;
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
        console.debug('[FileSearchManager] checkForFileSearch: rgAvailable=', this.rgAvailable, 'supportedLanguages.size=', this.supportedLanguages.size, 'supportedLanguages.has(language)=', this.supportedLanguages.has(language));

        // If code search not yet initialized, wait for it
        if (this.codeSearchInitPromise && this.supportedLanguages.size === 0) {
          console.debug('[FileSearchManager] checkForFileSearch: waiting for code search initialization...');
          this.codeSearchInitPromise.then(() => {
            // Re-check after initialization (only if cursor position hasn't changed)
            if (this.textInput && this.textInput.value.includes(`@${query}`)) {
              this.checkForFileSearch();
            }
          });
          return;
        }

        // Check if language is supported
        if (this.rgAvailable && this.supportedLanguages.has(language)) {
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
          console.debug('[FileSearchManager] checkForFileSearch: code search not available, rgAvailable=', this.rgAvailable);
          const langInfo = this.supportedLanguages.get(language);
          if (!langInfo && this.rgAvailable) {
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
   * @param symbolTypeFilter - Optional symbol type filter (e.g., "func" for functions only)
   * @param refreshCache - Whether to trigger a background cache refresh
   */
  private async searchSymbols(language: string, query: string, symbolTypeFilter: string | null = null, refreshCache: boolean = false): Promise<void> {
    if (!this.cachedDirectoryData?.directory) {
      console.debug('[FileSearchManager] searchSymbols: no directory');
      return;
    }

    try {
      // Code search (@go:) - only refresh cache when explicitly requested (first entry to code search mode)
      const response = await window.electronAPI.codeSearch.searchSymbols(
        this.cachedDirectoryData.directory,
        language,
        { maxSymbols: 20000, useCache: true, refreshCache }
      );

      if (!response.success) {
        console.warn('[FileSearchManager] Symbol search failed:', response.error);
        this.callbacks.updateHintText?.(response.error || 'Search failed');
        this.hideSuggestions();
        return;
      }

      let filtered: SymbolResult[] = response.symbols;

      // Filter by symbol type first (e.g., @go:func: → only functions)
      if (symbolTypeFilter) {
        const targetType = SYMBOL_TYPE_FROM_DISPLAY[symbolTypeFilter];
        if (targetType) {
          filtered = filtered.filter((s: SymbolResult) => s.type === targetType);
        }
      }

      // Filter symbols by query (search in both name and lineContent)
      if (query) {
        const lowerQuery = query.toLowerCase();
        filtered = filtered.filter((s: SymbolResult) =>
          s.name.toLowerCase().includes(lowerQuery) ||
          s.lineContent.toLowerCase().includes(lowerQuery)
        );

        // Sort by match relevance (name match takes priority)
        filtered.sort((a: SymbolResult, b: SymbolResult) => {
          const aName = a.name.toLowerCase();
          const bName = b.name.toLowerCase();
          const aNameMatch = aName.includes(lowerQuery);
          const bNameMatch = bName.includes(lowerQuery);
          // Name match takes priority over lineContent match
          if (aNameMatch && !bNameMatch) return -1;
          if (!aNameMatch && bNameMatch) return 1;
          // Within name matches, prefer starts with
          const aStarts = aName.startsWith(lowerQuery);
          const bStarts = bName.startsWith(lowerQuery);
          if (aStarts && !bStarts) return -1;
          if (!aStarts && bStarts) return 1;
          return aName.localeCompare(bName);
        });
      }

      // Limit results
      const maxSuggestions = 20;
      this.filteredSymbols = filtered.slice(0, maxSuggestions);

      // Clear file and agent results for code search mode
      this.filteredFiles = [];
      this.filteredAgents = [];

      // Convert symbols to SuggestionItems
      this.mergedSuggestions = this.filteredSymbols.map((symbol, index) => ({
        type: 'symbol' as const,
        symbol,
        score: 1000 - index  // Higher score for earlier results
      }));

      this.selectedIndex = 0;
      this.isVisible = true;

      if (this.mergedSuggestions.length > 0) {
        this.renderSuggestions(false);
        this.positionSuggestions();
        this.updateSelection();

        // Update hint with symbol count
        const langInfo = this.supportedLanguages.get(language);
        this.callbacks.updateHintText?.(`${this.filteredSymbols.length} ${langInfo?.displayName || language} symbols`);
      } else {
        this.callbacks.updateHintText?.(`No symbols found for "${query}"`);
        this.hideSuggestions();
      }
    } catch (error) {
      console.error('[FileSearchManager] Symbol search error:', error);
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
      this.showSymbolSuggestions(query);
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
    this.renderSuggestions(isIndexBuilding && !matchesPrefix);
    this.positionSuggestions();
    this.updateSelection();
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
   * If query is shorter than currentPath, navigate up to the matching level
   */
  private adjustCurrentPathToQuery(query: string): void {
    if (!this.currentPath) return;

    // If query starts with currentPath, we're searching within the current directory
    if (query.startsWith(this.currentPath)) {
      return;
    }

    // Query doesn't match currentPath, need to navigate up
    // Find the longest common prefix that ends with /
    let newPath = '';
    const parts = this.currentPath.split('/').filter(p => p);

    for (let i = 0; i < parts.length; i++) {
      const testPath = parts.slice(0, i + 1).join('/') + '/';
      if (query.startsWith(testPath)) {
        newPath = testPath;
      } else {
        break;
      }
    }

    if (newPath !== this.currentPath) {
      console.debug('[FileSearchManager] adjustCurrentPathToQuery: navigating up', formatLog({
        from: this.currentPath,
        to: newPath,
        query
      }));
      this.currentPath = newPath;
    }
  }

  /**
   * Position the suggestions container near the @ position
   * Shows above the cursor if there's not enough space below
   * Dynamically adjusts max-height based on available space
   * Uses main-content as positioning reference to allow spanning across input and history sections
   */
  private positionSuggestions(): void {
    if (!this.suggestionsContainer || !this.textInput || this.atStartPosition < 0) return;

    const coords = this.getCaretCoordinates(this.atStartPosition);
    if (!coords) return;

    // Get main-content for relative positioning (allows spanning across sections)
    const mainContent = this.textInput.closest('.main-content');
    if (!mainContent) return;

    const mainContentRect = mainContent.getBoundingClientRect();
    const lineHeight = parseInt(window.getComputedStyle(this.textInput).lineHeight) || 20;

    // Calculate position relative to main-content
    const caretTop = coords.top - mainContentRect.top;
    const left = Math.max(8, coords.left - mainContentRect.left);

    // Calculate available space below and above the cursor
    const spaceBelow = mainContentRect.height - (caretTop + lineHeight) - 8; // 8px margin
    const spaceAbove = caretTop - 8; // 8px margin

    let top: number = 0;
    let showAbove = false;
    let availableHeight: number;

    // Decide whether to show above or below based on available space
    if (spaceBelow >= spaceAbove) {
      // Show below the cursor - use all available space below
      top = caretTop + lineHeight + 4;
      availableHeight = spaceBelow;
    } else {
      // Show above the cursor - use all available space above
      showAbove = true;
      availableHeight = spaceAbove;
      // top will be calculated after setting max-height
    }

    // Set dynamic max-height based on available space (minimum 100px)
    const dynamicMaxHeight = Math.max(100, availableHeight);
    this.suggestionsContainer.style.maxHeight = `${dynamicMaxHeight}px`;

    // If showing above, calculate top position based on actual/expected height
    if (showAbove) {
      const menuHeight = Math.min(this.suggestionsContainer.scrollHeight || dynamicMaxHeight, dynamicMaxHeight);
      top = caretTop - menuHeight - 4;
      if (top < 0) top = 0;
    }

    // Calculate dynamic max-width and adjust left position if needed
    // This allows the menu to span into the history section if needed
    const minMenuWidth = 500; // Minimum width for readable descriptions
    const rightMargin = 8; // Margin from right edge
    let availableWidth = mainContentRect.width - left - rightMargin;
    let adjustedLeft = left;

    // If not enough space on the right, shift the menu left to ensure minimum width
    if (availableWidth < minMenuWidth) {
      // Calculate how much to shift left
      const shiftAmount = minMenuWidth - availableWidth;
      adjustedLeft = Math.max(8, left - shiftAmount); // Don't go past left edge
      availableWidth = mainContentRect.width - adjustedLeft - rightMargin;
    }

    const dynamicMaxWidth = Math.max(minMenuWidth, availableWidth);
    this.suggestionsContainer.style.maxWidth = `${dynamicMaxWidth}px`;

    this.suggestionsContainer.style.top = `${top}px`;
    this.suggestionsContainer.style.left = `${adjustedLeft}px`;
    this.suggestionsContainer.style.right = 'auto';
    this.suggestionsContainer.style.bottom = 'auto';

    console.debug('[FileSearchManager] positionSuggestions:', formatLog({
      atPosition: this.atStartPosition,
      top,
      left: adjustedLeft,
      originalLeft: left,
      showAbove,
      spaceBelow,
      spaceAbove,
      dynamicMaxHeight,
      dynamicMaxWidth
    }));
  }

  /**
   * Hide the suggestions dropdown
   */
  public hideSuggestions(): void {
    if (!this.suggestionsContainer) return;

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
    this.hideFrontmatterPopup();
    this.cancelPopupHide();
  }

  /**
   * Remove the @query text from the textarea without inserting a file path
   * Used when opening a file with Ctrl+Enter
   */
  private removeAtQueryText(): void {
    if (this.atStartPosition === -1) return;

    const currentText = this.callbacks.getTextContent();
    const cursorPos = this.callbacks.getCursorPosition();

    // Calculate the end position of the @query (current cursor position)
    const endPosition = cursorPos;

    // Remove the @query text
    const before = currentText.slice(0, this.atStartPosition);
    const after = currentText.slice(endPosition);
    const newText = before + after;

    this.callbacks.setTextContent(newText);
    this.callbacks.setCursorPosition(this.atStartPosition);
  }

  /**
   * Filter files based on query (fuzzy matching) and currentPath
   * When there's a query at root level, search recursively across all files
   */
  public filterFiles(query: string): FileInfo[] {
    if (!this.cachedDirectoryData?.files) return [];

    const baseDir = this.cachedDirectoryData.directory;
    const allFiles = this.cachedDirectoryData.files;
    let files: FileInfo[] = [];

    // If we're in a subdirectory, filter to show only direct children
    // Also create virtual directory entries for intermediate directories
    if (this.currentPath) {
      const seenDirs = new Set<string>();

      for (const file of allFiles) {
        const relativePath = this.getRelativePath(file.path, baseDir);

        // Check if file is under currentPath
        if (!relativePath.startsWith(this.currentPath)) {
          continue;
        }

        // Get the remaining path after currentPath
        const remainingPath = relativePath.substring(this.currentPath.length);
        if (!remainingPath) continue;

        const slashIndex = remainingPath.indexOf('/');

        if (slashIndex === -1) {
          // Direct file child
          files.push(file);
        } else if (slashIndex === remainingPath.length - 1) {
          // Direct directory child (already has trailing slash)
          if (!seenDirs.has(remainingPath)) {
            seenDirs.add(remainingPath);
            files.push(file);
          }
        } else {
          // Intermediate directory - create virtual entry
          const dirName = remainingPath.substring(0, slashIndex);
          if (!seenDirs.has(dirName)) {
            seenDirs.add(dirName);
            // Create virtual directory entry
            const virtualDir: FileInfo = {
              name: dirName,
              path: baseDir + '/' + this.currentPath + dirName,
              isDirectory: true
            };
            files.push(virtualDir);
          }
        }
      }

      if (!query) {
        // Return first N files if no query, with directories first
        const sorted = [...files].sort((a, b) => {
          // Directories come first
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          // Then sort by name
          return a.name.localeCompare(b.name);
        });
        return sorted.slice(0, FileSearchManager.DEFAULT_MAX_SUGGESTIONS);
      }

      const queryLower = query.toLowerCase();

      // Score and filter files
      const scored = files
        .map(file => ({
          file,
          score: this.calculateMatchScore(file, queryLower)
        }))
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, FileSearchManager.DEFAULT_MAX_SUGGESTIONS);

      return scored.map(item => item.file);
    }

    // At root level
    if (!query) {
      // No query - show top-level files and directories only
      const seenDirs = new Set<string>();

      for (const file of allFiles) {
        const relativePath = this.getRelativePath(file.path, baseDir);
        const slashIndex = relativePath.indexOf('/');

        if (slashIndex === -1) {
          // Top-level file
          files.push(file);
        } else {
          // Has subdirectory - create virtual directory for top-level
          const dirName = relativePath.substring(0, slashIndex);
          if (!seenDirs.has(dirName)) {
            seenDirs.add(dirName);
            // Check if we already have this directory in allFiles
            const existingDir = allFiles.find(f =>
              f.isDirectory && this.getRelativePath(f.path, baseDir) === dirName
            );
            if (existingDir) {
              files.push(existingDir);
            } else {
              // Create virtual directory entry
              const virtualDir: FileInfo = {
                name: dirName,
                path: baseDir + '/' + dirName,
                isDirectory: true
              };
              files.push(virtualDir);
            }
          }
        }
      }

      // Return first N files if no query, with directories first
      const sorted = [...files].sort((a, b) => {
        // Directories come first
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        // Then sort by name
        return a.name.localeCompare(b.name);
      });
      return sorted.slice(0, FileSearchManager.DEFAULT_MAX_SUGGESTIONS);
    }

    // With query at root level - search ALL files recursively and show matching ones
    // Also include matching directories
    const queryLower = query.toLowerCase();
    const seenDirs = new Set<string>();
    const matchingDirs: FileInfo[] = [];

    // First, find all matching files (from anywhere in the tree)
    const scoredFiles = allFiles
      .filter(file => !file.isDirectory)
      .map(file => ({
        file,
        score: this.calculateMatchScore(file, queryLower),
        relativePath: this.getRelativePath(file.path, baseDir)
      }))
      .filter(item => item.score > 0);

    // Also find matching directories (by path containing the query)
    // Track seen directory names to avoid duplicates from symlinks
    const seenDirNames = new Map<string, { path: string; depth: number }>();

    for (const file of allFiles) {
      const relativePath = this.getRelativePath(file.path, baseDir);
      const pathParts = relativePath.split('/').filter(p => p);

      // Check each directory in the path (except the last part which is the file name)
      for (let i = 0; i < pathParts.length - 1; i++) {
        const dirPath = pathParts.slice(0, i + 1).join('/');
        const dirName = pathParts[i] || '';

        if (!dirName || seenDirs.has(dirPath)) continue;

        // Check if directory name or path matches query
        if (dirName.toLowerCase().includes(queryLower) || dirPath.toLowerCase().includes(queryLower)) {
          seenDirs.add(dirPath);

          // Check if we already have a directory with the same name
          // Prefer the one with shorter path (likely the original, not symlink-resolved)
          const depth = pathParts.length;
          const existing = seenDirNames.get(dirName);
          if (existing && existing.depth <= depth) {
            continue; // Skip this one, we already have a shorter path
          }

          seenDirNames.set(dirName, { path: dirPath, depth });
          const virtualDir: FileInfo = {
            name: dirName,
            path: baseDir + '/' + dirPath,
            isDirectory: true
          };
          matchingDirs.push(virtualDir);
        }
      }
    }

    // Remove duplicate directories by name (keep shortest path)
    const uniqueDirs = Array.from(seenDirNames.entries()).map(([name, info]) => {
      return matchingDirs.find(d => d.name === name && d.path === baseDir + '/' + info.path);
    }).filter((d): d is FileInfo => d !== undefined);

    // Score directories (use uniqueDirs to avoid duplicates from symlinks)
    const scoredDirs = uniqueDirs.map(dir => ({
      file: dir,
      score: this.calculateMatchScore(dir, queryLower),
      relativePath: this.getRelativePath(dir.path, baseDir)
    }));

    // Combine and sort by score
    const allScored = [...scoredFiles, ...scoredDirs]
      .sort((a, b) => b.score - a.score)
      .slice(0, FileSearchManager.DEFAULT_MAX_SUGGESTIONS);

    return allScored.map(item => item.file);
  }

  /**
   * Calculate match score for a file
   * Higher score = better match
   */
  private calculateMatchScore(file: FileInfo, queryLower: string): number {
    const nameLower = file.name.toLowerCase();
    const pathLower = file.path.toLowerCase();

    let score = 0;

    // Exact name match
    if (nameLower === queryLower) {
      score += 1000;
    }
    // Name starts with query
    else if (nameLower.startsWith(queryLower)) {
      score += 500;
    }
    // Name contains query
    else if (nameLower.includes(queryLower)) {
      score += 200;
    }
    // Path contains query
    else if (pathLower.includes(queryLower)) {
      score += 50;
    }
    // Fuzzy match on name
    else if (this.fuzzyMatch(nameLower, queryLower)) {
      score += 10;
    }

    // Bonus for files (not directories)
    if (!file.isDirectory) {
      score += 5;
    }

    // Bonus for shorter paths
    score += Math.max(0, 20 - pathLower.split('/').length);

    return score;
  }

  /**
   * Simple fuzzy matching
   */
  private fuzzyMatch(text: string, pattern: string): boolean {
    let patternIdx = 0;

    for (let i = 0; i < text.length && patternIdx < pattern.length; i++) {
      if (text[i] === pattern[patternIdx]) {
        patternIdx++;
      }
    }

    return patternIdx === pattern.length;
  }

  /**
   * Count files in a directory (direct children only)
   */
  private countFilesInDirectory(dirPath: string): number {
    if (!this.cachedDirectoryData?.files) return 0;

    const baseDir = this.cachedDirectoryData.directory;
    const dirRelativePath = this.getRelativePath(dirPath, baseDir);
    const dirPrefix = dirRelativePath.endsWith('/') ? dirRelativePath : dirRelativePath + '/';

    let count = 0;
    const seenChildren = new Set<string>();

    for (const file of this.cachedDirectoryData.files) {
      const relativePath = this.getRelativePath(file.path, baseDir);

      if (!relativePath.startsWith(dirPrefix)) continue;

      const remainingPath = relativePath.substring(dirPrefix.length);
      if (!remainingPath) continue;

      // Get the direct child name
      const slashIndex = remainingPath.indexOf('/');
      const childName = slashIndex === -1 ? remainingPath : remainingPath.substring(0, slashIndex);

      if (!seenChildren.has(childName)) {
        seenChildren.add(childName);
        count++;
      }
    }

    return count;
  }

  /**
   * Get total count of merged suggestion items
   */
  private getTotalItemCount(): number {
    return this.mergedSuggestions.length;
  }

  /**
   * Merge files and agents into a single sorted list based on match score
   * When query is empty, prioritize directories first
   */
  private mergeSuggestions(query: string, maxSuggestions?: number): SuggestionItem[] {
    const items: SuggestionItem[] = [];
    const queryLower = query.toLowerCase();

    // Add files with scores
    for (const file of this.filteredFiles) {
      const score = this.calculateMatchScore(file, queryLower);
      items.push({ type: 'file', file, score });
    }

    // Add agents with scores
    for (const agent of this.filteredAgents) {
      const score = this.calculateAgentMatchScore(agent, queryLower);
      items.push({ type: 'agent', agent, score });
    }

    // Sort: when no query, directories first then by name; otherwise by score
    if (!query) {
      items.sort((a, b) => {
        // Directories first
        const aIsDir = a.type === 'file' && a.file?.isDirectory;
        const bIsDir = b.type === 'file' && b.file?.isDirectory;
        if (aIsDir && !bIsDir) return -1;
        if (!aIsDir && bIsDir) return 1;

        // Then by name alphabetically
        const aName = a.type === 'file' ? a.file?.name || '' : a.agent?.name || '';
        const bName = b.type === 'file' ? b.file?.name || '' : b.agent?.name || '';
        return aName.localeCompare(bName);
      });
    } else {
      // Sort by score descending
      items.sort((a, b) => b.score - a.score);
    }

    // Limit to maxSuggestions (use provided value or fallback to DEFAULT_MAX_SUGGESTIONS)
    const limit = maxSuggestions ?? FileSearchManager.DEFAULT_MAX_SUGGESTIONS;
    return items.slice(0, limit);
  }

  /**
   * Calculate match score for an agent
   */
  private calculateAgentMatchScore(agent: AgentItem, queryLower: string): number {
    if (!queryLower) return 50; // Base score for no query

    const nameLower = agent.name.toLowerCase();
    const descLower = agent.description.toLowerCase();

    let score = 0;

    // Exact name match
    if (nameLower === queryLower) {
      score += 1000;
    }
    // Name starts with query
    else if (nameLower.startsWith(queryLower)) {
      score += 500;
    }
    // Name contains query
    else if (nameLower.includes(queryLower)) {
      score += 200;
    }
    // Description contains query
    else if (descLower.includes(queryLower)) {
      score += 50;
    }

    return score;
  }

  /**
   * Render the suggestions in the dropdown
   * @param isIndexBuilding - Whether the file index is currently being built
   */
  private renderSuggestions(isIndexBuilding: boolean = false): void {
    if (!this.suggestionsContainer) return;

    const totalItems = this.getTotalItemCount();

    if (totalItems === 0) {
      // Clear existing content safely
      while (this.suggestionsContainer.firstChild) {
        this.suggestionsContainer.removeChild(this.suggestionsContainer.firstChild);
      }

      // Create empty state element using safe DOM methods
      const emptyDiv = document.createElement('div');
      emptyDiv.className = isIndexBuilding ? 'file-suggestion-empty indexing' : 'file-suggestion-empty';
      emptyDiv.textContent = isIndexBuilding ? 'Building file index...' : 'No matching items found';
      this.suggestionsContainer.appendChild(emptyDiv);

      this.suggestionsContainer.style.display = 'block';
      // Reset scroll position to top
      this.suggestionsContainer.scrollTop = 0;
      return;
    }

    // Reset scroll position to top when search text changes
    this.suggestionsContainer.scrollTop = 0;

    const fragment = document.createDocumentFragment();
    const baseDir = this.cachedDirectoryData?.directory || '';

    // Add path header if we're in a subdirectory
    if (this.currentPath) {
      const header = document.createElement('div');
      header.className = 'file-suggestion-header';
      header.textContent = this.currentPath;
      fragment.appendChild(header);
    }

    // Render merged suggestions (files and agents mixed by score)
    this.mergedSuggestions.forEach((suggestion, itemIndex) => {
      const item = document.createElement('div');

      if (suggestion.type === 'file' && suggestion.file) {
        const file = suggestion.file;
        item.className = 'file-suggestion-item';
        item.setAttribute('role', 'option');
        item.setAttribute('data-index', itemIndex.toString());
        item.setAttribute('data-type', 'file');

        // Create icon using SVG
        const icon = document.createElement('span');
        icon.className = 'file-icon';
        insertSvgIntoElement(icon, getFileIconSvg(file.name, file.isDirectory));

        // Create name with highlighting
        const name = document.createElement('span');
        name.className = 'file-name';

        if (file.isDirectory) {
          // For directories: show name with file count
          const fileCount = this.countFilesInDirectory(file.path);
          this.insertHighlightedText(name, file.name, this.currentQuery);
          const countSpan = document.createElement('span');
          countSpan.className = 'file-count';
          countSpan.textContent = ` (${fileCount} files)`;
          name.appendChild(countSpan);
        } else {
          // For files: just show the name
          this.insertHighlightedText(name, file.name, this.currentQuery);
        }

        item.appendChild(icon);
        item.appendChild(name);

        // Show the directory path next to the filename (for both files and directories)
        const relativePath = this.getRelativePath(file.path, baseDir);
        const dirPath = this.getDirectoryFromPath(relativePath);
        if (dirPath) {
          const pathEl = document.createElement('span');
          pathEl.className = 'file-path';
          pathEl.textContent = dirPath;
          item.appendChild(pathEl);
        }
      } else if (suggestion.type === 'agent' && suggestion.agent) {
        const agent = suggestion.agent;
        item.className = 'file-suggestion-item agent-suggestion-item';
        item.setAttribute('role', 'option');
        item.setAttribute('data-index', itemIndex.toString());
        item.setAttribute('data-type', 'agent');

        // Create icon using SVG
        const icon = document.createElement('span');
        icon.className = 'file-icon mention-icon';
        insertSvgIntoElement(icon, getMentionIconSvg());

        // Create name with highlighting
        const name = document.createElement('span');
        name.className = 'file-name agent-name';
        this.insertHighlightedText(name, agent.name, this.currentQuery);

        // Create description
        const desc = document.createElement('span');
        desc.className = 'file-path agent-description';
        desc.textContent = agent.description;

        item.appendChild(icon);
        item.appendChild(name);
        item.appendChild(desc);

        // Add info icon for frontmatter popup (only if frontmatter exists)
        if (agent.frontmatter) {
          const infoIcon = document.createElement('span');
          infoIcon.className = 'frontmatter-info-icon';
          infoIcon.textContent = 'ⓘ';

          // Show popup on info icon hover (pass infoIcon as target for positioning)
          infoIcon.addEventListener('mouseenter', () => {
            this.showFrontmatterPopup(agent, infoIcon);
          });

          infoIcon.addEventListener('mouseleave', () => {
            this.schedulePopupHide();
          });

          item.appendChild(infoIcon);
        }
      } else if (suggestion.type === 'symbol' && suggestion.symbol) {
        const symbol = suggestion.symbol;
        item.className = 'file-suggestion-item symbol-suggestion-item';
        item.setAttribute('role', 'option');
        item.setAttribute('data-index', itemIndex.toString());
        item.setAttribute('data-type', 'symbol');

        // Create icon for symbol type
        const icon = document.createElement('span');
        icon.className = 'file-icon symbol-icon';
        insertSvgIntoElement(icon, getSymbolIconSvg(symbol.type));

        // Create name with highlighting
        const name = document.createElement('span');
        name.className = 'file-name symbol-name';
        this.insertHighlightedText(name, symbol.name, this.codeSearchQuery);

        // Create type badge
        const typeBadge = document.createElement('span');
        typeBadge.className = 'symbol-type-badge';
        typeBadge.textContent = getSymbolTypeDisplay(symbol.type);

        // Create file path with line number
        const pathEl = document.createElement('span');
        pathEl.className = 'file-path symbol-path';
        pathEl.textContent = `${symbol.relativePath}:${symbol.lineNumber}`;

        item.appendChild(icon);
        item.appendChild(name);
        item.appendChild(typeBadge);
        item.appendChild(pathEl);
      }

      // Click handler
      const currentIndex = itemIndex;
      item.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        // Cmd+クリック（macOS）でエディタで開く
        if (e.metaKey) {
          const clickedSuggestion = this.mergedSuggestions[currentIndex];
          if (clickedSuggestion) {
            let filePath: string | undefined;
            // TODO: Support opening file at specific line number for symbols

            if (clickedSuggestion.type === 'file') {
              filePath = clickedSuggestion.file?.path;
            } else if (clickedSuggestion.type === 'agent') {
              filePath = clickedSuggestion.agent?.filePath;
            } else if (clickedSuggestion.type === 'symbol') {
              filePath = clickedSuggestion.symbol?.filePath;
            }

            if (filePath) {
              await this.openFileAndRestoreFocus(filePath);
              this.hideSuggestions();
              return;
            }
          }
        }

        // 通常クリックは既存の動作（テキスト挿入）
        this.selectItem(currentIndex);
      });

      // Mouse move handler - only highlight when mouse actually moves
      item.addEventListener('mousemove', () => {
        const allItems = this.suggestionsContainer?.querySelectorAll('.file-suggestion-item');
        allItems?.forEach(el => el.classList.remove('hovered'));
        item.classList.add('hovered');
      });

      // Remove hover when mouse leaves the item
      item.addEventListener('mouseleave', () => {
        item.classList.remove('hovered');
      });

      fragment.appendChild(item);
    });

    this.suggestionsContainer.innerHTML = '';
    this.suggestionsContainer.appendChild(fragment);
    this.suggestionsContainer.style.display = 'block';
  }

  /**
   * Select an item from merged suggestions by index
   */
  private selectItem(index: number): void {
    const suggestion = this.mergedSuggestions[index];
    if (!suggestion) return;

    if (suggestion.type === 'file' && suggestion.file) {
      this.selectFileByInfo(suggestion.file);
    } else if (suggestion.type === 'agent' && suggestion.agent) {
      this.selectAgentByInfo(suggestion.agent);
    } else if (suggestion.type === 'symbol' && suggestion.symbol) {
      this.selectSymbol(suggestion.symbol);
    }
  }

  /**
   * Select a symbol and insert its path:lineNumber#symbolName (with @ prefix for highlighting)
   */
  private selectSymbol(symbol: SymbolResult): void {
    if (!this.textInput || this.atStartPosition < 0) return;

    // Format: relativePath:lineNumber#symbolName (keep @ prefix)
    // The @ is already at atStartPosition, so we insert path after it
    const pathWithLineAndSymbol = `${symbol.relativePath}:${symbol.lineNumber}#${symbol.name} `;

    // Get current cursor position (end of the @query)
    const cursorPos = this.textInput.selectionStart;

    // Save atStartPosition before replacement - replaceRangeWithUndo triggers input event
    // which calls checkForFileSearch() and may set atStartPosition to -1 via hideSuggestions()
    const savedAtStartPosition = this.atStartPosition;

    // Replace the lang:query part (after @) with the path:line#symbol
    // atStartPosition is the @ position, so we replace from atStartPosition + 1 to keep @
    if (this.callbacks.replaceRangeWithUndo) {
      // execCommand('insertText') sets cursor at end of inserted text automatically
      // Do NOT set cursor position after this - input event handler may have modified atStartPosition
      this.callbacks.replaceRangeWithUndo(savedAtStartPosition + 1, cursorPos, pathWithLineAndSymbol);
    } else {
      // Fallback without undo support - need to set cursor position manually
      const text = this.textInput.value;
      const newText = text.substring(0, savedAtStartPosition + 1) + pathWithLineAndSymbol + text.substring(cursorPos);
      this.textInput.value = newText;
      const newCursorPos = savedAtStartPosition + 1 + pathWithLineAndSymbol.length;
      this.textInput.setSelectionRange(newCursorPos, newCursorPos);
    }

    // Add to selectedPaths for highlighting and click-to-open
    // Use the full path including line number and symbol name (without trailing space)
    const pathForHighlight = `${symbol.relativePath}:${symbol.lineNumber}#${symbol.name}`;
    this.selectedPaths.add(pathForHighlight);
    console.debug('[FileSearchManager] Added symbol path to selectedPaths:', pathForHighlight);

    // Update highlight backdrop (this also calls rescanAtPaths internally)
    this.updateHighlightBackdrop();

    // Notify callback
    this.callbacks.onFileSelected(pathForHighlight);

    // Reset code search state
    this.codeSearchQuery = '';
    this.codeSearchLanguage = '';
    this.codeSearchCacheRefreshed = false;

    // Hide suggestions
    this.hideSuggestions();
  }

  /**
   * Get directory path from a file path (excluding the filename)
   */
  private getDirectoryFromPath(relativePath: string): string {
    const lastSlash = relativePath.lastIndexOf('/');
    if (lastSlash === -1) return '';
    return relativePath.substring(0, lastSlash + 1); // Include trailing slash
  }

  /**
   * Insert highlighted text into an element using safe DOM manipulation
   * This avoids innerHTML for security while allowing highlighting
   */
  private insertHighlightedText(element: HTMLElement, text: string, query: string): void {
    // Clear existing content
    element.textContent = '';

    if (!query) {
      element.textContent = text;
      return;
    }

    // Create regex for matching (case-insensitive)
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');

    // Split text by matches
    const parts = text.split(regex);

    parts.forEach(part => {
      if (part.toLowerCase() === query.toLowerCase()) {
        // This part matches - wrap in highlight span
        const highlight = document.createElement('span');
        highlight.className = 'highlight';
        highlight.textContent = part;
        element.appendChild(highlight);
      } else if (part) {
        // Non-matching part - add as text node
        element.appendChild(document.createTextNode(part));
      }
    });
  }

  /**
   * Get relative path from base directory
   */
  private getRelativePath(fullPath: string, baseDir: string): string {
    // If baseDir is empty or root '/', return fullPath as-is (it's already absolute)
    if (!baseDir || baseDir === '/') {
      return fullPath;
    }
    if (fullPath.startsWith(baseDir)) {
      const relative = fullPath.substring(baseDir.length);
      return relative.startsWith('/') ? relative.substring(1) : relative;
    }
    return fullPath;
  }

  /**
   * Handle keyboard navigation
   * Supports: ArrowDown/Ctrl+n/Ctrl+j (next), ArrowUp/Ctrl+p/Ctrl+k (previous), Enter/Tab (select), Escape (close), Ctrl+i (toggle tooltip)
   */
  public handleKeyDown(e: KeyboardEvent): void {
    if (!this.isVisible) return;

    // Ctrl+i: Toggle auto-show tooltip
    if (e.ctrlKey && e.key === 'i') {
      e.preventDefault();
      e.stopPropagation();
      this.toggleAutoShowTooltip();
      return;
    }

    const totalItems = this.getTotalItemCount();

    // Ctrl+n or Ctrl+j: Move down (same as ArrowDown)
    if (e.ctrlKey && (e.key === 'n' || e.key === 'j')) {
      e.preventDefault();
      e.stopPropagation();
      this.selectedIndex = Math.min(this.selectedIndex + 1, totalItems - 1);
      this.updateSelection();
      return;
    }

    // Ctrl+p or Ctrl+k: Move up (same as ArrowUp)
    if (e.ctrlKey && (e.key === 'p' || e.key === 'k')) {
      e.preventDefault();
      e.stopPropagation();
      this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
      this.updateSelection();
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        e.stopPropagation();
        this.selectedIndex = Math.min(this.selectedIndex + 1, totalItems - 1);
        this.updateSelection();
        break;

      case 'ArrowUp':
        e.preventDefault();
        e.stopPropagation();
        this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
        this.updateSelection();
        break;

      case 'Enter':
        // Skip Enter key if IME is active to let IME handle it (for Japanese input confirmation)
        if (e.isComposing || this.callbacks.getIsComposing?.()) {
          return;
        }

        // Enter: Select the currently highlighted item (agent or file)
        // Ctrl+Enter: Open the file in editor
        if (totalItems > 0 || this.isInSymbolMode) {
          e.preventDefault();
          e.stopPropagation();

          // 未選択状態（selectedIndex = -1）の場合
          if (this.selectedIndex < 0) {
            // シンボルモードの場合はファイルパス自体を挿入
            if (this.isInSymbolMode) {
              this.expandCurrentFile();
              return;
            }
            // ディレクトリモードの場合はディレクトリパスを展開
            this.expandCurrentDirectory();
            return;
          }

          if (e.ctrlKey) {
            // Ctrl+Enterでエディタで開く（@検索テキストは削除、パス挿入なし）
            const suggestion = this.mergedSuggestions[this.selectedIndex];
            if (suggestion) {
              const filePath = suggestion.type === 'file'
                ? suggestion.file?.path
                : suggestion.agent?.filePath;
              if (filePath) {
                // Remove @query text without inserting file path
                this.removeAtQueryText();
                this.openFileAndRestoreFocus(filePath)
                  .then(() => this.hideSuggestions());
                return;
              }
            }
          }

          // For files (not directories), Enter inserts path directly (like directories)
          // Tab navigates into file to show symbols
          const suggestion = this.mergedSuggestions[this.selectedIndex];
          if (suggestion?.type === 'file' && suggestion.file && !suggestion.file.isDirectory) {
            // Insert file path directly (don't navigate into symbols)
            const baseDir = this.cachedDirectoryData?.directory || '';
            const relativePath = this.getRelativePath(suggestion.file.path, baseDir);
            this.insertFilePath(relativePath);
            this.hideSuggestions();
            this.callbacks.onFileSelected(relativePath);
            return;
          }

          this.selectItem(this.selectedIndex);
        }
        break;

      case 'Tab':
        // Skip Tab key if IME is active to let IME handle it
        if (e.isComposing || this.callbacks.getIsComposing?.()) {
          return;
        }

        // Tab: Navigate into directory (for files), or select item (for agents/files)
        if (totalItems > 0 || this.isInSymbolMode) {
          e.preventDefault();
          e.stopPropagation();

          // 未選択状態（selectedIndex = -1）の場合
          if (this.selectedIndex < 0) {
            // シンボルモードの場合はファイルパス自体を挿入
            if (this.isInSymbolMode) {
              this.expandCurrentFile();
              return;
            }
            // ディレクトリモードの場合はディレクトリパスを展開
            this.expandCurrentDirectory();
            return;
          }

          // Check if current selection is a directory (for navigation)
          const suggestion = this.mergedSuggestions[this.selectedIndex];
          if (suggestion?.type === 'file' && suggestion.file?.isDirectory) {
            // Navigate into directory
            this.navigateIntoDirectory(suggestion.file);
            return;
          }

          // Otherwise select the item (file or agent)
          this.selectItem(this.selectedIndex);
        }
        break;

      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        this.hideSuggestions();
        break;

      case 'Backspace':
        // In symbol mode with empty query, exit symbol mode
        if (this.isInSymbolMode && this.currentQuery === '') {
          e.preventDefault();
          e.stopPropagation();
          this.exitSymbolMode();
        }
        break;
    }
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
    this.showTooltipForSelectedItem();
  }

  /**
   * Navigate into a directory (for Tab key on directories)
   */
  private navigateIntoDirectory(directory: FileInfo): void {
    if (!directory.isDirectory || !this.cachedDirectoryData) return;

    const baseDir = this.cachedDirectoryData.directory;
    const relativePath = this.getRelativePath(directory.path, baseDir);

    // Update current path to the selected directory
    this.currentPath = relativePath.endsWith('/') ? relativePath : relativePath + '/';

    console.debug('[FileSearchManager] navigateIntoDirectory:', formatLog({
      directory: directory.name,
      currentPath: this.currentPath
    }));

    // Update the text input to show the current path after @
    this.updateTextInputWithPath(this.currentPath);

    // Clear the query and show files in the new directory
    // selectedIndex = -1 で未選択状態にする（Tab/Enterでディレクトリ自体を展開可能）
    this.currentQuery = '';
    this.selectedIndex = -1;
    this.filteredFiles = this.filterFiles('');
    this.filteredAgents = []; // No agents when navigating into subdirectory
    this.mergedSuggestions = this.mergeSuggestions(''); // Update merged suggestions
    this.renderSuggestions();
    this.updateSelection();
  }

  /**
   * Expand current directory path (for Enter/Tab when no item is selected)
   * 未選択状態でTab/Enterを押した時に現在のディレクトリパスを展開する
   */
  private expandCurrentDirectory(): void {
    if (!this.currentPath) return;

    // 末尾に/を付けてパスを挿入
    const pathWithSlash = this.currentPath.endsWith('/') ? this.currentPath : this.currentPath + '/';
    this.insertFilePath(pathWithSlash);
    this.hideSuggestions();

    // Callback for external handling
    this.callbacks.onFileSelected(pathWithSlash);
  }

  /**
   * Expand current file path (for Enter/Tab when no symbol is selected in symbol mode)
   * シンボルモードで未選択状態の時、ファイルパス自体を挿入する
   */
  private expandCurrentFile(): void {
    if (!this.currentFilePath) return;

    // ファイルパスを挿入（末尾にスペースを追加）
    this.insertFilePath(this.currentFilePath);
    this.hideSuggestions();

    // Callback for external handling
    this.callbacks.onFileSelected(this.currentFilePath);
  }

  /**
   * Update text input with the current path (keeps @ and updates the path after it)
   */
  private updateTextInputWithPath(path: string): void {
    if (this.atStartPosition < 0) return;

    const text = this.callbacks.getTextContent();
    const cursorPos = this.callbacks.getCursorPosition();

    // Replace text after @ with the new path
    const before = text.substring(0, this.atStartPosition + 1); // Keep @
    const after = text.substring(cursorPos);
    const newText = before + path + after;

    this.callbacks.setTextContent(newText);

    // Position cursor at end of path (after @path)
    const newCursorPos = this.atStartPosition + 1 + path.length;
    this.callbacks.setCursorPosition(newCursorPos);
  }

  /**
   * Select a file by index (kept for backwards compatibility)
   */
  public selectFile(index: number): void {
    const file = this.filteredFiles[index];
    if (!file) return;
    this.selectFileByInfo(file);
  }

  /**
   * Select a file by FileInfo object and insert its path
   */
  private selectFileByInfo(file: FileInfo): void {
    // Get relative path from base directory
    const baseDir = this.cachedDirectoryData?.directory || '';
    let relativePath = this.getRelativePath(file.path, baseDir);

    // ディレクトリの場合は末尾に/を付ける
    if (file.isDirectory && !relativePath.endsWith('/')) {
      relativePath += '/';
    }

    // If it's a directory, just insert the path (directory navigation handled elsewhere)
    if (file.isDirectory) {
      this.insertFilePath(relativePath);
      this.hideSuggestions();
      this.callbacks.onFileSelected(relativePath);
      return;
    }

    // Check if symbol search is available for this file type
    const language = this.getLanguageForFile(file.name);
    if (this.rgAvailable && language) {
      // Navigate into file to show symbols
      this.navigateIntoFile(relativePath, file.path, language);
      return;
    }

    // Fallback: insert the file path
    this.insertFilePath(relativePath);
    this.hideSuggestions();

    // Callback for external handling
    this.callbacks.onFileSelected(relativePath);
  }

  /**
   * Get language info for a file based on its extension
   */
  private getLanguageForFile(filename: string): LanguageInfo | null {
    const ext = filename.substring(filename.lastIndexOf('.') + 1).toLowerCase();
    return this.supportedLanguages.get(ext) || null;
  }

  /**
   * Navigate into a file to show its symbols (similar to navigateIntoDirectory)
   */
  private async navigateIntoFile(relativePath: string, _absolutePath: string, language: LanguageInfo): Promise<void> {
    const cachedData = this.cachedDirectoryData;
    if (!cachedData) return;

    // Update state to symbol mode
    this.isInSymbolMode = true;
    this.currentFilePath = relativePath;
    this.currentQuery = '';

    // Update current path to the file path (like directory navigation)
    this.currentPath = relativePath;

    console.debug('[FileSearchManager] navigateIntoFile:', formatLog({
      file: relativePath,
      currentPath: this.currentPath,
      language: language.key
    }));

    // Update the text input to show the file path after @ (like directories)
    this.updateTextInputWithPath(this.currentPath);

    // Show loading state
    this.callbacks.updateHintText?.(`Loading symbols from ${relativePath}...`);

    try {
      // Search for symbols in the directory for this language
      // Use 20000 to ensure we have enough symbols to filter for any file
      let response = await window.electronAPI.codeSearch.searchSymbols(
        cachedData.directory,
        language.key,
        { maxSymbols: 20000, useCache: true }
      );

      if (!response.success) {
        console.warn('[FileSearchManager] Symbol search failed:', response.error);
        // Fallback: stay on current state with file path shown
        this.isInSymbolMode = false;
        this.hideSuggestions();
        return;
      }

      // Filter symbols to only those in the selected file
      this.currentFileSymbols = response.symbols.filter(
        (s: SymbolResult) => s.relativePath === relativePath
      );

      console.debug('[FileSearchManager] Found symbols in file:',
        this.currentFileSymbols.length, 'out of', response.symbolCount);

      // If no symbols found in cached results, retry without cache
      // (cache might be stale or have insufficient maxSymbols)
      if (this.currentFileSymbols.length === 0 && response.symbolCount > 0) {
        console.debug('[FileSearchManager] No symbols for file in cache, retrying without cache');
        this.callbacks.updateHintText?.(`Refreshing symbols for ${relativePath}...`);

        response = await window.electronAPI.codeSearch.searchSymbols(
          cachedData.directory,
          language.key,
          { maxSymbols: 20000, useCache: false }
        );

        if (response.success) {
          this.currentFileSymbols = response.symbols.filter(
            (s: SymbolResult) => s.relativePath === relativePath
          );
          console.debug('[FileSearchManager] After refresh, found symbols:',
            this.currentFileSymbols.length, 'out of', response.symbolCount);
        }
      }

      if (this.currentFileSymbols.length === 0) {
        // No symbols found - insert file path directly and close
        this.callbacks.updateHintText?.(`No symbols found in ${relativePath}`);
        this.isInSymbolMode = false;
        // Use insertFilePath to properly add space at the end
        this.insertFilePath(relativePath);
        this.hideSuggestions();
        this.callbacks.onFileSelected(relativePath);
        return;
      }

      // Show symbols with selectedIndex = -1 (like directory navigation)
      this.selectedIndex = -1;
      this.showSymbolSuggestions('');
    } catch (error) {
      console.error('[FileSearchManager] Error searching symbols:', error);
      this.isInSymbolMode = false;
      this.hideSuggestions();
    }
  }

  /**
   * Show symbol suggestions for the current file
   * Uses same pattern as directory navigation: header + items, selectedIndex = -1 for unselected
   */
  private showSymbolSuggestions(query: string): void {
    if (!this.suggestionsContainer) return;

    // Filter symbols by query
    let filtered = this.currentFileSymbols;
    if (query) {
      const lowerQuery = query.toLowerCase();
      filtered = this.currentFileSymbols.filter(s =>
        s.name.toLowerCase().includes(lowerQuery) ||
        s.lineContent.toLowerCase().includes(lowerQuery)
      );

      // Sort by relevance
      filtered.sort((a, b) => {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();
        const aStarts = aName.startsWith(lowerQuery);
        const bStarts = bName.startsWith(lowerQuery);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return aName.localeCompare(bName);
      });
    }

    // Limit results
    const maxSuggestions = 20;
    filtered = filtered.slice(0, maxSuggestions);

    // Convert to SuggestionItem
    this.mergedSuggestions = filtered.map((symbol, index) => ({
      type: 'symbol' as const,
      symbol,
      score: 1000 - index
    }));

    // Set selectedIndex = -1 (unselected state, like directory navigation)
    // Tab/Enter will insert file path when nothing is selected
    this.selectedIndex = -1;

    // Clear and render
    this.suggestionsContainer.innerHTML = '';
    const fragment = document.createDocumentFragment();

    // Add file path header (like directory header in renderSuggestions)
    if (this.currentFilePath) {
      const header = document.createElement('div');
      header.className = 'file-suggestion-header';
      header.textContent = this.currentFilePath;
      fragment.appendChild(header);
    }

    if (this.mergedSuggestions.length === 0) {
      this.callbacks.updateHintText?.(`No symbols matching "${query}" in ${this.currentFilePath}`);
    }

    // Render symbol items
    this.mergedSuggestions.forEach((suggestion, index) => {
      if (suggestion.symbol) {
        const item = this.renderSymbolItem(suggestion.symbol, index);
        fragment.appendChild(item);
      }
    });

    this.suggestionsContainer.appendChild(fragment);

    // Update hint
    if (this.mergedSuggestions.length > 0) {
      this.callbacks.updateHintText?.(`${this.mergedSuggestions.length} symbols in ${this.currentFilePath}`);
    }

    // Position and show
    this.positionSuggestions();
    this.suggestionsContainer.style.display = 'block';
    this.isVisible = true;
  }

  /**
   * Render a symbol item for the suggestions list
   */
  private renderSymbolItem(symbol: SymbolResult, index: number): HTMLElement {
    const item = document.createElement('div');
    item.className = 'file-suggestion-item symbol-item';
    item.dataset.index = String(index);

    if (index === this.selectedIndex) {
      item.classList.add('selected');
    }

    // Symbol type icon
    const iconSpan = document.createElement('span');
    iconSpan.className = 'file-icon symbol-icon';
    const iconSvg = getSymbolIconSvg(symbol.type);
    insertSvgIntoElement(iconSpan, iconSvg);
    item.appendChild(iconSpan);

    // Symbol name
    const nameSpan = document.createElement('span');
    nameSpan.className = 'file-name';
    nameSpan.textContent = symbol.name;
    item.appendChild(nameSpan);

    // Symbol type badge
    const typeBadge = document.createElement('span');
    typeBadge.className = 'file-suggestion-type';
    typeBadge.textContent = getSymbolTypeDisplay(symbol.type);
    item.appendChild(typeBadge);

    // Line number
    const lineSpan = document.createElement('span');
    lineSpan.className = 'file-path';
    lineSpan.textContent = `:${symbol.lineNumber}`;
    item.appendChild(lineSpan);

    // Mouse events
    item.addEventListener('mousemove', () => {
      this.selectedIndex = index;
      this.updateSelection();
    });

    item.addEventListener('click', () => {
      this.selectSymbol(symbol);
    });

    return item;
  }

  /**
   * Exit symbol mode and return to file list
   */
  private exitSymbolMode(): void {
    this.isInSymbolMode = false;
    this.currentFilePath = '';
    this.currentFileSymbols = [];
    this.currentQuery = '';

    // Restore default hint text
    if (this.callbacks.getDefaultHintText) {
      this.callbacks.updateHintText?.(this.callbacks.getDefaultHintText());
    }

    // Re-show file suggestions
    this.showSuggestions(this.currentPath || '');
  }

  /**
   * Select an agent by AgentItem object and insert its name
   */
  private selectAgentByInfo(agent: AgentItem): void {
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
    this.hideSuggestions();

    // Callback for external handling
    const insertText = inputFormat === 'path' ? agent.filePath : agent.name;
    this.callbacks.onFileSelected(inputFormat === 'name' ? `@${insertText}` : insertText);
  }

  /**
   * Insert file path, keeping the @ and replacing only the query part
   * Uses replaceRangeWithUndo for native Undo/Redo support
   */
  public insertFilePath(path: string): void {
    if (this.atStartPosition < 0) return;

    const cursorPos = this.callbacks.getCursorPosition();

    // The insertion text includes path + space for better UX
    const insertionText = path + ' ';

    // Replace the query part (after @) with the new path + space
    // atStartPosition points to @, so we keep @ and replace from atStartPosition + 1 to cursorPos
    const replaceStart = this.atStartPosition + 1;
    const replaceEnd = cursorPos;

    // Use replaceRangeWithUndo if available for native Undo support
    if (this.callbacks.replaceRangeWithUndo) {
      this.callbacks.replaceRangeWithUndo(replaceStart, replaceEnd, insertionText);
    } else {
      // Fallback to direct text manipulation (no Undo support)
      const text = this.callbacks.getTextContent();
      const before = text.substring(0, replaceStart);
      const after = text.substring(replaceEnd);
      const newText = before + insertionText + after;
      this.callbacks.setTextContent(newText);
    }

    // Add the path to the set of selected paths (for highlighting)
    this.selectedPaths.add(path);
    console.debug('[FileSearchManager] Added path to selectedPaths:', path, 'total:', this.selectedPaths.size);

    // Update highlight backdrop (this will find all occurrences in the text)
    this.updateHighlightBackdrop();

    // Reset state
    this.atStartPosition = -1;
  }

  /**
   * Insert file path without the @ symbol
   * Replaces both @ and query with just the path
   * Uses replaceRangeWithUndo for native Undo/Redo support
   */
  private insertFilePathWithoutAt(path: string): void {
    if (this.atStartPosition < 0) return;

    const cursorPos = this.callbacks.getCursorPosition();

    // The insertion text includes path + space for better UX
    const insertionText = path + ' ';

    // Replace from @ (atStartPosition) to cursorPos - this removes the @ as well
    const replaceStart = this.atStartPosition;
    const replaceEnd = cursorPos;

    // Use replaceRangeWithUndo if available for native Undo support
    if (this.callbacks.replaceRangeWithUndo) {
      this.callbacks.replaceRangeWithUndo(replaceStart, replaceEnd, insertionText);
    } else {
      // Fallback to direct text manipulation (no Undo support)
      const text = this.callbacks.getTextContent();
      const before = text.substring(0, replaceStart);
      const after = text.substring(replaceEnd);
      const newText = before + insertionText + after;
      this.callbacks.setTextContent(newText);
    }

    // Note: Don't add to selectedPaths for path format since there's no @ to highlight
    // Reset state
    this.atStartPosition = -1;
  }

  /**
   * Find @path at or just before the cursor position
   */
  private findAtPathAtCursor(cursorPos: number): AtPathRange | null {
    // Check if cursor is at the end of any @path (including one character after for space)
    for (const path of this.atPaths) {
      if (cursorPos === path.end || cursorPos === path.end + 1) {
        return path;
      }
    }
    return null;
  }

  /**
   * Handle backspace key to delete entire @path if cursor is at the end
   * Uses replaceRangeWithUndo for native Undo/Redo support
   */
  private handleBackspaceForAtPath(e: KeyboardEvent): void {
    const cursorPos = this.callbacks.getCursorPosition();
    const atPath = this.findAtPathAtCursor(cursorPos);

    if (atPath) {
      e.preventDefault();

      const text = this.callbacks.getTextContent();
      const deletedPathContent = atPath.path;

      // Save atPath properties before deletion - replaceRangeWithUndo triggers input event
      // which calls updateHighlightBackdrop() and rescanAtPaths(), modifying this.atPaths
      const savedStart = atPath.start;
      const savedEnd = atPath.end;

      // Delete the @path (and trailing space if present)
      let deleteEnd = savedEnd;
      if (text[deleteEnd] === ' ') {
        deleteEnd++;
      }

      // Use replaceRangeWithUndo if available for native Undo support
      // Note: execCommand('insertText', false, '') places cursor at the deletion point
      // which is exactly where we want it (savedStart), so no need to call setCursorPosition
      if (this.callbacks.replaceRangeWithUndo) {
        this.callbacks.replaceRangeWithUndo(savedStart, deleteEnd, '');
        // Explicitly restore cursor position after deletion
        // The input event fired by execCommand may trigger code that affects cursor position
        // (e.g., checkForFileSearch, updateHighlightBackdrop, updateCursorPositionHighlight)
        // Restoring here ensures cursor stays at the correct deletion point
        this.callbacks.setCursorPosition(savedStart);
      } else {
        // Fallback to direct text manipulation (no Undo support) - need to set cursor manually
        const newText = text.substring(0, savedStart) + text.substring(deleteEnd);
        this.callbacks.setTextContent(newText);
        this.callbacks.setCursorPosition(savedStart);
      }

      // Update highlight backdrop (rescanAtPaths will recalculate all positions)
      this.updateHighlightBackdrop();

      // Restore cursor position again after updateHighlightBackdrop
      // This ensures cursor stays at savedStart even if backdrop update affects it
      this.callbacks.setCursorPosition(savedStart);

      // After update, check if this path still exists in the text
      // If not, remove it from selectedPaths
      if (deletedPathContent && !this.atPaths.some(p => p.path === deletedPathContent)) {
        this.selectedPaths.delete(deletedPathContent);
        console.debug('[FileSearchManager] Removed path from selectedPaths:', deletedPathContent);
      }

      console.debug('[FileSearchManager] deleted @path:', formatLog({
        deletedStart: savedStart,
        deletedEnd: deleteEnd,
        deletedPath: deletedPathContent || 'unknown',
        remainingPaths: this.atPaths.length,
        selectedPathsCount: this.selectedPaths.size
      }));
    }
  }

  /**
   * Sync the scroll position of the highlight backdrop with the textarea
   */
  private syncBackdropScroll(): void {
    if (this.textInput && this.highlightBackdrop) {
      this.highlightBackdrop.scrollTop = this.textInput.scrollTop;
      this.highlightBackdrop.scrollLeft = this.textInput.scrollLeft;
    }
  }

  /**
   * Update the highlight backdrop to show @path highlights
   */
  public updateHighlightBackdrop(): void {
    if (!this.highlightBackdrop || !this.textInput) return;

    const text = this.textInput.value;

    // Re-scan for @paths in the text (in case user edited)
    this.rescanAtPaths(text);

    if (this.atPaths.length === 0) {
      // No @paths, just mirror the text
      this.highlightBackdrop.textContent = text;
      return;
    }

    // Build highlighted content
    const fragment = document.createDocumentFragment();
    let lastEnd = 0;

    for (const atPath of this.atPaths) {
      // Add text before this @path
      if (atPath.start > lastEnd) {
        fragment.appendChild(document.createTextNode(text.substring(lastEnd, atPath.start)));
      }

      // Add highlighted @path
      const span = document.createElement('span');
      span.className = 'at-path-highlight';
      span.textContent = text.substring(atPath.start, atPath.end);
      fragment.appendChild(span);

      lastEnd = atPath.end;
    }

    // Add remaining text
    if (lastEnd < text.length) {
      fragment.appendChild(document.createTextNode(text.substring(lastEnd)));
    }

    this.highlightBackdrop.innerHTML = '';
    this.highlightBackdrop.appendChild(fragment);

    // Sync scroll
    this.syncBackdropScroll();
  }

  /**
   * Build a set of valid paths from cached directory data
   */
  private buildValidPathsSet(): Set<string> | null {
    if (!this.cachedDirectoryData?.files || this.cachedDirectoryData.files.length === 0) {
      return null;
    }

    const baseDir = this.cachedDirectoryData.directory;
    const validPaths = new Set<string>();

    for (const file of this.cachedDirectoryData.files) {
      const relativePath = this.getRelativePath(file.path, baseDir);
      validPaths.add(relativePath);
      // For directories: add both with and without trailing slash
      if (file.isDirectory) {
        if (!relativePath.endsWith('/')) {
          validPaths.add(relativePath + '/');
        } else {
          validPaths.add(relativePath.slice(0, -1));
        }
      }
      // Also add parent directories
      const pathParts = relativePath.split('/');
      let parentPath = '';
      for (let i = 0; i < pathParts.length - 1; i++) {
        parentPath += (i > 0 ? '/' : '') + pathParts[i];
        validPaths.add(parentPath);
        validPaths.add(parentPath + '/');
      }
    }

    return validPaths;
  }

  /**
   * Re-scan text for @paths.
   * Finds ALL @path patterns in text and validates them against:
   * 1. The selectedPaths set (paths explicitly selected by user)
   * 2. The cached file list (for Undo support - restores highlights for valid paths)
   */
  private rescanAtPaths(text: string): void {
    const foundPaths: AtPathRange[] = [];
    const validPaths = this.buildValidPathsSet();

    // Find all @path patterns in text
    const atPathPattern = /@([^\s@]+)/g;
    let match;

    while ((match = atPathPattern.exec(text)) !== null) {
      const pathContent = match[1];
      if (!pathContent) continue;

      const start = match.index;
      const end = match.index + match[0].length;

      // Parse the path to handle symbol paths with line number and symbol name
      // Format: path:lineNumber#symbolName or just path
      const parsedPath = this.parsePathWithLineInfo(pathContent);
      const cleanPath = parsedPath.path;

      // Check if this path should be highlighted:
      // 1. It's in selectedPaths (explicitly selected by user), OR
      // 2. The clean path (without line number/symbol) exists in the valid paths from cached file list (for Undo support)
      const isSelected = this.selectedPaths.has(pathContent);
      const isValidPath = validPaths?.has(cleanPath) ?? false;

      if (isSelected || isValidPath) {
        foundPaths.push({
          start,
          end,
          path: pathContent
        });

        // If it's a valid path that was restored via Undo, add it to selectedPaths
        if (isValidPath && !isSelected) {
          this.selectedPaths.add(pathContent);
        }
      }
    }

    // Sort by start position
    foundPaths.sort((a, b) => a.start - b.start);
    this.atPaths = foundPaths;
  }

  /**
   * Clear all tracked @paths (called when text is cleared)
   */
  public clearAtPaths(): void {
    this.atPaths = [];
    this.selectedPaths.clear();
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
      hasHighlightBackdrop: !!this.highlightBackdrop,
      hasCachedData: !!this.cachedDirectoryData,
      cachedFileCount: this.cachedDirectoryData?.files?.length || 0,
      checkFilesystem
    }));

    if (!this.textInput) {
      console.debug('[FileSearchManager] restoreAtPathsFromText: no textInput, returning');
      return;
    }

    const text = this.textInput.value;
    if (!text) {
      console.debug('[FileSearchManager] restoreAtPathsFromText: no text, returning');
      return;
    }

    // Clear existing paths and selected paths
    this.atPaths = [];
    this.selectedPaths.clear();

    // Need cached directory data to check if files exist (or need to check filesystem)
    const hasValidCachedData = this.cachedDirectoryData?.files &&
                                this.cachedDirectoryData.files.length > 0 &&
                                this.cachedDirectoryData?.directory;
    const baseDir = this.cachedDirectoryData?.directory;

    if (!checkFilesystem && !hasValidCachedData) {
      console.debug('[FileSearchManager] restoreAtPathsFromText: no cached data and not checking filesystem, skipping highlight');
      this.updateHighlightBackdrop();
      return;
    }

    // Build a set of relative paths for quick lookup (only if we have valid cached data)
    let relativePaths: Set<string> | null = null;
    if (hasValidCachedData) {
      const files = this.cachedDirectoryData!.files!;
      relativePaths = new Set<string>();
      for (const file of files) {
        const relativePath = this.getRelativePath(file.path, baseDir!);
        relativePaths.add(relativePath);
        // For directories: add both with and without trailing slash
        // getRelativePath doesn't add trailing slash, but selectFileByInfo adds it for directories
        // So we need both versions to match @paths in text
        if (file.isDirectory) {
          // Add with trailing slash if not already present
          if (!relativePath.endsWith('/')) {
            relativePaths.add(relativePath + '/');
          } else {
            // Also add without trailing slash
            relativePaths.add(relativePath.slice(0, -1));
          }
        }

        // Also extract and add all parent directories from file paths
        // This handles cases where directory entries are not in the file list
        // but files within those directories are (e.g., .github/ISSUE_TEMPLATE/bug_report.yml
        // should make .github/ and .github/ISSUE_TEMPLATE/ available for highlighting)
        const pathParts = relativePath.split('/');
        let parentPath = '';
        for (let i = 0; i < pathParts.length - 1; i++) {
          parentPath += (i > 0 ? '/' : '') + pathParts[i];
          // Add both with and without trailing slash
          relativePaths.add(parentPath);
          relativePaths.add(parentPath + '/');
        }
      }

      console.debug('[FileSearchManager] Built relative path set:', formatLog({
        pathCount: relativePaths.size
      }));
    }

    // Find all @paths in text
    const atPathPattern = /@([^\s@]+)/g;
    let match;
    const pathsToCheck: Array<{ pathContent: string; start: number; end: number }> = [];

    while ((match = atPathPattern.exec(text)) !== null) {
      const pathContent = match[1];
      // Only add paths that look like file paths (contain / or .)
      if (pathContent && (pathContent.includes('/') || pathContent.includes('.'))) {
        pathsToCheck.push({
          pathContent,
          start: match.index,
          end: match.index + match[0].length
        });
      }
    }

    // Check each path for existence
    for (const { pathContent, start, end } of pathsToCheck) {
      let shouldHighlight = false;

      // Parse the path to handle symbol paths with line number and symbol name
      // Format: path:lineNumber#symbolName or just path
      const parsedPath = this.parsePathWithLineInfo(pathContent);
      const cleanPath = parsedPath.path;

      // First, check against cached file list if available
      if (relativePaths && relativePaths.has(cleanPath)) {
        shouldHighlight = true;
      }
      // If no cached data but checkFilesystem is enabled, check actual filesystem
      else if (checkFilesystem && baseDir) {
        // Construct full path and check filesystem
        const fullPath = `${baseDir}/${cleanPath}`;
        try {
          const exists = await window.electronAPI.file.checkExists(fullPath);
          shouldHighlight = exists;
          console.debug('[FileSearchManager] Filesystem check for @path:', formatLog({
            pathContent,
            cleanPath,
            fullPath,
            exists,
            isSymbolPath: !!parsedPath.lineNumber
          }));
        } catch (err) {
          console.error('[FileSearchManager] Error checking file existence:', err);
          shouldHighlight = false;
        }
      }

      if (shouldHighlight) {
        // Add to selectedPaths set (rescanAtPaths will find all occurrences)
        // Use the full pathContent (including line number and symbol name if present)
        this.selectedPaths.add(pathContent);
        console.debug('[FileSearchManager] Found @path:', formatLog({
          pathContent,
          cleanPath,
          start,
          end,
          checkFilesystem,
          isSymbolPath: !!parsedPath.lineNumber
        }));
      } else {
        console.debug('[FileSearchManager] Skipping non-existent @path:', pathContent);
      }
    }

    console.debug('[FileSearchManager] Restored @paths from text:', formatLog({
      selectedPathsCount: this.selectedPaths.size,
      textLength: text.length,
      checkFilesystem
    }));
    this.updateHighlightBackdrop();
  }

  /**
   * Check if suggestions are currently visible
   */
  public isActive(): boolean {
    return this.isVisible;
  }

  /**
   * Check if we have cached directory data
   */
  public hasCachedData(): boolean {
    return this.cachedDirectoryData !== null;
  }

  /**
   * Get the cached directory path
   */
  public getCachedDirectory(): string | null {
    return this.cachedDirectoryData?.directory || null;
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
  }
}
