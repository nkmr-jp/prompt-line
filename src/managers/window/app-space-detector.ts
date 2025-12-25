import { getCurrentApp, logger } from '../../utils/utils';
import type { AppInfo } from '../../types';
import type DesktopSpaceManager from '../desktop-space-manager';
import type NativeToolExecutor from './native-tool-executor';
import type DirectoryDetector from './directory-detector';

/**
 * AppSpaceDetector handles app and desktop space detection
 * Extracted from WindowManager to reduce file complexity
 */
export class AppSpaceDetector {
  private desktopSpaceManager: DesktopSpaceManager | null;
  private nativeToolExecutor: NativeToolExecutor;
  private directoryDetector: DirectoryDetector;
  private lastSpaceSignature: string | null = null;

  constructor(
    desktopSpaceManager: DesktopSpaceManager | null,
    nativeToolExecutor: NativeToolExecutor,
    directoryDetector: DirectoryDetector
  ) {
    this.desktopSpaceManager = desktopSpaceManager;
    this.nativeToolExecutor = nativeToolExecutor;
    this.directoryDetector = directoryDetector;
  }

  /**
   * Get last space signature
   */
  getLastSpaceSignature(): string | null {
    return this.lastSpaceSignature;
  }

  /**
   * Set last space signature
   */
  setLastSpaceSignature(signature: string | null): void {
    this.lastSpaceSignature = signature;
  }

  /**
   * Detect current app and desktop space in parallel
   */
  async detectAppAndSpace(): Promise<{
    previousApp: AppInfo | string | null;
    currentSpaceInfo: any;
  }> {
    const appSpaceStartTime = performance.now();
    const [currentAppResult, currentSpaceResult] = await Promise.allSettled([
      getCurrentApp(),
      this.desktopSpaceManager?.isReady()
        ? this.desktopSpaceManager.getCurrentSpaceInfo(null)
        : Promise.resolve(null)
    ]);
    logger.debug(`⏱️  App + Space detection (parallel): ${(performance.now() - appSpaceStartTime).toFixed(2)}ms`);

    const previousApp = this.processCurrentAppResult(currentAppResult);
    const currentSpaceInfo = await this.processSpaceResult(currentSpaceResult, previousApp);

    return { previousApp, currentSpaceInfo };
  }

  /**
   * Process current app detection result
   * @private
   */
  private processCurrentAppResult(
    result: PromiseSettledResult<AppInfo | string | null>
  ): AppInfo | string | null {
    if (result.status === 'fulfilled') {
      const previousApp = result.value;
      this.nativeToolExecutor.setPreviousApp(previousApp);
      this.directoryDetector.updatePreviousApp(previousApp);
      return previousApp;
    }

    logger.error('Failed to get current app:', result.reason);
    return null;
  }

  /**
   * Process space detection result
   * @private
   */
  private async processSpaceResult(
    result: PromiseSettledResult<any>,
    previousApp: AppInfo | string | null
  ): Promise<any> {
    const spaceProcessStartTime = performance.now();

    if (result.status === 'rejected') {
      logger.warn('Failed to get current space info:', result.reason);
      logger.debug(`⏱️  Space processing: ${(performance.now() - spaceProcessStartTime).toFixed(2)}ms`);
      return null;
    }

    if (!result.value) {
      logger.debug(`⏱️  Space processing: ${(performance.now() - spaceProcessStartTime).toFixed(2)}ms`);
      return null;
    }

    let currentSpaceInfo = result.value;

    // Update space info with actual app information
    if (previousApp && this.desktopSpaceManager) {
      currentSpaceInfo = await this.updateSpaceInfoWithApp(currentSpaceInfo, previousApp);
    }

    logger.debug('Current space info:', {
      signature: currentSpaceInfo.signature,
      appCount: currentSpaceInfo.appCount,
      method: currentSpaceInfo.method
    });

    logger.debug(`⏱️  Space processing: ${(performance.now() - spaceProcessStartTime).toFixed(2)}ms`);
    return currentSpaceInfo;
  }

  /**
   * Update space info with app information
   * @private
   */
  private async updateSpaceInfoWithApp(currentSpaceInfo: any, previousApp: AppInfo | string | null): Promise<any> {
    try {
      const spaceUpdateStartTime = performance.now();
      const updatedInfo = await this.desktopSpaceManager!.getCurrentSpaceInfo(previousApp);
      logger.debug(`⏱️  Space info update with app: ${(performance.now() - spaceUpdateStartTime).toFixed(2)}ms`);
      return updatedInfo;
    } catch (error) {
      logger.debug('Failed to update space info with app:', error);
      return currentSpaceInfo;
    }
  }

  /**
   * Determine if window recreation is needed
   */
  determineWindowRecreation(currentSpaceInfo: any, inputWindow: any): boolean {
    if (!currentSpaceInfo) {
      return !inputWindow || inputWindow.isDestroyed();
    }

    // Check if desktop space has changed
    if (this.lastSpaceSignature !== currentSpaceInfo.signature) {
      logger.debug('Desktop space changed, window recreation needed', {
        lastSignature: this.lastSpaceSignature,
        currentSignature: currentSpaceInfo.signature
      });
      this.lastSpaceSignature = currentSpaceInfo.signature;
      return true;
    }

    this.lastSpaceSignature = currentSpaceInfo.signature;
    return false;
  }
}

export default AppSpaceDetector;
