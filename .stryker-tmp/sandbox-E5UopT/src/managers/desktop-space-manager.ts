// @ts-nocheck
// Desktop Space Detection Manager for Prompt Line
// Uses accessibility permissions only - no screen recording permission required
function stryNS_9fa48() {
  var g = typeof globalThis === 'object' && globalThis && globalThis.Math === Math && globalThis || new Function("return this")();
  var ns = g.__stryker__ || (g.__stryker__ = {});
  if (ns.activeMutant === undefined && g.process && g.process.env && g.process.env.__STRYKER_ACTIVE_MUTANT__) {
    ns.activeMutant = g.process.env.__STRYKER_ACTIVE_MUTANT__;
  }
  function retrieveNS() {
    return ns;
  }
  stryNS_9fa48 = retrieveNS;
  return retrieveNS();
}
stryNS_9fa48();
function stryCov_9fa48() {
  var ns = stryNS_9fa48();
  var cov = ns.mutantCoverage || (ns.mutantCoverage = {
    static: {},
    perTest: {}
  });
  function cover() {
    var c = cov.static;
    if (ns.currentTestId) {
      c = cov.perTest[ns.currentTestId] = cov.perTest[ns.currentTestId] || {};
    }
    var a = arguments;
    for (var i = 0; i < a.length; i++) {
      c[a[i]] = (c[a[i]] || 0) + 1;
    }
  }
  stryCov_9fa48 = cover;
  cover.apply(null, arguments);
}
function stryMutAct_9fa48(id) {
  var ns = stryNS_9fa48();
  function isActive(id) {
    if (ns.activeMutant === id) {
      if (ns.hitCount !== void 0 && ++ns.hitCount > ns.hitLimit) {
        throw new Error('Stryker: Hit count limit reached (' + ns.hitCount + ')');
      }
      return true;
    }
    return false;
  }
  stryMutAct_9fa48 = isActive;
  return isActive(id);
}
import { execFile } from 'child_process';
import { logger } from '../utils/utils';
import config from '../config/app-config';
import type { AppInfo } from '../types';
interface WindowBasicInfo {
  windowID: number;
  ownerPID: number;
  ownerName: string;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
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
String.prototype.hashCode = function (): number {
  if (stryMutAct_9fa48("1468")) {
    {}
  } else {
    stryCov_9fa48("1468");
    let hash = 0;
    if (stryMutAct_9fa48("1471") ? this.length !== 0 : stryMutAct_9fa48("1470") ? false : stryMutAct_9fa48("1469") ? true : (stryCov_9fa48("1469", "1470", "1471"), this.length === 0)) return hash;
    for (let i = 0; stryMutAct_9fa48("1474") ? i >= this.length : stryMutAct_9fa48("1473") ? i <= this.length : stryMutAct_9fa48("1472") ? false : (stryCov_9fa48("1472", "1473", "1474"), i < this.length); stryMutAct_9fa48("1475") ? i-- : (stryCov_9fa48("1475"), i++)) {
      if (stryMutAct_9fa48("1476")) {
        {}
      } else {
        stryCov_9fa48("1476");
        const char = this.charCodeAt(i);
        hash = stryMutAct_9fa48("1477") ? (hash << 5) - hash - char : (stryCov_9fa48("1477"), (stryMutAct_9fa48("1478") ? (hash << 5) + hash : (stryCov_9fa48("1478"), (hash << 5) - hash)) + char);
        hash = hash & hash; // Convert to 32-bit integer
      }
    }
    return Math.abs(hash);
  }
};
class DesktopSpaceManager {
  private currentSpaceSignature: string | null = null;
  private isInitialized = stryMutAct_9fa48("1479") ? true : (stryCov_9fa48("1479"), false);

  // Performance optimization: cache system
  private lastSpaceCheck: {
    timestamp: number;
    signature: string;
    windows: WindowBasicInfo[];
  } | null = null;
  private readonly CACHE_TTL_MS = 2000; // Cache for 2 seconds

