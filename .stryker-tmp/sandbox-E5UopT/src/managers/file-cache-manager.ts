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
import { promises as fs } from 'fs';
import path from 'path';
import { createReadStream, createWriteStream } from 'fs';
import { createInterface } from 'readline';
import config from '../config/app-config';
import { logger } from '../utils/utils';
import type { FileInfo, FileCacheMetadata, CachedDirectoryData, GlobalCacheMetadata, FileCacheStats, CachedFileEntry } from '../types';
class FileCacheManager {
  private cacheDir: string;
  private globalMetadataPath: string;
  private static readonly CACHE_VERSION = stryMutAct_9fa48("2022") ? "" : (stryCov_9fa48("2022"), '1.0');
  private static readonly DEFAULT_TTL_SECONDS = 3600; // 1 hour
  private static readonly MAX_RECENT_DIRECTORIES = 10;
  constructor() {
    if (stryMutAct_9fa48("2023")) {
      {}
    } else {
      stryCov_9fa48("2023");
      this.cacheDir = path.join(config.paths.userDataDir, stryMutAct_9fa48("2024") ? "" : (stryCov_9fa48("2024"), 'cache'), stryMutAct_9fa48("2025") ? "" : (stryCov_9fa48("2025"), 'projects'));
      this.globalMetadataPath = path.join(this.cacheDir, stryMutAct_9fa48("2026") ? "" : (stryCov_9fa48("2026"), 'global-metadata.json'));
    }
  }

  /**
   * Initialize cache directory structure
   */
  async initialize(): Promise<void> {
    if (stryMutAct_9fa48("2027")) {
      {}
    } else {
      stryCov_9fa48("2027");
      try {
        if (stryMutAct_9fa48("2028")) {
          {}
        } else {
          stryCov_9fa48("2028");
          // Set restrictive directory permissions (owner read/write/execute only)
          await fs.mkdir(this.cacheDir, stryMutAct_9fa48("2029") ? {} : (stryCov_9fa48("2029"), {
            recursive: stryMutAct_9fa48("2030") ? false : (stryCov_9fa48("2030"), true),
            mode: 0o700
          }));
          logger.debug(stryMutAct_9fa48("2031") ? "" : (stryCov_9fa48("2031"), 'File cache manager initialized'));
        }
      } catch (error) {
        if (stryMutAct_9fa48("2032")) {
          {}
        } else {
          stryCov_9fa48("2032");
          logger.error(stryMutAct_9fa48("2033") ? "" : (stryCov_9fa48("2033"), 'Failed to initialize file cache manager:'), error);
          throw error;
        }
      }
    }
  }

