import { logger, detectCurrentDirectoryWithFiles } from '../utils/utils';

export class DirectoryDetector {
  async testDirectoryDetection(): Promise<void> {
    try {
      logger.debug('Testing directory detection feature...');
      const startTime = performance.now();

      const result = await detectCurrentDirectoryWithFiles();
      const duration = performance.now() - startTime;

      if (result.error) {
        this.logErrorResult(result, duration);
      } else {
        this.logSuccessResult(result, duration);
      }
    } catch (error) {
      logger.warn('Directory detection test failed:', error);
    }
  }

  private logErrorResult(result: any, duration: number): void {
    logger.debug('Directory detection result (error):', {
      error: result.error,
      appName: result.appName,
      bundleId: result.bundleId,
      duration: `${duration.toFixed(2)}ms`
    });
  }

  private logSuccessResult(result: any, duration: number): void {
    logger.debug('Directory detection result (success):', {
      directory: result.directory,
      fileCount: result.fileCount,
      method: result.method,
      tty: result.tty,
      pid: result.pid,
      idePid: result.idePid,
      appName: result.appName,
      bundleId: result.bundleId,
      duration: `${duration.toFixed(2)}ms`
    });

    if (result.files && result.files.length > 0) {
      const sampleFiles = result.files.slice(0, 5).map((f: any) => ({
        name: f.name,
        isDirectory: f.isDirectory
      }));
      logger.debug('Sample files:', sampleFiles);
    }
  }
}
