/**
 * PathManager - Unified path management for file search
 *
 * Consolidated from:
 * - PathManager: Main orchestration
 * - PathValidator: Path validation and verification logic
 * - PathResolver: Path resolution and detection logic
 * - PathTextEditor: Text input path manipulation
 *
 * Responsibilities:
 * - @path tracking and validation against file system
 * - Path detection at mouse coordinates
 * - Path insertion with undo support
 * - Backspace deletion of @paths
 * - Build valid path sets for validation
 */

import type { AtPathRange, DirectoryData } from '../types';
import type { FileInfo } from '../../../types';
import {
  findAtPathAtPosition,
  findUrlAtPosition,
  findSlashCommandAtPosition,
  findClickablePathAtPosition
} from '../text-finder';
import { getRelativePath, parsePathWithLineInfo, formatLog } from '../index';

// ============================================================================
// Callback Interfaces
// ============================================================================

/**
 * Core callbacks required by PathManager
 */
export interface PathManagerCallbacks {
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

  // File system
  checkFileExists?: ((path: string) => Promise<boolean>) | undefined;

  // Directory data
  getCachedDirectoryData?: (() => DirectoryData | null) | undefined;

  // Feature flags
  isCommandEnabledSync?: (() => boolean) | undefined;
}

/**
 * Directory data structure for scanner operations
 */
export interface DirectoryDataForScanner {
  directory: string;
  files: FileInfo[];
}

// ============================================================================
// PathManager Class
// ============================================================================

/**
 * Unified path management for file search
 */
export class PathManager {
  private callbacks: PathManagerCallbacks;
  private textInput: HTMLTextAreaElement | null = null;

  // @path tracking state (from PathResolver)
  private atPaths: AtPathRange[] = [];
  private selectedPaths: Set<string> = new Set();
  private validPathsBuilder: (() => Set<string> | null) = () => null;

  // Registered at-paths with spaces (loaded from persistent cache)
  // These paths are matched before the default regex to support symbol names with spaces
  private registeredAtPaths: Set<string> = new Set();

  /**
   * Set registered at-paths from persistent cache
   * These paths may contain spaces and are matched before the default regex
   */
  public setRegisteredAtPaths(paths: string[]): void {
    this.registeredAtPaths = new Set(paths);
    console.debug('[PathManager] Set registered at-paths:', {
      count: this.registeredAtPaths.size
    });
  }

  /**
   * Get registered at-paths
   */
  public getRegisteredAtPaths(): Set<string> {
    return new Set(this.registeredAtPaths);
  }

  constructor(callbacks: PathManagerCallbacks, textInput?: HTMLTextAreaElement) {
    this.callbacks = callbacks;
    this.textInput = textInput || null;
  }

  /**
   * Set the textarea element (for coordinate calculations)
   */
  public setTextInput(textInput: HTMLTextAreaElement): void {
    this.textInput = textInput;
  }

  // ==========================================================================
  // Path Scanning
  // ==========================================================================

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
   * Add a path to the selectedPaths set
   */
  public addSelectedPath(path: string): void {
    this.selectedPaths.add(path);
    console.debug('[PathManager] Added path to selectedPaths:', path, 'total:', this.selectedPaths.size);
  }

  /**
   * Remove a path from the selectedPaths set
   */
  public removeSelectedPath(path: string): void {
    this.selectedPaths.delete(path);
    console.debug('[PathManager] Removed path from selectedPaths:', path);
  }

  /**
   * Clear all tracked @paths (called when text is cleared)
   */
  public clearAtPaths(): void {
    this.atPaths = [];
    this.selectedPaths.clear();
  }

  /**
   * Set the valid paths builder for validation (used by rescanAtPaths)
   */
  public setValidPathsBuilder(builder: () => Set<string> | null): void {
    this.validPathsBuilder = builder;
  }

