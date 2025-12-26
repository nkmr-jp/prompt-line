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
import { screen } from 'electron';
import { logger, getActiveWindowBounds } from '../../utils/utils';
import type { StartupPosition } from '../../types';
import { getActiveTextFieldBounds } from './text-field-bounds-detector';

/**
 * Window position calculator with multiple positioning strategies
 * Handles window positioning for different modes with screen boundary constraints
 */
class WindowPositionCalculator {
  /**
   * Calculate window position based on specified positioning mode
   * @param position - Positioning mode (center, active-window-center, cursor, active-text-field)
   * @param windowWidth - Width of the window to position
   * @param windowHeight - Height of the window to position
   * @returns Promise resolving to window position coordinates
   */
  async calculateWindowPosition(position: StartupPosition, windowWidth: number, windowHeight: number): Promise<{
    x: number;
    y: number;
  }> {
    if (stryMutAct_9fa48("4150")) {
      {}
    } else {
      stryCov_9fa48("4150");
      const methodStartTime = performance.now();
      logger.debug(stryMutAct_9fa48("4151") ? `` : (stryCov_9fa48("4151"), `🕐 Calculating position for: ${position}`));
      let result: {
        x: number;
        y: number;
      };
      switch (position) {
        case stryMutAct_9fa48("4153") ? "" : (stryCov_9fa48("4153"), 'center'):
          if (stryMutAct_9fa48("4152")) {} else {
            stryCov_9fa48("4152");
            {
              if (stryMutAct_9fa48("4154")) {
                {}
              } else {
                stryCov_9fa48("4154");
                const centerStartTime = performance.now();
                result = this.calculateCenterPosition(windowWidth, windowHeight);
                logger.debug(stryMutAct_9fa48("4155") ? `` : (stryCov_9fa48("4155"), `⏱️  Center calculation: ${(stryMutAct_9fa48("4156") ? performance.now() + centerStartTime : (stryCov_9fa48("4156"), performance.now() - centerStartTime)).toFixed(2)}ms`));
                break;
              }
            }
          }
        case stryMutAct_9fa48("4158") ? "" : (stryCov_9fa48("4158"), 'active-window-center'):
          if (stryMutAct_9fa48("4157")) {} else {
            stryCov_9fa48("4157");
            {
              if (stryMutAct_9fa48("4159")) {
                {}
              } else {
                stryCov_9fa48("4159");
                const awcStartTime = performance.now();
                result = await this.calculateActiveWindowCenterPosition(windowWidth, windowHeight);
                logger.debug(stryMutAct_9fa48("4160") ? `` : (stryCov_9fa48("4160"), `⏱️  Active window center calculation: ${(stryMutAct_9fa48("4161") ? performance.now() + awcStartTime : (stryCov_9fa48("4161"), performance.now() - awcStartTime)).toFixed(2)}ms`));
                break;
              }
            }
          }
        case stryMutAct_9fa48("4163") ? "" : (stryCov_9fa48("4163"), 'active-text-field'):
          if (stryMutAct_9fa48("4162")) {} else {
            stryCov_9fa48("4162");
            {
              if (stryMutAct_9fa48("4164")) {
                {}
              } else {
                stryCov_9fa48("4164");
                const atfStartTime = performance.now();
                result = await this.calculateActiveTextFieldPosition(windowWidth, windowHeight);
                logger.debug(stryMutAct_9fa48("4165") ? `` : (stryCov_9fa48("4165"), `⏱️  Active text field calculation: ${(stryMutAct_9fa48("4166") ? performance.now() + atfStartTime : (stryCov_9fa48("4166"), performance.now() - atfStartTime)).toFixed(2)}ms`));
                break;
              }
            }
          }
        case stryMutAct_9fa48("4168") ? "" : (stryCov_9fa48("4168"), 'cursor'):
          if (stryMutAct_9fa48("4167")) {} else {
            stryCov_9fa48("4167");
            {
              if (stryMutAct_9fa48("4169")) {
                {}
              } else {
                stryCov_9fa48("4169");
                const cursorStartTime = performance.now();
                result = this.calculateCursorPosition(windowWidth, windowHeight);
                logger.debug(stryMutAct_9fa48("4170") ? `` : (stryCov_9fa48("4170"), `⏱️  Cursor calculation: ${(stryMutAct_9fa48("4171") ? performance.now() + cursorStartTime : (stryCov_9fa48("4171"), performance.now() - cursorStartTime)).toFixed(2)}ms`));
                break;
              }
            }
          }
        default:
          if (stryMutAct_9fa48("4172")) {} else {
            stryCov_9fa48("4172");
            {
              if (stryMutAct_9fa48("4173")) {
                {}
              } else {
                stryCov_9fa48("4173");
                logger.warn(stryMutAct_9fa48("4174") ? "" : (stryCov_9fa48("4174"), 'Invalid position value, falling back to active-window-center'), stryMutAct_9fa48("4175") ? {} : (stryCov_9fa48("4175"), {
                  position
                }));
                const fallbackStartTime = performance.now();
                result = await this.calculateActiveWindowCenterPosition(windowWidth, windowHeight);
                logger.debug(stryMutAct_9fa48("4176") ? `` : (stryCov_9fa48("4176"), `⏱️  Fallback calculation: ${(stryMutAct_9fa48("4177") ? performance.now() + fallbackStartTime : (stryCov_9fa48("4177"), performance.now() - fallbackStartTime)).toFixed(2)}ms`));
                break;
              }
            }
          }
      }
      logger.debug(stryMutAct_9fa48("4178") ? `` : (stryCov_9fa48("4178"), `🏁 Total position calculation (${position}): ${(stryMutAct_9fa48("4179") ? performance.now() + methodStartTime : (stryCov_9fa48("4179"), performance.now() - methodStartTime)).toFixed(2)}ms`));
      return result;
    }
  }

