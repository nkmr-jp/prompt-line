/**
 * HighlightManager - Manages @path highlighting and Cmd+click interactions
 *
 * Consolidated from:
 * - HighlightManager: Main orchestration
 * - CursorHighlightManager: Cursor position and hover state highlighting
 * - BackdropRenderer: Highlight backdrop rendering
 *
 * Responsibilities:
 * - @path highlighting in textarea using backdrop layer
 * - Cmd+hover link style for @paths, URLs, slash commands, and absolute paths
 * - Ctrl+Enter hint text when cursor is on a clickable path
 * - Cursor position highlighting for absolute paths and URLs
 * - Scroll synchronization between textarea and backdrop
 * - @path tracking and validation against file system
 */
// @ts-nocheck


import type { AtPathRange } from '../types';
import type { FileInfo } from '../../../types';
import {
  findAtPathAtPosition,
  findUrlAtPosition,
  findSlashCommandAtPosition,
  findAbsolutePathAtPosition,
  findClickablePathAtPosition
} from '../text-finder';
import { PathManager } from './path-manager';

export interface HighlightManagerCallbacks {
  getTextContent: () => string;
  getCursorPosition: () => number;
  updateHintText?: (text: string) => void;
  getDefaultHintText?: () => string;
  isFileSearchEnabled?: () => boolean;
  isCommandEnabledSync?: () => boolean;
  checkFileExists?: (path: string) => Promise<boolean>;
}

export interface DirectoryDataForHighlight {
  directory: string;
  files: FileInfo[];
}

export class HighlightManager {
  private textInput: HTMLTextAreaElement;
  private highlightBackdrop: HTMLDivElement;
  private callbacks: HighlightManagerCallbacks;

  // PathManager is injected from parent (FileSearchManager)
  private pathManager: PathManager;

  // Cursor highlight state (from CursorHighlightManager)
  private cursorPositionPath: AtPathRange | null = null;

  // Cmd+hover state (from CursorHighlightManager)
  private isCmdHoverActive: boolean = false;
  private hoveredAtPath: AtPathRange | null = null;
  private lastMouseX: number = 0;
  private lastMouseY: number = 0;

  constructor(
    textInput: HTMLTextAreaElement,
    highlightBackdrop: HTMLDivElement,
    callbacks: HighlightManagerCallbacks,
    pathManager: PathManager
  ) {
    this.textInput = textInput;
    this.highlightBackdrop = highlightBackdrop;
    this.callbacks = callbacks;
    this.pathManager = pathManager;

    // Set textInput for coordinate calculations
    this.pathManager.setTextInput(textInput);
  }

  // ============================================================
  // Public API - Highlight Updates
  // ============================================================

  /**
   * Update the highlight backdrop to show @path highlights
   */
  public updateHighlightBackdrop(): void {
    if (!this.highlightBackdrop || !this.textInput) return;

    const text = this.textInput.value;

    // Re-scan for @paths in the text (in case user edited)
    this.pathManager.rescanAtPaths(text);

    this.renderBackdrop();
  }

  /**
   * Render highlight backdrop with cursor position highlight
   * @paths get their own highlight, absolute paths get cursor highlight
   */
  public renderHighlightBackdropWithCursor(): void {
    if (!this.highlightBackdrop || !this.textInput) return;

    const text = this.textInput.value;

    // Re-scan for @paths
    this.pathManager.rescanAtPaths(text);

    this.renderBackdropWithCursor();
  }

  /**
   * Render file path highlight (link style) while preserving @path highlights
   */
  public renderFilePathHighlight(): void {
    if (!this.highlightBackdrop || !this.textInput) return;

    const text = this.textInput.value;

    // Re-scan for @paths
    this.pathManager.rescanAtPaths(text);

    this.renderBackdropWithHover();
  }

  /**
   * Clear file path highlight (link style) while preserving @path highlights
   */
  public clearFilePathHighlight(): void {
    this.clearHover();
  }

