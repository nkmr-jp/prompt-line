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
import { ipcMain, IpcMainInvokeEvent, shell } from 'electron';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { logger } from '../utils/utils';
import type FileOpenerManager from '../managers/file-opener-manager';
import type DirectoryManager from '../managers/directory-manager';
interface IPCResult {
  success: boolean;
  error?: string;
  warning?: string;
}

// Constants
const ALLOWED_URL_PROTOCOLS = stryMutAct_9fa48("287") ? [] : (stryCov_9fa48("287"), [stryMutAct_9fa48("288") ? "" : (stryCov_9fa48("288"), 'http:'), stryMutAct_9fa48("289") ? "" : (stryCov_9fa48("289"), 'https:')]);

/**
 * FileHandler class manages file operation IPC handlers.
 * Handles file opening, existence checking, and external URL operations.
 */
class FileHandler {
  private fileOpenerManager: FileOpenerManager;
  private directoryManager: DirectoryManager;
  constructor(fileOpenerManager: FileOpenerManager, directoryManager: DirectoryManager) {
    if (stryMutAct_9fa48("290")) {
      {}
    } else {
      stryCov_9fa48("290");
      this.fileOpenerManager = fileOpenerManager;
      this.directoryManager = directoryManager;
    }
  }

  /**
   * Register all file operation IPC handlers
   */
  setupHandlers(ipcMainInstance: typeof ipcMain): void {
    if (stryMutAct_9fa48("291")) {
      {}
    } else {
      stryCov_9fa48("291");
      ipcMainInstance.handle(stryMutAct_9fa48("292") ? "" : (stryCov_9fa48("292"), 'open-file-in-editor'), this.handleOpenFileInEditor.bind(this));
      ipcMainInstance.handle(stryMutAct_9fa48("293") ? "" : (stryCov_9fa48("293"), 'check-file-exists'), this.handleCheckFileExists.bind(this));
      ipcMainInstance.handle(stryMutAct_9fa48("294") ? "" : (stryCov_9fa48("294"), 'open-external-url'), this.handleOpenExternalUrl.bind(this));
      logger.info(stryMutAct_9fa48("295") ? "" : (stryCov_9fa48("295"), 'File operation IPC handlers set up successfully'));
    }
  }

  /**
   * Unregister all file operation IPC handlers
   */
  removeHandlers(ipcMainInstance: typeof ipcMain): void {
    if (stryMutAct_9fa48("296")) {
      {}
    } else {
      stryCov_9fa48("296");
      const handlers = stryMutAct_9fa48("297") ? [] : (stryCov_9fa48("297"), [stryMutAct_9fa48("298") ? "" : (stryCov_9fa48("298"), 'open-file-in-editor'), stryMutAct_9fa48("299") ? "" : (stryCov_9fa48("299"), 'check-file-exists'), stryMutAct_9fa48("300") ? "" : (stryCov_9fa48("300"), 'open-external-url')]);
      handlers.forEach(handler => {
        if (stryMutAct_9fa48("301")) {
          {}
        } else {
          stryCov_9fa48("301");
          ipcMainInstance.removeAllListeners(handler);
        }
      });
      logger.info(stryMutAct_9fa48("302") ? "" : (stryCov_9fa48("302"), 'File operation IPC handlers removed'));
    }
  }

