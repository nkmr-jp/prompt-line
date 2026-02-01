import fs from 'fs';
import { EventEmitter } from 'events';

// Mock chokidar before importing the manager
jest.mock('chokidar', () => ({
  watch: jest.fn()
}));

// Mock fs and path
jest.mock('fs');
jest.mock('path', () => ({
  join: jest.fn((...parts: string[]) => parts.join('/')),
  extname: jest.fn((filePath: string) => {
    const parts = filePath.split('.');
    return parts.length > 1 ? '.' + parts[parts.length - 1] : '';
  }),
  basename: jest.fn((filePath: string, ext?: string) => {
    const name = filePath.split('/').pop() || '';
    if (ext && name.endsWith(ext)) {
      return name.slice(0, -ext.length);
    }
    return name;
  })
}));

// Mock config
const mockConfig = {
  paths: {
    builtInCommandsDir: '/test/built-in-commands'
  }
};

jest.mock('../../src/config/app-config', () => mockConfig);

jest.mock('../../src/utils/utils', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  },
  ensureDir: jest.fn()
}));

// Mock built-in-commands-loader with clearCache method
jest.mock('../../src/lib/built-in-commands-loader', () => {
  const mockClearCache = jest.fn();
  return {
    __esModule: true,
    default: {
      clearCache: mockClearCache
    }
  };
});

// Import after mocks
import BuiltInCommandsManager from '../../src/managers/built-in-commands-manager';

