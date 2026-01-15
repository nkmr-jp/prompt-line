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
import { FzfScorer } from '../lib/fzf-scorer';
import { compareTiebreak } from '../lib/tiebreaker';

interface SlashCommandItem {
  name: string;
  description: string;
  label?: string;  // Label text (e.g., from frontmatter)
  color?: 'grey' | 'darkGrey' | 'purple' | 'teal' | 'green' | 'yellow' | 'orange' | 'pink' | 'red';  // Color for label and highlight
  argumentHint?: string; // Hint text shown when editing arguments (after Tab selection)
  filePath: string;
  frontmatter?: string;  // Front Matter 全文（ポップアップ表示用）
  inputFormat?: InputFormatType;  // 入力フォーマット（'name' | 'path'）
  source?: string;  // Source tool identifier (e.g., 'claude-code') for filtering
  displayName?: string;  // Human-readable source name for display (e.g., 'Claude Code')
}

/**
 * Cached version of SlashCommandItem with pre-computed lowercase strings
 * for faster filtering without repeated toLowerCase() calls
 */
interface CachedSlashCommand extends SlashCommandItem {
  nameLower: string;
  descLower: string;
  displayNameLower: string | undefined;
  labelLower: string | undefined;
}

export class SlashCommandManager implements IInitializable {

  private suggestionsContainer: HTMLElement | null = null;
  private textarea: HTMLTextAreaElement | null = null;
  private mirrorDiv: HTMLDivElement | null = null;
  private commands: CachedSlashCommand[] = [];
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
  private previousSelectedElement: HTMLElement | null = null; // Cache for selected element

  // Frontmatter popup manager
  private frontmatterPopupManager: FrontmatterPopupManager;

  // Debounce timers for performance optimization
  private debounceTimer: number | null = null;
  private cursorCheckTimer: number | null = null;

  // Debounce delays
  private readonly DEBOUNCE_SHORT = 150; // For short queries (≤200 chars)
  private readonly DEBOUNCE_LONG = 300;  // For long queries (>200 chars)
  private readonly CURSOR_CHECK_DEBOUNCE = 50; // For cursor position checks

  // FZF scorer for improved matching
  private fzfScorer = new FzfScorer({
    caseSensitive: false,
    enableCamelCase: true,
    enableBoundaryBonus: true,
  });

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
    this.textarea.addEventListener('input', (e) => {
      // Ignore programmatic dispatchEvent calls to prevent redundant processing
      if (!e.isTrusted) return;

      this.checkForSlashCommand();
      // After checking for slash command, also check if we need to show argumentHint
      // This handles the case when user deletes characters and cursor returns to argument position
      if (!this.isActive) {
        this.scheduleCursorCheck();
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
        this.scheduleCursorCheck();
      }
    });

    // Check for argumentHint when clicking in textarea
    this.textarea.addEventListener('click', () => {
      this.scheduleCursorCheck();
    });

