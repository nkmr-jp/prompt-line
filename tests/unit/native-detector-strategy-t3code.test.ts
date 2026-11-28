import { beforeEach, describe, expect, test, vi } from 'vitest';

const { execFileMock, listDirectoryMock } = vi.hoisted(() => ({
  execFileMock: vi.fn(),
  listDirectoryMock: vi.fn(),
}));

vi.mock('child_process', () => ({
  execFile: execFileMock,
}));

vi.mock('../../src/config/app-config', () => ({
  default: {
    platform: { isMac: true },
  },
}));

vi.mock('../../src/utils/utils', () => ({
  DIRECTORY_DETECTOR_PATH: '/mock/directory-detector',
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../src/utils/file-search', () => ({
  listDirectory: listDirectoryMock,
}));

import { NativeDetectorStrategy } from '../../src/managers/window/strategies/native-detector-strategy';

describe('NativeDetectorStrategy T3 Code terminal focus forwarding', () => {
  const strategy = new NativeDetectorStrategy();

  beforeEach(() => {
    execFileMock.mockReset();
    listDirectoryMock.mockReset();
    listDirectoryMock.mockResolvedValue({
      directory: '/tmp/project',
      files: [],
      fileCount: 0,
    });
  });

  test('passes --terminal-focused when previousApp.terminalFocused is true', async () => {
    execFileMock.mockImplementation((_path, _args, _opts, cb) => {
      cb(null, JSON.stringify({ success: true, directory: '/tmp/project', method: 't3code-terminal' }));
    });

    const result = await strategy.detect(
      3000,
      { name: 'T3 Code (Custom)', bundleId: 'com.t3tools.t3code.custom', terminalFocused: true },
      null
    );

    expect(execFileMock).toHaveBeenCalledTimes(1);
    expect(execFileMock.mock.calls[0]?.[1]).toEqual([
      'detect',
      '--bundleId',
      'com.t3tools.t3code.custom',
      '--terminal-focused',
    ]);
    expect(result?.directory).toBe('/tmp/project');
    expect(result?.method).toBe('t3code-terminal');
  });

  test('omits --terminal-focused when terminalFocused is absent or false', async () => {
    execFileMock.mockImplementation((_path, _args, _opts, cb) => {
      cb(null, JSON.stringify({ success: true, directory: '/tmp/project', method: 't3code-window-title' }));
    });

    await strategy.detect(
      3000,
      { name: 'T3 Code (Custom)', bundleId: 'com.t3tools.t3code.custom' },
      null
    );

    expect(execFileMock).toHaveBeenCalledTimes(1);
    expect(execFileMock.mock.calls[0]?.[1]).toEqual([
      'detect',
      '--bundleId',
      'com.t3tools.t3code.custom',
    ]);
  });
});
