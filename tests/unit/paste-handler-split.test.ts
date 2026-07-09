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

import { wrapImagePathsInBackticks } from '../../src/handlers/paste-handler';

describe('wrapImagePathsInBackticks', () => {
  it('returns text unchanged when no image path is present', () => {
    expect(wrapImagePathsInBackticks('hello world')).toBe('hello world');
  });

  it('wraps a single image path with surrounding text', () => {
    expect(wrapImagePathsInBackticks('テスト\n/Users/nkmr/.prompt-line/images/20260503_191755.png')).toBe(
      'テスト\n`/Users/nkmr/.prompt-line/images/20260503_191755.png`'
    );
  });

  it('wraps an image path at the start with trailing text', () => {
    expect(wrapImagePathsInBackticks('/Users/me/img.png describe this')).toBe(
      '`/Users/me/img.png` describe this'
    );
  });

  it('wraps multiple image paths', () => {
    expect(wrapImagePathsInBackticks('see /a.png and /b.jpg too')).toBe(
      'see `/a.png` and `/b.jpg` too'
    );
  });

  it('wraps the path-only case', () => {
    expect(wrapImagePathsInBackticks('/Users/x/photo.jpeg')).toBe('`/Users/x/photo.jpeg`');
  });

  it('wraps relative @-prefixed paths used by Prompt Line', () => {
    expect(wrapImagePathsInBackticks('look at @images/20260503_191755.png please')).toBe(
      'look at `@images/20260503_191755.png` please'
    );
  });

  it('supports png/jpg/jpeg/gif/webp extensions', () => {
    expect(wrapImagePathsInBackticks('a.png')).toBe('`a.png`');
    expect(wrapImagePathsInBackticks('a.jpg')).toBe('`a.jpg`');
    expect(wrapImagePathsInBackticks('a.jpeg')).toBe('`a.jpeg`');
    expect(wrapImagePathsInBackticks('a.gif')).toBe('`a.gif`');
    expect(wrapImagePathsInBackticks('a.webp')).toBe('`a.webp`');
  });

  it('does not match non-image extensions', () => {
    expect(wrapImagePathsInBackticks('config.json and main.ts')).toBe('config.json and main.ts');
  });

  it('wraps absolute paths that contain spaces', () => {
    expect(wrapImagePathsInBackticks('see /Users/me/My Pictures/foo.png please')).toBe(
      'see `/Users/me/My Pictures/foo.png` please'
    );
  });

  it('wraps @-prefixed relative paths that contain spaces', () => {
    expect(wrapImagePathsInBackticks('テスト @My Images/20260503_191755.png')).toBe(
      'テスト `@My Images/20260503_191755.png`'
    );
  });

  it('does not greedily swallow trailing prose after a path with spaces', () => {
    expect(wrapImagePathsInBackticks('これは /foo.png のテストです')).toBe(
      'これは `/foo.png` のテストです'
    );
  });
});

describe('wrapImagePathsInBackticks — newlines are preserved', () => {
  it('keeps the newline-bearing prefix intact around the wrapped path', () => {
    expect(wrapImagePathsInBackticks('テスト\n/Users/nkmr/.prompt-line/images/foo.png')).toBe(
      'テスト\n`/Users/nkmr/.prompt-line/images/foo.png`'
    );
  });

  it('leaves multi-line text without image paths unchanged', () => {
    expect(wrapImagePathsInBackticks('line1\nline2\nline3')).toBe('line1\nline2\nline3');
  });

  it('wraps paths within multi-line text correctly', () => {
    expect(wrapImagePathsInBackticks('describe /a.png\nthen do X\nthen /b.jpg')).toBe(
      'describe `/a.png`\nthen do X\nthen `/b.jpg`'
    );
  });
});

describe('wrapImagePathsInBackticks — boundary correctness', () => {
  it('does not match an image extension that is a mere substring of a longer token', () => {
    expect(wrapImagePathsInBackticks('readme.pngx')).toBe('readme.pngx');
  });

  it('does not match an image extension followed by another extension', () => {
    expect(wrapImagePathsInBackticks('image.png.bak')).toBe('image.png.bak');
  });

  it('does not double-wrap a path the user already quoted in backticks', () => {
    expect(
      wrapImagePathsInBackticks('As discussed, `/Users/me/screenshot.png` was already generated')
    ).toBe('As discussed, `/Users/me/screenshot.png` was already generated');
  });
});

describe('wrapImagePathsInBackticks — performance safety', () => {
  it('stays fast on a long non-matching, whitespace-free paste (no catastrophic backtracking)', () => {
    const pathological = 'a'.repeat(1024 * 1024); // 1MB, at the paste size limit
    const start = Date.now();
    expect(wrapImagePathsInBackticks(pathological)).toBe(pathological);
    expect(Date.now() - start).toBeLessThan(500);
  });
});
