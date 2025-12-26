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
import FileCacheManager from '../file-cache-manager';
import type { DirectoryInfo, FileInfo } from '../../types';
import { DirectoryDetectorUtils } from './directory-detector-utils';

/**
 * Helper class for DirectoryDetector cache operations
 * Handles loading cached files for window initialization
 */
export class DirectoryCacheHelper {
  constructor(private fileCacheManager: FileCacheManager | null) {}

  /**
   * Load cached files for window show - provides instant file search availability
   * Priority: savedDirectory cache > lastUsedDirectory cache
   */
  async loadCachedFilesForWindow(savedDirectory: string | null): Promise<DirectoryInfo | null> {
    if (stryMutAct_9fa48("3794")) {
      {}
    } else {
      stryCov_9fa48("3794");
      if (stryMutAct_9fa48("3797") ? false : stryMutAct_9fa48("3796") ? true : stryMutAct_9fa48("3795") ? this.fileCacheManager : (stryCov_9fa48("3795", "3796", "3797"), !this.fileCacheManager)) return null;
      try {
        if (stryMutAct_9fa48("3798")) {
          {}
        } else {
          stryCov_9fa48("3798");
          // Priority 1: Try to load cache for savedDirectory (from DirectoryManager)
          if (stryMutAct_9fa48("3800") ? false : stryMutAct_9fa48("3799") ? true : (stryCov_9fa48("3799", "3800"), savedDirectory)) {
            if (stryMutAct_9fa48("3801")) {
              {}
            } else {
              stryCov_9fa48("3801");
              const result = await this.loadCacheForDirectory(savedDirectory);
              if (stryMutAct_9fa48("3803") ? false : stryMutAct_9fa48("3802") ? true : (stryCov_9fa48("3802", "3803"), result)) return result;
            }
          }

          // Priority 2: Try to load cache for lastUsedDirectory
          const lastUsedDir = await this.fileCacheManager.getLastUsedDirectory();
          if (stryMutAct_9fa48("3806") ? lastUsedDir || lastUsedDir !== savedDirectory : stryMutAct_9fa48("3805") ? false : stryMutAct_9fa48("3804") ? true : (stryCov_9fa48("3804", "3805", "3806"), lastUsedDir && (stryMutAct_9fa48("3808") ? lastUsedDir === savedDirectory : stryMutAct_9fa48("3807") ? true : (stryCov_9fa48("3807", "3808"), lastUsedDir !== savedDirectory)))) {
            if (stryMutAct_9fa48("3809")) {
              {}
            } else {
              stryCov_9fa48("3809");
              return await this.loadCacheForDirectory(lastUsedDir);
            }
          }
          return null;
        }
      } catch (error) {
        if (stryMutAct_9fa48("3810")) {
          {}
        } else {
          stryCov_9fa48("3810");
          logger.error(stryMutAct_9fa48("3811") ? "" : (stryCov_9fa48("3811"), 'Failed to load cached files:'), error);
          return null;
        }
      }
    }
  }

