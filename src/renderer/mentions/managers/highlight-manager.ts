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

import type { AtPathRange } from '../types';
import type { FileInfo } from '../../../types';
import {
  findAtPathAtPosition,
  findUrlAtPosition,
  findSlashCommandAtPosition,
  findAbsolutePathAtPosition,
  findClickablePathAtPosition,
  findAllUrls,
  findAllAbsolutePaths
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

  // PathManager is injected from parent (MentionManager)
  private pathManager: PathManager;

  // Cursor highlight state (from CursorHighlightManager)
  private cursorPositionPath: AtPathRange | null = null;

  // Cmd+hover state (from CursorHighlightManager)
  private isCmdHoverActive: boolean = false;
  private hoveredAtPath: AtPathRange | null = null;
  private lastMouseX: number = 0;
  private lastMouseY: number = 0;

  // RAF-based update optimization (Phase 2)
  private pendingUpdate: number | null = null;

  // Debug mode for development (Phase 4)
  private debugMode: boolean = false;

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
   * Uses requestAnimationFrame to batch updates and prevent jitter
   */
  public updateHighlightBackdrop(): void {
    if (!this.highlightBackdrop || !this.textInput) return;

    // Cancel pending update to prevent stale renders
    if (this.pendingUpdate !== null) {
      cancelAnimationFrame(this.pendingUpdate);
    }

    this.pendingUpdate = requestAnimationFrame(() => {
      this.pendingUpdate = null;
      this.renderBackdropSync();
    });
  }

  /**
   * Synchronous backdrop render (called within RAF)
   */
  private renderBackdropSync(): void {
    if (!this.highlightBackdrop || !this.textInput) return;

    // Sync scroll position first to ensure alignment
    this.syncBackdropScroll();

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
   * Uses CSS transform for GPU-accelerated, lag-free sync
   */
  public syncBackdropScroll(): void {
    if (this.textInput && this.highlightBackdrop) {
      const scrollTop = this.textInput.scrollTop;
      const scrollLeft = this.textInput.scrollLeft;

      // Find the content wrapper and apply transform to it
      const contentWrapper = this.highlightBackdrop.querySelector('.highlight-backdrop-content') as HTMLElement;
      if (contentWrapper) {
        // Use CSS transform for instant, GPU-accelerated position sync
        contentWrapper.style.transform = `translate(${-scrollLeft}px, ${-scrollTop}px)`;
      }
    }
  }

  /**
   * Set the backdrop content with a wrapper for transform-based scroll sync
   */
  private setBackdropContent(content: Node | string): void {
    if (!this.highlightBackdrop) return;

    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'highlight-backdrop-content';

    if (typeof content === 'string') {
      contentWrapper.textContent = content;
    } else {
      contentWrapper.appendChild(content);
    }

    this.highlightBackdrop.innerHTML = '';
    this.highlightBackdrop.appendChild(contentWrapper);
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

  /**
   * Set registered at-paths from persistent cache
   * These paths may contain spaces and are matched before the default regex
   */
  public setRegisteredAtPaths(paths: string[]): void {
    this.pathManager.setRegisteredAtPaths(paths);
  }

  /**
   * Get registered at-paths
   */
  public getRegisteredAtPaths(): Set<string> {
    return this.pathManager.getRegisteredAtPaths();
  }

  // ============================================================
  // Debug Mode (Phase 4)
  // ============================================================

  /**
   * Enable debug mode for development
   * Makes backdrop text visible with red color and semi-transparent
   * to help identify alignment issues
   */
  public enableDebugMode(): void {
    this.debugMode = true;
    if (this.highlightBackdrop) {
      this.highlightBackdrop.style.color = 'red';
      this.highlightBackdrop.style.opacity = '0.5';
    }
    console.debug('[HighlightManager] Debug mode enabled');
  }

  /**
   * Disable debug mode
   * Restores normal backdrop appearance
   */
  public disableDebugMode(): void {
    this.debugMode = false;
    if (this.highlightBackdrop) {
      this.highlightBackdrop.style.color = 'transparent';
      this.highlightBackdrop.style.opacity = '';
    }
    console.debug('[HighlightManager] Debug mode disabled');
  }

  /**
   * Check if debug mode is enabled
   */
  public isDebugModeEnabled(): boolean {
    return this.debugMode;
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
    const ranges: Array<AtPathRange & { className: string }> = [];

    // Add @paths
    for (const atPath of atPaths) {
      ranges.push({ ...atPath, className: 'at-path-highlight' });
    }

    // Add all URLs with underline (always visible)
    const urls = findAllUrls(text);
    for (const url of urls) {
      const overlapsWithAtPath = atPaths.some(
        ap => (url.start >= ap.start && url.start < ap.end) ||
              (url.end > ap.start && url.end <= ap.end)
      );
      if (!overlapsWithAtPath) {
        ranges.push({ start: url.start, end: url.end, className: 'file-path-cursor-highlight' });
      }
    }

    // Add all absolute paths with underline (always visible)
    const absolutePaths = findAllAbsolutePaths(text);
    for (const pathInfo of absolutePaths) {
      const overlapsWithAtPath = atPaths.some(
        ap => (pathInfo.start >= ap.start && pathInfo.start < ap.end) ||
              (pathInfo.end > ap.start && pathInfo.end <= ap.end)
      );
      const overlapsWithUrl = urls.some(
        u => (pathInfo.start >= u.start && pathInfo.start < u.end) ||
             (pathInfo.end > u.start && pathInfo.end <= u.end)
      );
      if (!overlapsWithAtPath && !overlapsWithUrl) {
        ranges.push({ start: pathInfo.start, end: pathInfo.end, className: 'file-path-cursor-highlight' });
      }
    }

    if (ranges.length === 0) {
      this.setBackdropContent(text);
      this.syncBackdropScroll();
      return;
    }

    this.updateBackdropWithRanges(text, ranges);
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

    // Add all URLs with underline (always visible)
    const urls = findAllUrls(text);
    for (const url of urls) {
      // Check if this URL overlaps with any @path
      const overlapsWithAtPath = atPaths.some(
        ap => (url.start >= ap.start && url.start < ap.end) ||
              (url.end > ap.start && url.end <= ap.end)
      );
      if (!overlapsWithAtPath) {
        ranges.push({ start: url.start, end: url.end, className: 'file-path-cursor-highlight' });
      }
    }

    // Add all absolute paths with underline (always visible)
    const absolutePaths = findAllAbsolutePaths(text);
    for (const pathInfo of absolutePaths) {
      // Check if this path overlaps with any @path or URL
      const overlapsWithAtPath = atPaths.some(
        ap => (pathInfo.start >= ap.start && pathInfo.start < ap.end) ||
              (pathInfo.end > ap.start && pathInfo.end <= ap.end)
      );
      const overlapsWithUrl = urls.some(
        u => (pathInfo.start >= u.start && pathInfo.start < u.end) ||
             (pathInfo.end > u.start && pathInfo.end <= u.end)
      );
      if (!overlapsWithAtPath && !overlapsWithUrl) {
        ranges.push({ start: pathInfo.start, end: pathInfo.end, className: 'file-path-cursor-highlight' });
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

    // Add all URLs with underline (always visible)
    const urls = findAllUrls(text);
    for (const url of urls) {
      const overlapsWithAtPath = atPaths.some(
        ap => (url.start >= ap.start && url.start < ap.end) ||
              (url.end > ap.start && url.end <= ap.end)
      );
      if (!overlapsWithAtPath) {
        const isHovered = url.start === this.hoveredAtPath.start && url.end === this.hoveredAtPath.end;
        const className = isHovered ? 'file-path-link' : 'file-path-cursor-highlight';
        ranges.push({ start: url.start, end: url.end, className });
      }
    }

    // Add all absolute paths with underline (always visible)
    const absolutePaths = findAllAbsolutePaths(text);
    for (const pathInfo of absolutePaths) {
      const overlapsWithAtPath = atPaths.some(
        ap => (pathInfo.start >= ap.start && pathInfo.start < ap.end) ||
              (pathInfo.end > ap.start && pathInfo.end <= ap.end)
      );
      const overlapsWithUrl = urls.some(
        u => (pathInfo.start >= u.start && pathInfo.start < u.end) ||
             (pathInfo.end > u.start && pathInfo.end <= u.end)
      );
      if (!overlapsWithAtPath && !overlapsWithUrl) {
        const isHovered = pathInfo.start === this.hoveredAtPath.start && pathInfo.end === this.hoveredAtPath.end;
        const className = isHovered ? 'file-path-link' : 'file-path-cursor-highlight';
        ranges.push({ start: pathInfo.start, end: pathInfo.end, className });
      }
    }

    // Add hovered path if it's not already added (for other linkable types like slash commands)
    if (!isHoveredAtPath) {
      const isHoveredUrl = urls.some(u => u.start === this.hoveredAtPath!.start && u.end === this.hoveredAtPath!.end);
      const isHoveredPath = absolutePaths.some(p => p.start === this.hoveredAtPath!.start && p.end === this.hoveredAtPath!.end);
      if (!isHoveredUrl && !isHoveredPath) {
        ranges.push({ ...this.hoveredAtPath, className: 'file-path-link' });
      }
    }

    this.updateBackdropWithRanges(text, ranges);
  }

  private updateBackdropWithRanges(text: string, ranges: Array<AtPathRange & { className: string }>): void {
    // Sort by start position, then by priority (at-path > link > cursor-highlight)
    ranges.sort((a, b) => {
      if (a.start !== b.start) return a.start - b.start;
      // Priority: at-path-highlight > file-path-link > file-path-cursor-highlight
      const priorityA = a.className.includes('at-path-highlight') ? 0 :
                        a.className.includes('file-path-link') ? 1 : 2;
      const priorityB = b.className.includes('at-path-highlight') ? 0 :
                        b.className.includes('file-path-link') ? 1 : 2;
      return priorityA - priorityB;
    });

    // Remove overlapping ranges (keep the higher priority one)
    const filteredRanges: Array<AtPathRange & { className: string }> = [];
    let lastEnd = -1;
    for (const range of ranges) {
      // Skip ranges that overlap with previous ranges
      if (range.start >= lastEnd) {
        filteredRanges.push(range);
        lastEnd = range.end;
      }
      // Note: Any range with start < lastEnd is skipped (overlapping)
    }

    const fragment = this.buildHighlightFragment(text, filteredRanges);
    this.setBackdropContent(fragment);
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