  async initialize(): Promise<void> {
    if (stryMutAct_9fa48("1480")) {
      {}
    } else {
      stryCov_9fa48("1480");
      try {
        if (stryMutAct_9fa48("1481")) {
          {}
        } else {
          stryCov_9fa48("1481");
          logger.info(stryMutAct_9fa48("1482") ? "" : (stryCov_9fa48("1482"), 'Initializing DesktopSpaceManager...'));

          // Check if running on macOS
          if (stryMutAct_9fa48("1485") ? false : stryMutAct_9fa48("1484") ? true : stryMutAct_9fa48("1483") ? config.platform.isMac : (stryCov_9fa48("1483", "1484", "1485"), !config.platform.isMac)) {
            if (stryMutAct_9fa48("1486")) {
              {}
            } else {
              stryCov_9fa48("1486");
              logger.warn(stryMutAct_9fa48("1487") ? "" : (stryCov_9fa48("1487"), 'Desktop space detection only available on macOS'));
              this.isInitialized = stryMutAct_9fa48("1488") ? false : (stryCov_9fa48("1488"), true);
              return;
            }
          }

          // Check accessibility permission
          const hasPermission = await this.checkAccessibilityPermission();
          if (stryMutAct_9fa48("1491") ? false : stryMutAct_9fa48("1490") ? true : stryMutAct_9fa48("1489") ? hasPermission : (stryCov_9fa48("1489", "1490", "1491"), !hasPermission)) {
            if (stryMutAct_9fa48("1492")) {
              {}
            } else {
              stryCov_9fa48("1492");
              logger.warn(stryMutAct_9fa48("1493") ? "" : (stryCov_9fa48("1493"), 'Accessibility permission not granted - space detection may be limited'));
            }
          }
          this.isInitialized = stryMutAct_9fa48("1494") ? false : (stryCov_9fa48("1494"), true);
          logger.info(stryMutAct_9fa48("1495") ? "" : (stryCov_9fa48("1495"), 'DesktopSpaceManager initialized successfully'));
        }
      } catch (error) {
        if (stryMutAct_9fa48("1496")) {
          {}
        } else {
          stryCov_9fa48("1496");
          logger.error(stryMutAct_9fa48("1497") ? "" : (stryCov_9fa48("1497"), 'Failed to initialize DesktopSpaceManager:'), error);
          throw error;
        }
      }
    }
  }

  /**
   * Check if accessibility permission is available
   */
  private async checkAccessibilityPermission(): Promise<boolean> {
    if (stryMutAct_9fa48("1498")) {
      {}
    } else {
      stryCov_9fa48("1498");
      try {
        if (stryMutAct_9fa48("1499")) {
          {}
        } else {
          stryCov_9fa48("1499");
          const script = stryMutAct_9fa48("1500") ? `` : (stryCov_9fa48("1500"), `
      tell application "System Events"
        return true
      end tell
      `);
          const {
            stdout
          } = await this.execOsascript(script);
          return stryMutAct_9fa48("1503") ? stdout.trim() !== 'true' : stryMutAct_9fa48("1502") ? false : stryMutAct_9fa48("1501") ? true : (stryCov_9fa48("1501", "1502", "1503"), (stryMutAct_9fa48("1504") ? stdout : (stryCov_9fa48("1504"), stdout.trim())) === (stryMutAct_9fa48("1505") ? "" : (stryCov_9fa48("1505"), 'true')));
        }
      } catch (error) {
        if (stryMutAct_9fa48("1506")) {
          {}
        } else {
          stryCov_9fa48("1506");
          logger.debug(stryMutAct_9fa48("1507") ? "" : (stryCov_9fa48("1507"), 'Error checking accessibility permission:'), error);
          return stryMutAct_9fa48("1508") ? true : (stryCov_9fa48("1508"), false);
        }
      }
    }
  }

