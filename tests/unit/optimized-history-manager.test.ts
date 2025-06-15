import { promises as fs } from 'fs';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import OptimizedHistoryManager from '../../src/managers/optimized-history-manager';

// モックの設定
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    appendFile: jest.fn(),
    access: jest.fn(),
    stat: jest.fn(),
    open: jest.fn(),
    rename: jest.fn(),
    unlink: jest.fn()
  },
  createReadStream: jest.fn(),
  createWriteStream: jest.fn()
}));

jest.mock('readline', () => ({
  createInterface: jest.fn()
}));

jest.mock('../../src/config/app-config', () => ({
  paths: {
    historyFile: '/test/history.jsonl'
  }
}));

jest.mock('../../src/utils/utils', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  },
  generateId: jest.fn(() => `id-${Date.now()}`),
  debounce: jest.fn((fn) => {
    const debounced = (...args: any[]) => fn(...args);
    debounced.cancel = jest.fn();
    return debounced;
  }),
  safeJsonParse: jest.fn((text) => {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  })
}));

describe('OptimizedHistoryManager', () => {
  let manager: OptimizedHistoryManager;
  const mockFs = fs as jest.Mocked<typeof fs>;
  const mockCreateReadStream = createReadStream as jest.MockedFunction<typeof createReadStream>;
  const mockCreateInterface = createInterface as jest.MockedFunction<typeof createInterface>;

  beforeEach(() => {
    jest.clearAllMocks();
    manager = new OptimizedHistoryManager();
  });

  describe('initialize', () => {
    it('should initialize with empty file', async () => {
      mockFs.access.mockRejectedValue(new Error('File not found'));
      mockFs.writeFile.mockResolvedValue();
      mockFs.stat.mockResolvedValue({ size: 0 } as any);
      
      const mockStream: any = {
        on: jest.fn((event: string, callback: Function) => {
          if (event === 'close') callback();
          return mockStream;
        })
      };
      
      mockCreateReadStream.mockReturnValue(mockStream as any);
      mockCreateInterface.mockReturnValue({
        on: jest.fn((event, callback) => {
          if (event === 'close') callback();
        })
      } as any);

      await manager.initialize();

      expect(mockFs.writeFile).toHaveBeenCalledWith('/test/history.jsonl', '');
    });

    it('should load recent history on initialize', async () => {
      mockFs.access.mockResolvedValue();
      mockFs.stat.mockResolvedValue({ size: 1000 } as any);
      
      const mockFd = {
        read: jest.fn().mockImplementation((_buffer: Buffer) => {
          const testData = '{"text":"item1","timestamp":1000,"id":"id1"}\n{"text":"item2","timestamp":2000,"id":"id2"}\n';
          if (_buffer) _buffer.write(testData, 0);
          return Promise.resolve({ bytesRead: testData.length });
        }),
        stat: jest.fn().mockResolvedValue({ size: 1000 }),
        close: jest.fn().mockResolvedValue(undefined)
      };
      
      mockFs.open.mockResolvedValue(mockFd as any);
      
      const mockStream = { on: jest.fn() };
      mockCreateReadStream.mockReturnValue(mockStream as any);
      
      const mockRl: any = {
        on: jest.fn((event: string, callback: Function) => {
          if (event === 'line') {
            callback('{"text":"item2","timestamp":2000,"id":"id2"}');
            callback('{"text":"item1","timestamp":1000,"id":"id1"}');
          }
          if (event === 'close') callback();
          return mockRl;
        })
      };
      
      mockCreateInterface.mockReturnValue(mockRl as any);

      await manager.initialize();

      const history = manager.getHistory();
      expect(history).toHaveLength(2);
      expect(history[0]?.text).toBe('item2'); // 新しい順
      expect(history[1]?.text).toBe('item1');
    });
  });

  describe('addToHistory', () => {
    beforeEach(async () => {
      mockFs.access.mockResolvedValue();
      mockFs.stat.mockResolvedValue({ size: 0 } as any);
      mockFs.appendFile.mockResolvedValue();
      
      const mockFd = {
        read: jest.fn().mockImplementation((_buffer: Buffer) => {
          return Promise.resolve({ bytesRead: 0 });
        }),
        stat: jest.fn().mockResolvedValue({ size: 0 }),
        close: jest.fn().mockResolvedValue(undefined)
      };
      
      mockFs.open.mockResolvedValue(mockFd as any);
      
      const mockStream = { on: jest.fn() };
      mockCreateReadStream.mockReturnValue(mockStream as any);
      
      const mockRl: any = {
        on: jest.fn((event: string, callback: Function) => {
          if (event === 'close') callback();
          return mockRl;
        })
      };
      
      mockCreateInterface.mockReturnValue(mockRl as any);
      
      await manager.initialize();
    });

    it('should add new item to history', async () => {
      const item = await manager.addToHistory('Test text');

      expect(item).toBeTruthy();
      expect(item?.text).toBe('Test text');
      expect(item?.id).toMatch(/^id-/);
      
      const history = manager.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0]?.text).toBe('Test text');
    });

    it('should append to file', async () => {
      await manager.addToHistory('Test text');
      
      // debounceされているので、flushを呼ぶ
      await manager.flushPendingSaves();

      expect(mockFs.appendFile).toHaveBeenCalledWith(
        '/test/history.jsonl',
        expect.stringContaining('"text":"Test text"')
      );
    });

    it('should handle duplicates by updating timestamp', async () => {
      await manager.addToHistory('Duplicate text');
      const originalTimestamp = manager.getHistory()[0]?.timestamp;
      
      // 少し待機してタイムスタンプが変わるようにする
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await manager.addToHistory('Duplicate text');
      const history = manager.getHistory();
      
      expect(history).toHaveLength(1);
      expect(history[0]?.text).toBe('Duplicate text');
      expect(history[0]?.timestamp).toBeGreaterThan(originalTimestamp!);
    });

    it('should reject empty text', async () => {
      const result = await manager.addToHistory('   ');
      expect(result).toBeNull();
    });
  });

  describe('searchHistory', () => {
    beforeEach(async () => {
      mockFs.access.mockResolvedValue();
      mockFs.stat.mockResolvedValue({ size: 1000 } as any);
      
      const mockFd = {
        read: jest.fn().mockImplementation((_buffer) => {
          const testData = '{"text":"Hello world","timestamp":1000,"id":"id1"}\n{"text":"Hello JavaScript","timestamp":2000,"id":"id2"}\n{"text":"Goodbye world","timestamp":3000,"id":"id3"}\n';
          if (_buffer) _buffer.write(testData, 0);
          return Promise.resolve({ bytesRead: testData.length });
        }),
        stat: jest.fn().mockResolvedValue({ size: 1000 }),
        close: jest.fn().mockResolvedValue(undefined)
      };
      
      mockFs.open.mockResolvedValue(mockFd as any);
      
      const mockStream = { on: jest.fn() };
      mockCreateReadStream.mockReturnValue(mockStream as any);
      
      const mockRl: any = {
        on: jest.fn((event: string, callback: Function) => {
          if (event === 'line') {
            callback('{"text":"Hello world","timestamp":1000,"id":"id1"}');
            callback('{"text":"Hello JavaScript","timestamp":2000,"id":"id2"}');
            callback('{"text":"Goodbye world","timestamp":3000,"id":"id3"}');
          }
          if (event === 'close') callback();
          return mockRl;
        })
      };
      
      mockCreateInterface.mockReturnValue(mockRl as any);
      
      await manager.initialize();
    });

    it('should search in cache first', () => {
      const results = manager.searchHistory('Hello');
      
      expect(results).toHaveLength(2);
      expect(results[0]?.text).toBe('Hello JavaScript');
      expect(results[1]?.text).toBe('Hello world');
    });

    it('should return empty array for empty query', () => {
      const results = manager.searchHistory('');
      expect(results).toEqual([]);
    });

    it('should limit results', () => {
      const results = manager.searchHistory('world', 1);
      
      expect(results).toHaveLength(1);
      expect(results[0]?.text).toBe('Goodbye world');
    });

    it('should search case-insensitively', () => {
      const results = manager.searchHistory('HELLO');
      
      expect(results).toHaveLength(2);
    });
  });

  describe('removeHistoryItem', () => {
    beforeEach(async () => {
      mockFs.access.mockResolvedValue();
      mockFs.stat.mockResolvedValue({ size: 100 } as any);
      
      const mockFd = {
        read: jest.fn().mockImplementation((_buffer) => {
          const testData = '{"text":"Item to remove","timestamp":1000,"id":"remove-me"}\n';
          if (_buffer) _buffer.write(testData, 0);
          return Promise.resolve({ bytesRead: testData.length });
        }),
        stat: jest.fn().mockResolvedValue({ size: 100 }),
        close: jest.fn().mockResolvedValue(undefined)
      };
      
      mockFs.open.mockResolvedValue(mockFd as any);
      
      const mockRl: any = {
        on: jest.fn((event: string, callback: Function) => {
          if (event === 'line') {
            callback('{"text":"Item to remove","timestamp":1000,"id":"remove-me"}');
          }
          if (event === 'close') callback();
          return mockRl;
        })
      };
      
      mockCreateInterface.mockReturnValue(mockRl as any);
      
      await manager.initialize();
    });

    it('should remove item from cache', async () => {
      expect(manager.getHistory()).toHaveLength(1);
      
      const removed = await manager.removeHistoryItem('remove-me');
      
      expect(removed).toBe(true);
      expect(manager.getHistory()).toHaveLength(0);
    });

    it('should return false for non-existent item', async () => {
      const removed = await manager.removeHistoryItem('non-existent');
      expect(removed).toBe(false);
    });
  });

  describe('clearHistory', () => {
    it('should clear all history', async () => {
      mockFs.access.mockResolvedValue();
      mockFs.stat.mockResolvedValue({ size: 0 } as any);
      mockFs.writeFile.mockResolvedValue();
      
      const mockRl: any = {
        on: jest.fn((event: string, callback: Function) => {
          if (event === 'close') callback();
          return mockRl;
        })
      };
      
      mockCreateInterface.mockReturnValue(mockRl as any);
      
      await manager.initialize();
      await manager.addToHistory('Test item');
      
      await manager.clearHistory();
      
      expect(manager.getHistory()).toHaveLength(0);
      // ファイルは永続保護されるため、writeFileは呼ばれない
      expect(mockFs.writeFile).not.toHaveBeenCalledWith('/test/history.jsonl', '');
    });
  });

  describe('getHistoryStats', () => {
    beforeEach(async () => {
      mockFs.access.mockResolvedValue();
      mockFs.stat.mockResolvedValue({ size: 200 } as any);
      
      const mockFd = {
        read: jest.fn().mockImplementation((_buffer) => {
          const testData = '{"text":"Short","timestamp":1000,"id":"id1"}\n{"text":"Longer text here","timestamp":2000,"id":"id2"}\n';
          if (_buffer) _buffer.write(testData, 0);
          return Promise.resolve({ bytesRead: testData.length });
        }),
        stat: jest.fn().mockResolvedValue({ size: 200 }),
        close: jest.fn().mockResolvedValue(undefined)
      };
      
      mockFs.open.mockResolvedValue(mockFd as any);
      
      const mockStream = { on: jest.fn() };
      mockCreateReadStream.mockReturnValue(mockStream as any);
      
      const mockRl: any = {
        on: jest.fn((event: string, callback: Function) => {
          if (event === 'line') {
            callback('{"text":"Short","timestamp":1000,"id":"id1"}');
            callback('{"text":"Longer text here","timestamp":2000,"id":"id2"}');
          }
          if (event === 'close') callback();
          return mockRl;
        })
      };
      
      mockCreateInterface.mockReturnValue(mockRl as any);
      
      await manager.initialize();
    });

    it('should return correct stats', () => {
      const stats = manager.getHistoryStats();
      
      // totalItemCountがキャッシュされていない場合はキャッシュサイズを返す
      expect(stats.totalItems).toBe(2); // キャッシュにある2つ
      expect(stats.totalCharacters).toBe(21); // "Short" + "Longer text here"
      expect(stats.averageLength).toBe(11); // 21 / 2 = 10.5 → 11
      expect(stats.oldestTimestamp).toBe(1000);
      expect(stats.newestTimestamp).toBe(2000);
    });
  });

  describe('performance', () => {
    it('should handle large history files efficiently', async () => {
      mockFs.access.mockResolvedValue();
      mockFs.stat.mockResolvedValue({ size: 1000000 } as any); // 1MB
      
      // 最後の100行だけ読み込むことをシミュレート
      const mockFd = {
        read: jest.fn().mockImplementation((_buffer: Buffer) => {
          // 最後の部分だけ読み込む
          const lastLines = Array(100).fill(0).map((_, i) => 
            `{"text":"Item ${i}","timestamp":${1000 + i},"id":"id${i}"}`
          ).join('\n') + '\n';
          
          _buffer.write(lastLines, 0);
          return Promise.resolve({ bytesRead: lastLines.length });
        }),
        close: jest.fn().mockResolvedValue(undefined)
      };
      
      mockFs.open.mockResolvedValue(mockFd as any);
      
      const mockRl: any = {
        on: jest.fn((event: string, callback: Function) => {
          if (event === 'line') {
            // 全体のカウントのみ
            for (let i = 0; i < 10000; i++) {
              // カウントのみ
            }
          }
          if (event === 'close') callback();
          return mockRl;
        })
      };
      
      mockCreateInterface.mockReturnValue(mockRl as any);
      
      const startTime = Date.now();
      await manager.initialize();
      const endTime = Date.now();
      
      // 初期化は高速であるべき（1秒以内）
      expect(endTime - startTime).toBeLessThan(1000);
      
      // キャッシュには最新の100件のみ
      expect(manager.getHistory().length).toBeLessThanOrEqual(100);
    });
  });
});