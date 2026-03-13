import type { MockedFunction, Mocked } from 'vitest';
import { execFile } from 'child_process';
import { FileOpenerManager } from '../../src/managers/file-opener-manager';
import type SettingsManager from '../../src/managers/settings-manager';
import type { UserSettings } from '../../src/types';

// Mock child_process
vi.mock('child_process', () => ({
  execFile: vi.fn()
}));

// Mock path module
vi.mock('path', () => {
  const pathMock = {
    extname: vi.fn((filePath: string) => {
      const lastDot = filePath.lastIndexOf('.');
      return lastDot === -1 ? '' : filePath.substring(lastDot);
    }),
    join: vi.fn((...parts: string[]) => parts.join('/').replace(/\/+/g, '/')),
    dirname: vi.fn((filePath: string) => filePath.split('/').slice(0, -1).join('/')),
    basename: vi.fn((filePath: string) => filePath.split('/').pop()),
    resolve: vi.fn((p: string) => p.startsWith('/') ? p : `/cwd/${p}`),
    sep: '/'
  };
  return { ...pathMock, default: pathMock };
});

// Mock os module
vi.mock('os', () => ({
  homedir: vi.fn(() => '/Users/test'),
  default: { homedir: vi.fn(() => '/Users/test') }
}));

// Mock utils
vi.mock('../../src/utils/utils', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

const mockedExecFile = execFile as MockedFunction<typeof execFile>;

describe('FileOpenerManager', () => {
  let fileOpenerManager: FileOpenerManager;
  let mockSettingsManager: Mocked<SettingsManager>;

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
    vi.clearAllMocks();

    // SettingsManagerのモックを作成
    mockSettingsManager = {
      getSettings: vi.fn().mockReturnValue({ ...defaultSettings })
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

  describe('with directory-specific editor', () => {
      it('should open file with directory-specific editor when file is in configured directory', async () => {
        mockSettingsManager.getSettings.mockReturnValue({
          ...defaultSettings,
          fileOpener: {
            extensions: {},
            directories: [{ path: '/Users/test/go-projects', editor: 'GoLand' }],
            defaultEditor: 'Visual Studio Code'
          }
        });

        mockedExecFile.mockImplementation((_cmd, _args, callback: any) => {
          callback(null);
          return {} as any;
        });

        const result = await fileOpenerManager.openFile('/Users/test/go-projects/main.go');

        expect(result.success).toBe(true);
        expect(mockedExecFile).toHaveBeenCalledWith(
          'open',
          ['-a', 'GoLand', '/Users/test/go-projects/main.go'],
          expect.any(Function)
        );
      });

      it('should use most specific pattern when multiple directories match', async () => {
        mockSettingsManager.getSettings.mockReturnValue({
          ...defaultSettings,
          fileOpener: {
            extensions: {},
            directories: [
              { path: '/Users/test/projects/*', editor: 'Visual Studio Code' },
              { path: '/Users/test/projects/go-api', editor: 'GoLand' }
            ],
            defaultEditor: null
          }
        });

        mockedExecFile.mockImplementation((_cmd, _args, callback: any) => {
          callback(null);
          return {} as any;
        });

        const result = await fileOpenerManager.openFile('/Users/test/projects/go-api/main.go');

        expect(result.success).toBe(true);
        expect(mockedExecFile).toHaveBeenCalledWith(
          'open',
          ['-a', 'GoLand', '/Users/test/projects/go-api/main.go'],
          expect.any(Function)
        );
      });

      it('should prefer extension-specific app over directory-specific editor', async () => {
        mockSettingsManager.getSettings.mockReturnValue({
          ...defaultSettings,
          fileOpener: {
            extensions: { pdf: 'Preview' },
            directories: [{ path: '/Users/test/go-projects', editor: 'GoLand' }],
            defaultEditor: null
          }
        });

        mockedExecFile.mockImplementation((_cmd, _args, callback: any) => {
          callback(null);
          return {} as any;
        });

        const result = await fileOpenerManager.openFile('/Users/test/go-projects/doc.pdf');

        expect(result.success).toBe(true);
        expect(mockedExecFile).toHaveBeenCalledWith(
          'open',
          ['-a', 'Preview', '/Users/test/go-projects/doc.pdf'],
          expect.any(Function)
        );
      });

      it('should fall back to defaultEditor when file is not in any configured directory', async () => {
        mockSettingsManager.getSettings.mockReturnValue({
          ...defaultSettings,
          fileOpener: {
            extensions: {},
            directories: [{ path: '/Users/test/go-projects', editor: 'GoLand' }],
            defaultEditor: 'Visual Studio Code'
          }
        });

        mockedExecFile.mockImplementation((_cmd, _args, callback: any) => {
          callback(null);
          return {} as any;
        });

        const result = await fileOpenerManager.openFile('/Users/test/other-project/file.ts');

        expect(result.success).toBe(true);
        expect(mockedExecFile).toHaveBeenCalledWith(
          'open',
          ['-a', 'Visual Studio Code', '/Users/test/other-project/file.ts'],
          expect.any(Function)
        );
      });

      it('should expand ~ in directory paths', async () => {
        mockSettingsManager.getSettings.mockReturnValue({
          ...defaultSettings,
          fileOpener: {
            extensions: {},
            directories: [{ path: '~/go-projects', editor: 'GoLand' }],
            defaultEditor: null
          }
        });

        mockedExecFile.mockImplementation((_cmd, _args, callback: any) => {
          callback(null);
          return {} as any;
        });

        const result = await fileOpenerManager.openFile('/Users/test/go-projects/main.go');

        expect(result.success).toBe(true);
        expect(mockedExecFile).toHaveBeenCalledWith(
          'open',
          ['-a', 'GoLand', '/Users/test/go-projects/main.go'],
          expect.any(Function)
        );
      });

      it('should not match when file path is a prefix but not in directory', async () => {
        mockSettingsManager.getSettings.mockReturnValue({
          ...defaultSettings,
          fileOpener: {
            extensions: {},
            directories: [{ path: '/Users/test/proj', editor: 'GoLand' }],
            defaultEditor: null
          }
        });

        mockedExecFile.mockImplementation((_cmd, _args, callback: any) => {
          callback(null);
          return {} as any;
        });

        // /Users/test/projects/file.ts should NOT match /Users/test/proj
        const result = await fileOpenerManager.openFile('/Users/test/projects/file.ts');

        expect(result.success).toBe(true);
        expect(mockedExecFile).toHaveBeenCalledWith(
          'open',
          ['/Users/test/projects/file.ts'],
          expect.any(Function)
        );
      });

      it('should handle empty directories array', async () => {
        mockSettingsManager.getSettings.mockReturnValue({
          ...defaultSettings,
          fileOpener: {
            extensions: {},
            directories: [],
            defaultEditor: 'Visual Studio Code'
          }
        });

        mockedExecFile.mockImplementation((_cmd, _args, callback: any) => {
          callback(null);
          return {} as any;
        });

        const result = await fileOpenerManager.openFile('/Users/test/project/file.ts');

        expect(result.success).toBe(true);
        expect(mockedExecFile).toHaveBeenCalledWith(
          'open',
          ['-a', 'Visual Studio Code', '/Users/test/project/file.ts'],
          expect.any(Function)
        );
      });

      it('should match * glob pattern (single directory level)', async () => {
        mockSettingsManager.getSettings.mockReturnValue({
          ...defaultSettings,
          fileOpener: {
            extensions: {},
            directories: [{ path: '/Users/test/ghq/github.com/my-org/*', editor: 'GoLand' }],
            defaultEditor: null
          }
        });

        mockedExecFile.mockImplementation((_cmd, _args, callback: any) => {
          callback(null);
          return {} as any;
        });

        const result = await fileOpenerManager.openFile('/Users/test/ghq/github.com/my-org/my-go-repo/main.go');

        expect(result.success).toBe(true);
        expect(mockedExecFile).toHaveBeenCalledWith(
          'open',
          ['-a', 'GoLand', '/Users/test/ghq/github.com/my-org/my-go-repo/main.go'],
          expect.any(Function)
        );
      });

      it('should not match * glob across directory separators', async () => {
        mockSettingsManager.getSettings.mockReturnValue({
          ...defaultSettings,
          fileOpener: {
            extensions: {},
            directories: [{ path: '/Users/test/ghq/github.com/*/repo', editor: 'GoLand' }],
            defaultEditor: null
          }
        });

        mockedExecFile.mockImplementation((_cmd, _args, callback: any) => {
          callback(null);
          return {} as any;
        });

        // * should not match "my-org/other" (contains /)
        const result = await fileOpenerManager.openFile('/Users/test/ghq/github.com/my-org/other/repo/main.go');

        expect(result.success).toBe(true);
        // Should fall through to system default (no -a flag)
        expect(mockedExecFile).toHaveBeenCalledWith(
          'open',
          ['/Users/test/ghq/github.com/my-org/other/repo/main.go'],
          expect.any(Function)
        );
      });

      it('should match ** glob pattern (multiple directory levels)', async () => {
        mockSettingsManager.getSettings.mockReturnValue({
          ...defaultSettings,
          fileOpener: {
            extensions: {},
            directories: [{ path: '/Users/test/ghq/**', editor: 'GoLand' }],
            defaultEditor: null
          }
        });

        mockedExecFile.mockImplementation((_cmd, _args, callback: any) => {
          callback(null);
          return {} as any;
        });

        const result = await fileOpenerManager.openFile('/Users/test/ghq/github.com/my-org/repo/main.go');

        expect(result.success).toBe(true);
        expect(mockedExecFile).toHaveBeenCalledWith(
          'open',
          ['-a', 'GoLand', '/Users/test/ghq/github.com/my-org/repo/main.go'],
          expect.any(Function)
        );
      });

      it('should match glob with ~ expansion', async () => {
        mockSettingsManager.getSettings.mockReturnValue({
          ...defaultSettings,
          fileOpener: {
            extensions: {},
            directories: [{ path: '~/ghq/github.com/my-org/go-*', editor: 'GoLand' }],
            defaultEditor: null
          }
        });

        mockedExecFile.mockImplementation((_cmd, _args, callback: any) => {
          callback(null);
          return {} as any;
        });

        const result = await fileOpenerManager.openFile('/Users/test/ghq/github.com/my-org/go-api/main.go');

        expect(result.success).toBe(true);
        expect(mockedExecFile).toHaveBeenCalledWith(
          'open',
          ['-a', 'GoLand', '/Users/test/ghq/github.com/my-org/go-api/main.go'],
          expect.any(Function)
        );
      });

      it('should prefer more specific pattern over glob', async () => {
        mockSettingsManager.getSettings.mockReturnValue({
          ...defaultSettings,
          fileOpener: {
            extensions: {},
            directories: [
              { path: '/Users/test/ghq/github.com/*', editor: 'Visual Studio Code' },
              { path: '/Users/test/ghq/github.com/my-org/go-*', editor: 'GoLand' }
            ],
            defaultEditor: null
          }
        });

        mockedExecFile.mockImplementation((_cmd, _args, callback: any) => {
          callback(null);
          return {} as any;
        });

        const result = await fileOpenerManager.openFile('/Users/test/ghq/github.com/my-org/go-api/main.go');

        expect(result.success).toBe(true);
        // More specific pattern (longer non-glob prefix) should win
        expect(mockedExecFile).toHaveBeenCalledWith(
          'open',
          ['-a', 'GoLand', '/Users/test/ghq/github.com/my-org/go-api/main.go'],
          expect.any(Function)
        );
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

  describe('line number support with configured editor', () => {
    it('should open file with open -na --goto for VSCode when line number is provided', async () => {
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

      const result = await fileOpenerManager.openFile('/path/to/file.ts', { lineNumber: 42 });

      expect(result.success).toBe(true);
      expect(mockedExecFile).toHaveBeenCalledWith(
        'open',
        ['-na', 'Visual Studio Code', '--args', '--goto', '/path/to/file.ts:42:1'],
        expect.any(Function)
      );
    });

    it('should open file with open -na --goto for Cursor when line number is provided', async () => {
      mockSettingsManager.getSettings.mockReturnValue({
        ...defaultSettings,
        fileOpener: {
          extensions: {},
          defaultEditor: 'Cursor'
        }
      });

      mockedExecFile.mockImplementation((_cmd, _args, callback: any) => {
        callback(null);
        return {} as any;
      });

      const result = await fileOpenerManager.openFile('/path/to/file.ts', { lineNumber: 10 });

      expect(result.success).toBe(true);
      expect(mockedExecFile).toHaveBeenCalledWith(
        'open',
        ['-na', 'Cursor', '--args', '--goto', '/path/to/file.ts:10:1'],
        expect.any(Function)
      );
    });

    it('should open file with open -na --goto for Windsurf when line number is provided', async () => {
      mockSettingsManager.getSettings.mockReturnValue({
        ...defaultSettings,
        fileOpener: {
          extensions: {},
          defaultEditor: 'Windsurf'
        }
      });

      mockedExecFile.mockImplementation((_cmd, _args, callback: any) => {
        callback(null);
        return {} as any;
      });

      const result = await fileOpenerManager.openFile('/path/to/file.ts', { lineNumber: 15 });

      expect(result.success).toBe(true);
      expect(mockedExecFile).toHaveBeenCalledWith(
        'open',
        ['-na', 'Windsurf', '--args', '--goto', '/path/to/file.ts:15:1'],
        expect.any(Function)
      );
    });

    it('should open file with open -na --goto for Antigravity when line number is provided', async () => {
      mockSettingsManager.getSettings.mockReturnValue({
        ...defaultSettings,
        fileOpener: {
          extensions: {},
          defaultEditor: 'Antigravity'
        }
      });

      mockedExecFile.mockImplementation((_cmd, _args, callback: any) => {
        callback(null);
        return {} as any;
      });

      const result = await fileOpenerManager.openFile('/path/to/file.ts', { lineNumber: 99 });

      expect(result.success).toBe(true);
      expect(mockedExecFile).toHaveBeenCalledWith(
        'open',
        ['-na', 'Antigravity', '--args', '--goto', '/path/to/file.ts:99:1'],
        expect.any(Function)
      );
    });

    it('should open file with xed -l for Xcode when line number is provided', async () => {
      mockSettingsManager.getSettings.mockReturnValue({
        ...defaultSettings,
        fileOpener: {
          extensions: {},
          defaultEditor: 'Xcode'
        }
      });

      mockedExecFile.mockImplementation((_cmd, _args, callback: any) => {
        callback(null);
        return {} as any;
      });

      const result = await fileOpenerManager.openFile('/path/to/file.swift', { lineNumber: 75 });

      expect(result.success).toBe(true);
      expect(mockedExecFile).toHaveBeenCalledWith(
        'xed',
        ['-l', '75', '/path/to/file.swift'],
        expect.any(Function)
      );
    });

    it('should fallback to open -a Xcode when xed fails', async () => {
      mockSettingsManager.getSettings.mockReturnValue({
        ...defaultSettings,
        fileOpener: {
          extensions: {},
          defaultEditor: 'Xcode'
        }
      });

      let callIndex = 0;
      mockedExecFile.mockImplementation((cmd: any, _args: any, callback: any) => {
        callIndex++;
        if (callIndex === 1) {
          // xed fails
          expect(cmd).toBe('xed');
          callback(new Error('xed not found'));
        } else {
          // fallback to open -a Xcode
          expect(cmd).toBe('open');
          callback(null);
        }
        return {} as any;
      });

      const result = await fileOpenerManager.openFile('/path/to/file.swift', { lineNumber: 75 });

      expect(result.success).toBe(true);
      expect(mockedExecFile).toHaveBeenCalledTimes(2);
      expect(mockedExecFile).toHaveBeenNthCalledWith(1,
        'xed',
        ['-l', '75', '/path/to/file.swift'],
        expect.any(Function)
      );
      expect(mockedExecFile).toHaveBeenNthCalledWith(2,
        'open',
        ['-a', 'Xcode', '/path/to/file.swift'],
        expect.any(Function)
      );
    });

    it('should open file with open -na for JetBrains IDEs when line number is provided', async () => {
      mockSettingsManager.getSettings.mockReturnValue({
        ...defaultSettings,
        fileOpener: {
          extensions: {},
          defaultEditor: 'WebStorm'
        }
      });

      mockedExecFile.mockImplementation((_cmd, _args, callback: any) => {
        callback(null);
        return {} as any;
      });

      const result = await fileOpenerManager.openFile('/path/to/file.ts', { lineNumber: 25 });

      expect(result.success).toBe(true);
      expect(mockedExecFile).toHaveBeenCalledWith(
        'open',
        ['-na', 'WebStorm', '--args', '--line', '25', '/path/to/file.ts'],
        expect.any(Function)
      );
    });
  });

  describe('default app detection for line number support', () => {
    const originalPlatform = process.platform;

    afterEach(() => {
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should detect default app and use line number when fileOpener is not configured', async () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' });

      mockSettingsManager.getSettings.mockReturnValue({
        ...defaultSettings,
        fileOpener: {
          extensions: {},
          defaultEditor: null
        }
      });

      let callIndex = 0;
      mockedExecFile.mockImplementation((cmd: any, args: any, optionsOrCb: any, cb?: any) => {
        const callback = typeof optionsOrCb === 'function' ? optionsOrCb : cb;
        callIndex++;
        if (callIndex === 1) {
          // First call: osascript for default app detection
          expect(cmd).toBe('osascript');
          callback(null, 'Cursor\n');
        } else {
          // Second call: open -na Cursor --args --goto
          expect(cmd).toBe('open');
          expect(args).toEqual(['-na', 'Cursor', '--args', '--goto', '/path/to/file.ts:42:1']);
          callback(null);
        }
        return {} as any;
      });

      const result = await fileOpenerManager.openFile('/path/to/file.ts', { lineNumber: 42 });

      expect(result.success).toBe(true);
      expect(mockedExecFile).toHaveBeenCalledTimes(2);
    });

    it('should fall through to openWithDefault when detection fails', async () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' });

      mockSettingsManager.getSettings.mockReturnValue({
        ...defaultSettings,
        fileOpener: {
          extensions: {},
          defaultEditor: null
        }
      });

      let callIndex = 0;
      mockedExecFile.mockImplementation((cmd: any, _args: any, optionsOrCb: any, cb?: any) => {
        const callback = typeof optionsOrCb === 'function' ? optionsOrCb : cb;
        callIndex++;
        if (callIndex === 1) {
          // osascript fails
          expect(cmd).toBe('osascript');
          callback(new Error('osascript failed'));
        } else {
          // Fallback to system default
          expect(cmd).toBe('open');
          callback(null);
        }
        return {} as any;
      });

      const result = await fileOpenerManager.openFile('/path/to/file.ts', { lineNumber: 42 });

      expect(result.success).toBe(true);
      // Should fall through to openWithDefault
      expect(mockedExecFile).toHaveBeenCalledTimes(2);
    });

    it('should fall through to openWithDefault when detected app is unknown', async () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' });

      mockSettingsManager.getSettings.mockReturnValue({
        ...defaultSettings,
        fileOpener: {
          extensions: {},
          defaultEditor: null
        }
      });

      let callIndex = 0;
      mockedExecFile.mockImplementation((cmd: any, _args: any, optionsOrCb: any, cb?: any) => {
        const callback = typeof optionsOrCb === 'function' ? optionsOrCb : cb;
        callIndex++;
        if (callIndex === 1) {
          // osascript returns an unknown app
          expect(cmd).toBe('osascript');
          callback(null, 'UnknownEditor\n');
        } else {
          // Fallback to system default
          expect(cmd).toBe('open');
          callback(null);
        }
        return {} as any;
      });

      const result = await fileOpenerManager.openFile('/path/to/file.ts', { lineNumber: 42 });

      expect(result.success).toBe(true);
      expect(mockedExecFile).toHaveBeenCalledTimes(2);
    });

    it('should detect Xcode as default app and use xed for line number', async () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' });

      mockSettingsManager.getSettings.mockReturnValue({
        ...defaultSettings,
        fileOpener: {
          extensions: {},
          defaultEditor: null
        }
      });

      let callIndex = 0;
      mockedExecFile.mockImplementation((cmd: any, args: any, optionsOrCb: any, cb?: any) => {
        const callback = typeof optionsOrCb === 'function' ? optionsOrCb : cb;
        callIndex++;
        if (callIndex === 1) {
          // First call: osascript detects Xcode
          expect(cmd).toBe('osascript');
          callback(null, 'Xcode\n');
        } else {
          // Second call: xed -l 42 file
          expect(cmd).toBe('xed');
          expect(args).toEqual(['-l', '42', '/path/to/file.swift']);
          callback(null);
        }
        return {} as any;
      });

      const result = await fileOpenerManager.openFile('/path/to/file.swift', { lineNumber: 42 });

      expect(result.success).toBe(true);
      expect(mockedExecFile).toHaveBeenCalledTimes(2);
    });

    it('should skip detection on non-macOS platforms', async () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });

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

      const result = await fileOpenerManager.openFile('/path/to/file.ts', { lineNumber: 42 });

      expect(result.success).toBe(true);
      // Should only call openWithDefault (1 call), not osascript
      expect(mockedExecFile).toHaveBeenCalledTimes(1);
      expect(mockedExecFile).toHaveBeenCalledWith(
        'open',
        ['/path/to/file.ts'],
        expect.any(Function)
      );
    });

    it('should not detect default app when no line number is provided', async () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' });

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

      const result = await fileOpenerManager.openFile('/path/to/file.ts');

      expect(result.success).toBe(true);
      // Should only call openWithDefault (1 call), not osascript
      expect(mockedExecFile).toHaveBeenCalledTimes(1);
      expect(mockedExecFile).toHaveBeenCalledWith(
        'open',
        ['/path/to/file.ts'],
        expect.any(Function)
      );
    });
  });
});
