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
import { logger, KEYBOARD_SIMULATOR_PATH } from '../../utils/utils';
import config from '../../config/app-config';
import type { AppInfo } from '../../types';

/**
 * NativeToolExecutor handles execution of native macOS tools for window management
 * Extracted from WindowManager to improve code organization and testability
 *
 * Note: Text field bounds detection is now handled by text-field-bounds-detector.ts
 */
class NativeToolExecutor {
  private previousApp: AppInfo | string | null = null;

  /**
   * Focus the previously active application using native keyboard-simulator tool
   * Supports both bundle ID (preferred) and app name fallback
   * @returns Promise<boolean> indicating success
   */
  async focusPreviousApp(): Promise<boolean> {
    if (stryMutAct_9fa48("4076")) {
      {}
    } else {
      stryCov_9fa48("4076");
      try {
        if (stryMutAct_9fa48("4077")) {
          {}
        } else {
          stryCov_9fa48("4077");
          if (stryMutAct_9fa48("4080") ? !this.previousApp && !config.platform.isMac : stryMutAct_9fa48("4079") ? false : stryMutAct_9fa48("4078") ? true : (stryCov_9fa48("4078", "4079", "4080"), (stryMutAct_9fa48("4081") ? this.previousApp : (stryCov_9fa48("4081"), !this.previousApp)) || (stryMutAct_9fa48("4082") ? config.platform.isMac : (stryCov_9fa48("4082"), !config.platform.isMac)))) {
            if (stryMutAct_9fa48("4083")) {
              {}
            } else {
              stryCov_9fa48("4083");
              logger.debug(stryMutAct_9fa48("4084") ? "" : (stryCov_9fa48("4084"), 'No previous app to focus or not on macOS'));
              return stryMutAct_9fa48("4085") ? true : (stryCov_9fa48("4085"), false);
            }
          }
          let appName: string;
          let bundleId: string | null = null;
          if (stryMutAct_9fa48("4088") ? typeof this.previousApp !== 'string' : stryMutAct_9fa48("4087") ? false : stryMutAct_9fa48("4086") ? true : (stryCov_9fa48("4086", "4087", "4088"), typeof this.previousApp === (stryMutAct_9fa48("4089") ? "" : (stryCov_9fa48("4089"), 'string')))) {
            if (stryMutAct_9fa48("4090")) {
              {}
            } else {
              stryCov_9fa48("4090");
              appName = this.previousApp;
            }
          } else if (stryMutAct_9fa48("4093") ? this.previousApp || typeof this.previousApp === 'object' : stryMutAct_9fa48("4092") ? false : stryMutAct_9fa48("4091") ? true : (stryCov_9fa48("4091", "4092", "4093"), this.previousApp && (stryMutAct_9fa48("4095") ? typeof this.previousApp !== 'object' : stryMutAct_9fa48("4094") ? true : (stryCov_9fa48("4094", "4095"), typeof this.previousApp === (stryMutAct_9fa48("4096") ? "" : (stryCov_9fa48("4096"), 'object')))))) {
            if (stryMutAct_9fa48("4097")) {
              {}
            } else {
              stryCov_9fa48("4097");
              appName = this.previousApp.name;
              bundleId = stryMutAct_9fa48("4100") ? this.previousApp.bundleId && null : stryMutAct_9fa48("4099") ? false : stryMutAct_9fa48("4098") ? true : (stryCov_9fa48("4098", "4099", "4100"), this.previousApp.bundleId || null);
            }
          } else {
            if (stryMutAct_9fa48("4101")) {
              {}
            } else {
              stryCov_9fa48("4101");
              logger.error(stryMutAct_9fa48("4102") ? "" : (stryCov_9fa48("4102"), 'Invalid previousApp format:'), this.previousApp);
              return stryMutAct_9fa48("4103") ? true : (stryCov_9fa48("4103"), false);
            }
          }
          const options = stryMutAct_9fa48("4104") ? {} : (stryCov_9fa48("4104"), {
            timeout: 3000,
            killSignal: 'SIGTERM' as const
          });
          let args: string[];
          if (stryMutAct_9fa48("4106") ? false : stryMutAct_9fa48("4105") ? true : (stryCov_9fa48("4105", "4106"), bundleId)) {
            if (stryMutAct_9fa48("4107")) {
              {}
            } else {
              stryCov_9fa48("4107");
              args = stryMutAct_9fa48("4108") ? [] : (stryCov_9fa48("4108"), [stryMutAct_9fa48("4109") ? "" : (stryCov_9fa48("4109"), 'activate-bundle'), bundleId]);
              logger.debug(stryMutAct_9fa48("4110") ? "" : (stryCov_9fa48("4110"), 'Using bundle ID for app activation:'), stryMutAct_9fa48("4111") ? {} : (stryCov_9fa48("4111"), {
                appName,
                bundleId
              }));
            }
          } else {
            if (stryMutAct_9fa48("4112")) {
              {}
            } else {
              stryCov_9fa48("4112");
              args = stryMutAct_9fa48("4113") ? [] : (stryCov_9fa48("4113"), [stryMutAct_9fa48("4114") ? "" : (stryCov_9fa48("4114"), 'activate-name'), appName]);
              logger.debug(stryMutAct_9fa48("4115") ? "" : (stryCov_9fa48("4115"), 'Using app name for activation:'), stryMutAct_9fa48("4116") ? {} : (stryCov_9fa48("4116"), {
                appName
              }));
            }
          }
          return new Promise(resolve => {
            if (stryMutAct_9fa48("4117")) {
              {}
            } else {
              stryCov_9fa48("4117");
              execFile(KEYBOARD_SIMULATOR_PATH, args, options, (error: Error | null, stdout?: string) => {
                if (stryMutAct_9fa48("4118")) {
                  {}
                } else {
                  stryCov_9fa48("4118");
                  if (stryMutAct_9fa48("4120") ? false : stryMutAct_9fa48("4119") ? true : (stryCov_9fa48("4119", "4120"), error)) {
                    if (stryMutAct_9fa48("4121")) {
                      {}
                    } else {
                      stryCov_9fa48("4121");
                      logger.error(stryMutAct_9fa48("4122") ? "" : (stryCov_9fa48("4122"), 'Error focusing previous app:'), error);
                      resolve(stryMutAct_9fa48("4123") ? true : (stryCov_9fa48("4123"), false));
                    }
                  } else {
                    if (stryMutAct_9fa48("4124")) {
                      {}
                    } else {
                      stryCov_9fa48("4124");
                      try {
                        if (stryMutAct_9fa48("4125")) {
                          {}
                        } else {
                          stryCov_9fa48("4125");
                          const result = JSON.parse(stryMutAct_9fa48("4128") ? stdout?.trim() && '{}' : stryMutAct_9fa48("4127") ? false : stryMutAct_9fa48("4126") ? true : (stryCov_9fa48("4126", "4127", "4128"), (stryMutAct_9fa48("4130") ? stdout.trim() : stryMutAct_9fa48("4129") ? stdout : (stryCov_9fa48("4129", "4130"), stdout?.trim())) || (stryMutAct_9fa48("4131") ? "" : (stryCov_9fa48("4131"), '{}'))));
                          if (stryMutAct_9fa48("4133") ? false : stryMutAct_9fa48("4132") ? true : (stryCov_9fa48("4132", "4133"), result.success)) {
                            if (stryMutAct_9fa48("4134")) {
                              {}
                            } else {
                              stryCov_9fa48("4134");
                              logger.debug(stryMutAct_9fa48("4135") ? "" : (stryCov_9fa48("4135"), 'Successfully focused previous app:'), stryMutAct_9fa48("4136") ? {} : (stryCov_9fa48("4136"), {
                                appName,
                                bundleId
                              }));
                              resolve(stryMutAct_9fa48("4137") ? false : (stryCov_9fa48("4137"), true));
                            }
                          } else {
                            if (stryMutAct_9fa48("4138")) {
                              {}
                            } else {
                              stryCov_9fa48("4138");
                              logger.warn(stryMutAct_9fa48("4139") ? "" : (stryCov_9fa48("4139"), 'Native tool failed to focus app:'), result);
                              resolve(stryMutAct_9fa48("4140") ? true : (stryCov_9fa48("4140"), false));
                            }
                          }
                        }
                      } catch (parseError) {
                        if (stryMutAct_9fa48("4141")) {
                          {}
                        } else {
                          stryCov_9fa48("4141");
                          logger.warn(stryMutAct_9fa48("4142") ? "" : (stryCov_9fa48("4142"), 'Error parsing focus app result:'), parseError);
                          resolve(stryMutAct_9fa48("4143") ? true : (stryCov_9fa48("4143"), false));
                        }
                      }
                    }
                  }
                }
              });
            }
          });
        }
      } catch (error) {
        if (stryMutAct_9fa48("4144")) {
          {}
        } else {
          stryCov_9fa48("4144");
          logger.error(stryMutAct_9fa48("4145") ? "" : (stryCov_9fa48("4145"), 'Failed to focus previous app:'), error);
          return stryMutAct_9fa48("4146") ? true : (stryCov_9fa48("4146"), false);
        }
      }
    }
  }

  /**
   * Store the previously active application for later restoration
   * @param app App info (name + bundleId) or just app name
   */
  setPreviousApp(app: AppInfo | string | null): void {
    if (stryMutAct_9fa48("4147")) {
      {}
    } else {
      stryCov_9fa48("4147");
      this.previousApp = app;
      logger.debug(stryMutAct_9fa48("4148") ? "" : (stryCov_9fa48("4148"), 'Previous app stored:'), app);
    }
  }

  /**
   * Get the stored previous app
   * @returns Stored app info or null
   */
  getPreviousApp(): AppInfo | string | null {
    if (stryMutAct_9fa48("4149")) {
      {}
    } else {
      stryCov_9fa48("4149");
      return this.previousApp;
    }
  }
}
export default NativeToolExecutor;