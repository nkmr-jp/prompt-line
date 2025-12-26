// @ts-nocheck
import { logger } from './logger';

// Secure error messages (user-facing - no internal information)
export const SecureErrors = {
  INVALID_INPUT: 'Invalid input provided',
  OPERATION_FAILED: 'Operation failed',
  FILE_NOT_FOUND: 'File not found',
  PERMISSION_DENIED: 'Permission denied',
  INTERNAL_ERROR: 'An internal error occurred',
  INVALID_FORMAT: 'Invalid format',
  SIZE_LIMIT_EXCEEDED: 'Size limit exceeded',
} as const;

// Error handler helper - separates user-facing and internal log messages
export function handleError(error: Error, context: string): { logMessage: string; userMessage: string } {
  return {
    logMessage: `${context}: ${error.message}`,
    userMessage: SecureErrors.OPERATION_FAILED,
  };
}

/**
 * Sanitizes command line arguments to prevent command injection
 * Removes dangerous characters and limits length for safe shell execution
 * @param input - The input string to sanitize
 * @param maxLength - Maximum allowed length (default: 256)
 * @returns Sanitized string safe for command execution
 */
export function sanitizeCommandArgument(input: string, maxLength = 256): string {
  if (typeof input !== 'string') {
    throw new Error('Input must be a string');
  }

  // Limit input length to prevent buffer overflows
  if (input.length > maxLength) {
    logger.warn(`Command argument truncated from ${input.length} to ${maxLength} characters`);
    input = input.substring(0, maxLength);
  }

  // Remove dangerous characters that could be used for command injection
  // Allow only alphanumeric, dots, hyphens, underscores, spaces, and safe punctuation
  const sanitized = input
    .replace(/[;&|`$(){}[\]<>"'\\*?~^]/g, '') // Remove shell metacharacters
    .replace(/\x00/g, '') // Remove null bytes
    .replace(/[\r\n]/g, '') // Remove newlines
    .trim(); // Remove leading/trailing whitespace

  // Log if sanitization occurred
  if (sanitized !== input.trim()) {
    logger.warn('Command argument sanitized', {
      original: input,
      sanitized,
      removedChars: input.length - sanitized.length
    });
  }

  return sanitized;
}

/**
 * Validates that a command argument contains only safe characters
 * @param input - The input string to validate
 * @returns boolean indicating if the input is safe
 */
export function isCommandArgumentSafe(input: string): boolean {
  if (typeof input !== 'string') {
    return false;
  }

  // Check for dangerous patterns
  const dangerousPatterns = [
    /[;&|`$(){}[\]<>"'\\*?~^]/, // Shell metacharacters
    /\x00/, // Null bytes
    /[\r\n]/, // Newlines
    /^-/, // Arguments starting with dash (could be interpreted as flags)
    /\.\./, // Path traversal attempts
  ];

  return !dangerousPatterns.some(pattern => pattern.test(input));
}
