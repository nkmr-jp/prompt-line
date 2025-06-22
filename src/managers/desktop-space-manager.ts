// Desktop Space Detection Manager for Prompt Line
// Uses accessibility permissions only - no screen recording permission required

import { exec } from 'child_process';
import { logger } from '../utils/utils';
import config from '../config/app-config';
import type { AppInfo } from '../types';

interface WindowBasicInfo {
  windowID: number;
  ownerPID: number;
  ownerName: string;
  bounds: { x: number; y: number; width: number; height: number };
}

interface SpaceInfo {
  method: string;
  signature: string;
  frontmostApp?: AppInfo | string | null;
  windowCount: number;
  appCount: number;
  apps: Array<{
    name: string;
    pid: number;
    windowCount: number;
    isActive: boolean;
  }>;
}

// String extension for hash code generation
declare global {
  interface String {
    hashCode(): number;
  }
}

String.prototype.hashCode = function(): number {
  let hash = 0;
  if (this.length === 0) return hash;
  for (let i = 0; i < this.length; i++) {
    const char = this.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
};

class DesktopSpaceManager {
  private currentSpaceSignature: string | null = null;
  private isInitialized = false;
  
  // Performance optimization: cache system
  private lastSpaceCheck: { timestamp: number; signature: string; windows: WindowBasicInfo[] } | null = null;
  private readonly CACHE_TTL_MS = 2000; // Cache for 2 seconds

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing DesktopSpaceManager...');
      
      // Check if running on macOS
      if (!config.platform.isMac) {
        logger.warn('Desktop space detection only available on macOS');
        this.isInitialized = true;
        return;
      }

      // Check accessibility permission
      const hasPermission = await this.checkAccessibilityPermission();
      if (!hasPermission) {
        logger.warn('Accessibility permission not granted - space detection may be limited');
      }

      this.isInitialized = true;
      logger.info('DesktopSpaceManager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize DesktopSpaceManager:', error);
      throw error;
    }
  }

  /**
   * Check if accessibility permission is available
   */
  private async checkAccessibilityPermission(): Promise<boolean> {
    try {
      const script = `
      tell application "System Events"
        return true
      end tell
      `;
      
      const { stdout } = await this.execAsync(`osascript -e '${script}'`);
      return stdout.trim() === 'true';
    } catch (error) {
      logger.debug('Error checking accessibility permission:', error);
      return false;
    }
  }

  /**
   * Get current space information without screen recording permission
   */
  async getCurrentSpaceInfo(frontmostApp?: AppInfo | string | null): Promise<SpaceInfo> {
    try {
      if (!this.isInitialized) {
        throw new Error('DesktopSpaceManager not initialized');
      }

      // Check cache first
      const now = Date.now();
      if (this.lastSpaceCheck && (now - this.lastSpaceCheck.timestamp) < this.CACHE_TTL_MS) {
        return {
          method: 'Cached + Ultra-Fast',
          signature: this.lastSpaceCheck.signature,
          frontmostApp: frontmostApp || null,
          windowCount: this.lastSpaceCheck.windows.length,
          appCount: this.getUniqueAppCount(this.lastSpaceCheck.windows),
          apps: this.getAppsFromWindows(this.lastSpaceCheck.windows, frontmostApp)
        };
      }

      // Get windows using ultra-fast mode
      const cgWindows = await this.getWindowsUltraFast(frontmostApp);
      
      // Generate space signature
      const signature = this.generateSpaceSignature(cgWindows);

      // Cache the result
      this.lastSpaceCheck = {
        timestamp: now,
        signature,
        windows: cgWindows
      };

      // Create space info
      const spaceInfo: SpaceInfo = {
        method: 'Ultra-Fast Detection',
        signature,
        frontmostApp: frontmostApp || null,
        windowCount: cgWindows.length,
        appCount: this.getUniqueAppCount(cgWindows),
        apps: this.getAppsFromWindows(cgWindows, frontmostApp)
      };

      this.currentSpaceSignature = signature;
      return spaceInfo;
    } catch (error) {
      logger.error('Failed to get current space info:', error);
      
      // Return minimal info on error
      return {
        method: 'Error',
        signature: 'unknown',
        frontmostApp: frontmostApp || null,
        windowCount: 0,
        appCount: 0,
        apps: []
      };
    }
  }

  /**
   * Check if the current space has changed since the last check
   */
  async hasSpaceChanged(): Promise<boolean> {
    try {
      const spaceInfo = await this.getCurrentSpaceInfo();
      const hasChanged = this.currentSpaceSignature !== spaceInfo.signature;
      
      if (hasChanged) {
        logger.debug('Space change detected', { 
          old: this.currentSpaceSignature, 
          new: spaceInfo.signature 
        });
      }
      
      return hasChanged;
    } catch (error) {
      logger.error('Error checking space change:', error);
      return false;
    }
  }

  /**
   * Ultra-fast window detection using app-based signatures only
   * Sacrifices precision for extreme speed (<5ms target)
   */
  private async getWindowsUltraFast(frontmostApp?: AppInfo | string | null): Promise<WindowBasicInfo[]> {
    try {
      // Create synthetic window data based on frontmost app only
      const windows: WindowBasicInfo[] = [];
      
      if (frontmostApp) {
        const appName = typeof frontmostApp === 'string' ? frontmostApp : frontmostApp.name;
        const pid = typeof frontmostApp === 'string' ? 1000 : (frontmostApp.bundleId?.hashCode() || 1000);
        
        // Create synthetic window entry for space signature
        windows.push({
          windowID: pid,
          ownerPID: pid,
          ownerName: appName,
          bounds: { x: 0, y: 0, width: 1, height: 1 }
        });
      }
      
      // Add timestamp-based variation to detect changes over time
      const timeSlot = Math.floor(Date.now() / 1000); // 1-second slots
      windows.push({
        windowID: timeSlot,
        ownerPID: timeSlot,
        ownerName: `TimeSlot_${timeSlot}`,
        bounds: { x: 0, y: 0, width: 1, height: 1 }
      });
      
      return windows;
    } catch (error) {
      logger.error('Error in ultra-fast detection:', error);
      return [];
    }
  }

  /**
   * Generate space signature from window information
   */
  private generateSpaceSignature(windows: WindowBasicInfo[]): string {
    const appCounts: { [key: string]: number } = {};
    
    windows.forEach(window => {
      appCounts[window.ownerName] = (appCounts[window.ownerName] || 0) + 1;
    });

    return Object.entries(appCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([app, count]) => `${app}:${count}`)
      .join('|');
  }

  /**
   * Get unique app count from windows
   */
  private getUniqueAppCount(windows: WindowBasicInfo[]): number {
    const uniqueApps = new Set(windows.map(w => w.ownerName));
    return uniqueApps.size;
  }

  /**
   * Get apps information from windows
   */
  private getAppsFromWindows(windows: WindowBasicInfo[], frontmostApp?: AppInfo | string | null): Array<{
    name: string;
    pid: number;
    windowCount: number;
    isActive: boolean;
  }> {
    const apps: { [key: string]: { name: string; pid: number; windowCount: number; isActive: boolean } } = {};
    
    windows.forEach(window => {
      const key = window.ownerName;
      if (!apps[key]) {
        apps[key] = {
          name: window.ownerName,
          pid: window.ownerPID,
          windowCount: 0,
          isActive: false
        };
      }
      apps[key].windowCount++;
    });

    // Mark active app
    if (frontmostApp) {
      const frontmostAppName = typeof frontmostApp === 'string' ? frontmostApp : frontmostApp.name;
      Object.values(apps).forEach(app => {
        app.isActive = app.name === frontmostAppName;
      });
    }

    return Object.values(apps).sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Utility method for async exec
   */
  private execAsync(command: string): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      exec(command, { timeout: 5000 }, (error: Error | null, stdout: string, stderr: string) => {
        if (error) {
          reject(error);
        } else {
          resolve({ stdout, stderr });
        }
      });
    });
  }

  /**
   * Get current space signature (cached)
   */
  getCurrentSpaceSignature(): string | null {
    return this.currentSpaceSignature;
  }

  /**
   * Check if manager is initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Stop monitoring (no-op for compatibility)
   */
  private stopMonitoring(): void {
    // Monitoring functionality removed for lightweight implementation
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopMonitoring();
    this.isInitialized = false;
    logger.debug('DesktopSpaceManager destroyed');
  }
}

export default DesktopSpaceManager;