  /**
   * Load cache for a specific directory
   */
  private async loadCacheForDirectory(directory: string): Promise<DirectoryInfo | null> {
    if (stryMutAct_9fa48("3812")) {
      {}
    } else {
      stryCov_9fa48("3812");
      if (stryMutAct_9fa48("3815") ? false : stryMutAct_9fa48("3814") ? true : stryMutAct_9fa48("3813") ? this.fileCacheManager : (stryCov_9fa48("3813", "3814", "3815"), !this.fileCacheManager)) return null;

      // Check if this directory has file search disabled
      if (stryMutAct_9fa48("3817") ? false : stryMutAct_9fa48("3816") ? true : (stryCov_9fa48("3816", "3817"), DirectoryDetectorUtils.isFileSearchDisabledDirectory(directory))) {
        if (stryMutAct_9fa48("3818")) {
          {}
        } else {
          stryCov_9fa48("3818");
          return stryMutAct_9fa48("3819") ? {} : (stryCov_9fa48("3819"), {
            success: stryMutAct_9fa48("3820") ? false : (stryCov_9fa48("3820"), true),
            directory,
            files: stryMutAct_9fa48("3821") ? ["Stryker was here"] : (stryCov_9fa48("3821"), []),
            fileCount: 0,
            partial: stryMutAct_9fa48("3822") ? true : (stryCov_9fa48("3822"), false),
            fromCache: stryMutAct_9fa48("3823") ? false : (stryCov_9fa48("3823"), true),
            searchMode: stryMutAct_9fa48("3824") ? "" : (stryCov_9fa48("3824"), 'recursive'),
            filesDisabled: stryMutAct_9fa48("3825") ? false : (stryCov_9fa48("3825"), true),
            filesDisabledReason: stryMutAct_9fa48("3826") ? "" : (stryCov_9fa48("3826"), 'File search is disabled for root directory')
          });
        }
      }
      const cached = await this.fileCacheManager.loadCache(directory);
      if (stryMutAct_9fa48("3829") ? cached || this.fileCacheManager.isCacheValid(cached.metadata) : stryMutAct_9fa48("3828") ? false : stryMutAct_9fa48("3827") ? true : (stryCov_9fa48("3827", "3828", "3829"), cached && this.fileCacheManager.isCacheValid(cached.metadata))) {
        if (stryMutAct_9fa48("3830")) {
          {}
        } else {
          stryCov_9fa48("3830");
          return stryMutAct_9fa48("3831") ? {} : (stryCov_9fa48("3831"), {
            success: stryMutAct_9fa48("3832") ? false : (stryCov_9fa48("3832"), true),
            directory: cached.directory,
            files: cached.files,
            fileCount: cached.files.length,
            partial: stryMutAct_9fa48("3833") ? true : (stryCov_9fa48("3833"), false),
            fromCache: stryMutAct_9fa48("3834") ? false : (stryCov_9fa48("3834"), true),
            cacheAge: stryMutAct_9fa48("3835") ? Date.now() + new Date(cached.metadata.updatedAt).getTime() : (stryCov_9fa48("3835"), Date.now() - new Date(cached.metadata.updatedAt).getTime()),
            searchMode: stryMutAct_9fa48("3836") ? "" : (stryCov_9fa48("3836"), 'recursive')
          });
        }
      }
      return null;
    }
  }

  /**
   * Update cache with new file list or timestamp
   */
  async updateCache(directory: string, files: FileInfo[], existingFiles?: FileInfo[]): Promise<boolean> {
    if (stryMutAct_9fa48("3837")) {
      {}
    } else {
      stryCov_9fa48("3837");
      if (stryMutAct_9fa48("3840") ? false : stryMutAct_9fa48("3839") ? true : stryMutAct_9fa48("3838") ? this.fileCacheManager : (stryCov_9fa48("3838", "3839", "3840"), !this.fileCacheManager)) return stryMutAct_9fa48("3841") ? true : (stryCov_9fa48("3841"), false);
      const hasChanges = DirectoryDetectorUtils.hasFileListChanges(existingFiles, files);
      if (stryMutAct_9fa48("3843") ? false : stryMutAct_9fa48("3842") ? true : (stryCov_9fa48("3842", "3843"), hasChanges)) {
        if (stryMutAct_9fa48("3844")) {
          {}
        } else {
          stryCov_9fa48("3844");
          await this.fileCacheManager.saveCache(directory, files, stryMutAct_9fa48("3845") ? {} : (stryCov_9fa48("3845"), {
            searchMode: stryMutAct_9fa48("3846") ? "" : (stryCov_9fa48("3846"), 'recursive')
          }));
          logger.debug(stryMutAct_9fa48("3847") ? `` : (stryCov_9fa48("3847"), `Cache updated for ${directory}, ${files.length} files`));
        }
      } else {
        if (stryMutAct_9fa48("3848")) {
          {}
        } else {
          stryCov_9fa48("3848");
          await this.fileCacheManager.updateCacheTimestamp(directory);
          logger.debug(stryMutAct_9fa48("3849") ? `` : (stryCov_9fa48("3849"), `Cache timestamp updated for ${directory}, no file changes`));
        }
      }
      return hasChanges;
    }
  }

