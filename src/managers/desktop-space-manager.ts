// desktop-space-manager.ts
// Desktop Space Detection Manager for Prompt Line
// Uses accessibility permissions only - no screen recording permission required

import { spawn, exec } from 'child_process';
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
  private spaceChangeCallbacks: Array<(spaceInfo: SpaceInfo) => void> = [];
  private monitoringInterval: NodeJS.Timeout | null = null;
  
  // Performance optimization: cache system
  private lastSpaceCheck: { timestamp: number; signature: string; windows: WindowBasicInfo[] } | null = null;
  private readonly CACHE_TTL_MS = 2000; // Cache for 2 seconds - longer cache for better performance
  
  // Ultra-fast mode: lightweight space detection (sacrifices precision for speed)
  private readonly ULTRA_FAST_MODE = true; // Enable ultra-fast mode for <100ms target

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
    const startTime = performance.now();
    logger.debug('🕐 Starting getCurrentSpaceInfo()');
    
    try {
      if (!this.isInitialized) {
        throw new Error('DesktopSpaceManager not initialized');
      }

      // Check cache first for performance - use longer cache for better UX
      const now = Date.now();
      if (this.lastSpaceCheck && (now - this.lastSpaceCheck.timestamp) < this.CACHE_TTL_MS) {
        logger.debug(`⏱️  Using cached space info (${Math.round(now - this.lastSpaceCheck.timestamp)}ms old): ${(performance.now() - startTime).toFixed(2)}ms`);
        const spaceInfo: SpaceInfo = {
          method: 'Cached + Limited CGWindowList',
          signature: this.lastSpaceCheck.signature,
          frontmostApp: frontmostApp || null,
          windowCount: this.lastSpaceCheck.windows.length,
          appCount: this.getUniqueAppCount(this.lastSpaceCheck.windows),
          apps: this.getAppsFromWindows(this.lastSpaceCheck.windows, frontmostApp)
        };
        logger.debug(`🏁 Total getCurrentSpaceInfo time (cached): ${(performance.now() - startTime).toFixed(2)}ms`);
        return spaceInfo;
      }

      // Get windows using optimized method
      const windowsStartTime = performance.now();
      let cgWindows: WindowBasicInfo[];
      
      if (this.ULTRA_FAST_MODE) {
        // Ultra-fast mode: Use simple app-based detection (no CGWindowList)
        cgWindows = await this.getWindowsUltraFast(frontmostApp);
        logger.debug(`⏱️  Ultra-fast detection: ${(performance.now() - windowsStartTime).toFixed(2)}ms`);
      } else {
        // Standard mode: Use CGWindowList (accurate but slow)
        cgWindows = await this.getWindowsWithoutScreenRecording();
        logger.debug(`⏱️  Window detection: ${(performance.now() - windowsStartTime).toFixed(2)}ms`);
      }
      
      // Generate space signature
      const signatureStartTime = performance.now();
      const signature = this.generateSpaceSignature(cgWindows);
      logger.debug(`⏱️  Signature generation: ${(performance.now() - signatureStartTime).toFixed(2)}ms`);

      // Cache the result
      this.lastSpaceCheck = {
        timestamp: now,
        signature,
        windows: cgWindows
      };

      // Create space info
      const spaceInfo: SpaceInfo = {
        method: this.ULTRA_FAST_MODE ? 'Ultra-Fast App-Based Detection' : 'Optimized + Limited CGWindowList',
        signature,
        frontmostApp: frontmostApp || null,
        windowCount: cgWindows.length,
        appCount: this.getUniqueAppCount(cgWindows),
        apps: this.getAppsFromWindows(cgWindows, frontmostApp)
      };

      this.currentSpaceSignature = signature;
      logger.debug(`🏁 Total getCurrentSpaceInfo time: ${(performance.now() - startTime).toFixed(2)}ms`);
      return spaceInfo;
    } catch (error) {
      logger.error('Failed to get current space info:', error);
      logger.error(`❌ getCurrentSpaceInfo failed after ${(performance.now() - startTime).toFixed(2)}ms`);
      
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
   * Ultra-fast window detection using app-based signatures only
   * Sacrifices precision for extreme speed (<5ms target)
   */
  private async getWindowsUltraFast(frontmostApp?: AppInfo | string | null): Promise<WindowBasicInfo[]> {
    const startTime = performance.now();
    
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
      
      logger.debug(`⏱️  Ultra-fast window synthesis: ${(performance.now() - startTime).toFixed(2)}ms`);
      return windows;
    } catch (error) {
      logger.error('Error in ultra-fast detection:', error);
      return [];
    }
  }

  /**
   * Get windows using optimized Swift execution
   * Simplified approach with better performance characteristics
   */
  private async getWindowsWithoutScreenRecording(): Promise<WindowBasicInfo[]> {
    const startTime = performance.now();
    logger.debug('🕐 Starting getWindowsWithoutScreenRecording()');
    
    try {
      // Use optimized Swift execution directly (native tool doesn't support window-list)
      const result = await this.getWindowsWithSwiftFallback();
      logger.debug(`🏁 Total getWindowsWithoutScreenRecording time: ${(performance.now() - startTime).toFixed(2)}ms`);
      return result;
    } catch (error) {
      logger.error('Error getting windows without screen recording:', error);
      logger.error(`❌ getWindowsWithoutScreenRecording failed after ${(performance.now() - startTime).toFixed(2)}ms`);
      return [];
    }
  }


  /**
   * Swift execution for CGWindowList
   */
  private async getWindowsWithSwiftFallback(): Promise<WindowBasicInfo[]> {
    const startTime = performance.now();
    
    try {
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

      const result = await this.executeOptimizedSwiftCode(swiftCode);
      logger.debug(`⏱️  Swift execution: ${(performance.now() - startTime).toFixed(2)}ms`);
      return JSON.parse(result);
    } catch (error) {
      logger.error('Swift execution failed:', error);
      return [];
    }
  }

  /**
   * Execute Swift code with optimized approach (no temporary file)
   */
  private async executeOptimizedSwiftCode(code: string): Promise<string> {
    const startTime = performance.now();
    
    try {
      // Use stdin pipe to avoid file I/O overhead
      return new Promise<string>((resolve, reject) => {
        const swift = spawn('/usr/bin/swift', ['-'], {
          stdio: ['pipe', 'pipe', 'pipe']
        });
        
        let stdout = '';
        let stderr = '';
        
        swift.stdout.on('data', (data: Buffer) => {
          stdout += data.toString();
        });
        
        swift.stderr.on('data', (data: Buffer) => {
          stderr += data.toString();
        });
        
        swift.on('close', (code: number) => {
          logger.debug(`⏱️  Swift subprocess execution: ${(performance.now() - startTime).toFixed(2)}ms`);
          
          if (code === 0) {
            resolve(stdout.trim());
          } else {
            reject(new Error(`Swift execution failed with code ${code}: ${stderr}`));
          }
        });
        
        swift.on('error', (error: Error) => {
          reject(error);
        });
        
        // Send code via stdin and close
        swift.stdin.write(code);
        swift.stdin.end();
        
        // Set timeout to prevent hanging
        setTimeout(() => {
          swift.kill('SIGTERM');
          reject(new Error('Swift execution timeout'));
        }, 5000);
      });
      
    } catch (error) {
      logger.error('Error in optimized Swift execution:', error);
      throw error;
    }
  }

  /**
   * Parse AppleScript window list output for basic window info (deprecated)
   */
  // @ts-expect-error - Method kept for potential future use
  private parseAppleScriptWindowList(output: string): WindowBasicInfo[] {
    const windows: WindowBasicInfo[] = [];
    
    try {
      // Parse AppleScript list format: {ownerName:App1, ownerPID:123, windowCount:2}, {ownerName:App2, ...}
      const recordRegex = /\{([^}]+)\}/g;
      let match;
      
      while ((match = recordRegex.exec(output)) !== null) {
        const record = match[1];
        if (!record) continue;
        
        // Extract fields from record
        const ownerNameMatch = record.match(/ownerName:([^,]+)/);
        const ownerPIDMatch = record.match(/ownerPID:(\d+)/);
        const windowCountMatch = record.match(/windowCount:(\d+)/);
        
        if (ownerNameMatch && ownerNameMatch[1] && ownerPIDMatch && ownerPIDMatch[1] && windowCountMatch && windowCountMatch[1]) {
          const ownerName = ownerNameMatch[1].trim();
          const ownerPID = parseInt(ownerPIDMatch[1]);
          const windowCount = parseInt(windowCountMatch[1]);
          
          // Create synthetic window entries for each window count
          // This gives us enough information to generate space signatures
          for (let i = 0; i < windowCount; i++) {
            windows.push({
              windowID: ownerPID * 1000 + i, // Synthetic window ID
              ownerPID,
              ownerName,
              bounds: { x: 0, y: 0, width: 100, height: 100 } // Synthetic bounds
            });
          }
        }
      }
      
      return windows;
    } catch (error) {
      logger.debug('Error parsing AppleScript window list:', error);
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
   * Execute Swift code via temporary file (deprecated - kept for compatibility)
   * Now using AppleScript for better performance
   */
  // @ts-expect-error - Method kept for potential future use
  private async executeSwiftCode(code: string): Promise<string> {
    const fs = require('fs').promises;
    const path = require('path');
    const tmpFile = path.join('/tmp', `prompt-line-swift-${Date.now()}.swift`);

    logger.debug('⚠️  Using deprecated Swift execution - consider using AppleScript alternative');
    
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
   * Cleanup resources
   */
  destroy(): void {
    this.stopMonitoring();
    this.isInitialized = false;
    logger.debug('DesktopSpaceManager destroyed');
  }
}

export default DesktopSpaceManager;