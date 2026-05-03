import { describe, it, expect, vi } from 'vitest';

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn(), removeAllListeners: vi.fn() },
  clipboard: { writeText: vi.fn(), readImage: vi.fn(), clear: vi.fn() },
  dialog: { showMessageBox: vi.fn() },
  app: { getApplicationInfoForProtocol: vi.fn(), getAppPath: vi.fn(() => '') }
}));

vi.mock('../../src/config/app-config', () => ({
  default: { platform: { isMac: true }, paths: { imagesDir: '/tmp' }, timing: {} }
}));

vi.mock('../../src/utils/utils', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  pasteWithNativeTool: vi.fn(),
  activateAndPasteWithNativeTool: vi.fn(),
  sleep: vi.fn(() => Promise.resolve()),
  checkAccessibilityPermission: vi.fn(),
  SecureErrors: {}
}));

vi.mock('../../src/utils/native-tools/app-detection', () => ({
  isITerm2: vi.fn(() => false),
  isCmux: vi.fn(() => false),
  isGhostty: vi.fn(() => false),
  isWezTerm: vi.fn(() => false),
  getITermSessionId: vi.fn()
}));

import { splitTextByImagePaths } from '../../src/handlers/paste-handler';

describe('splitTextByImagePaths', () => {
  it('returns single text segment when no image path is present', () => {
    const segments = splitTextByImagePaths('hello world');
    expect(segments).toEqual([{ type: 'text', content: 'hello world' }]);
  });

  it('extracts a single image path with surrounding text', () => {
    const segments = splitTextByImagePaths('テスト\n/Users/nkmr/.prompt-line/images/20260503_191755.png');
    expect(segments).toEqual([
      { type: 'text', content: 'テスト\n' },
      { type: 'image', content: '/Users/nkmr/.prompt-line/images/20260503_191755.png' }
    ]);
  });

  it('extracts an image path at the start with trailing text', () => {
    const segments = splitTextByImagePaths('/Users/me/img.png describe this');
    expect(segments).toEqual([
      { type: 'image', content: '/Users/me/img.png' },
      { type: 'text', content: ' describe this' }
    ]);
  });

  it('extracts multiple image paths', () => {
    const segments = splitTextByImagePaths('see /a.png and /b.jpg too');
    expect(segments).toEqual([
      { type: 'text', content: 'see ' },
      { type: 'image', content: '/a.png' },
      { type: 'text', content: ' and ' },
      { type: 'image', content: '/b.jpg' },
      { type: 'text', content: ' too' }
    ]);
  });

  it('returns the path-only case as a single image segment', () => {
    const segments = splitTextByImagePaths('/Users/x/photo.jpeg');
    expect(segments).toEqual([{ type: 'image', content: '/Users/x/photo.jpeg' }]);
  });

  it('matches relative @-prefixed paths used by Prompt Line', () => {
    const segments = splitTextByImagePaths('look at @images/20260503_191755.png please');
    expect(segments).toEqual([
      { type: 'text', content: 'look at ' },
      { type: 'image', content: '@images/20260503_191755.png' },
      { type: 'text', content: ' please' }
    ]);
  });

  it('supports png/jpg/jpeg/gif/webp extensions', () => {
    expect(splitTextByImagePaths('a.png')).toHaveLength(1);
    expect(splitTextByImagePaths('a.jpg')).toHaveLength(1);
    expect(splitTextByImagePaths('a.jpeg')).toHaveLength(1);
    expect(splitTextByImagePaths('a.gif')).toHaveLength(1);
    expect(splitTextByImagePaths('a.webp')).toHaveLength(1);
  });

  it('does not match non-image extensions', () => {
    const segments = splitTextByImagePaths('config.json and main.ts');
    expect(segments).toEqual([{ type: 'text', content: 'config.json and main.ts' }]);
  });

  it('captures absolute paths that contain spaces', () => {
    const segments = splitTextByImagePaths('see /Users/me/My Pictures/foo.png please');
    expect(segments).toEqual([
      { type: 'text', content: 'see ' },
      { type: 'image', content: '/Users/me/My Pictures/foo.png' },
      { type: 'text', content: ' please' }
    ]);
  });

  it('captures @-prefixed relative paths that contain spaces', () => {
    const segments = splitTextByImagePaths('テスト @My Images/20260503_191755.png');
    expect(segments).toEqual([
      { type: 'text', content: 'テスト ' },
      { type: 'image', content: '@My Images/20260503_191755.png' },
      { type: 'text', content: '' }
    ].filter(s => s.content.length > 0));
  });

  it('does not greedily swallow trailing prose after a path with spaces', () => {
    const segments = splitTextByImagePaths('これは /foo.png のテストです');
    expect(segments).toEqual([
      { type: 'text', content: 'これは ' },
      { type: 'image', content: '/foo.png' },
      { type: 'text', content: ' のテストです' }
    ]);
  });
});

describe('splitTextByImagePaths — newlines stay inside text segments', () => {
  it('keeps newline-bearing prefix as one text segment, then image', () => {
    const segments = splitTextByImagePaths('テスト\n/Users/nkmr/.prompt-line/images/foo.png');
    expect(segments).toEqual([
      { type: 'text', content: 'テスト\n' },
      { type: 'image', content: '/Users/nkmr/.prompt-line/images/foo.png' }
    ]);
  });

  it('keeps multi-line text without image paths as a single text segment', () => {
    const segments = splitTextByImagePaths('line1\nline2\nline3');
    expect(segments).toEqual([{ type: 'text', content: 'line1\nline2\nline3' }]);
  });

  it('splits text/image/text-with-newlines correctly', () => {
    const segments = splitTextByImagePaths('describe /a.png\nthen do X\nthen /b.jpg');
    expect(segments).toEqual([
      { type: 'text', content: 'describe ' },
      { type: 'image', content: '/a.png' },
      { type: 'text', content: '\nthen do X\nthen ' },
      { type: 'image', content: '/b.jpg' }
    ]);
  });
});
