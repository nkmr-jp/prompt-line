import {
  sanitizeAppleScript,
  validateAppleScriptSecurity
} from '../../src/utils/apple-script-sanitizer';

// Test data helpers
const TEST_CASES = {
  singleQuote: { input: "tell application 'Finder'", expected: "tell application '\\''Finder'\\''" },
  injection: { input: "'; rm -rf /; echo '", expected: "'\\''; rm -rf /; echo '\\''"},
  doubleQuote: { input: 'tell application "Terminal"', expected: 'tell application \\"Terminal\\"' },
  backslash: { input: 'path\\to\\file', expected: 'path\\\\to\\\\file' },
  carriageReturn: { input: 'line1\rline2', expected: 'line1\\rline2' },
  nullChar: { input: 'text\x00null', expected: 'textnull' },
  controlChars: { input: 'text\x01\x08\x0B\x0C\x0E\x1F\x7Fcontrol', expected: 'textcontrol' }
};

function testSanitization(input: string, expected: string): void {
  expect(sanitizeAppleScript(input)).toBe(expected);
}

describe('AppleScript Sanitizer', () => {
  describe('sanitizeAppleScript', () => {
    test('should escape single quotes properly for shell single-quoted context', () => {
      testSanitization(TEST_CASES.singleQuote.input, TEST_CASES.singleQuote.expected);
    });

    test('should prevent command injection', () => {
      testSanitization(TEST_CASES.injection.input, TEST_CASES.injection.expected);
    });

    test('should handle newlines and special characters', () => {
      const input = "line1\nline2\tline3$var`cmd`";
      const expected = "line1\\nline2\\tline3\\$var\\`cmd\\`";
      testSanitization(input, expected);
    });

    test('should escape double quotes', () => {
      testSanitization(TEST_CASES.doubleQuote.input, TEST_CASES.doubleQuote.expected);
    });

    test('should escape backslashes', () => {
      testSanitization(TEST_CASES.backslash.input, TEST_CASES.backslash.expected);
    });

    test('should handle carriage returns', () => {
      testSanitization(TEST_CASES.carriageReturn.input, TEST_CASES.carriageReturn.expected);
    });

    test('should remove NULL characters', () => {
      testSanitization(TEST_CASES.nullChar.input, TEST_CASES.nullChar.expected);
    });

    test('should remove control characters', () => {
      testSanitization(TEST_CASES.controlChars.input, TEST_CASES.controlChars.expected);
    });

    test('should reject non-string input', () => {
      expect(() => sanitizeAppleScript(null as any)).toThrow('Input must be a string');
      expect(() => sanitizeAppleScript(undefined as any)).toThrow('Input must be a string');
      expect(() => sanitizeAppleScript(123 as any)).toThrow('Input must be a string');
    });

    test('should reject overly long input', () => {
      const longInput = 'a'.repeat(70000);
      expect(() => sanitizeAppleScript(longInput)).toThrow('AppleScript input too long');
    });

    test('should handle empty string', () => {
      expect(sanitizeAppleScript('')).toBe('');
    });

    test('should handle complex injection attempt', () => {
      const maliciousInput = `'; do shell script "rm -rf /"; tell application "Terminal" to activate; '`;
      const result = sanitizeAppleScript(maliciousInput);
      expect(result).toBe(`'\\''; do shell script \\"rm -rf /\\"; tell application \\"Terminal\\" to activate; '\\''`);
    });

    test('should properly escape single quotes in shell context', () => {
      testSanitization("It's a test", "It'\\''s a test");
    });

    test('should handle multiple consecutive single quotes', () => {
      testSanitization("'''", "'\\'''\\'''\\''");
    });

    test('should handle mixed quotes and special characters', () => {
      const input = `'hello' "world" \\ \n \t $ \``;
      const result = sanitizeAppleScript(input);
      expect(result).toBe(`'\\''hello'\\'' \\"world\\" \\\\ \\n \\t \\$ \\` + '`');
    });
  });

  describe('validateAppleScriptSecurity', () => {
    function expectWarning(script: string, warning: string): void {
      expect(validateAppleScriptSecurity(script)).toContain(warning);
    }

    test('should detect shell script execution', () => {
      expectWarning('do shell script "rm -rf /"', 'shell script execution detected');
    });

    test('should detect keystroke injection', () => {
      expectWarning('tell application "System Events" to keystroke "malicious"', 'keystroke injection detected');
    });

    test('should detect application termination', () => {
      expectWarning('tell application "Terminal" to quit', 'application termination detected');
    });

    test('should detect file deletion commands', () => {
      expectWarning('delete file "important.txt"', 'file deletion commands detected');
      expectWarning('remove folder "documents"', 'file deletion commands detected');
      expectWarning('move to trash', 'file deletion commands detected');
    });

    test('should detect sensitive data access', () => {
      expectWarning('get password from keychain', 'sensitive data access detected');
      expectWarning('access credential store', 'sensitive data access detected');
    });

    test('should return empty array for safe scripts', () => {
      const safeScript = 'tell application "System Events"\n  try\n    set frontApp to first application process whose frontmost is true\n    return name of frontApp\n  end try\nend tell';
      expect(validateAppleScriptSecurity(safeScript)).toEqual([]);
    });

    test('should be case insensitive', () => {
      expectWarning('DO SHELL SCRIPT "echo test"', 'shell script execution detected');
    });

    test('should detect multiple issues', () => {
      const script = 'do shell script "rm -rf /"; tell application "Terminal" to quit; delete file "test"';
      const warnings = validateAppleScriptSecurity(script);

      expect(warnings).toContain('shell script execution detected');
      expect(warnings).toContain('application termination detected');
      expect(warnings).toContain('file deletion commands detected');
      expect(warnings.length).toBe(3);
    });
  });
});