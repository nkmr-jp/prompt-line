/**
 * Code Search IPC Handler
 * Handles IPC requests for symbol search functionality
 */
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
import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { logger } from '../utils/utils';
import { checkRgAvailable, getSupportedLanguages, searchSymbols, DEFAULT_MAX_SYMBOLS, DEFAULT_SEARCH_TIMEOUT } from '../managers/symbol-search';
import { symbolCacheManager } from '../managers/symbol-cache-manager';
import type SettingsManager from '../managers/settings-manager';
import type { SymbolSearchResponse, RgCheckResponse, LanguagesResponse } from '../managers/symbol-search/types';

/**
 * Code Search Handler class
 * Manages IPC handlers for code/symbol search operations
 */
class CodeSearchHandler {
  private initialized = stryMutAct_9fa48("104") ? true : (stryCov_9fa48("104"), false);
  // Track pending background refreshes to avoid duplicates
  private pendingRefreshes = new Map<string, boolean>();
  private settingsManager: SettingsManager | null = null;

  /**
   * Set settings manager for symbol search configuration
   */
  setSettingsManager(settingsManager: SettingsManager): void {
    if (stryMutAct_9fa48("105")) {
      {}
    } else {
      stryCov_9fa48("105");
      this.settingsManager = settingsManager;
      logger.debug(stryMutAct_9fa48("106") ? "" : (stryCov_9fa48("106"), 'CodeSearchHandler: SettingsManager configured'));
    }
  }

  /**
   * Get symbol search settings with defaults
   */
  private getSymbolSearchOptions(): {
    maxSymbols: number;
    timeout: number;
  } {
    if (stryMutAct_9fa48("107")) {
      {}
    } else {
      stryCov_9fa48("107");
      const symbolSearchSettings = stryMutAct_9fa48("108") ? this.settingsManager.getSymbolSearchSettings() : (stryCov_9fa48("108"), this.settingsManager?.getSymbolSearchSettings());
      const result = stryMutAct_9fa48("109") ? {} : (stryCov_9fa48("109"), {
        maxSymbols: stryMutAct_9fa48("110") ? symbolSearchSettings?.maxSymbols && DEFAULT_MAX_SYMBOLS : (stryCov_9fa48("110"), (stryMutAct_9fa48("111") ? symbolSearchSettings.maxSymbols : (stryCov_9fa48("111"), symbolSearchSettings?.maxSymbols)) ?? DEFAULT_MAX_SYMBOLS),
        timeout: stryMutAct_9fa48("112") ? symbolSearchSettings?.timeout && DEFAULT_SEARCH_TIMEOUT : (stryCov_9fa48("112"), (stryMutAct_9fa48("113") ? symbolSearchSettings.timeout : (stryCov_9fa48("113"), symbolSearchSettings?.timeout)) ?? DEFAULT_SEARCH_TIMEOUT)
      });
      logger.debug(stryMutAct_9fa48("114") ? "" : (stryCov_9fa48("114"), 'getSymbolSearchOptions:'), stryMutAct_9fa48("115") ? {} : (stryCov_9fa48("115"), {
        hasSettingsManager: stryMutAct_9fa48("116") ? !this.settingsManager : (stryCov_9fa48("116"), !(stryMutAct_9fa48("117") ? this.settingsManager : (stryCov_9fa48("117"), !this.settingsManager))),
        symbolSearchSettings,
        effectiveOptions: result
      }));
      return result;
    }
  }

  /**
   * Register all IPC handlers
   */
  register(): void {
    if (stryMutAct_9fa48("118")) {
      {}
    } else {
      stryCov_9fa48("118");
      if (stryMutAct_9fa48("120") ? false : stryMutAct_9fa48("119") ? true : (stryCov_9fa48("119", "120"), this.initialized)) {
        if (stryMutAct_9fa48("121")) {
          {}
        } else {
          stryCov_9fa48("121");
          logger.warn(stryMutAct_9fa48("122") ? "" : (stryCov_9fa48("122"), 'CodeSearchHandler already initialized'));
          return;
        }
      }

      // Check if ripgrep is available
      ipcMain.handle(stryMutAct_9fa48("123") ? "" : (stryCov_9fa48("123"), 'check-rg'), this.handleCheckRg.bind(this));

      // Get supported programming languages
      ipcMain.handle(stryMutAct_9fa48("124") ? "" : (stryCov_9fa48("124"), 'get-supported-languages'), this.handleGetSupportedLanguages.bind(this));

      // Search for symbols in a directory
      ipcMain.handle(stryMutAct_9fa48("125") ? "" : (stryCov_9fa48("125"), 'search-symbols'), this.handleSearchSymbols.bind(this));

      // Get cached symbols
      ipcMain.handle(stryMutAct_9fa48("126") ? "" : (stryCov_9fa48("126"), 'get-cached-symbols'), this.handleGetCachedSymbols.bind(this));

      // Clear symbol cache
      ipcMain.handle(stryMutAct_9fa48("127") ? "" : (stryCov_9fa48("127"), 'clear-symbol-cache'), this.handleClearSymbolCache.bind(this));
      this.initialized = stryMutAct_9fa48("128") ? false : (stryCov_9fa48("128"), true);
      logger.debug(stryMutAct_9fa48("129") ? "" : (stryCov_9fa48("129"), 'CodeSearchHandler registered'));
    }
  }

