/**
 * Text finding utilities for File Search module
 * Pure functions for finding patterns in text at cursor positions
 */

export interface TextMatch {
  start: number;
  end: number;
}

export interface UrlMatch extends TextMatch {
  url: string;
}

export interface CommandMatch extends TextMatch {
  command: string;
}

export interface PathMatch extends TextMatch {
  path: string;
}

/**
 * Find @path at the given cursor position
 * Returns the path (without @) if found, null otherwise
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
export function findUrlAtPosition(text: string, cursorPos: number): UrlMatch | null {
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
export function findSlashCommandAtPosition(text: string, cursorPos: number): CommandMatch | null {
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
export function findClickablePathAtPosition(text: string, cursorPos: number): PathMatch | null {
  // First check @path
  const atPathMatch = findAtPathMatch(text, cursorPos);
  if (atPathMatch) {
    return atPathMatch;
  }

  // Then check absolute paths
  return findAbsolutePathMatch(text, cursorPos);
}

/**
 * Find @path match at cursor position
 */
function findAtPathMatch(text: string, cursorPos: number): PathMatch | null {
  const atPathPattern = /@([^\s@]+)/g;
  let match;

  while ((match = atPathPattern.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;

    if (cursorPos >= start && cursorPos <= end) {
      return { path: match[1] ?? '', start, end };
    }
  }

  return null;
}

/**
 * Find absolute path match at cursor position
 * Excludes single-level paths like /commit (slash commands)
 */
function findAbsolutePathMatch(text: string, cursorPos: number): PathMatch | null {
  const absolutePathPattern = /(?:\/(?:[^\s"'<>|*?\n/]+\/)+[^\s"'<>|*?\n]*|~\/[^\s"'<>|*?\n]+)/g;
  let match;

  while ((match = absolutePathPattern.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;

    if (!isStandalonePath(text, start)) {
      continue; // Skip - not a standalone absolute path
    }

    if (cursorPos >= start && cursorPos <= end) {
      return { path: match[0], start, end };
    }
  }

  return null;
}

/**
 * Check if path is at start of text or preceded by whitespace
 */
function isStandalonePath(text: string, start: number): boolean {
  if (start === 0) return true;

  const prevChar = text[start - 1] ?? '';
  return prevChar === ' ' || prevChar === '\t' || prevChar === '\n';
}

/**
 * Resolve a relative file path to absolute path
 * Handles paths with line number and symbol suffix: path:lineNumber#symbolName
 * Preserves line number and symbol suffix in the returned path
 */
export function resolveAtPathToAbsolute(
  relativePath: string,
  baseDir: string | undefined,
  parsePathWithLineInfo: (path: string) => { path: string; lineNumber?: number; symbolName?: string },
  normalizePath: (path: string) => string
): string | null {
  // Parse the path to extract line number/symbol suffix
  const parsed = parsePathWithLineInfo(relativePath);
  const cleanPath = parsed.path;

  let absolutePath: string;

  if (!baseDir) {
    // If no base directory, try to use the path as-is
    absolutePath = cleanPath;
  } else if (cleanPath.startsWith('/')) {
    // Already an absolute path
    absolutePath = cleanPath;
  } else {
    // Combine with base directory and normalize (handles ../ etc.)
    const combined = `${baseDir}/${cleanPath}`;
    absolutePath = normalizePath(combined);
  }

  // Re-append line number and symbol suffix if they were present
  if (parsed.lineNumber !== undefined) {
    absolutePath = `${absolutePath}:${parsed.lineNumber}`;
    if (parsed.symbolName) {
      absolutePath = `${absolutePath}#${parsed.symbolName}`;
    }
  }

  return absolutePath;
}
