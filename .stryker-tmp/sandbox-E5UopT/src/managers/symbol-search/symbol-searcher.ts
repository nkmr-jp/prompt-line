/**
 * Symbol Searcher - Native tool executor for ripgrep-based symbol search
 * Interfaces with the symbol-searcher native binary
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
import { execFile } from 'child_process';
import { SYMBOL_SEARCHER_PATH, logger } from '../../utils/utils';
import type { SymbolSearchResponse, RgCheckResponse, LanguagesResponse, SymbolSearchOptions } from './types';

// Default search options (exported for use by handlers)
export const DEFAULT_MAX_SYMBOLS = 20000;
export const DEFAULT_SEARCH_TIMEOUT = 5000; // 5 seconds for symbol search

/**
 * Check if ripgrep (rg) is available
 */
export async function checkRgAvailable(): Promise<RgCheckResponse> {
  if (stryMutAct_9fa48("3651")) {
    {}
  } else {
    stryCov_9fa48("3651");
    return new Promise(resolve => {
      if (stryMutAct_9fa48("3652")) {
        {}
      } else {
        stryCov_9fa48("3652");
        if (stryMutAct_9fa48("3655") ? process.platform === 'darwin' : stryMutAct_9fa48("3654") ? false : stryMutAct_9fa48("3653") ? true : (stryCov_9fa48("3653", "3654", "3655"), process.platform !== (stryMutAct_9fa48("3656") ? "" : (stryCov_9fa48("3656"), 'darwin')))) {
          if (stryMutAct_9fa48("3657")) {
            {}
          } else {
            stryCov_9fa48("3657");
            resolve(stryMutAct_9fa48("3658") ? {} : (stryCov_9fa48("3658"), {
              rgAvailable: stryMutAct_9fa48("3659") ? true : (stryCov_9fa48("3659"), false),
              rgPath: null
            }));
            return;
          }
        }
        const options = stryMutAct_9fa48("3660") ? {} : (stryCov_9fa48("3660"), {
          timeout: DEFAULT_SEARCH_TIMEOUT,
          killSignal: 'SIGTERM' as const
        });
        execFile(SYMBOL_SEARCHER_PATH, stryMutAct_9fa48("3661") ? [] : (stryCov_9fa48("3661"), [stryMutAct_9fa48("3662") ? "" : (stryCov_9fa48("3662"), 'check-rg')]), options, (error, stdout) => {
          if (stryMutAct_9fa48("3663")) {
            {}
          } else {
            stryCov_9fa48("3663");
            if (stryMutAct_9fa48("3665") ? false : stryMutAct_9fa48("3664") ? true : (stryCov_9fa48("3664", "3665"), error)) {
              if (stryMutAct_9fa48("3666")) {
                {}
              } else {
                stryCov_9fa48("3666");
                logger.warn(stryMutAct_9fa48("3667") ? "" : (stryCov_9fa48("3667"), 'Error checking rg availability:'), error.message);
                resolve(stryMutAct_9fa48("3668") ? {} : (stryCov_9fa48("3668"), {
                  rgAvailable: stryMutAct_9fa48("3669") ? true : (stryCov_9fa48("3669"), false),
                  rgPath: null
                }));
                return;
              }
            }
            try {
              if (stryMutAct_9fa48("3670")) {
                {}
              } else {
                stryCov_9fa48("3670");
                const result = JSON.parse(stdout.trim()) as RgCheckResponse;
                logger.debug(stryMutAct_9fa48("3671") ? "" : (stryCov_9fa48("3671"), 'rg availability check:'), result);
                resolve(result);
              }
            } catch (parseError) {
              if (stryMutAct_9fa48("3672")) {
                {}
              } else {
                stryCov_9fa48("3672");
                logger.warn(stryMutAct_9fa48("3673") ? "" : (stryCov_9fa48("3673"), 'Error parsing rg check result:'), parseError);
                resolve(stryMutAct_9fa48("3674") ? {} : (stryCov_9fa48("3674"), {
                  rgAvailable: stryMutAct_9fa48("3675") ? true : (stryCov_9fa48("3675"), false),
                  rgPath: null
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
 * Get list of supported programming languages
 */
export async function getSupportedLanguages(): Promise<LanguagesResponse> {
  if (stryMutAct_9fa48("3676")) {
    {}
  } else {
    stryCov_9fa48("3676");
    return new Promise(resolve => {
      if (stryMutAct_9fa48("3677")) {
        {}
      } else {
        stryCov_9fa48("3677");
        if (stryMutAct_9fa48("3680") ? process.platform === 'darwin' : stryMutAct_9fa48("3679") ? false : stryMutAct_9fa48("3678") ? true : (stryCov_9fa48("3678", "3679", "3680"), process.platform !== (stryMutAct_9fa48("3681") ? "" : (stryCov_9fa48("3681"), 'darwin')))) {
          if (stryMutAct_9fa48("3682")) {
            {}
          } else {
            stryCov_9fa48("3682");
            resolve(stryMutAct_9fa48("3683") ? {} : (stryCov_9fa48("3683"), {
              languages: stryMutAct_9fa48("3684") ? ["Stryker was here"] : (stryCov_9fa48("3684"), [])
            }));
            return;
          }
        }
        const options = stryMutAct_9fa48("3685") ? {} : (stryCov_9fa48("3685"), {
          timeout: DEFAULT_SEARCH_TIMEOUT,
          killSignal: 'SIGTERM' as const
        });
        execFile(SYMBOL_SEARCHER_PATH, stryMutAct_9fa48("3686") ? [] : (stryCov_9fa48("3686"), [stryMutAct_9fa48("3687") ? "" : (stryCov_9fa48("3687"), 'list-languages')]), options, (error, stdout) => {
          if (stryMutAct_9fa48("3688")) {
            {}
          } else {
            stryCov_9fa48("3688");
            if (stryMutAct_9fa48("3690") ? false : stryMutAct_9fa48("3689") ? true : (stryCov_9fa48("3689", "3690"), error)) {
              if (stryMutAct_9fa48("3691")) {
                {}
              } else {
                stryCov_9fa48("3691");
                logger.warn(stryMutAct_9fa48("3692") ? "" : (stryCov_9fa48("3692"), 'Error getting supported languages:'), error.message);
                resolve(stryMutAct_9fa48("3693") ? {} : (stryCov_9fa48("3693"), {
                  languages: stryMutAct_9fa48("3694") ? ["Stryker was here"] : (stryCov_9fa48("3694"), [])
                }));
                return;
              }
            }
            try {
              if (stryMutAct_9fa48("3695")) {
                {}
              } else {
                stryCov_9fa48("3695");
                const result = JSON.parse(stdout.trim()) as LanguagesResponse;
                logger.debug(stryMutAct_9fa48("3696") ? "" : (stryCov_9fa48("3696"), 'Supported languages:'), result);
                resolve(result);
              }
            } catch (parseError) {
              if (stryMutAct_9fa48("3697")) {
                {}
              } else {
                stryCov_9fa48("3697");
                logger.warn(stryMutAct_9fa48("3698") ? "" : (stryCov_9fa48("3698"), 'Error parsing languages result:'), parseError);
                resolve(stryMutAct_9fa48("3699") ? {} : (stryCov_9fa48("3699"), {
                  languages: stryMutAct_9fa48("3700") ? ["Stryker was here"] : (stryCov_9fa48("3700"), [])
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
 * Search for symbols in a directory for a specific language
 * @param directory - The directory to search in
 * @param language - The language key (e.g., 'ts', 'go', 'py')
 * @param options - Optional search options
 */
export async function searchSymbols(directory: string, language: string, options: SymbolSearchOptions = {}): Promise<SymbolSearchResponse> {
  if (stryMutAct_9fa48("3701")) {
    {}
  } else {
    stryCov_9fa48("3701");
    return new Promise(resolve => {
      if (stryMutAct_9fa48("3702")) {
        {}
      } else {
        stryCov_9fa48("3702");
        if (stryMutAct_9fa48("3705") ? process.platform === 'darwin' : stryMutAct_9fa48("3704") ? false : stryMutAct_9fa48("3703") ? true : (stryCov_9fa48("3703", "3704", "3705"), process.platform !== (stryMutAct_9fa48("3706") ? "" : (stryCov_9fa48("3706"), 'darwin')))) {
          if (stryMutAct_9fa48("3707")) {
            {}
          } else {
            stryCov_9fa48("3707");
            resolve(stryMutAct_9fa48("3708") ? {} : (stryCov_9fa48("3708"), {
              success: stryMutAct_9fa48("3709") ? true : (stryCov_9fa48("3709"), false),
              symbols: stryMutAct_9fa48("3710") ? ["Stryker was here"] : (stryCov_9fa48("3710"), []),
              symbolCount: 0,
              searchMode: stryMutAct_9fa48("3711") ? "" : (stryCov_9fa48("3711"), 'full'),
              partial: stryMutAct_9fa48("3712") ? true : (stryCov_9fa48("3712"), false),
              maxSymbols: stryMutAct_9fa48("3715") ? options.maxSymbols && DEFAULT_MAX_SYMBOLS : stryMutAct_9fa48("3714") ? false : stryMutAct_9fa48("3713") ? true : (stryCov_9fa48("3713", "3714", "3715"), options.maxSymbols || DEFAULT_MAX_SYMBOLS),
              error: stryMutAct_9fa48("3716") ? "" : (stryCov_9fa48("3716"), 'Symbol search only supported on macOS')
            }));
            return;
          }
        }

        // Validate inputs
        if (stryMutAct_9fa48("3719") ? !directory && typeof directory !== 'string' : stryMutAct_9fa48("3718") ? false : stryMutAct_9fa48("3717") ? true : (stryCov_9fa48("3717", "3718", "3719"), (stryMutAct_9fa48("3720") ? directory : (stryCov_9fa48("3720"), !directory)) || (stryMutAct_9fa48("3722") ? typeof directory === 'string' : stryMutAct_9fa48("3721") ? false : (stryCov_9fa48("3721", "3722"), typeof directory !== (stryMutAct_9fa48("3723") ? "" : (stryCov_9fa48("3723"), 'string')))))) {
          if (stryMutAct_9fa48("3724")) {
            {}
          } else {
            stryCov_9fa48("3724");
            resolve(stryMutAct_9fa48("3725") ? {} : (stryCov_9fa48("3725"), {
              success: stryMutAct_9fa48("3726") ? true : (stryCov_9fa48("3726"), false),
              symbols: stryMutAct_9fa48("3727") ? ["Stryker was here"] : (stryCov_9fa48("3727"), []),
              symbolCount: 0,
              searchMode: stryMutAct_9fa48("3728") ? "" : (stryCov_9fa48("3728"), 'full'),
              partial: stryMutAct_9fa48("3729") ? true : (stryCov_9fa48("3729"), false),
              maxSymbols: stryMutAct_9fa48("3732") ? options.maxSymbols && DEFAULT_MAX_SYMBOLS : stryMutAct_9fa48("3731") ? false : stryMutAct_9fa48("3730") ? true : (stryCov_9fa48("3730", "3731", "3732"), options.maxSymbols || DEFAULT_MAX_SYMBOLS),
              error: stryMutAct_9fa48("3733") ? "" : (stryCov_9fa48("3733"), 'Invalid directory')
            }));
            return;
          }
        }
        if (stryMutAct_9fa48("3736") ? !language && typeof language !== 'string' : stryMutAct_9fa48("3735") ? false : stryMutAct_9fa48("3734") ? true : (stryCov_9fa48("3734", "3735", "3736"), (stryMutAct_9fa48("3737") ? language : (stryCov_9fa48("3737"), !language)) || (stryMutAct_9fa48("3739") ? typeof language === 'string' : stryMutAct_9fa48("3738") ? false : (stryCov_9fa48("3738", "3739"), typeof language !== (stryMutAct_9fa48("3740") ? "" : (stryCov_9fa48("3740"), 'string')))))) {
          if (stryMutAct_9fa48("3741")) {
            {}
          } else {
            stryCov_9fa48("3741");
            resolve(stryMutAct_9fa48("3742") ? {} : (stryCov_9fa48("3742"), {
              success: stryMutAct_9fa48("3743") ? true : (stryCov_9fa48("3743"), false),
              symbols: stryMutAct_9fa48("3744") ? ["Stryker was here"] : (stryCov_9fa48("3744"), []),
              symbolCount: 0,
              searchMode: stryMutAct_9fa48("3745") ? "" : (stryCov_9fa48("3745"), 'full'),
              partial: stryMutAct_9fa48("3746") ? true : (stryCov_9fa48("3746"), false),
              maxSymbols: stryMutAct_9fa48("3749") ? options.maxSymbols && DEFAULT_MAX_SYMBOLS : stryMutAct_9fa48("3748") ? false : stryMutAct_9fa48("3747") ? true : (stryCov_9fa48("3747", "3748", "3749"), options.maxSymbols || DEFAULT_MAX_SYMBOLS),
              error: stryMutAct_9fa48("3750") ? "" : (stryCov_9fa48("3750"), 'Invalid language')
            }));
            return;
          }
        }
        const maxSymbols = stryMutAct_9fa48("3753") ? options.maxSymbols && DEFAULT_MAX_SYMBOLS : stryMutAct_9fa48("3752") ? false : stryMutAct_9fa48("3751") ? true : (stryCov_9fa48("3751", "3752", "3753"), options.maxSymbols || DEFAULT_MAX_SYMBOLS);
        const timeout = stryMutAct_9fa48("3756") ? options.timeout && DEFAULT_SEARCH_TIMEOUT : stryMutAct_9fa48("3755") ? false : stryMutAct_9fa48("3754") ? true : (stryCov_9fa48("3754", "3755", "3756"), options.timeout || DEFAULT_SEARCH_TIMEOUT);
        const args = stryMutAct_9fa48("3757") ? [] : (stryCov_9fa48("3757"), [stryMutAct_9fa48("3758") ? "" : (stryCov_9fa48("3758"), 'search'), directory, stryMutAct_9fa48("3759") ? "" : (stryCov_9fa48("3759"), '--language'), language, stryMutAct_9fa48("3760") ? "" : (stryCov_9fa48("3760"), '--max-symbols'), String(maxSymbols)]);
        const execOptions = stryMutAct_9fa48("3761") ? {} : (stryCov_9fa48("3761"), {
          timeout,
          killSignal: 'SIGTERM' as const
        });
        logger.debug(stryMutAct_9fa48("3762") ? "" : (stryCov_9fa48("3762"), 'Searching symbols:'), stryMutAct_9fa48("3763") ? {} : (stryCov_9fa48("3763"), {
          directory,
          language,
          maxSymbols
        }));
        execFile(SYMBOL_SEARCHER_PATH, args, execOptions, (error, stdout, stderr) => {
          if (stryMutAct_9fa48("3764")) {
            {}
          } else {
            stryCov_9fa48("3764");
            if (stryMutAct_9fa48("3766") ? false : stryMutAct_9fa48("3765") ? true : (stryCov_9fa48("3765", "3766"), error)) {
              if (stryMutAct_9fa48("3767")) {
                {}
              } else {
                stryCov_9fa48("3767");
                logger.warn(stryMutAct_9fa48("3768") ? "" : (stryCov_9fa48("3768"), 'Error searching symbols:'), stryMutAct_9fa48("3769") ? {} : (stryCov_9fa48("3769"), {
                  message: error.message,
                  code: (error as any).code,
                  signal: (error as any).signal,
                  killed: (error as any).killed,
                  stderr: stryMutAct_9fa48("3772") ? stderr.toString()?.substring(0, 500) : stryMutAct_9fa48("3771") ? stderr?.toString().substring(0, 500) : stryMutAct_9fa48("3770") ? stderr?.toString() : (stryCov_9fa48("3770", "3771", "3772"), stderr?.toString()?.substring(0, 500))
                }));
                resolve(stryMutAct_9fa48("3773") ? {} : (stryCov_9fa48("3773"), {
                  success: stryMutAct_9fa48("3774") ? true : (stryCov_9fa48("3774"), false),
                  symbols: stryMutAct_9fa48("3775") ? ["Stryker was here"] : (stryCov_9fa48("3775"), []),
                  symbolCount: 0,
                  searchMode: stryMutAct_9fa48("3776") ? "" : (stryCov_9fa48("3776"), 'full'),
                  partial: stryMutAct_9fa48("3777") ? true : (stryCov_9fa48("3777"), false),
                  maxSymbols,
                  error: error.message
                }));
                return;
              }
            }
            try {
              if (stryMutAct_9fa48("3778")) {
                {}
              } else {
                stryCov_9fa48("3778");
                const result = JSON.parse(stdout.trim()) as SymbolSearchResponse;
                if (stryMutAct_9fa48("3780") ? false : stryMutAct_9fa48("3779") ? true : (stryCov_9fa48("3779", "3780"), result.success)) {
                  if (stryMutAct_9fa48("3781")) {
                    {}
                  } else {
                    stryCov_9fa48("3781");
                    logger.debug(stryMutAct_9fa48("3782") ? "" : (stryCov_9fa48("3782"), 'Symbol search completed:'), stryMutAct_9fa48("3783") ? {} : (stryCov_9fa48("3783"), {
                      directory: result.directory,
                      language: result.language,
                      symbolCount: result.symbolCount
                    }));
                  }
                } else {
                  if (stryMutAct_9fa48("3784")) {
                    {}
                  } else {
                    stryCov_9fa48("3784");
                    logger.debug(stryMutAct_9fa48("3785") ? "" : (stryCov_9fa48("3785"), 'Symbol search returned error:'), result.error);
                  }
                }
                resolve(result);
              }
            } catch (parseError) {
              if (stryMutAct_9fa48("3786")) {
                {}
              } else {
                stryCov_9fa48("3786");
                logger.warn(stryMutAct_9fa48("3787") ? "" : (stryCov_9fa48("3787"), 'Error parsing symbol search result:'), parseError);
                resolve(stryMutAct_9fa48("3788") ? {} : (stryCov_9fa48("3788"), {
                  success: stryMutAct_9fa48("3789") ? true : (stryCov_9fa48("3789"), false),
                  symbols: stryMutAct_9fa48("3790") ? ["Stryker was here"] : (stryCov_9fa48("3790"), []),
                  symbolCount: 0,
                  searchMode: stryMutAct_9fa48("3791") ? "" : (stryCov_9fa48("3791"), 'full'),
                  partial: stryMutAct_9fa48("3792") ? true : (stryCov_9fa48("3792"), false),
                  maxSymbols,
                  error: stryMutAct_9fa48("3793") ? "" : (stryCov_9fa48("3793"), 'Failed to parse symbol search result')
                }));
              }
            }
          }
        });
      }
    });
  }
}