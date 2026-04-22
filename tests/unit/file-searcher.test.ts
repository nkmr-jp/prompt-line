/* eslint-disable @typescript-eslint/no-explicit-any */

vi.mock('child_process', () => ({
  execFile: vi.fn()
}));

// Override the global path mock from tests/setup.ts to expose the
// methods file-searcher actually uses (resolve, normalize, basename).
vi.mock('path', async () => {
  const actual = await vi.importActual<typeof import('path')>('path');
  return { ...actual, default: actual };
});

vi.mock('fs/promises', () => ({
  lstat: vi.fn(async () => ({ isDirectory: () => true, isSymbolicLink: () => false })),
  realpath: vi.fn(async (p: string) => p),
  stat: vi.fn(async () => ({ isDirectory: () => true })),
  readdir: vi.fn(async () => [])
}));

vi.mock('../../src/utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

import { execFile } from 'child_process';
import { listDirectory } from '../../src/utils/file-search/file-searcher';

const mockedExecFile = vi.mocked(execFile);

type CapturedCall = { file: string; args: string[]; cwd?: string };

function mockExecFileCapturing(): { calls: CapturedCall[] } {
  const calls: CapturedCall[] = [];
  mockedExecFile.mockImplementation(((file: any, args: any, options: any, callback: any) => {
    const argList: string[] = Array.isArray(args) ? args : [];
    const cb = typeof options === 'function' ? options : callback;
    const cwd = typeof options === 'object' && options ? (options as any).cwd : undefined;

    if (argList.includes('--version')) {
      cb(null, 'fd 9.0.0', '');
      return;
    }

    calls.push({ file, args: argList, cwd });
    cb(null, '', '');
  }) as any);
  return { calls };
}

describe('listDirectory followSymlinks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('passes --follow to fd when followSymlinks is true', async () => {
    const { calls } = mockExecFileCapturing();

    await listDirectory('/tmp/test-dir', {
      respectGitignore: true,
      excludePatterns: [],
      includePatterns: [],
      maxFiles: 100,
      includeHidden: true,
      maxDepth: null,
      followSymlinks: true,
      fdPath: null
    });

    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0]!.args).toContain('--follow');
  });

  test('omits --follow when followSymlinks is false', async () => {
    const { calls } = mockExecFileCapturing();

    await listDirectory('/tmp/test-dir', {
      respectGitignore: true,
      excludePatterns: [],
      includePatterns: [],
      maxFiles: 100,
      includeHidden: true,
      maxDepth: null,
      followSymlinks: false,
      fdPath: null
    });

    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0]!.args).not.toContain('--follow');
  });

  test('passes --follow to includePattern search when followSymlinks is true', async () => {
    const { calls } = mockExecFileCapturing();

    await listDirectory('/tmp/test-dir', {
      respectGitignore: true,
      excludePatterns: [],
      includePatterns: ['.agentsws/**'],
      maxFiles: 100,
      includeHidden: true,
      maxDepth: null,
      followSymlinks: true,
      fdPath: null
    });

    // First call is the main fd search; subsequent calls are per-includePattern.
    const includeCall = calls.find(c => c.cwd && c.cwd.endsWith('/.agentsws'));
    expect(includeCall, 'expected fd to be invoked for the includePattern').toBeDefined();
    expect(includeCall!.args).toContain('--follow');
  });

  test('omits --follow from includePattern search when followSymlinks is false', async () => {
    const { calls } = mockExecFileCapturing();

    await listDirectory('/tmp/test-dir', {
      respectGitignore: true,
      excludePatterns: [],
      includePatterns: ['.agentsws/**'],
      maxFiles: 100,
      includeHidden: true,
      maxDepth: null,
      followSymlinks: false,
      fdPath: null
    });

    const includeCall = calls.find(c => c.cwd && c.cwd.endsWith('/.agentsws'));
    expect(includeCall).toBeDefined();
    expect(includeCall!.args).not.toContain('--follow');
  });
});
