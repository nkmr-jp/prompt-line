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

import { AppDirectoryOverrides } from '../../src/managers/window/app-directory-overrides';
import DirectoryDetector from '../../src/managers/window/directory-detector';

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

describe('DirectoryDetector app directory overrides', () => {
  test('override wins over live native detection', async () => {
    await writeOverrides(JSON.stringify({ [BUNDLE_ID]: projectDir }));

    const detector = new DirectoryDetector(null);
    detector.updatePreviousApp({ name: 'Some App', bundleId: BUNDLE_ID });
    detector.updateSavedDirectory('/saved/from/directory-json');

    await expect(detector.refreshOverrideDirectory()).resolves.toBe(projectDir);
    expect(detector.getEffectiveDirectory()).toBe(projectDir);

    const result = await detector.executeDirectoryDetector(1000);
    expect(result?.directory).toBe(projectDir);
    expect(listedFiles).toHaveBeenCalledWith({ success: true, directory: projectDir }, null);
  });

  test('falls back to native detection and the saved directory without an override', async () => {
    const detector = new DirectoryDetector(null);
    detector.updatePreviousApp({ name: 'Some App', bundleId: BUNDLE_ID });
    detector.updateSavedDirectory('/saved/from/directory-json');

    await expect(detector.refreshOverrideDirectory()).resolves.toBeNull();
    expect(detector.getEffectiveDirectory()).toBe('/saved/from/directory-json');

    const result = await detector.executeDirectoryDetector(1000);
    expect(result?.directory).toBe('/from/native');
    expect(listedFiles).not.toHaveBeenCalled();
  });

  test('a removed override file drops back to the saved directory on the next show', async () => {
    await writeOverrides(JSON.stringify({ [BUNDLE_ID]: projectDir }));

    const detector = new DirectoryDetector(null);
    detector.updatePreviousApp({ name: 'Some App', bundleId: BUNDLE_ID });
    detector.updateSavedDirectory('/saved/from/directory-json');
    await detector.refreshOverrideDirectory();
    expect(detector.getEffectiveDirectory()).toBe(projectDir);

    await removeOverrides();
    await expect(detector.refreshOverrideDirectory()).resolves.toBeNull();
    expect(detector.getEffectiveDirectory()).toBe('/saved/from/directory-json');
  });
});
