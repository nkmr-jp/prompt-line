/**
 * Parse and match keyboard shortcuts
 */

export interface ParsedShortcut {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

/**
 * Parse a shortcut string like "Ctrl+j" or "Cmd+Enter" into a ParsedShortcut object
 */
export function parseShortcut(shortcut: string): ParsedShortcut {
  const parts = shortcut.toLowerCase().split('+');
  const key = parts[parts.length - 1] || '';
  
  return {
    key,
    metaKey: parts.includes('cmd') || parts.includes('meta'),
    ctrlKey: parts.includes('ctrl') || parts.includes('control'),
    shiftKey: parts.includes('shift'),
    altKey: parts.includes('alt') || parts.includes('option')
  };
}

/**
 * Check if a KeyboardEvent matches a parsed shortcut
 */
export function matchesShortcut(event: KeyboardEvent, shortcut: ParsedShortcut): boolean {
  // Normalize the event key for comparison
  const eventKey = event.key.toLowerCase();
  
  return (
    eventKey === shortcut.key &&
    event.metaKey === shortcut.metaKey &&
    event.ctrlKey === shortcut.ctrlKey &&
    event.shiftKey === shortcut.shiftKey &&
    event.altKey === shortcut.altKey
  );
}

/**
 * Check if a KeyboardEvent matches a shortcut string
 */
export function matchesShortcutString(event: KeyboardEvent, shortcutString: string): boolean {
  const parsed = parseShortcut(shortcutString);
  return matchesShortcut(event, parsed);
}