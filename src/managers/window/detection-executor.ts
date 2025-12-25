import { execFile } from 'child_process';
import config from '../../config/app-config';
import { logger, DIRECTORY_DETECTOR_PATH } from '../../utils/utils';
import type { DirectoryInfo, AppInfo, FileSearchSettings } from '../../types';
import { buildFileSearcherArgs, executeFileSearcher } from './directory-detector-helpers';

/**
 * Execute directory detection operations
 */
export class DetectionExecutor {
  constructor(
    private previousApp: AppInfo | string | null,
    private fileSearchSettings: FileSearchSettings | null
  ) {}

  /**
   * Update previous app for directory detection
   */
  updatePreviousApp(app: AppInfo | string | null): void {
    this.previousApp = app;
  }

  /**
   * Execute directory-detector native tool with fd (single stage)
   */
  async executeDirectoryDetector(timeout: number): Promise<DirectoryInfo | null> {
    if (!config.platform.isMac) {
      logger.debug('Directory detection only supported on macOS');
      return null;
    }

    const startTime = performance.now();
    const detectResult = await this.detectDirectory(timeout, startTime);

    if (!detectResult) {
      return null;
    }

    const detectElapsed = performance.now() - startTime;
    const result = await this.listFilesInDirectory(detectResult, timeout, detectElapsed, startTime);

    return result;
  }

  /**
   * Execute directory detection
   */
  private async detectDirectory(timeout: number, startTime: number): Promise<DirectoryInfo | null> {
    const detectArgs = this.buildDetectArgs();

    logger.debug('Directory detector command:', {
      executable: DIRECTORY_DETECTOR_PATH,
      args: detectArgs
    });

    const detectOptions = {
      timeout: Math.min(timeout, 3000),
      killSignal: 'SIGTERM' as const
    };

    return new Promise((resolve) => {
      execFile(DIRECTORY_DETECTOR_PATH, detectArgs, detectOptions, (error: Error | null, stdout?: string) => {
        const elapsed = performance.now() - startTime;

        if (error) {
          logger.warn(`Directory detection failed after ${elapsed.toFixed(2)}ms:`, error);
          resolve(null);
          return;
        }

        const result = this.parseDetectionResult(stdout, elapsed);
        resolve(result);
      });
    });
  }

  /**
   * Build detection arguments
   */
  private buildDetectArgs(): string[] {
    const args: string[] = ['detect'];

    if (this.previousApp && typeof this.previousApp === 'object' && this.previousApp.bundleId) {
      args.push('--bundleId', this.previousApp.bundleId);
    }

    return args;
  }

  /**
   * Parse directory detection result
   */
  private parseDetectionResult(stdout: string | undefined, elapsed: number): DirectoryInfo | null {
    try {
      const result = JSON.parse(stdout?.trim() || '{}') as DirectoryInfo;

      if (result.error) {
        logger.debug('Directory detection returned error:', result.error);
        return result;
      }

      if (!result.directory) {
        logger.debug('No directory detected');
        return null;
      }

      logger.debug(`⏱️  Directory detection completed in ${elapsed.toFixed(2)}ms`, {
        directory: result.directory,
        appName: result.appName,
        bundleId: result.bundleId
      });

      return result;
    } catch (parseError) {
      logger.warn('Error parsing directory detection result:', parseError);
      return null;
    }
  }

  /**
   * List files in detected directory
   */
  private async listFilesInDirectory(
    detectResult: DirectoryInfo,
    timeout: number,
    detectElapsed: number,
    startTime: number
  ): Promise<DirectoryInfo> {
    const listArgs = buildFileSearcherArgs(detectResult.directory!, this.fileSearchSettings);
    const remainingTimeout = Math.round(Math.max(timeout - detectElapsed, 1000));

    try {
      const fileData = await executeFileSearcher(listArgs, remainingTimeout, startTime);

      return {
        ...detectResult,
        ...fileData
      };
    } catch (execError) {
      logger.warn('Error executing file searcher:', execError);
      return detectResult;
    }
  }
}
