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
import type { DebounceFunction } from '../types';
import { TIME_CALCULATIONS } from '../constants';
import { logger } from './logger';
export function debounce<T extends unknown[]>(func: (...args: T) => void, wait: number, immediate = stryMutAct_9fa48("4842") ? true : (stryCov_9fa48("4842"), false)): DebounceFunction<T> {
  if (stryMutAct_9fa48("4843")) {
    {}
  } else {
    stryCov_9fa48("4843");
    let timeout: NodeJS.Timeout | undefined;
    const debouncedFunction = function (this: unknown, ...args: T) {
      if (stryMutAct_9fa48("4844")) {
        {}
      } else {
        stryCov_9fa48("4844");
        const later = () => {
          if (stryMutAct_9fa48("4845")) {
            {}
          } else {
            stryCov_9fa48("4845");
            timeout = undefined;
            if (stryMutAct_9fa48("4848") ? false : stryMutAct_9fa48("4847") ? true : stryMutAct_9fa48("4846") ? immediate : (stryCov_9fa48("4846", "4847", "4848"), !immediate)) func.apply(this, args);
          }
        };
        const callNow = stryMutAct_9fa48("4851") ? immediate || !timeout : stryMutAct_9fa48("4850") ? false : stryMutAct_9fa48("4849") ? true : (stryCov_9fa48("4849", "4850", "4851"), immediate && (stryMutAct_9fa48("4852") ? timeout : (stryCov_9fa48("4852"), !timeout)));
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (stryMutAct_9fa48("4854") ? false : stryMutAct_9fa48("4853") ? true : (stryCov_9fa48("4853", "4854"), callNow)) func.apply(this, args);
      }
    };
    return debouncedFunction;
  }
}
export function safeJsonParse<T = unknown>(jsonString: string, fallback?: T): T | null {
  if (stryMutAct_9fa48("4855")) {
    {}
  } else {
    stryCov_9fa48("4855");
    try {
      if (stryMutAct_9fa48("4856")) {
        {}
      } else {
        stryCov_9fa48("4856");
        return JSON.parse(jsonString) as T;
      }
    } catch (error) {
      if (stryMutAct_9fa48("4857")) {
        {}
      } else {
        stryCov_9fa48("4857");
        logger.warn(stryMutAct_9fa48("4858") ? "" : (stryCov_9fa48("4858"), 'Failed to parse JSON:'), error);
        return stryMutAct_9fa48("4859") ? fallback && null : (stryCov_9fa48("4859"), fallback ?? null);
      }
    }
  }
}
export function safeJsonStringify(obj: unknown, fallback = stryMutAct_9fa48("4860") ? "" : (stryCov_9fa48("4860"), '{}')): string {
  if (stryMutAct_9fa48("4861")) {
    {}
  } else {
    stryCov_9fa48("4861");
    try {
      if (stryMutAct_9fa48("4862")) {
        {}
      } else {
        stryCov_9fa48("4862");
        return JSON.stringify(obj, null, 2);
      }
    } catch (error) {
      if (stryMutAct_9fa48("4863")) {
        {}
      } else {
        stryCov_9fa48("4863");
        logger.warn(stryMutAct_9fa48("4864") ? "" : (stryCov_9fa48("4864"), 'Failed to stringify object:'), error);
        return fallback;
      }
    }
  }
}

// Generates lowercase alphanumeric ID (a-z0-9)
// NOTE: ID validation in ipc-handlers.ts depends on this format - update both if changed
export function generateId(): string {
  if (stryMutAct_9fa48("4865")) {
    {}
  } else {
    stryCov_9fa48("4865");
    return stryMutAct_9fa48("4866") ? Date.now().toString(TIME_CALCULATIONS.TIMESTAMP_BASE) - Math.random().toString(TIME_CALCULATIONS.TIMESTAMP_BASE).substring(TIME_CALCULATIONS.RANDOM_ID_START, TIME_CALCULATIONS.RANDOM_ID_END) : (stryCov_9fa48("4866"), Date.now().toString(TIME_CALCULATIONS.TIMESTAMP_BASE) + (stryMutAct_9fa48("4867") ? Math.random().toString(TIME_CALCULATIONS.TIMESTAMP_BASE) : (stryCov_9fa48("4867"), Math.random().toString(TIME_CALCULATIONS.TIMESTAMP_BASE).substring(TIME_CALCULATIONS.RANDOM_ID_START, TIME_CALCULATIONS.RANDOM_ID_END))));
  }
}
export function sleep(ms: number): Promise<void> {
  if (stryMutAct_9fa48("4868")) {
    {}
  } else {
    stryCov_9fa48("4868");
    return new Promise(stryMutAct_9fa48("4869") ? () => undefined : (stryCov_9fa48("4869"), resolve => setTimeout(resolve, ms)));
  }
}