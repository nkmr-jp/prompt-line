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
import path from 'path';
import { logger } from '../utils/utils';
import type SettingsManager from './settings-manager';
interface OpenFileResult {
  success: boolean;
  error?: string;
}
interface OpenFileOptions {
  lineNumber?: number;
  columnNumber?: number;
}

// Editor CLI commands and their line number support
interface EditorConfig {
  // CLI command to use (if different from app name)
  cli?: string;
  // Format for line number argument: 'goto' = --goto file:line, 'line' = --line N file, 'colon' = file:line
  lineFormat?: 'goto' | 'line' | 'colon' | 'url';
  // URL scheme for JetBrains-style navigation
  urlScheme?: string;
  // Use 'open -na <appName> --args' for macOS apps that accept file:line as argument
  useOpenArgs?: boolean;
}

// Known editors and their configurations
const EDITOR_CONFIGS: Record<string, EditorConfig> = stryMutAct_9fa48("2255") ? {} : (stryCov_9fa48("2255"), {
  // VSCode and variants
  'Visual Studio Code': stryMutAct_9fa48("2256") ? {} : (stryCov_9fa48("2256"), {
    cli: stryMutAct_9fa48("2257") ? "" : (stryCov_9fa48("2257"), 'code'),
    lineFormat: stryMutAct_9fa48("2258") ? "" : (stryCov_9fa48("2258"), 'goto')
  }),
  'Visual Studio Code - Insiders': stryMutAct_9fa48("2259") ? {} : (stryCov_9fa48("2259"), {
    cli: stryMutAct_9fa48("2260") ? "" : (stryCov_9fa48("2260"), 'code-insiders'),
    lineFormat: stryMutAct_9fa48("2261") ? "" : (stryCov_9fa48("2261"), 'goto')
  }),
  'VSCodium': stryMutAct_9fa48("2262") ? {} : (stryCov_9fa48("2262"), {
    cli: stryMutAct_9fa48("2263") ? "" : (stryCov_9fa48("2263"), 'codium'),
    lineFormat: stryMutAct_9fa48("2264") ? "" : (stryCov_9fa48("2264"), 'goto')
  }),
  'Cursor': stryMutAct_9fa48("2265") ? {} : (stryCov_9fa48("2265"), {
    cli: stryMutAct_9fa48("2266") ? "" : (stryCov_9fa48("2266"), 'cursor'),
    lineFormat: stryMutAct_9fa48("2267") ? "" : (stryCov_9fa48("2267"), 'goto')
  }),
  'Windsurf': stryMutAct_9fa48("2268") ? {} : (stryCov_9fa48("2268"), {
    cli: stryMutAct_9fa48("2269") ? "" : (stryCov_9fa48("2269"), 'windsurf'),
    lineFormat: stryMutAct_9fa48("2270") ? "" : (stryCov_9fa48("2270"), 'goto')
  }),
  // JetBrains IDEs (use 'open -na <app> --args file:line' for reliable line number support)
  'IntelliJ IDEA': stryMutAct_9fa48("2271") ? {} : (stryCov_9fa48("2271"), {
    useOpenArgs: stryMutAct_9fa48("2272") ? false : (stryCov_9fa48("2272"), true)
  }),
  'IntelliJ IDEA Ultimate': stryMutAct_9fa48("2273") ? {} : (stryCov_9fa48("2273"), {
    useOpenArgs: stryMutAct_9fa48("2274") ? false : (stryCov_9fa48("2274"), true)
  }),
  'IntelliJ IDEA Community': stryMutAct_9fa48("2275") ? {} : (stryCov_9fa48("2275"), {
    useOpenArgs: stryMutAct_9fa48("2276") ? false : (stryCov_9fa48("2276"), true)
  }),
  'WebStorm': stryMutAct_9fa48("2277") ? {} : (stryCov_9fa48("2277"), {
    useOpenArgs: stryMutAct_9fa48("2278") ? false : (stryCov_9fa48("2278"), true)
  }),
  'PyCharm': stryMutAct_9fa48("2279") ? {} : (stryCov_9fa48("2279"), {
    useOpenArgs: stryMutAct_9fa48("2280") ? false : (stryCov_9fa48("2280"), true)
  }),
  'PyCharm Professional': stryMutAct_9fa48("2281") ? {} : (stryCov_9fa48("2281"), {
    useOpenArgs: stryMutAct_9fa48("2282") ? false : (stryCov_9fa48("2282"), true)
  }),
  'PyCharm Community': stryMutAct_9fa48("2283") ? {} : (stryCov_9fa48("2283"), {
    useOpenArgs: stryMutAct_9fa48("2284") ? false : (stryCov_9fa48("2284"), true)
  }),
  'GoLand': stryMutAct_9fa48("2285") ? {} : (stryCov_9fa48("2285"), {
    useOpenArgs: stryMutAct_9fa48("2286") ? false : (stryCov_9fa48("2286"), true)
  }),
  'RubyMine': stryMutAct_9fa48("2287") ? {} : (stryCov_9fa48("2287"), {
    useOpenArgs: stryMutAct_9fa48("2288") ? false : (stryCov_9fa48("2288"), true)
  }),
  'PhpStorm': stryMutAct_9fa48("2289") ? {} : (stryCov_9fa48("2289"), {
    useOpenArgs: stryMutAct_9fa48("2290") ? false : (stryCov_9fa48("2290"), true)
  }),
  'CLion': stryMutAct_9fa48("2291") ? {} : (stryCov_9fa48("2291"), {
    useOpenArgs: stryMutAct_9fa48("2292") ? false : (stryCov_9fa48("2292"), true)
  }),
  'Rider': stryMutAct_9fa48("2293") ? {} : (stryCov_9fa48("2293"), {
    useOpenArgs: stryMutAct_9fa48("2294") ? false : (stryCov_9fa48("2294"), true)
  }),
  'DataGrip': stryMutAct_9fa48("2295") ? {} : (stryCov_9fa48("2295"), {
    useOpenArgs: stryMutAct_9fa48("2296") ? false : (stryCov_9fa48("2296"), true)
  }),
  'AppCode': stryMutAct_9fa48("2297") ? {} : (stryCov_9fa48("2297"), {
    useOpenArgs: stryMutAct_9fa48("2298") ? false : (stryCov_9fa48("2298"), true)
  }),
  'Android Studio': stryMutAct_9fa48("2299") ? {} : (stryCov_9fa48("2299"), {
    useOpenArgs: stryMutAct_9fa48("2300") ? false : (stryCov_9fa48("2300"), true)
  }),
  // Other editors
  'Sublime Text': stryMutAct_9fa48("2301") ? {} : (stryCov_9fa48("2301"), {
    cli: stryMutAct_9fa48("2302") ? "" : (stryCov_9fa48("2302"), 'subl'),
    lineFormat: stryMutAct_9fa48("2303") ? "" : (stryCov_9fa48("2303"), 'colon')
  }),
  'TextMate': stryMutAct_9fa48("2304") ? {} : (stryCov_9fa48("2304"), {
    cli: stryMutAct_9fa48("2305") ? "" : (stryCov_9fa48("2305"), 'mate'),
    lineFormat: stryMutAct_9fa48("2306") ? "" : (stryCov_9fa48("2306"), 'line')
  }),
  'Atom': stryMutAct_9fa48("2307") ? {} : (stryCov_9fa48("2307"), {
    cli: stryMutAct_9fa48("2308") ? "" : (stryCov_9fa48("2308"), 'atom'),
    lineFormat: stryMutAct_9fa48("2309") ? "" : (stryCov_9fa48("2309"), 'colon')
  }),
  'Zed': stryMutAct_9fa48("2310") ? {} : (stryCov_9fa48("2310"), {
    cli: stryMutAct_9fa48("2311") ? "" : (stryCov_9fa48("2311"), 'zed'),
    lineFormat: stryMutAct_9fa48("2312") ? "" : (stryCov_9fa48("2312"), 'colon')
  })
});
export class FileOpenerManager {
  private settingsManager: SettingsManager;
  constructor(settingsManager: SettingsManager) {
    if (stryMutAct_9fa48("2313")) {
      {}
    } else {
      stryCov_9fa48("2313");
      this.settingsManager = settingsManager;
    }
  }

