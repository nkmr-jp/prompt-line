import { describe, it, expect, vi, beforeEach } from 'vitest';

// Electron 44 replaced clipboard.readImage() with the async W3C-modelled
// clipboard.read(), so the image path now goes through ClipboardItem.getType.
// These cover the branches that migration introduced.

const clipboardRead = vi.fn();
const createFromBuffer = vi.fn();
const writeFile = vi.fn(async () => {});
const mkdir = vi.fn(async () => {});

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn(), removeAllListeners: vi.fn() },
  clipboard: {
    writeText: vi.fn(async () => {}),
    read: () => clipboardRead(),
    clear: vi.fn()
  },
  nativeImage: { createFromBuffer: (buf: Buffer) => createFromBuffer(buf) },
  dialog: { showMessageBox: vi.fn() },
  app: { getApplicationInfoForProtocol: vi.fn(), getAppPath: vi.fn(() => '') }
}));

vi.mock('fs', () => ({
  promises: { writeFile: (...a: unknown[]) => writeFile(...(a as [])), mkdir: (...a: unknown[]) => mkdir(...(a as [])) }
}));

vi.mock('../../src/config/app-config', () => ({
  default: { platform: { isMac: true }, paths: { imagesDir: '/tmp/images' }, timing: {} },
  isIsolatedInstance: () => false
}));

vi.mock('../../src/utils/utils', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  pasteWithNativeTool: vi.fn(),
  activateAndPasteWithNativeTool: vi.fn(),
  sleep: vi.fn(async () => {}),
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

import PasteHandler from '../../src/handlers/paste-handler';

/** A ClipboardItem-like whose getType hands back a Blob-like for `bytes`. */
function item(types: string[], bytes = Buffer.from('png-bytes')) {
  return {
    types,
    getType: vi.fn(async (mime: string) => {
      if (!types.includes(mime)) throw new Error(`not present: ${mime}`);
      return { arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length) };
    })
  };
}

function image(empty: boolean, png = Buffer.from('saved')) {
  return { isEmpty: () => empty, toPNG: () => png };
}

function pasteImage() {
  const handler = new PasteHandler(
    {} as never, // windowManager
    {} as never, // historyManager
    {} as never, // draftManager
    { getDirectory: () => null } as never,
    { getSettings: () => ({}) } as never
  );
  return (handler as unknown as {
    handlePasteImage: (e: unknown) => Promise<{ success: boolean; error?: string; path?: string }>;
  }).handlePasteImage({});
}

describe('paste-image via the Electron 44 clipboard API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    writeFile.mockResolvedValue(undefined);
    mkdir.mockResolvedValue(undefined);
  });

  it('reports no image when the clipboard is empty', async () => {
    clipboardRead.mockResolvedValue([]);

    await expect(pasteImage()).resolves.toMatchObject({ success: false, error: 'No image in clipboard' });
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('reports no image when the only item carries no image/png type', async () => {
    clipboardRead.mockResolvedValue([item(['text/plain'])]);

    await expect(pasteImage()).resolves.toMatchObject({ success: false, error: 'No image in clipboard' });
    expect(createFromBuffer).not.toHaveBeenCalled();
  });

  it('decodes an image/png item and writes it with owner-only permissions', async () => {
    clipboardRead.mockResolvedValue([item(['image/png'], Buffer.from('the-png'))]);
    createFromBuffer.mockReturnValue(image(false, Buffer.from('encoded')));

    const result = await pasteImage();

    expect(result.success).toBe(true);
    expect(Buffer.from(createFromBuffer.mock.calls[0]![0] as Buffer).toString()).toBe('the-png');
    const [, data, options] = writeFile.mock.calls[0] as unknown as [string, Buffer, { mode: number }];
    expect(data.toString()).toBe('encoded');
    expect(options.mode).toBe(0o600);
  });

  it('ignores an item whose png decodes to an empty image and falls through to the next', async () => {
    clipboardRead.mockResolvedValue([
      item(['image/png'], Buffer.from('broken')),
      item(['image/png'], Buffer.from('good'))
    ]);
    createFromBuffer
      .mockReturnValueOnce(image(true))
      .mockReturnValueOnce(image(false, Buffer.from('encoded')));

    await expect(pasteImage()).resolves.toMatchObject({ success: true });
    expect(createFromBuffer).toHaveBeenCalledTimes(2);
  });

  it('reports no image when every png item decodes to an empty image', async () => {
    clipboardRead.mockResolvedValue([item(['image/png'])]);
    createFromBuffer.mockReturnValue(image(true));

    await expect(pasteImage()).resolves.toMatchObject({ success: false, error: 'No image in clipboard' });
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('surfaces a clipboard read failure as an error result rather than throwing', async () => {
    clipboardRead.mockRejectedValue(new Error('pasteboard unavailable'));

    await expect(pasteImage()).resolves.toMatchObject({ success: false, error: 'pasteboard unavailable' });
  });
});
