import { createReadStream, createWriteStream } from 'fs';
import { createInterface } from 'readline';
import { logger } from '../utils/utils';
import type { CachedFileEntry, FileInfo } from '../types';

export class FileCacheIOHelper {
  /**
   * Convert FileInfo to CachedFileEntry for storage
   * Uses compact format to reduce file size
   */
  fileInfoToCacheEntry(file: FileInfo): CachedFileEntry {
    const entry: CachedFileEntry = {
      path: file.path,
      name: file.name,
      type: file.isDirectory ? 'directory' : 'file'
    };

    if (file.size !== undefined) {
      entry.size = file.size;
    }

    if (file.modifiedAt) {
      entry.mtime = new Date(file.modifiedAt).getTime();
    }

    return entry;
  }

  /**
   * Convert CachedFileEntry to FileInfo for use
   */
  cacheEntryToFileInfo(entry: CachedFileEntry): FileInfo {
    const fileInfo: FileInfo = {
      path: entry.path,
      name: entry.name,
      isDirectory: entry.type === 'directory'
    };

    if (entry.size !== undefined) {
      fileInfo.size = entry.size;
    }

    if (entry.mtime !== undefined) {
      fileInfo.modifiedAt = new Date(entry.mtime).toISOString();
    }

    return fileInfo;
  }

  /**
   * Read JSONL file as stream for memory efficiency
   */
  async readJsonlFile(filePath: string): Promise<CachedFileEntry[]> {
    return new Promise((resolve, reject) => {
      const entries: CachedFileEntry[] = [];
      const fileStream = createReadStream(filePath);
      const rl = createInterface({
        input: fileStream,
        crlfDelay: Infinity
      });

      rl.on('line', (line) => {
        try {
          if (line.trim()) {
            const entry = JSON.parse(line) as CachedFileEntry;
            entries.push(entry);
          }
        } catch {
          logger.warn('Invalid JSONL line in cache file:', line);
        }
      });

      rl.on('close', () => {
        resolve(entries);
      });

      rl.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Write JSONL file as stream for memory efficiency
   */
  async writeJsonlFile(
    filePath: string,
    entries: CachedFileEntry[]
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      // Set restrictive file permissions (owner read/write only)
      const writeStream = createWriteStream(filePath, { mode: 0o600 });

      writeStream.on('error', reject);
      writeStream.on('finish', resolve);

      for (const entry of entries) {
        writeStream.write(JSON.stringify(entry) + '\n');
      }

      writeStream.end();
    });
  }
}