  /**
   * ファイルを適切なアプリで開く
   * @param filePath ファイルパス
   * @param options オプション（行番号など）
   */
  async openFile(filePath: string, options?: OpenFileOptions): Promise<OpenFileResult> {
    if (stryMutAct_9fa48("2314")) {
      {}
    } else {
      stryCov_9fa48("2314");
      const settings = this.settingsManager.getSettings();
      const ext = stryMutAct_9fa48("2316") ? path.extname(filePath).toLowerCase() : stryMutAct_9fa48("2315") ? path.extname(filePath).slice(1).toUpperCase() : (stryCov_9fa48("2315", "2316"), path.extname(filePath).slice(1).toLowerCase());

      // 拡張子に対応するアプリを取得
      const app = stryMutAct_9fa48("2319") ? settings.fileOpener?.extensions?.[ext] && settings.fileOpener?.defaultEditor : stryMutAct_9fa48("2318") ? false : stryMutAct_9fa48("2317") ? true : (stryCov_9fa48("2317", "2318", "2319"), (stryMutAct_9fa48("2321") ? settings.fileOpener.extensions?.[ext] : stryMutAct_9fa48("2320") ? settings.fileOpener?.extensions[ext] : (stryCov_9fa48("2320", "2321"), settings.fileOpener?.extensions?.[ext])) || (stryMutAct_9fa48("2322") ? settings.fileOpener.defaultEditor : (stryCov_9fa48("2322"), settings.fileOpener?.defaultEditor)));
      logger.debug(stryMutAct_9fa48("2323") ? "" : (stryCov_9fa48("2323"), 'FileOpenerManager: openFile called'), stryMutAct_9fa48("2324") ? {} : (stryCov_9fa48("2324"), {
        filePath,
        ext,
        lineNumber: stryMutAct_9fa48("2325") ? options.lineNumber : (stryCov_9fa48("2325"), options?.lineNumber),
        fileOpenerSettings: settings.fileOpener,
        selectedApp: stryMutAct_9fa48("2328") ? app && 'system default' : stryMutAct_9fa48("2327") ? false : stryMutAct_9fa48("2326") ? true : (stryCov_9fa48("2326", "2327", "2328"), app || (stryMutAct_9fa48("2329") ? "" : (stryCov_9fa48("2329"), 'system default')))
      }));
      if (stryMutAct_9fa48("2331") ? false : stryMutAct_9fa48("2330") ? true : (stryCov_9fa48("2330", "2331"), app)) {
        if (stryMutAct_9fa48("2332")) {
          {}
        } else {
          stryCov_9fa48("2332");
          return this.openWithApp(filePath, app, options);
        }
      }

      // デフォルト動作（システムデフォルトアプリ）
      return this.openWithDefault(filePath);
    }
  }

