/**
 * Slash Command Manager for renderer process
 * Manages slash command suggestions and selection
 */

import type { InputFormatType, ColorValue } from '../types';
import type { IInitializable } from './interfaces/initializable';
import { FrontmatterPopupManager } from './frontmatter-popup-manager';
import { highlightMatch } from './utils/highlight-utils';
import { electronAPI } from './services/electron-api';
import { extractTriggerQueryAtCursor } from './utils/trigger-query-extractor';
import { getCaretCoordinates, createMirrorDiv } from './mentions/dom-utils';
import { compareTiebreak } from '../lib/tiebreaker';

interface SlashCommandItem {
  name: string;
  description: string;
  label?: string;  // Label text (e.g., from frontmatter)
  /**
   * Color for label and highlight
   * Supports both named colors and hex color codes:
   * - Named colors: 'grey', 'darkGrey', 'blue', 'purple', 'teal', 'green', 'yellow', 'orange', 'pink', 'red'
   * - Hex codes: '#RGB' or '#RRGGBB' (e.g., '#FF6B35', '#F63')
   */
  color?: ColorValue;
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
  private editingCommandStartPos: number = 0; // Position where the editing command starts
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
      getSelectedIndex: () => this.selectedIndex,
      ...(callbacks.onBeforeOpenFile ? { onBeforeOpenFile: callbacks.onBeforeOpenFile } : {}),
      ...(callbacks.setDraggable ? { setDraggable: callbacks.setDraggable } : {}),
      onSelectCommand: (command) => {
        // Find the command in filteredCommands to get the full command object
        const fullCommand = this.filteredCommands.find(cmd => cmd.name === command.name);
        if (fullCommand) {
          // Use Tab behavior (shouldPaste=false) to insert command with space for editing
          this.selectCommand(this.filteredCommands.indexOf(fullCommand), false);
        }
      }
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

