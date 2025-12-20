/**
 * File Search Highlighter
 * Handles @path highlighting in the textarea
 */

import type { DirectoryData, FileSearchCallbacks, AtPathRange } from './types';
import { formatLog } from './types';

export class FileSearchHighlighter {
  private atPaths: AtPathRange[] = []; // Tracked @paths in the text (computed from selectedPaths)
  private selectedPaths: Set<string> = new Set(); // Paths to highlight (explicitly selected by user)
  private hoveredAtPath: AtPathRange | null = null; // Currently hovered @path (for Cmd+hover link style)
  private cursorPositionPath: AtPathRange | null = null; // Path at cursor position (for underline highlight)
  private isCmdHoverActive: boolean = false; // Cmd+hover state

  constructor(
    private getTextInput: () => HTMLTextAreaElement | null,
    private getHighlightBackdrop: () => HTMLDivElement | null,
    private callbacks: FileSearchCallbacks,
    private getCachedDirectoryData: () => DirectoryData | null,
    private getRelativePath: (fullPath: string, baseDir: string) => string
  ) {}

  /**
   * Sync the scroll position of the highlight backdrop with the textarea
   */
  public syncBackdropScroll(): void {
    const textInput = this.getTextInput();
    const highlightBackdrop = this.getHighlightBackdrop();
    if (textInput && highlightBackdrop) {
      highlightBackdrop.scrollTop = textInput.scrollTop;
      highlightBackdrop.scrollLeft = textInput.scrollLeft;
    }
  }

