/**
 * CursorHighlightManager - Manages cursor position and hover state highlighting
 *
 * Consolidated from CursorHighlightManager and HoverStateManager.
 *
 * Responsibilities:
 * - Track cursor position in textarea
 * - Highlight absolute paths and URLs at cursor position
 * - Update hint text based on cursor position
 * - Track Cmd key state for hover interactions
 * - Track mouse position for hover detection
 * - Manage hovered path state for Cmd+click
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
  // Hover state callbacks (consolidated from HoverStateManager)
  findClickableRangeAtPosition?: (charPos: number) => AtPathRange | null;
  getCharPositionFromCoordinates?: (clientX: number, clientY: number) => number | null;
  renderFilePathHighlight?: () => void;
  clearFilePathHighlight?: () => void;
}

/**
 * Manages cursor position highlighting and Cmd+hover state for clickable paths
 */
export class CursorHighlightManager {
  private callbacks: CursorHighlightCallbacks;
  private cursorPositionPath: AtPathRange | null = null;

  // Cmd+hover state (consolidated from HoverStateManager)
  private isCmdHoverActive: boolean = false;
  private hoveredAtPath: AtPathRange | null = null;
  private lastMouseX: number = 0;
  private lastMouseY: number = 0;

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

  // ============================================
  // Hover State Management (from HoverStateManager)
  // ============================================

  /**
   * Get the currently hovered path
   */
  public getHoveredPath(): AtPathRange | null {
    return this.hoveredAtPath;
  }

  /**
   * Handle mouse move for Cmd+hover link style
   */
  public onMouseMove(e: MouseEvent): void {
    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;

    if (!e.metaKey) {
      if (this.hoveredAtPath) {
        this.clearHover();
      }
      return;
    }

    this.isCmdHoverActive = true;
    this.checkAndHighlightAtPath(e.clientX, e.clientY);
  }

  /**
   * Handle Cmd key down
   */
  public onCmdKeyDown(): void {
    if (!this.isCmdHoverActive) {
      this.isCmdHoverActive = true;
      // Re-check current mouse position for @path
      this.updateHoverStateAtLastPosition();
    }
  }

  /**
   * Handle Cmd key up
   */
  public onCmdKeyUp(): void {
    if (this.isCmdHoverActive) {
      this.isCmdHoverActive = false;
      this.clearHover();
    }
  }

  /**
   * Clear hover state
   */
  public clearHover(): void {
    this.hoveredAtPath = null;
    this.callbacks.clearFilePathHighlight?.();
  }

  /**
   * Check if mouse is over a clickable path and highlight it
   */
  private checkAndHighlightAtPath(clientX: number, clientY: number): void {
    if (!this.callbacks.getCharPositionFromCoordinates || !this.callbacks.findClickableRangeAtPosition) {
      return;
    }

    const charPos = this.callbacks.getCharPositionFromCoordinates(clientX, clientY);

    if (charPos === null) {
      this.clearHover();
      return;
    }

    // Find any clickable range at this position
    const clickableRange = this.callbacks.findClickableRangeAtPosition(charPos);

    if (clickableRange) {
      // Update hover state if changed
      if (!this.hoveredAtPath ||
          this.hoveredAtPath.start !== clickableRange.start ||
          this.hoveredAtPath.end !== clickableRange.end) {
        this.hoveredAtPath = clickableRange;
        this.callbacks.renderFilePathHighlight?.();
      }
    } else {
      this.clearHover();
    }
  }

  /**
   * Update hover state when Cmd key is pressed
   */
  private updateHoverStateAtLastPosition(): void {
    if (this.lastMouseX && this.lastMouseY) {
      this.checkAndHighlightAtPath(this.lastMouseX, this.lastMouseY);
    }
  }
}
