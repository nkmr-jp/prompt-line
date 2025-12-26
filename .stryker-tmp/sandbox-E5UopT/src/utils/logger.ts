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
import type { LogLevel } from '../types';
import config from "../config/app-config";

// Sensitive information patterns for masking
const SENSITIVE_PATTERNS = stryMutAct_9fa48("4887") ? [] : (stryCov_9fa48("4887"), [stryMutAct_9fa48("4888") ? {} : (stryCov_9fa48("4888"), {
  pattern: stryMutAct_9fa48("4896") ? /password['":\s]*['"]?[\W!@#$%^&*]+/gi : stryMutAct_9fa48("4895") ? /password['":\s]*['"]?[^\w!@#$%^&*]+/gi : stryMutAct_9fa48("4894") ? /password['":\s]*['"]?[\w!@#$%^&*]/gi : stryMutAct_9fa48("4893") ? /password['":\s]*[^'"]?[\w!@#$%^&*]+/gi : stryMutAct_9fa48("4892") ? /password['":\s]*['"][\w!@#$%^&*]+/gi : stryMutAct_9fa48("4891") ? /password['":\S]*['"]?[\w!@#$%^&*]+/gi : stryMutAct_9fa48("4890") ? /password[^'":\s]*['"]?[\w!@#$%^&*]+/gi : stryMutAct_9fa48("4889") ? /password['":\s]['"]?[\w!@#$%^&*]+/gi : (stryCov_9fa48("4889", "4890", "4891", "4892", "4893", "4894", "4895", "4896"), /password['":\s]*['"]?[\w!@#$%^&*]+/gi),
  replacement: stryMutAct_9fa48("4897") ? "" : (stryCov_9fa48("4897"), 'password: [MASKED]')
}), stryMutAct_9fa48("4898") ? {} : (stryCov_9fa48("4898"), {
  pattern: stryMutAct_9fa48("4906") ? /token['":\s]*['"]?[\W\-.]+/gi : stryMutAct_9fa48("4905") ? /token['":\s]*['"]?[^\w\-.]+/gi : stryMutAct_9fa48("4904") ? /token['":\s]*['"]?[\w\-.]/gi : stryMutAct_9fa48("4903") ? /token['":\s]*[^'"]?[\w\-.]+/gi : stryMutAct_9fa48("4902") ? /token['":\s]*['"][\w\-.]+/gi : stryMutAct_9fa48("4901") ? /token['":\S]*['"]?[\w\-.]+/gi : stryMutAct_9fa48("4900") ? /token[^'":\s]*['"]?[\w\-.]+/gi : stryMutAct_9fa48("4899") ? /token['":\s]['"]?[\w\-.]+/gi : (stryCov_9fa48("4899", "4900", "4901", "4902", "4903", "4904", "4905", "4906"), /token['":\s]*['"]?[\w\-.]+/gi),
  replacement: stryMutAct_9fa48("4907") ? "" : (stryCov_9fa48("4907"), 'token: [MASKED]')
}), stryMutAct_9fa48("4908") ? {} : (stryCov_9fa48("4908"), {
  pattern: stryMutAct_9fa48("4918") ? /api[_-]?key['":\s]*['"]?[\W-]+/gi : stryMutAct_9fa48("4917") ? /api[_-]?key['":\s]*['"]?[^\w-]+/gi : stryMutAct_9fa48("4916") ? /api[_-]?key['":\s]*['"]?[\w-]/gi : stryMutAct_9fa48("4915") ? /api[_-]?key['":\s]*[^'"]?[\w-]+/gi : stryMutAct_9fa48("4914") ? /api[_-]?key['":\s]*['"][\w-]+/gi : stryMutAct_9fa48("4913") ? /api[_-]?key['":\S]*['"]?[\w-]+/gi : stryMutAct_9fa48("4912") ? /api[_-]?key[^'":\s]*['"]?[\w-]+/gi : stryMutAct_9fa48("4911") ? /api[_-]?key['":\s]['"]?[\w-]+/gi : stryMutAct_9fa48("4910") ? /api[^_-]?key['":\s]*['"]?[\w-]+/gi : stryMutAct_9fa48("4909") ? /api[_-]key['":\s]*['"]?[\w-]+/gi : (stryCov_9fa48("4909", "4910", "4911", "4912", "4913", "4914", "4915", "4916", "4917", "4918"), /api[_-]?key['":\s]*['"]?[\w-]+/gi),
  replacement: stryMutAct_9fa48("4919") ? "" : (stryCov_9fa48("4919"), 'api_key: [MASKED]')
}), stryMutAct_9fa48("4920") ? {} : (stryCov_9fa48("4920"), {
  pattern: stryMutAct_9fa48("4928") ? /secret['":\s]*['"]?[\W-]+/gi : stryMutAct_9fa48("4927") ? /secret['":\s]*['"]?[^\w-]+/gi : stryMutAct_9fa48("4926") ? /secret['":\s]*['"]?[\w-]/gi : stryMutAct_9fa48("4925") ? /secret['":\s]*[^'"]?[\w-]+/gi : stryMutAct_9fa48("4924") ? /secret['":\s]*['"][\w-]+/gi : stryMutAct_9fa48("4923") ? /secret['":\S]*['"]?[\w-]+/gi : stryMutAct_9fa48("4922") ? /secret[^'":\s]*['"]?[\w-]+/gi : stryMutAct_9fa48("4921") ? /secret['":\s]['"]?[\w-]+/gi : (stryCov_9fa48("4921", "4922", "4923", "4924", "4925", "4926", "4927", "4928"), /secret['":\s]*['"]?[\w-]+/gi),
  replacement: stryMutAct_9fa48("4929") ? "" : (stryCov_9fa48("4929"), 'secret: [MASKED]')
}), stryMutAct_9fa48("4930") ? {} : (stryCov_9fa48("4930"), {
  pattern: stryMutAct_9fa48("4938") ? /authorization['":\s]*['"]?Bearer [\W\-.]+/gi : stryMutAct_9fa48("4937") ? /authorization['":\s]*['"]?Bearer [^\w\-.]+/gi : stryMutAct_9fa48("4936") ? /authorization['":\s]*['"]?Bearer [\w\-.]/gi : stryMutAct_9fa48("4935") ? /authorization['":\s]*[^'"]?Bearer [\w\-.]+/gi : stryMutAct_9fa48("4934") ? /authorization['":\s]*['"]Bearer [\w\-.]+/gi : stryMutAct_9fa48("4933") ? /authorization['":\S]*['"]?Bearer [\w\-.]+/gi : stryMutAct_9fa48("4932") ? /authorization[^'":\s]*['"]?Bearer [\w\-.]+/gi : stryMutAct_9fa48("4931") ? /authorization['":\s]['"]?Bearer [\w\-.]+/gi : (stryCov_9fa48("4931", "4932", "4933", "4934", "4935", "4936", "4937", "4938"), /authorization['":\s]*['"]?Bearer [\w\-.]+/gi),
  replacement: stryMutAct_9fa48("4939") ? "" : (stryCov_9fa48("4939"), 'authorization: Bearer [MASKED]')
})]);

