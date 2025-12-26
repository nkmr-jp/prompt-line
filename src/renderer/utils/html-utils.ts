/**
 * HTML entity map for XSS prevention
 */
export const HTML_ENTITY_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#039;'
};

/**
 * Escape HTML special characters using DOM API (safer, prevents XSS)
 * Uses browser's built-in text content to HTML conversion
 * 
 * @param text - Text to escape
 * @returns HTML-escaped text
 * 
 * @example
 * escapeHtml('<script>alert("XSS")</script>')
 * // Returns: '&lt;script&gt;alert("XSS")&lt;/script&gt;'
 */
export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Escape HTML special characters using regex replacement (faster)
 * More performant for high-frequency operations like search highlighting
 * 
 * @param text - Text to escape
 * @returns HTML-escaped text
 * 
 * @example
 * escapeHtmlFast('<script>alert("XSS")</script>')
 * // Returns: '&lt;script&gt;alert("XSS")&lt;/script&gt;'
 */
export function escapeHtmlFast(text: string): string {
  return text.replace(/[&<>"']/g, (char) => HTML_ENTITY_MAP[char] || char);
}
