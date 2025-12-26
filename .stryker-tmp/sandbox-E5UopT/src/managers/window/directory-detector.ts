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
import type { BrowserWindow } from 'electron';
import { logger } from '../../utils/utils';
import FileCacheManager from '../file-cache-manager';
import type DirectoryManager from '../directory-manager';
import type { AppInfo, DirectoryInfo, FileSearchSettings } from '../../types';
import type { IDirectoryDetectionStrategy } from './strategies';
import { NativeDetectorStrategy } from './strategies';
import { DirectoryDetectorUtils } from './directory-detector-utils';
import { DirectoryCacheHelper } from './directory-cache-helper';

/**
 * DirectoryDetector orchestrates directory detection and file caching
 *
 * Responsibilities:
 * - Delegate directory detection to strategy (Strategy Pattern)
 * - Manage file caching for detected directories
 * - Handle file search disabled directories (root, system directories)
 * - Orchestrate background directory detection with window updates
 *
 * Integration:
 * - Uses IDirectoryDetectionStrategy for platform-specific detection
 * - Uses FileCacheManager for caching file lists
 * - Requires DirectoryManager reference for fallback behavior
 * - Sends updates to renderer via BrowserWindow.webContents
 */
class DirectoryDetector {
  private fileSearchSettings: FileSearchSettings | null = null;
  private directoryManager: DirectoryManager | null = null;
  private savedDirectory: string | null = null;
  private fdCommandAvailable: boolean = stryMutAct_9fa48("3950") ? false : (stryCov_9fa48("3950"), true);
  private fdCommandChecked: boolean = stryMutAct_9fa48("3951") ? true : (stryCov_9fa48("3951"), false);
  private previousApp: AppInfo | string | null = null;
  private strategy: IDirectoryDetectionStrategy;
  private cacheHelper: DirectoryCacheHelper;
  constructor(fileCacheManager: FileCacheManager | null) {
    if (stryMutAct_9fa48("3952")) {
      {}
    } else {
      stryCov_9fa48("3952");
      this.cacheHelper = new DirectoryCacheHelper(fileCacheManager);
      // Initialize with native detector strategy
      this.strategy = new NativeDetectorStrategy();
    }
  }

  /**
   * Set DirectoryManager reference for directory fallback feature
   */
  setDirectoryManager(directoryManager: DirectoryManager): void {
    if (stryMutAct_9fa48("3953")) {
      {}
    } else {
      stryCov_9fa48("3953");
      this.directoryManager = directoryManager;
      logger.debug(stryMutAct_9fa48("3954") ? "" : (stryCov_9fa48("3954"), 'DirectoryManager reference set in DirectoryDetector'));
    }
  }

  /**
   * Update file search settings
   */
  updateFileSearchSettings(settings: FileSearchSettings | null | undefined): void {
    if (stryMutAct_9fa48("3955")) {
      {}
    } else {
      stryCov_9fa48("3955");
      this.fileSearchSettings = stryMutAct_9fa48("3956") ? settings && null : (stryCov_9fa48("3956"), settings ?? null);
      logger.debug(stryMutAct_9fa48("3957") ? "" : (stryCov_9fa48("3957"), 'File search settings updated in DirectoryDetector'), stryMutAct_9fa48("3958") ? {} : (stryCov_9fa48("3958"), {
        enabled: stryMutAct_9fa48("3961") ? settings !== null || settings !== undefined : stryMutAct_9fa48("3960") ? false : stryMutAct_9fa48("3959") ? true : (stryCov_9fa48("3959", "3960", "3961"), (stryMutAct_9fa48("3963") ? settings === null : stryMutAct_9fa48("3962") ? true : (stryCov_9fa48("3962", "3963"), settings !== null)) && (stryMutAct_9fa48("3965") ? settings === undefined : stryMutAct_9fa48("3964") ? true : (stryCov_9fa48("3964", "3965"), settings !== undefined))),
        settings
      }));
    }
  }

  /**
   * Update saved directory from DirectoryManager
   */
  updateSavedDirectory(directory: string | null): void {
    if (stryMutAct_9fa48("3966")) {
      {}
    } else {
      stryCov_9fa48("3966");
      this.savedDirectory = directory;
      logger.debug(stryMutAct_9fa48("3967") ? "" : (stryCov_9fa48("3967"), 'Saved directory updated in DirectoryDetector:'), stryMutAct_9fa48("3968") ? {} : (stryCov_9fa48("3968"), {
        savedDirectory: directory
      }));
    }
  }