  /**
   * 指定アプリでファイルを開く（execFileを使用 - シェルインジェクション防止）
   */
  private openWithApp(filePath: string, appName: string, options?: OpenFileOptions): Promise<OpenFileResult> {
    if (stryMutAct_9fa48("2333")) {
      {}
    } else {
      stryCov_9fa48("2333");
      return new Promise(resolve => {
        if (stryMutAct_9fa48("2334")) {
          {}
        } else {
          stryCov_9fa48("2334");
          // アプリ名の検証
          if (stryMutAct_9fa48("2337") ? !appName && typeof appName !== 'string' : stryMutAct_9fa48("2336") ? false : stryMutAct_9fa48("2335") ? true : (stryCov_9fa48("2335", "2336", "2337"), (stryMutAct_9fa48("2338") ? appName : (stryCov_9fa48("2338"), !appName)) || (stryMutAct_9fa48("2340") ? typeof appName === 'string' : stryMutAct_9fa48("2339") ? false : (stryCov_9fa48("2339", "2340"), typeof appName !== (stryMutAct_9fa48("2341") ? "" : (stryCov_9fa48("2341"), 'string')))))) {
            if (stryMutAct_9fa48("2342")) {
              {}
            } else {
              stryCov_9fa48("2342");
              logger.warn(stryMutAct_9fa48("2343") ? "" : (stryCov_9fa48("2343"), 'Invalid app name provided'), stryMutAct_9fa48("2344") ? {} : (stryCov_9fa48("2344"), {
                appName
              }));
              this.openWithDefault(filePath).then(resolve);
              return;
            }
          }

          // パストラバーサルパターンの検出
          if (stryMutAct_9fa48("2347") ? appName.includes('..') && appName.includes('/') : stryMutAct_9fa48("2346") ? false : stryMutAct_9fa48("2345") ? true : (stryCov_9fa48("2345", "2346", "2347"), appName.includes(stryMutAct_9fa48("2348") ? "" : (stryCov_9fa48("2348"), '..')) || appName.includes(stryMutAct_9fa48("2349") ? "" : (stryCov_9fa48("2349"), '/')))) {
            if (stryMutAct_9fa48("2350")) {
              {}
            } else {
              stryCov_9fa48("2350");
              logger.warn(stryMutAct_9fa48("2351") ? "" : (stryCov_9fa48("2351"), 'Potentially malicious app name detected'), stryMutAct_9fa48("2352") ? {} : (stryCov_9fa48("2352"), {
                appName
              }));
              this.openWithDefault(filePath).then(resolve);
              return;
            }
          }

          // Check if we have a line number and the editor supports it
          const editorConfig = EDITOR_CONFIGS[appName];
          if (stryMutAct_9fa48("2355") ? options?.lineNumber || editorConfig : stryMutAct_9fa48("2354") ? false : stryMutAct_9fa48("2353") ? true : (stryCov_9fa48("2353", "2354", "2355"), (stryMutAct_9fa48("2356") ? options.lineNumber : (stryCov_9fa48("2356"), options?.lineNumber)) && editorConfig)) {
            if (stryMutAct_9fa48("2357")) {
              {}
            } else {
              stryCov_9fa48("2357");
              this.openWithLineNumber(filePath, appName, editorConfig, options).then(resolve).catch(() => {
                if (stryMutAct_9fa48("2358")) {
                  {}
                } else {
                  stryCov_9fa48("2358");
                  // Fallback to regular open if line number open fails
                  logger.warn(stryMutAct_9fa48("2359") ? "" : (stryCov_9fa48("2359"), 'Line number open failed, falling back to regular open'), stryMutAct_9fa48("2360") ? {} : (stryCov_9fa48("2360"), {
                    appName,
                    filePath
                  }));
                  this.openWithAppSimple(filePath, appName).then(resolve);
                }
              });
              return;
            }
          }

          // No line number or unsupported editor - use simple open
          this.openWithAppSimple(filePath, appName).then(resolve);
        }
      });
    }
  }

