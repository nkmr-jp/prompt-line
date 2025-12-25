/**
 * HighlightManager - Manages @path highlighting and Cmd+click interactions
 *
 * This manager orchestrates specialized managers for:
 * - @path highlighting in textarea using backdrop layer
 * - Cmd+hover link style for @paths, URLs, slash commands, and absolute paths
 * - Ctrl+Enter hint text when cursor is on a clickable path
 * - Cursor position highlighting for absolute paths and URLs
 * - Scroll synchronization between textarea and backdrop
 * - @path tracking and validation against file system
 */

import type { AtPathRange } from '../types';
import type { FileInfo } from '../../../types';
import { BackdropRenderer } from './backdrop-renderer';
import type { BackdropRendererCallbacks } from './backdrop-renderer';
import { PathDetectionManager } from './path-detection-manager';
import type { PathDetectionCallbacks } from './path-detection-manager';
import { CursorHighlightManager } from './cursor-highlight-manager';
import type { CursorHighlightCallbacks } from './cursor-highlight-manager';
import { PathScannerManager } from './path-scanner-manager';
import type { PathScannerCallbacks } from './path-scanner-manager';

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

  // Specialized managers (initialized in initializeManagers)
  private backdropRenderer!: BackdropRenderer;
  private pathDetection!: PathDetectionManager;
  private cursorHighlight!: CursorHighlightManager;
  private pathScanner!: PathScannerManager;

  constructor(
    textInput: HTMLTextAreaElement,
    highlightBackdrop: HTMLDivElement,
    callbacks: HighlightManagerCallbacks
  ) {
    this.textInput = textInput;
    this.highlightBackdrop = highlightBackdrop;
    this.callbacks = callbacks;

    this.initializeManagers();
  }

  /**
   * Initialize specialized managers with delegation callbacks
   */
  private initializeManagers(): void {
    // PathScannerManager callbacks (initialized first, used by others)
    const pathScannerCallbacks: PathScannerCallbacks = {
      getTextContent: () => this.callbacks.getTextContent(),
      ...(this.callbacks.checkFileExists && { checkFileExists: this.callbacks.checkFileExists }),
    };
    this.pathScanner = new PathScannerManager(pathScannerCallbacks);

    // PathDetectionManager callbacks (initialized second, used by cursorHighlight)
    const pathDetectionCallbacks: PathDetectionCallbacks = {
      getTextContent: () => this.callbacks.getTextContent(),
      getAtPaths: () => this.pathScanner.getAtPaths(),
      ...(this.callbacks.isCommandEnabledSync && { isCommandEnabledSync: this.callbacks.isCommandEnabledSync }),
    };
    this.pathDetection = new PathDetectionManager(this.textInput, pathDetectionCallbacks);

    // CursorHighlightManager callbacks (includes hover state callbacks)
    const cursorHighlightCallbacks: CursorHighlightCallbacks = {
      getTextContent: () => this.callbacks.getTextContent(),
      getCursorPosition: () => this.callbacks.getCursorPosition(),
      ...(this.callbacks.updateHintText && { updateHintText: this.callbacks.updateHintText }),
      ...(this.callbacks.getDefaultHintText && { getDefaultHintText: this.callbacks.getDefaultHintText }),
      ...(this.callbacks.isFileSearchEnabled && { isFileSearchEnabled: this.callbacks.isFileSearchEnabled }),
      ...(this.callbacks.isCommandEnabledSync && { isCommandEnabledSync: this.callbacks.isCommandEnabledSync }),
      renderHighlightBackdrop: () => this.renderHighlightBackdropWithCursor(),
      // Hover state callbacks (consolidated from HoverStateManager)
      findClickableRangeAtPosition: (charPos: number) => this.pathDetection.findClickableRangeAtPosition(charPos),
      getCharPositionFromCoordinates: (x: number, y: number) => this.pathDetection.getCharPositionFromCoordinates(x, y),
      renderFilePathHighlight: () => this.renderFilePathHighlight(),
      clearFilePathHighlight: () => this.clearFilePathHighlightInternal(),
    };
    this.cursorHighlight = new CursorHighlightManager(cursorHighlightCallbacks);

    // BackdropRenderer callbacks (uses cursorHighlight for hover path)
    const backdropCallbacks: BackdropRendererCallbacks = {
      getAtPaths: () => this.pathScanner.getAtPaths(),
      getCursorPositionPath: () => this.cursorHighlight.getCursorPositionPath(),
      getHoveredPath: () => this.cursorHighlight.getHoveredPath(),
      getTextContent: () => this.callbacks.getTextContent(),
    };
    this.backdropRenderer = new BackdropRenderer(this.textInput, this.highlightBackdrop, backdropCallbacks);
  }

  /**
   * Update the highlight backdrop to show @path highlights
   */
  public updateHighlightBackdrop(): void {
    if (!this.highlightBackdrop || !this.textInput) return;

    const text = this.textInput.value;

    // Re-scan for @paths in the text (in case user edited)
    this.pathScanner.rescanAtPaths(text);

    this.backdropRenderer.updateHighlightBackdrop();
  }

  /**
   * Render highlight backdrop with cursor position highlight
   * @paths get their own highlight, absolute paths get cursor highlight
   */
  public renderHighlightBackdropWithCursor(): void {
    if (!this.highlightBackdrop || !this.textInput) return;

    const text = this.textInput.value;

    // Re-scan for @paths
    this.pathScanner.rescanAtPaths(text);

    this.backdropRenderer.renderHighlightBackdropWithCursor();
  }

  /**
   * Render file path highlight (link style) while preserving @path highlights
   */
  public renderFilePathHighlight(): void {
    if (!this.highlightBackdrop || !this.textInput) return;

    const text = this.textInput.value;

    // Re-scan for @paths
    this.pathScanner.rescanAtPaths(text);

    this.backdropRenderer.renderFilePathHighlight();
  }

  /**
   * Clear file path highlight (link style) while preserving @path highlights
   */
  public clearFilePathHighlight(): void {
    this.cursorHighlight.clearHover();
  }

  /**
   * Internal method to clear file path highlight (used by cursorHighlight callback)
   * This renders the backdrop without the hover highlight
   */
  private clearFilePathHighlightInternal(): void {
    // Re-render backdrop without hover highlight (hover state is already cleared)
    this.updateHighlightBackdrop();
  }

  /**
   * Update cursor position highlight (called when cursor moves)
   * Only highlights absolute file paths and URLs, not @paths (which already have their own highlight)
   * Also updates hint text to show Ctrl+Enter shortcut when on a clickable path or URL
   */
  public updateCursorPositionHighlight(): void {
    if (!this.textInput) return;

    this.cursorHighlight.updateCursorPositionHighlight();
  }

  /**
   * Re-scan text for @paths.
   * Finds ALL @path patterns in text and validates them against:
   * 1. The selectedPaths set (paths explicitly selected by user)
   * 2. The cached file list (for Undo support - restores highlights for valid paths)
   */
  public rescanAtPaths(text: string, validPaths?: Set<string> | null): void {
    this.pathScanner.rescanAtPaths(text, validPaths);
  }

  /**
   * Sync the scroll position of the highlight backdrop with the textarea
   */
  public syncBackdropScroll(): void {
    this.backdropRenderer.syncBackdropScroll();
  }

  /**
   * Get character position from mouse coordinates using mirror div
   */
  public getCharPositionFromCoordinates(clientX: number, clientY: number): number | null {
    return this.pathDetection.getCharPositionFromCoordinates(clientX, clientY);
  }

  /**
   * Handle mouse move for Cmd+hover link style
   */
  public onMouseMove(e: MouseEvent): void {
    this.cursorHighlight.onMouseMove(e);
  }

  /**
   * Handle Cmd key down
   */
  public onCmdKeyDown(): void {
    this.cursorHighlight.onCmdKeyDown();
  }

  /**
   * Handle Cmd key up
   */
  public onCmdKeyUp(): void {
    this.cursorHighlight.onCmdKeyUp();
  }

  /**
   * Clear all tracked @paths (called when text is cleared)
   */
  public clearAtPaths(): void {
    this.pathScanner.clearAtPaths();
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
    await this.pathScanner.restoreAtPathsFromText(checkFilesystem, directoryData);
    this.updateHighlightBackdrop();
  }

  /**
   * Add a path to the selectedPaths set
   */
  public addSelectedPath(path: string): void {
    this.pathScanner.addSelectedPath(path);
  }

  /**
   * Remove a path from the selectedPaths set
   */
  public removeSelectedPath(path: string): void {
    this.pathScanner.removeSelectedPath(path);
  }

  /**
   * Get all tracked @paths
   */
  public getAtPaths(): AtPathRange[] {
    return this.pathScanner.getAtPaths();
  }

  /**
   * Get the selected paths set
   */
  public getSelectedPaths(): Set<string> {
    return this.pathScanner.getSelectedPaths();
  }

  /**
   * Set the valid paths set for validation (used by rescanAtPaths)
   */
  public setValidPathsBuilder(builder: () => Set<string> | null): void {
    this.pathScanner.setValidPathsBuilder(builder);
  }
}
