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
 * Find file path at the given cursor position
 * Returns the path if found, null otherwise
 * Supports absolute paths (/, ~/), and relative paths (./, ../)
 */
export function findAbsolutePathAtPosition(text: string, cursorPos: number): string | null {
  // Pattern to match file paths:
  // - Relative paths: ./path, ../path (ASCII path characters only)
  // - Absolute paths: /path, ~/path (first segment must start with ASCII alphanumeric)
  const absolutePathPattern = /(?:\.{1,2}\/[a-zA-Z0-9_./-]+|\/[a-zA-Z0-9_][^\s"'<>|*?\n]*|~\/[a-zA-Z0-9_][^\s"'<>|*?\n]*)/g;
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
 * Supports @path, relative paths (./, ../), and absolute paths (/, ~/)
 * Excludes slash commands (e.g., /commit)
 */
export function findClickablePathAtPosition(text: string, cursorPos: number): PathMatch | null {
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

  // Then check file paths (relative and absolute)
  // - Relative paths: ./path, ../path (ASCII path characters only)
  // - Absolute paths: multi-level /path/to/file, ~/path (first segment must start with ASCII alphanumeric)
  // Excludes single-level paths like /commit (slash commands)
  const absolutePathPattern = /(?:\.{1,2}\/[a-zA-Z0-9_./-]+|\/(?:[a-zA-Z0-9_.][^\s"'<>|*?\n/]*\/)+[^\s"'<>|*?\n]*|~\/[a-zA-Z0-9_][^\s"'<>|*?\n]+)/g;
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
 * Find all URLs in the text
 * Returns array of { url, start, end }
 */
export function findAllUrls(text: string): UrlMatch[] {
  const results: UrlMatch[] = [];
  const urlPattern = /https?:\/\/[^\s"'<>|*\n]+/gi;
  let match;

  while ((match = urlPattern.exec(text)) !== null) {
    results.push({
      url: match[0],
      start: match.index,
      end: match.index + match[0].length
    });
  }

  return results;
}

/**
 * Find all file paths in the text
 * Returns array of { path, start, end }
 * Includes relative paths (./, ../) and excludes slash commands (e.g., /commit)
 */
export function findAllAbsolutePaths(text: string): PathMatch[] {
  const results: PathMatch[] = [];
  // - Relative paths: ./path, ../path (ASCII path characters only)
  // - Absolute paths: multi-level /path/to/file, ~/path (first segment can start with dot for hidden dirs)
  // Excludes single-level paths like /commit (slash commands)
  // Path must end with alphanumeric, dot, underscore, or closing paren/bracket
  const absolutePathPattern = /(?:\.{1,2}\/[a-zA-Z0-9_./-]+|\/(?:[a-zA-Z0-9_.][^\s"'<>|*?\n/]*\/)+[^\s"'<>|*?\n]*[a-zA-Z0-9_.)}\]:]|~\/[a-zA-Z0-9_.][^\s"'<>|*?\n]*[a-zA-Z0-9_.)}\]:])/g;
  let match;

  while ((match = absolutePathPattern.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;

    // Check if path is at start of text or preceded by whitespace
    const prevChar = start > 0 ? text[start - 1] : '';
    if (prevChar !== '' && prevChar !== ' ' && prevChar !== '\t' && prevChar !== '\n') {
      continue; // Skip - not a standalone absolute path
    }

    results.push({
      path: match[0],
      start,
      end
    });
  }

  return results;
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
  } else if (cleanPath.startsWith('~')) {
    // Home directory path - pass through as-is (will be expanded by main process)
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
