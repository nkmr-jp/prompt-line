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

import { promises as fs } from 'fs';
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
  private memoryCache: Map<string, MemoryCacheEntry> = new Map();

  /** Memory cache TTL (5 minutes) - refresh from disk after this time */
  private readonly MEMORY_CACHE_TTL_MS = CACHE_TTL.SYMBOL_MEMORY;

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
    logger.debug('Cleared all memory cache');
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
        logger.debug('Symbol cache version mismatch', { expected: CACHE_VERSION, actual: metadata.version });
        return false;
      }

      // Check directory match
      if (metadata.directory !== directory) {
        logger.debug('Symbol cache directory mismatch');
        return false;
      }

      // Check TTL
      const updatedAt = new Date(metadata.updatedAt);
      const now = new Date();
      const ageSeconds = (now.getTime() - updatedAt.getTime()) / 1000;
      if (ageSeconds > metadata.ttlSeconds) {
        logger.debug('Symbol cache expired', { ageSeconds, ttlSeconds: metadata.ttlSeconds });
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
   */
  async loadSymbols(directory: string, language?: string): Promise<SymbolResult[]> {
    try {
      if (language) {
        // Load from language-specific file
        return await this.loadSymbolsForLanguage(directory, language);
      }

      // Load from all language files
      const metadata = await this.loadMetadata(directory);
      if (!metadata) {
        return [];
      }

      const allSymbols: SymbolResult[] = [];
      for (const lang of Object.keys(metadata.languages)) {
        const langSymbols = await this.loadSymbolsForLanguage(directory, lang);
        allSymbols.push(...langSymbols);
      }

      logger.debug('Loaded symbols from cache (all languages)', {
        directory,
        count: allSymbols.length
      });

      return allSymbols;
    } catch (error) {
      logger.debug('Error loading symbol cache:', error);
      return [];
    }
  }

  /**
   * Load symbols for a specific language from its dedicated file
   * Uses in-memory cache to avoid repeated disk reads
   */
  private async loadSymbolsForLanguage(directory: string, language: string): Promise<SymbolResult[]> {
    const cacheKey = this.getMemoryCacheKey(directory, language);

    // Check memory cache first
    const memoryCacheEntry = this.memoryCache.get(cacheKey);
    if (this.isMemoryCacheValid(memoryCacheEntry)) {
      logger.debug('Returning symbols from memory cache', {
        directory,
        language,
        count: memoryCacheEntry!.symbols.length
      });
      return memoryCacheEntry!.symbols;
    }

    // Load from disk
    try {
      const symbolsPath = this.getSymbolsPath(directory, language);
      const content = await fs.readFile(symbolsPath, 'utf8');
      const lines = content.trim().split('\n').filter(line => line.length > 0);

      const symbols: SymbolResult[] = [];
      for (const line of lines) {
        try {
          const symbol: SymbolResult = JSON.parse(line);
          symbols.push(symbol);
        } catch (parseError) {
          logger.warn('Error parsing symbol line:', parseError);
        }
      }

      // Store in memory cache
      this.memoryCache.set(cacheKey, {
        symbols,
        loadedAt: Date.now()
      });

      logger.debug('Loaded symbols from disk cache', {
        directory,
        language,
        count: symbols.length
      });

      return symbols;
    } catch (error) {
      logger.debug('Error loading symbol cache for language:', { language, error });
      return [];
    }
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

      logger.debug('Saved symbols to cache', {
        directory,
        language,
        symbolCount: symbols.length,
        totalSymbolCount: totalCount
      });
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
      logger.debug('Cleared symbol cache for directory', { directory });
    } catch (error) {
      logger.warn('Error clearing symbol cache:', error);
    }
  }

  /**
   * Clear symbol cache for a single project directory
   */
  private async clearProjectSymbolCache(projectDir: string, dirName: string): Promise<void> {
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

    logger.debug('Cleared symbol cache for', { dir: dirName });
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

      logger.debug('Cleared symbol cache for language', { directory, language });
    } catch (error) {
      logger.warn('Error clearing language cache:', error);
    }
  }
}

// Export singleton instance
export const symbolCacheManager = new SymbolCacheManager();
