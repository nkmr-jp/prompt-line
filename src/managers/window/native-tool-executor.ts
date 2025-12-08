import { execFile } from 'child_process';
import { logger, TEXT_FIELD_DETECTOR_PATH, KEYBOARD_SIMULATOR_PATH } from '../../utils/utils';
import config from '../../config/app-config';
import type { AppInfo } from '../../types';

/**
 * NativeToolExecutor handles execution of native macOS tools for window management
 * Extracted from WindowManager to improve code organization and testability
 */
class NativeToolExecutor {
  private previousApp: AppInfo | string | null = null;

  /**
   * Get bounds of the currently focused text field using native text-field-detector tool
   * Uses JSON response parsing with comprehensive error handling
   * @returns Promise with text field bounds or null if not found/error
   */
  async getActiveTextFieldBounds(): Promise<{ x: number; y: number; width: number; height: number } | null> {
    if (!config.platform.isMac) {
      logger.debug('Text field detection only supported on macOS');
      return null;
    }

    const options = {
      timeout: 3000,
      killSignal: 'SIGTERM' as const
    };

    return new Promise((resolve) => {
      execFile(TEXT_FIELD_DETECTOR_PATH, ['text-field-bounds'], options, (error: Error | null, stdout?: string) => {
        if (error) {
          logger.debug('Error getting text field bounds via native tool:', error);
          resolve(null);
          return;
        }

        try {
          const result = JSON.parse(stdout?.trim() || '{}');

          if (result.error) {
            logger.debug('Text field detector error:', result.error);
            resolve(null);
            return;
          }

          if (result.success && typeof result.x === 'number' && typeof result.y === 'number' &&
              typeof result.width === 'number' && typeof result.height === 'number') {

            let bounds = {
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

            logger.debug('Text field bounds found:', bounds);
            resolve(bounds);
            return;
          }

          logger.debug('Invalid text field bounds data received');
          resolve(null);
        } catch (parseError) {
          logger.debug('Error parsing text field detector output:', parseError);
          resolve(null);
        }
      });
    });
  }

  /**
   * Focus the previously active application using native keyboard-simulator tool
   * Supports both bundle ID (preferred) and app name fallback
   * @returns Promise<boolean> indicating success
   */
  async focusPreviousApp(): Promise<boolean> {
    try {
      if (!this.previousApp || !config.platform.isMac) {
        logger.debug('No previous app to focus or not on macOS');
        return false;
      }

      let appName: string;
      let bundleId: string | null = null;

      if (typeof this.previousApp === 'string') {
        appName = this.previousApp;
      } else if (this.previousApp && typeof this.previousApp === 'object') {
        appName = this.previousApp.name;
        bundleId = this.previousApp.bundleId || null;
      } else {
        logger.error('Invalid previousApp format:', this.previousApp);
        return false;
      }

      const options = {
        timeout: 3000,
        killSignal: 'SIGTERM' as const
      };

      let args: string[];
      if (bundleId) {
        args = ['activate-bundle', bundleId];
        logger.debug('Using bundle ID for app activation:', { appName, bundleId });
      } else {
        args = ['activate-name', appName];
        logger.debug('Using app name for activation:', { appName });
      }

      return new Promise((resolve) => {
        execFile(KEYBOARD_SIMULATOR_PATH, args, options, (error: Error | null, stdout?: string) => {
          if (error) {
            logger.error('Error focusing previous app:', error);
            resolve(false);
          } else {
            try {
              const result = JSON.parse(stdout?.trim() || '{}');
              if (result.success) {
                logger.debug('Successfully focused previous app:', { appName, bundleId });
                resolve(true);
              } else {
                logger.warn('Native tool failed to focus app:', result);
                resolve(false);
              }
            } catch (parseError) {
              logger.warn('Error parsing focus app result:', parseError);
              resolve(false);
            }
          }
        });
      });
    } catch (error) {
      logger.error('Failed to focus previous app:', error);
      return false;
    }
  }

  /**
   * Store the previously active application for later restoration
   * @param app App info (name + bundleId) or just app name
   */
  setPreviousApp(app: AppInfo | string | null): void {
    this.previousApp = app;
    logger.debug('Previous app stored:', app);
  }

  /**
   * Get the stored previous app
   * @returns Stored app info or null
   */
  getPreviousApp(): AppInfo | string | null {
    return this.previousApp;
  }
}

export default NativeToolExecutor;
