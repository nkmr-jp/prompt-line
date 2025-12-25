/**
 * PathScannerManager - Scans and validates @paths in text
 *
 * Responsibilities:
 * - Scan text for @path patterns
 * - Validate @paths against file system and cache
 * - Manage selected paths set
 * - Build valid paths set from directory data
 * - Restore @paths from text (draft restoration)
 */

import type { AtPathRange } from '../types';
import { getRelativePath, parsePathWithLineInfo } from '../path-utils';
import type { FileInfo } from '../../../types';

export interface PathScannerCallbacks {
  getTextContent: () => string;
  checkFileExists?: (path: string) => Promise<boolean>;
}

export interface DirectoryDataForScanner {
  directory: string;
  files: FileInfo[];
}

/**
 * Scans and validates @path patterns in text
 */
export class PathScannerManager {
  private callbacks: PathScannerCallbacks;

  // @path tracking
  private atPaths: AtPathRange[] = [];
  private selectedPaths: Set<string> = new Set();

  // Valid paths builder (injected)
  private validPathsBuilder: (() => Set<string> | null) = () => null;

  constructor(callbacks: PathScannerCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Get all tracked @paths
   */
  public getAtPaths(): AtPathRange[] {
    return [...this.atPaths];
  }

  /**
   * Get the selected paths set
   */
  public getSelectedPaths(): Set<string> {
    return new Set(this.selectedPaths);
  }

  /**
   * Add a path to the selectedPaths set
   */
  public addSelectedPath(path: string): void {
    this.selectedPaths.add(path);
    console.debug('[PathScannerManager] Added path to selectedPaths:', path, 'total:', this.selectedPaths.size);
  }

  /**
   * Remove a path from the selectedPaths set
   */
  public removeSelectedPath(path: string): void {
    this.selectedPaths.delete(path);
    console.debug('[PathScannerManager] Removed path from selectedPaths:', path);
  }

  /**
   * Clear all tracked @paths (called when text is cleared)
   */
  public clearAtPaths(): void {
    this.atPaths = [];
    this.selectedPaths.clear();
  }

  /**
   * Set the valid paths builder for validation (used by rescanAtPaths)
   */
  public setValidPathsBuilder(builder: () => Set<string> | null): void {
    this.validPathsBuilder = builder;
  }

  /**
   * Re-scan text for @paths.
   * Finds ALL @path patterns in text and validates them against:
   * 1. The selectedPaths set (paths explicitly selected by user)
   * 2. The cached file list (for Undo support - restores highlights for valid paths)
   */
  public rescanAtPaths(text: string, validPaths?: Set<string> | null): void {
    const foundPaths: AtPathRange[] = [];
    const validPathsSet = validPaths !== undefined ? validPaths : this.validPathsBuilder();

    // Find all @path patterns in text
    const atPathPattern = /@([^\s@]+)/g;
    let match;

    while ((match = atPathPattern.exec(text)) !== null) {
      const pathContent = match[1];
      if (!pathContent) continue;

      const start = match.index;
      const end = start + 1 + pathContent.length; // +1 for @

      // Check if this path is in selectedPaths (user explicitly selected it)
      const isSelected = this.selectedPaths.has(pathContent);

      // Check if path is valid according to cached file list (for Undo support)
      let isValidCachedPath = false;
      if (validPathsSet) {
        // Extract the clean path (without line number and symbol name)
        const parsedPath = parsePathWithLineInfo(pathContent);
        const cleanPath = parsedPath.path;
        isValidCachedPath = validPathsSet.has(cleanPath);
      }

      // Add to foundPaths if it's selected OR valid according to cached list
      if (isSelected || isValidCachedPath) {
        foundPaths.push({ start, end, path: pathContent });
      }
    }

    // Sort by start position and update
    foundPaths.sort((a, b) => a.start - b.start);
    this.atPaths = foundPaths;
  }

  /**
   * Restore @paths from text (called when draft is restored or directory data is updated)
   * This auto-detects @paths in the text and adds them to tracking
   * Only highlights @paths that actually exist (checked against cached file list or filesystem)
   *
   * @param checkFilesystem - If true, checks filesystem for file existence when cached file list is empty.
   *                          Use this when restoring from draft with empty file list (fromDraft).
   * @param directoryData - Directory data for validation (optional)
   */
  public async restoreAtPathsFromText(checkFilesystem: boolean = false, directoryData?: DirectoryDataForScanner | null): Promise<void> {
    const text = this.callbacks.getTextContent();
    console.debug('[PathScannerManager] Restoring @paths from text:', {
      textLength: text.length,
      checkFilesystem,
      hasDirectoryData: !!directoryData
    });

    // Clear existing state
    this.atPaths = [];
    this.selectedPaths.clear();

    // Need cached directory data to check if files exist (or need to check filesystem)
    const hasValidCachedData = directoryData?.files &&
                                directoryData.files.length > 0 &&
                                directoryData?.directory;
    const baseDir = directoryData?.directory;

    if (!checkFilesystem && !hasValidCachedData) {
      console.debug('[PathScannerManager] restoreAtPathsFromText: no cached data and not checking filesystem, skipping highlight');
      return;
    }

    // Build a set of relative paths for quick lookup (only if we have valid cached data)
    let relativePaths: Set<string> | null = null;
    if (hasValidCachedData && directoryData) {
      relativePaths = this.buildRelativePathsSet(directoryData.files, baseDir!);
      console.debug('[PathScannerManager] Built relative path set:', {
        pathCount: relativePaths.size
      });
    }

    // Find all @path patterns
    const atPathPattern = /@([^\s@]+)/g;
    let match;

    while ((match = atPathPattern.exec(text)) !== null) {
      const pathContent = match[1];
      if (!pathContent) continue;

      const start = match.index;
      const end = start + 1 + pathContent.length;

      // Parse path to extract clean path (without line number and symbol name)
      const parsedPath = parsePathWithLineInfo(pathContent);
      const cleanPath = parsedPath.path;

      // Check if file exists (either in cache or filesystem)
      let shouldHighlight = false;

      if (relativePaths && relativePaths.has(cleanPath)) {
        // Path exists in cached file list
        shouldHighlight = true;
        console.debug('[PathScannerManager] Found @path in cache:', {
          pathContent,
          cleanPath,
          start,
          end,
          isSymbolPath: !!parsedPath.lineNumber
        });
      } else if (checkFilesystem && this.callbacks.checkFileExists) {
        // Check filesystem if cache lookup failed and checkFilesystem is true
        try {
          const exists = await this.callbacks.checkFileExists(cleanPath);
          shouldHighlight = exists;
          console.debug('[PathScannerManager] Checked filesystem for @path:', {
            pathContent,
            cleanPath,
            exists,
            isSymbolPath: !!parsedPath.lineNumber
          });
        } catch (err) {
          console.error('[PathScannerManager] Error checking file existence:', err);
          shouldHighlight = false;
        }
      }

      if (shouldHighlight) {
        // Add to selectedPaths set (rescanAtPaths will find all occurrences)
        // Use the full pathContent (including line number and symbol name if present)
        this.selectedPaths.add(pathContent);
        console.debug('[PathScannerManager] Found @path:', {
          pathContent,
          cleanPath,
          start,
          end,
          checkFilesystem,
          isSymbolPath: !!parsedPath.lineNumber
        });
      } else {
        console.debug('[PathScannerManager] Skipping non-existent @path:', pathContent);
      }
    }

    console.debug('[PathScannerManager] Restored @paths from text:', {
      selectedPathsCount: this.selectedPaths.size,
      textLength: text.length,
      checkFilesystem
    });
  }

  /**
   * Build a set of relative paths from file list
   */
  private buildRelativePathsSet(files: FileInfo[], baseDir: string): Set<string> {
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
}
