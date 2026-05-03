import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';

const { mockExecFile } = vi.hoisted(() => ({
  mockExecFile: vi.fn()
}));

vi.mock('electron', () => ({
  app: { getApplicationInfoForProtocol: vi.fn() }
}));

vi.mock('child_process', () => ({
  execFile: mockExecFile
}));

vi.mock('../../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

vi.mock('../../src/utils/native-tools/paths', () => ({
  KEYBOARD_SIMULATOR_PATH: '/mock/keyboard-simulator',
  WINDOW_DETECTOR_PATH: '/mock/window-detector'
}));

const ORIGINAL_PLATFORM = process.platform;

import { activateAndPasteWithNativeTool } from '../../src/utils/native-tools/paste-operations';

describe('activateAndPasteWithNativeTool — cmux/Ghostty input text dispatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(process, 'platform', { value: 'darwin' });
  });

  it('routes cmux paste through osascript input text with text passed via argv', async () => {
    mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
      cb(null, '', '');
    });

    await activateAndPasteWithNativeTool({ name: 'cmux', bundleId: 'com.cmuxterm.app' }, 'hello\nworld');

    expect(mockExecFile).toHaveBeenCalledTimes(1);
    const [cmd, args] = mockExecFile.mock.calls[0]!;
    expect(cmd).toBe('osascript');
    expect(args[0]).toBe('-e');
    expect(args[1]).toContain('tell application "cmux"');
    expect(args[1]).toContain('input text (item 1 of argv)');
    expect(args[1]).toContain('focused terminal of selected tab of front window');
    // text is passed verbatim through argv (after `--`) so newlines/quotes do
    // not need to be re-escaped by us
    expect(args[2]).toBe('--');
    expect(args[3]).toBe('hello\nworld');
  });

  it('routes Ghostty paste through osascript input text with text passed via argv', async () => {
    mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
      cb(null, '', '');
    });

    await activateAndPasteWithNativeTool(
      { name: 'Ghostty', bundleId: 'com.mitchellh.ghostty' },
      'テスト\n/Users/nkmr/.prompt-line/images/foo.png'
    );

    expect(mockExecFile).toHaveBeenCalledTimes(1);
    const [cmd, args] = mockExecFile.mock.calls[0]!;
    expect(cmd).toBe('osascript');
    expect(args[1]).toContain('tell application "Ghostty"');
    expect(args[1]).toContain('input text (item 1 of argv)');
    expect(args[3]).toBe('テスト\n/Users/nkmr/.prompt-line/images/foo.png');
  });

  it('does NOT invoke keyboard-simulator for cmux/Ghostty (avoids ineffective Cmd+V)', async () => {
    mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
      cb(null, '', '');
    });

    await activateAndPasteWithNativeTool({ name: 'cmux', bundleId: 'com.cmuxterm.app' }, 'x');
    await activateAndPasteWithNativeTool({ name: 'Ghostty', bundleId: 'com.mitchellh.ghostty' }, 'y');

    const usedKeyboardSimulator = mockExecFile.mock.calls.some(
      ([cmd]) => cmd === '/mock/keyboard-simulator'
    );
    expect(usedKeyboardSimulator).toBe(false);
  });

  it('rejects when AppleScript input text fails', async () => {
    mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
      cb(new Error('osascript failed'), '', 'cmux not running');
    });

    await expect(
      activateAndPasteWithNativeTool({ name: 'cmux', bundleId: 'com.cmuxterm.app' }, 'x')
    ).rejects.toThrow('osascript failed');
  });

  it('falls through to keyboard-simulator activate-and-paste-bundle for non-cmux/Ghostty apps', async () => {
    mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
      cb(null, JSON.stringify({ success: true }), '');
    });

    await activateAndPasteWithNativeTool({ name: 'iTerm2', bundleId: 'com.googlecode.iterm2' }, 'x');

    expect(mockExecFile).toHaveBeenCalledTimes(1);
    const firstCall = mockExecFile.mock.calls[0]!;
    expect(firstCall[0]).toBe('/mock/keyboard-simulator');
    expect(firstCall[1]).toEqual(['activate-and-paste-bundle', 'com.googlecode.iterm2']);
  });

  afterAll(() => {
    Object.defineProperty(process, 'platform', { value: ORIGINAL_PLATFORM });
  });
});
