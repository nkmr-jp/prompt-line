import { promises as fs } from 'fs';
import path from 'path';
import config from '../config/app-config';
import {
  logger,
  safeJsonParse,
  safeJsonStringify,
  debounce
} from '../utils/utils';
import type {
  DebounceFunction
} from '../types';
import { DEBOUNCE, LIMITS } from '../constants';

interface DraftMetadata {
  length: number;
  timestamp: number;
  version: string;
  wordCount: number;
  lineCount: number;
  directory?: string;
}

interface DraftBackup {
  text: string;
  timestamp: number;
  originalFile: string;
  backupDate: string;
}

interface DraftStatsExtended {
  hasContent: boolean;
  length: number;
  wordCount: number;
  lineCount: number;
  isMultiline?: boolean;
}

class DraftManager {
  private draftFile: string;
  private currentDraft: string | null = null;
  private pendingSave = false;
  private hasUnsavedChanges = false;
  private lastSavedContent: string | null = null;
  private debouncedSave: DebounceFunction<[string]>;
  private quickSave: DebounceFunction<[string]>;

  constructor() {
    this.draftFile = config.paths.draftFile;

    this.debouncedSave = debounce(this._saveDraft.bind(this), DEBOUNCE.LONG_TEXT);
    this.quickSave = debounce(this._saveDraft.bind(this), DEBOUNCE.SHORT_TEXT);
  }

  async initialize(): Promise<void> {
    try {
      this.currentDraft = await this.loadDraft();
      logger.info('Draft manager initialized');
    } catch (error) {
      logger.error('Failed to initialize draft manager:', error);
      this.currentDraft = null;
    }
  }

  async loadDraft(): Promise<string> {
    try {
      const data = await fs.readFile(this.draftFile, 'utf8');

      if (!data || data.trim().length === 0) {
        return '';
      }

      const parsed = safeJsonParse<{ text?: string }>(data, {});

      if (parsed && typeof parsed.text === 'string') {
        return parsed.text;
      } else {
        return '';
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return '';
      } else {
        logger.error('Error loading draft:', error);
        throw error;
      }
    }
  }

  async saveDraft(text: string): Promise<void> {
    try {
      this.currentDraft = text;
      this.hasUnsavedChanges = true;

      if (!text || !text.trim()) {
        await this.clearDraft();
        return;
      }

      // サイズ制限を追加（1MB）
      const MAX_DRAFT_SIZE = 1024 * 1024; // 1MB
      if (Buffer.byteLength(text, 'utf8') > MAX_DRAFT_SIZE) {
        logger.warn('Draft too large, rejecting', {
          size: Buffer.byteLength(text, 'utf8'),
          limit: MAX_DRAFT_SIZE
        });
        throw new Error('Draft size exceeds 1MB limit');
      }

      if (text.length > DEBOUNCE.TEXT_LENGTH_THRESHOLD) {
        this.debouncedSave(text);
      } else {
        this.quickSave(text);
      }
    } catch (error) {
      logger.error('Failed to schedule draft save:', error);
      throw error;
    }
  }

  private async _saveDraft(text: string): Promise<void> {
    if (this.lastSavedContent === text) {
      return;
    }

    if (this.pendingSave) {
      return;
    }

    this.pendingSave = true;
    try {
      const draft = {
        text: text,
        timestamp: Date.now(),
        version: '1.0'
      };

      const data = safeJsonStringify(draft);
      // Set restrictive file permissions (owner read/write only)
      await fs.writeFile(this.draftFile, data, { mode: 0o600 });

      this.lastSavedContent = text;
      this.hasUnsavedChanges = false;
    } catch (error) {
      logger.error('Failed to save draft to file:', error);
      throw error;
    } finally {
      this.pendingSave = false;
    }
  }

  async saveDraftImmediately(text: string): Promise<void> {
    try {
      this.currentDraft = text;

      if (!text || !text.trim()) {
        await this.clearDraft();
        return;
      }

      // サイズ制限を追加（1MB）
      const MAX_DRAFT_SIZE = 1024 * 1024; // 1MB
      if (Buffer.byteLength(text, 'utf8') > MAX_DRAFT_SIZE) {
        logger.warn('Draft too large, rejecting', {
          size: Buffer.byteLength(text, 'utf8'),
          limit: MAX_DRAFT_SIZE
        });
        throw new Error('Draft size exceeds 1MB limit');
      }

      await this._saveDraft(text);
    } catch (error) {
      logger.error('Failed to save draft immediately:', error);
      throw error;
    }
  }

  async flushPendingSaves(): Promise<void> {
    if (this.hasUnsavedChanges && this.currentDraft !== this.lastSavedContent && this.currentDraft) {
      await this._saveDraft(this.currentDraft);
    }
  }

