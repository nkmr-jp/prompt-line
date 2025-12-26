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
import { app, globalShortcut, Tray, Menu, nativeImage, shell } from 'electron';
import fs from 'fs';
import path from 'path';

// Optimized macOS configuration for performance and IMK error prevention
if (stryMutAct_9fa48("1202") ? process.platform !== 'darwin' : stryMutAct_9fa48("1201") ? false : stryMutAct_9fa48("1200") ? true : (stryCov_9fa48("1200", "1201", "1202"), process.platform === (stryMutAct_9fa48("1203") ? "" : (stryCov_9fa48("1203"), 'darwin')))) {
  if (stryMutAct_9fa48("1204")) {
    {}
  } else {
    stryCov_9fa48("1204");
    app.commandLine.appendSwitch(stryMutAct_9fa48("1205") ? "" : (stryCov_9fa48("1205"), 'disable-features'), stryMutAct_9fa48("1206") ? "" : (stryCov_9fa48("1206"), 'HardwareMediaKeyHandling'));

    // Security warnings: enabled in all environments for better security
    // Note: Security warnings help identify potential security issues
    // Explicitly enable security warnings in all environments
    process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = stryMutAct_9fa48("1207") ? "" : (stryCov_9fa48("1207"), 'false');
    process.env.ELECTRON_ENABLE_LOGGING = stryMutAct_9fa48("1208") ? "" : (stryCov_9fa48("1208"), 'false');
    process.noDeprecation = stryMutAct_9fa48("1209") ? false : (stryCov_9fa48("1209"), true);
  }
}
import config from './config/app-config';
import WindowManager from './managers/window';
import HistoryManager from './managers/history-manager';
import DraftManager from './managers/draft-manager';
import DirectoryManager from './managers/directory-manager';
import SettingsManager from './managers/settings-manager';
import IPCHandlers from './handlers/ipc-handlers';
import { codeSearchHandler } from './handlers/code-search-handler';
import { logger, ensureDir, detectCurrentDirectoryWithFiles } from './utils/utils';
import { LIMITS } from './constants';
import type { WindowData } from './types';
class PromptLineApp {
  private windowManager: WindowManager | null = null;
  private historyManager: HistoryManager | null = null;
  private draftManager: DraftManager | null = null;
  private directoryManager: DirectoryManager | null = null;
  private settingsManager: SettingsManager | null = null;
  private ipcHandlers: IPCHandlers | null = null;
  private tray: Tray | null = null;
  private isInitialized = stryMutAct_9fa48("1210") ? true : (stryCov_9fa48("1210"), false);
  async initialize(): Promise<void> {
    if (stryMutAct_9fa48("1211")) {
      {}
    } else {
      stryCov_9fa48("1211");
      try {
        if (stryMutAct_9fa48("1212")) {
          {}
        } else {
          stryCov_9fa48("1212");
          logger.info(stryMutAct_9fa48("1213") ? "" : (stryCov_9fa48("1213"), 'Initializing Prompt Line...'));
          await ensureDir(config.paths.userDataDir);
          await ensureDir(config.paths.imagesDir);
          logger.info(stryMutAct_9fa48("1214") ? "" : (stryCov_9fa48("1214"), 'Data directories ensured at:'), config.paths.userDataDir);
          this.windowManager = new WindowManager();
          this.draftManager = new DraftManager();
          this.directoryManager = new DirectoryManager();
          this.settingsManager = new SettingsManager();
          await this.windowManager.initialize();
          await this.draftManager.initialize();
          await this.directoryManager.initialize();
          await this.settingsManager.init();
          const userSettings = this.settingsManager.getSettings();

          // 無制限履歴機能を使用（LRUキャッシュ付き最適化版）
          logger.info(stryMutAct_9fa48("1215") ? "" : (stryCov_9fa48("1215"), 'Using HistoryManager (unlimited history with LRU caching)'));
          this.historyManager = new HistoryManager();
          await this.historyManager.initialize();
          this.windowManager.updateWindowSettings(userSettings.window);
          // Only update file search settings if the feature is enabled
          const fileSearchSettings = this.settingsManager.getFileSearchSettings();
          if (stryMutAct_9fa48("1217") ? false : stryMutAct_9fa48("1216") ? true : (stryCov_9fa48("1216", "1217"), fileSearchSettings)) {
            if (stryMutAct_9fa48("1218")) {
              {}
            } else {
              stryCov_9fa48("1218");
              this.windowManager.updateFileSearchSettings(fileSearchSettings);
            }
          }
          this.windowManager.setDirectoryManager(this.directoryManager);
          this.ipcHandlers = new IPCHandlers(this.windowManager, this.historyManager, this.draftManager, this.directoryManager, this.settingsManager);

          // Register code search handlers
          codeSearchHandler.setSettingsManager(this.settingsManager);
          codeSearchHandler.register();

          // Note: Window is now pre-created during WindowManager initialization
          this.registerShortcuts();
          this.createTray();
          this.setupAppEventListeners();
          if (stryMutAct_9fa48("1221") ? config.platform.isMac || app.dock : stryMutAct_9fa48("1220") ? false : stryMutAct_9fa48("1219") ? true : (stryCov_9fa48("1219", "1220", "1221"), config.platform.isMac && app.dock)) {
            if (stryMutAct_9fa48("1222")) {
              {}
            } else {
              stryCov_9fa48("1222");
              app.dock.hide();
            }
          }
          this.isInitialized = stryMutAct_9fa48("1223") ? false : (stryCov_9fa48("1223"), true);
          const historyStats = this.historyManager.getHistoryStats();
          const settings = this.settingsManager.getSettings();
          logger.info(stryMutAct_9fa48("1224") ? "" : (stryCov_9fa48("1224"), 'Prompt Line initialized successfully'), stryMutAct_9fa48("1225") ? {} : (stryCov_9fa48("1225"), {
            historyItems: historyStats.totalItems,
            hasDraft: this.draftManager.hasDraft(),
            platform: process.platform
          }));
          console.log(stryMutAct_9fa48("1226") ? "" : (stryCov_9fa48("1226"), '\n=== Prompt Line ==='));
          console.log(stryMutAct_9fa48("1227") ? `` : (stryCov_9fa48("1227"), `Shortcut: ${settings.shortcuts.main}`));
          console.log(stryMutAct_9fa48("1228") ? "" : (stryCov_9fa48("1228"), 'Usage: Enter text and press Cmd+Enter to paste'));
          console.log(stryMutAct_9fa48("1229") ? `` : (stryCov_9fa48("1229"), `History: ${historyStats.totalItems} items loaded`));
          console.log(stryMutAct_9fa48("1230") ? "" : (stryCov_9fa48("1230"), 'Exit: Ctrl+C\n'));
        }
      } catch (error) {
        if (stryMutAct_9fa48("1231")) {
          {}
        } else {
          stryCov_9fa48("1231");
          logger.error(stryMutAct_9fa48("1232") ? "" : (stryCov_9fa48("1232"), 'Failed to initialize application:'), error);
          throw error;
        }
      }
    }
  }

