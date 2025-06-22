// desktop-space-manager.ts
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
  windowName?: string; // Will be null without screen recording permission
}

interface AXWindowInfo {
  appName: string;
  pid: number;
  title: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
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

class DesktopSpaceManager {
  private currentSpaceSignature: string | null = null;
  private isInitialized = false;
  private spaceChangeCallbacks: Array<(spaceInfo: SpaceInfo) => void> = [];
  private monitoringInterval: NodeJS.Timeout | null = null;

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
        logger.warn('Accessibility permission not granted - limited functionality available');
      }

      this.isInitialized = true;
      logger.info('DesktopSpaceManager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize DesktopSpaceManager:', error);
      throw error;
    }
  }

  async checkAccessibilityPermission(): Promise<boolean> {
    try {
      const script = `
      tell application "System Events"
        try
          set testWindows to windows of process "System Events"
          return true
        on error
          return false
        end try
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

      // Get windows using limited CGWindowList (no screen recording needed)
      const cgWindows = await this.getWindowsWithoutScreenRecording();
      
      // Get detailed window info using AXUIElement (accessibility permission only)
      // const axWindows = await this.getWindowsUsingAccessibility();

      // Generate space signature
      const signature = this.generateSpaceSignature(cgWindows);

      // Create space info
      const spaceInfo: SpaceInfo = {
        method: 'Accessibility + Limited CGWindowList',
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
  async hasSpaceChanged(frontmostApp?: AppInfo | string | null): Promise<boolean> {
    try {
      const spaceInfo = await this.getCurrentSpaceInfo(frontmostApp);
      const hasChanged = spaceInfo.signature !== this.currentSpaceSignature;
      
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
   * Start monitoring space changes
   */
  startMonitoring(callback: (spaceInfo: SpaceInfo) => void, interval: number = 1000): void {
    if (this.monitoringInterval) {
      this.stopMonitoring();
    }

    this.spaceChangeCallbacks.push(callback);

    this.monitoringInterval = setInterval(async () => {
      try {
        const spaceInfo = await this.getCurrentSpaceInfo();
        
        if (spaceInfo.signature !== this.currentSpaceSignature) {
          this.currentSpaceSignature = spaceInfo.signature;
          
          // Notify all callbacks
          this.spaceChangeCallbacks.forEach(cb => {
            try {
              cb(spaceInfo);
            } catch (error) {
              logger.error('Error in space change callback:', error);
            }
          });
        }
      } catch (error) {
        logger.error('Error during space monitoring:', error);
      }
    }, interval);

    logger.debug('Started space monitoring', { interval });
  }

  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    this.spaceChangeCallbacks = [];
    logger.debug('Stopped space monitoring');
  }

  /**
   * Get windows using CGWindowList without screen recording permission
   */
  private async getWindowsWithoutScreenRecording(): Promise<WindowBasicInfo[]> {
    try {
      // Create temporary Swift script
      const swiftCode = `
      import Cocoa
      
      let windows = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] ?? []
      
      var result: [[String: Any]] = []
      for window in windows {
          if let pid = window[kCGWindowOwnerPID as String] as? Int,
             let ownerName = window[kCGWindowOwnerName as String] as? String,
             let bounds = window[kCGWindowBounds as String] as? [String: CGFloat],
             let windowID = window[kCGWindowNumber as String] as? Int {
              
              result.append([
                  "pid": pid,
                  "ownerName": ownerName,
                  "windowID": windowID,
                  "x": bounds["X"] ?? 0,
                  "y": bounds["Y"] ?? 0,
                  "width": bounds["Width"] ?? 0,
                  "height": bounds["Height"] ?? 0
              ])
          }
      }
      
      let jsonData = try! JSONSerialization.data(withJSONObject: result)
      print(String(data: jsonData, encoding: .utf8)!)
      `;

      const result = await this.executeSwiftCode(swiftCode);
      return JSON.parse(result);
    } catch (error) {
      logger.error('Error getting windows without screen recording:', error);
      return [];
    }
  }

  /**
   * Get windows using AppleScript accessibility features
   * Currently not used but kept for potential future implementation
   */
  // @ts-expect-error - Method kept for future use
  private async getWindowsUsingAccessibility(): Promise<AXWindowInfo[]> {
    try {
      const script = `
      set windowList to {}
      
      tell application "System Events"
          set appList to application processes whose visible is true
          
          repeat with currentApp in appList
              set appName to name of currentApp
              set appPID to unix id of currentApp
              
              try
                  set appWindows to windows of currentApp
                  repeat with currentWindow in appWindows
                      try
                          set windowTitle to title of currentWindow
                          set windowPosition to position of currentWindow
                          set windowSize to size of currentWindow
                          
                          set windowInfo to {appName:appName, pid:appPID, title:windowTitle, x:item 1 of windowPosition, y:item 2 of windowPosition, width:item 1 of windowSize, height:item 2 of windowSize}
                          set end of windowList to windowInfo
                      end try
                  end repeat
              end try
          end repeat
      end tell
      
      return windowList
      `;

      const { stdout } = await this.execAsync(`osascript -ss -e '${script}'`);
      return this.parseAppleScriptRecords(stdout);
    } catch (error) {
      logger.debug('Error getting accessibility windows:', error);
      return [];
    }
  }

  /**
   * Execute Swift code via temporary file
   */
  private async executeSwiftCode(code: string): Promise<string> {
    const fs = require('fs').promises;
    const path = require('path');
    const tmpFile = path.join('/tmp', `prompt-line-swift-${Date.now()}.swift`);

    try {
      await fs.writeFile(tmpFile, code);
      const { stdout } = await this.execAsync(`swift ${tmpFile}`);
      return stdout;
    } finally {
      try {
        await fs.unlink(tmpFile);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Parse AppleScript record format output
   */
  private parseAppleScriptRecords(output: string): AXWindowInfo[] {
    const windows: AXWindowInfo[] = [];
    const recordRegex = /\{([^}]+)\}/g;
    let match;

    while ((match = recordRegex.exec(output)) !== null) {
      const record = match[1];
      if (!record) continue;
      
      const windowData: Record<string, unknown> = {};
      
      // Parse each field
      const fieldRegex = /(\w+):"?([^",]+)"?/g;
      let fieldMatch;
      
      while ((fieldMatch = fieldRegex.exec(record)) !== null) {
        const key = fieldMatch[1];
        const value = fieldMatch[2];
        
        if (key && value !== undefined) {
          if (['pid', 'x', 'y', 'width', 'height'].includes(key)) {
            windowData[key] = parseInt(value as string);
          } else {
            windowData[key] = value;
          }
        }
      }
      
      if (windowData.appName && typeof windowData.x === 'number' && typeof windowData.y === 'number' &&
          typeof windowData.width === 'number' && typeof windowData.height === 'number') {
        windows.push({
          appName: windowData.appName as string,
          pid: (windowData.pid as number) || 0,
          title: (windowData.title as string) || 'Untitled',
          position: { x: windowData.x as number, y: windowData.y as number },
          size: { width: windowData.width as number, height: windowData.height as number },
          bounds: { 
            x: windowData.x as number, 
            y: windowData.y as number, 
            width: windowData.width as number, 
            height: windowData.height as number 
          }
        });
      }
    }

    return windows;
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
      exec(command, { timeout: 5000 }, (error, stdout, stderr) => {
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
   * Cleanup resources
   */
  destroy(): void {
    this.stopMonitoring();
    this.isInitialized = false;
    logger.debug('DesktopSpaceManager destroyed');
  }
}

export default DesktopSpaceManager;