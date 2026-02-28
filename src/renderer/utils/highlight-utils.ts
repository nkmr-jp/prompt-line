/**
 * Utility functions for text highlighting with HTML escaping
 */

import { escapeHtml } from './html-utils';

/**
 * Split a search query into normalized lowercase keywords.
 * Fast-paths the single-word case to avoid regex overhead.
 */
export function splitKeywords(query: string): string[] {
  if (query.indexOf(' ') === -1) {
    return query.length > 0 ? [query] : [];
  }
  return query.split(/\s+/).filter(k => k.length > 0);
}

/**
 * Build a single combined regex for multi-keyword highlighting.
 * Keywords are sorted by length descending for longest-match-first.
 */
export function buildKeywordRegex(keywords: string[], escape?: (k: string) => string): RegExp {
  const escapeFn = escape ?? ((k: string) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const escaped = keywords.map(escapeFn).sort((a, b) => b.length - a.length);
  return new RegExp(`(${escaped.join('|')})`, 'gi');
}

/**
 * Highlight matched text with specified CSS class
 *
 * @param text - Text to highlight
 * @param query - Search query to highlight
 * @param highlightClass - CSS class name for highlighted text (default: 'highlight')
 * @returns HTML string with highlighted matches
 *
 * @example
 * highlightMatch('Hello World', 'wor', 'search-highlight')
 * // Returns: 'Hello <span class="search-highlight">Wor</span>ld'
 */
export function highlightMatch(
  text: string,
  query: string,
  highlightClass: string = 'highlight'
): string {
  if (!query) return escapeHtml(text);

  const keywords = splitKeywords(query);
  if (keywords.length === 0) return escapeHtml(text);

  // Build a single combined regex (escape HTML in keywords first, then regex-escape)
  const regex = buildKeywordRegex(keywords, k => {
    return escapeHtml(k).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  });

  return escapeHtml(text).replace(regex, `<span class="${highlightClass}">$1</span>`);
}
