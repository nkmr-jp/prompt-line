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
import { BrowserWindow } from 'electron';
import config from '../../config/app-config';
import { getCurrentApp, logger } from '../../utils/utils';
import DesktopSpaceManager from '../desktop-space-manager';
import FileCacheManager from '../file-cache-manager';
import type DirectoryManager from '../directory-manager';
import type { AppInfo, WindowData, StartupPosition, FileSearchSettings } from '../../types';

// Import extracted modules
import WindowPositionCalculator from './position-calculator';
import NativeToolExecutor from './native-tool-executor';
import DirectoryDetector from './directory-detector';

/**
 * WindowManager coordinates window lifecycle and positioning
 *
 * This is the main coordinator that composes:
 * - WindowPositionCalculator: Calculates window positions for different modes
 * - NativeToolExecutor: Executes native macOS tools for app/text field detection
 * - DirectoryDetector: Handles directory detection and file search
 *
 * Responsibilities:
 * - Window lifecycle management (create, show, hide, destroy)
 * - Window positioning with multiple modes (active-text-field, active-window-center, cursor, center)
 * - Desktop space change detection and window recreation
 * - Settings and configuration management
 * - Event listener setup
 */
class WindowManager {
  private inputWindow: BrowserWindow | null = null;
  private customWindowSettings: {
    position?: StartupPosition;
    width?: number;
    height?: number;
  } = {};
  private desktopSpaceManager: DesktopSpaceManager | null = null;
  private lastSpaceSignature: string | null = null;

  // Composed sub-managers
  private positionCalculator: WindowPositionCalculator;
  private nativeToolExecutor: NativeToolExecutor;
  private directoryDetector: DirectoryDetector;
  constructor() {
    if (stryMutAct_9fa48("4477")) {
      {}
    } else {
      stryCov_9fa48("4477");
      // Initialize sub-managers
      this.positionCalculator = new WindowPositionCalculator();
      this.nativeToolExecutor = new NativeToolExecutor();
      this.directoryDetector = new DirectoryDetector(null); // FileCacheManager will be set in initialize
    }
  }
  async initialize(): Promise<void> {
    if (stryMutAct_9fa48("4478")) {
      {}
    } else {
      stryCov_9fa48("4478");
      try {
        if (stryMutAct_9fa48("4479")) {
          {}
        } else {
          stryCov_9fa48("4479");
          logger.info(stryMutAct_9fa48("4480") ? "" : (stryCov_9fa48("4480"), 'Initializing WindowManager...'));

          // Initialize desktop space manager
          this.desktopSpaceManager = new DesktopSpaceManager();
          await this.desktopSpaceManager.initialize();

          // Initialize file cache manager
          const fileCacheManager = new FileCacheManager();
          await fileCacheManager.initialize();

          // Pass FileCacheManager to DirectoryDetector
          this.directoryDetector = new DirectoryDetector(fileCacheManager);

          // Pre-create window for faster first-time startup
          this.createInputWindow();
          logger.debug(stryMutAct_9fa48("4481") ? "" : (stryCov_9fa48("4481"), 'Pre-created input window for faster startup'));
          logger.info(stryMutAct_9fa48("4482") ? "" : (stryCov_9fa48("4482"), 'WindowManager initialized successfully'));
        }
      } catch (error) {
        if (stryMutAct_9fa48("4483")) {
          {}
        } else {
          stryCov_9fa48("4483");
          logger.error(stryMutAct_9fa48("4484") ? "" : (stryCov_9fa48("4484"), 'Failed to initialize WindowManager:'), error);
          throw error;
        }
      }
    }
  }

  /**
   * Create a new input window with configuration
   * @returns Created BrowserWindow instance
   */
  createInputWindow(): BrowserWindow {
    if (stryMutAct_9fa48("4485")) {
      {}
    } else {
      stryCov_9fa48("4485");
      try {
        if (stryMutAct_9fa48("4486")) {
          {}
        } else {
          stryCov_9fa48("4486");
          this.inputWindow = new BrowserWindow(stryMutAct_9fa48("4487") ? {} : (stryCov_9fa48("4487"), {
            ...config.window,
            width: stryMutAct_9fa48("4490") ? this.customWindowSettings.width && config.window.width : stryMutAct_9fa48("4489") ? false : stryMutAct_9fa48("4488") ? true : (stryCov_9fa48("4488", "4489", "4490"), this.customWindowSettings.width || config.window.width),
            height: stryMutAct_9fa48("4493") ? this.customWindowSettings.height && config.window.height : stryMutAct_9fa48("4492") ? false : stryMutAct_9fa48("4491") ? true : (stryCov_9fa48("4491", "4492", "4493"), this.customWindowSettings.height || config.window.height),
            show: stryMutAct_9fa48("4494") ? true : (stryCov_9fa48("4494"), false)
          }));
          this.inputWindow.loadFile(config.getInputHtmlPath());
          this.inputWindow.webContents.on(stryMutAct_9fa48("4495") ? "" : (stryCov_9fa48("4495"), 'context-menu'), e => {
            if (stryMutAct_9fa48("4496")) {
              {}
            } else {
              stryCov_9fa48("4496");
              e.preventDefault();
            }
          });
          logger.debug(stryMutAct_9fa48("4497") ? "" : (stryCov_9fa48("4497"), 'Input window created successfully'));
          return this.inputWindow;
        }
      } catch (error) {
        if (stryMutAct_9fa48("4498")) {
          {}
        } else {
          stryCov_9fa48("4498");
          logger.error(stryMutAct_9fa48("4499") ? "" : (stryCov_9fa48("4499"), 'Failed to create input window:'), error);
          throw error;
        }
      }
    }
  }

