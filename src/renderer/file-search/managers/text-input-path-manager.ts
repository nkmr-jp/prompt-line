/**
 * TextInputPathManager - Handles text input path insertion and manipulation
 *
 * Extracted from FileSearchManager to improve modularity and reduce file size.
 * Responsibilities:
 * - Insert file paths with @ prefix
 * - Insert file paths without @ prefix
 * - Update text input with path
 * - Remove @query text from textarea
 */

/**
 * Callbacks for TextInputPathManager
 */
export interface TextInputPathCallbacks {
  /** Get text content from textarea */
  getTextContent: () => string;
  /** Set text content to textarea */
  setTextContent: (text: string) => void;
  /** Get current cursor position */
  getCursorPosition: () => number;
  /** Set cursor position */
  setCursorPosition: (position: number) => void;
  /** Replace range with text (with undo support) */
  replaceRangeWithUndo?: ((start: number, end: number, text: string) => void) | undefined;
  /** Add path to selected paths for highlighting */
  addSelectedPath?: ((path: string) => void) | undefined;
  /** Update highlight backdrop */
  updateHighlightBackdrop?: (() => void) | undefined;
}

/**
 * TextInputPathManager handles all path insertion and text manipulation in textarea
 */
export class TextInputPathManager {
  private callbacks: TextInputPathCallbacks;

  constructor(callbacks: TextInputPathCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Insert file path, keeping the @ and replacing only the query part
   * Uses replaceRangeWithUndo for native Undo/Redo support
   * @param path - The path to insert
   * @param atStartPosition - Position of @ character
   * @returns The new atStartPosition (-1 after insertion)
   */
  public insertFilePath(path: string, atStartPosition: number): number {
    if (atStartPosition < 0) return atStartPosition;

    const cursorPos = this.callbacks.getCursorPosition();

    // The insertion text includes path + space for better UX
    const insertionText = path + ' ';

    // Replace the query part (after @) with the new path + space
    // atStartPosition points to @, so we keep @ and replace from atStartPosition + 1 to cursorPos
    const replaceStart = atStartPosition + 1;
    const replaceEnd = cursorPos;

    // Use replaceRangeWithUndo if available for native Undo support
    if (this.callbacks.replaceRangeWithUndo) {
      this.callbacks.replaceRangeWithUndo(replaceStart, replaceEnd, insertionText);
    } else {
      // Fallback to direct text manipulation (no Undo support)
      const text = this.callbacks.getTextContent();
      const before = text.substring(0, replaceStart);
      const after = text.substring(replaceEnd);
      const newText = before + insertionText + after;
      this.callbacks.setTextContent(newText);
    }

    // Add the path to the set of selected paths (for highlighting)
    this.callbacks.addSelectedPath?.(path);

    // Update highlight backdrop (this will find all occurrences in the text)
    this.callbacks.updateHighlightBackdrop?.();

    // Return -1 to indicate atStartPosition should be reset
    return -1;
  }

  /**
   * Insert file path without the @ symbol
   * Replaces both @ and query with just the path
   * Uses replaceRangeWithUndo for native Undo/Redo support
   * @param path - The path to insert
   * @param atStartPosition - Position of @ character
   * @returns The new atStartPosition (-1 after insertion)
   */
  public insertFilePathWithoutAt(path: string, atStartPosition: number): number {
    if (atStartPosition < 0) return atStartPosition;

    const cursorPos = this.callbacks.getCursorPosition();

    // The insertion text includes path + space for better UX
    const insertionText = path + ' ';

    // Replace from @ (atStartPosition) to cursorPos - this removes the @ as well
    const replaceStart = atStartPosition;
    const replaceEnd = cursorPos;

    // Use replaceRangeWithUndo if available for native Undo support
    if (this.callbacks.replaceRangeWithUndo) {
      this.callbacks.replaceRangeWithUndo(replaceStart, replaceEnd, insertionText);
    } else {
      // Fallback to direct text manipulation (no Undo support)
      const text = this.callbacks.getTextContent();
      const before = text.substring(0, replaceStart);
      const after = text.substring(replaceEnd);
      const newText = before + insertionText + after;
      this.callbacks.setTextContent(newText);
    }

    // Note: Don't add to selectedPaths for path format since there's no @ to highlight
    // Return -1 to indicate atStartPosition should be reset
    return -1;
  }

  /**
   * Update text input with the current path (keeps @ and updates the path after it)
   * @param path - The path to set
   * @param atStartPosition - Position of @ character
   */
  public updateTextInputWithPath(path: string, atStartPosition: number): void {
    if (atStartPosition < 0) return;

    const text = this.callbacks.getTextContent();
    const cursorPos = this.callbacks.getCursorPosition();

    // Replace text after @ with the new path
    const before = text.substring(0, atStartPosition + 1); // Keep @
    const after = text.substring(cursorPos);
    const newText = before + path + after;

    this.callbacks.setTextContent(newText);

    // Position cursor at end of path (after @path)
    const newCursorPos = atStartPosition + 1 + path.length;
    this.callbacks.setCursorPosition(newCursorPos);
  }

  /**
   * Remove the @query text from the textarea without inserting a file path
   * Used when opening a file with Ctrl+Enter
   * @param atStartPosition - Position of @ character
   */
  public removeAtQueryText(atStartPosition: number): void {
    if (atStartPosition === -1) return;

    const currentText = this.callbacks.getTextContent();
    const cursorPos = this.callbacks.getCursorPosition();

    // Calculate the end position of the @query (current cursor position)
    const endPosition = cursorPos;

    // Remove the @query text
    const before = currentText.slice(0, atStartPosition);
    const after = currentText.slice(endPosition);
    const newText = before + after;

    this.callbacks.setTextContent(newText);
    this.callbacks.setCursorPosition(atStartPosition);
  }
}
