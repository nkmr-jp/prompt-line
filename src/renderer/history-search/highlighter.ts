/**
 * Highlighter for History Search
 * Provides search term highlighting with XSS protection
 * Extracted from SearchManager for improved modularity
 */

import { escapeHtmlFast as escapeHtml } from '../utils/html-utils';

export class HistorySearchHighlighter {
  /** CSS class for highlighted text */
  private highlightClass: string;

  constructor(highlightClass: string = 'search-highlight') {
    this.highlightClass = highlightClass;
  }



  /**
   * Highlight search terms in text with XSS protection
   * Returns HTML string with highlighted matches
   */
  public highlightSearchTerms(text: string, searchTerm: string): string {
    // Return escaped text if no search term
    if (!searchTerm) {
      return escapeHtml(text);
    }

    // Escape both text and search term for safety
    const escapedText = escapeHtml(text);
    const escapedSearchTerm = escapeHtml(searchTerm);

    // Escape regex special characters in search term
    const escapedPattern = escapedSearchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Create case-insensitive regex for matching
    const regex = new RegExp(`(${escapedPattern})`, 'gi');

    // Replace matches with highlighted spans
    return escapedText.replace(
      regex,
      `<span class="${this.highlightClass}">$1</span>`
    );
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
