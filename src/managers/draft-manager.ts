import { promises as fs } from 'fs';
import path from 'path';
import config from '../config/app-config';
import {
  logger,
  safeJsonParse,
  safeJsonStringify
} from '../utils/utils';
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
  private currentScrollTop = 0;
  private pendingSave = false;
  private hasUnsavedChanges = false;
  private lastSavedContent: string | null = null;
  private lastSavedScrollTop = 0;
  private saveTimer: number | null = null;

  constructor() {
    this.draftFile = config.paths.draftFile;
  }

  async initialize(): Promise<void> {
    try {
      const draftData = await this.loadDraftData();
      this.currentDraft = draftData.text;
      this.currentScrollTop = draftData.scrollTop;
    } catch (error) {
      logger.error('Failed to initialize draft manager:', error);
      this.currentDraft = null;
      this.currentScrollTop = 0;
    }
  }

  async loadDraft(): Promise<string> {
    const draftData = await this.loadDraftData();
    return draftData.text;
  }

  async loadDraftData(): Promise<{ text: string; scrollTop: number }> {
    try {
      const data = await fs.readFile(this.draftFile, 'utf8');

      if (!data || data.trim().length === 0) {
        return { text: '', scrollTop: 0 };
      }

      const parsed = safeJsonParse<{ text?: string; scrollTop?: number }>(data, {});

      if (parsed && typeof parsed.text === 'string') {
        return {
          text: parsed.text,
          scrollTop: typeof parsed.scrollTop === 'number' ? parsed.scrollTop : 0
        };
      } else {
        return { text: '', scrollTop: 0 };
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { text: '', scrollTop: 0 };
      } else {
        logger.error('Error loading draft:', error);
        throw error;
      }
    }
  }

  async saveDraft(text: string, scrollTop = 0): Promise<void> {
    try {
      this.currentDraft = text;
      this.currentScrollTop = scrollTop;
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

      // 前回のタイマーをクリア
      if (this.saveTimer !== null) {
        clearTimeout(this.saveTimer);
      }

      // テキスト長に応じて遅延を動的に決定
      const delay = text.length > DEBOUNCE.TEXT_LENGTH_THRESHOLD ? DEBOUNCE.LONG_TEXT : DEBOUNCE.SHORT_TEXT;

      this.saveTimer = setTimeout(() => {
        this._saveDraft(text, scrollTop);
        this.saveTimer = null;
      }, delay) as unknown as number;
    } catch (error) {
      logger.error('Failed to schedule draft save:', error);
      throw error;
    }
  }

  private async _saveDraft(text: string, scrollTop = 0): Promise<void> {
    if (this.lastSavedContent === text && this.lastSavedScrollTop === scrollTop) {
      return;
    }

    if (this.pendingSave) {
      return;
    }

    this.pendingSave = true;
    try {
      const draft = {
        text: text,
        scrollTop: scrollTop,
        timestamp: Date.now(),
        version: '1.0'
      };

      const data = safeJsonStringify(draft);
      // Set restrictive file permissions (owner read/write only)
      await fs.writeFile(this.draftFile, data, { mode: 0o600 });

      this.lastSavedContent = text;
      this.lastSavedScrollTop = scrollTop;
      this.hasUnsavedChanges = false;
    } catch (error) {
      logger.error('Failed to save draft to file:', error);
      throw error;
    } finally {
      this.pendingSave = false;
    }
  }

  async saveDraftImmediately(text: string, scrollTop = 0): Promise<void> {
    try {
      this.currentDraft = text;
      this.currentScrollTop = scrollTop;

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

      await this._saveDraft(text, scrollTop);
    } catch (error) {
      logger.error('Failed to save draft immediately:', error);
      throw error;
    }
  }

  async flushPendingSaves(): Promise<void> {
    if (this.hasUnsavedChanges && this.currentDraft !== this.lastSavedContent && this.currentDraft) {
      await this._saveDraft(this.currentDraft, this.currentScrollTop);
    }
  }

  async clearDraft(): Promise<void> {
    try {
      this.currentDraft = null;
      this.currentScrollTop = 0;

      // タイマーをクリア
      if (this.saveTimer !== null) {
        clearTimeout(this.saveTimer);
        this.saveTimer = null;
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

  getCurrentScrollTop(): number {
    return this.currentScrollTop;
  }

  getDraftWithScrollTop(): { text: string; scrollTop: number } {
    return {
      text: this.currentDraft || '',
      scrollTop: this.currentScrollTop
    };
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

      // タイマーをクリア
      if (this.saveTimer !== null) {
        clearTimeout(this.saveTimer);
        this.saveTimer = null;
      }

      this.currentDraft = null;
      this.currentScrollTop = 0;
      this.hasUnsavedChanges = false;
      this.lastSavedContent = null;
      this.lastSavedScrollTop = 0;
    } catch (error) {
      logger.error('Error during draft manager cleanup:', error);
    }
  }
}

export default DraftManager;