  /**
   * Handle check-rg request
   */
  private async handleCheckRg(): Promise<RgCheckResponse> {
    if (stryMutAct_9fa48("130")) {
      {}
    } else {
      stryCov_9fa48("130");
      logger.debug(stryMutAct_9fa48("131") ? "" : (stryCov_9fa48("131"), 'Handling check-rg request'));
      return checkRgAvailable();
    }
  }

  /**
   * Handle get-supported-languages request
   */
  private async handleGetSupportedLanguages(): Promise<LanguagesResponse> {
    if (stryMutAct_9fa48("132")) {
      {}
    } else {
      stryCov_9fa48("132");
      logger.debug(stryMutAct_9fa48("133") ? "" : (stryCov_9fa48("133"), 'Handling get-supported-languages request'));
      return getSupportedLanguages();
    }
  }

  /**
   * Handle search-symbols request
   */
  private async handleSearchSymbols(_event: IpcMainInvokeEvent, directory: string, language: string, options?: {
    maxSymbols?: number;
    useCache?: boolean;
    refreshCache?: boolean;
  }): Promise<SymbolSearchResponse> {
    if (stryMutAct_9fa48("134")) {
      {}
    } else {
      stryCov_9fa48("134");
      logger.debug(stryMutAct_9fa48("135") ? "" : (stryCov_9fa48("135"), 'Handling search-symbols request'), stryMutAct_9fa48("136") ? {} : (stryCov_9fa48("136"), {
        directory,
        language,
        options
      }));

      // Get settings-based defaults
      const settingsOptions = this.getSymbolSearchOptions();
      const effectiveMaxSymbols = stryMutAct_9fa48("137") ? options?.maxSymbols && settingsOptions.maxSymbols : (stryCov_9fa48("137"), (stryMutAct_9fa48("138") ? options.maxSymbols : (stryCov_9fa48("138"), options?.maxSymbols)) ?? settingsOptions.maxSymbols);

      // Validate inputs
      if (stryMutAct_9fa48("141") ? !directory && typeof directory !== 'string' : stryMutAct_9fa48("140") ? false : stryMutAct_9fa48("139") ? true : (stryCov_9fa48("139", "140", "141"), (stryMutAct_9fa48("142") ? directory : (stryCov_9fa48("142"), !directory)) || (stryMutAct_9fa48("144") ? typeof directory === 'string' : stryMutAct_9fa48("143") ? false : (stryCov_9fa48("143", "144"), typeof directory !== (stryMutAct_9fa48("145") ? "" : (stryCov_9fa48("145"), 'string')))))) {
        if (stryMutAct_9fa48("146")) {
          {}
        } else {
          stryCov_9fa48("146");
          return stryMutAct_9fa48("147") ? {} : (stryCov_9fa48("147"), {
            success: stryMutAct_9fa48("148") ? true : (stryCov_9fa48("148"), false),
            symbols: stryMutAct_9fa48("149") ? ["Stryker was here"] : (stryCov_9fa48("149"), []),
            symbolCount: 0,
            searchMode: stryMutAct_9fa48("150") ? "" : (stryCov_9fa48("150"), 'full'),
            partial: stryMutAct_9fa48("151") ? true : (stryCov_9fa48("151"), false),
            maxSymbols: effectiveMaxSymbols,
            error: stryMutAct_9fa48("152") ? "" : (stryCov_9fa48("152"), 'Invalid directory')
          });
        }
      }
      if (stryMutAct_9fa48("155") ? !language && typeof language !== 'string' : stryMutAct_9fa48("154") ? false : stryMutAct_9fa48("153") ? true : (stryCov_9fa48("153", "154", "155"), (stryMutAct_9fa48("156") ? language : (stryCov_9fa48("156"), !language)) || (stryMutAct_9fa48("158") ? typeof language === 'string' : stryMutAct_9fa48("157") ? false : (stryCov_9fa48("157", "158"), typeof language !== (stryMutAct_9fa48("159") ? "" : (stryCov_9fa48("159"), 'string')))))) {
        if (stryMutAct_9fa48("160")) {
          {}
        } else {
          stryCov_9fa48("160");
          return stryMutAct_9fa48("161") ? {} : (stryCov_9fa48("161"), {
            success: stryMutAct_9fa48("162") ? true : (stryCov_9fa48("162"), false),
            symbols: stryMutAct_9fa48("163") ? ["Stryker was here"] : (stryCov_9fa48("163"), []),
            symbolCount: 0,
            searchMode: stryMutAct_9fa48("164") ? "" : (stryCov_9fa48("164"), 'full'),
            partial: stryMutAct_9fa48("165") ? true : (stryCov_9fa48("165"), false),
            maxSymbols: effectiveMaxSymbols,
            error: stryMutAct_9fa48("166") ? "" : (stryCov_9fa48("166"), 'Invalid language')
          });
        }
      }

      // Check cache first if requested
      if (stryMutAct_9fa48("169") ? options?.useCache === false : stryMutAct_9fa48("168") ? false : stryMutAct_9fa48("167") ? true : (stryCov_9fa48("167", "168", "169"), (stryMutAct_9fa48("170") ? options.useCache : (stryCov_9fa48("170"), options?.useCache)) !== (stryMutAct_9fa48("171") ? true : (stryCov_9fa48("171"), false)))) {
        if (stryMutAct_9fa48("172")) {
          {}
        } else {
          stryCov_9fa48("172");
          const hasLanguage = await symbolCacheManager.hasLanguageCache(directory, language);
          if (stryMutAct_9fa48("174") ? false : stryMutAct_9fa48("173") ? true : (stryCov_9fa48("173", "174"), hasLanguage)) {
            if (stryMutAct_9fa48("175")) {
              {}
            } else {
              stryCov_9fa48("175");
              const cachedSymbols = await symbolCacheManager.loadSymbols(directory, language);
              if (stryMutAct_9fa48("179") ? cachedSymbols.length <= 0 : stryMutAct_9fa48("178") ? cachedSymbols.length >= 0 : stryMutAct_9fa48("177") ? false : stryMutAct_9fa48("176") ? true : (stryCov_9fa48("176", "177", "178", "179"), cachedSymbols.length > 0)) {
                if (stryMutAct_9fa48("180")) {
                  {}
                } else {
                  stryCov_9fa48("180");
                  // Apply maxSymbols limit to cached results
                  const limitedSymbols = stryMutAct_9fa48("181") ? cachedSymbols : (stryCov_9fa48("181"), cachedSymbols.slice(0, effectiveMaxSymbols));
                  const wasLimited = stryMutAct_9fa48("185") ? cachedSymbols.length <= effectiveMaxSymbols : stryMutAct_9fa48("184") ? cachedSymbols.length >= effectiveMaxSymbols : stryMutAct_9fa48("183") ? false : stryMutAct_9fa48("182") ? true : (stryCov_9fa48("182", "183", "184", "185"), cachedSymbols.length > effectiveMaxSymbols);
                  logger.debug(stryMutAct_9fa48("186") ? "" : (stryCov_9fa48("186"), 'Returning cached symbols (stale-while-revalidate)'), stryMutAct_9fa48("187") ? {} : (stryCov_9fa48("187"), {
                    cachedCount: cachedSymbols.length,
                    returnedCount: limitedSymbols.length,
                    maxSymbols: effectiveMaxSymbols,
                    wasLimited
                  }));

                  // Background refresh: only update cache when refreshCache is explicitly true
                  // This prevents unnecessary refreshes during file navigation (e.g., @go vs @go:)
                  if (stryMutAct_9fa48("190") ? options?.refreshCache !== true : stryMutAct_9fa48("189") ? false : stryMutAct_9fa48("188") ? true : (stryCov_9fa48("188", "189", "190"), (stryMutAct_9fa48("191") ? options.refreshCache : (stryCov_9fa48("191"), options?.refreshCache)) === (stryMutAct_9fa48("192") ? false : (stryCov_9fa48("192"), true)))) {
                    if (stryMutAct_9fa48("193")) {
                      {}
                    } else {
                      stryCov_9fa48("193");
                      this.refreshCacheInBackground(directory, language, stryMutAct_9fa48("194") ? {} : (stryCov_9fa48("194"), {
                        maxSymbols: effectiveMaxSymbols,
                        timeout: settingsOptions.timeout
                      }));
                    }
                  }
                  return stryMutAct_9fa48("195") ? {} : (stryCov_9fa48("195"), {
                    success: stryMutAct_9fa48("196") ? false : (stryCov_9fa48("196"), true),
                    directory,
                    language,
                    symbols: limitedSymbols,
                    symbolCount: limitedSymbols.length,
                    searchMode: stryMutAct_9fa48("197") ? "" : (stryCov_9fa48("197"), 'cached'),
                    partial: wasLimited,
                    maxSymbols: effectiveMaxSymbols
                  });
                }
              }
            }
          }
        }
      }

      // Perform fresh search (no cache available)
      const searchOptions = stryMutAct_9fa48("198") ? {} : (stryCov_9fa48("198"), {
        maxSymbols: effectiveMaxSymbols,
        timeout: settingsOptions.timeout
      });
      const result = await searchSymbols(directory, language, searchOptions);

      // Cache successful results
      if (stryMutAct_9fa48("201") ? result.success || result.symbols.length > 0 : stryMutAct_9fa48("200") ? false : stryMutAct_9fa48("199") ? true : (stryCov_9fa48("199", "200", "201"), result.success && (stryMutAct_9fa48("204") ? result.symbols.length <= 0 : stryMutAct_9fa48("203") ? result.symbols.length >= 0 : stryMutAct_9fa48("202") ? true : (stryCov_9fa48("202", "203", "204"), result.symbols.length > 0)))) {
        if (stryMutAct_9fa48("205")) {
          {}
        } else {
          stryCov_9fa48("205");
          await symbolCacheManager.saveSymbols(directory, language, result.symbols, stryMutAct_9fa48("206") ? "" : (stryCov_9fa48("206"), 'full'));
        }
      }
      return result;
    }
  }

