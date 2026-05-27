/**
 * Symlink Resolver — reverse-lookup the user-facing symlink path for a realpath
 *
 * macOS kernel APIs (proc_pidinfo / getcwd) always canonicalize symlinks, so by
 * the time a CWD reaches this process it's already in realpath form (e.g.,
 * `/Users/foo/Library/Mobile Documents/.../vault`). Reading the shell's logical
 * `PWD` env var would recover the symlink but macOS SIP masks env vars from
 * Apple-signed binaries like `/bin/zsh`.
 *
 * Instead this module scans user-configured root directories (default:
 * `~/ghq`) for symlinks and builds a reverse map `realpath_target → symlink`.
 * When `resolveSymlinkAlias` is called with a realpath, it returns the
 * matching symlink (or null), substituting any path that lives inside a known
 * symlink target.
 */

import { promises as fs } from 'fs';
import { join, sep } from 'path';
import os from 'os';
import { logger } from '../logger';

const CACHE_TTL_MS = 5 * 60 * 1000;   // 5 minutes
const DEFAULT_SCAN_DEPTH = 5;          // ghq layout: ~/ghq/<host>/<user>/<repo> ≈ depth 4
const MAX_ENTRIES_PER_DIR = 500;       // safety cap to avoid pathological cases

interface SymlinkMapEntry {
  /** The user-facing symlink path (e.g. /Users/foo/ghq/.../vault) */
  alias: string;
  /** The realpath the symlink resolves to */
  target: string;
}

interface ScanCache {
  /** key = JSON-stringified expanded scan roots; value = entries sorted longest-target-first */
  entries: SymlinkMapEntry[];
  expandedRoots: string[];
  lastBuiltAt: number;
}

let cache: ScanCache | null = null;
let inflightBuild: Promise<ScanCache> | null = null;

/** Expand a leading `~` to the home directory. */
function expandHome(path: string): string {
  if (path === '~') return os.homedir();
  if (path.startsWith('~/')) return join(os.homedir(), path.slice(2));
  return path;
}

/**
 * Walk a directory up to `maxDepth` levels, invoking `onSymlink(absPath)` for
 * every entry whose `lstat` says it's a symbolic link. Non-symlink directories
 * are recursed into; symlink directories are NOT followed to avoid cycles and
 * because the alias is exactly what we want to record.
 */
 
async function walkSymlinks(
  dir: string,
  maxDepth: number,
  onSymlink: (absPath: string) => Promise<void>
): Promise<void> {
  if (maxDepth < 0) return;

  let entries: import('fs').Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;  // missing dir / EPERM / etc. — silently skip
  }

  if (entries.length > MAX_ENTRIES_PER_DIR) {
    entries = entries.slice(0, MAX_ENTRIES_PER_DIR);
  }

  for (const entry of entries) {
    const abs = join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      await onSymlink(abs);
    } else if (entry.isDirectory() && maxDepth > 0) {
      await walkSymlinks(abs, maxDepth - 1, onSymlink);
    }
  }
}

async function buildCache(expandedRoots: string[]): Promise<ScanCache> {
  const startedAt = Date.now();
  const entries: SymlinkMapEntry[] = [];
  const seenAliases = new Set<string>();

  for (const root of expandedRoots) {
    await walkSymlinks(root, DEFAULT_SCAN_DEPTH, async (absPath) => {
      if (seenAliases.has(absPath)) return;
      try {
        const target = await fs.realpath(absPath);
        if (target === absPath) return;  // not actually a symlink target → self
        seenAliases.add(absPath);
        entries.push({ alias: absPath, target });
      } catch {
        // dangling symlink — skip silently
      }
    });
  }

  // Sort longest-target-first so prefix matching prefers the most specific
  // alias when multiple symlinks lie on the same chain.
  entries.sort((a, b) => b.target.length - a.target.length);

  const elapsedMs = Date.now() - startedAt;
  logger.debug('symlink-resolver: cache built', {
    roots: expandedRoots,
    entryCount: entries.length,
    elapsedMs
  });

  return {
    entries,
    expandedRoots,
    lastBuiltAt: Date.now()
  };
}

async function getCache(expandedRoots: string[]): Promise<ScanCache> {
  const rootsKey = expandedRoots.join('\0');
  const existing = cache;
  if (existing &&
      existing.expandedRoots.join('\0') === rootsKey &&
      Date.now() - existing.lastBuiltAt < CACHE_TTL_MS) {
    return existing;
  }

  if (inflightBuild) {
    return inflightBuild;
  }

  inflightBuild = buildCache(expandedRoots).then((built) => {
    cache = built;
    inflightBuild = null;
    return built;
  }).catch((err) => {
    inflightBuild = null;
    throw err;
  });

  return inflightBuild;
}

/**
 * Try to find a user-facing symlink alias for the given realpath. Returns the
 * substituted path (alias + any trailing components of inputPath beyond the
 * symlink target) or null if no symlink in any scan root resolves to a prefix
 * of inputPath.
 *
 * Scan roots are expanded with `~` → $HOME. An empty or undefined scanRoots
 * array disables the feature (returns null without scanning).
 */
export async function resolveSymlinkAlias(
  inputPath: string,
  scanRoots: string[] | undefined
): Promise<string | null> {
  if (!scanRoots || scanRoots.length === 0) return null;
  if (!inputPath || !inputPath.startsWith('/')) return null;

  const expandedRoots = scanRoots
    .map(expandHome)
    .filter((p) => p.startsWith('/'));
  if (expandedRoots.length === 0) return null;

  const built = await getCache(expandedRoots);
  for (const { alias, target } of built.entries) {
    if (inputPath === target) {
      return alias;
    }
    if (inputPath.startsWith(target + sep)) {
      return alias + inputPath.substring(target.length);
    }
  }
  return null;
}

/** Reset the in-memory cache. Intended for tests. */
export function resetSymlinkResolverCache(): void {
  cache = null;
  inflightBuild = null;
}
