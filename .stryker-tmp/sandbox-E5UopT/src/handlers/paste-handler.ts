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
import { ipcMain, clipboard, IpcMainInvokeEvent, dialog } from 'electron';
import { promises as fs } from 'fs';
import { execFile } from 'child_process';
import path from 'path';
import config from '../config/app-config';
import { logger, pasteWithNativeTool, activateAndPasteWithNativeTool, sleep, checkAccessibilityPermission, SecureErrors } from '../utils/utils';
import type WindowManager from '../managers/window';
import type DraftManager from '../managers/draft-manager';
import type DirectoryManager from '../managers/directory-manager';
import type { AppInfo, IHistoryManager } from '../types';
interface PasteResult {
  success: boolean;
  error?: string;
  warning?: string;
}

// Constants
const MAX_PASTE_TEXT_LENGTH_BYTES = stryMutAct_9fa48("773") ? 1024 / 1024 : (stryCov_9fa48("773"), 1024 * 1024); // 1MB limit for paste text

class PasteHandler {
  private windowManager: WindowManager;
  private historyManager: IHistoryManager;
  private draftManager: DraftManager;
  private directoryManager: DirectoryManager;
  constructor(windowManager: WindowManager, historyManager: IHistoryManager, draftManager: DraftManager, directoryManager: DirectoryManager) {
    if (stryMutAct_9fa48("774")) {
      {}
    } else {
      stryCov_9fa48("774");
      this.windowManager = windowManager;
      this.historyManager = historyManager;
      this.draftManager = draftManager;
      this.directoryManager = directoryManager;
    }
  }
  setupHandlers(ipcMainInstance: typeof ipcMain): void {
    if (stryMutAct_9fa48("775")) {
      {}
    } else {
      stryCov_9fa48("775");
      ipcMainInstance.handle(stryMutAct_9fa48("776") ? "" : (stryCov_9fa48("776"), 'paste-text'), this.handlePasteText.bind(this));
      ipcMainInstance.handle(stryMutAct_9fa48("777") ? "" : (stryCov_9fa48("777"), 'paste-image'), this.handlePasteImage.bind(this));
      logger.info(stryMutAct_9fa48("778") ? "" : (stryCov_9fa48("778"), 'Paste handlers set up successfully'));
    }
  }
  removeHandlers(ipcMainInstance: typeof ipcMain): void {
    if (stryMutAct_9fa48("779")) {
      {}
    } else {
      stryCov_9fa48("779");
      ipcMainInstance.removeAllListeners(stryMutAct_9fa48("780") ? "" : (stryCov_9fa48("780"), 'paste-text'));
      ipcMainInstance.removeAllListeners(stryMutAct_9fa48("781") ? "" : (stryCov_9fa48("781"), 'paste-image'));
      logger.info(stryMutAct_9fa48("782") ? "" : (stryCov_9fa48("782"), 'Paste handlers removed'));
    }
  }
  private async handlePasteText(_event: IpcMainInvokeEvent, text: string): Promise<PasteResult> {
    if (stryMutAct_9fa48("783")) {
      {}
    } else {
      stryCov_9fa48("783");
      try {
        if (stryMutAct_9fa48("784")) {
          {}
        } else {
          stryCov_9fa48("784");
          logger.info(stryMutAct_9fa48("785") ? "" : (stryCov_9fa48("785"), 'Paste text requested'), stryMutAct_9fa48("786") ? {} : (stryCov_9fa48("786"), {
            length: text.length
          }));

          // Validate input
          if (stryMutAct_9fa48("789") ? typeof text === 'string' : stryMutAct_9fa48("788") ? false : stryMutAct_9fa48("787") ? true : (stryCov_9fa48("787", "788", "789"), typeof text !== (stryMutAct_9fa48("790") ? "" : (stryCov_9fa48("790"), 'string')))) {
            if (stryMutAct_9fa48("791")) {
              {}
            } else {
              stryCov_9fa48("791");
              logger.warn(stryMutAct_9fa48("792") ? "" : (stryCov_9fa48("792"), 'Invalid input type for paste text'), stryMutAct_9fa48("793") ? {} : (stryCov_9fa48("793"), {
                type: typeof text
              }));
              return stryMutAct_9fa48("794") ? {} : (stryCov_9fa48("794"), {
                success: stryMutAct_9fa48("795") ? true : (stryCov_9fa48("795"), false),
                error: SecureErrors.INVALID_INPUT
              });
            }
          }
          if (stryMutAct_9fa48("798") ? false : stryMutAct_9fa48("797") ? true : stryMutAct_9fa48("796") ? text.trim() : (stryCov_9fa48("796", "797", "798"), !(stryMutAct_9fa48("799") ? text : (stryCov_9fa48("799"), text.trim())))) {
            if (stryMutAct_9fa48("800")) {
              {}
            } else {
              stryCov_9fa48("800");
              logger.debug(stryMutAct_9fa48("801") ? "" : (stryCov_9fa48("801"), 'Empty text provided for paste'));
              return stryMutAct_9fa48("802") ? {} : (stryCov_9fa48("802"), {
                success: stryMutAct_9fa48("803") ? true : (stryCov_9fa48("803"), false),
                error: SecureErrors.INVALID_INPUT
              });
            }
          }

          // Add reasonable length limit (1MB) to prevent DoS attacks
          // Use Buffer.byteLength for accurate byte-based limit instead of character count
          if (stryMutAct_9fa48("807") ? Buffer.byteLength(text, 'utf8') <= MAX_PASTE_TEXT_LENGTH_BYTES : stryMutAct_9fa48("806") ? Buffer.byteLength(text, 'utf8') >= MAX_PASTE_TEXT_LENGTH_BYTES : stryMutAct_9fa48("805") ? false : stryMutAct_9fa48("804") ? true : (stryCov_9fa48("804", "805", "806", "807"), Buffer.byteLength(text, stryMutAct_9fa48("808") ? "" : (stryCov_9fa48("808"), 'utf8')) > MAX_PASTE_TEXT_LENGTH_BYTES)) {
            if (stryMutAct_9fa48("809")) {
              {}
            } else {
              stryCov_9fa48("809");
              logger.warn(stryMutAct_9fa48("810") ? "" : (stryCov_9fa48("810"), 'Text size exceeds limit'), stryMutAct_9fa48("811") ? {} : (stryCov_9fa48("811"), {
                size: Buffer.byteLength(text, stryMutAct_9fa48("812") ? "" : (stryCov_9fa48("812"), 'utf8')),
                limit: MAX_PASTE_TEXT_LENGTH_BYTES
              }));
              return stryMutAct_9fa48("813") ? {} : (stryCov_9fa48("813"), {
                success: stryMutAct_9fa48("814") ? true : (stryCov_9fa48("814"), false),
                error: SecureErrors.SIZE_LIMIT_EXCEEDED
              });
            }
          }

          // Get previous app info before hiding window
          const previousApp = await this.getPreviousAppAsync();

          // Extract app name for history
          let appName: string | undefined;
          if (stryMutAct_9fa48("816") ? false : stryMutAct_9fa48("815") ? true : (stryCov_9fa48("815", "816"), previousApp)) {
            if (stryMutAct_9fa48("817")) {
              {}
            } else {
              stryCov_9fa48("817");
              if (stryMutAct_9fa48("820") ? typeof previousApp !== 'string' : stryMutAct_9fa48("819") ? false : stryMutAct_9fa48("818") ? true : (stryCov_9fa48("818", "819", "820"), typeof previousApp === (stryMutAct_9fa48("821") ? "" : (stryCov_9fa48("821"), 'string')))) {
                if (stryMutAct_9fa48("822")) {
                  {}
                } else {
                  stryCov_9fa48("822");
                  appName = previousApp;
                }
              } else if (stryMutAct_9fa48("824") ? false : stryMutAct_9fa48("823") ? true : (stryCov_9fa48("823", "824"), previousApp.name)) {
                if (stryMutAct_9fa48("825")) {
                  {}
                } else {
                  stryCov_9fa48("825");
                  appName = previousApp.name;
                }
              }
            }
          }

          // Get directory from directory manager
          const directory = stryMutAct_9fa48("828") ? this.directoryManager.getDirectory() && undefined : stryMutAct_9fa48("827") ? false : stryMutAct_9fa48("826") ? true : (stryCov_9fa48("826", "827", "828"), this.directoryManager.getDirectory() || undefined);
          await Promise.all(stryMutAct_9fa48("829") ? [] : (stryCov_9fa48("829"), [this.historyManager.addToHistory(text, appName, directory), this.draftManager.clearDraft(), this.setClipboardAsync(text)]));
          const hideWindowPromise = this.windowManager.hideInputWindow();
          await hideWindowPromise;
          await sleep(stryMutAct_9fa48("830") ? Math.min(config.timing.windowHideDelay, 5) : (stryCov_9fa48("830"), Math.max(config.timing.windowHideDelay, 5)));
          try {
            if (stryMutAct_9fa48("831")) {
              {}
            } else {
              stryCov_9fa48("831");
              if (stryMutAct_9fa48("834") ? previousApp || config.platform.isMac : stryMutAct_9fa48("833") ? false : stryMutAct_9fa48("832") ? true : (stryCov_9fa48("832", "833", "834"), previousApp && config.platform.isMac)) {
                if (stryMutAct_9fa48("835")) {
                  {}
                } else {
                  stryCov_9fa48("835");
                  await activateAndPasteWithNativeTool(previousApp);
                  logger.info(stryMutAct_9fa48("836") ? "" : (stryCov_9fa48("836"), 'Activate and paste operation completed successfully'));
                  return stryMutAct_9fa48("837") ? {} : (stryCov_9fa48("837"), {
                    success: stryMutAct_9fa48("838") ? false : (stryCov_9fa48("838"), true)
                  });
                }
              } else if (stryMutAct_9fa48("840") ? false : stryMutAct_9fa48("839") ? true : (stryCov_9fa48("839", "840"), config.platform.isMac)) {
                if (stryMutAct_9fa48("841")) {
                  {}
                } else {
                  stryCov_9fa48("841");
                  const focusSuccess = await this.windowManager.focusPreviousApp();
                  if (stryMutAct_9fa48("843") ? false : stryMutAct_9fa48("842") ? true : (stryCov_9fa48("842", "843"), focusSuccess)) {
                    if (stryMutAct_9fa48("844")) {
                      {}
                    } else {
                      stryCov_9fa48("844");
                      await sleep(config.timing.appFocusDelay);
                      await pasteWithNativeTool();
                      logger.info(stryMutAct_9fa48("845") ? "" : (stryCov_9fa48("845"), 'Paste operation completed successfully'));
                      return stryMutAct_9fa48("846") ? {} : (stryCov_9fa48("846"), {
                        success: stryMutAct_9fa48("847") ? false : (stryCov_9fa48("847"), true)
                      });
                    }
                  } else {
                    if (stryMutAct_9fa48("848")) {
                      {}
                    } else {
                      stryCov_9fa48("848");
                      await pasteWithNativeTool();
                      logger.warn(stryMutAct_9fa48("849") ? "" : (stryCov_9fa48("849"), 'Paste attempted without focus confirmation'));
                      return stryMutAct_9fa48("850") ? {} : (stryCov_9fa48("850"), {
                        success: stryMutAct_9fa48("851") ? false : (stryCov_9fa48("851"), true),
                        warning: stryMutAct_9fa48("852") ? "" : (stryCov_9fa48("852"), 'Could not focus previous application')
                      });
                    }
                  }
                }
              } else {
                if (stryMutAct_9fa48("853")) {
                  {}
                } else {
                  stryCov_9fa48("853");
                  logger.warn(stryMutAct_9fa48("854") ? "" : (stryCov_9fa48("854"), 'Auto-paste not supported on this platform'));
                  return stryMutAct_9fa48("855") ? {} : (stryCov_9fa48("855"), {
                    success: stryMutAct_9fa48("856") ? false : (stryCov_9fa48("856"), true),
                    warning: stryMutAct_9fa48("857") ? "" : (stryCov_9fa48("857"), 'Auto-paste not supported on this platform')
                  });
                }
              }
            }
          } catch (pasteError) {
            if (stryMutAct_9fa48("858")) {
              {}
            } else {
              stryCov_9fa48("858");
              const err = pasteError as Error;
              logger.error(stryMutAct_9fa48("859") ? "" : (stryCov_9fa48("859"), 'Paste operation failed:'), stryMutAct_9fa48("860") ? {} : (stryCov_9fa48("860"), {
                message: err.message,
                stack: err.stack
              }));

              // Check accessibility permission after paste failure on macOS
              if (stryMutAct_9fa48("862") ? false : stryMutAct_9fa48("861") ? true : (stryCov_9fa48("861", "862"), config.platform.isMac)) {
                if (stryMutAct_9fa48("863")) {
                  {}
                } else {
                  stryCov_9fa48("863");
                  try {
                    if (stryMutAct_9fa48("864")) {
                      {}
                    } else {
                      stryCov_9fa48("864");
                      const {
                        hasPermission,
                        bundleId
                      } = await checkAccessibilityPermission();
                      if (stryMutAct_9fa48("867") ? false : stryMutAct_9fa48("866") ? true : stryMutAct_9fa48("865") ? hasPermission : (stryCov_9fa48("865", "866", "867"), !hasPermission)) {
                        if (stryMutAct_9fa48("868")) {
                          {}
                        } else {
                          stryCov_9fa48("868");
                          logger.warn(stryMutAct_9fa48("869") ? "" : (stryCov_9fa48("869"), 'Paste failed - accessibility permission not granted'), stryMutAct_9fa48("870") ? {} : (stryCov_9fa48("870"), {
                            bundleId
                          }));
                          this.showAccessibilityWarning(bundleId);
                          return stryMutAct_9fa48("871") ? {} : (stryCov_9fa48("871"), {
                            success: stryMutAct_9fa48("872") ? true : (stryCov_9fa48("872"), false),
                            error: SecureErrors.PERMISSION_DENIED
                          });
                        }
                      }
                    }
                  } catch (accessibilityError) {
                    if (stryMutAct_9fa48("873")) {
                      {}
                    } else {
                      stryCov_9fa48("873");
                      const accErr = accessibilityError as Error;
                      logger.error(stryMutAct_9fa48("874") ? "" : (stryCov_9fa48("874"), 'Failed to check accessibility permission after paste failure:'), stryMutAct_9fa48("875") ? {} : (stryCov_9fa48("875"), {
                        message: accErr.message
                      }));
                    }
                  }
                }
              }
              return stryMutAct_9fa48("876") ? {} : (stryCov_9fa48("876"), {
                success: stryMutAct_9fa48("877") ? true : (stryCov_9fa48("877"), false),
                error: SecureErrors.OPERATION_FAILED
              });
            }
          }
        }
      } catch (error) {
        if (stryMutAct_9fa48("878")) {
          {}
        } else {
          stryCov_9fa48("878");
          const err = error as Error;
          logger.error(stryMutAct_9fa48("879") ? "" : (stryCov_9fa48("879"), 'Failed to handle paste text:'), stryMutAct_9fa48("880") ? {} : (stryCov_9fa48("880"), {
            message: err.message,
            stack: err.stack
          }));
          return stryMutAct_9fa48("881") ? {} : (stryCov_9fa48("881"), {
            success: stryMutAct_9fa48("882") ? true : (stryCov_9fa48("882"), false),
            error: SecureErrors.OPERATION_FAILED
          });
        }
      }
    }
  }
  private async handlePasteImage(_event: IpcMainInvokeEvent): Promise<{
    success: boolean;
    error?: string;
    path?: string;
  }> {
    if (stryMutAct_9fa48("883")) {
      {}
    } else {
      stryCov_9fa48("883");
      try {
        if (stryMutAct_9fa48("884")) {
          {}
        } else {
          stryCov_9fa48("884");
          logger.info(stryMutAct_9fa48("885") ? "" : (stryCov_9fa48("885"), 'Paste image requested'));
          const image = clipboard.readImage();
          if (stryMutAct_9fa48("887") ? false : stryMutAct_9fa48("886") ? true : (stryCov_9fa48("886", "887"), image.isEmpty())) {
            if (stryMutAct_9fa48("888")) {
              {}
            } else {
              stryCov_9fa48("888");
              return stryMutAct_9fa48("889") ? {} : (stryCov_9fa48("889"), {
                success: stryMutAct_9fa48("890") ? true : (stryCov_9fa48("890"), false),
                error: stryMutAct_9fa48("891") ? "" : (stryCov_9fa48("891"), 'No image in clipboard')
              });
            }
          }
          const imagesDir = config.paths.imagesDir;
          try {
            if (stryMutAct_9fa48("892")) {
              {}
            } else {
              stryCov_9fa48("892");
              // Set restrictive directory permissions (owner read/write/execute only)
              await fs.mkdir(imagesDir, stryMutAct_9fa48("893") ? {} : (stryCov_9fa48("893"), {
                recursive: stryMutAct_9fa48("894") ? false : (stryCov_9fa48("894"), true),
                mode: 0o700
              }));
            }
          } catch (error) {
            if (stryMutAct_9fa48("895")) {
              {}
            } else {
              stryCov_9fa48("895");
              logger.error(stryMutAct_9fa48("896") ? "" : (stryCov_9fa48("896"), 'Failed to create images directory:'), error);
            }
          }
          const now = new Date();
          const year = now.getFullYear();
          const month = String(stryMutAct_9fa48("897") ? now.getMonth() - 1 : (stryCov_9fa48("897"), now.getMonth() + 1)).padStart(2, stryMutAct_9fa48("898") ? "" : (stryCov_9fa48("898"), '0'));
          const day = String(now.getDate()).padStart(2, stryMutAct_9fa48("899") ? "" : (stryCov_9fa48("899"), '0'));
          const hours = String(now.getHours()).padStart(2, stryMutAct_9fa48("900") ? "" : (stryCov_9fa48("900"), '0'));
          const minutes = String(now.getMinutes()).padStart(2, stryMutAct_9fa48("901") ? "" : (stryCov_9fa48("901"), '0'));
          const seconds = String(now.getSeconds()).padStart(2, stryMutAct_9fa48("902") ? "" : (stryCov_9fa48("902"), '0'));
          const filename = stryMutAct_9fa48("903") ? `` : (stryCov_9fa48("903"), `${year}${month}${day}_${hours}${minutes}${seconds}.png`);

          // Validate filename (ensure no dangerous characters)
          const SAFE_FILENAME_REGEX = stryMutAct_9fa48("907") ? /^[^0-9_]+\.png$/ : stryMutAct_9fa48("906") ? /^[0-9_]\.png$/ : stryMutAct_9fa48("905") ? /^[0-9_]+\.png/ : stryMutAct_9fa48("904") ? /[0-9_]+\.png$/ : (stryCov_9fa48("904", "905", "906", "907"), /^[0-9_]+\.png$/);
          if (stryMutAct_9fa48("910") ? false : stryMutAct_9fa48("909") ? true : stryMutAct_9fa48("908") ? SAFE_FILENAME_REGEX.test(filename) : (stryCov_9fa48("908", "909", "910"), !SAFE_FILENAME_REGEX.test(filename))) {
            if (stryMutAct_9fa48("911")) {
              {}
            } else {
              stryCov_9fa48("911");
              logger.error(stryMutAct_9fa48("912") ? "" : (stryCov_9fa48("912"), 'Invalid filename generated'), stryMutAct_9fa48("913") ? {} : (stryCov_9fa48("913"), {
                filename
              }));
              return stryMutAct_9fa48("914") ? {} : (stryCov_9fa48("914"), {
                success: stryMutAct_9fa48("915") ? true : (stryCov_9fa48("915"), false),
                error: stryMutAct_9fa48("916") ? "" : (stryCov_9fa48("916"), 'Invalid filename')
              });
            }
          }
          const filepath = path.join(imagesDir, filename);

          // Normalize and validate path to prevent path traversal
          const normalizedPath = path.normalize(filepath);
          if (stryMutAct_9fa48("919") ? false : stryMutAct_9fa48("918") ? true : stryMutAct_9fa48("917") ? normalizedPath.startsWith(path.normalize(imagesDir)) : (stryCov_9fa48("917", "918", "919"), !(stryMutAct_9fa48("920") ? normalizedPath.endsWith(path.normalize(imagesDir)) : (stryCov_9fa48("920"), normalizedPath.startsWith(path.normalize(imagesDir)))))) {
            if (stryMutAct_9fa48("921")) {
              {}
            } else {
              stryCov_9fa48("921");
              logger.error(stryMutAct_9fa48("922") ? "" : (stryCov_9fa48("922"), 'Attempted path traversal detected - potential security threat'), stryMutAct_9fa48("923") ? {} : (stryCov_9fa48("923"), {
                filepath,
                normalizedPath,
                timestamp: Date.now(),
                source: stryMutAct_9fa48("924") ? "" : (stryCov_9fa48("924"), 'handlePasteImage')
              }));
              return stryMutAct_9fa48("925") ? {} : (stryCov_9fa48("925"), {
                success: stryMutAct_9fa48("926") ? true : (stryCov_9fa48("926"), false),
                error: stryMutAct_9fa48("927") ? "" : (stryCov_9fa48("927"), 'Invalid file path')
              });
            }
          }

          // Additional validation: ensure actual directory matches expected directory
          const expectedDir = path.normalize(imagesDir);
          const actualDir = path.dirname(normalizedPath);
          if (stryMutAct_9fa48("930") ? actualDir === expectedDir : stryMutAct_9fa48("929") ? false : stryMutAct_9fa48("928") ? true : (stryCov_9fa48("928", "929", "930"), actualDir !== expectedDir)) {
            if (stryMutAct_9fa48("931")) {
              {}
            } else {
              stryCov_9fa48("931");
              logger.error(stryMutAct_9fa48("932") ? "" : (stryCov_9fa48("932"), 'Unexpected directory in path'), stryMutAct_9fa48("933") ? {} : (stryCov_9fa48("933"), {
                expected: expectedDir,
                actual: actualDir
              }));
              return stryMutAct_9fa48("934") ? {} : (stryCov_9fa48("934"), {
                success: stryMutAct_9fa48("935") ? true : (stryCov_9fa48("935"), false),
                error: stryMutAct_9fa48("936") ? "" : (stryCov_9fa48("936"), 'Invalid file path')
              });
            }
          }
          const buffer = image.toPNG();
          // Set restrictive file permissions (owner read/write only)
          await fs.writeFile(normalizedPath, buffer, stryMutAct_9fa48("937") ? {} : (stryCov_9fa48("937"), {
            mode: 0o600
          }));

          // Clear clipboard text to prevent markdown syntax from being pasted
          // when copying images from markdown editors like Bear
          clipboard.writeText(stryMutAct_9fa48("938") ? "Stryker was here!" : (stryCov_9fa48("938"), ''));
          logger.info(stryMutAct_9fa48("939") ? "" : (stryCov_9fa48("939"), 'Image saved successfully'), stryMutAct_9fa48("940") ? {} : (stryCov_9fa48("940"), {
            filepath: normalizedPath
          }));
          return stryMutAct_9fa48("941") ? {} : (stryCov_9fa48("941"), {
            success: stryMutAct_9fa48("942") ? false : (stryCov_9fa48("942"), true),
            path: filepath
          });
        }
      } catch (error) {
        if (stryMutAct_9fa48("943")) {
          {}
        } else {
          stryCov_9fa48("943");
          logger.error(stryMutAct_9fa48("944") ? "" : (stryCov_9fa48("944"), 'Failed to handle paste image:'), error);
          return stryMutAct_9fa48("945") ? {} : (stryCov_9fa48("945"), {
            success: stryMutAct_9fa48("946") ? true : (stryCov_9fa48("946"), false),
            error: (error as Error).message
          });
        }
      }
    }
  }
  private async setClipboardAsync(text: string): Promise<void> {
    if (stryMutAct_9fa48("947")) {
      {}
    } else {
      stryCov_9fa48("947");
      return new Promise(resolve => {
        if (stryMutAct_9fa48("948")) {
          {}
        } else {
          stryCov_9fa48("948");
          try {
            if (stryMutAct_9fa48("949")) {
              {}
            } else {
              stryCov_9fa48("949");
              clipboard.writeText(text);
              resolve();
            }
          } catch (error) {
            if (stryMutAct_9fa48("950")) {
              {}
            } else {
              stryCov_9fa48("950");
              logger.warn(stryMutAct_9fa48("951") ? "" : (stryCov_9fa48("951"), 'Clipboard write failed:'), error);
              resolve();
            }
          }
        }
      });
    }
  }
  private async getPreviousAppAsync(): Promise<AppInfo | string | null> {
    if (stryMutAct_9fa48("952")) {
      {}
    } else {
      stryCov_9fa48("952");
      try {
        if (stryMutAct_9fa48("953")) {
          {}
        } else {
          stryCov_9fa48("953");
          return this.windowManager.getPreviousApp();
        }
      } catch (error) {
        if (stryMutAct_9fa48("954")) {
          {}
        } else {
          stryCov_9fa48("954");
          logger.warn(stryMutAct_9fa48("955") ? "" : (stryCov_9fa48("955"), 'Failed to get previous app info:'), error);
          return null;
        }
      }
    }
  }
  private showAccessibilityWarning(bundleId: string): void {
    if (stryMutAct_9fa48("956")) {
      {}
    } else {
      stryCov_9fa48("956");
      dialog.showMessageBox(stryMutAct_9fa48("957") ? {} : (stryCov_9fa48("957"), {
        type: stryMutAct_9fa48("958") ? "" : (stryCov_9fa48("958"), 'warning'),
        title: stryMutAct_9fa48("959") ? "" : (stryCov_9fa48("959"), 'Accessibility Permission Required'),
        message: stryMutAct_9fa48("960") ? "" : (stryCov_9fa48("960"), 'Prompt Line needs accessibility permission to function properly.'),
        detail: stryMutAct_9fa48("961") ? `` : (stryCov_9fa48("961"), `To enable paste functionality:\n\n1. Open System Preferences\n2. Go to Security & Privacy → Privacy\n3. Select "Accessibility"\n4. Add "Prompt Line" and enable it\n\nBundle ID: ${bundleId}`),
        buttons: stryMutAct_9fa48("962") ? [] : (stryCov_9fa48("962"), [stryMutAct_9fa48("963") ? "" : (stryCov_9fa48("963"), 'Open System Preferences'), stryMutAct_9fa48("964") ? "" : (stryCov_9fa48("964"), 'Set Up Later')]),
        defaultId: 0,
        cancelId: 1
      })).then((result: {
        response: number;
      }) => {
        if (stryMutAct_9fa48("965")) {
          {}
        } else {
          stryCov_9fa48("965");
          if (stryMutAct_9fa48("968") ? result.response !== 0 : stryMutAct_9fa48("967") ? false : stryMutAct_9fa48("966") ? true : (stryCov_9fa48("966", "967", "968"), result.response === 0)) {
            if (stryMutAct_9fa48("969")) {
              {}
            } else {
              stryCov_9fa48("969");
              // Open System Preferences accessibility settings
              execFile(stryMutAct_9fa48("970") ? "" : (stryCov_9fa48("970"), 'open'), stryMutAct_9fa48("971") ? [] : (stryCov_9fa48("971"), [stryMutAct_9fa48("972") ? "" : (stryCov_9fa48("972"), 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility')]));
            }
          }
        }
      }).catch((error: Error) => {
        if (stryMutAct_9fa48("973")) {
          {}
        } else {
          stryCov_9fa48("973");
          logger.error(stryMutAct_9fa48("974") ? "" : (stryCov_9fa48("974"), 'Failed to show accessibility warning dialog:'), error);
        }
      });
    }
  }
}
export default PasteHandler;