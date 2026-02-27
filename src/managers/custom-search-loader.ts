import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { logger } from '../utils/utils';
import type { CustomSearchEntry, CustomSearchItem, CustomSearchType, UserSettings, ColorValue } from '../types';
import { resolveTemplate, getBasename, getDirname, parseFrontmatter, extractRawFrontmatter, parseFirstHeading, parseJsonContent } from '../lib/template-resolver';
import { evaluateJq } from '../lib/jq-resolver';
import { getDefaultCustomSearchConfig, DEFAULT_MAX_SUGGESTIONS, DEFAULT_ORDER_BY } from '../lib/default-custom-search-config';
import { CACHE_TTL } from '../constants';
import { resolvePrefix } from '../lib/prefix-resolver';
import { isCommandEnabled } from '../lib/command-name-matcher';

/**
 * CustomSearchLoader - 設定ベースの統合Markdownファイルローダー
 *
 * AgentSkillLoaderとAgentLoaderを統合し、より柔軟な設定が可能
 */
class CustomSearchLoader {
  private config: CustomSearchEntry[];
  private cache: Map<string, { items: CustomSearchItem[]; timestamp: number }> = new Map();
  private cacheTTL: number = CACHE_TTL.MD_SEARCH;
  private settings: UserSettings | undefined;

  constructor(
    config?: CustomSearchEntry[],
    settings?: UserSettings
  ) {
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
    this.cache.clear();
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

    if (type === 'mention' && this.settings?.mentions) {
      const { enable, disable } = this.settings.mentions;
      items = items.filter(item =>
        isCommandEnabled(item.name, enable, disable)
      );
    }

    const orderBy = this.getOrderBy(type);
    return this.sortItems(items, orderBy);
  }

