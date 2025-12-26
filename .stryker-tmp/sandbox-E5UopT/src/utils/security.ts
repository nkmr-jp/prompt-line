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
import { logger } from './logger';

// Secure error messages (user-facing - no internal information)
export const SecureErrors = {
  INVALID_INPUT: 'Invalid input provided',
  OPERATION_FAILED: 'Operation failed',
  FILE_NOT_FOUND: 'File not found',
  PERMISSION_DENIED: 'Permission denied',
  INTERNAL_ERROR: 'An internal error occurred',
  INVALID_FORMAT: 'Invalid format',
  SIZE_LIMIT_EXCEEDED: 'Size limit exceeded'
} as const;

// Error handler helper - separates user-facing and internal log messages
export function handleError(error: Error, context: string): {
  logMessage: string;
  userMessage: string;
} {
  if (stryMutAct_9fa48("5497")) {
    {}
  } else {
    stryCov_9fa48("5497");
    return stryMutAct_9fa48("5498") ? {} : (stryCov_9fa48("5498"), {
      logMessage: stryMutAct_9fa48("5499") ? `` : (stryCov_9fa48("5499"), `${context}: ${error.message}`),
      userMessage: SecureErrors.OPERATION_FAILED
    });
  }
}

/**
 * Sanitizes command line arguments to prevent command injection
 * Removes dangerous characters and limits length for safe shell execution
 * @param input - The input string to sanitize
 * @param maxLength - Maximum allowed length (default: 256)
 * @returns Sanitized string safe for command execution
 */
export function sanitizeCommandArgument(input: string, maxLength = 256): string {
  if (stryMutAct_9fa48("5500")) {
    {}
  } else {
    stryCov_9fa48("5500");
    if (stryMutAct_9fa48("5503") ? typeof input === 'string' : stryMutAct_9fa48("5502") ? false : stryMutAct_9fa48("5501") ? true : (stryCov_9fa48("5501", "5502", "5503"), typeof input !== (stryMutAct_9fa48("5504") ? "" : (stryCov_9fa48("5504"), 'string')))) {
      if (stryMutAct_9fa48("5505")) {
        {}
      } else {
        stryCov_9fa48("5505");
        throw new Error(stryMutAct_9fa48("5506") ? "" : (stryCov_9fa48("5506"), 'Input must be a string'));
      }
    }

    // Limit input length to prevent buffer overflows
    if (stryMutAct_9fa48("5510") ? input.length <= maxLength : stryMutAct_9fa48("5509") ? input.length >= maxLength : stryMutAct_9fa48("5508") ? false : stryMutAct_9fa48("5507") ? true : (stryCov_9fa48("5507", "5508", "5509", "5510"), input.length > maxLength)) {
      if (stryMutAct_9fa48("5511")) {
        {}
      } else {
        stryCov_9fa48("5511");
        logger.warn(stryMutAct_9fa48("5512") ? `` : (stryCov_9fa48("5512"), `Command argument truncated from ${input.length} to ${maxLength} characters`));
        input = stryMutAct_9fa48("5513") ? input : (stryCov_9fa48("5513"), input.substring(0, maxLength));
      }
    }

    // Remove dangerous characters that could be used for command injection
    // Allow only alphanumeric, dots, hyphens, underscores, spaces, and safe punctuation
    const sanitized = stryMutAct_9fa48("5514") ? input.replace(/[;&|`$(){}[\]<>"'\\*?~^]/g, '') // Remove shell metacharacters
    .replace(/\x00/g, '') // Remove null bytes
    .replace(/[\r\n]/g, '') // Remove newlines
    : (stryCov_9fa48("5514"), input.replace(stryMutAct_9fa48("5515") ? /[^;&|`$(){}[\]<>"'\\*?~^]/g : (stryCov_9fa48("5515"), /[;&|`$(){}[\]<>"'\\*?~^]/g), stryMutAct_9fa48("5516") ? "Stryker was here!" : (stryCov_9fa48("5516"), '')) // Remove shell metacharacters
    .replace(/\x00/g, stryMutAct_9fa48("5517") ? "Stryker was here!" : (stryCov_9fa48("5517"), '')) // Remove null bytes
    .replace(stryMutAct_9fa48("5518") ? /[^\r\n]/g : (stryCov_9fa48("5518"), /[\r\n]/g), stryMutAct_9fa48("5519") ? "Stryker was here!" : (stryCov_9fa48("5519"), '')) // Remove newlines
    .trim()); // Remove leading/trailing whitespace

    // Log if sanitization occurred
    if (stryMutAct_9fa48("5522") ? sanitized === input.trim() : stryMutAct_9fa48("5521") ? false : stryMutAct_9fa48("5520") ? true : (stryCov_9fa48("5520", "5521", "5522"), sanitized !== (stryMutAct_9fa48("5523") ? input : (stryCov_9fa48("5523"), input.trim())))) {
      if (stryMutAct_9fa48("5524")) {
        {}
      } else {
        stryCov_9fa48("5524");
        logger.warn(stryMutAct_9fa48("5525") ? "" : (stryCov_9fa48("5525"), 'Command argument sanitized'), stryMutAct_9fa48("5526") ? {} : (stryCov_9fa48("5526"), {
          original: input,
          sanitized,
          removedChars: stryMutAct_9fa48("5527") ? input.length + sanitized.length : (stryCov_9fa48("5527"), input.length - sanitized.length)
        }));
      }
    }
    return sanitized;
  }
}

/**
 * Validates that a command argument contains only safe characters
 * @param input - The input string to validate
 * @returns boolean indicating if the input is safe
 */
export function isCommandArgumentSafe(input: string): boolean {
  if (stryMutAct_9fa48("5528")) {
    {}
  } else {
    stryCov_9fa48("5528");
    if (stryMutAct_9fa48("5531") ? typeof input === 'string' : stryMutAct_9fa48("5530") ? false : stryMutAct_9fa48("5529") ? true : (stryCov_9fa48("5529", "5530", "5531"), typeof input !== (stryMutAct_9fa48("5532") ? "" : (stryCov_9fa48("5532"), 'string')))) {
      if (stryMutAct_9fa48("5533")) {
        {}
      } else {
        stryCov_9fa48("5533");
        return stryMutAct_9fa48("5534") ? true : (stryCov_9fa48("5534"), false);
      }
    }

    // Check for dangerous patterns
    const dangerousPatterns = stryMutAct_9fa48("5535") ? [] : (stryCov_9fa48("5535"), [stryMutAct_9fa48("5536") ? /[^;&|`$(){}[\]<>"'\\*?~^]/ : (stryCov_9fa48("5536"), /[;&|`$(){}[\]<>"'\\*?~^]/),
    // Shell metacharacters
    /\x00/, // Null bytes
    stryMutAct_9fa48("5537") ? /[^\r\n]/ : (stryCov_9fa48("5537"), /[\r\n]/), // Newlines
    stryMutAct_9fa48("5538") ? /-/ : (stryCov_9fa48("5538"), /^-/),
    // Arguments starting with dash (could be interpreted as flags)
    /\.\./ // Path traversal attempts
    ]);
    return stryMutAct_9fa48("5539") ? dangerousPatterns.some(pattern => pattern.test(input)) : (stryCov_9fa48("5539"), !(stryMutAct_9fa48("5540") ? dangerousPatterns.every(pattern => pattern.test(input)) : (stryCov_9fa48("5540"), dangerousPatterns.some(stryMutAct_9fa48("5541") ? () => undefined : (stryCov_9fa48("5541"), pattern => pattern.test(input))))));
  }
}