  /**
   * Get current space information without screen recording permission
   */
  async getCurrentSpaceInfo(frontmostApp?: AppInfo | string | null): Promise<SpaceInfo> {
    if (stryMutAct_9fa48("1509")) {
      {}
    } else {
      stryCov_9fa48("1509");
      try {
        if (stryMutAct_9fa48("1510")) {
          {}
        } else {
          stryCov_9fa48("1510");
          if (stryMutAct_9fa48("1513") ? false : stryMutAct_9fa48("1512") ? true : stryMutAct_9fa48("1511") ? this.isInitialized : (stryCov_9fa48("1511", "1512", "1513"), !this.isInitialized)) {
            if (stryMutAct_9fa48("1514")) {
              {}
            } else {
              stryCov_9fa48("1514");
              throw new Error(stryMutAct_9fa48("1515") ? "" : (stryCov_9fa48("1515"), 'DesktopSpaceManager not initialized'));
            }
          }

          // Check cache first
          const now = Date.now();
          if (stryMutAct_9fa48("1518") ? this.lastSpaceCheck || now - this.lastSpaceCheck.timestamp < this.CACHE_TTL_MS : stryMutAct_9fa48("1517") ? false : stryMutAct_9fa48("1516") ? true : (stryCov_9fa48("1516", "1517", "1518"), this.lastSpaceCheck && (stryMutAct_9fa48("1521") ? now - this.lastSpaceCheck.timestamp >= this.CACHE_TTL_MS : stryMutAct_9fa48("1520") ? now - this.lastSpaceCheck.timestamp <= this.CACHE_TTL_MS : stryMutAct_9fa48("1519") ? true : (stryCov_9fa48("1519", "1520", "1521"), (stryMutAct_9fa48("1522") ? now + this.lastSpaceCheck.timestamp : (stryCov_9fa48("1522"), now - this.lastSpaceCheck.timestamp)) < this.CACHE_TTL_MS)))) {
            if (stryMutAct_9fa48("1523")) {
              {}
            } else {
              stryCov_9fa48("1523");
              return stryMutAct_9fa48("1524") ? {} : (stryCov_9fa48("1524"), {
                method: stryMutAct_9fa48("1525") ? "" : (stryCov_9fa48("1525"), 'Cached + Ultra-Fast'),
                signature: this.lastSpaceCheck.signature,
                frontmostApp: stryMutAct_9fa48("1528") ? frontmostApp && null : stryMutAct_9fa48("1527") ? false : stryMutAct_9fa48("1526") ? true : (stryCov_9fa48("1526", "1527", "1528"), frontmostApp || null),
                windowCount: this.lastSpaceCheck.windows.length,
                appCount: this.getUniqueAppCount(this.lastSpaceCheck.windows),
                apps: this.getAppsFromWindows(this.lastSpaceCheck.windows, frontmostApp)
              });
            }
          }

          // Get windows using ultra-fast mode
          const cgWindows = await this.getWindowsUltraFast(frontmostApp);

          // Generate space signature
          const signature = this.generateSpaceSignature(cgWindows);

          // Cache the result
          this.lastSpaceCheck = stryMutAct_9fa48("1529") ? {} : (stryCov_9fa48("1529"), {
            timestamp: now,
            signature,
            windows: cgWindows
          });

          // Create space info
          const spaceInfo: SpaceInfo = stryMutAct_9fa48("1530") ? {} : (stryCov_9fa48("1530"), {
            method: stryMutAct_9fa48("1531") ? "" : (stryCov_9fa48("1531"), 'Ultra-Fast Detection'),
            signature,
            frontmostApp: stryMutAct_9fa48("1534") ? frontmostApp && null : stryMutAct_9fa48("1533") ? false : stryMutAct_9fa48("1532") ? true : (stryCov_9fa48("1532", "1533", "1534"), frontmostApp || null),
            windowCount: cgWindows.length,
            appCount: this.getUniqueAppCount(cgWindows),
            apps: this.getAppsFromWindows(cgWindows, frontmostApp)
          });
          this.currentSpaceSignature = signature;
          return spaceInfo;
        }
      } catch (error) {
        if (stryMutAct_9fa48("1535")) {
          {}
        } else {
          stryCov_9fa48("1535");
          logger.error(stryMutAct_9fa48("1536") ? "" : (stryCov_9fa48("1536"), 'Failed to get current space info:'), error);

          // Return minimal info on error
          return stryMutAct_9fa48("1537") ? {} : (stryCov_9fa48("1537"), {
            method: stryMutAct_9fa48("1538") ? "" : (stryCov_9fa48("1538"), 'Error'),
            signature: stryMutAct_9fa48("1539") ? "" : (stryCov_9fa48("1539"), 'unknown'),
            frontmostApp: stryMutAct_9fa48("1542") ? frontmostApp && null : stryMutAct_9fa48("1541") ? false : stryMutAct_9fa48("1540") ? true : (stryCov_9fa48("1540", "1541", "1542"), frontmostApp || null),
            windowCount: 0,
            appCount: 0,
            apps: stryMutAct_9fa48("1543") ? ["Stryker was here"] : (stryCov_9fa48("1543"), [])
          });
        }
      }
    }
  }