  /**
   * Expand ~ to home directory and convert relative paths to absolute.
   * @param filePath - The file path to expand
   * @param baseDir - Optional base directory for relative paths
   * @returns Expanded and normalized absolute path
   */
  private expandPath(filePath: string, baseDir?: string | null): string {
    if (stryMutAct_9fa48("303")) {
      {}
    } else {
      stryCov_9fa48("303");
      // Expand ~ to home directory
      let expandedPath = filePath;
      if (stryMutAct_9fa48("306") ? filePath.endsWith('~/') : stryMutAct_9fa48("305") ? false : stryMutAct_9fa48("304") ? true : (stryCov_9fa48("304", "305", "306"), filePath.startsWith(stryMutAct_9fa48("307") ? "" : (stryCov_9fa48("307"), '~/')))) {
        if (stryMutAct_9fa48("308")) {
          {}
        } else {
          stryCov_9fa48("308");
          expandedPath = path.join(os.homedir(), stryMutAct_9fa48("309") ? filePath : (stryCov_9fa48("309"), filePath.slice(2)));
        }
      } else if (stryMutAct_9fa48("312") ? filePath !== '~' : stryMutAct_9fa48("311") ? false : stryMutAct_9fa48("310") ? true : (stryCov_9fa48("310", "311", "312"), filePath === (stryMutAct_9fa48("313") ? "" : (stryCov_9fa48("313"), '~')))) {
        if (stryMutAct_9fa48("314")) {
          {}
        } else {
          stryCov_9fa48("314");
          expandedPath = os.homedir();
        }
      }

      // Convert to absolute path if relative
      let absolutePath: string;
      if (stryMutAct_9fa48("316") ? false : stryMutAct_9fa48("315") ? true : (stryCov_9fa48("315", "316"), path.isAbsolute(expandedPath))) {
        if (stryMutAct_9fa48("317")) {
          {}
        } else {
          stryCov_9fa48("317");
          absolutePath = expandedPath;
        }
      } else {
        if (stryMutAct_9fa48("318")) {
          {}
        } else {
          stryCov_9fa48("318");
          // Use baseDir if provided, otherwise use DirectoryManager's directory
          const resolvedBaseDir = stryMutAct_9fa48("319") ? baseDir && this.directoryManager.getDirectory() : (stryCov_9fa48("319"), baseDir ?? this.directoryManager.getDirectory());
          if (stryMutAct_9fa48("321") ? false : stryMutAct_9fa48("320") ? true : (stryCov_9fa48("320", "321"), resolvedBaseDir)) {
            if (stryMutAct_9fa48("322")) {
              {}
            } else {
              stryCov_9fa48("322");
              absolutePath = path.join(resolvedBaseDir, expandedPath);
            }
          } else {
            if (stryMutAct_9fa48("323")) {
              {}
            } else {
              stryCov_9fa48("323");
              // Fallback to process.cwd() if no directory is set
              absolutePath = path.join(process.cwd(), expandedPath);
            }
          }
        }
      }

      // Normalize path
      return path.normalize(absolutePath);
    }
  }

