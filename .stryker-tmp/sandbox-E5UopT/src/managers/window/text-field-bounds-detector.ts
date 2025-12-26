/**
 * Text Field Bounds Detector
 *
 * Shared utility for detecting focused text field bounds using native macOS tools.
 * This module consolidates the duplicate getActiveTextFieldBounds implementations
 * from NativeToolExecutor and WindowPositionCalculator.
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
import { logger, TEXT_FIELD_DETECTOR_PATH } from '../../utils/utils';
import config from '../../config/app-config';
import type { TextFieldBounds } from './types';

/**
 * Detects the bounds of the currently focused text field on macOS.
 * Uses a native Swift tool to query accessibility APIs for text field location.
 *
 * @returns Promise resolving to text field bounds, or null if not found/not macOS
 */
export async function getActiveTextFieldBounds(): Promise<TextFieldBounds | null> {
  if (stryMutAct_9fa48("4398")) {
    {}
  } else {
    stryCov_9fa48("4398");
    if (stryMutAct_9fa48("4401") ? false : stryMutAct_9fa48("4400") ? true : stryMutAct_9fa48("4399") ? config.platform.isMac : (stryCov_9fa48("4399", "4400", "4401"), !config.platform.isMac)) {
      if (stryMutAct_9fa48("4402")) {
        {}
      } else {
        stryCov_9fa48("4402");
        logger.debug(stryMutAct_9fa48("4403") ? "" : (stryCov_9fa48("4403"), 'Text field detection only supported on macOS'));
        return null;
      }
    }
    const options = stryMutAct_9fa48("4404") ? {} : (stryCov_9fa48("4404"), {
      timeout: 3000,
      killSignal: 'SIGTERM' as const
    });
    return new Promise(resolve => {
      if (stryMutAct_9fa48("4405")) {
        {}
      } else {
        stryCov_9fa48("4405");
        execFile(TEXT_FIELD_DETECTOR_PATH, stryMutAct_9fa48("4406") ? [] : (stryCov_9fa48("4406"), [stryMutAct_9fa48("4407") ? "" : (stryCov_9fa48("4407"), 'text-field-bounds')]), options, (error: Error | null, stdout?: string) => {
          if (stryMutAct_9fa48("4408")) {
            {}
          } else {
            stryCov_9fa48("4408");
            if (stryMutAct_9fa48("4410") ? false : stryMutAct_9fa48("4409") ? true : (stryCov_9fa48("4409", "4410"), error)) {
              if (stryMutAct_9fa48("4411")) {
                {}
              } else {
                stryCov_9fa48("4411");
                logger.debug(stryMutAct_9fa48("4412") ? "" : (stryCov_9fa48("4412"), 'Error getting text field bounds via native tool:'), error);
                resolve(null);
                return;
              }
            }
            try {
              if (stryMutAct_9fa48("4413")) {
                {}
              } else {
                stryCov_9fa48("4413");
                const result = JSON.parse(stryMutAct_9fa48("4416") ? stdout?.trim() && '{}' : stryMutAct_9fa48("4415") ? false : stryMutAct_9fa48("4414") ? true : (stryCov_9fa48("4414", "4415", "4416"), (stryMutAct_9fa48("4418") ? stdout.trim() : stryMutAct_9fa48("4417") ? stdout : (stryCov_9fa48("4417", "4418"), stdout?.trim())) || (stryMutAct_9fa48("4419") ? "" : (stryCov_9fa48("4419"), '{}'))));
                if (stryMutAct_9fa48("4421") ? false : stryMutAct_9fa48("4420") ? true : (stryCov_9fa48("4420", "4421"), result.error)) {
                  if (stryMutAct_9fa48("4422")) {
                    {}
                  } else {
                    stryCov_9fa48("4422");
                    logger.debug(stryMutAct_9fa48("4423") ? "" : (stryCov_9fa48("4423"), 'Text field detector error:'), result.error);
                    resolve(null);
                    return;
                  }
                }
                if (stryMutAct_9fa48("4426") ? result.success && typeof result.x === 'number' && typeof result.y === 'number' && typeof result.width === 'number' || typeof result.height === 'number' : stryMutAct_9fa48("4425") ? false : stryMutAct_9fa48("4424") ? true : (stryCov_9fa48("4424", "4425", "4426"), (stryMutAct_9fa48("4428") ? result.success && typeof result.x === 'number' && typeof result.y === 'number' || typeof result.width === 'number' : stryMutAct_9fa48("4427") ? true : (stryCov_9fa48("4427", "4428"), (stryMutAct_9fa48("4430") ? result.success && typeof result.x === 'number' || typeof result.y === 'number' : stryMutAct_9fa48("4429") ? true : (stryCov_9fa48("4429", "4430"), (stryMutAct_9fa48("4432") ? result.success || typeof result.x === 'number' : stryMutAct_9fa48("4431") ? true : (stryCov_9fa48("4431", "4432"), result.success && (stryMutAct_9fa48("4434") ? typeof result.x !== 'number' : stryMutAct_9fa48("4433") ? true : (stryCov_9fa48("4433", "4434"), typeof result.x === (stryMutAct_9fa48("4435") ? "" : (stryCov_9fa48("4435"), 'number')))))) && (stryMutAct_9fa48("4437") ? typeof result.y !== 'number' : stryMutAct_9fa48("4436") ? true : (stryCov_9fa48("4436", "4437"), typeof result.y === (stryMutAct_9fa48("4438") ? "" : (stryCov_9fa48("4438"), 'number')))))) && (stryMutAct_9fa48("4440") ? typeof result.width !== 'number' : stryMutAct_9fa48("4439") ? true : (stryCov_9fa48("4439", "4440"), typeof result.width === (stryMutAct_9fa48("4441") ? "" : (stryCov_9fa48("4441"), 'number')))))) && (stryMutAct_9fa48("4443") ? typeof result.height !== 'number' : stryMutAct_9fa48("4442") ? true : (stryCov_9fa48("4442", "4443"), typeof result.height === (stryMutAct_9fa48("4444") ? "" : (stryCov_9fa48("4444"), 'number')))))) {
                  if (stryMutAct_9fa48("4445")) {
                    {}
                  } else {
                    stryCov_9fa48("4445");
                    let bounds: TextFieldBounds = stryMutAct_9fa48("4446") ? {} : (stryCov_9fa48("4446"), {
                      x: result.x,
                      y: result.y,
                      width: result.width,
                      height: result.height
                    });

                    // Use parent container bounds if available for better positioning with scrollable content
                    if (stryMutAct_9fa48("4449") ? result.parent && result.parent.isVisibleContainer && typeof result.parent.x === 'number' && typeof result.parent.y === 'number' && typeof result.parent.width === 'number' || typeof result.parent.height === 'number' : stryMutAct_9fa48("4448") ? false : stryMutAct_9fa48("4447") ? true : (stryCov_9fa48("4447", "4448", "4449"), (stryMutAct_9fa48("4451") ? result.parent && result.parent.isVisibleContainer && typeof result.parent.x === 'number' && typeof result.parent.y === 'number' || typeof result.parent.width === 'number' : stryMutAct_9fa48("4450") ? true : (stryCov_9fa48("4450", "4451"), (stryMutAct_9fa48("4453") ? result.parent && result.parent.isVisibleContainer && typeof result.parent.x === 'number' || typeof result.parent.y === 'number' : stryMutAct_9fa48("4452") ? true : (stryCov_9fa48("4452", "4453"), (stryMutAct_9fa48("4455") ? result.parent && result.parent.isVisibleContainer || typeof result.parent.x === 'number' : stryMutAct_9fa48("4454") ? true : (stryCov_9fa48("4454", "4455"), (stryMutAct_9fa48("4457") ? result.parent || result.parent.isVisibleContainer : stryMutAct_9fa48("4456") ? true : (stryCov_9fa48("4456", "4457"), result.parent && result.parent.isVisibleContainer)) && (stryMutAct_9fa48("4459") ? typeof result.parent.x !== 'number' : stryMutAct_9fa48("4458") ? true : (stryCov_9fa48("4458", "4459"), typeof result.parent.x === (stryMutAct_9fa48("4460") ? "" : (stryCov_9fa48("4460"), 'number')))))) && (stryMutAct_9fa48("4462") ? typeof result.parent.y !== 'number' : stryMutAct_9fa48("4461") ? true : (stryCov_9fa48("4461", "4462"), typeof result.parent.y === (stryMutAct_9fa48("4463") ? "" : (stryCov_9fa48("4463"), 'number')))))) && (stryMutAct_9fa48("4465") ? typeof result.parent.width !== 'number' : stryMutAct_9fa48("4464") ? true : (stryCov_9fa48("4464", "4465"), typeof result.parent.width === (stryMutAct_9fa48("4466") ? "" : (stryCov_9fa48("4466"), 'number')))))) && (stryMutAct_9fa48("4468") ? typeof result.parent.height !== 'number' : stryMutAct_9fa48("4467") ? true : (stryCov_9fa48("4467", "4468"), typeof result.parent.height === (stryMutAct_9fa48("4469") ? "" : (stryCov_9fa48("4469"), 'number')))))) {
                      if (stryMutAct_9fa48("4470")) {
                        {}
                      } else {
                        stryCov_9fa48("4470");
                        logger.debug(stryMutAct_9fa48("4471") ? "" : (stryCov_9fa48("4471"), 'Using parent container bounds for scrollable text field'));
                        bounds = stryMutAct_9fa48("4472") ? {} : (stryCov_9fa48("4472"), {
                          x: result.parent.x,
                          y: result.parent.y,
                          width: result.parent.width,
                          height: result.parent.height
                        });
                      }
                    }
                    logger.debug(stryMutAct_9fa48("4473") ? "" : (stryCov_9fa48("4473"), 'Text field bounds found:'), bounds);
                    resolve(bounds);
                    return;
                  }
                }
                logger.debug(stryMutAct_9fa48("4474") ? "" : (stryCov_9fa48("4474"), 'Invalid text field bounds data received'));
                resolve(null);
              }
            } catch (parseError) {
              if (stryMutAct_9fa48("4475")) {
                {}
              } else {
                stryCov_9fa48("4475");
                logger.debug(stryMutAct_9fa48("4476") ? "" : (stryCov_9fa48("4476"), 'Error parsing text field detector output:'), parseError);
                resolve(null);
              }
            }
          }
        });
      }
    });
  }
}