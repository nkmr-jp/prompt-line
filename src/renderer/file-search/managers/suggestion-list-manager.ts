/**
 * SuggestionListManager - Manages suggestion dropdown display and interaction
 *
 * Responsibilities:
 * - Renders suggestion items (files, agents, symbols) in dropdown
 * - Handles keyboard navigation (arrow keys, Enter, Tab, Escape)
 * - Manages selection state and visual feedback
 * - Positions dropdown near cursor
 * - Handles mouse hover and click interactions
 */

import type { SuggestionItem } from '../types';
import type { FileInfo, AgentItem } from '../../../types';
import type { SymbolResult } from '../../code-search/types';
import { getFileIconSvg, getMentionIconSvg, getSymbolIconSvg } from '../../assets/icons/file-icons';
import { getSymbolTypeDisplay } from '../../code-search/types';
import { insertSvgIntoElement } from '../types';
import { insertHighlightedText, getCaretCoordinates, createMirrorDiv } from '../dom-utils';
import { getRelativePath, getDirectoryFromPath } from '../path-utils';

export interface SuggestionListCallbacks {
  onItemSelected: (index: number) => void;
  onNavigateIntoDirectory: (file: FileInfo) => void;
  onEscape: () => void;
  onOpenFileInEditor?: (filePath: string) => Promise<void>;
  getIsComposing?: () => boolean;
  getCurrentPath?: () => string; // Current directory path for header display
  getBaseDir?: () => string; // Base directory for relative path calculations
  getCurrentQuery?: () => string; // Current search query for highlighting
  getCodeSearchQuery?: () => string; // Code search query for symbol highlighting
  countFilesInDirectory?: (path: string) => number; // Count files in directory
  onMouseEnterInfo?: (suggestion: SuggestionItem, target: HTMLElement) => void; // Info icon hover
  onMouseLeaveInfo?: () => void; // Info icon leave
}

/**
 * Manages the suggestion list dropdown UI and interactions
 */
export class SuggestionListManager {
  private textInput: HTMLTextAreaElement;
  private callbacks: SuggestionListCallbacks;

  private suggestionsContainer: HTMLElement | null = null;
  private mirrorDiv: HTMLDivElement | null = null;
  private isVisible: boolean = false;
  private selectedIndex: number = 0;
  private mergedSuggestions: SuggestionItem[] = [];
  private atPosition: number = -1; // Position of @ character for positioning

  constructor(
    textInput: HTMLTextAreaElement,
    callbacks: SuggestionListCallbacks
  ) {
    this.textInput = textInput;
    this.callbacks = callbacks;

    this.initializeContainer();
  }

