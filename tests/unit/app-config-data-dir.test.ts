import os from 'os';
import path from 'path';
import { resolveUserDataDir, isIsolatedInstance } from '../../src/config/app-config';

describe('resolveUserDataDir', () => {
  const originalDataDir = process.env.PROMPT_LINE_DATA_DIR;
  const originalIsolated = process.env.PROMPT_LINE_ISOLATED;

  afterEach(() => {
    if (originalDataDir === undefined) delete process.env.PROMPT_LINE_DATA_DIR;
    else process.env.PROMPT_LINE_DATA_DIR = originalDataDir;

    if (originalIsolated === undefined) delete process.env.PROMPT_LINE_ISOLATED;
    else process.env.PROMPT_LINE_ISOLATED = originalIsolated;
  });

  test('defaults to ~/.prompt-line', () => {
    delete process.env.PROMPT_LINE_DATA_DIR;

    expect(resolveUserDataDir()).toBe(path.join(os.homedir(), '.prompt-line'));
  });

  test('falls back to the default when the override is blank', () => {
    process.env.PROMPT_LINE_DATA_DIR = '   ';

    expect(resolveUserDataDir()).toBe(path.join(os.homedir(), '.prompt-line'));
  });

  test('honors an absolute override', () => {
    process.env.PROMPT_LINE_DATA_DIR = '/tmp/prompt-line-isolated/data';

    expect(resolveUserDataDir()).toBe('/tmp/prompt-line-isolated/data');
  });

  test('expands a leading ~', () => {
    process.env.PROMPT_LINE_DATA_DIR = '~/.prompt-line-isolated/wt/data';

    expect(resolveUserDataDir()).toBe(path.join(os.homedir(), '.prompt-line-isolated/wt/data'));
  });

  test('resolves a relative override to an absolute path', () => {
    process.env.PROMPT_LINE_DATA_DIR = './isolated-data';

    expect(resolveUserDataDir()).toBe(path.resolve('./isolated-data'));
  });

  test('does not treat ~name as a home-relative path', () => {
    process.env.PROMPT_LINE_DATA_DIR = '/tmp/~backup/data';

    expect(resolveUserDataDir()).toBe('/tmp/~backup/data');
  });
});

describe('isIsolatedInstance', () => {
  const original = process.env.PROMPT_LINE_ISOLATED;

  afterEach(() => {
    if (original === undefined) delete process.env.PROMPT_LINE_ISOLATED;
    else process.env.PROMPT_LINE_ISOLATED = original;
  });

  test('is false by default', () => {
    delete process.env.PROMPT_LINE_ISOLATED;

    expect(isIsolatedInstance()).toBe(false);
  });

  test('is true only for an exact "1"', () => {
    process.env.PROMPT_LINE_ISOLATED = '1';
    expect(isIsolatedInstance()).toBe(true);

    process.env.PROMPT_LINE_ISOLATED = 'true';
    expect(isIsolatedInstance()).toBe(false);
  });
});
