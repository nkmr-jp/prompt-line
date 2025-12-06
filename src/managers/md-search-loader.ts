import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { logger } from '../utils/utils';
import type { MdSearchEntry, MdSearchItem, MdSearchType } from '../types';
import { resolveTemplate, getBasename, parseFrontmatter, extractRawFrontmatter } from '../lib/template-resolver';
import { getDefaultMdSearchConfig } from '../lib/default-md-search-config';

/**
 * MdSearchLoader - 設定ベースの統合Markdownファイルローダー
 *
 * SlashCommandLoaderとAgentLoaderを統合し、より柔軟な設定が可能
 */
class MdSearchLoader {
  private config: MdSearchEntry[];
  private cache: Map<string, { items: MdSearchItem[]; timestamp: number }> = new Map();
  private cacheTTL: number = 5000; // 5 seconds

  constructor(config?: MdSearchEntry[]) {
    this.config = config ?? getDefaultMdSearchConfig();
  }

  /**
   * 設定を更新（設定変更時に呼び出す）
   */
  updateConfig(config: MdSearchEntry[] | undefined): void {
    const newConfig = config ?? getDefaultMdSearchConfig();

    // 設定が変わった場合のみキャッシュをクリア
    if (JSON.stringify(this.config) !== JSON.stringify(newConfig)) {
      this.config = newConfig;
      this.invalidateCache();
      logger.debug('MdSearchLoader config updated', { entryCount: this.config.length });
    }
  }

  /**
   * キャッシュを無効化
   */
  invalidateCache(): void {
    this.cache.clear();
    logger.debug('MdSearchLoader cache invalidated');
  }

  /**
   * 指定タイプのアイテムを取得
   */
  async getItems(type: MdSearchType): Promise<MdSearchItem[]> {
    const allItems = await this.loadAll();
    return allItems.filter(item => item.type === type);
  }

  /**
   * 指定タイプのアイテムを検索
   */
  async searchItems(type: MdSearchType, query: string): Promise<MdSearchItem[]> {
    const items = await this.getItems(type);

    if (!query) {
      return items;
    }

    const lowerQuery = query.toLowerCase();
    return items.filter(item =>
      item.name.toLowerCase().includes(lowerQuery) ||
      item.description.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * 全設定エントリからアイテムをロード
   */
  private async loadAll(): Promise<MdSearchItem[]> {
    // キャッシュチェック
    const cacheKey = 'all';
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.items;
    }

    const allItems: MdSearchItem[] = [];
    const seenNames = new Map<MdSearchType, Set<string>>();

    for (const entry of this.config) {
      try {
        const items = await this.loadEntry(entry);

        // タイプごとの重複チェック用Setを取得または作成
        if (!seenNames.has(entry.type)) {
          seenNames.set(entry.type, new Set());
        }
        const typeSeenNames = seenNames.get(entry.type)!;

        for (const item of items) {
          // 同じタイプ内での重複を防ぐ
          if (!typeSeenNames.has(item.name)) {
            typeSeenNames.add(item.name);
            allItems.push(item);
          } else {
            logger.debug('Skipping duplicate item', {
              name: item.name,
              type: item.type,
              sourceId: item.sourceId
            });
          }
        }
      } catch (error) {
        logger.error('Failed to load entry', { entry, error });
      }
    }

    // 名前でソート
    allItems.sort((a, b) => a.name.localeCompare(b.name));

    // キャッシュを更新
    this.cache.set(cacheKey, { items: allItems, timestamp: Date.now() });

    logger.info('MdSearch items loaded', {
      total: allItems.length,
      commands: allItems.filter(i => i.type === 'command').length,
      mentions: allItems.filter(i => i.type === 'mention').length
    });

    return allItems;
  }

  /**
   * 単一エントリをロード
   */
  private async loadEntry(entry: MdSearchEntry): Promise<MdSearchItem[]> {
    // パスを展開（~をホームディレクトリに置換）
    const expandedPath = entry.path.replace(/^~/, os.homedir());

    // ディレクトリの存在確認
    try {
      const stats = await fs.stat(expandedPath);
      if (!stats.isDirectory()) {
        logger.warn('MdSearch path is not a directory', { path: expandedPath });
        return [];
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        logger.debug('MdSearch directory does not exist', { path: expandedPath });
        return [];
      }
      throw error;
    }

    // パターンでファイルを検索
    const files = await this.findFiles(expandedPath, entry.pattern);

    const items: MdSearchItem[] = [];
    const sourceId = `${entry.path}:${entry.pattern}`;

    for (const filePath of files) {
      try {
        const content = await fs.readFile(filePath, 'utf8');
        const frontmatter = parseFrontmatter(content);
        const rawFrontmatter = extractRawFrontmatter(content);
        const basename = getBasename(filePath);

        const context = { basename, frontmatter };

        const item: MdSearchItem = {
          name: resolveTemplate(entry.name, context),
          description: resolveTemplate(entry.description, context),
          type: entry.type,
          filePath,
          sourceId,
        };

        // オプションフィールドを追加
        if (rawFrontmatter) {
          item.frontmatter = rawFrontmatter;
        }

        if (entry.argumentHint) {
          const resolvedHint = resolveTemplate(entry.argumentHint, context);
          if (resolvedHint) {
            item.argumentHint = resolvedHint;
          }
        }

        items.push(item);
      } catch (error) {
        logger.warn('Failed to parse file', { filePath, error });
      }
    }

    logger.debug('MdSearch entry loaded', {
      sourceId,
      count: items.length
    });

    return items;
  }

  /**
   * パターンに一致するファイルを検索
   * サポートするパターン: "*.md", "SKILL.md", "**\/*.md"
   */
  private async findFiles(directory: string, pattern: string): Promise<string[]> {
    const files: string[] = [];

    // 再帰検索かどうか判定
    const isRecursive = pattern.includes('**');

    // パターンから拡張子やファイル名を抽出
    const patternParts = pattern.replace('**/', '').replace('**\\', '');

    // ディレクトリを読み取り
    const entries = await fs.readdir(directory, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);

      if (entry.isDirectory() && isRecursive) {
        // 再帰検索の場合、サブディレクトリも検索
        const subFiles = await this.findFiles(fullPath, patternParts);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        // ファイルがパターンに一致するか確認
        if (this.matchesPattern(entry.name, patternParts)) {
          files.push(fullPath);
        }
      }
    }

    return files;
  }

  /**
   * ファイル名がパターンに一致するか確認
   * サポートするパターン: "*.md", "SKILL.md"
   */
  private matchesPattern(fileName: string, pattern: string): boolean {
    // ワイルドカードパターン (e.g., "*.md")
    if (pattern.startsWith('*.')) {
      const extension = pattern.slice(1); // ".md"
      return fileName.endsWith(extension);
    }

    // 具体的なファイル名 (e.g., "SKILL.md")
    return fileName === pattern;
  }
}

export default MdSearchLoader;
