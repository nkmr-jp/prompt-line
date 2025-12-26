// @ts-nocheck
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
import { promises as fs } from 'fs';
import config from '../config/app-config';
import { logger, safeJsonParse, safeJsonStringify } from '../utils/utils';
interface DirectoryData {
  directory: string;
  timestamp: number;
  method?: string;
}

/**
 * DirectoryManager - Manages the last launched directory information
 *
 * This manager handles the persistence of directory information separately from drafts.
 * The directory information is used for:
 * - File search operations
 * - @path highlighting restoration
 * - Window context preservation
 */
class DirectoryManager {
  private directoryFile: string;
  private currentDirectory: string | null = null;
  private currentMethod: string | null = null;
  private lastSaveTimestamp: number = 0;
  constructor() {
    if (stryMutAct_9fa48("1636")) {
      {}
    } else {
      stryCov_9fa48("1636");
      this.directoryFile = config.paths.directoryFile;
    }
  }

  /**
   * Initialize the directory manager
   * Loads saved directory and handles migration from draft.json
   */
  async initialize(): Promise<void> {
    if (stryMutAct_9fa48("1637")) {
      {}
    } else {
      stryCov_9fa48("1637");
      try {
        if (stryMutAct_9fa48("1638")) {
          {}
        } else {
          stryCov_9fa48("1638");
          // First, try to migrate from draft.json if directory.json doesn't exist
          await this.migrateFromDraft();

          // Then load the directory
          await this.loadDirectory();
          logger.info(stryMutAct_9fa48("1639") ? "" : (stryCov_9fa48("1639"), 'Directory manager initialized'), stryMutAct_9fa48("1640") ? {} : (stryCov_9fa48("1640"), {
            directory: this.currentDirectory
          }));
        }
      } catch (error) {
        if (stryMutAct_9fa48("1641")) {
          {}
        } else {
          stryCov_9fa48("1641");
          logger.error(stryMutAct_9fa48("1642") ? "" : (stryCov_9fa48("1642"), 'Failed to initialize directory manager:'), error);
          this.currentDirectory = null;
        }
      }
    }
  }

  /**
   * Migrate directory information from draft.json to directory.json
   * This is a one-time migration for existing users
   */
  private async migrateFromDraft(): Promise<void> {
    if (stryMutAct_9fa48("1643")) {
      {}
    } else {
      stryCov_9fa48("1643");
      try {
        if (stryMutAct_9fa48("1644")) {
          {}
        } else {
          stryCov_9fa48("1644");
          // Check if directory.json already exists
          try {
            if (stryMutAct_9fa48("1645")) {
              {}
            } else {
              stryCov_9fa48("1645");
              await fs.access(this.directoryFile);
              // File exists, no need to migrate
              return;
            }
          } catch {
            // File doesn't exist, continue with migration
          }

          // Try to read draft.json
          const draftFile = config.paths.draftFile;
          try {
            if (stryMutAct_9fa48("1646")) {
              {}
            } else {
              stryCov_9fa48("1646");
              const data = await fs.readFile(draftFile, stryMutAct_9fa48("1647") ? "" : (stryCov_9fa48("1647"), 'utf8'));
              const parsed = safeJsonParse<{
                directory?: string;
              }>(data, {});
              if (stryMutAct_9fa48("1650") ? parsed || parsed.directory : stryMutAct_9fa48("1649") ? false : stryMutAct_9fa48("1648") ? true : (stryCov_9fa48("1648", "1649", "1650"), parsed && parsed.directory)) {
                if (stryMutAct_9fa48("1651")) {
                  {}
                } else {
                  stryCov_9fa48("1651");
                  // Save directory to new file
                  await this.saveDirectory(parsed.directory);
                  logger.info(stryMutAct_9fa48("1652") ? "" : (stryCov_9fa48("1652"), 'Migrated directory from draft.json:'), stryMutAct_9fa48("1653") ? {} : (stryCov_9fa48("1653"), {
                    directory: parsed.directory
                  }));
                }
              }
            }
          } catch (error) {
            if (stryMutAct_9fa48("1654")) {
              {}
            } else {
              stryCov_9fa48("1654");
              if (stryMutAct_9fa48("1657") ? (error as NodeJS.ErrnoException).code === 'ENOENT' : stryMutAct_9fa48("1656") ? false : stryMutAct_9fa48("1655") ? true : (stryCov_9fa48("1655", "1656", "1657"), (error as NodeJS.ErrnoException).code !== (stryMutAct_9fa48("1658") ? "" : (stryCov_9fa48("1658"), 'ENOENT')))) {
                if (stryMutAct_9fa48("1659")) {
                  {}
                } else {
                  stryCov_9fa48("1659");
                  logger.debug(stryMutAct_9fa48("1660") ? "" : (stryCov_9fa48("1660"), 'No draft.json to migrate from or error reading:'), error);
                }
              }
            }
          }
        }
      } catch (error) {
        if (stryMutAct_9fa48("1661")) {
          {}
        } else {
          stryCov_9fa48("1661");
          logger.error(stryMutAct_9fa48("1662") ? "" : (stryCov_9fa48("1662"), 'Failed to migrate directory from draft:'), error);
        }
      }
    }
  }

