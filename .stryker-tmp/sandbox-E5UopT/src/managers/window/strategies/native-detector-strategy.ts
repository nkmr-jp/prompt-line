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
import config from '../../../config/app-config';
import { logger, DIRECTORY_DETECTOR_PATH, FILE_SEARCHER_PATH } from '../../../utils/utils';
import type { DirectoryInfo, FileSearchSettings, AppInfo } from '../../../types';
import type { IDirectoryDetectionStrategy } from './types';

/**
 * Native tool-based directory detection strategy
 * Uses compiled Swift binaries for macOS directory and file detection
 */
export class NativeDetectorStrategy implements IDirectoryDetectionStrategy {
  getName(): string {
    if (stryMutAct_9fa48("4253")) {
      {}
    } else {
      stryCov_9fa48("4253");
      return stryMutAct_9fa48("4254") ? "" : (stryCov_9fa48("4254"), 'Native');
    }
  }
  isAvailable(): boolean {
    if (stryMutAct_9fa48("4255")) {
      {}
    } else {
      stryCov_9fa48("4255");
      return config.platform.isMac;
    }
  }
  async detect(timeout: number, previousApp: AppInfo | string | null, fileSearchSettings: FileSearchSettings | null): Promise<DirectoryInfo | null> {
    if (stryMutAct_9fa48("4256")) {
      {}
    } else {
      stryCov_9fa48("4256");
      const startTime = performance.now();

      // Step 1: Detect directory using directory-detector
      const detectArgs: string[] = stryMutAct_9fa48("4257") ? [] : (stryCov_9fa48("4257"), [stryMutAct_9fa48("4258") ? "" : (stryCov_9fa48("4258"), 'detect')]);

      // Add bundleId if available for accurate directory detection
      if (stryMutAct_9fa48("4261") ? previousApp && typeof previousApp === 'object' || previousApp.bundleId : stryMutAct_9fa48("4260") ? false : stryMutAct_9fa48("4259") ? true : (stryCov_9fa48("4259", "4260", "4261"), (stryMutAct_9fa48("4263") ? previousApp || typeof previousApp === 'object' : stryMutAct_9fa48("4262") ? true : (stryCov_9fa48("4262", "4263"), previousApp && (stryMutAct_9fa48("4265") ? typeof previousApp !== 'object' : stryMutAct_9fa48("4264") ? true : (stryCov_9fa48("4264", "4265"), typeof previousApp === (stryMutAct_9fa48("4266") ? "" : (stryCov_9fa48("4266"), 'object')))))) && previousApp.bundleId)) {
        if (stryMutAct_9fa48("4267")) {
          {}
        } else {
          stryCov_9fa48("4267");
          detectArgs.push(stryMutAct_9fa48("4268") ? "" : (stryCov_9fa48("4268"), '--bundleId'), previousApp.bundleId);
        }
      }
      logger.debug(stryMutAct_9fa48("4269") ? "" : (stryCov_9fa48("4269"), 'Directory detector command:'), stryMutAct_9fa48("4270") ? {} : (stryCov_9fa48("4270"), {
        executable: DIRECTORY_DETECTOR_PATH,
        args: detectArgs
      }));
      const detectOptions = stryMutAct_9fa48("4271") ? {} : (stryCov_9fa48("4271"), {
        timeout: stryMutAct_9fa48("4272") ? Math.max(timeout, 3000) : (stryCov_9fa48("4272"), Math.min(timeout, 3000)),
        // Use shorter timeout for detection
        killSignal: 'SIGTERM' as const
      });
      return new Promise(resolve => {
        if (stryMutAct_9fa48("4273")) {
          {}
        } else {
          stryCov_9fa48("4273");
          execFile(DIRECTORY_DETECTOR_PATH, detectArgs, detectOptions, async (detectError: Error | null, detectStdout?: string) => {
            if (stryMutAct_9fa48("4274")) {
              {}
            } else {
              stryCov_9fa48("4274");
              const detectElapsed = stryMutAct_9fa48("4275") ? performance.now() + startTime : (stryCov_9fa48("4275"), performance.now() - startTime);
              if (stryMutAct_9fa48("4277") ? false : stryMutAct_9fa48("4276") ? true : (stryCov_9fa48("4276", "4277"), detectError)) {
                if (stryMutAct_9fa48("4278")) {
                  {}
                } else {
                  stryCov_9fa48("4278");
                  logger.warn(stryMutAct_9fa48("4279") ? `` : (stryCov_9fa48("4279"), `Directory detection failed after ${detectElapsed.toFixed(2)}ms:`), detectError);
                  resolve(null);
                  return;
                }
              }
              try {
                if (stryMutAct_9fa48("4280")) {
                  {}
                } else {
                  stryCov_9fa48("4280");
                  const detectResult = JSON.parse(detectStdout?.trim() || '{}') as DirectoryInfo;
                  if (stryMutAct_9fa48("4282") ? false : stryMutAct_9fa48("4281") ? true : (stryCov_9fa48("4281", "4282"), detectResult.error)) {
                    if (stryMutAct_9fa48("4283")) {
                      {}
                    } else {
                      stryCov_9fa48("4283");
                      logger.debug(stryMutAct_9fa48("4284") ? "" : (stryCov_9fa48("4284"), 'Directory detection returned error:'), detectResult.error);
                      resolve(detectResult); // Return result with error for logging
                      return;
                    }
                  }
                  if (stryMutAct_9fa48("4287") ? false : stryMutAct_9fa48("4286") ? true : stryMutAct_9fa48("4285") ? detectResult.directory : (stryCov_9fa48("4285", "4286", "4287"), !detectResult.directory)) {
                    if (stryMutAct_9fa48("4288")) {
                      {}
                    } else {
                      stryCov_9fa48("4288");
                      logger.debug(stryMutAct_9fa48("4289") ? "" : (stryCov_9fa48("4289"), 'No directory detected'));
                      resolve(null);
                      return;
                    }
                  }
                  logger.debug(stryMutAct_9fa48("4290") ? `` : (stryCov_9fa48("4290"), `⏱️  Directory detection completed in ${detectElapsed.toFixed(2)}ms`), stryMutAct_9fa48("4291") ? {} : (stryCov_9fa48("4291"), {
                    directory: detectResult.directory,
                    appName: detectResult.appName,
                    bundleId: detectResult.bundleId
                  }));

                  // Step 2: List files using file-searcher
                  const listArgs: string[] = stryMutAct_9fa48("4292") ? [] : (stryCov_9fa48("4292"), [stryMutAct_9fa48("4293") ? "" : (stryCov_9fa48("4293"), 'list'), detectResult.directory]);

                  // Apply file search settings if available
                  if (stryMutAct_9fa48("4295") ? false : stryMutAct_9fa48("4294") ? true : (stryCov_9fa48("4294", "4295"), fileSearchSettings)) {
                    if (stryMutAct_9fa48("4296")) {
                      {}
                    } else {
                      stryCov_9fa48("4296");
                      this.applyFileSearchSettings(listArgs, fileSearchSettings);
                    }
                  }
                  logger.debug(stryMutAct_9fa48("4297") ? "" : (stryCov_9fa48("4297"), 'File searcher command:'), stryMutAct_9fa48("4298") ? {} : (stryCov_9fa48("4298"), {
                    executable: FILE_SEARCHER_PATH,
                    args: listArgs
                  }));

                  // Calculate remaining timeout with minimum threshold
                  const remainingTimeout = Math.round(stryMutAct_9fa48("4299") ? Math.min(timeout - detectElapsed, 1000) : (stryCov_9fa48("4299"), Math.max(stryMutAct_9fa48("4300") ? timeout + detectElapsed : (stryCov_9fa48("4300"), timeout - detectElapsed), 1000)));
                  const listOptions = stryMutAct_9fa48("4301") ? {} : (stryCov_9fa48("4301"), {
                    timeout: remainingTimeout,
                    killSignal: 'SIGTERM' as const,
                    maxBuffer: stryMutAct_9fa48("4302") ? 50 * 1024 / 1024 : (stryCov_9fa48("4302"), (stryMutAct_9fa48("4303") ? 50 / 1024 : (stryCov_9fa48("4303"), 50 * 1024)) * 1024) // 50MB for large file lists
                  });
                  logger.debug(stryMutAct_9fa48("4304") ? "" : (stryCov_9fa48("4304"), 'Executing file searcher with timeout:'), stryMutAct_9fa48("4305") ? {} : (stryCov_9fa48("4305"), {
                    remainingTimeout
                  }));
                  try {
                    if (stryMutAct_9fa48("4306")) {
                      {}
                    } else {
                      stryCov_9fa48("4306");
                      execFile(FILE_SEARCHER_PATH, listArgs, listOptions, (listError: Error | null, listStdout?: string) => {
                        if (stryMutAct_9fa48("4307")) {
                          {}
                        } else {
                          stryCov_9fa48("4307");
                          const totalElapsed = stryMutAct_9fa48("4308") ? performance.now() + startTime : (stryCov_9fa48("4308"), performance.now() - startTime);

                          // Merge results
                          const result: DirectoryInfo = stryMutAct_9fa48("4309") ? {} : (stryCov_9fa48("4309"), {
                            ...detectResult
                          });
                          if (stryMutAct_9fa48("4311") ? false : stryMutAct_9fa48("4310") ? true : (stryCov_9fa48("4310", "4311"), listError)) {
                            if (stryMutAct_9fa48("4312")) {
                              {}
                            } else {
                              stryCov_9fa48("4312");
                              logger.warn(stryMutAct_9fa48("4313") ? `` : (stryCov_9fa48("4313"), `File listing failed after ${totalElapsed.toFixed(2)}ms:`), listError);
                              result.filesError = listError.message;
                            }
                          } else {
                            if (stryMutAct_9fa48("4314")) {
                              {}
                            } else {
                              stryCov_9fa48("4314");
                              this.parseFileListResult(listStdout, result);
                            }
                          }
                          logger.debug(stryMutAct_9fa48("4315") ? `` : (stryCov_9fa48("4315"), `⏱️  Directory detection + file listing completed in ${totalElapsed.toFixed(2)}ms`), stryMutAct_9fa48("4316") ? {} : (stryCov_9fa48("4316"), {
                            directory: result.directory,
                            fileCount: result.fileCount,
                            searchMode: result.searchMode
                          }));
                          resolve(result);
                        }
                      });
                    }
                  } catch (execError) {
                    if (stryMutAct_9fa48("4317")) {
                      {}
                    } else {
                      stryCov_9fa48("4317");
                      logger.warn(stryMutAct_9fa48("4318") ? "" : (stryCov_9fa48("4318"), 'Error executing file searcher:'), execError);
                      // Return detect result without files on file searcher error
                      resolve(detectResult);
                    }
                  }
                }
              } catch (parseError) {
                if (stryMutAct_9fa48("4319")) {
                  {}
                } else {
                  stryCov_9fa48("4319");
                  logger.warn(stryMutAct_9fa48("4320") ? "" : (stryCov_9fa48("4320"), 'Error parsing directory detection result:'), parseError);
                  resolve(null);
                }
              }
            }
          });
        }
      });
    }
  }