// Sensitive key names that should be masked
const SENSITIVE_KEYS = stryMutAct_9fa48("4940") ? [] : (stryCov_9fa48("4940"), [stryMutAct_9fa48("4941") ? "" : (stryCov_9fa48("4941"), 'password'), stryMutAct_9fa48("4942") ? "" : (stryCov_9fa48("4942"), 'token'), stryMutAct_9fa48("4943") ? "" : (stryCov_9fa48("4943"), 'secret'), stryMutAct_9fa48("4944") ? "" : (stryCov_9fa48("4944"), 'apikey'), stryMutAct_9fa48("4945") ? "" : (stryCov_9fa48("4945"), 'api_key'), stryMutAct_9fa48("4946") ? "" : (stryCov_9fa48("4946"), 'authorization'), stryMutAct_9fa48("4947") ? "" : (stryCov_9fa48("4947"), 'bearer'), stryMutAct_9fa48("4948") ? "" : (stryCov_9fa48("4948"), 'auth')]);

/**
 * Masks sensitive data in strings and objects before logging
 * @param data - Data to mask (string, object, or primitive)
 * @returns Masked data with sensitive information replaced
 */
export function maskSensitiveData(data: unknown): unknown {
  if (stryMutAct_9fa48("4949")) {
    {}
  } else {
    stryCov_9fa48("4949");
    if (stryMutAct_9fa48("4952") ? typeof data !== 'string' : stryMutAct_9fa48("4951") ? false : stryMutAct_9fa48("4950") ? true : (stryCov_9fa48("4950", "4951", "4952"), typeof data === (stryMutAct_9fa48("4953") ? "" : (stryCov_9fa48("4953"), 'string')))) {
      if (stryMutAct_9fa48("4954")) {
        {}
      } else {
        stryCov_9fa48("4954");
        let masked = data;
        for (const {
          pattern,
          replacement
        } of SENSITIVE_PATTERNS) {
          if (stryMutAct_9fa48("4955")) {
            {}
          } else {
            stryCov_9fa48("4955");
            masked = masked.replace(pattern, replacement);
          }
        }
        return masked;
      }
    }
    if (stryMutAct_9fa48("4958") ? typeof data === 'object' || data !== null : stryMutAct_9fa48("4957") ? false : stryMutAct_9fa48("4956") ? true : (stryCov_9fa48("4956", "4957", "4958"), (stryMutAct_9fa48("4960") ? typeof data !== 'object' : stryMutAct_9fa48("4959") ? true : (stryCov_9fa48("4959", "4960"), typeof data === (stryMutAct_9fa48("4961") ? "" : (stryCov_9fa48("4961"), 'object')))) && (stryMutAct_9fa48("4963") ? data === null : stryMutAct_9fa48("4962") ? true : (stryCov_9fa48("4962", "4963"), data !== null)))) {
      if (stryMutAct_9fa48("4964")) {
        {}
      } else {
        stryCov_9fa48("4964");
        if (stryMutAct_9fa48("4966") ? false : stryMutAct_9fa48("4965") ? true : (stryCov_9fa48("4965", "4966"), Array.isArray(data))) {
          if (stryMutAct_9fa48("4967")) {
            {}
          } else {
            stryCov_9fa48("4967");
            return data.map(stryMutAct_9fa48("4968") ? () => undefined : (stryCov_9fa48("4968"), item => maskSensitiveData(item)));
          }
        }
        const masked: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(data)) {
          if (stryMutAct_9fa48("4969")) {
            {}
          } else {
            stryCov_9fa48("4969");
            const lowerKey = stryMutAct_9fa48("4970") ? key.toUpperCase() : (stryCov_9fa48("4970"), key.toLowerCase());
            if (stryMutAct_9fa48("4973") ? SENSITIVE_KEYS.every(k => lowerKey.includes(k)) : stryMutAct_9fa48("4972") ? false : stryMutAct_9fa48("4971") ? true : (stryCov_9fa48("4971", "4972", "4973"), SENSITIVE_KEYS.some(stryMutAct_9fa48("4974") ? () => undefined : (stryCov_9fa48("4974"), k => lowerKey.includes(k))))) {
              if (stryMutAct_9fa48("4975")) {
                {}
              } else {
                stryCov_9fa48("4975");
                masked[key] = stryMutAct_9fa48("4976") ? "" : (stryCov_9fa48("4976"), '[MASKED]');
              }
            } else {
              if (stryMutAct_9fa48("4977")) {
                {}
              } else {
                stryCov_9fa48("4977");
                masked[key] = maskSensitiveData(value);
              }
            }
          }
        }
        return masked;
      }
    }
    return data;
  }
}
class Logger {
  private level: LogLevel = stryMutAct_9fa48("4978") ? "" : (stryCov_9fa48("4978"), 'info');
  private enableFileLogging: boolean = stryMutAct_9fa48("4979") ? false : (stryCov_9fa48("4979"), true);
  private logFile: string;
  constructor() {
    if (stryMutAct_9fa48("4980")) {
      {}
    } else {
      stryCov_9fa48("4980");
      // Initialize with defaults to avoid circular dependency
      this.logFile = path.join(os.homedir(), stryMutAct_9fa48("4981") ? "" : (stryCov_9fa48("4981"), '.prompt-line'), stryMutAct_9fa48("4982") ? "" : (stryCov_9fa48("4982"), 'app.log'));

      // Set actual config values after initialization if available
      this.initializeConfig();
    }
  }
  private initializeConfig(): void {
    if (stryMutAct_9fa48("4983")) {
      {}
    } else {
      stryCov_9fa48("4983");
      try {
        if (stryMutAct_9fa48("4984")) {
          {}
        } else {
          stryCov_9fa48("4984");
          if (stryMutAct_9fa48("4987") ? config || config.logging : stryMutAct_9fa48("4986") ? false : stryMutAct_9fa48("4985") ? true : (stryCov_9fa48("4985", "4986", "4987"), config && config.logging)) {
            if (stryMutAct_9fa48("4988")) {
              {}
            } else {
              stryCov_9fa48("4988");
              this.level = stryMutAct_9fa48("4991") ? config.logging.level && 'info' : stryMutAct_9fa48("4990") ? false : stryMutAct_9fa48("4989") ? true : (stryCov_9fa48("4989", "4990", "4991"), config.logging.level || (stryMutAct_9fa48("4992") ? "" : (stryCov_9fa48("4992"), 'info')));
              this.enableFileLogging = stryMutAct_9fa48("4995") ? config.logging.enableFileLogging === false : stryMutAct_9fa48("4994") ? false : stryMutAct_9fa48("4993") ? true : (stryCov_9fa48("4993", "4994", "4995"), config.logging.enableFileLogging !== (stryMutAct_9fa48("4996") ? true : (stryCov_9fa48("4996"), false)));
            }
          }
          if (stryMutAct_9fa48("4999") ? config && config.paths || config.paths.logFile : stryMutAct_9fa48("4998") ? false : stryMutAct_9fa48("4997") ? true : (stryCov_9fa48("4997", "4998", "4999"), (stryMutAct_9fa48("5001") ? config || config.paths : stryMutAct_9fa48("5000") ? true : (stryCov_9fa48("5000", "5001"), config && config.paths)) && config.paths.logFile)) {
            if (stryMutAct_9fa48("5002")) {
              {}
            } else {
              stryCov_9fa48("5002");
              this.logFile = config.paths.logFile;
            }
          }
        }
      } catch {
        // Config not available yet, use defaults
      }
    }
  }
  log(level: LogLevel, message: string, data: unknown = null): void {
    if (stryMutAct_9fa48("5003")) {
      {}
    } else {
      stryCov_9fa48("5003");
      const timestamp = new Date().toISOString();
      const logMessage = stryMutAct_9fa48("5004") ? `` : (stryCov_9fa48("5004"), `[${timestamp}] [${stryMutAct_9fa48("5005") ? level.toLowerCase() : (stryCov_9fa48("5005"), level.toUpperCase())}] ${message}`);
      if (stryMutAct_9fa48("5008") ? false : stryMutAct_9fa48("5007") ? true : stryMutAct_9fa48("5006") ? this.shouldLog(level) : (stryCov_9fa48("5006", "5007", "5008"), !this.shouldLog(level))) return;

      // Mask sensitive data before logging
      const maskedData = data ? maskSensitiveData(data) : null;
      const consoleMethod = this.getConsoleMethod(level);
      if (stryMutAct_9fa48("5010") ? false : stryMutAct_9fa48("5009") ? true : (stryCov_9fa48("5009", "5010"), maskedData)) {
        if (stryMutAct_9fa48("5011")) {
          {}
        } else {
          stryCov_9fa48("5011");
          consoleMethod(logMessage, maskedData);
        }
      } else {
        if (stryMutAct_9fa48("5012")) {
          {}
        } else {
          stryCov_9fa48("5012");
          consoleMethod(logMessage);
        }
      }
      if (stryMutAct_9fa48("5014") ? false : stryMutAct_9fa48("5013") ? true : (stryCov_9fa48("5013", "5014"), this.enableFileLogging)) {
        if (stryMutAct_9fa48("5015")) {
          {}
        } else {
          stryCov_9fa48("5015");
          this.writeToFile(logMessage, maskedData);
        }
      }
    }
  }
  private shouldLog(level: LogLevel): boolean {
    if (stryMutAct_9fa48("5016")) {
      {}
    } else {
      stryCov_9fa48("5016");
      const levels: Record<LogLevel, number> = stryMutAct_9fa48("5017") ? {} : (stryCov_9fa48("5017"), {
        debug: 0,
        info: 1,
        warn: 2,
        error: 3
      });
      return stryMutAct_9fa48("5021") ? levels[level] < levels[this.level] : stryMutAct_9fa48("5020") ? levels[level] > levels[this.level] : stryMutAct_9fa48("5019") ? false : stryMutAct_9fa48("5018") ? true : (stryCov_9fa48("5018", "5019", "5020", "5021"), levels[level] >= levels[this.level]);
    }
  }
  private getConsoleMethod(level: LogLevel): typeof console.log {
    if (stryMutAct_9fa48("5022")) {
      {}
    } else {
      stryCov_9fa48("5022");
      switch (level) {
        case stryMutAct_9fa48("5024") ? "" : (stryCov_9fa48("5024"), 'debug'):
          if (stryMutAct_9fa48("5023")) {} else {
            stryCov_9fa48("5023");
            return console.debug;
          }
        case stryMutAct_9fa48("5026") ? "" : (stryCov_9fa48("5026"), 'info'):
          if (stryMutAct_9fa48("5025")) {} else {
            stryCov_9fa48("5025");
            return console.info;
          }
        case stryMutAct_9fa48("5028") ? "" : (stryCov_9fa48("5028"), 'warn'):
          if (stryMutAct_9fa48("5027")) {} else {
            stryCov_9fa48("5027");
            return console.warn;
          }
        case stryMutAct_9fa48("5030") ? "" : (stryCov_9fa48("5030"), 'error'):
          if (stryMutAct_9fa48("5029")) {} else {
            stryCov_9fa48("5029");
            return console.error;
          }
        default:
          if (stryMutAct_9fa48("5031")) {} else {
            stryCov_9fa48("5031");
            return console.log;
          }
      }
    }
  }
  private writeToFile(message: string, data: unknown): void {
    if (stryMutAct_9fa48("5032")) {
      {}
    } else {
      stryCov_9fa48("5032");
      const fullMessage = data ? stryMutAct_9fa48("5033") ? `` : (stryCov_9fa48("5033"), `${message} ${JSON.stringify(data)}\n`) : stryMutAct_9fa48("5034") ? `` : (stryCov_9fa48("5034"), `${message}\n`);
      fs.appendFile(this.logFile, fullMessage).catch(err => {
        if (stryMutAct_9fa48("5035")) {
          {}
        } else {
          stryCov_9fa48("5035");
          console.error(stryMutAct_9fa48("5036") ? "" : (stryCov_9fa48("5036"), 'Failed to write to log file:'), err);
        }
      });
    }
  }
  debug(message: string, data?: unknown): void {
    if (stryMutAct_9fa48("5037")) {
      {}
    } else {
      stryCov_9fa48("5037");
      this.log(stryMutAct_9fa48("5038") ? "" : (stryCov_9fa48("5038"), 'debug'), message, data);
    }
  }
  info(message: string, data?: unknown): void {
    if (stryMutAct_9fa48("5039")) {
      {}
    } else {
      stryCov_9fa48("5039");
      this.log(stryMutAct_9fa48("5040") ? "" : (stryCov_9fa48("5040"), 'info'), message, data);
    }
  }
  warn(message: string, data?: unknown): void {
    if (stryMutAct_9fa48("5041")) {
      {}
    } else {
      stryCov_9fa48("5041");
      this.log(stryMutAct_9fa48("5042") ? "" : (stryCov_9fa48("5042"), 'warn'), message, data);
    }
  }
  error(message: string, data?: unknown): void {
    if (stryMutAct_9fa48("5043")) {
      {}
    } else {
      stryCov_9fa48("5043");
      this.log(stryMutAct_9fa48("5044") ? "" : (stryCov_9fa48("5044"), 'error'), message, data);
    }
  }
}
export const logger = new Logger();