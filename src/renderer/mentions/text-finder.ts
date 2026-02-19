/**
 * Text finding utilities for File Search module
 * Pure functions for finding patterns in text at cursor positions
 */

// =============================================================================
// Common Path Pattern Constants
// =============================================================================

/**
 * First character allowed after path prefix (/, ~/, ./, ../)
 * Includes dot (.) to support hidden directories like ~/.claude
 */
const PATH_FIRST_CHAR = '[a-zA-Z0-9_.]';

/**
 * Characters not allowed in path segments (whitespace and special chars)
 */
const PATH_INVALID_CHARS = '[^\\s"\'<>|*?\\n]';

/**
 * Valid ending characters for paths (alphanumeric, dot, underscore, closing brackets)
 */
const PATH_END_CHAR = '[a-zA-Z0-9_.)\\}\\]:]';

/**
 * Relative path pattern: ./path or ../path
 */
const RELATIVE_PATH_PATTERN = '\\.{1,2}\\/[a-zA-Z0-9_./-]+';

/**
 * Tilde path pattern: ~/path (supports hidden dirs like ~/.claude)
 */
const TILDE_PATH_PATTERN = `~\\/${PATH_FIRST_CHAR}${PATH_INVALID_CHARS}*`;

/**
 * Multi-level absolute path pattern: /path/to/file (requires at least one /)
 */
const MULTI_LEVEL_ABSOLUTE_PATH_PATTERN = `\\/(?:${PATH_FIRST_CHAR}${PATH_INVALID_CHARS.replace('\\n', '\\n/')}*\\/)+${PATH_INVALID_CHARS}*`;

/**
 * Single-level absolute path pattern: /path
 */
const SINGLE_LEVEL_ABSOLUTE_PATH_PATTERN = `\\/${PATH_FIRST_CHAR}${PATH_INVALID_CHARS}*`;

// =============================================================================
// Interfaces
// =============================================================================

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
 * Find agent skill at the given cursor position
 * Returns { command, start, end } if found, null otherwise
 * Agent skills are like /commit, /help (single word after /)
 * When knownCommandNames is provided, also matches multi-word commands like /Linear API
 */