  /**
   * Parse a file path that may contain line number and symbol suffix
   * Format: path:lineNumber#symbolName or path:lineNumber or just path
   */
  private parsePathWithLineInfo(pathStr: string): {
    path: string;
    lineNumber?: number;
    symbolName?: string;
  } {
    if (stryMutAct_9fa48("324")) {
      {}
    } else {
      stryCov_9fa48("324");
      // Match pattern: path:lineNumber#symbolName or path:lineNumber
      const match = pathStr.match(stryMutAct_9fa48("331") ? /^(.+?):(\d+)(#(.))?$/ : stryMutAct_9fa48("330") ? /^(.+?):(\d+)(#(.+))$/ : stryMutAct_9fa48("329") ? /^(.+?):(\D+)(#(.+))?$/ : stryMutAct_9fa48("328") ? /^(.+?):(\d)(#(.+))?$/ : stryMutAct_9fa48("327") ? /^(.):(\d+)(#(.+))?$/ : stryMutAct_9fa48("326") ? /^(.+?):(\d+)(#(.+))?/ : stryMutAct_9fa48("325") ? /(.+?):(\d+)(#(.+))?$/ : (stryCov_9fa48("325", "326", "327", "328", "329", "330", "331"), /^(.+?):(\d+)(#(.+))?$/));
      if (stryMutAct_9fa48("334") ? match && match[1] || match[2] : stryMutAct_9fa48("333") ? false : stryMutAct_9fa48("332") ? true : (stryCov_9fa48("332", "333", "334"), (stryMutAct_9fa48("336") ? match || match[1] : stryMutAct_9fa48("335") ? true : (stryCov_9fa48("335", "336"), match && match[1])) && match[2])) {
        if (stryMutAct_9fa48("337")) {
          {}
        } else {
          stryCov_9fa48("337");
          const result: {
            path: string;
            lineNumber?: number;
            symbolName?: string;
          } = stryMutAct_9fa48("338") ? {} : (stryCov_9fa48("338"), {
            path: match[1],
            lineNumber: parseInt(match[2], 10)
          });
          if (stryMutAct_9fa48("340") ? false : stryMutAct_9fa48("339") ? true : (stryCov_9fa48("339", "340"), match[4])) {
            if (stryMutAct_9fa48("341")) {
              {}
            } else {
              stryCov_9fa48("341");
              result.symbolName = match[4];
            }
          }
          return result;
        }
      }
      // No line number suffix
      return stryMutAct_9fa48("342") ? {} : (stryCov_9fa48("342"), {
        path: pathStr
      });
    }
  }

  /**
   * Handle open-file-in-editor IPC channel
   * Opens a file in the configured editor based on file extension
   * Supports paths with line numbers: path:lineNumber or path:lineNumber#symbolName
   */
  private async handleOpenFileInEditor(_event: IpcMainInvokeEvent, filePath: string): Promise<IPCResult> {
    if (stryMutAct_9fa48("343")) {
      {}
    } else {
      stryCov_9fa48("343");
      try {
        if (stryMutAct_9fa48("344")) {
          {}
        } else {
          stryCov_9fa48("344");
          logger.info(stryMutAct_9fa48("345") ? "" : (stryCov_9fa48("345"), 'Opening file in editor:'), stryMutAct_9fa48("346") ? {} : (stryCov_9fa48("346"), {
            filePath
          }));

          // Validate input
          if (stryMutAct_9fa48("349") ? !filePath && typeof filePath !== 'string' : stryMutAct_9fa48("348") ? false : stryMutAct_9fa48("347") ? true : (stryCov_9fa48("347", "348", "349"), (stryMutAct_9fa48("350") ? filePath : (stryCov_9fa48("350"), !filePath)) || (stryMutAct_9fa48("352") ? typeof filePath === 'string' : stryMutAct_9fa48("351") ? false : (stryCov_9fa48("351", "352"), typeof filePath !== (stryMutAct_9fa48("353") ? "" : (stryCov_9fa48("353"), 'string')))))) {
            if (stryMutAct_9fa48("354")) {
              {}
            } else {
              stryCov_9fa48("354");
              return stryMutAct_9fa48("355") ? {} : (stryCov_9fa48("355"), {
                success: stryMutAct_9fa48("356") ? true : (stryCov_9fa48("356"), false),
                error: stryMutAct_9fa48("357") ? "" : (stryCov_9fa48("357"), 'Invalid file path provided')
              });
            }
          }

          // Parse line number and symbol from path
          const parsedPath = this.parsePathWithLineInfo(filePath);
          const cleanPath = parsedPath.path;
          logger.debug(stryMutAct_9fa48("358") ? "" : (stryCov_9fa48("358"), 'Parsed file path:'), stryMutAct_9fa48("359") ? {} : (stryCov_9fa48("359"), {
            original: filePath,
            cleanPath,
            lineNumber: parsedPath.lineNumber,
            symbolName: parsedPath.symbolName
          }));

          // Expand and resolve path (without line number suffix)
          const normalizedPath = this.expandPath(cleanPath);
          logger.debug(stryMutAct_9fa48("360") ? "" : (stryCov_9fa48("360"), 'Resolved file path:'), stryMutAct_9fa48("361") ? {} : (stryCov_9fa48("361"), {
            original: filePath,
            cleanPath,
            baseDir: this.directoryManager.getDirectory(),
            resolved: normalizedPath,
            lineNumber: parsedPath.lineNumber
          }));

          // File existence check (TOCTOU mitigation)
          try {
            if (stryMutAct_9fa48("362")) {
              {}
            } else {
              stryCov_9fa48("362");
              await fs.access(normalizedPath);
            }
          } catch {
            if (stryMutAct_9fa48("363")) {
              {}
            } else {
              stryCov_9fa48("363");
              logger.warn(stryMutAct_9fa48("364") ? "" : (stryCov_9fa48("364"), 'File does not exist:'), stryMutAct_9fa48("365") ? {} : (stryCov_9fa48("365"), {
                normalizedPath
              }));
              return stryMutAct_9fa48("366") ? {} : (stryCov_9fa48("366"), {
                success: stryMutAct_9fa48("367") ? true : (stryCov_9fa48("367"), false),
                error: stryMutAct_9fa48("368") ? "" : (stryCov_9fa48("368"), 'File does not exist')
              });
            }
          }

          // Open file using FileOpenerManager with line number option
          const options = (stryMutAct_9fa48("371") ? parsedPath.lineNumber === undefined : stryMutAct_9fa48("370") ? false : stryMutAct_9fa48("369") ? true : (stryCov_9fa48("369", "370", "371"), parsedPath.lineNumber !== undefined)) ? stryMutAct_9fa48("372") ? {} : (stryCov_9fa48("372"), {
            lineNumber: parsedPath.lineNumber
          }) : undefined;
          return await this.fileOpenerManager.openFile(normalizedPath, options);
        }
      } catch (error) {
        if (stryMutAct_9fa48("373")) {
          {}
        } else {
          stryCov_9fa48("373");
          logger.error(stryMutAct_9fa48("374") ? "" : (stryCov_9fa48("374"), 'Failed to open file in editor:'), error);
          return stryMutAct_9fa48("375") ? {} : (stryCov_9fa48("375"), {
            success: stryMutAct_9fa48("376") ? true : (stryCov_9fa48("376"), false),
            error: (error as Error).message
          });
        }
      }
    }
  }

  /**
   * Handle check-file-exists IPC channel
   * Checks if a file exists at the specified path
   */
  private async handleCheckFileExists(_event: IpcMainInvokeEvent, filePath: string): Promise<boolean> {
    if (stryMutAct_9fa48("377")) {
      {}
    } else {
      stryCov_9fa48("377");
      try {
        if (stryMutAct_9fa48("378")) {
          {}
        } else {
          stryCov_9fa48("378");
          // Validate input
          if (stryMutAct_9fa48("381") ? !filePath && typeof filePath !== 'string' : stryMutAct_9fa48("380") ? false : stryMutAct_9fa48("379") ? true : (stryCov_9fa48("379", "380", "381"), (stryMutAct_9fa48("382") ? filePath : (stryCov_9fa48("382"), !filePath)) || (stryMutAct_9fa48("384") ? typeof filePath === 'string' : stryMutAct_9fa48("383") ? false : (stryCov_9fa48("383", "384"), typeof filePath !== (stryMutAct_9fa48("385") ? "" : (stryCov_9fa48("385"), 'string')))))) {
            if (stryMutAct_9fa48("386")) {
              {}
            } else {
              stryCov_9fa48("386");
              return stryMutAct_9fa48("387") ? true : (stryCov_9fa48("387"), false);
            }
          }

          // Expand and resolve path
          const normalizedPath = this.expandPath(filePath);

          // Check if file exists
          await fs.access(normalizedPath);
          return stryMutAct_9fa48("388") ? false : (stryCov_9fa48("388"), true);
        }
      } catch {
        if (stryMutAct_9fa48("389")) {
          {}
        } else {
          stryCov_9fa48("389");
          // File does not exist or cannot be accessed
          return stryMutAct_9fa48("390") ? true : (stryCov_9fa48("390"), false);
        }
      }
    }
  }

  /**
   * Handle open-external-url IPC channel
   * Opens a URL in the system default browser with protocol validation
   */
  private async handleOpenExternalUrl(_event: IpcMainInvokeEvent, url: string): Promise<IPCResult> {
    if (stryMutAct_9fa48("391")) {
      {}
    } else {
      stryCov_9fa48("391");
      try {
        if (stryMutAct_9fa48("392")) {
          {}
        } else {
          stryCov_9fa48("392");
          logger.info(stryMutAct_9fa48("393") ? "" : (stryCov_9fa48("393"), 'Opening external URL:'), stryMutAct_9fa48("394") ? {} : (stryCov_9fa48("394"), {
            url
          }));

          // Validate input
          if (stryMutAct_9fa48("397") ? !url && typeof url !== 'string' : stryMutAct_9fa48("396") ? false : stryMutAct_9fa48("395") ? true : (stryCov_9fa48("395", "396", "397"), (stryMutAct_9fa48("398") ? url : (stryCov_9fa48("398"), !url)) || (stryMutAct_9fa48("400") ? typeof url === 'string' : stryMutAct_9fa48("399") ? false : (stryCov_9fa48("399", "400"), typeof url !== (stryMutAct_9fa48("401") ? "" : (stryCov_9fa48("401"), 'string')))))) {
            if (stryMutAct_9fa48("402")) {
              {}
            } else {
              stryCov_9fa48("402");
              return stryMutAct_9fa48("403") ? {} : (stryCov_9fa48("403"), {
                success: stryMutAct_9fa48("404") ? true : (stryCov_9fa48("404"), false),
                error: stryMutAct_9fa48("405") ? "" : (stryCov_9fa48("405"), 'Invalid URL provided')
              });
            }
          }

          // Validate URL format using URL parser
          let parsedUrl: URL;
          try {
            if (stryMutAct_9fa48("406")) {
              {}
            } else {
              stryCov_9fa48("406");
              parsedUrl = new URL(url);
            }
          } catch {
            if (stryMutAct_9fa48("407")) {
              {}
            } else {
              stryCov_9fa48("407");
              return stryMutAct_9fa48("408") ? {} : (stryCov_9fa48("408"), {
                success: stryMutAct_9fa48("409") ? true : (stryCov_9fa48("409"), false),
                error: stryMutAct_9fa48("410") ? "" : (stryCov_9fa48("410"), 'Invalid URL format')
              });
            }
          }

          // Whitelist protocols
          if (stryMutAct_9fa48("413") ? false : stryMutAct_9fa48("412") ? true : stryMutAct_9fa48("411") ? ALLOWED_URL_PROTOCOLS.includes(parsedUrl.protocol) : (stryCov_9fa48("411", "412", "413"), !ALLOWED_URL_PROTOCOLS.includes(parsedUrl.protocol))) {
            if (stryMutAct_9fa48("414")) {
              {}
            } else {
              stryCov_9fa48("414");
              logger.warn(stryMutAct_9fa48("415") ? "" : (stryCov_9fa48("415"), 'Attempted to open URL with disallowed protocol:'), stryMutAct_9fa48("416") ? {} : (stryCov_9fa48("416"), {
                url,
                protocol: parsedUrl.protocol
              }));
              return stryMutAct_9fa48("417") ? {} : (stryCov_9fa48("417"), {
                success: stryMutAct_9fa48("418") ? true : (stryCov_9fa48("418"), false),
                error: stryMutAct_9fa48("419") ? "" : (stryCov_9fa48("419"), 'Only http:// and https:// URLs are allowed')
              });
            }
          }

          // Open URL with system default browser
          await shell.openExternal(url);
          logger.info(stryMutAct_9fa48("420") ? "" : (stryCov_9fa48("420"), 'URL opened successfully in browser:'), stryMutAct_9fa48("421") ? {} : (stryCov_9fa48("421"), {
            url
          }));
          return stryMutAct_9fa48("422") ? {} : (stryCov_9fa48("422"), {
            success: stryMutAct_9fa48("423") ? false : (stryCov_9fa48("423"), true)
          });
        }
      } catch (error) {
        if (stryMutAct_9fa48("424")) {
          {}
        } else {
          stryCov_9fa48("424");
          logger.error(stryMutAct_9fa48("425") ? "" : (stryCov_9fa48("425"), 'Failed to open external URL:'), error);
          return stryMutAct_9fa48("426") ? {} : (stryCov_9fa48("426"), {
            success: stryMutAct_9fa48("427") ? true : (stryCov_9fa48("427"), false),
            error: (error as Error).message
          });
        }
      }
    }
  }
}
export default FileHandler;