/**
 * Window Manager Type Definitions
 *
 * This file contains type definitions specific to window management functionality.
 * Core types are imported from the main types module to maintain consistency.
 */

import type {
  AppInfo,
  DirectoryInfo,
  FileSearchSettings,
  StartupPosition,
  WindowData,
  SpaceInfo
} from '../../types';

/**
 * Window positioning mode
 * - active-text-field: Position near focused text field (default, falls back to active-window-center)
 * - active-window-center: Center within active window
 * - cursor: Position at mouse cursor location
 * - center: Center on primary display
 */
export type PositioningMode = StartupPosition;

/**
 * Window position coordinates
 */
export interface WindowPosition {
  x: number;
  y: number;
}

/**
 * Text field bounds from native detector
 */
export interface TextFieldBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Window customization settings
 */
export interface WindowSettings {
  position?: PositioningMode;
  width?: number;
  height?: number;
}

/**
 * Re-export core types for convenience
 */
export type {
  AppInfo,
  DirectoryInfo,
  FileSearchSettings,
  WindowData,
  SpaceInfo
};
