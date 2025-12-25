/**
 * SuggestionItemRenderer - Handles rendering of suggestion items
 *
 * Responsibilities:
 * - Creates and renders file suggestion items
 * - Creates and renders agent suggestion items
 * - Creates and renders symbol suggestion items
 * - Handles highlighting and text formatting
 */

import type { SuggestionItem } from '../types';
import type { FileInfo, AgentItem } from '../../../types';
import type { SymbolResult } from '../../code-search/types';
import { getFileIconSvg, getMentionIconSvg, getSymbolIconSvg } from '../../assets/icons/file-icons';
import { getSymbolTypeDisplay } from '../../code-search/types';
import { insertSvgIntoElement } from '../types';
import { insertHighlightedText } from '../dom-utils';
import { getRelativePath, getDirectoryFromPath } from '../path-utils';

export interface SuggestionItemRendererCallbacks {
  getCurrentQuery?: () => string;
  getCodeSearchQuery?: () => string;
  getBaseDir?: () => string;
  getCurrentPath?: () => string;
  countFilesInDirectory?: (path: string) => number;
  onMouseEnterInfo?: (suggestion: SuggestionItem, target: HTMLElement) => void;
  onMouseLeaveInfo?: () => void;
}

/**
 * Renders suggestion items for the dropdown
 */
export class SuggestionItemRenderer {
  private callbacks: SuggestionItemRendererCallbacks;

  constructor(callbacks: SuggestionItemRendererCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Render all suggestions into the container
   */
  public renderAll(
    container: HTMLElement,
    suggestions: SuggestionItem[],
    isIndexBuilding: boolean,
    attachEventListeners: (item: HTMLElement, index: number) => void
  ): void {
    if (suggestions.length === 0) {
      this.renderEmptyState(container, isIndexBuilding);
      return;
    }

    // Reset scroll position to top
    container.scrollTop = 0;

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
    suggestions.forEach((suggestion, index) => {
      const item = this.createSuggestionItem(suggestion, index);
      attachEventListeners(item, index);
      fragment.appendChild(item);
    });

    container.innerHTML = '';
    container.appendChild(fragment);
    container.style.display = 'block';
  }

  /**
   * Render empty state
   */
  public renderEmptyState(container: HTMLElement, isIndexBuilding: boolean): void {
    // Clear existing content safely
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    const emptyDiv = document.createElement('div');
    emptyDiv.className = isIndexBuilding ? 'file-suggestion-empty indexing' : 'file-suggestion-empty';
    emptyDiv.textContent = isIndexBuilding ? 'Building file index...' : 'No matching items found';
    container.appendChild(emptyDiv);

    container.style.display = 'block';
    container.scrollTop = 0;
  }

  /**
   * Create a suggestion item element
   */
  public createSuggestionItem(suggestion: SuggestionItem, index: number): HTMLElement {
    const item = document.createElement('div');
    item.className = 'file-suggestion-item';
    item.setAttribute('role', 'option');
    item.setAttribute('data-index', index.toString());

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
  private renderAgentItem(item: HTMLElement, agent: AgentItem, suggestion: SuggestionItem): void {
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
}
