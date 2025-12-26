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
import type { AppInfo } from '../../types';
import { TIMEOUTS } from '../../constants';
import { logger } from '../logger';
import { sanitizeCommandArgument, isCommandArgumentSafe } from '../security';
import { KEYBOARD_SIMULATOR_PATH, NATIVE_TOOLS_DIR } from './paths';
export function pasteWithNativeTool(): Promise<void> {
  if (stryMutAct_9fa48("5286")) {
    {}
  } else {
    stryCov_9fa48("5286");
    return new Promise((resolve, reject) => {
      if (stryMutAct_9fa48("5287")) {
        {}
      } else {
        stryCov_9fa48("5287");
        if (stryMutAct_9fa48("5290") ? process.platform === 'darwin' : stryMutAct_9fa48("5289") ? false : stryMutAct_9fa48("5288") ? true : (stryCov_9fa48("5288", "5289", "5290"), process.platform !== (stryMutAct_9fa48("5291") ? "" : (stryCov_9fa48("5291"), 'darwin')))) {
          if (stryMutAct_9fa48("5292")) {
            {}
          } else {
            stryCov_9fa48("5292");
            reject(new Error(stryMutAct_9fa48("5293") ? "" : (stryCov_9fa48("5293"), 'Native paste only supported on macOS')));
            return;
          }
        }
        const options = stryMutAct_9fa48("5294") ? {} : (stryCov_9fa48("5294"), {
          timeout: TIMEOUTS.NATIVE_PASTE_TIMEOUT,
          killSignal: 'SIGTERM' as const
        });
        const args = stryMutAct_9fa48("5295") ? [] : (stryCov_9fa48("5295"), [stryMutAct_9fa48("5296") ? "" : (stryCov_9fa48("5296"), 'paste')]);
        logger.debug(stryMutAct_9fa48("5297") ? "" : (stryCov_9fa48("5297"), 'Executing native paste command'), stryMutAct_9fa48("5298") ? {} : (stryCov_9fa48("5298"), {
          executable: KEYBOARD_SIMULATOR_PATH,
          args,
          nativeToolsDir: NATIVE_TOOLS_DIR
        }));
        execFile(KEYBOARD_SIMULATOR_PATH, args, options, (error, stdout, stderr) => {
          if (stryMutAct_9fa48("5299")) {
            {}
          } else {
            stryCov_9fa48("5299");
            if (stryMutAct_9fa48("5301") ? false : stryMutAct_9fa48("5300") ? true : (stryCov_9fa48("5300", "5301"), error)) {
              if (stryMutAct_9fa48("5302")) {
                {}
              } else {
                stryCov_9fa48("5302");
                if (stryMutAct_9fa48("5304") ? false : stryMutAct_9fa48("5303") ? true : (stryCov_9fa48("5303", "5304"), error.killed)) {
                  if (stryMutAct_9fa48("5305")) {
                    {}
                  } else {
                    stryCov_9fa48("5305");
                    logger.warn(stryMutAct_9fa48("5306") ? "" : (stryCov_9fa48("5306"), 'Native paste timed out (non-critical)'));
                    resolve();
                  }
                } else {
                  if (stryMutAct_9fa48("5307")) {
                    {}
                  } else {
                    stryCov_9fa48("5307");
                    logger.error(stryMutAct_9fa48("5308") ? "" : (stryCov_9fa48("5308"), 'Native paste error:'), stryMutAct_9fa48("5309") ? {} : (stryCov_9fa48("5309"), {
                      error: error.message,
                      code: error.code,
                      signal: error.signal,
                      stderr,
                      executable: KEYBOARD_SIMULATOR_PATH,
                      args
                    }));
                    reject(error);
                  }
                }
              }
            } else {
              if (stryMutAct_9fa48("5310")) {
                {}
              } else {
                stryCov_9fa48("5310");
                try {
                  if (stryMutAct_9fa48("5311")) {
                    {}
                  } else {
                    stryCov_9fa48("5311");
                    const result = JSON.parse(stryMutAct_9fa48("5312") ? stdout : (stryCov_9fa48("5312"), stdout.trim()));
                    if (stryMutAct_9fa48("5314") ? false : stryMutAct_9fa48("5313") ? true : (stryCov_9fa48("5313", "5314"), result.success)) {
                      if (stryMutAct_9fa48("5315")) {
                        {}
                      } else {
                        stryCov_9fa48("5315");
                        logger.debug(stryMutAct_9fa48("5316") ? "" : (stryCov_9fa48("5316"), 'Native paste successful'));
                        resolve();
                      }
                    } else {
                      if (stryMutAct_9fa48("5317")) {
                        {}
                      } else {
                        stryCov_9fa48("5317");
                        logger.error(stryMutAct_9fa48("5318") ? "" : (stryCov_9fa48("5318"), 'Native paste failed:'), result);
                        reject(new Error(stryMutAct_9fa48("5319") ? "" : (stryCov_9fa48("5319"), 'Native paste failed')));
                      }
                    }
                  }
                } catch (parseError) {
                  if (stryMutAct_9fa48("5320")) {
                    {}
                  } else {
                    stryCov_9fa48("5320");
                    logger.warn(stryMutAct_9fa48("5321") ? "" : (stryCov_9fa48("5321"), 'Error parsing native paste result:'), parseError);
                    resolve();
                  }
                }
              }
            }
          }
        });
      }
    });
  }
}
export function activateAndPasteWithNativeTool(appInfo: AppInfo | string): Promise<void> {
  if (stryMutAct_9fa48("5322")) {
    {}
  } else {
    stryCov_9fa48("5322");
    return new Promise((resolve, reject) => {
      if (stryMutAct_9fa48("5323")) {
        {}
      } else {
        stryCov_9fa48("5323");
        if (stryMutAct_9fa48("5326") ? process.platform === 'darwin' : stryMutAct_9fa48("5325") ? false : stryMutAct_9fa48("5324") ? true : (stryCov_9fa48("5324", "5325", "5326"), process.platform !== (stryMutAct_9fa48("5327") ? "" : (stryCov_9fa48("5327"), 'darwin')))) {
          if (stryMutAct_9fa48("5328")) {
            {}
          } else {
            stryCov_9fa48("5328");
            reject(new Error(stryMutAct_9fa48("5329") ? "" : (stryCov_9fa48("5329"), 'Native paste only supported on macOS')));
            return;
          }
        }
        let appName: string;
        let bundleId: string | null;
        if (stryMutAct_9fa48("5332") ? typeof appInfo !== 'string' : stryMutAct_9fa48("5331") ? false : stryMutAct_9fa48("5330") ? true : (stryCov_9fa48("5330", "5331", "5332"), typeof appInfo === (stryMutAct_9fa48("5333") ? "" : (stryCov_9fa48("5333"), 'string')))) {
          if (stryMutAct_9fa48("5334")) {
            {}
          } else {
            stryCov_9fa48("5334");
            appName = appInfo;
            bundleId = null;
          }
        } else if (stryMutAct_9fa48("5337") ? appInfo || typeof appInfo === 'object' : stryMutAct_9fa48("5336") ? false : stryMutAct_9fa48("5335") ? true : (stryCov_9fa48("5335", "5336", "5337"), appInfo && (stryMutAct_9fa48("5339") ? typeof appInfo !== 'object' : stryMutAct_9fa48("5338") ? true : (stryCov_9fa48("5338", "5339"), typeof appInfo === (stryMutAct_9fa48("5340") ? "" : (stryCov_9fa48("5340"), 'object')))))) {
          if (stryMutAct_9fa48("5341")) {
            {}
          } else {
            stryCov_9fa48("5341");
            appName = appInfo.name;
            bundleId = stryMutAct_9fa48("5344") ? appInfo.bundleId && null : stryMutAct_9fa48("5343") ? false : stryMutAct_9fa48("5342") ? true : (stryCov_9fa48("5342", "5343", "5344"), appInfo.bundleId || null);
          }
        } else {
          if (stryMutAct_9fa48("5345")) {
            {}
          } else {
            stryCov_9fa48("5345");
            reject(new Error(stryMutAct_9fa48("5346") ? "" : (stryCov_9fa48("5346"), 'Invalid app info provided')));
            return;
          }
        }

        // Validate inputs before sanitization
        if (stryMutAct_9fa48("5349") ? false : stryMutAct_9fa48("5348") ? true : stryMutAct_9fa48("5347") ? isCommandArgumentSafe(appName) : (stryCov_9fa48("5347", "5348", "5349"), !isCommandArgumentSafe(appName))) {
          if (stryMutAct_9fa48("5350")) {
            {}
          } else {
            stryCov_9fa48("5350");
            logger.error(stryMutAct_9fa48("5351") ? "" : (stryCov_9fa48("5351"), 'App name contains unsafe characters:'), stryMutAct_9fa48("5352") ? {} : (stryCov_9fa48("5352"), {
              appName
            }));
            reject(new Error(stryMutAct_9fa48("5353") ? "" : (stryCov_9fa48("5353"), 'App name contains unsafe characters')));
            return;
          }
        }
        if (stryMutAct_9fa48("5356") ? bundleId || !isCommandArgumentSafe(bundleId) : stryMutAct_9fa48("5355") ? false : stryMutAct_9fa48("5354") ? true : (stryCov_9fa48("5354", "5355", "5356"), bundleId && (stryMutAct_9fa48("5357") ? isCommandArgumentSafe(bundleId) : (stryCov_9fa48("5357"), !isCommandArgumentSafe(bundleId))))) {
          if (stryMutAct_9fa48("5358")) {
            {}
          } else {
            stryCov_9fa48("5358");
            logger.error(stryMutAct_9fa48("5359") ? "" : (stryCov_9fa48("5359"), 'Bundle ID contains unsafe characters:'), stryMutAct_9fa48("5360") ? {} : (stryCov_9fa48("5360"), {
              bundleId
            }));
            reject(new Error(stryMutAct_9fa48("5361") ? "" : (stryCov_9fa48("5361"), 'Bundle ID contains unsafe characters')));
            return;
          }
        }

        // Sanitize inputs to prevent command injection
        try {
          if (stryMutAct_9fa48("5362")) {
            {}
          } else {
            stryCov_9fa48("5362");
            appName = sanitizeCommandArgument(appName, 128);
            if (stryMutAct_9fa48("5364") ? false : stryMutAct_9fa48("5363") ? true : (stryCov_9fa48("5363", "5364"), bundleId)) {
              if (stryMutAct_9fa48("5365")) {
                {}
              } else {
                stryCov_9fa48("5365");
                bundleId = sanitizeCommandArgument(bundleId, 128);
              }
            }
          }
        } catch (sanitizeError) {
          if (stryMutAct_9fa48("5366")) {
            {}
          } else {
            stryCov_9fa48("5366");
            logger.error(stryMutAct_9fa48("5367") ? "" : (stryCov_9fa48("5367"), 'Failed to sanitize command arguments:'), sanitizeError);
            reject(new Error(stryMutAct_9fa48("5368") ? "" : (stryCov_9fa48("5368"), 'Invalid characters in app information')));
            return;
          }
        }

        // Additional validation for empty values after sanitization
        if (stryMutAct_9fa48("5371") ? !appName && appName.length === 0 : stryMutAct_9fa48("5370") ? false : stryMutAct_9fa48("5369") ? true : (stryCov_9fa48("5369", "5370", "5371"), (stryMutAct_9fa48("5372") ? appName : (stryCov_9fa48("5372"), !appName)) || (stryMutAct_9fa48("5374") ? appName.length !== 0 : stryMutAct_9fa48("5373") ? false : (stryCov_9fa48("5373", "5374"), appName.length === 0)))) {
          if (stryMutAct_9fa48("5375")) {
            {}
          } else {
            stryCov_9fa48("5375");
            logger.error(stryMutAct_9fa48("5376") ? "" : (stryCov_9fa48("5376"), 'App name is empty after sanitization'));
            reject(new Error(stryMutAct_9fa48("5377") ? "" : (stryCov_9fa48("5377"), 'App name is required')));
            return;
          }
        }
        const options = stryMutAct_9fa48("5378") ? {} : (stryCov_9fa48("5378"), {
          timeout: TIMEOUTS.ACTIVATE_PASTE_TIMEOUT,
          killSignal: 'SIGTERM' as const
        });
        let args: string[];
        if (stryMutAct_9fa48("5381") ? bundleId || bundleId.length > 0 : stryMutAct_9fa48("5380") ? false : stryMutAct_9fa48("5379") ? true : (stryCov_9fa48("5379", "5380", "5381"), bundleId && (stryMutAct_9fa48("5384") ? bundleId.length <= 0 : stryMutAct_9fa48("5383") ? bundleId.length >= 0 : stryMutAct_9fa48("5382") ? true : (stryCov_9fa48("5382", "5383", "5384"), bundleId.length > 0)))) {
          if (stryMutAct_9fa48("5385")) {
            {}
          } else {
            stryCov_9fa48("5385");
            args = stryMutAct_9fa48("5386") ? [] : (stryCov_9fa48("5386"), [stryMutAct_9fa48("5387") ? "" : (stryCov_9fa48("5387"), 'activate-and-paste-bundle'), bundleId]);
            logger.debug(stryMutAct_9fa48("5388") ? "" : (stryCov_9fa48("5388"), 'Using sanitized bundle ID for app activation and paste:'), stryMutAct_9fa48("5389") ? {} : (stryCov_9fa48("5389"), {
              appName,
              bundleId
            }));
          }
        } else {
          if (stryMutAct_9fa48("5390")) {
            {}
          } else {
            stryCov_9fa48("5390");
            args = stryMutAct_9fa48("5391") ? [] : (stryCov_9fa48("5391"), [stryMutAct_9fa48("5392") ? "" : (stryCov_9fa48("5392"), 'activate-and-paste-name'), appName]);
            logger.debug(stryMutAct_9fa48("5393") ? "" : (stryCov_9fa48("5393"), 'Using sanitized app name for app activation and paste:'), stryMutAct_9fa48("5394") ? {} : (stryCov_9fa48("5394"), {
              appName
            }));
          }
        }
        logger.debug(stryMutAct_9fa48("5395") ? "" : (stryCov_9fa48("5395"), 'Executing native activate and paste command'), stryMutAct_9fa48("5396") ? {} : (stryCov_9fa48("5396"), {
          executable: KEYBOARD_SIMULATOR_PATH,
          args,
          nativeToolsDir: NATIVE_TOOLS_DIR,
          appName,
          bundleId
        }));
        execFile(KEYBOARD_SIMULATOR_PATH, args, options, (error, stdout, stderr) => {
          if (stryMutAct_9fa48("5397")) {
            {}
          } else {
            stryCov_9fa48("5397");
            if (stryMutAct_9fa48("5399") ? false : stryMutAct_9fa48("5398") ? true : (stryCov_9fa48("5398", "5399"), error)) {
              if (stryMutAct_9fa48("5400")) {
                {}
              } else {
                stryCov_9fa48("5400");
                if (stryMutAct_9fa48("5402") ? false : stryMutAct_9fa48("5401") ? true : (stryCov_9fa48("5401", "5402"), error.killed)) {
                  if (stryMutAct_9fa48("5403")) {
                    {}
                  } else {
                    stryCov_9fa48("5403");
                    logger.warn(stryMutAct_9fa48("5404") ? "" : (stryCov_9fa48("5404"), 'Native activate+paste timed out, attempting graceful fallback'));
                    pasteWithNativeTool().then(resolve).catch(reject);
                  }
                } else {
                  if (stryMutAct_9fa48("5405")) {
                    {}
                  } else {
                    stryCov_9fa48("5405");
                    logger.error(stryMutAct_9fa48("5406") ? "" : (stryCov_9fa48("5406"), 'Native activate and paste error:'), stryMutAct_9fa48("5407") ? {} : (stryCov_9fa48("5407"), {
                      error: error.message,
                      code: error.code,
                      signal: error.signal,
                      stderr,
                      executable: KEYBOARD_SIMULATOR_PATH,
                      args,
                      appName,
                      bundleId
                    }));
                    reject(error);
                  }
                }
              }
            } else {
              if (stryMutAct_9fa48("5408")) {
                {}
              } else {
                stryCov_9fa48("5408");
                try {
                  if (stryMutAct_9fa48("5409")) {
                    {}
                  } else {
                    stryCov_9fa48("5409");
                    const result = JSON.parse(stryMutAct_9fa48("5410") ? stdout : (stryCov_9fa48("5410"), stdout.trim()));
                    if (stryMutAct_9fa48("5412") ? false : stryMutAct_9fa48("5411") ? true : (stryCov_9fa48("5411", "5412"), result.success)) {
                      if (stryMutAct_9fa48("5413")) {
                        {}
                      } else {
                        stryCov_9fa48("5413");
                        logger.debug(stryMutAct_9fa48("5414") ? "" : (stryCov_9fa48("5414"), 'Native activate and paste successful'), stryMutAct_9fa48("5415") ? {} : (stryCov_9fa48("5415"), {
                          appName,
                          bundleId
                        }));
                        resolve();
                      }
                    } else {
                      if (stryMutAct_9fa48("5416")) {
                        {}
                      } else {
                        stryCov_9fa48("5416");
                        logger.error(stryMutAct_9fa48("5417") ? "" : (stryCov_9fa48("5417"), 'Native activate and paste failed:'), result);
                        reject(new Error(stryMutAct_9fa48("5418") ? "" : (stryCov_9fa48("5418"), 'Native activate and paste failed')));
                      }
                    }
                  }
                } catch (parseError) {
                  if (stryMutAct_9fa48("5419")) {
                    {}
                  } else {
                    stryCov_9fa48("5419");
                    logger.warn(stryMutAct_9fa48("5420") ? "" : (stryCov_9fa48("5420"), 'Error parsing native activate+paste result:'), parseError);
                    resolve();
                  }
                }
              }
            }
          }
        });
      }
    });
  }
}