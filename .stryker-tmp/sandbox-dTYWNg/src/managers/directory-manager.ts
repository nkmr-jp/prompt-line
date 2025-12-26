// @ts-nocheck
import { promises as fs } from 'fs';
import config from '../config/app-config';
import {
  logger,
  safeJsonParse,
  safeJsonStringify
} from '../utils/utils';

interface DirectoryData {
  directory: string;
  timestamp: number;
  method?: string;
}

/**
 * DirectoryManager - Manages the last launched directory information
 *
 * This manager handles the persistence of directory information separately from drafts.
 * The directory information is used for:
 * - File search operations
 * - @path highlighting restoration
 * - Window context preservation
 */
class DirectoryManager {
  private directoryFile: string;
  private currentDirectory: string | null = null;
  private currentMethod: string | null = null;
  private lastSaveTimestamp: number = 0;

  constructor() {
    this.directoryFile = config.paths.directoryFile;
  }

  /**
   * Initialize the directory manager
   * Loads saved directory and handles migration from draft.json
   */
  async initialize(): Promise<void> {
    try {
      // First, try to migrate from draft.json if directory.json doesn't exist
      await this.migrateFromDraft();

      // Then load the directory
      await this.loadDirectory();
      logger.info('Directory manager initialized', { directory: this.currentDirectory });
    } catch (error) {
      logger.error('Failed to initialize directory manager:', error);
      this.currentDirectory = null;
    }
  }

  /**
   * Migrate directory information from draft.json to directory.json
   * This is a one-time migration for existing users
   */
  private async migrateFromDraft(): Promise<void> {
    try {
      // Check if directory.json already exists
      try {
        await fs.access(this.directoryFile);
        // File exists, no need to migrate
        return;
      } catch {
        // File doesn't exist, continue with migration
      }

      // Try to read draft.json
      const draftFile = config.paths.draftFile;
      try {
        const data = await fs.readFile(draftFile, 'utf8');
        const parsed = safeJsonParse<{ directory?: string }>(data, {});

        if (parsed && parsed.directory) {
          // Save directory to new file
          await this.saveDirectory(parsed.directory);
          logger.info('Migrated directory from draft.json:', { directory: parsed.directory });
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          logger.debug('No draft.json to migrate from or error reading:', error);
        }
      }
    } catch (error) {
      logger.error('Failed to migrate directory from draft:', error);
    }
  }

  /**
   * Load directory information from file
   */
  private async loadDirectory(): Promise<void> {
    try {
      const data = await fs.readFile(this.directoryFile, 'utf8');

      if (!data || data.trim().length === 0) {
        logger.debug('Directory file is empty');
        return;
      }

      const parsed = safeJsonParse<DirectoryData>(data, {} as DirectoryData);

      if (parsed && typeof parsed.directory === 'string') {
        this.currentDirectory = parsed.directory;
        this.currentMethod = parsed.method || null;
        this.lastSaveTimestamp = parsed.timestamp || 0;
        logger.debug('Directory loaded:', {
          directory: this.currentDirectory,
          method: this.currentMethod
        });
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        logger.debug('Directory file not found');
      } else {
        logger.error('Error loading directory:', error);
        throw error;
      }
    }
  }

  /**
   * Save directory information to file
   */
  async saveDirectory(directory: string, method?: string): Promise<void> {
    try {
      this.currentDirectory = directory;
      this.currentMethod = method || this.currentMethod;
      this.lastSaveTimestamp = Date.now();

      const data: DirectoryData = {
        directory: directory,
        timestamp: this.lastSaveTimestamp
      };

      if (this.currentMethod) {
        data.method = this.currentMethod;
      }

      const jsonData = safeJsonStringify(data);
      // Set restrictive file permissions (owner read/write only)
      await fs.writeFile(this.directoryFile, jsonData, { mode: 0o600 });

      logger.debug('Directory saved:', {
        directory: this.currentDirectory,
        method: this.currentMethod
      });
    } catch (error) {
      logger.error('Failed to save directory:', error);
      throw error;
    }
  }

  /**
   * Set the current directory (in memory only, does not persist)
   */
  setDirectory(directory: string | null, method?: string): void {
    this.currentDirectory = directory;
    if (method) {
      this.currentMethod = method;
    }
    logger.debug('Directory set (in-memory):', { directory, method });
  }

  /**
   * Get the current directory
   */
  getDirectory(): string | null {
    return this.currentDirectory;
  }

  /**
   * Get the detection method used for the current directory
   */
  getMethod(): string | null {
    return this.currentMethod;
  }

  /**
   * Get the last save timestamp
   */
  getLastSaveTimestamp(): number {
    return this.lastSaveTimestamp;
  }

  /**
   * Check if a directory is set
   */
  hasDirectory(): boolean {
    return !!this.currentDirectory;
  }

  /**
   * Clear directory information (both in-memory and file)
   */
  async clearDirectory(): Promise<void> {
    try {
      this.currentDirectory = null;
      this.currentMethod = null;
      this.lastSaveTimestamp = 0;

      await fs.unlink(this.directoryFile);
      logger.debug('Directory cleared and file removed');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        logger.debug('Directory file already does not exist');
      } else {
        logger.error('Failed to clear directory:', error);
        throw error;
      }
    }
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    this.currentDirectory = null;
    this.currentMethod = null;
    this.lastSaveTimestamp = 0;
    logger.debug('Directory manager destroyed');
  }
}

export default DirectoryManager;
