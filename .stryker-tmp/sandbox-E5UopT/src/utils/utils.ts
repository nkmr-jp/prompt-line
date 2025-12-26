/**
 * Utils module - re-exports all utility functions for backward compatibility
 *
 * This file maintains the original API while the implementation is split into:
 * - logger.ts: Logging and sensitive data masking
 * - security.ts: Security utilities and error handling
 * - native-tools.ts: macOS native tool execution
 * - common.ts: General utilities (debounce, JSON, etc.)
 * - file-utils.ts: File system operations
 */
// @ts-nocheck


// Logger
export { logger, maskSensitiveData } from './logger';

// Security
export { SecureErrors, handleError, sanitizeCommandArgument, isCommandArgumentSafe } from './security';

// Native tools
export { getCurrentApp, getActiveWindowBounds, pasteWithNativeTool, activateAndPasteWithNativeTool, checkAccessibilityPermission, detectCurrentDirectory, detectCurrentDirectoryWithFiles, listDirectory, KEYBOARD_SIMULATOR_PATH, TEXT_FIELD_DETECTOR_PATH, WINDOW_DETECTOR_PATH, DIRECTORY_DETECTOR_PATH, FILE_SEARCHER_PATH, SYMBOL_SEARCHER_PATH } from './native-tools';
export type { DirectoryDetectionOptions } from './native-tools';

// Common utilities
export { debounce, safeJsonParse, safeJsonStringify, generateId, sleep } from './common';

// File utilities
export { ensureDir, fileExists } from './file-utils';

// Apple Script sanitizer (re-export from original location)
export { sanitizeAppleScript, executeAppleScriptSafely, validateAppleScriptSecurity } from './apple-script-sanitizer';