  /**
   * シンプルなアプリ起動（行番号なし）
   */
  private openWithAppSimple(filePath: string, appName: string): Promise<OpenFileResult> {
    if (stryMutAct_9fa48("2361")) {
      {}
    } else {
      stryCov_9fa48("2361");
      return new Promise(resolve => {
        if (stryMutAct_9fa48("2362")) {
          {}
        } else {
          stryCov_9fa48("2362");
          // execFileを使用（引数を配列で渡すことでシェルインジェクションを防止）
          // デフォルトでアプリはフロントに持ってくる（-g を付けないことでフォアグラウンドで開く）
          execFile(stryMutAct_9fa48("2363") ? "" : (stryCov_9fa48("2363"), 'open'), stryMutAct_9fa48("2364") ? [] : (stryCov_9fa48("2364"), [stryMutAct_9fa48("2365") ? "" : (stryCov_9fa48("2365"), '-a'), appName, filePath]), error => {
            if (stryMutAct_9fa48("2366")) {
              {}
            } else {
              stryCov_9fa48("2366");
              if (stryMutAct_9fa48("2368") ? false : stryMutAct_9fa48("2367") ? true : (stryCov_9fa48("2367", "2368"), error)) {
                if (stryMutAct_9fa48("2369")) {
                  {}
                } else {
                  stryCov_9fa48("2369");
                  // アプリが見つからない等のエラー時はフォールバック
                  logger.warn(stryMutAct_9fa48("2370") ? `` : (stryCov_9fa48("2370"), `Failed to open with ${appName}, falling back to default`), stryMutAct_9fa48("2371") ? {} : (stryCov_9fa48("2371"), {
                    error: error.message,
                    filePath
                  }));
                  // フォールバック：システムデフォルトで開く
                  this.openWithDefault(filePath).then(resolve);
                  return;
                }
              }
              logger.info(stryMutAct_9fa48("2372") ? "" : (stryCov_9fa48("2372"), 'File opened successfully with configured app'), stryMutAct_9fa48("2373") ? {} : (stryCov_9fa48("2373"), {
                filePath,
                app: appName
              }));
              resolve(stryMutAct_9fa48("2374") ? {} : (stryCov_9fa48("2374"), {
                success: stryMutAct_9fa48("2375") ? false : (stryCov_9fa48("2375"), true)
              }));
            }
          });
        }
      });
    }
  }

