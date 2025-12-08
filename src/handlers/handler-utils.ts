import path from 'path';
import os from 'os';
import { logger } from '../utils/utils';
import MdSearchLoader from '../managers/md-search-loader';
import type { UserSettings } from '../types';

/**
 * Expands ~ to home directory and resolves relative paths.
 *
 * @param filePath - The file path to expand
 * @param baseDir - Optional base directory for resolving relative paths
 * @returns Expanded and resolved absolute path
 */
export function expandPath(filePath: string, baseDir?: string): string {
  // Expand ~ to home directory
  let expandedPath = filePath;
  if (filePath.startsWith('~/')) {
    expandedPath = path.join(os.homedir(), filePath.slice(2));
  } else if (filePath === '~') {
    expandedPath = os.homedir();
  }

  // Convert to absolute path if relative
  if (path.isAbsolute(expandedPath)) {
    return expandedPath;
  } else {
    // Use baseDir if provided, otherwise fallback to process.cwd()
    const base = baseDir || process.cwd();
    return path.join(base, expandedPath);
  }
}

/**
 * Normalizes and validates file paths to prevent path traversal attacks.
 *
 * @param filePath - The file path to normalize and validate
 * @param baseDir - Optional base directory for validation
 * @returns Normalized path
 * @throws Error if path validation fails
 */
export function normalizeAndValidatePath(filePath: string, baseDir?: string): string {
  const absolutePath = expandPath(filePath, baseDir);
  const normalizedPath = path.normalize(absolutePath);

  // If baseDir is provided, validate that the normalized path stays within it
  if (baseDir) {
    const normalizedBase = path.normalize(baseDir);
    if (!normalizedPath.startsWith(normalizedBase)) {
      logger.error('Attempted path traversal detected', {
        filePath,
        baseDir,
        normalizedPath,
        timestamp: Date.now()
      });
      throw new Error('Invalid file path - path traversal detected');
    }
  }

  return normalizedPath;
}

/**
 * Validates history item ID format.
 * ID must be lowercase alphanumeric with maximum length of 32 characters.
 *
 * NOTE: This validation is coupled with utils.generateId() - update both if ID format changes.
 *
 * @param id - The history item ID to validate
 * @returns true if valid, false otherwise
 */
export function validateHistoryId(id: string): boolean {
  const MAX_ID_LENGTH = 32; // Matches generateId() output format

  if (!id || typeof id !== 'string') {
    return false;
  }

  if (!id.match(/^[a-z0-9]+$/)) {
    return false;
  }

  if (id.length > MAX_ID_LENGTH) {
    return false;
  }

  return true;
}

/**
 * Updates MdSearchLoader configuration from user settings.
 *
 * @param loader - The MdSearchLoader instance to update
 * @param settings - User settings containing mdSearch configuration
 */
export function updateMdSearchConfig(loader: MdSearchLoader, settings: UserSettings): void {
  if (settings.mdSearch) {
    loader.updateConfig(settings.mdSearch);
    logger.info('MdSearch config updated from settings');
  }
}
