/**
 * Text Field Bounds Detector
 *
 * Shared utility for detecting focused text field bounds using native macOS tools.
 * This module consolidates the duplicate getActiveTextFieldBounds implementations
 * from NativeToolExecutor and WindowPositionCalculator.
 */

import { execFile } from 'child_process';
import { logger, TEXT_FIELD_DETECTOR_PATH } from '../../utils/utils';
import config from '../../config/app-config';
import type { TextFieldBounds, TextFieldDetectionResult } from './types';

/**
 * Detects the bounds of the currently focused text field on macOS.
 * Uses a native Swift tool to query accessibility APIs for text field location.
 *
 * @returns Promise resolving to text field bounds, or null if not found/not macOS
 */
export async function getActiveTextFieldBounds(): Promise<TextFieldBounds | null> {
  const result = await detectTextFieldWithAppInfo();
  return result.bounds;
}

/**
 * Detects the focused text field bounds along with app info.
 * Returns bundleId even when text field detection fails, enabling
 * app-specific fallback strategies.
 *
 * @returns Promise resolving to detection result with bounds and app info
 */
export async function detectTextFieldWithAppInfo(): Promise<TextFieldDetectionResult> {
  if (!config.platform.isMac) {
    logger.debug('Text field detection only supported on macOS');
    return { bounds: null };
  }

  const options = {
    timeout: 3000,
    killSignal: 'SIGTERM' as const
  };

  return new Promise((resolve) => {
    execFile(TEXT_FIELD_DETECTOR_PATH, ['text-field-bounds'], options, (error: Error | null, stdout?: string) => {
      if (error) {
        logger.debug('Error getting text field bounds via native tool:', error);
        resolve({ bounds: null });
        return;
      }

      try {
        const result = JSON.parse(stdout?.trim() || '{}');

        // Extract app info (available in both success and error responses)
        const bundleId = typeof result.bundleId === 'string' ? result.bundleId : undefined;
        const appName = typeof result.appName === 'string' ? result.appName : undefined;

        if (result.error) {
          logger.debug('Text field detector error: ' + result.error, { bundleId, appName });
          resolve({ bounds: null, bundleId, appName });
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
            logger.debug('Using parent container bounds for scrollable text field');
            bounds = {
              x: result.parent.x,
              y: result.parent.y,
              width: result.parent.width,
              height: result.parent.height
            };
          }

          logger.debug('Text field bounds found', { ...bounds, bundleId, appName });
          resolve({ bounds, bundleId, appName });
          return;
        }

        logger.debug('Invalid text field bounds data received', { bundleId, appName });
        resolve({ bounds: null, bundleId, appName });
      } catch (parseError) {
        logger.debug('Error parsing text field detector output:', parseError);
        resolve({ bounds: null });
      }
    });
  });
}
