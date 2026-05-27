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
const MAX_ENTRIES_PER_DIR = 5000;      // safety cap; covers ~/ghq/github.com with 1000s of users
const SCAN_TIMEOUT_MS = 1500;          // walk budget — fall back to null on overruns

/**
 * Directory names to skip during the walk. Recursing into these (especially
 * node_modules) explodes the walk into millions of entries without ever
 * finding a useful project-level symlink.
 */
const SKIP_DIR_NAMES = new Set<string>([
  'node_modules', 'vendor', 'bower_components', '.pnpm',
  '.next', '.nuxt', 'dist', 'build', 'out', 'target', '.output',
  '.git', '.svn', '.hg',
  '.idea', '.vscode', '.fleet',
  '.cache', '__pycache__', '.pytest_cache', '.mypy_cache', '.ruff_cache',
  'coverage', '.nyc_output', '.turbo', '.vercel', '.netlify'
]);

interface SymlinkMapEntry {
  /** The user-facing symlink path (e.g. /Users/foo/ghq/.../vault) */
  alias: string;
  /** The realpath the symlink resolves to */
  target: string;
}

interface ScanCache {
  entries: SymlinkMapEntry[];
  expandedRoots: string[];
  lastBuiltAt: number;
}

/** Cached scan result keyed by the roots-key (joined expanded roots). */
let cache: ScanCache | null = null;
/** In-flight builds keyed by roots-key so concurrent callers with different roots don't share. */
const inflightBuilds = new Map<string, Promise<ScanCache>>();

function rootsKeyOf(expandedRoots: string[]): string {
  return expandedRoots.join('\0');
}

/** Expand a leading `~` to the home directory. */
function expandHome(path: string): string {
  if (path === '~') return os.homedir();
  if (path.startsWith('~/')) return join(os.homedir(), path.slice(2));
  return path;
}

interface WalkContext {
  onSymlink: (absPath: string) => Promise<void>;
  deadlineAt: number;
  timedOut: boolean;
}

/**
 * Walk a directory up to `maxDepth` levels, invoking `ctx.onSymlink(absPath)`
 * for every entry whose `lstat` says it's a symbolic link. Non-symlink
 * directories are recursed into UNLESS their name appears in `SKIP_DIR_NAMES`.
 * Symlink directories are NOT followed (their alias is the recorded artifact).
 * Aborts early when `ctx.deadlineAt` is reached so a slow filesystem never
 * blocks the caller indefinitely.
 */
async function walkSymlinks(dir: string, maxDepth: number, ctx: WalkContext): Promise<void> {
  if (maxDepth < 0 || ctx.timedOut) return;
  if (Date.now() > ctx.deadlineAt) {
    ctx.timedOut = true;
    return;
  }

  let entries: import('fs').Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;  // missing dir / EPERM / etc. — silently skip
  }

  if (entries.length > MAX_ENTRIES_PER_DIR) {
    logger.warn('symlink-resolver: directory exceeds entry cap, truncating', {
      dir,
      entries: entries.length,
      cap: MAX_ENTRIES_PER_DIR
    });
    entries = entries.slice(0, MAX_ENTRIES_PER_DIR);
  }

  for (const entry of entries) {
    if (ctx.timedOut) return;
    const abs = join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      await ctx.onSymlink(abs);
    } else if (entry.isDirectory() && maxDepth > 0 && !SKIP_DIR_NAMES.has(entry.name)) {
      await walkSymlinks(abs, maxDepth - 1, ctx);
    }
  }
}

/** Record a single symlink alias (used for both walked entries and roots). */
async function recordSymlink(
  absPath: string,
  entries: SymlinkMapEntry[],
  seenAliases: Set<string>
): Promise<void> {
  if (seenAliases.has(absPath)) return;
  try {
    const target = await fs.realpath(absPath);
    if (target === absPath) return;
    seenAliases.add(absPath);
    entries.push({ alias: absPath, target });
  } catch {
    // dangling symlink — skip silently
  }
}

async function buildCache(expandedRoots: string[]): Promise<ScanCache> {
  const startedAt = Date.now();
  const entries: SymlinkMapEntry[] = [];
  const seenAliases = new Set<string>();
  const ctx: WalkContext = {
    deadlineAt: startedAt + SCAN_TIMEOUT_MS,
    timedOut: false,
    onSymlink: (absPath) => recordSymlink(absPath, entries, seenAliases)
  };

  for (const root of expandedRoots) {
    // If the configured root is itself a symlink, record it directly — readdir
    // would follow it but never see the alias name.
    try {
      const st = await fs.lstat(root);
      if (st.isSymbolicLink()) {
        await recordSymlink(root, entries, seenAliases);
        continue;
      }
    } catch {
      // root missing — skip; walkSymlinks would also no-op.
    }
    await walkSymlinks(root, DEFAULT_SCAN_DEPTH, ctx);
  }

  // Sort longest-target-first so prefix matching prefers the most specific
  // alias when multiple symlinks lie on the same chain.
  entries.sort((a, b) => b.target.length - a.target.length);

  const elapsedMs = Date.now() - startedAt;
  if (ctx.timedOut) {
    logger.warn('symlink-resolver: scan timed out', {
      roots: expandedRoots,
      entryCount: entries.length,
      elapsedMs,
      budgetMs: SCAN_TIMEOUT_MS
    });
  } else {
    logger.debug('symlink-resolver: cache built', {
      roots: expandedRoots,
      entryCount: entries.length,
      elapsedMs
    });
  }

  return { entries, expandedRoots, lastBuiltAt: Date.now() };
}

async function getCache(expandedRoots: string[]): Promise<ScanCache> {
  const key = rootsKeyOf(expandedRoots);
  const existing = cache;
  if (existing &&
      rootsKeyOf(existing.expandedRoots) === key &&
      Date.now() - existing.lastBuiltAt < CACHE_TTL_MS) {
    return existing;
  }

  const inflight = inflightBuilds.get(key);
  if (inflight) {
    return inflight;
  }

  const buildPromise = buildCache(expandedRoots).then((built) => {
    cache = built;
    inflightBuilds.delete(key);
    return built;
  }).catch((err) => {
    inflightBuilds.delete(key);
    throw err;
  });

  inflightBuilds.set(key, buildPromise);
  return buildPromise;
}

/**
 * Try to find a user-facing symlink alias for the given realpath. Returns the
 * substituted path (alias + any trailing components of inputPath beyond the
 * symlink target) or null if no symlink in any scan root resolves to a prefix
 * of inputPath.
 *
 * Scan roots are expanded with `~` → $HOME. Invalid or non-absolute entries
 * are dropped with a logged warning so misconfigured settings surface.
 */
export async function resolveSymlinkAlias(
  inputPath: string,
  scanRoots: string[] | undefined
): Promise<string | null> {
  if (!scanRoots || scanRoots.length === 0) return null;
  if (!inputPath || !inputPath.startsWith('/')) return null;

  const expandedRoots: string[] = [];
  const dropped: string[] = [];
  for (const raw of scanRoots) {
    const expanded = expandHome(raw);
    if (expanded.startsWith('/')) {
      expandedRoots.push(expanded);
    } else {
      dropped.push(raw);
    }
  }
  if (dropped.length > 0) {
    logger.warn('symlink-resolver: ignoring non-absolute scan roots', { dropped });
  }
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
  inflightBuilds.clear();
}
