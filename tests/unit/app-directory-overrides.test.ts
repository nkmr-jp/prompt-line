import { promises as fsp, mkdtempSync } from 'fs';

// Point app-config at a throwaway data dir *before* it is imported, so
// `config.paths.appDirectoriesFile` resolves inside the temp dir.
const dataDir = vi.hoisted(() => {
  const dir = require('fs').mkdtempSync('/tmp/pl-app-directories-');
  process.env.PROMPT_LINE_DATA_DIR = dir;
  return dir as string;
});

// The strategies module shells out to the Swift detector; stub it so the
// detector integration tests stay hermetic.
const listedFiles = vi.hoisted(() => vi.fn());
vi.mock('../../src/managers/window/strategies', () => ({
  NativeDetectorStrategy: class {
    getName() { return 'Native'; }
    isAvailable() { return true; }
    detect = vi.fn(async () => ({ success: true, directory: '/from/native', files: [] }));
  },
  withListedFiles: listedFiles
}));

vi.mock('../../src/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  maskSensitiveData: vi.fn((data: unknown) => data)
}));

import { AppDirectoryOverrides } from '../../src/managers/window/app-directory-overrides';
import DirectoryDetector from '../../src/managers/window/directory-detector';
import { logger } from '../../src/utils/logger';

function warningsMatching(needle: string): unknown[][] {
  return vi.mocked(logger.warn).mock.calls.filter(call => String(call[0]).includes(needle));
}

const overrideFile = `${dataDir}/app-directories.json`;
const BUNDLE_ID = 'com.example.someapp';

let projectDir: string;

async function writeOverrides(contents: string): Promise<void> {
  await fsp.writeFile(overrideFile, contents, 'utf8');
}

async function removeOverrides(): Promise<void> {
  await fsp.rm(overrideFile, { force: true });
}

beforeAll(() => {
  projectDir = mkdtempSync('/tmp/pl-project-');
});

beforeEach(async () => {
  await removeOverrides();
  vi.mocked(logger.warn).mockClear();
  vi.mocked(logger.info).mockClear();
  listedFiles.mockReset();
  listedFiles.mockImplementation(async (base: unknown) => base);
});

