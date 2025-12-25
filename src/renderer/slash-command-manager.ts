/**
 * Slash Command Manager for renderer process
 * Manages slash command suggestions and selection
 */

import { FrontmatterPopupManager } from './frontmatter-popup-manager';
import {
  type SlashCommandItem,
  type KeyboardNavigationHandlers,
  filterAndSortCommands,
  getCommandText,
  createSuggestionItemElement,
  addCommandName,
  addCommandDescription,
  createFrontmatterIcon,
  handleKeyboardNavigation,
  updateVisualSelection,
  parseSlashCommand,
  renderSuggestionsToContainer,
  createSelectedCommandDisplay
} from './slash-command-helpers';

export class SlashCommandManager {
  private static readonly DEFAULT_MAX_SUGGESTIONS = 20; // Default max suggestions

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

  public initializeElements(): void {
    this.suggestionsContainer = document.getElementById('slashCommandSuggestions');
    this.textarea = document.getElementById('textInput') as HTMLTextAreaElement;

    // Create frontmatter popup element
    this.frontmatterPopupManager.createPopup();
  }

  public setupEventListeners(): void {
    if (!this.textarea) return;

    this.textarea.addEventListener('input', () => this.checkForSlashCommand());
    this.textarea.addEventListener('keydown', (e) => this.handleTextareaKeydown(e));
    this.textarea.addEventListener('blur', () => setTimeout(() => this.hideSuggestions(), 200));

    if (this.suggestionsContainer) {
      this.suggestionsContainer.addEventListener('click', (e) => this.handleSuggestionClick(e));
      this.suggestionsContainer.addEventListener('mousemove', () =>
        this.suggestionsContainer?.classList.add('hover-enabled')
      );
    }
  }

  private handleTextareaKeydown(e: KeyboardEvent): void {
    if (this.isActive) {
      this.handleKeyDown(e);
    } else if (this.isEditingMode && e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      this.openCommandFile(this.selectedIndex);
    }
  }

  private handleSuggestionClick(e: Event): void {
    const target = e.target as HTMLElement;
    const suggestionItem = target.closest('.slash-suggestion-item') as HTMLElement;
    if (suggestionItem) {
      const index = parseInt(suggestionItem.dataset.index || '0', 10);
      this.selectCommand(index);
    }
  }

  /**
   * Load commands from main process
   */
  public async loadCommands(): Promise<void> {
    try {
      const electronAPI = (window as any).electronAPI;
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
      const electronAPI = (window as any).electronAPI;
      if (electronAPI?.mdSearch?.getMaxSuggestions) {
        const maxSuggestions = await electronAPI.mdSearch.getMaxSuggestions('command');
        this.maxSuggestionsCache = maxSuggestions;
        return maxSuggestions;
      }
    } catch (error) {
      console.error('[SlashCommandManager] Failed to get maxSuggestions:', error);
    }

    return SlashCommandManager.DEFAULT_MAX_SUGGESTIONS;
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

    const parsed = parseSlashCommand(this.textarea.value);

    if (!parsed.hasSlash) {
      this.hideSuggestions();
      return;
    }

    // If in editing mode, check if command name still matches
    if (this.isEditingMode) {
      if (parsed.query !== this.editingCommandName) {
        this.isEditingMode = false;
        this.editingCommandName = '';
      } else {
        return;
      }
    }

    // Hide suggestions if user is typing arguments
    if (parsed.hasArguments) {
      this.hideSuggestions();
      return;
    }

    this.showSuggestions(parsed.query);
  }

  /**
   * Show suggestions based on query
   */
  private async showSuggestions(query: string): Promise<void> {
    await this.ensureCommandsLoaded();

    const maxSuggestions = await this.getMaxSuggestions();
    this.filteredCommands = filterAndSortCommands(this.commands, query, maxSuggestions);

    if (this.filteredCommands.length === 0) {
      this.hideSuggestions();
      return;
    }

    this.isActive = true;
    this.selectedIndex = 0;
    this.renderSuggestions(query);
  }