export function findAgentSkillAtPosition(text: string, cursorPos: number, knownCommandNames?: string[]): CommandMatch | null {
  // Use findAllAgentSkills to get all commands (including multi-word ones if knownCommandNames provided)
  const commands = findAllAgentSkills(text, knownCommandNames);

  for (const cmd of commands) {
    // Check if cursor is within this agent skill
    if (cursorPos >= cmd.start && cursorPos <= cmd.end) {
      return cmd;
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
  // Uses common path pattern constants for consistency
  // Includes single-level absolute paths (/path) for this function
  const absolutePathPattern = new RegExp(
    `(?:${RELATIVE_PATH_PATTERN}|${SINGLE_LEVEL_ABSOLUTE_PATH_PATTERN}|${TILDE_PATH_PATTERN})`,
    'g'
  );

  // Pattern to identify agent skills (single segment starting with /, no additional slashes or dots)
  // Agent skills look like /commit, /help, /skill:creater - single word after / without extensions
  const agentSkillPattern = /^\/[a-zA-Z][a-zA-Z0-9_:-]*$/;

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

    // Skip if this matches the agent skill pattern
    // Agent skills are single segments like /commit, /help (no additional slashes or dots)
    // This prevents conflict with the agent skill feature
    if (agentSkillPattern.test(match[0])) {
      continue;
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
 * Excludes agent skills (e.g., /commit)
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
  // Uses common path pattern constants for consistency
  // Excludes single-level paths like /commit (agent skills)
  const absolutePathPattern = new RegExp(
    `(?:${RELATIVE_PATH_PATTERN}|${MULTI_LEVEL_ABSOLUTE_PATH_PATTERN}|${TILDE_PATH_PATTERN})`,
    'g'
  );
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
 * Includes relative paths (./, ../) and excludes agent skills (e.g., /commit)
 */
export function findAllAbsolutePaths(text: string): PathMatch[] {
  const results: PathMatch[] = [];
  // Uses common path pattern constants for consistency
  // Excludes single-level paths like /commit (agent skills)
  // Path must end with valid ending characters (alphanumeric, dot, underscore, closing brackets)
  const absolutePathPattern = new RegExp(
    `(?:${RELATIVE_PATH_PATTERN}|${MULTI_LEVEL_ABSOLUTE_PATH_PATTERN}${PATH_END_CHAR}|${TILDE_PATH_PATTERN}${PATH_END_CHAR})`,
    'g'
  );
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
 * Find all agent skills in the text
 * Returns array of { command, start, end }
 * Agent skills are like /commit, /help (single word after /)
 * When knownCommandNames is provided, also matches multi-word commands like /Linear API
 */
export function findAllAgentSkills(text: string, knownCommandNames?: string[]): CommandMatch[] {
  const results: CommandMatch[] = [];
  // Track matched ranges to avoid duplicates
  const matchedRanges = new Set<string>();

  // First, find multi-word commands if known command names are provided
  // (Process these first so they take precedence over simple matches)
  if (knownCommandNames && knownCommandNames.length > 0) {
    // Sort by length descending to match longer commands first
    const sortedNames = [...knownCommandNames]
      .filter(name => name.includes(' '))  // Only process multi-word commands
      .sort((a, b) => b.length - a.length);

    for (const cmdName of sortedNames) {
      const searchPattern = '/' + cmdName;
      let searchStart = 0;

      while (true) {
        const idx = text.indexOf(searchPattern, searchStart);
        if (idx === -1) break;

        const start = idx;
        const end = idx + searchPattern.length;
        const rangeKey = `${start}-${end}`;

        // Check if at word boundary
        const prevChar = start > 0 ? text[start - 1] : ' ';
        const nextChar = end < text.length ? text[end] : ' ';
        const isValidStart = prevChar === ' ' || prevChar === '\n' || prevChar === '\t' || start === 0;
        const isValidEnd = nextChar === ' ' || nextChar === '\n' || nextChar === '\t' || end === text.length;

        if (isValidStart && isValidEnd && !matchedRanges.has(rangeKey)) {
          matchedRanges.add(rangeKey);
          results.push({
            command: cmdName,
            start,
            end
          });
        }

        searchStart = idx + 1;
      }
    }
  }

  // Then, find simple agent skills using regex
  const agentSkillPattern = /\/([a-zA-Z][a-zA-Z0-9_:-]*)/g;
  let match;

  while ((match = agentSkillPattern.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    const commandName = match[1] ?? '';
    const rangeKey = `${start}-${end}`;

    // Skip if this range overlaps with already matched multi-word command
    const overlapsExisting = [...matchedRanges].some(range => {
      const parts = range.split('-').map(Number);
      const existingStart = parts[0] ?? 0;
      const existingEnd = parts[1] ?? 0;
      return start >= existingStart && start < existingEnd;
    });

    if (overlapsExisting) continue;

    // Make sure it's at the start of text or after whitespace (not part of a path)
    const prevChar = start > 0 ? text[start - 1] : ' ';
    if (prevChar === ' ' || prevChar === '\n' || prevChar === '\t' || start === 0) {
      matchedRanges.add(rangeKey);
      results.push({
        command: commandName,
        start,
        end
      });
    }
  }

  // Sort by start position
  results.sort((a, b) => a.start - b.start);

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

/**
 * Find agent skill at cursor position for backspace deletion
 * Returns command if cursor is at end of command (within 3 chars, only spaces between)
 */
export function findAgentSkillAtCursor(
  text: string,
  cursorPos: number,
  knownCommandNames?: string[]
): CommandMatch | null {
  const commands = findAllAgentSkills(text, knownCommandNames);

  for (const cmd of commands) {
    // Check if cursor is at end of command (within 3 chars, only terminators between)
    if (cursorPos >= cmd.end && cursorPos <= cmd.end + 3) {
      // Check no newline between command end and cursor
      const betweenText = text.substring(cmd.end, cursorPos);
      if (betweenText.includes('\n')) continue;

      // Check all chars between are terminators (space/newline)
      const terminators = [' ', '\n', '\t'];
      if ([...betweenText].every(ch => terminators.includes(ch))) {
        // Only delete entire command if it's a known command name
        // If not known, allow normal backspace (character-by-character deletion)
        if (knownCommandNames && knownCommandNames.length > 0) {
          // Check if this command name matches any known command (case-insensitive)
          const isKnownCommand = knownCommandNames.some(
            name => name.toLowerCase() === cmd.command.toLowerCase()
          );
          if (!isKnownCommand) {
            continue; // Not a known command, skip it
          }
        }
        return cmd;
      }
    }
  }
  return null;
}
