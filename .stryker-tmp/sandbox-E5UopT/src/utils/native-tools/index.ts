/**
 * Native Tools module - macOS native tool integration
 *
 * This module provides integration with compiled Swift native tools for:
 * - App detection (window-detector)
 * - Keyboard simulation (keyboard-simulator)
 * - Directory detection (directory-detector)
 * - File searching (file-searcher)
 */
// @ts-nocheck


// Path constants
export { WINDOW_DETECTOR_PATH, KEYBOARD_SIMULATOR_PATH, TEXT_FIELD_DETECTOR_PATH, DIRECTORY_DETECTOR_PATH, FILE_SEARCHER_PATH, SYMBOL_SEARCHER_PATH } from './paths';

// App detection
export { getCurrentApp, getActiveWindowBounds, checkAccessibilityPermission } from './app-detection';

// Paste operations
export { pasteWithNativeTool, activateAndPasteWithNativeTool } from './paste-operations';

// Directory operations
export { detectCurrentDirectory, detectCurrentDirectoryWithFiles, listDirectory } from './directory-operations';
export type { DirectoryDetectionOptions } from './directory-operations';