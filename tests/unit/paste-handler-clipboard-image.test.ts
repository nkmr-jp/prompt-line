import { describe, it, expect, vi, beforeEach } from 'vitest';

// Electron 44 replaced clipboard.readImage() with the async W3C-modelled
// clipboard.read(), so the image path now goes through ClipboardItem.getType.
// readImage() resolved a file URL by itself; read() does not, so the two
// pasteboard shapes measured on macOS are covered here:
//   - image data      -> types include image/png
//   - a copied file   -> types include text/uri-list and NO image/png

const isIsolatedInstance = vi.fn(() => false);
const clipboardRead = vi.fn();
const clipboardClear = vi.fn();
const createFromBuffer = vi.fn();
const createFromPath = vi.fn();
const writeFile = vi.fn(async () => {});
const mkdir = vi.fn(async () => {});

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn(), removeAllListeners: vi.fn() },
  clipboard: {
    writeText: vi.fn(async () => {}),
    read: () => clipboardRead(),
    clear: () => clipboardClear()
  },
  nativeImage: {
    createFromBuffer: (buf: Buffer) => createFromBuffer(buf),
    createFromPath: (p: string) => createFromPath(p)
  },
  dialog: { showMessageBox: vi.fn() },
  app: { getApplicationInfoForProtocol: vi.fn(), getAppPath: vi.fn(() => '') }
}));

vi.mock('fs', () => ({
  promises: {
    writeFile: (...a: unknown[]) => writeFile(...(a as [])),
    mkdir: (...a: unknown[]) => mkdir(...(a as []))
  }
}));

vi.mock('../../src/config/app-config', () => ({
  default: { platform: { isMac: true }, paths: { imagesDir: '/tmp/images' }, timing: {} },
  isIsolatedInstance: () => isIsolatedInstance()
}));

vi.mock('../../src/utils/utils', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  pasteWithNativeTool: vi.fn(),
  activateAndPasteWithNativeTool: vi.fn(),
  sleep: vi.fn(async () => {}),
  checkAccessibilityPermission: vi.fn(),
  SecureErrors: { OPERATION_FAILED: 'Operation failed' }
}));

vi.mock('../../src/utils/native-tools/app-detection', () => ({
  isITerm2: vi.fn(() => false),
  isCmux: vi.fn(() => false),
  isGhostty: vi.fn(() => false),
  isWezTerm: vi.fn(() => false),
  getITermSessionId: vi.fn()
}));

import PasteHandler from '../../src/handlers/paste-handler';

/** A ClipboardItem-like whose getType hands back a Blob-like per MIME type. */
function item(payloads: Record<string, Buffer | Error>) {
  const types = Object.keys(payloads);
  return {
    types,
    getType: vi.fn(async (mime: string) => {
      const value = payloads[mime];
      if (value === undefined) throw new Error(`The type '${mime}' was not found in the ClipboardItem`);
      if (value instanceof Error) throw value;
      return {
        arrayBuffer: async () =>
          value.buffer.slice(value.byteOffset, value.byteOffset + value.length)
      };
    })
  };
}

function image(empty: boolean, png = Buffer.from('encoded')) {
  return { isEmpty: () => empty, toPNG: () => png };
}

function pasteImage(settings: Record<string, unknown> = {}) {
  const handler = new PasteHandler(
    {} as never,
    {} as never,
    {} as never,
    { getDirectory: () => '/proj' } as never,
    { getSettings: () => settings } as never
  );
  return (handler as unknown as {
    handlePasteImage: (e: unknown) => Promise<{ success: boolean; error?: string; path?: string; relativePath?: string }>;
  }).handlePasteImage({});
}

