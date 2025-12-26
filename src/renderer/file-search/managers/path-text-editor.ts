/**
 * PathTextEditor - Text input path manipulation
 *
 * Responsibilities:
 * - Insert paths into textarea
 * - Update text with paths
 * - Remove @query text
 * - Handle backspace deletion of @paths
 */

import type { AtPathRange } from '../types';
import { formatLog } from '../index';

/**
 * Callbacks required by PathTextEditor
 */
export interface PathTextEditorCallbacks {
  // Text content
  getTextContent: () => string;
  setTextContent?: ((text: string) => void) | undefined;

  // Cursor management
  getCursorPosition?: (() => number) | undefined;
  setCursorPosition?: ((position: number) => void) | undefined;

  // Undo support (optional, supports undefined for exactOptionalPropertyTypes)
  replaceRangeWithUndo?: ((start: number, end: number, text: string) => void) | undefined;

  // Highlight management
  updateHighlightBackdrop?: (() => void) | undefined;

  // Path management
  addSelectedPath: (path: string) => void;
  removeSelectedPath: (path: string) => void;
  findAtPathAtCursor: (cursorPos: number, text: string) => AtPathRange | null;
  getAtPaths: () => AtPathRange[];
  getSelectedPaths: () => Set<string>;
}

/**
 * PathTextEditor - Handles text input path manipulation
 */
export class PathTextEditor {
  private callbacks: PathTextEditorCallbacks;

  constructor(callbacks: PathTextEditorCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Replace text range with insertion text, using replaceRangeWithUndo if available
   */
  private replaceTextRange(replaceStart: number, replaceEnd: number, insertionText: string): void {
    if (this.callbacks.replaceRangeWithUndo) {
      this.callbacks.replaceRangeWithUndo(replaceStart, replaceEnd, insertionText);
    } else if (this.callbacks.setTextContent) {
      // Fallback to direct text manipulation (no Undo support)
      const text = this.callbacks.getTextContent();
      const before = text.substring(0, replaceStart);
      const after = text.substring(replaceEnd);
      this.callbacks.setTextContent(before + insertionText + after);
    }
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
    if (!this.callbacks.getCursorPosition) return atStartPosition;

    // Replace the query part (after @) with path + space
    // atStartPosition points to @, so we keep @ and replace from atStartPosition + 1
    this.replaceTextRange(atStartPosition + 1, this.callbacks.getCursorPosition(), path + ' ');

    // Add the path to the set of selected paths (for highlighting)
    this.callbacks.addSelectedPath(path);

    // Update highlight backdrop (this will find all occurrences in the text)
    this.callbacks.updateHighlightBackdrop?.();

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
    if (!this.callbacks.getCursorPosition) return atStartPosition;

    // Replace from @ (atStartPosition) to cursorPos - this removes the @ as well
    this.replaceTextRange(atStartPosition, this.callbacks.getCursorPosition(), path + ' ');

    // Note: Don't add to selectedPaths for path format since there's no @ to highlight
    return -1;
  }

  /**
   * Update text input with the current path (keeps @ and updates the path after it)
   * @param path - The path to set
   * @param atStartPosition - Position of @ character
   */
  public updateTextInputWithPath(path: string, atStartPosition: number): void {
    if (atStartPosition < 0) return;
    if (!this.callbacks.setTextContent || !this.callbacks.getCursorPosition || !this.callbacks.setCursorPosition) return;

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
    if (!this.callbacks.setTextContent || !this.callbacks.getCursorPosition || !this.callbacks.setCursorPosition) return;

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

  /**
   * Handle backspace key for @path deletion
   * Deletes the entire @path when cursor is at the end
   * @param e - Keyboard event
   * @returns true if @path was deleted, false otherwise
   */
  public handleBackspaceForAtPath(e: KeyboardEvent): boolean {
    if (!this.callbacks.getCursorPosition || !this.callbacks.setCursorPosition) return false;

    const cursorPos = this.callbacks.getCursorPosition();
    const text = this.callbacks.getTextContent();
    const atPath = this.callbacks.findAtPathAtCursor(cursorPos, text);

    if (!atPath) {
      return false;
    }

    e.preventDefault();

    const deletedPathContent = atPath.path;

    // Save atPath properties before deletion - replaceRangeWithUndo triggers input event
    // which calls updateHighlightBackdrop() and rescanAtPaths(), modifying atPaths
    const savedStart = atPath.start;
    const savedEnd = atPath.end;

    // Delete the @path (and trailing space if present)
    let deleteEnd = savedEnd;
    if (text[deleteEnd] === ' ') {
      deleteEnd++;
    }

    // Use replaceRangeWithUndo if available for native Undo support
    // Note: execCommand('insertText', false, '') places cursor at the deletion point
    // which is exactly where we want it (savedStart), so no need to call setCursorPosition
    if (this.callbacks.replaceRangeWithUndo) {
      this.callbacks.replaceRangeWithUndo(savedStart, deleteEnd, '');
      // Explicitly restore cursor position after deletion
      // The input event fired by execCommand may trigger code that affects cursor position
      // (e.g., checkForFileSearch, updateHighlightBackdrop, updateCursorPositionHighlight)
      // Restoring here ensures cursor stays at the correct deletion point
      this.callbacks.setCursorPosition(savedStart);
    } else if (this.callbacks.setTextContent) {
      // Fallback to direct text manipulation (no Undo support) - need to set cursor manually
      const newText = text.substring(0, savedStart) + text.substring(deleteEnd);
      this.callbacks.setTextContent(newText);
      this.callbacks.setCursorPosition(savedStart);
    }

    // Update highlight backdrop (rescanAtPaths will recalculate all positions)
    this.callbacks.updateHighlightBackdrop?.();

    // Restore cursor position again after updateHighlightBackdrop
    // This ensures cursor stays at savedStart even if backdrop update affects it
    this.callbacks.setCursorPosition(savedStart);

    // After update, check if this path still exists in the text
    // If not, remove it from selectedPaths
    if (deletedPathContent && !this.callbacks.getAtPaths().some(p => p.path === deletedPathContent)) {
      this.callbacks.removeSelectedPath(deletedPathContent);
      console.debug('[PathTextEditor] Removed path from selectedPaths after deletion:', deletedPathContent);
    }

    console.debug('[PathTextEditor] deleted @path:', formatLog({
      deletedStart: savedStart,
      deletedEnd: deleteEnd,
      deletedPath: deletedPathContent || 'unknown',
      remainingPaths: this.callbacks.getAtPaths().length,
      selectedPathsCount: this.callbacks.getSelectedPaths().size
    }));

    return true;
  }
}
