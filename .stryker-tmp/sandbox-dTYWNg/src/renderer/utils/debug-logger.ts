/**
 * Debug logging utilities for renderer process
 * Provides consistent logging format across all renderer modules
 */
// @ts-nocheck


/**
 * Format object for console output
 * Outputs in a format similar to the main process logger
 */
export function formatLog(obj: Record<string, unknown>): string {
  const entries = Object.entries(obj)
    .map(([key, value]) => `  ${key}: ${typeof value === 'string' ? `'${value}'` : value}`)
    .join(',\n');
  return '{\n' + entries + '\n}';
}

/**
 * Create a debug logger for a specific module
 *
 * @param moduleName - The name of the module (e.g., 'FileSearchManager', 'PopupManager')
 * @returns A debug function that prefixes all messages with the module name
 *
 * @example
 * const debug = createDebugLogger('FileSearchManager');
 * debug('initialized'); // Output: [FileSearchManager] initialized
 * debug('search result', { count: 5 }); // Output: [FileSearchManager] search result { count: 5 }
 */
export function createDebugLogger(moduleName: string): (...args: unknown[]) => void {
  const prefix = `[${moduleName}]`;
  return (...args: unknown[]) => {
    console.debug(prefix, ...args);
  };
}

/**
 * Type for module-specific debug logger
 */
export type DebugLogger = ReturnType<typeof createDebugLogger>;