describe('AppDirectoryOverrides', () => {
  test('resolves the directory mapped to the app bundleId', async () => {
    await writeOverrides(JSON.stringify({ [BUNDLE_ID]: projectDir }));

    const overrides = new AppDirectoryOverrides();
    await expect(overrides.resolve({ name: 'Some App', bundleId: BUNDLE_ID })).resolves.toBe(projectDir);
  });

  test('returns null for an app that is not listed', async () => {
    await writeOverrides(JSON.stringify({ [BUNDLE_ID]: projectDir }));

    const overrides = new AppDirectoryOverrides();
    await expect(overrides.resolve({ name: 'Other', bundleId: 'com.example.other' })).resolves.toBeNull();
  });

  test('returns null when the file does not exist', async () => {
    const overrides = new AppDirectoryOverrides();
    await expect(overrides.resolve({ name: 'Some App', bundleId: BUNDLE_ID })).resolves.toBeNull();
  });

  test('returns null and does not throw when the file is malformed', async () => {
    await writeOverrides('{ this is not json');

    const overrides = new AppDirectoryOverrides();
    await expect(overrides.resolve({ name: 'Some App', bundleId: BUNDLE_ID })).resolves.toBeNull();
  });

  test('returns null when the file is empty', async () => {
    await writeOverrides('');

    const overrides = new AppDirectoryOverrides();
    await expect(overrides.resolve({ name: 'Some App', bundleId: BUNDLE_ID })).resolves.toBeNull();
  });

  test('returns null when the file is a JSON array instead of a map', async () => {
    await writeOverrides(JSON.stringify([projectDir]));

    const overrides = new AppDirectoryOverrides();
    await expect(overrides.resolve({ name: 'Some App', bundleId: BUNDLE_ID })).resolves.toBeNull();
  });

  test('ignores non-string and blank values', async () => {
    await writeOverrides(JSON.stringify({ [BUNDLE_ID]: 42, 'com.example.blank': '  ' }));

    const overrides = new AppDirectoryOverrides();
    await expect(overrides.resolve({ name: 'Some App', bundleId: BUNDLE_ID })).resolves.toBeNull();
    await expect(overrides.resolve({ name: 'Blank', bundleId: 'com.example.blank' })).resolves.toBeNull();
  });

  test('returns null for a stale entry whose directory no longer exists', async () => {
    await writeOverrides(JSON.stringify({ [BUNDLE_ID]: `${projectDir}/gone` }));

    const overrides = new AppDirectoryOverrides();
    await expect(overrides.resolve({ name: 'Some App', bundleId: BUNDLE_ID })).resolves.toBeNull();
  });

  test('returns null when the entry points at a file rather than a directory', async () => {
    const filePath = `${projectDir}/a-file.txt`;
    await fsp.writeFile(filePath, 'x', 'utf8');
    await writeOverrides(JSON.stringify({ [BUNDLE_ID]: filePath }));

    const overrides = new AppDirectoryOverrides();
    await expect(overrides.resolve({ name: 'Some App', bundleId: BUNDLE_ID })).resolves.toBeNull();
  });

  test('rejects relative and traversal paths', async () => {
    await writeOverrides(JSON.stringify({
      [BUNDLE_ID]: 'relative/dir',
      'com.example.traversal': `${projectDir}/../etc`
    }));

    const overrides = new AppDirectoryOverrides();
    await expect(overrides.resolve({ name: 'Some App', bundleId: BUNDLE_ID })).resolves.toBeNull();
    await expect(overrides.resolve({ name: 'T', bundleId: 'com.example.traversal' })).resolves.toBeNull();
  });

  test('returns null when the app has no bundleId', async () => {
    await writeOverrides(JSON.stringify({ [BUNDLE_ID]: projectDir }));

    const overrides = new AppDirectoryOverrides();
    await expect(overrides.resolve(null)).resolves.toBeNull();
    await expect(overrides.resolve('Some App')).resolves.toBeNull();
    await expect(overrides.resolve({ name: 'Some App' })).resolves.toBeNull();
  });

  test('a blank value disables an override without removing the key', async () => {
    await writeOverrides(JSON.stringify({ [BUNDLE_ID]: projectDir }));
    const overrides = new AppDirectoryOverrides();
    await expect(overrides.resolve({ name: 'Some App', bundleId: BUNDLE_ID })).resolves.toBe(projectDir);

    // Documented escape hatch for external tools: "no override right now".
    await writeOverrides(JSON.stringify({ [BUNDLE_ID]: '   ' }));
    await expect(overrides.resolve({ name: 'Some App', bundleId: BUNDLE_ID })).resolves.toBeNull();
    expect(warningsMatching('Ignoring non-absolute')).toHaveLength(0);
  });

  test('resolves prototype-derived bundle ids to null without throwing', async () => {
    await writeOverrides(JSON.stringify({ [BUNDLE_ID]: projectDir }));
    const overrides = new AppDirectoryOverrides();

    for (const bundleId of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
      await expect(overrides.resolve({ name: 'Weird', bundleId })).resolves.toBeNull();
    }
  });

  test('resolves prototype-derived bundle ids to null when the file is absent', async () => {
    const overrides = new AppDirectoryOverrides();

    for (const bundleId of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
      await expect(overrides.resolve({ name: 'Weird', bundleId })).resolves.toBeNull();
    }
  });

  test('accepts a raw __proto__ key in the file without losing the real entries', async () => {
    // The only case that discriminates `Object.create(null)` from `{}`: on a plain
    // object literal, assigning the parsed `__proto__` key is silently a no-op and
    // would swallow the entry instead of storing it alongside the real one.
    await writeOverrides(`{"__proto__": "${projectDir}", "${BUNDLE_ID}": "${projectDir}"}`);
    const overrides = new AppDirectoryOverrides();

    await expect(overrides.resolve({ name: 'Some App', bundleId: BUNDLE_ID })).resolves.toBe(projectDir);
    await expect(overrides.resolve({ name: 'Weird', bundleId: '__proto__' })).resolves.toBe(projectDir);
  });

  test('keeps the parse error message in the warning', async () => {
    await writeOverrides('{ this is not json');

    const overrides = new AppDirectoryOverrides();
    await expect(overrides.resolve({ name: 'Some App', bundleId: BUNDLE_ID })).resolves.toBeNull();

    const [call] = warningsMatching('Failed to read app-directories.json');
    // The exact wording is V8's and varies by Node version; what matters is that
    // the external tool that wrote the file gets a reason instead of `{}`.
    expect(typeof call?.[1]).toBe('string');
    expect(call?.[1]).not.toBe('');
  });

  test('warns once per file change for an invalid entry, not once per resolve', async () => {
    await writeOverrides(JSON.stringify({ [BUNDLE_ID]: 'relative/dir' }));

    const overrides = new AppDirectoryOverrides();
    await overrides.resolve({ name: 'Some App', bundleId: BUNDLE_ID });
    await overrides.resolve({ name: 'Some App', bundleId: BUNDLE_ID });

    expect(warningsMatching('Ignoring non-absolute')).toHaveLength(1);
  });

  test('keeps serving the cached map when mtime and size are both unchanged', async () => {
    const otherDir = mkdtempSync('/tmp/pl-project-');
    const first = JSON.stringify({ [BUNDLE_ID]: projectDir });
    const second = JSON.stringify({ [BUNDLE_ID]: otherDir });
    // mkdtemp names have a fixed length, so the two files are byte-identical in size.
    expect(second).toHaveLength(first.length);

    // Pin both writes to the same whole-millisecond timestamp; a stat-and-restore
    // round trip would lose the sub-millisecond part and invalidate the cache.
    const stamp = new Date(1700000000000);

    await writeOverrides(first);
    await fsp.utimes(overrideFile, stamp, stamp);

    const overrides = new AppDirectoryOverrides();
    await expect(overrides.resolve({ name: 'Some App', bundleId: BUNDLE_ID })).resolves.toBe(projectDir);

    await writeOverrides(second);
    await fsp.utimes(overrideFile, stamp, stamp);

    // Content changed but the cache key (mtime + size) did not: the stale value
    // is served until something observable about the file changes.
    await expect(overrides.resolve({ name: 'Some App', bundleId: BUNDLE_ID })).resolves.toBe(projectDir);
  });

  test('re-reads after the file is deleted and re-created', async () => {
    await writeOverrides(JSON.stringify({ [BUNDLE_ID]: projectDir }));
    const overrides = new AppDirectoryOverrides();
    await expect(overrides.resolve({ name: 'Some App', bundleId: BUNDLE_ID })).resolves.toBe(projectDir);

    await removeOverrides();
    await expect(overrides.resolve({ name: 'Some App', bundleId: BUNDLE_ID })).resolves.toBeNull();

    const otherDir = mkdtempSync('/tmp/pl-project-');
    await writeOverrides(JSON.stringify({ [BUNDLE_ID]: otherDir }));
    await expect(overrides.resolve({ name: 'Some App', bundleId: BUNDLE_ID })).resolves.toBe(otherDir);
  });

  test('re-reads only when the file changes', async () => {
    await writeOverrides(JSON.stringify({ [BUNDLE_ID]: projectDir }));
    const overrides = new AppDirectoryOverrides();
    const readSpy = vi.spyOn(fsp, 'readFile');

    await overrides.resolve({ name: 'Some App', bundleId: BUNDLE_ID });
    await overrides.resolve({ name: 'Some App', bundleId: BUNDLE_ID });
    expect(readSpy).toHaveBeenCalledTimes(1);

    const otherDir = mkdtempSync('/tmp/pl-project-other-');
    await writeOverrides(JSON.stringify({ [BUNDLE_ID]: otherDir, extra: otherDir }));

    await expect(overrides.resolve({ name: 'Some App', bundleId: BUNDLE_ID })).resolves.toBe(otherDir);
    expect(readSpy).toHaveBeenCalledTimes(2);
    readSpy.mockRestore();
  });
});

