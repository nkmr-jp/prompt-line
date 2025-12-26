/**
 * SuggestionRenderer - Handles rendering of suggestion items
 *
 * Responsibilities:
 * - Rendering file suggestion items with icons and metadata
 * - Rendering agent suggestion items with descriptions
 * - Rendering symbol suggestion items with type badges
 * - Empty state rendering
 * - HTML generation for suggestion items
 */

import type { SuggestionItem } from '../types';
import type { FileInfo, AgentItem } from '../../../types';
import type { SymbolResult } from '../../code-search/types';
import { getFileIconSvg, getMentionIconSvg, getSymbolIconSvg } from '../../assets/icons/file-icons';
import { getSymbolTypeDisplay } from '../../code-search/types';
import { insertSvgIntoElement } from '../types';
import { insertHighlightedText } from '../dom-utils';
import { getRelativePath, getDirectoryFromPath } from '../path-utils';

/**
 * Callbacks for accessing context data during rendering
 */
export interface SuggestionRendererCallbacks {
  getCurrentPath?: (() => string) | undefined;
  getBaseDir?: (() => string) | undefined;
  getCurrentQuery?: (() => string) | undefined;
  getCodeSearchQuery?: (() => string) | undefined;
  countFilesInDirectory?: ((path: string) => number) | undefined;
  onMouseEnterInfo?: ((suggestion: SuggestionItem, target: HTMLElement) => void) | undefined;
  onMouseLeaveInfo?: (() => void) | undefined;
}

/**
 * Renders suggestion items to HTML elements
 */
export class SuggestionRenderer {
  private callbacks: SuggestionRendererCallbacks;

  constructor(callbacks: SuggestionRendererCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Render suggestions into the container
   */
  public renderSuggestions(
    container: HTMLElement,
    suggestions: SuggestionItem[],
    isIndexBuilding: boolean = false
  ): void {
    if (suggestions.length === 0) {
      this.renderEmptyState(container, isIndexBuilding);
      return;
    }

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
  private createSuggestionItem(suggestion: SuggestionItem, index: number): HTMLElement {
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
}

export default SuggestionRenderer;
