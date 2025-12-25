/**
 * BackdropRenderer - Renders highlight backdrop with various highlight types
 *
 * Responsibilities:
 * - Render @path highlights in backdrop
 * - Render cursor position highlights for absolute paths
 * - Render Cmd+hover link style highlights
 * - Sync backdrop scroll with textarea
 */

import type { AtPathRange } from '../types';

export interface BackdropRendererCallbacks {
  getAtPaths: () => AtPathRange[];
  getCursorPositionPath: () => AtPathRange | null;
  getHoveredPath: () => AtPathRange | null;
  getTextContent: () => string;
}

/**
 * Manages backdrop rendering for all highlight types
 */
export class BackdropRenderer {
  private textInput: HTMLTextAreaElement;
  private highlightBackdrop: HTMLDivElement;
  private callbacks: BackdropRendererCallbacks;

  constructor(
    textInput: HTMLTextAreaElement,
    highlightBackdrop: HTMLDivElement,
    callbacks: BackdropRendererCallbacks
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

    const text = this.callbacks.getTextContent();
    const atPaths = this.callbacks.getAtPaths();

    if (atPaths.length === 0) {
      // No @paths, just mirror the text
      this.highlightBackdrop.textContent = text;
      return;
    }

    // Build highlighted content
    const fragment = this.buildHighlightFragment(text, atPaths.map(ap => ({
      ...ap,
      className: 'at-path-highlight'
    })));

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

    const hoveredPath = this.callbacks.getHoveredPath();
    if (hoveredPath) {
      this.renderFilePathHighlight();
      return;
    }

    const text = this.callbacks.getTextContent();
    const allHighlightRanges = this.collectCursorHighlightRanges();

    const fragment = this.buildCursorHighlightFragment(text, allHighlightRanges);
    this.replaceBackdropContent(fragment);
    this.syncBackdropScroll();
  }

  /**
   * Collect all highlight ranges for cursor mode
   */
  private collectCursorHighlightRanges(): Array<AtPathRange & { isAtPath: boolean; isCursorHighlight: boolean }> {
    const atPaths = this.callbacks.getAtPaths();
    const allHighlightRanges: Array<AtPathRange & { isAtPath: boolean; isCursorHighlight: boolean }> = [];

    // Add @paths
    for (const atPath of atPaths) {
      allHighlightRanges.push({ ...atPath, isAtPath: true, isCursorHighlight: false });
    }

    // Add cursor position path if not already an @path
    const cursorPositionPath = this.callbacks.getCursorPositionPath();
    if (cursorPositionPath) {
      const isAlreadyAtPath = atPaths.some(
        ap => ap.start === cursorPositionPath.start && ap.end === cursorPositionPath.end
      );
      if (!isAlreadyAtPath) {
        allHighlightRanges.push({ ...cursorPositionPath, isAtPath: false, isCursorHighlight: true });
      }
    }

    allHighlightRanges.sort((a, b) => a.start - b.start);
    return allHighlightRanges;
  }

  /**
   * Build fragment for cursor highlight mode
   */
  private buildCursorHighlightFragment(
    text: string,
    ranges: Array<AtPathRange & { isAtPath: boolean; isCursorHighlight: boolean }>
  ): DocumentFragment {
    const fragment = document.createDocumentFragment();
    let lastEnd = 0;

    for (const range of ranges) {
      if (range.start > lastEnd) {
        fragment.appendChild(document.createTextNode(text.substring(lastEnd, range.start)));
      }

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

    if (lastEnd < text.length) {
      fragment.appendChild(document.createTextNode(text.substring(lastEnd)));
    }

    return fragment;
  }

  /**
   * Render file path highlight (link style) while preserving @path highlights
   */
  public renderFilePathHighlight(): void {
    if (!this.highlightBackdrop || !this.textInput) return;

    const text = this.callbacks.getTextContent();
    const hoveredPath = this.callbacks.getHoveredPath();

    if (!hoveredPath) return;

    const allHighlightRanges = this.collectLinkHighlightRanges(hoveredPath);
    const fragment = this.buildLinkHighlightFragment(text, allHighlightRanges);
    this.replaceBackdropContent(fragment);
    this.syncBackdropScroll();
  }

  /**
   * Collect all highlight ranges for link mode
   */
  private collectLinkHighlightRanges(
    hoveredPath: AtPathRange
  ): Array<AtPathRange & { isAtPath: boolean; isHovered: boolean }> {
    const atPaths = this.callbacks.getAtPaths();
    const isHoveredAtPathInAtPaths = atPaths.some(
      ap => ap.start === hoveredPath.start && ap.end === hoveredPath.end
    );

    const allHighlightRanges: Array<AtPathRange & { isAtPath: boolean; isHovered: boolean }> = [];

    // Add @paths
    for (const atPath of atPaths) {
      const isHovered = hoveredPath &&
                        atPath.start === hoveredPath.start &&
                        atPath.end === hoveredPath.end;
      allHighlightRanges.push({ ...atPath, isAtPath: true, isHovered: !!isHovered });
    }

    // Add hovered path if not an @path
    if (!isHoveredAtPathInAtPaths) {
      allHighlightRanges.push({ ...hoveredPath, isAtPath: false, isHovered: true });
    }

    allHighlightRanges.sort((a, b) => a.start - b.start);
    return allHighlightRanges;
  }

  /**
   * Build fragment for link highlight mode
   */
  private buildLinkHighlightFragment(
    text: string,
    ranges: Array<AtPathRange & { isAtPath: boolean; isHovered: boolean }>
  ): DocumentFragment {
    const fragment = document.createDocumentFragment();
    let lastEnd = 0;

    for (const range of ranges) {
      if (range.start > lastEnd) {
        fragment.appendChild(document.createTextNode(text.substring(lastEnd, range.start)));
      }

      const span = document.createElement('span');
      if (range.isHovered) {
        span.className = range.isAtPath ? 'at-path-highlight file-path-link' : 'file-path-link';
      } else {
        span.className = 'at-path-highlight';
      }
      span.textContent = text.substring(range.start, range.end);
      fragment.appendChild(span);

      lastEnd = range.end;
    }

    if (lastEnd < text.length) {
      fragment.appendChild(document.createTextNode(text.substring(lastEnd)));
    }

    return fragment;
  }

  /**
   * Replace backdrop content safely
   */
  private replaceBackdropContent(fragment: DocumentFragment): void {
    while (this.highlightBackdrop.firstChild) {
      this.highlightBackdrop.removeChild(this.highlightBackdrop.firstChild);
    }
    this.highlightBackdrop.appendChild(fragment);
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
   * Build a DocumentFragment with highlighted ranges
   */
  private buildHighlightFragment(
    text: string,
    ranges: Array<AtPathRange & { className: string }>
  ): DocumentFragment {
    const fragment = document.createDocumentFragment();
    let lastEnd = 0;

    for (const range of ranges) {
      // Add text before this range
      if (range.start > lastEnd) {
        fragment.appendChild(document.createTextNode(text.substring(lastEnd, range.start)));
      }

      // Add highlighted range
      const span = document.createElement('span');
      span.className = range.className;
      span.textContent = text.substring(range.start, range.end);
      fragment.appendChild(span);

      lastEnd = range.end;
    }

    // Add remaining text
    if (lastEnd < text.length) {
      fragment.appendChild(document.createTextNode(text.substring(lastEnd)));
    }

    return fragment;
  }
}
