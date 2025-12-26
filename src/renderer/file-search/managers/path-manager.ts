/**
 * PathManager - Unified path management for file search
 *
 * Consolidates functionality from:
 * - PathDetectionManager: Detect clickable paths at coordinates
 * - PathScannerManager: Track and scan @paths in text
 * - TextInputPathManager: Insert/manipulate paths in textarea
 * - AtPathBehaviorManager: Handle @path behavior (backspace deletion)
 *
 * This manager handles all @path related operations including:
 * - @path tracking and validation against file system
 * - Path detection at mouse coordinates
 * - Path insertion with undo support
 * - Backspace deletion of @paths
 */

import type { AtPathRange, DirectoryData } from '../types';
import type { FileInfo } from '../../../types';
import { PathValidator } from './path-validator';
import { PathResolver } from './path-resolver';
import { PathTextEditor } from './path-text-editor';

// ============================================================================
// Callback Interfaces
// ============================================================================

/**
 * Core callbacks required by PathManager
 */
export interface PathManagerCallbacks {
  // Text content
  getTextContent: () => string;
  setTextContent?: (text: string) => void;

  // Cursor management
  getCursorPosition?: () => number;
  setCursorPosition?: (position: number) => void;

  // Undo support (optional, supports undefined for exactOptionalPropertyTypes)
  replaceRangeWithUndo?: ((start: number, end: number, text: string) => void) | undefined;

  // Highlight management
  updateHighlightBackdrop?: () => void;

  // File system
  checkFileExists?: (path: string) => Promise<boolean>;

  // Directory data
  getCachedDirectoryData?: () => DirectoryData | null;

  // Feature flags
  isCommandEnabledSync?: () => boolean;
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
  private validator: PathValidator;
  private resolver: PathResolver;
  private textEditor: PathTextEditor;

  constructor(callbacks: PathManagerCallbacks, textInput?: HTMLTextAreaElement) {

    // Create validator with required callbacks
    this.validator = new PathValidator({
      getTextContent: callbacks.getTextContent,
      checkFileExists: callbacks.checkFileExists,
      getCachedDirectoryData: callbacks.getCachedDirectoryData
    });

    // Create resolver with required callbacks
    this.resolver = new PathResolver(
      {
        getTextContent: callbacks.getTextContent,
        isCommandEnabledSync: callbacks.isCommandEnabledSync
      },
      textInput
    );

    // Create text editor with required callbacks
    this.textEditor = new PathTextEditor({
      getTextContent: callbacks.getTextContent,
      setTextContent: callbacks.setTextContent,
      getCursorPosition: callbacks.getCursorPosition,
      setCursorPosition: callbacks.setCursorPosition,
      replaceRangeWithUndo: callbacks.replaceRangeWithUndo,
      updateHighlightBackdrop: callbacks.updateHighlightBackdrop,
      addSelectedPath: (path: string) => this.resolver.addSelectedPath(path),
      removeSelectedPath: (path: string) => this.resolver.removeSelectedPath(path),
      findAtPathAtCursor: (cursorPos: number, text: string) => this.resolver.findAtPathAtCursor(cursorPos, text),
      getAtPaths: () => this.resolver.getAtPaths(),
      getSelectedPaths: () => this.resolver.getSelectedPaths()
    });
  }

  /**
   * Set the textarea element (for coordinate calculations)
   */
  public setTextInput(textInput: HTMLTextAreaElement): void {
    this.resolver.setTextInput(textInput);
  }

  // ==========================================================================
  // Path Scanning (delegated to PathResolver)
  // ==========================================================================

  /**
   * Get all tracked @paths
   */
  public getAtPaths(): AtPathRange[] {
    return this.resolver.getAtPaths();
  }

  /**
   * Get the selected paths set
   */
  public getSelectedPaths(): Set<string> {
    return this.resolver.getSelectedPaths();
  }

  /**
   * Add a path to the selectedPaths set
   */
  public addSelectedPath(path: string): void {
    this.resolver.addSelectedPath(path);
  }

  /**
   * Remove a path from the selectedPaths set
   */
  public removeSelectedPath(path: string): void {
    this.resolver.removeSelectedPath(path);
  }