  /**
   * Check if the current space has changed since the last check
   */
  async hasSpaceChanged(): Promise<boolean> {
    if (stryMutAct_9fa48("1544")) {
      {}
    } else {
      stryCov_9fa48("1544");
      try {
        if (stryMutAct_9fa48("1545")) {
          {}
        } else {
          stryCov_9fa48("1545");
          const spaceInfo = await this.getCurrentSpaceInfo();
          const hasChanged = stryMutAct_9fa48("1548") ? this.currentSpaceSignature === spaceInfo.signature : stryMutAct_9fa48("1547") ? false : stryMutAct_9fa48("1546") ? true : (stryCov_9fa48("1546", "1547", "1548"), this.currentSpaceSignature !== spaceInfo.signature);
          if (stryMutAct_9fa48("1550") ? false : stryMutAct_9fa48("1549") ? true : (stryCov_9fa48("1549", "1550"), hasChanged)) {
            if (stryMutAct_9fa48("1551")) {
              {}
            } else {
              stryCov_9fa48("1551");
              logger.debug(stryMutAct_9fa48("1552") ? "" : (stryCov_9fa48("1552"), 'Space change detected'), stryMutAct_9fa48("1553") ? {} : (stryCov_9fa48("1553"), {
                old: this.currentSpaceSignature,
                new: spaceInfo.signature
              }));
            }
          }
          return hasChanged;
        }
      } catch (error) {
        if (stryMutAct_9fa48("1554")) {
          {}
        } else {
          stryCov_9fa48("1554");
          logger.error(stryMutAct_9fa48("1555") ? "" : (stryCov_9fa48("1555"), 'Error checking space change:'), error);
          return stryMutAct_9fa48("1556") ? true : (stryCov_9fa48("1556"), false);
        }
      }
    }
  }

  /**
   * Ultra-fast window detection using app-based signatures only
   * Sacrifices precision for extreme speed (<5ms target)
   */
  private async getWindowsUltraFast(frontmostApp?: AppInfo | string | null): Promise<WindowBasicInfo[]> {
    if (stryMutAct_9fa48("1557")) {
      {}
    } else {
      stryCov_9fa48("1557");
      try {
        if (stryMutAct_9fa48("1558")) {
          {}
        } else {
          stryCov_9fa48("1558");
          // Create synthetic window data based on frontmost app only
          const windows: WindowBasicInfo[] = stryMutAct_9fa48("1559") ? ["Stryker was here"] : (stryCov_9fa48("1559"), []);
          if (stryMutAct_9fa48("1561") ? false : stryMutAct_9fa48("1560") ? true : (stryCov_9fa48("1560", "1561"), frontmostApp)) {
            if (stryMutAct_9fa48("1562")) {
              {}
            } else {
              stryCov_9fa48("1562");
              const appName = (stryMutAct_9fa48("1565") ? typeof frontmostApp !== 'string' : stryMutAct_9fa48("1564") ? false : stryMutAct_9fa48("1563") ? true : (stryCov_9fa48("1563", "1564", "1565"), typeof frontmostApp === (stryMutAct_9fa48("1566") ? "" : (stryCov_9fa48("1566"), 'string')))) ? frontmostApp : frontmostApp.name;
              const pid = (stryMutAct_9fa48("1569") ? typeof frontmostApp !== 'string' : stryMutAct_9fa48("1568") ? false : stryMutAct_9fa48("1567") ? true : (stryCov_9fa48("1567", "1568", "1569"), typeof frontmostApp === (stryMutAct_9fa48("1570") ? "" : (stryCov_9fa48("1570"), 'string')))) ? 1000 : stryMutAct_9fa48("1573") ? frontmostApp.bundleId?.hashCode() && 1000 : stryMutAct_9fa48("1572") ? false : stryMutAct_9fa48("1571") ? true : (stryCov_9fa48("1571", "1572", "1573"), (stryMutAct_9fa48("1574") ? frontmostApp.bundleId.hashCode() : (stryCov_9fa48("1574"), frontmostApp.bundleId?.hashCode())) || 1000);

              // Create synthetic window entry for space signature
              windows.push(stryMutAct_9fa48("1575") ? {} : (stryCov_9fa48("1575"), {
                windowID: pid,
                ownerPID: pid,
                ownerName: appName,
                bounds: stryMutAct_9fa48("1576") ? {} : (stryCov_9fa48("1576"), {
                  x: 0,
                  y: 0,
                  width: 1,
                  height: 1
                })
              }));
            }
          }

          // Add timestamp-based variation to detect changes over time
          const timeSlot = Math.floor(stryMutAct_9fa48("1577") ? Date.now() * 1000 : (stryCov_9fa48("1577"), Date.now() / 1000)); // 1-second slots
          windows.push(stryMutAct_9fa48("1578") ? {} : (stryCov_9fa48("1578"), {
            windowID: timeSlot,
            ownerPID: timeSlot,
            ownerName: stryMutAct_9fa48("1579") ? `` : (stryCov_9fa48("1579"), `TimeSlot_${timeSlot}`),
            bounds: stryMutAct_9fa48("1580") ? {} : (stryCov_9fa48("1580"), {
              x: 0,
              y: 0,
              width: 1,
              height: 1
            })
          }));
          return windows;
        }
      } catch (error) {
        if (stryMutAct_9fa48("1581")) {
          {}
        } else {
          stryCov_9fa48("1581");
          logger.error(stryMutAct_9fa48("1582") ? "" : (stryCov_9fa48("1582"), 'Error in ultra-fast detection:'), error);
          return stryMutAct_9fa48("1583") ? ["Stryker was here"] : (stryCov_9fa48("1583"), []);
        }
      }
    }
  }