  /**
   * Show input window with positioning and directory detection
   * Coordinates all sub-managers for window display
   */
  async showInputWindow(data: WindowData = {}): Promise<void> {
    if (stryMutAct_9fa48("4500")) {
      {}
    } else {
      stryCov_9fa48("4500");
      const startTime = performance.now();
      logger.debug(stryMutAct_9fa48("4501") ? "" : (stryCov_9fa48("4501"), '🕐 Starting showInputWindow()'));
      try {
        if (stryMutAct_9fa48("4502")) {
          {}
        } else {
          stryCov_9fa48("4502");
          // Update settings from data
          const settingsStartTime = performance.now();
          if (stryMutAct_9fa48("4505") ? data.settings.window : stryMutAct_9fa48("4504") ? false : stryMutAct_9fa48("4503") ? true : (stryCov_9fa48("4503", "4504", "4505"), data.settings?.window)) {
            if (stryMutAct_9fa48("4506")) {
              {}
            } else {
              stryCov_9fa48("4506");
              this.updateWindowSettings(data.settings.window);
            }
          }
          if (stryMutAct_9fa48("4509") ? data.settings.fileSearch : stryMutAct_9fa48("4508") ? false : stryMutAct_9fa48("4507") ? true : (stryCov_9fa48("4507", "4508", "4509"), data.settings?.fileSearch)) {
            if (stryMutAct_9fa48("4510")) {
              {}
            } else {
              stryCov_9fa48("4510");
              this.directoryDetector.updateFileSearchSettings(data.settings.fileSearch as FileSearchSettings);
            }
          }
          logger.debug(stryMutAct_9fa48("4511") ? `` : (stryCov_9fa48("4511"), `⏱️  Window settings update: ${(stryMutAct_9fa48("4512") ? performance.now() + settingsStartTime : (stryCov_9fa48("4512"), performance.now() - settingsStartTime)).toFixed(2)}ms`));

          // Get current app and space information in parallel
          const appSpaceStartTime = performance.now();
          const [currentAppResult, currentSpaceResult] = await Promise.allSettled(stryMutAct_9fa48("4513") ? [] : (stryCov_9fa48("4513"), [getCurrentApp(), (stryMutAct_9fa48("4516") ? this.desktopSpaceManager || this.desktopSpaceManager.isReady() : stryMutAct_9fa48("4515") ? false : stryMutAct_9fa48("4514") ? true : (stryCov_9fa48("4514", "4515", "4516"), this.desktopSpaceManager && this.desktopSpaceManager.isReady())) ? this.desktopSpaceManager.getCurrentSpaceInfo(null) : Promise.resolve(null)]));
          logger.debug(stryMutAct_9fa48("4517") ? `` : (stryCov_9fa48("4517"), `⏱️  App + Space detection (parallel): ${(stryMutAct_9fa48("4518") ? performance.now() + appSpaceStartTime : (stryCov_9fa48("4518"), performance.now() - appSpaceStartTime)).toFixed(2)}ms`));

          // Process current app result
          let previousApp: AppInfo | string | null = null;
          if (stryMutAct_9fa48("4521") ? currentAppResult.status !== 'fulfilled' : stryMutAct_9fa48("4520") ? false : stryMutAct_9fa48("4519") ? true : (stryCov_9fa48("4519", "4520", "4521"), currentAppResult.status === (stryMutAct_9fa48("4522") ? "" : (stryCov_9fa48("4522"), 'fulfilled')))) {
            if (stryMutAct_9fa48("4523")) {
              {}
            } else {
              stryCov_9fa48("4523");
              previousApp = currentAppResult.value;
              this.nativeToolExecutor.setPreviousApp(previousApp);
              this.directoryDetector.updatePreviousApp(previousApp);
            }
          } else {
            if (stryMutAct_9fa48("4524")) {
              {}
            } else {
              stryCov_9fa48("4524");
              logger.error(stryMutAct_9fa48("4525") ? "" : (stryCov_9fa48("4525"), 'Failed to get current app:'), currentAppResult.reason);
            }
          }

          // Process space information and determine if window recreation is needed
          const spaceProcessStartTime = performance.now();
          let currentSpaceInfo = null;
          let needsWindowRecreation = stryMutAct_9fa48("4526") ? true : (stryCov_9fa48("4526"), false);
          if (stryMutAct_9fa48("4529") ? currentSpaceResult.status === 'fulfilled' || currentSpaceResult.value : stryMutAct_9fa48("4528") ? false : stryMutAct_9fa48("4527") ? true : (stryCov_9fa48("4527", "4528", "4529"), (stryMutAct_9fa48("4531") ? currentSpaceResult.status !== 'fulfilled' : stryMutAct_9fa48("4530") ? true : (stryCov_9fa48("4530", "4531"), currentSpaceResult.status === (stryMutAct_9fa48("4532") ? "" : (stryCov_9fa48("4532"), 'fulfilled')))) && currentSpaceResult.value)) {
            if (stryMutAct_9fa48("4533")) {
              {}
            } else {
              stryCov_9fa48("4533");
              currentSpaceInfo = currentSpaceResult.value;

              // Update space info with actual app information
              if (stryMutAct_9fa48("4536") ? previousApp || this.desktopSpaceManager : stryMutAct_9fa48("4535") ? false : stryMutAct_9fa48("4534") ? true : (stryCov_9fa48("4534", "4535", "4536"), previousApp && this.desktopSpaceManager)) {
                if (stryMutAct_9fa48("4537")) {
                  {}
                } else {
                  stryCov_9fa48("4537");
                  try {
                    if (stryMutAct_9fa48("4538")) {
                      {}
                    } else {
                      stryCov_9fa48("4538");
                      const spaceUpdateStartTime = performance.now();
                      currentSpaceInfo = await this.desktopSpaceManager.getCurrentSpaceInfo(previousApp);
                      logger.debug(stryMutAct_9fa48("4539") ? `` : (stryCov_9fa48("4539"), `⏱️  Space info update with app: ${(stryMutAct_9fa48("4540") ? performance.now() + spaceUpdateStartTime : (stryCov_9fa48("4540"), performance.now() - spaceUpdateStartTime)).toFixed(2)}ms`));
                    }
                  } catch (error) {
                    if (stryMutAct_9fa48("4541")) {
                      {}
                    } else {
                      stryCov_9fa48("4541");
                      logger.debug(stryMutAct_9fa48("4542") ? "" : (stryCov_9fa48("4542"), 'Failed to update space info with app:'), error);
                    }
                  }
                }
              }
              logger.debug(stryMutAct_9fa48("4543") ? "" : (stryCov_9fa48("4543"), 'Current space info:'), stryMutAct_9fa48("4544") ? {} : (stryCov_9fa48("4544"), {
                signature: currentSpaceInfo.signature,
                appCount: currentSpaceInfo.appCount,
                method: currentSpaceInfo.method
              }));

              // Check if desktop space has changed
              if (stryMutAct_9fa48("4547") ? this.lastSpaceSignature === currentSpaceInfo.signature : stryMutAct_9fa48("4546") ? false : stryMutAct_9fa48("4545") ? true : (stryCov_9fa48("4545", "4546", "4547"), this.lastSpaceSignature !== currentSpaceInfo.signature)) {
                if (stryMutAct_9fa48("4548")) {
                  {}
                } else {
                  stryCov_9fa48("4548");
                  needsWindowRecreation = stryMutAct_9fa48("4549") ? false : (stryCov_9fa48("4549"), true);
                  logger.debug(stryMutAct_9fa48("4550") ? "" : (stryCov_9fa48("4550"), 'Desktop space changed, window recreation needed'), stryMutAct_9fa48("4551") ? {} : (stryCov_9fa48("4551"), {
                    lastSignature: this.lastSpaceSignature,
                    currentSignature: currentSpaceInfo.signature
                  }));
                }
              }
              this.lastSpaceSignature = currentSpaceInfo.signature;
            }
          } else {
            if (stryMutAct_9fa48("4552")) {
              {}
            } else {
              stryCov_9fa48("4552");
              // If space detection is not available, use simple logic
              needsWindowRecreation = stryMutAct_9fa48("4555") ? !this.inputWindow && this.inputWindow.isDestroyed() : stryMutAct_9fa48("4554") ? false : stryMutAct_9fa48("4553") ? true : (stryCov_9fa48("4553", "4554", "4555"), (stryMutAct_9fa48("4556") ? this.inputWindow : (stryCov_9fa48("4556"), !this.inputWindow)) || this.inputWindow.isDestroyed());
              if (stryMutAct_9fa48("4559") ? currentSpaceResult.status !== 'rejected' : stryMutAct_9fa48("4558") ? false : stryMutAct_9fa48("4557") ? true : (stryCov_9fa48("4557", "4558", "4559"), currentSpaceResult.status === (stryMutAct_9fa48("4560") ? "" : (stryCov_9fa48("4560"), 'rejected')))) {
                if (stryMutAct_9fa48("4561")) {
                  {}
                } else {
                  stryCov_9fa48("4561");
                  logger.warn(stryMutAct_9fa48("4562") ? "" : (stryCov_9fa48("4562"), 'Failed to get current space info:'), currentSpaceResult.reason);
                }
              }
            }
          }
          logger.debug(stryMutAct_9fa48("4563") ? `` : (stryCov_9fa48("4563"), `⏱️  Space processing: ${(stryMutAct_9fa48("4564") ? performance.now() + spaceProcessStartTime : (stryCov_9fa48("4564"), performance.now() - spaceProcessStartTime)).toFixed(2)}ms`));

          // Handle window creation/reuse based on space changes
          const windowMgmtStartTime = performance.now();
          if (stryMutAct_9fa48("4567") ? needsWindowRecreation && this.inputWindow || !this.inputWindow.isDestroyed() : stryMutAct_9fa48("4566") ? false : stryMutAct_9fa48("4565") ? true : (stryCov_9fa48("4565", "4566", "4567"), (stryMutAct_9fa48("4569") ? needsWindowRecreation || this.inputWindow : stryMutAct_9fa48("4568") ? true : (stryCov_9fa48("4568", "4569"), needsWindowRecreation && this.inputWindow)) && (stryMutAct_9fa48("4570") ? this.inputWindow.isDestroyed() : (stryCov_9fa48("4570"), !this.inputWindow.isDestroyed())))) {
            if (stryMutAct_9fa48("4571")) {
              {}
            } else {
              stryCov_9fa48("4571");
              const destroyStartTime = performance.now();
              this.inputWindow.destroy();
              this.inputWindow = null;
              logger.debug(stryMutAct_9fa48("4572") ? `` : (stryCov_9fa48("4572"), `⏱️  Window destruction: ${(stryMutAct_9fa48("4573") ? performance.now() + destroyStartTime : (stryCov_9fa48("4573"), performance.now() - destroyStartTime)).toFixed(2)}ms`));
              logger.debug(stryMutAct_9fa48("4574") ? "" : (stryCov_9fa48("4574"), 'Destroyed existing window due to desktop space change'));
            }
          }
          if (stryMutAct_9fa48("4577") ? !this.inputWindow && this.inputWindow.isDestroyed() : stryMutAct_9fa48("4576") ? false : stryMutAct_9fa48("4575") ? true : (stryCov_9fa48("4575", "4576", "4577"), (stryMutAct_9fa48("4578") ? this.inputWindow : (stryCov_9fa48("4578"), !this.inputWindow)) || this.inputWindow.isDestroyed())) {
            if (stryMutAct_9fa48("4579")) {
              {}
            } else {
              stryCov_9fa48("4579");
              const createStartTime = performance.now();
              this.createInputWindow();
              logger.debug(stryMutAct_9fa48("4580") ? `` : (stryCov_9fa48("4580"), `⏱️  Window creation: ${(stryMutAct_9fa48("4581") ? performance.now() + createStartTime : (stryCov_9fa48("4581"), performance.now() - createStartTime)).toFixed(2)}ms`));
              const positionStartTime = performance.now();
              await this.positionWindow();
              logger.debug(stryMutAct_9fa48("4582") ? `` : (stryCov_9fa48("4582"), `⏱️  Window positioning: ${(stryMutAct_9fa48("4583") ? performance.now() + positionStartTime : (stryCov_9fa48("4583"), performance.now() - positionStartTime)).toFixed(2)}ms`));
              logger.debug(stryMutAct_9fa48("4584") ? "" : (stryCov_9fa48("4584"), 'New window created on current desktop space'));
            }
          } else {
            if (stryMutAct_9fa48("4585")) {
              {}
            } else {
              stryCov_9fa48("4585");
              // Reuse existing window but reposition if needed
              const currentPosition = stryMutAct_9fa48("4588") ? this.customWindowSettings.position && 'active-window-center' : stryMutAct_9fa48("4587") ? false : stryMutAct_9fa48("4586") ? true : (stryCov_9fa48("4586", "4587", "4588"), this.customWindowSettings.position || (stryMutAct_9fa48("4589") ? "" : (stryCov_9fa48("4589"), 'active-window-center')));
              if (stryMutAct_9fa48("4592") ? (currentPosition === 'active-window-center' || currentPosition === 'active-text-field' || currentPosition === 'cursor') && data.settings?.window?.position && data.settings.window.position !== currentPosition : stryMutAct_9fa48("4591") ? false : stryMutAct_9fa48("4590") ? true : (stryCov_9fa48("4590", "4591", "4592"), (stryMutAct_9fa48("4594") ? (currentPosition === 'active-window-center' || currentPosition === 'active-text-field') && currentPosition === 'cursor' : stryMutAct_9fa48("4593") ? false : (stryCov_9fa48("4593", "4594"), (stryMutAct_9fa48("4596") ? currentPosition === 'active-window-center' && currentPosition === 'active-text-field' : stryMutAct_9fa48("4595") ? false : (stryCov_9fa48("4595", "4596"), (stryMutAct_9fa48("4598") ? currentPosition !== 'active-window-center' : stryMutAct_9fa48("4597") ? false : (stryCov_9fa48("4597", "4598"), currentPosition === (stryMutAct_9fa48("4599") ? "" : (stryCov_9fa48("4599"), 'active-window-center')))) || (stryMutAct_9fa48("4601") ? currentPosition !== 'active-text-field' : stryMutAct_9fa48("4600") ? false : (stryCov_9fa48("4600", "4601"), currentPosition === (stryMutAct_9fa48("4602") ? "" : (stryCov_9fa48("4602"), 'active-text-field')))))) || (stryMutAct_9fa48("4604") ? currentPosition !== 'cursor' : stryMutAct_9fa48("4603") ? false : (stryCov_9fa48("4603", "4604"), currentPosition === (stryMutAct_9fa48("4605") ? "" : (stryCov_9fa48("4605"), 'cursor')))))) || (stryMutAct_9fa48("4607") ? data.settings?.window?.position || data.settings.window.position !== currentPosition : stryMutAct_9fa48("4606") ? false : (stryCov_9fa48("4606", "4607"), (stryMutAct_9fa48("4609") ? data.settings.window?.position : stryMutAct_9fa48("4608") ? data.settings?.window.position : (stryCov_9fa48("4608", "4609"), data.settings?.window?.position)) && (stryMutAct_9fa48("4611") ? data.settings.window.position === currentPosition : stryMutAct_9fa48("4610") ? true : (stryCov_9fa48("4610", "4611"), data.settings.window.position !== currentPosition)))))) {
                if (stryMutAct_9fa48("4612")) {
                  {}
                } else {
                  stryCov_9fa48("4612");
                  logger.debug(stryMutAct_9fa48("4613") ? "" : (stryCov_9fa48("4613"), 'Repositioning existing window for position:'), currentPosition);
                  const repositionStartTime = performance.now();
                  await this.positionWindow();
                  logger.debug(stryMutAct_9fa48("4614") ? `` : (stryCov_9fa48("4614"), `⏱️  Window repositioning: ${(stryMutAct_9fa48("4615") ? performance.now() + repositionStartTime : (stryCov_9fa48("4615"), performance.now() - repositionStartTime)).toFixed(2)}ms`));
                }
              }
              logger.debug(stryMutAct_9fa48("4616") ? "" : (stryCov_9fa48("4616"), 'Reusing existing window on same desktop space'));
            }
          }
          logger.debug(stryMutAct_9fa48("4617") ? `` : (stryCov_9fa48("4617"), `⏱️  Window management total: ${(stryMutAct_9fa48("4618") ? performance.now() + windowMgmtStartTime : (stryCov_9fa48("4618"), performance.now() - windowMgmtStartTime)).toFixed(2)}ms`));

          // Prepare window data with directory information
          const windowData = await this.prepareWindowData(data, previousApp, currentSpaceInfo);

          // Display window with prepared data
          await this.displayWindow(windowData);
          logger.debug(stryMutAct_9fa48("4619") ? `` : (stryCov_9fa48("4619"), `🏁 Total showInputWindow time: ${(stryMutAct_9fa48("4620") ? performance.now() + startTime : (stryCov_9fa48("4620"), performance.now() - startTime)).toFixed(2)}ms`));
          logger.debug(stryMutAct_9fa48("4621") ? "" : (stryCov_9fa48("4621"), 'Input window shown'), stryMutAct_9fa48("4622") ? {} : (stryCov_9fa48("4622"), {
            sourceApp: previousApp
          }));

          // Background directory detection (non-blocking) - runs AFTER window is shown
          if (stryMutAct_9fa48("4624") ? false : stryMutAct_9fa48("4623") ? true : (stryCov_9fa48("4623", "4624"), this.isFileSearchEnabled())) {
            if (stryMutAct_9fa48("4625")) {
              {}
            } else {
              stryCov_9fa48("4625");
              setImmediate(() => {
                if (stryMutAct_9fa48("4626")) {
                  {}
                } else {
                  stryCov_9fa48("4626");
                  this.directoryDetector.executeBackgroundDirectoryDetection(this.inputWindow).catch(error => {
                    if (stryMutAct_9fa48("4627")) {
                      {}
                    } else {
                      stryCov_9fa48("4627");
                      logger.warn(stryMutAct_9fa48("4628") ? "" : (stryCov_9fa48("4628"), 'Background directory detection error:'), error);
                    }
                  });
                }
              });
            }
          }
        }
      } catch (error) {
        if (stryMutAct_9fa48("4629")) {
          {}
        } else {
          stryCov_9fa48("4629");
          logger.error(stryMutAct_9fa48("4630") ? "" : (stryCov_9fa48("4630"), 'Failed to show input window:'), error);
          logger.error(stryMutAct_9fa48("4631") ? `` : (stryCov_9fa48("4631"), `❌ Failed after ${(stryMutAct_9fa48("4632") ? performance.now() + startTime : (stryCov_9fa48("4632"), performance.now() - startTime)).toFixed(2)}ms`));
          throw error;
        }
      }
    }
  }

