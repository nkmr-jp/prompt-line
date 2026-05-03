import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockExecFile } = vi.hoisted(() => ({
  mockExecFile: vi.fn()
}));

vi.mock('electron', () => ({
  app: { getApplicationInfoForProtocol: vi.fn() }
}));

vi.mock('child_process', () => ({
  execFile: mockExecFile
}));

vi.mock('../../src/utils/apple-script-sanitizer', () => ({
  executeAppleScriptSafely: vi.fn(),
  validateAppleScriptSecurity: vi.fn(() => [])
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
  WINDOW_DETECTOR_PATH: '/mock/window-detector'
}));

import { isITerm2, isCmux, isGhostty, getITermSessionId } from '../../src/utils/native-tools/app-detection';

describe('isITerm2', () => {
  it('should return true for AppInfo with iTerm2 bundleId', () => {
    expect(isITerm2({ name: 'iTerm2', bundleId: 'com.googlecode.iterm2' })).toBe(true);
  });

  it('should return false for AppInfo with different bundleId', () => {
    expect(isITerm2({ name: 'Terminal', bundleId: 'com.apple.Terminal' })).toBe(false);
  });

  it('should return true for string "iTerm2"', () => {
    expect(isITerm2('iTerm2')).toBe(true);
  });

  it('should return true for string "iterm" (case-insensitive)', () => {
    expect(isITerm2('iterm')).toBe(true);
    expect(isITerm2('iTerm')).toBe(true);
    expect(isITerm2('ITERM2')).toBe(true);
  });

  it('should return false for null', () => {
    expect(isITerm2(null)).toBe(false);
  });

  it('should return false for other apps', () => {
    expect(isITerm2('Terminal')).toBe(false);
    expect(isITerm2({ name: 'VS Code', bundleId: 'com.microsoft.VSCode' })).toBe(false);
  });
});

describe('isCmux', () => {
  it('should return true for AppInfo with cmux bundleId', () => {
    expect(isCmux({ name: 'cmux', bundleId: 'com.cmuxterm.app' })).toBe(true);
  });

  it('should return false for AppInfo with different bundleId', () => {
    expect(isCmux({ name: 'cmux', bundleId: 'com.mitchellh.ghostty' })).toBe(false);
  });

  it('should return true for string "cmux" (case-insensitive)', () => {
    expect(isCmux('cmux')).toBe(true);
    expect(isCmux('CMUX')).toBe(true);
    expect(isCmux('Cmux')).toBe(true);
  });

  it('should return false for null', () => {
    expect(isCmux(null)).toBe(false);
  });

  it('should return false for other terminals', () => {
    expect(isCmux('Terminal')).toBe(false);
    expect(isCmux({ name: 'iTerm2', bundleId: 'com.googlecode.iterm2' })).toBe(false);
    expect(isCmux({ name: 'Ghostty', bundleId: 'com.mitchellh.ghostty' })).toBe(false);
  });
});

describe('isGhostty', () => {
  it('should return true for AppInfo with Ghostty bundleId', () => {
    expect(isGhostty({ name: 'Ghostty', bundleId: 'com.mitchellh.ghostty' })).toBe(true);
  });

  it('should return false for AppInfo with cmux bundleId', () => {
    expect(isGhostty({ name: 'cmux', bundleId: 'com.cmuxterm.app' })).toBe(false);
  });

  it('should return true for string "ghostty" (case-insensitive)', () => {
    expect(isGhostty('ghostty')).toBe(true);
    expect(isGhostty('Ghostty')).toBe(true);
    expect(isGhostty('GHOSTTY')).toBe(true);
  });

  it('should return false for null', () => {
    expect(isGhostty(null)).toBe(false);
  });

  it('should return false for other terminals', () => {
    expect(isGhostty('Terminal')).toBe(false);
    expect(isGhostty({ name: 'iTerm2', bundleId: 'com.googlecode.iterm2' })).toBe(false);
    expect(isGhostty({ name: 'cmux', bundleId: 'com.cmuxterm.app' })).toBe(false);
  });
});

describe('getITermSessionId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return session unique ID from osascript', async () => {
    mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
      cb(null, '30088CC4-3726-4ECB-90CE-0DA3EA4AC757\n', '');
    });
    const result = await getITermSessionId();
    expect(result).toBe('30088CC4-3726-4ECB-90CE-0DA3EA4AC757');
    expect(mockExecFile).toHaveBeenCalledWith(
      'osascript',
      ['-e', expect.stringContaining('unique id')],
      expect.any(Object),
      expect.any(Function)
    );
  });

  it('should return undefined on execFile error', async () => {
    mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
      cb(new Error('Script failed'), '', '');
    });
    const result = await getITermSessionId();
    expect(result).toBeUndefined();
  });

  it('should return undefined for empty output', async () => {
    mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
      cb(null, '', '');
    });
    const result = await getITermSessionId();
    expect(result).toBeUndefined();
  });

  it('should trim whitespace from output', async () => {
    mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
      cb(null, '  30088CC4-3726-4ECB  \n', '');
    });
    const result = await getITermSessionId();
    expect(result).toBe('30088CC4-3726-4ECB');
  });
});
