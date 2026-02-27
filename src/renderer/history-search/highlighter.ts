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
      this.cachedSearchTerm = searchTerm;
      const keywords = this.splitKeywords(searchTerm);
      this.cachedRegexes = keywords.map(keyword => {
        const escapedKeyword = escapeHtml(keyword);
        const escapedPattern = escapedKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`(${escapedPattern})`, 'gi');
      });
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