  /**
   * Prepare window data with directory information
   * @private
   */
  private async prepareWindowData(data: WindowData, previousApp: AppInfo | string | null, currentSpaceInfo: any): Promise<WindowData> {
    if (stryMutAct_9fa48("4633")) {
      {}
    } else {
      stryCov_9fa48("4633");
      // Get saved directory from DirectoryManager for fallback feature
      const savedDirectory = this.directoryDetector.getSavedDirectory();
      this.directoryDetector.updateSavedDirectory(savedDirectory);
      const windowData: WindowData = stryMutAct_9fa48("4634") ? {} : (stryCov_9fa48("4634"), {
        sourceApp: previousApp,
        currentSpaceInfo,
        fileSearchEnabled: this.isFileSearchEnabled(),
        ...data
      });

      // Only load directory data and check fd when fileSearch is enabled
      if (stryMutAct_9fa48("4636") ? false : stryMutAct_9fa48("4635") ? true : (stryCov_9fa48("4635", "4636"), this.isFileSearchEnabled())) {
        if (stryMutAct_9fa48("4637")) {
          {}
        } else {
          stryCov_9fa48("4637");
          // Check fd command availability
          await this.directoryDetector.checkFdCommandAvailability();

          // Load cached file data for immediate file search availability
          const cachedData = await this.directoryDetector.loadCachedFilesForWindow();
          if (stryMutAct_9fa48("4639") ? false : stryMutAct_9fa48("4638") ? true : (stryCov_9fa48("4638", "4639"), cachedData)) {
            if (stryMutAct_9fa48("4640")) {
              {}
            } else {
              stryCov_9fa48("4640");
              windowData.directoryData = cachedData;
              logger.debug(stryMutAct_9fa48("4641") ? "" : (stryCov_9fa48("4641"), 'Loaded cached directory data'), stryMutAct_9fa48("4642") ? {} : (stryCov_9fa48("4642"), {
                directory: cachedData.directory,
                fileCount: cachedData.fileCount,
                fromCache: cachedData.fromCache
              }));
            }
          } else if (stryMutAct_9fa48("4644") ? false : stryMutAct_9fa48("4643") ? true : (stryCov_9fa48("4643", "4644"), savedDirectory)) {
            if (stryMutAct_9fa48("4645")) {
              {}
            } else {
              stryCov_9fa48("4645");
              // Fallback to draft directory with empty files if no cache
              const isRootDirectory = this.directoryDetector.isFileSearchDisabledDirectory(savedDirectory);
              windowData.directoryData = stryMutAct_9fa48("4646") ? {} : (stryCov_9fa48("4646"), {
                success: stryMutAct_9fa48("4647") ? false : (stryCov_9fa48("4647"), true),
                directory: savedDirectory,
                files: stryMutAct_9fa48("4648") ? ["Stryker was here"] : (stryCov_9fa48("4648"), []),
                fileCount: 0,
                partial: stryMutAct_9fa48("4649") ? true : (stryCov_9fa48("4649"), false),
                searchMode: stryMutAct_9fa48("4650") ? "" : (stryCov_9fa48("4650"), 'recursive'),
                fromDraft: stryMutAct_9fa48("4651") ? false : (stryCov_9fa48("4651"), true),
                ...(isRootDirectory ? stryMutAct_9fa48("4652") ? {} : (stryCov_9fa48("4652"), {
                  filesDisabled: stryMutAct_9fa48("4653") ? false : (stryCov_9fa48("4653"), true),
                  filesDisabledReason: stryMutAct_9fa48("4654") ? "" : (stryCov_9fa48("4654"), 'File search is disabled for root directory')
                }) : {})
              });
            }
          }

          // Add hint message if fd command is not available
          if (stryMutAct_9fa48("4657") ? false : stryMutAct_9fa48("4656") ? true : stryMutAct_9fa48("4655") ? this.directoryDetector.isFdCommandAvailable() : (stryCov_9fa48("4655", "4656", "4657"), !this.directoryDetector.isFdCommandAvailable())) {
            if (stryMutAct_9fa48("4658")) {
              {}
            } else {
              stryCov_9fa48("4658");
              if (stryMutAct_9fa48("4661") ? false : stryMutAct_9fa48("4660") ? true : stryMutAct_9fa48("4659") ? windowData.directoryData : (stryCov_9fa48("4659", "4660", "4661"), !windowData.directoryData)) {
                if (stryMutAct_9fa48("4662")) {
                  {}
                } else {
                  stryCov_9fa48("4662");
                  windowData.directoryData = stryMutAct_9fa48("4663") ? {} : (stryCov_9fa48("4663"), {
                    success: stryMutAct_9fa48("4664") ? true : (stryCov_9fa48("4664"), false)
                  });
                }
              }
              windowData.directoryData.hint = stryMutAct_9fa48("4665") ? "" : (stryCov_9fa48("4665"), 'Install fd for file search: brew install fd');
              logger.debug(stryMutAct_9fa48("4666") ? "" : (stryCov_9fa48("4666"), 'Added fd not available hint to directoryData'));
            }
          }
        }
      }
      return windowData;
    }
  }

