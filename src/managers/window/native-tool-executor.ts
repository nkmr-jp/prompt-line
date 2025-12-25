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

        const bounds = this.parseTextFieldBounds(stdout);
        resolve(bounds);
      });
    });
  }

  /**
   * Parse text field bounds from JSON response
   * @private
   */
  private parseTextFieldBounds(stdout?: string): { x: number; y: number; width: number; height: number } | null {
    try {
      const result = JSON.parse(stdout?.trim() || '{}');

      if (result.error) {
        logger.debug('Text field detector error:', result.error);
        return null;
      }

      if (!this.isValidBoundsResult(result)) {
        logger.debug('Invalid text field bounds data received');
        return null;
      }

      return this.extractBoundsFromResult(result);
    } catch (parseError) {
      logger.debug('Error parsing text field detector output:', parseError);
      return null;
    }
  }

  /**
   * Check if result contains valid bounds data
   * @private
   */
  private isValidBoundsResult(result: any): boolean {
    return result.success &&
           typeof result.x === 'number' &&
           typeof result.y === 'number' &&
           typeof result.width === 'number' &&
           typeof result.height === 'number';
  }

  /**
   * Extract bounds from result, preferring parent container if available
   * @private
   */
  private extractBoundsFromResult(result: any): { x: number; y: number; width: number; height: number } {
    let bounds = {
      x: result.x,
      y: result.y,
      width: result.width,
      height: result.height
    };

    // Use parent container bounds if available for better positioning with scrollable content
    const parent = result.parent;
    if (parent?.isVisibleContainer && this.isValidParentBounds(parent)) {
      logger.debug('Using parent container bounds for scrollable text field');
      bounds = {
        x: parent.x,
        y: parent.y,
        width: parent.width,
        height: parent.height
      };
    }

    logger.debug('Text field bounds found:', bounds);
    return bounds;
  }

  /**
   * Check if parent bounds data is valid
   * @private
   */
  private isValidParentBounds(parent: any): boolean {
    return typeof parent.x === 'number' &&
           typeof parent.y === 'number' &&
           typeof parent.width === 'number' &&
           typeof parent.height === 'number';
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

      const appInfo = this.extractAppInfo(this.previousApp);
      if (!appInfo) {
        logger.error('Invalid previousApp format:', this.previousApp);
        return false;
      }

      const args = this.buildActivationArgs(appInfo);
      return await this.executeAppActivation(args, appInfo);
    } catch (error) {
      logger.error('Failed to focus previous app:', error);
      return false;
    }
  }

  /**
   * Extract app name and bundle ID from previousApp
   * @private
   */
  private extractAppInfo(app: AppInfo | string): { appName: string; bundleId: string | null } | null {
    if (typeof app === 'string') {
      return { appName: app, bundleId: null };
    }

    if (app && typeof app === 'object') {
      return {
        appName: app.name,
        bundleId: app.bundleId || null
      };
    }

    return null;
  }

  /**
   * Build activation arguments for keyboard simulator
   * @private
   */
  private buildActivationArgs(appInfo: { appName: string; bundleId: string | null }): string[] {
    if (appInfo.bundleId) {
      logger.debug('Using bundle ID for app activation:', appInfo);
      return ['activate-bundle', appInfo.bundleId];
    }

    logger.debug('Using app name for activation:', { appName: appInfo.appName });
    return ['activate-name', appInfo.appName];
  }

  /**
   * Execute app activation command
   * @private
   */
  private async executeAppActivation(
    args: string[],
    appInfo: { appName: string; bundleId: string | null }
  ): Promise<boolean> {
    const options = {
      timeout: 3000,
      killSignal: 'SIGTERM' as const
    };

    return new Promise((resolve) => {
      execFile(KEYBOARD_SIMULATOR_PATH, args, options, (error: Error | null, stdout?: string) => {
        if (error) {
          logger.error('Error focusing previous app:', error);
          resolve(false);
          return;
        }

        const success = this.parseActivationResult(stdout, appInfo);
        resolve(success);
      });
    });
  }

  /**
   * Parse activation result from JSON response
   * @private
   */
  private parseActivationResult(stdout: string | undefined, appInfo: { appName: string; bundleId: string | null }): boolean {
    try {
      const result = JSON.parse(stdout?.trim() || '{}');
      if (result.success) {
        logger.debug('Successfully focused previous app:', appInfo);
        return true;
      }

      logger.warn('Native tool failed to focus app:', result);
      return false;
    } catch (parseError) {
      logger.warn('Error parsing focus app result:', parseError);
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
