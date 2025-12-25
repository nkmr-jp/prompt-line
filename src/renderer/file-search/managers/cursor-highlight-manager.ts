/**
 * CursorHighlightManager - Manages cursor position highlighting
 *
 * Responsibilities:
 * - Track cursor position in textarea
 * - Highlight absolute paths and URLs at cursor position
 * - Update hint text based on cursor position
 * - Coordinate with BackdropRenderer for visual updates
 */

import type { AtPathRange } from '../types';
import {
  findAtPathAtPosition,
  findUrlAtPosition,
  findSlashCommandAtPosition,
  findAbsolutePathAtPosition,
  findClickablePathAtPosition
} from '../text-finder';

export interface CursorHighlightCallbacks {
  getTextContent: () => string;
  getCursorPosition: () => number;
  updateHintText?: (text: string) => void;
  getDefaultHintText?: () => string;
  isFileSearchEnabled?: () => boolean;
  isCommandEnabledSync?: () => boolean;
  renderHighlightBackdrop: () => void;
}

/**
 * Manages cursor position highlighting for clickable paths
 */
export class CursorHighlightManager {
  private callbacks: CursorHighlightCallbacks;
  private cursorPositionPath: AtPathRange | null = null;

  constructor(callbacks: CursorHighlightCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Get the current cursor position path
   */
  public getCursorPositionPath(): AtPathRange | null {
    return this.cursorPositionPath;
  }

  /**
   * Update cursor position highlight (called when cursor moves)
   * Only highlights absolute file paths and URLs, not @paths (which already have their own highlight)
   * Also updates hint text to show Ctrl+Enter shortcut when on a clickable path or URL
   */
  public updateCursorPositionHighlight(): void {
    const text = this.callbacks.getTextContent();
    const cursorPos = this.callbacks.getCursorPosition();

    // First check if cursor is on an @path - still show hint but no extra highlight
    const atPath = findAtPathAtPosition(text, cursorPos);
    if (atPath) {
      // Show hint for @path too
      this.showFileOpenHint();
      if (this.cursorPositionPath) {
        this.cursorPositionPath = null;
        this.callbacks.renderHighlightBackdrop();
      }
      return;
    }

    // Check if cursor is on a URL
    const url = findUrlAtPosition(text, cursorPos);
    if (url) {
      // Show hint for URL
      this.showUrlOpenHint();
      const newRange: AtPathRange = { start: url.start, end: url.end };
      // Only update if position changed
      if (!this.cursorPositionPath ||
          this.cursorPositionPath.start !== newRange.start ||
          this.cursorPositionPath.end !== newRange.end) {
        this.cursorPositionPath = newRange;
        this.callbacks.renderHighlightBackdrop();
      }
      return;
    }

    // Check if cursor is on a slash command (only if command type is enabled)
    if (this.callbacks.isCommandEnabledSync?.()) {
      const slashCommand = findSlashCommandAtPosition(text, cursorPos);
      if (slashCommand) {
        // Show hint for slash command
        this.showSlashCommandOpenHint();
        const newRange: AtPathRange = { start: slashCommand.start, end: slashCommand.end };
        // Only update if position changed
        if (!this.cursorPositionPath ||
            this.cursorPositionPath.start !== newRange.start ||
            this.cursorPositionPath.end !== newRange.end) {
          this.cursorPositionPath = newRange;
          this.callbacks.renderHighlightBackdrop();
        }
        return;
      }
    }

    // Find absolute path at cursor position (paths starting with / or ~)
    const absolutePath = findAbsolutePathAtPosition(text, cursorPos);

    if (absolutePath) {
      // Show hint for absolute path
      this.showFileOpenHint();
      // Get the range for the absolute path
      const pathInfo = findClickablePathAtPosition(text, cursorPos);
      if (pathInfo && !pathInfo.path.startsWith('@')) {
        const newRange: AtPathRange = { start: pathInfo.start, end: pathInfo.end };
        // Only update if position changed
        if (!this.cursorPositionPath ||
            this.cursorPositionPath.start !== newRange.start ||
            this.cursorPositionPath.end !== newRange.end) {
          this.cursorPositionPath = newRange;
          this.callbacks.renderHighlightBackdrop();
        }
      }
    } else {
      // Restore default hint when not on a clickable path
      this.restoreDefaultHint();
      if (this.cursorPositionPath) {
        // Clear cursor highlight
        this.cursorPositionPath = null;
        this.callbacks.renderHighlightBackdrop();
      }
    }
  }

  /**
   * Clear cursor position highlight
   */
  public clear(): void {
    this.cursorPositionPath = null;
  }

  /**
   * Show hint for opening file with Ctrl+Enter
   */
  private showFileOpenHint(): void {
    // Skip hint if file search is disabled
    if (this.callbacks.isFileSearchEnabled && !this.callbacks.isFileSearchEnabled()) {
      return;
    }
    if (this.callbacks.updateHintText) {
      this.callbacks.updateHintText('Press Ctrl+Enter to open file in editor');
    }
  }

  /**
   * Show hint for opening URL with Ctrl+Enter
   */
  private showUrlOpenHint(): void {
    if (this.callbacks.updateHintText) {
      this.callbacks.updateHintText('Press Ctrl+Enter to open URL in browser');
    }
  }

  /**
   * Show hint for opening slash command with Ctrl+Enter
   */
  private showSlashCommandOpenHint(): void {
    if (this.callbacks.updateHintText) {
      this.callbacks.updateHintText('Press Ctrl+Enter to open command file');
    }
  }

  /**
   * Restore default hint text
   */
  private restoreDefaultHint(): void {
    if (this.callbacks.updateHintText && this.callbacks.getDefaultHintText) {
      const defaultHint = this.callbacks.getDefaultHintText();
      this.callbacks.updateHintText(defaultHint);
    }
  }
}
