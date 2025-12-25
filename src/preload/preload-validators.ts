/**
 * Preload Script Validation and Sanitization
 * Security helpers for input validation
 */

import { ALLOWED_CHANNELS, MAX_DEPTH, MAX_STRING_LENGTH, DANGEROUS_KEYS } from './preload-constants';

/**
 * IPC channel validation with additional security checks
 */
export function validateChannel(channel: string): boolean {
  // Check if channel is in allowed list
  if (!ALLOWED_CHANNELS.includes(channel)) {
    return false;
  }

  // Additional validation: prevent prototype pollution
  if (channel.includes('__proto__') || channel.includes('constructor') || channel.includes('prototype')) {
    return false;
  }

  // Prevent path traversal attempts
  if (channel.includes('../') || channel.includes('..\\')) {
    return false;
  }

  return true;
}

/**
 * Checks if a key is dangerous (prototype pollution)
 */
export function isDangerousKey(key: string): boolean {
  return DANGEROUS_KEYS.includes(key);
}

/**
 * Validates object for prototype pollution
 */
export function validateObject(obj: any): void {
  if (DANGEROUS_KEYS.some(key => Object.prototype.hasOwnProperty.call(obj, key))) {
    throw new Error('Potentially dangerous object properties detected');
  }
}

/**
 * Sanitizes a string input
 */
export function sanitizeString(input: string): string {
  if (input.length > MAX_STRING_LENGTH) {
    throw new Error('Input too long');
  }
  return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

/**
 * Sanitizes an object recursively
 */
export function sanitizeObject(obj: any, depth: number): Record<string, any> {
  validateObject(obj);

  const sanitized: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    if (isDangerousKey(key)) {
      throw new Error('Potentially dangerous object key detected');
    }
    sanitized[key] = sanitizeInput(obj[key], depth + 1);
  }
  return sanitized;
}

/**
 * Input sanitization helper with recursive support
 */
export function sanitizeInput(input: any, depth = 0): any {
  // 再帰深度制限（無限ループ防止）
  if (depth > MAX_DEPTH) {
    throw new Error('Input nesting too deep');
  }

  if (typeof input === 'string') {
    return sanitizeString(input);
  }

  if (Array.isArray(input)) {
    return input.map(item => sanitizeInput(item, depth + 1));
  }

  if (typeof input === 'object' && input !== null) {
    return sanitizeObject(input, depth);
  }

  return input;
}
