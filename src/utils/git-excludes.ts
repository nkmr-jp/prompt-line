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
import { logger } from './logger';

const execFileAsync = promisify(execFile);

let cached: string | null | undefined = undefined;

export async function getGlobalGitExcludesFile(): Promise<string | null> {
  if (cached !== undefined) return cached;

  try {
    // Scope: `--global` limits lookup to the user's global config chain,
    // without which a repo-local core.excludesfile set in a project's
    // .git/config would be cached at first resolution and then silently
    // applied to every other search path for the rest of the session.
    //
    // Includes: `--global` alone does not follow `[include]` directives,
    // so a user who sets `core.excludesfile` in an included gitconfig
    // (common when dotfiles live outside `~/.gitconfig`) would look
    // unset. `--includes` restores that.
    //
    // Path: `--path` asks git itself to resolve the value, which expands
    // leading `~` and honors git's "relative to the config file that
    // defined it" semantics for relative paths.
    const { stdout } = await execFileAsync(
      'git',
      ['config', '--global', '--includes', '--get', '--path', 'core.excludesfile'],
      { timeout: 2000, windowsHide: true }
    );
    const resolved = stdout.trim();
    if (!resolved) {
      cached = null;
      return cached;
    }

    await access(resolved);
    cached = resolved;
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
