/**
 * AppleScript Sanitizer - Sanitization for safe AppleScript execution
 * 
 * Escapes all dangerous characters to safely execute AppleScript commands
 * and prevents injection attacks.
 */

/**
 * Safely sanitize AppleScript commands
 * Escapes all dangerous characters to prevent injection attacks
 * 
 * @param input - AppleScript string to sanitize
 * @returns Sanitized safe AppleScript string
 * @throws Error - If input is not a string or too long
 */
export function sanitizeAppleScript(input: string): string {
  // Input validation
  if (typeof input !== 'string') {
    throw new Error('Input must be a string');
  }

  // 最大長制限（64KB）- AppleScriptの実用的な上限
  if (input.length > 65536) {
    throw new Error('AppleScript input too long (max 64KB)');
  }

  return input
    // Remove NULL character (process first to avoid interference)
    .replace(/\x00/g, '')
    // Remove other control characters (ASCII 1-31, 127) except \n, \r, \t
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Backslash (must be processed first to avoid double-escaping)
    .replace(/\\/g, '\\\\')
    // Single quotes: In shell single-quoted strings, single quotes cannot be escaped with backslash
    // The only way is to end the quoted string, add escaped quote, then start new quoted string
    // Use '\'' which is more readable than '\"'\"'
    .replace(/'/g, "'\\''")
    // Double quotes (escape for AppleScript content)  
    .replace(/"/g, '\\"')
    // 改行文字 (escape for AppleScript content)
    .replace(/\n/g, '\\n')
    // Carriage return (escape for AppleScript content)
    .replace(/\r/g, '\\r')
    // Tab character (escape for AppleScript content)
    .replace(/\t/g, '\\t')
    // These characters don't need escaping in shell single quotes, but we escape for AppleScript
    // Dollar sign (prevent variable expansion)
    .replace(/\$/g, '\\$')
    // Backtick (prevent command execution)
    .replace(/`/g, '\\`');
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
  return new Promise((resolve, reject) => {
    try {
      const sanitizedScript = sanitizeAppleScript(script);
      
      // Dynamic import of child_process to avoid circular dependencies
      const { exec } = require('child_process');
      
      exec(`osascript -e '${sanitizedScript}'`, 
        { timeout, killSignal: 'SIGTERM' as const }, 
        (error: any, stdout: string, stderr: string) => {
          if (error) {
            reject(new Error(`AppleScript execution failed: ${error.message}`));
            return;
          }
          
          if (stderr && stderr.trim()) {
            reject(new Error(`AppleScript stderr: ${stderr.trim()}`));
            return;
          }
          
          resolve(stdout.trim());
        }
      );
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Security validation for AppleScript execution
 * Checks for dangerous patterns and outputs warnings
 * 
 * @param script - AppleScript to validate
 * @returns Array of warnings if dangerous patterns are detected
 */
export function validateAppleScriptSecurity(script: string): string[] {
  const warnings: string[] = [];
  
  // 危険なパターンのチェック
  const dangerousPatterns = [
    { pattern: /do shell script/i, warning: 'shell script execution detected' },
    { pattern: /system events.*keystroke/i, warning: 'keystroke injection detected' },
    { pattern: /tell application ".*".*quit/i, warning: 'application termination detected' },
    { pattern: /delete|remove|trash/i, warning: 'file deletion commands detected' },
    { pattern: /password|credential/i, warning: 'sensitive data access detected' }
  ];

  for (const { pattern, warning } of dangerousPatterns) {
    if (pattern.test(script)) {
      warnings.push(warning);
    }
  }

  return warnings;
}