  /**
   * Re-scan text for @paths.
   * Finds ALL @path patterns in text and validates them against:
   * 1. The registeredAtPaths set (paths with spaces from persistent cache)
   * 2. The selectedPaths set (paths explicitly selected by user)
   * 3. The cached file list (for Undo support - restores highlights for valid paths)
   *
   * Phase 3 improvement: Valid paths are automatically added to selectedPaths
   * for persistence, ensuring highlights survive cache invalidation.
   */
  public rescanAtPaths(text: string, validPaths?: Set<string> | null): void {
    const foundPaths: AtPathRange[] = [];
    const validPathsSet = validPaths !== undefined ? validPaths : this.validPathsBuilder();

    // Track consumed character ranges to avoid overlapping matches
    const consumedRanges: Array<{ start: number; end: number }> = [];

    // Helper to check if a position is already consumed
    const isConsumed = (start: number, end: number): boolean => {
      return consumedRanges.some(range =>
        (start >= range.start && start < range.end) ||
        (end > range.start && end <= range.end) ||
        (start <= range.start && end >= range.end)
      );
    };

    // Phase 1: Match paths that may contain spaces (from both registeredAtPaths and selectedPaths)
    // Combine both sets to handle:
    // - registeredAtPaths: paths loaded from persistent cache on window show
    // - selectedPaths: paths just selected in this session (not yet in persistent cache)
    // Sort by length descending to prefer longer matches
    const pathsWithSpaces = new Set([...this.registeredAtPaths, ...this.selectedPaths]);
    const sortedPathsWithSpaces = [...pathsWithSpaces].sort((a, b) => b.length - a.length);

    for (const pathWithSpace of sortedPathsWithSpaces) {
      const searchPattern = '@' + pathWithSpace;
      let searchIndex = 0;

      while (searchIndex < text.length) {
        const foundIndex = text.indexOf(searchPattern, searchIndex);
        if (foundIndex === -1) break;

        const start = foundIndex;
        const end = foundIndex + searchPattern.length;

        // Only add if not already consumed
        if (!isConsumed(start, end)) {
          foundPaths.push({ start, end, path: pathWithSpace });
          consumedRanges.push({ start, end });
        }

        searchIndex = foundIndex + 1;
      }
    }

    // Phase 2: Find remaining @path patterns using default regex
    const atPathPattern = /@([^\s@]+)/g;
    let match;

    while ((match = atPathPattern.exec(text)) !== null) {
      const pathContent = match[1];
      if (!pathContent) continue;

      const start = match.index;
      const end = start + 1 + pathContent.length; // +1 for @

      // Skip if this range is already consumed by a registered path
      if (isConsumed(start, end)) continue;

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

        // Phase 3: Persist valid paths to selectedPaths for robustness
        // This ensures highlights survive cache invalidation
        if (isValidCachedPath && !isSelected) {
          this.selectedPaths.add(pathContent);
        }
      }
    }

