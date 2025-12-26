/**
 * PathResolver - Path resolution and detection logic
 *
 * Responsibilities:
 * - Scan and track @paths in text
 * - Detect paths at coordinates
 * - Find clickable paths and ranges
 */

import type { AtPathRange } from '../types';
import {
  findAtPathAtPosition,
  findUrlAtPosition,
  findSlashCommandAtPosition,
  findClickablePathAtPosition
} from '../text-finder';
import { parsePathWithLineInfo } from '../index';

/**
 * Callbacks required by PathResolver
 */
export interface PathResolverCallbacks {
  getTextContent: () => string;
  isCommandEnabledSync?: (() => boolean) | undefined;
}

/**
 * PathResolver - Handles path detection and resolution
 */
export class PathResolver {
  private textInput: HTMLTextAreaElement | null = null;
  private callbacks: PathResolverCallbacks;

  // @path tracking state
  private atPaths: AtPathRange[] = [];
  private selectedPaths: Set<string> = new Set();
  private validPathsBuilder: (() => Set<string> | null) = () => null;

  constructor(callbacks: PathResolverCallbacks, textInput?: HTMLTextAreaElement) {
    this.callbacks = callbacks;
    this.textInput = textInput || null;
  }

  /**
   * Set the textarea element (for coordinate calculations)
   */
  public setTextInput(textInput: HTMLTextAreaElement): void {
    this.textInput = textInput;
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
   * Add a path to the selectedPaths set
   */
  public addSelectedPath(path: string): void {
    this.selectedPaths.add(path);
    console.debug('[PathResolver] Added path to selectedPaths:', path, 'total:', this.selectedPaths.size);
  }

  /**
   * Remove a path from the selectedPaths set
   */
  public removeSelectedPath(path: string): void {
    this.selectedPaths.delete(path);
    console.debug('[PathResolver] Removed path from selectedPaths:', path);
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
   * 1. The selectedPaths set (paths explicitly selected by user)
   * 2. The cached file list (for Undo support - restores highlights for valid paths)
   */
  public rescanAtPaths(text: string, validPaths?: Set<string> | null): void {
    const foundPaths: AtPathRange[] = [];
    const validPathsSet = validPaths !== undefined ? validPaths : this.validPathsBuilder();

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
   * Restore validated paths from validator
   * @param validatedPaths - Set of validated paths from PathValidator
   */
  public restoreValidatedPaths(validatedPaths: Set<string>): void {
    this.atPaths = [];
    this.selectedPaths = validatedPaths;

    console.debug('[PathResolver] Restored validated paths:', {
      selectedPathsCount: this.selectedPaths.size
    });
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
}