  /**
   * Generate space signature from window information
   */
  private generateSpaceSignature(windows: WindowBasicInfo[]): string {
    if (stryMutAct_9fa48("1584")) {
      {}
    } else {
      stryCov_9fa48("1584");
      const appCounts: {
        [key: string]: number;
      } = {};
      windows.forEach(window => {
        if (stryMutAct_9fa48("1585")) {
          {}
        } else {
          stryCov_9fa48("1585");
          appCounts[window.ownerName] = stryMutAct_9fa48("1586") ? (appCounts[window.ownerName] || 0) - 1 : (stryCov_9fa48("1586"), (stryMutAct_9fa48("1589") ? appCounts[window.ownerName] && 0 : stryMutAct_9fa48("1588") ? false : stryMutAct_9fa48("1587") ? true : (stryCov_9fa48("1587", "1588", "1589"), appCounts[window.ownerName] || 0)) + 1);
        }
      });
      return stryMutAct_9fa48("1590") ? Object.entries(appCounts).map(([app, count]) => `${app}:${count}`).join('|') : (stryCov_9fa48("1590"), Object.entries(appCounts).sort(stryMutAct_9fa48("1591") ? () => undefined : (stryCov_9fa48("1591"), ([a], [b]) => a.localeCompare(b))).map(stryMutAct_9fa48("1592") ? () => undefined : (stryCov_9fa48("1592"), ([app, count]) => stryMutAct_9fa48("1593") ? `` : (stryCov_9fa48("1593"), `${app}:${count}`))).join(stryMutAct_9fa48("1594") ? "" : (stryCov_9fa48("1594"), '|')));
    }
  }

