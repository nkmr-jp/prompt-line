/**
 * Match a pattern against a command name.
 * If the pattern ends with '*', it performs a prefix match.
 * Otherwise, it performs an exact match.
 *
 * @param pattern - The pattern to match (e.g., "commit", "sa:*")
 * @param commandName - The command name to test (e.g., "commit", "sa:test")
 * @returns true if the pattern matches the command name
 */
export function matchCommandName(pattern: string, commandName: string): boolean {
  if (pattern.endsWith('*')) {
    const prefix = pattern.slice(0, -1);
    return commandName.startsWith(prefix);
  }
  return pattern === commandName;
}

/**
 * Determine if a command is enabled based on enable/disable lists.
 * - If enable list exists, only commands matching the list are allowed.
 * - Commands matching the disable list are blocked.
 * - If neither list is set, all commands are enabled.
 *
 * @param commandName - The command name to check
 * @param enable - Optional list of patterns to enable
 * @param disable - Optional list of patterns to disable
 * @returns true if the command is enabled
 */
export function isCommandEnabled(
  commandName: string,
  enable?: string[],
  disable?: string[]
): boolean {
  // If enable list exists, check if command matches any pattern
  if (enable && enable.length > 0) {
    const isAllowed = enable.some(pattern => matchCommandName(pattern, commandName));
    if (!isAllowed) return false;
  }

  // If disable list exists, check if command matches any pattern
  if (disable && disable.length > 0) {
    const isBlocked = disable.some(pattern => matchCommandName(pattern, commandName));
    if (isBlocked) return false;
  }

  return true;
}
