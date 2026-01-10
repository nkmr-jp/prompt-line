import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { logger } from '../utils/utils';
import type { MdSearchEntry, MdSearchItem, MdSearchType, UserSettings } from '../types';
import { resolveTemplate, getBasename, parseFrontmatter, extractRawFrontmatter } from '../lib/template-resolver';
import { getDefaultMdSearchConfig, DEFAULT_MAX_SUGGESTIONS, DEFAULT_SORT_ORDER } from '../lib/default-md-search-config';
import { CACHE_TTL } from '../constants';
import { resolvePrefix } from '../lib/prefix-resolver';
import { isCommandEnabled } from '../lib/command-name-matcher';

/**
 * MdSearchLoader - 設定ベースの統合Markdownファイルローダー
 *
 * SlashCommandLoaderとAgentLoaderを統合し、より柔軟な設定が可能
 */
class MdSearchLoader {
  private config: MdSearchEntry[];
  private cache: Map<string, { items: MdSearchItem[]; timestamp: number }> = new Map();
  private cacheTTL: number = CACHE_TTL.MD_SEARCH;
  private settings: UserSettings | undefined;

  constructor(
    config?: MdSearchEntry[],
    settings?: UserSettings
  ) {
    // Use default config if config is undefined or empty array
    this.config = (config && config.length > 0) ? config : getDefaultMdSearchConfig();
    this.settings = settings;
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
  async getItems(type: MdSearchType): Promise<MdSearchItem[]> {
    const allItems = await this.loadAll();
    let items = allItems.filter(item => item.type === type);

    // command タイプのみ enable/disable フィルタを適用
    if (type === 'command' && this.settings?.slashCommands) {
      const { enable, disable } = this.settings.slashCommands;
      items = items.filter(item =>
        isCommandEnabled(item.name, enable, disable)
      );
    }

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
      // queryがsearchPrefix:で始まるかチェック（: は自動で追加）
      const prefixWithColon = entry.searchPrefix + ':';
      return query.startsWith(prefixWithColon);
    });

    // クエリに基づいてソート順を決定
    const sortOrder = this.getSortOrderForQuery(type, query);

    if (!query) {
      return this.sortItems(items, sortOrder);
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
   * 指定タイプのsearchPrefixリストを取得（: 付き）
   */
  getSearchPrefixes(type: MdSearchType): string[] {
    const entries = this.config.filter(entry => entry.type === type && entry.searchPrefix);
    return entries.map(entry => entry.searchPrefix! + ':');
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

    // クエリがsearchPrefix:で始まるエントリを探す（: は自動で追加）
    const matchingEntry = entries.find(entry =>
      entry.searchPrefix && query.startsWith(entry.searchPrefix + ':')
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
  private async loadAllEntries(): Promise<MdSearchItem[]> {
    const allItems: MdSearchItem[] = [];
    const seenNames = new Map<MdSearchType, Set<string>>();

    for (const entry of this.config) {
      try {
        const items = await this.loadEntry(entry);
        this.addItemsWithDeduplication(items, entry.type, seenNames, allItems);
      } catch (error) {
        logger.error('Failed to load entry', { entry, error });
      }
    }

    return allItems;
  }

  /**
   * Add items with deduplication check
   */
  private addItemsWithDeduplication(
    items: MdSearchItem[],
    type: MdSearchType,
    seenNames: Map<MdSearchType, Set<string>>,
    allItems: MdSearchItem[]
  ): void {
    if (!seenNames.has(type)) {
      seenNames.set(type, new Set());
    }
    const typeSeenNames = seenNames.get(type)!;

    for (const item of items) {
      if (!typeSeenNames.has(item.name)) {
        typeSeenNames.add(item.name);
        allItems.push(item);
      }
    }
  }

  /**
   * Log loaded items statistics
   */
  private logLoadedItems(allItems: MdSearchItem[]): void {
    logger.info('MdSearch items loaded', {
      total: allItems.length,
      commands: allItems.filter(i => i.type === 'command').length,
      mentions: allItems.filter(i => i.type === 'mention').length
    });
  }

  /**
   * 単一エントリをロード
   */
  private async loadEntry(entry: MdSearchEntry): Promise<MdSearchItem[]> {
    const expandedPath = entry.path.replace(/^~/, os.homedir());

    const isValid = await this.validateDirectory(expandedPath);
    if (!isValid) {
      return [];
    }

    const files = await this.findFiles(expandedPath, entry.pattern);
    const sourceId = `${entry.path}:${entry.pattern}`;
    const items = await this.parseFilesToItems(files, entry, sourceId);
    return items;
  }

  /**
   * Validate directory exists
   */
  private async validateDirectory(path: string): Promise<boolean> {
    try {
      const stats = await fs.stat(path);
      if (!stats.isDirectory()) {
        logger.warn('MdSearch path is not a directory', { path });
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
   * Parse files to MdSearchItems
   */
  private async parseFilesToItems(
    files: string[],
    entry: MdSearchEntry,
    sourceId: string
  ): Promise<MdSearchItem[]> {
    const items: MdSearchItem[] = [];

    for (const filePath of files) {
      const item = await this.parseFileToItem(filePath, entry, sourceId);
      if (item) {
        items.push(item);
      }
    }

    return items;
  }

  /**
   * Parse single file to MdSearchItem
   */
  private async parseFileToItem(
    filePath: string,
    entry: MdSearchEntry,
    sourceId: string
  ): Promise<MdSearchItem | null> {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const frontmatter = parseFrontmatter(content);
      const rawFrontmatter = extractRawFrontmatter(content);
      const basename = getBasename(filePath);

      // Expand path for prefix resolution
      const expandedPath = entry.path.replace(/^~/, os.homedir());

      // プレフィックス解決
      let prefix = '';
      if (entry.prefixPattern) {
        prefix = await resolvePrefix(filePath, entry.prefixPattern, expandedPath);
      }

      const context = { basename, frontmatter, prefix };

      const item: MdSearchItem = {
        name: resolveTemplate(entry.name, context),
        description: resolveTemplate(entry.description, context),
        type: entry.type,
        filePath,
        sourceId,
      };

      if (rawFrontmatter) item.frontmatter = rawFrontmatter;
      if (entry.label) {
        const resolvedLabel = resolveTemplate(entry.label, context);
        if (resolvedLabel) item.label = resolvedLabel;
      }
      if (entry.color) item.color = entry.color;
      if (entry.argumentHint) {
        const resolvedHint = resolveTemplate(entry.argumentHint, context);
        if (resolvedHint) item.argumentHint = resolvedHint;
      }
      if (entry.inputFormat) item.inputFormat = entry.inputFormat;

      return item;
    } catch (error) {
      logger.warn('Failed to parse file', { filePath, error });
      return null;
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

export default MdSearchLoader;
