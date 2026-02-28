/**
 * Trigger Query Extractor
 * Common utility for extracting trigger-based queries at cursor position.
 * Used by both AgentSkillManager ('/') and MentionManager ('@').
 */

export interface TriggerQueryResult {
  query: string;      // Text after trigger character (up to cursor)
  startPos: number;   // Position of trigger character
  triggerChar: string; // The trigger character ('/' or '@')
}

/**
 * Extract a trigger-based query at the current cursor position.
 * Searches backwards from cursor to find a trigger character that is:
 * - At the start of the text, OR
 * - After whitespace or newline
 *
 * @param text - Full text content
 * @param cursorPos - Current cursor position
 * @param triggerChar - Trigger character to search for ('/' or '@')
 * @returns TriggerQueryResult if valid trigger found, null otherwise
 *
 * @example
 * // Agent skill at start
 * extractTriggerQueryAtCursor('/comm', 5, '/') // { query: 'comm', startPos: 0, triggerChar: '/' }
 *
 * @example
 * // Agent skill mid-text
 * extractTriggerQueryAtCursor('hello /wo', 10, '/') // { query: 'wo', startPos: 6, triggerChar: '/' }
 *
 * @example
 * // @ mention at start of new line
 * extractTriggerQueryAtCursor('line1\n@file', 11, '@') // { query: 'file', startPos: 7, triggerChar: '@' }
 *
 * @example
 * // Invalid: @ in email (no whitespace before)
 * extractTriggerQueryAtCursor('user@example', 12, '@') // null
 */
export function extractTriggerQueryAtCursor(
  text: string,
  cursorPos: number,
  triggerChar: string,
  options?: { allowSpaces?: boolean }
): TriggerQueryResult | null {
  // Find the trigger character before cursor
  let triggerPos = -1;
  const allowSpaces = options?.allowSpaces === true;

  for (let i = cursorPos - 1; i >= 0; i--) {
    const char = text[i];

    // Stop at newline or tab (always a boundary)
    if (char === '\n' || char === '\t') {
      break;
    }

    // Space handling: skip if allowSpaces, otherwise stop
    if (char === ' ') {
      if (allowSpaces) continue;
      break;
    }

    // Found trigger character
    if (char === triggerChar) {
      triggerPos = i;
      break;
    }
  }

  if (triggerPos === -1) return null;

  // Validate: trigger must be at start of text OR after whitespace/newline
  if (triggerPos > 0) {
    const prevChar = text[triggerPos - 1];
    if (prevChar !== ' ' && prevChar !== '\n' && prevChar !== '\t') {
      // Trigger is part of something else (like email for @, or URL for /)
      return null;
    }
  }

  // Extract query (text after trigger up to cursor)
  const query = text.substring(triggerPos + 1, cursorPos);

  return {
    query,
    startPos: triggerPos,
    triggerChar
  };
}
