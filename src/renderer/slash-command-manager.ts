/**
 * Slash Command Manager for renderer process
 * Manages slash command suggestions and selection
 */

import type { InputFormatType } from '../types';
import type { IInitializable } from './interfaces/initializable';
import { FrontmatterPopupManager } from './frontmatter-popup-manager';
import { highlightMatch } from './utils/highlight-utils';
import { electronAPI } from './services/electron-api';
import { extractTriggerQueryAtCursor } from './utils/trigger-query-extractor';
import { getCaretCoordinates, createMirrorDiv } from './mentions/dom-utils';

interface SlashCommandItem {
  name: string;
  description: string;
  argumentHint?: string; // Hint text shown when editing arguments (after Tab selection)
  filePath: string;
  frontmatter?: string;  // Front Matter 全文（ポップアップ表示用）
  inputFormat?: InputFormatType;  // 入力フォーマット（'name' | 'path'）
  source?: string;  // Source tool identifier (e.g., 'claude-code') for filtering
  displayName?: string;  // Human-readable source name for display (e.g., 'Claude Code')
}

export class SlashCommandManager implements IInitializable {

  private suggestionsContainer: HTMLElement | null = null;
  private textarea: HTMLTextAreaElement | null = null;
  private mirrorDiv: HTMLDivElement | null = null;
  private commands: SlashCommandItem[] = [];
  private filteredCommands: SlashCommandItem[] = [];
  private selectedIndex: number = 0;
  private isActive: boolean = false;
  private isEditingMode: boolean = false; // True when Tab selected a command and user is editing arguments
  private editingCommandName: string = ''; // The command name being edited
  private currentTriggerStartPos: number = 0; // Position of trigger character
  private onCommandSelect: (command: string) => void;
  private onCommandInsert: (command: string) => void;
  private onBeforeOpenFile: (() => void) | undefined;
  private setDraggable: ((enabled: boolean) => void) | undefined;

  // Frontmatter popup manager
  private frontmatterPopupManager: FrontmatterPopupManager;

  constructor(callbacks: {
    onCommandSelect: (command: string) => void;
    onCommandInsert?: (command: string) => void;
    onBeforeOpenFile?: () => void;
    setDraggable?: (enabled: boolean) => void;
  }) {
    this.onCommandSelect = callbacks.onCommandSelect;
    this.onCommandInsert = callbacks.onCommandInsert || (() => {});
    this.onBeforeOpenFile = callbacks.onBeforeOpenFile;
    this.setDraggable = callbacks.setDraggable;
    this.frontmatterPopupManager = new FrontmatterPopupManager({
      getSuggestionsContainer: () => this.suggestionsContainer,
      getFilteredCommands: () => this.filteredCommands,
      getSelectedIndex: () => this.selectedIndex
    });
  }

  /**
   * マネージャーを初期化する（IInitializable実装）
   * - DOM要素の取得
   * - イベントリスナーの設定
   */
  public initialize(): void {
    this.initializeElements();
    this.setupEventListeners();
  }

  public initializeElements(): void {
    this.suggestionsContainer = document.getElementById('slashCommandSuggestions');
    this.textarea = document.getElementById('textInput') as HTMLTextAreaElement;

    // Create mirror div for caret position calculation
    this.mirrorDiv = createMirrorDiv();

    // Create frontmatter popup element
    this.frontmatterPopupManager.createPopup();
  }

  public setupEventListeners(): void {
    if (!this.textarea) return;

    // Monitor input for slash command detection
    this.textarea.addEventListener('input', () => {
      this.checkForSlashCommand();
    });

    // Handle keyboard navigation
    this.textarea.addEventListener('keydown', (e) => {
      if (this.isActive) {
        this.handleKeyDown(e);
      } else if (this.isEditingMode && e.ctrlKey && e.key === 'Enter') {
        // Allow Ctrl+Enter to open file even in editing mode
        e.preventDefault();
        e.stopPropagation();
        this.openCommandFile(this.selectedIndex);
      }
    });

    // Hide suggestions on blur (with delay to allow click)
    this.textarea.addEventListener('blur', () => {
      setTimeout(() => {
        this.hideSuggestions();
      }, 200);
    });

    // Setup click and mousemove handling on suggestions container
    if (this.suggestionsContainer) {
      this.suggestionsContainer.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const suggestionItem = target.closest('.slash-suggestion-item') as HTMLElement;
        if (suggestionItem) {
          const index = parseInt(suggestionItem.dataset.index || '0', 10);
          this.selectCommand(index);
        }
      });

