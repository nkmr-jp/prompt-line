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

    if (this.tryHandleAtPath(text, cursorPos)) return;
    if (this.tryHandleUrl(text, cursorPos)) return;
    if (this.tryHandleSlashCommand(text, cursorPos)) return;
    this.handleAbsolutePathOrNone(text, cursorPos);
  }

  /**
   * Try to handle @path at cursor position
   */
  private tryHandleAtPath(text: string, cursorPos: number): boolean {
    const atPath = findAtPathAtPosition(text, cursorPos);
    if (!atPath) return false;

    this.handleAtPathHighlight();
    return true;
  }

  /**
   * Try to handle URL at cursor position
   */
  private tryHandleUrl(text: string, cursorPos: number): boolean {
    const url = findUrlAtPosition(text, cursorPos);
    if (!url) return false;

    this.handleUrlHighlight(url);
    return true;
  }

  /**
   * Try to handle slash command at cursor position
   */
  private tryHandleSlashCommand(text: string, cursorPos: number): boolean {
    if (!this.callbacks.isCommandEnabledSync?.()) return false;

    const slashCommand = findSlashCommandAtPosition(text, cursorPos);
    if (!slashCommand) return false;

    this.handleSlashCommandHighlight(slashCommand);
    return true;
  }

  /**
   * Handle absolute path or no path at cursor position
   */
  private handleAbsolutePathOrNone(text: string, cursorPos: number): void {
    const absolutePath = findAbsolutePathAtPosition(text, cursorPos);
    if (absolutePath) {
      this.handleAbsolutePathHighlight(text, cursorPos);
    } else {
      this.handleNoPathHighlight();
    }
  }

  /**
   * Handle @path highlight (show hint but no extra highlight)
   */
  private handleAtPathHighlight(): void {
    this.showFileOpenHint();
    if (this.cursorPositionPath) {
      this.cursorPositionPath = null;
      this.callbacks.renderHighlightBackdrop();
    }
  }

  /**
   * Handle URL highlight
   */
  private handleUrlHighlight(url: { start: number; end: number }): void {
    this.showUrlOpenHint();
    this.updateHighlightRange({ start: url.start, end: url.end });
  }

  /**
   * Handle slash command highlight
   */
  private handleSlashCommandHighlight(slashCommand: { start: number; end: number }): void {
    this.showSlashCommandOpenHint();
    this.updateHighlightRange({ start: slashCommand.start, end: slashCommand.end });
  }

  /**
   * Handle absolute path highlight
   */
  private handleAbsolutePathHighlight(text: string, cursorPos: number): void {
    this.showFileOpenHint();
    const pathInfo = findClickablePathAtPosition(text, cursorPos);
    if (pathInfo && !pathInfo.path.startsWith('@')) {
      this.updateHighlightRange({ start: pathInfo.start, end: pathInfo.end });
    }
  }

  /**
   * Handle case when no path is at cursor position
   */
  private handleNoPathHighlight(): void {
    this.restoreDefaultHint();
    if (this.cursorPositionPath) {
      this.cursorPositionPath = null;
      this.callbacks.renderHighlightBackdrop();
    }
  }

  /**
   * Update highlight range if position changed
   */
  private updateHighlightRange(newRange: AtPathRange): void {
    if (!this.cursorPositionPath ||
        this.cursorPositionPath.start !== newRange.start ||
        this.cursorPositionPath.end !== newRange.end) {
      this.cursorPositionPath = newRange;
      this.callbacks.renderHighlightBackdrop();
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
