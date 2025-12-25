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

// Cache configuration
const CACHE_VERSION = '2.0'; // Version bump for new file structure
const DEFAULT_TTL_SECONDS = 3600; // 1 hour
const SYMBOL_METADATA_FILE = 'symbol-metadata.json';
const SYMBOLS_FILE_PREFIX = 'symbols-'; // symbols-{language}.jsonl

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
      const metadata = await this.readMetadata(directory);
      return this.validateMetadata(metadata, directory);
    } catch {
      return false;
    }
  }

  private async readMetadata(directory: string): Promise<SymbolCacheMetadata> {
    const metadataPath = this.getMetadataPath(directory);
    const content = await fs.readFile(metadataPath, 'utf8');
    return JSON.parse(content);
  }

  private validateMetadata(metadata: SymbolCacheMetadata, directory: string): boolean {
    if (!this.isVersionValid(metadata)) {
      return false;
    }

    if (!this.isDirectoryValid(metadata, directory)) {
      return false;
    }

    return this.isTtlValid(metadata);
  }

  private isVersionValid(metadata: SymbolCacheMetadata): boolean {
    if (metadata.version !== CACHE_VERSION) {
      logger.debug('Symbol cache version mismatch', { expected: CACHE_VERSION, actual: metadata.version });
      return false;
    }
    return true;
  }

  private isDirectoryValid(metadata: SymbolCacheMetadata, directory: string): boolean {
    if (metadata.directory !== directory) {
      logger.debug('Symbol cache directory mismatch');
      return false;
    }
    return true;
  }

  private isTtlValid(metadata: SymbolCacheMetadata): boolean {
    const updatedAt = new Date(metadata.updatedAt);
    const now = new Date();
    const ageSeconds = (now.getTime() - updatedAt.getTime()) / 1000;

    if (ageSeconds > metadata.ttlSeconds) {
      logger.debug('Symbol cache expired', { ageSeconds, ttlSeconds: metadata.ttlSeconds });
      return false;
    }
    return true;
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
   */
  private async loadSymbolsForLanguage(directory: string, language: string): Promise<SymbolResult[]> {
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

      logger.debug('Loaded symbols from cache', {
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

      const metadata = await this.prepareMetadata(directory, language, symbols.length, searchMode);
      await this.persistMetadata(directory, metadata);
      await this.persistSymbols(directory, language, symbols);

      this.logSaveSuccess(directory, language, symbols.length, metadata.totalSymbolCount);
    } catch (error) {
      logger.error('Error saving symbol cache:', error);
    }
  }

  private async prepareMetadata(
    directory: string,
    language: string,
    symbolCount: number,
    searchMode: 'quick' | 'full'
  ): Promise<SymbolCacheMetadata> {
    const metadata = await this.loadMetadata(directory) || this.createNewMetadata(directory);
    const now = new Date().toISOString();

    metadata.languages[language] = { symbolCount, searchMode };
    metadata.updatedAt = now;
    metadata.totalSymbolCount = this.calculateTotalCount(metadata);

    return metadata;
  }

  private createNewMetadata(directory: string): SymbolCacheMetadata {
    const now = new Date().toISOString();
    return {
      version: CACHE_VERSION,
      directory,
      createdAt: now,
      updatedAt: now,
      languages: {},
      totalSymbolCount: 0,
      ttlSeconds: DEFAULT_TTL_SECONDS
    };
  }

  private calculateTotalCount(metadata: SymbolCacheMetadata): number {
    return Object.values(metadata.languages).reduce((total, langMeta) => total + langMeta.symbolCount, 0);
  }

  private async persistMetadata(directory: string, metadata: SymbolCacheMetadata): Promise<void> {
    const metadataPath = this.getMetadataPath(directory);
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');
  }

  private async persistSymbols(directory: string, language: string, symbols: SymbolResult[]): Promise<void> {
    const symbolsPath = this.getSymbolsPath(directory, language);
    const symbolsContent = symbols.map(s => JSON.stringify(s)).join('\n');
    await fs.writeFile(symbolsPath, symbolsContent, 'utf8');
  }

  private logSaveSuccess(directory: string, language: string, symbolCount: number, totalSymbolCount: number): void {
    logger.debug('Saved symbols to cache', {
      directory,
      language,
      symbolCount,
      totalSymbolCount
    });
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
      const entries = await fs.readdir(this.cacheDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }

        await this.clearProjectCache(entry.name);
      }
    } catch (error) {
      logger.warn('Error clearing all symbol caches:', error);
    }
  }

  private async clearProjectCache(projectName: string): Promise<void> {
    try {
      const projectDir = path.join(this.cacheDir, projectName);
      const symbolMetadataPath = path.join(projectDir, SYMBOL_METADATA_FILE);

      await fs.access(symbolMetadataPath);
      await this.removeMetadataFile(symbolMetadataPath);
      await this.removeSymbolFiles(projectDir);

      logger.debug('Cleared symbol cache for', { dir: projectName });
    } catch {
      // No symbol cache in this directory
    }
  }

  private async removeMetadataFile(metadataPath: string): Promise<void> {
    await fs.rm(metadataPath);
  }

  private async removeSymbolFiles(projectDir: string): Promise<void> {
    const files = await fs.readdir(projectDir);

    for (const file of files) {
      if (!this.isSymbolFile(file)) {
        continue;
      }

      await fs.rm(path.join(projectDir, file), { force: true });
    }
  }

  private isSymbolFile(filename: string): boolean {
    return filename.startsWith(SYMBOLS_FILE_PREFIX) && filename.endsWith('.jsonl');
  }

  /**
   * Clear cache for a specific language in a directory
   */
  async clearLanguageCache(directory: string, language: string): Promise<void> {
    try {
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
