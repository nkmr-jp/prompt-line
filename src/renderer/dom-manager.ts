export class DomManager {
  public textarea: HTMLTextAreaElement | null = null;
  public appNameEl: HTMLElement | null = null;
  public charCountEl: HTMLElement | null = null;
  public historyList: HTMLElement | null = null;
  public headerShortcutsEl: HTMLElement | null = null;
  public historyShortcutsEl: HTMLElement | null = null;
  public searchInput: HTMLInputElement | null = null;
  public hintTextEl: HTMLElement | null = null;
  public headerEl: HTMLElement | null = null;

  public initializeElements(): void {
    this.textarea = document.getElementById('textInput') as HTMLTextAreaElement;
    this.appNameEl = document.getElementById('appName');
    this.charCountEl = document.getElementById('charCount');
    this.historyList = document.getElementById('historyList');
    this.headerShortcutsEl = document.getElementById('headerShortcuts');
    this.historyShortcutsEl = document.getElementById('historyShortcuts');
    this.searchInput = document.getElementById('searchInput') as HTMLInputElement;
    this.hintTextEl = document.getElementById('hintText');
    this.headerEl = document.getElementById('header');

    if (!this.textarea || !this.appNameEl || !this.charCountEl || !this.historyList) {
      throw new Error('Required DOM elements not found');
    }
  }

  /**
   * Enable or disable draggable state on the header
   * When enabled, the header becomes a drag region for the window
   * @param enabled - Whether to enable draggable state
   */
  public setDraggable(enabled: boolean): void {
    if (!this.headerEl) return;

    if (enabled) {
      this.headerEl.classList.add('draggable');
    } else {
      this.headerEl.classList.remove('draggable');
    }
  }

  /**
   * Check if the header is currently in draggable state
   * @returns true if draggable
   */
  public isDraggable(): boolean {
    return this.headerEl?.classList.contains('draggable') ?? false;
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

  /**
   * Set textarea text content with undo support.
   * Uses Selection API and insertText command to enable browser's native Undo/Redo.
   * Falls back to direct value assignment if execCommand is not available.
   * @param text - The new text content to set
   */
  public setTextWithUndo(text: string): void {
    if (!this.textarea) {
      return;
    }

    // Focus textarea to ensure execCommand works
    this.textarea.focus();

    // Select all text
    this.textarea.setSelectionRange(0, this.textarea.value.length);

    // Use execCommand to replace selected text - this enables native Undo
    // Note: execCommand is deprecated but still widely supported and is the only
    // reliable way to enable native Undo for programmatic text changes
    const success = document.execCommand('insertText', false, text);

    if (!success) {
      // Fallback to direct value assignment if execCommand fails
      this.textarea.value = text;
    }

    this.updateCharCount();
  }

  /**
   * Replace a range of text with new text, with undo support.
   * Uses Selection API and insertText command to enable browser's native Undo/Redo.
   * @param start - Start position of the range to replace
   * @param end - End position of the range to replace
   * @param newText - The replacement text
   */
  public replaceRangeWithUndo(start: number, end: number, newText: string): void {
    if (!this.textarea) {
      return;
    }

    // Focus textarea to ensure execCommand works (only if not already focused)
    if (document.activeElement !== this.textarea) {
      this.textarea.focus();
    }

    // Select the range to replace
    this.textarea.setSelectionRange(start, end);

    // Use execCommand to replace selected text - this enables native Undo
    const success = document.execCommand('insertText', false, newText);

    if (!success) {
      // Fallback to manual replacement if execCommand fails
      const value = this.textarea.value;
      this.textarea.value = value.substring(0, start) + newText + value.substring(end);
      this.textarea.setSelectionRange(start + newText.length, start + newText.length);
    }

    this.updateCharCount();
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

    const lineBounds = this.findLineBounds(value, start, end);
    const lines = this.extractLinesToProcess(value, lineBounds);
    const processResult = this.processOutdentLines(lines, lineBounds.lineStart, start, end);

    this.applyOutdentChanges(value, lineBounds, processResult);
  }

  /**
   * Find line boundaries for the current selection
   */
  private findLineBounds(
    value: string,
    start: number,
    end: number
  ): { lineStart: number; lineEnd: number } {
    const beforeSelection = value.substring(0, start);
    const afterSelection = value.substring(end);

    const lineStart = beforeSelection.lastIndexOf('\n') + 1;
    const lineEndAfterSelection = afterSelection.indexOf('\n');
    const lineEnd = lineEndAfterSelection === -1 ? value.length : end + lineEndAfterSelection;

    return { lineStart, lineEnd };
  }

  /**
   * Extract lines to process from the text
   */
  private extractLinesToProcess(
    value: string,
    bounds: { lineStart: number; lineEnd: number }
  ): string[] {
    const linesToProcess = value.substring(bounds.lineStart, bounds.lineEnd);
    return linesToProcess.split('\n');
  }

  /**
   * Process lines to remove indentation and track character removal
   */
  private processOutdentLines(
    lines: string[],
    lineStartPosition: number,
    originalStart: number,
    originalEnd: number
  ): {
    processedLines: string[];
    charsRemovedBeforeStart: number;
    charsRemovedBeforeEnd: number;
  } {
    let totalCharsRemovedBeforeStart = 0;
    let totalCharsRemovedBeforeEnd = 0;
    let currentPos = lineStartPosition;

    const processedLines = lines.map((line) => {
      const { processedLine, charsRemoved } = this.removeLineIndentation(line);

      totalCharsRemovedBeforeStart += this.calculateCharsRemovedBeforePosition(
        currentPos,
        line.length,
        originalStart,
        charsRemoved
      );

      totalCharsRemovedBeforeEnd += this.calculateCharsRemovedBeforePosition(
        currentPos,
        line.length,
        originalEnd,
        charsRemoved
      );

      currentPos += line.length + 1;

      return processedLine;
    });

    return {
      processedLines,
      charsRemovedBeforeStart: totalCharsRemovedBeforeStart,
      charsRemovedBeforeEnd: totalCharsRemovedBeforeEnd
    };
  }

  /**
   * Remove indentation from a single line
   */
  private removeLineIndentation(line: string): { processedLine: string; charsRemoved: number } {
    if (line.startsWith('\t')) {
      return { processedLine: line.substring(1), charsRemoved: 1 };
    }

    const spaces = line.match(/^ {1,4}/);
    if (spaces) {
      return { processedLine: line.substring(spaces[0].length), charsRemoved: spaces[0].length };
    }

    return { processedLine: line, charsRemoved: 0 };
  }

  /**
   * Calculate how many characters were removed before a given position
   */
  private calculateCharsRemovedBeforePosition(
    currentPos: number,
    lineLength: number,
    targetPos: number,
    charsRemoved: number
  ): number {
    if (currentPos + lineLength <= targetPos) {
      return charsRemoved;
    }
    if (currentPos < targetPos && targetPos >= currentPos + charsRemoved) {
      return charsRemoved;
    }
    if (currentPos < targetPos && targetPos < currentPos + charsRemoved) {
      return targetPos - currentPos;
    }
    return 0;
  }

  /**
   * Apply outdent changes to textarea
   */
  private applyOutdentChanges(
    value: string,
    bounds: { lineStart: number; lineEnd: number },
    processResult: {
      processedLines: string[];
      charsRemovedBeforeStart: number;
      charsRemovedBeforeEnd: number;
    }
  ): void {
    if (!this.textarea) {
      return;
    }

    const newContent = processResult.processedLines.join('\n');
    const newValue =
      value.substring(0, bounds.lineStart) + newContent + value.substring(bounds.lineEnd);

    this.textarea.value = newValue;

    const start = this.textarea.selectionStart;
    const end = this.textarea.selectionEnd;
    const newStart = start - processResult.charsRemovedBeforeStart;
    const newEnd = end - processResult.charsRemovedBeforeEnd;

    this.textarea.setSelectionRange(newStart, newEnd);
    this.updateCharCount();
  }
}