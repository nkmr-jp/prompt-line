import { promises as fs } from 'fs';
import path from 'path';
import { logger, safeJsonStringify, safeJsonParse } from '../utils/utils';

interface DraftBackup {
  text: string;
  timestamp: number;
  originalFile: string;
  backupDate: string;
}

export class DraftBackupHelper {
  constructor(private draftFile: string) {}

  async createBackup(currentDraft: string): Promise<string> {
    try {
      if (!currentDraft || !currentDraft.trim()) {
        throw new Error('No draft to backup');
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFile = `${this.draftFile}.backup.${timestamp}`;

      const draft: DraftBackup = {
        text: currentDraft,
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

  async restoreBackup(backupFile: string): Promise<string> {
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

      logger.info('Draft restored from backup:', backupFile);
      return parsed.text;
    } catch (error) {
      logger.error('Failed to restore draft from backup:', error);
      throw error;
    }
  }

  async cleanupOldBackups(maxAge: number): Promise<number> {
    try {
      const dir = path.dirname(this.draftFile);
      const backupFiles = await this.getBackupFiles(dir);
      const cleanedCount = await this.removeOldBackups(backupFiles, dir, maxAge);

      logger.info(`Cleaned up ${cleanedCount} old draft backups`);
      return cleanedCount;
    } catch (error) {
      logger.error('Failed to cleanup draft backups:', error);
      throw error;
    }
  }

  private async getBackupFiles(dir: string): Promise<string[]> {
    const files = await fs.readdir(dir);
    return files.filter(file =>
      file.startsWith(path.basename(this.draftFile) + '.backup.')
    );
  }

  private async removeOldBackups(backupFiles: string[], dir: string, maxAge: number): Promise<number> {
    let cleanedCount = 0;
    const now = Date.now();

    for (const file of backupFiles) {
      const filePath = path.join(dir, file);
      const stats = await fs.stat(filePath);

      if (now - stats.mtime.getTime() > maxAge) {
        await fs.unlink(filePath);
        cleanedCount++;
        logger.debug('Cleaned up old backup:', file);
      }
    }

    return cleanedCount;
  }
}
