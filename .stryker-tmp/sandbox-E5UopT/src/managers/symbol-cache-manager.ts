/**
 * Symbol Cache Manager
 * Manages disk caching for symbol search results
 * Uses language-separated files for efficient access
 *
 * File structure:
 *   ~/.prompt-line/cache/<encoded-path>/
 *     symbol-metadata.json     - Metadata with language info
 *     symbols-go.jsonl         - Go symbols
 *     symbols-ts.jsonl         - TypeScript symbols
 *     symbols-py.jsonl         - Python symbols
 *     ...
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
import { promises as fs } from 'fs';
import path from 'path';
import config from '../config/app-config';
import { logger, ensureDir } from '../utils/utils';
import type { SymbolResult, SymbolCacheMetadata } from './symbol-search/types';

// Cache configuration
const CACHE_VERSION = stryMutAct_9fa48("3499") ? "" : (stryCov_9fa48("3499"), '2.0'); // Version bump for new file structure
const DEFAULT_TTL_SECONDS = 3600; // 1 hour
const SYMBOL_METADATA_FILE = stryMutAct_9fa48("3500") ? "" : (stryCov_9fa48("3500"), 'symbol-metadata.json');
const SYMBOLS_FILE_PREFIX = stryMutAct_9fa48("3501") ? "" : (stryCov_9fa48("3501"), 'symbols-'); // symbols-{language}.jsonl

/**
 * Symbol Cache Manager for disk-based caching
 */
export class SymbolCacheManager {
  private cacheDir: string;
  constructor() {
    if (stryMutAct_9fa48("3502")) {
      {}
    } else {
      stryCov_9fa48("3502");
      this.cacheDir = config.paths.projectsCacheDir;
    }
  }