  /**
   * Calculate center position on primary display with slight upward offset
   * @param windowWidth - Width of the window
   * @param windowHeight - Height of the window
   * @returns Window position coordinates centered on primary display
   */
  calculateCenterPosition(windowWidth: number, windowHeight: number): {
    x: number;
    y: number;
  } {
    if (stryMutAct_9fa48("4180")) {
      {}
    } else {
      stryCov_9fa48("4180");
      const display = screen.getPrimaryDisplay();
      const bounds = display.bounds;
      return stryMutAct_9fa48("4181") ? {} : (stryCov_9fa48("4181"), {
        x: stryMutAct_9fa48("4182") ? bounds.x - (bounds.width - windowWidth) / 2 : (stryCov_9fa48("4182"), bounds.x + (stryMutAct_9fa48("4183") ? (bounds.width - windowWidth) * 2 : (stryCov_9fa48("4183"), (stryMutAct_9fa48("4184") ? bounds.width + windowWidth : (stryCov_9fa48("4184"), bounds.width - windowWidth)) / 2))),
        y: stryMutAct_9fa48("4185") ? bounds.y + (bounds.height - windowHeight) / 2 + 100 : (stryCov_9fa48("4185"), (stryMutAct_9fa48("4186") ? bounds.y - (bounds.height - windowHeight) / 2 : (stryCov_9fa48("4186"), bounds.y + (stryMutAct_9fa48("4187") ? (bounds.height - windowHeight) * 2 : (stryCov_9fa48("4187"), (stryMutAct_9fa48("4188") ? bounds.height + windowHeight : (stryCov_9fa48("4188"), bounds.height - windowHeight)) / 2)))) - 100)
      });
    }
  }