  /**
   * 行番号指定でファイルを開く
   */
  private openWithLineNumber(filePath: string, appName: string, config: EditorConfig, options: OpenFileOptions): Promise<OpenFileResult> {
    if (stryMutAct_9fa48("2376")) {
      {}
    } else {
      stryCov_9fa48("2376");
      return new Promise((resolve, reject) => {
        if (stryMutAct_9fa48("2377")) {
          {}
        } else {
          stryCov_9fa48("2377");
          const lineNumber = stryMutAct_9fa48("2380") ? options.lineNumber && 1 : stryMutAct_9fa48("2379") ? false : stryMutAct_9fa48("2378") ? true : (stryCov_9fa48("2378", "2379", "2380"), options.lineNumber || 1);
          const columnNumber = stryMutAct_9fa48("2383") ? options.columnNumber && 1 : stryMutAct_9fa48("2382") ? false : stryMutAct_9fa48("2381") ? true : (stryCov_9fa48("2381", "2382", "2383"), options.columnNumber || 1);
          logger.debug(stryMutAct_9fa48("2384") ? "" : (stryCov_9fa48("2384"), 'Opening file with line number'), stryMutAct_9fa48("2385") ? {} : (stryCov_9fa48("2385"), {
            filePath,
            appName,
            lineNumber,
            columnNumber,
            config
          }));

          // macOS 'open -na <app> --args --line <line> file' method (for JetBrains IDEs)
          if (stryMutAct_9fa48("2387") ? false : stryMutAct_9fa48("2386") ? true : (stryCov_9fa48("2386", "2387"), config.useOpenArgs)) {
            if (stryMutAct_9fa48("2388")) {
              {}
            } else {
              stryCov_9fa48("2388");
              // JetBrains IDEs use: --line <line> [--column <column>] file
              const args = stryMutAct_9fa48("2389") ? [] : (stryCov_9fa48("2389"), [stryMutAct_9fa48("2390") ? "" : (stryCov_9fa48("2390"), '-na'), appName, stryMutAct_9fa48("2391") ? "" : (stryCov_9fa48("2391"), '--args'), stryMutAct_9fa48("2392") ? "" : (stryCov_9fa48("2392"), '--line'), String(lineNumber), filePath]);
              logger.debug(stryMutAct_9fa48("2393") ? "" : (stryCov_9fa48("2393"), 'Opening with open -na --args (JetBrains style)'), stryMutAct_9fa48("2394") ? {} : (stryCov_9fa48("2394"), {
                appName,
                args
              }));
              execFile(stryMutAct_9fa48("2395") ? "" : (stryCov_9fa48("2395"), 'open'), args, error => {
                if (stryMutAct_9fa48("2396")) {
                  {}
                } else {
                  stryCov_9fa48("2396");
                  if (stryMutAct_9fa48("2398") ? false : stryMutAct_9fa48("2397") ? true : (stryCov_9fa48("2397", "2398"), error)) {
                    if (stryMutAct_9fa48("2399")) {
                      {}
                    } else {
                      stryCov_9fa48("2399");
                      logger.warn(stryMutAct_9fa48("2400") ? "" : (stryCov_9fa48("2400"), 'open -na --args failed'), stryMutAct_9fa48("2401") ? {} : (stryCov_9fa48("2401"), {
                        error: error.message,
                        appName,
                        args
                      }));
                      reject(error);
                      return;
                    }
                  }
                  logger.info(stryMutAct_9fa48("2402") ? "" : (stryCov_9fa48("2402"), 'File opened successfully with open -na --args'), stryMutAct_9fa48("2403") ? {} : (stryCov_9fa48("2403"), {
                    filePath,
                    lineNumber,
                    app: appName
                  }));
                  resolve(stryMutAct_9fa48("2404") ? {} : (stryCov_9fa48("2404"), {
                    success: stryMutAct_9fa48("2405") ? false : (stryCov_9fa48("2405"), true)
                  }));
                }
              });
              return;
            }
          }

          // JetBrains URL scheme
          if (stryMutAct_9fa48("2407") ? false : stryMutAct_9fa48("2406") ? true : (stryCov_9fa48("2406", "2407"), config.urlScheme)) {
            if (stryMutAct_9fa48("2408")) {
              {}
            } else {
              stryCov_9fa48("2408");
              // Use URL scheme: jetbrains://<ide>/navigate/reference?path=<file>&line=<line>
              const url = stryMutAct_9fa48("2409") ? `` : (stryCov_9fa48("2409"), `${config.urlScheme}://open?file=${encodeURIComponent(filePath)}&line=${lineNumber}`);
              logger.debug(stryMutAct_9fa48("2410") ? "" : (stryCov_9fa48("2410"), 'Opening with JetBrains URL scheme'), stryMutAct_9fa48("2411") ? {} : (stryCov_9fa48("2411"), {
                url
              }));
              execFile(stryMutAct_9fa48("2412") ? "" : (stryCov_9fa48("2412"), 'open'), stryMutAct_9fa48("2413") ? [] : (stryCov_9fa48("2413"), [url]), error => {
                if (stryMutAct_9fa48("2414")) {
                  {}
                } else {
                  stryCov_9fa48("2414");
                  if (stryMutAct_9fa48("2416") ? false : stryMutAct_9fa48("2415") ? true : (stryCov_9fa48("2415", "2416"), error)) {
                    if (stryMutAct_9fa48("2417")) {
                      {}
                    } else {
                      stryCov_9fa48("2417");
                      logger.warn(stryMutAct_9fa48("2418") ? "" : (stryCov_9fa48("2418"), 'JetBrains URL scheme failed'), stryMutAct_9fa48("2419") ? {} : (stryCov_9fa48("2419"), {
                        error: error.message,
                        url
                      }));
                      reject(error);
                      return;
                    }
                  }
                  logger.info(stryMutAct_9fa48("2420") ? "" : (stryCov_9fa48("2420"), 'File opened successfully with JetBrains URL scheme'), stryMutAct_9fa48("2421") ? {} : (stryCov_9fa48("2421"), {
                    filePath,
                    lineNumber,
                    app: appName
                  }));
                  resolve(stryMutAct_9fa48("2422") ? {} : (stryCov_9fa48("2422"), {
                    success: stryMutAct_9fa48("2423") ? false : (stryCov_9fa48("2423"), true)
                  }));
                }
              });
              return;
            }
          }

          // CLI-based editors
          if (stryMutAct_9fa48("2425") ? false : stryMutAct_9fa48("2424") ? true : (stryCov_9fa48("2424", "2425"), config.cli)) {
            if (stryMutAct_9fa48("2426")) {
              {}
            } else {
              stryCov_9fa48("2426");
              let args: string[];
              switch (config.lineFormat) {
                case stryMutAct_9fa48("2428") ? "" : (stryCov_9fa48("2428"), 'goto'):
                  if (stryMutAct_9fa48("2427")) {} else {
                    stryCov_9fa48("2427");
                    // VSCode style: --goto file:line:column
                    args = stryMutAct_9fa48("2429") ? [] : (stryCov_9fa48("2429"), [stryMutAct_9fa48("2430") ? "" : (stryCov_9fa48("2430"), '--goto'), stryMutAct_9fa48("2431") ? `` : (stryCov_9fa48("2431"), `${filePath}:${lineNumber}:${columnNumber}`)]);
                    break;
                  }
                case stryMutAct_9fa48("2433") ? "" : (stryCov_9fa48("2433"), 'line'):
                  if (stryMutAct_9fa48("2432")) {} else {
                    stryCov_9fa48("2432");
                    // TextMate style: -l <line> <file>
                    args = stryMutAct_9fa48("2434") ? [] : (stryCov_9fa48("2434"), [stryMutAct_9fa48("2435") ? "" : (stryCov_9fa48("2435"), '-l'), String(lineNumber), filePath]);
                    break;
                  }
                case stryMutAct_9fa48("2437") ? "" : (stryCov_9fa48("2437"), 'colon'):
                  if (stryMutAct_9fa48("2436")) {} else {
                    stryCov_9fa48("2436");
                    // Sublime/Atom style: file:line:column
                    args = stryMutAct_9fa48("2438") ? [] : (stryCov_9fa48("2438"), [stryMutAct_9fa48("2439") ? `` : (stryCov_9fa48("2439"), `${filePath}:${lineNumber}:${columnNumber}`)]);
                    break;
                  }
                default:
                  if (stryMutAct_9fa48("2440")) {} else {
                    stryCov_9fa48("2440");
                    args = stryMutAct_9fa48("2441") ? [] : (stryCov_9fa48("2441"), [filePath]);
                  }
              }
              logger.debug(stryMutAct_9fa48("2442") ? "" : (stryCov_9fa48("2442"), 'Opening with CLI'), stryMutAct_9fa48("2443") ? {} : (stryCov_9fa48("2443"), {
                cli: config.cli,
                args
              }));
              execFile(config.cli, args, error => {
                if (stryMutAct_9fa48("2444")) {
                  {}
                } else {
                  stryCov_9fa48("2444");
                  if (stryMutAct_9fa48("2446") ? false : stryMutAct_9fa48("2445") ? true : (stryCov_9fa48("2445", "2446"), error)) {
                    if (stryMutAct_9fa48("2447")) {
                      {}
                    } else {
                      stryCov_9fa48("2447");
                      logger.warn(stryMutAct_9fa48("2448") ? "" : (stryCov_9fa48("2448"), 'CLI open failed'), stryMutAct_9fa48("2449") ? {} : (stryCov_9fa48("2449"), {
                        error: error.message,
                        cli: config.cli,
                        args
                      }));
                      reject(error);
                      return;
                    }
                  }
                  logger.info(stryMutAct_9fa48("2450") ? "" : (stryCov_9fa48("2450"), 'File opened successfully with CLI'), stryMutAct_9fa48("2451") ? {} : (stryCov_9fa48("2451"), {
                    filePath,
                    lineNumber,
                    cli: config.cli
                  }));
                  resolve(stryMutAct_9fa48("2452") ? {} : (stryCov_9fa48("2452"), {
                    success: stryMutAct_9fa48("2453") ? false : (stryCov_9fa48("2453"), true)
                  }));
                }
              });
              return;
            }
          }

          // No special handling available
          reject(new Error(stryMutAct_9fa48("2454") ? "" : (stryCov_9fa48("2454"), 'No line number handling available for this editor')));
        }
      });
    }
  }