  /**
   * Update cursor position highlight (called when cursor moves)
   */
  public updateCursorPositionHighlight(): void {
    if (!this.textInput) return;

    const text = this.callbacks.getTextContent();
    const cursorPos = this.callbacks.getCursorPosition();

    // First check if cursor is on an @path - still show hint but no extra highlight
    const atPath = findAtPathAtPosition(text, cursorPos);
    if (atPath) {
      this.showFileOpenHint();
      if (this.cursorPositionPath) {
        this.cursorPositionPath = null;
        this.renderHighlightBackdropWithCursor();
      }
      return;
    }

    // Check if cursor is on a URL
    const url = findUrlAtPosition(text, cursorPos);
    if (url) {
      this.showUrlOpenHint();
      const newRange: AtPathRange = { start: url.start, end: url.end };
      if (!this.cursorPositionPath ||
          this.cursorPositionPath.start !== newRange.start ||
          this.cursorPositionPath.end !== newRange.end) {
        this.cursorPositionPath = newRange;
        this.renderHighlightBackdropWithCursor();
      }
      return;
    }

    // Check if cursor is on a slash command (only if command type is enabled)
    if (this.callbacks.isCommandEnabledSync?.()) {
      const slashCommand = findSlashCommandAtPosition(text, cursorPos);
      if (slashCommand) {
        this.showSlashCommandOpenHint();
        const newRange: AtPathRange = { start: slashCommand.start, end: slashCommand.end };
        if (!this.cursorPositionPath ||
            this.cursorPositionPath.start !== newRange.start ||
            this.cursorPositionPath.end !== newRange.end) {
          this.cursorPositionPath = newRange;
          this.renderHighlightBackdropWithCursor();
        }
        return;
      }
    }

    // Find absolute path at cursor position
    const absolutePath = findAbsolutePathAtPosition(text, cursorPos);

    if (absolutePath) {
      this.showFileOpenHint();
      const pathInfo = findClickablePathAtPosition(text, cursorPos);
      if (pathInfo && !pathInfo.path.startsWith('@')) {
        const newRange: AtPathRange = { start: pathInfo.start, end: pathInfo.end };
        if (!this.cursorPositionPath ||
            this.cursorPositionPath.start !== newRange.start ||
            this.cursorPositionPath.end !== newRange.end) {
          this.cursorPositionPath = newRange;
          this.renderHighlightBackdropWithCursor();
        }
      }
    } else {
      this.restoreDefaultHint();
      if (this.cursorPositionPath) {
        this.cursorPositionPath = null;
        this.renderHighlightBackdropWithCursor();
      }
    }
  }

  /**
   * Sync the scroll position of the highlight backdrop with the textarea
   */
  public syncBackdropScroll(): void {
    if (this.textInput && this.highlightBackdrop) {
      this.highlightBackdrop.scrollTop = this.textInput.scrollTop;
      this.highlightBackdrop.scrollLeft = this.textInput.scrollLeft;
    }
  }

  // ============================================================
  // Mouse/Keyboard Event Handlers (from CursorHighlightManager)
  // ============================================================

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
   * Get character position from mouse coordinates
   */
  public getCharPositionFromCoordinates(clientX: number, clientY: number): number | null {
    return this.pathManager.getCharPositionFromCoordinates(clientX, clientY);
  }

  // ============================================================
  // @path Management (delegated to PathManager)
  // ============================================================

  /**
   * Re-scan text for @paths
   */
  public rescanAtPaths(text: string, validPaths?: Set<string> | null): void {
    this.pathManager.rescanAtPaths(text, validPaths);
  }

  /**
   * Clear all tracked @paths
   */
  public clearAtPaths(): void {
    this.pathManager.clearAtPaths();
    this.updateHighlightBackdrop();
  }

  /**
   * Restore @paths from text
   */
  public async restoreAtPathsFromText(checkFilesystem: boolean = false, directoryData?: DirectoryDataForHighlight | null): Promise<void> {
    await this.pathManager.restoreAtPathsFromText(checkFilesystem, directoryData);
    this.updateHighlightBackdrop();
  }

  public addSelectedPath(path: string): void {
    this.pathManager.addSelectedPath(path);
  }

  public removeSelectedPath(path: string): void {
    this.pathManager.removeSelectedPath(path);
  }

  public getAtPaths(): AtPathRange[] {
    return this.pathManager.getAtPaths();
  }

  public getSelectedPaths(): Set<string> {
    return this.pathManager.getSelectedPaths();
  }

  public setValidPathsBuilder(builder: () => Set<string> | null): void {
    this.pathManager.setValidPathsBuilder(builder);
  }

  // ============================================================
  // Private - Hint Text
  // ============================================================

  private showFileOpenHint(): void {
    if (this.callbacks.isFileSearchEnabled && !this.callbacks.isFileSearchEnabled()) {
      return;
    }
    if (this.callbacks.updateHintText) {
      this.callbacks.updateHintText('Press Ctrl+Enter to open file in editor');
    }
  }

  private showUrlOpenHint(): void {
    if (this.callbacks.updateHintText) {
      this.callbacks.updateHintText('Press Ctrl+Enter to open URL in browser');
    }
  }

  private showSlashCommandOpenHint(): void {
    if (this.callbacks.updateHintText) {
      this.callbacks.updateHintText('Press Ctrl+Enter to open command file');
    }
  }

  private restoreDefaultHint(): void {
    if (this.callbacks.updateHintText && this.callbacks.getDefaultHintText) {
      const defaultHint = this.callbacks.getDefaultHintText();
      this.callbacks.updateHintText(defaultHint);
    }
  }

  // ============================================================
  // Private - Hover State
  // ============================================================

  private clearHover(): void {
    this.hoveredAtPath = null;
    this.updateHighlightBackdrop();
  }