  /**
   * Display window with data
   * @private
   */
  private async displayWindow(windowData: WindowData): Promise<void> {
    if (stryMutAct_9fa48("4667")) {
      {}
    } else {
      stryCov_9fa48("4667");
      const displayStartTime = performance.now();
      if (stryMutAct_9fa48("4669") ? false : stryMutAct_9fa48("4668") ? true : (stryCov_9fa48("4668", "4669"), this.inputWindow!.isVisible())) {
        if (stryMutAct_9fa48("4670")) {
          {}
        } else {
          stryCov_9fa48("4670");
          // Window is already visible, just update data and focus
          const updateStartTime = performance.now();
          this.inputWindow!.webContents.send(stryMutAct_9fa48("4671") ? "" : (stryCov_9fa48("4671"), 'window-shown'), windowData);
          this.inputWindow!.focus();
          logger.debug(stryMutAct_9fa48("4672") ? `` : (stryCov_9fa48("4672"), `⏱️  Window data update + focus: ${(stryMutAct_9fa48("4673") ? performance.now() + updateStartTime : (stryCov_9fa48("4673"), performance.now() - updateStartTime)).toFixed(2)}ms`));
          logger.debug(stryMutAct_9fa48("4674") ? "" : (stryCov_9fa48("4674"), 'Updated existing visible window'));
        }
      } else if (stryMutAct_9fa48("4676") ? false : stryMutAct_9fa48("4675") ? true : (stryCov_9fa48("4675", "4676"), this.inputWindow!.webContents.isLoading())) {
        if (stryMutAct_9fa48("4677")) {
          {}
        } else {
          stryCov_9fa48("4677");
          // Window is loading, wait for completion
          logger.debug(stryMutAct_9fa48("4678") ? "" : (stryCov_9fa48("4678"), '⏱️  Window waiting for load completion...'));
          this.inputWindow!.webContents.once(stryMutAct_9fa48("4679") ? "" : (stryCov_9fa48("4679"), 'did-finish-load'), () => {
            if (stryMutAct_9fa48("4680")) {
              {}
            } else {
              stryCov_9fa48("4680");
              const loadCompleteStartTime = performance.now();
              this.inputWindow!.webContents.send(stryMutAct_9fa48("4681") ? "" : (stryCov_9fa48("4681"), 'window-shown'), windowData);
              this.inputWindow!.show();
              this.inputWindow!.focus();
              logger.debug(stryMutAct_9fa48("4682") ? `` : (stryCov_9fa48("4682"), `⏱️  Window load completion handling: ${(stryMutAct_9fa48("4683") ? performance.now() + loadCompleteStartTime : (stryCov_9fa48("4683"), performance.now() - loadCompleteStartTime)).toFixed(2)}ms`));
            }
          });
        }
      } else {
        if (stryMutAct_9fa48("4684")) {
          {}
        } else {
          stryCov_9fa48("4684");
          // Window is ready, show it
          const showStartTime = performance.now();
          this.inputWindow!.webContents.send(stryMutAct_9fa48("4685") ? "" : (stryCov_9fa48("4685"), 'window-shown'), windowData);
          this.inputWindow!.show();
          this.inputWindow!.focus();
          logger.debug(stryMutAct_9fa48("4686") ? `` : (stryCov_9fa48("4686"), `⏱️  Window show + focus: ${(stryMutAct_9fa48("4687") ? performance.now() + showStartTime : (stryCov_9fa48("4687"), performance.now() - showStartTime)).toFixed(2)}ms`));
        }
      }
      logger.debug(stryMutAct_9fa48("4688") ? `` : (stryCov_9fa48("4688"), `⏱️  Display handling: ${(stryMutAct_9fa48("4689") ? performance.now() + displayStartTime : (stryCov_9fa48("4689"), performance.now() - displayStartTime)).toFixed(2)}ms`));
    }
  }