  /**
   * 指定タイプのアイテムを検索
   * searchPrefixが設定されているエントリは、クエリがそのプレフィックスで始まる場合のみ検索対象
   */
  async searchItems(type: CustomSearchType, query: string): Promise<CustomSearchItem[]> {
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
      // queryがsearchPrefix:で始まるかチェック（: は自動で追加）
      const prefixWithColon = entry.searchPrefix + ':';
      return query.startsWith(prefixWithColon);
    });

    // クエリに基づいてソート順を決定
    const orderBy = this.getOrderByForQuery(type, query);

    if (!query) {
      return this.sortItems(items, orderBy);
    }

    // 各アイテムの実際の検索クエリを計算（searchPrefix:を除去）
    const filteredItems = items.filter(item => {
      const entry = this.findEntryForItem(item);
      const prefixWithColon = entry?.searchPrefix ? entry.searchPrefix + ':' : '';
      const actualQuery = query.startsWith(prefixWithColon) ? query.slice(prefixWithColon.length) : query;

      // プレフィックスのみの場合は全て表示
      if (!actualQuery) {
        return true;
      }

      const lowerActualQuery = actualQuery.toLowerCase();
      return item.name.toLowerCase().includes(lowerActualQuery) ||
             item.description.toLowerCase().includes(lowerActualQuery);
    });

    return this.sortItems(filteredItems, orderBy);
  }

  /**
   * アイテムに対応する設定エントリを検索
   */
  private findEntryForItem(item: CustomSearchItem): CustomSearchEntry | undefined {
    return this.config.find(entry =>
      entry.type === item.type &&
      `${entry.path}:${entry.pattern}` === item.sourceId
    );
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
    return [...items].sort((a, b) => {
      // updatedAt: 数値比較（未設定は0扱い）
      if (field === 'updatedAt') {
        const aTime = a.updatedAt ?? 0;
        const bTime = b.updatedAt ?? 0;
        const comparison = aTime - bTime;
        return direction === 'desc' ? -comparison : comparison;
      }

      let aValue: string;
      let bValue: string;
      if (field === 'name') {
        aValue = a.name;
        bValue = b.name;
      } else if (field === 'description') {
        aValue = a.description;
        bValue = b.description;
      } else {
        // カスタムフィールド: sortKeyを使用（未設定の場合はnameにフォールバック）
        aValue = a.sortKey ?? a.name;
        bValue = b.sortKey ?? b.name;
      }
      const comparison = aValue.localeCompare(bValue);
      return direction === 'desc' ? -comparison : comparison;
    });
  }

  /**
   * 全設定エントリからアイテムをロード
   */
  private async loadAll(): Promise<CustomSearchItem[]> {
    const cacheKey = 'all';
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.items;
    }

    const allItems = await this.loadAllEntries();
    allItems.sort((a, b) => a.name.localeCompare(b.name));

    this.cache.set(cacheKey, { items: allItems, timestamp: Date.now() });
    this.logLoadedItems(allItems);

    return allItems;
  }

  /**
   * Load all entries with deduplication
   */
  private async loadAllEntries(): Promise<CustomSearchItem[]> {
    const allItems: CustomSearchItem[] = [];
    const seenNames = new Map<string, Set<string>>();

    for (const entry of this.config) {
      try {
        const items = await this.loadEntry(entry);
        const sourceId = `${entry.path}:${entry.pattern}`;
        this.addItemsWithDeduplication(items, sourceId, seenNames, allItems);
      } catch (error) {
        logger.error('Failed to load entry', { entry, error });
      }
    }

    return allItems;
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
      // Use name+label as key to allow same name with different labels
      const key = item.label ? `${item.name}:${item.label}` : item.name;
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
  private async loadEntry(entry: CustomSearchEntry): Promise<CustomSearchItem[]> {
    const expandedPath = entry.path.replace(/^~/, os.homedir());

    const isValid = await this.validateDirectory(expandedPath);
    if (!isValid) {
      return [];
    }

    // Parse jq expression from pattern: '**/config.json@.members' → filePattern + jqExpression
    const { filePattern, jqExpression } = this.parseJqPath(entry.pattern);
    const files = await this.findFiles(expandedPath, filePattern);
    const sourceId = `${entry.path}:${entry.pattern}`;
    logger.debug('CustomSearch loadEntry', {
      path: entry.path,
      pattern: entry.pattern,
      filePattern,
      jqExpression,
      filesFound: files.length
    });
    const items = await this.parseFilesToItems(files, entry, sourceId, jqExpression);
    return items;
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

    for (const filePath of files) {
      if (jqExpression && filePath.endsWith('.json')) {
        const arrayItems = await this.parseJsonArrayToItems(filePath, entry, sourceId, jqExpression);
        items.push(...arrayItems);
      } else if (filePath.endsWith('.jsonl')) {
        const jsonlItems = await this.parseJsonlToItems(filePath, entry, sourceId, jqExpression);
        items.push(...jsonlItems);
      } else {
        const item = await this.parseFileToItem(filePath, entry, sourceId);
        if (item) {
          items.push(item);
        }
      }
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
      const isPlainText = !isJsonFile && this.isPlainTextFile(filePath);
      const frontmatter = (isJsonFile || isPlainText) ? {} : parseFrontmatter(content);
      const rawFrontmatter = (isJsonFile || isPlainText) ? '' : extractRawFrontmatter(content);
      const basename = getBasename(filePath);

      // Expand path for prefix resolution
      const expandedPath = entry.path.replace(/^~/, os.homedir());

      // プレフィックス解決
      let prefix = '';
      if (entry.prefixPattern) {
        prefix = await resolvePrefix(filePath, entry.prefixPattern, expandedPath);
      }

      const dirname = getDirname(filePath);
      const heading = isJsonFile ? '' : isPlainText ? this.parseFirstLine(content) : parseFirstHeading(content);
      const jsonData = isJsonFile ? parseJsonContent(content) : undefined;
      const context = { basename, frontmatter, prefix, dirname, filePath, heading, ...(jsonData && { jsonData }) };

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
      if (entry.argumentHint) {
        const resolvedHint = resolveTemplate(entry.argumentHint, context);
        if (resolvedHint) item.argumentHint = resolvedHint;
      }
      if (entry.inputFormat) item.inputFormat = entry.inputFormat;
      item.updatedAt = fileStat.mtimeMs;

      const displayTime = this.resolveDisplayTime(entry, context, fileStat.mtimeMs);
      if (displayTime !== undefined) item.displayTime = displayTime;

      return item;
    } catch (error) {
      logger.warn('Failed to parse file', { filePath, error });
      return null;
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

      // Evaluate jq expression
      const result = await evaluateJq(jsonData, jqExpression);
      logger.debug('parseJsonArrayToItems jq result', {
        filePath,
        jqExpression,
        resultType: typeof result,
        isArray: Array.isArray(result),
        length: Array.isArray(result) ? result.length : 'N/A'
      });
      if (!Array.isArray(result)) return [];
      const arrayData: unknown[] = result;

      const basename = getBasename(filePath);
      const dirname = getDirname(filePath);
      const items: CustomSearchItem[] = [];

      for (const element of arrayData) {
        if (element === null || typeof element !== 'object' || Array.isArray(element)) continue;

        const elementData = element as Record<string, unknown>;
        const parentJsonDataStack = [jsonData];
        const context = { basename, frontmatter: {}, prefix: '', dirname, filePath, heading: '', jsonData: elementData, parentJsonDataStack };

        const item: CustomSearchItem = {
          name: resolveTemplate(entry.name, context),
          description: resolveTemplate(entry.description, context),
          type: entry.type,
          filePath,
          sourceId,
        };

        const sortKey = this.resolveSortKey(entry, context);
        if (sortKey) item.sortKey = sortKey;

        if (entry.label) {
          const resolvedLabel = resolveTemplate(entry.label, context);
          if (resolvedLabel) item.label = resolvedLabel;
        }
        if (entry.color) {
          logger.debug('parseJsonArrayToItems entry.color', { entryColor: entry.color, itemName: item.name });
          const resolvedColor = this.resolveColorWithFallback(entry.color, context);
          if (resolvedColor) item.color = resolvedColor as ColorValue;
        }
        if (entry.icon) {
          const resolvedIcon = resolveTemplate(entry.icon, context);
          if (resolvedIcon) item.icon = resolvedIcon.startsWith('codicon-') ? resolvedIcon : `codicon-${resolvedIcon}`;
        }
        if (entry.argumentHint) {
          const resolvedHint = resolveTemplate(entry.argumentHint, context);
          if (resolvedHint) item.argumentHint = resolvedHint;
        }
        if (entry.inputFormat) item.inputFormat = entry.inputFormat;

        const displayTime = this.resolveDisplayTime(entry, context);
        if (displayTime !== undefined) item.displayTime = displayTime;

        if (item.name) {
          items.push(item);
        }
      }

      return items;
    } catch (error) {
      logger.warn('Failed to parse JSON array file', { filePath, error });
      return [];
    }
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

  /**
   * Parse JSONL file to generate multiple CustomSearchItems (one per line)
   * jqExpression がある場合、各行のJSONに対してjq式を適用する
   */
  private async parseJsonlToItems(
    filePath: string,
    entry: CustomSearchEntry,
    sourceId: string,
    jqExpression: string | null = null
  ): Promise<CustomSearchItem[]> {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const lines = content.split('\n');
      const basename = getBasename(filePath);
      const dirname = getDirname(filePath);
      const items: CustomSearchItem[] = [];

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        let parsed: unknown;
        try {
          parsed = JSON.parse(trimmed);
          if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) continue;
        } catch {
          continue;  // skip invalid JSON lines
        }

        // jq式が指定されている場合、各行に適用
        if (jqExpression) {
          const jqResult = await evaluateJq(parsed, jqExpression);
          if (jqResult === null || jqResult === undefined) continue;

          // 結果が配列なら展開して複数アイテムに
          const elements = Array.isArray(jqResult) ? jqResult : [jqResult];
          const lineData = parsed as Record<string, unknown>;
          for (const element of elements) {
            if (element === null || typeof element !== 'object' || Array.isArray(element)) continue;
            const elementData = element as Record<string, unknown>;
            const item = this.createItemFromJsonData(elementData, basename, dirname, filePath, entry, sourceId, [lineData]);
            if (item) items.push(item);
          }
        } else {
          const elementData = parsed as Record<string, unknown>;
          const item = this.createItemFromJsonData(elementData, basename, dirname, filePath, entry, sourceId);
          if (item) items.push(item);
        }
      }
      return items;
    } catch (error) {
      logger.warn('Failed to parse JSONL file', { filePath, error });
      return [];
    }
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
    parentJsonDataStack?: Record<string, unknown>[]
  ): CustomSearchItem | null {
    const context = { basename, frontmatter: {}, prefix: '', dirname, filePath, heading: '', jsonData: elementData, ...(parentJsonDataStack && { parentJsonDataStack }) };
    const item: CustomSearchItem = {
      name: resolveTemplate(entry.name, context),
      description: resolveTemplate(entry.description, context),
      type: entry.type,
      filePath,
      sourceId,
    };

    const sortKey = this.resolveSortKey(entry, context);
    if (sortKey) item.sortKey = sortKey;

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
    if (entry.argumentHint) {
      const resolvedHint = resolveTemplate(entry.argumentHint, context);
      if (resolvedHint) item.argumentHint = resolvedHint;
    }
    if (entry.inputFormat) item.inputFormat = entry.inputFormat;

    const displayTime = this.resolveDisplayTime(entry, context);
    if (displayTime !== undefined) item.displayTime = displayTime;

    return item.name ? item : null;
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
  private async findFiles(directory: string, pattern: string): Promise<string[]> {
    // ブレース展開を処理（例: {commands,agents} → ['commands', 'agents']）
    const expandedPatterns = this.expandBraces(pattern);

    const allFiles: string[] = [];
    for (const expandedPattern of expandedPatterns) {
      const files = await this.findFilesWithPattern(directory, expandedPattern, '');
      allFiles.push(...files);
    }

    // 重複を除去
    return [...new Set(allFiles)];
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
    relativePath: string
  ): Promise<string[]> {
    const files: string[] = [];
    const parsed = this.parsePattern(pattern);

    try {
      const entries = await fs.readdir(directory, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(directory, entry.name);
        const entryRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

        if (entry.isDirectory()) {
          const dirFiles = await this.processDirectoryEntry(fullPath, entryRelativePath, pattern, parsed);
          files.push(...dirFiles);
        } else if (entry.isFile() && this.matchesFilePattern(entry.name, entryRelativePath, parsed)) {
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
    parsed: ReturnType<typeof this.parsePattern>
  ): Promise<string[]> {
    if (!parsed.isRecursive) return [];

    const files: string[] = [];

    // Check intermediate pattern match
    if (parsed.intermediatePattern && this.matchesIntermediatePathSuffix(entryRelativePath, parsed.intermediatePattern)) {
      const subFiles = await this.findFilesInDir(fullPath, parsed.filePattern);
      files.push(...subFiles);
    }

    // Always recurse into subdirectories
    const subFiles = await this.findFilesWithPattern(fullPath, pattern, entryRelativePath);
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
        if (entry.isFile() && this.matchesGlobPattern(entry.name, filePattern)) {
          files.push(path.join(directory, entry.name));
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
    // "*" は全てにマッチ
    if (pattern === '*') {
      return true;
    }

    // パターンを正規表現に変換
    const regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&') // 特殊文字をエスケープ
      .replace(/\*/g, '.*')  // * を .* に変換
      .replace(/\?/g, '.');   // ? を . に変換

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(name);
  }
}

export default CustomSearchLoader;
