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

  // Escape special regex characters in query
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  // Create case-insensitive regex
  const regex = new RegExp(`(${escapedQuery})`, 'gi');
  
  // Escape HTML first, then apply highlighting
  return escapeHtml(text).replace(
    regex,
    `<span class="${highlightClass}">$1</span>`
  );
}
