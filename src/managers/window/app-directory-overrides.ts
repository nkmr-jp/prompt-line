import { promises as fs } from 'fs';
import config from '../../config/app-config';
import { logger } from '../../utils/utils';
import type { AppInfo } from '../../types';

type OverrideMap = Record<string, string>;

/**
 * Bundle ids are used as lookup keys, so the map must not inherit anything from
 * `Object.prototype` (`constructor`, `toString`, ...).
 */
function emptyMap(): OverrideMap {
  return Object.create(null) as OverrideMap;
}

/**
 * The file is written by external tools: refuse anything that is not a plain
 * absolute path rather than resolving it against the cwd. Applied at parse time
 * so a bad entry warns once per file change, not once per window show.
 */
function isUsableOverridePath(bundleId: string, directory: string): boolean {
  if (!directory.startsWith('/') || directory.split('/').includes('..')) {
    logger.warn('Ignoring non-absolute app directory override', { bundleId, directory });
    return false;
  }
  return true;
}

/**
 * Per-app startup directory overrides.
 *
 * Reads `<userDataDir>/app-directories.json`, a flat map of macOS bundle id to
 * absolute directory path:
 *
 * ```json
 * {
 *   "com.example.someapp": "/Users/me/ghq/github.com/me/project"
 * }
 * ```
 *
 * The file is owned by *external* tools — Prompt Line only reads it. It may be
 * absent, empty, malformed, or point at directories that no longer exist; every
 * such case resolves to `null` so the caller falls back to the normal detection
 * chain. Nothing here throws.
 *
 * The parsed map is cached and only re-read when the file's mtime or size
 * changes, so resolving on every window show costs one `stat` plus one lookup.
 */
export class AppDirectoryOverrides {
  private map: OverrideMap = emptyMap();
  private cachedMtimeMs: number | null = null;
  private cachedSize: number | null = null;

  /**
   * Extract the bundle id used as the override key.
   * `previousApp` is a plain app name string on some detection paths, which has
   * no bundle id and therefore never matches an override.
   */
  static bundleIdOf(app: AppInfo | string | null): string | null {
    if (!app || typeof app !== 'object') return null;
    return app.bundleId ?? null;
  }

  /**
   * Resolve the override directory for an app.
   * @returns an existing absolute directory, or null when no override applies
   */
  async resolve(app: AppInfo | string | null): Promise<string | null> {
    const bundleId = AppDirectoryOverrides.bundleIdOf(app);
    if (!bundleId) return null;

    const map = await this.loadMap();
    const directory = map[bundleId];
    if (!directory) return null;

    // Entries go stale independently of the file (repo moved or deleted), so
    // this check cannot be cached alongside the parsed map.
    try {
      const stats = await fs.stat(directory);
      if (!stats.isDirectory()) return null;
    } catch {
      return null;
    }

    return directory;
  }

  /**
   * Load the override map, re-reading only when the file changed.
   * mtime alone has 1s granularity on some filesystems, so size is part of the key.
   */
  private async loadMap(): Promise<OverrideMap> {
    const file = config.paths.appDirectoriesFile;

    let mtimeMs: number;
    let size: number;
    try {
      const stats = await fs.stat(file);
      mtimeMs = stats.mtimeMs;
      size = stats.size;
    } catch {
      // Missing file is the normal case for users without external tooling.
      this.reset();
      return this.map;
    }

    if (this.cachedMtimeMs === mtimeMs && this.cachedSize === size) {
      return this.map;
    }

    this.cachedMtimeMs = mtimeMs;
    this.cachedSize = size;
    this.map = emptyMap();

    try {
      const raw = await fs.readFile(file, 'utf8');
      if (!raw.trim()) return this.map;

      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        logger.warn('app-directories.json is not an object, ignoring', { file });
        return this.map;
      }

      for (const [bundleId, directory] of Object.entries(parsed as Record<string, unknown>)) {
        // A blank value is an external tool's way of saying "no override right
        // now" without dropping the key, so it is skipped, not warned about.
        if (typeof directory !== 'string' || !directory.trim()) continue;
        if (isUsableOverridePath(bundleId, directory)) {
          this.map[bundleId] = directory;
        }
      }
      logger.debug('Loaded app directory overrides', { count: Object.keys(this.map).length });
    } catch (error) {
      // The parse error text is what the external tool that wrote this file needs.
      logger.warn(
        'Failed to read app-directories.json, ignoring:',
        error instanceof Error ? error.message : String(error)
      );
      this.map = emptyMap();
    }

    return this.map;
  }

  private reset(): void {
    this.map = emptyMap();
    this.cachedMtimeMs = null;
    this.cachedSize = null;
  }
}

export default AppDirectoryOverrides;