  /**
   * Hide the input window
   */
  async hideInputWindow(): Promise<void> {
    if (stryMutAct_9fa48("4690")) {
      {}
    } else {
      stryCov_9fa48("4690");
      try {
        if (stryMutAct_9fa48("4691")) {
          {}
        } else {
          stryCov_9fa48("4691");
          if (stryMutAct_9fa48("4694") ? this.inputWindow || this.inputWindow.isVisible() : stryMutAct_9fa48("4693") ? false : stryMutAct_9fa48("4692") ? true : (stryCov_9fa48("4692", "4693", "4694"), this.inputWindow && this.inputWindow.isVisible())) {
            if (stryMutAct_9fa48("4695")) {
              {}
            } else {
              stryCov_9fa48("4695");
              this.inputWindow.hide();
              logger.debug(stryMutAct_9fa48("4696") ? "" : (stryCov_9fa48("4696"), 'Input window hidden'));
            }
          }
        }
      } catch (error) {
        if (stryMutAct_9fa48("4697")) {
          {}
        } else {
          stryCov_9fa48("4697");
          logger.error(stryMutAct_9fa48("4698") ? "" : (stryCov_9fa48("4698"), 'Failed to hide input window:'), error);
          throw error;
        }
      }
    }
  }

  /**
   * Focus the input window
   */
  focusWindow(): void {
    if (stryMutAct_9fa48("4699")) {
      {}
    } else {
      stryCov_9fa48("4699");
      try {
        if (stryMutAct_9fa48("4700")) {
          {}
        } else {
          stryCov_9fa48("4700");
          if (stryMutAct_9fa48("4702") ? false : stryMutAct_9fa48("4701") ? true : (stryCov_9fa48("4701", "4702"), this.inputWindow)) {
            if (stryMutAct_9fa48("4703")) {
              {}
            } else {
              stryCov_9fa48("4703");
              this.inputWindow.focus();
              logger.debug(stryMutAct_9fa48("4704") ? "" : (stryCov_9fa48("4704"), 'Input window focused'));
            }
          }
        }
      } catch (error) {
        if (stryMutAct_9fa48("4705")) {
          {}
        } else {
          stryCov_9fa48("4705");
          logger.error(stryMutAct_9fa48("4706") ? "" : (stryCov_9fa48("4706"), 'Failed to focus input window:'), error);
          throw error;
        }
      }
    }
  }

