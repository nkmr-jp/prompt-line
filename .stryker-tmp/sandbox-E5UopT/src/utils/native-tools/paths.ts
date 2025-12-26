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

// Native tools paths - handle both packaged and development modes
function getNativeToolsPath(): string {
  if (stryMutAct_9fa48("5421")) {
    {}
  } else {
    stryCov_9fa48("5421");
    try {
      if (stryMutAct_9fa48("5422")) {
        {}
      } else {
        stryCov_9fa48("5422");
        // Try to import app to check if packaged
        const {
          app
        } = require('electron');
        if (stryMutAct_9fa48("5425") ? app || app.isPackaged : stryMutAct_9fa48("5424") ? false : stryMutAct_9fa48("5423") ? true : (stryCov_9fa48("5423", "5424", "5425"), app && app.isPackaged)) {
          if (stryMutAct_9fa48("5426")) {
            {}
          } else {
            stryCov_9fa48("5426");
            // In packaged mode, native tools are in the .asar.unpacked directory
            const appPath = app.getAppPath();
            const resourcesPath = path.dirname(appPath);
            const nativeToolsPath = path.join(resourcesPath, stryMutAct_9fa48("5427") ? "" : (stryCov_9fa48("5427"), 'app.asar.unpacked'), stryMutAct_9fa48("5428") ? "" : (stryCov_9fa48("5428"), 'dist'), stryMutAct_9fa48("5429") ? "" : (stryCov_9fa48("5429"), 'native-tools'));
            return nativeToolsPath;
          }
        }
      }
    } catch {
      // App object not available (e.g., in renderer process or tests)
    }

    // Development mode or fallback
    return path.join(__dirname, stryMutAct_9fa48("5430") ? "" : (stryCov_9fa48("5430"), '..'), stryMutAct_9fa48("5431") ? "" : (stryCov_9fa48("5431"), '..'), stryMutAct_9fa48("5432") ? "" : (stryCov_9fa48("5432"), 'native-tools'));
  }
}
const NATIVE_TOOLS_DIR = getNativeToolsPath();
export const WINDOW_DETECTOR_PATH = path.join(NATIVE_TOOLS_DIR, stryMutAct_9fa48("5433") ? "" : (stryCov_9fa48("5433"), 'window-detector'));
export const KEYBOARD_SIMULATOR_PATH = path.join(NATIVE_TOOLS_DIR, stryMutAct_9fa48("5434") ? "" : (stryCov_9fa48("5434"), 'keyboard-simulator'));
export const TEXT_FIELD_DETECTOR_PATH = path.join(NATIVE_TOOLS_DIR, stryMutAct_9fa48("5435") ? "" : (stryCov_9fa48("5435"), 'text-field-detector'));
export const DIRECTORY_DETECTOR_PATH = path.join(NATIVE_TOOLS_DIR, stryMutAct_9fa48("5436") ? "" : (stryCov_9fa48("5436"), 'directory-detector'));
export const FILE_SEARCHER_PATH = path.join(NATIVE_TOOLS_DIR, stryMutAct_9fa48("5437") ? "" : (stryCov_9fa48("5437"), 'file-searcher'));
export const SYMBOL_SEARCHER_PATH = path.join(NATIVE_TOOLS_DIR, stryMutAct_9fa48("5438") ? "" : (stryCov_9fa48("5438"), 'symbol-searcher'));
export { NATIVE_TOOLS_DIR };