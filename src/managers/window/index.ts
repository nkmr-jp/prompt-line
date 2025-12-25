/**
 * Window Manager Module
 *
 * Handles window lifecycle management with native macOS integration.
 * This module is split into multiple submodules for maintainability:
 *
 * - types.ts: Type definitions for window management
 * - position-calculator.ts: Window positioning algorithms
 * - native-tool-executor.ts: Native macOS tool execution
 * - directory-detector.ts: Directory detection and file search
 * - window-manager.ts: Main window manager orchestration
 */

// Main export - WindowManager coordinator
export { default as WindowManager, default } from './window-manager';

// Type exports for external use
export type {
  PositioningMode,
  WindowPosition,
  TextFieldBounds,
  WindowSettings,
  AppInfo,
  DirectoryInfo,
  FileSearchSettings,
  WindowData,
  SpaceInfo
} from './types';

// Submodule exports (for advanced usage or testing)
export { default as WindowPositionCalculator } from './position-calculator';
export { default as NativeToolExecutor } from './native-tool-executor';
export { default as DirectoryDetector } from './directory-detector';
export { getActiveTextFieldBounds } from './text-field-bounds-detector';