  private checkAndHighlightAtPath(clientX: number, clientY: number): void {
    const charPos = this.pathManager.getCharPositionFromCoordinates(clientX, clientY);

    if (charPos === null) {
      this.clearHover();
      return;
    }

    const clickableRange = this.pathManager.findClickableRangeAtPosition(charPos);

    if (clickableRange) {
      if (!this.hoveredAtPath ||
          this.hoveredAtPath.start !== clickableRange.start ||
          this.hoveredAtPath.end !== clickableRange.end) {
        this.hoveredAtPath = clickableRange;
        this.renderFilePathHighlight();
      }
    } else {
      this.clearHover();
    }
  }

  private updateHoverStateAtLastPosition(): void {
    if (this.lastMouseX && this.lastMouseY) {
      this.checkAndHighlightAtPath(this.lastMouseX, this.lastMouseY);
    }
  }

  // ============================================================
  // Private - Backdrop Rendering (from BackdropRenderer)
  // ============================================================

  private renderBackdrop(): void {
    if (!this.highlightBackdrop || !this.textInput) return;

    const text = this.callbacks.getTextContent();
    const atPaths = this.pathManager.getAtPaths();

    if (atPaths.length === 0) {
      this.highlightBackdrop.textContent = text;
      return;
    }

    const fragment = this.buildHighlightFragment(text, atPaths.map(ap => ({
      ...ap,
      className: 'at-path-highlight'
    })));

    this.highlightBackdrop.innerHTML = '';
    this.highlightBackdrop.appendChild(fragment);

    this.syncBackdropScroll();
  }

  private renderBackdropWithCursor(): void {
    if (!this.highlightBackdrop || !this.textInput) return;

    // If there's an active Cmd+hover, use the full link style rendering
    if (this.hoveredAtPath) {
      this.renderBackdropWithHover();
      return;
    }

    const text = this.callbacks.getTextContent();
    const atPaths = this.pathManager.getAtPaths();
    const ranges: Array<AtPathRange & { className: string }> = [];

    // Add @paths
    for (const atPath of atPaths) {
      ranges.push({ ...atPath, className: 'at-path-highlight' });
    }

    // Add cursor position path if it's not already an @path
    if (this.cursorPositionPath) {
      const isAlreadyAtPath = atPaths.some(
        ap => ap.start === this.cursorPositionPath!.start && ap.end === this.cursorPositionPath!.end
      );
      if (!isAlreadyAtPath) {
        ranges.push({ ...this.cursorPositionPath, className: 'file-path-cursor-highlight' });
      }
    }

    this.updateBackdropWithRanges(text, ranges);
  }

  private renderBackdropWithHover(): void {
    if (!this.highlightBackdrop || !this.textInput) return;
    if (!this.hoveredAtPath) return;

    const text = this.callbacks.getTextContent();
    const atPaths = this.pathManager.getAtPaths();
    const ranges: Array<AtPathRange & { className: string }> = [];

    const isHoveredAtPath = atPaths.some(
      ap => ap.start === this.hoveredAtPath!.start && ap.end === this.hoveredAtPath!.end
    );

    // Add @paths with appropriate styling
    for (const atPath of atPaths) {
      const isHovered = atPath.start === this.hoveredAtPath.start && atPath.end === this.hoveredAtPath.end;
      const className = isHovered ? 'at-path-highlight file-path-link' : 'at-path-highlight';
      ranges.push({ ...atPath, className });
    }

    // Add hovered path if it's not an @path
    if (!isHoveredAtPath) {
      ranges.push({ ...this.hoveredAtPath, className: 'file-path-link' });
    }

    this.updateBackdropWithRanges(text, ranges);
  }

  private updateBackdropWithRanges(text: string, ranges: Array<AtPathRange & { className: string }>): void {
    ranges.sort((a, b) => a.start - b.start);

    const fragment = this.buildHighlightFragment(text, ranges);

    while (this.highlightBackdrop.firstChild) {
      this.highlightBackdrop.removeChild(this.highlightBackdrop.firstChild);
    }
    this.highlightBackdrop.appendChild(fragment);
    this.syncBackdropScroll();
  }

  private buildHighlightFragment(
    text: string,
    ranges: Array<AtPathRange & { className: string }>
  ): DocumentFragment {
    const fragment = document.createDocumentFragment();
    let lastEnd = 0;

    for (const range of ranges) {
      if (range.start > lastEnd) {
        fragment.appendChild(document.createTextNode(text.substring(lastEnd, range.start)));
      }

      const span = document.createElement('span');
      span.className = range.className;
      span.textContent = text.substring(range.start, range.end);
      fragment.appendChild(span);

      lastEnd = range.end;
    }

    if (lastEnd < text.length) {
      fragment.appendChild(document.createTextNode(text.substring(lastEnd)));
    }

    return fragment;
  }
}
