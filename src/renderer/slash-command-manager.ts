/**
 * Slash Command Manager for renderer process
 * Manages slash command suggestions and selection
 */

import type { InputFormatType } from '../types';
import type { IInitializable } from './interfaces/initializable';
import { FrontmatterPopupManager } from './frontmatter-popup-manager';
import { highlightMatch } from './utils/highlight-utils';
import { escapeHtml } from './utils/html-utils';
import { handleError } from './utils/error-handler';
import { SUGGESTIONS } from '../constants';
import { electronAPI } from './services/electron-api';

interface SlashCommandItem {
  name: string;
  description: string;
  argumentHint?: string; // Hint text shown when editing arguments (after Tab selection)
  filePath: string;
  frontmatter?: string;  // Front Matter 全文（ポップアップ表示用）
  inputFormat?: InputFormatType;  // 入力フォーマット（'name' | 'path'）
}

export class SlashCommandManager implements IInitializable {

  private suggestionsContainer: HTMLElement | null = null;
  private textarea: HTMLTextAreaElement | null = null;
  private commands: SlashCommandItem[] = [];
  private filteredCommands: SlashCommandItem[] = [];
  private selectedIndex: number = 0;
  private isActive: boolean = false;
  private isEditingMode: boolean = false; // True when Tab selected a command and user is editing arguments
  private editingCommandName: string = ''; // The command name being edited
  private onCommandSelect: (command: string) => void;
  private onCommandInsert: (command: string) => void;
  private onBeforeOpenFile: (() => void) | undefined;
  private setDraggable: ((enabled: boolean) => void) | undefined;

  // Frontmatter popup manager
  private frontmatterPopupManager: FrontmatterPopupManager;

  // Cached maxSuggestions
  private maxSuggestionsCache: number | null = null;

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
   * Get maxSuggestions for commands (cached)
   */
  private async getMaxSuggestions(): Promise<number> {
    // Return cached value if available
    if (this.maxSuggestionsCache !== null) {
      return this.maxSuggestionsCache;
    }

    try {
      if (electronAPI?.mdSearch?.getMaxSuggestions) {
        const maxSuggestions = await electronAPI.mdSearch.getMaxSuggestions('command');
        this.maxSuggestionsCache = maxSuggestions;
        return maxSuggestions;
      }
    } catch (error) {
      handleError('SlashCommandManager.getMaxSuggestions', error);
    }

    return SUGGESTIONS.DEFAULT_MAX;
  }

  /**
   * Clear maxSuggestions cache (call when settings might have changed)
   */
  public clearMaxSuggestionsCache(): void {
    this.maxSuggestionsCache = null;
  }

  /**
   * Check if user is typing a slash command at the beginning of input
   */
  private checkForSlashCommand(): void {
    if (!this.textarea) return;

    const text = this.textarea.value;

    // Only show suggestions if text starts with /
    if (text.startsWith('/')) {
      const parts = text.slice(1).split(/\s/);
      const query = parts[0] || ''; // Get first word after /

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

      // Hide suggestions if there's a space after the command (user is typing arguments)
      if (parts.length > 1 || text.includes(' ')) {
        this.hideSuggestions();
        return;
      }

      this.showSuggestions(query);
    } else {
      this.hideSuggestions();
    }
  }

  /**
   * Show suggestions based on query
   */
  private async showSuggestions(query: string): Promise<void> {
    // Load commands if not loaded
    if (this.commands.length === 0) {
      await this.loadCommands();
    }

    // Get maxSuggestions setting
    const maxSuggestions = await this.getMaxSuggestions();

    // Filter and sort commands - prioritize: prefix match > contains match > description match
    const lowerQuery = query.toLowerCase();
    this.filteredCommands = this.commands
      .filter(cmd =>
        cmd.name.toLowerCase().includes(lowerQuery) ||
        cmd.description.toLowerCase().includes(lowerQuery)
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
      })
      .slice(0, maxSuggestions);

    if (this.filteredCommands.length === 0) {
      this.hideSuggestions();
      return;
    }

    this.isActive = true;
    this.selectedIndex = 0;
    this.renderSuggestions(query);
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
    if (!command) return;

    // Determine what to insert based on inputFormat setting
    // Default to 'name' for commands (backward compatible behavior)
    const inputFormat = command.inputFormat ?? 'name';
    const commandText = inputFormat === 'path' ? command.filePath : `/${command.name}`;

    if (shouldPaste) {
      // Enter: Paste immediately and hide suggestions
      this.hideSuggestions();

      if (this.textarea) {
        this.textarea.value = commandText;
        this.textarea.setSelectionRange(commandText.length, commandText.length);
        this.textarea.focus();
      }
      this.onCommandSelect(commandText);
    } else {
      // Tab: Insert with trailing space for editing arguments
      // Show only the selected command in suggestions
      this.showSelectedCommandOnly(command);

      const commandWithSpace = commandText + ' ';
      if (this.textarea) {
        this.textarea.value = commandWithSpace;
        this.textarea.setSelectionRange(commandWithSpace.length, commandWithSpace.length);
        this.textarea.focus();
      }
      this.onCommandInsert(commandWithSpace);
    }
  }

  /**
   * Show only the selected command in suggestions (for Tab selection)
   */
  private showSelectedCommandOnly(command: SlashCommandItem): void {
    if (!this.suggestionsContainer) return;

    this.suggestionsContainer.innerHTML = '';
    this.suggestionsContainer.style.display = 'block';
    this.suggestionsContainer.classList.remove('hover-enabled');

    const item = document.createElement('div');
    item.className = 'slash-suggestion-item selected';
    item.dataset.index = '0';

    // Use argumentHint if available, otherwise use description
    const hintText = command.argumentHint || command.description;

    item.innerHTML = `
      <span class="slash-command-name">/${escapeHtml(command.name)}</span>
      ${hintText ? `<span class="slash-command-description">${escapeHtml(hintText)}</span>` : ''}
    `;

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
