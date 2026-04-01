import { promises as fs, createReadStream } from 'fs';
import { createInterface } from 'readline';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);
import os from 'os';
import chokidar, { type FSWatcher } from 'chokidar';
import { EventEmitter } from 'events';
import { logger } from '../utils/utils';
import type { CustomSearchEntry, CustomSearchItem, CustomSearchType, UserSettings, ColorValue } from '../types';
import { resolveTemplate, getBasename, getDirname, parseFrontmatter, extractRawFrontmatter, parseFirstHeading, parseJsonContent, type TemplateContext } from '../lib/template-resolver';
import { evaluateJq } from '../lib/jq-resolver';
import { getDefaultCustomSearchConfig, DEFAULT_MAX_SUGGESTIONS, DEFAULT_ORDER_BY } from '../lib/default-custom-search-config';
import { resolveValues } from '../lib/prefix-resolver';
import { isCommandEnabled } from '../lib/command-name-matcher';
import { splitKeywords } from '../lib/keyword-utils';
import { shellQuote } from '../utils/security';

/**
 * CustomSearchLoader - 設定ベースの統合Markdownファイルローダー
 *
 * AgentSkillLoaderとAgentLoaderを統合し、より柔軟な設定が可能
 */
const SKILL_PATTERN = /SKILL\.md/i;

class CustomSearchLoader extends EventEmitter {
  private config: CustomSearchEntry[];
  private cache: Map<string, { items: CustomSearchItem[] }> = new Map();
  private settings: UserSettings | undefined;
  private loadingPromise: Promise<CustomSearchItem[]> | null = null;

  private entryMap: Map<string, CustomSearchEntry> = new Map();
  private normalizedCache: string[] = [];
  private normalizedCacheSource: CustomSearchItem[] | null = null;
  private resultCacheKey = '';
  private resultCacheItems: CustomSearchItem[] = [];
  private regexCache: Map<string, RegExp> = new Map();
  private lastChangeTimestamp: number = 0;
  private isStale: boolean = false;

  // Command source cache (stale-while-revalidate)
  private commandCache: Map<string, { items: CustomSearchItem[]; fetchedAt: number }> = new Map();
  private commandFetchPromises: Map<string, Promise<CustomSearchItem[]>> = new Map();
  private static readonly COMMAND_SOURCE_TIMEOUT = 5000;

