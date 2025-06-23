import { 
  sanitizeAppleScript, 
  validateAppleScriptSecurity 
} from '../../src/utils/apple-script-sanitizer';

describe('AppleScript Sanitizer', () => {
  describe('sanitizeAppleScript', () => {
    test('should escape single quotes properly for shell single-quoted context', () => {
      const input = "tell application 'Finder'";
      const expected = "tell application '\\''Finder'\\''";
      expect(sanitizeAppleScript(input)).toBe(expected);
    });

    test('should prevent command injection', () => {
      const input = "'; rm -rf /; echo '";
      const expected = "'\\''; rm -rf /; echo '\\''";
      expect(sanitizeAppleScript(input)).toBe(expected);
    });

    test('should handle newlines and special characters', () => {
      const input = "line1\nline2\tline3$var`cmd`";
      const expected = "line1\\nline2\\tline3\\$var\\`cmd\\`";
      expect(sanitizeAppleScript(input)).toBe(expected);
    });

    test('should escape double quotes', () => {
      const input = 'tell application "Terminal"';
      const expected = 'tell application \\"Terminal\\"';
      expect(sanitizeAppleScript(input)).toBe(expected);
    });

    test('should escape backslashes', () => {
      const input = 'path\\to\\file';
      const expected = 'path\\\\to\\\\file';
      expect(sanitizeAppleScript(input)).toBe(expected);
    });

    test('should handle carriage returns', () => {
      const input = 'line1\rline2';
      const expected = 'line1\\rline2';
      expect(sanitizeAppleScript(input)).toBe(expected);
    });

    test('should remove NULL characters', () => {
      const input = 'text\x00null';
      const expected = 'textnull';
      expect(sanitizeAppleScript(input)).toBe(expected);
    });

    test('should remove control characters', () => {
      const input = 'text\x01\x08\x0B\x0C\x0E\x1F\x7Fcontrol';
      const expected = 'textcontrol';
      expect(sanitizeAppleScript(input)).toBe(expected);
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
      // Test that the escaped string would be safe when used in osascript -e 'ESCAPED_STRING'
      const input = "It's a test";
      const result = sanitizeAppleScript(input);
      expect(result).toBe("It'\\''s a test");
      
      // The shell command would be: osascript -e 'It'\''s a test'
      // Which shell interprets as: osascript -e It's a test (three concatenated parts)
    });

    test('should handle multiple consecutive single quotes', () => {
      const input = "'''";
      const result = sanitizeAppleScript(input);
      expect(result).toBe("'\\'''\\'''\\''");
    });

    test('should handle mixed quotes and special characters', () => {
      const input = `'hello' "world" \\ \n \t $ \``;
      const result = sanitizeAppleScript(input);
      expect(result).toBe(`'\\''hello'\\'' \\"world\\" \\\\ \\n \\t \\$ \\` + '`');
    });
  });

  describe('validateAppleScriptSecurity', () => {
    test('should detect shell script execution', () => {
      const script = 'do shell script "rm -rf /"';
      const warnings = validateAppleScriptSecurity(script);
      expect(warnings).toContain('shell script execution detected');
    });

    test('should detect keystroke injection', () => {
      const script = 'tell application "System Events" to keystroke "malicious"';
      const warnings = validateAppleScriptSecurity(script);
      expect(warnings).toContain('keystroke injection detected');
    });

    test('should detect application termination', () => {
      const script = 'tell application "Terminal" to quit';
      const warnings = validateAppleScriptSecurity(script);
      expect(warnings).toContain('application termination detected');
    });

    test('should detect file deletion commands', () => {
      const script1 = 'delete file "important.txt"';
      const script2 = 'remove folder "documents"';
      const script3 = 'move to trash';
      
      expect(validateAppleScriptSecurity(script1)).toContain('file deletion commands detected');
      expect(validateAppleScriptSecurity(script2)).toContain('file deletion commands detected');
      expect(validateAppleScriptSecurity(script3)).toContain('file deletion commands detected');
    });

    test('should detect sensitive data access', () => {
      const script1 = 'get password from keychain';
      const script2 = 'access credential store';
      
      expect(validateAppleScriptSecurity(script1)).toContain('sensitive data access detected');
      expect(validateAppleScriptSecurity(script2)).toContain('sensitive data access detected');
    });

    test('should return empty array for safe scripts', () => {
      const safeScript = `
        tell application "System Events"
          try
            set frontApp to first application process whose frontmost is true
            return name of frontApp
          end try
        end tell
      `.trim();
      
      const warnings = validateAppleScriptSecurity(safeScript);
      expect(warnings).toEqual([]);
    });

    test('should be case insensitive', () => {
      const script = 'DO SHELL SCRIPT "echo test"';
      const warnings = validateAppleScriptSecurity(script);
      expect(warnings).toContain('shell script execution detected');
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