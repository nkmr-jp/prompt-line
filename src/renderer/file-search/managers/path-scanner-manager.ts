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
    const validPathsSet = validPaths !== undefined ? validPaths : this.validPathsBuilder();
    const foundPaths = this.findAndValidateAtPaths(text, validPathsSet);

    foundPaths.sort((a, b) => a.start - b.start);
    this.atPaths = foundPaths;
  }

  /**
   * Find and validate all @path patterns in text
   */
  private findAndValidateAtPaths(text: string, validPathsSet: Set<string> | null): AtPathRange[] {
    const foundPaths: AtPathRange[] = [];
    const atPathPattern = /@([^\s@]+)/g;
    let match;

    while ((match = atPathPattern.exec(text)) !== null) {
      const pathContent = match[1];
      if (!pathContent) continue;

      const atPath = this.createAtPathIfValid(match, pathContent, validPathsSet);
      if (atPath) {
        foundPaths.push(atPath);
      }
    }

    return foundPaths;
  }

  /**
   * Create AtPathRange if path is valid
   */
  private createAtPathIfValid(
    match: RegExpExecArray,
    pathContent: string,
    validPathsSet: Set<string> | null
  ): AtPathRange | null {
    const start = match.index;
    const end = start + 1 + pathContent.length;

    const isSelected = this.selectedPaths.has(pathContent);
    const isValidCached = this.isValidCachedPath(pathContent, validPathsSet);

    return (isSelected || isValidCached) ? { start, end, path: pathContent } : null;
  }

  /**
   * Check if path is valid according to cached file list
   */
  private isValidCachedPath(pathContent: string, validPathsSet: Set<string> | null): boolean {
    if (!validPathsSet) return false;

    const parsedPath = parsePathWithLineInfo(pathContent);
    const cleanPath = parsedPath.path;
    return validPathsSet.has(cleanPath);
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
  public async restoreAtPathsFromText(
    checkFilesystem: boolean = false,
    directoryData?: DirectoryDataForScanner | null
  ): Promise<void> {
    const text = this.callbacks.getTextContent();
    this.logRestoreStart(text, checkFilesystem, directoryData);
    this.clearState();

    const context = this.prepareRestoreContext(checkFilesystem, directoryData);
    if (!context) return;

    await this.processAtPathsInText(text, context);
    this.logRestoreComplete(text, checkFilesystem);
  }

  /**
   * Prepare context for path restoration
   */
  private prepareRestoreContext(
    checkFilesystem: boolean,
    directoryData?: DirectoryDataForScanner | null
  ): { relativePaths: Set<string> | null; checkFilesystem: boolean } | null {
    const hasValidCachedData = this.hasValidDirectoryData(directoryData);

    if (!checkFilesystem && !hasValidCachedData) {
      console.debug('[PathScannerManager] restoreAtPathsFromText: no cached data and not checking filesystem, skipping highlight');
      return null;
    }

    const relativePaths = hasValidCachedData && directoryData
      ? this.buildRelativePathsSet(directoryData.files, directoryData.directory!)
      : null;

    if (relativePaths) {
      console.debug('[PathScannerManager] Built relative path set:', { pathCount: relativePaths.size });
    }

    return { relativePaths, checkFilesystem };
  }

  /**
   * Process all @path patterns in text
   */
  private async processAtPathsInText(
    text: string,
    context: { relativePaths: Set<string> | null; checkFilesystem: boolean }
  ): Promise<void> {
    const atPathPattern = /@([^\s@]+)/g;
    let match;

    while ((match = atPathPattern.exec(text)) !== null) {
      const pathContent = match[1];
      if (!pathContent) continue;

      await this.processAtPath(pathContent, match.index, context);
    }
  }

  /**
   * Process a single @path pattern
   */
  private async processAtPath(
    pathContent: string,
    startIndex: number,
    context: { relativePaths: Set<string> | null; checkFilesystem: boolean }
  ): Promise<void> {
    const parsedPath = parsePathWithLineInfo(pathContent);
    const cleanPath = parsedPath.path;
    const end = startIndex + 1 + pathContent.length;

    const shouldHighlight = await this.shouldHighlightPath(
      cleanPath,
      context.relativePaths,
      context.checkFilesystem
    );

    if (shouldHighlight) {
      this.selectedPaths.add(pathContent);
      this.logFoundPath(pathContent, cleanPath, startIndex, end, context.checkFilesystem, parsedPath);
    } else {
      console.debug('[PathScannerManager] Skipping non-existent @path:', pathContent);
    }
  }

  /**
   * Check if path should be highlighted
   */
  private async shouldHighlightPath(
    cleanPath: string,
    relativePaths: Set<string> | null,
    checkFilesystem: boolean
  ): Promise<boolean> {
    if (relativePaths?.has(cleanPath)) {
      return true;
    }

    if (checkFilesystem && this.callbacks.checkFileExists) {
      try {
        return await this.callbacks.checkFileExists(cleanPath);
      } catch (err) {
        console.error('[PathScannerManager] Error checking file existence:', err);
        return false;
      }
    }

    return false;
  }

  /**
   * Check if directory data is valid
   */
  private hasValidDirectoryData(directoryData?: DirectoryDataForScanner | null): boolean {
    return !!(directoryData?.files && directoryData.files.length > 0 && directoryData?.directory);
  }

  /**
   * Clear state for path restoration
   */
  private clearState(): void {
    this.atPaths = [];
    this.selectedPaths.clear();
  }

  /**
   * Log restore start
   */
  private logRestoreStart(
    text: string,
    checkFilesystem: boolean,
    directoryData?: DirectoryDataForScanner | null
  ): void {
    console.debug('[PathScannerManager] Restoring @paths from text:', {
      textLength: text.length,
      checkFilesystem,
      hasDirectoryData: !!directoryData
    });
  }

  /**
   * Log restore complete
   */
  private logRestoreComplete(text: string, checkFilesystem: boolean): void {
    console.debug('[PathScannerManager] Restored @paths from text:', {
      selectedPathsCount: this.selectedPaths.size,
      textLength: text.length,
      checkFilesystem
    });
  }

  /**
   * Log found path
   */
  private logFoundPath(
    pathContent: string,
    cleanPath: string,
    start: number,
    end: number,
    checkFilesystem: boolean,
    parsedPath: { path: string; lineNumber?: number }
  ): void {
    console.debug('[PathScannerManager] Found @path:', {
      pathContent,
      cleanPath,
      start,
      end,
      checkFilesystem,
      isSymbolPath: !!parsedPath.lineNumber
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