describe('BuiltInCommandsManager', () => {
  let manager: BuiltInCommandsManager;
  const mockFs = fs as jest.Mocked<typeof fs>;
  const mockChokidar = require('chokidar');
  const mockUtils = require('../../src/utils/utils');
  let mockClearCache: jest.MockedFunction<() => void>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Get the mocked clearCache function
    const builtInCommandsLoader = require('../../src/lib/built-in-commands-loader').default;
    mockClearCache = builtInCommandsLoader.clearCache;
    mockClearCache.mockClear();

    // Default fs.existsSync behavior - source dir exists
    mockFs.existsSync.mockImplementation((filePath: unknown) => {
      const pathStr = String(filePath);
      // Make source dir exist by default
      return pathStr.includes('built-in-commands') && !pathStr.includes('/test/built-in-commands/');
    });

    // Default fs.readdirSync behavior
    mockFs.readdirSync.mockReturnValue([]);

    // Default fs.copyFileSync behavior
    mockFs.copyFileSync.mockImplementation(() => {});

    // Ensure ensureDir resolves successfully by default
    mockUtils.ensureDir.mockResolvedValue(undefined);

    manager = new BuiltInCommandsManager();
  });

  afterEach(async () => {
    if (manager) {
      await manager.destroy();
    }
  });

  describe('User customization protection', () => {
    it('should not copy file if target already exists', async () => {
      // Arrange
      const sourceFiles = ['claude.yml'];
      mockFs.readdirSync.mockReturnValue(sourceFiles as any);

      // Both source and target exist
      mockFs.existsSync.mockReturnValue(true);

      // Act
      await manager.initialize();

      // Assert
      expect(mockFs.copyFileSync).not.toHaveBeenCalled();
    });

    it('should copy file if target does not exist', async () => {
      // Arrange
      const sourceFiles = ['new-command.yml'];
      mockFs.readdirSync.mockReturnValue(sourceFiles as any);

      // Source exists, target doesn't
      mockFs.existsSync.mockImplementation((filePath: unknown) => {
        const pathStr = String(filePath);
        // Source dir exists
        if (!pathStr.includes('/')) return true;
        // Target file does not exist
        return !pathStr.includes('/test/built-in-commands/new-command.yml');
      });

      // Act
      await manager.initialize();

      // Assert
      expect(mockFs.copyFileSync).toHaveBeenCalledTimes(1);
    });

    it('should copy only new files on app update', async () => {
      // Arrange
      const sourceFiles = ['existing.yml', 'new.yml'];
      mockFs.readdirSync.mockReturnValue(sourceFiles as any);

      mockFs.existsSync.mockImplementation((filePath: unknown) => {
        const pathStr = String(filePath);
        // Source dir exists
        if (!pathStr.includes('/test/built-in-commands/')) return true;
        // Only existing.yml exists in target
        return pathStr.includes('existing.yml');
      });

      // Act
      await manager.initialize();

      // Assert
      expect(mockFs.copyFileSync).toHaveBeenCalledTimes(1);
      expect(mockFs.copyFileSync).toHaveBeenCalledWith(
        expect.stringContaining('new.yml'),
        expect.stringContaining('new.yml')
      );
    });
  });

  describe('File watching', () => {
    let mockWatcher: any;

    beforeEach(() => {
      // Create a mock watcher with necessary methods
      mockWatcher = Object.assign(new EventEmitter(), {
        close: jest.fn().mockResolvedValue(undefined)
      });
      mockChokidar.watch.mockReturnValue(mockWatcher);
    });

    it('should start file watcher on initialization', async () => {
      // Arrange
      mockFs.readdirSync.mockReturnValue([]);
      mockFs.existsSync.mockReturnValue(true);

      // Act
      await manager.initialize();

      // Assert
      expect(mockChokidar.watch).toHaveBeenCalledWith(
        '/test/built-in-commands',
        expect.objectContaining({
          persistent: true,
          ignoreInitial: true
        })
      );
    });

    it('should clear cache on file change', async () => {
      // Arrange
      jest.useFakeTimers();
      mockFs.readdirSync.mockReturnValue([]);
      mockFs.existsSync.mockReturnValue(true);

      await manager.initialize();
      mockClearCache.mockClear();

      // Act
      mockWatcher.emit('change', '/test/built-in-commands/test.yml');
      jest.advanceTimersByTime(300);

      // Assert
      expect(mockClearCache).toHaveBeenCalledTimes(1);

      jest.useRealTimers();
    });

    it('should debounce rapid file changes', async () => {
      // Arrange
      jest.useFakeTimers();
      mockFs.readdirSync.mockReturnValue([]);
      mockFs.existsSync.mockReturnValue(true);

      await manager.initialize();
      mockClearCache.mockClear();

      // Act - trigger multiple changes rapidly
      mockWatcher.emit('change', '/test/built-in-commands/test1.yml');
      jest.advanceTimersByTime(100);

      mockWatcher.emit('change', '/test/built-in-commands/test2.yml');
      jest.advanceTimersByTime(100);

      mockWatcher.emit('change', '/test/built-in-commands/test3.yml');
      jest.advanceTimersByTime(300);

      // Assert - cache should only be cleared once
      expect(mockClearCache).toHaveBeenCalledTimes(1);

      jest.useRealTimers();
    });

    it('should watch YAML files only', async () => {
      // Arrange
      mockFs.readdirSync.mockReturnValue([]);
      mockFs.existsSync.mockReturnValue(true);

      // Act
      await manager.initialize();

      // Assert
      const watchOptions = mockChokidar.watch.mock.calls[0][1];
      expect(watchOptions.ignored).toBeDefined();

      // Test the ignored function
      const ignoredFn = watchOptions.ignored;
      expect(ignoredFn('/test/file.txt')).toBe(true);
      expect(ignoredFn('/test/file.json')).toBe(true);
      expect(ignoredFn('/test/file.yaml')).toBe(false);
      expect(ignoredFn('/test/file.yml')).toBe(false);
    });

    it('should emit commands-changed event on file change', async () => {
      // Arrange
      jest.useFakeTimers();
      mockFs.readdirSync.mockReturnValue([]);
      mockFs.existsSync.mockReturnValue(true);

      const eventSpy = jest.fn();
      manager.on('commands-changed', eventSpy);

      await manager.initialize();

      // Act
      mockWatcher.emit('change', '/test/built-in-commands/test.yml');
      jest.advanceTimersByTime(300);

      // Assert
      expect(eventSpy).toHaveBeenCalledTimes(1);

      jest.useRealTimers();
    });

    it('should handle file addition', async () => {
      // Arrange
      jest.useFakeTimers();
      mockFs.readdirSync.mockReturnValue([]);
      mockFs.existsSync.mockReturnValue(true);

      await manager.initialize();
      mockClearCache.mockClear();

      // Act
      mockWatcher.emit('add', '/test/built-in-commands/new.yml');
      jest.advanceTimersByTime(300);

      // Assert
      expect(mockClearCache).toHaveBeenCalledTimes(1);

      jest.useRealTimers();
    });

    it('should handle file deletion', async () => {
      // Arrange
      jest.useFakeTimers();
      mockFs.readdirSync.mockReturnValue([]);
      mockFs.existsSync.mockReturnValue(true);

      await manager.initialize();
      mockClearCache.mockClear();

      // Act
      mockWatcher.emit('unlink', '/test/built-in-commands/deleted.yml');
      jest.advanceTimersByTime(300);

      // Assert
      expect(mockClearCache).toHaveBeenCalledTimes(1);

      jest.useRealTimers();
    });

    it('should handle watcher errors gracefully', async () => {
      // Arrange
      mockFs.readdirSync.mockReturnValue([]);
      mockFs.existsSync.mockReturnValue(true);

      await manager.initialize();

      // Act
      const error = new Error('File system error');
      mockWatcher.emit('error', error);

      // Assert
      expect(mockUtils.logger.error).toHaveBeenCalledWith(
        'Built-in commands watcher error:',
        error
      );
    });
  });

  describe('Cleanup', () => {
    it('should close watcher on destroy', async () => {
      // Arrange
      const mockWatcher = Object.assign(new EventEmitter(), {
        close: jest.fn().mockResolvedValue(undefined)
      });
      mockChokidar.watch.mockReturnValue(mockWatcher);

      mockFs.readdirSync.mockReturnValue([]);
      mockFs.existsSync.mockReturnValue(true);

      await manager.initialize();

      // Act
      await manager.destroy();

      // Assert
      expect(mockWatcher.close).toHaveBeenCalledTimes(1);
    });

    it('should clear debounce timer on destroy', async () => {
      // Arrange
      jest.useFakeTimers();
      const mockWatcher = Object.assign(new EventEmitter(), {
        close: jest.fn().mockResolvedValue(undefined)
      });
      mockChokidar.watch.mockReturnValue(mockWatcher);

      mockFs.readdirSync.mockReturnValue([]);
      mockFs.existsSync.mockReturnValue(true);

      await manager.initialize();

      // Trigger file change to start debounce timer
      mockWatcher.emit('change', '/test/built-in-commands/test.yml');
      mockClearCache.mockClear();

      // Act
      await manager.destroy();
      jest.advanceTimersByTime(300);

      // Assert - cache should not be cleared after destroy
      expect(mockClearCache).not.toHaveBeenCalled();

      jest.useRealTimers();
    });

    it('should remove all event listeners on destroy', async () => {
      // Arrange
      const mockWatcher = Object.assign(new EventEmitter(), {
        close: jest.fn().mockResolvedValue(undefined)
      });
      mockChokidar.watch.mockReturnValue(mockWatcher);

      mockFs.readdirSync.mockReturnValue([]);
      mockFs.existsSync.mockReturnValue(true);

      const eventSpy = jest.fn();
      manager.on('commands-changed', eventSpy);

      await manager.initialize();

      // Act
      await manager.destroy();

      // Assert
      expect(manager.listenerCount('commands-changed')).toBe(0);
    });
  });

  describe('Initialization edge cases', () => {
    it('should handle missing source directory gracefully', async () => {
      // Arrange
      mockFs.existsSync.mockReturnValue(false);

      // Act
      await manager.initialize();

      // Assert - should log warning and not crash
      expect(mockFs.copyFileSync).not.toHaveBeenCalled();
    });

    it('should handle directory creation failure', async () => {
      // Arrange
      const error = new Error('Permission denied');
      mockUtils.ensureDir.mockRejectedValue(error);

      // Act
      await manager.initialize();

      // Assert
      expect(mockUtils.logger.error).toHaveBeenCalled();
    });

    it('should filter non-YAML files', async () => {
      // Arrange
      const mixedFiles = [
        'command1.yml',
        'command2.yaml',
        'readme.txt',
        'config.json',
        '.DS_Store'
      ];
      mockFs.readdirSync.mockReturnValue(mixedFiles as any);

      // Source exists, targets don't exist (YAML files will be copied)
      mockFs.existsSync.mockImplementation((filePath: unknown) => {
        const pathStr = String(filePath);
        // Source dir exists
        if (pathStr.includes('built-in-commands') && !pathStr.includes('/test/built-in-commands/')) {
          return true;
        }
        // Target files don't exist
        return false;
      });

      // Act
      await manager.initialize();

      // Assert - only .yml and .yaml files should be processed
      expect(mockFs.copyFileSync).toHaveBeenCalledTimes(2);
    });

    it('should handle copy failures gracefully', async () => {
      // Arrange
      const sourceFiles = ['test.yml'];
      mockFs.readdirSync.mockReturnValue(sourceFiles as any);

      mockFs.existsSync.mockImplementation((filePath: unknown) => {
        const pathStr = String(filePath);
        // Source dir exists
        if (pathStr.includes('built-in-commands') && !pathStr.includes('/test/built-in-commands/')) {
          return true;
        }
        // Target file doesn't exist (will trigger copy)
        return !pathStr.includes('/test/built-in-commands/test.yml');
      });

      const copyError = new Error('Disk full');
      mockFs.copyFileSync.mockImplementation(() => {
        throw copyError;
      });

      // Act
      await manager.initialize();

      // Assert - should log warning and continue
      expect(mockUtils.logger.warn).toHaveBeenCalled();
    });
  });

  describe('getTargetDirectory', () => {
    it('should return the target directory path', () => {
      // Act
      const targetDir = manager.getTargetDirectory();

      // Assert
      expect(targetDir).toBe('/test/built-in-commands');
    });
  });
});
