import type { DirectoryInfo, FileSearchSettings, AppInfo } from '../../../types';

/**
 * Strategy interface for directory detection
 * Each strategy implements a different method for detecting the current working directory
 */
export interface IDirectoryDetectionStrategy {
  /**
   * Detect directory using the strategy's method
   * @param timeout Timeout in milliseconds
   * @param previousApp Previous application info for context
   * @param fileSearchSettings File search settings
   * @returns DirectoryInfo or null on error
   */
  detect(
    timeout: number,
    previousApp: AppInfo | string | null,
    fileSearchSettings: FileSearchSettings | null
  ): Promise<DirectoryInfo | null>;

  /**
   * Check if the strategy is available on the current platform
   */
  isAvailable(): boolean;

  /**
   * Get strategy name for logging
   */
  getName(): string;
}
