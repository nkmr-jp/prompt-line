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
import type { DirectoryInfo } from '../../types';
import { TIMEOUTS } from '../../constants';
import { logger } from '../logger';
import { DIRECTORY_DETECTOR_PATH, FILE_SEARCHER_PATH } from './paths';

/**
 * Options for directory detection with source app override
 */
export interface DirectoryDetectionOptions {
  /** Source app PID (for when Prompt Line window is in front) */
  pid?: number;
  /** Source app bundle ID */
  bundleId?: string;
}

/**
 * Detect current directory from active terminal (Terminal.app or iTerm2)
 * @param options - Optional PID and bundleId to override frontmost app detection
 * @returns Promise<DirectoryInfo> - Object with directory info or error
 */
export function detectCurrentDirectory(options?: DirectoryDetectionOptions): Promise<DirectoryInfo> {
  if (stryMutAct_9fa48("5165")) {
    {}
  } else {
    stryCov_9fa48("5165");
    return new Promise(resolve => {
      if (stryMutAct_9fa48("5166")) {
        {}
      } else {
        stryCov_9fa48("5166");
        if (stryMutAct_9fa48("5169") ? process.platform === 'darwin' : stryMutAct_9fa48("5168") ? false : stryMutAct_9fa48("5167") ? true : (stryCov_9fa48("5167", "5168", "5169"), process.platform !== (stryMutAct_9fa48("5170") ? "" : (stryCov_9fa48("5170"), 'darwin')))) {
          if (stryMutAct_9fa48("5171")) {
            {}
          } else {
            stryCov_9fa48("5171");
            resolve(stryMutAct_9fa48("5172") ? {} : (stryCov_9fa48("5172"), {
              error: stryMutAct_9fa48("5173") ? "" : (stryCov_9fa48("5173"), 'Directory detection only supported on macOS')
            }));
            return;
          }
        }
        const execOptions = stryMutAct_9fa48("5174") ? {} : (stryCov_9fa48("5174"), {
          timeout: TIMEOUTS.WINDOW_BOUNDS_TIMEOUT,
          killSignal: 'SIGTERM' as const
        });

        // Build args array with optional PID and/or bundleId arguments
        // bundleId alone is supported - Swift will look up the PID
        const args: string[] = stryMutAct_9fa48("5175") ? [] : (stryCov_9fa48("5175"), [stryMutAct_9fa48("5176") ? "" : (stryCov_9fa48("5176"), 'detect')]);
        if (stryMutAct_9fa48("5179") ? options.bundleId : stryMutAct_9fa48("5178") ? false : stryMutAct_9fa48("5177") ? true : (stryCov_9fa48("5177", "5178", "5179"), options?.bundleId)) {
          if (stryMutAct_9fa48("5180")) {
            {}
          } else {
            stryCov_9fa48("5180");
            args.push(stryMutAct_9fa48("5181") ? "" : (stryCov_9fa48("5181"), '--bundleId'), options.bundleId);
            if (stryMutAct_9fa48("5184") ? options.pid : stryMutAct_9fa48("5183") ? false : stryMutAct_9fa48("5182") ? true : (stryCov_9fa48("5182", "5183", "5184"), options?.pid)) {
              if (stryMutAct_9fa48("5185")) {
                {}
              } else {
                stryCov_9fa48("5185");
                args.push(stryMutAct_9fa48("5186") ? "" : (stryCov_9fa48("5186"), '--pid'), String(options.pid));
              }
            }
          }
        }
        execFile(DIRECTORY_DETECTOR_PATH, args, execOptions, (error, stdout) => {
          if (stryMutAct_9fa48("5187")) {
            {}
          } else {
            stryCov_9fa48("5187");
            if (stryMutAct_9fa48("5189") ? false : stryMutAct_9fa48("5188") ? true : (stryCov_9fa48("5188", "5189"), error)) {
              if (stryMutAct_9fa48("5190")) {
                {}
              } else {
                stryCov_9fa48("5190");
                logger.warn(stryMutAct_9fa48("5191") ? "" : (stryCov_9fa48("5191"), 'Error detecting current directory (non-blocking):'), error.message);
                resolve(stryMutAct_9fa48("5192") ? {} : (stryCov_9fa48("5192"), {
                  error: error.message
                }));
              }
            } else {
              if (stryMutAct_9fa48("5193")) {
                {}
              } else {
                stryCov_9fa48("5193");
                try {
                  if (stryMutAct_9fa48("5194")) {
                    {}
                  } else {
                    stryCov_9fa48("5194");
                    const result = JSON.parse(stdout.trim()) as DirectoryInfo;
                    if (stryMutAct_9fa48("5196") ? false : stryMutAct_9fa48("5195") ? true : (stryCov_9fa48("5195", "5196"), result.error)) {
                      if (stryMutAct_9fa48("5197")) {
                        {}
                      } else {
                        stryCov_9fa48("5197");
                        logger.debug(stryMutAct_9fa48("5198") ? "" : (stryCov_9fa48("5198"), 'Directory detection returned error:'), result.error);
                      }
                    } else {
                      if (stryMutAct_9fa48("5199")) {
                        {}
                      } else {
                        stryCov_9fa48("5199");
                        logger.debug(stryMutAct_9fa48("5200") ? "" : (stryCov_9fa48("5200"), 'Current directory detected:'), result.directory);
                      }
                    }
                    resolve(result);
                  }
                } catch (parseError) {
                  if (stryMutAct_9fa48("5201")) {
                    {}
                  } else {
                    stryCov_9fa48("5201");
                    logger.warn(stryMutAct_9fa48("5202") ? "" : (stryCov_9fa48("5202"), 'Error parsing directory detection result:'), parseError);
                    resolve(stryMutAct_9fa48("5203") ? {} : (stryCov_9fa48("5203"), {
                      error: stryMutAct_9fa48("5204") ? "" : (stryCov_9fa48("5204"), 'Failed to parse directory detection result')
                    }));
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
 * List files in a specified directory using file-searcher native tool
 * @param directoryPath - Path to the directory to list
 * @returns Promise<DirectoryInfo> - Object with file list or error
 */
export function listDirectory(directoryPath: string): Promise<DirectoryInfo> {
  if (stryMutAct_9fa48("5205")) {
    {}
  } else {
    stryCov_9fa48("5205");
    return new Promise(resolve => {
      if (stryMutAct_9fa48("5206")) {
        {}
      } else {
        stryCov_9fa48("5206");
        if (stryMutAct_9fa48("5209") ? process.platform === 'darwin' : stryMutAct_9fa48("5208") ? false : stryMutAct_9fa48("5207") ? true : (stryCov_9fa48("5207", "5208", "5209"), process.platform !== (stryMutAct_9fa48("5210") ? "" : (stryCov_9fa48("5210"), 'darwin')))) {
          if (stryMutAct_9fa48("5211")) {
            {}
          } else {
            stryCov_9fa48("5211");
            resolve(stryMutAct_9fa48("5212") ? {} : (stryCov_9fa48("5212"), {
              error: stryMutAct_9fa48("5213") ? "" : (stryCov_9fa48("5213"), 'Directory listing only supported on macOS')
            }));
            return;
          }
        }

        // Validate path input
        if (stryMutAct_9fa48("5216") ? !directoryPath && typeof directoryPath !== 'string' : stryMutAct_9fa48("5215") ? false : stryMutAct_9fa48("5214") ? true : (stryCov_9fa48("5214", "5215", "5216"), (stryMutAct_9fa48("5217") ? directoryPath : (stryCov_9fa48("5217"), !directoryPath)) || (stryMutAct_9fa48("5219") ? typeof directoryPath === 'string' : stryMutAct_9fa48("5218") ? false : (stryCov_9fa48("5218", "5219"), typeof directoryPath !== (stryMutAct_9fa48("5220") ? "" : (stryCov_9fa48("5220"), 'string')))))) {
          if (stryMutAct_9fa48("5221")) {
            {}
          } else {
            stryCov_9fa48("5221");
            resolve(stryMutAct_9fa48("5222") ? {} : (stryCov_9fa48("5222"), {
              error: stryMutAct_9fa48("5223") ? "" : (stryCov_9fa48("5223"), 'Invalid directory path')
            }));
            return;
          }
        }

        // Sanitize path to prevent command injection
        const sanitizedPath = stryMutAct_9fa48("5224") ? directoryPath.replace(/[;&|`$(){}[\]<>"'\\*?~^]/g, '').replace(/\x00/g, '').replace(/[\r\n]/g, '') : (stryCov_9fa48("5224"), directoryPath.replace(stryMutAct_9fa48("5225") ? /[^;&|`$(){}[\]<>"'\\*?~^]/g : (stryCov_9fa48("5225"), /[;&|`$(){}[\]<>"'\\*?~^]/g), stryMutAct_9fa48("5226") ? "Stryker was here!" : (stryCov_9fa48("5226"), '')).replace(/\x00/g, stryMutAct_9fa48("5227") ? "Stryker was here!" : (stryCov_9fa48("5227"), '')).replace(stryMutAct_9fa48("5228") ? /[^\r\n]/g : (stryCov_9fa48("5228"), /[\r\n]/g), stryMutAct_9fa48("5229") ? "Stryker was here!" : (stryCov_9fa48("5229"), '')).trim());
        if (stryMutAct_9fa48("5232") ? sanitizedPath.length !== 0 : stryMutAct_9fa48("5231") ? false : stryMutAct_9fa48("5230") ? true : (stryCov_9fa48("5230", "5231", "5232"), sanitizedPath.length === 0)) {
          if (stryMutAct_9fa48("5233")) {
            {}
          } else {
            stryCov_9fa48("5233");
            resolve(stryMutAct_9fa48("5234") ? {} : (stryCov_9fa48("5234"), {
              error: stryMutAct_9fa48("5235") ? "" : (stryCov_9fa48("5235"), 'Directory path is empty after sanitization')
            }));
            return;
          }
        }
        const options = stryMutAct_9fa48("5236") ? {} : (stryCov_9fa48("5236"), {
          timeout: TIMEOUTS.WINDOW_BOUNDS_TIMEOUT,
          killSignal: 'SIGTERM' as const
        });

        // Use file-searcher native tool for file listing
        execFile(FILE_SEARCHER_PATH, stryMutAct_9fa48("5237") ? [] : (stryCov_9fa48("5237"), [stryMutAct_9fa48("5238") ? "" : (stryCov_9fa48("5238"), 'list'), sanitizedPath]), options, (error, stdout) => {
          if (stryMutAct_9fa48("5239")) {
            {}
          } else {
            stryCov_9fa48("5239");
            if (stryMutAct_9fa48("5241") ? false : stryMutAct_9fa48("5240") ? true : (stryCov_9fa48("5240", "5241"), error)) {
              if (stryMutAct_9fa48("5242")) {
                {}
              } else {
                stryCov_9fa48("5242");
                logger.warn(stryMutAct_9fa48("5243") ? "" : (stryCov_9fa48("5243"), 'Error listing directory (non-blocking):'), error.message);
                resolve(stryMutAct_9fa48("5244") ? {} : (stryCov_9fa48("5244"), {
                  error: error.message
                }));
              }
            } else {
              if (stryMutAct_9fa48("5245")) {
                {}
              } else {
                stryCov_9fa48("5245");
                try {
                  if (stryMutAct_9fa48("5246")) {
                    {}
                  } else {
                    stryCov_9fa48("5246");
                    const result = JSON.parse(stdout.trim()) as DirectoryInfo;
                    if (stryMutAct_9fa48("5248") ? false : stryMutAct_9fa48("5247") ? true : (stryCov_9fa48("5247", "5248"), result.error)) {
                      if (stryMutAct_9fa48("5249")) {
                        {}
                      } else {
                        stryCov_9fa48("5249");
                        logger.debug(stryMutAct_9fa48("5250") ? "" : (stryCov_9fa48("5250"), 'Directory listing returned error:'), result.error);
                      }
                    } else {
                      if (stryMutAct_9fa48("5251")) {
                        {}
                      } else {
                        stryCov_9fa48("5251");
                        logger.debug(stryMutAct_9fa48("5252") ? "" : (stryCov_9fa48("5252"), 'Directory listed:'), stryMutAct_9fa48("5253") ? {} : (stryCov_9fa48("5253"), {
                          directory: result.directory,
                          fileCount: result.fileCount
                        }));
                      }
                    }
                    resolve(result);
                  }
                } catch (parseError) {
                  if (stryMutAct_9fa48("5254")) {
                    {}
                  } else {
                    stryCov_9fa48("5254");
                    logger.warn(stryMutAct_9fa48("5255") ? "" : (stryCov_9fa48("5255"), 'Error parsing directory listing result:'), parseError);
                    resolve(stryMutAct_9fa48("5256") ? {} : (stryCov_9fa48("5256"), {
                      error: stryMutAct_9fa48("5257") ? "" : (stryCov_9fa48("5257"), 'Failed to parse directory listing result')
                    }));
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
 * Detect current directory from active terminal and list files
 * Uses separated tools: directory-detector for CWD, file-searcher for file listing
 * @param options - Optional PID and bundleId to override frontmost app detection
 * @returns Promise<DirectoryInfo> - Object with directory info and file list
 */
export async function detectCurrentDirectoryWithFiles(options?: DirectoryDetectionOptions): Promise<DirectoryInfo> {
  if (stryMutAct_9fa48("5258")) {
    {}
  } else {
    stryCov_9fa48("5258");
    if (stryMutAct_9fa48("5261") ? process.platform === 'darwin' : stryMutAct_9fa48("5260") ? false : stryMutAct_9fa48("5259") ? true : (stryCov_9fa48("5259", "5260", "5261"), process.platform !== (stryMutAct_9fa48("5262") ? "" : (stryCov_9fa48("5262"), 'darwin')))) {
      if (stryMutAct_9fa48("5263")) {
        {}
      } else {
        stryCov_9fa48("5263");
        return stryMutAct_9fa48("5264") ? {} : (stryCov_9fa48("5264"), {
          error: stryMutAct_9fa48("5265") ? "" : (stryCov_9fa48("5265"), 'Directory detection only supported on macOS')
        });
      }
    }

    // Step 1: Detect current directory using directory-detector
    const dirResult = await detectCurrentDirectory(options);
    if (stryMutAct_9fa48("5268") ? dirResult.error && !dirResult.directory : stryMutAct_9fa48("5267") ? false : stryMutAct_9fa48("5266") ? true : (stryCov_9fa48("5266", "5267", "5268"), dirResult.error || (stryMutAct_9fa48("5269") ? dirResult.directory : (stryCov_9fa48("5269"), !dirResult.directory)))) {
      if (stryMutAct_9fa48("5270")) {
        {}
      } else {
        stryCov_9fa48("5270");
        return dirResult;
      }
    }

    // Step 2: List files using file-searcher
    const fileResult = await listDirectory(dirResult.directory);
    if (stryMutAct_9fa48("5272") ? false : stryMutAct_9fa48("5271") ? true : (stryCov_9fa48("5271", "5272"), fileResult.error)) {
      if (stryMutAct_9fa48("5273")) {
        {}
      } else {
        stryCov_9fa48("5273");
        // Return directory info without files if file listing fails
        logger.warn(stryMutAct_9fa48("5274") ? "" : (stryCov_9fa48("5274"), 'File listing failed, returning directory only:'), fileResult.error);
        return dirResult;
      }
    }

    // Combine results - only add file properties if they exist
    const result: DirectoryInfo = stryMutAct_9fa48("5275") ? {} : (stryCov_9fa48("5275"), {
      ...dirResult
    });
    if (stryMutAct_9fa48("5277") ? false : stryMutAct_9fa48("5276") ? true : (stryCov_9fa48("5276", "5277"), fileResult.files)) result.files = fileResult.files;
    if (stryMutAct_9fa48("5280") ? fileResult.fileCount === undefined : stryMutAct_9fa48("5279") ? false : stryMutAct_9fa48("5278") ? true : (stryCov_9fa48("5278", "5279", "5280"), fileResult.fileCount !== undefined)) result.fileCount = fileResult.fileCount;
    if (stryMutAct_9fa48("5282") ? false : stryMutAct_9fa48("5281") ? true : (stryCov_9fa48("5281", "5282"), fileResult.searchMode)) result.searchMode = fileResult.searchMode;
    if (stryMutAct_9fa48("5285") ? fileResult.partial === undefined : stryMutAct_9fa48("5284") ? false : stryMutAct_9fa48("5283") ? true : (stryCov_9fa48("5283", "5284", "5285"), fileResult.partial !== undefined)) result.partial = fileResult.partial;
    return result;
  }
}