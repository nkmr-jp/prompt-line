/**
 * Path utilities for File Search module
 * Pure functions for path manipulation and parsing
 */

import type { ParsedPathInfo } from './types';

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
 * Parse a path that may contain line number and symbol name suffix
 * Format: path:lineNumber#symbolName
 * Returns: { path: string, lineNumber?: number, symbolName?: string }
 */
export function parsePathWithLineInfo(pathStr: string): ParsedPathInfo {
  // Match pattern: path:lineNumber#symbolName or path:lineNumber
  const match = pathStr.match(/^(.+?):(\d+)(#(.+))?$/);
  if (match && match[1] && match[2]) {
    const result: ParsedPathInfo = {
      path: match[1],
      lineNumber: parseInt(match[2], 10)
    };
    if (match[4]) {
      result.symbolName = match[4];
    }
    return result;
  }
  // No line number suffix
  return { path: pathStr };
}

/**
 * Get relative path from base directory
 */
export function getRelativePath(fullPath: string, baseDir: string): string {
  // If baseDir is empty or root '/', return fullPath as-is (it's already absolute)
  if (!baseDir || baseDir === '/') {
    return fullPath;
  }
  if (fullPath.startsWith(baseDir)) {
    const relative = fullPath.substring(baseDir.length);
    return relative.startsWith('/') ? relative.substring(1) : relative;
  }
  return fullPath;
}

/**
 * Get directory path from a file path (excluding the filename)
 */
export function getDirectoryFromPath(relativePath: string): string {
  const lastSlash = relativePath.lastIndexOf('/');
  if (lastSlash === -1) return '';
  return relativePath.substring(0, lastSlash + 1); // Include trailing slash
}