  /**
   * Test directory detection feature on startup (for debugging)
   */
  private async testDirectoryDetection(): Promise<void> {
    if (stryMutAct_9fa48("1233")) {
      {}
    } else {
      stryCov_9fa48("1233");
      try {
        if (stryMutAct_9fa48("1234")) {
          {}
        } else {
          stryCov_9fa48("1234");
          logger.debug(stryMutAct_9fa48("1235") ? "" : (stryCov_9fa48("1235"), 'Testing directory detection feature...'));
          const startTime = performance.now();
          const result = await detectCurrentDirectoryWithFiles();
          const duration = stryMutAct_9fa48("1236") ? performance.now() + startTime : (stryCov_9fa48("1236"), performance.now() - startTime);
          if (stryMutAct_9fa48("1238") ? false : stryMutAct_9fa48("1237") ? true : (stryCov_9fa48("1237", "1238"), result.error)) {
            if (stryMutAct_9fa48("1239")) {
              {}
            } else {
              stryCov_9fa48("1239");
              logger.debug(stryMutAct_9fa48("1240") ? "" : (stryCov_9fa48("1240"), 'Directory detection result (error):'), stryMutAct_9fa48("1241") ? {} : (stryCov_9fa48("1241"), {
                error: result.error,
                appName: result.appName,
                bundleId: result.bundleId,
                duration: stryMutAct_9fa48("1242") ? `` : (stryCov_9fa48("1242"), `${duration.toFixed(2)}ms`)
              }));
            }
          } else {
            if (stryMutAct_9fa48("1243")) {
              {}
            } else {
              stryCov_9fa48("1243");
              logger.debug(stryMutAct_9fa48("1244") ? "" : (stryCov_9fa48("1244"), 'Directory detection result (success):'), stryMutAct_9fa48("1245") ? {} : (stryCov_9fa48("1245"), {
                directory: result.directory,
                fileCount: result.fileCount,
                method: result.method,
                tty: result.tty,
                pid: result.pid,
                idePid: result.idePid,
                appName: result.appName,
                bundleId: result.bundleId,
                duration: stryMutAct_9fa48("1246") ? `` : (stryCov_9fa48("1246"), `${duration.toFixed(2)}ms`)
              }));

              // Log first 5 files as sample
              if (stryMutAct_9fa48("1249") ? result.files || result.files.length > 0 : stryMutAct_9fa48("1248") ? false : stryMutAct_9fa48("1247") ? true : (stryCov_9fa48("1247", "1248", "1249"), result.files && (stryMutAct_9fa48("1252") ? result.files.length <= 0 : stryMutAct_9fa48("1251") ? result.files.length >= 0 : stryMutAct_9fa48("1250") ? true : (stryCov_9fa48("1250", "1251", "1252"), result.files.length > 0)))) {
                if (stryMutAct_9fa48("1253")) {
                  {}
                } else {
                  stryCov_9fa48("1253");
                  const sampleFiles = stryMutAct_9fa48("1254") ? result.files.map(f => ({
                    name: f.name,
                    isDirectory: f.isDirectory
                  })) : (stryCov_9fa48("1254"), result.files.slice(0, 5).map(stryMutAct_9fa48("1255") ? () => undefined : (stryCov_9fa48("1255"), f => stryMutAct_9fa48("1256") ? {} : (stryCov_9fa48("1256"), {
                    name: f.name,
                    isDirectory: f.isDirectory
                  }))));
                  logger.debug(stryMutAct_9fa48("1257") ? "" : (stryCov_9fa48("1257"), 'Sample files:'), sampleFiles);
                }
              }
            }
          }
        }
      } catch (error) {
        if (stryMutAct_9fa48("1258")) {
          {}
        } else {
          stryCov_9fa48("1258");
          logger.warn(stryMutAct_9fa48("1259") ? "" : (stryCov_9fa48("1259"), 'Directory detection test failed:'), error);
        }
      }
    }
  }
  private registerShortcuts(): void {
    if (stryMutAct_9fa48("1260")) {
      {}
    } else {
      stryCov_9fa48("1260");
      try {
        if (stryMutAct_9fa48("1261")) {
          {}
        } else {
          stryCov_9fa48("1261");
          const settings = stryMutAct_9fa48("1262") ? this.settingsManager.getSettings() : (stryCov_9fa48("1262"), this.settingsManager?.getSettings());
          const mainShortcut = stryMutAct_9fa48("1265") ? settings?.shortcuts.main && config.shortcuts.main : stryMutAct_9fa48("1264") ? false : stryMutAct_9fa48("1263") ? true : (stryCov_9fa48("1263", "1264", "1265"), (stryMutAct_9fa48("1266") ? settings.shortcuts.main : (stryCov_9fa48("1266"), settings?.shortcuts.main)) || config.shortcuts.main);
          const mainRegistered = globalShortcut.register(mainShortcut, async () => {
            if (stryMutAct_9fa48("1267")) {
              {}
            } else {
              stryCov_9fa48("1267");
              await this.showInputWindow();
            }
          });
          if (stryMutAct_9fa48("1269") ? false : stryMutAct_9fa48("1268") ? true : (stryCov_9fa48("1268", "1269"), mainRegistered)) {
            if (stryMutAct_9fa48("1270")) {
              {}
            } else {
              stryCov_9fa48("1270");
              logger.info(stryMutAct_9fa48("1271") ? "" : (stryCov_9fa48("1271"), 'Global shortcut registered:'), mainShortcut);
            }
          } else {
            if (stryMutAct_9fa48("1272")) {
              {}
            } else {
              stryCov_9fa48("1272");
              logger.error(stryMutAct_9fa48("1273") ? "" : (stryCov_9fa48("1273"), 'Failed to register global shortcut:'), mainShortcut);
              throw new Error(stryMutAct_9fa48("1274") ? `` : (stryCov_9fa48("1274"), `Failed to register shortcut: ${mainShortcut}`));
            }
          }
        }
      } catch (error) {
        if (stryMutAct_9fa48("1275")) {
          {}
        } else {
          stryCov_9fa48("1275");
          logger.error(stryMutAct_9fa48("1276") ? "" : (stryCov_9fa48("1276"), 'Error registering shortcuts:'), error);
          throw error;
        }
      }
    }
  }
  private async openSettingsFile(): Promise<void> {
    if (stryMutAct_9fa48("1277")) {
      {}
    } else {
      stryCov_9fa48("1277");
      try {
        if (stryMutAct_9fa48("1278")) {
          {}
        } else {
          stryCov_9fa48("1278");
          if (stryMutAct_9fa48("1281") ? false : stryMutAct_9fa48("1280") ? true : stryMutAct_9fa48("1279") ? this.settingsManager : (stryCov_9fa48("1279", "1280", "1281"), !this.settingsManager)) {
            if (stryMutAct_9fa48("1282")) {
              {}
            } else {
              stryCov_9fa48("1282");
              logger.warn(stryMutAct_9fa48("1283") ? "" : (stryCov_9fa48("1283"), 'Settings manager not initialized'));
              return;
            }
          }
          const settingsFilePath = this.settingsManager.getSettingsFilePath();
          logger.info(stryMutAct_9fa48("1284") ? "" : (stryCov_9fa48("1284"), 'Opening settings file:'), settingsFilePath);
          await shell.openPath(settingsFilePath);
        }
      } catch (error) {
        if (stryMutAct_9fa48("1285")) {
          {}
        } else {
          stryCov_9fa48("1285");
          logger.error(stryMutAct_9fa48("1286") ? "" : (stryCov_9fa48("1286"), 'Failed to open settings file:'), error);
        }
      }
    }
  }
  private createTray(): void {
    if (stryMutAct_9fa48("1287")) {
      {}
    } else {
      stryCov_9fa48("1287");
      try {
        if (stryMutAct_9fa48("1288")) {
          {}
        } else {
          stryCov_9fa48("1288");
          // Create icon from multiple resolutions for better display quality
          const iconPath22 = path.join(__dirname, stryMutAct_9fa48("1289") ? "" : (stryCov_9fa48("1289"), '..'), stryMutAct_9fa48("1290") ? "" : (stryCov_9fa48("1290"), 'assets'), stryMutAct_9fa48("1291") ? "" : (stryCov_9fa48("1291"), 'icon-tray-22.png'));
          const iconPath44 = path.join(__dirname, stryMutAct_9fa48("1292") ? "" : (stryCov_9fa48("1292"), '..'), stryMutAct_9fa48("1293") ? "" : (stryCov_9fa48("1293"), 'assets'), stryMutAct_9fa48("1294") ? "" : (stryCov_9fa48("1294"), 'icon-tray-44.png'));
          const iconPath88 = path.join(__dirname, stryMutAct_9fa48("1295") ? "" : (stryCov_9fa48("1295"), '..'), stryMutAct_9fa48("1296") ? "" : (stryCov_9fa48("1296"), 'assets'), stryMutAct_9fa48("1297") ? "" : (stryCov_9fa48("1297"), 'icon-tray-88.png'));

          // Create empty image and add representations
          const icon = nativeImage.createEmpty();

          // Check if files exist and add representations
          if (stryMutAct_9fa48("1299") ? false : stryMutAct_9fa48("1298") ? true : (stryCov_9fa48("1298", "1299"), fs.existsSync(iconPath22))) {
            if (stryMutAct_9fa48("1300")) {
              {}
            } else {
              stryCov_9fa48("1300");
              icon.addRepresentation(stryMutAct_9fa48("1301") ? {} : (stryCov_9fa48("1301"), {
                scaleFactor: 1.0,
                width: 22,
                height: 22,
                buffer: fs.readFileSync(iconPath22)
              }));
            }
          }
          if (stryMutAct_9fa48("1303") ? false : stryMutAct_9fa48("1302") ? true : (stryCov_9fa48("1302", "1303"), fs.existsSync(iconPath44))) {
            if (stryMutAct_9fa48("1304")) {
              {}
            } else {
              stryCov_9fa48("1304");
              icon.addRepresentation(stryMutAct_9fa48("1305") ? {} : (stryCov_9fa48("1305"), {
                scaleFactor: 2.0,
                width: 44,
                height: 44,
                buffer: fs.readFileSync(iconPath44)
              }));
            }
          }
          if (stryMutAct_9fa48("1307") ? false : stryMutAct_9fa48("1306") ? true : (stryCov_9fa48("1306", "1307"), fs.existsSync(iconPath88))) {
            if (stryMutAct_9fa48("1308")) {
              {}
            } else {
              stryCov_9fa48("1308");
              icon.addRepresentation(stryMutAct_9fa48("1309") ? {} : (stryCov_9fa48("1309"), {
                scaleFactor: 4.0,
                width: 88,
                height: 88,
                buffer: fs.readFileSync(iconPath88)
              }));
            }
          }
          icon.setTemplateImage(stryMutAct_9fa48("1310") ? false : (stryCov_9fa48("1310"), true)); // Make it a template image for proper macOS menu bar appearance
          this.tray = new Tray(icon);
          const contextMenu = Menu.buildFromTemplate(stryMutAct_9fa48("1311") ? [] : (stryCov_9fa48("1311"), [stryMutAct_9fa48("1312") ? {} : (stryCov_9fa48("1312"), {
            label: stryMutAct_9fa48("1313") ? "" : (stryCov_9fa48("1313"), 'Show Prompt Line'),
            click: async () => {
              if (stryMutAct_9fa48("1314")) {
                {}
              } else {
                stryCov_9fa48("1314");
                await this.showInputWindow();
              }
            }
          }), stryMutAct_9fa48("1315") ? {} : (stryCov_9fa48("1315"), {
            label: stryMutAct_9fa48("1316") ? "" : (stryCov_9fa48("1316"), 'Hide Window'),
            click: async () => {
              if (stryMutAct_9fa48("1317")) {
                {}
              } else {
                stryCov_9fa48("1317");
                await this.hideInputWindow();
              }
            }
          }), stryMutAct_9fa48("1318") ? {} : (stryCov_9fa48("1318"), {
            type: stryMutAct_9fa48("1319") ? "" : (stryCov_9fa48("1319"), 'separator')
          }), stryMutAct_9fa48("1320") ? {} : (stryCov_9fa48("1320"), {
            label: stryMutAct_9fa48("1321") ? "" : (stryCov_9fa48("1321"), 'Settings'),
            click: async () => {
              if (stryMutAct_9fa48("1322")) {
                {}
              } else {
                stryCov_9fa48("1322");
                await this.openSettingsFile();
              }
            }
          }), stryMutAct_9fa48("1323") ? {} : (stryCov_9fa48("1323"), {
            type: stryMutAct_9fa48("1324") ? "" : (stryCov_9fa48("1324"), 'separator')
          }), stryMutAct_9fa48("1325") ? {} : (stryCov_9fa48("1325"), {
            label: stryMutAct_9fa48("1326") ? `` : (stryCov_9fa48("1326"), `Version ${config.app.version}`),
            enabled: stryMutAct_9fa48("1327") ? true : (stryCov_9fa48("1327"), false)
          }), stryMutAct_9fa48("1328") ? {} : (stryCov_9fa48("1328"), {
            label: stryMutAct_9fa48("1329") ? "" : (stryCov_9fa48("1329"), 'Release Notes'),
            click: () => {
              if (stryMutAct_9fa48("1330")) {
                {}
              } else {
                stryCov_9fa48("1330");
                shell.openExternal(stryMutAct_9fa48("1331") ? "" : (stryCov_9fa48("1331"), 'https://github.com/nkmr-jp/prompt-line/blob/main/CHANGELOG.md'));
              }
            }
          }), stryMutAct_9fa48("1332") ? {} : (stryCov_9fa48("1332"), {
            type: stryMutAct_9fa48("1333") ? "" : (stryCov_9fa48("1333"), 'separator')
          }), stryMutAct_9fa48("1334") ? {} : (stryCov_9fa48("1334"), {
            label: stryMutAct_9fa48("1335") ? "" : (stryCov_9fa48("1335"), 'Quit Prompt Line'),
            click: () => {
              if (stryMutAct_9fa48("1336")) {
                {}
              } else {
                stryCov_9fa48("1336");
                this.quitApp();
              }
            }
          })]));
          this.tray.setContextMenu(contextMenu);
          const settings = stryMutAct_9fa48("1337") ? this.settingsManager.getSettings() : (stryCov_9fa48("1337"), this.settingsManager?.getSettings());
          const shortcut = stryMutAct_9fa48("1340") ? settings?.shortcuts.main && config.shortcuts.main : stryMutAct_9fa48("1339") ? false : stryMutAct_9fa48("1338") ? true : (stryCov_9fa48("1338", "1339", "1340"), (stryMutAct_9fa48("1341") ? settings.shortcuts.main : (stryCov_9fa48("1341"), settings?.shortcuts.main)) || config.shortcuts.main);
          this.tray.setToolTip((stryMutAct_9fa48("1342") ? "" : (stryCov_9fa48("1342"), 'Prompt Line - Press ')) + shortcut + (stryMutAct_9fa48("1343") ? "" : (stryCov_9fa48("1343"), ' to open')));
          this.tray.on(stryMutAct_9fa48("1344") ? "" : (stryCov_9fa48("1344"), 'double-click'), async () => {
            if (stryMutAct_9fa48("1345")) {
              {}
            } else {
              stryCov_9fa48("1345");
              await this.showInputWindow();
            }
          });
          logger.info(stryMutAct_9fa48("1346") ? "" : (stryCov_9fa48("1346"), 'System tray created successfully'));
        }
      } catch (error) {
        if (stryMutAct_9fa48("1347")) {
          {}
        } else {
          stryCov_9fa48("1347");
          logger.error(stryMutAct_9fa48("1348") ? "" : (stryCov_9fa48("1348"), 'Failed to create system tray:'), error);
          throw error;
        }
      }
    }
  }
  private quitApp(): void {
    if (stryMutAct_9fa48("1349")) {
      {}
    } else {
      stryCov_9fa48("1349");
      logger.info(stryMutAct_9fa48("1350") ? "" : (stryCov_9fa48("1350"), 'Quit requested from tray menu'));
      app.quit();
    }
  }
  private setupAppEventListeners(): void {
    if (stryMutAct_9fa48("1351")) {
      {}
    } else {
      stryCov_9fa48("1351");
      app.on(stryMutAct_9fa48("1352") ? "" : (stryCov_9fa48("1352"), 'will-quit'), event => {
        if (stryMutAct_9fa48("1353")) {
          {}
        } else {
          stryCov_9fa48("1353");
          event.preventDefault();
          this.cleanup().finally(() => {
            if (stryMutAct_9fa48("1354")) {
              {}
            } else {
              stryCov_9fa48("1354");
              app.exit(0);
            }
          });
        }
      });
      app.on(stryMutAct_9fa48("1355") ? "" : (stryCov_9fa48("1355"), 'window-all-closed'), () => {
        if (stryMutAct_9fa48("1356")) {
          {}
        } else {
          stryCov_9fa48("1356");
          logger.debug(stryMutAct_9fa48("1357") ? "" : (stryCov_9fa48("1357"), 'All windows closed, keeping app running in background'));
        }
      });
      app.on(stryMutAct_9fa48("1358") ? "" : (stryCov_9fa48("1358"), 'activate'), async () => {
        if (stryMutAct_9fa48("1359")) {
          {}
        } else {
          stryCov_9fa48("1359");
          if (stryMutAct_9fa48("1361") ? false : stryMutAct_9fa48("1360") ? true : (stryCov_9fa48("1360", "1361"), config.platform.isMac)) {
            if (stryMutAct_9fa48("1362")) {
              {}
            } else {
              stryCov_9fa48("1362");
              await this.showInputWindow();
            }
          }
        }
      });
      app.on(stryMutAct_9fa48("1363") ? "" : (stryCov_9fa48("1363"), 'before-quit'), async _event => {
        if (stryMutAct_9fa48("1364")) {
          {}
        } else {
          stryCov_9fa48("1364");
          logger.info(stryMutAct_9fa48("1365") ? "" : (stryCov_9fa48("1365"), 'Application is about to quit'));
          const savePromises: Promise<unknown>[] = stryMutAct_9fa48("1366") ? ["Stryker was here"] : (stryCov_9fa48("1366"), []);
          if (stryMutAct_9fa48("1369") ? this.draftManager || this.draftManager.hasDraft() : stryMutAct_9fa48("1368") ? false : stryMutAct_9fa48("1367") ? true : (stryCov_9fa48("1367", "1368", "1369"), this.draftManager && this.draftManager.hasDraft())) {
            if (stryMutAct_9fa48("1370")) {
              {}
            } else {
              stryCov_9fa48("1370");
              savePromises.push(this.draftManager.saveDraftImmediately(this.draftManager.getCurrentDraft()));
            }
          }
          if (stryMutAct_9fa48("1372") ? false : stryMutAct_9fa48("1371") ? true : (stryCov_9fa48("1371", "1372"), this.historyManager)) {
            if (stryMutAct_9fa48("1373")) {
              {}
            } else {
              stryCov_9fa48("1373");
              savePromises.push(this.historyManager.flushPendingSaves());
            }
          }
          try {
            if (stryMutAct_9fa48("1374")) {
              {}
            } else {
              stryCov_9fa48("1374");
              await Promise.allSettled(savePromises);
              logger.info(stryMutAct_9fa48("1375") ? "" : (stryCov_9fa48("1375"), 'Critical data saved before quit'));
            }
          } catch (error) {
            if (stryMutAct_9fa48("1376")) {
              {}
            } else {
              stryCov_9fa48("1376");
              logger.error(stryMutAct_9fa48("1377") ? "" : (stryCov_9fa48("1377"), 'Error saving critical data before quit:'), error);
            }
          }
        }
      });
    }
  }
  async showInputWindow(): Promise<void> {
    if (stryMutAct_9fa48("1378")) {
      {}
    } else {
      stryCov_9fa48("1378");
      try {
        if (stryMutAct_9fa48("1379")) {
          {}
        } else {
          stryCov_9fa48("1379");
          if (stryMutAct_9fa48("1382") ? (!this.isInitialized || !this.windowManager || !this.historyManager || !this.draftManager) && !this.settingsManager : stryMutAct_9fa48("1381") ? false : stryMutAct_9fa48("1380") ? true : (stryCov_9fa48("1380", "1381", "1382"), (stryMutAct_9fa48("1384") ? (!this.isInitialized || !this.windowManager || !this.historyManager) && !this.draftManager : stryMutAct_9fa48("1383") ? false : (stryCov_9fa48("1383", "1384"), (stryMutAct_9fa48("1386") ? (!this.isInitialized || !this.windowManager) && !this.historyManager : stryMutAct_9fa48("1385") ? false : (stryCov_9fa48("1385", "1386"), (stryMutAct_9fa48("1388") ? !this.isInitialized && !this.windowManager : stryMutAct_9fa48("1387") ? false : (stryCov_9fa48("1387", "1388"), (stryMutAct_9fa48("1389") ? this.isInitialized : (stryCov_9fa48("1389"), !this.isInitialized)) || (stryMutAct_9fa48("1390") ? this.windowManager : (stryCov_9fa48("1390"), !this.windowManager)))) || (stryMutAct_9fa48("1391") ? this.historyManager : (stryCov_9fa48("1391"), !this.historyManager)))) || (stryMutAct_9fa48("1392") ? this.draftManager : (stryCov_9fa48("1392"), !this.draftManager)))) || (stryMutAct_9fa48("1393") ? this.settingsManager : (stryCov_9fa48("1393"), !this.settingsManager)))) {
            if (stryMutAct_9fa48("1394")) {
              {}
            } else {
              stryCov_9fa48("1394");
              logger.warn(stryMutAct_9fa48("1395") ? "" : (stryCov_9fa48("1395"), 'App not initialized, cannot show window'));
              return;
            }
          }
          const draft = this.draftManager.getCurrentDraft();
          const settings = this.settingsManager.getSettings();
          // Use getHistoryForSearch for larger search scope (5000 items instead of 200)
          const history = await this.historyManager.getHistoryForSearch(LIMITS.MAX_SEARCH_ITEMS);
          logger.debug(stryMutAct_9fa48("1396") ? "" : (stryCov_9fa48("1396"), 'Settings from settingsManager:'), stryMutAct_9fa48("1397") ? {} : (stryCov_9fa48("1397"), {
            hasFileSearch: stryMutAct_9fa48("1398") ? !settings.fileSearch : (stryCov_9fa48("1398"), !(stryMutAct_9fa48("1399") ? settings.fileSearch : (stryCov_9fa48("1399"), !settings.fileSearch))),
            fileSearch: settings.fileSearch
          }));
          const windowData: WindowData = stryMutAct_9fa48("1400") ? {} : (stryCov_9fa48("1400"), {
            history,
            draft: stryMutAct_9fa48("1403") ? draft && null : stryMutAct_9fa48("1402") ? false : stryMutAct_9fa48("1401") ? true : (stryCov_9fa48("1401", "1402", "1403"), draft || null),
            settings
          });
          await this.windowManager.showInputWindow(windowData);
          logger.debug(stryMutAct_9fa48("1404") ? "" : (stryCov_9fa48("1404"), 'Input window shown with data'), stryMutAct_9fa48("1405") ? {} : (stryCov_9fa48("1405"), {
            historyItems: stryMutAct_9fa48("1408") ? windowData.history?.length && 0 : stryMutAct_9fa48("1407") ? false : stryMutAct_9fa48("1406") ? true : (stryCov_9fa48("1406", "1407", "1408"), (stryMutAct_9fa48("1409") ? windowData.history.length : (stryCov_9fa48("1409"), windowData.history?.length)) || 0),
            hasDraft: stryMutAct_9fa48("1410") ? !windowData.draft : (stryCov_9fa48("1410"), !(stryMutAct_9fa48("1411") ? windowData.draft : (stryCov_9fa48("1411"), !windowData.draft)))
          }));

          // Debug: Test directory detection when editor is shown
          this.testDirectoryDetection();
        }
      } catch (error) {
        if (stryMutAct_9fa48("1412")) {
          {}
        } else {
          stryCov_9fa48("1412");
          logger.error(stryMutAct_9fa48("1413") ? "" : (stryCov_9fa48("1413"), 'Failed to show input window:'), error);
        }
      }
    }
  }
  async hideInputWindow(): Promise<void> {
    if (stryMutAct_9fa48("1414")) {
      {}
    } else {
      stryCov_9fa48("1414");
      try {
        if (stryMutAct_9fa48("1415")) {
          {}
        } else {
          stryCov_9fa48("1415");
          if (stryMutAct_9fa48("1417") ? false : stryMutAct_9fa48("1416") ? true : (stryCov_9fa48("1416", "1417"), this.windowManager)) {
            if (stryMutAct_9fa48("1418")) {
              {}
            } else {
              stryCov_9fa48("1418");
              await this.windowManager.hideInputWindow();
              logger.debug(stryMutAct_9fa48("1419") ? "" : (stryCov_9fa48("1419"), 'Input window hidden'));
            }
          }
        }
      } catch (error) {
        if (stryMutAct_9fa48("1420")) {
          {}
        } else {
          stryCov_9fa48("1420");
          logger.error(stryMutAct_9fa48("1421") ? "" : (stryCov_9fa48("1421"), 'Failed to hide input window:'), error);
        }
      }
    }
  }
  private async cleanup(): Promise<void> {
    if (stryMutAct_9fa48("1422")) {
      {}
    } else {
      stryCov_9fa48("1422");
      try {
        if (stryMutAct_9fa48("1423")) {
          {}
        } else {
          stryCov_9fa48("1423");
          logger.info(stryMutAct_9fa48("1424") ? "" : (stryCov_9fa48("1424"), 'Cleaning up application resources...'));
          const cleanupPromises: Promise<unknown>[] = stryMutAct_9fa48("1425") ? ["Stryker was here"] : (stryCov_9fa48("1425"), []);
          globalShortcut.unregisterAll();
          if (stryMutAct_9fa48("1427") ? false : stryMutAct_9fa48("1426") ? true : (stryCov_9fa48("1426", "1427"), this.tray)) {
            if (stryMutAct_9fa48("1428")) {
              {}
            } else {
              stryCov_9fa48("1428");
              this.tray.destroy();
              this.tray = null;
              logger.debug(stryMutAct_9fa48("1429") ? "" : (stryCov_9fa48("1429"), 'System tray destroyed'));
            }
          }
          if (stryMutAct_9fa48("1431") ? false : stryMutAct_9fa48("1430") ? true : (stryCov_9fa48("1430", "1431"), this.ipcHandlers)) {
            if (stryMutAct_9fa48("1432")) {
              {}
            } else {
              stryCov_9fa48("1432");
              cleanupPromises.push(Promise.resolve(this.ipcHandlers.removeAllHandlers()));
            }
          }
          if (stryMutAct_9fa48("1434") ? false : stryMutAct_9fa48("1433") ? true : (stryCov_9fa48("1433", "1434"), this.draftManager)) {
            if (stryMutAct_9fa48("1435")) {
              {}
            } else {
              stryCov_9fa48("1435");
              cleanupPromises.push(this.draftManager.destroy());
            }
          }
          if (stryMutAct_9fa48("1437") ? false : stryMutAct_9fa48("1436") ? true : (stryCov_9fa48("1436", "1437"), this.historyManager)) {
            if (stryMutAct_9fa48("1438")) {
              {}
            } else {
              stryCov_9fa48("1438");
              cleanupPromises.push(this.historyManager.destroy());
            }
          }
          if (stryMutAct_9fa48("1440") ? false : stryMutAct_9fa48("1439") ? true : (stryCov_9fa48("1439", "1440"), this.windowManager)) {
            if (stryMutAct_9fa48("1441")) {
              {}
            } else {
              stryCov_9fa48("1441");
              cleanupPromises.push(Promise.resolve(this.windowManager.destroy()));
            }
          }
          await Promise.allSettled(cleanupPromises);
          logger.info(stryMutAct_9fa48("1442") ? "" : (stryCov_9fa48("1442"), 'Application cleanup completed (optimized)'));
        }
      } catch (error) {
        if (stryMutAct_9fa48("1443")) {
          {}
        } else {
          stryCov_9fa48("1443");
          logger.error(stryMutAct_9fa48("1444") ? "" : (stryCov_9fa48("1444"), 'Error during cleanup:'), error);
        }
      }
    }
  }
  async restart(): Promise<void> {
    if (stryMutAct_9fa48("1445")) {
      {}
    } else {
      stryCov_9fa48("1445");
      try {
        if (stryMutAct_9fa48("1446")) {
          {}
        } else {
          stryCov_9fa48("1446");
          logger.info(stryMutAct_9fa48("1447") ? "" : (stryCov_9fa48("1447"), 'Restarting application...'));
          await this.cleanup();
          await this.initialize();
          logger.info(stryMutAct_9fa48("1448") ? "" : (stryCov_9fa48("1448"), 'Application restarted successfully'));
        }
      } catch (error) {
        if (stryMutAct_9fa48("1449")) {
          {}
        } else {
          stryCov_9fa48("1449");
          logger.error(stryMutAct_9fa48("1450") ? "" : (stryCov_9fa48("1450"), 'Failed to restart application:'), error);
          throw error;
        }
      }
    }
  }
  isReady(): boolean {
    if (stryMutAct_9fa48("1451")) {
      {}
    } else {
      stryCov_9fa48("1451");
      return stryMutAct_9fa48("1454") ? this.isInitialized || app.isReady() : stryMutAct_9fa48("1453") ? false : stryMutAct_9fa48("1452") ? true : (stryCov_9fa48("1452", "1453", "1454"), this.isInitialized && app.isReady());
    }
  }
}
const promptLineApp = new PromptLineApp();
app.whenReady().then(async () => {
  if (stryMutAct_9fa48("1455")) {
    {}
  } else {
    stryCov_9fa48("1455");
    try {
      if (stryMutAct_9fa48("1456")) {
        {}
      } else {
        stryCov_9fa48("1456");
        await promptLineApp.initialize();
      }
    } catch (error) {
      if (stryMutAct_9fa48("1457")) {
        {}
      } else {
        stryCov_9fa48("1457");
        logger.error(stryMutAct_9fa48("1458") ? "" : (stryCov_9fa48("1458"), 'Application failed to start:'), error);
        app.quit();
      }
    }
  }
});
const gotTheLock = app.requestSingleInstanceLock();
if (stryMutAct_9fa48("1461") ? false : stryMutAct_9fa48("1460") ? true : stryMutAct_9fa48("1459") ? gotTheLock : (stryCov_9fa48("1459", "1460", "1461"), !gotTheLock)) {
  if (stryMutAct_9fa48("1462")) {
    {}
  } else {
    stryCov_9fa48("1462");
    logger.warn(stryMutAct_9fa48("1463") ? "" : (stryCov_9fa48("1463"), 'Another instance is already running, quitting...'));
    app.quit();
  }
} else {
  if (stryMutAct_9fa48("1464")) {
    {}
  } else {
    stryCov_9fa48("1464");
    app.on(stryMutAct_9fa48("1465") ? "" : (stryCov_9fa48("1465"), 'second-instance'), async () => {
      if (stryMutAct_9fa48("1466")) {
        {}
      } else {
        stryCov_9fa48("1466");
        logger.info(stryMutAct_9fa48("1467") ? "" : (stryCov_9fa48("1467"), 'Second instance detected, showing main window'));
        await promptLineApp.showInputWindow();
      }
    });
  }
}
export default promptLineApp;