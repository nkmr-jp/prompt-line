/**
 * Native Tools module - re-exports for backward compatibility
 *
 * This file maintains the original API while the implementation is split into:
 * - native-tools/paths.ts: Tool path constants
 * - native-tools/app-detection.ts: App and window detection
 * - native-tools/paste-operations.ts: Paste and activate operations
 * - native-tools/directory-operations.ts: Directory detection and listing
 */

export {
  // Path constants
  WINDOW_DETECTOR_PATH,
  KEYBOARD_SIMULATOR_PATH,
  TEXT_FIELD_DETECTOR_PATH,
  DIRECTORY_DETECTOR_PATH,
  FILE_SEARCHER_PATH,
  SYMBOL_SEARCHER_PATH,
  // App detection
  getCurrentApp,
  getActiveWindowBounds,
  checkAccessibilityPermission,
  // Paste operations
  pasteWithNativeTool,
  activateAndPasteWithNativeTool,
  // Directory operations
  detectCurrentDirectory,
  detectCurrentDirectoryWithFiles,
  listDirectory,
} from './native-tools/index';

export type { DirectoryDetectionOptions } from './native-tools/index';