  /**
   * Check if file search is enabled based on settings
   * Returns true only if file search settings have been configured
   */
  isEnabled(): boolean {
    if (stryMutAct_9fa48("3969")) {
      {}
    } else {
      stryCov_9fa48("3969");
      return stryMutAct_9fa48("3972") ? this.fileSearchSettings === null : stryMutAct_9fa48("3971") ? false : stryMutAct_9fa48("3970") ? true : (stryCov_9fa48("3970", "3971", "3972"), this.fileSearchSettings !== null);
    }
  }

  /**
   * Update previous app info for directory detection
   */
  updatePreviousApp(app: AppInfo | string | null): void {
    if (stryMutAct_9fa48("3973")) {
      {}
    } else {
      stryCov_9fa48("3973");
      this.previousApp = app;
    }
  }

  /**
   * Get current saved directory
   */
  getSavedDirectory(): string | null {
    if (stryMutAct_9fa48("3974")) {
      {}
    } else {
      stryCov_9fa48("3974");
      return this.savedDirectory;
    }
  }

  /**
   * Check if fd command is available on the system (only once)
   */
  async checkFdCommandAvailability(): Promise<void> {
    if (stryMutAct_9fa48("3975")) {
      {}
    } else {
      stryCov_9fa48("3975");
      // Only check once
      if (stryMutAct_9fa48("3977") ? false : stryMutAct_9fa48("3976") ? true : (stryCov_9fa48("3976", "3977"), this.fdCommandChecked)) {
        if (stryMutAct_9fa48("3978")) {
          {}
        } else {
          stryCov_9fa48("3978");
          return;
        }
      }
      this.fdCommandChecked = stryMutAct_9fa48("3979") ? false : (stryCov_9fa48("3979"), true);
      this.fdCommandAvailable = DirectoryDetectorUtils.checkFdCommandAvailability(stryMutAct_9fa48("3980") ? this.fileSearchSettings?.fdPath && undefined : (stryCov_9fa48("3980"), (stryMutAct_9fa48("3981") ? this.fileSearchSettings.fdPath : (stryCov_9fa48("3981"), this.fileSearchSettings?.fdPath)) ?? undefined));
    }
  }

  /**
   * Check if fd command is available
   */
  isFdCommandAvailable(): boolean {
    if (stryMutAct_9fa48("3982")) {
      {}
    } else {
      stryCov_9fa48("3982");
      return this.fdCommandAvailable;
    }
  }

  /**
   * Check if a directory should have file search disabled
   * Root directory (/) and root-owned system directories are excluded for security
   * This is a pre-check before calling directory-detector; the Swift tool also checks ownership
   */
  isFileSearchDisabledDirectory(directory: string): boolean {
    if (stryMutAct_9fa48("3983")) {
      {}
    } else {
      stryCov_9fa48("3983");
      return DirectoryDetectorUtils.isFileSearchDisabledDirectory(directory);
    }
  }

  /**
   * Load cached files for window show - provides instant file search availability
   * Priority: savedDirectory cache > lastUsedDirectory cache
   */
  async loadCachedFilesForWindow(): Promise<DirectoryInfo | null> {
    if (stryMutAct_9fa48("3984")) {
      {}
    } else {
      stryCov_9fa48("3984");
      return this.cacheHelper.loadCachedFilesForWindow(this.savedDirectory);
    }
  }

  /**
   * Set detection strategy (for testing or platform-specific implementations)
   */
  setStrategy(strategy: IDirectoryDetectionStrategy): void {
    if (stryMutAct_9fa48("3985")) {
      {}
    } else {
      stryCov_9fa48("3985");
      this.strategy = strategy;
      logger.debug(stryMutAct_9fa48("3986") ? `` : (stryCov_9fa48("3986"), `Detection strategy changed to: ${strategy.getName()}`));
    }
  }

