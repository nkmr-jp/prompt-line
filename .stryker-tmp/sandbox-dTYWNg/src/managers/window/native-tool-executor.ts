// @ts-nocheck
import { execFile } from 'child_process';
import { logger, KEYBOARD_SIMULATOR_PATH } from '../../utils/utils';
import config from '../../config/app-config';
import type { AppInfo } from '../../types';

/**
 * NativeToolExecutor handles execution of native macOS tools for window management
 * Extracted from WindowManager to improve code organization and testability
 *
 * Note: Text field bounds detection is now handled by text-field-bounds-detector.ts
 */
class NativeToolExecutor {
  private previousApp: AppInfo | string | null = null;

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
