/**
 * Helper utilities for slash command processing
 * Extracted for better modularity and to reduce SlashCommandManager complexity
 */

import type { InputFormatType } from '../types';

export interface SlashCommandItem {
  name: string;
  description: string;
  argumentHint?: string;
  filePath: string;
  frontmatter?: string;
  inputFormat?: InputFormatType;
}

export interface KeyboardNavigationHandlers {
  onMoveDown: () => void;
  onMoveUp: () => void;
  onSelect: (ctrlPressed: boolean) => void;
  onSelectForEditing: () => void;
  onClose: () => void;
  onToggleTooltip: () => void;
}

/**
 * Check if command matches the query
 */
export function matchesCommand(cmd: SlashCommandItem, lowerQuery: string): boolean {
  return (
    cmd.name.toLowerCase().includes(lowerQuery) ||
    cmd.description.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Compare two commands for sorting based on query relevance
 */
export function compareCommands(
  a: SlashCommandItem,
  b: SlashCommandItem,
  lowerQuery: string
): number {
  const aName = a.name.toLowerCase();
  const bName = b.name.toLowerCase();
  const aNamePrefix = aName.startsWith(lowerQuery);
  const bNamePrefix = bName.startsWith(lowerQuery);
  const aNameContains = aName.includes(lowerQuery);
  const bNameContains = bName.includes(lowerQuery);

  if (aNamePrefix && !bNamePrefix) return -1;
  if (!aNamePrefix && bNamePrefix) return 1;

  if (aNamePrefix && bNamePrefix) {
    return a.name.localeCompare(b.name);
  }

  if (aNameContains && !bNameContains) return -1;
  if (!aNameContains && bNameContains) return 1;

  return a.name.localeCompare(b.name);
}

/**
 * Filter and sort commands based on query
 */
export function filterAndSortCommands(
  commands: SlashCommandItem[],
  query: string,
  maxSuggestions: number
): SlashCommandItem[] {
  const lowerQuery = query.toLowerCase();

  return commands
    .filter(cmd => matchesCommand(cmd, lowerQuery))
    .sort((a, b) => compareCommands(a, b, lowerQuery))
    .slice(0, maxSuggestions);
}

/**
 * Escape HTML to prevent XSS
 */
export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Highlight matching text in suggestions
 */
export function highlightMatch(text: string, query: string): string {
  if (!query) return escapeHtml(text);

  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedQuery})`, 'gi');
  return escapeHtml(text).replace(regex, '<span class="slash-highlight">$1</span>');
}

/**
 * Get command text based on input format
 */
export function getCommandText(command: SlashCommandItem): string {
  const inputFormat = command.inputFormat ?? 'name';
  return inputFormat === 'path' ? command.filePath : `/${command.name}`;
}

/**
 * Create suggestion item element structure
 */
export function createSuggestionItemElement(index: number, isSelected: boolean): HTMLElement {
  const item = document.createElement('div');
  item.className = 'slash-suggestion-item';
  if (isSelected) {
    item.classList.add('selected');
  }
  item.dataset.index = index.toString();
  return item;
}

/**
 * Add command name to suggestion item
 */
export function addCommandName(
  item: HTMLElement,
  cmd: SlashCommandItem,
  query: string
): void {
  const nameSpan = document.createElement('span');
  nameSpan.className = 'slash-command-name';
  nameSpan.innerHTML = '/' + highlightMatch(cmd.name, query);
  item.appendChild(nameSpan);
}

/**
 * Add command description to suggestion item
 */
export function addCommandDescription(
  item: HTMLElement,
  cmd: SlashCommandItem,
  query: string
): void {
  if (!cmd.description) return;

  const descSpan = document.createElement('span');
  descSpan.className = 'slash-command-description';
  descSpan.innerHTML = highlightMatch(cmd.description, query);
  item.appendChild(descSpan);
}

/**
 * Create frontmatter info icon element
 */
export function createFrontmatterIcon(): HTMLElement {
  const infoIcon = document.createElement('span');
  infoIcon.className = 'frontmatter-info-icon';
  infoIcon.textContent = 'ⓘ';
  return infoIcon;
}

/**
 * Handle keyboard navigation events
 */
export function handleKeyboardNavigation(
  e: KeyboardEvent,
  handlers: KeyboardNavigationHandlers
): boolean {
  if (handleTooltipToggle(e, handlers.onToggleTooltip)) return true;
  if (handleControlNavigation(e, handlers.onMoveDown, handlers.onMoveUp)) return true;
  handleStandardNavigation(e, handlers);
  return false;
}

function handleTooltipToggle(e: KeyboardEvent, onToggle: () => void): boolean {
  if (e.ctrlKey && e.key === 'i') {
    e.preventDefault();
    e.stopPropagation();
    onToggle();
    return true;
  }
  return false;
}

function handleControlNavigation(
  e: KeyboardEvent,
  onMoveDown: () => void,
  onMoveUp: () => void
): boolean {
  if (!e.ctrlKey) return false;

  if (e.key === 'n' || e.key === 'j') {
    e.preventDefault();
    e.stopPropagation();
    onMoveDown();
    return true;
  }

  if (e.key === 'p' || e.key === 'k') {
    e.preventDefault();
    e.stopPropagation();
    onMoveUp();
    return true;
  }

  return false;
}

function handleStandardNavigation(e: KeyboardEvent, handlers: KeyboardNavigationHandlers): void {
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      e.stopPropagation();
      handlers.onMoveDown();
      break;

    case 'ArrowUp':
      e.preventDefault();
      e.stopPropagation();
      handlers.onMoveUp();
      break;

    case 'Enter':
      e.preventDefault();
      e.stopPropagation();
      handlers.onSelect(e.ctrlKey);
      break;

    case 'Tab':
      e.preventDefault();
      e.stopPropagation();
      handlers.onSelectForEditing();
      break;

    case 'Escape':
      e.preventDefault();
      e.stopPropagation();
      handlers.onClose();
      break;
  }
}

/**
 * Update visual selection in suggestions container
 */
export function updateVisualSelection(
  container: HTMLElement,
  selectedIndex: number,
  onSelectionUpdated?: () => void
): void {
  const items = container.querySelectorAll('.slash-suggestion-item');
  items.forEach((item, index) => {
    if (index === selectedIndex) {
      item.classList.add('selected');
      (item as HTMLElement).scrollIntoView({ block: 'nearest' });
    } else {
      item.classList.remove('selected');
    }
  });

  onSelectionUpdated?.();
}

/**
 * Parse slash command from text input
 */
export interface SlashCommandParseResult {
  hasSlash: boolean;
  query: string;
  hasArguments: boolean;
}

export function parseSlashCommand(text: string): SlashCommandParseResult {
  if (!text.startsWith('/')) {
    return { hasSlash: false, query: '', hasArguments: false };
  }

  const parts = text.slice(1).split(/\s/);
  const query = parts[0] || '';
  const hasArguments = parts.length > 1 || text.includes(' ');

  return { hasSlash: true, query, hasArguments };
}

/**
 * Render suggestions to container
 */
export function renderSuggestionsToContainer(
  container: HTMLElement,
  commands: SlashCommandItem[],
  _selectedIndex: number,
  query: string,
  onCreateItem: (cmd: SlashCommandItem, index: number, query: string) => HTMLElement
): void {
  container.innerHTML = '';
  container.style.display = 'block';
  container.classList.remove('hover-enabled');
  container.scrollTop = 0;

  const fragment = document.createDocumentFragment();
  commands.forEach((cmd, index) => {
    const item = onCreateItem(cmd, index, query);
    fragment.appendChild(item);
  });

  container.appendChild(fragment);
}

/**
 * Create and populate selected command display (for editing mode)
 */
export function createSelectedCommandDisplay(
  container: HTMLElement,
  command: SlashCommandItem
): void {
  container.innerHTML = '';
  container.style.display = 'block';
  container.classList.remove('hover-enabled');

  const item = document.createElement('div');
  item.className = 'slash-suggestion-item selected';
  item.dataset.index = '0';

  const hintText = command.argumentHint || command.description;
  item.innerHTML = `
    <span class="slash-command-name">/${escapeHtml(command.name)}</span>
    ${hintText ? `<span class="slash-command-description">${escapeHtml(hintText)}</span>` : ''}
  `;

  container.appendChild(item);
}
