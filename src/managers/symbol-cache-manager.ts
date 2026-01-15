/**
 * Symbol Cache Manager
 * Manages disk caching for symbol search results
 * Uses language-separated files for efficient access
 *
 * File structure:
 *   ~/.prompt-line/cache/<encoded-path>/
 *     symbol-metadata.json     - Metadata with language info
 *     symbols-go.jsonl         - Go symbols
 *     symbols-ts.jsonl         - TypeScript symbols
 *     symbols-py.jsonl         - Python symbols
 *     ...
 */

import { promises as fs, createReadStream } from 'fs';
import { createInterface } from 'readline';
import path from 'path';
import config from '../config/app-config';
import { logger, ensureDir } from '../utils/utils';
import type {
  SymbolResult,
  SymbolCacheMetadata
} from './symbol-search/types';
import { CACHE_TTL } from '../constants';

// Cache configuration
const CACHE_VERSION = '2.0'; // Version bump for new file structure
const DEFAULT_TTL_SECONDS = 3600; // 1 hour
const SYMBOL_METADATA_FILE = 'symbol-metadata.json';
const SYMBOLS_FILE_PREFIX = 'symbols-'; // symbols-{language}.jsonl

/**
 * In-memory cache entry with timestamp
 */
interface MemoryCacheEntry {
  symbols: SymbolResult[];
  loadedAt: number;
}

/**
 * Symbol Cache Manager for disk-based caching
 * Includes in-memory cache to avoid repeated disk reads for large symbol sets
 */
export class SymbolCacheManager {
  private cacheDir: string;

  /** In-memory cache: Map<"directory:language", MemoryCacheEntry> */
  /** Note: Map maintains insertion order, enabling O(1) LRU operations */
  private memoryCache: Map<string, MemoryCacheEntry> = new Map();

  /** Memory cache TTL (5 minutes) - refresh from disk after this time */
  private readonly MEMORY_CACHE_TTL_MS = CACHE_TTL.SYMBOL_MEMORY;

  /** Maximum number of cache entries to keep in memory */
  private readonly MAX_CACHE_ENTRIES = 50;

  constructor() {
    this.cacheDir = config.paths.projectsCacheDir;
  }

  /**
   * Get memory cache key for directory and language
   */
  private getMemoryCacheKey(directory: string, language: string): string {
    return `${directory}:${language}`;
  }

  /**
   * Update LRU order for a cache key
   * Moves the key to the end (most recently used position)
   * Evicts oldest entries if MAX_CACHE_ENTRIES is exceeded
   *
   * Time Complexity: O(1) - Map.delete() and Map.set() are O(1)
   */
  private updateCacheOrder(key: string): void {
    const entry = this.memoryCache.get(key);

    // If key exists, delete and re-insert to move to end (most recently used)
    if (entry !== undefined) {
      this.memoryCache.delete(key);
      this.memoryCache.set(key, entry);
    }

    // Evict oldest entries if we exceed the limit
    // Map iterator returns entries in insertion order, oldest first
    while (this.memoryCache.size > this.MAX_CACHE_ENTRIES) {
      const oldestKey = this.memoryCache.keys().next().value;
      if (oldestKey !== undefined) {
        this.memoryCache.delete(oldestKey);
      }
    }
  }

  /**
   * Check if memory cache is valid
   */
  private isMemoryCacheValid(entry: MemoryCacheEntry | undefined): boolean {
    if (!entry) return false;
    const age = Date.now() - entry.loadedAt;
    return age < this.MEMORY_CACHE_TTL_MS;
  }

  /**
   * Clear memory cache for a directory (all languages)
   */
  private clearMemoryCacheForDirectory(directory: string): void {
    const keysToDelete: string[] = [];
    for (const key of this.memoryCache.keys()) {
      if (key.startsWith(`${directory}:`)) {
        keysToDelete.push(key);
      }
    }
    for (const key of keysToDelete) {
      this.memoryCache.delete(key);
    }
  }

