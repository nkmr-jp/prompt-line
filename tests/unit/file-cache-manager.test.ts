import type { Mock } from 'vitest';
import type { FileInfo } from '../../src/types';

// Mock the config module FIRST (must be before imports that use it)
vi.mock('../../src/config/app-config', () => {
  const mockUserDataDir = '/test/.prompt-line';
  return {
    default: {
      paths: {
        userDataDir: mockUserDataDir,
        cacheDir: `${mockUserDataDir}/cache`,
        projectsCacheDir: `${mockUserDataDir}/cache/projects`
      }
    }
  };
});

// Mock fs promises module
vi.mock('fs', () => ({
  promises: {
    mkdir: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    access: vi.fn(),
    readdir: vi.fn(),
    stat: vi.fn(),
    rm: vi.fn()
  },
  createReadStream: vi.fn(),
  createWriteStream: vi.fn()
}));

// Mock the utils module
vi.mock('../../src/utils/utils', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

// Mock readline module
vi.mock('readline', () => ({
  createInterface: vi.fn()
}));

// Import after mocks
import FileCacheManager from '../../src/managers/file-cache-manager';
import { promises as fs } from 'fs';

const mockedFs = vi.mocked(fs);

describe('FileCacheManager', () => {
  let cacheManager: FileCacheManager;

  beforeEach(() => {
    cacheManager = new FileCacheManager();
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    test('should create cache directory on initialize', async () => {
      mockedFs.mkdir.mockResolvedValue(undefined as any);

      await cacheManager.initialize();

      expect(mockedFs.mkdir).toHaveBeenCalledWith(
        '/test/.prompt-line/cache/projects',
        { recursive: true, mode: 0o700 }
      );
    });

    test('should handle initialization errors', async () => {
      mockedFs.mkdir.mockRejectedValue(new Error('Permission denied'));

      await expect(cacheManager.initialize()).rejects.toThrow('Permission denied');
    });
  });

  describe('encodeDirectoryPath', () => {
    test('should encode directory path by replacing / with -', () => {
      const input = '/Users/nkmr/ghq/github.com/nkmr-jp/prompt-line';
      const expected = '-Users-nkmr-ghq-github.com-nkmr-jp-prompt-line';

      const result = cacheManager.encodeDirectoryPath(input);

      expect(result).toBe(expected);
    });

    test('should handle root directory', () => {
      const input = '/';
      const expected = '-';

      const result = cacheManager.encodeDirectoryPath(input);

      expect(result).toBe(expected);
    });

    test('should handle relative paths', () => {
      const input = 'relative/path';
      const expected = 'relative-path';

      const result = cacheManager.encodeDirectoryPath(input);

      expect(result).toBe(expected);
    });
  });

  describe('getCachePath', () => {
    test('should return correct cache path', () => {
      const directory = '/Users/nkmr/project';
      const expected = '/test/.prompt-line/cache/projects/-Users-nkmr-project';

      const result = cacheManager.getCachePath(directory);

      expect(result).toBe(expected);
    });
  });

  describe('loadCache', () => {
    test('should return null if cache does not exist', async () => {
      mockedFs.access.mockRejectedValue(new Error('ENOENT'));

      const result = await cacheManager.loadCache('/test/dir');

      expect(result).toBeNull();
    });

    test('should return null if metadata is invalid', async () => {
      mockedFs.access.mockResolvedValue(undefined as any);
      mockedFs.readFile.mockRejectedValue(new Error('Invalid JSON'));

      const result = await cacheManager.loadCache('/test/dir');

      expect(result).toBeNull();
    });

    test('should load valid cache with files', async () => {
      const directory = '/test/dir';
      const metadata = {
        version: '1.0',
        directory,
        createdAt: '2025-12-01T00:00:00.000Z',
        updatedAt: '2025-12-01T00:00:00.000Z',
        fileCount: 2,
        searchMode: 'recursive' as const,
        usedFd: true,
        gitignoreRespected: true,
        ttlSeconds: 3600
      };

      mockedFs.access.mockResolvedValue(undefined as any);
      mockedFs.readFile.mockResolvedValue(JSON.stringify(metadata) as any);

      // Mock readline for JSONL reading
      const mockRl = {
        on: vi.fn((event: string, handler: Function) => {
          if (event === 'line') {
            handler('{"path":"file1.ts","name":"file1.ts","type":"file","size":100,"mtime":1700000000000}');
            handler('{"path":"file2.ts","name":"file2.ts","type":"file","size":200,"mtime":1700000001000}');
          } else if (event === 'close') {
            handler();
          }
          return mockRl;
        })
      };

      const { createInterface } = await import('readline');
      (createInterface as Mock).mockReturnValue(mockRl);

      const result = await cacheManager.loadCache(directory);

      expect(result).not.toBeNull();
      expect(result?.directory).toBe(directory);
      expect(result?.files).toHaveLength(2);
      expect(result?.metadata.fileCount).toBe(2);
    });
  });

  describe('saveCache', () => {
    test('should save cache with files and metadata', async () => {
      const directory = '/test/dir';
      const files: FileInfo[] = [
        {
          path: 'file1.ts',
          name: 'file1.ts',
          isDirectory: false,
          size: 100,
          modifiedAt: '2025-12-01T00:00:00.000Z'
        },
        {
          path: 'file2.ts',
          name: 'file2.ts',
          isDirectory: false,
          size: 200,
          modifiedAt: '2025-12-01T00:01:00.000Z'
        }
      ];

      mockedFs.mkdir.mockResolvedValue(undefined as any);
      mockedFs.writeFile.mockResolvedValue(undefined as any);

      // Mock createWriteStream
      const mockWriteStream = {
        write: vi.fn(),
        end: vi.fn(),
        on: vi.fn((event: string, handler: Function) => {
          if (event === 'finish') {
            handler();
          }
          return mockWriteStream;
        })
      };
      const { createWriteStream } = await import('fs');
      (createWriteStream as Mock).mockReturnValue(mockWriteStream);

      await cacheManager.saveCache(directory, files, {
        searchMode: 'recursive',
        gitignoreRespected: true
      });

      expect(mockedFs.mkdir).toHaveBeenCalled();
      expect(mockedFs.writeFile).toHaveBeenCalled();
      expect(mockWriteStream.write).toHaveBeenCalledTimes(2);
      expect(mockWriteStream.end).toHaveBeenCalled();
    });

    test('should not throw on save error', async () => {
      mockedFs.mkdir.mockRejectedValue(new Error('Permission denied'));

      await expect(
        cacheManager.saveCache('/test/dir', [])
      ).resolves.not.toThrow();
    });
  });

  describe('isCacheValid', () => {
    test('should return true for fresh cache with files', () => {
      const metadata = {
        version: '1.0',
        directory: '/test',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        fileCount: 100,  // Must have files to be valid
        ttlSeconds: 3600
      };

      const result = cacheManager.isCacheValid(metadata);

      expect(result).toBe(true);
    });

    test('should return false for expired cache', () => {
      const oldDate = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
      const metadata = {
        version: '1.0',
        directory: '/test',
        createdAt: oldDate.toISOString(),
        updatedAt: oldDate.toISOString(),
        fileCount: 100,
        ttlSeconds: 3600 // 1 hour
      };

      const result = cacheManager.isCacheValid(metadata);

      expect(result).toBe(false);
    });

    test('should return false for cache with fileCount 0 (indicates failed indexing)', () => {
      const metadata = {
        version: '1.0',
        directory: '/test',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        fileCount: 0,  // Zero files indicates failed indexing, should re-index
        ttlSeconds: 3600
      };

      const result = cacheManager.isCacheValid(metadata);

      expect(result).toBe(false);
    });

    test('should use custom TTL if provided', () => {
      const oldDate = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
      const metadata = {
        version: '1.0',
        directory: '/test',
        createdAt: oldDate.toISOString(),
        updatedAt: oldDate.toISOString(),
        fileCount: 100,  // Must have files to be valid
        ttlSeconds: 3600 // 1 hour (should be overridden)
      };

      // Use custom TTL of 3 hours
      const result = cacheManager.isCacheValid(metadata, 10800);

      expect(result).toBe(true);
    });
  });

  describe('updateCacheTimestamp', () => {
    test('should update only the timestamp field', async () => {
      const metadata = {
        version: '1.0',
        directory: '/test',
        createdAt: '2025-12-01T00:00:00.000Z',
        updatedAt: '2025-12-01T00:00:00.000Z',
        fileCount: 100,
        ttlSeconds: 3600
      };

      mockedFs.readFile.mockResolvedValue(JSON.stringify(metadata) as any);
      mockedFs.writeFile.mockResolvedValue(undefined as any);

      await cacheManager.updateCacheTimestamp('/test');

      expect(mockedFs.writeFile).toHaveBeenCalled();
      const writtenData = (mockedFs.writeFile as Mock).mock.calls[0]?.[1] as string;
      const updatedMetadata = JSON.parse(writtenData);

      expect(updatedMetadata.createdAt).toBe(metadata.createdAt);
      expect(updatedMetadata.fileCount).toBe(metadata.fileCount);
      expect(new Date(updatedMetadata.updatedAt).getTime()).toBeGreaterThan(
        new Date(metadata.updatedAt).getTime()
      );
    });

    test('should not throw on update error', async () => {
      mockedFs.readFile.mockRejectedValue(new Error('Not found'));

      await expect(
        cacheManager.updateCacheTimestamp('/test')
      ).resolves.not.toThrow();
    });
  });

  describe('global metadata management', () => {
    test('should return null if global metadata does not exist', async () => {
      mockedFs.readFile.mockRejectedValue({ code: 'ENOENT' });

      const result = await cacheManager.getLastUsedDirectory();

      expect(result).toBeNull();
    });

    test('should return last used directory', async () => {
      const globalMetadata = {
        version: '1.0',
        lastUsedDirectory: '/test/dir',
        lastUsedAt: '2025-12-01T00:00:00.000Z',
        recentDirectories: []
      };

      mockedFs.readFile.mockResolvedValue(JSON.stringify(globalMetadata) as any);

      const result = await cacheManager.getLastUsedDirectory();

      expect(result).toBe('/test/dir');
    });

    test('should update global metadata with new directory', async () => {
      const existingMetadata = {
        version: '1.0',
        lastUsedDirectory: '/old/dir',
        lastUsedAt: '2025-12-01T00:00:00.000Z',
        recentDirectories: [
          {
            directory: '/old/dir',
            lastUsedAt: '2025-12-01T00:00:00.000Z'
          }
        ]
      };

      mockedFs.readFile.mockResolvedValue(JSON.stringify(existingMetadata) as any);
      mockedFs.writeFile.mockResolvedValue(undefined as any);

      await cacheManager.setLastUsedDirectory('/new/dir');

      expect(mockedFs.writeFile).toHaveBeenCalled();
      const writtenData = (mockedFs.writeFile as Mock).mock.calls[0]?.[1] as string;
      const updatedMetadata = JSON.parse(writtenData);

      expect(updatedMetadata.lastUsedDirectory).toBe('/new/dir');
      expect(updatedMetadata.recentDirectories).toHaveLength(2);
      expect(updatedMetadata.recentDirectories[0].directory).toBe('/new/dir');
    });

    test('should limit recent directories to MAX_RECENT_DIRECTORIES', async () => {
      const recentDirs = Array.from({ length: 12 }, (_, i) => ({
        directory: `/dir${i}`,
        lastUsedAt: new Date().toISOString()
      }));

      const existingMetadata = {
        version: '1.0',
        lastUsedDirectory: '/dir0',
        lastUsedAt: new Date().toISOString(),
        recentDirectories: recentDirs
      };

      mockedFs.readFile.mockResolvedValue(JSON.stringify(existingMetadata) as any);
      mockedFs.writeFile.mockResolvedValue(undefined as any);

      await cacheManager.setLastUsedDirectory('/new/dir');

      const writtenData = (mockedFs.writeFile as Mock).mock.calls[0]?.[1] as string;
      const updatedMetadata = JSON.parse(writtenData);

      expect(updatedMetadata.recentDirectories).toHaveLength(10); // MAX_RECENT_DIRECTORIES
    });
  });

  describe('clearCache', () => {
    test('should remove cache directory', async () => {
      mockedFs.rm.mockResolvedValue(undefined as any);

      await cacheManager.clearCache('/test/dir');

      expect(mockedFs.rm).toHaveBeenCalledWith(
        expect.stringContaining('-test-dir'),
        { recursive: true, force: true }
      );
    });

    test('should throw on error', async () => {
      mockedFs.rm.mockRejectedValue(new Error('Permission denied'));

      await expect(cacheManager.clearCache('/test/dir')).rejects.toThrow('Permission denied');
    });
  });

  describe('clearAllCaches', () => {
    test('should remove all cache directories', async () => {
      const mockEntries = [
        { name: 'cache1', isDirectory: () => true },
        { name: 'cache2', isDirectory: () => true },
        { name: 'global-metadata.json', isDirectory: () => false }
      ];

      mockedFs.readdir.mockResolvedValue(mockEntries as any);
      mockedFs.rm.mockResolvedValue(undefined as any);

      await cacheManager.clearAllCaches();

      expect(mockedFs.rm).toHaveBeenCalledTimes(3); // 2 directories + global metadata
    });
  });

  describe('getCacheStats', () => {
    test('should return stats for all caches', async () => {
      const mockEntries = [
        { name: 'cache1', isDirectory: () => true },
        { name: 'cache2', isDirectory: () => true }
      ];

      const metadata1 = {
        version: '1.0',
        directory: '/dir1',
        createdAt: '2025-12-01T00:00:00.000Z',
        updatedAt: '2025-12-01T01:00:00.000Z',
        fileCount: 100,
        ttlSeconds: 3600
      };

      const metadata2 = {
        version: '1.0',
        directory: '/dir2',
        createdAt: '2025-12-01T02:00:00.000Z',
        updatedAt: '2025-12-01T03:00:00.000Z',
        fileCount: 200,
        ttlSeconds: 3600
      };

      mockedFs.readdir.mockResolvedValue(mockEntries as any);
      mockedFs.readFile
        .mockResolvedValueOnce(JSON.stringify(metadata1) as any)
        .mockResolvedValueOnce(JSON.stringify(metadata2) as any);
      mockedFs.stat
        .mockResolvedValueOnce({ size: 1000 } as any)
        .mockResolvedValueOnce({ size: 2000 } as any);

      const stats = await cacheManager.getCacheStats();

      expect(stats.totalCaches).toBe(2);
      expect(stats.totalFiles).toBe(300);
      expect(stats.totalSizeBytes).toBe(3000);
      expect(stats.oldestCache).toBe('/dir1');
      expect(stats.newestCache).toBe('/dir2');
    });

    test('should return zero stats on error', async () => {
      mockedFs.readdir.mockRejectedValue(new Error('Not found'));

      const stats = await cacheManager.getCacheStats();

      expect(stats.totalCaches).toBe(0);
      expect(stats.totalFiles).toBe(0);
      expect(stats.totalSizeBytes).toBe(0);
      expect(stats.oldestCache).toBeNull();
      expect(stats.newestCache).toBeNull();
    });
  });

  describe('cleanupOldCaches', () => {
    test('should remove caches older than maxAgeDays', async () => {
      const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
      const recentDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000); // 1 day ago

      const mockEntries = [
        { name: 'old-cache', isDirectory: () => true },
        { name: 'recent-cache', isDirectory: () => true }
      ];

      const oldMetadata = {
        version: '1.0',
        directory: '/old',
        createdAt: oldDate.toISOString(),
        updatedAt: oldDate.toISOString(),
        fileCount: 100,
        ttlSeconds: 3600
      };

      const recentMetadata = {
        version: '1.0',
        directory: '/recent',
        createdAt: recentDate.toISOString(),
        updatedAt: recentDate.toISOString(),
        fileCount: 100,
        ttlSeconds: 3600
      };

      mockedFs.readdir.mockResolvedValue(mockEntries as any);
      mockedFs.readFile
        .mockResolvedValueOnce(JSON.stringify(oldMetadata) as any)
        .mockResolvedValueOnce(JSON.stringify(recentMetadata) as any);
      mockedFs.rm.mockResolvedValue(undefined as any);

      await cacheManager.cleanupOldCaches(7); // 7 days

      expect(mockedFs.rm).toHaveBeenCalledTimes(1); // Only old cache removed
    });
  });
});