  /**
   * Load directory information from file
   */
  private async loadDirectory(): Promise<void> {
    if (stryMutAct_9fa48("1663")) {
      {}
    } else {
      stryCov_9fa48("1663");
      try {
        if (stryMutAct_9fa48("1664")) {
          {}
        } else {
          stryCov_9fa48("1664");
          const data = await fs.readFile(this.directoryFile, stryMutAct_9fa48("1665") ? "" : (stryCov_9fa48("1665"), 'utf8'));
          if (stryMutAct_9fa48("1668") ? !data && data.trim().length === 0 : stryMutAct_9fa48("1667") ? false : stryMutAct_9fa48("1666") ? true : (stryCov_9fa48("1666", "1667", "1668"), (stryMutAct_9fa48("1669") ? data : (stryCov_9fa48("1669"), !data)) || (stryMutAct_9fa48("1671") ? data.trim().length !== 0 : stryMutAct_9fa48("1670") ? false : (stryCov_9fa48("1670", "1671"), (stryMutAct_9fa48("1672") ? data.length : (stryCov_9fa48("1672"), data.trim().length)) === 0)))) {
            if (stryMutAct_9fa48("1673")) {
              {}
            } else {
              stryCov_9fa48("1673");
              logger.debug(stryMutAct_9fa48("1674") ? "" : (stryCov_9fa48("1674"), 'Directory file is empty'));
              return;
            }
          }
          const parsed = safeJsonParse<DirectoryData>(data, {} as DirectoryData);
          if (stryMutAct_9fa48("1677") ? parsed || typeof parsed.directory === 'string' : stryMutAct_9fa48("1676") ? false : stryMutAct_9fa48("1675") ? true : (stryCov_9fa48("1675", "1676", "1677"), parsed && (stryMutAct_9fa48("1679") ? typeof parsed.directory !== 'string' : stryMutAct_9fa48("1678") ? true : (stryCov_9fa48("1678", "1679"), typeof parsed.directory === (stryMutAct_9fa48("1680") ? "" : (stryCov_9fa48("1680"), 'string')))))) {
            if (stryMutAct_9fa48("1681")) {
              {}
            } else {
              stryCov_9fa48("1681");
              this.currentDirectory = parsed.directory;
              this.currentMethod = stryMutAct_9fa48("1684") ? parsed.method && null : stryMutAct_9fa48("1683") ? false : stryMutAct_9fa48("1682") ? true : (stryCov_9fa48("1682", "1683", "1684"), parsed.method || null);
              this.lastSaveTimestamp = stryMutAct_9fa48("1687") ? parsed.timestamp && 0 : stryMutAct_9fa48("1686") ? false : stryMutAct_9fa48("1685") ? true : (stryCov_9fa48("1685", "1686", "1687"), parsed.timestamp || 0);
              logger.debug(stryMutAct_9fa48("1688") ? "" : (stryCov_9fa48("1688"), 'Directory loaded:'), stryMutAct_9fa48("1689") ? {} : (stryCov_9fa48("1689"), {
                directory: this.currentDirectory,
                method: this.currentMethod
              }));
            }
          }
        }
      } catch (error) {
        if (stryMutAct_9fa48("1690")) {
          {}
        } else {
          stryCov_9fa48("1690");
          if (stryMutAct_9fa48("1693") ? (error as NodeJS.ErrnoException).code !== 'ENOENT' : stryMutAct_9fa48("1692") ? false : stryMutAct_9fa48("1691") ? true : (stryCov_9fa48("1691", "1692", "1693"), (error as NodeJS.ErrnoException).code === (stryMutAct_9fa48("1694") ? "" : (stryCov_9fa48("1694"), 'ENOENT')))) {
            if (stryMutAct_9fa48("1695")) {
              {}
            } else {
              stryCov_9fa48("1695");
              logger.debug(stryMutAct_9fa48("1696") ? "" : (stryCov_9fa48("1696"), 'Directory file not found'));
            }
          } else {
            if (stryMutAct_9fa48("1697")) {
              {}
            } else {
              stryCov_9fa48("1697");
              logger.error(stryMutAct_9fa48("1698") ? "" : (stryCov_9fa48("1698"), 'Error loading directory:'), error);
              throw error;
            }
          }
        }
      }
    }
  }

