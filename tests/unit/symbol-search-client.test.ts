import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import type { SymbolSearchResult } from '../../src/types';

// Mock window.electronAPI with explicit types
const mockSearch = jest.fn<(
  directory: string,
  language: string,
  query: string,
  symbolType?: string
) => Promise<SymbolSearchResult[]>>();

const mockGetLanguages = jest.fn<() => Promise<string[]>>();

const mockGetConfig = jest.fn<() => Promise<{ enabled: boolean; maxResults: number; timeout: number }>>();

const mockElectronAPI = {
  symbolSearch: {
    search: mockSearch,
    getLanguages: mockGetLanguages,
    getConfig: mockGetConfig
  }
};

// Set up global window mock
(global as any).window = {
  electronAPI: mockElectronAPI
};

// Import after setting up mock
import { SymbolSearchClient } from '../../src/renderer/file-search/symbol-search-client';

describe('SymbolSearchClient', () => {
  let client: SymbolSearchClient;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new SymbolSearchClient();
  });

  describe('parsePrefix', () => {
    test('@go:Handler を正しくパースできるか', () => {
      const result = client.parsePrefix('@go:Handler');
      expect(result).toEqual({
        language: 'go',
        symbolType: undefined,
        query: 'Handler'
      });
    });

    test('@ts:class:User を正しくパースできるか', () => {
      const result = client.parsePrefix('@ts:class:User');
      expect(result).toEqual({
        language: 'ts',
        symbolType: 'class',
        query: 'User'
      });
    });

    test('@py: (空クエリ) を正しくパースできるか', () => {
      const result = client.parsePrefix('@py:');
      expect(result).toEqual({
        language: 'py',
        symbolType: undefined,
        query: ''
      });
    });

    test('通常の @ メンションは null を返すか', () => {
      const result = client.parsePrefix('@filename.ts');
      expect(result).toBeNull();
    });

    test('プレフィックスなしの文字列は null を返すか', () => {
      const result = client.parsePrefix('Handler');
      expect(result).toBeNull();
    });

    test('@ のみは null を返すか', () => {
      const result = client.parsePrefix('@');
      expect(result).toBeNull();
    });
  });

  describe('isSymbolSearchQuery', () => {
    test('@go: で始まる文字列を検出できるか', () => {
      expect(client.isSymbolSearchQuery('@go:')).toBe(true);
      expect(client.isSymbolSearchQuery('@go:Handler')).toBe(true);
    });

    test('@ts:class: で始まる文字列を検出できるか', () => {
      expect(client.isSymbolSearchQuery('@ts:class:')).toBe(true);
      expect(client.isSymbolSearchQuery('@ts:class:User')).toBe(true);
    });

    test('通常のファイル検索は false を返すか', () => {
      expect(client.isSymbolSearchQuery('@file.ts')).toBe(false);
      expect(client.isSymbolSearchQuery('@src/')).toBe(false);
    });

    test('空文字列は false を返すか', () => {
      expect(client.isSymbolSearchQuery('')).toBe(false);
    });
  });

  describe('search', () => {
    const searchResults: SymbolSearchResult[] = [
      {
        file: 'src/handler.go',
        line: 10,
        column: 1,
        symbolName: 'Handler',
        symbolType: 'func',
        matchedLine: 'func Handler() {',
        language: 'go'
      }
    ];

    test('シンボル検索を実行できるか', async () => {
      mockSearch.mockResolvedValue(searchResults);

      const result = await client.search('/project', 'go', 'Handler');

      expect(mockSearch).toHaveBeenCalledWith(
        '/project', 'go', 'Handler', undefined
      );
      expect(result).toEqual(searchResults);
    });

    test('シンボルタイプ指定で検索できるか', async () => {
      mockSearch.mockResolvedValue(searchResults);

      const result = await client.search('/project', 'go', 'Handler', 'func');

      expect(mockSearch).toHaveBeenCalledWith(
        '/project', 'go', 'Handler', 'func'
      );
      expect(result).toEqual(searchResults);
    });

    test('エラー時は空配列を返すか', async () => {
      mockSearch.mockRejectedValue(new Error('Search failed'));

      const result = await client.search('/project', 'go', 'Handler');

      expect(result).toEqual([]);
    });
  });

  describe('getLanguages', () => {
    test('サポート言語一覧を取得できるか', async () => {
      const languages = ['go', 'ts', 'js', 'py', 'rs'];
      mockGetLanguages.mockResolvedValue(languages);

      const result = await client.getLanguages();

      expect(result).toEqual(languages);
    });

    test('エラー時は空配列を返すか', async () => {
      mockGetLanguages.mockRejectedValue(new Error('Failed'));

      const result = await client.getLanguages();

      expect(result).toEqual([]);
    });
  });

  describe('getConfig', () => {
    test('設定を取得できるか', async () => {
      const config = { enabled: true, maxResults: 50, timeout: 5000 };
      mockGetConfig.mockResolvedValue(config);

      const result = await client.getConfig();

      expect(result).toEqual(config);
    });

    test('エラー時はデフォルト設定を返すか', async () => {
      mockGetConfig.mockRejectedValue(new Error('Failed'));

      const result = await client.getConfig();

      expect(result).toEqual({
        enabled: false,
        maxResults: 50,
        timeout: 5000
      });
    });
  });

  describe('isEnabled', () => {
    test('有効な場合 true を返すか', async () => {
      mockGetConfig.mockResolvedValue({
        enabled: true,
        maxResults: 50,
        timeout: 5000
      });

      const result = await client.isEnabled();

      expect(result).toBe(true);
    });

    test('無効な場合 false を返すか', async () => {
      mockGetConfig.mockResolvedValue({
        enabled: false,
        maxResults: 50,
        timeout: 5000
      });

      const result = await client.isEnabled();

      expect(result).toBe(false);
    });
  });

  describe('searchFromInput', () => {
    const searchResults: SymbolSearchResult[] = [
      {
        file: 'src/handler.go',
        line: 10,
        column: 1,
        symbolName: 'Handler',
        symbolType: 'func',
        matchedLine: 'func Handler() {',
        language: 'go'
      }
    ];

    test('入力文字列から検索を実行できるか', async () => {
      mockSearch.mockResolvedValue(searchResults);

      const result = await client.searchFromInput('/project', '@go:Handler');

      expect(mockSearch).toHaveBeenCalledWith(
        '/project', 'go', 'Handler', undefined
      );
      expect(result).toEqual(searchResults);
    });

    test('シンボルタイプ付き入力から検索できるか', async () => {
      mockSearch.mockResolvedValue(searchResults);

      const result = await client.searchFromInput('/project', '@go:func:Handle');

      expect(mockSearch).toHaveBeenCalledWith(
        '/project', 'go', 'Handle', 'func'
      );
      expect(result).toEqual(searchResults);
    });

    test('無効な入力は空配列を返すか', async () => {
      const result = await client.searchFromInput('/project', '@filename.ts');

      expect(mockSearch).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });
});