  /**
   * Update the highlight backdrop to show @path highlights
   */
  public updateHighlightBackdrop(): void {
    const highlightBackdrop = this.getHighlightBackdrop();
    const textInput = this.getTextInput();
    if (!highlightBackdrop || !textInput) return;

    const text = textInput.value;

    // Re-scan for @paths in the text (in case user edited)
    this.rescanAtPaths(text);

    if (this.atPaths.length === 0) {
      // No @paths, just mirror the text
      highlightBackdrop.textContent = text;
      return;
    }

    // Build highlighted content
    const fragment = document.createDocumentFragment();
    let lastEnd = 0;

    for (const atPath of this.atPaths) {
      // Add text before this @path
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

    highlightBackdrop.innerHTML = '';
    highlightBackdrop.appendChild(fragment);

    // Sync scroll
    this.syncBackdropScroll();
  }

  /**
   * Re-scan text for @paths.
   * Finds ALL @path patterns in text and validates them against:
   * 1. The selectedPaths set (paths explicitly selected by user)
   * 2. The cached file list (for Undo support - restores highlights for valid paths)
   */
  public rescanAtPaths(text: string): void {
    const foundPaths: AtPathRange[] = [];
    const validPaths = this.buildValidPathsSet();

    // Find all @path patterns in text
    const atPathPattern = /@([^\s@]+)/g;
    let match;

    while ((match = atPathPattern.exec(text)) !== null) {
      const pathContent = match[1];
      if (!pathContent) continue;

      const start = match.index;
      const end = match.index + match[0].length;

      // Check if this path should be highlighted:
      // 1. It's in selectedPaths (explicitly selected by user), OR
      // 2. It exists in the valid paths from cached file list (for Undo support)
      const isSelected = this.selectedPaths.has(pathContent);
      const isValidPath = validPaths?.has(pathContent) ?? false;

      if (isSelected || isValidPath) {
        foundPaths.push({
          start,
          end,
          path: pathContent
        });

        // If it's a valid path that was restored via Undo, add it to selectedPaths
        if (isValidPath && !isSelected) {
          this.selectedPaths.add(pathContent);
        }
      }
    }

    // Sort by start position
    foundPaths.sort((a, b) => a.start - b.start);
    this.atPaths = foundPaths;
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
   */
  public async restoreAtPathsFromText(checkFilesystem = false): Promise<void> {
    const textInput = this.getTextInput();
    const cachedDirectoryData = this.getCachedDirectoryData();

    console.debug('[FileSearchHighlighter] restoreAtPathsFromText called:', formatLog({
      hasTextInput: !!textInput,
      hasHighlightBackdrop: !!this.getHighlightBackdrop(),
      hasCachedData: !!cachedDirectoryData,
      cachedFileCount: cachedDirectoryData?.files?.length || 0,
      checkFilesystem
    }));

    if (!textInput) {
      console.debug('[FileSearchHighlighter] restoreAtPathsFromText: no textInput, returning');
      return;
    }

    const text = textInput.value;
    if (!text) {
      console.debug('[FileSearchHighlighter] restoreAtPathsFromText: no text, returning');
      return;
    }

    // Clear existing paths and selected paths
    this.atPaths = [];
    this.selectedPaths.clear();

    // Need cached directory data to check if files exist (or need to check filesystem)
    const hasValidCachedData = cachedDirectoryData?.files &&
                                cachedDirectoryData.files.length > 0 &&
                                cachedDirectoryData?.directory;
    const baseDir = cachedDirectoryData?.directory;

    if (!checkFilesystem && !hasValidCachedData) {
      console.debug('[FileSearchHighlighter] restoreAtPathsFromText: no cached data and not checking filesystem, skipping highlight');
      this.updateHighlightBackdrop();
      return;
    }

    // Build a set of relative paths for quick lookup (only if we have valid cached data)
    let relativePaths: Set<string> | null = null;
    if (hasValidCachedData) {
      const files = cachedDirectoryData!.files!;
      relativePaths = new Set<string>();
      for (const file of files) {
        const relativePath = this.getRelativePath(file.path, baseDir!);
        relativePaths.add(relativePath);
        // For directories: add both with and without trailing slash
        // getRelativePath doesn't add trailing slash, but selectFileByInfo adds it for directories
        // So we need both versions to match @paths in text
        if (file.isDirectory) {
          // Add with trailing slash if not already present
          if (!relativePath.endsWith('/')) {
            relativePaths.add(relativePath + '/');
          } else {
            // Also add without trailing slash
            relativePaths.add(relativePath.slice(0, -1));
          }
        }

        // Also extract and add all parent directories from file paths
        // This handles cases where directory entries are not in the file list
        // but files within those directories are (e.g., .github/ISSUE_TEMPLATE/bug_report.yml
        // should make .github/ and .github/ISSUE_TEMPLATE/ available for highlighting)
        const pathParts = relativePath.split('/');
        let parentPath = '';
        for (let i = 0; i < pathParts.length - 1; i++) {
          parentPath += (i > 0 ? '/' : '') + pathParts[i];
          // Add both with and without trailing slash
          relativePaths.add(parentPath);
          relativePaths.add(parentPath + '/');
        }
      }

      console.debug('[FileSearchHighlighter] Built relative path set:', formatLog({
        pathCount: relativePaths.size
      }));
    }

    // Find all @paths in text
    const atPathPattern = /@([^\s@]+)/g;
    let match;
    const pathsToCheck: Array<{ pathContent: string; start: number; end: number }> = [];

    while ((match = atPathPattern.exec(text)) !== null) {
      const pathContent = match[1];
      // Only add paths that look like file paths (contain / or .)
      if (pathContent && (pathContent.includes('/') || pathContent.includes('.'))) {
        pathsToCheck.push({
          pathContent,
          start: match.index,
          end: match.index + match[0].length
        });
      }
    }

    // Check each path for existence
    for (const { pathContent, start, end } of pathsToCheck) {
      let shouldHighlight = false;

      // First, check against cached file list if available
      if (relativePaths && relativePaths.has(pathContent)) {
        shouldHighlight = true;
      }
      // If no cached data but checkFilesystem is enabled, check actual filesystem
      else if (checkFilesystem && baseDir) {
        // Construct full path and check filesystem
        const fullPath = `${baseDir}/${pathContent}`;
        try {
          const exists = await window.electronAPI.file.checkExists(fullPath);
          shouldHighlight = exists;
          console.debug('[FileSearchHighlighter] Filesystem check for @path:', formatLog({
            pathContent,
            fullPath,
            exists
          }));
        } catch (err) {
          console.error('[FileSearchHighlighter] Error checking file existence:', err);
          shouldHighlight = false;
        }
      }

      if (shouldHighlight) {
        // Add to selectedPaths set (rescanAtPaths will find all occurrences)
        this.selectedPaths.add(pathContent);
        console.debug('[FileSearchHighlighter] Found @path:', formatLog({
          pathContent,
          start,
          end,
          checkFilesystem
        }));
      } else {
        console.debug('[FileSearchHighlighter] Skipping non-existent @path:', pathContent);
      }
    }

    console.debug('[FileSearchHighlighter] Restored @paths from text:', formatLog({
      selectedPathsCount: this.selectedPaths.size,
      textLength: text.length,
      checkFilesystem
    }));
    this.updateHighlightBackdrop();
  }

  /**
   * Render file path highlight (link style) while preserving @path highlights
   */
  public renderFilePathHighlight(): void {
    const highlightBackdrop = this.getHighlightBackdrop();
    const textInput = this.getTextInput();
    if (!highlightBackdrop || !textInput || !this.hoveredAtPath) return;

    const text = textInput.value;

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
      const isHovered = this.hoveredAtPath !== null &&
        atPath.start === this.hoveredAtPath.start &&
        atPath.end === this.hoveredAtPath.end;
      allHighlightRanges.push({ ...atPath, isAtPath: true, isHovered });
    }

    // Add absolute path if not already in @paths
    if (!isHoveredAtPathInAtPaths && this.hoveredAtPath) {
      allHighlightRanges.push({
        start: this.hoveredAtPath.start,
        end: this.hoveredAtPath.end,
        isAtPath: false,
        isHovered: true
      });
    }

    // Sort by start position
    allHighlightRanges.sort((a, b) => a.start - b.start);

    // Build highlighted content with link style on hovered path
    const fragment = document.createDocumentFragment();
    let lastEnd = 0;

    for (const range of allHighlightRanges) {
      // Add text before this range
      if (range.start > lastEnd) {
        fragment.appendChild(document.createTextNode(text.substring(lastEnd, range.start)));
      }

      // Add highlighted span
      const span = document.createElement('span');

      if (range.isAtPath) {
        span.className = 'at-path-highlight';
      }

      // Add link style if this is the hovered path
      if (range.isHovered) {
        span.classList.add('file-path-link');
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
    while (highlightBackdrop.firstChild) {
      highlightBackdrop.removeChild(highlightBackdrop.firstChild);
    }
    highlightBackdrop.appendChild(fragment);

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
   * Render highlight backdrop with cursor position highlight
   * @paths get their own highlight, absolute paths get cursor highlight
   */
  public renderHighlightBackdropWithCursor(): void {
    const highlightBackdrop = this.getHighlightBackdrop();
    const textInput = this.getTextInput();
    if (!highlightBackdrop || !textInput) return;

    const text = textInput.value;

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

    // Add cursor position path for absolute paths (not @paths)
    if (this.cursorPositionPath) {
      allHighlightRanges.push({
        start: this.cursorPositionPath.start,
        end: this.cursorPositionPath.end,
        isAtPath: false,
        isCursorHighlight: true
      });
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

      // Add highlighted span
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
    while (highlightBackdrop.firstChild) {
      highlightBackdrop.removeChild(highlightBackdrop.firstChild);
    }
    highlightBackdrop.appendChild(fragment);

    // Sync scroll
    this.syncBackdropScroll();
  }

  /**
   * Find @path at or just before the cursor position
   */
  public findAtPathAtCursor(cursorPos: number): AtPathRange | null {
    // Check if cursor is at the end of any @path (including one character after for space)
    for (const path of this.atPaths) {
      if (cursorPos === path.end || cursorPos === path.end + 1) {
        return path;
      }
    }
    return null;
  }

  /**
   * Handle backspace key to delete entire @path if cursor is at the end
   * Uses replaceRangeWithUndo for native Undo/Redo support
   *
   * Note: Does not override normal backspace behavior when:
   * - Shift key is pressed (Shift+Backspace)
   * - Text is selected (let browser delete selection normally)
   */
  public handleBackspaceForAtPath(
    e: KeyboardEvent,
    getCursorPosition: () => number,
    getTextContent: () => string,
    setCursorPosition: (pos: number) => void
  ): void {
    // Don't override Shift+Backspace (let it behave as normal backspace)
    if (e.shiftKey) {
      return;
    }

    // Don't override when text is selected (let browser delete selection normally)
    const textInput = this.getTextInput();
    if (textInput && textInput.selectionStart !== textInput.selectionEnd) {
      return;
    }

    const cursorPos = getCursorPosition();
    const atPath = this.findAtPathAtCursor(cursorPos);

    if (atPath) {
      e.preventDefault();

      const text = getTextContent();
      const deletedPathContent = atPath.path;

      // Delete the @path (and trailing space if present)
      let deleteEnd = atPath.end;
      if (text[deleteEnd] === ' ') {
        deleteEnd++;
      }

      // Use replaceRangeWithUndo if available for native Undo support
      if (this.callbacks.replaceRangeWithUndo) {
        this.callbacks.replaceRangeWithUndo(atPath.start, deleteEnd, '');
      } else {
        // Fallback to direct text manipulation (no Undo support)
        const newText = text.substring(0, atPath.start) + text.substring(deleteEnd);
        this.callbacks.setTextContent(newText);
      }
      setCursorPosition(atPath.start);

      // Update highlight backdrop (rescanAtPaths will recalculate all positions)
      this.updateHighlightBackdrop();

      // After update, check if this path still exists in the text
      // If not, remove it from selectedPaths
      if (deletedPathContent && !this.atPaths.some(p => p.path === deletedPathContent)) {
        this.selectedPaths.delete(deletedPathContent);
        console.debug('[FileSearchHighlighter] Removed path from selectedPaths:', deletedPathContent);
      }

      console.debug('[FileSearchHighlighter] deleted @path:', formatLog({
        deletedStart: atPath.start,
        deletedEnd: deleteEnd,
        deletedPath: deletedPathContent || 'unknown',
        remainingPaths: this.atPaths.length,
        selectedPathsCount: this.selectedPaths.size
      }));
    }
  }

  /**
   * Insert file path, keeping the @ and replacing only the query part
   * Uses replaceRangeWithUndo for native Undo/Redo support
   */
  public insertFilePath(
    path: string,
    atStartPosition: number,
    getCursorPosition: () => number,
    replaceRangeWithUndo?: (start: number, end: number, text: string) => void,
    getTextContent?: () => string,
    setTextContent?: (text: string) => void
  ): void {
    if (atStartPosition < 0) return;

    const cursorPos = getCursorPosition();

    // The insertion text includes path + space for better UX
    const insertionText = path + ' ';

    // Replace the query part (after @) with the new path + space
    // atStartPosition points to @, so we keep @ and replace from atStartPosition + 1 to cursorPos
    const replaceStart = atStartPosition + 1;
    const replaceEnd = cursorPos;

    // Use replaceRangeWithUndo if available for native Undo support
    if (replaceRangeWithUndo) {
      replaceRangeWithUndo(replaceStart, replaceEnd, insertionText);
    } else if (getTextContent && setTextContent) {
      // Fallback to direct text manipulation (no Undo support)
      const text = getTextContent();
      const before = text.substring(0, replaceStart);
      const after = text.substring(replaceEnd);
      const newText = before + insertionText + after;
      setTextContent(newText);
    }

    // Add the path to the set of selected paths (for highlighting)
    this.selectedPaths.add(path);
    console.debug('[FileSearchHighlighter] Added path to selectedPaths:', path, 'total:', this.selectedPaths.size);

    // Update highlight backdrop (this will find all occurrences in the text)
    this.updateHighlightBackdrop();
  }

  /**
   * Find AtPathRange at the given position
   */
  public findAtPathRangeAtPosition(charPos: number): AtPathRange | null {
    for (const atPath of this.atPaths) {
      if (charPos >= atPath.start && charPos < atPath.end) {
        return atPath;
      }
    }
    return null;
  }

  // Getters and setters
  public getAtPaths(): AtPathRange[] {
    return this.atPaths;
  }

  public getSelectedPaths(): Set<string> {
    return this.selectedPaths;
  }

  public setHoveredAtPath(path: AtPathRange | null): void {
    this.hoveredAtPath = path;
  }

  public getHoveredAtPath(): AtPathRange | null {
    return this.hoveredAtPath;
  }

  public setCursorPositionPath(path: AtPathRange | null): void {
    this.cursorPositionPath = path;
  }

  public getCursorPositionPath(): AtPathRange | null {
    return this.cursorPositionPath;
  }

  public setIsCmdHoverActive(active: boolean): void {
    this.isCmdHoverActive = active;
  }

  public getIsCmdHoverActive(): boolean {
    return this.isCmdHoverActive;
  }

  /**
   * Build a set of valid paths from cached directory data
   */
  private buildValidPathsSet(): Set<string> | null {
    const cachedDirectoryData = this.getCachedDirectoryData();
    if (!cachedDirectoryData?.files || cachedDirectoryData.files.length === 0) {
      return null;
    }

    const baseDir = cachedDirectoryData.directory;
    const validPaths = new Set<string>();

    for (const file of cachedDirectoryData.files) {
      const relativePath = this.getRelativePath(file.path, baseDir);
      validPaths.add(relativePath);
      // For directories: add both with and without trailing slash
      if (file.isDirectory) {
        if (!relativePath.endsWith('/')) {
          validPaths.add(relativePath + '/');
        } else {
          validPaths.add(relativePath.slice(0, -1));
        }
      }
      // Also add parent directories
      const pathParts = relativePath.split('/');
      let parentPath = '';
      for (let i = 0; i < pathParts.length - 1; i++) {
        parentPath += (i > 0 ? '/' : '') + pathParts[i];
        validPaths.add(parentPath);
        validPaths.add(parentPath + '/');
      }
    }

    return validPaths;
  }
}