  /**
   * Initialize the suggestions container
   */
  private initializeContainer(): void {
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
      }
    }

    // Create mirror div for caret position calculation
    this.mirrorDiv = createMirrorDiv();
  }

  /**
   * Show suggestions at a specific position
   * @param suggestions - Array of suggestions to display
   * @param atPosition - Character position of @ in textarea
   * @param isIndexBuilding - Whether the file index is currently being built
   */
  public show(suggestions: SuggestionItem[], atPosition: number, isIndexBuilding: boolean = false): void {
    if (!this.suggestionsContainer) return;

    this.mergedSuggestions = suggestions;
    this.atPosition = atPosition;
    this.selectedIndex = 0;
    this.isVisible = true;

    this.renderSuggestions(isIndexBuilding);
    this.positionSuggestions();
    this.updateSelection();
  }

  /**
   * Hide the suggestions dropdown
   */
  public hide(): void {
    if (!this.suggestionsContainer) return;

    this.isVisible = false;
    this.suggestionsContainer.style.display = 'none';

    // Clear container safely
    while (this.suggestionsContainer.firstChild) {
      this.suggestionsContainer.removeChild(this.suggestionsContainer.firstChild);
    }

    this.mergedSuggestions = [];
    this.atPosition = -1;
  }

  /**
   * Handle keyboard navigation
   * @returns true if event was handled, false otherwise
   */
  public handleKeyDown(e: KeyboardEvent): boolean {
    if (!this.isVisible) return false;

    const totalItems = this.getTotalItemCount();

    // Ctrl+n or Ctrl+j: Move down (same as ArrowDown)
    if (e.ctrlKey && (e.key === 'n' || e.key === 'j')) {
      e.preventDefault();
      e.stopPropagation();
      this.selectedIndex = Math.min(this.selectedIndex + 1, totalItems - 1);
      this.updateSelection();
      return true;
    }

    // Ctrl+p or Ctrl+k: Move up (same as ArrowUp)
    if (e.ctrlKey && (e.key === 'p' || e.key === 'k')) {
      e.preventDefault();
      e.stopPropagation();
      this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
      this.updateSelection();
      return true;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        e.stopPropagation();
        this.selectedIndex = Math.min(this.selectedIndex + 1, totalItems - 1);
        this.updateSelection();
        return true;

      case 'ArrowUp':
        e.preventDefault();
        e.stopPropagation();
        this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
        this.updateSelection();
        return true;

      case 'Enter':
        // Skip Enter key if IME is active to let IME handle it
        if (e.isComposing || this.callbacks.getIsComposing?.()) {
          return false;
        }

        if (totalItems > 0) {
          e.preventDefault();
          e.stopPropagation();

          // Ctrl+Enter: Open file in editor (delegated to parent)
          if (e.ctrlKey && this.selectedIndex >= 0) {
            const suggestion = this.mergedSuggestions[this.selectedIndex];
            if (suggestion && this.callbacks.onOpenFileInEditor) {
              const filePath = this.getFilePathFromSuggestion(suggestion);
              if (filePath) {
                this.callbacks.onOpenFileInEditor(filePath)
                  .then(() => this.hide());
                return true;
              }
            }
          }

          // Normal Enter: select item
          if (this.selectedIndex >= 0) {
            this.callbacks.onItemSelected(this.selectedIndex);
            return true;
          }
        }
        return false;

      case 'Tab':
        // Skip Tab key if IME is active
        if (e.isComposing || this.callbacks.getIsComposing?.()) {
          return false;
        }

        if (totalItems > 0) {
          e.preventDefault();
          e.stopPropagation();

          // Check if current selection is a directory (delegate to parent)
          if (this.selectedIndex >= 0) {
            const suggestion = this.mergedSuggestions[this.selectedIndex];
            if (suggestion?.type === 'file' && suggestion.file?.isDirectory) {
              this.callbacks.onNavigateIntoDirectory(suggestion.file);
              return true;
            }
          }

          // Otherwise select the item
          if (this.selectedIndex >= 0) {
            this.callbacks.onItemSelected(this.selectedIndex);
            return true;
          }
        }
        return false;

      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        this.callbacks.onEscape();
        return true;

      default:
        return false;
    }
  }

  /**
   * Get the currently selected index
   */
  public getSelectedIndex(): number {
    return this.selectedIndex;
  }

  /**
   * Get the currently selected suggestion
   */
  public getSelectedSuggestion(): SuggestionItem | null {
    return this.mergedSuggestions[this.selectedIndex] || null;
  }

  /**
   * Check if suggestions are visible
   */
  public isActive(): boolean {
    return this.isVisible;
  }

  /**
   * Get total count of suggestion items
   */
  private getTotalItemCount(): number {
    return this.mergedSuggestions.length;
  }

  /**
   * Render the suggestions in the dropdown
   */
  private renderSuggestions(isIndexBuilding: boolean = false): void {
    if (!this.suggestionsContainer) return;

    const totalItems = this.getTotalItemCount();

    if (totalItems === 0) {
      this.renderEmptyState(isIndexBuilding);
      return;
    }

    // Reset scroll position to top
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

    // Render merged suggestions
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

    // Clear existing content safely
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

    if (suggestion.type === 'file' && suggestion.file) {
      this.renderFileItem(item, suggestion.file);
    } else if (suggestion.type === 'agent' && suggestion.agent) {
      this.renderAgentItem(item, suggestion.agent);
    } else if (suggestion.type === 'symbol' && suggestion.symbol) {
      this.renderSymbolItemInline(item, suggestion.symbol);
    }

    // Add event listeners
    this.attachItemEventListeners(item, index);

    return item;
  }

  /**
   * Render a file item
   */
  private renderFileItem(item: HTMLElement, file: FileInfo): void {
    item.setAttribute('data-type', 'file');

    // Icon
    const icon = document.createElement('span');
    icon.className = 'file-icon';
    insertSvgIntoElement(icon, getFileIconSvg(file.name, file.isDirectory));

    // Name with highlighting
    const name = document.createElement('span');
    name.className = 'file-name';

    const currentQuery = this.callbacks.getCurrentQuery?.() || '';
    if (file.isDirectory) {
      insertHighlightedText(name, file.name, currentQuery);

      // File count for directories
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

    // Directory path
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
  private renderAgentItem(item: HTMLElement, agent: AgentItem): void {
    item.className += ' agent-suggestion-item';
    item.setAttribute('data-type', 'agent');

    // Icon
    const icon = document.createElement('span');
    icon.className = 'file-icon mention-icon';
    insertSvgIntoElement(icon, getMentionIconSvg());

    // Name with highlighting
    const name = document.createElement('span');
    name.className = 'file-name agent-name';
    const currentQuery = this.callbacks.getCurrentQuery?.() || '';
    insertHighlightedText(name, agent.name, currentQuery);

    // Description
    const desc = document.createElement('span');
    desc.className = 'file-path agent-description';
    desc.textContent = agent.description;

    item.appendChild(icon);
    item.appendChild(name);
    item.appendChild(desc);

    // Add info icon for frontmatter popup (only if frontmatter exists)
    if (agent.frontmatter && this.callbacks.onMouseEnterInfo) {
      const infoIcon = document.createElement('span');
      infoIcon.className = 'frontmatter-info-icon';
      infoIcon.textContent = 'ⓘ';

      infoIcon.addEventListener('mouseenter', () => {
        this.callbacks.onMouseEnterInfo?.({ type: 'agent', agent, score: 0 }, infoIcon);
      });

      infoIcon.addEventListener('mouseleave', () => {
        this.callbacks.onMouseLeaveInfo?.();
      });

      item.appendChild(infoIcon);
    }
  }

  /**
   * Render a symbol item inline (for mixed suggestions)
   */
  private renderSymbolItemInline(item: HTMLElement, symbol: SymbolResult): void {
    item.className += ' symbol-suggestion-item';
    item.setAttribute('data-type', 'symbol');

    // Icon
    const icon = document.createElement('span');
    icon.className = 'file-icon symbol-icon';
    insertSvgIntoElement(icon, getSymbolIconSvg(symbol.type));

    // Name with highlighting
    const name = document.createElement('span');
    name.className = 'file-name symbol-name';
    const codeSearchQuery = this.callbacks.getCodeSearchQuery?.() || '';
    insertHighlightedText(name, symbol.name, codeSearchQuery);

    // Type badge
    const typeBadge = document.createElement('span');
    typeBadge.className = 'symbol-type-badge';
    typeBadge.textContent = getSymbolTypeDisplay(symbol.type);

    // File path with line number
    const pathEl = document.createElement('span');
    pathEl.className = 'file-path symbol-path';
    pathEl.textContent = `${symbol.relativePath}:${symbol.lineNumber}`;

    item.appendChild(icon);
    item.appendChild(name);
    item.appendChild(typeBadge);
    item.appendChild(pathEl);
  }

  /**
   * Attach event listeners to a suggestion item
   */
  private attachItemEventListeners(item: HTMLElement, index: number): void {
    // Click handler
    item.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Cmd+click: Open file in editor
      if (e.metaKey && this.callbacks.onOpenFileInEditor) {
        const suggestion = this.mergedSuggestions[index];
        if (suggestion) {
          const filePath = this.getFilePathFromSuggestion(suggestion);
          if (filePath) {
            await this.callbacks.onOpenFileInEditor(filePath);
            this.hide();
            return;
          }
        }
      }

      // Normal click: select item
      this.callbacks.onItemSelected(index);
    });

    // Mouse move handler - only highlight when mouse actually moves
    item.addEventListener('mousemove', () => {
      const allItems = this.suggestionsContainer?.querySelectorAll('.file-suggestion-item');
      allItems?.forEach(el => el.classList.remove('hovered'));
      item.classList.add('hovered');
    });

    // Remove hover when mouse leaves
    item.addEventListener('mouseleave', () => {
      item.classList.remove('hovered');
    });
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
  }

  /**
   * Position the suggestions container near the @ position
   */
  private positionSuggestions(): void {
    if (!this.suggestionsContainer || !this.textInput || this.atPosition < 0) return;
    if (!this.mirrorDiv) {
      this.mirrorDiv = createMirrorDiv();
    }

    // Get caret position
    const coordinates = getCaretCoordinates(this.textInput, this.mirrorDiv, this.atPosition);
    if (!coordinates) return;

    const { top: caretTop, left: caretLeft } = coordinates;

    // Get main-content bounds for positioning
    const mainContent = document.querySelector('.main-content');
    if (!mainContent) return;

    const mainContentRect = mainContent.getBoundingClientRect();
    const viewportHeight = window.innerHeight;

    // Calculate available space
    const spaceBelow = viewportHeight - caretTop - 20; // 20px for line height
    const spaceAbove = caretTop - mainContentRect.top;
    const showAbove = spaceBelow < 200 && spaceAbove > spaceBelow;

    // Calculate position
    let top: number;
    let left = caretLeft;
    const availableHeight = showAbove ? spaceAbove - 8 : spaceBelow - 8;

    if (!showAbove) {
      top = caretTop + 20; // Below cursor
    } else {
      // Will be calculated after setting max-height
      top = 0;
    }

    // Set dynamic max-height based on available space
    const dynamicMaxHeight = Math.max(100, availableHeight);
    this.suggestionsContainer.style.maxHeight = `${dynamicMaxHeight}px`;

    // If showing above, calculate top position
    if (showAbove) {
      const menuHeight = Math.min(this.suggestionsContainer.scrollHeight || dynamicMaxHeight, dynamicMaxHeight);
      top = caretTop - menuHeight - 4;
      if (top < 0) top = 0;
    }

    // Calculate dynamic max-width and adjust left position
    const minMenuWidth = 300;
    const rightMargin = 16;
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

  /**
   * Extract file path from suggestion
   */
  private getFilePathFromSuggestion(suggestion: SuggestionItem): string | undefined {
    if (suggestion.type === 'file') {
      return suggestion.file?.path;
    } else if (suggestion.type === 'agent') {
      return suggestion.agent?.filePath;
    } else if (suggestion.type === 'symbol') {
      return suggestion.symbol?.filePath;
    }
    return undefined;
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    this.hide();

    // Clean up mirror div
    if (this.mirrorDiv && this.mirrorDiv.parentNode) {
      this.mirrorDiv.parentNode.removeChild(this.mirrorDiv);
      this.mirrorDiv = null;
    }
  }
}