  /**
   * Ensure commands are loaded
   */
  private async ensureCommandsLoaded(): Promise<void> {
    if (this.commands.length === 0) {
      await this.loadCommands();
    }
  }

  /**
   * Render suggestions to the UI
   */
  private renderSuggestions(query: string): void {
    if (!this.suggestionsContainer) return;

    renderSuggestionsToContainer(
      this.suggestionsContainer,
      this.filteredCommands,
      this.selectedIndex,
      query,
      (cmd, index, q) => this.createSuggestionItem(cmd, index, q)
    );
  }

  /**
   * Create a single suggestion item element
   */
  private createSuggestionItem(cmd: SlashCommandItem, index: number, query: string): HTMLElement {
    const item = createSuggestionItemElement(index, index === this.selectedIndex);
    addCommandName(item, cmd, query);
    addCommandDescription(item, cmd, query);
    this.addFrontmatterIconWithHandlers(item, cmd);
    return item;
  }

  private addFrontmatterIconWithHandlers(item: HTMLElement, cmd: SlashCommandItem): void {
    if (!cmd.frontmatter) return;

    const infoIcon = createFrontmatterIcon();

    infoIcon.addEventListener('mouseenter', () => {
      this.frontmatterPopupManager.show(cmd, infoIcon);
    });

    infoIcon.addEventListener('mouseleave', () => {
      this.frontmatterPopupManager.scheduleHide();
    });

    item.appendChild(infoIcon);
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
    const handlers: KeyboardNavigationHandlers = {
      onMoveDown: () => this.moveSelectionDown(),
      onMoveUp: () => this.moveSelectionUp(),
      onSelect: (ctrlPressed) => {
        if (ctrlPressed) {
          this.openCommandFile(this.selectedIndex);
        } else {
          this.selectCommand(this.selectedIndex, true);
        }
      },
      onSelectForEditing: () => this.selectCommand(this.selectedIndex, false),
      onClose: () => this.hideSuggestions(),
      onToggleTooltip: () => this.frontmatterPopupManager.toggleAutoShow()
    };

    handleKeyboardNavigation(e, handlers);
  }

  private moveSelectionDown(): void {
    this.selectedIndex = Math.min(this.selectedIndex + 1, this.filteredCommands.length - 1);
    this.updateSelection();
  }

  private moveSelectionUp(): void {
    this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
    this.updateSelection();
  }

  /**
   * Update visual selection
   */
  private updateSelection(): void {
    if (!this.suggestionsContainer) return;

    updateVisualSelection(
      this.suggestionsContainer,
      this.selectedIndex,
      () => this.frontmatterPopupManager.showForSelectedItem()
    );
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

    const commandText = getCommandText(command);

    if (shouldPaste) {
      this.hideSuggestions();
      this.setTextareaValue(commandText);
      this.onCommandSelect(commandText);
    } else {
      this.showSelectedCommandOnly(command);
      const commandWithSpace = commandText + ' ';
      this.setTextareaValue(commandWithSpace);
      this.onCommandInsert(commandWithSpace);
    }
  }

  private setTextareaValue(text: string): void {
    if (this.textarea) {
      this.textarea.value = text;
      this.textarea.setSelectionRange(text.length, text.length);
      this.textarea.focus();
    }
  }

  /**
   * Show only the selected command in suggestions (for Tab selection)
   */
  private showSelectedCommandOnly(command: SlashCommandItem): void {
    if (!this.suggestionsContainer) return;

    createSelectedCommandDisplay(this.suggestionsContainer, command);

    // Keep active state but update filtered commands to just this one
    this.filteredCommands = [command];
    this.selectedIndex = 0;
    this.isActive = false;
    this.isEditingMode = true;
    this.editingCommandName = command.name;
  }

  /**
   * Check if suggestions are currently active
   */
  public isActiveMode(): boolean {
    return this.isActive;
  }

  /**
   * Open the command file in editor without inserting command text
   * Similar to FileSearchManager behavior - window stays open and becomes draggable
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
      const electronAPI = (window as any).electronAPI;
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
