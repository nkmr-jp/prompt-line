import { logger } from '../../utils/utils';
import type { FileSearchSettings } from '../../types';

/**
 * Checks if fd command is available on the system
 * Handles custom paths from settings and common installation paths
 */
export class FdAvailabilityChecker {
  private fdCommandAvailable: boolean = true;
  private fdCommandChecked: boolean = false;

  /**
   * Check if fd command is available (only runs once)
   */
  async check(settings: FileSearchSettings | null): Promise<void> {
    if (this.fdCommandChecked) {
      return;
    }
    this.fdCommandChecked = true;

    const customPath = settings?.fdPath;
    if (customPath && this.checkCustomPath(customPath)) {
      return;
    }

    this.fdCommandAvailable = this.checkCommonPaths();
  }

  /**
   * Get availability status
   */
  isAvailable(): boolean {
    return this.fdCommandAvailable;
  }

  /**
   * Check custom fd path from settings
   */
  private checkCustomPath(customPath: string): boolean {
    const fs = require('fs');
    if (fs.existsSync(customPath)) {
      this.fdCommandAvailable = true;
      logger.debug(`fd command found at custom path: ${customPath}`);
      return true;
    }

    logger.warn(`Custom fdPath "${customPath}" does not exist, falling back to auto-detect`);
    return false;
  }

  /**
   * Check common fd installation paths
   */
  private checkCommonPaths(): boolean {
    const fs = require('fs');
    const fdPaths = [
      '/opt/homebrew/bin/fd',  // Apple Silicon Homebrew
      '/usr/local/bin/fd',     // Intel Homebrew
      '/usr/bin/fd'            // System
    ];

    for (const fdPath of fdPaths) {
      if (fs.existsSync(fdPath)) {
        logger.debug(`fd command found at: ${fdPath}`);
        return true;
      }
    }

    logger.warn('fd command is not available. File search will not work. Install with: brew install fd');
    return false;
  }
}