  /**
   * Handle get-cached-symbols request
   */
  private async handleGetCachedSymbols(_event: IpcMainInvokeEvent, directory: string, language?: string): Promise<SymbolSearchResponse> {
    if (stryMutAct_9fa48("207")) {
      {}
    } else {
      stryCov_9fa48("207");
      logger.debug(stryMutAct_9fa48("208") ? "" : (stryCov_9fa48("208"), 'Handling get-cached-symbols request'), stryMutAct_9fa48("209") ? {} : (stryCov_9fa48("209"), {
        directory,
        language
      }));
      const settingsOptions = this.getSymbolSearchOptions();
      if (stryMutAct_9fa48("212") ? !directory && typeof directory !== 'string' : stryMutAct_9fa48("211") ? false : stryMutAct_9fa48("210") ? true : (stryCov_9fa48("210", "211", "212"), (stryMutAct_9fa48("213") ? directory : (stryCov_9fa48("213"), !directory)) || (stryMutAct_9fa48("215") ? typeof directory === 'string' : stryMutAct_9fa48("214") ? false : (stryCov_9fa48("214", "215"), typeof directory !== (stryMutAct_9fa48("216") ? "" : (stryCov_9fa48("216"), 'string')))))) {
        if (stryMutAct_9fa48("217")) {
          {}
        } else {
          stryCov_9fa48("217");
          return stryMutAct_9fa48("218") ? {} : (stryCov_9fa48("218"), {
            success: stryMutAct_9fa48("219") ? true : (stryCov_9fa48("219"), false),
            symbols: stryMutAct_9fa48("220") ? ["Stryker was here"] : (stryCov_9fa48("220"), []),
            symbolCount: 0,
            searchMode: stryMutAct_9fa48("221") ? "" : (stryCov_9fa48("221"), 'cached'),
            partial: stryMutAct_9fa48("222") ? true : (stryCov_9fa48("222"), false),
            maxSymbols: settingsOptions.maxSymbols,
            error: stryMutAct_9fa48("223") ? "" : (stryCov_9fa48("223"), 'Invalid directory')
          });
        }
      }
      const isCacheValid = await symbolCacheManager.isCacheValid(directory);
      if (stryMutAct_9fa48("226") ? false : stryMutAct_9fa48("225") ? true : stryMutAct_9fa48("224") ? isCacheValid : (stryCov_9fa48("224", "225", "226"), !isCacheValid)) {
        if (stryMutAct_9fa48("227")) {
          {}
        } else {
          stryCov_9fa48("227");
          return stryMutAct_9fa48("228") ? {} : (stryCov_9fa48("228"), {
            success: stryMutAct_9fa48("229") ? true : (stryCov_9fa48("229"), false),
            symbols: stryMutAct_9fa48("230") ? ["Stryker was here"] : (stryCov_9fa48("230"), []),
            symbolCount: 0,
            searchMode: stryMutAct_9fa48("231") ? "" : (stryCov_9fa48("231"), 'cached'),
            partial: stryMutAct_9fa48("232") ? true : (stryCov_9fa48("232"), false),
            maxSymbols: settingsOptions.maxSymbols,
            error: stryMutAct_9fa48("233") ? "" : (stryCov_9fa48("233"), 'No valid cache found')
          });
        }
      }
      const allSymbols = await symbolCacheManager.loadSymbols(directory, language);

      // Apply maxSymbols limit to cached results
      const limitedSymbols = stryMutAct_9fa48("234") ? allSymbols : (stryCov_9fa48("234"), allSymbols.slice(0, settingsOptions.maxSymbols));
      const wasLimited = stryMutAct_9fa48("238") ? allSymbols.length <= settingsOptions.maxSymbols : stryMutAct_9fa48("237") ? allSymbols.length >= settingsOptions.maxSymbols : stryMutAct_9fa48("236") ? false : stryMutAct_9fa48("235") ? true : (stryCov_9fa48("235", "236", "237", "238"), allSymbols.length > settingsOptions.maxSymbols);
      logger.debug(stryMutAct_9fa48("239") ? "" : (stryCov_9fa48("239"), 'Returning cached symbols'), stryMutAct_9fa48("240") ? {} : (stryCov_9fa48("240"), {
        cachedCount: allSymbols.length,
        returnedCount: limitedSymbols.length,
        maxSymbols: settingsOptions.maxSymbols,
        wasLimited
      }));
      const response: SymbolSearchResponse = stryMutAct_9fa48("241") ? {} : (stryCov_9fa48("241"), {
        success: stryMutAct_9fa48("242") ? false : (stryCov_9fa48("242"), true),
        directory,
        symbols: limitedSymbols,
        symbolCount: limitedSymbols.length,
        searchMode: stryMutAct_9fa48("243") ? "" : (stryCov_9fa48("243"), 'cached'),
        partial: wasLimited,
        maxSymbols: settingsOptions.maxSymbols
      });
      if (stryMutAct_9fa48("245") ? false : stryMutAct_9fa48("244") ? true : (stryCov_9fa48("244", "245"), language)) {
        if (stryMutAct_9fa48("246")) {
          {}
        } else {
          stryCov_9fa48("246");
          response.language = language;
        }
      }
      return response;
    }
  }

