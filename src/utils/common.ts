import type { DebounceFunction } from '../types';
import { TIME_CALCULATIONS } from '../constants';
import { logger } from './logger';

export function debounce<T extends unknown[]>(
  func: (...args: T) => void,
  wait: number,
  immediate = false
): DebounceFunction<T> {
  let timeout: NodeJS.Timeout | undefined;

  const debouncedFunction = function(this: unknown, ...args: T) {
    const later = () => {
      timeout = undefined;
      if (!immediate) func.apply(this, args);
    };
    const callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) func.apply(this, args);
  };

  return debouncedFunction;
}

export function safeJsonParse<T = unknown>(jsonString: string, fallback?: T): T | null {
  try {
    return JSON.parse(jsonString) as T;
  } catch (error) {
    logger.warn('Failed to parse JSON:', error);
    return fallback ?? null;
  }
}

export function safeJsonStringify(obj: unknown, fallback = '{}'): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch (error) {
    logger.warn('Failed to stringify object:', error);
    return fallback;
  }
}

// Generates lowercase alphanumeric ID (a-z0-9)
// NOTE: ID validation in ipc-handlers.ts depends on this format - update both if changed
export function generateId(): string {
  return Date.now().toString(TIME_CALCULATIONS.TIMESTAMP_BASE) + Math.random().toString(TIME_CALCULATIONS.TIMESTAMP_BASE).substring(TIME_CALCULATIONS.RANDOM_ID_START, TIME_CALCULATIONS.RANDOM_ID_END);
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Validates a hex color code
 * Supports both 3-digit (#RGB) and 6-digit (#RRGGBB) formats
 * @param color - Color value to validate (named color or hex code)
 * @returns true if valid hex color code, false otherwise
 */
export function isValidHexColor(color: string): boolean {
  const hexColorRegex = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;
  return hexColorRegex.test(color);
}

/**
 * Validates a color value (named color or hex code)
 * @param color - Color value to validate
 * @returns Validated color value or default color if invalid
 */
export function validateColorValue(color: string | undefined, defaultColor = 'grey'): string {
  if (!color) {
    return defaultColor;
  }

  // Named colors list
  const namedColors = ['grey', 'darkGrey', 'slate', 'stone', 'red', 'rose', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink'];

  // Check if it's a named color
  if (namedColors.includes(color)) {
    return color;
  }

  // Check if it's a valid hex color code
  if (isValidHexColor(color)) {
    return color;
  }

  // Invalid color: log warning and return default
  logger.warn(`Invalid color value: ${color}. Using default color: ${defaultColor}`);
  return defaultColor;
}