  /**
   * Clear entire memory cache
   */
  public clearMemoryCache(): void {
    this.memoryCache.clear();
  }

  /**
   * Encode directory path to safe cache directory name
   */
  private encodePath(directoryPath: string): string {
    return directoryPath.replace(/\//g, '-');
  }

  /**
   * Get cache directory for a project
   */
  private getProjectCacheDir(directory: string): string {
    const encodedPath = this.encodePath(directory);
    return path.join(this.cacheDir, encodedPath);
  }

  /**
   * Get metadata file path for a project
   */
  private getMetadataPath(directory: string): string {
    return path.join(this.getProjectCacheDir(directory), SYMBOL_METADATA_FILE);
  }

  /**
   * Get symbols file path for a project and language
   * @param directory - The project directory
   * @param language - The language key (e.g., 'go', 'ts', 'py')
   */
  private getSymbolsPath(directory: string, language: string): string {
    return path.join(this.getProjectCacheDir(directory), `${SYMBOLS_FILE_PREFIX}${language}.jsonl`);
  }

  /**
   * Check if cache exists and is valid for a directory
   */
  async isCacheValid(directory: string): Promise<boolean> {
    try {
      const metadataPath = this.getMetadataPath(directory);
      const content = await fs.readFile(metadataPath, 'utf8');
      const metadata: SymbolCacheMetadata = JSON.parse(content);

      // Check version
      if (metadata.version !== CACHE_VERSION) {
        return false;
      }

      // Check directory match
      if (metadata.directory !== directory) {
        return false;
      }

      // Check TTL
      const updatedAt = new Date(metadata.updatedAt);
      const now = new Date();
      const ageSeconds = (now.getTime() - updatedAt.getTime()) / 1000;
      if (ageSeconds > metadata.ttlSeconds) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if cache exists for a specific language
   */
  async hasLanguageCache(directory: string, language: string): Promise<boolean> {
    try {
      const metadataPath = this.getMetadataPath(directory);
      const content = await fs.readFile(metadataPath, 'utf8');
      const metadata: SymbolCacheMetadata = JSON.parse(content);
      return language in metadata.languages;
    } catch {
      return false;
    }
  }

  /**
   * Load cached symbols for a directory and language
   * If language is specified, loads from language-specific file
   * If language is not specified, loads from all language files
   * @param directory - The project directory
   * @param language - Optional language to filter by
   * @param maxSymbols - Optional maximum number of symbols to load (for early termination)
   */
  async loadSymbols(directory: string, language?: string, maxSymbols?: number): Promise<SymbolResult[]> {
    try {
      if (language) {
        // Load from language-specific file
        return await this.loadSymbolsForLanguage(directory, language, maxSymbols);
      }

      // Load from all language files
      const metadata = await this.loadMetadata(directory);
      if (!metadata) {
        return [];
      }

      const allSymbols: SymbolResult[] = [];

      // Parallel loading for better performance
      const langPromises = Object.keys(metadata.languages).map((lang) =>
        this.loadSymbolsForLanguage(directory, lang, maxSymbols)
      );
      const langResults = await Promise.all(langPromises);

      for (const symbols of langResults) {
        allSymbols.push(...symbols);
        // Early termination if maxSymbols reached
        if (maxSymbols !== undefined && allSymbols.length >= maxSymbols) {
          return allSymbols.slice(0, maxSymbols);
        }
      }

      return allSymbols;
    } catch {
      return [];
    }
  }

  /**
   * Load symbols for a specific language from its dedicated file
   * Uses in-memory cache to avoid repeated disk reads
   * Supports streaming read with early termination when maxSymbols is specified
   * @param directory - The project directory
   * @param language - The language key
   * @param maxSymbols - Optional maximum number of symbols to load
   */
  private async loadSymbolsForLanguage(
    directory: string,
    language: string,
    maxSymbols?: number
  ): Promise<SymbolResult[]> {
    const cacheKey = this.getMemoryCacheKey(directory, language);

    // Check memory cache first
    const memoryCacheEntry = this.memoryCache.get(cacheKey);
    if (this.isMemoryCacheValid(memoryCacheEntry)) {
      // Update LRU order on cache hit
      this.updateCacheOrder(cacheKey);
      const cachedSymbols = memoryCacheEntry!.symbols;
      // Apply maxSymbols limit if specified
      if (maxSymbols !== undefined && cachedSymbols.length > maxSymbols) {
        return cachedSymbols.slice(0, maxSymbols);
      }
      return cachedSymbols;
    }

    // Load from disk using streaming read
    try {
      const symbolsPath = this.getSymbolsPath(directory, language);
      const { symbols, terminated } = await this.streamLoadSymbols(symbolsPath, maxSymbols);

      // Store in memory cache only if we loaded all symbols (EOF reached, not terminated early)
      // terminated = true means early termination (partial load)
      // terminated = false means EOF reached (full load)
      if (!terminated) {
        this.memoryCache.set(cacheKey, {
          symbols,
          loadedAt: Date.now()
        });
        // Update LRU order on cache set
        this.updateCacheOrder(cacheKey);
      }

      return symbols;
    } catch {
      return [];
    }
  }

  /**
   * Stream load symbols from a JSONL file with optional early termination
   * @param filePath - Path to the JSONL file
   * @param maxSymbols - Optional maximum number of symbols to load
   * @returns Object with symbols array and terminated flag
   */
  private streamLoadSymbols(
    filePath: string,
    maxSymbols?: number
  ): Promise<{ symbols: SymbolResult[]; terminated: boolean }> {
    return new Promise((resolve, reject) => {
      const symbols: SymbolResult[] = [];
      const readStream = createReadStream(filePath, { encoding: 'utf8' });
      const rl = createInterface({
        input: readStream,
        crlfDelay: Infinity
      });

      let terminated = false;
      let settled = false;

      rl.on('line', (line: string) => {
        if (terminated) return;
        if (line.length === 0) return;

        try {
          const symbol: SymbolResult = JSON.parse(line);
          // Pre-compute nameLower if not present (backward compatibility with cached data)
          if (!symbol.nameLower) {
            symbol.nameLower = symbol.name.toLowerCase();
          }
          symbols.push(symbol);

          // Early termination if maxSymbols reached
          if (maxSymbols !== undefined && symbols.length >= maxSymbols) {
            terminated = true;
            rl.close();
            readStream.destroy();
          }
        } catch (parseError) {
          logger.warn('Error parsing symbol line:', parseError);
        }
      });

      rl.on('close', () => {
        if (!settled) {
          settled = true;
          resolve({ symbols, terminated });
        }
      });

      rl.on('error', (error) => {
        if (!settled) {
          settled = true;
          rl.close();
          reject(error);
        }
      });

      readStream.on('error', (error) => {
        if (!settled) {
          settled = true;
          rl.close();
          reject(error);
        }
      });
    });
  }

  /**
   * Load cache metadata
   */
  async loadMetadata(directory: string): Promise<SymbolCacheMetadata | null> {
    try {
      const metadataPath = this.getMetadataPath(directory);
      const content = await fs.readFile(metadataPath, 'utf8');
      return JSON.parse(content) as SymbolCacheMetadata;
    } catch {
      return null;
    }
  }

  /**
   * Save symbols to cache
   * Each language is saved to its own file for efficient access
   */
  async saveSymbols(
    directory: string,
    language: string,
    symbols: SymbolResult[],
    searchMode: 'quick' | 'full'
  ): Promise<void> {
    try {
      const projectCacheDir = this.getProjectCacheDir(directory);
      await ensureDir(projectCacheDir);

      // Load existing metadata or create new
      let metadata = await this.loadMetadata(directory);
      const now = new Date().toISOString();

      if (!metadata) {
        metadata = {
          version: CACHE_VERSION,
          directory,
          createdAt: now,
          updatedAt: now,
          languages: {},
          totalSymbolCount: 0,
          ttlSeconds: DEFAULT_TTL_SECONDS
        };
      }

      // Update language metadata
      metadata.languages[language] = {
        symbolCount: symbols.length,
        searchMode
      };
      metadata.updatedAt = now;

      // Calculate total count from all languages
      let totalCount = 0;
      for (const langMeta of Object.values(metadata.languages)) {
        totalCount += langMeta.symbolCount;
      }
      metadata.totalSymbolCount = totalCount;

      // Save metadata
      const metadataPath = this.getMetadataPath(directory);
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');

      // Save symbols to language-specific file
      const symbolsPath = this.getSymbolsPath(directory, language);
      const symbolsContent = symbols.map(s => JSON.stringify(s)).join('\n');
      await fs.writeFile(symbolsPath, symbolsContent, 'utf8');

      // Update memory cache
      const cacheKey = this.getMemoryCacheKey(directory, language);
      this.memoryCache.set(cacheKey, {
        symbols,
        loadedAt: Date.now()
      });

      // Update LRU order on cache set
      this.updateCacheOrder(cacheKey);
    } catch (error) {
      logger.error('Error saving symbol cache:', error);
    }
  }

  /**
   * Clear cache for a directory
   */
  async clearCache(directory: string): Promise<void> {
    try {
      // Clear memory cache first
      this.clearMemoryCacheForDirectory(directory);

      const projectCacheDir = this.getProjectCacheDir(directory);
      await fs.rm(projectCacheDir, { recursive: true, force: true });
    } catch (error) {
      logger.warn('Error clearing symbol cache:', error);
    }
  }

  /**
   * Clear symbol cache for a single project directory
   */
  private async clearProjectSymbolCache(projectDir: string, _dirName: string): Promise<void> {
    const symbolMetadataPath = path.join(projectDir, SYMBOL_METADATA_FILE);

    try {
      await fs.access(symbolMetadataPath);
    } catch {
      return; // No symbol cache in this directory
    }

    // Remove metadata file
    await fs.rm(symbolMetadataPath);

    // Remove all language-specific symbol files
    const files = await fs.readdir(projectDir);
    const symbolFiles = files.filter((f) => f.startsWith(SYMBOLS_FILE_PREFIX) && f.endsWith('.jsonl'));

    for (const file of symbolFiles) {
      await fs.rm(path.join(projectDir, file), { force: true });
    }
  }

  /**
   * Clear all symbol caches
   */
  async clearAllCaches(): Promise<void> {
    try {
      // Clear all memory cache first
      this.clearMemoryCache();

      const entries = await fs.readdir(this.cacheDir, { withFileTypes: true });
      const directories = entries.filter((e) => e.isDirectory());

      for (const entry of directories) {
        const projectDir = path.join(this.cacheDir, entry.name);
        await this.clearProjectSymbolCache(projectDir, entry.name);
      }
    } catch (error) {
      logger.warn('Error clearing all symbol caches:', error);
    }
  }

  /**
   * Clear cache for a specific language in a directory
   */
  async clearLanguageCache(directory: string, language: string): Promise<void> {
    try {
      // Clear memory cache for this language
      const cacheKey = this.getMemoryCacheKey(directory, language);
      this.memoryCache.delete(cacheKey);

      // Remove language-specific file
      const symbolsPath = this.getSymbolsPath(directory, language);
      await fs.rm(symbolsPath, { force: true });

      // Update metadata
      const metadata = await this.loadMetadata(directory);
      if (metadata && metadata.languages[language]) {
        delete metadata.languages[language];

        // Recalculate total count
        let totalCount = 0;
        for (const langMeta of Object.values(metadata.languages)) {
          totalCount += langMeta.symbolCount;
        }
        metadata.totalSymbolCount = totalCount;
        metadata.updatedAt = new Date().toISOString();

        // Save updated metadata
        const metadataPath = this.getMetadataPath(directory);
        await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');
      }
    } catch (error) {
      logger.warn('Error clearing language cache:', error);
    }
  }
}

// Export singleton instance
export const symbolCacheManager = new SymbolCacheManager();