    // Sort by start position and update
    foundPaths.sort((a, b) => a.start - b.start);
    this.atPaths = foundPaths;
  }

  /**
   * Restore validated paths
   * @param validatedPaths - Set of validated paths
   */
  public restoreValidatedPaths(validatedPaths: Set<string>): void {
    this.atPaths = [];
    this.selectedPaths = validatedPaths;

    console.debug('[PathManager] Restored validated paths:', {
      selectedPathsCount: this.selectedPaths.size
    });
  }

  /**
   * Restore @paths from text (called when draft is restored or directory data is updated)
   * This auto-detects @paths in the text and adds them to tracking
   * Only highlights @paths that actually exist (checked against cached file list or filesystem)
   *
   * Phase 3 improvement: When cache is unavailable and filesystem check is disabled,
   * existing selectedPaths are preserved to maintain highlight stability.
   *
   * @param checkFilesystem - If true, checks filesystem for file existence when cached file list is empty.
   *                          Use this when restoring from draft with empty file list (fromDraft).
   * @param directoryData - Directory data for validation (optional)
   */
  public async restoreAtPathsFromText(checkFilesystem: boolean = false, directoryData?: DirectoryDataForScanner | null): Promise<void> {
    const text = this.callbacks.getTextContent();
    const validatedPaths = new Set<string>();

    console.debug('[PathManager] Restoring @paths from text:', {
      textLength: text.length,
      checkFilesystem,
      hasDirectoryData: !!directoryData,
      existingSelectedPaths: this.selectedPaths.size
    });

    // Need cached directory data to check if files exist (or need to check filesystem)
    const hasValidCachedData = directoryData?.files &&
                                directoryData.files.length > 0 &&
                                directoryData?.directory;
    const baseDir = directoryData?.directory;

    if (!checkFilesystem && !hasValidCachedData) {
      // Phase 3: When no cache and not checking filesystem, preserve existing selectedPaths
      // This prevents highlights from disappearing when cache is temporarily unavailable
      if (this.selectedPaths.size > 0) {
        console.debug('[PathManager] No cached data, preserving existing selectedPaths:', {
          selectedPathsCount: this.selectedPaths.size
        });
        // Re-scan with existing selectedPaths (don't reset them)
        this.rescanAtPaths(text, null);
        return;
      }
      console.debug('[PathManager] No cached data and no existing selectedPaths, skipping validation');
      this.restoreValidatedPaths(validatedPaths);
      return;
    }

    // Build a set of relative paths for quick lookup (only if we have valid cached data)
    let relativePaths: Set<string> | null = null;
    if (hasValidCachedData && directoryData) {
      relativePaths = this.buildRelativePathsSet(directoryData.files, baseDir!);
      console.debug('[PathManager] Built relative path set:', {
        pathCount: relativePaths.size
      });
    }

    // Find all @path patterns
    const atPathPattern = /@([^\s@]+)/g;
    let match;

    while ((match = atPathPattern.exec(text)) !== null) {
      const pathContent = match[1];
      if (!pathContent) continue;

      // Parse path to extract clean path (without line number and symbol name)
      const parsedPath = parsePathWithLineInfo(pathContent);
      const cleanPath = parsedPath.path;

      // Check if file exists (either in cache or filesystem)
      let shouldInclude = false;

      if (relativePaths && relativePaths.has(cleanPath)) {
        // Path exists in cached file list
        shouldInclude = true;
        console.debug('[PathManager] Found @path in cache:', {
          pathContent,
          cleanPath,
          isSymbolPath: !!parsedPath.lineNumber
        });
      } else if (checkFilesystem && this.callbacks.checkFileExists) {
        // Check filesystem if cache lookup failed and checkFilesystem is true
        try {
          const exists = await this.callbacks.checkFileExists(cleanPath);
          shouldInclude = exists;
          console.debug('[PathManager] Checked filesystem for @path:', {
            pathContent,
            cleanPath,
            exists,
            isSymbolPath: !!parsedPath.lineNumber
          });
        } catch (err) {
          console.error('[PathManager] Error checking file existence:', err);
          shouldInclude = false;
        }
      }

      if (shouldInclude) {
        // Use the full pathContent (including line number and symbol name if present)
        validatedPaths.add(pathContent);
        console.debug('[PathManager] Found valid @path:', {
          pathContent,
          cleanPath,
          checkFilesystem,
          isSymbolPath: !!parsedPath.lineNumber
        });
      } else {
        console.debug('[PathManager] Skipping non-existent @path:', pathContent);
      }
    }

    console.debug('[PathManager] Validated @paths from text:', {
      validatedPathsCount: validatedPaths.size,
      textLength: text.length,
      checkFilesystem
    });

    // Update with validated paths
    this.restoreValidatedPaths(validatedPaths);
  }

  // ==========================================================================
  // Path Detection
  // ==========================================================================

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

  /**
   * Check for any clickable path at position and return the range
   * Priority: @path > URL > slash command > absolute path
   */
  public findClickableRangeAtPosition(charPos: number): AtPathRange | null {
    const text = this.callbacks.getTextContent();

    // Check for @path first
    const atPath = findAtPathAtPosition(text, charPos);
    if (atPath) {
      const atPathRange = this.findAtPathRangeAtPosition(charPos);
      if (atPathRange) {
        return atPathRange;
      }
    }

    // Check for URL
    const url = findUrlAtPosition(text, charPos);
    if (url) {
      return { start: url.start, end: url.end };
    }

    // Check for slash command (if enabled)
    if (this.callbacks.isCommandEnabledSync?.()) {
      const slashCommand = findSlashCommandAtPosition(text, charPos);
      if (slashCommand) {
        return { start: slashCommand.start, end: slashCommand.end };
      }
    }

    // Check for absolute path
    const clickablePath = findClickablePathAtPosition(text, charPos);
    if (clickablePath) {
      return { start: clickablePath.start, end: clickablePath.end };
    }

    return null;
  }

  /**
   * Get character position from mouse coordinates using approximation
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
   * Find @path at the current cursor position
   * @param cursorPos - Current cursor position
   * @param text - Current text content
   * @returns The AtPathRange at cursor or null
   */
  public findAtPathAtCursor(cursorPos: number, text: string): AtPathRange | null {
    for (const path of this.atPaths) {
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

  // ==========================================================================
  // Text Input Path Management
  // ==========================================================================

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
    this.addSelectedPath(path);

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
    const atPath = this.findAtPathAtCursor(cursorPos, text);

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
    } else if (this.callbacks.setTextContent) {
      // Fallback to direct text manipulation (no Undo support)
      const newText = text.substring(0, savedStart) + text.substring(deleteEnd);
      this.callbacks.setTextContent(newText);
    }

    // Update highlight backdrop (rescanAtPaths will recalculate all positions)
    this.callbacks.updateHighlightBackdrop?.();

    // Use requestAnimationFrame to ensure cursor position is set after all event handlers
    // (input event triggers checkForFileSearch, updateHighlightBackdrop, updateCursorPositionHighlight)
    // and DOM updates are complete. This prevents cursor position from being overwritten
    // by other handlers that may run synchronously or in subsequent frames.
    requestAnimationFrame(() => {
      this.callbacks.setCursorPosition?.(savedStart);
    });

    // After update, check if this path still exists in the text
    // If not, remove it from selectedPaths
    if (deletedPathContent && !this.atPaths.some(p => p.path === deletedPathContent)) {
      this.removeSelectedPath(deletedPathContent);
      console.debug('[PathManager] Removed path from selectedPaths after deletion:', deletedPathContent);
    }

    console.debug('[PathManager] deleted @path:', formatLog({
      deletedStart: savedStart,
      deletedEnd: deleteEnd,
      deletedPath: deletedPathContent || 'unknown',
      remainingPaths: this.atPaths.length,
      selectedPathsCount: this.selectedPaths.size
    }));

    return true;
  }

  // ==========================================================================
  // Validation
  // ==========================================================================

  /**
   * Build a set of relative paths from file list
   * Includes both files and parent directories
   */
  public buildRelativePathsSet(files: FileInfo[], baseDir: string): Set<string> {
    const relativePaths = new Set<string>();

    for (const file of files) {
      const relativePath = getRelativePath(file.path, baseDir);
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

    return relativePaths;
  }

  /**
   * Build a set of valid paths from cached directory data
   * @returns Set of valid paths or null if no data
   */
  public buildValidPathsSet(): Set<string> | null {
    const cachedData = this.callbacks.getCachedDirectoryData?.();
    if (!cachedData?.files || cachedData.files.length === 0) {
      return null;
    }

    const baseDir = cachedData.directory;
    const validPaths = new Set<string>();

    for (const file of cachedData.files) {
      const relativePath = getRelativePath(file.path, baseDir);
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
