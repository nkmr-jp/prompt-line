/**
 * DOM utilities for File Search module
 * Pure functions for DOM manipulation
 */

/**
 * Insert highlighted text into an element using safe DOM manipulation
 * This avoids innerHTML for security while allowing highlighting
 */
export function insertHighlightedText(element: HTMLElement, text: string, query: string): void {
  // Clear existing content
  element.textContent = '';

  if (!query) {
    element.textContent = text;
    return;
  }

  // Split query into keywords for multi-keyword highlighting
  const keywords = query.split(/\s+/).filter(k => k.length > 0);
  if (keywords.length === 0) {
    element.textContent = text;
    return;
  }

  // Build combined regex for all keywords (sorted by length desc for longest match first)
  const escapedKeywords = keywords
    .map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .sort((a, b) => b.length - a.length);
  const regex = new RegExp(`(${escapedKeywords.join('|')})`, 'gi');
  const keywordsLower = keywords.map(k => k.toLowerCase());

  // Split text by matches
  const parts = text.split(regex);

  parts.forEach(part => {
    if (keywordsLower.some(kw => part.toLowerCase() === kw)) {
      // This part matches a keyword - wrap in highlight span
      const highlight = document.createElement('span');
      highlight.className = 'highlight';
      highlight.textContent = part;
      element.appendChild(highlight);
    } else if (part) {
      // Non-matching part - add as text node
      element.appendChild(document.createTextNode(part));
    }
  });
}

/**
 * Calculate the pixel position of a character in the textarea
 * Uses a mirror div technique to measure text position
 *
 * @param textInput - The textarea element to calculate position for
 * @param mirrorDiv - A hidden div used for position calculation (will be modified)
 * @param position - The character position to calculate coordinates for
 * @returns The top/left coordinates relative to the viewport, or null if textInput is null
 */
export function getCaretCoordinates(
  textInput: HTMLTextAreaElement | null,
  mirrorDiv: HTMLDivElement,
  position: number
): { top: number; left: number } | null {
  if (!textInput) return null;

  // Copy textarea styles to mirror div
  const style = window.getComputedStyle(textInput);
  const properties = [
    'fontFamily', 'fontSize', 'fontWeight', 'fontStyle',
    'letterSpacing', 'textTransform', 'wordSpacing',
    'textIndent', 'whiteSpace', 'lineHeight',
    'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
    'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
    'boxSizing', 'width', 'tabSize'
  ];

  properties.forEach(prop => {
    const value = style.getPropertyValue(prop.replace(/([A-Z])/g, '-$1').toLowerCase());
    if (value) {
      mirrorDiv.style.setProperty(prop.replace(/([A-Z])/g, '-$1').toLowerCase(), value);
    }
  });

  // Get text up to the position and add a span marker
  const text = textInput.value.substring(0, position);
  const textNode = document.createTextNode(text);
  const marker = document.createElement('span');
  marker.textContent = '@'; // Use @ as marker

  mirrorDiv.innerHTML = '';
  mirrorDiv.appendChild(textNode);
  mirrorDiv.appendChild(marker);

  // Get marker position relative to mirror div
  const markerRect = marker.getBoundingClientRect();
  const mirrorRect = mirrorDiv.getBoundingClientRect();

  // Calculate position relative to textarea
  const textareaRect = textInput.getBoundingClientRect();

  return {
    top: markerRect.top - mirrorRect.top + textareaRect.top - textInput.scrollTop,
    left: markerRect.left - mirrorRect.left + textareaRect.left - textInput.scrollLeft
  };
}

/**
 * Create a mirror div element for caret position calculation
 * The div is positioned absolutely and hidden from view
 */
export function createMirrorDiv(): HTMLDivElement {
  const mirrorDiv = document.createElement('div');
  mirrorDiv.style.position = 'absolute';
  mirrorDiv.style.visibility = 'hidden';
  mirrorDiv.style.whiteSpace = 'pre-wrap';
  mirrorDiv.style.wordWrap = 'break-word';
  mirrorDiv.style.overflow = 'hidden';
  document.body.appendChild(mirrorDiv);
  return mirrorDiv;
}
