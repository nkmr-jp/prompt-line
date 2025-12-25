import { promises as fs } from 'fs';
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
import { DraftBackupHelper } from './draft-backup-helper';

interface DraftMetadata {
  length: number;
  timestamp: number;
  version: string;
  wordCount: number;
  lineCount: number;
  directory?: string;
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
  private saveDelay: number;
  private currentDraft: string | null = null;
  private pendingSave = false;
  private hasUnsavedChanges = false;
  private lastSavedContent: string | null = null;
  private debouncedSave: DebounceFunction<[string]>;
  private quickSave: DebounceFunction<[string]>;
  private backupHelper: DraftBackupHelper;

  constructor() {
    this.draftFile = config.paths.draftFile;
    this.saveDelay = config.draft.saveDelay;

    this.debouncedSave = debounce(this._saveDraft.bind(this), this.saveDelay * 2);
    this.quickSave = debounce(this._saveDraft.bind(this), this.saveDelay);
    this.backupHelper = new DraftBackupHelper(this.draftFile);
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
      return this.parseDraftData(data);
    } catch (error) {
      return this.handleLoadDraftError(error);
    }
  }

  private parseDraftData(data: string): string {
    if (!data || data.trim().length === 0) {
      logger.debug('Draft file is empty');
      return '';
    }

    const parsed = safeJsonParse<{ text?: string }>(data, {});

    if (parsed && typeof parsed.text === 'string') {
      logger.debug('Draft loaded:', { length: parsed.text.length });
      return parsed.text;
    }

    logger.debug('No valid draft found');
    return '';
  }

  private handleLoadDraftError(error: unknown): string {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      logger.debug('Draft file not found');
      return '';
    }

    logger.error('Error loading draft:', error);
    throw error;
  }

  async saveDraft(text: string): Promise<void> {
    try {
      this.currentDraft = text;
      this.hasUnsavedChanges = true;

      if (!text || !text.trim()) {
        await this.clearDraft();
        return;
      }

      this.validateDraftSize(text);
      this.scheduleSave(text);

      logger.debug('Draft save scheduled (optimized):', { length: text.length });
    } catch (error) {
      logger.error('Failed to schedule draft save:', error);
      throw error;
    }
  }

  private validateDraftSize(text: string): void {
    const MAX_DRAFT_SIZE = 1024 * 1024; // 1MB
    const size = Buffer.byteLength(text, 'utf8');

    if (size > MAX_DRAFT_SIZE) {
      logger.warn('Draft too large, rejecting', { size, limit: MAX_DRAFT_SIZE });
      throw new Error('Draft size exceeds 1MB limit');
    }
  }

  private scheduleSave(text: string): void {
    if (text.length > 200) {
      this.debouncedSave(text);
    } else {
      this.quickSave(text);
    }
  }

  private async _saveDraft(text: string): Promise<void> {
    if (this.shouldSkipSave(text)) {
      return;
    }

    this.pendingSave = true;
    try {
      await this.writeDraftToFile(text);
      this.updateSaveState(text);
      logger.debug('Draft saved to file (optimized):', { length: text.length });
    } catch (error) {
      logger.error('Failed to save draft to file:', error);
      throw error;
    } finally {
      this.pendingSave = false;
    }
  }

  private shouldSkipSave(text: string): boolean {
    if (this.lastSavedContent === text) {
      logger.debug('Draft save skipped - no changes');
      return true;
    }

    if (this.pendingSave) {
      return true;
    }

    return false;
  }

  private async writeDraftToFile(text: string): Promise<void> {
    const draft = {
      text: text,
      timestamp: Date.now(),
      version: '1.0'
    };

    const data = safeJsonStringify(draft);
    // Set restrictive file permissions (owner read/write only)
    await fs.writeFile(this.draftFile, data, { mode: 0o600 });
  }

  private updateSaveState(text: string): void {
    this.lastSavedContent = text;
    this.hasUnsavedChanges = false;
  }

  async saveDraftImmediately(text: string): Promise<void> {
    try {
      this.currentDraft = text;

      if (!text || !text.trim()) {
        await this.clearDraft();
        return;
      }

      this.validateDraftSize(text);

      await this._saveDraft(text);
      logger.debug('Draft saved immediately (optimized):', { length: text.length });
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
      logger.debug('Draft cleared and file removed');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        logger.debug('Draft file already does not exist');
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
    if (!this.hasDraft()) {
      throw new Error('No draft to backup');
    }
    return this.backupHelper.createBackup(this.currentDraft!);
  }

  async restoreDraft(backupFile: string): Promise<void> {
    const text = await this.backupHelper.restoreBackup(backupFile);
    await this.saveDraftImmediately(text);
  }

  async cleanupBackups(maxAge = 7 * 24 * 60 * 60 * 1000): Promise<number> {
    return this.backupHelper.cleanupOldBackups(maxAge);
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
      
      logger.debug('Draft manager destroyed (optimized cleanup completed)');
    } catch (error) {
      logger.error('Error during draft manager cleanup:', error);
    }
  }
}

export default DraftManager;