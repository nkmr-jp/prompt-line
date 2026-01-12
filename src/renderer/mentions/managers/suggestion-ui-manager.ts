/**
 * SuggestionUIManager - Unified manager for suggestion dropdown UI
 *
 * Consolidated from:
 * - SuggestionListManager: Dropdown display and positioning
 * - SuggestionItemRenderer: Item rendering (file, agent, symbol)
 * - SuggestionEventHandler: Keyboard and mouse events
 * - SuggestionStateManager: Display state coordination
 *
 * Responsibilities:
 * - Managing suggestion dropdown display and positioning
 * - Rendering suggestion items (files, agents, symbols)
 * - Handling keyboard navigation and mouse interactions
 * - Coordinating suggestion visibility and state
 */

import type { SuggestionItem, DirectoryData } from '../types';
import { insertSvgIntoElement } from '../types';
import type { FileInfo, AgentItem } from '../../../types';
import type { SymbolResult } from '../code-search/types';
import { getSymbolTypeDisplay } from '../code-search/types';
import { getCaretCoordinates, createMirrorDiv, insertHighlightedText } from '../dom-utils';
import { getRelativePath, getDirectoryFromPath } from '../path-utils';
import { getFileIconSvg, getMentionIconSvg, getSymbolIconSvg } from '../../assets/icons/file-icons';

/**
 * Callbacks for SuggestionUIManager
 */
export interface SuggestionUICallbacks {
  // Selection and navigation
  onItemSelected: (index: number) => void;
  onNavigateIntoDirectory: (file: FileInfo) => void;
  onEscape: () => void;
  onOpenFileInEditor?: (filePath: string) => Promise<void>;

  // Input state
  getIsComposing?: () => boolean;

  // Display context
  getCurrentPath?: () => string;
  getBaseDir?: () => string;
  getCurrentQuery?: () => string;
  getCodeSearchQuery?: () => string;
  countFilesInDirectory?: (path: string) => number;

  // Popup interactions
  onMouseEnterInfo?: (suggestion: SuggestionItem, target: HTMLElement) => void | Promise<void>;
  onMouseLeaveInfo?: () => void;

  // State management (for SuggestionStateManager functionality)
  getCachedDirectoryData?: () => DirectoryData | null;
  getAtStartPosition?: () => number;
  adjustCurrentPathToQuery?: (query: string) => void;
  filterFiles?: (query: string) => FileInfo[];
  mergeSuggestions?: (query: string, maxSuggestions?: number) => SuggestionItem[];
  searchAgents?: (query: string) => Promise<AgentItem[]>;
  isIndexBeingBuilt?: () => boolean;
  showIndexingHint?: () => void;
  restoreDefaultHint?: () => void;
  matchesSearchPrefix?: (query: string, type: 'command' | 'mention') => Promise<boolean>;
  getMaxSuggestions?: (type: 'command' | 'mention') => Promise<number>;
  showTooltipForSelectedItem?: () => void;

  // State setters
  setCurrentPath?: (path: string) => void;
  setCurrentQuery?: (query: string) => void;
  setFilteredFiles?: (files: FileInfo[]) => void;
  setFilteredAgents?: (agents: AgentItem[]) => void;
  setMergedSuggestions?: (suggestions: SuggestionItem[]) => void;
  setSelectedIndex?: (index: number) => void;
  setIsVisible?: (visible: boolean) => void;
}

/**
 * Unified manager for suggestion dropdown UI
 */
export class SuggestionUIManager {
  private textInput: HTMLTextAreaElement;
  private callbacks: SuggestionUICallbacks;

  private suggestionsContainer: HTMLElement | null = null;
  private isVisible: boolean = false;
  private selectedIndex: number = 0;
  private mergedSuggestions: SuggestionItem[] = [];
  private mirrorDiv: HTMLDivElement | null = null;
  private containerClickHandler: ((e: MouseEvent) => void) | null = null;
  private containerMouseMoveHandler: ((e: MouseEvent) => void) | null = null;
  private containerMouseLeaveHandler: ((e: MouseEvent) => void) | null = null;

  constructor(textInput: HTMLTextAreaElement, callbacks: SuggestionUICallbacks) {
    this.textInput = textInput;
    this.callbacks = callbacks;

    this.mirrorDiv = createMirrorDiv();
    this.initializeContainer();
  }