  /**
   * Encode directory path to safe cache directory name
   */
  private encodePath(directoryPath: string): string {
    if (stryMutAct_9fa48("3503")) {
      {}
    } else {
      stryCov_9fa48("3503");
      return directoryPath.replace(/\//g, stryMutAct_9fa48("3504") ? "" : (stryCov_9fa48("3504"), '-'));
    }
  }

  /**
   * Get cache directory for a project
   */
  private getProjectCacheDir(directory: string): string {
    if (stryMutAct_9fa48("3505")) {
      {}
    } else {
      stryCov_9fa48("3505");
      const encodedPath = this.encodePath(directory);
      return path.join(this.cacheDir, encodedPath);
    }
  }

  /**
   * Get metadata file path for a project
   */
  private getMetadataPath(directory: string): string {
    if (stryMutAct_9fa48("3506")) {
      {}
    } else {
      stryCov_9fa48("3506");
      return path.join(this.getProjectCacheDir(directory), SYMBOL_METADATA_FILE);
    }
  }

  /**
   * Get symbols file path for a project and language
   * @param directory - The project directory
   * @param language - The language key (e.g., 'go', 'ts', 'py')
   */
  private getSymbolsPath(directory: string, language: string): string {
    if (stryMutAct_9fa48("3507")) {
      {}
    } else {
      stryCov_9fa48("3507");
      return path.join(this.getProjectCacheDir(directory), stryMutAct_9fa48("3508") ? `` : (stryCov_9fa48("3508"), `${SYMBOLS_FILE_PREFIX}${language}.jsonl`));
    }
  }

  /**
   * Check if cache exists and is valid for a directory
   */
  async isCacheValid(directory: string): Promise<boolean> {
    if (stryMutAct_9fa48("3509")) {
      {}
    } else {
      stryCov_9fa48("3509");
      try {
        if (stryMutAct_9fa48("3510")) {
          {}
        } else {
          stryCov_9fa48("3510");
          const metadataPath = this.getMetadataPath(directory);
          const content = await fs.readFile(metadataPath, stryMutAct_9fa48("3511") ? "" : (stryCov_9fa48("3511"), 'utf8'));
          const metadata: SymbolCacheMetadata = JSON.parse(content);

          // Check version
          if (stryMutAct_9fa48("3514") ? metadata.version === CACHE_VERSION : stryMutAct_9fa48("3513") ? false : stryMutAct_9fa48("3512") ? true : (stryCov_9fa48("3512", "3513", "3514"), metadata.version !== CACHE_VERSION)) {
            if (stryMutAct_9fa48("3515")) {
              {}
            } else {
              stryCov_9fa48("3515");
              logger.debug(stryMutAct_9fa48("3516") ? "" : (stryCov_9fa48("3516"), 'Symbol cache version mismatch'), stryMutAct_9fa48("3517") ? {} : (stryCov_9fa48("3517"), {
                expected: CACHE_VERSION,
                actual: metadata.version
              }));
              return stryMutAct_9fa48("3518") ? true : (stryCov_9fa48("3518"), false);
            }
          }

          // Check directory match
          if (stryMutAct_9fa48("3521") ? metadata.directory === directory : stryMutAct_9fa48("3520") ? false : stryMutAct_9fa48("3519") ? true : (stryCov_9fa48("3519", "3520", "3521"), metadata.directory !== directory)) {
            if (stryMutAct_9fa48("3522")) {
              {}
            } else {
              stryCov_9fa48("3522");
              logger.debug(stryMutAct_9fa48("3523") ? "" : (stryCov_9fa48("3523"), 'Symbol cache directory mismatch'));
              return stryMutAct_9fa48("3524") ? true : (stryCov_9fa48("3524"), false);
            }
          }

          // Check TTL
          const updatedAt = new Date(metadata.updatedAt);
          const now = new Date();
          const ageSeconds = stryMutAct_9fa48("3525") ? (now.getTime() - updatedAt.getTime()) * 1000 : (stryCov_9fa48("3525"), (stryMutAct_9fa48("3526") ? now.getTime() + updatedAt.getTime() : (stryCov_9fa48("3526"), now.getTime() - updatedAt.getTime())) / 1000);
          if (stryMutAct_9fa48("3530") ? ageSeconds <= metadata.ttlSeconds : stryMutAct_9fa48("3529") ? ageSeconds >= metadata.ttlSeconds : stryMutAct_9fa48("3528") ? false : stryMutAct_9fa48("3527") ? true : (stryCov_9fa48("3527", "3528", "3529", "3530"), ageSeconds > metadata.ttlSeconds)) {
            if (stryMutAct_9fa48("3531")) {
              {}
            } else {
              stryCov_9fa48("3531");
              logger.debug(stryMutAct_9fa48("3532") ? "" : (stryCov_9fa48("3532"), 'Symbol cache expired'), stryMutAct_9fa48("3533") ? {} : (stryCov_9fa48("3533"), {
                ageSeconds,
                ttlSeconds: metadata.ttlSeconds
              }));
              return stryMutAct_9fa48("3534") ? true : (stryCov_9fa48("3534"), false);
            }
          }
          return stryMutAct_9fa48("3535") ? false : (stryCov_9fa48("3535"), true);
        }
      } catch {
        if (stryMutAct_9fa48("3536")) {
          {}
        } else {
          stryCov_9fa48("3536");
          return stryMutAct_9fa48("3537") ? true : (stryCov_9fa48("3537"), false);
        }
      }
    }
  }

  /**
   * Check if cache exists for a specific language
   */
  async hasLanguageCache(directory: string, language: string): Promise<boolean> {
    if (stryMutAct_9fa48("3538")) {
      {}
    } else {
      stryCov_9fa48("3538");
      try {
        if (stryMutAct_9fa48("3539")) {
          {}
        } else {
          stryCov_9fa48("3539");
          const metadataPath = this.getMetadataPath(directory);
          const content = await fs.readFile(metadataPath, stryMutAct_9fa48("3540") ? "" : (stryCov_9fa48("3540"), 'utf8'));
          const metadata: SymbolCacheMetadata = JSON.parse(content);
          return language in metadata.languages;
        }
      } catch {
        if (stryMutAct_9fa48("3541")) {
          {}
        } else {
          stryCov_9fa48("3541");
          return stryMutAct_9fa48("3542") ? true : (stryCov_9fa48("3542"), false);
        }
      }
    }
  }

  /**
   * Load cached symbols for a directory and language
   * If language is specified, loads from language-specific file
   * If language is not specified, loads from all language files
   */
  async loadSymbols(directory: string, language?: string): Promise<SymbolResult[]> {
    if (stryMutAct_9fa48("3543")) {
      {}
    } else {
      stryCov_9fa48("3543");
      try {
        if (stryMutAct_9fa48("3544")) {
          {}
        } else {
          stryCov_9fa48("3544");
          if (stryMutAct_9fa48("3546") ? false : stryMutAct_9fa48("3545") ? true : (stryCov_9fa48("3545", "3546"), language)) {
            if (stryMutAct_9fa48("3547")) {
              {}
            } else {
              stryCov_9fa48("3547");
              // Load from language-specific file
              return await this.loadSymbolsForLanguage(directory, language);
            }
          }

          // Load from all language files
          const metadata = await this.loadMetadata(directory);
          if (stryMutAct_9fa48("3550") ? false : stryMutAct_9fa48("3549") ? true : stryMutAct_9fa48("3548") ? metadata : (stryCov_9fa48("3548", "3549", "3550"), !metadata)) {
            if (stryMutAct_9fa48("3551")) {
              {}
            } else {
              stryCov_9fa48("3551");
              return stryMutAct_9fa48("3552") ? ["Stryker was here"] : (stryCov_9fa48("3552"), []);
            }
          }
          const allSymbols: SymbolResult[] = stryMutAct_9fa48("3553") ? ["Stryker was here"] : (stryCov_9fa48("3553"), []);
          for (const lang of Object.keys(metadata.languages)) {
            if (stryMutAct_9fa48("3554")) {
              {}
            } else {
              stryCov_9fa48("3554");
              const langSymbols = await this.loadSymbolsForLanguage(directory, lang);
              allSymbols.push(...langSymbols);
            }
          }
          logger.debug(stryMutAct_9fa48("3555") ? "" : (stryCov_9fa48("3555"), 'Loaded symbols from cache (all languages)'), stryMutAct_9fa48("3556") ? {} : (stryCov_9fa48("3556"), {
            directory,
            count: allSymbols.length
          }));
          return allSymbols;
        }
      } catch (error) {
        if (stryMutAct_9fa48("3557")) {
          {}
        } else {
          stryCov_9fa48("3557");
          logger.debug(stryMutAct_9fa48("3558") ? "" : (stryCov_9fa48("3558"), 'Error loading symbol cache:'), error);
          return stryMutAct_9fa48("3559") ? ["Stryker was here"] : (stryCov_9fa48("3559"), []);
        }
      }
    }
  }

  /**
   * Load symbols for a specific language from its dedicated file
   */
  private async loadSymbolsForLanguage(directory: string, language: string): Promise<SymbolResult[]> {
    if (stryMutAct_9fa48("3560")) {
      {}
    } else {
      stryCov_9fa48("3560");
      try {
        if (stryMutAct_9fa48("3561")) {
          {}
        } else {
          stryCov_9fa48("3561");
          const symbolsPath = this.getSymbolsPath(directory, language);
          const content = await fs.readFile(symbolsPath, stryMutAct_9fa48("3562") ? "" : (stryCov_9fa48("3562"), 'utf8'));
          const lines = stryMutAct_9fa48("3564") ? content.split('\n').filter(line => line.length > 0) : stryMutAct_9fa48("3563") ? content.trim().split('\n') : (stryCov_9fa48("3563", "3564"), content.trim().split(stryMutAct_9fa48("3565") ? "" : (stryCov_9fa48("3565"), '\n')).filter(stryMutAct_9fa48("3566") ? () => undefined : (stryCov_9fa48("3566"), line => stryMutAct_9fa48("3570") ? line.length <= 0 : stryMutAct_9fa48("3569") ? line.length >= 0 : stryMutAct_9fa48("3568") ? false : stryMutAct_9fa48("3567") ? true : (stryCov_9fa48("3567", "3568", "3569", "3570"), line.length > 0))));
          const symbols: SymbolResult[] = stryMutAct_9fa48("3571") ? ["Stryker was here"] : (stryCov_9fa48("3571"), []);
          for (const line of lines) {
            if (stryMutAct_9fa48("3572")) {
              {}
            } else {
              stryCov_9fa48("3572");
              try {
                if (stryMutAct_9fa48("3573")) {
                  {}
                } else {
                  stryCov_9fa48("3573");
                  const symbol: SymbolResult = JSON.parse(line);
                  symbols.push(symbol);
                }
              } catch (parseError) {
                if (stryMutAct_9fa48("3574")) {
                  {}
                } else {
                  stryCov_9fa48("3574");
                  logger.warn(stryMutAct_9fa48("3575") ? "" : (stryCov_9fa48("3575"), 'Error parsing symbol line:'), parseError);
                }
              }
            }
          }
          logger.debug(stryMutAct_9fa48("3576") ? "" : (stryCov_9fa48("3576"), 'Loaded symbols from cache'), stryMutAct_9fa48("3577") ? {} : (stryCov_9fa48("3577"), {
            directory,
            language,
            count: symbols.length
          }));
          return symbols;
        }
      } catch (error) {
        if (stryMutAct_9fa48("3578")) {
          {}
        } else {
          stryCov_9fa48("3578");
          logger.debug(stryMutAct_9fa48("3579") ? "" : (stryCov_9fa48("3579"), 'Error loading symbol cache for language:'), stryMutAct_9fa48("3580") ? {} : (stryCov_9fa48("3580"), {
            language,
            error
          }));
          return stryMutAct_9fa48("3581") ? ["Stryker was here"] : (stryCov_9fa48("3581"), []);
        }
      }
    }
  }

  /**
   * Load cache metadata
   */
  async loadMetadata(directory: string): Promise<SymbolCacheMetadata | null> {
    if (stryMutAct_9fa48("3582")) {
      {}
    } else {
      stryCov_9fa48("3582");
      try {
        if (stryMutAct_9fa48("3583")) {
          {}
        } else {
          stryCov_9fa48("3583");
          const metadataPath = this.getMetadataPath(directory);
          const content = await fs.readFile(metadataPath, stryMutAct_9fa48("3584") ? "" : (stryCov_9fa48("3584"), 'utf8'));
          return JSON.parse(content) as SymbolCacheMetadata;
        }
      } catch {
        if (stryMutAct_9fa48("3585")) {
          {}
        } else {
          stryCov_9fa48("3585");
          return null;
        }
      }
    }
  }

  /**
   * Save symbols to cache
   * Each language is saved to its own file for efficient access
   */
  async saveSymbols(directory: string, language: string, symbols: SymbolResult[], searchMode: 'quick' | 'full'): Promise<void> {
    if (stryMutAct_9fa48("3586")) {
      {}
    } else {
      stryCov_9fa48("3586");
      try {
        if (stryMutAct_9fa48("3587")) {
          {}
        } else {
          stryCov_9fa48("3587");
          const projectCacheDir = this.getProjectCacheDir(directory);
          await ensureDir(projectCacheDir);

          // Load existing metadata or create new
          let metadata = await this.loadMetadata(directory);
          const now = new Date().toISOString();
          if (stryMutAct_9fa48("3590") ? false : stryMutAct_9fa48("3589") ? true : stryMutAct_9fa48("3588") ? metadata : (stryCov_9fa48("3588", "3589", "3590"), !metadata)) {
            if (stryMutAct_9fa48("3591")) {
              {}
            } else {
              stryCov_9fa48("3591");
              metadata = stryMutAct_9fa48("3592") ? {} : (stryCov_9fa48("3592"), {
                version: CACHE_VERSION,
                directory,
                createdAt: now,
                updatedAt: now,
                languages: {},
                totalSymbolCount: 0,
                ttlSeconds: DEFAULT_TTL_SECONDS
              });
            }
          }

          // Update language metadata
          metadata.languages[language] = stryMutAct_9fa48("3593") ? {} : (stryCov_9fa48("3593"), {
            symbolCount: symbols.length,
            searchMode
          });
          metadata.updatedAt = now;

          // Calculate total count from all languages
          let totalCount = 0;
          for (const langMeta of Object.values(metadata.languages)) {
            if (stryMutAct_9fa48("3594")) {
              {}
            } else {
              stryCov_9fa48("3594");
              stryMutAct_9fa48("3595") ? totalCount -= langMeta.symbolCount : (stryCov_9fa48("3595"), totalCount += langMeta.symbolCount);
            }
          }
          metadata.totalSymbolCount = totalCount;

          // Save metadata
          const metadataPath = this.getMetadataPath(directory);
          await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), stryMutAct_9fa48("3596") ? "" : (stryCov_9fa48("3596"), 'utf8'));

          // Save symbols to language-specific file
          const symbolsPath = this.getSymbolsPath(directory, language);
          const symbolsContent = symbols.map(stryMutAct_9fa48("3597") ? () => undefined : (stryCov_9fa48("3597"), s => JSON.stringify(s))).join(stryMutAct_9fa48("3598") ? "" : (stryCov_9fa48("3598"), '\n'));
          await fs.writeFile(symbolsPath, symbolsContent, stryMutAct_9fa48("3599") ? "" : (stryCov_9fa48("3599"), 'utf8'));
          logger.debug(stryMutAct_9fa48("3600") ? "" : (stryCov_9fa48("3600"), 'Saved symbols to cache'), stryMutAct_9fa48("3601") ? {} : (stryCov_9fa48("3601"), {
            directory,
            language,
            symbolCount: symbols.length,
            totalSymbolCount: totalCount
          }));
        }
      } catch (error) {
        if (stryMutAct_9fa48("3602")) {
          {}
        } else {
          stryCov_9fa48("3602");
          logger.error(stryMutAct_9fa48("3603") ? "" : (stryCov_9fa48("3603"), 'Error saving symbol cache:'), error);
        }
      }
    }
  }

  /**
   * Clear cache for a directory
   */
  async clearCache(directory: string): Promise<void> {
    if (stryMutAct_9fa48("3604")) {
      {}
    } else {
      stryCov_9fa48("3604");
      try {
        if (stryMutAct_9fa48("3605")) {
          {}
        } else {
          stryCov_9fa48("3605");
          const projectCacheDir = this.getProjectCacheDir(directory);
          await fs.rm(projectCacheDir, stryMutAct_9fa48("3606") ? {} : (stryCov_9fa48("3606"), {
            recursive: stryMutAct_9fa48("3607") ? false : (stryCov_9fa48("3607"), true),
            force: stryMutAct_9fa48("3608") ? false : (stryCov_9fa48("3608"), true)
          }));
          logger.debug(stryMutAct_9fa48("3609") ? "" : (stryCov_9fa48("3609"), 'Cleared symbol cache for directory'), stryMutAct_9fa48("3610") ? {} : (stryCov_9fa48("3610"), {
            directory
          }));
        }
      } catch (error) {
        if (stryMutAct_9fa48("3611")) {
          {}
        } else {
          stryCov_9fa48("3611");
          logger.warn(stryMutAct_9fa48("3612") ? "" : (stryCov_9fa48("3612"), 'Error clearing symbol cache:'), error);
        }
      }
    }
  }

  /**
   * Clear all symbol caches
   */
  async clearAllCaches(): Promise<void> {
    if (stryMutAct_9fa48("3613")) {
      {}
    } else {
      stryCov_9fa48("3613");
      try {
        if (stryMutAct_9fa48("3614")) {
          {}
        } else {
          stryCov_9fa48("3614");
          // List all project cache directories
          const entries = await fs.readdir(this.cacheDir, stryMutAct_9fa48("3615") ? {} : (stryCov_9fa48("3615"), {
            withFileTypes: stryMutAct_9fa48("3616") ? false : (stryCov_9fa48("3616"), true)
          }));
          for (const entry of entries) {
            if (stryMutAct_9fa48("3617")) {
              {}
            } else {
              stryCov_9fa48("3617");
              if (stryMutAct_9fa48("3619") ? false : stryMutAct_9fa48("3618") ? true : (stryCov_9fa48("3618", "3619"), entry.isDirectory())) {
                if (stryMutAct_9fa48("3620")) {
                  {}
                } else {
                  stryCov_9fa48("3620");
                  const projectDir = path.join(this.cacheDir, entry.name);
                  const symbolMetadataPath = path.join(projectDir, SYMBOL_METADATA_FILE);

                  // Only clear if it has symbol cache
                  try {
                    if (stryMutAct_9fa48("3621")) {
                      {}
                    } else {
                      stryCov_9fa48("3621");
                      await fs.access(symbolMetadataPath);

                      // Remove metadata file
                      await fs.rm(symbolMetadataPath);

                      // Remove all language-specific symbol files
                      const files = await fs.readdir(projectDir);
                      for (const file of files) {
                        if (stryMutAct_9fa48("3622")) {
                          {}
                        } else {
                          stryCov_9fa48("3622");
                          if (stryMutAct_9fa48("3625") ? file.startsWith(SYMBOLS_FILE_PREFIX) || file.endsWith('.jsonl') : stryMutAct_9fa48("3624") ? false : stryMutAct_9fa48("3623") ? true : (stryCov_9fa48("3623", "3624", "3625"), (stryMutAct_9fa48("3626") ? file.endsWith(SYMBOLS_FILE_PREFIX) : (stryCov_9fa48("3626"), file.startsWith(SYMBOLS_FILE_PREFIX))) && (stryMutAct_9fa48("3627") ? file.startsWith('.jsonl') : (stryCov_9fa48("3627"), file.endsWith(stryMutAct_9fa48("3628") ? "" : (stryCov_9fa48("3628"), '.jsonl')))))) {
                            if (stryMutAct_9fa48("3629")) {
                              {}
                            } else {
                              stryCov_9fa48("3629");
                              await fs.rm(path.join(projectDir, file), stryMutAct_9fa48("3630") ? {} : (stryCov_9fa48("3630"), {
                                force: stryMutAct_9fa48("3631") ? false : (stryCov_9fa48("3631"), true)
                              }));
                            }
                          }
                        }
                      }
                      logger.debug(stryMutAct_9fa48("3632") ? "" : (stryCov_9fa48("3632"), 'Cleared symbol cache for'), stryMutAct_9fa48("3633") ? {} : (stryCov_9fa48("3633"), {
                        dir: entry.name
                      }));
                    }
                  } catch {
                    // No symbol cache in this directory
                  }
                }
              }
            }
          }
        }
      } catch (error) {
        if (stryMutAct_9fa48("3634")) {
          {}
        } else {
          stryCov_9fa48("3634");
          logger.warn(stryMutAct_9fa48("3635") ? "" : (stryCov_9fa48("3635"), 'Error clearing all symbol caches:'), error);
        }
      }
    }
  }

  /**
   * Clear cache for a specific language in a directory
   */
  async clearLanguageCache(directory: string, language: string): Promise<void> {
    if (stryMutAct_9fa48("3636")) {
      {}
    } else {
      stryCov_9fa48("3636");
      try {
        if (stryMutAct_9fa48("3637")) {
          {}
        } else {
          stryCov_9fa48("3637");
          // Remove language-specific file
          const symbolsPath = this.getSymbolsPath(directory, language);
          await fs.rm(symbolsPath, stryMutAct_9fa48("3638") ? {} : (stryCov_9fa48("3638"), {
            force: stryMutAct_9fa48("3639") ? false : (stryCov_9fa48("3639"), true)
          }));

          // Update metadata
          const metadata = await this.loadMetadata(directory);
          if (stryMutAct_9fa48("3642") ? metadata || metadata.languages[language] : stryMutAct_9fa48("3641") ? false : stryMutAct_9fa48("3640") ? true : (stryCov_9fa48("3640", "3641", "3642"), metadata && metadata.languages[language])) {
            if (stryMutAct_9fa48("3643")) {
              {}
            } else {
              stryCov_9fa48("3643");
              delete metadata.languages[language];

              // Recalculate total count
              let totalCount = 0;
              for (const langMeta of Object.values(metadata.languages)) {
                if (stryMutAct_9fa48("3644")) {
                  {}
                } else {
                  stryCov_9fa48("3644");
                  stryMutAct_9fa48("3645") ? totalCount -= langMeta.symbolCount : (stryCov_9fa48("3645"), totalCount += langMeta.symbolCount);
                }
              }
              metadata.totalSymbolCount = totalCount;
              metadata.updatedAt = new Date().toISOString();

              // Save updated metadata
              const metadataPath = this.getMetadataPath(directory);
              await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), stryMutAct_9fa48("3646") ? "" : (stryCov_9fa48("3646"), 'utf8'));
            }
          }
          logger.debug(stryMutAct_9fa48("3647") ? "" : (stryCov_9fa48("3647"), 'Cleared symbol cache for language'), stryMutAct_9fa48("3648") ? {} : (stryCov_9fa48("3648"), {
            directory,
            language
          }));
        }
      } catch (error) {
        if (stryMutAct_9fa48("3649")) {
          {}
        } else {
          stryCov_9fa48("3649");
          logger.warn(stryMutAct_9fa48("3650") ? "" : (stryCov_9fa48("3650"), 'Error clearing language cache:'), error);
        }
      }
    }
  }
}

// Export singleton instance
export const symbolCacheManager = new SymbolCacheManager();