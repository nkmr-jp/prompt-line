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
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import config from '../config/app-config';
import { logger, generateId, debounce, safeJsonParse } from '../utils/utils';
import type { HistoryItem, HistoryStats, ExportData, DebounceFunction, IHistoryManager, HistoryConfig } from '../types';
import { LIMITS } from "../constants";

/**
 * HistoryManager - Optimized history management with LRU caching
 * Provides unlimited history storage with streaming operations for large datasets.
 */
class HistoryManager implements IHistoryManager {
  private recentCache: HistoryItem[] = stryMutAct_9fa48("2486") ? ["Stryker was here"] : (stryCov_9fa48("2486"), []);
  private cacheSize = LIMITS.MAX_CACHE_ITEMS;
  private historyFile: string;
  private totalItemCount = 0;
  private totalItemCountCached = stryMutAct_9fa48("2487") ? true : (stryCov_9fa48("2487"), false);
  private appendQueue: HistoryItem[] = stryMutAct_9fa48("2488") ? ["Stryker was here"] : (stryCov_9fa48("2488"), []);
  private debouncedAppend: DebounceFunction<[]>;
  private duplicateCheckSet = new Set<string>();
  constructor() {
    if (stryMutAct_9fa48("2489")) {
      {}
    } else {
      stryCov_9fa48("2489");
      this.historyFile = config.paths.historyFile;
      this.debouncedAppend = debounce(this.flushAppendQueue.bind(this), 100);
    }
  }
  async initialize(): Promise<void> {
    if (stryMutAct_9fa48("2490")) {
      {}
    } else {
      stryCov_9fa48("2490");
      try {
        if (stryMutAct_9fa48("2491")) {
          {}
        } else {
          stryCov_9fa48("2491");
          await this.ensureHistoryFile();
          await this.loadRecentHistory();
          logger.info(stryMutAct_9fa48("2492") ? `` : (stryCov_9fa48("2492"), `History manager initialized with ${this.recentCache.length} cached items (total count will be calculated when needed)`));

          // Background count calculation to avoid blocking startup
          this.countTotalItemsAsync().catch((error: Error) => {
            if (stryMutAct_9fa48("2493")) {
              {}
            } else {
              stryCov_9fa48("2493");
              logger.warn(stryMutAct_9fa48("2494") ? "" : (stryCov_9fa48("2494"), 'Background total count failed:'), error);
            }
          });
        }
      } catch (error) {
        if (stryMutAct_9fa48("2495")) {
          {}
        } else {
          stryCov_9fa48("2495");
          logger.error(stryMutAct_9fa48("2496") ? "" : (stryCov_9fa48("2496"), 'Failed to initialize history manager:'), error);
          this.recentCache = stryMutAct_9fa48("2497") ? ["Stryker was here"] : (stryCov_9fa48("2497"), []);
          this.totalItemCount = 0;
          this.totalItemCountCached = stryMutAct_9fa48("2498") ? true : (stryCov_9fa48("2498"), false);
        }
      }
    }
  }
  private async ensureHistoryFile(): Promise<void> {
    if (stryMutAct_9fa48("2499")) {
      {}
    } else {
      stryCov_9fa48("2499");
      try {
        if (stryMutAct_9fa48("2500")) {
          {}
        } else {
          stryCov_9fa48("2500");
          await fs.access(this.historyFile);
        }
      } catch {
        if (stryMutAct_9fa48("2501")) {
          {}
        } else {
          stryCov_9fa48("2501");
          // Set restrictive file permissions (owner read/write only)
          await fs.writeFile(this.historyFile, stryMutAct_9fa48("2502") ? "Stryker was here!" : (stryCov_9fa48("2502"), ''), stryMutAct_9fa48("2503") ? {} : (stryCov_9fa48("2503"), {
            mode: 0o600
          }));
          logger.debug(stryMutAct_9fa48("2504") ? "" : (stryCov_9fa48("2504"), 'Created new history file'));
        }
      }
    }
  }
  private async loadRecentHistory(): Promise<void> {
    if (stryMutAct_9fa48("2505")) {
      {}
    } else {
      stryCov_9fa48("2505");
      try {
        if (stryMutAct_9fa48("2506")) {
          {}
        } else {
          stryCov_9fa48("2506");
          const lines = await this.readLastNLines(this.cacheSize);
          this.recentCache = stryMutAct_9fa48("2507") ? ["Stryker was here"] : (stryCov_9fa48("2507"), []);
          this.duplicateCheckSet.clear();
          for (const line of lines) {
            if (stryMutAct_9fa48("2508")) {
              {}
            } else {
              stryCov_9fa48("2508");
              const item = safeJsonParse<HistoryItem>(line);
              if (stryMutAct_9fa48("2511") ? item || this.validateHistoryItem(item) : stryMutAct_9fa48("2510") ? false : stryMutAct_9fa48("2509") ? true : (stryCov_9fa48("2509", "2510", "2511"), item && this.validateHistoryItem(item))) {
                if (stryMutAct_9fa48("2512")) {
                  {}
                } else {
                  stryCov_9fa48("2512");
                  this.recentCache.unshift(item);
                  this.duplicateCheckSet.add(item.text);
                }
              }
            }
          }
          logger.debug(stryMutAct_9fa48("2513") ? `` : (stryCov_9fa48("2513"), `Loaded ${this.recentCache.length} recent history items into cache`));
        }
      } catch (error) {
        if (stryMutAct_9fa48("2514")) {
          {}
        } else {
          stryCov_9fa48("2514");
          logger.error(stryMutAct_9fa48("2515") ? "" : (stryCov_9fa48("2515"), 'Error loading recent history:'), error);
          this.recentCache = stryMutAct_9fa48("2516") ? ["Stryker was here"] : (stryCov_9fa48("2516"), []);
        }
      }
    }
  }
  private async readLastNLines(lineCount = 100): Promise<string[]> {
    if (stryMutAct_9fa48("2517")) {
      {}
    } else {
      stryCov_9fa48("2517");
      const fd = await fs.open(this.historyFile, stryMutAct_9fa48("2518") ? "" : (stryCov_9fa48("2518"), 'r'));
      const stats = await fd.stat();
      const fileSize = stats.size;
      if (stryMutAct_9fa48("2521") ? fileSize !== 0 : stryMutAct_9fa48("2520") ? false : stryMutAct_9fa48("2519") ? true : (stryCov_9fa48("2519", "2520", "2521"), fileSize === 0)) {
        if (stryMutAct_9fa48("2522")) {
          {}
        } else {
          stryCov_9fa48("2522");
          await fd.close();
          return stryMutAct_9fa48("2523") ? ["Stryker was here"] : (stryCov_9fa48("2523"), []);
        }
      }
      let position = fileSize;
      const lines: string[] = stryMutAct_9fa48("2524") ? ["Stryker was here"] : (stryCov_9fa48("2524"), []);
      let remainder = stryMutAct_9fa48("2525") ? "Stryker was here!" : (stryCov_9fa48("2525"), '');
      const chunkSize = 8192; // 8KB chunks

      try {
        if (stryMutAct_9fa48("2526")) {
          {}
        } else {
          stryCov_9fa48("2526");
          while (stryMutAct_9fa48("2528") ? lines.length < lineCount || position > 0 : stryMutAct_9fa48("2527") ? false : (stryCov_9fa48("2527", "2528"), (stryMutAct_9fa48("2531") ? lines.length >= lineCount : stryMutAct_9fa48("2530") ? lines.length <= lineCount : stryMutAct_9fa48("2529") ? true : (stryCov_9fa48("2529", "2530", "2531"), lines.length < lineCount)) && (stryMutAct_9fa48("2534") ? position <= 0 : stryMutAct_9fa48("2533") ? position >= 0 : stryMutAct_9fa48("2532") ? true : (stryCov_9fa48("2532", "2533", "2534"), position > 0)))) {
            if (stryMutAct_9fa48("2535")) {
              {}
            } else {
              stryCov_9fa48("2535");
              const readSize = stryMutAct_9fa48("2536") ? Math.max(chunkSize, position) : (stryCov_9fa48("2536"), Math.min(chunkSize, position));
              stryMutAct_9fa48("2537") ? position += readSize : (stryCov_9fa48("2537"), position -= readSize);
              const buffer = Buffer.alloc(readSize);
              await fd.read(buffer, 0, readSize, position);
              const chunk = buffer.toString(stryMutAct_9fa48("2538") ? "" : (stryCov_9fa48("2538"), 'utf8'));
              const text = stryMutAct_9fa48("2539") ? chunk - remainder : (stryCov_9fa48("2539"), chunk + remainder);
              const textLines = text.split(stryMutAct_9fa48("2540") ? "" : (stryCov_9fa48("2540"), '\n'));

              // 最初の行は不完全な可能性があるので次回に回す
              remainder = (stryMutAct_9fa48("2544") ? position <= 0 : stryMutAct_9fa48("2543") ? position >= 0 : stryMutAct_9fa48("2542") ? false : stryMutAct_9fa48("2541") ? true : (stryCov_9fa48("2541", "2542", "2543", "2544"), position > 0)) ? stryMutAct_9fa48("2547") ? textLines.shift() && '' : stryMutAct_9fa48("2546") ? false : stryMutAct_9fa48("2545") ? true : (stryCov_9fa48("2545", "2546", "2547"), textLines.shift() || (stryMutAct_9fa48("2548") ? "Stryker was here!" : (stryCov_9fa48("2548"), ''))) : stryMutAct_9fa48("2549") ? "Stryker was here!" : (stryCov_9fa48("2549"), '');

              // 末尾から有効な行を収集
              for (let i = stryMutAct_9fa48("2550") ? textLines.length + 1 : (stryCov_9fa48("2550"), textLines.length - 1); stryMutAct_9fa48("2552") ? i >= 0 || lines.length < lineCount : stryMutAct_9fa48("2551") ? false : (stryCov_9fa48("2551", "2552"), (stryMutAct_9fa48("2555") ? i < 0 : stryMutAct_9fa48("2554") ? i > 0 : stryMutAct_9fa48("2553") ? true : (stryCov_9fa48("2553", "2554", "2555"), i >= 0)) && (stryMutAct_9fa48("2558") ? lines.length >= lineCount : stryMutAct_9fa48("2557") ? lines.length <= lineCount : stryMutAct_9fa48("2556") ? true : (stryCov_9fa48("2556", "2557", "2558"), lines.length < lineCount))); stryMutAct_9fa48("2559") ? i++ : (stryCov_9fa48("2559"), i--)) {
                if (stryMutAct_9fa48("2560")) {
                  {}
                } else {
                  stryCov_9fa48("2560");
                  const line = stryMutAct_9fa48("2562") ? textLines[i].trim() : stryMutAct_9fa48("2561") ? textLines[i] : (stryCov_9fa48("2561", "2562"), textLines[i]?.trim());
                  if (stryMutAct_9fa48("2564") ? false : stryMutAct_9fa48("2563") ? true : (stryCov_9fa48("2563", "2564"), line)) {
                    if (stryMutAct_9fa48("2565")) {
                      {}
                    } else {
                      stryCov_9fa48("2565");
                      lines.unshift(line);
                    }
                  }
                }
              }
            }
          }
          return stryMutAct_9fa48("2566") ? lines : (stryCov_9fa48("2566"), lines.slice(stryMutAct_9fa48("2567") ? +lineCount : (stryCov_9fa48("2567"), -lineCount))); // 念のため再度制限
        }
      } finally {
        if (stryMutAct_9fa48("2568")) {
          {}
        } else {
          stryCov_9fa48("2568");
          await fd.close();
        }
      }
    }
  }
  private async countTotalItems(): Promise<void> {
    if (stryMutAct_9fa48("2569")) {
      {}
    } else {
      stryCov_9fa48("2569");
      if (stryMutAct_9fa48("2571") ? false : stryMutAct_9fa48("2570") ? true : (stryCov_9fa48("2570", "2571"), this.totalItemCountCached)) {
        if (stryMutAct_9fa48("2572")) {
          {}
        } else {
          stryCov_9fa48("2572");
          return; // 既にカウント済み
        }
      }
      return new Promise(resolve => {
        if (stryMutAct_9fa48("2573")) {
          {}
        } else {
          stryCov_9fa48("2573");
          let count = 0;
          const stream = createReadStream(this.historyFile);
          const rl = createInterface(stryMutAct_9fa48("2574") ? {} : (stryCov_9fa48("2574"), {
            input: stream,
            crlfDelay: Infinity
          }));
          rl.on(stryMutAct_9fa48("2575") ? "" : (stryCov_9fa48("2575"), 'line'), line => {
            if (stryMutAct_9fa48("2576")) {
              {}
            } else {
              stryCov_9fa48("2576");
              if (stryMutAct_9fa48("2579") ? line : stryMutAct_9fa48("2578") ? false : stryMutAct_9fa48("2577") ? true : (stryCov_9fa48("2577", "2578", "2579"), line.trim())) stryMutAct_9fa48("2580") ? count-- : (stryCov_9fa48("2580"), count++);
            }
          });
          rl.on(stryMutAct_9fa48("2581") ? "" : (stryCov_9fa48("2581"), 'close'), () => {
            if (stryMutAct_9fa48("2582")) {
              {}
            } else {
              stryCov_9fa48("2582");
              this.totalItemCount = count;
              this.totalItemCountCached = stryMutAct_9fa48("2583") ? false : (stryCov_9fa48("2583"), true);
              logger.debug(stryMutAct_9fa48("2584") ? `` : (stryCov_9fa48("2584"), `Total item count calculated: ${count}`));
              resolve();
            }
          });
          rl.on(stryMutAct_9fa48("2585") ? "" : (stryCov_9fa48("2585"), 'error'), (error: Error) => {
            if (stryMutAct_9fa48("2586")) {
              {}
            } else {
              stryCov_9fa48("2586");
              logger.error(stryMutAct_9fa48("2587") ? "" : (stryCov_9fa48("2587"), 'Error counting history items:'), error);
              this.totalItemCount = this.recentCache.length;
              this.totalItemCountCached = stryMutAct_9fa48("2588") ? false : (stryCov_9fa48("2588"), true);
              resolve();
            }
          });
        }
      });
    }
  }
  private async countTotalItemsAsync(): Promise<void> {
    if (stryMutAct_9fa48("2589")) {
      {}
    } else {
      stryCov_9fa48("2589");
      // Async background count execution
      setTimeout(async () => {
        if (stryMutAct_9fa48("2590")) {
          {}
        } else {
          stryCov_9fa48("2590");
          try {
            if (stryMutAct_9fa48("2591")) {
              {}
            } else {
              stryCov_9fa48("2591");
              await this.countTotalItems();
            }
          } catch (error) {
            if (stryMutAct_9fa48("2592")) {
              {}
            } else {
              stryCov_9fa48("2592");
              logger.warn(stryMutAct_9fa48("2593") ? "" : (stryCov_9fa48("2593"), 'Background total items count failed:'), error);
            }
          }
        }
      }, 100);
    }
  }
  async addToHistory(text: string, appName?: string, directory?: string): Promise<HistoryItem | null> {
    if (stryMutAct_9fa48("2594")) {
      {}
    } else {
      stryCov_9fa48("2594");
      try {
        if (stryMutAct_9fa48("2595")) {
          {}
        } else {
          stryCov_9fa48("2595");
          const trimmedText = stryMutAct_9fa48("2596") ? text : (stryCov_9fa48("2596"), text.trim());
          if (stryMutAct_9fa48("2599") ? false : stryMutAct_9fa48("2598") ? true : stryMutAct_9fa48("2597") ? trimmedText : (stryCov_9fa48("2597", "2598", "2599"), !trimmedText)) {
            if (stryMutAct_9fa48("2600")) {
              {}
            } else {
              stryCov_9fa48("2600");
              logger.debug(stryMutAct_9fa48("2601") ? "" : (stryCov_9fa48("2601"), 'Attempted to add empty text to history'));
              return null;
            }
          }
          if (stryMutAct_9fa48("2603") ? false : stryMutAct_9fa48("2602") ? true : (stryCov_9fa48("2602", "2603"), this.duplicateCheckSet.has(trimmedText))) {
            if (stryMutAct_9fa48("2604")) {
              {}
            } else {
              stryCov_9fa48("2604");
              // Move existing item to latest position
              this.recentCache = stryMutAct_9fa48("2605") ? this.recentCache : (stryCov_9fa48("2605"), this.recentCache.filter(stryMutAct_9fa48("2606") ? () => undefined : (stryCov_9fa48("2606"), item => stryMutAct_9fa48("2609") ? item.text === trimmedText : stryMutAct_9fa48("2608") ? false : stryMutAct_9fa48("2607") ? true : (stryCov_9fa48("2607", "2608", "2609"), item.text !== trimmedText))));
              const existingItem = this.recentCache.find(stryMutAct_9fa48("2610") ? () => undefined : (stryCov_9fa48("2610"), item => stryMutAct_9fa48("2613") ? item.text !== trimmedText : stryMutAct_9fa48("2612") ? false : stryMutAct_9fa48("2611") ? true : (stryCov_9fa48("2611", "2612", "2613"), item.text === trimmedText)));
              if (stryMutAct_9fa48("2615") ? false : stryMutAct_9fa48("2614") ? true : (stryCov_9fa48("2614", "2615"), existingItem)) {
                if (stryMutAct_9fa48("2616")) {
                  {}
                } else {
                  stryCov_9fa48("2616");
                  existingItem.timestamp = Date.now();
                  if (stryMutAct_9fa48("2618") ? false : stryMutAct_9fa48("2617") ? true : (stryCov_9fa48("2617", "2618"), appName)) {
                    if (stryMutAct_9fa48("2619")) {
                      {}
                    } else {
                      stryCov_9fa48("2619");
                      existingItem.appName = appName;
                    }
                  }
                  if (stryMutAct_9fa48("2621") ? false : stryMutAct_9fa48("2620") ? true : (stryCov_9fa48("2620", "2621"), directory)) {
                    if (stryMutAct_9fa48("2622")) {
                      {}
                    } else {
                      stryCov_9fa48("2622");
                      existingItem.directory = directory;
                    }
                  }
                  this.recentCache.unshift(existingItem);
                  return existingItem;
                }
              }
            }
          }
          const historyItem: HistoryItem = stryMutAct_9fa48("2623") ? {} : (stryCov_9fa48("2623"), {
            text: trimmedText,
            timestamp: Date.now(),
            id: generateId(),
            ...(stryMutAct_9fa48("2626") ? appName || {
              appName
            } : stryMutAct_9fa48("2625") ? false : stryMutAct_9fa48("2624") ? true : (stryCov_9fa48("2624", "2625", "2626"), appName && (stryMutAct_9fa48("2627") ? {} : (stryCov_9fa48("2627"), {
              appName
            })))),
            ...(stryMutAct_9fa48("2630") ? directory || {
              directory
            } : stryMutAct_9fa48("2629") ? false : stryMutAct_9fa48("2628") ? true : (stryCov_9fa48("2628", "2629", "2630"), directory && (stryMutAct_9fa48("2631") ? {} : (stryCov_9fa48("2631"), {
              directory
            }))))
          });

          // Add to cache
          this.recentCache.unshift(historyItem);
          this.duplicateCheckSet.add(trimmedText);
          if (stryMutAct_9fa48("2635") ? this.recentCache.length <= this.cacheSize : stryMutAct_9fa48("2634") ? this.recentCache.length >= this.cacheSize : stryMutAct_9fa48("2633") ? false : stryMutAct_9fa48("2632") ? true : (stryCov_9fa48("2632", "2633", "2634", "2635"), this.recentCache.length > this.cacheSize)) {
            if (stryMutAct_9fa48("2636")) {
              {}
            } else {
              stryCov_9fa48("2636");
              const removed = this.recentCache.pop();
              if (stryMutAct_9fa48("2638") ? false : stryMutAct_9fa48("2637") ? true : (stryCov_9fa48("2637", "2638"), removed)) {
                if (stryMutAct_9fa48("2639")) {
                  {}
                } else {
                  stryCov_9fa48("2639");
                  this.duplicateCheckSet.delete(removed.text);
                }
              }
            }
          }

          // Add to append queue
          this.appendQueue.push(historyItem);
          this.debouncedAppend();
          if (stryMutAct_9fa48("2641") ? false : stryMutAct_9fa48("2640") ? true : (stryCov_9fa48("2640", "2641"), this.totalItemCountCached)) {
            if (stryMutAct_9fa48("2642")) {
              {}
            } else {
              stryCov_9fa48("2642");
              stryMutAct_9fa48("2643") ? this.totalItemCount-- : (stryCov_9fa48("2643"), this.totalItemCount++);
            }
          }
          logger.debug(stryMutAct_9fa48("2644") ? "" : (stryCov_9fa48("2644"), 'Added item to history:'), stryMutAct_9fa48("2645") ? {} : (stryCov_9fa48("2645"), {
            id: historyItem.id,
            length: trimmedText.length,
            appName: stryMutAct_9fa48("2648") ? appName && 'unknown' : stryMutAct_9fa48("2647") ? false : stryMutAct_9fa48("2646") ? true : (stryCov_9fa48("2646", "2647", "2648"), appName || (stryMutAct_9fa48("2649") ? "" : (stryCov_9fa48("2649"), 'unknown'))),
            directory: stryMutAct_9fa48("2652") ? directory && 'unknown' : stryMutAct_9fa48("2651") ? false : stryMutAct_9fa48("2650") ? true : (stryCov_9fa48("2650", "2651", "2652"), directory || (stryMutAct_9fa48("2653") ? "" : (stryCov_9fa48("2653"), 'unknown'))),
            cacheSize: this.recentCache.length,
            totalItems: this.totalItemCountCached ? this.totalItemCount : stryMutAct_9fa48("2654") ? "" : (stryCov_9fa48("2654"), 'not calculated')
          }));
          return historyItem;
        }
      } catch (error) {
        if (stryMutAct_9fa48("2655")) {
          {}
        } else {
          stryCov_9fa48("2655");
          logger.error(stryMutAct_9fa48("2656") ? "" : (stryCov_9fa48("2656"), 'Failed to add item to history:'), error);
          throw error;
        }
      }
    }
  }
  private async flushAppendQueue(): Promise<void> {
    if (stryMutAct_9fa48("2657")) {
      {}
    } else {
      stryCov_9fa48("2657");
      if (stryMutAct_9fa48("2660") ? this.appendQueue.length !== 0 : stryMutAct_9fa48("2659") ? false : stryMutAct_9fa48("2658") ? true : (stryCov_9fa48("2658", "2659", "2660"), this.appendQueue.length === 0)) return;
      const itemsToAppend = stryMutAct_9fa48("2661") ? [] : (stryCov_9fa48("2661"), [...this.appendQueue]);
      this.appendQueue = stryMutAct_9fa48("2662") ? ["Stryker was here"] : (stryCov_9fa48("2662"), []);
      try {
        if (stryMutAct_9fa48("2663")) {
          {}
        } else {
          stryCov_9fa48("2663");
          const lines = itemsToAppend.map(stryMutAct_9fa48("2664") ? () => undefined : (stryCov_9fa48("2664"), item => JSON.stringify(item))).join(stryMutAct_9fa48("2665") ? "" : (stryCov_9fa48("2665"), '\n')) + (stryMutAct_9fa48("2666") ? "" : (stryCov_9fa48("2666"), '\n'));
          await fs.appendFile(this.historyFile, lines);
          logger.debug(stryMutAct_9fa48("2667") ? `` : (stryCov_9fa48("2667"), `Appended ${itemsToAppend.length} items to history file`));
        }
      } catch (error) {
        if (stryMutAct_9fa48("2668")) {
          {}
        } else {
          stryCov_9fa48("2668");
          logger.error(stryMutAct_9fa48("2669") ? "" : (stryCov_9fa48("2669"), 'Failed to append to history file:'), error);
          // 失敗したアイテムをキューに戻す
          this.appendQueue.unshift(...itemsToAppend);
          throw error;
        }
      }
    }
  }
  getHistory(limit?: number): HistoryItem[] {
    if (stryMutAct_9fa48("2670")) {
      {}
    } else {
      stryCov_9fa48("2670");
      // キャッシュから返す（起動速度優先）
      if (stryMutAct_9fa48("2673") ? false : stryMutAct_9fa48("2672") ? true : stryMutAct_9fa48("2671") ? limit : (stryCov_9fa48("2671", "2672", "2673"), !limit)) {
        if (stryMutAct_9fa48("2674")) {
          {}
        } else {
          stryCov_9fa48("2674");
          return stryMutAct_9fa48("2675") ? [] : (stryCov_9fa48("2675"), [...this.recentCache]);
        }
      }
      const requestedLimit = stryMutAct_9fa48("2676") ? Math.max(limit, this.cacheSize) : (stryCov_9fa48("2676"), Math.min(limit, this.cacheSize));
      return stryMutAct_9fa48("2677") ? this.recentCache : (stryCov_9fa48("2677"), this.recentCache.slice(0, requestedLimit));
    }
  }
  getHistoryItem(id: string): HistoryItem | null {
    if (stryMutAct_9fa48("2678")) {
      {}
    } else {
      stryCov_9fa48("2678");
      // まずキャッシュから探す
      const cachedItem = this.recentCache.find(stryMutAct_9fa48("2679") ? () => undefined : (stryCov_9fa48("2679"), item => stryMutAct_9fa48("2682") ? item.id !== id : stryMutAct_9fa48("2681") ? false : stryMutAct_9fa48("2680") ? true : (stryCov_9fa48("2680", "2681", "2682"), item.id === id)));
      if (stryMutAct_9fa48("2684") ? false : stryMutAct_9fa48("2683") ? true : (stryCov_9fa48("2683", "2684"), cachedItem)) return cachedItem;

      // キャッシュになければnull（フルスキャンは避ける）
      return null;
    }
  }
  getRecentHistory(limit = 10): HistoryItem[] {
    if (stryMutAct_9fa48("2685")) {
      {}
    } else {
      stryCov_9fa48("2685");
      return stryMutAct_9fa48("2686") ? this.recentCache : (stryCov_9fa48("2686"), this.recentCache.slice(0, stryMutAct_9fa48("2687") ? Math.max(limit, this.recentCache.length) : (stryCov_9fa48("2687"), Math.min(limit, this.recentCache.length))));
    }
  }