  /**
   * システムデフォルトで開く
   * openコマンドを使用してアプリをフォアグラウンドで開く
   */
  private openWithDefault(filePath: string): Promise<OpenFileResult> {
    if (stryMutAct_9fa48("2455")) {
      {}
    } else {
      stryCov_9fa48("2455");
      return new Promise(resolve => {
        if (stryMutAct_9fa48("2456")) {
          {}
        } else {
          stryCov_9fa48("2456");
          // openコマンドを使用（shell.openPathはアプリをフロントに持ってこない場合がある）
          // -g オプションを付けないことでフォアグラウンドで開く
          execFile(stryMutAct_9fa48("2457") ? "" : (stryCov_9fa48("2457"), 'open'), stryMutAct_9fa48("2458") ? [] : (stryCov_9fa48("2458"), [filePath]), error => {
            if (stryMutAct_9fa48("2459")) {
              {}
            } else {
              stryCov_9fa48("2459");
              if (stryMutAct_9fa48("2461") ? false : stryMutAct_9fa48("2460") ? true : (stryCov_9fa48("2460", "2461"), error)) {
                if (stryMutAct_9fa48("2462")) {
                  {}
                } else {
                  stryCov_9fa48("2462");
                  logger.error(stryMutAct_9fa48("2463") ? "" : (stryCov_9fa48("2463"), 'Failed to open file with default app'), stryMutAct_9fa48("2464") ? {} : (stryCov_9fa48("2464"), {
                    error: error.message,
                    filePath
                  }));
                  resolve(stryMutAct_9fa48("2465") ? {} : (stryCov_9fa48("2465"), {
                    success: stryMutAct_9fa48("2466") ? true : (stryCov_9fa48("2466"), false),
                    error: error.message
                  }));
                  return;
                }
              }
              logger.info(stryMutAct_9fa48("2467") ? "" : (stryCov_9fa48("2467"), 'File opened successfully with default app'), stryMutAct_9fa48("2468") ? {} : (stryCov_9fa48("2468"), {
                filePath
              }));
              resolve(stryMutAct_9fa48("2469") ? {} : (stryCov_9fa48("2469"), {
                success: stryMutAct_9fa48("2470") ? false : (stryCov_9fa48("2470"), true)
              }));
            }
          });
        }
      });
    }
  }

