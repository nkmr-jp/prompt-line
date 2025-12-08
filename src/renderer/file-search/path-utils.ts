/**
 * Path Utilities Module
 *
 * This module provides utility functions for path detection, manipulation, and opening
 * in the file search system. It includes functions for:
 * - Finding @paths, URLs, slash commands, and absolute paths at cursor positions
 * - Path normalization and resolution
 * - File and URL opening with focus management
 * - Caret position calculations for dropdown positioning
 */

/**
 * Find @path at the given cursor position
 * Returns the path (without @) if found, null otherwise
 * Example: "@src/file.ts" returns "src/file.ts"
 */
export function findAtPathAtPosition(text: string, cursorPos: number): string | null {
  // Pattern to match @path (file paths after @)
  const atPathPattern = /@([^\s@]+)/g;
  let match;

  while ((match = atPathPattern.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;

    // Check if cursor is within this @path
    if (cursorPos >= start && cursorPos <= end) {
      return match[1] ?? null; // Return path without @
    }
  }

  return null;
}

/**
 * Find URL at the given cursor position
 * Returns { url, start, end } if found, null otherwise
 * Supports both http:// and https:// URLs including query parameters
 */
export function findUrlAtPosition(text: string, cursorPos: number): { url: string; start: number; end: number } | null {
  // Pattern to match URLs starting with http:// or https://
  // Includes query parameters (?key=value) and fragments (#section)
  const urlPattern = /https?:\/\/[^\s"'<>|*\n]+/gi;
  let match;

  while ((match = urlPattern.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;

    // Check if cursor is within this URL
    if (cursorPos >= start && cursorPos <= end) {
      return { url: match[0], start, end };
    }
  }

  return null;
}

/**
 * Find slash command at the given cursor position
 * Returns { command, start, end } if found, null otherwise
 * Slash commands are like /commit, /help (single word after /)
 */
export function findSlashCommandAtPosition(text: string, cursorPos: number): { command: string; start: number; end: number } | null {
  // Pattern to match slash commands: /word (no slashes in the middle)
  // This matches /commit, /help, etc. but not /path/to/file
  const slashCommandPattern = /\/([a-zA-Z][a-zA-Z0-9_-]*)/g;
  let match;

  while ((match = slashCommandPattern.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    const commandName = match[1] ?? '';

    // Check if cursor is within this slash command
    if (cursorPos >= start && cursorPos <= end) {
      // Make sure it's at the start of text or after whitespace (not part of a path)
      const prevChar = start > 0 ? text[start - 1] : ' ';
      if (prevChar === ' ' || prevChar === '\n' || prevChar === '\t' || start === 0) {
        return { command: commandName, start, end };
      }
    }
  }

  return null;
}

/**
 * Find absolute file path at the given cursor position
 * Returns the path if found, null otherwise
 * Supports both / and ~ (home directory) prefixed paths
 */
export function findAbsolutePathAtPosition(text: string, cursorPos: number): string | null {
  // Pattern to match absolute paths starting with / or ~
  // Matches paths like /Users/name/.prompt-line/images/file.png
  // or ~/.prompt-line/images/file.png
  const absolutePathPattern = /(?:\/|~\/)[^\s"'<>|*?\n]+/g;
  let match;

  while ((match = absolutePathPattern.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;

    // Check if path is at start of text or preceded by whitespace
    // This prevents matching paths like "ghq/github.com/..." as absolute paths
    const prevChar = start > 0 ? text[start - 1] : '';
    if (prevChar !== '' && prevChar !== ' ' && prevChar !== '\t' && prevChar !== '\n') {
      continue; // Skip - not a standalone absolute path
    }

    // Check if cursor is within this path
    if (cursorPos >= start && cursorPos <= end) {
      return match[0]; // Return the full path
    }
  }

  return null;
}

/**
 * Find any clickable file path at the given position
 * Returns { path, start, end } if found
 * Excludes slash commands (e.g., /commit) from absolute path detection
 */
export function findClickablePathAtPosition(text: string, cursorPos: number): { path: string; start: number; end: number } | null {
  // First check @path
  const atPathPattern = /@([^\s@]+)/g;
  let match;

  while ((match = atPathPattern.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;

    if (cursorPos >= start && cursorPos <= end) {
      return { path: match[1] ?? '', start, end };
    }
  }

  // Then check absolute paths (including ~ for home directory)
  // Excludes single-level paths like /commit (slash commands)
  const absolutePathPattern = /(?:\/(?:[^\s"'<>|*?\n/]+\/)+[^\s"'<>|*?\n]*|~\/[^\s"'<>|*?\n]+)/g;
  while ((match = absolutePathPattern.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;

    // Check if path is at start of text or preceded by whitespace
    // This prevents matching paths like "ghq/github.com/..." as absolute paths
    const prevChar = start > 0 ? text[start - 1] : '';
    if (prevChar !== '' && prevChar !== ' ' && prevChar !== '\t' && prevChar !== '\n') {
      continue; // Skip - not a standalone absolute path
    }

    if (cursorPos >= start && cursorPos <= end) {
      return { path: match[0], start, end };
    }
  }

  return null;
}

/**
 * Normalize a path by resolving . and .. segments
 * This is a browser-compatible implementation since Node's path module isn't available
 */
export function normalizePath(filePath: string): string {
  const parts = filePath.split('/');
  const result: string[] = [];

  for (const part of parts) {
    if (part === '..') {
      // Go up one directory (remove last segment)
      if (result.length > 0 && result[result.length - 1] !== '') {
        result.pop();
      }
    } else if (part !== '.' && part !== '') {
      // Skip current directory marker and empty parts (except for leading empty for absolute paths)
      result.push(part);
    } else if (part === '' && result.length === 0) {
      // Preserve leading empty string for absolute paths (e.g., /Users/...)
      result.push(part);
    }
  }

  return result.join('/') || '/';
}

/**
 * Resolve a relative file path to absolute path
 * @param relativePath - The relative path to resolve (e.g., "src/file.ts")
 * @param baseDir - The base directory to resolve from (e.g., "/Users/name/project")
 * @returns Absolute path or null if base directory is not provided
 */
export function resolveAtPathToAbsolute(relativePath: string, baseDir: string | null): string | null {
  if (!baseDir) {
    // If no base directory, try to use the path as-is
    return relativePath;
  }

  // Check if it's already an absolute path
  if (relativePath.startsWith('/')) {
    return relativePath;
  }

  // Combine with base directory and normalize (handles ../ etc.)
  const combined = `${baseDir}/${relativePath}`;
  return normalizePath(combined);
}

/**
 * CaretPositionCalculator class for coordinate calculations
 * Provides methods to calculate caret coordinates and character positions from mouse coordinates
 */
export class CaretPositionCalculator {
  private mirrorDiv: HTMLDivElement | null = null;

  /**
   * Get caret coordinates (top, left) from character position in textarea
   * Uses a mirror div technique to accurately calculate position
   * @param textInput - The textarea element
   * @param position - Character position in the textarea
   * @returns Coordinates { top, left } or null if calculation fails
   */
  getCaretCoordinates(textInput: HTMLTextAreaElement, position: number): { top: number; left: number } | null {
    if (!textInput) return null;

    // Create mirror div if it doesn't exist
    if (!this.mirrorDiv) {
      this.mirrorDiv = document.createElement('div');
      this.mirrorDiv.style.cssText = `
        position: absolute;
        visibility: hidden;
        white-space: pre-wrap;
        word-wrap: break-word;
        overflow: hidden;
      `;
      document.body.appendChild(this.mirrorDiv);
    }

    // Copy textarea styles to mirror div
    const style = window.getComputedStyle(textInput);
    const properties = [
      'fontFamily', 'fontSize', 'fontWeight', 'fontStyle',
      'letterSpacing', 'textTransform', 'wordSpacing',
      'textIndent', 'whiteSpace', 'lineHeight',
      'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
      'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
      'boxSizing', 'width'
    ];

    properties.forEach(prop => {
      const value = style.getPropertyValue(prop.replace(/([A-Z])/g, '-$1').toLowerCase());
      if (value) {
        this.mirrorDiv!.style.setProperty(prop.replace(/([A-Z])/g, '-$1').toLowerCase(), value);
      }
    });

    // Get text up to the position and add a span marker
    const text = textInput.value.substring(0, position);
    const textNode = document.createTextNode(text);
    const marker = document.createElement('span');
    marker.textContent = '@'; // Use @ as marker

    this.mirrorDiv.innerHTML = '';
    this.mirrorDiv.appendChild(textNode);
    this.mirrorDiv.appendChild(marker);

    // Get marker position relative to mirror div
    const markerRect = marker.getBoundingClientRect();
    const mirrorRect = this.mirrorDiv.getBoundingClientRect();

    // Calculate position relative to textarea
    const textareaRect = textInput.getBoundingClientRect();

    return {
      top: markerRect.top - mirrorRect.top + textareaRect.top - textInput.scrollTop,
      left: markerRect.left - mirrorRect.left + textareaRect.left - textInput.scrollLeft
    };
  }

  /**
   * Get character position from mouse coordinates
   * Uses line height and character width approximation
   * @param textInput - The textarea element
   * @param clientX - Mouse X coordinate
   * @param clientY - Mouse Y coordinate
   * @returns Character position or null if calculation fails
   */
  getCharPositionFromCoordinates(textInput: HTMLTextAreaElement, clientX: number, clientY: number): number | null {
    if (!textInput) return null;

    const textareaRect = textInput.getBoundingClientRect();
    const relativeX = clientX - textareaRect.left + textInput.scrollLeft;
    const relativeY = clientY - textareaRect.top + textInput.scrollTop;

    // Simple approximation based on line height and character width
    const style = window.getComputedStyle(textInput);
    const lineHeight = parseFloat(style.lineHeight) || 20;
    const fontSize = parseFloat(style.fontSize) || 15;
    const charWidth = fontSize * 0.55; // Approximate character width

    const paddingTop = parseFloat(style.paddingTop) || 0;
    const paddingLeft = parseFloat(style.paddingLeft) || 0;

    const text = textInput.value;
    const lines = text.split('\n');

    // Calculate which line
    const lineIndex = Math.floor((relativeY - paddingTop) / lineHeight);
    if (lineIndex < 0 || lineIndex >= lines.length) return null;

    // Calculate position within line
    let charIndex = Math.floor((relativeX - paddingLeft) / charWidth);
    charIndex = Math.max(0, Math.min(charIndex, lines[lineIndex]?.length || 0));

    // Calculate absolute position
    let absolutePos = 0;
    for (let i = 0; i < lineIndex; i++) {
      absolutePos += (lines[i]?.length || 0) + 1; // +1 for newline
    }
    absolutePos += charIndex;

    return Math.min(absolutePos, text.length);
  }

  /**
   * Cleanup method to remove mirror div from DOM
   * Should be called when the calculator is no longer needed
   */
  destroy(): void {
    if (this.mirrorDiv && this.mirrorDiv.parentNode) {
      this.mirrorDiv.parentNode.removeChild(this.mirrorDiv);
      this.mirrorDiv = null;
    }
  }
}

/**
 * Callbacks interface for file/URL opening operations
 */
interface OpenCallbacks {
  onBeforeOpenFile?: () => void;
  setDraggable?: (enabled: boolean) => void;
}

/**
 * Open URL in external browser and restore focus to PromptLine window
 * Enables window dragging during URL open operation (same behavior as file open)
 * @param url - URL to open
 * @param callbacks - Callback functions for state management
 */
export async function openUrlInBrowser(
  url: string,
  callbacks: OpenCallbacks
): Promise<void> {
  try {
    callbacks.onBeforeOpenFile?.();
    // Enable draggable state while URL is opening
    callbacks.setDraggable?.(true);
    const result = await window.electronAPI.shell.openExternal(url);
    if (!result.success) {
      console.error('Failed to open URL in browser:', result.error);
      // Disable draggable state on error
      callbacks.setDraggable?.(false);
    } else {
      console.log('URL opened successfully in browser:', url);
      // Restore focus to PromptLine window after a short delay
      // Keep draggable state enabled so user can move window while browser is open
      setTimeout(() => {
        window.electronAPI.window.focus().catch((err: Error) =>
          console.error('Failed to restore focus:', err)
        );
      }, 100);
    }
  } catch (err) {
    console.error('Failed to open URL in browser:', err);
    // Disable draggable state on error
    callbacks.setDraggable?.(false);
  }
}

/**
 * Open file in editor
 * The opened file's application will be brought to foreground
 * @param filePath - Path to the file to open
 * @param callbacks - Callback functions for state management
 */
export async function openFileAndRestoreFocus(
  filePath: string,
  callbacks: OpenCallbacks
): Promise<void> {
  try {
    callbacks.onBeforeOpenFile?.();
    // Enable draggable state while file is opening
    callbacks.setDraggable?.(true);
    await window.electronAPI.file.openInEditor(filePath);
    // Note: Do not restore focus to PromptLine window
    // The opened file's application should stay in foreground
  } catch (err) {
    console.error('Failed to open file in editor:', err);
    // Disable draggable state on error
    callbacks.setDraggable?.(false);
  }
}