  /**
   * Calculate position centered within the currently active window
   * Falls back to center position if active window bounds cannot be determined
   * @param windowWidth - Width of the window
   * @param windowHeight - Height of the window
   * @returns Window position coordinates centered in active window
   */
  async calculateActiveWindowCenterPosition(windowWidth: number, windowHeight: number): Promise<{
    x: number;
    y: number;
  }> {
    if (stryMutAct_9fa48("4189")) {
      {}
    } else {
      stryCov_9fa48("4189");
      try {
        if (stryMutAct_9fa48("4190")) {
          {}
        } else {
          stryCov_9fa48("4190");
          const activeWindowBounds = await getActiveWindowBounds();
          if (stryMutAct_9fa48("4192") ? false : stryMutAct_9fa48("4191") ? true : (stryCov_9fa48("4191", "4192"), activeWindowBounds)) {
            if (stryMutAct_9fa48("4193")) {
              {}
            } else {
              stryCov_9fa48("4193");
              const x = stryMutAct_9fa48("4194") ? activeWindowBounds.x - (activeWindowBounds.width - windowWidth) / 2 : (stryCov_9fa48("4194"), activeWindowBounds.x + (stryMutAct_9fa48("4195") ? (activeWindowBounds.width - windowWidth) * 2 : (stryCov_9fa48("4195"), (stryMutAct_9fa48("4196") ? activeWindowBounds.width + windowWidth : (stryCov_9fa48("4196"), activeWindowBounds.width - windowWidth)) / 2)));
              const y = stryMutAct_9fa48("4197") ? activeWindowBounds.y - (activeWindowBounds.height - windowHeight) / 2 : (stryCov_9fa48("4197"), activeWindowBounds.y + (stryMutAct_9fa48("4198") ? (activeWindowBounds.height - windowHeight) * 2 : (stryCov_9fa48("4198"), (stryMutAct_9fa48("4199") ? activeWindowBounds.height + windowHeight : (stryCov_9fa48("4199"), activeWindowBounds.height - windowHeight)) / 2)));
              const point = stryMutAct_9fa48("4200") ? {} : (stryCov_9fa48("4200"), {
                x: stryMutAct_9fa48("4201") ? activeWindowBounds.x - activeWindowBounds.width / 2 : (stryCov_9fa48("4201"), activeWindowBounds.x + (stryMutAct_9fa48("4202") ? activeWindowBounds.width * 2 : (stryCov_9fa48("4202"), activeWindowBounds.width / 2))),
                y: stryMutAct_9fa48("4203") ? activeWindowBounds.y - activeWindowBounds.height / 2 : (stryCov_9fa48("4203"), activeWindowBounds.y + (stryMutAct_9fa48("4204") ? activeWindowBounds.height * 2 : (stryCov_9fa48("4204"), activeWindowBounds.height / 2)))
              });
              return this.constrainToScreenBounds(stryMutAct_9fa48("4205") ? {} : (stryCov_9fa48("4205"), {
                x,
                y
              }), windowWidth, windowHeight, point);
            }
          } else {
            if (stryMutAct_9fa48("4206")) {
              {}
            } else {
              stryCov_9fa48("4206");
              logger.warn(stryMutAct_9fa48("4207") ? "" : (stryCov_9fa48("4207"), 'Could not get active window bounds, falling back to center position'));
              return this.calculateCenterPosition(windowWidth, windowHeight);
            }
          }
        }
      } catch (error) {
        if (stryMutAct_9fa48("4208")) {
          {}
        } else {
          stryCov_9fa48("4208");
          logger.warn(stryMutAct_9fa48("4209") ? "" : (stryCov_9fa48("4209"), 'Error getting active window bounds, falling back to center position:'), error);
          return this.calculateCenterPosition(windowWidth, windowHeight);
        }
      }
    }
  }

