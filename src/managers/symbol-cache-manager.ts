/**
 * Symbol Cache Manager
 * Manages disk caching for symbol search results
 * Uses the same directory structure as file-cache-manager
 */

import { promises as fs } from 'fs';
import path from 'path';
import config from '../config/app-config';
import { logger, ensureDir } from '../utils/utils';
import type {
  SymbolResult,
  SymbolCacheMetadata
} from './symbol-search/types';

// Cache configuration
const CACHE_VERSION = '1.0';
const DEFAULT_TTL_SECONDS = 3600; // 1 hour
const SYMBOL_METADATA_FILE = 'symbol-metadata.json';
const SYMBOLS_FILE = 'symbols.jsonl';

/**
 * Symbol Cache Manager for disk-based caching
 */
export class SymbolCacheManager {
  private cacheDir: string;

  constructor() {
    this.cacheDir = config.paths.projectsCacheDir;
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
   * Get symbols file path for a project
   */
  private getSymbolsPath(directory: string): string {
    return path.join(this.getProjectCacheDir(directory), SYMBOLS_FILE);
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
   */
  async loadSymbols(directory: string, language?: string): Promise<SymbolResult[]> {
    try {
      const symbolsPath = this.getSymbolsPath(directory);
      const content = await fs.readFile(symbolsPath, 'utf8');
      const lines = content.trim().split('\n').filter(line => line.length > 0);

      const symbols: SymbolResult[] = [];
      for (const line of lines) {
        try {
          const symbol: SymbolResult = JSON.parse(line);
          // Filter by language if specified
          if (!language || symbol.language === language) {
            symbols.push(symbol);
          }
        } catch (parseError) {
          logger.warn('Error parsing symbol line:', parseError);
        }
      }

      logger.debug('Loaded symbols from cache', {
        directory,
        language,
        count: symbols.length
      });

      return symbols;
    } catch (error) {
      logger.debug('Error loading symbol cache:', error);
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

      // Load existing symbols (for other languages)
      const existingSymbols = await this.loadSymbols(directory);
      const otherLanguageSymbols = existingSymbols.filter(s => s.language !== language);
      const allSymbols = [...otherLanguageSymbols, ...symbols];

      // Update total count
      metadata.totalSymbolCount = allSymbols.length;

      // Save metadata
      const metadataPath = this.getMetadataPath(directory);
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');

      // Save symbols as JSONL
      const symbolsPath = this.getSymbolsPath(directory);
      const symbolsContent = allSymbols.map(s => JSON.stringify(s)).join('\n');
      await fs.writeFile(symbolsPath, symbolsContent, 'utf8');

      logger.debug('Saved symbols to cache', {
        directory,
        language,
        symbolCount: symbols.length,
        totalSymbolCount: allSymbols.length
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
      const projectCacheDir = this.getProjectCacheDir(directory);
      await fs.rm(projectCacheDir, { recursive: true, force: true });
      logger.debug('Cleared symbol cache for directory', { directory });
    } catch (error) {
      logger.warn('Error clearing symbol cache:', error);
    }
  }

  /**
   * Clear all symbol caches
   */
  async clearAllCaches(): Promise<void> {
    try {
      // List all project cache directories
      const entries = await fs.readdir(this.cacheDir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const projectDir = path.join(this.cacheDir, entry.name);
          const symbolMetadataPath = path.join(projectDir, SYMBOL_METADATA_FILE);

          // Only clear if it has symbol cache
          try {
            await fs.access(symbolMetadataPath);
            await fs.rm(symbolMetadataPath);

            const symbolsPath = path.join(projectDir, SYMBOLS_FILE);
            await fs.rm(symbolsPath, { force: true });

            logger.debug('Cleared symbol cache for', { dir: entry.name });
          } catch {
            // No symbol cache in this directory
          }
        }
      }
    } catch (error) {
      logger.warn('Error clearing all symbol caches:', error);
    }
  }
}

// Export singleton instance
export const symbolCacheManager = new SymbolCacheManager();
