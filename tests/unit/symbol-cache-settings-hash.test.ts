 

/**
 * Verifies settingsHash round-trip through symbolCacheManager so that
 * cache entries written by one set of search settings are matched (or
 * rejected) when checked later by the handler.
 */

// Use real fs/promises and path so the cache manager can actually read
// and write its metadata file.
vi.mock('fs/promises', async () => {
  const actual = await vi.importActual<typeof import('fs/promises')>('fs/promises');
  return { ...actual, default: actual };
});
vi.mock('path', async () => {
  const actual = await vi.importActual<typeof import('path')>('path');
  return { ...actual, default: actual };
});

vi.mock('../../src/utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  ensureDir: vi.fn(async (p: string) => {
    const fs = await vi.importActual<typeof import('fs/promises')>('fs/promises');
    await fs.mkdir(p, { recursive: true });
  })
}));

// Pin the cache root to a per-process temp dir. The singleton captures
// this value in its constructor, so it must be stable across tests.
// Use vi.hoisted so the temp dir exists before vi.mock factories execute.
const { CACHE_ROOT } = vi.hoisted(() => {
  const { mkdtempSync } = require('fs');
  const { tmpdir } = require('os');
  const { join } = require('path');
  return { CACHE_ROOT: mkdtempSync(join(tmpdir(), 'pl-symbol-cache-')) as string };
});

vi.mock('../../src/config/app-config', () => ({
  default: {
    paths: {
      projectsCacheDir: CACHE_ROOT,
      cacheDir: CACHE_ROOT
    }
  }
}));

import { rmSync } from 'fs';

import { rm } from 'fs/promises';
import { symbolCacheManager } from '../../src/managers/symbol-cache-manager';
import type { SymbolResult } from '../../src/managers/symbol-search/types';

const sampleSymbol: SymbolResult = {
  name: 'alpha',
  type: 'function',
  filePath: '/tmp/project/src/alpha.py',
  relativePath: 'src/alpha.py',
  lineNumber: 1,
  lineContent: 'def alpha():',
  language: 'py'
};

const DIR_A = '/tmp/settings-hash-project-a';
const DIR_B = '/tmp/settings-hash-project-b';
const DIR_C = '/tmp/settings-hash-project-c';
const DIR_D = '/tmp/settings-hash-project-d';

describe('symbolCacheManager settingsHash round-trip', () => {
  afterAll(() => {
    rmSync(CACHE_ROOT, { recursive: true, force: true });
  });

  afterEach(async () => {
    await symbolCacheManager.clearCache(DIR_A).catch(() => {});
    await symbolCacheManager.clearCache(DIR_B).catch(() => {});
    await symbolCacheManager.clearCache(DIR_C).catch(() => {});
    await symbolCacheManager.clearCache(DIR_D).catch(() => {});
    await rm(CACHE_ROOT, { recursive: true, force: true }).catch(() => {});
  });

  test('saveSymbols persists the hash and getLanguageSettingsHash returns it', async () => {
    await symbolCacheManager.saveSymbols(DIR_A, 'py', [sampleSymbol], 'full', 'abc123');
    const hash = await symbolCacheManager.getLanguageSettingsHash(DIR_A, 'py');
    expect(hash).toBe('abc123');
  });

  test('omitting settingsHash leaves it null (legacy entries look stale)', async () => {
    await symbolCacheManager.saveSymbols(DIR_B, 'py', [sampleSymbol], 'full');
    const hash = await symbolCacheManager.getLanguageSettingsHash(DIR_B, 'py');
    expect(hash).toBeNull();
  });

  test('getLanguageSettingsHash returns null when the language cache is absent', async () => {
    await symbolCacheManager.saveSymbols(DIR_C, 'py', [sampleSymbol], 'full', 'abc123');
    const hash = await symbolCacheManager.getLanguageSettingsHash(DIR_C, 'ts');
    expect(hash).toBeNull();
  });

  test('overwriting a language rewrites the hash', async () => {
    await symbolCacheManager.saveSymbols(DIR_D, 'py', [sampleSymbol], 'full', 'first');
    await symbolCacheManager.saveSymbols(DIR_D, 'py', [sampleSymbol], 'full', 'second');
    const hash = await symbolCacheManager.getLanguageSettingsHash(DIR_D, 'py');
    expect(hash).toBe('second');
  });
});
