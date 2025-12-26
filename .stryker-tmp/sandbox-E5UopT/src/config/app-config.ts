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
import path from 'path';
import os from 'os';
import type { WindowConfig, ShortcutsConfig, PathsConfig, HistoryConfig, DraftConfig, TimingConfig, AppConfig, PlatformConfig, LoggingConfig, LogLevel } from '../types';

// Import package.json to get the version dynamically
import packageJson from '../../package.json';
class AppConfigClass {
  public window!: WindowConfig;
  public shortcuts!: ShortcutsConfig;
  public paths!: PathsConfig;
  public history!: HistoryConfig;
  public draft!: DraftConfig;
  public timing!: TimingConfig;
  public app!: AppConfig;
  public platform!: PlatformConfig;
  public logging!: LoggingConfig;
  constructor() {
    if (stryMutAct_9fa48("0")) {
      {}
    } else {
      stryCov_9fa48("0");
      this.init();
    }
  }
  private init(): void {
    if (stryMutAct_9fa48("1")) {
      {}
    } else {
      stryCov_9fa48("1");
      this.window = stryMutAct_9fa48("2") ? {} : (stryCov_9fa48("2"), {
        width: 600,
        height: 300,
        frame: stryMutAct_9fa48("3") ? true : (stryCov_9fa48("3"), false),
        transparent: stryMutAct_9fa48("4") ? true : (stryCov_9fa48("4"), false),
        backgroundColor: stryMutAct_9fa48("5") ? "" : (stryCov_9fa48("5"), '#141414'),
        alwaysOnTop: stryMutAct_9fa48("6") ? false : (stryCov_9fa48("6"), true),
        skipTaskbar: stryMutAct_9fa48("7") ? false : (stryCov_9fa48("7"), true),
        resizable: stryMutAct_9fa48("8") ? true : (stryCov_9fa48("8"), false),
        webPreferences: stryMutAct_9fa48("9") ? {} : (stryCov_9fa48("9"), {
          // Enhanced security configuration
          nodeIntegration: stryMutAct_9fa48("10") ? true : (stryCov_9fa48("10"), false),
          contextIsolation: stryMutAct_9fa48("11") ? false : (stryCov_9fa48("11"), true),
          webSecurity: stryMutAct_9fa48("12") ? false : (stryCov_9fa48("12"), true),
          preload: path.join(__dirname, stryMutAct_9fa48("13") ? "" : (stryCov_9fa48("13"), '..'), stryMutAct_9fa48("14") ? "" : (stryCov_9fa48("14"), 'preload'), stryMutAct_9fa48("15") ? "" : (stryCov_9fa48("15"), 'preload.js')),
          // Maintain existing settings
          spellcheck: stryMutAct_9fa48("16") ? true : (stryCov_9fa48("16"), false),
          disableDialogs: stryMutAct_9fa48("17") ? false : (stryCov_9fa48("17"), true),
          enableWebSQL: stryMutAct_9fa48("18") ? true : (stryCov_9fa48("18"), false),
          experimentalFeatures: stryMutAct_9fa48("19") ? true : (stryCov_9fa48("19"), false),
          defaultEncoding: stryMutAct_9fa48("20") ? "" : (stryCov_9fa48("20"), 'UTF-8'),
          offscreen: stryMutAct_9fa48("21") ? true : (stryCov_9fa48("21"), false),
          enablePreferredSizeMode: stryMutAct_9fa48("22") ? true : (stryCov_9fa48("22"), false),
          disableHtmlFullscreenWindowResize: stryMutAct_9fa48("23") ? false : (stryCov_9fa48("23"), true),
          // Additional security settings
          allowRunningInsecureContent: stryMutAct_9fa48("24") ? true : (stryCov_9fa48("24"), false),
          sandbox: stryMutAct_9fa48("25") ? false : (stryCov_9fa48("25"), true) // Enabled for enhanced security (accessibility features work via main process)
        })
      });
      this.shortcuts = stryMutAct_9fa48("26") ? {} : (stryCov_9fa48("26"), {
        main: stryMutAct_9fa48("27") ? "" : (stryCov_9fa48("27"), 'Cmd+Shift+Space'),
        paste: stryMutAct_9fa48("28") ? "" : (stryCov_9fa48("28"), 'Cmd+Enter'),
        close: stryMutAct_9fa48("29") ? "" : (stryCov_9fa48("29"), 'Escape'),
        historyNext: stryMutAct_9fa48("30") ? "" : (stryCov_9fa48("30"), 'Ctrl+j'),
        historyPrev: stryMutAct_9fa48("31") ? "" : (stryCov_9fa48("31"), 'Ctrl+k'),
        search: stryMutAct_9fa48("32") ? "" : (stryCov_9fa48("32"), 'Cmd+f')
      });
      const userDataDir = path.join(os.homedir(), stryMutAct_9fa48("33") ? "" : (stryCov_9fa48("33"), '.prompt-line'));
      this.paths = stryMutAct_9fa48("34") ? {} : (stryCov_9fa48("34"), {
        userDataDir,
        get historyFile() {
          if (stryMutAct_9fa48("35")) {
            {}
          } else {
            stryCov_9fa48("35");
            return path.join(userDataDir, stryMutAct_9fa48("36") ? "" : (stryCov_9fa48("36"), 'history.jsonl'));
          }
        },
        get draftFile() {
          if (stryMutAct_9fa48("37")) {
            {}
          } else {
            stryCov_9fa48("37");
            return path.join(userDataDir, stryMutAct_9fa48("38") ? "" : (stryCov_9fa48("38"), 'draft.json'));
          }
        },
        get logFile() {
          if (stryMutAct_9fa48("39")) {
            {}
          } else {
            stryCov_9fa48("39");
            return path.join(userDataDir, stryMutAct_9fa48("40") ? "" : (stryCov_9fa48("40"), 'app.log'));
          }
        },
        get imagesDir() {
          if (stryMutAct_9fa48("41")) {
            {}
          } else {
            stryCov_9fa48("41");
            return path.join(userDataDir, stryMutAct_9fa48("42") ? "" : (stryCov_9fa48("42"), 'images'));
          }
        },
        get directoryFile() {
          if (stryMutAct_9fa48("43")) {
            {}
          } else {
            stryCov_9fa48("43");
            return path.join(userDataDir, stryMutAct_9fa48("44") ? "" : (stryCov_9fa48("44"), 'directory.json'));
          }
        },
        get cacheDir() {
          if (stryMutAct_9fa48("45")) {
            {}
          } else {
            stryCov_9fa48("45");
            return path.join(userDataDir, stryMutAct_9fa48("46") ? "" : (stryCov_9fa48("46"), 'cache'));
          }
        },
        get projectsCacheDir() {
          if (stryMutAct_9fa48("47")) {
            {}
          } else {
            stryCov_9fa48("47");
            return path.join(userDataDir, stryMutAct_9fa48("48") ? "" : (stryCov_9fa48("48"), 'cache'), stryMutAct_9fa48("49") ? "" : (stryCov_9fa48("49"), 'projects'));
          }
        }
      });
      this.history = stryMutAct_9fa48("50") ? {} : (stryCov_9fa48("50"), {
        saveInterval: 1000
      });
      this.draft = stryMutAct_9fa48("51") ? {} : (stryCov_9fa48("51"), {
        saveDelay: 500
      });
      this.timing = stryMutAct_9fa48("52") ? {} : (stryCov_9fa48("52"), {
        windowHideDelay: 10,
        appFocusDelay: 50
      });
      this.app = stryMutAct_9fa48("53") ? {} : (stryCov_9fa48("53"), {
        name: stryMutAct_9fa48("54") ? "" : (stryCov_9fa48("54"), 'Prompt Line'),
        version: packageJson.version,
        description: stryMutAct_9fa48("55") ? "" : (stryCov_9fa48("55"), 'プロンプトラインアプリ - カーソル位置にテキストを素早く貼り付け')
      });
      this.platform = stryMutAct_9fa48("56") ? {} : (stryCov_9fa48("56"), {
        isMac: stryMutAct_9fa48("59") ? process.platform !== 'darwin' : stryMutAct_9fa48("58") ? false : stryMutAct_9fa48("57") ? true : (stryCov_9fa48("57", "58", "59"), process.platform === (stryMutAct_9fa48("60") ? "" : (stryCov_9fa48("60"), 'darwin'))),
        isWindows: stryMutAct_9fa48("63") ? process.platform !== 'win32' : stryMutAct_9fa48("62") ? false : stryMutAct_9fa48("61") ? true : (stryCov_9fa48("61", "62", "63"), process.platform === (stryMutAct_9fa48("64") ? "" : (stryCov_9fa48("64"), 'win32'))),
        isLinux: stryMutAct_9fa48("67") ? process.platform !== 'linux' : stryMutAct_9fa48("66") ? false : stryMutAct_9fa48("65") ? true : (stryCov_9fa48("65", "66", "67"), process.platform === (stryMutAct_9fa48("68") ? "" : (stryCov_9fa48("68"), 'linux')))
      });

      // Determine log level based on LOG_LEVEL environment variable
      let logLevel: LogLevel = stryMutAct_9fa48("69") ? "" : (stryCov_9fa48("69"), 'info'); // Default to info
      if (stryMutAct_9fa48("72") ? process.env.LOG_LEVEL !== 'debug' : stryMutAct_9fa48("71") ? false : stryMutAct_9fa48("70") ? true : (stryCov_9fa48("70", "71", "72"), process.env.LOG_LEVEL === (stryMutAct_9fa48("73") ? "" : (stryCov_9fa48("73"), 'debug')))) {
        if (stryMutAct_9fa48("74")) {
          {}
        } else {
          stryCov_9fa48("74");
          logLevel = stryMutAct_9fa48("75") ? "" : (stryCov_9fa48("75"), 'debug');
        }
      }
      this.logging = stryMutAct_9fa48("76") ? {} : (stryCov_9fa48("76"), {
        level: logLevel,
        enableFileLogging: stryMutAct_9fa48("77") ? false : (stryCov_9fa48("77"), true),
        maxLogFileSize: stryMutAct_9fa48("78") ? 5 * 1024 / 1024 : (stryCov_9fa48("78"), (stryMutAct_9fa48("79") ? 5 / 1024 : (stryCov_9fa48("79"), 5 * 1024)) * 1024),
        maxLogFiles: 3
      });
    }
  }
  get<K extends keyof this>(section: K): this[K] {
    if (stryMutAct_9fa48("80")) {
      {}
    } else {
      stryCov_9fa48("80");
      return stryMutAct_9fa48("83") ? this[section] && {} as this[K] : stryMutAct_9fa48("82") ? false : stryMutAct_9fa48("81") ? true : (stryCov_9fa48("81", "82", "83"), this[section] || {} as this[K]);
    }
  }
  getValue(path: string): unknown {
    if (stryMutAct_9fa48("84")) {
      {}
    } else {
      stryCov_9fa48("84");
      return path.split(stryMutAct_9fa48("85") ? "" : (stryCov_9fa48("85"), '.')).reduce(stryMutAct_9fa48("86") ? () => undefined : (stryCov_9fa48("86"), (obj, key) => stryMutAct_9fa48("89") ? obj || (obj as Record<string, unknown>)[key] : stryMutAct_9fa48("88") ? false : stryMutAct_9fa48("87") ? true : (stryCov_9fa48("87", "88", "89"), obj && (obj as Record<string, unknown>)[key])), this as unknown);
    }
  }
  isDevelopment(): boolean {
    if (stryMutAct_9fa48("90")) {
      {}
    } else {
      stryCov_9fa48("90");
      return stryMutAct_9fa48("93") ? process.env.NODE_ENV !== 'development' : stryMutAct_9fa48("92") ? false : stryMutAct_9fa48("91") ? true : (stryCov_9fa48("91", "92", "93"), process.env.NODE_ENV === (stryMutAct_9fa48("94") ? "" : (stryCov_9fa48("94"), 'development')));
    }
  }
  isProduction(): boolean {
    if (stryMutAct_9fa48("95")) {
      {}
    } else {
      stryCov_9fa48("95");
      return stryMutAct_9fa48("98") ? process.env.NODE_ENV !== 'production' : stryMutAct_9fa48("97") ? false : stryMutAct_9fa48("96") ? true : (stryCov_9fa48("96", "97", "98"), process.env.NODE_ENV === (stryMutAct_9fa48("99") ? "" : (stryCov_9fa48("99"), 'production')));
    }
  }
  getInputHtmlPath(): string {
    if (stryMutAct_9fa48("100")) {
      {}
    } else {
      stryCov_9fa48("100");
      // In production, HTML file is copied to dist/renderer directory
      // __dirname is dist/config
      return path.join(__dirname, stryMutAct_9fa48("101") ? "" : (stryCov_9fa48("101"), '..'), stryMutAct_9fa48("102") ? "" : (stryCov_9fa48("102"), 'renderer'), stryMutAct_9fa48("103") ? "" : (stryCov_9fa48("103"), 'input.html'));
    }
  }
}
export default new AppConfigClass();