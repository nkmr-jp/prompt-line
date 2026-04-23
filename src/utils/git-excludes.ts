/**
 * Resolve the user's global git excludes file.
 *
 * `fd` and `rg` respect only `$XDG_CONFIG_HOME/git/ignore` by default and do
 * not follow `[include]` directives in `~/.gitconfig`, so a user whose
 * `core.excludesfile` is set via an included gitconfig is silently ignored.
 * We resolve it via `git config --get core.excludesfile` (git itself follows
 * includes) and hand the absolute path to fd/rg via `--ignore-file`.
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import { access } from 'fs/promises';
import { homedir } from 'os';
import { isAbsolute, resolve } from 'path';
import { logger } from './logger';

const execFileAsync = promisify(execFile);

let cached: string | null | undefined = undefined;

function expandTilde(p: string): string {
  if (p === '~') return homedir();
  if (p.startsWith('~/')) return resolve(homedir(), p.slice(2));
  return p;
}

export async function getGlobalGitExcludesFile(): Promise<string | null> {
  if (cached !== undefined) return cached;

  try {
    const { stdout } = await execFileAsync('git', ['config', '--get', 'core.excludesfile'], {
      timeout: 2000,
      windowsHide: true
    });
    const raw = stdout.trim();
    if (!raw) {
      cached = null;
      return cached;
    }

    const expanded = expandTilde(raw);
    const absolute = isAbsolute(expanded) ? expanded : resolve(homedir(), expanded);
    await access(absolute);
    cached = absolute;
  } catch {
    cached = null;
  }

  if (cached) {
    logger.debug('Resolved global git excludes file', { path: cached });
  }
  return cached;
}

/** Reset cached resolution (test-only). */
export function resetGlobalGitExcludesFileCache(): void {
  cached = undefined;
}
