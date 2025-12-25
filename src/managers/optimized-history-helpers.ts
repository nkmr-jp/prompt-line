/**
 * Helper functions for OptimizedHistoryManager
 * Extracted to reduce file complexity
 */

import { promises as fs, createReadStream } from 'fs';
import { createInterface } from 'readline';
import { logger, safeJsonParse } from '../utils/utils';
import type { HistoryItem } from '../types';

/**
 * Read last N lines from a file efficiently using backwards reading
 */
export async function readLastNLines(filePath: string, lineCount = 100): Promise<string[]> {
  const fd = await fs.open(filePath, 'r');
  const stats = await fd.stat();
  const fileSize = stats.size;

  if (fileSize === 0) {
    await fd.close();
    return [];
  }

  try {
    return await readLinesBackwards(fd, fileSize, lineCount);
  } finally {
    await fd.close();
  }
}

/**
 * Read lines backwards from file using chunked reading
 */
async function readLinesBackwards(
  fd: import('fs/promises').FileHandle,
  fileSize: number,
  lineCount: number
): Promise<string[]> {
  let position = fileSize;
  const lines: string[] = [];
  let remainder = '';
  const chunkSize = 8192;

  while (lines.length < lineCount && position > 0) {
    const readSize = Math.min(chunkSize, position);
    position -= readSize;

    const buffer = Buffer.alloc(readSize);
    await fd.read(buffer, 0, readSize, position);

    const chunk = buffer.toString('utf8');
    const text = chunk + remainder;
    const textLines = text.split('\n');

    remainder = position > 0 ? textLines.shift() || '' : '';

    collectValidLines(textLines, lines, lineCount);
  }

  return lines.slice(-lineCount);
}

/**
 * Collect valid non-empty lines
 */
function collectValidLines(textLines: string[], lines: string[], lineCount: number): void {
  for (let i = textLines.length - 1; i >= 0 && lines.length < lineCount; i--) {
    const line = textLines[i]?.trim();
    if (line) {
      lines.unshift(line);
    }
  }
}

/**
 * Count total items in history file using streaming
 */
export async function countHistoryItems(filePath: string): Promise<number> {
  return new Promise((resolve) => {
    let count = 0;
    const stream = createReadStream(filePath);
    const rl = createInterface({
      input: stream,
      crlfDelay: Infinity
    });

    rl.on('line', (line) => {
      if (line.trim()) count++;
    });

    rl.on('close', () => {
      resolve(count);
    });

    rl.on('error', (error: Error) => {
      logger.error('Error counting history items:', error);
      resolve(0);
    });
  });
}

/**
 * Parse and validate history items from lines
 */
export function parseHistoryLines(
  lines: string[],
  validator: (item: unknown) => item is HistoryItem
): HistoryItem[] {
  const items: HistoryItem[] = [];

  for (const line of lines) {
    const item = safeJsonParse<HistoryItem>(line);
    if (item && validator(item)) {
      items.unshift(item); // Newest first
    }
  }

  return items;
}

/**
 * Stream all history items from file
 */
