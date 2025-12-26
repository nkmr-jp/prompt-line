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
import { logger } from '../../utils/utils';
import type { FileInfo } from '../../types';

/**
 * Utility functions for DirectoryDetector
 */
export class DirectoryDetectorUtils {
  /**
   * Check if a directory should have file search disabled
   * Root directory (/) and root-owned system directories are excluded for security
   */
  static isFileSearchDisabledDirectory(directory: string): boolean {
    if (stryMutAct_9fa48("3876")) {
      {}
    } else {
      stryCov_9fa48("3876");
      // Root directory
      if (stryMutAct_9fa48("3879") ? directory !== '/' : stryMutAct_9fa48("3878") ? false : stryMutAct_9fa48("3877") ? true : (stryCov_9fa48("3877", "3878", "3879"), directory === (stryMutAct_9fa48("3880") ? "" : (stryCov_9fa48("3880"), '/')))) return stryMutAct_9fa48("3881") ? false : (stryCov_9fa48("3881"), true);

      // Well-known root-owned system directories
      const rootOwnedDirs = stryMutAct_9fa48("3882") ? [] : (stryCov_9fa48("3882"), [stryMutAct_9fa48("3883") ? "" : (stryCov_9fa48("3883"), '/Library'), stryMutAct_9fa48("3884") ? "" : (stryCov_9fa48("3884"), '/System'), stryMutAct_9fa48("3885") ? "" : (stryCov_9fa48("3885"), '/Applications'), stryMutAct_9fa48("3886") ? "" : (stryCov_9fa48("3886"), '/bin'), stryMutAct_9fa48("3887") ? "" : (stryCov_9fa48("3887"), '/sbin'), stryMutAct_9fa48("3888") ? "" : (stryCov_9fa48("3888"), '/usr'), stryMutAct_9fa48("3889") ? "" : (stryCov_9fa48("3889"), '/var'), stryMutAct_9fa48("3890") ? "" : (stryCov_9fa48("3890"), '/etc'), stryMutAct_9fa48("3891") ? "" : (stryCov_9fa48("3891"), '/private'), stryMutAct_9fa48("3892") ? "" : (stryCov_9fa48("3892"), '/tmp'), stryMutAct_9fa48("3893") ? "" : (stryCov_9fa48("3893"), '/cores'), stryMutAct_9fa48("3894") ? "" : (stryCov_9fa48("3894"), '/opt')]);

      // Check if directory starts with any root-owned directory
      for (const rootDir of rootOwnedDirs) {
        if (stryMutAct_9fa48("3895")) {
          {}
        } else {
          stryCov_9fa48("3895");
          if (stryMutAct_9fa48("3898") ? directory === rootDir && directory.startsWith(rootDir + '/') : stryMutAct_9fa48("3897") ? false : stryMutAct_9fa48("3896") ? true : (stryCov_9fa48("3896", "3897", "3898"), (stryMutAct_9fa48("3900") ? directory !== rootDir : stryMutAct_9fa48("3899") ? false : (stryCov_9fa48("3899", "3900"), directory === rootDir)) || (stryMutAct_9fa48("3901") ? directory.endsWith(rootDir + '/') : (stryCov_9fa48("3901"), directory.startsWith(rootDir + (stryMutAct_9fa48("3902") ? "" : (stryCov_9fa48("3902"), '/'))))))) {
            if (stryMutAct_9fa48("3903")) {
              {}
            } else {
              stryCov_9fa48("3903");
              return stryMutAct_9fa48("3904") ? false : (stryCov_9fa48("3904"), true);
            }
          }
        }
      }
      return stryMutAct_9fa48("3905") ? true : (stryCov_9fa48("3905"), false);
    }
  }

