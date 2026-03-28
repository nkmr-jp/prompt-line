import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockExecuteAppleScriptSafely } = vi.hoisted(() => ({
  mockExecuteAppleScriptSafely: vi.fn()
}));

vi.mock('electron', () => ({
  app: { getApplicationInfoForProtocol: vi.fn() }
}));

vi.mock('child_process', () => ({
  execFile: vi.fn()
}));

vi.mock('../../src/utils/apple-script-sanitizer', () => ({
  executeAppleScriptSafely: mockExecuteAppleScriptSafely,
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

import { isITerm2, getITermSessionId } from '../../src/utils/native-tools/app-detection';

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

describe('getITermSessionId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return session ID from AppleScript', async () => {
    mockExecuteAppleScriptSafely.mockResolvedValue('w0t0p0:12345678-ABCD');
    const result = await getITermSessionId();
    expect(result).toBe('w0t0p0:12345678-ABCD');
    expect(mockExecuteAppleScriptSafely).toHaveBeenCalledWith(
      expect.stringContaining('ITERM_SESSION_ID'),
      expect.any(Number)
    );
  });

  it('should return undefined on AppleScript failure', async () => {
    mockExecuteAppleScriptSafely.mockRejectedValue(new Error('Script failed'));
    const result = await getITermSessionId();
    expect(result).toBeUndefined();
  });

  it('should return undefined for empty result', async () => {
    mockExecuteAppleScriptSafely.mockResolvedValue('');
    const result = await getITermSessionId();
    expect(result).toBeUndefined();
  });

  it('should trim whitespace from result', async () => {
    mockExecuteAppleScriptSafely.mockResolvedValue('  w0t0p0:SESSION  \n');
    const result = await getITermSessionId();
    expect(result).toBe('w0t0p0:SESSION');
  });
});