describe('paste-image via the Electron 44 clipboard API', () => {
  beforeEach(() => {
    // mockReset, not clearAllMocks: an unconsumed mockReturnValueOnce survives
    // clearing and then outranks the next test's mockReturnValue.
    clipboardRead.mockReset();
    clipboardClear.mockReset();
    createFromBuffer.mockReset();
    createFromPath.mockReset();
    writeFile.mockReset();
    mkdir.mockReset();
    isIsolatedInstance.mockReturnValue(false);
    writeFile.mockResolvedValue(undefined);
    mkdir.mockResolvedValue(undefined);
  });

  describe('image data on the pasteboard', () => {
    it('decodes an image/png item, writes it 0600 and clears the pasteboard', async () => {
      clipboardRead.mockResolvedValue([item({ 'image/png': Buffer.from('the-png') })]);
      createFromBuffer.mockReturnValue(image(false, Buffer.from('encoded')));

      const result = await pasteImage();

      expect(result.success).toBe(true);
      expect(Buffer.from(createFromBuffer.mock.calls[0]![0] as Buffer).toString()).toBe('the-png');

      const [written, data, options] = writeFile.mock.calls[0] as unknown as [string, Buffer, { mode: number }];
      expect(written).toBe('/tmp/images/' + written.split('/').pop());
      expect(data.toString()).toBe('encoded');
      expect(options.mode).toBe(0o600);
      expect(result.path).toBe(written);

      const [, mkdirOptions] = mkdir.mock.calls[0] as unknown as [string, { recursive: boolean; mode: number }];
      expect(mkdirOptions).toEqual({ recursive: true, mode: 0o700 });
      // The pasteboard is wiped once the image has been consumed.
      expect(clipboardClear).toHaveBeenCalledTimes(1);
    });

    it('returns a relative path when imagesDirectory is relative to the project', async () => {
      clipboardRead.mockResolvedValue([item({ 'image/png': Buffer.from('png') })]);
      createFromBuffer.mockReturnValue(image(false));

      const result = await pasteImage({ imagesDirectory: 'screenshots' });

      expect(result.success).toBe(true);
      expect(result.path!.startsWith('/proj/screenshots/')).toBe(true);
      expect(result.relativePath!.startsWith('screenshots/')).toBe(true);
    });

    // imagesDirectory is a verbatim passthrough from user settings, so it can
    // carry a trailing slash. Comparing a normalize()d dir against dirname()
    // would then reject every paste.
    it('accepts an imagesDirectory written with a trailing slash', async () => {
      clipboardRead.mockResolvedValue([item({ 'image/png': Buffer.from('png') })]);
      createFromBuffer.mockReturnValue(image(false));

      const result = await pasteImage({ imagesDirectory: 'screenshots/' });

      expect(result).toMatchObject({ success: true });
      expect(writeFile).toHaveBeenCalled();
    });
  });

  describe('an image copied as a file (Finder Cmd+C)', () => {
    // The regression this guards: such a pasteboard offers text/uri-list and
    // no image/png at all. Electron 43's readImage() followed the URL; the
    // W3C API does not, so dropping this fallback silently broke Finder paste.
    it('follows a text/uri-list file URL when no image/png is offered', async () => {
      clipboardRead.mockResolvedValue([
        item({ 'text/uri-list': Buffer.from('file:///Users/me/shot.png\n') })
      ]);
      createFromPath.mockReturnValue(image(false, Buffer.from('from-file')));

      const result = await pasteImage();

      expect(result.success).toBe(true);
      expect(createFromPath).toHaveBeenCalledWith('/Users/me/shot.png');
      expect(createFromBuffer).not.toHaveBeenCalled();
      const [, data] = writeFile.mock.calls[0] as unknown as [string, Buffer];
      expect(data.toString()).toBe('from-file');
    });

    it('decodes a percent-encoded file URL', async () => {
      clipboardRead.mockResolvedValue([
        item({ 'text/uri-list': Buffer.from('file:///Users/me/my%20shot.png') })
      ]);
      createFromPath.mockReturnValue(image(false));

      await expect(pasteImage()).resolves.toMatchObject({ success: true });
      expect(createFromPath).toHaveBeenCalledWith('/Users/me/my shot.png');
    });

    it('skips comment and blank lines in a uri-list', async () => {
      clipboardRead.mockResolvedValue([
        item({ 'text/uri-list': Buffer.from('# comment\n\nfile:///Users/me/a.png\n') })
      ]);
      createFromPath.mockReturnValue(image(false));

      await expect(pasteImage()).resolves.toMatchObject({ success: true });
      expect(createFromPath).toHaveBeenCalledWith('/Users/me/a.png');
    });

    it('reports no image when the copied file is not an image', async () => {
      clipboardRead.mockResolvedValue([
        item({ 'text/uri-list': Buffer.from('file:///Users/me/notes.txt') })
      ]);
      createFromPath.mockReturnValue(image(true));

      await expect(pasteImage()).resolves.toMatchObject({ success: false, error: 'No image in clipboard' });
      expect(writeFile).not.toHaveBeenCalled();
    });

    it('ignores a non-file URL such as a dragged web link', async () => {
      clipboardRead.mockResolvedValue([
        item({ 'text/uri-list': Buffer.from('https://example.com/a.png') })
      ]);

      await expect(pasteImage()).resolves.toMatchObject({ success: false, error: 'No image in clipboard' });
      expect(createFromPath).not.toHaveBeenCalled();
    });

    it('falls back to the file URL when the png in the same item fails to decode', async () => {
      clipboardRead.mockResolvedValue([
        item({ 'image/png': Buffer.from('broken'), 'text/uri-list': Buffer.from('file:///Users/me/a.png') })
      ]);
      createFromBuffer.mockReturnValue(image(true));
      createFromPath.mockReturnValue(image(false));

      await expect(pasteImage()).resolves.toMatchObject({ success: true });
      expect(createFromPath).toHaveBeenCalledWith('/Users/me/a.png');
    });
  });

  describe('failure handling', () => {
    it('reports no image when the clipboard is empty', async () => {
      clipboardRead.mockResolvedValue([]);

      await expect(pasteImage()).resolves.toMatchObject({ success: false, error: 'No image in clipboard' });
      expect(writeFile).not.toHaveBeenCalled();
      expect(clipboardClear).not.toHaveBeenCalled();
    });

    it('reports no image when the item carries neither an image nor a file URL', async () => {
      clipboardRead.mockResolvedValue([item({ 'text/plain': Buffer.from('hello') })]);

      await expect(pasteImage()).resolves.toMatchObject({ success: false, error: 'No image in clipboard' });
      expect(createFromBuffer).not.toHaveBeenCalled();
    });

    // `types` is a snapshot while getType() reads the live pasteboard, so a
    // clipboard that changed in between yields zero bytes rather than an error.
    it('treats a zero-byte image/png as a lost race rather than a decodable image', async () => {
      clipboardRead.mockResolvedValue([item({ 'image/png': Buffer.alloc(0) })]);

      await expect(pasteImage()).resolves.toMatchObject({ success: false, error: 'No image in clipboard' });
      expect(createFromBuffer).not.toHaveBeenCalled();
    });

    it('keeps scanning after one item throws', async () => {
      clipboardRead.mockResolvedValue([
        item({ 'image/png': new Error("The type 'image/png' was not found in the ClipboardItem") }),
        item({ 'image/png': Buffer.from('good') })
      ]);
      createFromBuffer.mockReturnValue(image(false));

      await expect(pasteImage()).resolves.toMatchObject({ success: true });
    });

    // Internal messages must not cross the IPC boundary.
    it('reports a generic error when the clipboard read itself fails', async () => {
      clipboardRead.mockRejectedValue(new Error('internal pasteboard detail'));

      const result = await pasteImage();

      expect(result).toMatchObject({ success: false, error: 'Operation failed' });
      expect(result.error).not.toContain('internal pasteboard detail');
    });
  });

  // An isolated verification instance shares the system clipboard with the app
  // the user is really running, and this path wipes it.
  it('does not touch the clipboard in an isolated instance', async () => {
    isIsolatedInstance.mockReturnValue(true);

    await expect(pasteImage()).resolves.toMatchObject({ success: false, error: 'No image in clipboard' });
    expect(clipboardRead).not.toHaveBeenCalled();
    expect(clipboardClear).not.toHaveBeenCalled();
    expect(writeFile).not.toHaveBeenCalled();
  });
});