  /**
   * Encode directory path for cache directory name
   * Claude projects style: / -> -
   * Example: /Users/nkmr/ghq -> -Users-nkmr-ghq
   */
  encodeDirectoryPath(directory: string): string {
    if (stryMutAct_9fa48("2034")) {
      {}
    } else {
      stryCov_9fa48("2034");
      return directory.replace(/\//g, stryMutAct_9fa48("2035") ? "" : (stryCov_9fa48("2035"), '-'));
    }
  }

  /**
   * Get cache directory path for a specific directory
   */
  getCachePath(directory: string): string {
    if (stryMutAct_9fa48("2036")) {
      {}
    } else {
      stryCov_9fa48("2036");
      const encoded = this.encodeDirectoryPath(directory);
      return path.join(this.cacheDir, encoded);
    }
  }

  /**
   * Load cache for a directory (returns immediately if exists)
   * Returns null if cache doesn't exist or is invalid
   */
  async loadCache(directory: string): Promise<CachedDirectoryData | null> {
    if (stryMutAct_9fa48("2037")) {
      {}
    } else {
      stryCov_9fa48("2037");
      try {
        if (stryMutAct_9fa48("2038")) {
          {}
        } else {
          stryCov_9fa48("2038");
          const cachePath = this.getCachePath(directory);
          const metadataPath = path.join(cachePath, stryMutAct_9fa48("2039") ? "" : (stryCov_9fa48("2039"), 'metadata.json'));
          const filesPath = path.join(cachePath, stryMutAct_9fa48("2040") ? "" : (stryCov_9fa48("2040"), 'files.jsonl'));

          // Check if both metadata and files exist
          try {
            if (stryMutAct_9fa48("2041")) {
              {}
            } else {
              stryCov_9fa48("2041");
              await fs.access(metadataPath);
              await fs.access(filesPath);
            }
          } catch {
            if (stryMutAct_9fa48("2042")) {
              {}
            } else {
              stryCov_9fa48("2042");
              logger.debug(stryMutAct_9fa48("2043") ? "" : (stryCov_9fa48("2043"), 'Cache not found for directory:'), directory);
              return null;
            }
          }

          // Read metadata
          const metadataContent = await fs.readFile(metadataPath, stryMutAct_9fa48("2044") ? "" : (stryCov_9fa48("2044"), 'utf8'));
          const metadata = JSON.parse(metadataContent) as FileCacheMetadata;

          // Read files from JSONL
          const entries = await this.readJsonlFile(filesPath);
          const files = entries.map(stryMutAct_9fa48("2045") ? () => undefined : (stryCov_9fa48("2045"), entry => this.cacheEntryToFileInfo(entry)));
          logger.debug(stryMutAct_9fa48("2046") ? `` : (stryCov_9fa48("2046"), `Loaded cache for directory: ${directory} (${files.length} files)`));
          return stryMutAct_9fa48("2047") ? {} : (stryCov_9fa48("2047"), {
            directory,
            files,
            metadata
          });
        }
      } catch (error) {
        if (stryMutAct_9fa48("2048")) {
          {}
        } else {
          stryCov_9fa48("2048");
          logger.error(stryMutAct_9fa48("2049") ? "" : (stryCov_9fa48("2049"), 'Failed to load cache:'), error);
          return null;
        }
      }
    }
  }

  /**
   * Save cache for a directory (background operation)
   * This should be called asynchronously after file search completes
   */
  async saveCache(directory: string, files: FileInfo[], options?: {
    searchMode?: 'recursive';
    gitignoreRespected?: boolean;
  }): Promise<void> {
    if (stryMutAct_9fa48("2050")) {
      {}
    } else {
      stryCov_9fa48("2050");
      try {
        if (stryMutAct_9fa48("2051")) {
          {}
        } else {
          stryCov_9fa48("2051");
          const cachePath = this.getCachePath(directory);
          const metadataPath = path.join(cachePath, stryMutAct_9fa48("2052") ? "" : (stryCov_9fa48("2052"), 'metadata.json'));
          const filesPath = path.join(cachePath, stryMutAct_9fa48("2053") ? "" : (stryCov_9fa48("2053"), 'files.jsonl'));

          // Create cache directory with restrictive permissions (owner read/write/execute only)
          await fs.mkdir(cachePath, stryMutAct_9fa48("2054") ? {} : (stryCov_9fa48("2054"), {
            recursive: stryMutAct_9fa48("2055") ? false : (stryCov_9fa48("2055"), true),
            mode: 0o700
          }));

          // Prepare metadata
          const now = new Date().toISOString();
          const metadata: FileCacheMetadata = stryMutAct_9fa48("2056") ? {} : (stryCov_9fa48("2056"), {
            version: FileCacheManager.CACHE_VERSION,
            directory,
            createdAt: now,
            updatedAt: now,
            fileCount: files.length,
            ttlSeconds: FileCacheManager.DEFAULT_TTL_SECONDS,
            searchMode: stryMutAct_9fa48("2057") ? "" : (stryCov_9fa48("2057"), 'recursive'),
            // Always recursive (fd is required)
            ...(stryMutAct_9fa48("2060") ? options?.gitignoreRespected !== undefined || {
              gitignoreRespected: options.gitignoreRespected
            } : stryMutAct_9fa48("2059") ? false : stryMutAct_9fa48("2058") ? true : (stryCov_9fa48("2058", "2059", "2060"), (stryMutAct_9fa48("2062") ? options?.gitignoreRespected === undefined : stryMutAct_9fa48("2061") ? true : (stryCov_9fa48("2061", "2062"), (stryMutAct_9fa48("2063") ? options.gitignoreRespected : (stryCov_9fa48("2063"), options?.gitignoreRespected)) !== undefined)) && (stryMutAct_9fa48("2064") ? {} : (stryCov_9fa48("2064"), {
              gitignoreRespected: options.gitignoreRespected
            }))))
          });

          // Write metadata with restrictive file permissions (owner read/write only)
          await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), stryMutAct_9fa48("2065") ? {} : (stryCov_9fa48("2065"), {
            mode: 0o600
          }));

          // Convert files to cache entries and write JSONL
          const entries = files.map(stryMutAct_9fa48("2066") ? () => undefined : (stryCov_9fa48("2066"), file => this.fileInfoToCacheEntry(file)));
          await this.writeJsonlFile(filesPath, entries);

          // Update global metadata
          await this.setLastUsedDirectory(directory);
          logger.debug(stryMutAct_9fa48("2067") ? `` : (stryCov_9fa48("2067"), `Saved cache for directory: ${directory} (${files.length} files)`));
        }
      } catch (error) {
        if (stryMutAct_9fa48("2068")) {
          {}
        } else {
          stryCov_9fa48("2068");
          logger.error(stryMutAct_9fa48("2069") ? "" : (stryCov_9fa48("2069"), 'Failed to save cache:'), error);
          // Don't throw - cache save failure shouldn't break file search
        }
      }
    }
  }

  /**
   * Check if cache is valid (within TTL)
   * Returns false if:
   * - Cache is older than TTL
   * - Cache has fileCount of 0 (indicates failed indexing, should re-index)
   */
  isCacheValid(metadata: FileCacheMetadata, ttlSeconds?: number): boolean {
    if (stryMutAct_9fa48("2070")) {
      {}
    } else {
      stryCov_9fa48("2070");
      // Invalidate cache if fileCount is 0 (indicates failed indexing)
      if (stryMutAct_9fa48("2073") ? metadata.fileCount !== 0 : stryMutAct_9fa48("2072") ? false : stryMutAct_9fa48("2071") ? true : (stryCov_9fa48("2071", "2072", "2073"), metadata.fileCount === 0)) {
        if (stryMutAct_9fa48("2074")) {
          {}
        } else {
          stryCov_9fa48("2074");
          logger.debug(stryMutAct_9fa48("2075") ? "" : (stryCov_9fa48("2075"), 'Cache invalid: fileCount is 0 (will re-index)'));
          return stryMutAct_9fa48("2076") ? true : (stryCov_9fa48("2076"), false);
        }
      }
      const ttl = stryMutAct_9fa48("2077") ? (ttlSeconds ?? metadata.ttlSeconds) && FileCacheManager.DEFAULT_TTL_SECONDS : (stryCov_9fa48("2077"), (stryMutAct_9fa48("2078") ? ttlSeconds && metadata.ttlSeconds : (stryCov_9fa48("2078"), ttlSeconds ?? metadata.ttlSeconds)) ?? FileCacheManager.DEFAULT_TTL_SECONDS);
      const updatedAt = new Date(metadata.updatedAt).getTime();
      const now = Date.now();
      const ageMs = stryMutAct_9fa48("2079") ? now + updatedAt : (stryCov_9fa48("2079"), now - updatedAt);
      const isValid = stryMutAct_9fa48("2083") ? ageMs >= ttl * 1000 : stryMutAct_9fa48("2082") ? ageMs <= ttl * 1000 : stryMutAct_9fa48("2081") ? false : stryMutAct_9fa48("2080") ? true : (stryCov_9fa48("2080", "2081", "2082", "2083"), ageMs < (stryMutAct_9fa48("2084") ? ttl / 1000 : (stryCov_9fa48("2084"), ttl * 1000)));
      logger.debug(stryMutAct_9fa48("2085") ? `` : (stryCov_9fa48("2085"), `Cache validity check: age=${ageMs}ms, ttl=${ttl}s, valid=${isValid}, fileCount=${metadata.fileCount}`));
      return isValid;
    }
  }

  /**
   * Update cache timestamp only (when no file changes detected)
   * This extends the cache TTL without rewriting files
   */
  async updateCacheTimestamp(directory: string): Promise<void> {
    if (stryMutAct_9fa48("2086")) {
      {}
    } else {
      stryCov_9fa48("2086");
      try {
        if (stryMutAct_9fa48("2087")) {
          {}
        } else {
          stryCov_9fa48("2087");
          const cachePath = this.getCachePath(directory);
          const metadataPath = path.join(cachePath, stryMutAct_9fa48("2088") ? "" : (stryCov_9fa48("2088"), 'metadata.json'));

          // Read existing metadata
          const metadataContent = await fs.readFile(metadataPath, stryMutAct_9fa48("2089") ? "" : (stryCov_9fa48("2089"), 'utf8'));
          const metadata = JSON.parse(metadataContent) as FileCacheMetadata;

          // Update only the updatedAt field
          metadata.updatedAt = new Date().toISOString();

          // Write back with restrictive file permissions (owner read/write only)
          await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), stryMutAct_9fa48("2090") ? {} : (stryCov_9fa48("2090"), {
            mode: 0o600
          }));
          logger.debug(stryMutAct_9fa48("2091") ? `` : (stryCov_9fa48("2091"), `Updated cache timestamp for directory: ${directory}`));
        }
      } catch (error) {
        if (stryMutAct_9fa48("2092")) {
          {}
        } else {
          stryCov_9fa48("2092");
          logger.error(stryMutAct_9fa48("2093") ? "" : (stryCov_9fa48("2093"), 'Failed to update cache timestamp:'), error);
          // Don't throw - timestamp update failure shouldn't break operations
        }
      }
    }
  }

  /**
   * Get last used directory from global metadata
   */
  async getLastUsedDirectory(): Promise<string | null> {
    if (stryMutAct_9fa48("2094")) {
      {}
    } else {
      stryCov_9fa48("2094");
      try {
        if (stryMutAct_9fa48("2095")) {
          {}
        } else {
          stryCov_9fa48("2095");
          const content = await fs.readFile(this.globalMetadataPath, stryMutAct_9fa48("2096") ? "" : (stryCov_9fa48("2096"), 'utf8'));
          const metadata = JSON.parse(content) as GlobalCacheMetadata;
          return metadata.lastUsedDirectory;
        }
      } catch (error) {
        if (stryMutAct_9fa48("2097")) {
          {}
        } else {
          stryCov_9fa48("2097");
          if (stryMutAct_9fa48("2100") ? (error as NodeJS.ErrnoException).code !== 'ENOENT' : stryMutAct_9fa48("2099") ? false : stryMutAct_9fa48("2098") ? true : (stryCov_9fa48("2098", "2099", "2100"), (error as NodeJS.ErrnoException).code === (stryMutAct_9fa48("2101") ? "" : (stryCov_9fa48("2101"), 'ENOENT')))) {
            if (stryMutAct_9fa48("2102")) {
              {}
            } else {
              stryCov_9fa48("2102");
              logger.debug(stryMutAct_9fa48("2103") ? "" : (stryCov_9fa48("2103"), 'Global metadata not found'));
              return null;
            }
          }
          logger.error(stryMutAct_9fa48("2104") ? "" : (stryCov_9fa48("2104"), 'Failed to read global metadata:'), error);
          return null;
        }
      }
    }
  }

  /**
   * Set last used directory in global metadata
   */
  async setLastUsedDirectory(directory: string): Promise<void> {
    if (stryMutAct_9fa48("2105")) {
      {}
    } else {
      stryCov_9fa48("2105");
      try {
        if (stryMutAct_9fa48("2106")) {
          {}
        } else {
          stryCov_9fa48("2106");
          let metadata: GlobalCacheMetadata;
          try {
            if (stryMutAct_9fa48("2107")) {
              {}
            } else {
              stryCov_9fa48("2107");
              const content = await fs.readFile(this.globalMetadataPath, stryMutAct_9fa48("2108") ? "" : (stryCov_9fa48("2108"), 'utf8'));
              metadata = JSON.parse(content) as GlobalCacheMetadata;
            }
          } catch {
            if (stryMutAct_9fa48("2109")) {
              {}
            } else {
              stryCov_9fa48("2109");
              // Create new metadata if not exists
              metadata = stryMutAct_9fa48("2110") ? {} : (stryCov_9fa48("2110"), {
                version: FileCacheManager.CACHE_VERSION,
                lastUsedDirectory: null,
                lastUsedAt: null,
                recentDirectories: stryMutAct_9fa48("2111") ? ["Stryker was here"] : (stryCov_9fa48("2111"), [])
              });
            }
          }
          const now = new Date().toISOString();

          // Update last used
          metadata.lastUsedDirectory = directory;
          metadata.lastUsedAt = now;

          // Update recent directories list
          // Remove if already exists
          metadata.recentDirectories = stryMutAct_9fa48("2112") ? metadata.recentDirectories : (stryCov_9fa48("2112"), metadata.recentDirectories.filter(stryMutAct_9fa48("2113") ? () => undefined : (stryCov_9fa48("2113"), item => stryMutAct_9fa48("2116") ? item.directory === directory : stryMutAct_9fa48("2115") ? false : stryMutAct_9fa48("2114") ? true : (stryCov_9fa48("2114", "2115", "2116"), item.directory !== directory))));

          // Add to front
          metadata.recentDirectories.unshift(stryMutAct_9fa48("2117") ? {} : (stryCov_9fa48("2117"), {
            directory,
            lastUsedAt: now
          }));

          // Limit to MAX_RECENT_DIRECTORIES
          metadata.recentDirectories = stryMutAct_9fa48("2118") ? metadata.recentDirectories : (stryCov_9fa48("2118"), metadata.recentDirectories.slice(0, FileCacheManager.MAX_RECENT_DIRECTORIES));

          // Write back
          await fs.writeFile(this.globalMetadataPath, JSON.stringify(metadata, null, 2));
          logger.debug(stryMutAct_9fa48("2119") ? `` : (stryCov_9fa48("2119"), `Updated global metadata with directory: ${directory}`));
        }
      } catch (error) {
        if (stryMutAct_9fa48("2120")) {
          {}
        } else {
          stryCov_9fa48("2120");
          logger.error(stryMutAct_9fa48("2121") ? "" : (stryCov_9fa48("2121"), 'Failed to update global metadata:'), error);
          // Don't throw - metadata update failure shouldn't break operations
        }
      }
    }
  }

  /**
   * Clear cache for a specific directory
   */
  async clearCache(directory: string): Promise<void> {
    if (stryMutAct_9fa48("2122")) {
      {}
    } else {
      stryCov_9fa48("2122");
      try {
        if (stryMutAct_9fa48("2123")) {
          {}
        } else {
          stryCov_9fa48("2123");
          const cachePath = this.getCachePath(directory);

          // Remove cache directory recursively
          await fs.rm(cachePath, stryMutAct_9fa48("2124") ? {} : (stryCov_9fa48("2124"), {
            recursive: stryMutAct_9fa48("2125") ? false : (stryCov_9fa48("2125"), true),
            force: stryMutAct_9fa48("2126") ? false : (stryCov_9fa48("2126"), true)
          }));
          logger.info(stryMutAct_9fa48("2127") ? `` : (stryCov_9fa48("2127"), `Cleared cache for directory: ${directory}`));
        }
      } catch (error) {
        if (stryMutAct_9fa48("2128")) {
          {}
        } else {
          stryCov_9fa48("2128");
          logger.error(stryMutAct_9fa48("2129") ? "" : (stryCov_9fa48("2129"), 'Failed to clear cache:'), error);
          throw error;
        }
      }
    }
  }

  /**
   * Clear all caches
   */
  async clearAllCaches(): Promise<void> {
    if (stryMutAct_9fa48("2130")) {
      {}
    } else {
      stryCov_9fa48("2130");
      try {
        if (stryMutAct_9fa48("2131")) {
          {}
        } else {
          stryCov_9fa48("2131");
          // Read all cache directories
          const entries = await fs.readdir(this.cacheDir, stryMutAct_9fa48("2132") ? {} : (stryCov_9fa48("2132"), {
            withFileTypes: stryMutAct_9fa48("2133") ? false : (stryCov_9fa48("2133"), true)
          }));

          // Remove all directories except global-metadata.json
          for (const entry of entries) {
            if (stryMutAct_9fa48("2134")) {
              {}
            } else {
              stryCov_9fa48("2134");
              if (stryMutAct_9fa48("2136") ? false : stryMutAct_9fa48("2135") ? true : (stryCov_9fa48("2135", "2136"), entry.isDirectory())) {
                if (stryMutAct_9fa48("2137")) {
                  {}
                } else {
                  stryCov_9fa48("2137");
                  const cachePath = path.join(this.cacheDir, entry.name);
                  await fs.rm(cachePath, stryMutAct_9fa48("2138") ? {} : (stryCov_9fa48("2138"), {
                    recursive: stryMutAct_9fa48("2139") ? false : (stryCov_9fa48("2139"), true),
                    force: stryMutAct_9fa48("2140") ? false : (stryCov_9fa48("2140"), true)
                  }));
                }
              }
            }
          }

          // Also remove global metadata
          await fs.rm(this.globalMetadataPath, stryMutAct_9fa48("2141") ? {} : (stryCov_9fa48("2141"), {
            force: stryMutAct_9fa48("2142") ? false : (stryCov_9fa48("2142"), true)
          }));
          logger.info(stryMutAct_9fa48("2143") ? "" : (stryCov_9fa48("2143"), 'Cleared all caches'));
        }
      } catch (error) {
        if (stryMutAct_9fa48("2144")) {
          {}
        } else {
          stryCov_9fa48("2144");
          logger.error(stryMutAct_9fa48("2145") ? "" : (stryCov_9fa48("2145"), 'Failed to clear all caches:'), error);
          throw error;
        }
      }
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<FileCacheStats> {
    if (stryMutAct_9fa48("2146")) {
      {}
    } else {
      stryCov_9fa48("2146");
      try {
        if (stryMutAct_9fa48("2147")) {
          {}
        } else {
          stryCov_9fa48("2147");
          const entries = await fs.readdir(this.cacheDir, stryMutAct_9fa48("2148") ? {} : (stryCov_9fa48("2148"), {
            withFileTypes: stryMutAct_9fa48("2149") ? false : (stryCov_9fa48("2149"), true)
          }));
          let totalCaches = 0;
          let totalFiles = 0;
          let oldestCache: string | null = null;
          let newestCache: string | null = null;
          let totalSizeBytes = 0;
          let oldestTimestamp = Number.MAX_SAFE_INTEGER;
          let newestTimestamp = 0;
          for (const entry of entries) {
            if (stryMutAct_9fa48("2150")) {
              {}
            } else {
              stryCov_9fa48("2150");
              if (stryMutAct_9fa48("2153") ? false : stryMutAct_9fa48("2152") ? true : stryMutAct_9fa48("2151") ? entry.isDirectory() : (stryCov_9fa48("2151", "2152", "2153"), !entry.isDirectory())) continue;
              const metadataPath = path.join(this.cacheDir, entry.name, stryMutAct_9fa48("2154") ? "" : (stryCov_9fa48("2154"), 'metadata.json'));
              try {
                if (stryMutAct_9fa48("2155")) {
                  {}
                } else {
                  stryCov_9fa48("2155");
                  const content = await fs.readFile(metadataPath, stryMutAct_9fa48("2156") ? "" : (stryCov_9fa48("2156"), 'utf8'));
                  const metadata = JSON.parse(content) as FileCacheMetadata;
                  stryMutAct_9fa48("2157") ? totalCaches-- : (stryCov_9fa48("2157"), totalCaches++);
                  stryMutAct_9fa48("2158") ? totalFiles -= metadata.fileCount : (stryCov_9fa48("2158"), totalFiles += metadata.fileCount);
                  const timestamp = new Date(metadata.updatedAt).getTime();
                  if (stryMutAct_9fa48("2162") ? timestamp >= oldestTimestamp : stryMutAct_9fa48("2161") ? timestamp <= oldestTimestamp : stryMutAct_9fa48("2160") ? false : stryMutAct_9fa48("2159") ? true : (stryCov_9fa48("2159", "2160", "2161", "2162"), timestamp < oldestTimestamp)) {
                    if (stryMutAct_9fa48("2163")) {
                      {}
                    } else {
                      stryCov_9fa48("2163");
                      oldestTimestamp = timestamp;
                      oldestCache = metadata.directory;
                    }
                  }
                  if (stryMutAct_9fa48("2167") ? timestamp <= newestTimestamp : stryMutAct_9fa48("2166") ? timestamp >= newestTimestamp : stryMutAct_9fa48("2165") ? false : stryMutAct_9fa48("2164") ? true : (stryCov_9fa48("2164", "2165", "2166", "2167"), timestamp > newestTimestamp)) {
                    if (stryMutAct_9fa48("2168")) {
                      {}
                    } else {
                      stryCov_9fa48("2168");
                      newestTimestamp = timestamp;
                      newestCache = metadata.directory;
                    }
                  }

                  // Calculate directory size
                  const filesPath = path.join(this.cacheDir, entry.name, stryMutAct_9fa48("2169") ? "" : (stryCov_9fa48("2169"), 'files.jsonl'));
                  const stats = await fs.stat(filesPath);
                  stryMutAct_9fa48("2170") ? totalSizeBytes -= stats.size : (stryCov_9fa48("2170"), totalSizeBytes += stats.size);
                }
              } catch {
                if (stryMutAct_9fa48("2171")) {
                  {}
                } else {
                  stryCov_9fa48("2171");
                  // Skip invalid cache entries
                  continue;
                }
              }
            }
          }
          return stryMutAct_9fa48("2172") ? {} : (stryCov_9fa48("2172"), {
            totalCaches,
            totalFiles,
            oldestCache,
            newestCache,
            totalSizeBytes
          });
        }
      } catch (error) {
        if (stryMutAct_9fa48("2173")) {
          {}
        } else {
          stryCov_9fa48("2173");
          logger.error(stryMutAct_9fa48("2174") ? "" : (stryCov_9fa48("2174"), 'Failed to get cache stats:'), error);
          return stryMutAct_9fa48("2175") ? {} : (stryCov_9fa48("2175"), {
            totalCaches: 0,
            totalFiles: 0,
            oldestCache: null,
            newestCache: null,
            totalSizeBytes: 0
          });
        }
      }
    }
  }

  /**
   * Cleanup old caches (for periodic maintenance)
   * Removes caches older than maxAgeDays
   */
  async cleanupOldCaches(maxAgeDays: number): Promise<void> {
    if (stryMutAct_9fa48("2176")) {
      {}
    } else {
      stryCov_9fa48("2176");
      try {
        if (stryMutAct_9fa48("2177")) {
          {}
        } else {
          stryCov_9fa48("2177");
          const entries = await fs.readdir(this.cacheDir, stryMutAct_9fa48("2178") ? {} : (stryCov_9fa48("2178"), {
            withFileTypes: stryMutAct_9fa48("2179") ? false : (stryCov_9fa48("2179"), true)
          }));
          const maxAgeMs = stryMutAct_9fa48("2180") ? maxAgeDays * 24 * 60 * 60 / 1000 : (stryCov_9fa48("2180"), (stryMutAct_9fa48("2181") ? maxAgeDays * 24 * 60 / 60 : (stryCov_9fa48("2181"), (stryMutAct_9fa48("2182") ? maxAgeDays * 24 / 60 : (stryCov_9fa48("2182"), (stryMutAct_9fa48("2183") ? maxAgeDays / 24 : (stryCov_9fa48("2183"), maxAgeDays * 24)) * 60)) * 60)) * 1000);
          const now = Date.now();
          let removedCount = 0;
          for (const entry of entries) {
            if (stryMutAct_9fa48("2184")) {
              {}
            } else {
              stryCov_9fa48("2184");
              if (stryMutAct_9fa48("2187") ? false : stryMutAct_9fa48("2186") ? true : stryMutAct_9fa48("2185") ? entry.isDirectory() : (stryCov_9fa48("2185", "2186", "2187"), !entry.isDirectory())) continue;
              const metadataPath = path.join(this.cacheDir, entry.name, stryMutAct_9fa48("2188") ? "" : (stryCov_9fa48("2188"), 'metadata.json'));
              try {
                if (stryMutAct_9fa48("2189")) {
                  {}
                } else {
                  stryCov_9fa48("2189");
                  const content = await fs.readFile(metadataPath, stryMutAct_9fa48("2190") ? "" : (stryCov_9fa48("2190"), 'utf8'));
                  const metadata = JSON.parse(content) as FileCacheMetadata;
                  const timestamp = new Date(metadata.updatedAt).getTime();
                  const age = stryMutAct_9fa48("2191") ? now + timestamp : (stryCov_9fa48("2191"), now - timestamp);
                  if (stryMutAct_9fa48("2195") ? age <= maxAgeMs : stryMutAct_9fa48("2194") ? age >= maxAgeMs : stryMutAct_9fa48("2193") ? false : stryMutAct_9fa48("2192") ? true : (stryCov_9fa48("2192", "2193", "2194", "2195"), age > maxAgeMs)) {
                    if (stryMutAct_9fa48("2196")) {
                      {}
                    } else {
                      stryCov_9fa48("2196");
                      const cachePath = path.join(this.cacheDir, entry.name);
                      await fs.rm(cachePath, stryMutAct_9fa48("2197") ? {} : (stryCov_9fa48("2197"), {
                        recursive: stryMutAct_9fa48("2198") ? false : (stryCov_9fa48("2198"), true),
                        force: stryMutAct_9fa48("2199") ? false : (stryCov_9fa48("2199"), true)
                      }));
                      stryMutAct_9fa48("2200") ? removedCount-- : (stryCov_9fa48("2200"), removedCount++);
                      logger.debug(stryMutAct_9fa48("2201") ? `` : (stryCov_9fa48("2201"), `Removed old cache: ${metadata.directory}`));
                    }
                  }
                }
              } catch {
                if (stryMutAct_9fa48("2202")) {
                  {}
                } else {
                  stryCov_9fa48("2202");
                  // Skip invalid cache entries
                  continue;
                }
              }
            }
          }
          logger.info(stryMutAct_9fa48("2203") ? `` : (stryCov_9fa48("2203"), `Cleanup completed: removed ${removedCount} old caches`));
        }
      } catch (error) {
        if (stryMutAct_9fa48("2204")) {
          {}
        } else {
          stryCov_9fa48("2204");
          logger.error(stryMutAct_9fa48("2205") ? "" : (stryCov_9fa48("2205"), 'Failed to cleanup old caches:'), error);
          throw error;
        }
      }
    }
  }

  /**
   * Convert FileInfo to CachedFileEntry for storage
   * Uses compact format to reduce file size
   */
  private fileInfoToCacheEntry(file: FileInfo): CachedFileEntry {
    if (stryMutAct_9fa48("2206")) {
      {}
    } else {
      stryCov_9fa48("2206");
      const entry: CachedFileEntry = stryMutAct_9fa48("2207") ? {} : (stryCov_9fa48("2207"), {
        path: file.path,
        name: file.name,
        type: file.isDirectory ? stryMutAct_9fa48("2208") ? "" : (stryCov_9fa48("2208"), 'directory') : stryMutAct_9fa48("2209") ? "" : (stryCov_9fa48("2209"), 'file')
      });
      if (stryMutAct_9fa48("2212") ? file.size === undefined : stryMutAct_9fa48("2211") ? false : stryMutAct_9fa48("2210") ? true : (stryCov_9fa48("2210", "2211", "2212"), file.size !== undefined)) {
        if (stryMutAct_9fa48("2213")) {
          {}
        } else {
          stryCov_9fa48("2213");
          entry.size = file.size;
        }
      }
      if (stryMutAct_9fa48("2215") ? false : stryMutAct_9fa48("2214") ? true : (stryCov_9fa48("2214", "2215"), file.modifiedAt)) {
        if (stryMutAct_9fa48("2216")) {
          {}
        } else {
          stryCov_9fa48("2216");
          entry.mtime = new Date(file.modifiedAt).getTime();
        }
      }
      return entry;
    }
  }

  /**
   * Convert CachedFileEntry to FileInfo for use
   */
  private cacheEntryToFileInfo(entry: CachedFileEntry): FileInfo {
    if (stryMutAct_9fa48("2217")) {
      {}
    } else {
      stryCov_9fa48("2217");
      const fileInfo: FileInfo = stryMutAct_9fa48("2218") ? {} : (stryCov_9fa48("2218"), {
        path: entry.path,
        name: entry.name,
        isDirectory: stryMutAct_9fa48("2221") ? entry.type !== 'directory' : stryMutAct_9fa48("2220") ? false : stryMutAct_9fa48("2219") ? true : (stryCov_9fa48("2219", "2220", "2221"), entry.type === (stryMutAct_9fa48("2222") ? "" : (stryCov_9fa48("2222"), 'directory')))
      });
      if (stryMutAct_9fa48("2225") ? entry.size === undefined : stryMutAct_9fa48("2224") ? false : stryMutAct_9fa48("2223") ? true : (stryCov_9fa48("2223", "2224", "2225"), entry.size !== undefined)) {
        if (stryMutAct_9fa48("2226")) {
          {}
        } else {
          stryCov_9fa48("2226");
          fileInfo.size = entry.size;
        }
      }
      if (stryMutAct_9fa48("2229") ? entry.mtime === undefined : stryMutAct_9fa48("2228") ? false : stryMutAct_9fa48("2227") ? true : (stryCov_9fa48("2227", "2228", "2229"), entry.mtime !== undefined)) {
        if (stryMutAct_9fa48("2230")) {
          {}
        } else {
          stryCov_9fa48("2230");
          fileInfo.modifiedAt = new Date(entry.mtime).toISOString();
        }
      }
      return fileInfo;
    }
  }

  /**
   * Read JSONL file as stream for memory efficiency
   */
  private async readJsonlFile(filePath: string): Promise<CachedFileEntry[]> {
    if (stryMutAct_9fa48("2231")) {
      {}
    } else {
      stryCov_9fa48("2231");
      return new Promise((resolve, reject) => {
        if (stryMutAct_9fa48("2232")) {
          {}
        } else {
          stryCov_9fa48("2232");
          const entries: CachedFileEntry[] = stryMutAct_9fa48("2233") ? ["Stryker was here"] : (stryCov_9fa48("2233"), []);
          const fileStream = createReadStream(filePath);
          const rl = createInterface(stryMutAct_9fa48("2234") ? {} : (stryCov_9fa48("2234"), {
            input: fileStream,
            crlfDelay: Infinity
          }));
          rl.on(stryMutAct_9fa48("2235") ? "" : (stryCov_9fa48("2235"), 'line'), line => {
            if (stryMutAct_9fa48("2236")) {
              {}
            } else {
              stryCov_9fa48("2236");
              try {
                if (stryMutAct_9fa48("2237")) {
                  {}
                } else {
                  stryCov_9fa48("2237");
                  if (stryMutAct_9fa48("2240") ? line : stryMutAct_9fa48("2239") ? false : stryMutAct_9fa48("2238") ? true : (stryCov_9fa48("2238", "2239", "2240"), line.trim())) {
                    if (stryMutAct_9fa48("2241")) {
                      {}
                    } else {
                      stryCov_9fa48("2241");
                      const entry = JSON.parse(line) as CachedFileEntry;
                      entries.push(entry);
                    }
                  }
                }
              } catch {
                if (stryMutAct_9fa48("2242")) {
                  {}
                } else {
                  stryCov_9fa48("2242");
                  logger.warn(stryMutAct_9fa48("2243") ? "" : (stryCov_9fa48("2243"), 'Invalid JSONL line in cache file:'), line);
                }
              }
            }
          });
          rl.on(stryMutAct_9fa48("2244") ? "" : (stryCov_9fa48("2244"), 'close'), () => {
            if (stryMutAct_9fa48("2245")) {
              {}
            } else {
              stryCov_9fa48("2245");
              resolve(entries);
            }
          });
          rl.on(stryMutAct_9fa48("2246") ? "" : (stryCov_9fa48("2246"), 'error'), error => {
            if (stryMutAct_9fa48("2247")) {
              {}
            } else {
              stryCov_9fa48("2247");
              reject(error);
            }
          });
        }
      });
    }
  }

  /**
   * Write JSONL file as stream for memory efficiency
   */
  private async writeJsonlFile(filePath: string, entries: CachedFileEntry[]): Promise<void> {
    if (stryMutAct_9fa48("2248")) {
      {}
    } else {
      stryCov_9fa48("2248");
      return new Promise((resolve, reject) => {
        if (stryMutAct_9fa48("2249")) {
          {}
        } else {
          stryCov_9fa48("2249");
          // Set restrictive file permissions (owner read/write only)
          const writeStream = createWriteStream(filePath, stryMutAct_9fa48("2250") ? {} : (stryCov_9fa48("2250"), {
            mode: 0o600
          }));
          writeStream.on(stryMutAct_9fa48("2251") ? "" : (stryCov_9fa48("2251"), 'error'), reject);
          writeStream.on(stryMutAct_9fa48("2252") ? "" : (stryCov_9fa48("2252"), 'finish'), resolve);
          for (const entry of entries) {
            if (stryMutAct_9fa48("2253")) {
              {}
            } else {
              stryCov_9fa48("2253");
              writeStream.write(JSON.stringify(entry) + (stryMutAct_9fa48("2254") ? "" : (stryCov_9fa48("2254"), '\n')));
            }
          }
          writeStream.end();
        }
      });
    }
  }
}
export default FileCacheManager;