  /**
   * Show a notification for copied feedback in the app name area
   */
  private showCopiedNotification(): void {
    const appNameEl = document.getElementById('appName');
    if (!appNameEl) return;

    const originalText = appNameEl.textContent;
    appNameEl.textContent = '✓ Copied to clipboard';
    appNameEl.classList.add('app-name-success');

    setTimeout(() => {
      if (appNameEl) {
        appNameEl.textContent = originalText;
        appNameEl.classList.remove('app-name-success');
      }
    }, 1500);
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

    // Monitor input for slash command detection and argumentHint display
    this.textarea.addEventListener('input', () => {
      this.checkForSlashCommand();
      // After checking for slash command, also check if we need to show argumentHint
      // This handles the case when user deletes characters and cursor returns to argument position
      if (!this.isActive) {
        this.checkForArgumentHintAtCursor();
      }
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

    // Check for argumentHint when cursor position changes (arrow keys, home, end)
    this.textarea.addEventListener('keyup', (e) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
        this.checkForArgumentHintAtCursor();
      }
    });

    // Check for argumentHint when clicking in textarea
    this.textarea.addEventListener('click', () => {
      this.checkForArgumentHintAtCursor();
    });

    // Check for argumentHint when textarea receives focus
    this.textarea.addEventListener('focus', () => {
      this.checkForArgumentHintAtCursor();
    });

    // Hide suggestions on blur (with delay to allow click)
    this.textarea.addEventListener('blur', () => {
      setTimeout(() => {
        this.hideSuggestions();
      }, 200);
    });

    // Setup click and mousemove handling on suggestions container
    if (this.suggestionsContainer) {
      this.suggestionsContainer.addEventListener('click', async (e) => {
        const target = e.target as HTMLElement;
        const suggestionItem = target.closest('.slash-suggestion-item') as HTMLElement;
        if (suggestionItem) {
          // Check if this is an argument-hint-only item
          if (suggestionItem.classList.contains('argument-hint-only')) {
            const argumentHint = suggestionItem.dataset.argumentHint;
            if (argumentHint) {
              try {
                await navigator.clipboard.writeText(argumentHint);
                // Show toast notification
                this.showCopiedNotification();
              } catch (error) {
                console.error('Failed to copy argumentHint to clipboard:', error);
              }
            }
            return; // Do NOT paste for argument-hint-only
          }

          // Normal suggestion handling
          const index = parseInt(suggestionItem.dataset.index || '0', 10);
          const command = this.filteredCommands[index];

          // Copy argumentHint to clipboard if it exists
          if (command?.argumentHint) {
            try {
              await navigator.clipboard.writeText(command.argumentHint);
              // Show toast notification
              this.showCopiedNotification();
            } catch (error) {
              console.error('Failed to copy argumentHint to clipboard:', error);
            }
          }

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

    // If in editing mode, check if user has started typing arguments
    if (!result) {
      if (this.isEditingMode) {
        // Check if the text still contains the command at the original position
        const text = this.textarea.value;
        const expectedCommand = `/${this.editingCommandName}`;
        const commandAtPos = text.substring(
          this.editingCommandStartPos,
          this.editingCommandStartPos + expectedCommand.length
        );
        if (commandAtPos === expectedCommand) {
          // Check if user has started typing arguments (after the trailing space)
          const commandEndPos = this.editingCommandStartPos + expectedCommand.length;
          const afterCommand = text.substring(commandEndPos);

          // Hide UI if user has typed any argument, but keep editing mode state
          if (afterCommand !== ' ') {
            this.hideUI();
            return;
          }

          // Keep showing hint (only single space after command)
          return;
        }
      }
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
        this.editingCommandStartPos = 0;
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
   * Check if cursor is at the argument input position of an existing slash command.
   * If so, show the argumentHint for that command.
   * Called when cursor position changes (click, arrow keys).
   */
  private async checkForArgumentHintAtCursor(): Promise<void> {
    if (!this.textarea) return;

    // Don't interfere if suggestions popup is already active
    if (this.isActive) return;

    // Load commands if not loaded
    if (this.commands.length === 0) {
      await this.loadCommands();
    }

    const text = this.textarea.value;
    const cursorPos = this.textarea.selectionStart;
    const textBeforeCursor = text.substring(0, cursorPos);

    // Cursor must be right after a space (argument input position)
    if (!textBeforeCursor.endsWith(' ')) {
      // 編集モード中で、UIが非表示の場合は何もしない（状態を保持）
      // UIを非表示にするのは checkForSlashCommand() の責任
      return;
    }

    // Use known command names to find matching command
    // Sort by name length descending to match longer commands first (e.g., "Linear API" before "Linear")
    const sortedCommands = [...this.commands].sort((a, b) => b.name.length - a.name.length);

    let matchedCommand: SlashCommandItem | null = null;
    let commandStartPos = -1;

    for (const cmd of sortedCommands) {
      const pattern = '/' + cmd.name + ' ';
      if (textBeforeCursor.endsWith(pattern)) {
        // Verify it's at start of text or preceded by whitespace
        const patternStartPos = textBeforeCursor.length - pattern.length;
        const prevChar = patternStartPos > 0 ? textBeforeCursor[patternStartPos - 1] : '';
        if (prevChar === '' || prevChar === ' ' || prevChar === '\n' || prevChar === '\t') {
          matchedCommand = cmd;
          commandStartPos = patternStartPos;
          break;
        }
      }
    }

    if (!matchedCommand || !matchedCommand.argumentHint) {
      // No command found or command has no argumentHint
      // 編集モード中でUIが非表示の場合、状態はリセットしない
      return;
    }

    // Show argumentHint for this command
    this.filteredCommands = [matchedCommand];
    this.selectedIndex = 0;
    this.isEditingMode = true;
    this.editingCommandName = matchedCommand.name;
    this.editingCommandStartPos = commandStartPos;
    this.currentTriggerStartPos = commandStartPos;

    this.showArgumentHintOnly(matchedCommand);
  }

  /**
   * Calculate match score for a command name
   * Higher score = better match
   */
  private getMatchScore(name: string, query: string, description?: string): number {
    const lowerQuery = query.toLowerCase();
    const lowerName = name.toLowerCase();

    // Exact match is highest priority
    if (lowerName === lowerQuery) return 1000;

    // Name starts with query
    if (lowerName.startsWith(lowerQuery)) return 500;

    // Name contains query
    if (lowerName.includes(lowerQuery)) return 200;

    // Description contains query
    if (description && description.toLowerCase().includes(lowerQuery)) {
      return 50;
    }

    // No match
    return 0;
  }

  /**
   * Show suggestions based on query
   */
  private async showSuggestions(query: string): Promise<void> {
    // Load commands if not loaded
    if (this.commands.length === 0) {
      await this.loadCommands();
    }

    // Filter commands - prioritize: prefix match > contains match > description match > source match
    const lowerQuery = query.toLowerCase();
    this.filteredCommands = this.commands
      .filter(cmd =>
        cmd.name.toLowerCase().includes(lowerQuery) ||
        cmd.description.toLowerCase().includes(lowerQuery) ||
        (cmd.displayName && cmd.displayName.toLowerCase().includes(lowerQuery)) ||
        (cmd.label && cmd.label.toLowerCase().includes(lowerQuery))
      );

    if (this.filteredCommands.length === 0) {
      this.hideSuggestions();
      return;
    }

    // Get usage bonuses for all filtered commands
    const commandNames = this.filteredCommands.map(cmd => cmd.name);
    let usageBonuses: Record<string, number> = {};
    try {
      if (electronAPI?.slashCommands?.getUsageBonuses) {
        usageBonuses = await electronAPI.slashCommands.getUsageBonuses(commandNames);
      }
    } catch (error) {
      console.error('Failed to get usage bonuses:', error);
      // Continue with empty bonuses (no usage bonus applied)
    }

    // Sort by total score (match score + usage bonus)
    this.filteredCommands.sort((a, b) => {
      const aMatchScore = this.getMatchScore(a.name, lowerQuery, a.description);
      const bMatchScore = this.getMatchScore(b.name, lowerQuery, b.description);

      const aBonus = usageBonuses[a.name] ?? 0;
      const bBonus = usageBonuses[b.name] ?? 0;

      const aTotal = aMatchScore + aBonus;
      const bTotal = bMatchScore + bBonus;

      // Sort by total score descending
      const scoreDiff = bTotal - aTotal;
      if (scoreDiff !== 0) return scoreDiff;

      // Tiebreak: prefer shorter names, then alphabetical
      return compareTiebreak(a, b, { criteria: ['length'] }, {
        length: (item) => item.name.length,
      }) || a.name.localeCompare(b.name);
    });

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

      // Create badge (label takes priority over source/displayName)
      if (cmd.label) {
        const labelBadge = document.createElement('span');
        labelBadge.className = 'slash-command-label';
        if (cmd.color) {
          // Check if color is a hex code (e.g., #FF6B35, #F63)
          if (cmd.color.startsWith('#')) {
            // Apply hex color directly as inline style
            labelBadge.style.color = cmd.color;
            labelBadge.style.background = `${cmd.color}33`; // Add 20% opacity (33 in hex)
          } else {
            // Use predefined color names via data attribute
            labelBadge.dataset.color = cmd.color;
          }
        }
        labelBadge.textContent = cmd.label;
        item.appendChild(labelBadge);
      } else if (cmd.displayName) {
        const sourceBadge = document.createElement('span');
        sourceBadge.className = 'slash-command-source';
        sourceBadge.dataset.source = cmd.source || cmd.displayName;
        // Apply color if specified
        if (cmd.color) {
          // Check if color is a hex code (e.g., #FF6B35, #F63)
          if (cmd.color.startsWith('#')) {
            // Apply hex color directly as inline style
            sourceBadge.style.color = cmd.color;
            sourceBadge.style.background = `${cmd.color}33`; // Add 20% opacity (33 in hex)
          } else {
            // Use predefined color names via data attribute
            sourceBadge.dataset.color = cmd.color;
          }
        }
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

    // Dynamic max height based on available space (calculate first for accurate menu height)
    const dynamicMaxHeight = showAbove
      ? Math.max(100, spaceAbove - 8)
      : Math.max(100, spaceBelow - 8);

    // Calculate vertical position (relative to main-content)
    let top: number;
    if (!showAbove) {
      // Show below cursor
      top = relativeCaretTop + 20;
    } else {
      // Show above cursor
      // Set maxHeight first so scrollHeight reflects actual visible height
      this.suggestionsContainer.style.maxHeight = `${dynamicMaxHeight}px`;
      const menuHeight = Math.min(
        this.suggestionsContainer.scrollHeight,
        dynamicMaxHeight
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
   * UIのみを非表示にする（状態は保持）
   */
  private hideUI(): void {
    this.isActive = false;
    if (this.suggestionsContainer) {
      this.suggestionsContainer.style.display = 'none';
      this.suggestionsContainer.textContent = '';
      this.suggestionsContainer.classList.remove('hover-enabled');
    }
    // Also hide frontmatter popup
    this.frontmatterPopupManager.hide();
  }

  /**
   * 全状態をリセットする
   */
  private resetState(): void {
    this.isEditingMode = false;
    this.editingCommandName = '';
    this.editingCommandStartPos = 0;
    this.selectedIndex = 0;
  }

  /**
   * Hide suggestions
   */
  public hideSuggestions(): void {
    this.hideUI();
    this.resetState();
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
        // Scroll into view if needed (use 'instant' to ensure scroll completes before popup positioning)
        (item as HTMLElement).scrollIntoView({ block: 'nearest', behavior: 'instant' });
      } else {
        item.classList.remove('selected');
      }
    });

    // Update tooltip if auto-show is enabled
    // Use requestAnimationFrame to ensure scroll position is settled before calculating popup position
    requestAnimationFrame(() => {
      this.frontmatterPopupManager.showForSelectedItem();
    });
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

    // Register command to global cache for quick access
    this.registerCommandToCache(command.name);

    // Determine what to insert based on inputFormat setting
    // Default to 'name' for commands (backward compatible behavior)
    const inputFormat = command.inputFormat ?? 'name';
    const commandText = inputFormat === 'path' ? command.filePath : `/${command.name}`;

    // Show argumentHint if available, otherwise hide suggestions
    if (command.argumentHint) {
      this.showArgumentHintOnly(command);
    } else {
      this.hideSuggestions();
    }

    if (shouldPaste && this.currentTriggerStartPos === 0) {
      // Enter at text start: Paste immediately
      // Replace only the /query portion
      const start = this.currentTriggerStartPos;
      const end = this.textarea.selectionStart;
      this.replaceRangeWithUndo(start, end, commandText);
      this.onCommandSelect(commandText);
    } else {
      // Tab, or Enter at non-start position: Insert with trailing space for editing
      const commandWithSpace = commandText + ' ';
      // Replace only the /query portion
      const start = this.currentTriggerStartPos;
      const end = this.textarea.selectionStart;
      this.replaceRangeWithUndo(start, end, commandWithSpace);
      this.onCommandInsert(commandWithSpace);
    }
  }

  /**
   * Register a command to the global cache for quick access
   */
  private async registerCommandToCache(commandName: string): Promise<void> {
    try {
      if (electronAPI?.slashCommands?.registerGlobal) {
        await electronAPI.slashCommands.registerGlobal(commandName);
      }
    } catch (error) {
      console.error('Failed to register slash command to cache:', error);
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
   * Show only the argumentHint for a selected command.
   * Used after command confirmation (Enter at text start) when argumentHint exists.
   * This provides guidance for argument input without being in editing mode.
   */
  private showArgumentHintOnly(command: SlashCommandItem): void {
    if (!this.suggestionsContainer || !command.argumentHint) return;

    // Hide frontmatter popup
    this.frontmatterPopupManager.hide();

    this.suggestionsContainer.innerHTML = '';
    this.suggestionsContainer.style.display = 'block';
    this.suggestionsContainer.classList.remove('hover-enabled');

    const item = document.createElement('div');
    item.className = 'slash-suggestion-item argument-hint-only';
    item.dataset.argumentHint = command.argumentHint;

    // Create name element
    const nameSpan = document.createElement('span');
    nameSpan.className = 'slash-command-name';
    nameSpan.textContent = `/${command.name}`;
    item.appendChild(nameSpan);

    // Add 'arg' badge with gray color
    const argBadge = document.createElement('span');
    argBadge.className = 'slash-command-source argument-hint-badge';
    argBadge.textContent = 'arg';
    item.appendChild(argBadge);

    // Create argumentHint element
    const hintSpan = document.createElement('span');
    hintSpan.className = 'slash-command-description';
    hintSpan.textContent = command.argumentHint;
    item.appendChild(hintSpan);

    // Add copy icon
    const copyIcon = document.createElement('span');
    copyIcon.className = 'argument-hint-copy-icon';
    copyIcon.innerHTML = `
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
    `;
    item.appendChild(copyIcon);

    this.suggestionsContainer.appendChild(item);

    // Keep tracking state for proper cleanup, but not in editing mode
    this.filteredCommands = [command];
    this.selectedIndex = 0;
    this.isActive = false;
    this.isEditingMode = true; // Use editing mode to keep showing the hint
    this.editingCommandName = command.name;
    this.editingCommandStartPos = this.currentTriggerStartPos; // Track command position

    // Position at command location for correct display
    this.positionAtCursor(this.currentTriggerStartPos);
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
   * Get command source by command name
   * Returns undefined if command is not found, has no source, or exists in multiple sources (duplicate)
   * @param commandName - Command name without slash (e.g., "commit")
   * @returns Source identifier (e.g., "claude", "codex", "gemini", "custom") or undefined
   */
  public getCommandSource(commandName: string): string | undefined {
    const matchingCommands = this.commands.filter(cmd => cmd.name === commandName);

    // No command found or command has no source
    if (matchingCommands.length === 0) {
      return undefined;
    }

    // Check if command exists in multiple different sources (duplicate)
    const uniqueSources = new Set(matchingCommands.map(cmd => cmd.source).filter(Boolean));
    if (uniqueSources.size > 1) {
      return undefined; // Duplicate command in multiple sources - return undefined for gray highlight
    }

    return matchingCommands[0]?.source;
  }

  /**
   * Get color for a slash command by name
   * @param commandName - Command name without slash (e.g., "commit")
   * @returns Color (e.g., "purple", "blue") or undefined
   */
  public getCommandColor(commandName: string): string | undefined {
    const matchingCommands = this.commands.filter(cmd => cmd.name === commandName);

    // No command found or command has no color
    if (matchingCommands.length === 0) {
      return undefined;
    }

    // Return first matching command's color
    return matchingCommands[0]?.color;
  }

  /**
   * Get all known command names for multi-word command detection in highlighting
   * @returns Array of command names (without slash prefix)
   */
  public getKnownCommandNames(): string[] {
    return this.commands.map(cmd => cmd.name);
  }

  /**
   * Invalidate command cache to force reload
   */
  public invalidateCache(): void {
    this.commands = [];
  }
}
