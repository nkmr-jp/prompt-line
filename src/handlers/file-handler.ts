import { ipcMain, IpcMainInvokeEvent, shell } from 'electron';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { logger } from '../utils/utils';
import type FileOpenerManager from '../managers/file-opener-manager';
import type DirectoryManager from '../managers/directory-manager';

interface IPCResult {
  success: boolean;
  error?: string;
  warning?: string;
}

// Constants
const ALLOWED_URL_PROTOCOLS = ['http:', 'https:'];

/**
 * FileHandler class manages file operation IPC handlers.
 * Handles file opening, existence checking, and external URL operations.
 */
class FileHandler {
  private fileOpenerManager: FileOpenerManager;
  private directoryManager: DirectoryManager;

  constructor(fileOpenerManager: FileOpenerManager, directoryManager: DirectoryManager) {
    this.fileOpenerManager = fileOpenerManager;
    this.directoryManager = directoryManager;
  }

  /**
   * Register all file operation IPC handlers
   */
  setupHandlers(ipcMainInstance: typeof ipcMain): void {
    ipcMainInstance.handle('open-file-in-editor', this.handleOpenFileInEditor.bind(this));
    ipcMainInstance.handle('check-file-exists', this.handleCheckFileExists.bind(this));
    ipcMainInstance.handle('open-external-url', this.handleOpenExternalUrl.bind(this));

    logger.info('File operation IPC handlers set up successfully');
  }

  /**
   * Unregister all file operation IPC handlers
   */
  removeHandlers(ipcMainInstance: typeof ipcMain): void {
    const handlers = [
      'open-file-in-editor',
      'check-file-exists',
      'open-external-url'
    ];

    handlers.forEach(handler => {
      ipcMainInstance.removeAllListeners(handler);
    });

    logger.info('File operation IPC handlers removed');
  }

  /**
   * Expand ~ to home directory and convert relative paths to absolute.
   * @param filePath - The file path to expand
   * @param baseDir - Optional base directory for relative paths
   * @returns Expanded and normalized absolute path
   */
  private expandPath(filePath: string, baseDir?: string | null): string {
    // Expand ~ to home directory
    let expandedPath = filePath;
    if (filePath.startsWith('~/')) {
      expandedPath = path.join(os.homedir(), filePath.slice(2));
    } else if (filePath === '~') {
      expandedPath = os.homedir();
    }

    // Convert to absolute path if relative
    let absolutePath: string;
    if (path.isAbsolute(expandedPath)) {
      absolutePath = expandedPath;
    } else {
      // Use baseDir if provided, otherwise use DirectoryManager's directory
      const resolvedBaseDir = baseDir ?? this.directoryManager.getDirectory();
      if (resolvedBaseDir) {
        absolutePath = path.join(resolvedBaseDir, expandedPath);
      } else {
        // Fallback to process.cwd() if no directory is set
        absolutePath = path.join(process.cwd(), expandedPath);
      }
    }

    // Normalize path
    return path.normalize(absolutePath);
  }

  /**
   * Parse a file path that may contain line number and symbol suffix
   * Format: path:lineNumber#symbolName or path:lineNumber or just path
   */
  private parsePathWithLineInfo(pathStr: string): { path: string; lineNumber?: number; symbolName?: string } {
    // Match pattern: path:lineNumber#symbolName or path:lineNumber
    const match = pathStr.match(/^(.+?):(\d+)(#(.+))?$/);
    if (match && match[1] && match[2]) {
      const result: { path: string; lineNumber?: number; symbolName?: string } = {
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
   * Handle open-file-in-editor IPC channel
   * Opens a file in the configured editor based on file extension
   * Supports paths with line numbers: path:lineNumber or path:lineNumber#symbolName
   */
  private async handleOpenFileInEditor(
    _event: IpcMainInvokeEvent,
    filePath: string
  ): Promise<IPCResult> {
    try {
      logger.info('Opening file in editor:', { filePath });

      // Validate input
      if (!filePath || typeof filePath !== 'string') {
        return { success: false, error: 'Invalid file path provided' };
      }

      // Parse line number and symbol from path
      const parsedPath = this.parsePathWithLineInfo(filePath);
      const cleanPath = parsedPath.path;

      logger.debug('Parsed file path:', {
        original: filePath,
        cleanPath,
        lineNumber: parsedPath.lineNumber,
        symbolName: parsedPath.symbolName
      });

      // Expand and resolve path (without line number suffix)
      const normalizedPath = this.expandPath(cleanPath);

      logger.debug('Resolved file path:', {
        original: filePath,
        cleanPath,
        baseDir: this.directoryManager.getDirectory(),
        resolved: normalizedPath,
        lineNumber: parsedPath.lineNumber
      });

      // File existence check (TOCTOU mitigation)
      try {
        await fs.access(normalizedPath);
      } catch {
        logger.warn('File does not exist:', { normalizedPath });
        return { success: false, error: 'File does not exist' };
      }

      // Open file using FileOpenerManager with line number option
      const options = parsedPath.lineNumber !== undefined
        ? { lineNumber: parsedPath.lineNumber }
        : undefined;
      return await this.fileOpenerManager.openFile(normalizedPath, options);
    } catch (error) {
      logger.error('Failed to open file in editor:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Handle check-file-exists IPC channel
   * Checks if a file exists at the specified path
   */
  private async handleCheckFileExists(
    _event: IpcMainInvokeEvent,
    filePath: string
  ): Promise<boolean> {
    try {
      // Validate input
      if (!filePath || typeof filePath !== 'string') {
        return false;
      }

      // Expand and resolve path
      const normalizedPath = this.expandPath(filePath);

      // Check if file exists
      await fs.access(normalizedPath);
      return true;
    } catch {
      // File does not exist or cannot be accessed
      return false;
    }
  }

  /**
   * Handle open-external-url IPC channel
   * Opens a URL in the system default browser with protocol validation
   */
  private async handleOpenExternalUrl(
    _event: IpcMainInvokeEvent,
    url: string
  ): Promise<IPCResult> {
    try {
      logger.info('Opening external URL:', { url });

      // Validate input
      if (!url || typeof url !== 'string') {
        return { success: false, error: 'Invalid URL provided' };
      }

      // Validate URL format using URL parser
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(url);
      } catch {
        return { success: false, error: 'Invalid URL format' };
      }

      // Whitelist protocols
      if (!ALLOWED_URL_PROTOCOLS.includes(parsedUrl.protocol)) {
        logger.warn('Attempted to open URL with disallowed protocol:', {
          url,
          protocol: parsedUrl.protocol
        });
        return { success: false, error: 'Only http:// and https:// URLs are allowed' };
      }

      // Open URL with system default browser
      await shell.openExternal(url);

      logger.info('URL opened successfully in browser:', { url });
      return { success: true };
    } catch (error) {
      logger.error('Failed to open external URL:', error);
      return { success: false, error: (error as Error).message };
    }
  }
}

export default FileHandler;
