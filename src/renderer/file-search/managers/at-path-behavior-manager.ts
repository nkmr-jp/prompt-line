/**
 * AtPathBehaviorManager - Handles @path behavior (backspace deletion, cursor detection)
 *
 * Extracted from FileSearchManager to improve modularity and reduce file size.
 * Responsibilities:
 * - Find @path at cursor position
 * - Handle backspace deletion of @path
 * - Build valid paths set from cached data
 */

import type { AtPathRange, DirectoryData } from '../types';
import { getRelativePath, formatLog } from '../index';

/**
 * Callbacks for AtPathBehaviorManager
 */
export interface AtPathBehaviorCallbacks {
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
  /** Get current @paths */
  getAtPaths: () => AtPathRange[];
  /** Get selected paths set */
  getSelectedPaths: () => Set<string>;
  /** Remove a path from selected paths */
  removeSelectedPath: (path: string) => void;
  /** Update highlight backdrop */
  updateHighlightBackdrop: () => void;
  /** Get cached directory data */
  getCachedDirectoryData: () => DirectoryData | null;
}

/**
 * AtPathBehaviorManager handles @path cursor detection and backspace deletion
 */
export class AtPathBehaviorManager {
  private callbacks: AtPathBehaviorCallbacks;

  constructor(callbacks: AtPathBehaviorCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Find @path at the current cursor position
   * @param cursorPos - Current cursor position
   * @param text - Current text content
   * @returns The AtPathRange at cursor or null
   */
  public findAtPathAtCursor(cursorPos: number, text: string): AtPathRange | null {
    const atPaths = this.callbacks.getAtPaths();

    for (const path of atPaths) {
      const charAtEnd = text[path.end];

      // Check if cursor is at path.end (right after the @path)
      if (cursorPos === path.end) {
        // Only treat as "at the end" if the character at path.end is:
        // - undefined (end of text), or
        // - a space (trailing space after @path)
        // If there's another character (like @), user is typing something new
        if (charAtEnd === undefined || charAtEnd === ' ') {
          return path;
        }
        // Don't return path if there's another character at path.end
        continue;
      }

      // Also check path.end + 1 if the character at path.end is a space
      // This allows deletion when cursor is after the trailing space
      if (cursorPos === path.end + 1 && charAtEnd === ' ') {
        return path;
      }
    }
    return null;
  }

  /**
   * Handle backspace key for @path deletion
   * Deletes the entire @path when cursor is at the end
   * @param e - Keyboard event
   * @returns true if @path was deleted, false otherwise
   */
  public handleBackspaceForAtPath(e: KeyboardEvent): boolean {
    const cursorPos = this.callbacks.getCursorPosition();
    const text = this.callbacks.getTextContent();
    const atPath = this.findAtPathAtCursor(cursorPos, text);

    if (!atPath) {
      return false;
    }

    e.preventDefault();

    const deletedPathContent = atPath.path;
    const savedStart = atPath.start;
    const savedEnd = atPath.end;

    // Calculate delete end position (including trailing space)
    const deleteEnd = this.calculateDeleteEnd(text, savedEnd);

    // Perform deletion with undo support
    this.performDeletion(savedStart, deleteEnd, text);

    // Update UI and clean up
    this.updateAfterDeletion(savedStart, deletedPathContent);

    return true;
  }

  /**
   * Calculate the end position for deletion (including trailing space)
   */
  private calculateDeleteEnd(text: string, savedEnd: number): number {
    return text[savedEnd] === ' ' ? savedEnd + 1 : savedEnd;
  }

  /**
   * Perform the deletion with undo support if available
   */
  private performDeletion(savedStart: number, deleteEnd: number, text: string): void {
    if (this.callbacks.replaceRangeWithUndo) {
      this.callbacks.replaceRangeWithUndo(savedStart, deleteEnd, '');
      this.callbacks.setCursorPosition(savedStart);
    } else {
      const newText = text.substring(0, savedStart) + text.substring(deleteEnd);
      this.callbacks.setTextContent(newText);
      this.callbacks.setCursorPosition(savedStart);
    }
  }

  /**
   * Update UI and clean up after deletion
   */
  private updateAfterDeletion(savedStart: number, deletedPathContent: string | undefined): void {
    this.callbacks.updateHighlightBackdrop();
    this.callbacks.setCursorPosition(savedStart);

    const atPaths = this.callbacks.getAtPaths();
    if (deletedPathContent && !atPaths.some(p => p.path === deletedPathContent)) {
      this.callbacks.removeSelectedPath(deletedPathContent);
      console.debug('[AtPathBehaviorManager] Removed path from selectedPaths:', deletedPathContent);
    }

    console.debug('[AtPathBehaviorManager] deleted @path:', formatLog({
      deletedStart: savedStart,
      deletedEnd: this.calculateDeleteEnd(this.callbacks.getTextContent(), savedStart),
      deletedPath: deletedPathContent || 'unknown',
      remainingPaths: atPaths.length,
      selectedPathsCount: this.callbacks.getSelectedPaths().size
    }));
  }

  /**
   * Build a set of valid paths from cached directory data
   * @returns Set of valid paths or null if no data
   */
  public buildValidPathsSet(): Set<string> | null {
    const cachedData = this.callbacks.getCachedDirectoryData();
    if (!cachedData?.files || cachedData.files.length === 0) {
      return null;
    }

    const baseDir = cachedData.directory;
    const validPaths = new Set<string>();

    for (const file of cachedData.files) {
      const relativePath = getRelativePath(file.path, baseDir);
      this.addFilePathVariants(validPaths, relativePath, file.isDirectory);
      this.addParentDirectories(validPaths, relativePath);
    }

    return validPaths;
  }

  /**
   * Add file path variants (with/without trailing slash for directories)
   */
  private addFilePathVariants(validPaths: Set<string>, relativePath: string, isDirectory: boolean): void {
    validPaths.add(relativePath);
    if (isDirectory) {
      if (!relativePath.endsWith('/')) {
        validPaths.add(relativePath + '/');
      } else {
        validPaths.add(relativePath.slice(0, -1));
      }
    }
  }

  /**
   * Add all parent directories from a path
   */
  private addParentDirectories(validPaths: Set<string>, relativePath: string): void {
    const pathParts = relativePath.split('/');
    let parentPath = '';
    for (let i = 0; i < pathParts.length - 1; i++) {
      parentPath += (i > 0 ? '/' : '') + pathParts[i];
      validPaths.add(parentPath);
      validPaths.add(parentPath + '/');
    }
  }
}
