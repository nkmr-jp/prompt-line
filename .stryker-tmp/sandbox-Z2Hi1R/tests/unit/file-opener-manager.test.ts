// @ts-nocheck
import { execFile } from 'child_process';
import { FileOpenerManager } from '../../src/managers/file-opener-manager';
import type SettingsManager from '../../src/managers/settings-manager';
import type { UserSettings } from '../../src/types';

// Mock child_process
jest.mock('child_process', () => ({
  execFile: jest.fn()
}));

// Mock path module
jest.mock('path', () => ({
  extname: jest.fn((filePath: string) => {
    const lastDot = filePath.lastIndexOf('.');
    return lastDot === -1 ? '' : filePath.substring(lastDot);
  }),
  join: jest.fn((...parts: string[]) => parts.join('/')),
  dirname: jest.fn((filePath: string) => filePath.split('/').slice(0, -1).join('/')),
  basename: jest.fn((filePath: string) => filePath.split('/').pop())
}));

// Mock utils
jest.mock('../../src/utils/utils', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

const mockedExecFile = execFile as jest.MockedFunction<typeof execFile>;

describe('FileOpenerManager', () => {
  let fileOpenerManager: FileOpenerManager;
  let mockSettingsManager: jest.Mocked<SettingsManager>;

  // デフォルト設定
  const defaultSettings: UserSettings = {
    shortcuts: {
      main: 'Cmd+Shift+Space',
      paste: 'Cmd+Enter',
      close: 'Escape',
      historyNext: 'Ctrl+j',
      historyPrev: 'Ctrl+k',
      search: 'Cmd+f'
    },
    window: {
      position: 'active-text-field',
      width: 600,
      height: 300
    },
    fileSearch: {
      respectGitignore: true,
      includeHidden: true,
      maxFiles: 5000,
      maxDepth: null,
      includePatterns: [],
      excludePatterns: [],
      followSymlinks: false
    },
    fileOpener: {
      extensions: {},
      defaultEditor: null
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // SettingsManagerのモックを作成
    mockSettingsManager = {
      getSettings: jest.fn().mockReturnValue({ ...defaultSettings })
    } as any;

    fileOpenerManager = new FileOpenerManager(mockSettingsManager);
  });

  describe('openFile', () => {
    describe('with extension-specific app', () => {
      it('should open .ts file with WebStorm when configured', async () => {
        // .tsファイルをWebStormで開く設定
        mockSettingsManager.getSettings.mockReturnValue({
          ...defaultSettings,
          fileOpener: {
            extensions: { ts: 'WebStorm' },
            defaultEditor: null
          }
        });

        // execFileを成功させる
        mockedExecFile.mockImplementation((_cmd, _args, callback: any) => {
          callback(null);
          return {} as any;
        });

        const result = await fileOpenerManager.openFile('/path/to/file.ts');

        expect(result.success).toBe(true);
        expect(mockedExecFile).toHaveBeenCalledWith(
          'open',
          ['-a', 'WebStorm', '/path/to/file.ts'],
          expect.any(Function)
        );
        // openコマンドでファイルを開く（-aオプションなし）
      });

      it('should open .md file with Typora when configured', async () => {
        mockSettingsManager.getSettings.mockReturnValue({
          ...defaultSettings,
          fileOpener: {
            extensions: { md: 'Typora' },
            defaultEditor: null
          }
        });

        mockedExecFile.mockImplementation((_cmd, _args, callback: any) => {
          callback(null);
          return {} as any;
        });

        const result = await fileOpenerManager.openFile('/path/to/README.md');

        expect(result.success).toBe(true);
        expect(mockedExecFile).toHaveBeenCalledWith(
          'open',
          ['-a', 'Typora', '/path/to/README.md'],
          expect.any(Function)
        );
      });

      it('should handle uppercase extension correctly', async () => {
        mockSettingsManager.getSettings.mockReturnValue({
          ...defaultSettings,
          fileOpener: {
            extensions: { ts: 'WebStorm' },
            defaultEditor: null
          }
        });

        mockedExecFile.mockImplementation((_cmd, _args, callback: any) => {
          callback(null);
          return {} as any;
        });

        const result = await fileOpenerManager.openFile('/path/to/file.TS');

        expect(result.success).toBe(true);
        expect(mockedExecFile).toHaveBeenCalledWith(
          'open',
          ['-a', 'WebStorm', '/path/to/file.TS'],
          expect.any(Function)
        );
      });
    });

    describe('with default editor', () => {
      it('should open file with default editor when no extension-specific app is configured', async () => {
        mockSettingsManager.getSettings.mockReturnValue({
          ...defaultSettings,
          fileOpener: {
            extensions: {},
            defaultEditor: 'Visual Studio Code'
          }
        });

        mockedExecFile.mockImplementation((_cmd, _args, callback: any) => {
          callback(null);
          return {} as any;
        });

        const result = await fileOpenerManager.openFile('/path/to/file.js');

        expect(result.success).toBe(true);
        expect(mockedExecFile).toHaveBeenCalledWith(
          'open',
          ['-a', 'Visual Studio Code', '/path/to/file.js'],
          expect.any(Function)
        );
      });

      it('should prefer extension-specific app over default editor', async () => {
        mockSettingsManager.getSettings.mockReturnValue({
          ...defaultSettings,
          fileOpener: {
            extensions: { ts: 'WebStorm' },
            defaultEditor: 'Visual Studio Code'
          }
        });

        mockedExecFile.mockImplementation((_cmd, _args, callback: any) => {
          callback(null);
          return {} as any;
        });

        const result = await fileOpenerManager.openFile('/path/to/file.ts');

        expect(result.success).toBe(true);
        expect(mockedExecFile).toHaveBeenCalledWith(
          'open',
          ['-a', 'WebStorm', '/path/to/file.ts'],
          expect.any(Function)
        );
      });
    });

    describe('with system default', () => {
      it('should open file with system default when no fileOpener config exists', async () => {
        mockSettingsManager.getSettings.mockReturnValue({
          ...defaultSettings,
          fileOpener: {
            extensions: {},
            defaultEditor: null
          }
        });

        // execFileを成功させる（openコマンドでファイルを開く）
        mockedExecFile.mockImplementation((_cmd, _args, callback: any) => {
          callback(null);
          return {} as any;
        });

        const result = await fileOpenerManager.openFile('/path/to/file.txt');

        expect(result.success).toBe(true);
        expect(mockedExecFile).toHaveBeenCalledWith(
          'open',
          ['/path/to/file.txt'],
          expect.any(Function)
        );
      });

      it('should open file with system default when extension not configured', async () => {
        mockSettingsManager.getSettings.mockReturnValue({
          ...defaultSettings,
          fileOpener: {
            extensions: { ts: 'WebStorm' },
            defaultEditor: null
          }
        });

        mockedExecFile.mockImplementation((_cmd, _args, callback: any) => {
          callback(null);
          return {} as any;
        });

        const result = await fileOpenerManager.openFile('/path/to/file.js');

        expect(result.success).toBe(true);
        expect(mockedExecFile).toHaveBeenCalledWith(
          'open',
          ['/path/to/file.js'],
          expect.any(Function)
        );
      });

      it('should return error when open command fails', async () => {
        mockSettingsManager.getSettings.mockReturnValue({
          ...defaultSettings,
          fileOpener: {
            extensions: {},
            defaultEditor: null
          }
        });

        mockedExecFile.mockImplementation((_cmd, _args, callback: any) => {
          callback(new Error('File not found'));
          return {} as any;
        });

        const result = await fileOpenerManager.openFile('/path/to/nonexistent.txt');

        expect(result.success).toBe(false);
        expect(result.error).toBe('File not found');
      });
    });

    describe('with fallback to system default', () => {
      it('should fallback to system default when app is not found', async () => {
        mockSettingsManager.getSettings.mockReturnValue({
          ...defaultSettings,
          fileOpener: {
            extensions: { ts: 'NonExistentApp' },
            defaultEditor: null
          }
        });

        let callCount = 0;
        // First call: execFile fails (app not found), Second call: fallback succeeds
        mockedExecFile.mockImplementation((_cmd, args, callback: any) => {
          callCount++;
          if (callCount === 1) {
            // First call with -a option fails
            expect(args).toContain('-a');
            callback(new Error('App not found'));
          } else {
            // Second call without -a option succeeds
            expect(args).not.toContain('-a');
            callback(null);
          }
          return {} as any;
        });

        const result = await fileOpenerManager.openFile('/path/to/file.ts');

        expect(result.success).toBe(true);
        expect(mockedExecFile).toHaveBeenCalledTimes(2);
        // First call: open -a NonExistentApp /path/to/file.ts
        expect(mockedExecFile).toHaveBeenNthCalledWith(1,
          'open',
          ['-a', 'NonExistentApp', '/path/to/file.ts'],
          expect.any(Function)
        );
        // Second call: open /path/to/file.ts (fallback)
        expect(mockedExecFile).toHaveBeenNthCalledWith(2,
          'open',
          ['/path/to/file.ts'],
          expect.any(Function)
        );
      });

      it('should return error when both app and system default fail', async () => {
        mockSettingsManager.getSettings.mockReturnValue({
          ...defaultSettings,
          fileOpener: {
            extensions: { ts: 'NonExistentApp' },
            defaultEditor: null
          }
        });

        // All execFile calls fail
        mockedExecFile.mockImplementation((_cmd, args, callback: any) => {
          if (Array.isArray(args) && args.includes('-a')) {
            callback(new Error('App not found'));
          } else {
            callback(new Error('File not found'));
          }
          return {} as any;
        });

        const result = await fileOpenerManager.openFile('/path/to/file.ts');

        expect(result.success).toBe(false);
        expect(result.error).toBe('File not found');
      });
    });
  });

  describe('getAppForExtension', () => {
    it('should return configured app for extension', () => {
      mockSettingsManager.getSettings.mockReturnValue({
        ...defaultSettings,
        fileOpener: {
          extensions: { ts: 'WebStorm', md: 'Typora' },
          defaultEditor: null
        }
      });

      expect(fileOpenerManager.getAppForExtension('ts')).toBe('WebStorm');
      expect(fileOpenerManager.getAppForExtension('md')).toBe('Typora');
    });

    it('should return null when extension is not configured', () => {
      mockSettingsManager.getSettings.mockReturnValue({
        ...defaultSettings,
        fileOpener: {
          extensions: { ts: 'WebStorm' },
          defaultEditor: null
        }
      });

      expect(fileOpenerManager.getAppForExtension('js')).toBeNull();
    });

    it('should handle extension with leading dot', () => {
      mockSettingsManager.getSettings.mockReturnValue({
        ...defaultSettings,
        fileOpener: {
          extensions: { ts: 'WebStorm' },
          defaultEditor: null
        }
      });

      expect(fileOpenerManager.getAppForExtension('.ts')).toBe('WebStorm');
    });

    it('should handle case-insensitive extensions', () => {
      mockSettingsManager.getSettings.mockReturnValue({
        ...defaultSettings,
        fileOpener: {
          extensions: { ts: 'WebStorm' },
          defaultEditor: null
        }
      });

      expect(fileOpenerManager.getAppForExtension('TS')).toBe('WebStorm');
      expect(fileOpenerManager.getAppForExtension('.TS')).toBe('WebStorm');
    });

    it('should return null when no fileOpener config exists', () => {
      mockSettingsManager.getSettings.mockReturnValue({
        ...defaultSettings,
        fileOpener: {
          extensions: {},
          defaultEditor: null
        }
      });

      expect(fileOpenerManager.getAppForExtension('ts')).toBeNull();
    });
  });

  describe('getDefaultEditor', () => {
    it('should return configured default editor', () => {
      mockSettingsManager.getSettings.mockReturnValue({
        ...defaultSettings,
        fileOpener: {
          extensions: {},
          defaultEditor: 'Visual Studio Code'
        }
      });

      expect(fileOpenerManager.getDefaultEditor()).toBe('Visual Studio Code');
    });

    it('should return null when default editor is not configured', () => {
      mockSettingsManager.getSettings.mockReturnValue({
        ...defaultSettings,
        fileOpener: {
          extensions: {},
          defaultEditor: null
        }
      });

      expect(fileOpenerManager.getDefaultEditor()).toBeNull();
    });

    it('should return null when no fileOpener config exists', () => {
      mockSettingsManager.getSettings.mockReturnValue({
        ...defaultSettings,
        fileOpener: {
          extensions: {},
          defaultEditor: null
        }
      });

      expect(fileOpenerManager.getDefaultEditor()).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should handle files without extension', async () => {
      mockSettingsManager.getSettings.mockReturnValue({
        ...defaultSettings,
        fileOpener: {
          extensions: {},
          defaultEditor: 'Visual Studio Code'
        }
      });

      mockedExecFile.mockImplementation((_cmd, _args, callback: any) => {
        callback(null);
        return {} as any;
      });

      const result = await fileOpenerManager.openFile('/path/to/Makefile');

      expect(result.success).toBe(true);
      // Should use default editor for files without extension
      expect(mockedExecFile).toHaveBeenCalledWith(
        'open',
        ['-a', 'Visual Studio Code', '/path/to/Makefile'],
        expect.any(Function)
      );
    });

    it('should handle files with multiple dots in filename', async () => {
      mockSettingsManager.getSettings.mockReturnValue({
        ...defaultSettings,
        fileOpener: {
          extensions: { ts: 'WebStorm' },
          defaultEditor: null
        }
      });

      mockedExecFile.mockImplementation((_cmd, _args, callback: any) => {
        callback(null);
        return {} as any;
      });

      const result = await fileOpenerManager.openFile('/path/to/file.test.ts');

      expect(result.success).toBe(true);
      expect(mockedExecFile).toHaveBeenCalledWith(
        'open',
        ['-a', 'WebStorm', '/path/to/file.test.ts'],
        expect.any(Function)
      );
    });

    it('should handle absolute paths correctly', async () => {
      mockSettingsManager.getSettings.mockReturnValue({
        ...defaultSettings,
        fileOpener: {
          extensions: {},
          defaultEditor: null
        }
      });

      mockedExecFile.mockImplementation((_cmd, _args, callback: any) => {
        callback(null);
        return {} as any;
      });

      const result = await fileOpenerManager.openFile('/Users/test/project/file.txt');

      expect(result.success).toBe(true);
      expect(mockedExecFile).toHaveBeenCalledWith(
        'open',
        ['/Users/test/project/file.txt'],
        expect.any(Function)
      );
    });
  });
});