  /**
   * Position window using the position calculator
   * @private
   */
  private async positionWindow(): Promise<void> {
    if (stryMutAct_9fa48("4707")) {
      {}
    } else {
      stryCov_9fa48("4707");
      const positionStartTime = performance.now();
      logger.debug(stryMutAct_9fa48("4708") ? "" : (stryCov_9fa48("4708"), '🕐 Starting positionWindow()'));
      try {
        if (stryMutAct_9fa48("4709")) {
          {}
        } else {
          stryCov_9fa48("4709");
          if (stryMutAct_9fa48("4712") ? false : stryMutAct_9fa48("4711") ? true : stryMutAct_9fa48("4710") ? this.inputWindow : (stryCov_9fa48("4710", "4711", "4712"), !this.inputWindow)) return;
          const configStartTime = performance.now();
          const windowWidth = stryMutAct_9fa48("4715") ? this.customWindowSettings.width && config.window.width : stryMutAct_9fa48("4714") ? false : stryMutAct_9fa48("4713") ? true : (stryCov_9fa48("4713", "4714", "4715"), this.customWindowSettings.width || config.window.width);
          const windowHeight = stryMutAct_9fa48("4718") ? this.customWindowSettings.height && config.window.height : stryMutAct_9fa48("4717") ? false : stryMutAct_9fa48("4716") ? true : (stryCov_9fa48("4716", "4717", "4718"), this.customWindowSettings.height || config.window.height);
          const position = stryMutAct_9fa48("4721") ? this.customWindowSettings.position && 'active-window-center' : stryMutAct_9fa48("4720") ? false : stryMutAct_9fa48("4719") ? true : (stryCov_9fa48("4719", "4720", "4721"), this.customWindowSettings.position || (stryMutAct_9fa48("4722") ? "" : (stryCov_9fa48("4722"), 'active-window-center')));
          logger.debug(stryMutAct_9fa48("4723") ? `` : (stryCov_9fa48("4723"), `⏱️  Position config: ${(stryMutAct_9fa48("4724") ? performance.now() + configStartTime : (stryCov_9fa48("4724"), performance.now() - configStartTime)).toFixed(2)}ms`));
          const calcStartTime = performance.now();
          const {
            x,
            y
          } = await this.positionCalculator.calculateWindowPosition(position, windowWidth, windowHeight);
          logger.debug(stryMutAct_9fa48("4725") ? `` : (stryCov_9fa48("4725"), `⏱️  Position calculation: ${(stryMutAct_9fa48("4726") ? performance.now() + calcStartTime : (stryCov_9fa48("4726"), performance.now() - calcStartTime)).toFixed(2)}ms`));
          const setStartTime = performance.now();
          this.inputWindow.setPosition(Math.round(x), Math.round(y));
          logger.debug(stryMutAct_9fa48("4727") ? `` : (stryCov_9fa48("4727"), `⏱️  Position setting: ${(stryMutAct_9fa48("4728") ? performance.now() + setStartTime : (stryCov_9fa48("4728"), performance.now() - setStartTime)).toFixed(2)}ms`));
          logger.debug(stryMutAct_9fa48("4729") ? `` : (stryCov_9fa48("4729"), `🏁 Total positionWindow time: ${(stryMutAct_9fa48("4730") ? performance.now() + positionStartTime : (stryCov_9fa48("4730"), performance.now() - positionStartTime)).toFixed(2)}ms`));
          logger.debug(stryMutAct_9fa48("4731") ? "" : (stryCov_9fa48("4731"), 'Window positioned'), stryMutAct_9fa48("4732") ? {} : (stryCov_9fa48("4732"), {
            x: Math.round(x),
            y: Math.round(y),
            position
          }));
        }
      } catch (error) {
        if (stryMutAct_9fa48("4733")) {
          {}
        } else {
          stryCov_9fa48("4733");
          logger.error(stryMutAct_9fa48("4734") ? "" : (stryCov_9fa48("4734"), 'Failed to position window:'), error);
          logger.error(stryMutAct_9fa48("4735") ? `` : (stryCov_9fa48("4735"), `❌ Position failed after ${(stryMutAct_9fa48("4736") ? performance.now() + positionStartTime : (stryCov_9fa48("4736"), performance.now() - positionStartTime)).toFixed(2)}ms`));
        }
      }
    }
  }

