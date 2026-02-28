/**
 * Utility functions for text highlighting with HTML escaping
 */

import { escapeHtml } from './html-utils';

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

  // Split query into keywords for multi-keyword highlighting
  const keywords = query.split(/\s+/).filter(k => k.length > 0);
  if (keywords.length === 0) return escapeHtml(text);

  let result = escapeHtml(text);

  // Apply highlighting for each keyword
  for (const keyword of keywords) {
    const escapedKeyword = escapeHtml(keyword).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedKeyword})`, 'gi');
    result = result.replace(regex, `<span class="${highlightClass}">$1</span>`);
  }

  return result;
}