  /**
   * Check if file list has changed (for cache update decision)
   */
  static hasFileListChanges(oldFiles: FileInfo[] | undefined, newFiles: FileInfo[]): boolean {
    if (stryMutAct_9fa48("3906")) {
      {}
    } else {
      stryCov_9fa48("3906");
      if (stryMutAct_9fa48("3909") ? false : stryMutAct_9fa48("3908") ? true : stryMutAct_9fa48("3907") ? oldFiles : (stryCov_9fa48("3907", "3908", "3909"), !oldFiles)) return stryMutAct_9fa48("3910") ? false : (stryCov_9fa48("3910"), true);
      if (stryMutAct_9fa48("3913") ? oldFiles.length === newFiles.length : stryMutAct_9fa48("3912") ? false : stryMutAct_9fa48("3911") ? true : (stryCov_9fa48("3911", "3912", "3913"), oldFiles.length !== newFiles.length)) return stryMutAct_9fa48("3914") ? false : (stryCov_9fa48("3914"), true);

      // Create path sets for comparison (order-independent)
      const oldPaths = new Set(oldFiles.map(stryMutAct_9fa48("3915") ? () => undefined : (stryCov_9fa48("3915"), f => f.path)));
      const newPaths = new Set(newFiles.map(stryMutAct_9fa48("3916") ? () => undefined : (stryCov_9fa48("3916"), f => f.path)));
      if (stryMutAct_9fa48("3919") ? oldPaths.size === newPaths.size : stryMutAct_9fa48("3918") ? false : stryMutAct_9fa48("3917") ? true : (stryCov_9fa48("3917", "3918", "3919"), oldPaths.size !== newPaths.size)) return stryMutAct_9fa48("3920") ? false : (stryCov_9fa48("3920"), true);
      for (const path of newPaths) {
        if (stryMutAct_9fa48("3921")) {
          {}
        } else {
          stryCov_9fa48("3921");
          if (stryMutAct_9fa48("3924") ? false : stryMutAct_9fa48("3923") ? true : stryMutAct_9fa48("3922") ? oldPaths.has(path) : (stryCov_9fa48("3922", "3923", "3924"), !oldPaths.has(path))) return stryMutAct_9fa48("3925") ? false : (stryCov_9fa48("3925"), true);
        }
      }
      return stryMutAct_9fa48("3926") ? true : (stryCov_9fa48("3926"), false);
    }
  }

  /**
   * Check if fd command is available on the system
   * @param customFdPath Optional custom fd path from settings
   * @returns true if fd is available, false otherwise
   */
  static checkFdCommandAvailability(customFdPath?: string): boolean {
    if (stryMutAct_9fa48("3927")) {
      {}
    } else {
      stryCov_9fa48("3927");
      const fs = require('fs');

      // Check custom fdPath from settings first
      if (stryMutAct_9fa48("3929") ? false : stryMutAct_9fa48("3928") ? true : (stryCov_9fa48("3928", "3929"), customFdPath)) {
        if (stryMutAct_9fa48("3930")) {
          {}
        } else {
          stryCov_9fa48("3930");
          if (stryMutAct_9fa48("3932") ? false : stryMutAct_9fa48("3931") ? true : (stryCov_9fa48("3931", "3932"), fs.existsSync(customFdPath))) {
            if (stryMutAct_9fa48("3933")) {
              {}
            } else {
              stryCov_9fa48("3933");
              logger.debug(stryMutAct_9fa48("3934") ? `` : (stryCov_9fa48("3934"), `fd command found at custom path: ${customFdPath}`));
              return stryMutAct_9fa48("3935") ? false : (stryCov_9fa48("3935"), true);
            }
          } else {
            if (stryMutAct_9fa48("3936")) {
              {}
            } else {
              stryCov_9fa48("3936");
              logger.warn(stryMutAct_9fa48("3937") ? `` : (stryCov_9fa48("3937"), `Custom fdPath "${customFdPath}" does not exist, falling back to auto-detect`));
            }
          }
        }
      }

      // Check common fd installation paths directly
      // This avoids PATH issues when Electron is launched outside of shell
      const fdPaths = stryMutAct_9fa48("3938") ? [] : (stryCov_9fa48("3938"), [stryMutAct_9fa48("3939") ? "" : (stryCov_9fa48("3939"), '/opt/homebrew/bin/fd'), // Apple Silicon Homebrew
      stryMutAct_9fa48("3940") ? "" : (stryCov_9fa48("3940"), '/usr/local/bin/fd'), // Intel Homebrew
      stryMutAct_9fa48("3941") ? "" : (stryCov_9fa48("3941"), '/usr/bin/fd') // System
      ]);
      for (const fdPath of fdPaths) {
        if (stryMutAct_9fa48("3942")) {
          {}
        } else {
          stryCov_9fa48("3942");
          if (stryMutAct_9fa48("3944") ? false : stryMutAct_9fa48("3943") ? true : (stryCov_9fa48("3943", "3944"), fs.existsSync(fdPath))) {
            if (stryMutAct_9fa48("3945")) {
              {}
            } else {
              stryCov_9fa48("3945");
              logger.debug(stryMutAct_9fa48("3946") ? `` : (stryCov_9fa48("3946"), `fd command found at: ${fdPath}`));
              return stryMutAct_9fa48("3947") ? false : (stryCov_9fa48("3947"), true);
            }
          }
        }
      }
      logger.warn(stryMutAct_9fa48("3948") ? "" : (stryCov_9fa48("3948"), 'fd command is not available. File search will not work. Install with: brew install fd'));
      return stryMutAct_9fa48("3949") ? true : (stryCov_9fa48("3949"), false);
    }
  }
}