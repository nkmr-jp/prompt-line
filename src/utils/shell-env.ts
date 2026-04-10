/**
 * Provides enhanced environment variables for shell command execution.
 *
 * Packaged Electron apps on macOS don't load ~/.zshrc, so PATH is limited
 * to /usr/bin:/bin:/usr/sbin:/sbin. This utility adds common macOS paths
 * (Homebrew, etc.) so that sourceCommand and other exec() calls can find
 * user-installed CLI tools.
 */
export function getEnhancedEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  const additionalPaths = [
    '/opt/homebrew/bin',
    '/opt/homebrew/sbin',
    '/usr/local/bin',
    '/usr/local/sbin',
  ];
  const currentPath = env.PATH || '/usr/bin:/bin:/usr/sbin:/sbin';
  const pathSet = new Set(currentPath.split(':'));
  const missingPaths = additionalPaths.filter(p => !pathSet.has(p));
  if (missingPaths.length > 0) {
    env.PATH = [...missingPaths, currentPath].join(':');
  }
  return env;
}
