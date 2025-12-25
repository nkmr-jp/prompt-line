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
import { HoverStateManager } from './hover-state-manager';
import type { HoverStateCallbacks } from './hover-state-manager';
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
  private hoverState!: HoverStateManager;
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
    // BackdropRenderer callbacks
    const backdropCallbacks: BackdropRendererCallbacks = {
      getAtPaths: () => this.pathScanner.getAtPaths(),
      getCursorPositionPath: () => this.cursorHighlight.getCursorPositionPath(),
      getHoveredPath: () => this.hoverState.getHoveredPath(),
      getTextContent: () => this.callbacks.getTextContent(),
    };

    // PathDetectionManager callbacks
    const pathDetectionCallbacks: PathDetectionCallbacks = {
      getTextContent: () => this.callbacks.getTextContent(),
      getAtPaths: () => this.pathScanner.getAtPaths(),
      ...(this.callbacks.isCommandEnabledSync && { isCommandEnabledSync: this.callbacks.isCommandEnabledSync }),
    };

    // CursorHighlightManager callbacks
    const cursorHighlightCallbacks: CursorHighlightCallbacks = {
      getTextContent: () => this.callbacks.getTextContent(),
      getCursorPosition: () => this.callbacks.getCursorPosition(),
      ...(this.callbacks.updateHintText && { updateHintText: this.callbacks.updateHintText }),
      ...(this.callbacks.getDefaultHintText && { getDefaultHintText: this.callbacks.getDefaultHintText }),
      ...(this.callbacks.isFileSearchEnabled && { isFileSearchEnabled: this.callbacks.isFileSearchEnabled }),
      ...(this.callbacks.isCommandEnabledSync && { isCommandEnabledSync: this.callbacks.isCommandEnabledSync }),
      renderHighlightBackdrop: () => this.renderHighlightBackdropWithCursor(),
    };

    // HoverStateManager callbacks
    const hoverStateCallbacks: HoverStateCallbacks = {
      findClickableRangeAtPosition: (charPos: number) => this.pathDetection.findClickableRangeAtPosition(charPos),
      getCharPositionFromCoordinates: (x: number, y: number) => this.pathDetection.getCharPositionFromCoordinates(x, y),
      renderFilePathHighlight: () => this.renderFilePathHighlight(),
      clearFilePathHighlight: () => this.clearFilePathHighlight(),
    };

    // PathScannerManager callbacks
    const pathScannerCallbacks: PathScannerCallbacks = {
      getTextContent: () => this.callbacks.getTextContent(),
      ...(this.callbacks.checkFileExists && { checkFileExists: this.callbacks.checkFileExists }),
    };

    // Initialize managers
    this.backdropRenderer = new BackdropRenderer(this.textInput, this.highlightBackdrop, backdropCallbacks);
    this.pathDetection = new PathDetectionManager(this.textInput, pathDetectionCallbacks);
    this.cursorHighlight = new CursorHighlightManager(cursorHighlightCallbacks);
    this.hoverState = new HoverStateManager(hoverStateCallbacks);
    this.pathScanner = new PathScannerManager(pathScannerCallbacks);
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
    this.hoverState.clearHover();
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
    this.hoverState.onMouseMove(e);
  }

  /**
   * Handle Cmd key down
   */
  public onCmdKeyDown(): void {
    this.hoverState.onCmdKeyDown();
  }

  /**
   * Handle Cmd key up
   */
  public onCmdKeyUp(): void {
    this.hoverState.onCmdKeyUp();
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
