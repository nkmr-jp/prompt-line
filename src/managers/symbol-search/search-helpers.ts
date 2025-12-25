/**
 * Symbol Search Helper Functions
 * Extracted helpers to reduce complexity of searchSymbols function
 */

import type { SymbolSearchResponse, SymbolSearchOptions } from './types';
import { DEFAULT_MAX_SYMBOLS } from './symbol-searcher';
import { logger } from '../../utils/utils';

/**
 * Create error response for platform check
 */
export function createPlatformErrorResponse(
  options: SymbolSearchOptions
): SymbolSearchResponse {
  return {
    success: false,
    symbols: [],
    symbolCount: 0,
    searchMode: 'full',
    partial: false,
    maxSymbols: options.maxSymbols || DEFAULT_MAX_SYMBOLS,
    error: 'Symbol search only supported on macOS'
  };
}

/**
 * Create error response for validation failures
 */
export function createValidationErrorResponse(
  options: SymbolSearchOptions,
  error: string
): SymbolSearchResponse {
  return {
    success: false,
    symbols: [],
    symbolCount: 0,
    searchMode: 'full',
    partial: false,
    maxSymbols: options.maxSymbols || DEFAULT_MAX_SYMBOLS,
    error
  };
}

/**
 * Create error response for execution failures
 */
export function createExecutionErrorResponse(
  maxSymbols: number,
  error: Error
): SymbolSearchResponse {
  return {
    success: false,
    symbols: [],
    symbolCount: 0,
    searchMode: 'full',
    partial: false,
    maxSymbols,
    error: error.message
  };
}

/**
 * Create error response for parsing failures
 */
export function createParseErrorResponse(maxSymbols: number): SymbolSearchResponse {
  return {
    success: false,
    symbols: [],
    symbolCount: 0,
    searchMode: 'full',
    partial: false,
    maxSymbols,
    error: 'Failed to parse symbol search result'
  };
}

/**
 * Validate directory input
 */
export function validateDirectory(directory: string): boolean {
  return !!directory && typeof directory === 'string';
}

/**
 * Validate language input
 */
export function validateLanguage(language: string): boolean {
  return !!language && typeof language === 'string';
}

/**
 * Build command arguments for symbol search
 */
export function buildSearchArgs(
  directory: string,
  language: string,
  maxSymbols: number
): string[] {
  return [
    'search',
    directory,
    '--language', language,
    '--max-symbols', String(maxSymbols)
  ];
}

/**
 * Log error details for debugging
 */
export function logExecutionError(error: any, stderr: any): void {
  logger.warn('Error searching symbols:', {
    message: error.message,
    code: error.code,
    signal: error.signal,
    killed: error.killed,
    stderr: stderr?.toString()?.substring(0, 500)
  });
}

/**
 * Log successful search result
 */
export function logSuccessResult(result: SymbolSearchResponse): void {
  if (result.success) {
    logger.debug('Symbol search completed:', {
      directory: result.directory,
      language: result.language,
      symbolCount: result.symbolCount
    });
  } else {
    logger.debug('Symbol search returned error:', result.error);
  }
}

/**
 * Parse JSON response with error handling
 */
export function parseSearchResponse(
  stdout: string,
  maxSymbols: number
): SymbolSearchResponse {
  try {
    const result = JSON.parse(stdout.trim()) as SymbolSearchResponse;
    logSuccessResult(result);
    return result;
  } catch (parseError) {
    logger.warn('Error parsing symbol search result:', parseError);
    return createParseErrorResponse(maxSymbols);
  }
}