  /**
   * Execute directory detection using the current strategy
   * @param timeout Timeout in milliseconds
   * @returns DirectoryInfo or null on error
   */
  async executeDirectoryDetector(timeout: number): Promise<DirectoryInfo | null> {
    if (stryMutAct_9fa48("3987")) {
      {}
    } else {
      stryCov_9fa48("3987");
      if (stryMutAct_9fa48("3990") ? false : stryMutAct_9fa48("3989") ? true : stryMutAct_9fa48("3988") ? this.strategy.isAvailable() : (stryCov_9fa48("3988", "3989", "3990"), !this.strategy.isAvailable())) {
        if (stryMutAct_9fa48("3991")) {
          {}
        } else {
          stryCov_9fa48("3991");
          logger.debug(stryMutAct_9fa48("3992") ? `` : (stryCov_9fa48("3992"), `Strategy ${this.strategy.getName()} is not available on this platform`));
          return null;
        }
      }
      return this.strategy.detect(timeout, this.previousApp, this.fileSearchSettings);
    }
  }

  /**
   * Execute directory detection in background (single stage with fd)
   * This ensures window shows immediately without waiting for directory detection
   *
   * Draft Directory Fallback Logic:
   * - If detection succeeds: update draft directory and send result with directoryChanged flag
   * - If detection fails: keep using draft directory (do nothing)
   * - directoryChanged flag is true when detected directory differs from saved draft directory
   *
   * Cache Integration:
   * - Background detection always runs to catch file changes
   * - If files changed, update cache and notify renderer
   * - If no changes, just update cache timestamp (no renderer notification)
   */
  async executeBackgroundDirectoryDetection(inputWindow: BrowserWindow | null): Promise<void> {
    if (stryMutAct_9fa48("3993")) {
      {}
    } else {
      stryCov_9fa48("3993");
      try {
        if (stryMutAct_9fa48("3994")) {
          {}
        } else {
          stryCov_9fa48("3994");
          const startTime = performance.now();
          logger.debug(stryMutAct_9fa48("3995") ? "" : (stryCov_9fa48("3995"), '🔄 Starting background directory detection...'), stryMutAct_9fa48("3996") ? {} : (stryCov_9fa48("3996"), {
            savedDirectory: this.savedDirectory
          }));

          // Single stage directory detection with fd (5 second timeout)
          const result = await this.executeDirectoryDetector(5000);
          if (stryMutAct_9fa48("3999") ? result && result.directory && inputWindow || !inputWindow.isDestroyed() : stryMutAct_9fa48("3998") ? false : stryMutAct_9fa48("3997") ? true : (stryCov_9fa48("3997", "3998", "3999"), (stryMutAct_9fa48("4001") ? result && result.directory || inputWindow : stryMutAct_9fa48("4000") ? true : (stryCov_9fa48("4000", "4001"), (stryMutAct_9fa48("4003") ? result || result.directory : stryMutAct_9fa48("4002") ? true : (stryCov_9fa48("4002", "4003"), result && result.directory)) && inputWindow)) && (stryMutAct_9fa48("4004") ? inputWindow.isDestroyed() : (stryCov_9fa48("4004"), !inputWindow.isDestroyed())))) {
            if (stryMutAct_9fa48("4005")) {
              {}
            } else {
              stryCov_9fa48("4005");
              // Detection succeeded - check if directory changed from draft
              const detectedDirectory = result.directory;
              const directoryChanged = stryMutAct_9fa48("4008") ? this.savedDirectory !== null || detectedDirectory !== this.savedDirectory : stryMutAct_9fa48("4007") ? false : stryMutAct_9fa48("4006") ? true : (stryCov_9fa48("4006", "4007", "4008"), (stryMutAct_9fa48("4010") ? this.savedDirectory === null : stryMutAct_9fa48("4009") ? true : (stryCov_9fa48("4009", "4010"), this.savedDirectory !== null)) && (stryMutAct_9fa48("4012") ? detectedDirectory === this.savedDirectory : stryMutAct_9fa48("4011") ? true : (stryCov_9fa48("4011", "4012"), detectedDirectory !== this.savedDirectory)));

              // Handle cache operations
              const isFileSearchDisabled = stryMutAct_9fa48("4015") ? this.isFileSearchDisabledDirectory(detectedDirectory) && (result.filesDisabled ?? false) : stryMutAct_9fa48("4014") ? false : stryMutAct_9fa48("4013") ? true : (stryCov_9fa48("4013", "4014", "4015"), this.isFileSearchDisabledDirectory(detectedDirectory) || (stryMutAct_9fa48("4016") ? result.filesDisabled && false : (stryCov_9fa48("4016"), result.filesDisabled ?? (stryMutAct_9fa48("4017") ? true : (stryCov_9fa48("4017"), false)))));
              const hasChanges = await this.cacheHelper.handleBackgroundCacheUpdate(detectedDirectory, result.files, isFileSearchDisabled);

              // Update directory manager with detected directory (detection succeeded)
              if (stryMutAct_9fa48("4019") ? false : stryMutAct_9fa48("4018") ? true : (stryCov_9fa48("4018", "4019"), this.directoryManager)) {
                if (stryMutAct_9fa48("4020")) {
                  {}
                } else {
                  stryCov_9fa48("4020");
                  this.directoryManager.setDirectory(detectedDirectory);
                  this.savedDirectory = detectedDirectory; // Update local reference
                }
              }

              // Notify renderer if there are changes, directory changed, or hint exists
              // hint needs to be sent even without file changes (e.g., fd not installed)
              if (stryMutAct_9fa48("4023") ? (hasChanges || directoryChanged) && result.hint : stryMutAct_9fa48("4022") ? false : stryMutAct_9fa48("4021") ? true : (stryCov_9fa48("4021", "4022", "4023"), (stryMutAct_9fa48("4025") ? hasChanges && directoryChanged : stryMutAct_9fa48("4024") ? false : (stryCov_9fa48("4024", "4025"), hasChanges || directoryChanged)) || result.hint)) {
                if (stryMutAct_9fa48("4026")) {
                  {}
                } else {
                  stryCov_9fa48("4026");
                  // Add directoryChanged flag to result
                  const resultWithFlags: DirectoryInfo = stryMutAct_9fa48("4027") ? {} : (stryCov_9fa48("4027"), {
                    ...result,
                    directoryChanged
                  });
                  // Only add previousDirectory if directory actually changed
                  if (stryMutAct_9fa48("4030") ? directoryChanged && this.savedDirectory !== null || this.savedDirectory !== detectedDirectory : stryMutAct_9fa48("4029") ? false : stryMutAct_9fa48("4028") ? true : (stryCov_9fa48("4028", "4029", "4030"), (stryMutAct_9fa48("4032") ? directoryChanged || this.savedDirectory !== null : stryMutAct_9fa48("4031") ? true : (stryCov_9fa48("4031", "4032"), directoryChanged && (stryMutAct_9fa48("4034") ? this.savedDirectory === null : stryMutAct_9fa48("4033") ? true : (stryCov_9fa48("4033", "4034"), this.savedDirectory !== null)))) && (stryMutAct_9fa48("4036") ? this.savedDirectory === detectedDirectory : stryMutAct_9fa48("4035") ? true : (stryCov_9fa48("4035", "4036"), this.savedDirectory !== detectedDirectory)))) {
                    if (stryMutAct_9fa48("4037")) {
                      {}
                    } else {
                      stryCov_9fa48("4037");
                      resultWithFlags.previousDirectory = this.savedDirectory;
                    }
                  }
                  inputWindow.webContents.send(stryMutAct_9fa48("4038") ? "" : (stryCov_9fa48("4038"), 'directory-data-updated'), resultWithFlags);
                  logger.debug(stryMutAct_9fa48("4039") ? `` : (stryCov_9fa48("4039"), `✅ Directory detection completed in ${(stryMutAct_9fa48("4040") ? performance.now() + startTime : (stryCov_9fa48("4040"), performance.now() - startTime)).toFixed(2)}ms`), stryMutAct_9fa48("4041") ? {} : (stryCov_9fa48("4041"), {
                    directory: detectedDirectory,
                    fileCount: result.fileCount,
                    directoryChanged,
                    hasChanges,
                    hint: result.hint
                  }));
                }
              } else {
                if (stryMutAct_9fa48("4042")) {
                  {}
                } else {
                  stryCov_9fa48("4042");
                  logger.debug(stryMutAct_9fa48("4043") ? `` : (stryCov_9fa48("4043"), `✅ Directory detection completed, no changes detected, skipping renderer notification`), stryMutAct_9fa48("4044") ? {} : (stryCov_9fa48("4044"), {
                    directory: detectedDirectory,
                    fileCount: result.fileCount
                  }));
                }
              }
            }
          } else {
            if (stryMutAct_9fa48("4045")) {
              {}
            } else {
              stryCov_9fa48("4045");
              // Detection failed (likely timeout) - keep using draft directory (fallback)
              // Notify renderer about timeout so it can show hint
              logger.debug(stryMutAct_9fa48("4046") ? "" : (stryCov_9fa48("4046"), 'Background directory detection: no result or window not available, keeping draft directory'), stryMutAct_9fa48("4047") ? {} : (stryCov_9fa48("4047"), {
                savedDirectory: this.savedDirectory
              }));

              // Send timeout notification to renderer if window is available
              if (stryMutAct_9fa48("4050") ? inputWindow || !inputWindow.isDestroyed() : stryMutAct_9fa48("4049") ? false : stryMutAct_9fa48("4048") ? true : (stryCov_9fa48("4048", "4049", "4050"), inputWindow && (stryMutAct_9fa48("4051") ? inputWindow.isDestroyed() : (stryCov_9fa48("4051"), !inputWindow.isDestroyed())))) {
                if (stryMutAct_9fa48("4052")) {
                  {}
                } else {
                  stryCov_9fa48("4052");
                  const timeoutInfo: DirectoryInfo = stryMutAct_9fa48("4053") ? {} : (stryCov_9fa48("4053"), {
                    success: stryMutAct_9fa48("4054") ? true : (stryCov_9fa48("4054"), false),
                    detectionTimedOut: stryMutAct_9fa48("4055") ? false : (stryCov_9fa48("4055"), true)
                  });
                  if (stryMutAct_9fa48("4057") ? false : stryMutAct_9fa48("4056") ? true : (stryCov_9fa48("4056", "4057"), this.savedDirectory)) {
                    if (stryMutAct_9fa48("4058")) {
                      {}
                    } else {
                      stryCov_9fa48("4058");
                      timeoutInfo.directory = this.savedDirectory;
                    }
                  }
                  inputWindow.webContents.send(stryMutAct_9fa48("4059") ? "" : (stryCov_9fa48("4059"), 'directory-data-updated'), timeoutInfo);
                }
              }
            }
          }
          logger.debug(stryMutAct_9fa48("4060") ? `` : (stryCov_9fa48("4060"), `🏁 Total background directory detection time: ${(stryMutAct_9fa48("4061") ? performance.now() + startTime : (stryCov_9fa48("4061"), performance.now() - startTime)).toFixed(2)}ms`));
        }
      } catch (error) {
        if (stryMutAct_9fa48("4062")) {
          {}
        } else {
          stryCov_9fa48("4062");
          logger.warn(stryMutAct_9fa48("4063") ? "" : (stryCov_9fa48("4063"), 'Background directory detection failed:'), error);
          // Detection failed - keep using draft directory (fallback)
          // Notify renderer about failure
          if (stryMutAct_9fa48("4066") ? inputWindow || !inputWindow.isDestroyed() : stryMutAct_9fa48("4065") ? false : stryMutAct_9fa48("4064") ? true : (stryCov_9fa48("4064", "4065", "4066"), inputWindow && (stryMutAct_9fa48("4067") ? inputWindow.isDestroyed() : (stryCov_9fa48("4067"), !inputWindow.isDestroyed())))) {
            if (stryMutAct_9fa48("4068")) {
              {}
            } else {
              stryCov_9fa48("4068");
              const errorInfo: DirectoryInfo = stryMutAct_9fa48("4069") ? {} : (stryCov_9fa48("4069"), {
                success: stryMutAct_9fa48("4070") ? true : (stryCov_9fa48("4070"), false),
                detectionTimedOut: stryMutAct_9fa48("4071") ? false : (stryCov_9fa48("4071"), true)
              });
              if (stryMutAct_9fa48("4073") ? false : stryMutAct_9fa48("4072") ? true : (stryCov_9fa48("4072", "4073"), this.savedDirectory)) {
                if (stryMutAct_9fa48("4074")) {
                  {}
                } else {
                  stryCov_9fa48("4074");
                  errorInfo.directory = this.savedDirectory;
                }
              }
              inputWindow.webContents.send(stryMutAct_9fa48("4075") ? "" : (stryCov_9fa48("4075"), 'directory-data-updated'), errorInfo);
            }
          }
        }
      }
    }
  }
}
export default DirectoryDetector;