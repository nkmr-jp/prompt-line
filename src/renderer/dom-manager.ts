export class DomManager {
  public textarea: HTMLTextAreaElement | null = null;
  public appNameEl: HTMLElement | null = null;
  public charCountEl: HTMLElement | null = null;
  public historyList: HTMLElement | null = null;
  public headerShortcutsEl: HTMLElement | null = null;
  public historyShortcutsEl: HTMLElement | null = null;
  public searchInput: HTMLInputElement | null = null;
  public hintTextEl: HTMLElement | null = null;

  public initializeElements(): void {
    this.textarea = document.getElementById('textInput') as HTMLTextAreaElement;
    this.appNameEl = document.getElementById('appName');
    this.charCountEl = document.getElementById('charCount');
    this.historyList = document.getElementById('historyList');
    this.headerShortcutsEl = document.getElementById('headerShortcuts');
    this.historyShortcutsEl = document.getElementById('historyShortcuts');
    this.searchInput = document.getElementById('searchInput') as HTMLInputElement;
    this.hintTextEl = document.getElementById('hintText');

    if (!this.textarea || !this.appNameEl || !this.charCountEl || !this.historyList) {
      throw new Error('Required DOM elements not found');
    }
  }

  public updateCharCount(): void {
    if (!this.textarea || !this.charCountEl) return;
    
    const count = this.textarea.value.length;
    this.charCountEl.textContent = `${count} char${count !== 1 ? 's' : ''}`;
  }

  public updateAppName(name: string): void {
    if (this.appNameEl) {
      this.appNameEl.textContent = name;
    }
  }

  public updateHintText(text: string): void {
    if (this.hintTextEl) {
      this.hintTextEl.textContent = text;
    }
  }

  public showError(message: string, duration: number = 2000): void {
    if (!this.appNameEl) return;
    
    const originalText = this.appNameEl.textContent;
    this.appNameEl.textContent = `Error: ${message}`;
    this.appNameEl.classList.add('app-name-error');

    setTimeout(() => {
      if (this.appNameEl) {
        this.appNameEl.textContent = originalText;
        this.appNameEl.classList.remove('app-name-error');
      }
    }, duration);
  }

  public insertTextAtCursor(text: string): void {
    if (!this.textarea) {
      return;
    }

    const start = this.textarea.selectionStart;
    const end = this.textarea.selectionEnd;
    const value = this.textarea.value;

    this.textarea.value = value.substring(0, start) + text + value.substring(end);
    this.textarea.selectionStart = this.textarea.selectionEnd = start + text.length;

    this.updateCharCount();
  }

  public clearText(): void {
    if (this.textarea) {
      this.textarea.value = '';
      this.updateCharCount();
    }
  }

  public setText(text: string): void {
    if (this.textarea) {
      this.textarea.value = text;
      this.updateCharCount();
    }
  }

  public getCurrentText(): string {
    return this.textarea?.value || '';
  }

  public focusTextarea(): void {
    this.textarea?.focus();
  }

  public selectAll(): void {
    this.textarea?.select();
  }

  public setCursorPosition(position: number): void {
    if (this.textarea) {
      this.textarea.setSelectionRange(position, position);
    }
  }

  /**
   * Get the current cursor position in the textarea
   * @returns The cursor position (selection start)
   */
  public getCursorPosition(): number {
    if (!this.textarea) {
      return 0;
    }
    return this.textarea.selectionStart;
  }

  /**
   * Remove indentation (tab or spaces) from the beginning of lines at cursor or selection
   * - Single line: Remove tab or up to 4 spaces from the beginning of the current line
   * - Multiple lines: Remove tab or up to 4 spaces from all selected lines
   */
  public outdentAtCursor(): void {
    if (!this.textarea) {
      return;
    }

    const value = this.textarea.value;
    const start = this.textarea.selectionStart;
    const end = this.textarea.selectionEnd;

    // Get the lines that are affected by the selection
    const beforeSelection = value.substring(0, start);
    const afterSelection = value.substring(end);

    // Find line start positions
    const lineStartBeforeSelection = beforeSelection.lastIndexOf('\n') + 1;
    const lineEndAfterSelection = afterSelection.indexOf('\n');
    const lineEnd = lineEndAfterSelection === -1 ? value.length : end + lineEndAfterSelection;

    // Extract the lines to process
    const linesToProcess = value.substring(lineStartBeforeSelection, lineEnd);
    const lines = linesToProcess.split('\n');

    // Process each line to remove leading indentation and track removal per line
    let totalCharsRemovedBeforeStart = 0;
    let totalCharsRemovedBeforeEnd = 0;
    let currentPos = lineStartBeforeSelection;

    const processedLines = lines.map((line) => {
      let charsRemoved = 0;
      let processedLine = line;

      // Try to remove a tab first
      if (line.startsWith('\t')) {
        processedLine = line.substring(1);
        charsRemoved = 1;
      } else {
        // Otherwise, remove up to 4 leading spaces
        const spaces = line.match(/^ {1,4}/);
        if (spaces) {
          processedLine = line.substring(spaces[0].length);
          charsRemoved = spaces[0].length;
        }
      }

      // Track how many chars were removed before the original start position
      if (currentPos + line.length <= start) {
        // This entire line is before the start position
        totalCharsRemovedBeforeStart += charsRemoved;
      } else if (currentPos < start && start >= currentPos + charsRemoved) {
        // Start position is on this line, after the removed characters
        totalCharsRemovedBeforeStart += charsRemoved;
      } else if (currentPos < start && start < currentPos + charsRemoved) {
        // Start position is within the removed characters - adjust to line start
        totalCharsRemovedBeforeStart += start - currentPos;
      }

      // Track how many chars were removed before the original end position
      if (currentPos + line.length <= end) {
        // This entire line is before the end position
        totalCharsRemovedBeforeEnd += charsRemoved;
      } else if (currentPos < end && end >= currentPos + charsRemoved) {
        // End position is on this line, after the removed characters
        totalCharsRemovedBeforeEnd += charsRemoved;
      } else if (currentPos < end && end < currentPos + charsRemoved) {
        // End position is within the removed characters - adjust to line start
        totalCharsRemovedBeforeEnd += end - currentPos;
      }

      // Move position forward (line length + newline)
      currentPos += line.length + 1;

      return processedLine;
    });

    // Build the new textarea value
    const newContent = processedLines.join('\n');
    const newValue = value.substring(0, lineStartBeforeSelection) + newContent + value.substring(lineEnd);

    // Update textarea
    this.textarea.value = newValue;

    // Adjust selection to maintain relative position
    const newStart = start - totalCharsRemovedBeforeStart;
    const newEnd = end - totalCharsRemovedBeforeEnd;

    this.textarea.setSelectionRange(newStart, newEnd);
    this.updateCharCount();
  }
}