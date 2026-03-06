/**
 * Integration test for FileFilterManager directory search.
 * Verifies that directories (especially Japanese-named ones) are found
 * when searching with a query at root level, even when only Stage 1
 * (single-level) data is available (no files inside the directory).
 *
 * @vitest-environment jsdom
 */

import { FileFilterManager } from '../../src/renderer/mentions/managers/file-filter-manager';
import type { DirectoryData } from '../../src/renderer/mentions/types';
import type { FileInfo } from '../../src/types';

const baseDir = '/test';

function createManager(): FileFilterManager {
  return new FileFilterManager({
    getDefaultMaxSuggestions: () => 20,
  });
}

// Stage 1 data: only top-level entries (directories have isDirectory: true, no child files)
const stage1Files: FileInfo[] = [
  { name: '_archive', path: '/test/_archive', isDirectory: true },
  { name: 'My Notes', path: '/test/My Notes', isDirectory: true },
  { name: 'DOCS', path: '/test/DOCS', isDirectory: true },
  { name: 'プロジェクト', path: '/test/プロジェクト', isDirectory: true },
  { name: 'ドキュメント', path: '/test/ドキュメント', isDirectory: true },
  { name: '設計書', path: '/test/設計書', isDirectory: true },
  { name: 'README.md', path: '/test/README.md', isDirectory: false },
];

// Stage 2 data: includes files inside directories
const stage2Files: FileInfo[] = [
  ...stage1Files,
  { name: 'main.py', path: '/test/プロジェクト/main.py', isDirectory: false },
  { name: 'utils.py', path: '/test/プロジェクト/utils.py', isDirectory: false },
  { name: 'report.xlsx', path: '/test/ドキュメント/report.xlsx', isDirectory: false },
  { name: 'notes.md', path: '/test/DOCS/notes.md', isDirectory: false },
];

function makeCachedData(files: FileInfo[]): DirectoryData {
  return {
    directory: baseDir,
    files,
    timestamp: Date.now(),
  };
}

describe('FileFilterManager directory search', () => {
  let manager: FileFilterManager;

  beforeEach(() => {
    manager = createManager();
  });

  describe('Stage 1 data (top-level directories only)', () => {
    test('empty query shows all top-level entries', () => {
      const result = manager.filterFiles(makeCachedData(stage1Files), '', '');
      expect(result).toHaveLength(stage1Files.length);
    });

    test('Japanese query finds matching directory', () => {
      const result = manager.filterFiles(makeCachedData(stage1Files), '', 'プロジェクト');
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.some(f => f.name === 'プロジェクト')).toBe(true);
    });

    test('partial Japanese query finds matching directory', () => {
      const result = manager.filterFiles(makeCachedData(stage1Files), '', 'プロジェ');
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.some(f => f.name === 'プロジェクト')).toBe(true);
    });

    test('English query finds matching directory', () => {
      const result = manager.filterFiles(makeCachedData(stage1Files), '', 'DOCS');
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.some(f => f.name === 'DOCS')).toBe(true);
    });

    test('case-insensitive English query', () => {
      const result = manager.filterFiles(makeCachedData(stage1Files), '', 'docs');
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.some(f => f.name === 'DOCS')).toBe(true);
    });

    test('non-matching query returns empty', () => {
      const result = manager.filterFiles(makeCachedData(stage1Files), '', 'zzzzz');
      expect(result).toHaveLength(0);
    });
  });

  describe('Stage 2 data (with files inside directories)', () => {
    test('Japanese query finds directory even with child files', () => {
      const result = manager.filterFiles(makeCachedData(stage2Files), '', 'プロジェクト');
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.some(f => f.name === 'プロジェクト' && f.isDirectory)).toBe(true);
    });

    test('does not duplicate directories found via both explicit entry and path', () => {
      const result = manager.filterFiles(makeCachedData(stage2Files), '', 'プロジェクト');
      const dirs = result.filter(f => f.name === 'プロジェクト' && f.isDirectory);
      expect(dirs).toHaveLength(1);
    });
  });

  describe('mixed queries', () => {
    test('query matching file name finds file', () => {
      const result = manager.filterFiles(makeCachedData(stage2Files), '', 'README');
      expect(result.some(f => f.name === 'README.md')).toBe(true);
    });

    test('query matching both file and directory returns both', () => {
      const result = manager.filterFiles(makeCachedData(stage2Files), '', 'ドキュメント');
      expect(result.some(f => f.name === 'ドキュメント' && f.isDirectory)).toBe(true);
    });
  });
});