  // ============================================================
  // Container Management
  // ============================================================

  private initializeContainer(): void {
    this.suggestionsContainer = document.getElementById('fileSuggestions');
    if (!this.suggestionsContainer) {
      this.suggestionsContainer = document.createElement('div');
      this.suggestionsContainer.id = 'fileSuggestions';
      this.suggestionsContainer.className = 'file-suggestions';
      this.suggestionsContainer.setAttribute('role', 'listbox');
      this.suggestionsContainer.setAttribute('aria-label', 'File suggestions');

      const mainContent = document.querySelector('.main-content');
      if (mainContent) {
        mainContent.appendChild(this.suggestionsContainer);
      }
    }

    // Set up event delegation on container
    this.setupEventDelegation();
  }

  private setupEventDelegation(): void {
    if (!this.suggestionsContainer) return;

    // Click event delegation
    this.containerClickHandler = async (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const item = target.closest('[data-suggestion-index]') as HTMLElement;
      if (!item) return;

      e.preventDefault();
      e.stopPropagation();

      const index = parseInt(item.getAttribute('data-suggestion-index') || '0', 10);

      // Cmd+click: Open file in editor
      if (e.metaKey && this.callbacks.onOpenFileInEditor) {
        const filePath = this.getFilePathFromSuggestion(this.mergedSuggestions[index]);
        if (filePath) {
          await this.callbacks.onOpenFileInEditor(filePath);
          this.hide();
        }
        return;
      }

      // Normal click: select item
      this.callbacks.onItemSelected(index);
    };

    // MouseMove event delegation
    this.containerMouseMoveHandler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const item = target.closest('[data-suggestion-index]') as HTMLElement;
      if (!item) return;

      const allItems = this.suggestionsContainer?.querySelectorAll('.file-suggestion-item');
      allItems?.forEach(el => el.classList.remove('hovered'));
      item.classList.add('hovered');
    };

    // MouseLeave event delegation - clear all hovered states when leaving container
    this.containerMouseLeaveHandler = () => {
      const hoveredItems = this.suggestionsContainer?.querySelectorAll('.hovered');
      hoveredItems?.forEach(item => item.classList.remove('hovered'));
    };

