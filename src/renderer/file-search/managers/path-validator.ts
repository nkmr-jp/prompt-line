/**
 * PathValidator - Path validation and verification logic
 *
 * Responsibilities:
 * - Validate paths against file system
 * - Build relative path sets for validation
 * - Check file existence
 */

import type { DirectoryData } from '../types';
import type { FileInfo } from '../../../types';
import { getRelativePath, parsePathWithLineInfo } from '../index';

/**
 * Directory data structure for validation operations
 */
export interface DirectoryDataForValidator {
  directory: string;
  files: FileInfo[];
}

/**
 * Callbacks required by PathValidator
 */
export interface PathValidatorCallbacks {
  getTextContent: () => string;
  checkFileExists?: ((path: string) => Promise<boolean>) | undefined;
  getCachedDirectoryData?: (() => DirectoryData | null) | undefined;
}

/**
 * PathValidator - Handles path validation and verification
 */
export class PathValidator {
  private callbacks: PathValidatorCallbacks;

  constructor(callbacks: PathValidatorCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Build a set of relative paths from file list
   * Includes both files and parent directories
   */
  public buildRelativePathsSet(files: FileInfo[], baseDir: string): Set<string> {
    const relativePaths = new Set<string>();

    for (const file of files) {
      const relativePath = getRelativePath(file.path, baseDir);
      relativePaths.add(relativePath);

      // For directories: add both with and without trailing slash
      if (file.isDirectory) {
        if (!relativePath.endsWith('/')) {
          relativePaths.add(relativePath + '/');
        } else {
          relativePaths.add(relativePath.slice(0, -1));
        }
      }

      // Extract and add all parent directories from file paths
      // This handles cases where directory entries are not in the file list
      const pathParts = relativePath.split('/');
      let parentPath = '';
      for (let i = 0; i < pathParts.length - 1; i++) {
        parentPath += (i > 0 ? '/' : '') + pathParts[i];
        relativePaths.add(parentPath);
        relativePaths.add(parentPath + '/');
      }
    }

    return relativePaths;
  }

  /**
   * Build a set of valid paths from cached directory data
   * @returns Set of valid paths or null if no data
   */
  public buildValidPathsSet(): Set<string> | null {
    const cachedData = this.callbacks.getCachedDirectoryData?.();
    if (!cachedData?.files || cachedData.files.length === 0) {
      return null;
    }

    const baseDir = cachedData.directory;
    const validPaths = new Set<string>();

    for (const file of cachedData.files) {
      const relativePath = getRelativePath(file.path, baseDir);
      validPaths.add(relativePath);
      // For directories: add both with and without trailing slash
      if (file.isDirectory) {
        if (!relativePath.endsWith('/')) {
          validPaths.add(relativePath + '/');
        } else {
          validPaths.add(relativePath.slice(0, -1));
        }
      }
      // Also add parent directories
      const pathParts = relativePath.split('/');
      let parentPath = '';
      for (let i = 0; i < pathParts.length - 1; i++) {
        parentPath += (i > 0 ? '/' : '') + pathParts[i];
        validPaths.add(parentPath);
        validPaths.add(parentPath + '/');
      }
    }

    return validPaths;
  }

  /**
   * Restore @paths from text and validate them
   * This auto-detects @paths in the text and returns validated paths
   *
   * @param checkFilesystem - If true, checks filesystem for file existence when cached file list is empty
   * @param directoryData - Directory data for validation (optional)
   * @returns Set of validated paths
   */
  public async restoreAtPathsFromText(
    checkFilesystem: boolean = false,
    directoryData?: DirectoryDataForValidator | null
  ): Promise<Set<string>> {
    const text = this.callbacks.getTextContent();
    const validatedPaths = new Set<string>();

    console.debug('[PathValidator] Restoring @paths from text:', {
      textLength: text.length,
      checkFilesystem,
      hasDirectoryData: !!directoryData
    });

    // Need cached directory data to check if files exist (or need to check filesystem)
    const hasValidCachedData = directoryData?.files &&
                                directoryData.files.length > 0 &&
                                directoryData?.directory;
    const baseDir = directoryData?.directory;

    if (!checkFilesystem && !hasValidCachedData) {
      console.debug('[PathValidator] No cached data and not checking filesystem, skipping validation');
      return validatedPaths;
    }

    // Build a set of relative paths for quick lookup (only if we have valid cached data)
    let relativePaths: Set<string> | null = null;
    if (hasValidCachedData && directoryData) {
      relativePaths = this.buildRelativePathsSet(directoryData.files, baseDir!);
      console.debug('[PathValidator] Built relative path set:', {
        pathCount: relativePaths.size
      });
    }

    // Find all @path patterns
    const atPathPattern = /@([^\s@]+)/g;
    let match;

    while ((match = atPathPattern.exec(text)) !== null) {
      const pathContent = match[1];
      if (!pathContent) continue;

      // Parse path to extract clean path (without line number and symbol name)
      const parsedPath = parsePathWithLineInfo(pathContent);
      const cleanPath = parsedPath.path;

      // Check if file exists (either in cache or filesystem)
      let shouldInclude = false;

      if (relativePaths && relativePaths.has(cleanPath)) {
        // Path exists in cached file list
        shouldInclude = true;
        console.debug('[PathValidator] Found @path in cache:', {
          pathContent,
          cleanPath,
          isSymbolPath: !!parsedPath.lineNumber
        });
      } else if (checkFilesystem && this.callbacks.checkFileExists) {
        // Check filesystem if cache lookup failed and checkFilesystem is true
        try {
          const exists = await this.callbacks.checkFileExists(cleanPath);
          shouldInclude = exists;
          console.debug('[PathValidator] Checked filesystem for @path:', {
            pathContent,
            cleanPath,
            exists,
            isSymbolPath: !!parsedPath.lineNumber
          });
        } catch (err) {
          console.error('[PathValidator] Error checking file existence:', err);
          shouldInclude = false;
        }
      }

      if (shouldInclude) {
        // Use the full pathContent (including line number and symbol name if present)
        validatedPaths.add(pathContent);
        console.debug('[PathValidator] Found valid @path:', {
          pathContent,
          cleanPath,
          checkFilesystem,
          isSymbolPath: !!parsedPath.lineNumber
        });
      } else {
        console.debug('[PathValidator] Skipping non-existent @path:', pathContent);
      }
    }

    console.debug('[PathValidator] Validated @paths from text:', {
      validatedPathsCount: validatedPaths.size,
      textLength: text.length,
      checkFilesystem
    });

    return validatedPaths;
  }
}