export async function streamHistoryItems(
  filePath: string,
  validator: (item: unknown) => item is HistoryItem
): Promise<HistoryItem[]> {
  const allItems: HistoryItem[] = [];
  const stream = createReadStream(filePath);
  const rl = createInterface({
    input: stream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    const item = safeJsonParse<HistoryItem>(line);
    if (item && validator(item)) {
      allItems.push(item);
    }
  }

  return allItems;
}

/**
 * Validate history item structure
 */
export function validateHistoryItem(item: unknown): item is HistoryItem {
  return (
    typeof item === 'object' &&
    item !== null &&
    'text' in item &&
    'timestamp' in item &&
    'id' in item &&
    typeof (item as HistoryItem).text === 'string' &&
    typeof (item as HistoryItem).timestamp === 'number' &&
    typeof (item as HistoryItem).id === 'string' &&
    (item as HistoryItem).text.length > 0
  );
}

/**
 * Handle duplicate history items
 */
export function handleDuplicateInCache(
  text: string,
  cache: HistoryItem[],
  duplicateSet: Set<string>,
  appName?: string,
  directory?: string
): { updatedCache: HistoryItem[]; existingItem: HistoryItem | null } {
  if (!duplicateSet.has(text)) {
    return { updatedCache: cache, existingItem: null };
  }

  const filteredCache = cache.filter(item => item.text !== text);
  const existingItem = cache.find(item => item.text === text);

  if (existingItem) {
    existingItem.timestamp = Date.now();
    if (appName) existingItem.appName = appName;
    if (directory) existingItem.directory = directory;
    filteredCache.unshift(existingItem);
    return { updatedCache: filteredCache, existingItem };
  }

  return { updatedCache: filteredCache, existingItem: null };
}

/**
 * Add item to cache and maintain cache size
 */
export function addItemToCache(
  item: HistoryItem,
  cache: HistoryItem[],
  duplicateSet: Set<string>,
  maxSize: number
): { updatedCache: HistoryItem[]; updatedSet: Set<string> } {
  const updatedCache = [item, ...cache];
  const updatedSet = new Set(duplicateSet);
  updatedSet.add(item.text);

  if (updatedCache.length > maxSize) {
    const removed = updatedCache.pop();
    if (removed) {
      updatedSet.delete(removed.text);
    }
  }

  return { updatedCache, updatedSet };
}

/**
 * Append items to history file
 */
export async function appendItemsToFile(
  filePath: string,
  items: HistoryItem[]
): Promise<void> {
  if (items.length === 0) return;

  const lines = items
    .map(item => JSON.stringify(item))
    .join('\n') + '\n';

  await fs.appendFile(filePath, lines);
}

/**
 * Ensure history file exists with proper permissions
 */
export async function ensureHistoryFileExists(filePath: string): Promise<void> {
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, '', { mode: 0o600 });
    logger.debug('Created new history file');
  }
}

/**
 * Calculate statistics from history items
 */
export function calculateHistoryStats(
  cachedItems: HistoryItem[],
  totalItemCount: number,
  totalItemCountCached: boolean
): import('../types').HistoryStats {
  const totalItems = totalItemCountCached ? totalItemCount : cachedItems.length;
  const totalCharacters = cachedItems.reduce((sum, item) => sum + item.text.length, 0);
  const oldestTimestamp = cachedItems.length > 0 ?
    Math.min(...cachedItems.map(item => item.timestamp)) : null;
  const newestTimestamp = cachedItems.length > 0 ?
    Math.max(...cachedItems.map(item => item.timestamp)) : null;

  return {
    totalItems,
    totalCharacters,
    averageLength: cachedItems.length > 0 ? Math.round(totalCharacters / cachedItems.length) : 0,
    oldestTimestamp,
    newestTimestamp,
  };
}

/**
 * Remove item from cache by ID
 */
export function removeItemFromCache(
  id: string,
  cache: HistoryItem[],
  duplicateSet: Set<string>
): { updatedCache: HistoryItem[]; updatedSet: Set<string>; removed: boolean } {
  const initialLength = cache.length;
  const removedItem = cache.find(item => item.id === id);
  const updatedCache = cache.filter(item => item.id !== id);
  const updatedSet = new Set(duplicateSet);

  if (updatedCache.length < initialLength && removedItem) {
    updatedSet.delete(removedItem.text);
    return { updatedCache, updatedSet, removed: true };
  }

  return { updatedCache: cache, updatedSet: duplicateSet, removed: false };
}

/**
 * Search history items by query
 */
export function searchHistoryItems(
  items: HistoryItem[],
  query: string,
  limit: number
): HistoryItem[] {
  if (!query || !query.trim()) {
    return [];
  }

  const searchTerm = query.toLowerCase().trim();
  const results = items.filter(item =>
    item.text.toLowerCase().includes(searchTerm)
  );

  return results.slice(0, limit);
}