/**
 * The override is a *fallback*: live detection always wins, and the override is
 * consulted only when detection produced no directory. These pin that rule from
 * both sides.
 */
describe('DirectoryDetector app directory overrides', () => {
  // The unsupported-app payload the Swift detector returns for apps with no cwd
  // to detect - an error and no directory. The primary case for an override.
  const UNSUPPORTED_APP = { error: 'Not a supported terminal or IDE application' };

  function detectorWithOverrideCandidate(): DirectoryDetector {
    const detector = new DirectoryDetector(null);
    detector.updatePreviousApp({ name: 'Some App', bundleId: BUNDLE_ID });
    detector.updateSavedDirectory('/saved/from/directory-json');
    return detector;
  }

  /** Strategy stub standing in for one detection outcome. */
  function strategyReturning(result: unknown): { detect: ReturnType<typeof vi.fn> } {
    return {
      getName: () => 'Stub',
      isAvailable: () => true,
      detect: vi.fn(async () => result)
    } as never;
  }

  function usedOverrideLogLines(): unknown[][] {
    return vi.mocked(logger.info).mock.calls.filter(
      call => String(call[0]).includes('Using app directory override')
    );
  }

  test('ignores the override while live detection works', async () => {
    await writeOverrides(JSON.stringify({ [BUNDLE_ID]: projectDir }));

    const detector = detectorWithOverrideCandidate();

    // Default stub strategy detects /from/native for this app.
    const result = await detector.executeDirectoryDetector(1000);
    expect(result?.directory).toBe('/from/native');
    expect(listedFiles).not.toHaveBeenCalled();
    expect(usedOverrideLogLines()).toHaveLength(0);
  });

  test('applies the override when detection returns the unsupported-app error', async () => {
    await writeOverrides(JSON.stringify({ [BUNDLE_ID]: projectDir }));

    const detector = detectorWithOverrideCandidate();
    detector.setStrategy(strategyReturning(UNSUPPORTED_APP) as never);

    const result = await detector.executeDirectoryDetector(1000);
    expect(result?.directory).toBe(projectDir);
    expect(result?.error).toBeUndefined();
    expect(listedFiles).toHaveBeenCalledWith({ success: true, directory: projectDir }, null);
    expect(usedOverrideLogLines()).toHaveLength(1);
  });

  test('applies the override when detection times out (no result at all)', async () => {
    await writeOverrides(JSON.stringify({ [BUNDLE_ID]: projectDir }));

    const detector = detectorWithOverrideCandidate();
    detector.setStrategy(strategyReturning(null) as never);

    const result = await detector.executeDirectoryDetector(1000);
    expect(result?.directory).toBe(projectDir);
    expect(listedFiles).toHaveBeenCalledWith({ success: true, directory: projectDir }, null);
  });

  test('keeps the detection error payload intact when there is no override', async () => {
    const detector = detectorWithOverrideCandidate();
    detector.setStrategy(strategyReturning(UNSUPPORTED_APP) as never);

    // The reason detection failed must survive to the caller, not be swallowed.
    await expect(detector.executeDirectoryDetector(1000)).resolves.toEqual(UNSUPPORTED_APP);
    expect(listedFiles).not.toHaveBeenCalled();
  });

  test('returns null when there is neither a detection result nor an override', async () => {
    const detector = detectorWithOverrideCandidate();
    detector.setStrategy(strategyReturning(null) as never);

    await expect(detector.executeDirectoryDetector(1000)).resolves.toBeNull();
  });

  test('a removed override file stops applying on the next detection', async () => {
    await writeOverrides(JSON.stringify({ [BUNDLE_ID]: projectDir }));

    const detector = detectorWithOverrideCandidate();
    detector.setStrategy(strategyReturning(UNSUPPORTED_APP) as never);
    expect((await detector.executeDirectoryDetector(1000))?.directory).toBe(projectDir);

    await removeOverrides();
    await expect(detector.executeDirectoryDetector(1000)).resolves.toEqual(UNSUPPORTED_APP);
  });

  test('the initial paint uses the saved directory, never the override', async () => {
    await writeOverrides(JSON.stringify({ [BUNDLE_ID]: projectDir }));

    const loadCache = vi.fn(async (directory: string) => ({
      directory,
      files: [],
      metadata: { updatedAt: new Date().toISOString() }
    }));
    const fileCacheManager = {
      loadCache,
      isCacheValid: () => true,
      getLastUsedDirectory: vi.fn(async () => null)
    };

    const detector = new DirectoryDetector(fileCacheManager as never);
    detector.updatePreviousApp({ name: 'Some App', bundleId: BUNDLE_ID });
    detector.updateSavedDirectory('/saved/from/directory-json');

    // At show time it is unknown whether detection will succeed, so painting the
    // override would flash a directory detection is about to replace.
    const cached = await detector.loadCachedFilesForWindow();
    expect(cached?.directory).toBe('/saved/from/directory-json');
    expect(loadCache).not.toHaveBeenCalledWith(projectDir, expect.anything());
  });
});

