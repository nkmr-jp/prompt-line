import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

const isIsolatedInstance = vi.fn(() => false);

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn(), removeAllListeners: vi.fn() },
  clipboard: { writeText: vi.fn(async () => {}), read: vi.fn(async () => []), clear: vi.fn() },
  nativeImage: { createFromBuffer: vi.fn() },
  dialog: { showMessageBox: vi.fn(() => Promise.resolve({ response: 1 })) },
  app: { getApplicationInfoForProtocol: vi.fn(), getAppPath: vi.fn(() => '') }
}));

vi.mock('../../src/config/app-config', () => ({
  default: {
    platform: { isMac: true },
    paths: { imagesDir: '/tmp' },
    timing: { windowHideDelay: 1, appFocusDelay: 1 }
  },
  isIsolatedInstance: () => isIsolatedInstance()
}));

vi.mock('../../src/utils/utils', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  pasteWithNativeTool: vi.fn(),
  activateAndPasteWithNativeTool: vi.fn(),
  sleep: vi.fn(() => Promise.resolve()),
  checkAccessibilityPermission: vi.fn(),
  SecureErrors: { OPERATION_FAILED: 'failed', PERMISSION_DENIED: 'denied' }
}));

vi.mock('../../src/utils/native-tools/app-detection', () => ({
  isITerm2: vi.fn(() => false),
  isCmux: vi.fn(() => false),
  isGhostty: vi.fn(() => false),
  isWezTerm: vi.fn(() => false),
  getITermSessionId: vi.fn()
}));

import { clipboard } from 'electron';
import { activateAndPasteWithNativeTool, pasteWithNativeTool } from '../../src/utils/utils';
import PasteHandler from '../../src/handlers/paste-handler';

/**
 * The isolated verification instance must never touch anything the user shares
 * with their running app: the system clipboard, or the frontmost application.
 */
describe('PasteHandler in an isolated instance', () => {
  const previousApp = { name: 'Terminal', bundleId: 'com.apple.Terminal' };
  let handler: PasteHandler;
  let hideInputWindow: ReturnType<typeof vi.fn>;
  let addToHistory: ReturnType<typeof vi.fn>;
  let clearDraft: ReturnType<typeof vi.fn>;

  const paste = (text: string): Promise<unknown> =>
    (handler as unknown as {
      handlePasteText: (event: unknown, text: string) => Promise<unknown>;
    }).handlePasteText({}, text);

  beforeEach(() => {
    vi.clearAllMocks();
    // clearAllMocks does not drop implementations, so a test that makes the
    // clipboard write reject or hang would leak into the next one.
    (clipboard.writeText as unknown as Mock).mockImplementation(async () => {});
    isIsolatedInstance.mockReturnValue(false);

    hideInputWindow = vi.fn(() => Promise.resolve());
    addToHistory = vi.fn(() => Promise.resolve());
    clearDraft = vi.fn(() => Promise.resolve());

    handler = new PasteHandler(
      {
        getPreviousApp: vi.fn(() => previousApp),
        hideInputWindow,
        focusPreviousApp: vi.fn(() => Promise.resolve(true))
      } as never,
      { addToHistory } as never,
      { clearDraft } as never,
      { getDirectory: vi.fn(() => '/tmp') } as never,
      { getSettings: vi.fn(() => ({})) } as never
    );
  });

  // Electron 44 made writeText async, and the window is hidden and Cmd+V fired
  // as soon as this resolves. Without the await the paste races the write, and
  // nothing else in the suite notices: every other test hands back a mock that
  // resolves in the same microtask, so awaited and un-awaited look identical.
  it('waits for the clipboard write to finish before hiding the window', async () => {
    let releaseWrite: () => void = () => {};
    const written: string[] = [];
    (clipboard.writeText as unknown as Mock).mockImplementation(
      (value: string) =>
        new Promise<void>(resolve => {
          releaseWrite = () => {
            written.push(value);
            resolve();
          };
        })
    );

    const pasted = paste('hello');
    await Promise.resolve();

    expect(written).toEqual([]);
    expect(hideInputWindow).not.toHaveBeenCalled();

    releaseWrite();
    await pasted;

    expect(written).toEqual(['hello']);
    expect(hideInputWindow).toHaveBeenCalled();
  });

  // A failed write leaves the pasteboard holding whatever it held before, so
  // reporting success here would fire Cmd+V and paste the wrong thing.
  it('reports failure when the clipboard write rejects', async () => {
    (clipboard.writeText as unknown as Mock).mockRejectedValue(new Error('pasteboard busy'));

    await expect(paste('hello')).resolves.toEqual({ success: false, error: 'failed' });
    expect(activateAndPasteWithNativeTool).not.toHaveBeenCalled();
  });

  it('writes the clipboard and pastes natively when not isolated', async () => {
    const result = await paste('hello');

    expect(result).toEqual({ success: true });
    expect(clipboard.writeText).toHaveBeenCalledWith('hello');
    expect(activateAndPasteWithNativeTool).toHaveBeenCalledWith(previousApp);
  });

  it('skips the clipboard and the native paste when isolated', async () => {
    isIsolatedInstance.mockReturnValue(true);

    const result = await paste('hello');

    expect(result).toEqual({ success: true, warning: 'Isolated instance: native paste skipped' });
    expect(clipboard.clear).not.toHaveBeenCalled();
    expect(clipboard.writeText).not.toHaveBeenCalled();
    expect(activateAndPasteWithNativeTool).not.toHaveBeenCalled();
    expect(pasteWithNativeTool).not.toHaveBeenCalled();
  });

  it('still records history and clears the draft when isolated', async () => {
    isIsolatedInstance.mockReturnValue(true);

    await paste('hello');

    expect(addToHistory).toHaveBeenCalled();
    expect(clearDraft).toHaveBeenCalled();
  });
});
