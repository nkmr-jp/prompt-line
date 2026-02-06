/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect, beforeEach, jest } from '@jest/globals';

// Mock child_process before importing the module under test
jest.mock('child_process', () => ({
  execFile: jest.fn()
}));

// Mock the logger to prevent file writes during tests
jest.mock('../../src/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

import { execFile } from 'child_process';
import {
  checkRgAvailable,
  getSupportedLanguages,
  searchSymbols
} from '../../src/utils/symbol-search/symbol-searcher-node';

const mockedExecFile = jest.mocked(execFile);

function mockExecFileError(error: Error & { code?: number; killed?: boolean }) {
  mockedExecFile.mockImplementation(
    ((_file: any, _args: any, _options: any, callback: any) => {
      if (typeof _options === 'function') {
        _options(error);
      } else if (callback) {
        callback(error);
      }
    }) as any
  );
}

// Helper that captures rg calls made for searchSymbols
// Returns mock that responds to --version with success and rg search calls with provided stdout
function mockExecFileForSearch(rgOutput: string) {
  mockedExecFile.mockImplementation(
    ((_file: any, _args: any, _options: any, callback: any) => {
      const args = Array.isArray(_args) ? _args : [];
      const cb = typeof _options === 'function' ? _options : callback;

      // First call is checkRgAvailable (--version)
      if (args.includes('--version')) {
        cb(null, 'ripgrep 14.0.0', '');
      } else {
        // Search call
        cb(null, rgOutput, '');
      }
    }) as any
  );
}

// Helper to capture the args passed to rg for the search call
function mockExecFileCapturingArgs(rgOutput: string): { getCapturedArgs: () => string[][] } {
  const capturedArgs: string[][] = [];
  mockedExecFile.mockImplementation(
    ((_file: any, _args: any, _options: any, callback: any) => {
      const args = Array.isArray(_args) ? _args : [];
      const cb = typeof _options === 'function' ? _options : callback;

      if (args.includes('--version')) {
        cb(null, 'ripgrep 14.0.0', '');
      } else {
        capturedArgs.push(args);
        cb(null, rgOutput, '');
      }
    }) as any
  );
  return { getCapturedArgs: () => capturedArgs };
}

describe('symbol-searcher-node', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================
  // 1. LANGUAGE_CONFIGS validation
  // ============================================================
  describe('LANGUAGE_CONFIGS validation (via getSupportedLanguages)', () => {
    const EXPECTED_LANGUAGES = [
      'go', 'ts', 'tsx', 'js', 'jsx', 'py', 'rs', 'java', 'kt',
      'swift', 'rb', 'cpp', 'c', 'sh', 'make', 'php', 'cs', 'scala', 'tf', 'md'
    ];

    test('should include all 20 expected language keys', async () => {
      const { languages } = await getSupportedLanguages();
      const keys = languages.map(l => l.key);

      for (const expected of EXPECTED_LANGUAGES) {
        expect(keys).toContain(expected);
      }
      expect(languages).toHaveLength(20);
    });

    test('each language should have a displayName and extension', async () => {
      const { languages } = await getSupportedLanguages();

      for (const lang of languages) {
        expect(lang.displayName).toBeTruthy();
        expect(lang.extension).toBeTruthy();
        expect(lang.key).toBeTruthy();
      }
    });

    test('should have correct display names for key languages', async () => {
      const { languages } = await getSupportedLanguages();
      const byKey: Record<string, (typeof languages)[number]> = {};
      for (const l of languages) {
        byKey[l.key] = l;
      }

      expect(byKey['go']!.displayName).toBe('Go');
      expect(byKey['ts']!.displayName).toBe('TypeScript');
      expect(byKey['tsx']!.displayName).toBe('TypeScript React');
      expect(byKey['py']!.displayName).toBe('Python');
      expect(byKey['rs']!.displayName).toBe('Rust');
      expect(byKey['md']!.displayName).toBe('Markdown');
      expect(byKey['tf']!.displayName).toBe('Terraform');
    });

    test('should have correct extensions', async () => {
      const { languages } = await getSupportedLanguages();
      const byKey: Record<string, (typeof languages)[number]> = {};
      for (const l of languages) {
        byKey[l.key] = l;
      }

      expect(byKey['go']!.extension).toBe('.go');
      expect(byKey['ts']!.extension).toBe('.ts');
      expect(byKey['tsx']!.extension).toBe('.tsx');
      expect(byKey['js']!.extension).toBe('.js');
      expect(byKey['py']!.extension).toBe('.py');
      expect(byKey['rs']!.extension).toBe('.rs');
      expect(byKey['md']!.extension).toBe('.md');
      expect(byKey['c']!.extension).toBe('.c');
      expect(byKey['sh']!.extension).toBe('.sh');
    });
  });

  // ============================================================
  // 2. Pattern matching tests
  // ============================================================
  describe('Pattern matching via searchSymbols output parsing', () => {
    describe('Go patterns', () => {
      test('should match Go function declarations', async () => {
        const output = '/project/main.go:10:func HandleRequest(w http.ResponseWriter, r *http.Request) {';
        mockExecFileForSearch(output);

        const result = await searchSymbols('/project', 'go');
        expect(result.success).toBe(true);
        expect(result.symbols).toHaveLength(1);
        expect(result.symbols[0]!.name).toBe('HandleRequest');
        expect(result.symbols[0]!.type).toBe('function');
      });

      test('should match Go method declarations', async () => {
        const output = '/project/server.go:20:func (s *Server) Start(port int) error {';
        mockExecFileForSearch(output);

        const result = await searchSymbols('/project', 'go');
        expect(result.success).toBe(true);
        expect(result.symbols).toHaveLength(1);
        expect(result.symbols[0]!.name).toBe('Start');
        expect(result.symbols[0]!.type).toBe('method');
      });

      test('should match Go struct declarations', async () => {
        const output = '/project/types.go:5:type Config struct {';
        mockExecFileForSearch(output);

        const result = await searchSymbols('/project', 'go');
        expect(result.success).toBe(true);
        expect(result.symbols[0]!.name).toBe('Config');
        expect(result.symbols[0]!.type).toBe('struct');
      });

      test('should match Go interface declarations', async () => {
        const output = '/project/types.go:15:type Handler interface {';
        mockExecFileForSearch(output);

        const result = await searchSymbols('/project', 'go');
        expect(result.success).toBe(true);
        expect(result.symbols[0]!.name).toBe('Handler');
        expect(result.symbols[0]!.type).toBe('interface');
      });

      test('should match Go type aliases', async () => {
        const lines = [
          '/project/types.go:1:type Names []string',
          '/project/types.go:2:type Cache map[string]int',
          '/project/types.go:3:type Ref *http.Handler',
          '/project/types.go:4:type HandlerFunc func(w http.ResponseWriter)',
          '/project/types.go:5:type Signal chan struct{}',
          '/project/types.go:6:type MyString string',
          '/project/types.go:7:type Duration time.Duration'
        ].join('\n');
        mockExecFileForSearch(lines);

        const result = await searchSymbols('/project', 'go');
        expect(result.success).toBe(true);
        const typeSymbols = result.symbols.filter(s => s.type === 'type');
        expect(typeSymbols.length).toBeGreaterThanOrEqual(7);
        expect(typeSymbols.map(s => s.name)).toContain('Names');
        expect(typeSymbols.map(s => s.name)).toContain('Cache');
        expect(typeSymbols.map(s => s.name)).toContain('HandlerFunc');
        expect(typeSymbols.map(s => s.name)).toContain('Signal');
        expect(typeSymbols.map(s => s.name)).toContain('MyString');
      });

      test('should match Go const declarations', async () => {
        const output = '/project/const.go:5:const MaxRetries = 3';
        mockExecFileForSearch(output);

        const result = await searchSymbols('/project', 'go');
        expect(result.success).toBe(true);
        expect(result.symbols[0]!.name).toBe('MaxRetries');
        expect(result.symbols[0]!.type).toBe('constant');
      });

      test('should match Go var declarations', async () => {
        const output = '/project/vars.go:3:var DefaultConfig Config';
        mockExecFileForSearch(output);

        const result = await searchSymbols('/project', 'go');
        expect(result.success).toBe(true);
        expect(result.symbols[0]!.name).toBe('DefaultConfig');
        expect(result.symbols[0]!.type).toBe('variable');
      });

      test('should match Go generic function declarations', async () => {
        const output = '/project/generic.go:5:func Map[T any](items []T, fn func(T) T) []T {';
        mockExecFileForSearch(output);

        const result = await searchSymbols('/project', 'go');
        expect(result.success).toBe(true);
        expect(result.symbols[0]!.name).toBe('Map');
        expect(result.symbols[0]!.type).toBe('function');
      });

      test('should match Go generic method declarations', async () => {
        const output = '/project/generic.go:10:func (c *Cache) Get[T any](key string) (T, bool) {';
        mockExecFileForSearch(output);

        const result = await searchSymbols('/project', 'go');
        expect(result.success).toBe(true);
        expect(result.symbols[0]!.name).toBe('Get');
        expect(result.symbols[0]!.type).toBe('method');
      });
    });

    describe('TypeScript patterns', () => {
      test('should match TypeScript function declarations', async () => {
        const output = '/project/utils.ts:5:export async function fetchData(url: string): Promise<void> {';
        mockExecFileForSearch(output);

        const result = await searchSymbols('/project', 'ts');
        expect(result.success).toBe(true);
        expect(result.symbols[0]!.name).toBe('fetchData');
        expect(result.symbols[0]!.type).toBe('function');
      });

      test('should match TypeScript class declarations', async () => {
        const output = '/project/app.ts:10:export abstract class BaseService {';
        mockExecFileForSearch(output);

        const result = await searchSymbols('/project', 'ts');
        expect(result.success).toBe(true);
        expect(result.symbols[0]!.name).toBe('BaseService');
        expect(result.symbols[0]!.type).toBe('class');
      });

      test('should match TypeScript interface declarations', async () => {
        const output = '/project/types.ts:1:export interface Config {';
        mockExecFileForSearch(output);

        const result = await searchSymbols('/project', 'ts');
        expect(result.success).toBe(true);
        expect(result.symbols[0]!.name).toBe('Config');
        expect(result.symbols[0]!.type).toBe('interface');
      });

      test('should match TypeScript type aliases', async () => {
        const output = '/project/types.ts:5:export type Handler = (req: Request) => Response;';
        mockExecFileForSearch(output);

        const result = await searchSymbols('/project', 'ts');
        expect(result.success).toBe(true);
        expect(result.symbols[0]!.name).toBe('Handler');
        expect(result.symbols[0]!.type).toBe('type');
      });

      test('should match TypeScript enum declarations', async () => {
        const output = '/project/types.ts:10:export enum Status {';
        mockExecFileForSearch(output);

        const result = await searchSymbols('/project', 'ts');
        expect(result.success).toBe(true);
        expect(result.symbols[0]!.name).toBe('Status');
        expect(result.symbols[0]!.type).toBe('enum');
      });

      test('should match TypeScript const declarations', async () => {
        const output = '/project/config.ts:1:export const DEFAULT_TIMEOUT = 5000;';
        mockExecFileForSearch(output);

        const result = await searchSymbols('/project', 'ts');
        expect(result.success).toBe(true);
        expect(result.symbols[0]!.name).toBe('DEFAULT_TIMEOUT');
        expect(result.symbols[0]!.type).toBe('constant');
      });

      test('should match TypeScript namespace declarations', async () => {
        const output = '/project/types.ts:20:export namespace Utils {';
        mockExecFileForSearch(output);

        const result = await searchSymbols('/project', 'ts');
        expect(result.success).toBe(true);
        expect(result.symbols[0]!.name).toBe('Utils');
        expect(result.symbols[0]!.type).toBe('namespace');
      });
    });

    describe('Python patterns', () => {
      test('should match Python function declarations', async () => {
        const output = '/project/app.py:5:def handle_request(request):';
        mockExecFileForSearch(output);

        const result = await searchSymbols('/project', 'py');
        expect(result.success).toBe(true);
        expect(result.symbols[0]!.name).toBe('handle_request');
        expect(result.symbols[0]!.type).toBe('function');
      });

      test('should match Python async function declarations', async () => {
        const output = '/project/app.py:10:async def fetch_data(url):';
        mockExecFileForSearch(output);

        const result = await searchSymbols('/project', 'py');
        expect(result.success).toBe(true);
        expect(result.symbols[0]!.name).toBe('fetch_data');
        expect(result.symbols[0]!.type).toBe('function');
      });

      test('should match Python class declarations', async () => {
        const output = '/project/models.py:1:class User:';
        mockExecFileForSearch(output);

        const result = await searchSymbols('/project', 'py');
        expect(result.success).toBe(true);
        expect(result.symbols[0]!.name).toBe('User');
        expect(result.symbols[0]!.type).toBe('class');
      });

      test('should match Python constant declarations', async () => {
        const output = '/project/config.py:1:MAX_RETRIES = 3';
        mockExecFileForSearch(output);

        const result = await searchSymbols('/project', 'py');
        expect(result.success).toBe(true);
        expect(result.symbols[0]!.name).toBe('MAX_RETRIES');
        expect(result.symbols[0]!.type).toBe('constant');
      });
    });

    describe('Rust patterns', () => {
      test('should match Rust function declarations', async () => {
        const output = '/project/lib.rs:5:pub async fn handle(req: Request) -> Response {';
        mockExecFileForSearch(output);

        const result = await searchSymbols('/project', 'rs');
        expect(result.success).toBe(true);
        expect(result.symbols[0]!.name).toBe('handle');
        expect(result.symbols[0]!.type).toBe('function');
      });

      test('should match Rust struct declarations', async () => {
        const output = '/project/types.rs:1:pub struct Config {';
        mockExecFileForSearch(output);

        const result = await searchSymbols('/project', 'rs');
        expect(result.success).toBe(true);
        expect(result.symbols[0]!.name).toBe('Config');
        expect(result.symbols[0]!.type).toBe('struct');
      });

      test('should match Rust enum declarations', async () => {
        const output = '/project/types.rs:10:pub enum Status {';
        mockExecFileForSearch(output);

        const result = await searchSymbols('/project', 'rs');
        expect(result.success).toBe(true);
        expect(result.symbols[0]!.name).toBe('Status');
        expect(result.symbols[0]!.type).toBe('enum');
      });
    });

    describe('Markdown patterns', () => {
      test('should match Markdown headings', async () => {
        const lines = [
          '/project/README.md:1:# Installation',
          '/project/README.md:5:## Usage',
          '/project/README.md:20:### Configuration'
        ].join('\n');
        mockExecFileForSearch(lines);

        const result = await searchSymbols('/project', 'md');
        expect(result.success).toBe(true);
        expect(result.symbols).toHaveLength(3);
        expect(result.symbols[0]!.name).toBe('Installation');
        expect(result.symbols[0]!.type).toBe('heading');
        expect(result.symbols[1]!.name).toBe('Usage');
        expect(result.symbols[2]!.name).toBe('Configuration');
      });
    });

    describe('Terraform patterns', () => {
      test('should match Terraform resource declarations', async () => {
        const output = '/project/main.tf:1:resource "aws_instance" "web_server" {';
        mockExecFileForSearch(output);

        const result = await searchSymbols('/project', 'tf');
        expect(result.success).toBe(true);
        expect(result.symbols[0]!.name).toBe('web_server');
        expect(result.symbols[0]!.type).toBe('resource');
      });

      test('should match Terraform data declarations', async () => {
        const output = '/project/data.tf:1:data "aws_ami" "ubuntu" {';
        mockExecFileForSearch(output);

        const result = await searchSymbols('/project', 'tf');
        expect(result.success).toBe(true);
        expect(result.symbols[0]!.name).toBe('ubuntu');
        expect(result.symbols[0]!.type).toBe('data');
      });

      test('should match Terraform variable declarations', async () => {
        const output = '/project/variables.tf:1:variable "instance_type" {';
        mockExecFileForSearch(output);

        const result = await searchSymbols('/project', 'tf');
        expect(result.success).toBe(true);
        expect(result.symbols[0]!.name).toBe('instance_type');
        expect(result.symbols[0]!.type).toBe('variable');
      });

      test('should match Terraform module declarations', async () => {
        const output = '/project/main.tf:10:module "vpc" {';
        mockExecFileForSearch(output);

        const result = await searchSymbols('/project', 'tf');
        expect(result.success).toBe(true);
        expect(result.symbols[0]!.name).toBe('vpc');
        expect(result.symbols[0]!.type).toBe('module');
      });
    });

    describe('Shell patterns', () => {
      test('should match Shell function declarations', async () => {
        const output = '/project/build.sh:5:build_project() {';
        mockExecFileForSearch(output);

        const result = await searchSymbols('/project', 'sh');
        expect(result.success).toBe(true);
        expect(result.symbols[0]!.name).toBe('build_project');
        expect(result.symbols[0]!.type).toBe('function');
      });

      test('should match Shell variable declarations', async () => {
        const output = '/project/env.sh:1:JAVA_HOME=/usr/lib/jvm';
        mockExecFileForSearch(output);

        const result = await searchSymbols('/project', 'sh');
        expect(result.success).toBe(true);
        expect(result.symbols[0]!.name).toBe('JAVA_HOME');
        expect(result.symbols[0]!.type).toBe('variable');
      });

      test('should match Shell export declarations', async () => {
        const output = '/project/env.sh:2:export PATH_PREFIX';
        mockExecFileForSearch(output);

        const result = await searchSymbols('/project', 'sh');
        expect(result.success).toBe(true);
        expect(result.symbols[0]!.name).toBe('PATH_PREFIX');
        expect(result.symbols[0]!.type).toBe('variable');
      });
    });

    describe('Makefile patterns', () => {
      test('should match Makefile targets', async () => {
        const output = '/project/Makefile:1:install:';
        mockExecFileForSearch(output);

        const result = await searchSymbols('/project', 'make');
        expect(result.success).toBe(true);
        expect(result.symbols[0]!.name).toBe('install');
        expect(result.symbols[0]!.type).toBe('function');
      });

      test('should match Makefile variable declarations', async () => {
        const output = '/project/Makefile:1:CC = gcc';
        mockExecFileForSearch(output);

        const result = await searchSymbols('/project', 'make');
        expect(result.success).toBe(true);
        expect(result.symbols[0]!.name).toBe('CC');
        expect(result.symbols[0]!.type).toBe('variable');
      });
    });

    describe('Java patterns', () => {
      test('should match Java class declarations', async () => {
        const output = '/project/App.java:1:public class Application {';
        mockExecFileForSearch(output);

        const result = await searchSymbols('/project', 'java');
        expect(result.success).toBe(true);
        expect(result.symbols[0]!.name).toBe('Application');
        expect(result.symbols[0]!.type).toBe('class');
      });

      test('should match Java interface declarations', async () => {
        const output = '/project/Service.java:1:public interface Service {';
        mockExecFileForSearch(output);

        const result = await searchSymbols('/project', 'java');
        expect(result.success).toBe(true);
        expect(result.symbols[0]!.name).toBe('Service');
        expect(result.symbols[0]!.type).toBe('interface');
      });
    });

    describe('C# patterns', () => {
      test('should match C# class declarations', async () => {
        const output = '/project/App.cs:1:public abstract class BaseController {';
        mockExecFileForSearch(output);

        const result = await searchSymbols('/project', 'cs');
        expect(result.success).toBe(true);
        expect(result.symbols[0]!.name).toBe('BaseController');
        expect(result.symbols[0]!.type).toBe('class');
      });

      test('should match C# namespace declarations', async () => {
        const output = '/project/App.cs:1:namespace MyApp {';
        mockExecFileForSearch(output);

        const result = await searchSymbols('/project', 'cs');
        expect(result.success).toBe(true);
        expect(result.symbols[0]!.name).toBe('MyApp');
        expect(result.symbols[0]!.type).toBe('namespace');
      });
    });
  });

  // ============================================================
  // 3. checkRgAvailable()
  // ============================================================
  describe('checkRgAvailable', () => {
    test('should return available when rg is found at /opt/homebrew/bin/rg', async () => {
      mockedExecFile.mockImplementation(
        ((_file: any, _args: any, _options: any, callback: any) => {
          const file = _file as string;
          const cb = typeof _options === 'function' ? _options : callback;
          if (file === '/opt/homebrew/bin/rg') {
            cb(null, 'ripgrep 14.0.0', '');
          } else {
            cb(new Error('not found'));
          }
        }) as any
      );

      const result = await checkRgAvailable();
      expect(result.rgAvailable).toBe(true);
      expect(result.rgPath).toBe('/opt/homebrew/bin/rg');
    });

    test('should try fallback paths when first path fails', async () => {
      mockedExecFile.mockImplementation(
        ((_file: any, _args: any, _options: any, callback: any) => {
          const file = _file as string;
          const cb = typeof _options === 'function' ? _options : callback;
          if (file === '/usr/local/bin/rg') {
            cb(null, 'ripgrep 14.0.0', '');
          } else {
            cb(new Error('not found'));
          }
        }) as any
      );

      const result = await checkRgAvailable();
      expect(result.rgAvailable).toBe(true);
      expect(result.rgPath).toBe('/usr/local/bin/rg');
    });

    test('should return unavailable when rg is not found in any path', async () => {
      mockExecFileError(new Error('not found'));

      const result = await checkRgAvailable();
      expect(result.rgAvailable).toBe(false);
      expect(result.rgPath).toBeNull();
    });
  });

  // ============================================================
  // 4. getSupportedLanguages()
  // ============================================================
  describe('getSupportedLanguages', () => {
    test('should return all 20 languages', async () => {
      const { languages } = await getSupportedLanguages();
      expect(languages).toHaveLength(20);
    });

    test('should return languages with key, displayName, and extension', async () => {
      const { languages } = await getSupportedLanguages();

      for (const lang of languages) {
        expect(typeof lang.key).toBe('string');
        expect(typeof lang.displayName).toBe('string');
        expect(typeof lang.extension).toBe('string');
        expect(lang.extension.startsWith('.') || lang.extension === 'Makefile').toBe(true);
      }
    });

    test('should include correct rgType mappings', async () => {
      const { languages } = await getSupportedLanguages();
      const keys = languages.map(l => l.key);

      expect(keys).toContain('go');
      expect(keys).toContain('ts');
      expect(keys).toContain('rs');
      expect(keys).toContain('tf');
      expect(keys).toContain('md');
    });
  });

  // ============================================================
  // 5. searchSymbols() argument construction (CRITICAL)
  // ============================================================
  describe('searchSymbols argument construction', () => {
    test('should NOT include --hidden or --no-ignore when includePatterns is empty', async () => {
      const { getCapturedArgs } = mockExecFileCapturingArgs('');

      // Use 'py' to avoid block search phase (ts/go/rs have block configs)
      await searchSymbols('/project', 'py');
      const args = getCapturedArgs();
      expect(args).toHaveLength(1);

      const searchArgs = args[0]!;
      expect(searchArgs).not.toContain('--hidden');
      expect(searchArgs).not.toContain('--no-ignore');
    });

    test('should NOT include --hidden or --no-ignore when includePatterns is undefined', async () => {
      const { getCapturedArgs } = mockExecFileCapturingArgs('');

      // Use 'py' to avoid block search phase
      await searchSymbols('/project', 'py', {});
      const args = getCapturedArgs();
      expect(args).toHaveLength(1);

      const searchArgs = args[0]!;
      expect(searchArgs).not.toContain('--hidden');
      expect(searchArgs).not.toContain('--no-ignore');
    });

    test('should run TWO separate rg calls when includePatterns is provided (matching Swift)', async () => {
      const { getCapturedArgs } = mockExecFileCapturingArgs('');

      // Use 'py' to avoid block search phase (focus on normal+include phases)
      await searchSymbols('/project', 'py', {
        includePatterns: ['.claude/**/*']
      });
      const args = getCapturedArgs();
      // Two separate rg calls: normal search + include search
      expect(args).toHaveLength(2);

      // First call: normal search (NO --hidden, NO --no-ignore)
      const normalArgs = args[0]!;
      expect(normalArgs).not.toContain('--hidden');
      expect(normalArgs).not.toContain('--no-ignore');
      expect(normalArgs).toContain('--type');

      // Second call: include search (WITH --hidden, WITH --no-ignore, WITH --glob)
      const includeArgs = args[1]!;
      expect(includeArgs).toContain('--hidden');
      expect(includeArgs).toContain('--no-ignore');
      expect(includeArgs).toContain('--type');

      // Include args should have the include pattern as --glob
      const globs: string[] = [];
      for (let i = 0; i < includeArgs.length; i++) {
        if (includeArgs[i] === '--glob') {
          globs.push(includeArgs[i + 1]!);
        }
      }
      expect(globs).toContain('.claude/**/*');
    });

    test('should NOT include --hidden or --no-ignore when includePatterns is empty array', async () => {
      const { getCapturedArgs } = mockExecFileCapturingArgs('');

      // Use 'py' to avoid block search phase
      await searchSymbols('/project', 'py', {
        includePatterns: []
      });
      const args = getCapturedArgs();
      expect(args).toHaveLength(1);

      const searchArgs = args[0]!;
      expect(searchArgs).not.toContain('--hidden');
      expect(searchArgs).not.toContain('--no-ignore');
    });

    test('normal search should NOT have excludePatterns leak into include search', async () => {
      const { getCapturedArgs } = mockExecFileCapturingArgs('');

      // Use 'py' to avoid block search phase (focus on normal+include phases)
      await searchSymbols('/project', 'py', {
        excludePatterns: ['node_modules'],
        includePatterns: ['.claude/**/*']
      });
      const args = getCapturedArgs();
      expect(args).toHaveLength(2);

      // Normal search should have excludePatterns
      const normalGlobs: string[] = [];
      for (let i = 0; i < args[0]!.length; i++) {
        if (args[0]![i] === '--glob') normalGlobs.push(args[0]![i + 1]!);
      }
      expect(normalGlobs).toContain('!node_modules');

      // Include search should NOT have excludePatterns (matching Swift)
      const includeGlobs: string[] = [];
      for (let i = 0; i < args[1]!.length; i++) {
        if (args[1]![i] === '--glob') includeGlobs.push(args[1]![i + 1]!);
      }
      expect(includeGlobs).not.toContain('!node_modules');
      expect(includeGlobs).toContain('.claude/**/*');
    });

    test('should use --type with correct rgType for each language', async () => {
      const languageToRgType: Record<string, string> = {
        go: 'go',
        ts: 'ts',
        tsx: 'ts',
        js: 'js',
        jsx: 'js',
        py: 'py',
        rs: 'rust',
        java: 'java',
        kt: 'kotlin',
        swift: 'swift',
        rb: 'ruby',
        cpp: 'cpp',
        c: 'c',
        sh: 'sh',
        make: 'make',
        php: 'php',
        cs: 'csharp',
        scala: 'scala',
        tf: 'tf',
        md: 'markdown'
      };

      for (const [langKey, expectedRgType] of Object.entries(languageToRgType)) {
        jest.clearAllMocks();
        const { getCapturedArgs } = mockExecFileCapturingArgs('');

        await searchSymbols('/project', langKey);
        const args = getCapturedArgs();

        if (args.length === 0) {
          continue;
        }

        const searchArgs = args[0]!;
        const typeIndex = searchArgs.indexOf('--type');
        expect(typeIndex).toBeGreaterThan(-1);
        expect(searchArgs[typeIndex + 1]).toBe(expectedRgType);
      }
    });

    test('should use -e with combined pattern', async () => {
      const { getCapturedArgs } = mockExecFileCapturingArgs('');

      await searchSymbols('/project', 'ts');
      const args = getCapturedArgs();
      // ts has normal search + block search (enum members)
      expect(args.length).toBeGreaterThanOrEqual(1);

      // First call is the normal search with combined patterns
      const searchArgs = args[0]!;
      const eIndex = searchArgs.indexOf('-e');
      expect(eIndex).toBeGreaterThan(-1);

      const combinedPattern = searchArgs[eIndex + 1];
      expect(combinedPattern).toContain('function');
      expect(combinedPattern).toContain('class');
      expect(combinedPattern).toContain('interface');
      expect(combinedPattern).toContain('type');
    });

    test('should pass directory as last argument', async () => {
      const { getCapturedArgs } = mockExecFileCapturingArgs('');

      await searchSymbols('/my/project/dir', 'go');
      const args = getCapturedArgs();
      // Go has 3 rg invocations: 1 normal + 2 block searches (var/const blocks)
      expect(args.length).toBeGreaterThanOrEqual(1);

      // Verify directory is last argument in all rg invocations
      for (const searchArgs of args) {
        expect(searchArgs[searchArgs.length - 1]).toBe('/my/project/dir');
      }
    });

    test('should include --line-number, --no-heading, --color never', async () => {
      const { getCapturedArgs } = mockExecFileCapturingArgs('');

      await searchSymbols('/project', 'ts');
      const args = getCapturedArgs();
      const searchArgs = args[0]!;

      expect(searchArgs).toContain('--line-number');
      expect(searchArgs).toContain('--no-heading');
      expect(searchArgs).toContain('--color');
      const colorIdx = searchArgs.indexOf('--color');
      expect(searchArgs[colorIdx + 1]).toBe('never');
    });

    test('should add exclude patterns with --glob and ! prefix', async () => {
      const { getCapturedArgs } = mockExecFileCapturingArgs('');

      await searchSymbols('/project', 'ts', {
        excludePatterns: ['node_modules', '.git']
      });
      const args = getCapturedArgs();
      const searchArgs = args[0]!;

      const globs: string[] = [];
      for (let i = 0; i < searchArgs.length; i++) {
        if (searchArgs[i] === '--glob') {
          globs.push(searchArgs[i + 1]!);
        }
      }

      expect(globs).toContain('!node_modules');
      expect(globs).toContain('!.git');
    });

    test('should add include patterns with --glob in the second (include) search call', async () => {
      const { getCapturedArgs } = mockExecFileCapturingArgs('');

      // Use 'py' to avoid block search phase (focus on normal+include phases)
      await searchSymbols('/project', 'py', {
        includePatterns: ['src/**/*.py', 'lib/**/*.py']
      });
      const args = getCapturedArgs();
      // Two calls: normal + include
      expect(args).toHaveLength(2);

      // Include patterns should only be in the second call
      const includeSearchArgs = args[1]!;
      const globs: string[] = [];
      for (let i = 0; i < includeSearchArgs.length; i++) {
        if (includeSearchArgs[i] === '--glob') {
          globs.push(includeSearchArgs[i + 1]!);
        }
      }

      expect(globs).toContain('src/**/*.py');
      expect(globs).toContain('lib/**/*.py');

      // Normal search (first call) should NOT have include globs
      const normalGlobs: string[] = [];
      for (let i = 0; i < args[0]!.length; i++) {
        if (args[0]![i] === '--glob') normalGlobs.push(args[0]![i + 1]!);
      }
      expect(normalGlobs).not.toContain('src/**/*.py');
      expect(normalGlobs).not.toContain('lib/**/*.py');
    });
  });

  // ============================================================
  // 6. searchSymbols() error handling
  // ============================================================
  describe('searchSymbols error handling', () => {
    test('should return error for invalid (empty) directory', async () => {
      const result = await searchSymbols('', 'ts');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid directory');
      expect(result.symbols).toEqual([]);
    });

    test('should return error for null directory', async () => {
      const result = await searchSymbols(null as any, 'ts');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid directory');
    });

    test('should return error for invalid (empty) language', async () => {
      const result = await searchSymbols('/project', '');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid language');
      expect(result.symbols).toEqual([]);
    });

    test('should return error for null language', async () => {
      const result = await searchSymbols('/project', null as any);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid language');
    });

    test('should return error for unsupported language', async () => {
      mockExecFileForSearch('');
      const result = await searchSymbols('/project', 'fortran');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Unsupported language: fortran');
      expect(result.symbols).toEqual([]);
    });

    test('should return error when rg is not available', async () => {
      mockExecFileError(new Error('not found'));

      const result = await searchSymbols('/project', 'ts');
      expect(result.success).toBe(false);
      expect(result.error).toContain('ripgrep');
      expect(result.symbols).toEqual([]);
    });

    test('should handle rg exit code 1 (no matches) gracefully', async () => {
      mockedExecFile.mockImplementation(
        ((_file: any, _args: any, _options: any, callback: any) => {
          const args = Array.isArray(_args) ? _args : [];
          const cb = typeof _options === 'function' ? _options : callback;

          if (args.includes('--version')) {
            cb(null, 'ripgrep 14.0.0', '');
          } else {
            const error = new Error('no matches') as Error & { code: number };
            error.code = 1;
            cb(error, '', '');
          }
        }) as any
      );

      const result = await searchSymbols('/project', 'ts');
      expect(result.success).toBe(true);
      expect(result.symbols).toEqual([]);
      expect(result.symbolCount).toBe(0);
    });

    test('should handle rg timeout (killed process)', async () => {
      mockedExecFile.mockImplementation(
        ((_file: any, _args: any, _options: any, callback: any) => {
          const args = Array.isArray(_args) ? _args : [];
          const cb = typeof _options === 'function' ? _options : callback;

          if (args.includes('--version')) {
            cb(null, 'ripgrep 14.0.0', '');
          } else {
            const error = new Error('killed') as Error & { code: number; killed: boolean };
            error.code = 2;
            error.killed = true;
            cb(error, '', '');
          }
        }) as any
      );

      const result = await searchSymbols('/project', 'ts');
      expect(result.success).toBe(false);
      expect(result.error).toBe('ripgrep command timed out');
    });

    test('should handle rg with non-1 error code as real error', async () => {
      mockedExecFile.mockImplementation(
        ((_file: any, _args: any, _options: any, callback: any) => {
          const args = Array.isArray(_args) ? _args : [];
          const cb = typeof _options === 'function' ? _options : callback;

          if (args.includes('--version')) {
            cb(null, 'ripgrep 14.0.0', '');
          } else {
            const error = new Error('rg crashed') as Error & { code: number };
            error.code = 2;
            cb(error, '', '');
          }
        }) as any
      );

      const result = await searchSymbols('/project', 'ts');
      expect(result.success).toBe(false);
      expect(result.error).toBe('rg crashed');
    });

    test('should preserve maxSymbols from options in error response', async () => {
      const result = await searchSymbols('', 'ts', { maxSymbols: 500 });
      expect(result.maxSymbols).toBe(500);
    });

    test('should use default maxSymbols when not specified in error response', async () => {
      const result = await searchSymbols('', 'ts');
      expect(result.maxSymbols).toBe(200000);
    });
  });

  // ============================================================
  // 7. Output parsing
  // ============================================================
  describe('Output parsing', () => {
    test('should correctly parse path:lineNumber:content format', async () => {
      const output = '/project/src/app.ts:42:export function handleRequest() {';
      mockExecFileForSearch(output);

      const result = await searchSymbols('/project', 'ts');
      expect(result.success).toBe(true);
      expect(result.symbols).toHaveLength(1);

      const symbol = result.symbols[0]!;
      expect(symbol.filePath).toBe('/project/src/app.ts');
      expect(symbol.lineNumber).toBe(42);
      expect(symbol.lineContent).toBe('export function handleRequest() {');
      expect(symbol.language).toBe('ts');
    });

    test('should handle lines with colons in content correctly', async () => {
      const output = '/project/types.ts:10:export type Config = { host: string; port: number };';
      mockExecFileForSearch(output);

      const result = await searchSymbols('/project', 'ts');
      expect(result.success).toBe(true);
      expect(result.symbols).toHaveLength(1);
      expect(result.symbols[0]!.name).toBe('Config');
      expect(result.symbols[0]!.lineContent).toBe('export type Config = { host: string; port: number };');
    });

    test('should skip empty lines', async () => {
      const output = [
        '/project/app.ts:1:export function foo() {',
        '',
        '   ',
        '/project/app.ts:5:export function bar() {'
      ].join('\n');
      mockExecFileForSearch(output);

      const result = await searchSymbols('/project', 'ts');
      expect(result.success).toBe(true);
      expect(result.symbols).toHaveLength(2);
      expect(result.symbols[0]!.name).toBe('foo');
      expect(result.symbols[1]!.name).toBe('bar');
    });

    test('should skip malformed lines with fewer than 3 parts', async () => {
      const output = [
        '/project/app.ts:1:export function foo() {',
        'just-some-text',
        'partial:line',
        '/project/app.ts:5:export function bar() {'
      ].join('\n');
      mockExecFileForSearch(output);

      const result = await searchSymbols('/project', 'ts');
      expect(result.success).toBe(true);
      expect(result.symbols).toHaveLength(2);
    });

    test('should respect maxSymbols limit', async () => {
      const lines = Array.from({ length: 10 }, (_, i) =>
        `/project/app.ts:${i + 1}:export function fn${i}() {`
      ).join('\n');
      mockExecFileForSearch(lines);

      const result = await searchSymbols('/project', 'ts', { maxSymbols: 3 });
      expect(result.success).toBe(true);
      expect(result.symbols).toHaveLength(3);
      expect(result.partial).toBe(true);
    });

    test('should set partial=false when symbols count is less than maxSymbols', async () => {
      const output = '/project/app.ts:1:export function foo() {';
      mockExecFileForSearch(output);

      const result = await searchSymbols('/project', 'ts', { maxSymbols: 100 });
      expect(result.success).toBe(true);
      expect(result.partial).toBe(false);
    });

    test('should calculate relative path by removing directory prefix', async () => {
      const output = '/my/project/src/app.ts:1:export function foo() {';
      mockExecFileForSearch(output);

      const result = await searchSymbols('/my/project', 'ts');
      expect(result.success).toBe(true);
      expect(result.symbols[0]!.filePath).toBe('/my/project/src/app.ts');
      expect(result.symbols[0]!.relativePath).toBe('src/app.ts');
    });

    test('should keep filePath as relativePath if directory prefix does not match', async () => {
      const output = '/other/path/app.ts:1:export function foo() {';
      mockExecFileForSearch(output);

      const result = await searchSymbols('/my/project', 'ts');
      expect(result.success).toBe(true);
      expect(result.symbols[0]!.relativePath).toBe('/other/path/app.ts');
    });

    test('should skip lines that do not match any pattern', async () => {
      const output = [
        '/project/app.ts:1:export function foo() {',
        '/project/app.ts:2:  console.log("hello");',
        '/project/app.ts:3:  return 42;',
        '/project/app.ts:4:export const BAR = "baz";'
      ].join('\n');
      mockExecFileForSearch(output);

      const result = await searchSymbols('/project', 'ts');
      expect(result.success).toBe(true);
      expect(result.symbols).toHaveLength(2);
      expect(result.symbols[0]!.name).toBe('foo');
      expect(result.symbols[1]!.name).toBe('BAR');
    });

    test('should handle multiple symbols from different files', async () => {
      const output = [
        '/project/a.ts:1:export function alpha() {',
        '/project/b.ts:5:export class Beta {',
        '/project/c.ts:10:export interface Gamma {'
      ].join('\n');
      mockExecFileForSearch(output);

      const result = await searchSymbols('/project', 'ts');
      expect(result.success).toBe(true);
      expect(result.symbols).toHaveLength(3);
      expect(result.symbols[0]!.name).toBe('alpha');
      expect(result.symbols[0]!.filePath).toBe('/project/a.ts');
      expect(result.symbols[1]!.name).toBe('Beta');
      expect(result.symbols[1]!.filePath).toBe('/project/b.ts');
      expect(result.symbols[2]!.name).toBe('Gamma');
      expect(result.symbols[2]!.filePath).toBe('/project/c.ts');
    });
  });

  // ============================================================
  // 8. Combined pattern behavior (patterns combined with |)
  // ============================================================
  describe('Combined pattern behavior', () => {
    test('should combine all patterns for a language into one regex with | separators', async () => {
      const { getCapturedArgs } = mockExecFileCapturingArgs('');

      await searchSymbols('/project', 'go');
      const args = getCapturedArgs();
      const searchArgs = args[0]!;
      const eIndex = searchArgs.indexOf('-e');
      const combinedPattern = searchArgs[eIndex + 1]!;

      // Go has multiple patterns, they should be combined with |
      // Each pattern is wrapped in () for grouping
      expect(combinedPattern).toMatch(/^\(.*\)(\|\(.*\))+$/);

      // Should contain key Go patterns
      expect(combinedPattern).toContain('func');
      expect(combinedPattern).toContain('struct');
      expect(combinedPattern).toContain('interface');
    });

    test('NOTE: combined pattern means captureGroup indices shift per pattern', async () => {
      // This is a critical behavior difference from Swift which ran patterns one-by-one.
      // Node.js combines all patterns with |, so when the SECOND pattern matches,
      // the capture groups from the FIRST pattern are undefined.
      // The code handles this by matching each line against pre-compiled individual
      // patterns in parseRipgrepOutput, NOT using the combined regex's groups.
      // This test documents that the combined pattern is ONLY for rg filtering,
      // and individual patterns are re-applied for extraction.
      const output = '/project/main.go:10:func HandleRequest() {';
      mockExecFileForSearch(output);

      const result = await searchSymbols('/project', 'go');
      // Despite combined pattern having many groups, extraction still works
      expect(result.symbols[0]!.name).toBe('HandleRequest');
    });
  });

  // ============================================================
  // 9. searchSymbols response structure
  // ============================================================
  describe('searchSymbols response structure', () => {
    test('should return correct response structure on success', async () => {
      const output = '/project/app.ts:1:export function foo() {';
      mockExecFileForSearch(output);

      const result = await searchSymbols('/project', 'ts');
      expect(result).toEqual(expect.objectContaining({
        success: true,
        directory: '/project',
        language: 'ts',
        searchMode: 'full',
        partial: false,
        maxSymbols: 200000
      }));
      expect(result.symbolCount).toBe(result.symbols.length);
    });

    test('should return correct response structure on error', async () => {
      const result = await searchSymbols('', 'ts');
      expect(result).toEqual(expect.objectContaining({
        success: false,
        symbols: [],
        symbolCount: 0,
        searchMode: 'full',
        partial: false,
        error: expect.any(String)
      }));
    });

    test('should set symbolCount to match actual symbols array length', async () => {
      const output = [
        '/project/app.ts:1:export function foo() {',
        '/project/app.ts:2:export class Bar {',
        '/project/app.ts:3:export const BAZ = 1;'
      ].join('\n');
      mockExecFileForSearch(output);

      const result = await searchSymbols('/project', 'ts');
      expect(result.symbolCount).toBe(3);
      expect(result.symbols).toHaveLength(3);
    });
  });

  // ============================================================
  // 10. Regex pattern validity
  // ============================================================
  describe('Pattern regex validity', () => {
    const ALL_LANGUAGES = [
      'go', 'ts', 'tsx', 'js', 'jsx', 'py', 'rs', 'java', 'kt',
      'swift', 'rb', 'cpp', 'c', 'sh', 'make', 'php', 'cs', 'scala', 'tf', 'md'
    ];

    for (const lang of ALL_LANGUAGES) {
      test(`all patterns for ${lang} should compile as valid RegExp`, async () => {
        mockExecFileForSearch('');
        const result = await searchSymbols('/project', lang);
        expect(result.success).toBe(true);
      });
    }

    test('no patterns should use lookahead or lookbehind (unsupported by ripgrep)', async () => {
      // ripgrep's default regex engine does not support look-around.
      // Using (?! (?= (?<! (?<= in patterns will cause rg to fail with:
      // "look-around, including look-ahead and look-behind, is not supported"
      for (const lang of ALL_LANGUAGES) {
        jest.clearAllMocks();
        const captor = mockExecFileCapturingArgs('');
        await searchSymbols('/project', lang);
        const args = captor.getCapturedArgs();
        if (args.length === 0) continue;

        const searchArgs = args[0]!;
        const eIndex = searchArgs.indexOf('-e');
        if (eIndex === -1) continue;

        const pattern = searchArgs[eIndex + 1]!;
        // Check for lookahead/lookbehind syntax
        expect(pattern).not.toMatch(/\(\?[!=<]/);
      }
    });
  });

  // ============================================================
  // 11. Two-phase search and deduplication (matching Swift behavior)
  // ============================================================
  describe('Two-phase search and deduplication', () => {
    test('should deduplicate symbols found in both normal and include searches', async () => {
      // Simulate the same symbol appearing in both normal and include search results
      const commonLine = '/project/src/app.ts:1:export function foo() {';
      mockedExecFile.mockImplementation(
        ((_file: any, _args: any, _options: any, callback: any) => {
          const args = Array.isArray(_args) ? _args : [];
          const cb = typeof _options === 'function' ? _options : callback;

          if (args.includes('--version')) {
            cb(null, 'ripgrep 14.0.0', '');
          } else {
            // Both searches return the same symbol
            cb(null, commonLine, '');
          }
        }) as any
      );

      const result = await searchSymbols('/project', 'ts', {
        includePatterns: ['.claude/**/*']
      });

      expect(result.success).toBe(true);
      // Should be deduplicated to 1 symbol, not 2
      expect(result.symbols).toHaveLength(1);
      expect(result.symbols[0]!.name).toBe('foo');
    });

    test('should merge unique symbols from both phases', async () => {
      mockedExecFile.mockImplementation(
        ((_file: any, _args: any, _options: any, callback: any) => {
          const args = Array.isArray(_args) ? _args : [];
          const cb = typeof _options === 'function' ? _options : callback;

          if (args.includes('--version')) {
            cb(null, 'ripgrep 14.0.0', '');
          } else if (args.includes('--hidden')) {
            // Include search: finds hidden/ignored files
            cb(null, '/project/.claude/config.ts:5:export const hiddenConst = 1;', '');
          } else {
            // Normal search: finds regular files
            cb(null, '/project/src/app.ts:1:export function normalFunc() {', '');
          }
        }) as any
      );

      const result = await searchSymbols('/project', 'ts', {
        includePatterns: ['.claude/**/*']
      });

      expect(result.success).toBe(true);
      expect(result.symbols).toHaveLength(2);
      expect(result.symbols.map(s => s.name)).toContain('normalFunc');
      expect(result.symbols.map(s => s.name)).toContain('hiddenConst');
    });

    test('should sort results by filePath then lineNumber', async () => {
      const output = [
        '/project/src/z-file.ts:10:export function zFunc() {',
        '/project/src/a-file.ts:20:export function aFunc20() {',
        '/project/src/a-file.ts:5:export function aFunc5() {'
      ].join('\n');
      mockExecFileForSearch(output);

      const result = await searchSymbols('/project', 'ts');
      expect(result.success).toBe(true);
      expect(result.symbols).toHaveLength(3);

      // Should be sorted: a-file:5, a-file:20, z-file:10
      expect(result.symbols[0]!.name).toBe('aFunc5');
      expect(result.symbols[0]!.lineNumber).toBe(5);
      expect(result.symbols[1]!.name).toBe('aFunc20');
      expect(result.symbols[1]!.lineNumber).toBe(20);
      expect(result.symbols[2]!.name).toBe('zFunc');
      expect(result.symbols[2]!.lineNumber).toBe(10);
    });

    test('should only run one rg call when no includePatterns specified', async () => {
      const { getCapturedArgs } = mockExecFileCapturingArgs('');

      // Use 'py' (no block configs) to test pure two-phase behavior
      await searchSymbols('/project', 'py');
      const args = getCapturedArgs();
      // Only normal search, no include search
      expect(args).toHaveLength(1);
    });

    test('should run two rg calls when includePatterns specified', async () => {
      const { getCapturedArgs } = mockExecFileCapturingArgs('');

      // Use 'py' (no block configs) to test pure two-phase behavior
      await searchSymbols('/project', 'py', {
        includePatterns: ['.claude/**/*']
      });
      const args = getCapturedArgs();
      // Normal search + include search
      expect(args).toHaveLength(2);
    });
  });
});
