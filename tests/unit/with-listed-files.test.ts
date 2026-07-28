import type { DirectoryInfo, FileSearchSettings } from '../../src/types';

// `withListedFiles` is the shared merge step for both the native detection path
// and the app-directory-override path, so its only real dependency is
// `listDirectory`. Mock that and the merge logic is fully observable.
const mockListDirectory = vi.hoisted(() => vi.fn());
vi.mock('../../src/utils/file-search', () => ({
  listDirectory: mockListDirectory
}));

vi.mock('../../src/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  maskSensitiveData: vi.fn((data: unknown) => data)
}));

import { withListedFiles } from '../../src/managers/window/strategies/native-detector-strategy';

const settings = (overrides: Partial<FileSearchSettings> = {}): FileSearchSettings => ({
  respectGitignore: true,
  excludePatterns: [],
  includePatterns: [],
  maxFiles: 5000,
  includeHidden: true,
  maxDepth: null,
  followSymlinks: false,
  fdPath: null,
  symlinkScanRoots: [],
  ...overrides
});

beforeEach(() => {
  mockListDirectory.mockReset();
});

describe('withListedFiles', () => {
  test('returns the base untouched when it carries no directory', async () => {
    const base: DirectoryInfo = { success: true };

    await expect(withListedFiles(base, null)).resolves.toBe(base);
    expect(mockListDirectory).not.toHaveBeenCalled();
  });

  test('prefers listResult.directory over base.directory (symlink alias recovery)', async () => {
    mockListDirectory.mockResolvedValue({
      directory: '/Users/me/ghq/github.com/me/vault',
      files: [{ name: 'a.md', path: '/a.md', isDirectory: false }],
      searchMode: 'recursive'
    });

    const result = await withListedFiles({ success: true, directory: '/private/var/vault' }, null);

    expect(result.directory).toBe('/Users/me/ghq/github.com/me/vault');
    expect(result.fileCount).toBe(1);
    expect(result.searchMode).toBe('recursive');
  });

  test('sets the fd hint even when the listing also reported an error', async () => {
    // The hint assignment deliberately sits outside the error branch: a missing
    // fd is the likely cause of the error, so the user must still see it.
    mockListDirectory.mockResolvedValue({
      error: 'fd failed',
      directory: '/should/not/win',
      fdAvailable: false
    });

    const result = await withListedFiles({ success: true, directory: '/base/dir' }, null);

    expect(result.hint).toBe('Install fd for file search: brew install fd');
    expect(result.filesError).toBe('fd failed');
    // The error branch skips the merge, so the alias must not have been applied.
    expect(result.directory).toBe('/base/dir');
    expect(result.files).toBeUndefined();
  });

  test('reports maxFiles alongside the limit flag only when settings provide it', async () => {
    mockListDirectory.mockResolvedValue({ directory: '/base/dir', partial: true });

    const withoutSettings = await withListedFiles({ success: true, directory: '/base/dir' }, null);
    expect(withoutSettings.fileLimitReached).toBe(true);
    expect(withoutSettings.maxFiles).toBeUndefined();

    const withSettings = await withListedFiles(
      { success: true, directory: '/base/dir' },
      settings({ maxFiles: 10 })
    );
    expect(withSettings.fileLimitReached).toBe(true);
    expect(withSettings.maxFiles).toBe(10);
  });

  test('returns the base unchanged when listing throws', async () => {
    mockListDirectory.mockRejectedValue(new Error('boom'));
    const base: DirectoryInfo = { success: true, directory: '/base/dir' };

    // Identity, not equality: nothing may be merged onto a failed listing.
    await expect(withListedFiles(base, null)).resolves.toBe(base);
  });
});