  /**
   * Save directory information to file
   */
  async saveDirectory(directory: string, method?: string): Promise<void> {
    if (stryMutAct_9fa48("1699")) {
      {}
    } else {
      stryCov_9fa48("1699");
      try {
        if (stryMutAct_9fa48("1700")) {
          {}
        } else {
          stryCov_9fa48("1700");
          this.currentDirectory = directory;
          this.currentMethod = stryMutAct_9fa48("1703") ? method && this.currentMethod : stryMutAct_9fa48("1702") ? false : stryMutAct_9fa48("1701") ? true : (stryCov_9fa48("1701", "1702", "1703"), method || this.currentMethod);
          this.lastSaveTimestamp = Date.now();
          const data: DirectoryData = stryMutAct_9fa48("1704") ? {} : (stryCov_9fa48("1704"), {
            directory: directory,
            timestamp: this.lastSaveTimestamp
          });
          if (stryMutAct_9fa48("1706") ? false : stryMutAct_9fa48("1705") ? true : (stryCov_9fa48("1705", "1706"), this.currentMethod)) {
            if (stryMutAct_9fa48("1707")) {
              {}
            } else {
              stryCov_9fa48("1707");
              data.method = this.currentMethod;
            }
          }
          const jsonData = safeJsonStringify(data);
          // Set restrictive file permissions (owner read/write only)
          await fs.writeFile(this.directoryFile, jsonData, stryMutAct_9fa48("1708") ? {} : (stryCov_9fa48("1708"), {
            mode: 0o600
          }));
          logger.debug(stryMutAct_9fa48("1709") ? "" : (stryCov_9fa48("1709"), 'Directory saved:'), stryMutAct_9fa48("1710") ? {} : (stryCov_9fa48("1710"), {
            directory: this.currentDirectory,
            method: this.currentMethod
          }));
        }
      } catch (error) {
        if (stryMutAct_9fa48("1711")) {
          {}
        } else {
          stryCov_9fa48("1711");
          logger.error(stryMutAct_9fa48("1712") ? "" : (stryCov_9fa48("1712"), 'Failed to save directory:'), error);
          throw error;
        }
      }
    }
  }