describe('DirectoryDetector failed-detection notification', () => {
  function fakeWindow(): { send: ReturnType<typeof vi.fn>; window: never } {
    const send = vi.fn();
    const window = {
      isDestroyed: () => false,
      webContents: { isLoading: () => false, send, once: vi.fn() }
    };
    return { send, window: window as never };
  }

  function throwingDetector(): DirectoryDetector {
    const detector = new DirectoryDetector(null);
    detector.updatePreviousApp({ name: 'Some App', bundleId: BUNDLE_ID });
    detector.updateSavedDirectory('/saved/from/directory-json');
    detector.setStrategy({
      getName: () => 'Throwing',
      isAvailable: () => true,
      detect: vi.fn(async () => { throw new Error('detector blew up'); })
    } as never);
    return detector;
  }

  test('sends the override directory instead of the timeout hint', async () => {
    await writeOverrides(JSON.stringify({ [BUNDLE_ID]: projectDir }));

    const { send, window } = fakeWindow();
    await throwingDetector().executeBackgroundDirectoryDetection(window);

    const [channel, payload] = send.mock.calls[0] as [string, Record<string, unknown>];
    expect(channel).toBe('directory-data-updated');
    expect(payload.directory).toBe(projectDir);
    // Not flagged as a timeout: the renderer would otherwise show
    // "Open terminal in editor for directory detection" - advice about detecting
    // a directory that is not being detected at all.
    expect(payload.detectionTimedOut).toBeUndefined();
  });

  test('still reports the timeout with the saved directory when there is no override', async () => {
    const { send, window } = fakeWindow();
    await throwingDetector().executeBackgroundDirectoryDetection(window);

    const [channel, payload] = send.mock.calls[0] as [string, Record<string, unknown>];
    expect(channel).toBe('directory-data-updated');
    expect(payload).toEqual({
      success: false,
      detectionTimedOut: true,
      directory: '/saved/from/directory-json'
    });
  });
});