  /**
   * Focus the previously active application
   * Delegates to NativeToolExecutor
   */
  async focusPreviousApp(): Promise<boolean> {
    if (stryMutAct_9fa48("4737")) {
      {}
    } else {
      stryCov_9fa48("4737");
      return this.nativeToolExecutor.focusPreviousApp();
    }
  }

  /**
   * Get the input window instance
   */
  getInputWindow(): BrowserWindow | null {
    if (stryMutAct_9fa48("4738")) {
      {}
    } else {
      stryCov_9fa48("4738");
      return this.inputWindow;
    }
  }

  /**
   * Get the previously active app
   */
  getPreviousApp(): AppInfo | string | null {
    if (stryMutAct_9fa48("4739")) {
      {}
    } else {
      stryCov_9fa48("4739");
      return this.nativeToolExecutor.getPreviousApp();
    }
  }

  /**
   * Set the previously active app (for testing and internal use)
   * Delegates to NativeToolExecutor
   */
  setPreviousApp(app: AppInfo | string | null): void {
    if (stryMutAct_9fa48("4740")) {
      {}
    } else {
      stryCov_9fa48("4740");
      this.nativeToolExecutor.setPreviousApp(app);
    }
  }

  /**
   * Destroy window and cleanup resources
   */
  destroy(): void {
    if (stryMutAct_9fa48("4741")) {
      {}
    } else {
      stryCov_9fa48("4741");
      try {
        if (stryMutAct_9fa48("4742")) {
          {}
        } else {
          stryCov_9fa48("4742");
          if (stryMutAct_9fa48("4744") ? false : stryMutAct_9fa48("4743") ? true : (stryCov_9fa48("4743", "4744"), this.inputWindow)) {
            if (stryMutAct_9fa48("4745")) {
              {}
            } else {
              stryCov_9fa48("4745");
              this.inputWindow.destroy();
              this.inputWindow = null;
              logger.debug(stryMutAct_9fa48("4746") ? "" : (stryCov_9fa48("4746"), 'Input window destroyed'));
            }
          }
          if (stryMutAct_9fa48("4748") ? false : stryMutAct_9fa48("4747") ? true : (stryCov_9fa48("4747", "4748"), this.desktopSpaceManager)) {
            if (stryMutAct_9fa48("4749")) {
              {}
            } else {
              stryCov_9fa48("4749");
              this.desktopSpaceManager.destroy();
              this.desktopSpaceManager = null;
              logger.debug(stryMutAct_9fa48("4750") ? "" : (stryCov_9fa48("4750"), 'Desktop space manager destroyed'));
            }
          }
        }
      } catch (error) {
        if (stryMutAct_9fa48("4751")) {
          {}
        } else {
          stryCov_9fa48("4751");
          logger.error(stryMutAct_9fa48("4752") ? "" : (stryCov_9fa48("4752"), 'Failed to destroy window manager:'), error);
        }
      }
    }
  }

