import { promises as fs } from 'fs';
import path from 'path';
import { createReadStream, createWriteStream } from 'fs';
import { createInterface } from 'readline';
import { logger } from '../utils/utils';
import type {
  FileInfo,
  CachedFileEntry,
  FileCacheStats,
  FileCacheMetadata,
  GlobalCacheMetadata
} from '../types';

/**
 * Encode directory path for cache directory name
 * Claude projects style: / -> -
 * Example: /Users/nkmr/ghq -> -Users-nkmr-ghq
 */
export function encodeDirectoryPath(directory: string): string {
  return directory.replace(/\//g, '-');
}

/**
 * Convert FileInfo to CachedFileEntry for storage
 * Uses compact format to reduce file size
 */
export function fileInfoToCacheEntry(file: FileInfo): CachedFileEntry {
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
export function cacheEntryToFileInfo(entry: CachedFileEntry): FileInfo {
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
export async function readJsonlFile(filePath: string): Promise<CachedFileEntry[]> {
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
export async function writeJsonlFile(
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

/**
 * Build stats result from collected stats data
 */
export function buildStatsResult(stats: {
  totalCaches: number;
  totalFiles: number;
  oldestCache: string | null;
  newestCache: string | null;
  totalSizeBytes: number;
}): FileCacheStats {
  return {
    totalCaches: stats.totalCaches,
    totalFiles: stats.totalFiles,
    oldestCache: stats.oldestCache,
    newestCache: stats.newestCache,
    totalSizeBytes: stats.totalSizeBytes
  };
}

/**
 * Build empty stats result
 */
export function buildEmptyStatsResult(): FileCacheStats {
  return {
    totalCaches: 0,
    totalFiles: 0,
    oldestCache: null,
    newestCache: null,
    totalSizeBytes: 0
  };
}

/**
 * Get cache file paths for a cache directory
 */
export function getCacheFilePaths(cachePath: string) {
  return {
    metadataPath: path.join(cachePath, 'metadata.json'),
    filesPath: path.join(cachePath, 'files.jsonl')
  };
}

/**
 * Check if cache files exist
 */
export async function cacheFilesExist(paths: { metadataPath: string; filesPath: string }): Promise<boolean> {
  try {
    await fs.access(paths.metadataPath);
    await fs.access(paths.filesPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read cache metadata from file
 */
export async function readCacheMetadata(metadataPath: string): Promise<FileCacheMetadata> {
  const metadataContent = await fs.readFile(metadataPath, 'utf8');
  return JSON.parse(metadataContent) as FileCacheMetadata;
}

/**
 * Create default global metadata
 */
export function createDefaultGlobalMetadata(cacheVersion: string): GlobalCacheMetadata {
  return {
    version: cacheVersion,
    lastUsedDirectory: null,
    lastUsedAt: null,
    recentDirectories: []
  };
}

/**
 * Update global metadata with directory
 */
export function updateMetadataWithDirectory(
  metadata: GlobalCacheMetadata,
  directory: string,
  now: string,
  maxRecentDirectories: number
): void {
  metadata.lastUsedDirectory = directory;
  metadata.lastUsedAt = now;

  metadata.recentDirectories = metadata.recentDirectories.filter(
    item => item.directory !== directory
  );

  metadata.recentDirectories.unshift({
    directory,
    lastUsedAt: now
  });

  metadata.recentDirectories = metadata.recentDirectories.slice(
    0,
    maxRecentDirectories
  );
}

/**
 * Save global metadata to file
 */
export async function saveGlobalMetadata(filePath: string, metadata: GlobalCacheMetadata): Promise<void> {
  await fs.writeFile(
    filePath,
    JSON.stringify(metadata, null, 2)
  );
}

/**
 * Stats accumulator type
 */
export interface StatsAccumulator {
  totalCaches: number;
  totalFiles: number;
  oldestCache: string | null;
  newestCache: string | null;
  totalSizeBytes: number;
  oldestTimestamp: number;
  newestTimestamp: number;
}

/**
 * Initialize stats accumulator
 */
export function initializeStats(): StatsAccumulator {
  return {
    totalCaches: 0,
    totalFiles: 0,
    oldestCache: null,
    newestCache: null,
    totalSizeBytes: 0,
    oldestTimestamp: Number.MAX_SAFE_INTEGER,
    newestTimestamp: 0
  };
}

/**
 * Update timestamp stats with metadata
 */
export function updateTimestampStats(metadata: FileCacheMetadata, stats: StatsAccumulator): void {
  const timestamp = new Date(metadata.updatedAt).getTime();

  if (timestamp < stats.oldestTimestamp) {
    stats.oldestTimestamp = timestamp;
    stats.oldestCache = metadata.directory;
  }

  if (timestamp > stats.newestTimestamp) {
    stats.newestTimestamp = timestamp;
    stats.newestCache = metadata.directory;
  }
}

/**
 * Update size stats for an entry
 */
export async function updateSizeStats(cacheDir: string, entryName: string, stats: StatsAccumulator): Promise<void> {
  const filesPath = path.join(cacheDir, entryName, 'files.jsonl');
  const fileStats = await fs.stat(filesPath);
  stats.totalSizeBytes += fileStats.size;
}

/**
 * Process cache entry for stats collection
 */
export async function processEntryStats(
  cacheDir: string,
  entry: { name: string; isDirectory(): boolean },
  stats: StatsAccumulator
): Promise<void> {
  const metadataPath = path.join(cacheDir, entry.name, 'metadata.json');

  try {
    const content = await fs.readFile(metadataPath, 'utf8');
    const metadata = JSON.parse(content) as FileCacheMetadata;

    stats.totalCaches++;
    stats.totalFiles += metadata.fileCount;

    updateTimestampStats(metadata, stats);
    await updateSizeStats(cacheDir, entry.name, stats);
  } catch {
    // Skip invalid cache entries
  }
}

/**
 * Check if cache entry is old and should be removed
 */
export async function shouldRemoveCacheEntry(
  cacheDir: string,
  entryName: string,
  maxAgeMs: number,
  now: number
): Promise<{ shouldRemove: boolean; directory?: string }> {
  const metadataPath = path.join(cacheDir, entryName, 'metadata.json');

  try {
    const content = await fs.readFile(metadataPath, 'utf8');
    const metadata = JSON.parse(content) as FileCacheMetadata;
    const timestamp = new Date(metadata.updatedAt).getTime();
    const age = now - timestamp;

    if (age > maxAgeMs) {
      return { shouldRemove: true, directory: metadata.directory };
    }
  } catch {
    // Skip invalid cache entries
  }

  return { shouldRemove: false };
}

/**
 * Create cache metadata object
 */
export function createCacheMetadata(
  directory: string,
  fileCount: number,
  cacheVersion: string,
  defaultTtlSeconds: number,
  options?: { gitignoreRespected?: boolean }
): FileCacheMetadata {
  const now = new Date().toISOString();
  return {
    version: cacheVersion,
    directory,
    createdAt: now,
    updatedAt: now,
    fileCount,
    ttlSeconds: defaultTtlSeconds,
    searchMode: 'recursive',
    ...(options?.gitignoreRespected !== undefined && {
      gitignoreRespected: options.gitignoreRespected
    })
  };
}

/**
 * Check if cache metadata is valid
 */
export function isCacheMetadataValid(
  metadata: FileCacheMetadata,
  ttlSeconds: number | undefined,
  defaultTtlSeconds: number
): boolean {
  // Invalidate cache if fileCount is 0 (indicates failed indexing)
  if (metadata.fileCount === 0) {
    return false;
  }

  const ttl = ttlSeconds ?? metadata.ttlSeconds ?? defaultTtlSeconds;
  const updatedAt = new Date(metadata.updatedAt).getTime();
  const now = Date.now();
  const ageMs = now - updatedAt;
  return ageMs < ttl * 1000;
}

/**
 * Update cache metadata timestamp
 */
export async function updateCacheMetadataTimestamp(metadataPath: string): Promise<void> {
  const metadataContent = await fs.readFile(metadataPath, 'utf8');
  const metadata = JSON.parse(metadataContent) as FileCacheMetadata;
  metadata.updatedAt = new Date().toISOString();
  await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), { mode: 0o600 });
}