  /**
   * Handle clear-symbol-cache request
   */
  private async handleClearSymbolCache(_event: IpcMainInvokeEvent, directory?: string): Promise<{
    success: boolean;
  }> {
    if (stryMutAct_9fa48("247")) {
      {}
    } else {
      stryCov_9fa48("247");
      logger.debug(stryMutAct_9fa48("248") ? "" : (stryCov_9fa48("248"), 'Handling clear-symbol-cache request'), stryMutAct_9fa48("249") ? {} : (stryCov_9fa48("249"), {
        directory
      }));
      try {
        if (stryMutAct_9fa48("250")) {
          {}
        } else {
          stryCov_9fa48("250");
          if (stryMutAct_9fa48("252") ? false : stryMutAct_9fa48("251") ? true : (stryCov_9fa48("251", "252"), directory)) {
            if (stryMutAct_9fa48("253")) {
              {}
            } else {
              stryCov_9fa48("253");
              await symbolCacheManager.clearCache(directory);
            }
          } else {
            if (stryMutAct_9fa48("254")) {
              {}
            } else {
              stryCov_9fa48("254");
              await symbolCacheManager.clearAllCaches();
            }
          }
          return stryMutAct_9fa48("255") ? {} : (stryCov_9fa48("255"), {
            success: stryMutAct_9fa48("256") ? false : (stryCov_9fa48("256"), true)
          });
        }
      } catch (error) {
        if (stryMutAct_9fa48("257")) {
          {}
        } else {
          stryCov_9fa48("257");
          logger.error(stryMutAct_9fa48("258") ? "" : (stryCov_9fa48("258"), 'Error clearing symbol cache:'), error);
          return stryMutAct_9fa48("259") ? {} : (stryCov_9fa48("259"), {
            success: stryMutAct_9fa48("260") ? true : (stryCov_9fa48("260"), false)
          });
        }
      }
    }
  }

