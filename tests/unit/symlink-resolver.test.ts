/* eslint-disable @typescript-eslint/no-explicit-any */

// The resolver pulls in real Node modules; restore real `path` and `os` so
// `join`, `homedir()`, etc. behave normally inside the unit under test.
vi.mock('path', async () => {
  const actual = await vi.importActual<typeof import('path')>('path');
  return { ...actual, default: actual };
});
vi.mock('os', async () => {
  const actual = await vi.importActual<typeof import('os')>('os');
  const mocked = { ...actual, homedir: () => '/home/test' };
  return { ...mocked, default: mocked };
});

vi.mock('fs', () => ({
  promises: {
    realpath: vi.fn(),
    readdir: vi.fn()
  }
}));

vi.mock('../../src/utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

import { promises as fs } from 'fs';
import {
  resolveSymlinkAlias,
  resetSymlinkResolverCache
} from '../../src/utils/file-search/symlink-resolver';

const realpathMock = vi.mocked(fs.realpath);
const readdirMock = vi.mocked(fs.readdir);

type DirentLike = {
  name: string;
  isSymbolicLink: () => boolean;
  isDirectory: () => boolean;
};

function dirent(name: string, type: 'symlink' | 'dir' | 'file'): DirentLike {
  return {
    name,
    isSymbolicLink: () => type === 'symlink',
    isDirectory: () => type === 'dir'
  };
}

/**
 * Set up a virtual filesystem in the readdir/realpath mocks. `tree` maps
 * directory paths to their entries; `links` maps symlink absolute paths to
 * their realpath target.
 */
function mockFs(tree: Record<string, DirentLike[]>, links: Record<string, string>): void {
  readdirMock.mockImplementation((async (dir: string) => {
    if (tree[dir]) return tree[dir];
    const err: any = new Error('ENOENT');
    err.code = 'ENOENT';
    throw err;
  }) as any);
  realpathMock.mockImplementation((async (p: string) => {
    if (links[p]) return links[p];
    return p;
  }) as any);
}

describe('resolveSymlinkAlias', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSymlinkResolverCache();
  });

  test('returns null when scanRoots is empty or undefined', async () => {
    expect(await resolveSymlinkAlias('/anything', undefined)).toBeNull();
    expect(await resolveSymlinkAlias('/anything', [])).toBeNull();
  });

  test('returns null when no symlink in scan roots matches', async () => {
    mockFs(
      {
        '/home/test/ghq': [dirent('plain', 'dir')],
        '/home/test/ghq/plain': []
      },
      {}
    );
    const result = await resolveSymlinkAlias('/private/elsewhere/vault', ['~/ghq']);
    expect(result).toBeNull();
  });

  test('substitutes the symlink alias when input equals the target', async () => {
    mockFs(
      {
        '/home/test/ghq': [dirent('github.com', 'dir')],
        '/home/test/ghq/github.com': [dirent('user', 'dir')],
        '/home/test/ghq/github.com/user': [dirent('vault', 'symlink')]
      },
      { '/home/test/ghq/github.com/user/vault': '/private/Mobile/vault' }
    );

    const result = await resolveSymlinkAlias('/private/Mobile/vault', ['~/ghq']);
    expect(result).toBe('/home/test/ghq/github.com/user/vault');
  });

  test('substitutes when input is a child of the symlink target', async () => {
    mockFs(
      {
        '/home/test/ghq': [dirent('github.com', 'dir')],
        '/home/test/ghq/github.com': [dirent('user', 'dir')],
        '/home/test/ghq/github.com/user': [dirent('vault', 'symlink')]
      },
      { '/home/test/ghq/github.com/user/vault': '/private/Mobile/vault' }
    );

    const result = await resolveSymlinkAlias('/private/Mobile/vault/sub/file.md', ['~/ghq']);
    expect(result).toBe('/home/test/ghq/github.com/user/vault/sub/file.md');
  });

  test('prefers the longest target match when multiple symlinks chain to the same area', async () => {
    mockFs(
      {
        '/home/test/ghq': [dirent('a', 'symlink'), dirent('b', 'symlink')]
      },
      {
        '/home/test/ghq/a': '/real/area',
        '/home/test/ghq/b': '/real/area/sub'
      }
    );
    // /real/area/sub/file matches both targets; the longest (b) wins.
    const result = await resolveSymlinkAlias('/real/area/sub/file', ['~/ghq']);
    expect(result).toBe('/home/test/ghq/b/file');
  });

  test('ignores dangling symlinks (realpath rejection)', async () => {
    mockFs(
      {
        '/home/test/ghq': [dirent('broken', 'symlink')]
      },
      {}
    );
    realpathMock.mockImplementation((async (p: string) => {
      if (p === '/home/test/ghq/broken') {
        const err: any = new Error('ENOENT');
        err.code = 'ENOENT';
        throw err;
      }
      return p;
    }) as any);
    const result = await resolveSymlinkAlias('/real/area/sub', ['~/ghq']);
    expect(result).toBeNull();
  });

  test('only follows directories — does not recurse into symlinks while scanning', async () => {
    mockFs(
      {
        '/home/test/ghq': [dirent('linktree', 'symlink'), dirent('realdir', 'dir')],
        '/home/test/ghq/realdir': [dirent('nested', 'symlink')]
      },
      {
        '/home/test/ghq/linktree': '/elsewhere',
        '/home/test/ghq/realdir/nested': '/real/target'
      }
    );

    const result = await resolveSymlinkAlias('/real/target', ['~/ghq']);
    expect(result).toBe('/home/test/ghq/realdir/nested');
    // The symlink at level 1 should not be recursed into.
    expect(readdirMock).not.toHaveBeenCalledWith('/home/test/ghq/linktree', expect.anything());
  });

  test('returns null on non-absolute input path', async () => {
    mockFs({}, {});
    const result = await resolveSymlinkAlias('relative/path', ['~/ghq']);
    expect(result).toBeNull();
  });

  test('reuses the cache across calls with the same roots', async () => {
    mockFs(
      {
        '/home/test/ghq': [dirent('vault', 'symlink')]
      },
      { '/home/test/ghq/vault': '/real/vault' }
    );

    await resolveSymlinkAlias('/real/vault', ['~/ghq']);
    const callsAfterFirst = readdirMock.mock.calls.length;
    await resolveSymlinkAlias('/real/vault', ['~/ghq']);
    expect(readdirMock.mock.calls).toHaveLength(callsAfterFirst);
  });
});