  /**
   * Get history items for search purposes
   * Reads directly from file to support larger limits than cache
   * @param limit Maximum number of items to return (e.g., 5000 for search)
   */
  async getHistoryForSearch(limit: number): Promise<HistoryItem[]> {
    if (stryMutAct_9fa48("2688")) {
      {}
    } else {
      stryCov_9fa48("2688");
      try {
        if (stryMutAct_9fa48("2689")) {
          {}
        } else {
          stryCov_9fa48("2689");
          // If requested limit is within cache, return from cache (faster)
          if (stryMutAct_9fa48("2693") ? limit > this.recentCache.length : stryMutAct_9fa48("2692") ? limit < this.recentCache.length : stryMutAct_9fa48("2691") ? false : stryMutAct_9fa48("2690") ? true : (stryCov_9fa48("2690", "2691", "2692", "2693"), limit <= this.recentCache.length)) {
            if (stryMutAct_9fa48("2694")) {
              {}
            } else {
              stryCov_9fa48("2694");
              return stryMutAct_9fa48("2695") ? [] : (stryCov_9fa48("2695"), [...(stryMutAct_9fa48("2696") ? this.recentCache : (stryCov_9fa48("2696"), this.recentCache.slice(0, limit)))]);
            }
          }

          // Read from file for larger limits
          const lines = await this.readLastNLines(limit);
          const items: HistoryItem[] = stryMutAct_9fa48("2697") ? ["Stryker was here"] : (stryCov_9fa48("2697"), []);
          for (const line of lines) {
            if (stryMutAct_9fa48("2698")) {
              {}
            } else {
              stryCov_9fa48("2698");
              const item = safeJsonParse<HistoryItem>(line);
              if (stryMutAct_9fa48("2701") ? item || this.validateHistoryItem(item) : stryMutAct_9fa48("2700") ? false : stryMutAct_9fa48("2699") ? true : (stryCov_9fa48("2699", "2700", "2701"), item && this.validateHistoryItem(item))) {
                if (stryMutAct_9fa48("2702")) {
                  {}
                } else {
                  stryCov_9fa48("2702");
                  items.unshift(item); // Newest first
                }
              }
            }
          }
          logger.debug(stryMutAct_9fa48("2703") ? `` : (stryCov_9fa48("2703"), `getHistoryForSearch: loaded ${items.length} items for search (limit: ${limit})`));
          return items;
        }
      } catch (error) {
        if (stryMutAct_9fa48("2704")) {
          {}
        } else {
          stryCov_9fa48("2704");
          logger.error(stryMutAct_9fa48("2705") ? "" : (stryCov_9fa48("2705"), 'Error in getHistoryForSearch:'), error);
          // Fallback to cache
          return stryMutAct_9fa48("2706") ? [] : (stryCov_9fa48("2706"), [...this.recentCache]);
        }
      }
    }
  }
  searchHistory(query: string, limit = 10): HistoryItem[] {
    if (stryMutAct_9fa48("2707")) {
      {}
    } else {
      stryCov_9fa48("2707");
      if (stryMutAct_9fa48("2710") ? !query && !query.trim() : stryMutAct_9fa48("2709") ? false : stryMutAct_9fa48("2708") ? true : (stryCov_9fa48("2708", "2709", "2710"), (stryMutAct_9fa48("2711") ? query : (stryCov_9fa48("2711"), !query)) || (stryMutAct_9fa48("2712") ? query.trim() : (stryCov_9fa48("2712"), !(stryMutAct_9fa48("2713") ? query : (stryCov_9fa48("2713"), query.trim())))))) {
        if (stryMutAct_9fa48("2714")) {
          {}
        } else {
          stryCov_9fa48("2714");
          return stryMutAct_9fa48("2715") ? ["Stryker was here"] : (stryCov_9fa48("2715"), []);
        }
      }
      const searchTerm = stryMutAct_9fa48("2717") ? query.toUpperCase().trim() : stryMutAct_9fa48("2716") ? query.toLowerCase() : (stryCov_9fa48("2716", "2717"), query.toLowerCase().trim());
      const results = stryMutAct_9fa48("2718") ? this.recentCache : (stryCov_9fa48("2718"), this.recentCache.filter(stryMutAct_9fa48("2719") ? () => undefined : (stryCov_9fa48("2719"), item => stryMutAct_9fa48("2720") ? item.text.toUpperCase().includes(searchTerm) : (stryCov_9fa48("2720"), item.text.toLowerCase().includes(searchTerm)))));
      return stryMutAct_9fa48("2721") ? results : (stryCov_9fa48("2721"), results.slice(0, limit));
    }
  }
  async removeHistoryItem(id: string): Promise<boolean> {
    if (stryMutAct_9fa48("2722")) {
      {}
    } else {
      stryCov_9fa48("2722");
      try {
        if (stryMutAct_9fa48("2723")) {
          {}
        } else {
          stryCov_9fa48("2723");
          // キャッシュから削除
          const initialLength = this.recentCache.length;
          const removedItem = this.recentCache.find(stryMutAct_9fa48("2724") ? () => undefined : (stryCov_9fa48("2724"), item => stryMutAct_9fa48("2727") ? item.id !== id : stryMutAct_9fa48("2726") ? false : stryMutAct_9fa48("2725") ? true : (stryCov_9fa48("2725", "2726", "2727"), item.id === id)));
          this.recentCache = stryMutAct_9fa48("2728") ? this.recentCache : (stryCov_9fa48("2728"), this.recentCache.filter(stryMutAct_9fa48("2729") ? () => undefined : (stryCov_9fa48("2729"), item => stryMutAct_9fa48("2732") ? item.id === id : stryMutAct_9fa48("2731") ? false : stryMutAct_9fa48("2730") ? true : (stryCov_9fa48("2730", "2731", "2732"), item.id !== id))));
          if (stryMutAct_9fa48("2735") ? this.recentCache.length < initialLength || removedItem : stryMutAct_9fa48("2734") ? false : stryMutAct_9fa48("2733") ? true : (stryCov_9fa48("2733", "2734", "2735"), (stryMutAct_9fa48("2738") ? this.recentCache.length >= initialLength : stryMutAct_9fa48("2737") ? this.recentCache.length <= initialLength : stryMutAct_9fa48("2736") ? true : (stryCov_9fa48("2736", "2737", "2738"), this.recentCache.length < initialLength)) && removedItem)) {
            if (stryMutAct_9fa48("2739")) {
              {}
            } else {
              stryCov_9fa48("2739");
              // duplicateCheckSetからも削除
              this.duplicateCheckSet.delete(removedItem.text);

              // ファイルは永続保護するため、メモリキャッシュのみ削除
              // totalItemCountはファイルがそのままなので変更しない
              logger.debug(stryMutAct_9fa48("2740") ? "" : (stryCov_9fa48("2740"), 'Removed history item from cache (file preserved):'), id);
              return stryMutAct_9fa48("2741") ? false : (stryCov_9fa48("2741"), true);
            }
          }
          logger.debug(stryMutAct_9fa48("2742") ? "" : (stryCov_9fa48("2742"), 'History item not found for removal:'), id);
          return stryMutAct_9fa48("2743") ? true : (stryCov_9fa48("2743"), false);
        }
      } catch (error) {
        if (stryMutAct_9fa48("2744")) {
          {}
        } else {
          stryCov_9fa48("2744");
          logger.error(stryMutAct_9fa48("2745") ? "" : (stryCov_9fa48("2745"), 'Failed to remove history item:'), error);
          throw error;
        }
      }
    }
  }
  async clearHistory(): Promise<void> {
    if (stryMutAct_9fa48("2746")) {
      {}
    } else {
      stryCov_9fa48("2746");
      try {
        if (stryMutAct_9fa48("2747")) {
          {}
        } else {
          stryCov_9fa48("2747");
          await this.flushAppendQueue();
          this.recentCache = stryMutAct_9fa48("2748") ? ["Stryker was here"] : (stryCov_9fa48("2748"), []);
          this.duplicateCheckSet.clear();
          this.appendQueue = stryMutAct_9fa48("2749") ? ["Stryker was here"] : (stryCov_9fa48("2749"), []);

          // ファイルは永続保護するため、メモリキャッシュのみクリア
          // totalItemCountはファイルがそのままなので変更しない
          logger.info(stryMutAct_9fa48("2750") ? "" : (stryCov_9fa48("2750"), 'History cache cleared (file preserved)'));
        }
      } catch (error) {
        if (stryMutAct_9fa48("2751")) {
          {}
        } else {
          stryCov_9fa48("2751");
          logger.error(stryMutAct_9fa48("2752") ? "" : (stryCov_9fa48("2752"), 'Failed to clear history cache:'), error);
          throw error;
        }
      }
    }
  }
  async flushPendingSaves(): Promise<void> {
    if (stryMutAct_9fa48("2753")) {
      {}
    } else {
      stryCov_9fa48("2753");
      await this.flushAppendQueue();
    }
  }
  async destroy(): Promise<void> {
    if (stryMutAct_9fa48("2754")) {
      {}
    } else {
      stryCov_9fa48("2754");
      try {
        if (stryMutAct_9fa48("2755")) {
          {}
        } else {
          stryCov_9fa48("2755");
          await this.flushPendingSaves();
          logger.debug(stryMutAct_9fa48("2756") ? "" : (stryCov_9fa48("2756"), 'History manager cleanup completed'));
        }
      } catch (error) {
        if (stryMutAct_9fa48("2757")) {
          {}
        } else {
          stryCov_9fa48("2757");
          logger.error(stryMutAct_9fa48("2758") ? "" : (stryCov_9fa48("2758"), 'Error during history manager cleanup:'), error);
        }
      }
    }
  }
  getHistoryStats(): HistoryStats {
    if (stryMutAct_9fa48("2759")) {
      {}
    } else {
      stryCov_9fa48("2759");
      // 必要に応じて遅延カウントを実行（非同期）
      if (stryMutAct_9fa48("2762") ? false : stryMutAct_9fa48("2761") ? true : stryMutAct_9fa48("2760") ? this.totalItemCountCached : (stryCov_9fa48("2760", "2761", "2762"), !this.totalItemCountCached)) {
        if (stryMutAct_9fa48("2763")) {
          {}
        } else {
          stryCov_9fa48("2763");
          this.countTotalItemsAsync().catch((error: Error) => {
            if (stryMutAct_9fa48("2764")) {
              {}
            } else {
              stryCov_9fa48("2764");
              logger.warn(stryMutAct_9fa48("2765") ? "" : (stryCov_9fa48("2765"), 'Lazy total count failed:'), error);
            }
          });
        }
      }
      const totalItems = this.totalItemCountCached ? this.totalItemCount : this.recentCache.length;
      const cachedItems = this.recentCache;
      const totalCharacters = cachedItems.reduce(stryMutAct_9fa48("2766") ? () => undefined : (stryCov_9fa48("2766"), (sum, item) => stryMutAct_9fa48("2767") ? sum - item.text.length : (stryCov_9fa48("2767"), sum + item.text.length)), 0);
      const oldestTimestamp = (stryMutAct_9fa48("2771") ? cachedItems.length <= 0 : stryMutAct_9fa48("2770") ? cachedItems.length >= 0 : stryMutAct_9fa48("2769") ? false : stryMutAct_9fa48("2768") ? true : (stryCov_9fa48("2768", "2769", "2770", "2771"), cachedItems.length > 0)) ? stryMutAct_9fa48("2772") ? Math.max(...cachedItems.map(item => item.timestamp)) : (stryCov_9fa48("2772"), Math.min(...cachedItems.map(stryMutAct_9fa48("2773") ? () => undefined : (stryCov_9fa48("2773"), item => item.timestamp)))) : null;
      const newestTimestamp = (stryMutAct_9fa48("2777") ? cachedItems.length <= 0 : stryMutAct_9fa48("2776") ? cachedItems.length >= 0 : stryMutAct_9fa48("2775") ? false : stryMutAct_9fa48("2774") ? true : (stryCov_9fa48("2774", "2775", "2776", "2777"), cachedItems.length > 0)) ? stryMutAct_9fa48("2778") ? Math.min(...cachedItems.map(item => item.timestamp)) : (stryCov_9fa48("2778"), Math.max(...cachedItems.map(stryMutAct_9fa48("2779") ? () => undefined : (stryCov_9fa48("2779"), item => item.timestamp)))) : null;
      return stryMutAct_9fa48("2780") ? {} : (stryCov_9fa48("2780"), {
        totalItems,
        totalCharacters,
        averageLength: (stryMutAct_9fa48("2784") ? cachedItems.length <= 0 : stryMutAct_9fa48("2783") ? cachedItems.length >= 0 : stryMutAct_9fa48("2782") ? false : stryMutAct_9fa48("2781") ? true : (stryCov_9fa48("2781", "2782", "2783", "2784"), cachedItems.length > 0)) ? Math.round(stryMutAct_9fa48("2785") ? totalCharacters * cachedItems.length : (stryCov_9fa48("2785"), totalCharacters / cachedItems.length)) : 0,
        oldestTimestamp,
        newestTimestamp
      });
    }
  }
  private validateHistoryItem(item: unknown): item is HistoryItem {
    if (stryMutAct_9fa48("2786")) {
      {}
    } else {
      stryCov_9fa48("2786");
      return stryMutAct_9fa48("2789") ? typeof item === 'object' && item !== null && 'text' in item && 'timestamp' in item && 'id' in item && typeof (item as HistoryItem).text === 'string' && typeof (item as HistoryItem).timestamp === 'number' && typeof (item as HistoryItem).id === 'string' || (item as HistoryItem).text.length > 0 : stryMutAct_9fa48("2788") ? false : stryMutAct_9fa48("2787") ? true : (stryCov_9fa48("2787", "2788", "2789"), (stryMutAct_9fa48("2791") ? typeof item === 'object' && item !== null && 'text' in item && 'timestamp' in item && 'id' in item && typeof (item as HistoryItem).text === 'string' && typeof (item as HistoryItem).timestamp === 'number' || typeof (item as HistoryItem).id === 'string' : stryMutAct_9fa48("2790") ? true : (stryCov_9fa48("2790", "2791"), (stryMutAct_9fa48("2793") ? typeof item === 'object' && item !== null && 'text' in item && 'timestamp' in item && 'id' in item && typeof (item as HistoryItem).text === 'string' || typeof (item as HistoryItem).timestamp === 'number' : stryMutAct_9fa48("2792") ? true : (stryCov_9fa48("2792", "2793"), (stryMutAct_9fa48("2795") ? typeof item === 'object' && item !== null && 'text' in item && 'timestamp' in item && 'id' in item || typeof (item as HistoryItem).text === 'string' : stryMutAct_9fa48("2794") ? true : (stryCov_9fa48("2794", "2795"), (stryMutAct_9fa48("2797") ? typeof item === 'object' && item !== null && 'text' in item && 'timestamp' in item || 'id' in item : stryMutAct_9fa48("2796") ? true : (stryCov_9fa48("2796", "2797"), (stryMutAct_9fa48("2799") ? typeof item === 'object' && item !== null && 'text' in item || 'timestamp' in item : stryMutAct_9fa48("2798") ? true : (stryCov_9fa48("2798", "2799"), (stryMutAct_9fa48("2801") ? typeof item === 'object' && item !== null || 'text' in item : stryMutAct_9fa48("2800") ? true : (stryCov_9fa48("2800", "2801"), (stryMutAct_9fa48("2803") ? typeof item === 'object' || item !== null : stryMutAct_9fa48("2802") ? true : (stryCov_9fa48("2802", "2803"), (stryMutAct_9fa48("2805") ? typeof item !== 'object' : stryMutAct_9fa48("2804") ? true : (stryCov_9fa48("2804", "2805"), typeof item === (stryMutAct_9fa48("2806") ? "" : (stryCov_9fa48("2806"), 'object')))) && (stryMutAct_9fa48("2808") ? item === null : stryMutAct_9fa48("2807") ? true : (stryCov_9fa48("2807", "2808"), item !== null)))) && (stryMutAct_9fa48("2809") ? "" : (stryCov_9fa48("2809"), 'text')) in item)) && (stryMutAct_9fa48("2810") ? "" : (stryCov_9fa48("2810"), 'timestamp')) in item)) && (stryMutAct_9fa48("2811") ? "" : (stryCov_9fa48("2811"), 'id')) in item)) && (stryMutAct_9fa48("2813") ? typeof (item as HistoryItem).text !== 'string' : stryMutAct_9fa48("2812") ? true : (stryCov_9fa48("2812", "2813"), typeof (item as HistoryItem).text === (stryMutAct_9fa48("2814") ? "" : (stryCov_9fa48("2814"), 'string')))))) && (stryMutAct_9fa48("2816") ? typeof (item as HistoryItem).timestamp !== 'number' : stryMutAct_9fa48("2815") ? true : (stryCov_9fa48("2815", "2816"), typeof (item as HistoryItem).timestamp === (stryMutAct_9fa48("2817") ? "" : (stryCov_9fa48("2817"), 'number')))))) && (stryMutAct_9fa48("2819") ? typeof (item as HistoryItem).id !== 'string' : stryMutAct_9fa48("2818") ? true : (stryCov_9fa48("2818", "2819"), typeof (item as HistoryItem).id === (stryMutAct_9fa48("2820") ? "" : (stryCov_9fa48("2820"), 'string')))))) && (stryMutAct_9fa48("2823") ? (item as HistoryItem).text.length <= 0 : stryMutAct_9fa48("2822") ? (item as HistoryItem).text.length >= 0 : stryMutAct_9fa48("2821") ? true : (stryCov_9fa48("2821", "2822", "2823"), (item as HistoryItem).text.length > 0)));
    }
  }

