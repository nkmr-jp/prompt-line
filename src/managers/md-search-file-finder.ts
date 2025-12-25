/**
 * File finding utilities for MdSearchLoader
 * Handles pattern matching and recursive file search
 */

import { promises as fs } from 'fs';
import path from 'path';
import { logger } from '../utils/utils';
import {
  parsePattern,
  matchesIntermediatePathSuffix,
  matchesFilePattern,
  matchesGlobPattern,
  expandBraces
} from './md-search-pattern-matcher';

/**
 * Find files matching a pattern in a directory
 */
export async function findFiles(directory: string, pattern: string): Promise<string[]> {
  const expandedPatterns = expandBraces(pattern);
  const allFiles: string[] = [];

  for (const expandedPattern of expandedPatterns) {
    const files = await findFilesWithPattern(directory, expandedPattern, '');
    allFiles.push(...files);
  }

  return [...new Set(allFiles)];
}

/**
 * Recursively find files matching a pattern
 */
async function findFilesWithPattern(
  directory: string,
  pattern: string,
  relativePath: string
): Promise<string[]> {
  const files: string[] = [];
  const parsed = parsePattern(pattern);

  try {
    const entries = await fs.readdir(directory, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      const entryRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

      if (entry.isDirectory() && parsed.isRecursive) {
        await processDirectory(fullPath, pattern, entryRelativePath, parsed, files);
      } else if (entry.isFile() && matchesFilePattern(entry.name, entryRelativePath, parsed)) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    logger.debug('Failed to read directory', { directory, error });
  }

  return files;
}

/**
 * Process a directory for pattern matching
 */
async function processDirectory(
  fullPath: string,
  pattern: string,
  entryRelativePath: string,
  parsed: ReturnType<typeof parsePattern>,
  files: string[]
): Promise<void> {
  if (parsed.intermediatePattern && matchesIntermediatePathSuffix(entryRelativePath, parsed.intermediatePattern)) {
    const subFiles = await findFilesInDir(fullPath, parsed.filePattern);
    files.push(...subFiles);
  }

  const subFiles = await findFilesWithPattern(fullPath, pattern, entryRelativePath);
  files.push(...subFiles);
}

/**
 * Find files in a directory (non-recursive)
 */
async function findFilesInDir(directory: string, filePattern: string): Promise<string[]> {
  const files: string[] = [];

  try {
    const entries = await fs.readdir(directory, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isFile() && matchesGlobPattern(entry.name, filePattern)) {
        files.push(path.join(directory, entry.name));
      }
    }
  } catch (error) {
    logger.debug('Failed to read directory', { directory, error });
  }

  return files;
}
