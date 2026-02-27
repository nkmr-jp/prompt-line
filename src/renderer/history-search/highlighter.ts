/**
 * Highlighter for History Search
 * Provides search term highlighting with XSS protection
 * Extracted from SearchManager for improved modularity
 */

import { escapeHtmlFast as escapeHtml } from '../utils/html-utils';

export class HistorySearchHighlighter {
  /** CSS class for highlighted text */
  private highlightClass: string;

  // Regex cache: avoids re-compiling RegExp per item when search term is unchanged
  private cachedSearchTerm: string = '';
  private cachedRegexes: RegExp[] = [];
  private cachedReplacement: string = '';
  // Plain-text regex cache for DOM-based highlighting (no HTML escaping needed)
  private cachedPlainRegexes: RegExp[] = [];

  constructor(highlightClass: string = 'search-highlight') {
    this.highlightClass = highlightClass;
    this.cachedReplacement = `<span class="${highlightClass}">$1</span>`;
  }

  /**
   * Split query into keywords (space-separated)
   * Filters out empty strings
   */
  private splitKeywords(query: string): string[] {
    return query.split(/\s+/).filter(k => k.length > 0);
  }

  /**
   * Highlight search terms in text with XSS protection
   * Supports multiple keywords (space-separated)
   * Returns HTML string with highlighted matches
   *
   * Performance: RegExp objects are cached per search term to avoid
   * re-compilation for each history item (typically 50 items per render)
   */
  public highlightSearchTerms(text: string, searchTerm: string): string {
    // Return escaped text if no search term
    if (!searchTerm) {
      return escapeHtml(text);
    }

    // Rebuild regex cache only when search term changes
    if (searchTerm !== this.cachedSearchTerm) {
      this.rebuildRegexCache(searchTerm);
    }

    if (this.cachedRegexes.length === 0) {
      return escapeHtml(text);
    }

    // Escape text for safety
    let result = escapeHtml(text);

    // Apply cached regexes
    const replacement = this.cachedReplacement;
    for (let i = 0; i < this.cachedRegexes.length; i++) {
      const regex = this.cachedRegexes[i]!;
      regex.lastIndex = 0;
      result = result.replace(regex, replacement);
    }

    return result;
  }

  /**
   * Highlight fuzzy match positions in text
   * For future enhancement when displaying fuzzy match details
   */
  public highlightFuzzyMatch(text: string, positions: number[]): string {
    if (positions.length === 0) {
      return escapeHtml(text);
    }

    const positionSet = new Set(positions);
    let result = '';
    let inHighlight = false;

    for (let i = 0; i < text.length; i++) {
      const isMatch = positionSet.has(i);
      const char = escapeHtml(text[i] || '');

      if (isMatch && !inHighlight) {
        result += `<span class="${this.highlightClass}">`;
        inHighlight = true;
      } else if (!isMatch && inHighlight) {
        result += '</span>';
        inHighlight = false;
      }

      result += char;
    }

    if (inHighlight) {
      result += '</span>';
    }

    return result;
  }

  /**
   * Rebuild regex caches for both HTML and plain-text highlighting
   */
  private rebuildRegexCache(searchTerm: string): void {
    this.cachedSearchTerm = searchTerm;
    const keywords = this.splitKeywords(searchTerm);
    // HTML-escaped regexes (for highlightSearchTerms)
    this.cachedRegexes = keywords.map(keyword => {
      const escapedKeyword = escapeHtml(keyword);
      const escapedPattern = escapedKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`(${escapedPattern})`, 'gi');
    });
    // Plain-text regexes (for applyHighlightDOM)
    this.cachedPlainRegexes = keywords.map(keyword => {
      const escapedPattern = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(escapedPattern, 'gi');
    });
  }

  /**
   * Apply search term highlighting directly to a DOM element.
   * Builds DOM nodes (TextNode + span) instead of innerHTML HTML parsing.
   * ~10x faster than innerHTML for 50-item renders.
   */
  public applyHighlightDOM(parent: HTMLElement, text: string, searchTerm: string): void {
    if (!searchTerm) {
      parent.textContent = text;
      return;
    }

    if (searchTerm !== this.cachedSearchTerm) {
      this.rebuildRegexCache(searchTerm);
    }

    if (this.cachedPlainRegexes.length === 0) {
      parent.textContent = text;
      return;
    }

    // Collect all match ranges
    const matches: Array<[number, number]> = [];
    for (const regex of this.cachedPlainRegexes) {
      regex.lastIndex = 0;
      let m;
      while ((m = regex.exec(text)) !== null) {
        matches.push([m.index, m.index + m[0].length]);
      }
    }

    if (matches.length === 0) {
      parent.textContent = text;
      return;
    }

    // Sort and merge overlapping ranges
    matches.sort((a, b) => a[0] - b[0]);
    const merged: Array<[number, number]> = [matches[0]!];
    for (let i = 1; i < matches.length; i++) {
      const last = merged[merged.length - 1]!;
      const curr = matches[i]!;
      if (curr[0] <= last[1]) {
        last[1] = Math.max(last[1], curr[1]);
      } else {
        merged.push(curr);
      }
    }

    // Build DOM nodes directly (avoids innerHTML HTML parsing overhead)
    parent.textContent = '';
    let lastIndex = 0;
    const highlightClass = this.highlightClass;
    for (const [start, end] of merged) {
      if (lastIndex < start) {
        parent.appendChild(document.createTextNode(text.substring(lastIndex, start)));
      }
      const span = document.createElement('span');
      span.className = highlightClass;
      span.textContent = text.substring(start, end);
      parent.appendChild(span);
      lastIndex = end;
    }
    if (lastIndex < text.length) {
      parent.appendChild(document.createTextNode(text.substring(lastIndex)));
    }
  }

  /**
   * Update the highlight CSS class
   */
  public setHighlightClass(className: string): void {
    this.highlightClass = className;
  }

  /**
   * Get the current highlight CSS class
   */
  public getHighlightClass(): string {
    return this.highlightClass;
  }
}
