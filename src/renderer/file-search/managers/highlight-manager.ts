/**
 * HighlightManager - Manages @path highlighting and Cmd+click interactions
 *
 * This manager handles:
 * - @path highlighting in textarea using backdrop layer
 * - Cmd+hover link style for @paths, URLs, slash commands, and absolute paths
 * - Ctrl+Enter hint text when cursor is on a clickable path
 * - Cursor position highlighting for absolute paths and URLs
 * - Scroll synchronization between textarea and backdrop
 * - @path tracking and validation against file system
 */

import type { AtPathRange } from '../types';
import {
  findAtPathAtPosition,
  findUrlAtPosition,
  findSlashCommandAtPosition,
  findAbsolutePathAtPosition,
  findClickablePathAtPosition
} from '../text-finder';
import { getRelativePath, parsePathWithLineInfo } from '../path-utils';
import type { FileInfo } from '../../../types';

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

  // @path tracking
  private atPaths: AtPathRange[] = [];
  private selectedPaths: Set<string> = new Set();

  // Cmd+hover state
  private isCmdHoverActive: boolean = false;
  private hoveredAtPath: AtPathRange | null = null;

  // Cursor position state
  private cursorPositionPath: AtPathRange | null = null;

  // Mouse position tracking for Cmd key press detection
  private lastMouseX: number = 0;
  private lastMouseY: number = 0;

  constructor(
    textInput: HTMLTextAreaElement,
    highlightBackdrop: HTMLDivElement,
    callbacks: HighlightManagerCallbacks
  ) {
    this.textInput = textInput;
    this.highlightBackdrop = highlightBackdrop;
    this.callbacks = callbacks;
  }

  /**
   * Update the highlight backdrop to show @path highlights
   */
  public updateHighlightBackdrop(): void {
    if (!this.highlightBackdrop || !this.textInput) return;

    const text = this.textInput.value;

    // Re-scan for @paths in the text (in case user edited)
    this.rescanAtPaths(text);

    if (this.atPaths.length === 0) {
      // No @paths, just mirror the text
      this.highlightBackdrop.textContent = text;
      return;
    }

    // Build highlighted content
    const fragment = document.createDocumentFragment();
    let lastEnd = 0;

    for (const atPath of this.atPaths) {
      // Add text before @path
      if (atPath.start > lastEnd) {
        fragment.appendChild(document.createTextNode(text.substring(lastEnd, atPath.start)));
      }

      // Add highlighted @path
      const span = document.createElement('span');
      span.className = 'at-path-highlight';
      span.textContent = text.substring(atPath.start, atPath.end);
      fragment.appendChild(span);

      lastEnd = atPath.end;
    }

    // Add remaining text
    if (lastEnd < text.length) {
      fragment.appendChild(document.createTextNode(text.substring(lastEnd)));
    }

    this.highlightBackdrop.innerHTML = '';
    this.highlightBackdrop.appendChild(fragment);

    // Sync scroll
    this.syncBackdropScroll();
  }

  /**
   * Render highlight backdrop with cursor position highlight
   * @paths get their own highlight, absolute paths get cursor highlight
   */
  public renderHighlightBackdropWithCursor(): void {
    if (!this.highlightBackdrop || !this.textInput) return;

    const text = this.textInput.value;

    // Re-scan for @paths
    this.rescanAtPaths(text);

    // If there's an active Cmd+hover, use the full link style rendering
    if (this.hoveredAtPath) {
      this.renderFilePathHighlight();
      return;
    }

    // Collect all highlight ranges: @paths and cursor position (for absolute paths only)
    const allHighlightRanges: Array<AtPathRange & { isAtPath: boolean; isCursorHighlight: boolean }> = [];

    // Add @paths (no cursor highlight for @paths - they have their own style)
    for (const atPath of this.atPaths) {
      allHighlightRanges.push({ ...atPath, isAtPath: true, isCursorHighlight: false });
    }

    // Add cursor position path if it's not already an @path
    if (this.cursorPositionPath) {
      const isAlreadyAtPath = this.atPaths.some(
        ap => ap.start === this.cursorPositionPath?.start && ap.end === this.cursorPositionPath?.end
      );
      if (!isAlreadyAtPath) {
        allHighlightRanges.push({ ...this.cursorPositionPath, isAtPath: false, isCursorHighlight: true });
      }
    }

    // Sort by start position
    allHighlightRanges.sort((a, b) => a.start - b.start);

    // Build highlighted content
    const fragment = document.createDocumentFragment();
    let lastEnd = 0;

    for (const range of allHighlightRanges) {
      // Add text before this range
      if (range.start > lastEnd) {
        fragment.appendChild(document.createTextNode(text.substring(lastEnd, range.start)));
      }

      // Add highlighted range
      const span = document.createElement('span');
      if (range.isAtPath) {
        span.className = 'at-path-highlight';
      } else if (range.isCursorHighlight) {
        span.className = 'file-path-cursor-highlight';
      }
      span.textContent = text.substring(range.start, range.end);
      fragment.appendChild(span);

      lastEnd = range.end;
    }

    // Add remaining text
    if (lastEnd < text.length) {
      fragment.appendChild(document.createTextNode(text.substring(lastEnd)));
    }

    // Clear existing content using DOM methods (avoid innerHTML for security)
    while (this.highlightBackdrop.firstChild) {
      this.highlightBackdrop.removeChild(this.highlightBackdrop.firstChild);
    }
    this.highlightBackdrop.appendChild(fragment);

    // Sync scroll
    this.syncBackdropScroll();
  }

  /**
   * Render file path highlight (link style) while preserving @path highlights
   */
  public renderFilePathHighlight(): void {
    if (!this.highlightBackdrop || !this.textInput || !this.hoveredAtPath) return;

    const text = this.textInput.value;

    // Re-scan for @paths
    this.rescanAtPaths(text);

    // Check if hoveredAtPath is an @path or an absolute path
    const isHoveredAtPathInAtPaths = this.atPaths.some(
      ap => ap.start === this.hoveredAtPath?.start && ap.end === this.hoveredAtPath?.end
    );

    // Merge @paths and hoveredAtPath (if it's an absolute path not in atPaths)
    const allHighlightRanges: Array<AtPathRange & { isAtPath: boolean; isHovered: boolean }> = [];

    // Add @paths
    for (const atPath of this.atPaths) {
      const isHovered = this.hoveredAtPath &&
                        atPath.start === this.hoveredAtPath.start &&
                        atPath.end === this.hoveredAtPath.end;
      allHighlightRanges.push({ ...atPath, isAtPath: true, isHovered: !!isHovered });
    }

    // Add hovered path if it's not an @path
    if (!isHoveredAtPathInAtPaths && this.hoveredAtPath) {
      allHighlightRanges.push({ ...this.hoveredAtPath, isAtPath: false, isHovered: true });
    }

    // Sort by start position
    allHighlightRanges.sort((a, b) => a.start - b.start);

    // Build highlighted content with link style
    const fragment = document.createDocumentFragment();
    let lastEnd = 0;

    for (const range of allHighlightRanges) {
      // Add text before this range
      if (range.start > lastEnd) {
        fragment.appendChild(document.createTextNode(text.substring(lastEnd, range.start)));
      }

      // Add highlighted range
      const span = document.createElement('span');
      if (range.isHovered) {
        // Apply link style
        span.className = range.isAtPath ? 'at-path-highlight file-path-link' : 'file-path-link';
      } else {
        // Just @path highlight
        span.className = 'at-path-highlight';
      }
      span.textContent = text.substring(range.start, range.end);
      fragment.appendChild(span);

      lastEnd = range.end;
    }

    // Add remaining text
    if (lastEnd < text.length) {
      fragment.appendChild(document.createTextNode(text.substring(lastEnd)));
    }

    // Clear existing content using DOM methods (avoid innerHTML for security)
    while (this.highlightBackdrop.firstChild) {
      this.highlightBackdrop.removeChild(this.highlightBackdrop.firstChild);
    }
    this.highlightBackdrop.appendChild(fragment);

    // Sync scroll
    this.syncBackdropScroll();
  }

  /**
   * Clear file path highlight (link style) while preserving @path highlights
   */
  public clearFilePathHighlight(): void {
    this.hoveredAtPath = null;
    // Re-render without link style (just @path highlights, with cursor highlight)
    this.renderHighlightBackdropWithCursor();
  }

  /**
   * Update cursor position highlight (called when cursor moves)
   * Only highlights absolute file paths and URLs, not @paths (which already have their own highlight)
   * Also updates hint text to show Ctrl+Enter shortcut when on a clickable path or URL
   */
  public updateCursorPositionHighlight(): void {
    if (!this.textInput) return;

    const text = this.textInput.value;
    const cursorPos = this.textInput.selectionStart;

    // First check if cursor is on an @path - still show hint but no extra highlight
    const atPath = findAtPathAtPosition(text, cursorPos);
    if (atPath) {
      // Show hint for @path too
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
      // Show hint for URL
      this.showUrlOpenHint();
      const newRange: AtPathRange = { start: url.start, end: url.end };
      // Only update if position changed
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
        // Show hint for slash command
        this.showSlashCommandOpenHint();
        const newRange: AtPathRange = { start: slashCommand.start, end: slashCommand.end };
        // Only update if position changed
        if (!this.cursorPositionPath ||
            this.cursorPositionPath.start !== newRange.start ||
            this.cursorPositionPath.end !== newRange.end) {
          this.cursorPositionPath = newRange;
          this.renderHighlightBackdropWithCursor();
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
          this.renderHighlightBackdropWithCursor();
        }
      }
    } else {
      // Restore default hint when not on a clickable path
      this.restoreDefaultHint();
      if (this.cursorPositionPath) {
        // Clear cursor highlight
        this.cursorPositionPath = null;
        this.renderHighlightBackdropWithCursor();
      }
    }
  }

  /**
   * Re-scan text for @paths.
   * Finds ALL @path patterns in text and validates them against:
   * 1. The selectedPaths set (paths explicitly selected by user)
   * 2. The cached file list (for Undo support - restores highlights for valid paths)
   */
  public rescanAtPaths(text: string, validPaths?: Set<string> | null): void {
    const foundPaths: AtPathRange[] = [];
    const validPathsSet = validPaths !== undefined ? validPaths : this.buildValidPathsSet();

    // Find all @path patterns in text
    const atPathPattern = /@([^\s@]+)/g;
    let match;

    while ((match = atPathPattern.exec(text)) !== null) {
      const pathContent = match[1];
      if (!pathContent) continue;

      const start = match.index;
      const end = start + 1 + pathContent.length; // +1 for @

      // Check if this path is in selectedPaths (user explicitly selected it)
      const isSelected = this.selectedPaths.has(pathContent);

      // Check if path is valid according to cached file list (for Undo support)
      let isValidCachedPath = false;
      if (validPathsSet) {
        // Extract the clean path (without line number and symbol name)
        const parsedPath = parsePathWithLineInfo(pathContent);
        const cleanPath = parsedPath.path;
        isValidCachedPath = validPathsSet.has(cleanPath);
      }

      // Add to foundPaths if it's selected OR valid according to cached list
      if (isSelected || isValidCachedPath) {
        foundPaths.push({ start, end, path: pathContent });
      }
    }

    // Sort by start position and update
    foundPaths.sort((a, b) => a.start - b.start);
    this.atPaths = foundPaths;
  }

  /**
   * Build a set of valid paths from cached directory data
   */
  private buildValidPathsSet(): Set<string> | null {
    // This method needs to be implemented by the caller or passed as a callback
    // For now, return null to indicate no validation
    return null;
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

  /**
   * Check if mouse is over an @path, absolute path, or URL and highlight it
   */
  public checkAndHighlightAtPath(clientX: number, clientY: number): void {
    if (!this.textInput) return;

    const text = this.textInput.value;
    const charPos = this.getCharPositionFromCoordinates(clientX, clientY);

    if (charPos === null) {
      this.clearFilePathHighlight();
      return;
    }

    // Check for @path first
    const atPath = findAtPathAtPosition(text, charPos);
    if (atPath) {
      // Find the AtPathRange that contains this position
      const atPathRange = this.findAtPathRangeAtPosition(charPos);
      if (atPathRange && atPathRange !== this.hoveredAtPath) {
        this.hoveredAtPath = atPathRange;
        this.renderFilePathHighlight();
      }
      return;
    }

    // Check for URL
    const url = findUrlAtPosition(text, charPos);
    if (url) {
      // Create a temporary AtPathRange for the URL
      const tempRange: AtPathRange = { start: url.start, end: url.end };
      if (!this.hoveredAtPath || this.hoveredAtPath.start !== tempRange.start || this.hoveredAtPath.end !== tempRange.end) {
        this.hoveredAtPath = tempRange;
        this.renderFilePathHighlight();
      }
      return;
    }

    // Check for slash command (like /commit, /help) - only if command type is enabled
    if (this.callbacks.isCommandEnabledSync?.()) {
      const slashCommand = findSlashCommandAtPosition(text, charPos);
      if (slashCommand) {
        // Create a temporary AtPathRange for the slash command
        const tempRange: AtPathRange = { start: slashCommand.start, end: slashCommand.end };
        if (!this.hoveredAtPath || this.hoveredAtPath.start !== tempRange.start || this.hoveredAtPath.end !== tempRange.end) {
          this.hoveredAtPath = tempRange;
          this.renderFilePathHighlight();
        }
        return;
      }
    }

    // Check for absolute path (starting with /)
    const clickablePath = findClickablePathAtPosition(text, charPos);
    if (clickablePath) {
      // Create a temporary AtPathRange for the absolute path
      const tempRange: AtPathRange = { start: clickablePath.start, end: clickablePath.end };
      if (!this.hoveredAtPath || this.hoveredAtPath.start !== tempRange.start || this.hoveredAtPath.end !== tempRange.end) {
        this.hoveredAtPath = tempRange;
        this.renderFilePathHighlight();
      }
      return;
    }

    this.clearFilePathHighlight();
  }

  /**
   * Get character position from mouse coordinates using mirror div
   */
  public getCharPositionFromCoordinates(clientX: number, clientY: number): number | null {
    if (!this.textInput) return null;

    const textareaRect = this.textInput.getBoundingClientRect();
    const relativeX = clientX - textareaRect.left + this.textInput.scrollLeft;
    const relativeY = clientY - textareaRect.top + this.textInput.scrollTop;

    // Simple approximation based on line height and character width
    const style = window.getComputedStyle(this.textInput);
    const lineHeight = parseFloat(style.lineHeight) || 20;
    const fontSize = parseFloat(style.fontSize) || 15;
    const charWidth = fontSize * 0.6; // Approximate for monospace fonts

    const text = this.textInput.value;
    const lines = text.split('\n');
    const lineIndex = Math.max(0, Math.min(Math.floor(relativeY / lineHeight), lines.length - 1));
    const charIndex = Math.max(0, Math.floor(relativeX / charWidth));

    // Calculate absolute position from line and char indices
    let absolutePos = 0;
    for (let i = 0; i < lineIndex; i++) {
      absolutePos += (lines[i]?.length || 0) + 1; // +1 for newline
    }
    absolutePos += charIndex;

    return Math.min(absolutePos, text.length);
  }

  /**
   * Handle mouse move for Cmd+hover link style
   */
  public onMouseMove(e: MouseEvent): void {
    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;

    if (!e.metaKey) {
      if (this.hoveredAtPath) {
        this.clearFilePathHighlight();
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
      this.clearFilePathHighlight();
    }
  }

  /**
   * Clear all tracked @paths (called when text is cleared)
   */
  public clearAtPaths(): void {
    this.atPaths = [];
    this.selectedPaths.clear();
    this.updateHighlightBackdrop();
  }

  /**
   * Restore @paths from text (called when draft is restored or directory data is updated)
   * This auto-detects @paths in the text and adds them to tracking
   * Only highlights @paths that actually exist (checked against cached file list or filesystem)
   *
   * @param checkFilesystem - If true, checks filesystem for file existence when cached file list is empty.
   *                          Use this when restoring from draft with empty file list (fromDraft).
   * @param directoryData - Directory data for validation (optional)
   */
  public async restoreAtPathsFromText(checkFilesystem: boolean = false, directoryData?: DirectoryDataForHighlight | null): Promise<void> {
    const text = this.callbacks.getTextContent();
    console.debug('[HighlightManager] Restoring @paths from text:', {
      textLength: text.length,
      checkFilesystem,
      hasDirectoryData: !!directoryData
    });

    // Clear existing state
    this.atPaths = [];
    this.selectedPaths.clear();

    // Need cached directory data to check if files exist (or need to check filesystem)
    const hasValidCachedData = directoryData?.files &&
                                directoryData.files.length > 0 &&
                                directoryData?.directory;
    const baseDir = directoryData?.directory;

    if (!checkFilesystem && !hasValidCachedData) {
      console.debug('[HighlightManager] restoreAtPathsFromText: no cached data and not checking filesystem, skipping highlight');
      this.updateHighlightBackdrop();
      return;
    }

    // Build a set of relative paths for quick lookup (only if we have valid cached data)
    let relativePaths: Set<string> | null = null;
    if (hasValidCachedData && directoryData) {
      const files = directoryData.files;
      relativePaths = new Set<string>();
      for (const file of files) {
        const relativePath = getRelativePath(file.path, baseDir!);
        relativePaths.add(relativePath);

        // For directories: add both with and without trailing slash
        if (file.isDirectory) {
          if (!relativePath.endsWith('/')) {
            relativePaths.add(relativePath + '/');
          } else {
            relativePaths.add(relativePath.slice(0, -1));
          }
        }

        // Extract and add all parent directories from file paths
        // This handles cases where directory entries are not in the file list
        const pathParts = relativePath.split('/');
        let parentPath = '';
        for (let i = 0; i < pathParts.length - 1; i++) {
          parentPath += (i > 0 ? '/' : '') + pathParts[i];
          relativePaths.add(parentPath);
          relativePaths.add(parentPath + '/');
        }
      }

      console.debug('[HighlightManager] Built relative path set:', {
        pathCount: relativePaths.size
      });
    }

    // Find all @path patterns
    const atPathPattern = /@([^\s@]+)/g;
    let match;

    while ((match = atPathPattern.exec(text)) !== null) {
      const pathContent = match[1];
      if (!pathContent) continue;

      const start = match.index;
      const end = start + 1 + pathContent.length;

      // Parse path to extract clean path (without line number and symbol name)
      const parsedPath = parsePathWithLineInfo(pathContent);
      const cleanPath = parsedPath.path;

      // Check if file exists (either in cache or filesystem)
      let shouldHighlight = false;

      if (relativePaths && relativePaths.has(cleanPath)) {
        // Path exists in cached file list
        shouldHighlight = true;
        console.debug('[HighlightManager] Found @path in cache:', {
          pathContent,
          cleanPath,
          start,
          end,
          isSymbolPath: !!parsedPath.lineNumber
        });
      } else if (checkFilesystem && this.callbacks.checkFileExists) {
        // Check filesystem if cache lookup failed and checkFilesystem is true
        try {
          const exists = await this.callbacks.checkFileExists(cleanPath);
          shouldHighlight = exists;
          console.debug('[HighlightManager] Checked filesystem for @path:', {
            pathContent,
            cleanPath,
            exists,
            isSymbolPath: !!parsedPath.lineNumber
          });
        } catch (err) {
          console.error('[HighlightManager] Error checking file existence:', err);
          shouldHighlight = false;
        }
      }

      if (shouldHighlight) {
        // Add to selectedPaths set (rescanAtPaths will find all occurrences)
        // Use the full pathContent (including line number and symbol name if present)
        this.selectedPaths.add(pathContent);
        console.debug('[HighlightManager] Found @path:', {
          pathContent,
          cleanPath,
          start,
          end,
          checkFilesystem,
          isSymbolPath: !!parsedPath.lineNumber
        });
      } else {
        console.debug('[HighlightManager] Skipping non-existent @path:', pathContent);
      }
    }

    console.debug('[HighlightManager] Restored @paths from text:', {
      selectedPathsCount: this.selectedPaths.size,
      textLength: text.length,
      checkFilesystem
    });
    this.updateHighlightBackdrop();
  }

  /**
   * Add a path to the selectedPaths set
   */
  public addSelectedPath(path: string): void {
    this.selectedPaths.add(path);
    console.debug('[HighlightManager] Added path to selectedPaths:', path, 'total:', this.selectedPaths.size);
  }

  /**
   * Remove a path from the selectedPaths set
   */
  public removeSelectedPath(path: string): void {
    this.selectedPaths.delete(path);
    console.debug('[HighlightManager] Removed path from selectedPaths:', path);
  }

  /**
   * Get all tracked @paths
   */
  public getAtPaths(): AtPathRange[] {
    return [...this.atPaths];
  }

  /**
   * Get the selected paths set
   */
  public getSelectedPaths(): Set<string> {
    return new Set(this.selectedPaths);
  }

  /**
   * Set the valid paths set for validation (used by rescanAtPaths)
   */
  public setValidPathsBuilder(builder: () => Set<string> | null): void {
    this.buildValidPathsSet = builder;
  }

  // Helper methods

  /**
   * Find AtPathRange at the given position
   */
  private findAtPathRangeAtPosition(charPos: number): AtPathRange | null {
    for (const atPath of this.atPaths) {
      if (charPos >= atPath.start && charPos < atPath.end) {
        return atPath;
      }
    }
    return null;
  }

  /**
   * Update hover state when Cmd key is pressed
   */
  private updateHoverStateAtLastPosition(): void {
    if (this.lastMouseX && this.lastMouseY) {
      this.checkAndHighlightAtPath(this.lastMouseX, this.lastMouseY);
    }
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