      // Enable hover styles only when mouse explicitly moves
      this.suggestionsContainer.addEventListener('mousemove', () => {
        this.suggestionsContainer?.classList.add('hover-enabled');
      });
    }
  }

  /**
   * Load commands from main process
   */
  public async loadCommands(): Promise<void> {
    try {
      if (electronAPI?.slashCommands?.get) {
        this.commands = await electronAPI.slashCommands.get();
      }
    } catch (error) {
      console.error('Failed to load slash commands:', error);
      this.commands = [];
    }
  }

  /**
   * Check if user is typing a slash command at cursor position
   */
  private checkForSlashCommand(): void {
    if (!this.textarea) return;

    const result = extractTriggerQueryAtCursor(
      this.textarea.value,
      this.textarea.selectionStart,
      '/'
    );

    if (!result) {
      this.hideSuggestions();
      return;
    }

    const { query, startPos } = result;

    // If in editing mode (Tab selected), check if command name still matches
    if (this.isEditingMode) {
      // Exit editing mode if user modified the command name
      if (query !== this.editingCommandName) {
        this.isEditingMode = false;
        this.editingCommandName = '';
        // Continue to show suggestions based on new query
      } else {
        // Command name still matches, keep showing selected command
        return;
      }
    }

    // Hide suggestions if there's a space in the query (user is typing arguments)
    if (query.includes(' ')) {
      this.hideSuggestions();
      return;
    }

    this.currentTriggerStartPos = startPos;
    this.showSuggestions(query);
  }

  /**
   * Show suggestions based on query
   */
  private async showSuggestions(query: string): Promise<void> {
    // Load commands if not loaded
    if (this.commands.length === 0) {
      await this.loadCommands();
    }

    // Filter and sort commands - prioritize: prefix match > contains match > description match > source match
    const lowerQuery = query.toLowerCase();
    this.filteredCommands = this.commands
      .filter(cmd =>
        cmd.name.toLowerCase().includes(lowerQuery) ||
        cmd.description.toLowerCase().includes(lowerQuery) ||
        (cmd.displayName && cmd.displayName.toLowerCase().includes(lowerQuery))
      )
      .sort((a, b) => {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();
        const aNamePrefix = aName.startsWith(lowerQuery);
        const bNamePrefix = bName.startsWith(lowerQuery);
        const aNameContains = aName.includes(lowerQuery);
        const bNameContains = bName.includes(lowerQuery);

        // 1. Prioritize prefix matches in name
        if (aNamePrefix && !bNamePrefix) return -1;
        if (!aNamePrefix && bNamePrefix) return 1;

        // 2. If both are prefix matches, sort by name alphabetically
        if (aNamePrefix && bNamePrefix) {
          return a.name.localeCompare(b.name);
        }

        // 3. Prioritize contains matches in name over description-only matches
        if (aNameContains && !bNameContains) return -1;
        if (!aNameContains && bNameContains) return 1;

        // 4. Sort by name alphabetically
        return a.name.localeCompare(b.name);
      });

    if (this.filteredCommands.length === 0) {
      this.hideSuggestions();
      return;
    }

    this.isActive = true;
    this.selectedIndex = 0;
    this.renderSuggestions(query);
    this.positionAtCursor(this.currentTriggerStartPos);
  }

  /**
   * Render suggestions to the UI
   */
  private renderSuggestions(query: string): void {
    if (!this.suggestionsContainer) return;

    this.suggestionsContainer.innerHTML = '';
    this.suggestionsContainer.style.display = 'block';
    // Reset hover-enabled class when re-rendering (will be re-added on mousemove)
    this.suggestionsContainer.classList.remove('hover-enabled');
    // Reset scroll position to top when search text changes
    this.suggestionsContainer.scrollTop = 0;

    const fragment = document.createDocumentFragment();

    this.filteredCommands.forEach((cmd, index) => {
      const item = document.createElement('div');
      item.className = 'slash-suggestion-item';
      if (index === this.selectedIndex) {
        item.classList.add('selected');
      }
      item.dataset.index = index.toString();

      // Create name element with highlighting
      const nameSpan = document.createElement('span');
      nameSpan.className = 'slash-command-name';
      nameSpan.innerHTML = '/' + highlightMatch(cmd.name, query, 'slash-highlight');
      item.appendChild(nameSpan);

      // Create source badge for built-in commands (if displayName exists)
      if (cmd.displayName) {
        const sourceBadge = document.createElement('span');
        sourceBadge.className = 'slash-command-source';
        sourceBadge.dataset.source = cmd.source || cmd.displayName;
        sourceBadge.textContent = cmd.displayName;
        item.appendChild(sourceBadge);
      }

      // Create description element with highlighting
      if (cmd.description) {
        const descSpan = document.createElement('span');
        descSpan.className = 'slash-command-description';
        descSpan.innerHTML = highlightMatch(cmd.description, query, 'slash-highlight');
        item.appendChild(descSpan);
      }

      // Add info icon for frontmatter popup (only if frontmatter exists)
      if (cmd.frontmatter) {
        const infoIcon = document.createElement('span');
        infoIcon.className = 'frontmatter-info-icon';
        infoIcon.textContent = 'ⓘ';

        // Show popup on info icon hover
        infoIcon.addEventListener('mouseenter', () => {
          this.frontmatterPopupManager.show(cmd, infoIcon);
        });

        infoIcon.addEventListener('mouseleave', () => {
          this.frontmatterPopupManager.scheduleHide();
        });

        item.appendChild(infoIcon);
      }

      fragment.appendChild(item);
    });

    this.suggestionsContainer.appendChild(fragment);
  }

  /**
   * Position suggestions container at cursor position (like MentionManager)
   * @param triggerPosition - Position of the trigger character (/)
   */
  private positionAtCursor(triggerPosition: number): void {
    if (!this.suggestionsContainer || !this.textarea || !this.mirrorDiv) return;

    const coordinates = getCaretCoordinates(this.textarea, this.mirrorDiv, triggerPosition);
    if (!coordinates) return;

    const { top: caretTop, left: caretLeft } = coordinates;

    // Get main content bounds for relative positioning
    const mainContent = document.querySelector('.main-content') as HTMLElement;
    if (!mainContent) return;

    const mainContentRect = mainContent.getBoundingClientRect();
    const viewportHeight = window.innerHeight;

    // Convert viewport coordinates to main-content relative coordinates
    const relativeCaretTop = caretTop - mainContentRect.top;
    const relativeCaretLeft = caretLeft - mainContentRect.left;

    // Calculate available space
    const spaceBelow = viewportHeight - caretTop - 20;
    const spaceAbove = caretTop - mainContentRect.top;

    // Decide whether to show above or below cursor
    const showAbove = spaceBelow < 200 && spaceAbove > spaceBelow;

    // Calculate vertical position (relative to main-content)
    let top: number;
    if (!showAbove) {
      // Show below cursor
      top = relativeCaretTop + 20;
    } else {
      // Show above cursor
      const menuHeight = Math.min(
        this.suggestionsContainer.scrollHeight,
        Math.max(spaceAbove, spaceBelow) - 20
      );
      top = relativeCaretTop - menuHeight - 4;
      if (top < 0) top = 0;
    }

    // Calculate horizontal position with boundary constraints (relative to main-content)
    const minMenuWidth = 500;
    const rightMargin = 8;
    let left = relativeCaretLeft;

    // Ensure menu doesn't overflow right edge
    const availableWidth = mainContentRect.width - left - rightMargin;
    if (availableWidth < minMenuWidth) {
      const shiftAmount = minMenuWidth - availableWidth;
      left = Math.max(8, left - shiftAmount);
    }

    // Dynamic max height based on available space
    const dynamicMaxHeight = showAbove
      ? Math.max(100, spaceAbove - 8)
      : Math.max(100, spaceBelow - 8);

    // Dynamic max width
    const dynamicMaxWidth = Math.max(minMenuWidth, mainContentRect.width - left - rightMargin);

    // Apply positioning (relative to main-content)
    this.suggestionsContainer.style.top = `${top}px`;
    this.suggestionsContainer.style.left = `${left}px`;
    this.suggestionsContainer.style.maxHeight = `${dynamicMaxHeight}px`;
    this.suggestionsContainer.style.maxWidth = `${dynamicMaxWidth}px`;
    this.suggestionsContainer.style.right = 'auto';
    this.suggestionsContainer.style.bottom = 'auto';
  }

  /**
   * Hide suggestions
   */
  public hideSuggestions(): void {
    this.isActive = false;
    this.isEditingMode = false;
    this.editingCommandName = '';
    this.selectedIndex = 0;
    if (this.suggestionsContainer) {
      this.suggestionsContainer.style.display = 'none';
      this.suggestionsContainer.textContent = '';
      this.suggestionsContainer.classList.remove('hover-enabled');
    }
    // Also hide frontmatter popup
    this.frontmatterPopupManager.hide();
  }

  /**
   * Handle keyboard navigation
   * Supports: ArrowDown/Ctrl+n/Ctrl+j (next), ArrowUp/Ctrl+p/Ctrl+k (previous), Enter/Tab (select), Escape (close), Ctrl+i (toggle tooltip)
   */
  private handleKeyDown(e: KeyboardEvent): void {
    // Ctrl+i: Toggle auto-show tooltip
    if (e.ctrlKey && e.key === 'i') {
      e.preventDefault();
      e.stopPropagation();
      this.frontmatterPopupManager.toggleAutoShow();
      return;
    }

    // Ctrl+n or Ctrl+j: Move down (same as ArrowDown)
    if (e.ctrlKey && (e.key === 'n' || e.key === 'j')) {
      e.preventDefault();
      e.stopPropagation();
      this.selectedIndex = Math.min(this.selectedIndex + 1, this.filteredCommands.length - 1);
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
        this.selectedIndex = Math.min(this.selectedIndex + 1, this.filteredCommands.length - 1);
        this.updateSelection();
        break;

      case 'ArrowUp':
        e.preventDefault();
        e.stopPropagation();
        this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
        this.updateSelection();
        break;

      case 'Enter':
        e.preventDefault();
        e.stopPropagation();
        if (e.ctrlKey) {
          // Ctrl+Enter: Open file in editor without inserting command
          this.openCommandFile(this.selectedIndex);
        } else {
          // Enter: Paste immediately
          this.selectCommand(this.selectedIndex, true);
        }
        break;

      case 'Tab':
        e.preventDefault();
        e.stopPropagation();
        this.selectCommand(this.selectedIndex, false); // Insert for editing
        break;

      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        this.hideSuggestions();
        break;
    }
  }

  /**
   * Update visual selection
   */
  private updateSelection(): void {
    if (!this.suggestionsContainer) return;

    const items = this.suggestionsContainer.querySelectorAll('.slash-suggestion-item');
    items.forEach((item, index) => {
      if (index === this.selectedIndex) {
        item.classList.add('selected');
        // Scroll into view if needed
        (item as HTMLElement).scrollIntoView({ block: 'nearest' });
      } else {
        item.classList.remove('selected');
      }
    });

    // Update tooltip if auto-show is enabled
    this.frontmatterPopupManager.showForSelectedItem();
  }

  /**
   * Select a command and insert it into the textarea
   * @param index - The index of the command to select
   * @param shouldPaste - If true, paste immediately (Enter). If false, insert for editing (Tab).
   */
  private selectCommand(index: number, shouldPaste: boolean = true): void {
    if (index < 0 || index >= this.filteredCommands.length) return;

    const command = this.filteredCommands[index];
    if (!command || !this.textarea) return;

    // Determine what to insert based on inputFormat setting
    // Default to 'name' for commands (backward compatible behavior)
    const inputFormat = command.inputFormat ?? 'name';
    const commandText = inputFormat === 'path' ? command.filePath : `/${command.name}`;

    if (shouldPaste && this.currentTriggerStartPos === 0) {
      // Enter at text start: Paste immediately
      this.hideSuggestions();
      // Replace only the /query portion
      const start = this.currentTriggerStartPos;
      const end = this.textarea.selectionStart;
      this.replaceRangeWithUndo(start, end, commandText);
      this.onCommandSelect(commandText);
    } else {
      // Tab, or Enter at non-start position: Insert with trailing space for editing
      // Show only the selected command in suggestions
      this.showSelectedCommandOnly(command);

      const commandWithSpace = commandText + ' ';
      // Replace only the /query portion
      const start = this.currentTriggerStartPos;
      const end = this.textarea.selectionStart;
      this.replaceRangeWithUndo(start, end, commandWithSpace);
      this.onCommandInsert(commandWithSpace);
    }
  }

  /**
   * Replace text range with undo support
   * Uses document.execCommand for native undo/redo support
   */
  private replaceRangeWithUndo(start: number, end: number, newText: string): void {
    if (!this.textarea) return;

    this.textarea.focus();
    this.textarea.setSelectionRange(start, end);

    const success = document.execCommand('insertText', false, newText);
    if (!success) {
      // Fallback if execCommand is not supported
      const value = this.textarea.value;
      this.textarea.value = value.substring(0, start) + newText + value.substring(end);
      this.textarea.setSelectionRange(start + newText.length, start + newText.length);
    }
  }

  /**
   * Show only the selected command in suggestions (for Tab selection)
   */
  private showSelectedCommandOnly(command: SlashCommandItem): void {
    if (!this.suggestionsContainer) return;

    // Hide frontmatter popup when showing selected command only
    this.frontmatterPopupManager.hide();

    this.suggestionsContainer.innerHTML = '';
    this.suggestionsContainer.style.display = 'block';
    this.suggestionsContainer.classList.remove('hover-enabled');

    const item = document.createElement('div');
    item.className = 'slash-suggestion-item selected';
    item.dataset.index = '0';

    // Use argumentHint if available, otherwise use description
    const hintText = command.argumentHint || command.description;

    // Create name element
    const nameSpan = document.createElement('span');
    nameSpan.className = 'slash-command-name';
    nameSpan.textContent = `/${command.name}`;
    item.appendChild(nameSpan);

    // Add source badge if displayName is available (same order as list view)
    if (command.displayName) {
      const sourceBadge = document.createElement('span');
      sourceBadge.className = 'slash-command-source';
      sourceBadge.dataset.source = command.source || command.displayName;
      sourceBadge.textContent = command.displayName;
      item.appendChild(sourceBadge);
    }

    // Create description element
    if (hintText) {
      const descSpan = document.createElement('span');
      descSpan.className = 'slash-command-description';
      descSpan.textContent = hintText;
      item.appendChild(descSpan);
    }

    this.suggestionsContainer.appendChild(item);

    // Keep active state but update filtered commands to just this one
    this.filteredCommands = [command];
    this.selectedIndex = 0;
    this.isActive = false; // Disable keyboard navigation since we're in editing mode
    this.isEditingMode = true; // Keep showing the selected command while editing arguments
    this.editingCommandName = command.name; // Track the command name for validation
  }

  /**
   * Check if suggestions are currently active
   */
  public isActiveMode(): boolean {
    return this.isActive;
  }

  /**
   * Open the command file in editor without inserting command text
   * Similar to MentionManager behavior - window stays open and becomes draggable
   */
  private async openCommandFile(index: number): Promise<void> {
    if (index < 0 || index >= this.filteredCommands.length) return;

    const command = this.filteredCommands[index];
    if (!command?.filePath) return;

    try {
      // Suppress blur event to prevent window from closing
      this.onBeforeOpenFile?.();
      // Enable draggable state while file is opening
      this.setDraggable?.(true);

      // Open the file in editor
      if (electronAPI?.file?.openInEditor) {
        await electronAPI.file.openInEditor(command.filePath);
      }
      // Note: Do not restore focus to PromptLine window
      // The opened file's application should stay in foreground
    } catch (err) {
      console.error('Failed to open command file in editor:', err);
      // Disable draggable state on error
      this.setDraggable?.(false);
    }
  }

  /**
   * Invalidate command cache to force reload
   */
  public invalidateCache(): void {
    this.commands = [];
  }
}
