import { IPlatformTools, WindowBounds, AppInfo, TextFieldBounds } from './platform-interface';
import { 
  getActiveWindowBounds as getNativeWindowBounds,
  getCurrentApp as getNativeCurrentApp,
  pasteWithNativeTool,
  activateAndPasteWithNativeTool,
  checkAccessibilityPermission,
  TEXT_FIELD_DETECTOR_PATH,
  KEYBOARD_SIMULATOR_PATH,
  logger
} from '../utils/utils';
import { exec } from 'child_process';
import config from '../config/app-config';

export class MacPlatformTools implements IPlatformTools {
  async getActiveWindowBounds(): Promise<WindowBounds | null> {
    return getNativeWindowBounds();
  }

  async getCurrentApp(): Promise<AppInfo | null> {
    return getNativeCurrentApp();
  }

  async pasteText(): Promise<void> {
    await pasteWithNativeTool();
  }

  async activateApp(identifier: string, useBundle: boolean = false): Promise<void> {
    const options = {
      timeout: 3000,
      killSignal: 'SIGTERM' as const
    };

    const command = useBundle 
      ? `"${KEYBOARD_SIMULATOR_PATH}" activate-bundle "${identifier}"`
      : `"${KEYBOARD_SIMULATOR_PATH}" activate-name "${identifier}"`;

    return new Promise((resolve, reject) => {
      exec(command, options, (error: Error | null, stdout?: string) => {
        if (error) {
          logger.error('Error activating app:', error);
          reject(error);
          return;
        }

        try {
          const result = JSON.parse(stdout?.trim() || '{}');
          if (result.success) {
            logger.debug('Successfully activated app:', { identifier, useBundle });
            resolve();
          } else {
            logger.warn('Native tool failed to activate app:', result);
            reject(new Error(result.error || 'Failed to activate app'));
          }
        } catch (parseError) {
          logger.warn('Error parsing activate app result:', parseError);
          reject(parseError);
        }
      });
    });
  }

  async activateAndPaste(identifier: string, _useBundle: boolean = false): Promise<void> {
    await activateAndPasteWithNativeTool(identifier);
  }

  async getActiveTextFieldBounds(): Promise<TextFieldBounds | null> {
    if (!config.platform.isMac) {
      logger.debug('Text field detection only supported on macOS');
      return null;
    }

    const options = {
      timeout: 3000,
      killSignal: 'SIGTERM' as const
    };

    return new Promise((resolve) => {
      exec(`"${TEXT_FIELD_DETECTOR_PATH}" text-field-bounds`, options, (error: Error | null, stdout?: string) => {
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
              height: result.height,
              isEnabled: result.isEnabled,
              hasText: result.hasText
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
                height: result.parent.height,
                isEnabled: result.isEnabled,
                hasText: result.hasText
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

  async checkAccessibilityPermissions(): Promise<boolean> {
    try {
      const result = await checkAccessibilityPermission();
      return result.hasPermission;
    } catch (error) {
      console.error('Error checking accessibility permissions:', error);
      return false;
    }
  }
}