  /**
   * Apply file search settings to fd arguments
   */
  private applyFileSearchSettings(args: string[], settings: FileSearchSettings): void {
    if (stryMutAct_9fa48("4321")) {
      {}
    } else {
      stryCov_9fa48("4321");
      if (stryMutAct_9fa48("4324") ? false : stryMutAct_9fa48("4323") ? true : stryMutAct_9fa48("4322") ? settings.respectGitignore : (stryCov_9fa48("4322", "4323", "4324"), !settings.respectGitignore)) {
        if (stryMutAct_9fa48("4325")) {
          {}
        } else {
          stryCov_9fa48("4325");
          args.push(stryMutAct_9fa48("4326") ? "" : (stryCov_9fa48("4326"), '--no-gitignore'));
        }
      }
      if (stryMutAct_9fa48("4329") ? settings.excludePatterns || settings.excludePatterns.length > 0 : stryMutAct_9fa48("4328") ? false : stryMutAct_9fa48("4327") ? true : (stryCov_9fa48("4327", "4328", "4329"), settings.excludePatterns && (stryMutAct_9fa48("4332") ? settings.excludePatterns.length <= 0 : stryMutAct_9fa48("4331") ? settings.excludePatterns.length >= 0 : stryMutAct_9fa48("4330") ? true : (stryCov_9fa48("4330", "4331", "4332"), settings.excludePatterns.length > 0)))) {
        if (stryMutAct_9fa48("4333")) {
          {}
        } else {
          stryCov_9fa48("4333");
          for (const pattern of settings.excludePatterns) {
            if (stryMutAct_9fa48("4334")) {
              {}
            } else {
              stryCov_9fa48("4334");
              args.push(stryMutAct_9fa48("4335") ? "" : (stryCov_9fa48("4335"), '--exclude'), pattern);
            }
          }
        }
      }
      if (stryMutAct_9fa48("4338") ? settings.includePatterns || settings.includePatterns.length > 0 : stryMutAct_9fa48("4337") ? false : stryMutAct_9fa48("4336") ? true : (stryCov_9fa48("4336", "4337", "4338"), settings.includePatterns && (stryMutAct_9fa48("4341") ? settings.includePatterns.length <= 0 : stryMutAct_9fa48("4340") ? settings.includePatterns.length >= 0 : stryMutAct_9fa48("4339") ? true : (stryCov_9fa48("4339", "4340", "4341"), settings.includePatterns.length > 0)))) {
        if (stryMutAct_9fa48("4342")) {
          {}
        } else {
          stryCov_9fa48("4342");
          for (const pattern of settings.includePatterns) {
            if (stryMutAct_9fa48("4343")) {
              {}
            } else {
              stryCov_9fa48("4343");
              args.push(stryMutAct_9fa48("4344") ? "" : (stryCov_9fa48("4344"), '--include'), pattern);
            }
          }
        }
      }
      if (stryMutAct_9fa48("4346") ? false : stryMutAct_9fa48("4345") ? true : (stryCov_9fa48("4345", "4346"), settings.maxFiles)) {
        if (stryMutAct_9fa48("4347")) {
          {}
        } else {
          stryCov_9fa48("4347");
          args.push(stryMutAct_9fa48("4348") ? "" : (stryCov_9fa48("4348"), '--max-files'), String(settings.maxFiles));
        }
      }
      if (stryMutAct_9fa48("4350") ? false : stryMutAct_9fa48("4349") ? true : (stryCov_9fa48("4349", "4350"), settings.includeHidden)) {
        if (stryMutAct_9fa48("4351")) {
          {}
        } else {
          stryCov_9fa48("4351");
          args.push(stryMutAct_9fa48("4352") ? "" : (stryCov_9fa48("4352"), '--include-hidden'));
        }
      }
      if (stryMutAct_9fa48("4355") ? settings.maxDepth !== null || settings.maxDepth !== undefined : stryMutAct_9fa48("4354") ? false : stryMutAct_9fa48("4353") ? true : (stryCov_9fa48("4353", "4354", "4355"), (stryMutAct_9fa48("4357") ? settings.maxDepth === null : stryMutAct_9fa48("4356") ? true : (stryCov_9fa48("4356", "4357"), settings.maxDepth !== null)) && (stryMutAct_9fa48("4359") ? settings.maxDepth === undefined : stryMutAct_9fa48("4358") ? true : (stryCov_9fa48("4358", "4359"), settings.maxDepth !== undefined)))) {
        if (stryMutAct_9fa48("4360")) {
          {}
        } else {
          stryCov_9fa48("4360");
          args.push(stryMutAct_9fa48("4361") ? "" : (stryCov_9fa48("4361"), '--max-depth'), String(settings.maxDepth));
        }
      }
      if (stryMutAct_9fa48("4363") ? false : stryMutAct_9fa48("4362") ? true : (stryCov_9fa48("4362", "4363"), settings.followSymlinks)) {
        if (stryMutAct_9fa48("4364")) {
          {}
        } else {
          stryCov_9fa48("4364");
          args.push(stryMutAct_9fa48("4365") ? "" : (stryCov_9fa48("4365"), '--follow-symlinks'));
        }
      }
    }
  }

