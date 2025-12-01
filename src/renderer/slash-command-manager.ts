/**
 * Slash Command Manager for renderer process
 * Manages slash command suggestions and selection
 */

interface SlashCommandItem {
  name: string;
  description: string;
  argumentHint?: string; // Hint text shown when editing arguments (after Tab selection)
  filePath: string;
  frontmatter?: string;  // Front Matter 全文（ポップアップ表示用）
}

export class SlashCommandManager {
  private static readonly POPUP_HIDE_DELAY = 100; // ms delay before hiding popup

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

  // Frontmatter popup
  private frontmatterPopup: HTMLElement | null = null;
  private popupHideTimeout: ReturnType<typeof setTimeout> | null = null;
  private isPopupVisible: boolean = false;

  constructor(callbacks: {
    onCommandSelect: (command: string) => void;
    onCommandInsert?: (command: string) => void;
  }) {
    this.onCommandSelect = callbacks.onCommandSelect;
    this.onCommandInsert = callbacks.onCommandInsert || (() => {});
  }

  public initializeElements(): void {
    this.suggestionsContainer = document.getElementById('slashCommandSuggestions');
    this.textarea = document.getElementById('textInput') as HTMLTextAreaElement;

    // Create frontmatter popup element
    this.createFrontmatterPopup();
  }

  /**
   * Create the frontmatter popup element for slash command hover display
   */
  private createFrontmatterPopup(): void {
    if (this.frontmatterPopup) return;

    this.frontmatterPopup = document.createElement('div');
    this.frontmatterPopup.id = 'slashCommandFrontmatterPopup';
    this.frontmatterPopup.className = 'frontmatter-popup';
    this.frontmatterPopup.style.display = 'none';

    // Prevent popup from closing when hovering over it
    this.frontmatterPopup.addEventListener('mouseenter', () => {
      this.cancelPopupHide();
    });

    this.frontmatterPopup.addEventListener('mouseleave', () => {
      this.schedulePopupHide();
    });

    // Capture wheel events on document when popup is visible
    document.addEventListener('wheel', (e) => {
      if (this.isPopupVisible && this.frontmatterPopup) {
        // Prevent default scrolling behavior
        e.preventDefault();
        // Scroll the popup instead
        this.frontmatterPopup.scrollTop += e.deltaY;
      }
    }, { passive: false });

    // Append to main-content
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      mainContent.appendChild(this.frontmatterPopup);
    }
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
      });

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
      nameSpan.innerHTML = '/' + this.highlightMatch(cmd.name, query);
      item.appendChild(nameSpan);

      // Create description element with highlighting
      if (cmd.description) {
        const descSpan = document.createElement('span');
        descSpan.className = 'slash-command-description';
        descSpan.innerHTML = this.highlightMatch(cmd.description, query);
        item.appendChild(descSpan);
      }

      // Add info icon for frontmatter popup (only if frontmatter exists)
      if (cmd.frontmatter) {
        const infoIcon = document.createElement('span');
        infoIcon.className = 'frontmatter-info-icon';
        infoIcon.textContent = 'ⓘ';
        infoIcon.title = 'Show details';

        // Show popup on info icon hover
        infoIcon.addEventListener('mouseenter', () => {
          this.showFrontmatterPopup(cmd, item);
        });

        infoIcon.addEventListener('mouseleave', () => {
          this.schedulePopupHide();
        });

        item.appendChild(infoIcon);
      }

      fragment.appendChild(item);
    });

    this.suggestionsContainer.appendChild(fragment);
  }

  /**
   * Highlight matching text in suggestions
   */
  private highlightMatch(text: string, query: string): string {
    if (!query) return this.escapeHtml(text);

    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    return this.escapeHtml(text).replace(regex, '<span class="slash-highlight">$1</span>');
  }

  /**
   * Escape HTML to prevent XSS
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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
    this.hideFrontmatterPopup();
  }

  /**
   * Show frontmatter popup for a slash command
   */
  private showFrontmatterPopup(command: SlashCommandItem, targetElement: HTMLElement): void {
    if (!this.frontmatterPopup || !command.frontmatter || !this.suggestionsContainer) return;

    // Cancel any pending hide
    this.cancelPopupHide();

    // Set content (using textContent for XSS safety)
    this.frontmatterPopup.textContent = command.frontmatter;

    // Get the item and container rectangles for positioning
    const itemRect = targetElement.getBoundingClientRect();
    const containerRect = this.suggestionsContainer.getBoundingClientRect();

    // Position: starts at the left edge of the item with some offset
    // Width: slightly narrower than container
    const leftOffset = 20;
    const rightMargin = 10;
    const left = containerRect.left + leftOffset;
    const width = containerRect.width - leftOffset - rightMargin;

    // Gap between popup and item
    const verticalGap = 8;

    // Calculate available space below and above the item
    const spaceBelow = window.innerHeight - itemRect.bottom - 10;
    const spaceAbove = itemRect.top - 10;
    const minPopupHeight = 80;

    // Decide whether to show popup above or below
    const showAbove = spaceBelow < minPopupHeight && spaceAbove > spaceBelow;

    let top: number;
    let maxHeight: number;

    if (showAbove) {
      // Position above the item
      maxHeight = Math.max(minPopupHeight, Math.min(150, spaceAbove - verticalGap));
      top = itemRect.top - maxHeight - verticalGap;
    } else {
      // Position below the item
      top = itemRect.bottom + verticalGap;
      maxHeight = Math.max(minPopupHeight, Math.min(150, spaceBelow - verticalGap));
    }

    this.frontmatterPopup.style.left = `${left}px`;
    this.frontmatterPopup.style.top = `${top}px`;
    this.frontmatterPopup.style.width = `${width}px`;
    this.frontmatterPopup.style.maxHeight = `${maxHeight}px`;

    this.frontmatterPopup.style.display = 'block';
    this.isPopupVisible = true;
  }

  /**
   * Hide frontmatter popup
   */
  private hideFrontmatterPopup(): void {
    if (this.frontmatterPopup) {
      this.frontmatterPopup.style.display = 'none';
    }
    this.isPopupVisible = false;
  }

  /**
   * Schedule popup hide with delay
   */
  private schedulePopupHide(): void {
    this.cancelPopupHide();
    this.popupHideTimeout = setTimeout(() => {
      this.hideFrontmatterPopup();
    }, SlashCommandManager.POPUP_HIDE_DELAY);
  }

  /**
   * Cancel scheduled popup hide
   */
  private cancelPopupHide(): void {
    if (this.popupHideTimeout) {
      clearTimeout(this.popupHideTimeout);
      this.popupHideTimeout = null;
    }
  }

  /**
   * Handle keyboard navigation
   * Supports: ArrowDown/Ctrl+n/Ctrl+j (next), ArrowUp/Ctrl+p/Ctrl+k (previous), Enter/Tab (select), Escape (close)
   */
  private handleKeyDown(e: KeyboardEvent): void {
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
        this.selectCommand(this.selectedIndex, true); // Paste immediately
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

    const commandText = `/${command.name}`;

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
      <span class="slash-command-name">/${this.escapeHtml(command.name)}</span>
      ${hintText ? `<span class="slash-command-description">${this.escapeHtml(hintText)}</span>` : ''}
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
   * Invalidate command cache to force reload
   */
  public invalidateCache(): void {
    this.commands = [];
  }
}
