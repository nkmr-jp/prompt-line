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
import path from 'path';
import config from '../config/app-config';
import { logger, safeJsonParse, safeJsonStringify, debounce } from '../utils/utils';
import type { DebounceFunction } from '../types';
interface DraftMetadata {
  length: number;
  timestamp: number;
  version: string;
  wordCount: number;
  lineCount: number;
  directory?: string;
}
interface DraftBackup {
  text: string;
  timestamp: number;
  originalFile: string;
  backupDate: string;
}
interface DraftStatsExtended {
  hasContent: boolean;
  length: number;
  wordCount: number;
  lineCount: number;
  isMultiline?: boolean;
}
class DraftManager {
  private draftFile: string;
  private saveDelay: number;
  private currentDraft: string | null = null;
  private pendingSave = stryMutAct_9fa48("1739") ? true : (stryCov_9fa48("1739"), false);
  private hasUnsavedChanges = stryMutAct_9fa48("1740") ? true : (stryCov_9fa48("1740"), false);
  private lastSavedContent: string | null = null;
  private debouncedSave: DebounceFunction<[string]>;
  private quickSave: DebounceFunction<[string]>;
  constructor() {
    if (stryMutAct_9fa48("1741")) {
      {}
    } else {
      stryCov_9fa48("1741");
      this.draftFile = config.paths.draftFile;
      this.saveDelay = config.draft.saveDelay;
      this.debouncedSave = debounce(this._saveDraft.bind(this), stryMutAct_9fa48("1742") ? this.saveDelay / 2 : (stryCov_9fa48("1742"), this.saveDelay * 2));
      this.quickSave = debounce(this._saveDraft.bind(this), this.saveDelay);
    }
  }
  async initialize(): Promise<void> {
    if (stryMutAct_9fa48("1743")) {
      {}
    } else {
      stryCov_9fa48("1743");
      try {
        if (stryMutAct_9fa48("1744")) {
          {}
        } else {
          stryCov_9fa48("1744");
          this.currentDraft = await this.loadDraft();
          logger.info(stryMutAct_9fa48("1745") ? "" : (stryCov_9fa48("1745"), 'Draft manager initialized'));
        }
      } catch (error) {
        if (stryMutAct_9fa48("1746")) {
          {}
        } else {
          stryCov_9fa48("1746");
          logger.error(stryMutAct_9fa48("1747") ? "" : (stryCov_9fa48("1747"), 'Failed to initialize draft manager:'), error);
          this.currentDraft = null;
        }
      }
    }
  }
  async loadDraft(): Promise<string> {
    if (stryMutAct_9fa48("1748")) {
      {}
    } else {
      stryCov_9fa48("1748");
      try {
        if (stryMutAct_9fa48("1749")) {
          {}
        } else {
          stryCov_9fa48("1749");
          const data = await fs.readFile(this.draftFile, stryMutAct_9fa48("1750") ? "" : (stryCov_9fa48("1750"), 'utf8'));
          if (stryMutAct_9fa48("1753") ? !data && data.trim().length === 0 : stryMutAct_9fa48("1752") ? false : stryMutAct_9fa48("1751") ? true : (stryCov_9fa48("1751", "1752", "1753"), (stryMutAct_9fa48("1754") ? data : (stryCov_9fa48("1754"), !data)) || (stryMutAct_9fa48("1756") ? data.trim().length !== 0 : stryMutAct_9fa48("1755") ? false : (stryCov_9fa48("1755", "1756"), (stryMutAct_9fa48("1757") ? data.length : (stryCov_9fa48("1757"), data.trim().length)) === 0)))) {
            if (stryMutAct_9fa48("1758")) {
              {}
            } else {
              stryCov_9fa48("1758");
              logger.debug(stryMutAct_9fa48("1759") ? "" : (stryCov_9fa48("1759"), 'Draft file is empty'));
              return stryMutAct_9fa48("1760") ? "Stryker was here!" : (stryCov_9fa48("1760"), '');
            }
          }
          const parsed = safeJsonParse<{
            text?: string;
          }>(data, {});
          if (stryMutAct_9fa48("1763") ? parsed || typeof parsed.text === 'string' : stryMutAct_9fa48("1762") ? false : stryMutAct_9fa48("1761") ? true : (stryCov_9fa48("1761", "1762", "1763"), parsed && (stryMutAct_9fa48("1765") ? typeof parsed.text !== 'string' : stryMutAct_9fa48("1764") ? true : (stryCov_9fa48("1764", "1765"), typeof parsed.text === (stryMutAct_9fa48("1766") ? "" : (stryCov_9fa48("1766"), 'string')))))) {
            if (stryMutAct_9fa48("1767")) {
              {}
            } else {
              stryCov_9fa48("1767");
              logger.debug(stryMutAct_9fa48("1768") ? "" : (stryCov_9fa48("1768"), 'Draft loaded:'), stryMutAct_9fa48("1769") ? {} : (stryCov_9fa48("1769"), {
                length: parsed.text.length
              }));
              return parsed.text;
            }
          } else {
            if (stryMutAct_9fa48("1770")) {
              {}
            } else {
              stryCov_9fa48("1770");
              logger.debug(stryMutAct_9fa48("1771") ? "" : (stryCov_9fa48("1771"), 'No valid draft found'));
              return stryMutAct_9fa48("1772") ? "Stryker was here!" : (stryCov_9fa48("1772"), '');
            }
          }
        }
      } catch (error) {
        if (stryMutAct_9fa48("1773")) {
          {}
        } else {
          stryCov_9fa48("1773");
          if (stryMutAct_9fa48("1776") ? (error as NodeJS.ErrnoException).code !== 'ENOENT' : stryMutAct_9fa48("1775") ? false : stryMutAct_9fa48("1774") ? true : (stryCov_9fa48("1774", "1775", "1776"), (error as NodeJS.ErrnoException).code === (stryMutAct_9fa48("1777") ? "" : (stryCov_9fa48("1777"), 'ENOENT')))) {
            if (stryMutAct_9fa48("1778")) {
              {}
            } else {
              stryCov_9fa48("1778");
              logger.debug(stryMutAct_9fa48("1779") ? "" : (stryCov_9fa48("1779"), 'Draft file not found'));
              return stryMutAct_9fa48("1780") ? "Stryker was here!" : (stryCov_9fa48("1780"), '');
            }
          } else {
            if (stryMutAct_9fa48("1781")) {
              {}
            } else {
              stryCov_9fa48("1781");
              logger.error(stryMutAct_9fa48("1782") ? "" : (stryCov_9fa48("1782"), 'Error loading draft:'), error);
              throw error;
            }
          }
        }
      }
    }
  }
  async saveDraft(text: string): Promise<void> {
    if (stryMutAct_9fa48("1783")) {
      {}
    } else {
      stryCov_9fa48("1783");
      try {
        if (stryMutAct_9fa48("1784")) {
          {}
        } else {
          stryCov_9fa48("1784");
          this.currentDraft = text;
          this.hasUnsavedChanges = stryMutAct_9fa48("1785") ? false : (stryCov_9fa48("1785"), true);
          if (stryMutAct_9fa48("1788") ? !text && !text.trim() : stryMutAct_9fa48("1787") ? false : stryMutAct_9fa48("1786") ? true : (stryCov_9fa48("1786", "1787", "1788"), (stryMutAct_9fa48("1789") ? text : (stryCov_9fa48("1789"), !text)) || (stryMutAct_9fa48("1790") ? text.trim() : (stryCov_9fa48("1790"), !(stryMutAct_9fa48("1791") ? text : (stryCov_9fa48("1791"), text.trim())))))) {
            if (stryMutAct_9fa48("1792")) {
              {}
            } else {
              stryCov_9fa48("1792");
              await this.clearDraft();
              return;
            }
          }

          // サイズ制限を追加（1MB）
          const MAX_DRAFT_SIZE = stryMutAct_9fa48("1793") ? 1024 / 1024 : (stryCov_9fa48("1793"), 1024 * 1024); // 1MB
          if (stryMutAct_9fa48("1797") ? Buffer.byteLength(text, 'utf8') <= MAX_DRAFT_SIZE : stryMutAct_9fa48("1796") ? Buffer.byteLength(text, 'utf8') >= MAX_DRAFT_SIZE : stryMutAct_9fa48("1795") ? false : stryMutAct_9fa48("1794") ? true : (stryCov_9fa48("1794", "1795", "1796", "1797"), Buffer.byteLength(text, stryMutAct_9fa48("1798") ? "" : (stryCov_9fa48("1798"), 'utf8')) > MAX_DRAFT_SIZE)) {
            if (stryMutAct_9fa48("1799")) {
              {}
            } else {
              stryCov_9fa48("1799");
              logger.warn(stryMutAct_9fa48("1800") ? "" : (stryCov_9fa48("1800"), 'Draft too large, rejecting'), stryMutAct_9fa48("1801") ? {} : (stryCov_9fa48("1801"), {
                size: Buffer.byteLength(text, stryMutAct_9fa48("1802") ? "" : (stryCov_9fa48("1802"), 'utf8')),
                limit: MAX_DRAFT_SIZE
              }));
              throw new Error(stryMutAct_9fa48("1803") ? "" : (stryCov_9fa48("1803"), 'Draft size exceeds 1MB limit'));
            }
          }
          if (stryMutAct_9fa48("1807") ? text.length <= 200 : stryMutAct_9fa48("1806") ? text.length >= 200 : stryMutAct_9fa48("1805") ? false : stryMutAct_9fa48("1804") ? true : (stryCov_9fa48("1804", "1805", "1806", "1807"), text.length > 200)) {
            if (stryMutAct_9fa48("1808")) {
              {}
            } else {
              stryCov_9fa48("1808");
              this.debouncedSave(text);
            }
          } else {
            if (stryMutAct_9fa48("1809")) {
              {}
            } else {
              stryCov_9fa48("1809");
              this.quickSave(text);
            }
          }
          logger.debug(stryMutAct_9fa48("1810") ? "" : (stryCov_9fa48("1810"), 'Draft save scheduled (optimized):'), stryMutAct_9fa48("1811") ? {} : (stryCov_9fa48("1811"), {
            length: text.length
          }));
        }
      } catch (error) {
        if (stryMutAct_9fa48("1812")) {
          {}
        } else {
          stryCov_9fa48("1812");
          logger.error(stryMutAct_9fa48("1813") ? "" : (stryCov_9fa48("1813"), 'Failed to schedule draft save:'), error);
          throw error;
        }
      }
    }
  }
  private async _saveDraft(text: string): Promise<void> {
    if (stryMutAct_9fa48("1814")) {
      {}
    } else {
      stryCov_9fa48("1814");
      if (stryMutAct_9fa48("1817") ? this.lastSavedContent !== text : stryMutAct_9fa48("1816") ? false : stryMutAct_9fa48("1815") ? true : (stryCov_9fa48("1815", "1816", "1817"), this.lastSavedContent === text)) {
        if (stryMutAct_9fa48("1818")) {
          {}
        } else {
          stryCov_9fa48("1818");
          logger.debug(stryMutAct_9fa48("1819") ? "" : (stryCov_9fa48("1819"), 'Draft save skipped - no changes'));
          return;
        }
      }
      if (stryMutAct_9fa48("1821") ? false : stryMutAct_9fa48("1820") ? true : (stryCov_9fa48("1820", "1821"), this.pendingSave)) {
        if (stryMutAct_9fa48("1822")) {
          {}
        } else {
          stryCov_9fa48("1822");
          return;
        }
      }
      this.pendingSave = stryMutAct_9fa48("1823") ? false : (stryCov_9fa48("1823"), true);
      try {
        if (stryMutAct_9fa48("1824")) {
          {}
        } else {
          stryCov_9fa48("1824");
          const draft = stryMutAct_9fa48("1825") ? {} : (stryCov_9fa48("1825"), {
            text: text,
            timestamp: Date.now(),
            version: stryMutAct_9fa48("1826") ? "" : (stryCov_9fa48("1826"), '1.0')
          });
          const data = safeJsonStringify(draft);
          // Set restrictive file permissions (owner read/write only)
          await fs.writeFile(this.draftFile, data, stryMutAct_9fa48("1827") ? {} : (stryCov_9fa48("1827"), {
            mode: 0o600
          }));
          this.lastSavedContent = text;
          this.hasUnsavedChanges = stryMutAct_9fa48("1828") ? true : (stryCov_9fa48("1828"), false);
          logger.debug(stryMutAct_9fa48("1829") ? "" : (stryCov_9fa48("1829"), 'Draft saved to file (optimized):'), stryMutAct_9fa48("1830") ? {} : (stryCov_9fa48("1830"), {
            length: text.length
          }));
        }
      } catch (error) {
        if (stryMutAct_9fa48("1831")) {
          {}
        } else {
          stryCov_9fa48("1831");
          logger.error(stryMutAct_9fa48("1832") ? "" : (stryCov_9fa48("1832"), 'Failed to save draft to file:'), error);
          throw error;
        }
      } finally {
        if (stryMutAct_9fa48("1833")) {
          {}
        } else {
          stryCov_9fa48("1833");
          this.pendingSave = stryMutAct_9fa48("1834") ? true : (stryCov_9fa48("1834"), false);
        }
      }
    }
  }
  async saveDraftImmediately(text: string): Promise<void> {
    if (stryMutAct_9fa48("1835")) {
      {}
    } else {
      stryCov_9fa48("1835");
      try {
        if (stryMutAct_9fa48("1836")) {
          {}
        } else {
          stryCov_9fa48("1836");
          this.currentDraft = text;
          if (stryMutAct_9fa48("1839") ? !text && !text.trim() : stryMutAct_9fa48("1838") ? false : stryMutAct_9fa48("1837") ? true : (stryCov_9fa48("1837", "1838", "1839"), (stryMutAct_9fa48("1840") ? text : (stryCov_9fa48("1840"), !text)) || (stryMutAct_9fa48("1841") ? text.trim() : (stryCov_9fa48("1841"), !(stryMutAct_9fa48("1842") ? text : (stryCov_9fa48("1842"), text.trim())))))) {
            if (stryMutAct_9fa48("1843")) {
              {}
            } else {
              stryCov_9fa48("1843");
              await this.clearDraft();
              return;
            }
          }

          // サイズ制限を追加（1MB）
          const MAX_DRAFT_SIZE = stryMutAct_9fa48("1844") ? 1024 / 1024 : (stryCov_9fa48("1844"), 1024 * 1024); // 1MB
          if (stryMutAct_9fa48("1848") ? Buffer.byteLength(text, 'utf8') <= MAX_DRAFT_SIZE : stryMutAct_9fa48("1847") ? Buffer.byteLength(text, 'utf8') >= MAX_DRAFT_SIZE : stryMutAct_9fa48("1846") ? false : stryMutAct_9fa48("1845") ? true : (stryCov_9fa48("1845", "1846", "1847", "1848"), Buffer.byteLength(text, stryMutAct_9fa48("1849") ? "" : (stryCov_9fa48("1849"), 'utf8')) > MAX_DRAFT_SIZE)) {
            if (stryMutAct_9fa48("1850")) {
              {}
            } else {
              stryCov_9fa48("1850");
              logger.warn(stryMutAct_9fa48("1851") ? "" : (stryCov_9fa48("1851"), 'Draft too large, rejecting'), stryMutAct_9fa48("1852") ? {} : (stryCov_9fa48("1852"), {
                size: Buffer.byteLength(text, stryMutAct_9fa48("1853") ? "" : (stryCov_9fa48("1853"), 'utf8')),
                limit: MAX_DRAFT_SIZE
              }));
              throw new Error(stryMutAct_9fa48("1854") ? "" : (stryCov_9fa48("1854"), 'Draft size exceeds 1MB limit'));
            }
          }
          await this._saveDraft(text);
          logger.debug(stryMutAct_9fa48("1855") ? "" : (stryCov_9fa48("1855"), 'Draft saved immediately (optimized):'), stryMutAct_9fa48("1856") ? {} : (stryCov_9fa48("1856"), {
            length: text.length
          }));
        }
      } catch (error) {
        if (stryMutAct_9fa48("1857")) {
          {}
        } else {
          stryCov_9fa48("1857");
          logger.error(stryMutAct_9fa48("1858") ? "" : (stryCov_9fa48("1858"), 'Failed to save draft immediately:'), error);
          throw error;
        }
      }
    }
  }
  async flushPendingSaves(): Promise<void> {
    if (stryMutAct_9fa48("1859")) {
      {}
    } else {
      stryCov_9fa48("1859");
      if (stryMutAct_9fa48("1862") ? this.hasUnsavedChanges && this.currentDraft !== this.lastSavedContent || this.currentDraft : stryMutAct_9fa48("1861") ? false : stryMutAct_9fa48("1860") ? true : (stryCov_9fa48("1860", "1861", "1862"), (stryMutAct_9fa48("1864") ? this.hasUnsavedChanges || this.currentDraft !== this.lastSavedContent : stryMutAct_9fa48("1863") ? true : (stryCov_9fa48("1863", "1864"), this.hasUnsavedChanges && (stryMutAct_9fa48("1866") ? this.currentDraft === this.lastSavedContent : stryMutAct_9fa48("1865") ? true : (stryCov_9fa48("1865", "1866"), this.currentDraft !== this.lastSavedContent)))) && this.currentDraft)) {
        if (stryMutAct_9fa48("1867")) {
          {}
        } else {
          stryCov_9fa48("1867");
          await this._saveDraft(this.currentDraft);
        }
      }
    }
  }
  async clearDraft(): Promise<void> {
    if (stryMutAct_9fa48("1868")) {
      {}
    } else {
      stryCov_9fa48("1868");
      try {
        if (stryMutAct_9fa48("1869")) {
          {}
        } else {
          stryCov_9fa48("1869");
          this.currentDraft = null;
          if (stryMutAct_9fa48("1871") ? false : stryMutAct_9fa48("1870") ? true : (stryCov_9fa48("1870", "1871"), this.debouncedSave.cancel)) {
            if (stryMutAct_9fa48("1872")) {
              {}
            } else {
              stryCov_9fa48("1872");
              this.debouncedSave.cancel();
            }
          }
          await fs.unlink(this.draftFile);
          logger.debug(stryMutAct_9fa48("1873") ? "" : (stryCov_9fa48("1873"), 'Draft cleared and file removed'));
        }
      } catch (error) {
        if (stryMutAct_9fa48("1874")) {
          {}
        } else {
          stryCov_9fa48("1874");
          if (stryMutAct_9fa48("1877") ? (error as NodeJS.ErrnoException).code !== 'ENOENT' : stryMutAct_9fa48("1876") ? false : stryMutAct_9fa48("1875") ? true : (stryCov_9fa48("1875", "1876", "1877"), (error as NodeJS.ErrnoException).code === (stryMutAct_9fa48("1878") ? "" : (stryCov_9fa48("1878"), 'ENOENT')))) {
            if (stryMutAct_9fa48("1879")) {
              {}
            } else {
              stryCov_9fa48("1879");
              logger.debug(stryMutAct_9fa48("1880") ? "" : (stryCov_9fa48("1880"), 'Draft file already does not exist'));
            }
          } else {
            if (stryMutAct_9fa48("1881")) {
              {}
            } else {
              stryCov_9fa48("1881");
              logger.error(stryMutAct_9fa48("1882") ? "" : (stryCov_9fa48("1882"), 'Failed to clear draft:'), error);
              throw error;
            }
          }
        }
      }
    }
  }
  getCurrentDraft(): string {
    if (stryMutAct_9fa48("1883")) {
      {}
    } else {
      stryCov_9fa48("1883");
      return stryMutAct_9fa48("1886") ? this.currentDraft && '' : stryMutAct_9fa48("1885") ? false : stryMutAct_9fa48("1884") ? true : (stryCov_9fa48("1884", "1885", "1886"), this.currentDraft || (stryMutAct_9fa48("1887") ? "Stryker was here!" : (stryCov_9fa48("1887"), '')));
    }
  }
  hasDraft(): boolean {
    if (stryMutAct_9fa48("1888")) {
      {}
    } else {
      stryCov_9fa48("1888");
      return stryMutAct_9fa48("1889") ? !(this.currentDraft && this.currentDraft.trim()) : (stryCov_9fa48("1889"), !(stryMutAct_9fa48("1890") ? this.currentDraft && this.currentDraft.trim() : (stryCov_9fa48("1890"), !(stryMutAct_9fa48("1893") ? this.currentDraft || this.currentDraft.trim() : stryMutAct_9fa48("1892") ? false : stryMutAct_9fa48("1891") ? true : (stryCov_9fa48("1891", "1892", "1893"), this.currentDraft && (stryMutAct_9fa48("1894") ? this.currentDraft : (stryCov_9fa48("1894"), this.currentDraft.trim())))))));
    }
  }
  async getDraftMetadata(): Promise<DraftMetadata | null> {
    if (stryMutAct_9fa48("1895")) {
      {}
    } else {
      stryCov_9fa48("1895");
      try {
        if (stryMutAct_9fa48("1896")) {
          {}
        } else {
          stryCov_9fa48("1896");
          const data = await fs.readFile(this.draftFile, stryMutAct_9fa48("1897") ? "" : (stryCov_9fa48("1897"), 'utf8'));
          const parsed = safeJsonParse<{
            text?: string;
            timestamp?: number;
            version?: string;
          }>(data, {});
          if (stryMutAct_9fa48("1900") ? parsed || parsed.text : stryMutAct_9fa48("1899") ? false : stryMutAct_9fa48("1898") ? true : (stryCov_9fa48("1898", "1899", "1900"), parsed && parsed.text)) {
            if (stryMutAct_9fa48("1901")) {
              {}
            } else {
              stryCov_9fa48("1901");
              return stryMutAct_9fa48("1902") ? {} : (stryCov_9fa48("1902"), {
                length: parsed.text.length,
                timestamp: stryMutAct_9fa48("1905") ? parsed.timestamp && 0 : stryMutAct_9fa48("1904") ? false : stryMutAct_9fa48("1903") ? true : (stryCov_9fa48("1903", "1904", "1905"), parsed.timestamp || 0),
                version: stryMutAct_9fa48("1908") ? parsed.version && '1.0' : stryMutAct_9fa48("1907") ? false : stryMutAct_9fa48("1906") ? true : (stryCov_9fa48("1906", "1907", "1908"), parsed.version || (stryMutAct_9fa48("1909") ? "" : (stryCov_9fa48("1909"), '1.0'))),
                wordCount: stryMutAct_9fa48("1910") ? parsed.text.split(/\s+/).length : (stryCov_9fa48("1910"), parsed.text.split(stryMutAct_9fa48("1912") ? /\S+/ : stryMutAct_9fa48("1911") ? /\s/ : (stryCov_9fa48("1911", "1912"), /\s+/)).filter(stryMutAct_9fa48("1913") ? () => undefined : (stryCov_9fa48("1913"), word => stryMutAct_9fa48("1917") ? word.length <= 0 : stryMutAct_9fa48("1916") ? word.length >= 0 : stryMutAct_9fa48("1915") ? false : stryMutAct_9fa48("1914") ? true : (stryCov_9fa48("1914", "1915", "1916", "1917"), word.length > 0))).length),
                lineCount: parsed.text.split(stryMutAct_9fa48("1918") ? "" : (stryCov_9fa48("1918"), '\n')).length
              });
            }
          }
          return null;
        }
      } catch (error) {
        if (stryMutAct_9fa48("1919")) {
          {}
        } else {
          stryCov_9fa48("1919");
          if (stryMutAct_9fa48("1922") ? (error as NodeJS.ErrnoException).code !== 'ENOENT' : stryMutAct_9fa48("1921") ? false : stryMutAct_9fa48("1920") ? true : (stryCov_9fa48("1920", "1921", "1922"), (error as NodeJS.ErrnoException).code === (stryMutAct_9fa48("1923") ? "" : (stryCov_9fa48("1923"), 'ENOENT')))) {
            if (stryMutAct_9fa48("1924")) {
              {}
            } else {
              stryCov_9fa48("1924");
              return null;
            }
          }
          logger.error(stryMutAct_9fa48("1925") ? "" : (stryCov_9fa48("1925"), 'Failed to get draft metadata:'), error);
          throw error;
        }
      }
    }
  }
  async updateDraft(text: string, immediate = stryMutAct_9fa48("1926") ? true : (stryCov_9fa48("1926"), false)): Promise<void> {
    if (stryMutAct_9fa48("1927")) {
      {}
    } else {
      stryCov_9fa48("1927");
      try {
        if (stryMutAct_9fa48("1928")) {
          {}
        } else {
          stryCov_9fa48("1928");
          this.currentDraft = text;
          if (stryMutAct_9fa48("1930") ? false : stryMutAct_9fa48("1929") ? true : (stryCov_9fa48("1929", "1930"), immediate)) {
            if (stryMutAct_9fa48("1931")) {
              {}
            } else {
              stryCov_9fa48("1931");
              await this.saveDraftImmediately(text);
            }
          } else {
            if (stryMutAct_9fa48("1932")) {
              {}
            } else {
              stryCov_9fa48("1932");
              await this.saveDraft(text);
            }
          }
        }
      } catch (error) {
        if (stryMutAct_9fa48("1933")) {
          {}
        } else {
          stryCov_9fa48("1933");
          logger.error(stryMutAct_9fa48("1934") ? "" : (stryCov_9fa48("1934"), 'Failed to update draft:'), error);
          throw error;
        }
      }
    }
  }
  getDraftStats(): DraftStatsExtended {
    if (stryMutAct_9fa48("1935")) {
      {}
    } else {
      stryCov_9fa48("1935");
      const text = this.getCurrentDraft();
      if (stryMutAct_9fa48("1938") ? false : stryMutAct_9fa48("1937") ? true : stryMutAct_9fa48("1936") ? text : (stryCov_9fa48("1936", "1937", "1938"), !text)) {
        if (stryMutAct_9fa48("1939")) {
          {}
        } else {
          stryCov_9fa48("1939");
          return stryMutAct_9fa48("1940") ? {} : (stryCov_9fa48("1940"), {
            hasContent: stryMutAct_9fa48("1941") ? true : (stryCov_9fa48("1941"), false),
            length: 0,
            wordCount: 0,
            lineCount: 0
          });
        }
      }
      return stryMutAct_9fa48("1942") ? {} : (stryCov_9fa48("1942"), {
        hasContent: stryMutAct_9fa48("1943") ? false : (stryCov_9fa48("1943"), true),
        length: text.length,
        wordCount: stryMutAct_9fa48("1944") ? text.split(/\s+/).length : (stryCov_9fa48("1944"), text.split(stryMutAct_9fa48("1946") ? /\S+/ : stryMutAct_9fa48("1945") ? /\s/ : (stryCov_9fa48("1945", "1946"), /\s+/)).filter(stryMutAct_9fa48("1947") ? () => undefined : (stryCov_9fa48("1947"), word => stryMutAct_9fa48("1951") ? word.length <= 0 : stryMutAct_9fa48("1950") ? word.length >= 0 : stryMutAct_9fa48("1949") ? false : stryMutAct_9fa48("1948") ? true : (stryCov_9fa48("1948", "1949", "1950", "1951"), word.length > 0))).length),
        lineCount: text.split(stryMutAct_9fa48("1952") ? "" : (stryCov_9fa48("1952"), '\n')).length,
        isMultiline: text.includes(stryMutAct_9fa48("1953") ? "" : (stryCov_9fa48("1953"), '\n'))
      });
    }
  }
  async backupDraft(): Promise<string> {
    if (stryMutAct_9fa48("1954")) {
      {}
    } else {
      stryCov_9fa48("1954");
      try {
        if (stryMutAct_9fa48("1955")) {
          {}
        } else {
          stryCov_9fa48("1955");
          if (stryMutAct_9fa48("1958") ? false : stryMutAct_9fa48("1957") ? true : stryMutAct_9fa48("1956") ? this.hasDraft() : (stryCov_9fa48("1956", "1957", "1958"), !this.hasDraft())) {
            if (stryMutAct_9fa48("1959")) {
              {}
            } else {
              stryCov_9fa48("1959");
              throw new Error(stryMutAct_9fa48("1960") ? "" : (stryCov_9fa48("1960"), 'No draft to backup'));
            }
          }
          const timestamp = new Date().toISOString().replace(stryMutAct_9fa48("1961") ? /[^:.]/g : (stryCov_9fa48("1961"), /[:.]/g), stryMutAct_9fa48("1962") ? "" : (stryCov_9fa48("1962"), '-'));
          const backupFile = stryMutAct_9fa48("1963") ? `` : (stryCov_9fa48("1963"), `${this.draftFile}.backup.${timestamp}`);
          const draft: DraftBackup = stryMutAct_9fa48("1964") ? {} : (stryCov_9fa48("1964"), {
            text: this.currentDraft!,
            timestamp: Date.now(),
            originalFile: this.draftFile,
            backupDate: new Date().toISOString()
          });
          const data = safeJsonStringify(draft);
          // Set restrictive file permissions (owner read/write only)
          await fs.writeFile(backupFile, data, stryMutAct_9fa48("1965") ? {} : (stryCov_9fa48("1965"), {
            mode: 0o600
          }));
          logger.info(stryMutAct_9fa48("1966") ? "" : (stryCov_9fa48("1966"), 'Draft backed up to:'), backupFile);
          return backupFile;
        }
      } catch (error) {
        if (stryMutAct_9fa48("1967")) {
          {}
        } else {
          stryCov_9fa48("1967");
          logger.error(stryMutAct_9fa48("1968") ? "" : (stryCov_9fa48("1968"), 'Failed to backup draft:'), error);
          throw error;
        }
      }
    }
  }
  async restoreDraft(backupFile: string): Promise<void> {
    if (stryMutAct_9fa48("1969")) {
      {}
    } else {
      stryCov_9fa48("1969");
      try {
        if (stryMutAct_9fa48("1970")) {
          {}
        } else {
          stryCov_9fa48("1970");
          // Validate backup file path to prevent path traversal attacks
          const normalizedPath = path.normalize(backupFile);
          const userDataDir = path.dirname(this.draftFile);
          if (stryMutAct_9fa48("1973") ? false : stryMutAct_9fa48("1972") ? true : stryMutAct_9fa48("1971") ? normalizedPath.startsWith(path.normalize(userDataDir)) : (stryCov_9fa48("1971", "1972", "1973"), !(stryMutAct_9fa48("1974") ? normalizedPath.endsWith(path.normalize(userDataDir)) : (stryCov_9fa48("1974"), normalizedPath.startsWith(path.normalize(userDataDir)))))) {
            if (stryMutAct_9fa48("1975")) {
              {}
            } else {
              stryCov_9fa48("1975");
              throw new Error(stryMutAct_9fa48("1976") ? "" : (stryCov_9fa48("1976"), 'Invalid backup file path'));
            }
          }
          const data = await fs.readFile(normalizedPath, stryMutAct_9fa48("1977") ? "" : (stryCov_9fa48("1977"), 'utf8'));
          const parsed = safeJsonParse<DraftBackup>(data, {} as DraftBackup);
          if (stryMutAct_9fa48("1980") ? !parsed && !parsed.text : stryMutAct_9fa48("1979") ? false : stryMutAct_9fa48("1978") ? true : (stryCov_9fa48("1978", "1979", "1980"), (stryMutAct_9fa48("1981") ? parsed : (stryCov_9fa48("1981"), !parsed)) || (stryMutAct_9fa48("1982") ? parsed.text : (stryCov_9fa48("1982"), !parsed.text)))) {
            if (stryMutAct_9fa48("1983")) {
              {}
            } else {
              stryCov_9fa48("1983");
              throw new Error(stryMutAct_9fa48("1984") ? "" : (stryCov_9fa48("1984"), 'Invalid backup file format'));
            }
          }
          await this.saveDraftImmediately(parsed.text);
          logger.info(stryMutAct_9fa48("1985") ? "" : (stryCov_9fa48("1985"), 'Draft restored from backup:'), backupFile);
        }
      } catch (error) {
        if (stryMutAct_9fa48("1986")) {
          {}
        } else {
          stryCov_9fa48("1986");
          logger.error(stryMutAct_9fa48("1987") ? "" : (stryCov_9fa48("1987"), 'Failed to restore draft from backup:'), error);
          throw error;
        }
      }
    }
  }
  async cleanupBackups(maxAge = stryMutAct_9fa48("1988") ? 7 * 24 * 60 * 60 / 1000 : (stryCov_9fa48("1988"), (stryMutAct_9fa48("1989") ? 7 * 24 * 60 / 60 : (stryCov_9fa48("1989"), (stryMutAct_9fa48("1990") ? 7 * 24 / 60 : (stryCov_9fa48("1990"), (stryMutAct_9fa48("1991") ? 7 / 24 : (stryCov_9fa48("1991"), 7 * 24)) * 60)) * 60)) * 1000)): Promise<number> {
    if (stryMutAct_9fa48("1992")) {
      {}
    } else {
      stryCov_9fa48("1992");
      try {
        if (stryMutAct_9fa48("1993")) {
          {}
        } else {
          stryCov_9fa48("1993");
          const dir = path.dirname(this.draftFile);
          const files = await fs.readdir(dir);
          const backupFiles = stryMutAct_9fa48("1994") ? files : (stryCov_9fa48("1994"), files.filter(stryMutAct_9fa48("1995") ? () => undefined : (stryCov_9fa48("1995"), file => stryMutAct_9fa48("1996") ? file.endsWith(path.basename(this.draftFile) + '.backup.') : (stryCov_9fa48("1996"), file.startsWith(path.basename(this.draftFile) + (stryMutAct_9fa48("1997") ? "" : (stryCov_9fa48("1997"), '.backup.')))))));
          let cleanedCount = 0;
          const now = Date.now();
          for (const file of backupFiles) {
            if (stryMutAct_9fa48("1998")) {
              {}
            } else {
              stryCov_9fa48("1998");
              const filePath = path.join(dir, file);
              const stats = await fs.stat(filePath);
              if (stryMutAct_9fa48("2002") ? now - stats.mtime.getTime() <= maxAge : stryMutAct_9fa48("2001") ? now - stats.mtime.getTime() >= maxAge : stryMutAct_9fa48("2000") ? false : stryMutAct_9fa48("1999") ? true : (stryCov_9fa48("1999", "2000", "2001", "2002"), (stryMutAct_9fa48("2003") ? now + stats.mtime.getTime() : (stryCov_9fa48("2003"), now - stats.mtime.getTime())) > maxAge)) {
                if (stryMutAct_9fa48("2004")) {
                  {}
                } else {
                  stryCov_9fa48("2004");
                  await fs.unlink(filePath);
                  stryMutAct_9fa48("2005") ? cleanedCount-- : (stryCov_9fa48("2005"), cleanedCount++);
                  logger.debug(stryMutAct_9fa48("2006") ? "" : (stryCov_9fa48("2006"), 'Cleaned up old backup:'), file);
                }
              }
            }
          }
          logger.info(stryMutAct_9fa48("2007") ? `` : (stryCov_9fa48("2007"), `Cleaned up ${cleanedCount} old draft backups`));
          return cleanedCount;
        }
      } catch (error) {
        if (stryMutAct_9fa48("2008")) {
          {}
        } else {
          stryCov_9fa48("2008");
          logger.error(stryMutAct_9fa48("2009") ? "" : (stryCov_9fa48("2009"), 'Failed to cleanup draft backups:'), error);
          throw error;
        }
      }
    }
  }
  async destroy(): Promise<void> {
    if (stryMutAct_9fa48("2010")) {
      {}
    } else {
      stryCov_9fa48("2010");
      try {
        if (stryMutAct_9fa48("2011")) {
          {}
        } else {
          stryCov_9fa48("2011");
          await this.flushPendingSaves();
          if (stryMutAct_9fa48("2013") ? false : stryMutAct_9fa48("2012") ? true : (stryCov_9fa48("2012", "2013"), this.debouncedSave.cancel)) {
            if (stryMutAct_9fa48("2014")) {
              {}
            } else {
              stryCov_9fa48("2014");
              this.debouncedSave.cancel();
            }
          }
          if (stryMutAct_9fa48("2016") ? false : stryMutAct_9fa48("2015") ? true : (stryCov_9fa48("2015", "2016"), this.quickSave.cancel)) {
            if (stryMutAct_9fa48("2017")) {
              {}
            } else {
              stryCov_9fa48("2017");
              this.quickSave.cancel();
            }
          }
          this.currentDraft = null;
          this.hasUnsavedChanges = stryMutAct_9fa48("2018") ? true : (stryCov_9fa48("2018"), false);
          this.lastSavedContent = null;
          logger.debug(stryMutAct_9fa48("2019") ? "" : (stryCov_9fa48("2019"), 'Draft manager destroyed (optimized cleanup completed)'));
        }
      } catch (error) {
        if (stryMutAct_9fa48("2020")) {
          {}
        } else {
          stryCov_9fa48("2020");
          logger.error(stryMutAct_9fa48("2021") ? "" : (stryCov_9fa48("2021"), 'Error during draft manager cleanup:'), error);
        }
      }
    }
  }
}
export default DraftManager;