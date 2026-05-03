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

describe('activateAndPasteWithNativeTool — terminal paste dispatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(process, 'platform', { value: 'darwin' });
  });

  it('routes cmux paste through osascript paste_from_clipboard (bracketed paste via terminal pipeline)', async () => {
    mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
      cb(null, '', '');
    });

    await activateAndPasteWithNativeTool({ name: 'cmux', bundleId: 'com.cmuxterm.app' }, 'hello\nworld');

    expect(mockExecFile).toHaveBeenCalledTimes(1);
    const [cmd, args] = mockExecFile.mock.calls[0]!;
    expect(cmd).toBe('osascript');
    expect(args[0]).toBe('-e');
    expect(args[1]).toContain('tell application "cmux"');
    expect(args[1]).toContain('perform action "paste_from_clipboard"');
    expect(args[1]).toContain('focused terminal of selected tab of front window');
  });

  it('routes Ghostty paste through osascript paste_from_clipboard', async () => {
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
    expect(args[1]).toContain('perform action "paste_from_clipboard"');
  });

  it('routes WezTerm paste through `wezterm cli send-text` with text on stdin', async () => {
    const fakeStdin = { end: vi.fn() };
    mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
      // First call: osascript activate (returns success)
      // Second call: wezterm cli send-text (returns success)
      cb(null, '', '');
      return { stdin: fakeStdin };
    });

    await activateAndPasteWithNativeTool(
      { name: 'WezTerm', bundleId: 'com.github.wez.wezterm' },
      'テスト\n/Users/nkmr/.prompt-line/images/foo.png'
    );

    // Two execFile calls: activate, then wezterm cli send-text
    expect(mockExecFile).toHaveBeenCalledTimes(2);
    const activateCall = mockExecFile.mock.calls[0]!;
    expect(activateCall[0]).toBe('osascript');
    expect(activateCall[1][1]).toContain('WezTerm');

    const sendTextCall = mockExecFile.mock.calls[1]!;
    expect(sendTextCall[0]).toBe('/Applications/WezTerm.app/Contents/MacOS/wezterm');
    expect(sendTextCall[1]).toEqual(['cli', 'send-text']);
    expect(fakeStdin.end).toHaveBeenCalledWith('テスト\n/Users/nkmr/.prompt-line/images/foo.png', 'utf8');
  });

  it('does NOT invoke keyboard-simulator for cmux/Ghostty/WezTerm', async () => {
    const fakeStdin = { end: vi.fn() };
    mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
      cb(null, '', '');
      return { stdin: fakeStdin };
    });

    await activateAndPasteWithNativeTool({ name: 'cmux', bundleId: 'com.cmuxterm.app' }, 'x');
    await activateAndPasteWithNativeTool({ name: 'Ghostty', bundleId: 'com.mitchellh.ghostty' }, 'y');
    await activateAndPasteWithNativeTool({ name: 'WezTerm', bundleId: 'com.github.wez.wezterm' }, 'z');

    const usedKeyboardSimulator = mockExecFile.mock.calls.some(
      ([cmd]) => cmd === '/mock/keyboard-simulator'
    );
    expect(usedKeyboardSimulator).toBe(false);
  });

  it('rejects when AppleScript paste_from_clipboard fails', async () => {
    mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
      cb(new Error('osascript failed'), '', 'cmux not running');
    });

    await expect(
      activateAndPasteWithNativeTool({ name: 'cmux', bundleId: 'com.cmuxterm.app' }, 'x')
    ).rejects.toThrow('osascript failed');
  });

  it('falls through to keyboard-simulator activate-and-paste-bundle for non-special apps', async () => {
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