  /**
   * Clear all tracked @paths (called when text is cleared)
   */
  public clearAtPaths(): void {
    this.resolver.clearAtPaths();
  }

  /**
   * Set the valid paths builder for validation (used by rescanAtPaths)
   */
  public setValidPathsBuilder(builder: () => Set<string> | null): void {
    this.resolver.setValidPathsBuilder(builder);
  }

  /**
   * Re-scan text for @paths.
   * Finds ALL @path patterns in text and validates them against:
   * 1. The selectedPaths set (paths explicitly selected by user)
   * 2. The cached file list (for Undo support - restores highlights for valid paths)
   */
  public rescanAtPaths(text: string, validPaths?: Set<string> | null): void {
    this.resolver.rescanAtPaths(text, validPaths);
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
  public async restoreAtPathsFromText(checkFilesystem: boolean = false, directoryData?: DirectoryDataForScanner | null): Promise<void> {
    // Validate paths using PathValidator
    const validatedPaths = await this.validator.restoreAtPathsFromText(checkFilesystem, directoryData);

    // Update resolver with validated paths
    this.resolver.restoreValidatedPaths(validatedPaths);
  }

  // ==========================================================================
  // Path Detection (delegated to PathResolver)
  // ==========================================================================

  /**
   * Find AtPathRange at the given position
   */
  public findAtPathRangeAtPosition(charPos: number): AtPathRange | null {
    return this.resolver.findAtPathRangeAtPosition(charPos);
  }

  /**
   * Check for any clickable path at position and return the range
   * Priority: @path > URL > slash command > absolute path
   */
  public findClickableRangeAtPosition(charPos: number): AtPathRange | null {
    return this.resolver.findClickableRangeAtPosition(charPos);
  }

  /**
   * Get character position from mouse coordinates using approximation
   */
  public getCharPositionFromCoordinates(clientX: number, clientY: number): number | null {
    return this.resolver.getCharPositionFromCoordinates(clientX, clientY);
  }

  /**
   * Find @path at the current cursor position
   * @param cursorPos - Current cursor position
   * @param text - Current text content
   * @returns The AtPathRange at cursor or null
   */
  public findAtPathAtCursor(cursorPos: number, text: string): AtPathRange | null {
    return this.resolver.findAtPathAtCursor(cursorPos, text);
  }

  // ==========================================================================
  // Text Input Path Management (delegated to PathTextEditor)
  // ==========================================================================

  /**
   * Insert file path, keeping the @ and replacing only the query part
   * Uses replaceRangeWithUndo for native Undo/Redo support
   * @param path - The path to insert
   * @param atStartPosition - Position of @ character
   * @returns The new atStartPosition (-1 after insertion)
   */
  public insertFilePath(path: string, atStartPosition: number): number {
    return this.textEditor.insertFilePath(path, atStartPosition);
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
    return this.textEditor.insertFilePathWithoutAt(path, atStartPosition);
  }

  /**
   * Update text input with the current path (keeps @ and updates the path after it)
   * @param path - The path to set
   * @param atStartPosition - Position of @ character
   */
  public updateTextInputWithPath(path: string, atStartPosition: number): void {
    this.textEditor.updateTextInputWithPath(path, atStartPosition);
  }

  /**
   * Remove the @query text from the textarea without inserting a file path
   * Used when opening a file with Ctrl+Enter
   * @param atStartPosition - Position of @ character
   */
  public removeAtQueryText(atStartPosition: number): void {
    this.textEditor.removeAtQueryText(atStartPosition);
  }

  /**
   * Handle backspace key for @path deletion
   * Deletes the entire @path when cursor is at the end
   * @param e - Keyboard event
   * @returns true if @path was deleted, false otherwise
   */
  public handleBackspaceForAtPath(e: KeyboardEvent): boolean {
    return this.textEditor.handleBackspaceForAtPath(e);
  }

  // ==========================================================================
  // Validation (delegated to PathValidator)
  // ==========================================================================

  /**
   * Build a set of valid paths from cached directory data
   * @returns Set of valid paths or null if no data
   */
  public buildValidPathsSet(): Set<string> | null {
    return this.validator.buildValidPathsSet();
  }
}
