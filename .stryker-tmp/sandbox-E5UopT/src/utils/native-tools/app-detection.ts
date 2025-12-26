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
import { app } from 'electron';
import type { AppInfo, WindowBounds } from '../../types';
import { TIMEOUTS } from '../../constants';
import { executeAppleScriptSafely, validateAppleScriptSecurity } from '../apple-script-sanitizer';
import { logger } from '../logger';
import { WINDOW_DETECTOR_PATH } from './paths';

// Accessibility permission check result
interface AccessibilityStatus {
  hasPermission: boolean;
  bundleId: string;
}
export function getCurrentApp(): Promise<AppInfo | null> {
  if (stryMutAct_9fa48("5045")) {
    {}
  } else {
    stryCov_9fa48("5045");
    const startTime = performance.now();
    logger.debug(stryMutAct_9fa48("5046") ? "" : (stryCov_9fa48("5046"), 'Starting getCurrentApp()'));
    return new Promise(resolve => {
      if (stryMutAct_9fa48("5047")) {
        {}
      } else {
        stryCov_9fa48("5047");
        if (stryMutAct_9fa48("5050") ? process.platform === 'darwin' : stryMutAct_9fa48("5049") ? false : stryMutAct_9fa48("5048") ? true : (stryCov_9fa48("5048", "5049", "5050"), process.platform !== (stryMutAct_9fa48("5051") ? "" : (stryCov_9fa48("5051"), 'darwin')))) {
          if (stryMutAct_9fa48("5052")) {
            {}
          } else {
            stryCov_9fa48("5052");
            logger.debug(stryMutAct_9fa48("5053") ? `` : (stryCov_9fa48("5053"), `Platform check (non-darwin): ${(stryMutAct_9fa48("5054") ? performance.now() + startTime : (stryCov_9fa48("5054"), performance.now() - startTime)).toFixed(2)}ms`));
            resolve(null);
            return;
          }
        }
        const options = stryMutAct_9fa48("5055") ? {} : (stryCov_9fa48("5055"), {
          timeout: TIMEOUTS.CURRENT_APP_TIMEOUT,
          killSignal: 'SIGTERM' as const
        });
        const execStartTime = performance.now();
        execFile(WINDOW_DETECTOR_PATH, stryMutAct_9fa48("5056") ? [] : (stryCov_9fa48("5056"), [stryMutAct_9fa48("5057") ? "" : (stryCov_9fa48("5057"), 'current-app')]), options, (error, stdout) => {
          if (stryMutAct_9fa48("5058")) {
            {}
          } else {
            stryCov_9fa48("5058");
            const execDuration = stryMutAct_9fa48("5059") ? performance.now() + execStartTime : (stryCov_9fa48("5059"), performance.now() - execStartTime);
            if (stryMutAct_9fa48("5061") ? false : stryMutAct_9fa48("5060") ? true : (stryCov_9fa48("5060", "5061"), error)) {
              if (stryMutAct_9fa48("5062")) {
                {}
              } else {
                stryCov_9fa48("5062");
                logger.warn(stryMutAct_9fa48("5063") ? "" : (stryCov_9fa48("5063"), 'Error getting current app (non-blocking):'), error.message);
                logger.debug(stryMutAct_9fa48("5064") ? `` : (stryCov_9fa48("5064"), `getCurrentApp exec (error): ${execDuration.toFixed(2)}ms`));
                logger.debug(stryMutAct_9fa48("5065") ? `` : (stryCov_9fa48("5065"), `Total getCurrentApp time (error): ${(stryMutAct_9fa48("5066") ? performance.now() + startTime : (stryCov_9fa48("5066"), performance.now() - startTime)).toFixed(2)}ms`));
                resolve(null);
              }
            } else {
              if (stryMutAct_9fa48("5067")) {
                {}
              } else {
                stryCov_9fa48("5067");
                try {
                  if (stryMutAct_9fa48("5068")) {
                    {}
                  } else {
                    stryCov_9fa48("5068");
                    const parseStartTime = performance.now();
                    const result = JSON.parse(stryMutAct_9fa48("5069") ? stdout : (stryCov_9fa48("5069"), stdout.trim()));
                    logger.debug(stryMutAct_9fa48("5070") ? `` : (stryCov_9fa48("5070"), `JSON parsing: ${(stryMutAct_9fa48("5071") ? performance.now() + parseStartTime : (stryCov_9fa48("5071"), performance.now() - parseStartTime)).toFixed(2)}ms`));
                    if (stryMutAct_9fa48("5073") ? false : stryMutAct_9fa48("5072") ? true : (stryCov_9fa48("5072", "5073"), result.error)) {
                      if (stryMutAct_9fa48("5074")) {
                        {}
                      } else {
                        stryCov_9fa48("5074");
                        logger.warn(stryMutAct_9fa48("5075") ? "" : (stryCov_9fa48("5075"), 'Native tool returned error:'), result.error);
                        logger.debug(stryMutAct_9fa48("5076") ? `` : (stryCov_9fa48("5076"), `getCurrentApp exec (tool error): ${execDuration.toFixed(2)}ms`));
                        logger.debug(stryMutAct_9fa48("5077") ? `` : (stryCov_9fa48("5077"), `Total getCurrentApp time (tool error): ${(stryMutAct_9fa48("5078") ? performance.now() + startTime : (stryCov_9fa48("5078"), performance.now() - startTime)).toFixed(2)}ms`));
                        resolve(null);
                        return;
                      }
                    }
                    const appInfo: AppInfo = stryMutAct_9fa48("5079") ? {} : (stryCov_9fa48("5079"), {
                      name: result.name,
                      bundleId: (stryMutAct_9fa48("5082") ? result.bundleId !== null : stryMutAct_9fa48("5081") ? false : stryMutAct_9fa48("5080") ? true : (stryCov_9fa48("5080", "5081", "5082"), result.bundleId === null)) ? null : result.bundleId
                    });
                    logger.debug(stryMutAct_9fa48("5083") ? `` : (stryCov_9fa48("5083"), `getCurrentApp exec (success): ${execDuration.toFixed(2)}ms`));
                    logger.debug(stryMutAct_9fa48("5084") ? `` : (stryCov_9fa48("5084"), `Total getCurrentApp time: ${(stryMutAct_9fa48("5085") ? performance.now() + startTime : (stryCov_9fa48("5085"), performance.now() - startTime)).toFixed(2)}ms`));
                    logger.debug(stryMutAct_9fa48("5086") ? "" : (stryCov_9fa48("5086"), 'Current app detected:'), appInfo);
                    resolve(appInfo);
                  }
                } catch (parseError) {
                  if (stryMutAct_9fa48("5087")) {
                    {}
                  } else {
                    stryCov_9fa48("5087");
                    logger.warn(stryMutAct_9fa48("5088") ? "" : (stryCov_9fa48("5088"), 'Error parsing app info:'), parseError);
                    logger.debug(stryMutAct_9fa48("5089") ? `` : (stryCov_9fa48("5089"), `getCurrentApp exec (parse error): ${execDuration.toFixed(2)}ms`));
                    logger.debug(stryMutAct_9fa48("5090") ? `` : (stryCov_9fa48("5090"), `Total getCurrentApp time (parse error): ${(stryMutAct_9fa48("5091") ? performance.now() + startTime : (stryCov_9fa48("5091"), performance.now() - startTime)).toFixed(2)}ms`));
                    resolve(null);
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
export function getActiveWindowBounds(): Promise<WindowBounds | null> {
  if (stryMutAct_9fa48("5092")) {
    {}
  } else {
    stryCov_9fa48("5092");
    return new Promise(resolve => {
      if (stryMutAct_9fa48("5093")) {
        {}
      } else {
        stryCov_9fa48("5093");
        if (stryMutAct_9fa48("5096") ? process.platform === 'darwin' : stryMutAct_9fa48("5095") ? false : stryMutAct_9fa48("5094") ? true : (stryCov_9fa48("5094", "5095", "5096"), process.platform !== (stryMutAct_9fa48("5097") ? "" : (stryCov_9fa48("5097"), 'darwin')))) {
          if (stryMutAct_9fa48("5098")) {
            {}
          } else {
            stryCov_9fa48("5098");
            resolve(null);
            return;
          }
        }
        const options = stryMutAct_9fa48("5099") ? {} : (stryCov_9fa48("5099"), {
          timeout: TIMEOUTS.WINDOW_BOUNDS_TIMEOUT,
          killSignal: 'SIGTERM' as const
        });
        execFile(WINDOW_DETECTOR_PATH, stryMutAct_9fa48("5100") ? [] : (stryCov_9fa48("5100"), [stryMutAct_9fa48("5101") ? "" : (stryCov_9fa48("5101"), 'window-bounds')]), options, (error, stdout) => {
          if (stryMutAct_9fa48("5102")) {
            {}
          } else {
            stryCov_9fa48("5102");
            if (stryMutAct_9fa48("5104") ? false : stryMutAct_9fa48("5103") ? true : (stryCov_9fa48("5103", "5104"), error)) {
              if (stryMutAct_9fa48("5105")) {
                {}
              } else {
                stryCov_9fa48("5105");
                logger.warn(stryMutAct_9fa48("5106") ? "" : (stryCov_9fa48("5106"), 'Error getting active window bounds (non-blocking):'), error.message);
                resolve(null);
              }
            } else {
              if (stryMutAct_9fa48("5107")) {
                {}
              } else {
                stryCov_9fa48("5107");
                try {
                  if (stryMutAct_9fa48("5108")) {
                    {}
                  } else {
                    stryCov_9fa48("5108");
                    const result = JSON.parse(stryMutAct_9fa48("5109") ? stdout : (stryCov_9fa48("5109"), stdout.trim()));
                    if (stryMutAct_9fa48("5111") ? false : stryMutAct_9fa48("5110") ? true : (stryCov_9fa48("5110", "5111"), result.error)) {
                      if (stryMutAct_9fa48("5112")) {
                        {}
                      } else {
                        stryCov_9fa48("5112");
                        logger.warn(stryMutAct_9fa48("5113") ? "" : (stryCov_9fa48("5113"), 'Native tool returned error for window bounds:'), result.error);
                        resolve(null);
                        return;
                      }
                    }
                    const windowBounds = stryMutAct_9fa48("5114") ? {} : (stryCov_9fa48("5114"), {
                      x: result.x,
                      y: result.y,
                      width: result.width,
                      height: result.height
                    });
                    if (stryMutAct_9fa48("5117") ? Object.values(windowBounds).every(val => typeof val !== 'number' || isNaN(val)) : stryMutAct_9fa48("5116") ? false : stryMutAct_9fa48("5115") ? true : (stryCov_9fa48("5115", "5116", "5117"), Object.values(windowBounds).some(stryMutAct_9fa48("5118") ? () => undefined : (stryCov_9fa48("5118"), val => stryMutAct_9fa48("5121") ? typeof val !== 'number' && isNaN(val) : stryMutAct_9fa48("5120") ? false : stryMutAct_9fa48("5119") ? true : (stryCov_9fa48("5119", "5120", "5121"), (stryMutAct_9fa48("5123") ? typeof val === 'number' : stryMutAct_9fa48("5122") ? false : (stryCov_9fa48("5122", "5123"), typeof val !== (stryMutAct_9fa48("5124") ? "" : (stryCov_9fa48("5124"), 'number')))) || isNaN(val)))))) {
                      if (stryMutAct_9fa48("5125")) {
                        {}
                      } else {
                        stryCov_9fa48("5125");
                        logger.warn(stryMutAct_9fa48("5126") ? "" : (stryCov_9fa48("5126"), 'Invalid numeric values in window bounds:'), result);
                        resolve(null);
                        return;
                      }
                    }
                    logger.debug(stryMutAct_9fa48("5127") ? "" : (stryCov_9fa48("5127"), 'Active window bounds detected:'), windowBounds);
                    resolve(windowBounds);
                  }
                } catch (parseError) {
                  if (stryMutAct_9fa48("5128")) {
                    {}
                  } else {
                    stryCov_9fa48("5128");
                    logger.warn(stryMutAct_9fa48("5129") ? "" : (stryCov_9fa48("5129"), 'Error parsing window bounds:'), parseError);
                    resolve(null);
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

/**
 * Check if the current application has accessibility permissions on macOS
 * @returns Promise<AccessibilityStatus> - Object with permission status and bundle ID
 */
export function checkAccessibilityPermission(): Promise<AccessibilityStatus> {
  if (stryMutAct_9fa48("5130")) {
    {}
  } else {
    stryCov_9fa48("5130");
    return new Promise(resolve => {
      if (stryMutAct_9fa48("5131")) {
        {}
      } else {
        stryCov_9fa48("5131");
        try {
          if (stryMutAct_9fa48("5132")) {
            {}
          } else {
            stryCov_9fa48("5132");
            // Get current app's bundle ID
            const bundleId = app.getApplicationInfoForProtocol ? stryMutAct_9fa48("5133") ? (app.getApplicationInfoForProtocol('prompt-line') as {
              bundleId?: string;
            }).bundleId : (stryCov_9fa48("5133"), (app.getApplicationInfoForProtocol('prompt-line') as {
              bundleId?: string;
            })?.bundleId) : stryMutAct_9fa48("5134") ? "" : (stryCov_9fa48("5134"), 'com.electron.prompt-line');
            const actualBundleId = stryMutAct_9fa48("5137") ? bundleId && 'com.electron.prompt-line' : stryMutAct_9fa48("5136") ? false : stryMutAct_9fa48("5135") ? true : (stryCov_9fa48("5135", "5136", "5137"), bundleId || (stryMutAct_9fa48("5138") ? "" : (stryCov_9fa48("5138"), 'com.electron.prompt-line')));

            // AppleScript to check if our app has accessibility permission
            const script = stryMutAct_9fa48("5139") ? `` : (stryCov_9fa48("5139"), `
        tell application "System Events"
          try
            -- Try to get accessibility status of our app
            set accessibilityEnabled to (accessibility enabled of application process "Prompt Line")
            return "true"
          on error errorMessage
            -- If we get a permission error, we don't have accessibility access
            if errorMessage contains "not allowed assistive access" or errorMessage contains "accessibility access" then
              return "false"
            else
              -- Other errors might indicate app not running or other issues
              -- Try a different approach by testing actual accessibility function
              try
                set frontApp to first application process whose frontmost is true
                return "true"
              on error
                return "false"
              end try
            end if
          end try
        end tell
      `);

            // Execute security check
            const securityWarnings = validateAppleScriptSecurity(script);
            if (stryMutAct_9fa48("5143") ? securityWarnings.length <= 0 : stryMutAct_9fa48("5142") ? securityWarnings.length >= 0 : stryMutAct_9fa48("5141") ? false : stryMutAct_9fa48("5140") ? true : (stryCov_9fa48("5140", "5141", "5142", "5143"), securityWarnings.length > 0)) {
              if (stryMutAct_9fa48("5144")) {
                {}
              } else {
                stryCov_9fa48("5144");
                logger.warn(stryMutAct_9fa48("5145") ? "" : (stryCov_9fa48("5145"), 'AppleScript security warnings detected'), stryMutAct_9fa48("5146") ? {} : (stryCov_9fa48("5146"), {
                  warnings: securityWarnings
                }));
              }
            }

            // Safe AppleScript execution
            executeAppleScriptSafely(script, TIMEOUTS.ACCESSIBILITY_CHECK_TIMEOUT).then(stdout => {
              if (stryMutAct_9fa48("5147")) {
                {}
              } else {
                stryCov_9fa48("5147");
                const result = stryMutAct_9fa48("5148") ? stdout : (stryCov_9fa48("5148"), stdout.trim());
                const hasPermission = stryMutAct_9fa48("5151") ? result !== 'true' : stryMutAct_9fa48("5150") ? false : stryMutAct_9fa48("5149") ? true : (stryCov_9fa48("5149", "5150", "5151"), result === (stryMutAct_9fa48("5152") ? "" : (stryCov_9fa48("5152"), 'true')));
                logger.debug(stryMutAct_9fa48("5153") ? "" : (stryCov_9fa48("5153"), 'Accessibility permission check result'), stryMutAct_9fa48("5154") ? {} : (stryCov_9fa48("5154"), {
                  hasPermission,
                  bundleId: actualBundleId,
                  rawResult: result
                }));
                resolve(stryMutAct_9fa48("5155") ? {} : (stryCov_9fa48("5155"), {
                  hasPermission,
                  bundleId: actualBundleId
                }));
              }
            }).catch(error => {
              if (stryMutAct_9fa48("5156")) {
                {}
              } else {
                stryCov_9fa48("5156");
                logger.warn(stryMutAct_9fa48("5157") ? "" : (stryCov_9fa48("5157"), 'Accessibility check failed with error, assuming no permission:'), error);
                resolve(stryMutAct_9fa48("5158") ? {} : (stryCov_9fa48("5158"), {
                  hasPermission: stryMutAct_9fa48("5159") ? true : (stryCov_9fa48("5159"), false),
                  bundleId: actualBundleId
                }));
              }
            });
          }
        } catch (error) {
          if (stryMutAct_9fa48("5160")) {
            {}
          } else {
            stryCov_9fa48("5160");
            logger.error(stryMutAct_9fa48("5161") ? "" : (stryCov_9fa48("5161"), 'Failed to check accessibility permission:'), error);
            resolve(stryMutAct_9fa48("5162") ? {} : (stryCov_9fa48("5162"), {
              hasPermission: stryMutAct_9fa48("5163") ? true : (stryCov_9fa48("5163"), false),
              bundleId: stryMutAct_9fa48("5164") ? "" : (stryCov_9fa48("5164"), 'com.electron.prompt-line')
            }));
          }
        }
      }
    });
  }
}