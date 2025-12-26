/**
 * AppleScript Sanitizer - Sanitization for safe AppleScript execution
 * 
 * Escapes all dangerous characters to safely execute AppleScript commands
 * and prevents injection attacks.
 */
// @ts-nocheck


/**
 * Safely sanitize AppleScript commands
 * Escapes all dangerous characters to prevent injection attacks
 * 
 * @param input - AppleScript string to sanitize
 * @returns Sanitized safe AppleScript string
 * @throws Error - If input is not a string or too long
 */function stryNS_9fa48() {
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
export function sanitizeAppleScript(input: string): string {
  if (stryMutAct_9fa48("4779")) {
    {}
  } else {
    stryCov_9fa48("4779");
    // Input validation
    if (stryMutAct_9fa48("4782") ? typeof input === 'string' : stryMutAct_9fa48("4781") ? false : stryMutAct_9fa48("4780") ? true : (stryCov_9fa48("4780", "4781", "4782"), typeof input !== (stryMutAct_9fa48("4783") ? "" : (stryCov_9fa48("4783"), 'string')))) {
      if (stryMutAct_9fa48("4784")) {
        {}
      } else {
        stryCov_9fa48("4784");
        throw new Error(stryMutAct_9fa48("4785") ? "" : (stryCov_9fa48("4785"), 'Input must be a string'));
      }
    }

    // 最大長制限（64KB）- AppleScriptの実用的な上限
    if (stryMutAct_9fa48("4789") ? input.length <= 65536 : stryMutAct_9fa48("4788") ? input.length >= 65536 : stryMutAct_9fa48("4787") ? false : stryMutAct_9fa48("4786") ? true : (stryCov_9fa48("4786", "4787", "4788", "4789"), input.length > 65536)) {
      if (stryMutAct_9fa48("4790")) {
        {}
      } else {
        stryCov_9fa48("4790");
        throw new Error(stryMutAct_9fa48("4791") ? "" : (stryCov_9fa48("4791"), 'AppleScript input too long (max 64KB)'));
      }
    }
    return input
    // Remove NULL character (process first to avoid interference)
    .replace(/\x00/g, stryMutAct_9fa48("4792") ? "Stryker was here!" : (stryCov_9fa48("4792"), ''))
    // Remove other control characters (ASCII 1-31, 127) except \n, \r, \t
    .replace(stryMutAct_9fa48("4793") ? /[^\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g : (stryCov_9fa48("4793"), /[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g), stryMutAct_9fa48("4794") ? "Stryker was here!" : (stryCov_9fa48("4794"), ''))
    // Backslash (must be processed first to avoid double-escaping)
    .replace(/\\/g, stryMutAct_9fa48("4795") ? "" : (stryCov_9fa48("4795"), '\\\\'))
    // Single quotes: In shell single-quoted strings, single quotes cannot be escaped with backslash
    // The only way is to end the quoted string, add escaped quote, then start new quoted string
    // Use '\'' which is more readable than '\"'\"'
    .replace(/'/g, stryMutAct_9fa48("4796") ? "" : (stryCov_9fa48("4796"), "'\\''"))
    // Double quotes (escape for AppleScript content)  
    .replace(/"/g, stryMutAct_9fa48("4797") ? "" : (stryCov_9fa48("4797"), '\\"'))
    // 改行文字 (escape for AppleScript content)
    .replace(/\n/g, stryMutAct_9fa48("4798") ? "" : (stryCov_9fa48("4798"), '\\n'))
    // Carriage return (escape for AppleScript content)
    .replace(/\r/g, stryMutAct_9fa48("4799") ? "" : (stryCov_9fa48("4799"), '\\r'))
    // Tab character (escape for AppleScript content)
    .replace(/\t/g, stryMutAct_9fa48("4800") ? "" : (stryCov_9fa48("4800"), '\\t'))
    // These characters don't need escaping in shell single quotes, but we escape for AppleScript
    // Dollar sign (prevent variable expansion)
    .replace(/\$/g, stryMutAct_9fa48("4801") ? "" : (stryCov_9fa48("4801"), '\\$'))
    // Backtick (prevent command execution)
    .replace(/`/g, stryMutAct_9fa48("4802") ? "" : (stryCov_9fa48("4802"), '\\`'));
  }
}

/**
 * Wrapper function for safe AppleScript execution
 * Includes sanitization and timeout handling
 * 
 * @param script - AppleScript to execute
 * @param timeout - Timeout in milliseconds (default: 3000)
 * @returns Promise<string> - AppleScript execution result
 */
export function executeAppleScriptSafely(script: string, timeout: number = 3000): Promise<string> {
  if (stryMutAct_9fa48("4803")) {
    {}
  } else {
    stryCov_9fa48("4803");
    return new Promise((resolve, reject) => {
      if (stryMutAct_9fa48("4804")) {
        {}
      } else {
        stryCov_9fa48("4804");
        try {
          if (stryMutAct_9fa48("4805")) {
            {}
          } else {
            stryCov_9fa48("4805");
            const sanitizedScript = sanitizeAppleScript(script);

            // Dynamic import of child_process to avoid circular dependencies
            const {
              exec
            } = require('child_process');
            exec(stryMutAct_9fa48("4806") ? `` : (stryCov_9fa48("4806"), `osascript -e '${sanitizedScript}'`), stryMutAct_9fa48("4807") ? {} : (stryCov_9fa48("4807"), {
              timeout,
              killSignal: 'SIGTERM' as const
            }), (error: any, stdout: string, stderr: string) => {
              if (stryMutAct_9fa48("4808")) {
                {}
              } else {
                stryCov_9fa48("4808");
                if (stryMutAct_9fa48("4810") ? false : stryMutAct_9fa48("4809") ? true : (stryCov_9fa48("4809", "4810"), error)) {
                  if (stryMutAct_9fa48("4811")) {
                    {}
                  } else {
                    stryCov_9fa48("4811");
                    reject(new Error(stryMutAct_9fa48("4812") ? `` : (stryCov_9fa48("4812"), `AppleScript execution failed: ${error.message}`)));
                    return;
                  }
                }
                if (stryMutAct_9fa48("4815") ? stderr || stderr.trim() : stryMutAct_9fa48("4814") ? false : stryMutAct_9fa48("4813") ? true : (stryCov_9fa48("4813", "4814", "4815"), stderr && (stryMutAct_9fa48("4816") ? stderr : (stryCov_9fa48("4816"), stderr.trim())))) {
                  if (stryMutAct_9fa48("4817")) {
                    {}
                  } else {
                    stryCov_9fa48("4817");
                    reject(new Error(stryMutAct_9fa48("4818") ? `` : (stryCov_9fa48("4818"), `AppleScript stderr: ${stryMutAct_9fa48("4819") ? stderr : (stryCov_9fa48("4819"), stderr.trim())}`)));
                    return;
                  }
                }
                resolve(stryMutAct_9fa48("4820") ? stdout : (stryCov_9fa48("4820"), stdout.trim()));
              }
            });
          }
        } catch (error) {
          if (stryMutAct_9fa48("4821")) {
            {}
          } else {
            stryCov_9fa48("4821");
            reject(error);
          }
        }
      }
    });
  }
}

/**
 * Security validation for AppleScript execution
 * Checks for dangerous patterns and outputs warnings
 * 
 * @param script - AppleScript to validate
 * @returns Array of warnings if dangerous patterns are detected
 */
export function validateAppleScriptSecurity(script: string): string[] {
  if (stryMutAct_9fa48("4822")) {
    {}
  } else {
    stryCov_9fa48("4822");
    const warnings: string[] = stryMutAct_9fa48("4823") ? ["Stryker was here"] : (stryCov_9fa48("4823"), []);

    // 危険なパターンのチェック
    const dangerousPatterns = stryMutAct_9fa48("4824") ? [] : (stryCov_9fa48("4824"), [stryMutAct_9fa48("4825") ? {} : (stryCov_9fa48("4825"), {
      pattern: /do shell script/i,
      warning: stryMutAct_9fa48("4826") ? "" : (stryCov_9fa48("4826"), 'shell script execution detected')
    }), stryMutAct_9fa48("4827") ? {} : (stryCov_9fa48("4827"), {
      pattern: stryMutAct_9fa48("4828") ? /system events.keystroke/i : (stryCov_9fa48("4828"), /system events.*keystroke/i),
      warning: stryMutAct_9fa48("4829") ? "" : (stryCov_9fa48("4829"), 'keystroke injection detected')
    }), stryMutAct_9fa48("4830") ? {} : (stryCov_9fa48("4830"), {
      pattern: stryMutAct_9fa48("4832") ? /tell application ".*".quit/i : stryMutAct_9fa48("4831") ? /tell application ".".*quit/i : (stryCov_9fa48("4831", "4832"), /tell application ".*".*quit/i),
      warning: stryMutAct_9fa48("4833") ? "" : (stryCov_9fa48("4833"), 'application termination detected')
    }), stryMutAct_9fa48("4834") ? {} : (stryCov_9fa48("4834"), {
      pattern: /delete|remove|trash/i,
      warning: stryMutAct_9fa48("4835") ? "" : (stryCov_9fa48("4835"), 'file deletion commands detected')
    }), stryMutAct_9fa48("4836") ? {} : (stryCov_9fa48("4836"), {
      pattern: /password|credential/i,
      warning: stryMutAct_9fa48("4837") ? "" : (stryCov_9fa48("4837"), 'sensitive data access detected')
    })]);
    for (const {
      pattern,
      warning
    } of dangerousPatterns) {
      if (stryMutAct_9fa48("4838")) {
        {}
      } else {
        stryCov_9fa48("4838");
        if (stryMutAct_9fa48("4840") ? false : stryMutAct_9fa48("4839") ? true : (stryCov_9fa48("4839", "4840"), pattern.test(script))) {
          if (stryMutAct_9fa48("4841")) {
            {}
          } else {
            stryCov_9fa48("4841");
            warnings.push(warning);
          }
        }
      }
    }
    return warnings;
  }
}