  /**
   * Parse file list result from file-searcher output
   */
  private parseFileListResult(stdout: string | undefined, result: DirectoryInfo): void {
    if (stryMutAct_9fa48("4366")) {
      {}
    } else {
      stryCov_9fa48("4366");
      try {
        if (stryMutAct_9fa48("4367")) {
          {}
        } else {
          stryCov_9fa48("4367");
          const listResult = JSON.parse(stryMutAct_9fa48("4370") ? stdout?.trim() && '{}' : stryMutAct_9fa48("4369") ? false : stryMutAct_9fa48("4368") ? true : (stryCov_9fa48("4368", "4369", "4370"), (stryMutAct_9fa48("4372") ? stdout.trim() : stryMutAct_9fa48("4371") ? stdout : (stryCov_9fa48("4371", "4372"), stdout?.trim())) || (stryMutAct_9fa48("4373") ? "" : (stryCov_9fa48("4373"), '{}'))));
          if (stryMutAct_9fa48("4375") ? false : stryMutAct_9fa48("4374") ? true : (stryCov_9fa48("4374", "4375"), listResult.files)) {
            if (stryMutAct_9fa48("4376")) {
              {}
            } else {
              stryCov_9fa48("4376");
              result.files = listResult.files;
              result.fileCount = listResult.fileCount;
            }
          }
          if (stryMutAct_9fa48("4378") ? false : stryMutAct_9fa48("4377") ? true : (stryCov_9fa48("4377", "4378"), listResult.searchMode)) {
            if (stryMutAct_9fa48("4379")) {
              {}
            } else {
              stryCov_9fa48("4379");
              result.searchMode = listResult.searchMode;
            }
          }
          if (stryMutAct_9fa48("4381") ? false : stryMutAct_9fa48("4380") ? true : (stryCov_9fa48("4380", "4381"), listResult.fileLimitReached)) {
            if (stryMutAct_9fa48("4382")) {
              {}
            } else {
              stryCov_9fa48("4382");
              result.fileLimitReached = listResult.fileLimitReached;
            }
          }
          if (stryMutAct_9fa48("4384") ? false : stryMutAct_9fa48("4383") ? true : (stryCov_9fa48("4383", "4384"), listResult.maxFiles)) {
            if (stryMutAct_9fa48("4385")) {
              {}
            } else {
              stryCov_9fa48("4385");
              result.maxFiles = listResult.maxFiles;
            }
          }
          if (stryMutAct_9fa48("4387") ? false : stryMutAct_9fa48("4386") ? true : (stryCov_9fa48("4386", "4387"), listResult.filesError)) {
            if (stryMutAct_9fa48("4388")) {
              {}
            } else {
              stryCov_9fa48("4388");
              result.filesError = listResult.filesError;
              // Add hint message if fd command is not available
              if (stryMutAct_9fa48("4390") ? false : stryMutAct_9fa48("4389") ? true : (stryCov_9fa48("4389", "4390"), listResult.filesError.includes(stryMutAct_9fa48("4391") ? "" : (stryCov_9fa48("4391"), 'fd required')))) {
                if (stryMutAct_9fa48("4392")) {
                  {}
                } else {
                  stryCov_9fa48("4392");
                  result.hint = stryMutAct_9fa48("4393") ? "" : (stryCov_9fa48("4393"), 'Install fd for file search: brew install fd');
                  logger.warn(stryMutAct_9fa48("4394") ? "" : (stryCov_9fa48("4394"), 'fd command not found. File search will not work. Install with: brew install fd'));
                }
              }
            }
          }
        }
      } catch (parseError) {
        if (stryMutAct_9fa48("4395")) {
          {}
        } else {
          stryCov_9fa48("4395");
          logger.warn(stryMutAct_9fa48("4396") ? "" : (stryCov_9fa48("4396"), 'Error parsing file list result:'), parseError);
          result.filesError = stryMutAct_9fa48("4397") ? "" : (stryCov_9fa48("4397"), 'Failed to parse file list');
        }
      }
    }
  }
}