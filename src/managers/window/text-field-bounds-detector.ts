/**
 * Text Field Bounds Detector
 *
 * Shared utility for detecting focused text field bounds using native macOS tools.
 * This module consolidates the duplicate getActiveTextFieldBounds implementations
 * from NativeToolExecutor and WindowPositionCalculator.
 */

import { execFile } from 'child_process';
import { TEXT_FIELD_DETECTOR_PATH } from '../../utils/utils';
import config from '../../config/app-config';
import type { TextFieldBounds } from './types';
import { TIMEOUTS } from '../../constants';

/**
 * Detects the bounds of the currently focused text field on macOS.
 * Uses a native Swift tool to query accessibility APIs for text field location.
 *
 * @returns Promise resolving to text field bounds, or null if not found/not macOS
 */
export async function getActiveTextFieldBounds(): Promise<TextFieldBounds | null> {
  if (!config.platform.isMac) {
    return null;
  }

  const options = {
    timeout: TIMEOUTS.TEXT_FIELD_DETECTION,
    killSignal: 'SIGTERM' as const
  };

  return new Promise((resolve) => {
    execFile(TEXT_FIELD_DETECTOR_PATH, ['text-field-bounds'], options, (error: Error | null, stdout?: string) => {
      if (error) {
        resolve(null);
        return;
      }

      try {
        const result = JSON.parse(stdout?.trim() || '{}');

        if (result.error) {
          resolve(null);
          return;
        }

        if (result.success && typeof result.x === 'number' && typeof result.y === 'number' &&
            typeof result.width === 'number' && typeof result.height === 'number') {

          let bounds: TextFieldBounds = {
            x: result.x,
            y: result.y,
            width: result.width,
            height: result.height
          };

          // Use parent container bounds if available for better positioning with scrollable content
          if (result.parent && result.parent.isVisibleContainer &&
              typeof result.parent.x === 'number' && typeof result.parent.y === 'number' &&
              typeof result.parent.width === 'number' && typeof result.parent.height === 'number') {
            bounds = {
              x: result.parent.x,
              y: result.parent.y,
              width: result.parent.width,
              height: result.parent.height
            };
          }

          resolve(bounds);
          return;
        }

        resolve(null);
      } catch {
        resolve(null);
      }
    });
  });
}
