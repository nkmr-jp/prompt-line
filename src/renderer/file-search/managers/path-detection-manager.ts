/**
 * PathDetectionManager - Detects paths at mouse coordinates
 *
 * Responsibilities:
 * - Convert mouse coordinates to character position in textarea
 * - Find @path, URL, slash command, or absolute path at position
 * - Coordinate with text-finder utilities for pattern detection
 */

import type { AtPathRange } from '../types';
import {
  findAtPathAtPosition,
  findUrlAtPosition,
  findSlashCommandAtPosition,
  findClickablePathAtPosition
} from '../text-finder';

export interface PathDetectionCallbacks {
  getTextContent: () => string;
  getAtPaths: () => AtPathRange[];
  isCommandEnabledSync?: () => boolean;
}

/**
 * Detects clickable paths at mouse coordinates
 */
export class PathDetectionManager {
  private textInput: HTMLTextAreaElement;
  private callbacks: PathDetectionCallbacks;

  constructor(
    textInput: HTMLTextAreaElement,
    callbacks: PathDetectionCallbacks
  ) {
    this.textInput = textInput;
    this.callbacks = callbacks;
  }

  /**
   * Find AtPathRange at the given position
   */
  public findAtPathRangeAtPosition(charPos: number): AtPathRange | null {
    const atPaths = this.callbacks.getAtPaths();
    for (const atPath of atPaths) {
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
}