  /**
   * Calculate position at cursor location
   * Window is centered on the cursor with screen boundary constraints
   * @param windowWidth - Width of the window
   * @param windowHeight - Height of the window
   * @returns Window position coordinates centered on cursor
   */
  calculateCursorPosition(windowWidth: number, windowHeight: number): {
    x: number;
    y: number;
  } {
    if (stryMutAct_9fa48("4210")) {
      {}
    } else {
      stryCov_9fa48("4210");
      const point = screen.getCursorScreenPoint();
      const x = stryMutAct_9fa48("4211") ? point.x + windowWidth / 2 : (stryCov_9fa48("4211"), point.x - (stryMutAct_9fa48("4212") ? windowWidth * 2 : (stryCov_9fa48("4212"), windowWidth / 2)));
      const y = stryMutAct_9fa48("4213") ? point.y + windowHeight / 2 : (stryCov_9fa48("4213"), point.y - (stryMutAct_9fa48("4214") ? windowHeight * 2 : (stryCov_9fa48("4214"), windowHeight / 2)));
      return this.constrainToScreenBounds(stryMutAct_9fa48("4215") ? {} : (stryCov_9fa48("4215"), {
        x,
        y
      }), windowWidth, windowHeight, point);
    }
  }

  /**
   * Calculate position near the currently focused text field
   * Falls back to active-window-center if text field cannot be detected
   * @param windowWidth - Width of the window
   * @param windowHeight - Height of the window
   * @returns Window position coordinates near active text field
   */
  async calculateActiveTextFieldPosition(windowWidth: number, windowHeight: number): Promise<{
    x: number;
    y: number;
  }> {
    if (stryMutAct_9fa48("4216")) {
      {}
    } else {
      stryCov_9fa48("4216");
      try {
        if (stryMutAct_9fa48("4217")) {
          {}
        } else {
          stryCov_9fa48("4217");
          const textFieldBounds = await getActiveTextFieldBounds();
          if (stryMutAct_9fa48("4219") ? false : stryMutAct_9fa48("4218") ? true : (stryCov_9fa48("4218", "4219"), textFieldBounds)) {
            if (stryMutAct_9fa48("4220")) {
              {}
            } else {
              stryCov_9fa48("4220");
              // If text field is narrower than window, align to left edge of text field
              // Otherwise, center the window horizontally within the text field
              let x: number;
              if (stryMutAct_9fa48("4224") ? textFieldBounds.width >= windowWidth : stryMutAct_9fa48("4223") ? textFieldBounds.width <= windowWidth : stryMutAct_9fa48("4222") ? false : stryMutAct_9fa48("4221") ? true : (stryCov_9fa48("4221", "4222", "4223", "4224"), textFieldBounds.width < windowWidth)) {
                if (stryMutAct_9fa48("4225")) {
                  {}
                } else {
                  stryCov_9fa48("4225");
                  x = textFieldBounds.x;
                }
              } else {
                if (stryMutAct_9fa48("4226")) {
                  {}
                } else {
                  stryCov_9fa48("4226");
                  x = stryMutAct_9fa48("4227") ? textFieldBounds.x - (textFieldBounds.width - windowWidth) / 2 : (stryCov_9fa48("4227"), textFieldBounds.x + (stryMutAct_9fa48("4228") ? (textFieldBounds.width - windowWidth) * 2 : (stryCov_9fa48("4228"), (stryMutAct_9fa48("4229") ? textFieldBounds.width + windowWidth : (stryCov_9fa48("4229"), textFieldBounds.width - windowWidth)) / 2)));
                }
              }

              // Always center vertically
              const y = stryMutAct_9fa48("4230") ? textFieldBounds.y - (textFieldBounds.height - windowHeight) / 2 : (stryCov_9fa48("4230"), textFieldBounds.y + (stryMutAct_9fa48("4231") ? (textFieldBounds.height - windowHeight) * 2 : (stryCov_9fa48("4231"), (stryMutAct_9fa48("4232") ? textFieldBounds.height + windowHeight : (stryCov_9fa48("4232"), textFieldBounds.height - windowHeight)) / 2)));
              return this.constrainToScreenBounds(stryMutAct_9fa48("4233") ? {} : (stryCov_9fa48("4233"), {
                x,
                y
              }), windowWidth, windowHeight, stryMutAct_9fa48("4234") ? {} : (stryCov_9fa48("4234"), {
                x: stryMutAct_9fa48("4235") ? textFieldBounds.x - textFieldBounds.width / 2 : (stryCov_9fa48("4235"), textFieldBounds.x + (stryMutAct_9fa48("4236") ? textFieldBounds.width * 2 : (stryCov_9fa48("4236"), textFieldBounds.width / 2))),
                y: stryMutAct_9fa48("4237") ? textFieldBounds.y - textFieldBounds.height / 2 : (stryCov_9fa48("4237"), textFieldBounds.y + (stryMutAct_9fa48("4238") ? textFieldBounds.height * 2 : (stryCov_9fa48("4238"), textFieldBounds.height / 2)))
              }));
            }
          } else {
            if (stryMutAct_9fa48("4239")) {
              {}
            } else {
              stryCov_9fa48("4239");
              logger.warn(stryMutAct_9fa48("4240") ? "" : (stryCov_9fa48("4240"), 'Could not get active text field bounds, falling back to active-window-center'));
              return this.calculateActiveWindowCenterPosition(windowWidth, windowHeight);
            }
          }
        }
      } catch (error) {
        if (stryMutAct_9fa48("4241")) {
          {}
        } else {
          stryCov_9fa48("4241");
          logger.warn(stryMutAct_9fa48("4242") ? "" : (stryCov_9fa48("4242"), 'Error getting active text field bounds, falling back to active-window-center:'), error);
          return this.calculateActiveWindowCenterPosition(windowWidth, windowHeight);
        }
      }
    }
  }