  // 既存のHistoryManagerとの互換性のためのメソッド
  updateConfig(_newConfig: Partial<HistoryConfig>): void {
    if (stryMutAct_9fa48("2824")) {
      {}
    } else {
      stryCov_9fa48("2824");
      // 無制限なので特に何もしない
      logger.info(stryMutAct_9fa48("2825") ? "" : (stryCov_9fa48("2825"), 'Config update called on HistoryManager (no-op)'));
    }
  }

  // Export/Import機能（ストリーミング対応）
  async exportHistory(): Promise<ExportData> {
    if (stryMutAct_9fa48("2826")) {
      {}
    } else {
      stryCov_9fa48("2826");
      const allItems: HistoryItem[] = stryMutAct_9fa48("2827") ? ["Stryker was here"] : (stryCov_9fa48("2827"), []);
      const stream = createReadStream(this.historyFile);
      const rl = createInterface(stryMutAct_9fa48("2828") ? {} : (stryCov_9fa48("2828"), {
        input: stream,
        crlfDelay: Infinity
      }));
      for await (const line of rl) {
        if (stryMutAct_9fa48("2829")) {
          {}
        } else {
          stryCov_9fa48("2829");
          const item = safeJsonParse<HistoryItem>(line);
          if (stryMutAct_9fa48("2832") ? item || this.validateHistoryItem(item) : stryMutAct_9fa48("2831") ? false : stryMutAct_9fa48("2830") ? true : (stryCov_9fa48("2830", "2831", "2832"), item && this.validateHistoryItem(item))) {
            if (stryMutAct_9fa48("2833")) {
              {}
            } else {
              stryCov_9fa48("2833");
              allItems.push(item);
            }
          }
        }
      }
      stryMutAct_9fa48("2834") ? allItems : (stryCov_9fa48("2834"), allItems.sort(stryMutAct_9fa48("2835") ? () => undefined : (stryCov_9fa48("2835"), (a, b) => stryMutAct_9fa48("2836") ? b.timestamp + a.timestamp : (stryCov_9fa48("2836"), b.timestamp - a.timestamp))));
      return stryMutAct_9fa48("2837") ? {} : (stryCov_9fa48("2837"), {
        version: stryMutAct_9fa48("2838") ? "" : (stryCov_9fa48("2838"), '1.0'),
        exportDate: new Date().toISOString(),
        history: allItems,
        stats: this.getHistoryStats()
      });
    }
  }
  async importHistory(exportData: ExportData, merge = stryMutAct_9fa48("2839") ? true : (stryCov_9fa48("2839"), false)): Promise<void> {
    if (stryMutAct_9fa48("2840")) {
      {}
    } else {
      stryCov_9fa48("2840");
      try {
        if (stryMutAct_9fa48("2841")) {
          {}
        } else {
          stryCov_9fa48("2841");
          if (stryMutAct_9fa48("2844") ? (!exportData || !exportData.history) && !Array.isArray(exportData.history) : stryMutAct_9fa48("2843") ? false : stryMutAct_9fa48("2842") ? true : (stryCov_9fa48("2842", "2843", "2844"), (stryMutAct_9fa48("2846") ? !exportData && !exportData.history : stryMutAct_9fa48("2845") ? false : (stryCov_9fa48("2845", "2846"), (stryMutAct_9fa48("2847") ? exportData : (stryCov_9fa48("2847"), !exportData)) || (stryMutAct_9fa48("2848") ? exportData.history : (stryCov_9fa48("2848"), !exportData.history)))) || (stryMutAct_9fa48("2849") ? Array.isArray(exportData.history) : (stryCov_9fa48("2849"), !Array.isArray(exportData.history))))) {
            if (stryMutAct_9fa48("2850")) {
              {}
            } else {
              stryCov_9fa48("2850");
              throw new Error(stryMutAct_9fa48("2851") ? "" : (stryCov_9fa48("2851"), 'Invalid export data format'));
            }
          }
          if (stryMutAct_9fa48("2854") ? false : stryMutAct_9fa48("2853") ? true : stryMutAct_9fa48("2852") ? merge : (stryCov_9fa48("2852", "2853", "2854"), !merge)) {
            if (stryMutAct_9fa48("2855")) {
              {}
            } else {
              stryCov_9fa48("2855");
              await this.clearHistory();
            }
          }

          // バッチで追記
          const lines = (stryMutAct_9fa48("2856") ? exportData.history.map(item => JSON.stringify(item)).join('\n') : (stryCov_9fa48("2856"), exportData.history.filter(stryMutAct_9fa48("2857") ? () => undefined : (stryCov_9fa48("2857"), item => this.validateHistoryItem(item))).map(stryMutAct_9fa48("2858") ? () => undefined : (stryCov_9fa48("2858"), item => JSON.stringify(item))).join(stryMutAct_9fa48("2859") ? "" : (stryCov_9fa48("2859"), '\n')))) + (stryMutAct_9fa48("2860") ? "" : (stryCov_9fa48("2860"), '\n'));
          await fs.appendFile(this.historyFile, lines);

          // キャッシュをリロード
          await this.loadRecentHistory();
          await this.countTotalItems();
          logger.info(stryMutAct_9fa48("2861") ? `` : (stryCov_9fa48("2861"), `History imported: ${exportData.history.length} items, merge: ${merge}`));
        }
      } catch (error) {
        if (stryMutAct_9fa48("2862")) {
          {}
        } else {
          stryCov_9fa48("2862");
          logger.error(stryMutAct_9fa48("2863") ? "" : (stryCov_9fa48("2863"), 'Failed to import history:'), error);
          throw error;
        }
      }
    }
  }
}
export default HistoryManager;