  /**
   * Refresh cache in background (stale-while-revalidate pattern)
   * This runs asynchronously without blocking the main response
   * Uses deduplication to avoid multiple concurrent refreshes for the same directory/language
   */
  private refreshCacheInBackground(directory: string, language: string, options?: {
    maxSymbols?: number;
    timeout?: number;
  }): void {
    if (stryMutAct_9fa48("261")) {
      {}
    } else {
      stryCov_9fa48("261");
      // Create a unique key for this refresh operation
      const refreshKey = stryMutAct_9fa48("262") ? `` : (stryCov_9fa48("262"), `${directory}:${language}`);

      // Skip if a refresh is already in progress for this combination
      if (stryMutAct_9fa48("264") ? false : stryMutAct_9fa48("263") ? true : (stryCov_9fa48("263", "264"), this.pendingRefreshes.get(refreshKey))) {
        if (stryMutAct_9fa48("265")) {
          {}
        } else {
          stryCov_9fa48("265");
          logger.debug(stryMutAct_9fa48("266") ? "" : (stryCov_9fa48("266"), 'Background cache refresh skipped (already in progress)'), stryMutAct_9fa48("267") ? {} : (stryCov_9fa48("267"), {
            directory,
            language
          }));
          return;
        }
      }

      // Mark as pending
      this.pendingRefreshes.set(refreshKey, stryMutAct_9fa48("268") ? false : (stryCov_9fa48("268"), true));

      // Run in background without awaiting
      (async () => {
        if (stryMutAct_9fa48("269")) {
          {}
        } else {
          stryCov_9fa48("269");
          try {
            if (stryMutAct_9fa48("270")) {
              {}
            } else {
              stryCov_9fa48("270");
              logger.debug(stryMutAct_9fa48("271") ? "" : (stryCov_9fa48("271"), 'Background cache refresh started'), stryMutAct_9fa48("272") ? {} : (stryCov_9fa48("272"), {
                directory,
                language
              }));
              const result = await searchSymbols(directory, language, options);
              if (stryMutAct_9fa48("275") ? result.success || result.symbols.length > 0 : stryMutAct_9fa48("274") ? false : stryMutAct_9fa48("273") ? true : (stryCov_9fa48("273", "274", "275"), result.success && (stryMutAct_9fa48("278") ? result.symbols.length <= 0 : stryMutAct_9fa48("277") ? result.symbols.length >= 0 : stryMutAct_9fa48("276") ? true : (stryCov_9fa48("276", "277", "278"), result.symbols.length > 0)))) {
                if (stryMutAct_9fa48("279")) {
                  {}
                } else {
                  stryCov_9fa48("279");
                  await symbolCacheManager.saveSymbols(directory, language, result.symbols, stryMutAct_9fa48("280") ? "" : (stryCov_9fa48("280"), 'full'));
                  logger.debug(stryMutAct_9fa48("281") ? "" : (stryCov_9fa48("281"), 'Background cache refresh completed'), stryMutAct_9fa48("282") ? {} : (stryCov_9fa48("282"), {
                    directory,
                    language,
                    symbolCount: result.symbols.length
                  }));
                }
              }
            }
          } catch (error) {
            if (stryMutAct_9fa48("283")) {
              {}
            } else {
              stryCov_9fa48("283");
              logger.warn(stryMutAct_9fa48("284") ? "" : (stryCov_9fa48("284"), 'Background cache refresh failed'), stryMutAct_9fa48("285") ? {} : (stryCov_9fa48("285"), {
                directory,
                language,
                error
              }));
            }
          } finally {
            if (stryMutAct_9fa48("286")) {
              {}
            } else {
              stryCov_9fa48("286");
              // Clear pending status
              this.pendingRefreshes.delete(refreshKey);
            }
          }
        }
      })();
    }
  }
}

// Export singleton instance
export const codeSearchHandler = new CodeSearchHandler();