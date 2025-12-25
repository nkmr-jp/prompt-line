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

    return this.checkAtPath(text, charPos) ||
           this.checkUrl(text, charPos) ||
           this.checkSlashCommand(text, charPos) ||
           this.checkAbsolutePath(text, charPos);
  }

  /**
   * Check for @path at position
   */
  private checkAtPath(text: string, charPos: number): AtPathRange | null {
    const atPath = findAtPathAtPosition(text, charPos);
    if (!atPath) return null;
    return this.findAtPathRangeAtPosition(charPos);
  }

  /**
   * Check for URL at position
   */
  private checkUrl(text: string, charPos: number): AtPathRange | null {
    const url = findUrlAtPosition(text, charPos);
    return url ? { start: url.start, end: url.end } : null;
  }

  /**
   * Check for slash command at position (if enabled)
   */
  private checkSlashCommand(text: string, charPos: number): AtPathRange | null {
    if (!this.callbacks.isCommandEnabledSync?.()) return null;
    const slashCommand = findSlashCommandAtPosition(text, charPos);
    return slashCommand ? { start: slashCommand.start, end: slashCommand.end } : null;
  }

  /**
   * Check for absolute path at position
   */
  private checkAbsolutePath(text: string, charPos: number): AtPathRange | null {
    const clickablePath = findClickablePathAtPosition(text, charPos);
    return clickablePath ? { start: clickablePath.start, end: clickablePath.end } : null;
  }

  /**
   * Get character position from mouse coordinates using approximation
   */
  public getCharPositionFromCoordinates(clientX: number, clientY: number): number | null {
    if (!this.textInput) return null;

    const { relativeX, relativeY } = this.calculateRelativePosition(clientX, clientY);
    const { lineHeight, charWidth } = this.getTextMetrics();
    const text = this.textInput.value;
    const lines = text.split('\n');

    const lineIndex = this.calculateLineIndex(relativeY, lineHeight, lines.length);
    const charIndex = this.calculateCharIndex(relativeX, charWidth);
    const absolutePos = this.calculateAbsolutePosition(lines, lineIndex, charIndex);

    return Math.min(absolutePos, text.length);
  }

  /**
   * Calculate relative position within textarea
   */
  private calculateRelativePosition(clientX: number, clientY: number): { relativeX: number; relativeY: number } {
    const textareaRect = this.textInput.getBoundingClientRect();
    return {
      relativeX: clientX - textareaRect.left + this.textInput.scrollLeft,
      relativeY: clientY - textareaRect.top + this.textInput.scrollTop
    };
  }

  /**
   * Get text metrics (line height and character width)
   */
  private getTextMetrics(): { lineHeight: number; charWidth: number } {
    const style = window.getComputedStyle(this.textInput);
    const lineHeight = parseFloat(style.lineHeight) || 20;
    const fontSize = parseFloat(style.fontSize) || 15;
    const charWidth = fontSize * 0.6; // Approximate for monospace fonts
    return { lineHeight, charWidth };
  }

  /**
   * Calculate line index from relative Y position
   */
  private calculateLineIndex(relativeY: number, lineHeight: number, lineCount: number): number {
    return Math.max(0, Math.min(Math.floor(relativeY / lineHeight), lineCount - 1));
  }

  /**
   * Calculate character index from relative X position
   */
  private calculateCharIndex(relativeX: number, charWidth: number): number {
    return Math.max(0, Math.floor(relativeX / charWidth));
  }

  /**
   * Calculate absolute position from line and character indices
   */
  private calculateAbsolutePosition(lines: string[], lineIndex: number, charIndex: number): number {
    let absolutePos = 0;
    for (let i = 0; i < lineIndex; i++) {
      absolutePos += (lines[i]?.length || 0) + 1; // +1 for newline
    }
    absolutePos += charIndex;
    return absolutePos;
  }
}
