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
import os from 'os';
import * as yaml from 'js-yaml';
import { logger } from '../utils/utils';
import type { UserSettings, FileSearchSettings } from '../types';
class SettingsManager {
  private settingsFile: string;
  private currentSettings: UserSettings;
  private defaultSettings: UserSettings;
  constructor() {
    if (stryMutAct_9fa48("3246")) {
      {}
    } else {
      stryCov_9fa48("3246");
      this.settingsFile = path.join(os.homedir(), stryMutAct_9fa48("3247") ? "" : (stryCov_9fa48("3247"), '.prompt-line'), stryMutAct_9fa48("3248") ? "" : (stryCov_9fa48("3248"), 'settings.yml'));
      this.defaultSettings = stryMutAct_9fa48("3249") ? {} : (stryCov_9fa48("3249"), {
        shortcuts: stryMutAct_9fa48("3250") ? {} : (stryCov_9fa48("3250"), {
          main: stryMutAct_9fa48("3251") ? "" : (stryCov_9fa48("3251"), 'Cmd+Shift+Space'),
          paste: stryMutAct_9fa48("3252") ? "" : (stryCov_9fa48("3252"), 'Cmd+Enter'),
          close: stryMutAct_9fa48("3253") ? "" : (stryCov_9fa48("3253"), 'Escape'),
          historyNext: stryMutAct_9fa48("3254") ? "" : (stryCov_9fa48("3254"), 'Ctrl+j'),
          historyPrev: stryMutAct_9fa48("3255") ? "" : (stryCov_9fa48("3255"), 'Ctrl+k'),
          search: stryMutAct_9fa48("3256") ? "" : (stryCov_9fa48("3256"), 'Cmd+f')
        }),
        window: stryMutAct_9fa48("3257") ? {} : (stryCov_9fa48("3257"), {
          position: stryMutAct_9fa48("3258") ? "" : (stryCov_9fa48("3258"), 'active-text-field'),
          width: 600,
          height: 300
        }),
        // commands is optional - not set by default
        // fileSearch is optional - when undefined, file search feature is disabled
        // fileOpener is optional - when undefined, uses system default
        fileOpener: stryMutAct_9fa48("3259") ? {} : (stryCov_9fa48("3259"), {
          extensions: {},
          defaultEditor: null
        }),
        mdSearch: stryMutAct_9fa48("3260") ? ["Stryker was here"] : (stryCov_9fa48("3260"), [])
      });
      this.currentSettings = stryMutAct_9fa48("3261") ? {} : (stryCov_9fa48("3261"), {
        ...this.defaultSettings
      });
    }
  }
  async init(): Promise<void> {
    if (stryMutAct_9fa48("3262")) {
      {}
    } else {
      stryCov_9fa48("3262");
      try {
        if (stryMutAct_9fa48("3263")) {
          {}
        } else {
          stryCov_9fa48("3263");
          await this.loadSettings();
          logger.debug(stryMutAct_9fa48("3264") ? "" : (stryCov_9fa48("3264"), 'Settings manager initialized successfully'));
        }
      } catch (error) {
        if (stryMutAct_9fa48("3265")) {
          {}
        } else {
          stryCov_9fa48("3265");
          logger.error(stryMutAct_9fa48("3266") ? "" : (stryCov_9fa48("3266"), 'Failed to initialize settings manager:'), error);
          throw error;
        }
      }
    }
  }
  private async loadSettings(): Promise<void> {
    if (stryMutAct_9fa48("3267")) {
      {}
    } else {
      stryCov_9fa48("3267");
      try {
        if (stryMutAct_9fa48("3268")) {
          {}
        } else {
          stryCov_9fa48("3268");
          // Set restrictive directory permissions (owner read/write/execute only)
          await fs.mkdir(path.dirname(this.settingsFile), stryMutAct_9fa48("3269") ? {} : (stryCov_9fa48("3269"), {
            recursive: stryMutAct_9fa48("3270") ? false : (stryCov_9fa48("3270"), true),
            mode: 0o700
          }));
          try {
            if (stryMutAct_9fa48("3271")) {
              {}
            } else {
              stryCov_9fa48("3271");
              const data = await fs.readFile(this.settingsFile, stryMutAct_9fa48("3272") ? "" : (stryCov_9fa48("3272"), 'utf8'));
              // Use JSON_SCHEMA to prevent arbitrary code execution from malicious YAML
              // JSON_SCHEMA only allows JSON-compatible types (strings, numbers, booleans, null, arrays, objects)
              // which prevents JavaScript-specific type coercion attacks
              const parsed = yaml.load(data, {
                schema: yaml.JSON_SCHEMA
              }) as UserSettings;
              if (stryMutAct_9fa48("3275") ? parsed || typeof parsed === 'object' : stryMutAct_9fa48("3274") ? false : stryMutAct_9fa48("3273") ? true : (stryCov_9fa48("3273", "3274", "3275"), parsed && (stryMutAct_9fa48("3277") ? typeof parsed !== 'object' : stryMutAct_9fa48("3276") ? true : (stryCov_9fa48("3276", "3277"), typeof parsed === (stryMutAct_9fa48("3278") ? "" : (stryCov_9fa48("3278"), 'object')))))) {
                if (stryMutAct_9fa48("3279")) {
                  {}
                } else {
                  stryCov_9fa48("3279");
                  this.currentSettings = this.mergeWithDefaults(parsed);
                  logger.debug(stryMutAct_9fa48("3280") ? "" : (stryCov_9fa48("3280"), 'Settings loaded from YAML file'), stryMutAct_9fa48("3281") ? {} : (stryCov_9fa48("3281"), {
                    file: this.settingsFile
                  }));
                }
              } else {
                if (stryMutAct_9fa48("3282")) {
                  {}
                } else {
                  stryCov_9fa48("3282");
                  logger.warn(stryMutAct_9fa48("3283") ? "" : (stryCov_9fa48("3283"), 'Invalid settings file format, using defaults'));
                  await this.saveSettings();
                }
              }
            }
          } catch (error) {
            if (stryMutAct_9fa48("3284")) {
              {}
            } else {
              stryCov_9fa48("3284");
              if (stryMutAct_9fa48("3287") ? (error as NodeJS.ErrnoException).code !== 'ENOENT' : stryMutAct_9fa48("3286") ? false : stryMutAct_9fa48("3285") ? true : (stryCov_9fa48("3285", "3286", "3287"), (error as NodeJS.ErrnoException).code === (stryMutAct_9fa48("3288") ? "" : (stryCov_9fa48("3288"), 'ENOENT')))) {
                if (stryMutAct_9fa48("3289")) {
                  {}
                } else {
                  stryCov_9fa48("3289");
                  logger.info(stryMutAct_9fa48("3290") ? "" : (stryCov_9fa48("3290"), 'Settings file not found, creating with defaults'));
                  await this.saveSettings();
                }
              } else {
                if (stryMutAct_9fa48("3291")) {
                  {}
                } else {
                  stryCov_9fa48("3291");
                  logger.error(stryMutAct_9fa48("3292") ? "" : (stryCov_9fa48("3292"), 'Failed to read settings file:'), error);
                  throw error;
                }
              }
            }
          }
        }
      } catch (error) {
        if (stryMutAct_9fa48("3293")) {
          {}
        } else {
          stryCov_9fa48("3293");
          logger.error(stryMutAct_9fa48("3294") ? "" : (stryCov_9fa48("3294"), 'Failed to load settings:'), error);
          throw error;
        }
      }
    }
  }
  private mergeWithDefaults(userSettings: Partial<UserSettings>): UserSettings {
    if (stryMutAct_9fa48("3295")) {
      {}
    } else {
      stryCov_9fa48("3295");
      const result: UserSettings = stryMutAct_9fa48("3296") ? {} : (stryCov_9fa48("3296"), {
        shortcuts: stryMutAct_9fa48("3297") ? {} : (stryCov_9fa48("3297"), {
          ...this.defaultSettings.shortcuts,
          ...userSettings.shortcuts
        }),
        window: stryMutAct_9fa48("3298") ? {} : (stryCov_9fa48("3298"), {
          ...this.defaultSettings.window,
          ...userSettings.window
        }),
        fileOpener: stryMutAct_9fa48("3299") ? {} : (stryCov_9fa48("3299"), {
          ...this.defaultSettings.fileOpener,
          ...userSettings.fileOpener,
          // Deep merge for extensions object
          extensions: stryMutAct_9fa48("3300") ? {} : (stryCov_9fa48("3300"), {
            ...(stryMutAct_9fa48("3301") ? this.defaultSettings.fileOpener.extensions : (stryCov_9fa48("3301"), this.defaultSettings.fileOpener?.extensions)),
            ...(stryMutAct_9fa48("3302") ? userSettings.fileOpener.extensions : (stryCov_9fa48("3302"), userSettings.fileOpener?.extensions))
          })
        }),
        // Use user's mdSearch if provided, otherwise use default (empty array)
        mdSearch: stryMutAct_9fa48("3303") ? (userSettings.mdSearch ?? this.defaultSettings.mdSearch) && [] : (stryCov_9fa48("3303"), (stryMutAct_9fa48("3304") ? userSettings.mdSearch && this.defaultSettings.mdSearch : (stryCov_9fa48("3304"), userSettings.mdSearch ?? this.defaultSettings.mdSearch)) ?? (stryMutAct_9fa48("3305") ? ["Stryker was here"] : (stryCov_9fa48("3305"), [])))
      });

      // Only set fileSearch if it exists in user settings (feature is disabled when undefined)
      if (stryMutAct_9fa48("3307") ? false : stryMutAct_9fa48("3306") ? true : (stryCov_9fa48("3306", "3307"), userSettings.fileSearch)) {
        if (stryMutAct_9fa48("3308")) {
          {}
        } else {
          stryCov_9fa48("3308");
          result.fileSearch = userSettings.fileSearch;
        }
      }

      // Set symbolSearch if it exists in user settings
      if (stryMutAct_9fa48("3310") ? false : stryMutAct_9fa48("3309") ? true : (stryCov_9fa48("3309", "3310"), userSettings.symbolSearch)) {
        if (stryMutAct_9fa48("3311")) {
          {}
        } else {
          stryCov_9fa48("3311");
          result.symbolSearch = userSettings.symbolSearch;
        }
      }
      return result;
    }
  }
  async saveSettings(): Promise<void> {
    if (stryMutAct_9fa48("3312")) {
      {}
    } else {
      stryCov_9fa48("3312");
      try {
        if (stryMutAct_9fa48("3313")) {
          {}
        } else {
          stryCov_9fa48("3313");
          const settingsWithComments = this.addCommentsToSettings(this.currentSettings);

          // Set restrictive file permissions (owner read/write only)
          await fs.writeFile(this.settingsFile, settingsWithComments, stryMutAct_9fa48("3314") ? {} : (stryCov_9fa48("3314"), {
            encoding: stryMutAct_9fa48("3315") ? "" : (stryCov_9fa48("3315"), 'utf8'),
            mode: 0o600
          }));
          logger.debug(stryMutAct_9fa48("3316") ? "" : (stryCov_9fa48("3316"), 'Settings saved to YAML file'), stryMutAct_9fa48("3317") ? {} : (stryCov_9fa48("3317"), {
            file: this.settingsFile
          }));
        }
      } catch (error) {
        if (stryMutAct_9fa48("3318")) {
          {}
        } else {
          stryCov_9fa48("3318");
          logger.error(stryMutAct_9fa48("3319") ? "" : (stryCov_9fa48("3319"), 'Failed to save settings:'), error);
          throw error;
        }
      }
    }
  }
  private addCommentsToSettings(settings: UserSettings): string {
    if (stryMutAct_9fa48("3320")) {
      {}
    } else {
      stryCov_9fa48("3320");
      // Helper to format arrays for YAML output (list format)
      const formatArrayAsList = (arr: unknown[] | undefined, indent: string = stryMutAct_9fa48("3321") ? "" : (stryCov_9fa48("3321"), '    ')): string => {
        if (stryMutAct_9fa48("3322")) {
          {}
        } else {
          stryCov_9fa48("3322");
          if (stryMutAct_9fa48("3325") ? !arr && arr.length === 0 : stryMutAct_9fa48("3324") ? false : stryMutAct_9fa48("3323") ? true : (stryCov_9fa48("3323", "3324", "3325"), (stryMutAct_9fa48("3326") ? arr : (stryCov_9fa48("3326"), !arr)) || (stryMutAct_9fa48("3328") ? arr.length !== 0 : stryMutAct_9fa48("3327") ? false : (stryCov_9fa48("3327", "3328"), arr.length === 0)))) return stryMutAct_9fa48("3329") ? "Stryker was here!" : (stryCov_9fa48("3329"), '');
          return arr.map(stryMutAct_9fa48("3330") ? () => undefined : (stryCov_9fa48("3330"), item => stryMutAct_9fa48("3331") ? `` : (stryCov_9fa48("3331"), `\n${indent}- "${item}"`))).join(stryMutAct_9fa48("3332") ? "Stryker was here!" : (stryCov_9fa48("3332"), ''));
        }
      };

      // Helper to format extensions object for YAML output (list format)
      const formatExtensionsAsList = (ext: Record<string, string> | undefined): string => {
        if (stryMutAct_9fa48("3333")) {
          {}
        } else {
          stryCov_9fa48("3333");
          if (stryMutAct_9fa48("3336") ? !ext && Object.keys(ext).length === 0 : stryMutAct_9fa48("3335") ? false : stryMutAct_9fa48("3334") ? true : (stryCov_9fa48("3334", "3335", "3336"), (stryMutAct_9fa48("3337") ? ext : (stryCov_9fa48("3337"), !ext)) || (stryMutAct_9fa48("3339") ? Object.keys(ext).length !== 0 : stryMutAct_9fa48("3338") ? false : (stryCov_9fa48("3338", "3339"), Object.keys(ext).length === 0)))) return stryMutAct_9fa48("3340") ? "Stryker was here!" : (stryCov_9fa48("3340"), '');
          return Object.entries(ext).map(stryMutAct_9fa48("3341") ? () => undefined : (stryCov_9fa48("3341"), ([key, val]) => stryMutAct_9fa48("3342") ? `` : (stryCov_9fa48("3342"), `\n    ${key}: "${val}"`))).join(stryMutAct_9fa48("3343") ? "Stryker was here!" : (stryCov_9fa48("3343"), ''));
        }
      };

      // Helper to format mdSearch array
      const formatMdSearch = (mdSearch: UserSettings['mdSearch']): string => {
        if (stryMutAct_9fa48("3344")) {
          {}
        } else {
          stryCov_9fa48("3344");
          if (stryMutAct_9fa48("3347") ? !mdSearch && mdSearch.length === 0 : stryMutAct_9fa48("3346") ? false : stryMutAct_9fa48("3345") ? true : (stryCov_9fa48("3345", "3346", "3347"), (stryMutAct_9fa48("3348") ? mdSearch : (stryCov_9fa48("3348"), !mdSearch)) || (stryMutAct_9fa48("3350") ? mdSearch.length !== 0 : stryMutAct_9fa48("3349") ? false : (stryCov_9fa48("3349", "3350"), mdSearch.length === 0)))) return stryMutAct_9fa48("3351") ? "Stryker was here!" : (stryCov_9fa48("3351"), '');
          return (stryMutAct_9fa48("3352") ? "" : (stryCov_9fa48("3352"), '\n')) + mdSearch.map(stryMutAct_9fa48("3353") ? () => undefined : (stryCov_9fa48("3353"), entry => stryMutAct_9fa48("3354") ? `` : (stryCov_9fa48("3354"), `  - name: "${entry.name}"
    type: ${entry.type}
    description: "${stryMutAct_9fa48("3357") ? entry.description && '' : stryMutAct_9fa48("3356") ? false : stryMutAct_9fa48("3355") ? true : (stryCov_9fa48("3355", "3356", "3357"), entry.description || (stryMutAct_9fa48("3358") ? "Stryker was here!" : (stryCov_9fa48("3358"), '')))}"
    path: ${entry.path}
    pattern: "${entry.pattern}"${entry.argumentHint ? stryMutAct_9fa48("3359") ? `` : (stryCov_9fa48("3359"), `\n    argumentHint: "${entry.argumentHint}"`) : stryMutAct_9fa48("3360") ? "Stryker was here!" : (stryCov_9fa48("3360"), '')}
    maxSuggestions: ${stryMutAct_9fa48("3361") ? entry.maxSuggestions && 20 : (stryCov_9fa48("3361"), entry.maxSuggestions ?? 20)}${entry.searchPrefix ? stryMutAct_9fa48("3362") ? `` : (stryCov_9fa48("3362"), `\n    searchPrefix: "${entry.searchPrefix}"`) : stryMutAct_9fa48("3363") ? "Stryker was here!" : (stryCov_9fa48("3363"), '')}${entry.inputFormat ? stryMutAct_9fa48("3364") ? `` : (stryCov_9fa48("3364"), `\n    inputFormat: ${entry.inputFormat}`) : stryMutAct_9fa48("3365") ? "Stryker was here!" : (stryCov_9fa48("3365"), '')}`))).join(stryMutAct_9fa48("3366") ? "" : (stryCov_9fa48("3366"), '\n'));
        }
      };

      // Build fileSearch section - if fileSearch is defined, output values; otherwise comment out entire section
      const buildFileSearchSection = (): string => {
        if (stryMutAct_9fa48("3367")) {
          {}
        } else {
          stryCov_9fa48("3367");
          if (stryMutAct_9fa48("3370") ? false : stryMutAct_9fa48("3369") ? true : stryMutAct_9fa48("3368") ? settings.fileSearch : (stryCov_9fa48("3368", "3369", "3370"), !settings.fileSearch)) {
            if (stryMutAct_9fa48("3371")) {
              {}
            } else {
              stryCov_9fa48("3371");
              // Feature is disabled - output commented template
              return stryMutAct_9fa48("3372") ? `` : (stryCov_9fa48("3372"), `#fileSearch:                        # File search for @ mentions (uncomment to enable)
#  respectGitignore: true             # Respect .gitignore files
#  includeHidden: true                # Include hidden files (starting with .)
#  maxFiles: 5000                     # Maximum files to return
#  maxDepth: null                     # Directory depth limit (null = unlimited)
#  maxSuggestions: 50                 # Maximum suggestions to show (default: 50)
#  followSymlinks: false              # Follow symbolic links
#  fdPath: null                       # Custom path to fd command (null = auto-detect)
#  #excludePatterns:                  # Additional exclude patterns
#  #  - "*.log"
#  #  - "*.tmp"
#  #includePatterns:                  # Force include patterns (override .gitignore)
#  #  - "dist/**/*.js"`);
            }
          }

          // Feature is enabled - output actual values
          const excludePatternsSection = (stryMutAct_9fa48("3375") ? settings.fileSearch.excludePatterns || settings.fileSearch.excludePatterns.length > 0 : stryMutAct_9fa48("3374") ? false : stryMutAct_9fa48("3373") ? true : (stryCov_9fa48("3373", "3374", "3375"), settings.fileSearch.excludePatterns && (stryMutAct_9fa48("3378") ? settings.fileSearch.excludePatterns.length <= 0 : stryMutAct_9fa48("3377") ? settings.fileSearch.excludePatterns.length >= 0 : stryMutAct_9fa48("3376") ? true : (stryCov_9fa48("3376", "3377", "3378"), settings.fileSearch.excludePatterns.length > 0)))) ? stryMutAct_9fa48("3379") ? `` : (stryCov_9fa48("3379"), `excludePatterns:${formatArrayAsList(settings.fileSearch.excludePatterns)}  # Additional exclude patterns`) : stryMutAct_9fa48("3380") ? `` : (stryCov_9fa48("3380"), `#excludePatterns:                  # Additional exclude patterns (uncomment to enable)
  #  - "*.log"
  #  - "*.tmp"`);
          const includePatternsSection = (stryMutAct_9fa48("3383") ? settings.fileSearch.includePatterns || settings.fileSearch.includePatterns.length > 0 : stryMutAct_9fa48("3382") ? false : stryMutAct_9fa48("3381") ? true : (stryCov_9fa48("3381", "3382", "3383"), settings.fileSearch.includePatterns && (stryMutAct_9fa48("3386") ? settings.fileSearch.includePatterns.length <= 0 : stryMutAct_9fa48("3385") ? settings.fileSearch.includePatterns.length >= 0 : stryMutAct_9fa48("3384") ? true : (stryCov_9fa48("3384", "3385", "3386"), settings.fileSearch.includePatterns.length > 0)))) ? stryMutAct_9fa48("3387") ? `` : (stryCov_9fa48("3387"), `includePatterns:${formatArrayAsList(settings.fileSearch.includePatterns)}  # Force include patterns (override .gitignore)`) : stryMutAct_9fa48("3388") ? `` : (stryCov_9fa48("3388"), `#includePatterns:                  # Force include patterns (uncomment to enable)
  #  - "dist/**/*.js"`);
          const fdPathSection = settings.fileSearch.fdPath ? stryMutAct_9fa48("3389") ? `` : (stryCov_9fa48("3389"), `fdPath: "${settings.fileSearch.fdPath}"                       # Custom path to fd command`) : stryMutAct_9fa48("3390") ? `` : (stryCov_9fa48("3390"), `#fdPath: null                       # Custom path to fd command (null = auto-detect)`);
          return stryMutAct_9fa48("3391") ? `` : (stryCov_9fa48("3391"), `fileSearch:
  respectGitignore: ${stryMutAct_9fa48("3392") ? settings.fileSearch.respectGitignore && true : (stryCov_9fa48("3392"), settings.fileSearch.respectGitignore ?? (stryMutAct_9fa48("3393") ? false : (stryCov_9fa48("3393"), true)))}    # Respect .gitignore files
  includeHidden: ${stryMutAct_9fa48("3394") ? settings.fileSearch.includeHidden && true : (stryCov_9fa48("3394"), settings.fileSearch.includeHidden ?? (stryMutAct_9fa48("3395") ? false : (stryCov_9fa48("3395"), true)))}          # Include hidden files (starting with .)
  maxFiles: ${stryMutAct_9fa48("3396") ? settings.fileSearch.maxFiles && 5000 : (stryCov_9fa48("3396"), settings.fileSearch.maxFiles ?? 5000)}                    # Maximum files to return
  maxDepth: ${stryMutAct_9fa48("3397") ? settings.fileSearch.maxDepth && 'null' : (stryCov_9fa48("3397"), settings.fileSearch.maxDepth ?? (stryMutAct_9fa48("3398") ? "" : (stryCov_9fa48("3398"), 'null')))}                  # Directory depth limit (null = unlimited)
  maxSuggestions: ${stryMutAct_9fa48("3399") ? settings.fileSearch.maxSuggestions && 50 : (stryCov_9fa48("3399"), settings.fileSearch.maxSuggestions ?? 50)}          # Maximum suggestions to show (default: 50)
  followSymlinks: ${stryMutAct_9fa48("3400") ? settings.fileSearch.followSymlinks && false : (stryCov_9fa48("3400"), settings.fileSearch.followSymlinks ?? (stryMutAct_9fa48("3401") ? true : (stryCov_9fa48("3401"), false)))}       # Follow symbolic links
  ${fdPathSection}
  ${excludePatternsSection}
  ${includePatternsSection}`);
        }
      };
      const fileSearchSection = buildFileSearchSection();

      // Build symbolSearch section
      const buildSymbolSearchSection = (): string => {
        if (stryMutAct_9fa48("3402")) {
          {}
        } else {
          stryCov_9fa48("3402");
          if (stryMutAct_9fa48("3405") ? false : stryMutAct_9fa48("3404") ? true : stryMutAct_9fa48("3403") ? settings.symbolSearch : (stryCov_9fa48("3403", "3404", "3405"), !settings.symbolSearch)) {
            if (stryMutAct_9fa48("3406")) {
              {}
            } else {
              stryCov_9fa48("3406");
              // Feature uses defaults - output commented template with default values
              return stryMutAct_9fa48("3407") ? `` : (stryCov_9fa48("3407"), `symbolSearch:
  maxSymbols: 20000                   # Maximum symbols to return (default: 20000)
  timeout: 5000                       # Search timeout in milliseconds (default: 5000)
  #rgPaths:                           # Custom paths to rg command (uncomment to override auto-detection)
  #  - /opt/homebrew/bin/rg
  #  - /usr/local/bin/rg`);
            }
          }

          // Feature has custom settings - output actual values
          const rgPathsSection = (stryMutAct_9fa48("3410") ? settings.symbolSearch.rgPaths || settings.symbolSearch.rgPaths.length > 0 : stryMutAct_9fa48("3409") ? false : stryMutAct_9fa48("3408") ? true : (stryCov_9fa48("3408", "3409", "3410"), settings.symbolSearch.rgPaths && (stryMutAct_9fa48("3413") ? settings.symbolSearch.rgPaths.length <= 0 : stryMutAct_9fa48("3412") ? settings.symbolSearch.rgPaths.length >= 0 : stryMutAct_9fa48("3411") ? true : (stryCov_9fa48("3411", "3412", "3413"), settings.symbolSearch.rgPaths.length > 0)))) ? stryMutAct_9fa48("3414") ? `` : (stryCov_9fa48("3414"), `rgPaths:${settings.symbolSearch.rgPaths.map(stryMutAct_9fa48("3415") ? () => undefined : (stryCov_9fa48("3415"), p => stryMutAct_9fa48("3416") ? `` : (stryCov_9fa48("3416"), `\n    - ${p}`))).join(stryMutAct_9fa48("3417") ? "Stryker was here!" : (stryCov_9fa48("3417"), ''))}`) : stryMutAct_9fa48("3418") ? `` : (stryCov_9fa48("3418"), `#rgPaths:                           # Custom paths to rg command (uncomment to override auto-detection)
  #  - /opt/homebrew/bin/rg
  #  - /usr/local/bin/rg`);
          return stryMutAct_9fa48("3419") ? `` : (stryCov_9fa48("3419"), `symbolSearch:
  maxSymbols: ${stryMutAct_9fa48("3420") ? settings.symbolSearch.maxSymbols && 20000 : (stryCov_9fa48("3420"), settings.symbolSearch.maxSymbols ?? 20000)}                   # Maximum symbols to return (default: 20000)
  timeout: ${stryMutAct_9fa48("3421") ? settings.symbolSearch.timeout && 5000 : (stryCov_9fa48("3421"), settings.symbolSearch.timeout ?? 5000)}                       # Search timeout in milliseconds (default: 5000)
  ${rgPathsSection}`);
        }
      };
      const symbolSearchSection = buildSymbolSearchSection();

      // Build extensions section
      const extensionsSection = (stryMutAct_9fa48("3424") ? settings.fileOpener?.extensions || Object.keys(settings.fileOpener.extensions).length > 0 : stryMutAct_9fa48("3423") ? false : stryMutAct_9fa48("3422") ? true : (stryCov_9fa48("3422", "3423", "3424"), (stryMutAct_9fa48("3425") ? settings.fileOpener.extensions : (stryCov_9fa48("3425"), settings.fileOpener?.extensions)) && (stryMutAct_9fa48("3428") ? Object.keys(settings.fileOpener.extensions).length <= 0 : stryMutAct_9fa48("3427") ? Object.keys(settings.fileOpener.extensions).length >= 0 : stryMutAct_9fa48("3426") ? true : (stryCov_9fa48("3426", "3427", "3428"), Object.keys(settings.fileOpener.extensions).length > 0)))) ? stryMutAct_9fa48("3429") ? `` : (stryCov_9fa48("3429"), `extensions:${formatExtensionsAsList(settings.fileOpener.extensions)}`) : stryMutAct_9fa48("3430") ? `` : (stryCov_9fa48("3430"), `#extensions:                       # Extension-specific apps (uncomment to enable)
  #  ts: "WebStorm"
  #  md: "Typora"
  #  pdf: "Preview"`);

      // Build mdSearch section
      const mdSearchSection = (stryMutAct_9fa48("3433") ? settings.mdSearch || settings.mdSearch.length > 0 : stryMutAct_9fa48("3432") ? false : stryMutAct_9fa48("3431") ? true : (stryCov_9fa48("3431", "3432", "3433"), settings.mdSearch && (stryMutAct_9fa48("3436") ? settings.mdSearch.length <= 0 : stryMutAct_9fa48("3435") ? settings.mdSearch.length >= 0 : stryMutAct_9fa48("3434") ? true : (stryCov_9fa48("3434", "3435", "3436"), settings.mdSearch.length > 0)))) ? stryMutAct_9fa48("3437") ? `` : (stryCov_9fa48("3437"), `mdSearch:${formatMdSearch(settings.mdSearch)}`) : stryMutAct_9fa48("3438") ? `` : (stryCov_9fa48("3438"), `#mdSearch:                         # Slash commands & mentions (uncomment to enable)
#  # Pattern examples:
#  #   "*.md"                  - Root directory only
#  #   "**/*.md"               - All subdirectories (recursive)
#  #   "**/commands/*.md"      - Any "commands" subdirectory
#  #   "**/*/SKILL.md"         - SKILL.md in any subdirectory
#  #   "**/{cmd,agent}/*.md"   - Brace expansion (cmd or agent dirs)
#  #   "test-*.md"             - Wildcard prefix
#
#  - name: "{basename}"
#    type: command                     # 'command' for / or 'mention' for @
#    description: "{frontmatter@description}"
#    path: ~/.claude/commands
#    pattern: "*.md"
#    argumentHint: "{frontmatter@argument-hint}"  # Optional hint after selection
#    maxSuggestions: 20                # Max number of suggestions (default: 20)
#    inputFormat: name                 # 'name' for name only, 'path' for file path (default: name)
#
#  - name: "agent-{basename}"
#    type: mention
#    description: "{frontmatter@description}"
#    path: ~/.claude/agents
#    pattern: "*.md"
#    maxSuggestions: 20
#    searchPrefix: "agent:"            # Require @agent: prefix for this entry (optional)
#    inputFormat: path                 # 'name' for name only, 'path' for file path
#
#  - name: "{frontmatter@name}"
#    type: mention
#    description: "{frontmatter@description}"
#    path: ~/.claude/plugins
#    pattern: "**/*/SKILL.md"          # Match SKILL.md in any plugin subdirectory
#    maxSuggestions: 20
#    searchPrefix: "skill:"            # Require @skill: prefix for this entry`);
      return stryMutAct_9fa48("3439") ? `` : (stryCov_9fa48("3439"), `# Prompt Line Settings Configuration
# This file is automatically generated but can be manually edited

# ============================================================================
# KEYBOARD SHORTCUTS
# ============================================================================
# Format: Modifier+Key (e.g., Cmd+Shift+Space, Ctrl+Alt+Space)
# Available modifiers: Cmd, Ctrl, Alt, Shift

shortcuts:
  main: ${settings.shortcuts.main}           # Show/hide the input window (global)
  paste: ${settings.shortcuts.paste}         # Paste text and close window
  close: ${settings.shortcuts.close}              # Close window without pasting
  historyNext: ${settings.shortcuts.historyNext}          # Navigate to next history item
  historyPrev: ${settings.shortcuts.historyPrev}          # Navigate to previous history item
  search: ${settings.shortcuts.search}            # Enable search mode in history

# ============================================================================
# WINDOW SETTINGS
# ============================================================================
# Position options:
#   - active-text-field: Near focused text field (default, falls back to active-window-center)
#   - active-window-center: Center within active window
#   - cursor: At mouse cursor location
#   - center: Center on primary display

window:
  position: ${settings.window.position}
  width: ${settings.window.width}                      # Recommended: 400-800 pixels
  height: ${settings.window.height}                     # Recommended: 200-400 pixels

# ============================================================================
# FILE OPENER SETTINGS
# ============================================================================
# Configure which applications to use when opening file links
# When defaultEditor is null, system default application is used

fileOpener:
  # Default editor for all files (null = use system default application)
  # Example values: "Visual Studio Code", "Sublime Text", "WebStorm"
  defaultEditor: ${(stryMutAct_9fa48("3442") ? settings.fileOpener?.defaultEditor === null && settings.fileOpener?.defaultEditor === undefined : stryMutAct_9fa48("3441") ? false : stryMutAct_9fa48("3440") ? true : (stryCov_9fa48("3440", "3441", "3442"), (stryMutAct_9fa48("3444") ? settings.fileOpener?.defaultEditor !== null : stryMutAct_9fa48("3443") ? false : (stryCov_9fa48("3443", "3444"), (stryMutAct_9fa48("3445") ? settings.fileOpener.defaultEditor : (stryCov_9fa48("3445"), settings.fileOpener?.defaultEditor)) === null)) || (stryMutAct_9fa48("3447") ? settings.fileOpener?.defaultEditor !== undefined : stryMutAct_9fa48("3446") ? false : (stryCov_9fa48("3446", "3447"), (stryMutAct_9fa48("3448") ? settings.fileOpener.defaultEditor : (stryCov_9fa48("3448"), settings.fileOpener?.defaultEditor)) === undefined)))) ? stryMutAct_9fa48("3449") ? "" : (stryCov_9fa48("3449"), 'null') : stryMutAct_9fa48("3450") ? `` : (stryCov_9fa48("3450"), `"${settings.fileOpener.defaultEditor}"`)}
  # Extension-specific applications (overrides defaultEditor)
  ${extensionsSection}

# ============================================================================
# FILE SEARCH SETTINGS (@ mentions)
# ============================================================================
# Note: fd command is required for file search (install: brew install fd)
# When this section is commented out, file search feature is disabled

${fileSearchSection}

# ============================================================================
# SYMBOL SEARCH SETTINGS (Code Search)
# ============================================================================
# Configure symbol search behavior for @<language>:<query> syntax
# Note: ripgrep (rg) command is required (install: brew install ripgrep)
# Note: File search must be enabled for symbol search to work

${symbolSearchSection}

# ============================================================================
# MARKDOWN SEARCH SETTINGS (Slash Commands & Mentions)
# ============================================================================
# Configure sources for slash commands (/) and mentions (@)
# Template variables: {basename}, {frontmatter@fieldName}

${mdSearchSection}
`);
    }
  }
  getSettings(): UserSettings {
    if (stryMutAct_9fa48("3451")) {
      {}
    } else {
      stryCov_9fa48("3451");
      return stryMutAct_9fa48("3452") ? {} : (stryCov_9fa48("3452"), {
        ...this.currentSettings
      });
    }
  }
  async updateSettings(newSettings: Partial<UserSettings>): Promise<void> {
    if (stryMutAct_9fa48("3453")) {
      {}
    } else {
      stryCov_9fa48("3453");
      try {
        if (stryMutAct_9fa48("3454")) {
          {}
        } else {
          stryCov_9fa48("3454");
          this.currentSettings = this.mergeWithDefaults(stryMutAct_9fa48("3455") ? {} : (stryCov_9fa48("3455"), {
            ...this.currentSettings,
            ...newSettings
          }));
          await this.saveSettings();
          logger.info(stryMutAct_9fa48("3456") ? "" : (stryCov_9fa48("3456"), 'Settings updated successfully'));
        }
      } catch (error) {
        if (stryMutAct_9fa48("3457")) {
          {}
        } else {
          stryCov_9fa48("3457");
          logger.error(stryMutAct_9fa48("3458") ? "" : (stryCov_9fa48("3458"), 'Failed to update settings:'), error);
          throw error;
        }
      }
    }
  }
  async resetSettings(): Promise<void> {
    if (stryMutAct_9fa48("3459")) {
      {}
    } else {
      stryCov_9fa48("3459");
      try {
        if (stryMutAct_9fa48("3460")) {
          {}
        } else {
          stryCov_9fa48("3460");
          this.currentSettings = stryMutAct_9fa48("3461") ? {} : (stryCov_9fa48("3461"), {
            ...this.defaultSettings
          });
          await this.saveSettings();
          logger.info(stryMutAct_9fa48("3462") ? "" : (stryCov_9fa48("3462"), 'Settings reset to defaults'));
        }
      } catch (error) {
        if (stryMutAct_9fa48("3463")) {
          {}
        } else {
          stryCov_9fa48("3463");
          logger.error(stryMutAct_9fa48("3464") ? "" : (stryCov_9fa48("3464"), 'Failed to reset settings:'), error);
          throw error;
        }
      }
    }
  }
  getShortcuts(): UserSettings['shortcuts'] {
    if (stryMutAct_9fa48("3465")) {
      {}
    } else {
      stryCov_9fa48("3465");
      return stryMutAct_9fa48("3466") ? {} : (stryCov_9fa48("3466"), {
        ...this.currentSettings.shortcuts
      });
    }
  }
  async updateShortcuts(shortcuts: Partial<UserSettings['shortcuts']>): Promise<void> {
    if (stryMutAct_9fa48("3467")) {
      {}
    } else {
      stryCov_9fa48("3467");
      await this.updateSettings(stryMutAct_9fa48("3468") ? {} : (stryCov_9fa48("3468"), {
        shortcuts: stryMutAct_9fa48("3469") ? {} : (stryCov_9fa48("3469"), {
          ...this.currentSettings.shortcuts,
          ...shortcuts
        })
      }));
    }
  }
  getWindowSettings(): UserSettings['window'] {
    if (stryMutAct_9fa48("3470")) {
      {}
    } else {
      stryCov_9fa48("3470");
      return stryMutAct_9fa48("3471") ? {} : (stryCov_9fa48("3471"), {
        ...this.currentSettings.window
      });
    }
  }
  async updateWindowSettings(window: Partial<UserSettings['window']>): Promise<void> {
    if (stryMutAct_9fa48("3472")) {
      {}
    } else {
      stryCov_9fa48("3472");
      await this.updateSettings(stryMutAct_9fa48("3473") ? {} : (stryCov_9fa48("3473"), {
        window: stryMutAct_9fa48("3474") ? {} : (stryCov_9fa48("3474"), {
          ...this.currentSettings.window,
          ...window
        })
      }));
    }
  }
  getDefaultSettings(): UserSettings {
    if (stryMutAct_9fa48("3475")) {
      {}
    } else {
      stryCov_9fa48("3475");
      return stryMutAct_9fa48("3476") ? {} : (stryCov_9fa48("3476"), {
        shortcuts: stryMutAct_9fa48("3477") ? {} : (stryCov_9fa48("3477"), {
          ...this.defaultSettings.shortcuts
        }),
        window: stryMutAct_9fa48("3478") ? {} : (stryCov_9fa48("3478"), {
          ...this.defaultSettings.window
        }),
        fileSearch: stryMutAct_9fa48("3479") ? {} : (stryCov_9fa48("3479"), {
          ...this.defaultSettings.fileSearch
        }),
        fileOpener: stryMutAct_9fa48("3480") ? {} : (stryCov_9fa48("3480"), {
          extensions: stryMutAct_9fa48("3481") ? {} : (stryCov_9fa48("3481"), {
            ...(stryMutAct_9fa48("3482") ? this.defaultSettings.fileOpener.extensions : (stryCov_9fa48("3482"), this.defaultSettings.fileOpener?.extensions))
          }),
          defaultEditor: stryMutAct_9fa48("3483") ? this.defaultSettings.fileOpener?.defaultEditor && null : (stryCov_9fa48("3483"), (stryMutAct_9fa48("3484") ? this.defaultSettings.fileOpener.defaultEditor : (stryCov_9fa48("3484"), this.defaultSettings.fileOpener?.defaultEditor)) ?? null)
        })
      });
    }
  }
  getFileSearchSettings(): FileSearchSettings | undefined {
    if (stryMutAct_9fa48("3485")) {
      {}
    } else {
      stryCov_9fa48("3485");
      // Return undefined if fileSearch is not configured (feature disabled)
      if (stryMutAct_9fa48("3488") ? false : stryMutAct_9fa48("3487") ? true : stryMutAct_9fa48("3486") ? this.currentSettings.fileSearch : (stryCov_9fa48("3486", "3487", "3488"), !this.currentSettings.fileSearch)) {
        if (stryMutAct_9fa48("3489")) {
          {}
        } else {
          stryCov_9fa48("3489");
          return undefined;
        }
      }
      return this.currentSettings.fileSearch as FileSearchSettings;
    }
  }
  isFileSearchEnabled(): boolean {
    if (stryMutAct_9fa48("3490")) {
      {}
    } else {
      stryCov_9fa48("3490");
      return stryMutAct_9fa48("3493") ? this.currentSettings.fileSearch === undefined : stryMutAct_9fa48("3492") ? false : stryMutAct_9fa48("3491") ? true : (stryCov_9fa48("3491", "3492", "3493"), this.currentSettings.fileSearch !== undefined);
    }
  }
  getSymbolSearchSettings(): UserSettings['symbolSearch'] {
    if (stryMutAct_9fa48("3494")) {
      {}
    } else {
      stryCov_9fa48("3494");
      return this.currentSettings.symbolSearch;
    }
  }
  async updateFileSearchSettings(fileSearch: Partial<NonNullable<UserSettings['fileSearch']>>): Promise<void> {
    if (stryMutAct_9fa48("3495")) {
      {}
    } else {
      stryCov_9fa48("3495");
      await this.updateSettings(stryMutAct_9fa48("3496") ? {} : (stryCov_9fa48("3496"), {
        fileSearch: stryMutAct_9fa48("3497") ? {} : (stryCov_9fa48("3497"), {
          ...this.currentSettings.fileSearch,
          ...fileSearch
        })
      }));
    }
  }
  getSettingsFilePath(): string {
    if (stryMutAct_9fa48("3498")) {
      {}
    } else {
      stryCov_9fa48("3498");
      return this.settingsFile;
    }
  }
}
export default SettingsManager;