  /**
   * Constrain window position to screen bounds for multi-monitor setups
   * Ensures the window stays fully visible within the screen containing the reference point
   * @param position - Initial window position
   * @param windowWidth - Width of the window
   * @param windowHeight - Height of the window
   * @param referencePoint - Reference point for determining which screen to use
   * @returns Constrained window position that stays within screen bounds
   */
  private constrainToScreenBounds(position: {
    x: number;
    y: number;
  }, windowWidth: number, windowHeight: number, referencePoint: {
    x: number;
    y: number;
  }): {
    x: number;
    y: number;
  } {
    if (stryMutAct_9fa48("4243")) {
      {}
    } else {
      stryCov_9fa48("4243");
      const display = screen.getDisplayNearestPoint(referencePoint);
      const bounds = display.bounds;
      return stryMutAct_9fa48("4244") ? {} : (stryCov_9fa48("4244"), {
        x: stryMutAct_9fa48("4245") ? Math.min(bounds.x, Math.min(position.x, bounds.x + bounds.width - windowWidth)) : (stryCov_9fa48("4245"), Math.max(bounds.x, stryMutAct_9fa48("4246") ? Math.max(position.x, bounds.x + bounds.width - windowWidth) : (stryCov_9fa48("4246"), Math.min(position.x, stryMutAct_9fa48("4247") ? bounds.x + bounds.width + windowWidth : (stryCov_9fa48("4247"), (stryMutAct_9fa48("4248") ? bounds.x - bounds.width : (stryCov_9fa48("4248"), bounds.x + bounds.width)) - windowWidth))))),
        y: stryMutAct_9fa48("4249") ? Math.min(bounds.y, Math.min(position.y, bounds.y + bounds.height - windowHeight)) : (stryCov_9fa48("4249"), Math.max(bounds.y, stryMutAct_9fa48("4250") ? Math.max(position.y, bounds.y + bounds.height - windowHeight) : (stryCov_9fa48("4250"), Math.min(position.y, stryMutAct_9fa48("4251") ? bounds.y + bounds.height + windowHeight : (stryCov_9fa48("4251"), (stryMutAct_9fa48("4252") ? bounds.y - bounds.height : (stryCov_9fa48("4252"), bounds.y + bounds.height)) - windowHeight)))))
      });
    }
  }
}
export default WindowPositionCalculator;