    this.suggestionsContainer.addEventListener('click', this.containerClickHandler);
    this.suggestionsContainer.addEventListener('mousemove', this.containerMouseMoveHandler);
    this.suggestionsContainer.addEventListener('mouseleave', this.containerMouseLeaveHandler);
  }

  // ============================================================
  // Public API - Display Control
  // ============================================================

  /**
   * Show suggestions at a specific position
   */
  public show(suggestions: SuggestionItem[], atPosition: number, isIndexBuilding: boolean = false): void {
    if (!this.suggestionsContainer) return;

    this.mergedSuggestions = suggestions;
    this.selectedIndex = 0;
    this.isVisible = true;

    this.renderSuggestionsInternal(isIndexBuilding);
    this.positionAtCursor(atPosition);
    this.updateSelection();
  }

  /**
   * Hide the suggestions dropdown
   */
  public hide(): void {
    if (!this.suggestionsContainer) return;

    this.isVisible = false;
    this.suggestionsContainer.style.display = 'none';

    while (this.suggestionsContainer.firstChild) {
      this.suggestionsContainer.removeChild(this.suggestionsContainer.firstChild);
    }

    this.mergedSuggestions = [];
  }

  /**
   * Update suggestions without changing position
   */
  public update(suggestions: SuggestionItem[], isIndexBuilding: boolean = false, newSelectedIndex?: number): void {
    if (!this.suggestionsContainer) return;

    this.mergedSuggestions = suggestions;
    if (newSelectedIndex !== undefined) {
      this.selectedIndex = newSelectedIndex;
    }
    this.renderSuggestionsInternal(isIndexBuilding);
    this.updateSelection();
  }

  /**
   * Position the suggestions container at the given @ position
   */
  public position(atPosition: number): void {
    this.positionAtCursor(atPosition);
  }

  // ============================================================
  // State Management (from SuggestionStateManager)
  // ============================================================

  /**
   * Show file suggestions based on the query
   */
  public async showSuggestions(query: string): Promise<void> {
    if (!this.callbacks.getCachedDirectoryData || !this.callbacks.getAtStartPosition) {
      return;
    }

    // Check if query matches any searchPrefix for mention type
    const matchesPrefix = await this.callbacks.matchesSearchPrefix?.(query, 'mention') ?? false;

    // Adjust currentPath based on query
    if (!matchesPrefix) {
      this.callbacks.adjustCurrentPathToQuery?.(query);
    } else {
      this.callbacks.setCurrentPath?.('');
    }

    // Extract search term (part after currentPath)
    const currentPath = this.callbacks.getCurrentPath?.() ?? '';
    const searchTerm = currentPath ? query.substring(currentPath.length) : query;

    this.callbacks.setCurrentQuery?.(searchTerm);

    // Fetch agents matching the query (only at root level without path navigation)
    if (!currentPath && this.callbacks.searchAgents) {
      const agents = await this.callbacks.searchAgents(searchTerm);
      this.callbacks.setFilteredAgents?.(agents);
    } else {
      this.callbacks.setFilteredAgents?.([]);
    }

    // Check if index is being built
    const isIndexBuilding = this.callbacks.isIndexBeingBuilt?.() ?? false;

    // Filter files if directory data is available
    if (matchesPrefix) {
      this.callbacks.setFilteredFiles?.([]);
    } else if (this.callbacks.getCachedDirectoryData() && this.callbacks.filterFiles) {
      const filtered = this.callbacks.filterFiles(searchTerm);
      this.callbacks.setFilteredFiles?.(filtered);
    } else {
      this.callbacks.setFilteredFiles?.([]);
    }

    // Get maxSuggestions setting for merged list
    const maxSuggestions = await this.callbacks.getMaxSuggestions?.('mention') ?? 20;

    // Merge files and agents into a single sorted list
    const merged = this.callbacks.mergeSuggestions?.(searchTerm, maxSuggestions) ?? [];
    this.callbacks.setMergedSuggestions?.(merged);

    this.callbacks.setSelectedIndex?.(0);
    this.callbacks.setIsVisible?.(true);

    // Show indexing hint if index is being built
    if (isIndexBuilding && !matchesPrefix) {
      this.callbacks.showIndexingHint?.();
    }

    // Show suggestions
    this.show(merged, this.callbacks.getAtStartPosition(), isIndexBuilding && !matchesPrefix);

    // Update popup tooltip for selected item
    this.callbacks.showTooltipForSelectedItem?.();
  }

  /**
   * Hide the suggestions and reset state
   */
  public hideSuggestions(): void {
    this.hide();
    this.callbacks.setIsVisible?.(false);
    this.callbacks.setFilteredFiles?.([]);
    this.callbacks.setFilteredAgents?.([]);
    this.callbacks.setMergedSuggestions?.([]);
    this.callbacks.setCurrentQuery?.('');
    this.callbacks.setCurrentPath?.('');
    this.callbacks.setSelectedIndex?.(0);
    this.callbacks.restoreDefaultHint?.();
  }

  // ============================================================
  // Keyboard Navigation (from SuggestionEventHandler)
  // ============================================================

  /**
   * Handle keyboard navigation
   * @returns true if event was handled, false otherwise
   */
  public handleKeyDown(e: KeyboardEvent): boolean {
    if (!this.isVisible) return false;

    const totalItems = this.mergedSuggestions.length;
    const currentIndex = this.selectedIndex;

    // Ctrl+n or Ctrl+j: Move down
    if (e.ctrlKey && (e.key === 'n' || e.key === 'j')) {
      e.preventDefault();
      e.stopPropagation();
      this.selectedIndex = Math.min(currentIndex + 1, totalItems - 1);
      this.updateSelection();
      return true;
    }

    // Ctrl+p or Ctrl+k: Move up
    if (e.ctrlKey && (e.key === 'p' || e.key === 'k')) {
      e.preventDefault();
      e.stopPropagation();
      this.selectedIndex = Math.max(currentIndex - 1, 0);
      this.updateSelection();
      return true;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        e.stopPropagation();
        this.selectedIndex = Math.min(currentIndex + 1, totalItems - 1);
        this.updateSelection();
        return true;

      case 'ArrowUp':
        e.preventDefault();
        e.stopPropagation();
        this.selectedIndex = Math.max(currentIndex - 1, 0);
        this.updateSelection();
        return true;

      case 'Enter':
        return this.handleEnterKey(e, totalItems, currentIndex);

      case 'Tab':
        return this.handleTabKey(e, totalItems, currentIndex);

      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        this.callbacks.onEscape();
        return true;

      default:
        return false;
    }
  }

  private handleEnterKey(e: KeyboardEvent, totalItems: number, currentIndex: number): boolean {
    if (e.isComposing || this.callbacks.getIsComposing?.()) {
      return false;
    }

    if (totalItems > 0) {
      e.preventDefault();
      e.stopPropagation();

      // Ctrl+Enter: Open file in editor
      if (e.ctrlKey && currentIndex >= 0 && this.callbacks.onOpenFileInEditor) {
        const filePath = this.getFilePathFromSuggestion(this.mergedSuggestions[currentIndex]);
        if (filePath) {
          this.callbacks.onOpenFileInEditor(filePath).then(() => this.hide());
        }
        return true;
      }

      // Normal Enter: select item
      if (currentIndex >= 0) {
        this.callbacks.onItemSelected(currentIndex);
        return true;
      }
    }
    return false;
  }

  private handleTabKey(e: KeyboardEvent, totalItems: number, currentIndex: number): boolean {
    if (e.isComposing || this.callbacks.getIsComposing?.()) {
      return false;
    }

    if (totalItems > 0) {
      e.preventDefault();
      e.stopPropagation();

      // Check if current selection is a directory
      if (currentIndex >= 0) {
        const suggestion = this.mergedSuggestions[currentIndex];
        if (suggestion?.type === 'file' && suggestion.file?.isDirectory) {
          this.callbacks.onNavigateIntoDirectory(suggestion.file);
          return true;
        }
      }

      // Otherwise select the item
      if (currentIndex >= 0) {
        this.callbacks.onItemSelected(currentIndex);
        return true;
      }
    }
    return false;
  }

  // ============================================================
  // Rendering (inlined from SuggestionRenderer)
  // ============================================================

  private renderSuggestionsInternal(isIndexBuilding: boolean = false): void {
    if (!this.suggestionsContainer) return;

    if (this.mergedSuggestions.length === 0) {
      this.renderEmptyState(isIndexBuilding);
      return;
    }

    this.suggestionsContainer.scrollTop = 0;

    const fragment = document.createDocumentFragment();

    // Add path header if we're in a subdirectory
    const currentPath = this.callbacks.getCurrentPath?.();
    if (currentPath) {
      const header = document.createElement('div');
      header.className = 'file-suggestion-header';
      header.textContent = currentPath;
      fragment.appendChild(header);
    }

    // Render suggestions
    this.mergedSuggestions.forEach((suggestion, index) => {
      const item = this.createSuggestionItem(suggestion, index);
      fragment.appendChild(item);
    });

    this.suggestionsContainer.innerHTML = '';
    this.suggestionsContainer.appendChild(fragment);
    this.suggestionsContainer.style.display = 'block';
  }

  /**
   * Render empty state
   */
  private renderEmptyState(isIndexBuilding: boolean): void {
    if (!this.suggestionsContainer) return;

    while (this.suggestionsContainer.firstChild) {
      this.suggestionsContainer.removeChild(this.suggestionsContainer.firstChild);
    }

    const emptyDiv = document.createElement('div');
    emptyDiv.className = isIndexBuilding ? 'file-suggestion-empty indexing' : 'file-suggestion-empty';
    emptyDiv.textContent = isIndexBuilding ? 'Building file index...' : 'No matching items found';
    this.suggestionsContainer.appendChild(emptyDiv);

    this.suggestionsContainer.style.display = 'block';
    this.suggestionsContainer.scrollTop = 0;
  }

  /**
   * Create a suggestion item element
   */
  private createSuggestionItem(suggestion: SuggestionItem, index: number): HTMLElement {
    const item = document.createElement('div');
    item.className = 'file-suggestion-item';
    item.setAttribute('role', 'option');
    item.setAttribute('data-index', index.toString());
    item.setAttribute('data-suggestion-index', index.toString());

    if (suggestion.type === 'file' && suggestion.file) {
      this.renderFileItem(item, suggestion.file);
    } else if (suggestion.type === 'agent' && suggestion.agent) {
      this.renderAgentItem(item, suggestion.agent, suggestion);
    } else if (suggestion.type === 'symbol' && suggestion.symbol) {
      this.renderSymbolItem(item, suggestion.symbol);
    }

    return item;
  }

  /**
   * Render a file item
   */
  private renderFileItem(item: HTMLElement, file: FileInfo): void {
    item.setAttribute('data-type', 'file');

    const icon = document.createElement('span');
    icon.className = 'file-icon';
    insertSvgIntoElement(icon, getFileIconSvg(file.name, file.isDirectory));

    const name = document.createElement('span');
    name.className = 'file-name';

    const currentQuery = this.callbacks.getCurrentQuery?.() || '';
    if (file.isDirectory) {
      insertHighlightedText(name, file.name, currentQuery);

      const fileCount = this.callbacks.countFilesInDirectory?.(file.path) || 0;
      const countSpan = document.createElement('span');
      countSpan.className = 'file-count';
      countSpan.textContent = ` (${fileCount} files)`;
      name.appendChild(countSpan);
    } else {
      insertHighlightedText(name, file.name, currentQuery);
    }

    item.appendChild(icon);
    item.appendChild(name);

    const baseDir = this.callbacks.getBaseDir?.() || '';
    const relativePath = getRelativePath(file.path, baseDir);
    const dirPath = getDirectoryFromPath(relativePath);
    if (dirPath) {
      const pathEl = document.createElement('span');
      pathEl.className = 'file-path';
      pathEl.textContent = dirPath;
      item.appendChild(pathEl);
    }
  }

  /**
   * Render an agent item
   */
  private renderAgentItem(item: HTMLElement, agent: AgentItem, suggestion: SuggestionItem): void {
    item.className += ' agent-suggestion-item';
    item.setAttribute('data-type', 'agent');

    const icon = document.createElement('span');
    icon.className = 'file-icon mention-icon';
    insertSvgIntoElement(icon, getMentionIconSvg());

    const name = document.createElement('span');
    name.className = 'file-name agent-name';
    const currentQuery = this.callbacks.getCurrentQuery?.() || '';
    insertHighlightedText(name, agent.name, currentQuery);

    const desc = document.createElement('span');
    desc.className = 'file-path agent-description';
    desc.textContent = agent.description;

    item.appendChild(icon);
    item.appendChild(name);
    item.appendChild(desc);

    if (agent.frontmatter && this.callbacks.onMouseEnterInfo) {
      const infoIcon = document.createElement('span');
      infoIcon.className = 'frontmatter-info-icon';
      infoIcon.textContent = 'ⓘ';

      infoIcon.addEventListener('mouseenter', () => {
        this.callbacks.onMouseEnterInfo?.(suggestion, infoIcon);
      });

      infoIcon.addEventListener('mouseleave', () => {
        this.callbacks.onMouseLeaveInfo?.();
      });

      item.appendChild(infoIcon);
    }
  }

  /**
   * Render a symbol item
   */
  private renderSymbolItem(item: HTMLElement, symbol: SymbolResult): void {
    item.className += ' symbol-suggestion-item';
    item.setAttribute('data-type', 'symbol');

    const icon = document.createElement('span');
    icon.className = 'file-icon symbol-icon';
    insertSvgIntoElement(icon, getSymbolIconSvg(symbol.type));

    const name = document.createElement('span');
    name.className = 'file-name symbol-name';
    const codeSearchQuery = this.callbacks.getCodeSearchQuery?.() || '';
    insertHighlightedText(name, symbol.name, codeSearchQuery);

    const typeBadge = document.createElement('span');
    typeBadge.className = 'symbol-type-badge';
    typeBadge.textContent = getSymbolTypeDisplay(symbol.type);

    const pathEl = document.createElement('span');
    pathEl.className = 'file-path symbol-path';
    pathEl.textContent = `${symbol.relativePath}:${symbol.lineNumber}`;

    item.appendChild(icon);
    item.appendChild(name);
    item.appendChild(typeBadge);
    item.appendChild(pathEl);
  }


  // ============================================================
  // Positioning
  // ============================================================

  private positionAtCursor(atPosition: number): void {
    if (!this.suggestionsContainer || atPosition < 0) return;

    if (!this.mirrorDiv) {
      this.mirrorDiv = createMirrorDiv();
    }

    const coordinates = getCaretCoordinates(this.textInput, this.mirrorDiv, atPosition);
    if (!coordinates) return;

    const { top: caretTop, left: caretLeft } = coordinates;

    const mainContent = document.querySelector('.main-content');
    if (!mainContent) return;

    const mainContentRect = mainContent.getBoundingClientRect();
    const viewportHeight = window.innerHeight;

    const spaceBelow = viewportHeight - caretTop - 20;
    const spaceAbove = caretTop - mainContentRect.top;
    const showAbove = spaceBelow < 200 && spaceAbove > spaceBelow;

    let top: number;
    let left = caretLeft;
    const availableHeight = showAbove ? spaceAbove - 8 : spaceBelow - 8;

    if (!showAbove) {
      top = caretTop + 20;
    } else {
      top = 0;
    }

    const dynamicMaxHeight = Math.max(100, availableHeight);
    this.suggestionsContainer.style.maxHeight = `${dynamicMaxHeight}px`;

    if (showAbove) {
      const menuHeight = Math.min(this.suggestionsContainer.scrollHeight || dynamicMaxHeight, dynamicMaxHeight);
      top = caretTop - menuHeight - 4;
      if (top < 0) top = 0;
    }

    const minMenuWidth = 500;
    const rightMargin = 8;
    let availableWidth = mainContentRect.width - left - rightMargin;
    let adjustedLeft = left;

    if (availableWidth < minMenuWidth) {
      const shiftAmount = minMenuWidth - availableWidth;
      adjustedLeft = Math.max(8, left - shiftAmount);
      availableWidth = mainContentRect.width - adjustedLeft - rightMargin;
    }

    const dynamicMaxWidth = Math.max(minMenuWidth, availableWidth);
    this.suggestionsContainer.style.maxWidth = `${dynamicMaxWidth}px`;

    this.suggestionsContainer.style.top = `${top}px`;
    this.suggestionsContainer.style.left = `${adjustedLeft}px`;
    this.suggestionsContainer.style.right = 'auto';
    this.suggestionsContainer.style.bottom = 'auto';
  }

  // ============================================================
  // Selection Management
  // ============================================================

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
  }

  // ============================================================
  // Getters
  // ============================================================

  public getSelectedIndex(): number {
    return this.selectedIndex;
  }

  public getSelectedSuggestion(): SuggestionItem | null {
    return this.mergedSuggestions[this.selectedIndex] || null;
  }

  public isActive(): boolean {
    return this.isVisible;
  }

  public getContainer(): HTMLElement | null {
    return this.suggestionsContainer;
  }

  public getTotalItemCount(): number {
    return this.mergedSuggestions.length;
  }

  // ============================================================
  // Helpers
  // ============================================================

  private getFilePathFromSuggestion(suggestion: SuggestionItem | undefined): string | undefined {
    if (!suggestion) return undefined;
    if (suggestion.type === 'file') {
      return suggestion.file?.path;
    } else if (suggestion.type === 'agent') {
      return suggestion.agent?.filePath;
    } else if (suggestion.type === 'symbol') {
      return suggestion.symbol?.filePath;
    }
    return undefined;
  }

  // ============================================================
  // Cleanup
  // ============================================================

  public destroy(): void {
    this.hide();
    if (this.mirrorDiv && this.mirrorDiv.parentNode) {
      this.mirrorDiv.parentNode.removeChild(this.mirrorDiv);
      this.mirrorDiv = null;
    }

    // Clean up event delegation
    if (this.suggestionsContainer) {
      if (this.containerClickHandler) {
        this.suggestionsContainer.removeEventListener('click', this.containerClickHandler);
        this.containerClickHandler = null;
      }
      if (this.containerMouseMoveHandler) {
        this.suggestionsContainer.removeEventListener('mousemove', this.containerMouseMoveHandler);
        this.containerMouseMoveHandler = null;
      }
      if (this.containerMouseLeaveHandler) {
        this.suggestionsContainer.removeEventListener('mouseleave', this.containerMouseLeaveHandler);
        this.containerMouseLeaveHandler = null;
      }
    }
  }
}

export default SuggestionUIManager;