  /**
   * Set the current directory (in memory only, does not persist)
   */
  setDirectory(directory: string | null, method?: string): void {
    if (stryMutAct_9fa48("1713")) {
      {}
    } else {
      stryCov_9fa48("1713");
      this.currentDirectory = directory;
      if (stryMutAct_9fa48("1715") ? false : stryMutAct_9fa48("1714") ? true : (stryCov_9fa48("1714", "1715"), method)) {
        if (stryMutAct_9fa48("1716")) {
          {}
        } else {
          stryCov_9fa48("1716");
          this.currentMethod = method;
        }
      }
      logger.debug(stryMutAct_9fa48("1717") ? "" : (stryCov_9fa48("1717"), 'Directory set (in-memory):'), stryMutAct_9fa48("1718") ? {} : (stryCov_9fa48("1718"), {
        directory,
        method
      }));
    }
  }

  /**
   * Get the current directory
   */
  getDirectory(): string | null {
    if (stryMutAct_9fa48("1719")) {
      {}
    } else {
      stryCov_9fa48("1719");
      return this.currentDirectory;
    }
  }

  /**
   * Get the detection method used for the current directory
   */
  getMethod(): string | null {
    if (stryMutAct_9fa48("1720")) {
      {}
    } else {
      stryCov_9fa48("1720");
      return this.currentMethod;
    }
  }

  /**
   * Get the last save timestamp
   */
  getLastSaveTimestamp(): number {
    if (stryMutAct_9fa48("1721")) {
      {}
    } else {
      stryCov_9fa48("1721");
      return this.lastSaveTimestamp;
    }
  }

  /**
   * Check if a directory is set
   */
  hasDirectory(): boolean {
    if (stryMutAct_9fa48("1722")) {
      {}
    } else {
      stryCov_9fa48("1722");
      return stryMutAct_9fa48("1723") ? !this.currentDirectory : (stryCov_9fa48("1723"), !(stryMutAct_9fa48("1724") ? this.currentDirectory : (stryCov_9fa48("1724"), !this.currentDirectory)));
    }
  }

  /**
   * Clear directory information (both in-memory and file)
   */
  async clearDirectory(): Promise<void> {
    if (stryMutAct_9fa48("1725")) {
      {}
    } else {
      stryCov_9fa48("1725");
      try {
        if (stryMutAct_9fa48("1726")) {
          {}
        } else {
          stryCov_9fa48("1726");
          this.currentDirectory = null;
          this.currentMethod = null;
          this.lastSaveTimestamp = 0;
          await fs.unlink(this.directoryFile);
          logger.debug(stryMutAct_9fa48("1727") ? "" : (stryCov_9fa48("1727"), 'Directory cleared and file removed'));
        }
      } catch (error) {
        if (stryMutAct_9fa48("1728")) {
          {}
        } else {
          stryCov_9fa48("1728");
          if (stryMutAct_9fa48("1731") ? (error as NodeJS.ErrnoException).code !== 'ENOENT' : stryMutAct_9fa48("1730") ? false : stryMutAct_9fa48("1729") ? true : (stryCov_9fa48("1729", "1730", "1731"), (error as NodeJS.ErrnoException).code === (stryMutAct_9fa48("1732") ? "" : (stryCov_9fa48("1732"), 'ENOENT')))) {
            if (stryMutAct_9fa48("1733")) {
              {}
            } else {
              stryCov_9fa48("1733");
              logger.debug(stryMutAct_9fa48("1734") ? "" : (stryCov_9fa48("1734"), 'Directory file already does not exist'));
            }
          } else {
            if (stryMutAct_9fa48("1735")) {
              {}
            } else {
              stryCov_9fa48("1735");
              logger.error(stryMutAct_9fa48("1736") ? "" : (stryCov_9fa48("1736"), 'Failed to clear directory:'), error);
              throw error;
            }
          }
        }
      }
    }
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    if (stryMutAct_9fa48("1737")) {
      {}
    } else {
      stryCov_9fa48("1737");
      this.currentDirectory = null;
      this.currentMethod = null;
      this.lastSaveTimestamp = 0;
      logger.debug(stryMutAct_9fa48("1738") ? "" : (stryCov_9fa48("1738"), 'Directory manager destroyed'));
    }
  }
}
export default DirectoryManager;