  /**
   * 指定された拡張子に対して設定されているアプリ名を取得
   */
  getAppForExtension(extension: string): string | null {
    if (stryMutAct_9fa48("2471")) {
      {}
    } else {
      stryCov_9fa48("2471");
      const settings = this.settingsManager.getSettings();
      const ext = (stryMutAct_9fa48("2472") ? extension.endsWith('.') : (stryCov_9fa48("2472"), extension.startsWith(stryMutAct_9fa48("2473") ? "" : (stryCov_9fa48("2473"), '.')))) ? stryMutAct_9fa48("2474") ? extension : (stryCov_9fa48("2474"), extension.slice(1)) : extension;
      return stryMutAct_9fa48("2477") ? settings.fileOpener?.extensions?.[ext.toLowerCase()] && null : stryMutAct_9fa48("2476") ? false : stryMutAct_9fa48("2475") ? true : (stryCov_9fa48("2475", "2476", "2477"), (stryMutAct_9fa48("2479") ? settings.fileOpener.extensions?.[ext.toLowerCase()] : stryMutAct_9fa48("2478") ? settings.fileOpener?.extensions[ext.toLowerCase()] : (stryCov_9fa48("2478", "2479"), settings.fileOpener?.extensions?.[stryMutAct_9fa48("2480") ? ext.toUpperCase() : (stryCov_9fa48("2480"), ext.toLowerCase())])) || null);
    }
  }

  /**
   * デフォルトエディタを取得
   */
  getDefaultEditor(): string | null {
    if (stryMutAct_9fa48("2481")) {
      {}
    } else {
      stryCov_9fa48("2481");
      const settings = this.settingsManager.getSettings();
      return stryMutAct_9fa48("2484") ? settings.fileOpener?.defaultEditor && null : stryMutAct_9fa48("2483") ? false : stryMutAct_9fa48("2482") ? true : (stryCov_9fa48("2482", "2483", "2484"), (stryMutAct_9fa48("2485") ? settings.fileOpener.defaultEditor : (stryCov_9fa48("2485"), settings.fileOpener?.defaultEditor)) || null);
    }
  }
}
export default FileOpenerManager;