  /**
   * Clear cache for a directory
   */
  async clearCache(directory: string): Promise<void> {
    if (stryMutAct_9fa48("3850")) {
      {}
    } else {
      stryCov_9fa48("3850");
      if (stryMutAct_9fa48("3853") ? false : stryMutAct_9fa48("3852") ? true : stryMutAct_9fa48("3851") ? this.fileCacheManager : (stryCov_9fa48("3851", "3852", "3853"), !this.fileCacheManager)) return;
      try {
        if (stryMutAct_9fa48("3854")) {
          {}
        } else {
          stryCov_9fa48("3854");
          await this.fileCacheManager.clearCache(directory);
          logger.debug(stryMutAct_9fa48("3855") ? `` : (stryCov_9fa48("3855"), `Cleared cache for ${directory}`));
        }
      } catch {
        // Cache may not exist, ignore errors
      }
    }
  }

  /**
   * Set last used directory
   */
  async setLastUsedDirectory(directory: string): Promise<void> {
    if (stryMutAct_9fa48("3856")) {
      {}
    } else {
      stryCov_9fa48("3856");
      if (stryMutAct_9fa48("3859") ? false : stryMutAct_9fa48("3858") ? true : stryMutAct_9fa48("3857") ? this.fileCacheManager : (stryCov_9fa48("3857", "3858", "3859"), !this.fileCacheManager)) return;
      await this.fileCacheManager.setLastUsedDirectory(directory);
    }
  }

  /**
   * Handle cache operations for background directory detection
   * @returns true if files changed, false if no changes
   */
  async handleBackgroundCacheUpdate(detectedDirectory: string, files: FileInfo[] | undefined, isFileSearchDisabled: boolean): Promise<boolean> {
    if (stryMutAct_9fa48("3860")) {
      {}
    } else {
      stryCov_9fa48("3860");
      if (stryMutAct_9fa48("3863") ? false : stryMutAct_9fa48("3862") ? true : stryMutAct_9fa48("3861") ? this.fileCacheManager : (stryCov_9fa48("3861", "3862", "3863"), !this.fileCacheManager)) return stryMutAct_9fa48("3864") ? false : (stryCov_9fa48("3864"), true);

      // Skip cache operations for directories with file search disabled
      if (stryMutAct_9fa48("3866") ? false : stryMutAct_9fa48("3865") ? true : (stryCov_9fa48("3865", "3866"), isFileSearchDisabled)) {
        if (stryMutAct_9fa48("3867")) {
          {}
        } else {
          stryCov_9fa48("3867");
          await this.clearCache(detectedDirectory);
          logger.debug(stryMutAct_9fa48("3868") ? `` : (stryCov_9fa48("3868"), `Skipping cache for ${detectedDirectory} (file search disabled)`));
          return stryMutAct_9fa48("3869") ? true : (stryCov_9fa48("3869"), false);
        }
      }
      if (stryMutAct_9fa48("3872") ? false : stryMutAct_9fa48("3871") ? true : stryMutAct_9fa48("3870") ? files : (stryCov_9fa48("3870", "3871", "3872"), !files)) return stryMutAct_9fa48("3873") ? false : (stryCov_9fa48("3873"), true);

      // Check if file list has changed compared to cache
      const existingCache = await this.fileCacheManager.loadCache(detectedDirectory);
      const hasChanges = DirectoryDetectorUtils.hasFileListChanges(stryMutAct_9fa48("3874") ? existingCache.files : (stryCov_9fa48("3874"), existingCache?.files), files);

      // Update lastUsedDirectory
      await this.setLastUsedDirectory(detectedDirectory);

      // Update cache
      await this.updateCache(detectedDirectory, files, stryMutAct_9fa48("3875") ? existingCache.files : (stryCov_9fa48("3875"), existingCache?.files));
      return hasChanges;
    }
  }
}