  async clearDraft(): Promise<void> {
    try {
      this.currentDraft = null;

      if (this.debouncedSave.cancel) {
        this.debouncedSave.cancel();
      }

      await fs.unlink(this.draftFile);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // Draft file already does not exist - ignore
      } else {
        logger.error('Failed to clear draft:', error);
        throw error;
      }
    }
  }

  getCurrentDraft(): string {
    return this.currentDraft || '';
  }

  hasDraft(): boolean {
    return !!(this.currentDraft && this.currentDraft.trim());
  }

  async getDraftMetadata(): Promise<DraftMetadata | null> {
    try {
      const data = await fs.readFile(this.draftFile, 'utf8');
      const parsed = safeJsonParse<{ text?: string; timestamp?: number; version?: string }>(data, {});
      
      if (parsed && parsed.text) {
        return {
          length: parsed.text.length,
          timestamp: parsed.timestamp || 0,
          version: parsed.version || '1.0',
          wordCount: parsed.text.split(/\s+/).filter(word => word.length > 0).length,
          lineCount: parsed.text.split('\n').length
        };
      }
      
      return null;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      logger.error('Failed to get draft metadata:', error);
      throw error;
    }
  }

  async updateDraft(text: string, immediate = false): Promise<void> {
    try {
      this.currentDraft = text;
      
      if (immediate) {
        await this.saveDraftImmediately(text);
      } else {
        await this.saveDraft(text);
      }
    } catch (error) {
      logger.error('Failed to update draft:', error);
      throw error;
    }
  }

  getDraftStats(): DraftStatsExtended {
    const text = this.getCurrentDraft();
    
    if (!text) {
      return {
        hasContent: false,
        length: 0,
        wordCount: 0,
        lineCount: 0
      };
    }
    
    return {
      hasContent: true,
      length: text.length,
      wordCount: text.split(/\s+/).filter(word => word.length > 0).length,
      lineCount: text.split('\n').length,
      isMultiline: text.includes('\n')
    };
  }

  async backupDraft(): Promise<string> {
    try {
      if (!this.hasDraft()) {
        throw new Error('No draft to backup');
      }
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFile = `${this.draftFile}.backup.${timestamp}`;
      
      const draft: DraftBackup = {
        text: this.currentDraft!,
        timestamp: Date.now(),
        originalFile: this.draftFile,
        backupDate: new Date().toISOString()
      };
      
      const data = safeJsonStringify(draft);
      // Set restrictive file permissions (owner read/write only)
      await fs.writeFile(backupFile, data, { mode: 0o600 });

      logger.info('Draft backed up to:', backupFile);
      return backupFile;
    } catch (error) {
      logger.error('Failed to backup draft:', error);
      throw error;
    }
  }

  async restoreDraft(backupFile: string): Promise<void> {
    try {
      // Validate backup file path to prevent path traversal attacks
      const normalizedPath = path.normalize(backupFile);
      const userDataDir = path.dirname(this.draftFile);
      
      if (!normalizedPath.startsWith(path.normalize(userDataDir))) {
        throw new Error('Invalid backup file path');
      }
      
      const data = await fs.readFile(normalizedPath, 'utf8');
      const parsed = safeJsonParse<DraftBackup>(data, {} as DraftBackup);
      
      if (!parsed || !parsed.text) {
        throw new Error('Invalid backup file format');
      }
      
      await this.saveDraftImmediately(parsed.text);
      logger.info('Draft restored from backup:', backupFile);
    } catch (error) {
      logger.error('Failed to restore draft from backup:', error);
      throw error;
    }
  }

  async cleanupBackups(maxAge = LIMITS.MAX_BACKUP_AGE): Promise<number> {
    try {
      const dir = path.dirname(this.draftFile);
      const files = await fs.readdir(dir);
      
      const backupFiles = files.filter(file => 
        file.startsWith(path.basename(this.draftFile) + '.backup.')
      );
      
      let cleanedCount = 0;
      const now = Date.now();
      
      for (const file of backupFiles) {
        const filePath = path.join(dir, file);
        const stats = await fs.stat(filePath);
        
        if (now - stats.mtime.getTime() > maxAge) {
          await fs.unlink(filePath);
          cleanedCount++;
        }
      }
      
      logger.info(`Cleaned up ${cleanedCount} old draft backups`);
      return cleanedCount;
    } catch (error) {
      logger.error('Failed to cleanup draft backups:', error);
      throw error;
    }
  }

  async destroy(): Promise<void> {
    try {
      await this.flushPendingSaves();
      
      if (this.debouncedSave.cancel) {
        this.debouncedSave.cancel();
      }
      if (this.quickSave.cancel) {
        this.quickSave.cancel();
      }
      
      this.currentDraft = null;
      this.hasUnsavedChanges = false;
      this.lastSavedContent = null;
    } catch (error) {
      logger.error('Error during draft manager cleanup:', error);
    }
  }
}

export default DraftManager;