  /**
   * Get unique app count from windows
   */
  private getUniqueAppCount(windows: WindowBasicInfo[]): number {
    if (stryMutAct_9fa48("1595")) {
      {}
    } else {
      stryCov_9fa48("1595");
      const uniqueApps = new Set(windows.map(stryMutAct_9fa48("1596") ? () => undefined : (stryCov_9fa48("1596"), w => w.ownerName)));
      return uniqueApps.size;
    }
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
    if (stryMutAct_9fa48("1597")) {
      {}
    } else {
      stryCov_9fa48("1597");
      const apps: {
        [key: string]: {
          name: string;
          pid: number;
          windowCount: number;
          isActive: boolean;
        };
      } = {};
      windows.forEach(window => {
        if (stryMutAct_9fa48("1598")) {
          {}
        } else {
          stryCov_9fa48("1598");
          const key = window.ownerName;
          if (stryMutAct_9fa48("1601") ? false : stryMutAct_9fa48("1600") ? true : stryMutAct_9fa48("1599") ? apps[key] : (stryCov_9fa48("1599", "1600", "1601"), !apps[key])) {
            if (stryMutAct_9fa48("1602")) {
              {}
            } else {
              stryCov_9fa48("1602");
              apps[key] = stryMutAct_9fa48("1603") ? {} : (stryCov_9fa48("1603"), {
                name: window.ownerName,
                pid: window.ownerPID,
                windowCount: 0,
                isActive: stryMutAct_9fa48("1604") ? true : (stryCov_9fa48("1604"), false)
              });
            }
          }
          stryMutAct_9fa48("1605") ? apps[key].windowCount-- : (stryCov_9fa48("1605"), apps[key].windowCount++);
        }
      });

      // Mark active app
      if (stryMutAct_9fa48("1607") ? false : stryMutAct_9fa48("1606") ? true : (stryCov_9fa48("1606", "1607"), frontmostApp)) {
        if (stryMutAct_9fa48("1608")) {
          {}
        } else {
          stryCov_9fa48("1608");
          const frontmostAppName = (stryMutAct_9fa48("1611") ? typeof frontmostApp !== 'string' : stryMutAct_9fa48("1610") ? false : stryMutAct_9fa48("1609") ? true : (stryCov_9fa48("1609", "1610", "1611"), typeof frontmostApp === (stryMutAct_9fa48("1612") ? "" : (stryCov_9fa48("1612"), 'string')))) ? frontmostApp : frontmostApp.name;
          Object.values(apps).forEach(app => {
            if (stryMutAct_9fa48("1613")) {
              {}
            } else {
              stryCov_9fa48("1613");
              app.isActive = stryMutAct_9fa48("1616") ? app.name !== frontmostAppName : stryMutAct_9fa48("1615") ? false : stryMutAct_9fa48("1614") ? true : (stryCov_9fa48("1614", "1615", "1616"), app.name === frontmostAppName);
            }
          });
        }
      }
      return stryMutAct_9fa48("1617") ? Object.values(apps) : (stryCov_9fa48("1617"), Object.values(apps).sort(stryMutAct_9fa48("1618") ? () => undefined : (stryCov_9fa48("1618"), (a, b) => a.name.localeCompare(b.name))));
    }
  }

  /**
   * Utility method for async osascript execution
   */
  private execOsascript(script: string): Promise<{
    stdout: string;
    stderr: string;
  }> {
    if (stryMutAct_9fa48("1619")) {
      {}
    } else {
      stryCov_9fa48("1619");
      return new Promise((resolve, reject) => {
        if (stryMutAct_9fa48("1620")) {
          {}
        } else {
          stryCov_9fa48("1620");
          execFile(stryMutAct_9fa48("1621") ? "" : (stryCov_9fa48("1621"), 'osascript'), stryMutAct_9fa48("1622") ? [] : (stryCov_9fa48("1622"), [stryMutAct_9fa48("1623") ? "" : (stryCov_9fa48("1623"), '-e'), script]), stryMutAct_9fa48("1624") ? {} : (stryCov_9fa48("1624"), {
            timeout: 5000
          }), (error: Error | null, stdout: string, stderr: string) => {
            if (stryMutAct_9fa48("1625")) {
              {}
            } else {
              stryCov_9fa48("1625");
              if (stryMutAct_9fa48("1627") ? false : stryMutAct_9fa48("1626") ? true : (stryCov_9fa48("1626", "1627"), error)) {
                if (stryMutAct_9fa48("1628")) {
                  {}
                } else {
                  stryCov_9fa48("1628");
                  reject(error);
                }
              } else {
                if (stryMutAct_9fa48("1629")) {
                  {}
                } else {
                  stryCov_9fa48("1629");
                  resolve(stryMutAct_9fa48("1630") ? {} : (stryCov_9fa48("1630"), {
                    stdout,
                    stderr
                  }));
                }
              }
            }
          });
        }
      });
    }
  }

  /**
   * Get current space signature (cached)
   */
  getCurrentSpaceSignature(): string | null {
    if (stryMutAct_9fa48("1631")) {
      {}
    } else {
      stryCov_9fa48("1631");
      return this.currentSpaceSignature;
    }
  }

  /**
   * Check if manager is initialized
   */
  isReady(): boolean {
    if (stryMutAct_9fa48("1632")) {
      {}
    } else {
      stryCov_9fa48("1632");
      return this.isInitialized;
    }
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
    if (stryMutAct_9fa48("1633")) {
      {}
    } else {
      stryCov_9fa48("1633");
      this.stopMonitoring();
      this.isInitialized = stryMutAct_9fa48("1634") ? true : (stryCov_9fa48("1634"), false);
      logger.debug(stryMutAct_9fa48("1635") ? "" : (stryCov_9fa48("1635"), 'DesktopSpaceManager destroyed'));
    }
  }
}
export default DesktopSpaceManager;