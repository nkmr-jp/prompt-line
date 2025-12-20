import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { IpcMainInvokeEvent } from 'electron';
import SymbolSearchHandler from '../../src/handlers/symbol-search-handler';
import type SettingsManager from '../../src/managers/settings-manager';
import type { CodeSymbolSearchUserConfig, SymbolSearchResult } from '../../src/types';

// Mock logger
jest.mock('../../src/utils/utils', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

// Mock CodeSymbolSearcher
jest.mock('../../src/lib/code-symbol-searcher', () => ({
  CodeSymbolSearcher: jest.fn().mockImplementation(() => ({
    getSupportedLanguages: jest.fn(() => ['go', 'ts', 'js', 'py', 'rs']),
    parsePrefix: jest.fn((input: string) => {
      const match = input.match(/^@(\w+):(?:(\w+):)?(.*)$/);
      if (!match) return null;
      const [, language, symbolType, query] = match;
      return { language, symbolType, query };
    }),
    search: jest.fn(() => Promise.resolve([
      {
        file: 'src/handler.go',
        line: 10,
        column: 1,
        symbolName: 'Handler',
        symbolType: 'func',
        matchedLine: 'func Handler() {',
        language: 'go'
      }
    ] as SymbolSearchResult[])),
    updateConfig: jest.fn()
  }))
}));

// Mock ipcMain
const mockIpcMain = {
  handle: jest.fn(),
  removeAllListeners: jest.fn()
};

// Mock SettingsManager
const createMockSettingsManager = (config?: Partial<CodeSymbolSearchUserConfig>): jest.Mocked<SettingsManager> => ({
  getSettings: jest.fn(() => ({
    shortcuts: { main: 'Cmd+Shift+Space', paste: 'Cmd+Enter', close: 'Escape', historyNext: 'Ctrl+j', historyPrev: 'Ctrl+k', search: 'Cmd+f' },
    window: { position: 'active-text-field' as const, width: 600, height: 300 },
    codeSymbolSearch: config ? {
      enabled: config.enabled ?? true,
      maxResults: config.maxResults ?? 50,
      timeout: config.timeout ?? 5000
    } : undefined
  })),
  getCodeSymbolSearchSettings: jest.fn(() => config ? {
    enabled: config.enabled ?? true,
    maxResults: config.maxResults ?? 50,
    timeout: config.timeout ?? 5000
  } : undefined),
  isCodeSymbolSearchEnabled: jest.fn(() => config?.enabled ?? false),
  init: jest.fn(),
  loadSettings: jest.fn(),
  saveSettings: jest.fn(),
  updateSettings: jest.fn(),
  resetSettings: jest.fn(),
  getShortcuts: jest.fn(),
  updateShortcuts: jest.fn(),
  getWindowSettings: jest.fn(),
  updateWindowSettings: jest.fn(),
  getDefaultSettings: jest.fn(),
  getFileSearchSettings: jest.fn(),
  isFileSearchEnabled: jest.fn(),
  updateFileSearchSettings: jest.fn(),
  updateCodeSymbolSearchSettings: jest.fn(),
  getSettingsFilePath: jest.fn()
} as any);

// Mock event
const mockEvent: IpcMainInvokeEvent = {
  sender: {} as any,
  processId: 1,
  frameId: 1
} as IpcMainInvokeEvent;

describe('SymbolSearchHandler', () => {
  let handler: SymbolSearchHandler;
  let mockSettingsManager: jest.Mocked<SettingsManager>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSettingsManager = createMockSettingsManager({ enabled: true });
    handler = new SymbolSearchHandler(mockSettingsManager);
  });

  describe('setupHandlers', () => {
    test('IPC ハンドラーが登録されるか', () => {
      handler.setupHandlers(mockIpcMain as any);

      expect(mockIpcMain.handle).toHaveBeenCalledWith('search-symbols', expect.any(Function));
      expect(mockIpcMain.handle).toHaveBeenCalledWith('get-symbol-languages', expect.any(Function));
      expect(mockIpcMain.handle).toHaveBeenCalledWith('get-symbol-config', expect.any(Function));
      expect(mockIpcMain.handle).toHaveBeenCalledTimes(3);
    });
  });

  describe('removeHandlers', () => {
    test('IPC ハンドラーが削除されるか', () => {
      handler.removeHandlers(mockIpcMain as any);

      expect(mockIpcMain.removeAllListeners).toHaveBeenCalledWith('search-symbols');
      expect(mockIpcMain.removeAllListeners).toHaveBeenCalledWith('get-symbol-languages');
      expect(mockIpcMain.removeAllListeners).toHaveBeenCalledWith('get-symbol-config');
      expect(mockIpcMain.removeAllListeners).toHaveBeenCalledTimes(3);
    });
  });

  describe('handleSearchSymbols', () => {
    test('シンボル検索が正しく実行されるか', async () => {
      handler.setupHandlers(mockIpcMain as any);

      // Get the registered handler function
      const searchHandler = (mockIpcMain.handle as jest.Mock).mock.calls.find(
        (call: unknown[]) => call[0] === 'search-symbols'
      )?.[1] as (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<SymbolSearchResult[]>;
      expect(searchHandler).toBeDefined();

      // Execute the handler
      const result = await searchHandler(mockEvent, '/Users/test/project', 'go', 'Handler');

      expect(result).toEqual([
        {
          file: 'src/handler.go',
          line: 10,
          column: 1,
          symbolName: 'Handler',
          symbolType: 'func',
          matchedLine: 'func Handler() {',
          language: 'go'
        }
      ]);
    });

    test('無効なディレクトリで空配列を返すか', async () => {
      handler.setupHandlers(mockIpcMain as any);

      const searchHandler = (mockIpcMain.handle as jest.Mock).mock.calls.find(
        (call: unknown[]) => call[0] === 'search-symbols'
      )?.[1] as (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<SymbolSearchResult[]>;

      const result = await searchHandler(mockEvent, '', 'go', 'Handler');

      expect(result).toEqual([]);
    });

    test('無効な言語で空配列を返すか', async () => {
      handler.setupHandlers(mockIpcMain as any);

      const searchHandler = (mockIpcMain.handle as jest.Mock).mock.calls.find(
        (call: unknown[]) => call[0] === 'search-symbols'
      )?.[1] as (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<SymbolSearchResult[]>;

      const result = await searchHandler(mockEvent, '/Users/test/project', '', 'Handler');

      expect(result).toEqual([]);
    });

    test('機能が無効の場合に空配列を返すか', async () => {
      // Recreate with disabled feature
      mockSettingsManager = createMockSettingsManager({ enabled: false });
      handler = new SymbolSearchHandler(mockSettingsManager);
      handler.setupHandlers(mockIpcMain as any);

      const searchHandler = (mockIpcMain.handle as jest.Mock).mock.calls.find(
        (call: unknown[]) => call[0] === 'search-symbols'
      )?.[1] as (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<SymbolSearchResult[]>;

      const result = await searchHandler(mockEvent, '/Users/test/project', 'go', 'Handler');

      expect(result).toEqual([]);
    });
  });

  describe('handleGetSymbolLanguages', () => {
    test('サポート言語一覧を返すか', async () => {
      handler.setupHandlers(mockIpcMain as any);

      const languagesHandler = (mockIpcMain.handle as jest.Mock).mock.calls.find(
        (call: unknown[]) => call[0] === 'get-symbol-languages'
      )?.[1] as (event: IpcMainInvokeEvent) => string[];
      expect(languagesHandler).toBeDefined();

      const result = languagesHandler(mockEvent);

      expect(result).toEqual(['go', 'ts', 'js', 'py', 'rs']);
    });
  });

  describe('handleGetSymbolConfig', () => {
    test('設定を返すか', async () => {
      handler.setupHandlers(mockIpcMain as any);

      const configHandler = (mockIpcMain.handle as jest.Mock).mock.calls.find(
        (call: unknown[]) => call[0] === 'get-symbol-config'
      )?.[1] as (event: IpcMainInvokeEvent) => CodeSymbolSearchUserConfig;
      expect(configHandler).toBeDefined();

      const result = configHandler(mockEvent);

      expect(result).toEqual({
        enabled: true,
        maxResults: 50,
        timeout: 5000
      });
    });

    test('設定が undefined の場合デフォルト値を返すか', async () => {
      // Recreate with no config
      mockSettingsManager = createMockSettingsManager();
      handler = new SymbolSearchHandler(mockSettingsManager);
      handler.setupHandlers(mockIpcMain as any);

      const configHandler = (mockIpcMain.handle as jest.Mock).mock.calls.find(
        (call: unknown[]) => call[0] === 'get-symbol-config'
      )?.[1] as (event: IpcMainInvokeEvent) => CodeSymbolSearchUserConfig;

      const result = configHandler(mockEvent);

      expect(result).toEqual({
        enabled: false,
        maxResults: 50,
        timeout: 5000
      });
    });
  });

  describe('isEnabled', () => {
    test('有効な場合に true を返すか', () => {
      expect(handler.isEnabled()).toBe(true);
    });

    test('無効な場合に false を返すか', () => {
      mockSettingsManager = createMockSettingsManager({ enabled: false });
      handler = new SymbolSearchHandler(mockSettingsManager);

      expect(handler.isEnabled()).toBe(false);
    });

    test('設定が undefined の場合に false を返すか', () => {
      mockSettingsManager = createMockSettingsManager();
      handler = new SymbolSearchHandler(mockSettingsManager);

      expect(handler.isEnabled()).toBe(false);
    });
  });
});
