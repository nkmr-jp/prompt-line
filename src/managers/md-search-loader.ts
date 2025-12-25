import { logger } from '../utils/utils';
import type { MdSearchEntry, MdSearchItem, MdSearchType } from '../types';
import { getDefaultMdSearchConfig, DEFAULT_MAX_SUGGESTIONS, DEFAULT_SORT_ORDER } from '../lib/default-md-search-config';
import { loadEntry } from './md-search-entry-loader';

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
    // Use default config if config is undefined or empty array
    this.config = (config && config.length > 0) ? config : getDefaultMdSearchConfig();
  }

  /**
   * 設定を更新（設定変更時に呼び出す）
   */
  updateConfig(config: MdSearchEntry[] | undefined): void {
    // Use default config if config is undefined or empty array
    const newConfig = (config && config.length > 0) ? config : getDefaultMdSearchConfig();

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
    const items = allItems.filter(item => item.type === type);
    const sortOrder = this.getSortOrder(type);
    return this.sortItems(items, sortOrder);
  }

  /**
   * 指定タイプのアイテムを検索
   * searchPrefixが設定されているエントリは、クエリがそのプレフィックスで始まる場合のみ検索対象
   */
  async searchItems(type: MdSearchType, query: string): Promise<MdSearchItem[]> {
    const allItems = await this.loadAll();

    // タイプでフィルタリング
    let items = allItems.filter(item => item.type === type);

    // searchPrefixが設定されているエントリをフィルタリング
    items = items.filter(item => {
      const entry = this.findEntryForItem(item);
      if (!entry?.searchPrefix) {
        // searchPrefixが未設定の場合は常に検索対象
        return true;
      }
      // queryがsearchPrefixで始まるかチェック
      return query.startsWith(entry.searchPrefix);
    });

    // クエリに基づいてソート順を決定
    const sortOrder = this.getSortOrderForQuery(type, query);

    if (!query) {
      return this.sortItems(items, sortOrder);
    }

    // 各アイテムの実際の検索クエリを計算（searchPrefixを除去）
    const filteredItems = items.filter(item => {
      const entry = this.findEntryForItem(item);
      const prefix = entry?.searchPrefix || '';
      const actualQuery = query.startsWith(prefix) ? query.slice(prefix.length) : query;

      // プレフィックスのみの場合は全て表示
      if (!actualQuery) {
        return true;
      }

      const lowerActualQuery = actualQuery.toLowerCase();
      return item.name.toLowerCase().includes(lowerActualQuery) ||
             item.description.toLowerCase().includes(lowerActualQuery);
    });

    return this.sortItems(filteredItems, sortOrder);
  }

  /**
   * アイテムに対応する設定エントリを検索
   */
  private findEntryForItem(item: MdSearchItem): MdSearchEntry | undefined {
    return this.config.find(entry =>
      entry.type === item.type &&
      `${entry.path}:${entry.pattern}` === item.sourceId
    );
  }

  /**
   * 指定タイプのmaxSuggestionsを取得（複数エントリがある場合は最大値を返す）
   */
  getMaxSuggestions(type: MdSearchType): number {
    const entries = this.config.filter(entry => entry.type === type);
    if (entries.length === 0) {
      return DEFAULT_MAX_SUGGESTIONS;
    }
    // 複数エントリがある場合は最大値を使用
    return Math.max(...entries.map(entry => entry.maxSuggestions ?? DEFAULT_MAX_SUGGESTIONS));
  }

  /**
   * 指定タイプのsearchPrefixリストを取得
   */
  getSearchPrefixes(type: MdSearchType): string[] {
    const entries = this.config.filter(entry => entry.type === type && entry.searchPrefix);
    return entries.map(entry => entry.searchPrefix!);
  }

  /**
   * 指定タイプのsortOrderを取得（複数エントリがある場合は最初のエントリの設定を返す）
   */
  getSortOrder(type: MdSearchType): 'asc' | 'desc' {
    const entries = this.config.filter(entry => entry.type === type);
    if (entries.length === 0) {
      return DEFAULT_SORT_ORDER;
    }
    // 最初のエントリの設定を使用（未設定の場合はデフォルト）
    return entries[0]?.sortOrder ?? DEFAULT_SORT_ORDER;
  }

  /**
   * クエリのsearchPrefixにマッチするエントリのsortOrderを取得
   */
  getSortOrderForQuery(type: MdSearchType, query: string): 'asc' | 'desc' {
    const entries = this.config.filter(entry => entry.type === type);
    if (entries.length === 0) {
      return DEFAULT_SORT_ORDER;
    }

    // クエリがsearchPrefixで始まるエントリを探す
    const matchingEntry = entries.find(entry =>
      entry.searchPrefix && query.startsWith(entry.searchPrefix)
    );

    if (matchingEntry) {
      return matchingEntry.sortOrder ?? DEFAULT_SORT_ORDER;
    }

    // searchPrefixがマッチしない場合は、searchPrefixが未設定のエントリを探す
    const defaultEntry = entries.find(entry => !entry.searchPrefix);
    if (defaultEntry) {
      return defaultEntry.sortOrder ?? DEFAULT_SORT_ORDER;
    }

    // フォールバック: 最初のエントリの設定を使用
    return entries[0]?.sortOrder ?? DEFAULT_SORT_ORDER;
  }

  /**
   * アイテムを指定のソート順でソート
   */
  private sortItems(items: MdSearchItem[], sortOrder: 'asc' | 'desc'): MdSearchItem[] {
    return [...items].sort((a, b) => {
      const comparison = a.name.localeCompare(b.name);
      return sortOrder === 'desc' ? -comparison : comparison;
    });
  }

  /**
   * 全設定エントリからアイテムをロード
   */
  private async loadAll(): Promise<MdSearchItem[]> {
    const cached = this.cache.get('all');
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.items;
    }

    const allItems = await this.loadAllEntries();
    const deduplicated = this.deduplicateItems(allItems);
    const sorted = this.sortItemsByName(deduplicated);

    this.cache.set('all', { items: sorted, timestamp: Date.now() });
    this.logLoadedItems(sorted);

    return sorted;
  }

  private async loadAllEntries(): Promise<MdSearchItem[]> {
    const allItems: MdSearchItem[] = [];

    for (const entry of this.config) {
      try {
        const items = await loadEntry(entry);
        allItems.push(...items);
      } catch (error) {
        logger.error('Failed to load entry', { entry, error });
      }
    }

    return allItems;
  }

  private deduplicateItems(items: MdSearchItem[]): MdSearchItem[] {
    const seenNames = new Map<MdSearchType, Set<string>>();
    const deduplicated: MdSearchItem[] = [];

    for (const item of items) {
      if (!seenNames.has(item.type)) {
        seenNames.set(item.type, new Set());
      }

      const typeSeenNames = seenNames.get(item.type)!;
      if (!typeSeenNames.has(item.name)) {
        typeSeenNames.add(item.name);
        deduplicated.push(item);
      }
    }

    return deduplicated;
  }

  private sortItemsByName(items: MdSearchItem[]): MdSearchItem[] {
    return items.sort((a, b) => a.name.localeCompare(b.name));
  }

  private logLoadedItems(items: MdSearchItem[]): void {
    logger.info('MdSearch items loaded', {
      total: items.length,
      commands: items.filter(i => i.type === 'command').length,
      mentions: items.filter(i => i.type === 'mention').length
    });
  }

}

export default MdSearchLoader;