  // File watchers for hot reload (individual files: JSONL + non-glob pattern files)
  private fileWatchers: FSWatcher[] = [];
  private watchedFilePaths: Set<string> = new Set();
  private static readonly FILE_RELOAD_DEBOUNCE_MS = 300;
  private fileReloadTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    config?: CustomSearchEntry[],
    settings?: UserSettings
  ) {
    super();
    // Use default config if config is undefined or empty array
    this.config = (config && config.length > 0) ? config : getDefaultCustomSearchConfig();
    this.settings = settings;
  }

  /**
   * 設定を更新（設定変更時に呼び出す）
   */
  updateConfig(config: CustomSearchEntry[] | undefined): void {
    // Use default config if config is undefined or empty array
    const newConfig = (config && config.length > 0) ? config : getDefaultCustomSearchConfig();

    // 設定が変わった場合のみキャッシュをクリア
    if (JSON.stringify(this.config) !== JSON.stringify(newConfig)) {
      this.config = newConfig;
      this.invalidateCache();
      // Reset file watchers since config paths may have changed
      this.stopWatching();
    }
  }

  /**
   * 設定を更新（設定変更時に呼び出す）
   */
  updateSettings(settings: UserSettings | undefined): void {
    this.settings = settings;
    this.invalidateCache();
  }

  /**
   * キャッシュを無効化
   */
  invalidateCache(): void {
    this.lastChangeTimestamp = Date.now();
    this.isStale = true;
    // Clear result cache immediately (checked before loadAll's stale check)
    this.resultCacheKey = '';
    this.resultCacheItems = [];
  }

  /**
   * Returns the timestamp of the last cache invalidation.
   * Used by renderer to avoid unnecessary invalidation on window-shown.
   */
  getLastChangeTimestamp(): number {
    return this.lastChangeTimestamp;
  }

  /**
   * Actually clear all caches. Called lazily when stale data is accessed.
   */
  private clearAllCaches(): void {
    this.cache.clear();
    this.loadingPromise = null;
    this.entryMap.clear();
    this.normalizedCache = [];
    this.normalizedCacheSource = null;
    this.resultCacheKey = '';
    this.resultCacheItems = [];
    this.regexCache.clear();
    // Note: commandCache is NOT cleared here (stale-while-revalidate)
    this.isStale = false;
  }

  /**
   * Start watching source files for hot reload.
   * Watches JSONL files and individual (non-glob) pattern files.
   */
  private startFileWatching(watchableFiles: string[]): void {
    // Filter to only new files not already watched
    const newFiles = watchableFiles.filter(f => !this.watchedFilePaths.has(f));
    if (newFiles.length === 0) return;

    for (const filePath of newFiles) {
      this.watchedFilePaths.add(filePath);
    }

    const watcher = chokidar.watch(newFiles, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50
      },
    });

    watcher.on('change', (filePath: string) => {
      logger.debug('CustomSearch source file changed:', filePath);
      this.handleSourceFileChange();
    });

    watcher.on('error', (error: unknown) => {
      logger.error('CustomSearch file watcher error:', error);
    });

    this.fileWatchers.push(watcher);
    logger.info('CustomSearch file watcher started', { files: newFiles });
  }

  /**
   * Check if a pattern represents an individual file (no glob characters)
   */
  private static isIndividualFilePattern(pattern: string): boolean {
    return !pattern.includes('*') && !pattern.includes('?') && !pattern.includes('[') && !pattern.includes('{');
  }

  /**
   * Handle source file change with debounce
   */
  private handleSourceFileChange(): void {
    if (this.fileReloadTimer) {
      clearTimeout(this.fileReloadTimer);
    }

    this.fileReloadTimer = setTimeout(() => {
      this.invalidateCache();
      this.emit('source-changed');
      logger.info('CustomSearch cache invalidated from source file change');
    }, CustomSearchLoader.FILE_RELOAD_DEBOUNCE_MS);
  }

  /**
   * Stop all file watchers
   */
  async stopWatching(): Promise<void> {
    for (const watcher of this.fileWatchers) {
      await watcher.close();
    }
    this.fileWatchers = [];
    this.watchedFilePaths.clear();
    if (this.fileReloadTimer) {
      clearTimeout(this.fileReloadTimer);
      this.fileReloadTimer = null;
    }
    this.commandFetchPromises.clear();
  }

  /**
   * 指定タイプのアイテムを取得
   */
  async getItems(type: CustomSearchType): Promise<CustomSearchItem[]> {
    const allItems = await this.loadAll();
    let items = allItems.filter(item => item.type === type);

    // グローバル enable/disable フィルタを適用
    if (type === 'command' && this.settings?.slashCommands) {
      // Global enable/disable only available via legacy slashCommands (AgentSkillsSettings)
      // agentSkills is now a flat array without global enable/disable
      const { enable, disable } = this.settings.slashCommands;
      items = items.filter(item =>
        isCommandEnabled(item.name, enable, disable)
      );
    }

    if (type === 'mention' && (this.settings?.mentionEnable || this.settings?.mentionDisable)) {
      const enable = this.settings.mentionEnable;
      const disable = this.settings.mentionDisable;
      items = items.filter(item =>
        isCommandEnabled(item.name, enable, disable)
      );
    }

    const orderBy = this.getOrderBy(type);
    return this.sortItems(items, orderBy);
  }

  /**
   * normalizedCache を構築/更新（参照等値チェックで不要な再構築を回避）
   */
  private ensureNormalized(items: CustomSearchItem[]): void {
    if (items === this.normalizedCacheSource) return;
    this.normalizedCache = new Array(items.length);
    for (let i = 0; i < items.length; i++) {
      this.normalizedCache[i] = `${items[i]!.name} ${items[i]!.description}`.toLowerCase();
    }
    this.normalizedCacheSource = items;
  }

  /**
   * 指定タイプのアイテムを検索
   * searchPrefixが設定されているエントリは、クエリがそのプレフィックスで始まる場合のみ検索対象
   */
  async searchItems(type: CustomSearchType, query: string): Promise<CustomSearchItem[]> {
    const cacheKey = `${type}:${query}`;
    if (cacheKey === this.resultCacheKey && this.resultCacheItems.length > 0) {
      return this.resultCacheItems;
    }

    const allItems = await this.loadAll();
    const maxSuggestions = this.getMaxSuggestions(type);

    // タイプ・searchPrefixでフィルタリング
    let items = allItems.filter(item => item.type === type);
    items = items.filter(item => {
      const entry = this.findEntryForItem(item);
      if (!entry?.searchPrefix) return true;
      return query.startsWith(entry.searchPrefix + ':');
    });

    // クエリに基づいてソート順を決定
    const orderBy = this.getOrderByForQuery(type, query);

    if (!query) {
      const sorted = this.sortItems(items, orderBy);
      const result = sorted.length > maxSuggestions ? sorted.slice(0, maxSuggestions) : sorted;
      this.resultCacheKey = cacheKey;
      this.resultCacheItems = result;
      return result;
    }

    this.ensureNormalized(allItems);
    const filteredItems = this.filterByKeywords(allItems, items, query);

    const sorted = this.sortItems(filteredItems, orderBy);
    const result = sorted.length > maxSuggestions ? sorted.slice(0, maxSuggestions) : sorted;
    this.resultCacheKey = cacheKey;
    this.resultCacheItems = result;
    return result;
  }

  /**
   * normalizedCache を使って items をキーワードフィルタリングする
   * allItems のインデックスで normalizedCache にアクセスするため両方必要
   */
  private filterByKeywords(
    allItems: CustomSearchItem[],
    items: CustomSearchItem[],
    query: string
  ): CustomSearchItem[] {
    const itemSet = new Set(items);
    // searchPrefix ごとにキーワードを事前計算してMapに格納
    const keywordsByPrefix = new Map<string, string[]>();
    const filteredItems: CustomSearchItem[] = [];

    for (let i = 0; i < allItems.length; i++) {
      const item = allItems[i]!;
      if (!itemSet.has(item)) continue;

      const entry = this.findEntryForItem(item);
      const prefixWithColon = entry?.searchPrefix ? entry.searchPrefix + ':' : '';

      let keywords = keywordsByPrefix.get(prefixWithColon);
      if (keywords === undefined) {
        const actualQuery = query.startsWith(prefixWithColon) ? query.slice(prefixWithColon.length) : query;
        keywords = actualQuery ? splitKeywords(actualQuery.toLowerCase()) : [];
        keywordsByPrefix.set(prefixWithColon, keywords);
      }

      if (keywords.length === 0) {
        filteredItems.push(item);
        continue;
      }

      const normalized = this.normalizedCache[i]!;
      let allMatch = true;
      for (let k = 0; k < keywords.length; k++) {
        if (!normalized.includes(keywords[k]!)) {
          allMatch = false;
          break;
        }
      }
      if (allMatch) filteredItems.push(item);
    }

    return filteredItems;
  }

  /**
   * entryMap を構築（loadAll完了後に1回だけ呼ばれる）
   */
  private buildEntryMap(): void {
    this.entryMap.clear();
    for (const entry of this.config) {
      const key = entry.source
        ? `${entry.type}:source:${entry.source}`
        : `${entry.type}:${entry.path}:${entry.pattern}`;
      this.entryMap.set(key, entry);
    }
  }

  /**
   * アイテムに対応する設定エントリを検索（O(1) Map lookup）
   */
  private findEntryForItem(item: CustomSearchItem): CustomSearchEntry | undefined {
    return this.entryMap.get(`${item.type}:${item.sourceId}`);
  }

  /**
   * 指定タイプのmaxSuggestionsを取得（複数エントリがある場合は最大値を返す）
   */
  getMaxSuggestions(type: CustomSearchType): number {
    const entries = this.config.filter(entry => entry.type === type);
    if (entries.length === 0) {
      return DEFAULT_MAX_SUGGESTIONS;
    }
    // 複数エントリがある場合は最大値を使用
    return Math.max(...entries.map(entry => entry.maxSuggestions ?? DEFAULT_MAX_SUGGESTIONS));
  }

  /**
   * 指定タイプのsearchPrefixリストを取得（: 付き）
   */
  getSearchPrefixes(type: CustomSearchType): string[] {
    const entries = this.config.filter(entry => entry.type === type && entry.searchPrefix);
    return entries.map(entry => entry.searchPrefix! + ':');
  }

  /**
   * 指定タイプのorderByを取得（複数エントリがある場合は最初のエントリの設定を返す）
   */
  getOrderBy(type: CustomSearchType): string {
    const entries = this.config.filter(entry => entry.type === type);
    if (entries.length === 0) {
      return DEFAULT_ORDER_BY;
    }
    // 最初のエントリの設定を使用（未設定の場合はデフォルト）
    return entries[0]?.orderBy ?? DEFAULT_ORDER_BY;
  }

  /**
   * クエリのsearchPrefixにマッチするエントリのorderByを取得
   */
  getOrderByForQuery(type: CustomSearchType, query: string): string {
    const entries = this.config.filter(entry => entry.type === type);
    if (entries.length === 0) {
      return DEFAULT_ORDER_BY;
    }

    // クエリがsearchPrefix:で始まるエントリを探す（: は自動で追加）
    const matchingEntry = entries.find(entry =>
      entry.searchPrefix && query.startsWith(entry.searchPrefix + ':')
    );

    if (matchingEntry) {
      return matchingEntry.orderBy ?? DEFAULT_ORDER_BY;
    }

    // searchPrefixがマッチしない場合は、searchPrefixが未設定のエントリを探す
    const defaultEntry = entries.find(entry => !entry.searchPrefix);
    if (defaultEntry) {
      return defaultEntry.orderBy ?? DEFAULT_ORDER_BY;
    }

    // フォールバック: 最初のエントリの設定を使用
    return entries[0]?.orderBy ?? DEFAULT_ORDER_BY;
  }

  /**
   * orderBy文字列をパースしてフィールド名とソート方向を取得
   * 例: "name" → { field: "name", direction: "asc" }
   *     "name desc" → { field: "name", direction: "desc" }
   *     "{json@name} desc" → { field: "name", direction: "desc" }
   *     "{json@createdAt} desc" → { field: "createdAt", direction: "desc" }
   */
  static parseOrderBy(orderBy: string): { field: string; direction: 'asc' | 'desc' } {
    const parts = orderBy.trim().split(/\s+/);
    const lastPart = parts[parts.length - 1]?.toLowerCase();
    const hasDirection = lastPart === 'asc' || lastPart === 'desc';
    const direction: 'asc' | 'desc' = hasDirection ? lastPart as 'asc' | 'desc' : 'asc';
    const rawField = hasDirection ? parts.slice(0, -1).join(' ') : orderBy.trim();

    // テンプレート構文からフィールド名を抽出（例: "{json@name}" → "name"）
    // "name" や "description" はそのまま使用
    let field = rawField;
    const templateMatch = rawField.match(/\{(?:json@|frontmatter@)?(\w+(?:\.\w+)*)\}/);
    if (templateMatch?.[1]) {
      field = templateMatch[1];
    }

    return { field, direction };
  }

  /**
   * orderBy文字列からテンプレート部分を抽出（ソート方向を除く）
   * 例: "{json@createdAt} desc" → "{json@createdAt}"
   *     "name desc" → "name"
   *     "name" → "name"
   */
  static extractOrderByTemplate(orderBy: string): string {
    const parts = orderBy.trim().split(/\s+/);
    const lastPart = parts[parts.length - 1]?.toLowerCase();
    const hasDirection = lastPart === 'asc' || lastPart === 'desc';
    return hasDirection ? parts.slice(0, -1).join(' ') : orderBy.trim();
  }

  /**
   * アイテムを指定のソート順でソート
   */
  private sortItems(items: CustomSearchItem[], orderBy: string): CustomSearchItem[] {
    const { field, direction } = CustomSearchLoader.parseOrderBy(orderBy);
    const isCustomField = field !== 'updatedAt' && field !== 'name' && field !== 'description';

    // カスタムフィールドの場合、数値変換をソート前に1回だけ行う
    let numericValues: Map<CustomSearchItem, number> | null = null;
    if (isCustomField) {
      const map = new Map<CustomSearchItem, number>();
      let allNumeric = true;
      for (const item of items) {
        const value = item.sortKey ?? item.name;
        const num = Number(value);
        if (isNaN(num)) { allNumeric = false; break; }
        map.set(item, num);
      }
      if (allNumeric && map.size > 0) numericValues = map;
    }

    return [...items].sort((a, b) => {
      if (field === 'updatedAt') {
        const comparison = (a.updatedAt ?? 0) - (b.updatedAt ?? 0);
        return direction === 'desc' ? -comparison : comparison;
      }

      // カスタムフィールドの数値比較（前計算済み）
      if (numericValues) {
        const comparison = numericValues.get(a)! - numericValues.get(b)!;
        return direction === 'desc' ? -comparison : comparison;
      }

      let aValue: string;
      let bValue: string;
      if (field === 'name' || isCustomField) {
        aValue = a.sortKey ?? a.name;
        bValue = b.sortKey ?? b.name;
      } else {
        aValue = a.description;
        bValue = b.description;
      }
      const comparison = aValue.localeCompare(bValue);
      return direction === 'desc' ? -comparison : comparison;
    });
  }

  /**
   * 全設定エントリからアイテムをロード
   * Singleflight パターン: 同時呼び出しが同一の Promise を共有し Cache Stampede を防止
   */
  private async loadAll(): Promise<CustomSearchItem[]> {
    if (this.isStale) {
      this.clearAllCaches();
    }

    const cacheKey = 'all';
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached.items;
    }

    // Singleflight: 既に進行中のロードがあればそれを共有
    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    this.loadingPromise = this.loadAllEntries().then(({ items: allItems, watchableFiles }) => {
      allItems.sort((a, b) => a.name.localeCompare(b.name));
      this.cache.set(cacheKey, { items: allItems });
      this.buildEntryMap();
      this.logLoadedItems(allItems);
      this.startFileWatching(watchableFiles);
      this.loadingPromise = null;
      return allItems;
    }).catch(err => {
      this.loadingPromise = null;
      throw err;
    });

    return this.loadingPromise;
  }

  /**
   * Load all entries with deduplication
   */
  private async loadAllEntries(): Promise<{ items: CustomSearchItem[]; watchableFiles: string[] }> {
    const results = await Promise.all(
      this.config.map(async (entry) => {
        const sourceId = entry.source
          ? `source:${entry.source}`
          : `${entry.path}:${entry.pattern}`;
        try {
          const { items, watchableFiles } = entry.source
            ? await this.loadCommandEntry(entry)
            : await this.loadEntry(entry);
          return { items, sourceId, watchableFiles };
        } catch (error) {
          logger.error('Failed to load entry', { entry, error });
          return { items: [] as CustomSearchItem[], sourceId, watchableFiles: [] as string[] };
        }
      })
    );

    const allItems: CustomSearchItem[] = [];
    const allWatchableFiles: string[] = [];
    const seenNames = new Map<string, Set<string>>();
    for (const { items, sourceId, watchableFiles } of results) {
      this.addItemsWithDeduplication(items, sourceId, seenNames, allItems);
      allWatchableFiles.push(...watchableFiles);
    }

    return { items: allItems, watchableFiles: allWatchableFiles };
  }

  /**
   * Add items with deduplication check (scoped per sourceId to avoid cross-entry name collisions)
   */
  private addItemsWithDeduplication(
    items: CustomSearchItem[],
    sourceId: string,
    seenNames: Map<string, Set<string>>,
    allItems: CustomSearchItem[]
  ): void {
    if (!seenNames.has(sourceId)) {
      seenNames.set(sourceId, new Set());
    }
    const sourceSeenNames = seenNames.get(sourceId)!;

    for (const item of items) {
      // Build dedup key: name + label + sortKey + inputText
      // sortKey (e.g., timestamp) is essential for JSONL sources where multiple entries
      // can have the same display value (e.g., "commit" entered at different times)
      let key = item.label ? `${item.name}:${item.label}` : item.name;
      if (item.sortKey) key += `\t${item.sortKey}`;
      if (item.inputText) key += `\t${item.inputText}`;
      if (!sourceSeenNames.has(key)) {
        sourceSeenNames.add(key);
        allItems.push(item);
      }
    }
  }

  /**
   * Log loaded items statistics
   */
  private logLoadedItems(allItems: CustomSearchItem[]): void {
    logger.info('CustomSearch items loaded', {
      total: allItems.length,
      commands: allItems.filter(i => i.type === 'command').length,
      mentions: allItems.filter(i => i.type === 'mention').length
    });
  }

  /**
   * 単一エントリをロード
   */
  private async loadEntry(entry: CustomSearchEntry): Promise<{ items: CustomSearchItem[]; watchableFiles: string[] }> {
    const expandedPath = await this.resolveSymlink(entry.path.replace(/^~/, os.homedir()));

    const isValid = await this.validateDirectory(expandedPath);
    if (!isValid) {
      return { items: [], watchableFiles: [] };
    }

    // Parse jq expression from pattern: '**/config.json@.members' → filePattern + jqExpression
    const { filePattern, jqExpression } = this.parseJqPath(entry.pattern);
    const files = await this.findFiles(expandedPath, filePattern, entry.excludeMarker);
    const sourceId = `${entry.path}:${entry.pattern}`;
    logger.debug('CustomSearch loadEntry', {
      path: entry.path,
      pattern: entry.pattern,
      filePattern,
      jqExpression,
      filesFound: files.length
    });

    // Watchable files: all files if pattern is individual (non-glob), otherwise JSONL only
    const isIndividual = CustomSearchLoader.isIndividualFilePattern(filePattern);
    const watchableFiles = isIndividual ? files : files.filter(f => f.endsWith('.jsonl'));

    const items = await this.parseFilesToItems(files, entry, sourceId, jqExpression);
    return { items, watchableFiles };
  }

  /**
   * Load items from command source (stale-while-revalidate)
   * Returns cached items immediately and triggers background refresh.
   */
  private async loadCommandEntry(
    entry: CustomSearchEntry
  ): Promise<{ items: CustomSearchItem[]; watchableFiles: string[] }> {
    const sourceId = `source:${entry.source}`;
    const cached = this.commandCache.get(sourceId);

    if (cached) {
      // Return stale cache immediately and refresh in background
      this.scheduleCommandRefresh(entry, sourceId);
      return { items: cached.items, watchableFiles: [] };
    }

    // First load: fetch synchronously
    const items = await this.fetchCommandItems(entry, sourceId);
    return { items, watchableFiles: [] };
  }

  /**
   * Schedule a background refresh for command source (Singleflight)
   */
  private scheduleCommandRefresh(entry: CustomSearchEntry, sourceId: string): void {
    if (this.commandFetchPromises.has(sourceId)) return;

    // Capture previous item count before fetch overwrites the cache
    const previousCount = this.commandCache.get(sourceId)?.items.length ?? 0;
    const promise = this.fetchCommandItems(entry, sourceId).then(items => {
      this.commandFetchPromises.delete(sourceId);
      // Notify renderer if item count changed (intentionally count-only for performance)
      if (items.length !== previousCount) {
        this.invalidateCache();
        this.emit('source-changed');
      }
      return items;
    }).catch(err => {
      this.commandFetchPromises.delete(sourceId);
      // fetchCommandItems handles its own errors and returns stale cache,
      // so this catch is defensive for unexpected errors only
      logger.debug('Background command refresh failed:', err);
      return [] as CustomSearchItem[];
    });

    this.commandFetchPromises.set(sourceId, promise);
  }

  /**
   * Execute command and parse stdout into CustomSearchItems
   */
  private async fetchCommandItems(
    entry: CustomSearchEntry,
    sourceId: string
  ): Promise<CustomSearchItem[]> {
    try {
      const { stdout } = await execAsync(entry.source!, {
        timeout: CustomSearchLoader.COMMAND_SOURCE_TIMEOUT,
        env: { ...process.env },
      });

      const output = stdout.trimEnd();
      if (!output) {
        this.commandCache.set(sourceId, { items: [], fetchedAt: Date.now() });
        return [];
      }

      const items = this.parseCommandOutput(output, entry, sourceId);
      this.commandCache.set(sourceId, { items, fetchedAt: Date.now() });
      logger.info('CustomSearch command source loaded', { source: entry.source, itemCount: items.length });
      return items;
    } catch (error) {
      const execError = error as { message: string; stderr?: string; signal?: string };
      const msg = execError.signal === 'SIGTERM'
        ? `Command timed out (5s): ${entry.source}`
        : `Command failed: ${execError.stderr || execError.message}`;
      logger.warn('CustomSearch command source error', { source: entry.source, error: msg });
      this.emit('command-error', { message: msg });

      // Return stale cache if available, otherwise empty
      const cached = this.commandCache.get(sourceId);
      return cached ? cached.items : [];
    }
  }

  /**
   * Parse command output into CustomSearchItems.
   * Auto-detects format: JSONL (first non-empty line starts with '{') or plain text.
   */
  private parseCommandOutput(
    output: string,
    entry: CustomSearchEntry,
    sourceId: string
  ): CustomSearchItem[] {
    const lines = output.split('\n');
    const firstLine = lines.find(l => l.trim());
    const isJsonl = firstLine?.trimStart().startsWith('{');

    if (isJsonl) {
      return this.parseCommandOutputJsonl(lines, output, entry, sourceId);
    }
    return this.parseCommandOutputPlainText(lines, output, entry, sourceId);
  }

  /**
   * Parse plain text command output (one item per non-empty line)
   */
  private parseCommandOutputPlainText(
    lines: string[],
    content: string,
    entry: CustomSearchEntry,
    sourceId: string
  ): CustomSearchItem[] {
    const items: CustomSearchItem[] = [];
    const virtualPath = `command-source:${entry.source}`;
    const nowMs = Date.now();
    let lineIndex = 0;

    for (const rawLine of lines) {
      const trimmed = rawLine.trim();
      if (!trimmed) continue;
      const item = this.createItemFromPlainTextLine(
        trimmed, entry.source!, '', virtualPath,
        entry, sourceId, '', '', lineIndex, nowMs, content, {}
      );
      if (item) { items.push(item); lineIndex++; }
    }
    return items;
  }

  /**
   * Parse JSONL command output (one JSON object per line)
   */
  private parseCommandOutputJsonl(
    lines: string[],
    content: string,
    entry: CustomSearchEntry,
    sourceId: string
  ): CustomSearchItem[] {
    const items: CustomSearchItem[] = [];
    const virtualPath = `command-source:${entry.source}`;

    for (const rawLine of lines) {
      const trimmed = rawLine.trim();
      if (!trimmed) continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(trimmed);
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) continue;
      } catch {
        continue;
      }
      const elementData = parsed as Record<string, unknown>;
      const item = this.createItemFromJsonData(
        elementData, entry.source!, '', virtualPath, entry, sourceId, undefined, content
      );
      if (item) items.push(item);
    }
    return items;
  }

  /**
   * Resolve symlink to real path (returns original path if not a symlink or on error)
   */
  private async resolveSymlink(targetPath: string): Promise<string> {
    try {
      return await fs.realpath(targetPath);
    } catch {
      return targetPath;
    }
  }

  /**
   * Resolve Dirent entry type, following symlinks
   */
  private async resolveEntryType(entry: import('fs').Dirent, fullPath: string): Promise<'file' | 'directory' | 'other'> {
    if (entry.isFile()) return 'file';
    if (entry.isDirectory()) return 'directory';
    if (entry.isSymbolicLink()) {
      try {
        const stats = await fs.stat(fullPath);
        if (stats.isDirectory()) return 'directory';
        if (stats.isFile()) return 'file';
      } catch {
        // Broken symlink
      }
    }
    return 'other';
  }

  /**
   * Validate directory exists
   */
  private async validateDirectory(path: string): Promise<boolean> {
    try {
      const stats = await fs.stat(path);
      if (!stats.isDirectory()) {
        logger.warn('CustomSearch path is not a directory', { path });
        return false;
      }
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Parse files to CustomSearchItems
   */
  private async parseFilesToItems(
    files: string[],
    entry: CustomSearchEntry,
    sourceId: string,
    jqExpression: string | null
  ): Promise<CustomSearchItem[]> {
    const items: CustomSearchItem[] = [];
    const BATCH_SIZE = 50;

    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(async (filePath) => {
          if (jqExpression && filePath.endsWith('.json')) {
            return this.parseJsonArrayToItems(filePath, entry, sourceId, jqExpression);
          } else if (filePath.endsWith('.jsonl')) {
            return this.parseJsonlToItems(filePath, entry, sourceId, jqExpression);
          } else if (this.isPlainTextFile(filePath)) {
            return this.parsePlainTextToItems(filePath, entry, sourceId);
          } else {
            const item = await this.parseFileToItem(filePath, entry, sourceId);
            return item ? [item] : [];
          }
        })
      );
      items.push(...batchResults.flat());
    }

    // Apply entry-level enable/disable filtering
    if (entry.enable || entry.disable) {
      return items.filter(item =>
        isCommandEnabled(item.name, entry.enable, entry.disable)
      );
    }

    return items;
  }

  /**
   * Parse single file to CustomSearchItem
   */
  private async parseFileToItem(
    filePath: string,
    entry: CustomSearchEntry,
    sourceId: string
  ): Promise<CustomSearchItem | null> {
    try {
      const [content, fileStat] = await Promise.all([
        fs.readFile(filePath, 'utf8'),
        fs.stat(filePath),
      ]);
      const isJsonFile = filePath.endsWith('.json');
      const frontmatter = isJsonFile ? {} : parseFrontmatter(content);
      const rawFrontmatter = isJsonFile ? '' : extractRawFrontmatter(content);
      const basename = getBasename(filePath);
      const values = await this.resolveEntryValues(filePath, entry);
      const prefix = values.prefix ?? '';
      const dirname = getDirname(filePath);
      const heading = isJsonFile ? '' : parseFirstHeading(content);
      const jsonData = isJsonFile ? parseJsonContent(content) : undefined;
      const hasValues = Object.keys(values).length > 0;
      const basePath = entry.path.replace(/^~/, os.homedir());
      const context = { basename, frontmatter, prefix, dirname, filePath, basePath, heading, content, ...(hasValues && { values }), ...(jsonData && { jsonData }) };

      const item: CustomSearchItem = {
        name: resolveTemplate(entry.name, context),
        description: resolveTemplate(entry.description, context),
        type: entry.type,
        filePath,
        sourceId,
      };

      const sortKey = this.resolveSortKey(entry, context);
      if (sortKey) item.sortKey = sortKey;
      if (rawFrontmatter) item.frontmatter = rawFrontmatter;
      this.applyOptionalItemFields(item, entry, context);
      item.updatedAt = fileStat.mtimeMs;

      const displayTime = this.resolveDisplayTime(entry, context, fileStat.mtimeMs);
      if (displayTime !== undefined) item.displayTime = displayTime;

      return item;
    } catch (error) {
      logger.warn('Failed to parse file', { filePath, error });
      return null;
    }
  }

  /** エントリのvalues/prefixPatternからテンプレート変数を解決する */
  private async resolveEntryValues(filePath: string, entry: CustomSearchEntry): Promise<Record<string, string>> {
    if (!entry.values && !entry.prefixPattern) return {};
    const expandedPath = await this.resolveSymlink(entry.path.replace(/^~/, os.homedir()));
    return resolveValues(filePath, entry.values, entry.prefixPattern, expandedPath);
  }

  /** label/color/icon/argumentHint のオプションフィールドをアイテムに適用する */
  private applyOptionalItemFields(
    item: CustomSearchItem,
    entry: CustomSearchEntry,
    context: Parameters<typeof resolveTemplate>[1]
  ): void {
    if (entry.label) {
      const resolvedLabel = resolveTemplate(entry.label, context);
      if (resolvedLabel) item.label = resolvedLabel;
    }
    if (entry.color) {
      const resolvedColor = this.resolveColorWithFallback(entry.color, context);
      if (resolvedColor) item.color = resolvedColor as ColorValue;
    }
    if (entry.icon) {
      const resolvedIcon = resolveTemplate(entry.icon, context);
      if (resolvedIcon) item.icon = resolvedIcon.startsWith('codicon-') ? resolvedIcon : `codicon-${resolvedIcon}`;
    }
    // Auto-detect default icon from pattern when not explicitly set
    if (!item.icon && entry.pattern) {
      item.icon = SKILL_PATTERN.test(entry.pattern) ? 'codicon-edit-sparkle' : 'codicon-terminal';
    }
    if (entry.argumentHint) {
      const resolvedHint = resolveTemplate(entry.argumentHint, context);
      if (resolvedHint) item.argumentHint = resolvedHint;
    }
    if (entry.triggers) {
      item.triggers = entry.triggers;
    }
    if (entry.command) {
      // Shell-quote all resolved template values to prevent shell injection (CWE-78).
      // valueTransform is applied AFTER resolveJsonPath/getDirname/etc. produce their
      // final string, so JSON.stringify output (including object keys) is also quoted.
      const resolvedCommand = resolveTemplate(entry.command, context, shellQuote);
      if (resolvedCommand) item.command = resolvedCommand;
    }
  }

  /** Markdown構造化ファイルの拡張子 */
  private static readonly STRUCTURED_EXTENSIONS = new Set(['.md', '.json', '.jsonl', '.yaml', '.yml']);

  /** プレーンテキストファイルかどうか判定（Markdown/JSON/YAML以外） */
  private isPlainTextFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return !CustomSearchLoader.STRUCTURED_EXTENSIONS.has(ext);
  }

  /** プレーンテキストの最初の非空行を取得 */
  private parseFirstLine(content: string): string {
    const firstLine = content.split('\n').find(line => line.trim() !== '');
    return firstLine?.trim() ?? '';
  }

  /**
   * Parse plain text file to generate multiple CustomSearchItems (one per non-empty line)
   * テンプレート変数 {line} で各行のテキストを参照可能
   */
  private async parsePlainTextToItems(
    filePath: string,
    entry: CustomSearchEntry,
    sourceId: string
  ): Promise<CustomSearchItem[]> {
    try {
      const [content, fileStat] = await Promise.all([
        fs.readFile(filePath, 'utf8'),
        fs.stat(filePath),
      ]);
      const lines = content.split('\n');
      const basename = getBasename(filePath);
      const dirname = getDirname(filePath);
      const entryValues = await this.resolveEntryValues(filePath, entry);
      const prefix = entryValues.prefix ?? '';
      const heading = this.parseFirstLine(content);
      const items: CustomSearchItem[] = [];
      let lineIndex = 0;

      for (const rawLine of lines) {
        const trimmed = rawLine.trim();
        if (!trimmed) continue;
        const item = this.createItemFromPlainTextLine(
          trimmed, basename, dirname, filePath, entry, sourceId, prefix, heading, lineIndex, fileStat.mtimeMs, content, entryValues
        );
        if (item) { items.push(item); lineIndex++; }
      }

      return items;
    } catch (error) {
      logger.warn('Failed to parse plain text file', { filePath, error });
      return [];
    }
  }

  /** プレーンテキストの1行からCustomSearchItemを生成する */
  private createItemFromPlainTextLine(
    trimmed: string,
    basename: string,
    dirname: string,
    filePath: string,
    entry: CustomSearchEntry,
    sourceId: string,
    prefix: string,
    heading: string,
    lineIndex: number,
    mtimeMs: number,
    content: string,
    values?: Record<string, string>
  ): CustomSearchItem | null {
    const basePath = entry.path ? entry.path.replace(/^~/, os.homedir()) : '';
    const context = { basename, frontmatter: {}, prefix, dirname, filePath, basePath, heading, line: trimmed, content, ...(values && { values }) };
    const item: CustomSearchItem = {
      name: resolveTemplate(entry.name, context),
      description: resolveTemplate(entry.description, context),
      type: entry.type,
      filePath,
      sourceId,
    };

    // ユーザー指定の orderBy があればそちらを優先、なければ行順を保持
    const sortKey = this.resolveSortKey(entry, context);
    item.sortKey = sortKey ?? String(lineIndex).padStart(8, '0');
    this.applyOptionalItemFields(item, entry, context);
    this.applyInputFormat(item, entry, context);
    item.updatedAt = mtimeMs;

    const displayTime = this.resolveDisplayTime(entry, context, mtimeMs);
    if (displayTime !== undefined) item.displayTime = displayTime;

    return item.name ? item : null;
  }

  /**
   * Parse JSON file with jq expression to generate multiple CustomSearchItems
   */
  private async parseJsonArrayToItems(
    filePath: string,
    entry: CustomSearchEntry,
    sourceId: string,
    jqExpression: string
  ): Promise<CustomSearchItem[]> {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const jsonData = parseJsonContent(content);
      if (!jsonData) return [];

      const arrayData = await this.evaluateJqArrayResult(jsonData, jqExpression, filePath);
      if (!arrayData) return [];

      const items: CustomSearchItem[] = [];
      for (const element of arrayData) {
        if (element === null || typeof element !== 'object' || Array.isArray(element)) continue;
        const elementData = element as Record<string, unknown>;
        const item = this.createItemFromJsonData(
          elementData, getBasename(filePath), getDirname(filePath), filePath, entry, sourceId, [jsonData], content
        );
        if (item) items.push(item);
      }

      return items;
    } catch (error) {
      logger.warn('Failed to parse JSON array file', { filePath, error });
      return [];
    }
  }

  /** jqExpression を評価して配列結果を返す。配列でなければ null を返す */
  private async evaluateJqArrayResult(
    jsonData: Record<string, unknown>,
    jqExpression: string,
    filePath: string
  ): Promise<unknown[] | null> {
    // filePath をキャッシュキーとして渡し、繰り返し失敗を防止
    const result = await evaluateJq(jsonData, jqExpression, filePath);
    // logger.debug('evaluateJqArrayResult', {
    //   filePath,
    //   jqExpression,
    //   resultType: typeof result,
    //   isArray: Array.isArray(result),
    //   length: Array.isArray(result) ? result.length : 'N/A'
    // });
    return Array.isArray(result) ? result : null;
  }

  /**
   * Parse jq expression from pattern
   * Example: 'config.json@.members' → { filePattern: 'config.json', jqExpression: '.members' }
   * Example: 'config.json@.members | map(select(.active))' → { filePattern: 'config.json', jqExpression: '.members | map(select(.active))' }
   */
  private parseJqPath(pattern: string): { filePattern: string; jqExpression: string | null } {
    const atIndex = pattern.indexOf('@.');
    if (atIndex === -1) return { filePattern: pattern, jqExpression: null };
    return {
      filePattern: pattern.slice(0, atIndex),
      jqExpression: pattern.slice(atIndex + 1),  // skip '@', keep '.'
    };
  }

  /** Threshold for switching to streaming JSONL parsing (1MB) */
  private static readonly STREAMING_THRESHOLD = 1024 * 1024;

  /**
   * Parse JSONL file to generate multiple CustomSearchItems (one per line)
   * jqExpression がある場合、各行のJSONに対してjq式を適用する
   * ファイルサイズ >= 1MB の場合はストリーミング読み込みに自動切替
   */
  private async parseJsonlToItems(
    filePath: string,
    entry: CustomSearchEntry,
    sourceId: string,
    jqExpression: string | null = null
  ): Promise<CustomSearchItem[]> {
    try {
      const stat = await fs.stat(filePath);
      if (stat.size >= CustomSearchLoader.STREAMING_THRESHOLD) {
        return this.parseJsonlToItemsStreaming(filePath, entry, sourceId, jqExpression);
      }
      return this.parseJsonlToItemsBatch(filePath, entry, sourceId, jqExpression);
    } catch (error) {
      logger.warn('Failed to parse JSONL file', { filePath, error });
      return [];
    }
  }

  /** Batch JSONL parsing for small files (< 1MB) */
  private async parseJsonlToItemsBatch(
    filePath: string,
    entry: CustomSearchEntry,
    sourceId: string,
    jqExpression: string | null
  ): Promise<CustomSearchItem[]> {
    const content = await fs.readFile(filePath, 'utf8');
    return this.iterateJsonlLines(content.split('\n'), filePath, entry, sourceId, jqExpression, content);
  }

  /** Streaming JSONL parsing for large files (>= 1MB) */
  private async parseJsonlToItemsStreaming(
    filePath: string,
    entry: CustomSearchEntry,
    sourceId: string,
    jqExpression: string | null
  ): Promise<CustomSearchItem[]> {
    const rl = createInterface({
      input: createReadStream(filePath, { encoding: 'utf8' }),
      crlfDelay: Infinity,
    });
    return this.iterateJsonlLines(rl, filePath, entry, sourceId, jqExpression, undefined);
  }

  /** Common JSONL line iteration logic for both batch and streaming modes */
  private async iterateJsonlLines(
    lines: Iterable<string> | AsyncIterable<string>,
    filePath: string,
    entry: CustomSearchEntry,
    sourceId: string,
    jqExpression: string | null,
    content: string | undefined
  ): Promise<CustomSearchItem[]> {
    const basename = getBasename(filePath);
    const dirname = getDirname(filePath);
    const items: CustomSearchItem[] = [];

    for await (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const result = await this.parseJsonlLine(trimmed, jqExpression, filePath, basename, dirname, entry, sourceId, content);
      if (result) items.push(...result);
    }
    return items;
  }

  /** Parse a single JSONL line into CustomSearchItem(s) */
  private async parseJsonlLine(
    trimmedLine: string,
    jqExpression: string | null,
    filePath: string,
    basename: string,
    dirname: string,
    entry: CustomSearchEntry,
    sourceId: string,
    content: string | undefined
  ): Promise<CustomSearchItem[] | null> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmedLine);
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    } catch {
      return null;
    }

    if (jqExpression) {
      return this.applyJqToJsonlLine(
        parsed as Record<string, unknown>, jqExpression, filePath, basename, dirname, entry, sourceId, content
      );
    }

    const elementData = parsed as Record<string, unknown>;
    const item = this.createItemFromJsonData(elementData, basename, dirname, filePath, entry, sourceId, undefined, content);
    return item ? [item] : null;
  }

  /** JSONL行にjq式を適用してCustomSearchItemsを生成する */
  private async applyJqToJsonlLine(
    lineData: Record<string, unknown>,
    jqExpression: string,
    filePath: string,
    basename: string,
    dirname: string,
    entry: CustomSearchEntry,
    sourceId: string,
    content: string | undefined
  ): Promise<CustomSearchItem[] | null> {
    const jqResult = await evaluateJq(lineData, jqExpression, filePath);
    if (jqResult === null || jqResult === undefined) return null;

    const elements = Array.isArray(jqResult) ? jqResult : [jqResult];
    const items: CustomSearchItem[] = [];
    for (const element of elements) {
      if (element === null || typeof element !== 'object' || Array.isArray(element)) continue;
      const elementData = element as Record<string, unknown>;
      const item = this.createItemFromJsonData(elementData, basename, dirname, filePath, entry, sourceId, [lineData], content);
      if (item) items.push(item);
    }
    return items.length > 0 ? items : null;
  }

  /**
   * colorテンプレートをフォールバック付きで解決する
   * 例: "{json@color}|#ffffff" → json@colorが空なら"#ffffff"
   */
  private resolveColorWithFallback(colorTemplate: string, context: Parameters<typeof resolveTemplate>[1]): string {
    const pipeIndex = colorTemplate.indexOf('|');
    if (pipeIndex === -1) {
      return resolveTemplate(colorTemplate, context);
    }
    const template = colorTemplate.slice(0, pipeIndex);
    const fallback = colorTemplate.slice(pipeIndex + 1);
    const resolved = resolveTemplate(template, context);
    logger.debug('resolveColorWithFallback', { colorTemplate, template, fallback, resolved, result: resolved || fallback });
    return resolved || fallback;
  }

  /**
   * entryのdisplayTimeテンプレートからタイムスタンプを解決する
   * @returns number（タイムスタンプ）、null（"none"で非表示）、undefined（未設定）
   */
  private resolveDisplayTime(
    entry: CustomSearchEntry,
    context: Parameters<typeof resolveTemplate>[1],
    fileMtimeMs?: number
  ): number | null | undefined {
    if (!entry.displayTime) return undefined;
    if (entry.displayTime === 'none') return null;

    // {updatedAt} は特別扱い: ファイル更新日時を使用
    const parsed = CustomSearchLoader.parseOrderBy(entry.displayTime);
    if (parsed.field === 'updatedAt') {
      return fileMtimeMs;
    }

    // テンプレートを解決して数値に変換
    const resolved = resolveTemplate(entry.displayTime, context);
    if (!resolved) return undefined;
    const num = Number(resolved);
    return isNaN(num) ? undefined : num;
  }

  /**
   * entryのorderByテンプレートからsortKeyを解決する
   * name/descriptionフィールドの場合はsortKey不要（sortItemsが直接参照する）
   */
  private resolveSortKey(entry: CustomSearchEntry, context: Parameters<typeof resolveTemplate>[1]): string | undefined {
    if (!entry.orderBy) return undefined;
    const { field } = CustomSearchLoader.parseOrderBy(entry.orderBy);
    if (field === 'name' || field === 'description' || field === 'updatedAt') return undefined;
    const template = CustomSearchLoader.extractOrderByTemplate(entry.orderBy);
    const resolved = resolveTemplate(template, context);
    return resolved || undefined;
  }

  /**
   * JSONデータからCustomSearchItemを生成するヘルパー
   */
  private createItemFromJsonData(
    elementData: Record<string, unknown>,
    basename: string,
    dirname: string,
    filePath: string,
    entry: CustomSearchEntry,
    sourceId: string,
    parentJsonDataStack?: Record<string, unknown>[],
    content?: string
  ): CustomSearchItem | null {
    const basePath = entry.path ? entry.path.replace(/^~/, os.homedir()) : '';
    const context = { basename, frontmatter: {}, prefix: '', dirname, filePath, basePath, heading: '', jsonData: elementData, ...(parentJsonDataStack && { parentJsonDataStack }), ...(content !== undefined && { content }) };
    const item: CustomSearchItem = {
      name: resolveTemplate(entry.name, context),
      description: resolveTemplate(entry.description, context),
      type: entry.type,
      filePath,
      sourceId,
    };

    const sortKey = this.resolveSortKey(entry, context);
    if (sortKey) item.sortKey = sortKey;
    this.applyOptionalItemFields(item, entry, context);
    this.applyInputFormat(item, entry, context);

    const displayTime = this.resolveDisplayTime(entry, context);
    if (displayTime !== undefined) item.displayTime = displayTime;

    return item.name ? item : null;
  }

  /**
   * entry の inputFormat 設定を item に適用する
   * 'name' の場合はそのまま（テンプレート解決なし）、それ以外はテンプレートとして解決
   */
  private applyInputFormat(item: CustomSearchItem, entry: CustomSearchEntry, context: TemplateContext): void {
    if (!entry.inputFormat) return;
    item.inputFormat = entry.inputFormat;
    if (entry.inputFormat !== 'name') {
      item.inputText = resolveTemplate(entry.inputFormat, context);
    }
  }

  /**
   * パターンに一致するファイルを検索
   * サポートするパターン:
   * - "*.md" - ルート直下の .md ファイル
   * - "SKILL.md" - 具体的なファイル名
   * - "**\/*.md" - 再帰的な .md ファイル検索
   * - "**\/commands/*.md" - 再帰的に commands ディレクトリを探して .md ファイル
   * - "**\/*\/SKILL.md" - 再帰的な任意ディレクトリ内の SKILL.md
   * - "**\/{commands,agents}/*.md" - ブレース展開対応
   */
  private async findFiles(directory: string, pattern: string, excludeMarker?: string): Promise<string[]> {
    // {latest} handling: walk prefix segments, pick newest dir, delegate suffix to findFilesWithPattern
    if (pattern.includes('{latest}')) {
      return this.findFilesWithLatest(directory, pattern, excludeMarker);
    }

    // ブレース展開を処理（例: {commands,agents} → ['commands', 'agents']）
    const expandedPatterns = this.expandBraces(pattern);

    const allFiles: string[] = [];
    for (const expandedPattern of expandedPatterns) {
      const files = await this.findFilesWithPattern(directory, expandedPattern, '', excludeMarker);
      allFiles.push(...files);
    }

    // 重複を除去
    return [...new Set(allFiles)];
  }

  /**
   * {latest} を含むパターンを処理:
   * 1. {latest} 前のセグメントでディレクトリを走査（* glob対応）
   * 2. {latest} 位置で各グループの最新ディレクトリのみ選択
   * 3. {latest} 後のパターンを findFilesWithPattern に委譲
   */
  private async findFilesWithLatest(directory: string, pattern: string, excludeMarker?: string): Promise<string[]> {
    const segments = pattern.split('/');
    const latestIndex = segments.findIndex(s => s === '{latest}');
    if (latestIndex < 0) return this.findFiles(directory, pattern, excludeMarker);

    const prefixSegments = segments.slice(0, latestIndex); // segments before {latest}
    const suffixPattern = segments.slice(latestIndex + 1).join('/'); // pattern after {latest}

    // Walk prefix segments to find parent directories of {latest}
    const parentDirs = await this.walkGlobSegments(directory, prefixSegments);

    // For each parent dir, find the latest subdirectory
    const allFiles: string[] = [];
    for (const parentDir of parentDirs) {
      const latestDir = await this.findLatestSubdir(parentDir);
      if (!latestDir) continue;

      // Delegate suffix pattern to existing findFiles (handles **, braces, etc.)
      const files = await this.findFiles(latestDir, suffixPattern, excludeMarker);
      allFiles.push(...files);
    }

    return [...new Set(allFiles)];
  }

  /** Walk glob segments (e.g., ["*", "*"]) to find matching directories */
  private async walkGlobSegments(baseDir: string, segments: string[]): Promise<string[]> {
    let dirs = [baseDir];
    for (const segment of segments) {
      const nextDirs: string[] = [];
      for (const dir of dirs) {
        try {
          const entries = await fs.readdir(dir, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.isDirectory() && this.matchesGlobPattern(entry.name, segment)) {
              nextDirs.push(path.join(dir, entry.name));
            }
          }
        } catch { /* skip unreadable dirs */ }
      }
      dirs = nextDirs;
    }
    return dirs;
  }

  /** Find the most recently modified subdirectory */
  private async findLatestSubdir(parentDir: string): Promise<string | null> {
    try {
      const entries = await fs.readdir(parentDir, { withFileTypes: true });
      let latestDir = '';
      let latestMtime = -1;
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const fullPath = path.join(parentDir, entry.name);
        try {
          const stat = await fs.stat(fullPath);
          if (stat.mtimeMs > latestMtime) {
            latestMtime = stat.mtimeMs;
            latestDir = fullPath;
          }
        } catch { /* skip */ }
      }
      return latestDir || null;
    } catch {
      return null;
    }
  }

  /**
   * ブレース展開を処理
   * 例: "**\/{commands,agents}/*.md" → ["**\/commands/*.md", "**\/agents/*.md"]
   */
  private expandBraces(pattern: string): string[] {
    const braceMatch = pattern.match(/\{([^}]+)\}/);
    if (!braceMatch || !braceMatch[1]) {
      return [pattern];
    }

    const fullMatch = braceMatch[0];
    const content = braceMatch[1];
    const alternatives = content.split(',').map(s => s.trim());
    const prefix = pattern.slice(0, braceMatch.index);
    const suffix = pattern.slice((braceMatch.index ?? 0) + fullMatch.length);

    const results: string[] = [];
    for (const alt of alternatives) {
      const expanded = prefix + alt + suffix;
      // 再帰的にブレース展開を処理
      results.push(...this.expandBraces(expanded));
    }

    return results;
  }

  /**
   * パターンに一致するファイルを再帰的に検索
   * @param directory 検索対象ディレクトリ
   * @param pattern 検索パターン
   * @param relativePath ルートからの相対パス（パターンマッチング用）
   */
  private async findFilesWithPattern(
    directory: string,
    pattern: string,
    relativePath: string,
    excludeMarker?: string
  ): Promise<string[]> {
    const files: string[] = [];
    const parsed = this.parsePattern(pattern);

    try {
      const entries = await fs.readdir(directory, { withFileTypes: true });

      // excludeMarker が指定されている場合、そのファイルが存在するディレクトリをスキップ
      if (excludeMarker && entries.some(e => e.name === excludeMarker)) {
        return files;
      }

      for (const entry of entries) {
        const fullPath = path.join(directory, entry.name);
        const entryRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
        const entryType = await this.resolveEntryType(entry, fullPath);

        if (entryType === 'directory') {
          const dirFiles = await this.processDirectoryEntry(fullPath, entryRelativePath, pattern, parsed, excludeMarker);
          files.push(...dirFiles);
        } else if (entryType === 'file' && this.matchesFilePattern(entry.name, entryRelativePath, parsed)) {
          files.push(fullPath);
        }
      }
    } catch {
      // Silently ignore directory read errors
    }

    return files;
  }

  /**
   * Process a directory entry during pattern search
   */
  private async processDirectoryEntry(
    fullPath: string,
    entryRelativePath: string,
    pattern: string,
    parsed: ReturnType<typeof this.parsePattern>,
    excludeMarker?: string
  ): Promise<string[]> {
    if (!parsed.isRecursive) return [];

    const files: string[] = [];

    // Check intermediate pattern match
    if (parsed.intermediatePattern && this.matchesIntermediatePathSuffix(entryRelativePath, parsed.intermediatePattern)) {
      const subFiles = await this.findFilesInDir(fullPath, parsed.filePattern);
      files.push(...subFiles);
    }

    // Always recurse into subdirectories
    const subFiles = await this.findFilesWithPattern(fullPath, pattern, entryRelativePath, excludeMarker);
    files.push(...subFiles);

    return files;
  }

  /**
   * ディレクトリ内のファイルを検索（再帰なし）
   */
  private async findFilesInDir(directory: string, filePattern: string): Promise<string[]> {
    const files: string[] = [];

    try {
      const entries = await fs.readdir(directory, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(directory, entry.name);
        const entryType = await this.resolveEntryType(entry, fullPath);
        if (entryType === 'file' && this.matchesGlobPattern(entry.name, filePattern)) {
          files.push(fullPath);
        }
      }
    } catch {
      // Silently ignore directory read errors
    }

    return files;
  }

  /**
   * パターンを解析
   */
  private parsePattern(pattern: string): {
    isRecursive: boolean;
    intermediatePattern: string | null;
    filePattern: string;
  } {
    const isRecursive = pattern.startsWith('**/');

    if (!isRecursive) {
      return {
        isRecursive: false,
        intermediatePattern: null,
        filePattern: pattern,
      };
    }

    // "**/" を除去
    const withoutPrefix = pattern.slice(3);

    // 中間パスとファイルパターンを分離
    const lastSlashIndex = withoutPrefix.lastIndexOf('/');
    if (lastSlashIndex === -1) {
      // "**/*.md" のようなパターン
      return {
        isRecursive: true,
        intermediatePattern: null,
        filePattern: withoutPrefix,
      };
    }

    // "**/commands/*.md" または "**/*/SKILL.md" のようなパターン
    const intermediatePattern = withoutPrefix.slice(0, lastSlashIndex);
    const filePattern = withoutPrefix.slice(lastSlashIndex + 1);

    return {
      isRecursive: true,
      intermediatePattern,
      filePattern,
    };
  }

  /**
   * 相対パスの末尾が中間パターンにマッチするか確認
   * 例: "project1/commands" が "commands" にマッチ（末尾が一致）
   * 例: "plugins/my-plugin/commands" が "plugins/star/commands" にマッチ (star=*)
   * 例: "plugin1" が "*" にマッチ
   */
  private matchesIntermediatePathSuffix(relativePath: string, intermediatePattern: string): boolean {
    const pathSegments = relativePath.split('/');
    const patternSegments = intermediatePattern.split('/');

    // パスセグメント数がパターンセグメント数より少ない場合はマッチしない
    if (pathSegments.length < patternSegments.length) {
      return false;
    }

    // パスの末尾からパターンをマッチさせる
    const startIndex = pathSegments.length - patternSegments.length;

    for (let i = 0; i < patternSegments.length; i++) {
      const pathSeg = pathSegments[startIndex + i];
      const patternSeg = patternSegments[i];
      if (pathSeg === undefined || patternSeg === undefined) {
        return false;
      }
      if (!this.matchesGlobPattern(pathSeg, patternSeg)) {
        return false;
      }
    }

    return true;
  }

  /**
   * ファイルがパターンに一致するか確認
   */
  private matchesFilePattern(
    fileName: string,
    relativePath: string,
    parsed: { isRecursive: boolean; intermediatePattern: string | null; filePattern: string }
  ): boolean {
    if (!parsed.isRecursive) {
      // 非再帰パターン: ルート直下のみ
      return relativePath === fileName && this.matchesGlobPattern(fileName, parsed.filePattern);
    }

    if (parsed.intermediatePattern) {
      // 中間パターンがある場合は、findFilesInDirで処理されるため、ここでは false
      return false;
    }

    // "**/*.md" のような単純な再帰パターン
    return this.matchesGlobPattern(fileName, parsed.filePattern);
  }

  /**
   * ファイル名/ディレクトリ名がglobパターンに一致するか確認
   * サポートするパターン:
   * - "*.md" - ワイルドカード + 拡張子
   * - "*" - 全てにマッチ
   * - "SKILL.md" - 具体的なファイル名
   * - "test-*.md" - 前方一致 + ワイルドカード
   * - "*-test.md" - ワイルドカード + 後方一致
   */
  private matchesGlobPattern(name: string, pattern: string): boolean {
    if (pattern === '*') {
      return true;
    }

    let regex = this.regexCache.get(pattern);
    if (!regex) {
      const regexPattern = pattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.');
      regex = new RegExp(`^${regexPattern}$`);
      this.regexCache.set(pattern, regex);
    }
    return regex.test(name);
  }
}

export default CustomSearchLoader;