  /**
   * Check if window is visible
   */
  isVisible(): boolean {
    if (stryMutAct_9fa48("4753")) {
      {}
    } else {
      stryCov_9fa48("4753");
      return this.inputWindow ? this.inputWindow.isVisible() : stryMutAct_9fa48("4754") ? true : (stryCov_9fa48("4754"), false);
    }
  }

  /**
   * Setup event listeners for window events
   */
  setupEventListeners(onBlur?: () => void, onClosed?: () => void): void {
    if (stryMutAct_9fa48("4755")) {
      {}
    } else {
      stryCov_9fa48("4755");
      if (stryMutAct_9fa48("4758") ? false : stryMutAct_9fa48("4757") ? true : stryMutAct_9fa48("4756") ? this.inputWindow : (stryCov_9fa48("4756", "4757", "4758"), !this.inputWindow)) {
        if (stryMutAct_9fa48("4759")) {
          {}
        } else {
          stryCov_9fa48("4759");
          logger.warn(stryMutAct_9fa48("4760") ? "" : (stryCov_9fa48("4760"), 'Cannot setup event listeners: no input window'));
          return;
        }
      }
      if (stryMutAct_9fa48("4762") ? false : stryMutAct_9fa48("4761") ? true : (stryCov_9fa48("4761", "4762"), onBlur)) {
        if (stryMutAct_9fa48("4763")) {
          {}
        } else {
          stryCov_9fa48("4763");
          this.inputWindow.on(stryMutAct_9fa48("4764") ? "" : (stryCov_9fa48("4764"), 'blur'), onBlur);
        }
      }
      if (stryMutAct_9fa48("4766") ? false : stryMutAct_9fa48("4765") ? true : (stryCov_9fa48("4765", "4766"), onClosed)) {
        if (stryMutAct_9fa48("4767")) {
          {}
        } else {
          stryCov_9fa48("4767");
          this.inputWindow.on(stryMutAct_9fa48("4768") ? "" : (stryCov_9fa48("4768"), 'closed'), onClosed);
        }
      }
      logger.debug(stryMutAct_9fa48("4769") ? "" : (stryCov_9fa48("4769"), 'Window event listeners set up'));
    }
  }

  /**
   * Update window settings (position, width, height)
   */
  updateWindowSettings(settings: {
    position?: StartupPosition;
    width?: number;
    height?: number;
  }): void {
    if (stryMutAct_9fa48("4770")) {
      {}
    } else {
      stryCov_9fa48("4770");
      this.customWindowSettings = stryMutAct_9fa48("4771") ? {} : (stryCov_9fa48("4771"), {
        ...this.customWindowSettings,
        ...settings
      });
      logger.debug(stryMutAct_9fa48("4772") ? "" : (stryCov_9fa48("4772"), 'Window settings updated'), settings);
    }
  }

  /**
   * Get current window settings
   */
  getWindowSettings(): {
    position?: StartupPosition;
    width?: number;
    height?: number;
  } {
    if (stryMutAct_9fa48("4773")) {
      {}
    } else {
      stryCov_9fa48("4773");
      return stryMutAct_9fa48("4774") ? {} : (stryCov_9fa48("4774"), {
        ...this.customWindowSettings
      });
    }
  }

  /**
   * Update file search settings
   * Delegates to DirectoryDetector
   */
  updateFileSearchSettings(settings: FileSearchSettings | null | undefined): void {
    if (stryMutAct_9fa48("4775")) {
      {}
    } else {
      stryCov_9fa48("4775");
      this.directoryDetector.updateFileSearchSettings(settings);
    }
  }

  /**
   * Check if file search is enabled
   * Returns true only when file search settings have been configured
   */
  isFileSearchEnabled(): boolean {
    if (stryMutAct_9fa48("4776")) {
      {}
    } else {
      stryCov_9fa48("4776");
      return this.directoryDetector.isEnabled();
    }
  }

  /**
   * Set DirectoryManager reference for directory fallback feature
   * Delegates to DirectoryDetector
   */
  setDirectoryManager(directoryManager: DirectoryManager): void {
    if (stryMutAct_9fa48("4777")) {
      {}
    } else {
      stryCov_9fa48("4777");
      this.directoryDetector.setDirectoryManager(directoryManager);
      // Update saved directory from DirectoryManager
      const savedDirectory = directoryManager.getDirectory();
      this.directoryDetector.updateSavedDirectory(savedDirectory);
      logger.debug(stryMutAct_9fa48("4778") ? "" : (stryCov_9fa48("4778"), 'DirectoryManager reference set in WindowManager'));
    }
  }
}
export default WindowManager;