    // Check for argumentHint when textarea receives focus
    this.textarea.addEventListener('focus', () => {
      this.scheduleCursorCheck();
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
   * Load commands from main process and pre-compute lowercase strings for filtering
   */
  public async loadCommands(): Promise<void> {
    try {
      if (electronAPI?.slashCommands?.get) {
        const rawCommands = await electronAPI.slashCommands.get();
        // Cache lowercase strings for faster filtering
        this.commands = rawCommands.map(cmd => ({
          ...cmd,
          nameLower: cmd.name.toLowerCase(),
          descLower: cmd.description.toLowerCase(),
          displayNameLower: cmd.displayName?.toLowerCase(),
          labelLower: cmd.label?.toLowerCase(),
        }));
      }
    } catch (error) {
      console.error('Failed to load slash commands:', error);
      this.commands = [];
    }
  }

  /**
   * Schedule a debounced cursor position check to avoid redundant calls
   */
  private scheduleCursorCheck(): void {
    if (this.cursorCheckTimer !== null) {
      clearTimeout(this.cursorCheckTimer);
    }
    this.cursorCheckTimer = window.setTimeout(() => {
      this.checkForArgumentHintAtCursor();
      this.cursorCheckTimer = null;
    }, this.CURSOR_CHECK_DEBOUNCE);
  }

  /**
   * Check if user is typing a slash command at cursor position (with debouncing)
   */
  private checkForSlashCommand(): void {
    if (!this.textarea) return;

    // Clear existing debounce timer
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
    }

    // Determine debounce delay based on query length
    const queryLength = this.textarea.value.length;
    const debounceDelay = queryLength > 200 ? this.DEBOUNCE_LONG : this.DEBOUNCE_SHORT;

    this.debounceTimer = window.setTimeout(() => {
      this.performSlashCommandCheck();
      this.debounceTimer = null;
    }, debounceDelay);
  }

  /**
   * Actual slash command check logic (called after debounce)
   */
  private performSlashCommandCheck(): void {
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
   * Calculate match score for a command
   * Higher score = better match
   * Uses cached lowercase strings for better performance
   */
  private getMatchScore(cmd: CachedSlashCommand, lowerQuery: string): number {
    // 完全一致は最優先（既存動作維持）
    if (cmd.nameLower === lowerQuery) return 1000;

    // fzfスコアリング（名前）
    const nameResult = this.fzfScorer.score(cmd.name, lowerQuery);
    if (nameResult.matched) {
      // 名前マッチは2倍重要、最大900点（完全一致より下）
      return Math.min(900, nameResult.score * 2);
    }

    // fzfスコアリング（説明）
    if (cmd.description) {
      const descResult = this.fzfScorer.score(cmd.description, lowerQuery);
      if (descResult.matched) {
        // 説明マッチは最大400点
        return Math.min(400, descResult.score);
      }
    }

    // マッチしない場合
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

    // Filter commands using cached lowercase strings for better performance
    const lowerQuery = query.toLowerCase();
    this.filteredCommands = this.commands
      .filter(cmd =>
        cmd.nameLower.includes(lowerQuery) ||
        cmd.descLower.includes(lowerQuery) ||
        (cmd.displayNameLower && cmd.displayNameLower.includes(lowerQuery)) ||
        (cmd.labelLower && cmd.labelLower.includes(lowerQuery))
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
    // Note: filteredCommands contains CachedSlashCommand, but we treat as SlashCommandItem for compatibility
    this.filteredCommands.sort((a, b) => {
      const cmdA = a as CachedSlashCommand;
      const cmdB = b as CachedSlashCommand;

      const aMatchScore = this.getMatchScore(cmdA, lowerQuery);
      const bMatchScore = this.getMatchScore(cmdB, lowerQuery);

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
    // Reset cached selected element when re-rendering
    this.previousSelectedElement = null;

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
          labelBadge.dataset.color = cmd.color;
        }
        labelBadge.textContent = cmd.label;
        item.appendChild(labelBadge);
      } else if (cmd.displayName) {
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
    // Reset cached selected element when hiding
    this.previousSelectedElement = null;
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
   * Performance optimized: Uses cached element reference to avoid iterating all items
   */
  private updateSelection(): void {
    if (!this.suggestionsContainer) return;

    // Remove selection from previously selected element
    if (this.previousSelectedElement) {
      this.previousSelectedElement.classList.remove('selected');
    }

    // Get new selected element by index
    const items = this.suggestionsContainer.querySelectorAll('.slash-suggestion-item');
    const newSelectedElement = items[this.selectedIndex] as HTMLElement | undefined;

    if (newSelectedElement) {
      // Add selection to new element
      newSelectedElement.classList.add('selected');
      // Scroll into view if needed (use 'instant' to ensure scroll completes before popup positioning)
      newSelectedElement.scrollIntoView({ block: 'nearest', behavior: 'instant' });
      // Cache the newly selected element
      this.previousSelectedElement = newSelectedElement;
    }

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

  /**
   * Cleanup method to clear all pending timers
   * Should be called when the manager is being destroyed
   */
  public cleanup(): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.cursorCheckTimer !== null) {
      clearTimeout(this.cursorCheckTimer);
      this.cursorCheckTimer = null;
    }
  }
}
