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
