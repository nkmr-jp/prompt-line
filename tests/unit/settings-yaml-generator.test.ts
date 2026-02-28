/**
 * Tests for settings-yaml-generator.ts
 *
 * This test suite validates the YAML generation logic for settings files,
 * including both runtime-saved settings and example file generation.
 */

import { generateSettingsYaml } from '../../src/config/settings-yaml-generator';
import type { YamlGeneratorOptions } from '../../src/config/settings-yaml-generator';
import type { UserSettings } from '../../src/types';
import * as yaml from 'js-yaml';

// Import actual default settings for testing
import { defaultSettings } from '../../src/config/default-settings';

describe('settings-yaml-generator', () => {
  describe('generateSettingsYaml', () => {
    describe('minimal settings', () => {
      test('should generate YAML with only shortcuts and window settings', () => {
        const minimalSettings: UserSettings = {
          shortcuts: {
            main: 'Cmd+Shift+Space',
            paste: 'Cmd+Enter',
            close: 'Escape',
            historyNext: 'Ctrl+j',
            historyPrev: 'Ctrl+k',
            search: 'Cmd+f'
          },
          window: {
            position: 'active-text-field',
            width: 600,
            height: 300
          }
        };

        const result = generateSettingsYaml(minimalSettings);

        expect(result).toContain('shortcuts:');
        expect(result).toContain('main: Cmd+Shift+Space');
        expect(result).toContain('paste: Cmd+Enter');
        expect(result).toContain('close: Escape');
        expect(result).toContain('historyNext: Ctrl+j');
        expect(result).toContain('historyPrev: Ctrl+k');
        expect(result).toContain('search: Cmd+f');

        expect(result).toContain('window:');
        expect(result).toContain('position: active-text-field');
        expect(result).toContain('width: 600');
        expect(result).toContain('height: 300');
      });

      test('should include commented templates when sections are missing', () => {
        const minimalSettings: UserSettings = {
          shortcuts: {
            main: 'Cmd+Shift+Space',
            paste: 'Cmd+Enter',
            close: 'Escape',
            historyNext: 'Ctrl+j',
            historyPrev: 'Ctrl+k',
            search: 'Cmd+f'
          },
          window: {
            position: 'center',
            width: 800,
            height: 400
          }
        };

        const result = generateSettingsYaml(minimalSettings);

        // Should have commented extensions section
        expect(result).toContain('#extensions:');
        expect(result).toContain('#  ts: "WebStorm"');

        // Should have commented builtInCommands section
        expect(result).toContain('#builtInCommands:');

        // Should have commented agentSkills section
        expect(result).toContain('#agentSkills:');

        // Should have commented mentions section
        expect(result).toContain('#mentions:');
        expect(result).toContain('#  fileSearch:');
      });
    });

    describe('full settings with all sections', () => {
      test('should generate complete YAML with all sections populated', () => {
        const fullSettings: UserSettings = {
          shortcuts: {
            main: 'Alt+Space',
            paste: 'Enter',
            close: 'Escape',
            historyNext: 'Ctrl+j',
            historyPrev: 'Ctrl+k',
            search: 'Cmd+f'
          },
          window: {
            position: 'cursor',
            width: 700,
            height: 350
          },
          fileOpener: {
            defaultEditor: 'Visual Studio Code',
            extensions: {
              ts: 'WebStorm',
              go: 'Goland',
              md: 'Typora'
            }
          },
          builtInCommands: ['claude', 'codex'],
          agentSkills: [
            {
              name: 'test-{basename}',
              description: 'Test command',
              path: '~/.claude/test',
              pattern: '*.md',
              argumentHint: 'Enter argument',
              maxSuggestions: 10
            }
          ],
          mentions: {
            fileSearch: {
              respectGitignore: false,
              includeHidden: false,
              maxFiles: 1000,
              maxDepth: 5,
              maxSuggestions: 30,
              followSymlinks: true,
              fdPath: '/usr/local/bin/fd',
              includePatterns: ['*.log', 'dist/**'],
              excludePatterns: ['node_modules', '*.min.js']
            },
            symbolSearch: {
              maxSymbols: 10000,
              timeout: 3000,
              rgPath: '/opt/homebrew/bin/rg'
            },
            customSearch: [
              {
                name: 'agent-{basename}',
                description: 'Agent files',
                path: '~/.claude/agents',
                pattern: '*.md',
                searchPrefix: 'agent',
                maxSuggestions: 20,
                orderBy: 'name',
                inputFormat: '{filepath}'
              }
            ]
          }
        };

        const result = generateSettingsYaml(fullSettings);

        // Shortcuts
        expect(result).toContain('main: Alt+Space');
        expect(result).toContain('paste: Enter');

        // Window
        expect(result).toContain('position: cursor');
        expect(result).toContain('width: 700');
        expect(result).toContain('height: 350');

        // File opener
        expect(result).toContain('defaultEditor: "Visual Studio Code"');
        expect(result).toContain('ts: "WebStorm"');
        expect(result).toContain('go: "Goland"');
        expect(result).toContain('md: "Typora"');

        // Slash commands
        expect(result).toContain('- claude');
        expect(result).toContain('- codex');
        expect(result).toContain('name: "test-{basename}"');
        expect(result).toContain('description: "Test command"');
        expect(result).toContain('path: ~/.claude/test');
        expect(result).toContain('pattern: "*.md"');
        expect(result).toContain('argumentHint: "Enter argument"');
        expect(result).toContain('maxSuggestions: 10');

        // Mentions - file search
        expect(result).toContain('respectGitignore: false');
        expect(result).toContain('includeHidden: false');
        expect(result).toContain('maxFiles: 1000');
        expect(result).toContain('maxDepth: 5');
        expect(result).toContain('followSymlinks: true');
        expect(result).toContain('fdPath: "/usr/local/bin/fd"');
        // Arrays with values are formatted as multi-line with proper indentation
        expect(result).toContain('includePatterns:');
        expect(result).toContain('- "*.log"');
        expect(result).toContain('- "dist/**"');
        expect(result).toContain('excludePatterns:');
        expect(result).toContain('- "node_modules"');
        expect(result).toContain('- "*.min.js"');

        // Mentions - symbol search
        expect(result).toContain('maxSymbols: 10000');
        expect(result).toContain('timeout: 3000');
        expect(result).toContain('rgPath: "/opt/homebrew/bin/rg"');

        // Mentions - customSearch
        expect(result).toContain('searchPrefix: agent');
        expect(result).toContain('orderBy: "name"');
        expect(result).toContain('inputFormat: {filepath}');
      });
    });

    describe('commented examples option', () => {
      test('should not include commented examples when includeCommentedExamples=false', () => {
        const settings = { ...defaultSettings };
        const options: YamlGeneratorOptions = { includeCommentedExamples: false };

        const result = generateSettingsYaml(settings, options);

        // Should not include commented extension examples
        expect(result).not.toContain('# go: "Goland"');

        // Should not include commented slash command examples
        expect(result).not.toContain('# - codex');
        expect(result).not.toContain('# - gemini');

        // Should not include commented customSearch examples
        expect(result).not.toContain('# - name: "{frontmatter@name}"');
        // Note: ~/.claude/plugins/cache is now an active value in default settings
      });

      test('should include commented examples when includeCommentedExamples=true', () => {
        const settings = { ...defaultSettings };
        const options: YamlGeneratorOptions = { includeCommentedExamples: true };

        const result = generateSettingsYaml(settings, options);

        // Should include commented extension examples
        expect(result).toContain('# go: "Goland"');
        expect(result).toContain('# md: "Typora"');

        // Should include commented builtInCommands examples
        expect(result).toContain('# - codex');
        expect(result).toContain('# - gemini');
      });

      test('should add commented examples after active values', () => {
        const settings: UserSettings = {
          ...defaultSettings,
          fileOpener: {
            extensions: {
              ts: 'WebStorm'
            },
            defaultEditor: null
          }
        };
        const options: YamlGeneratorOptions = { includeCommentedExamples: true };

        const result = generateSettingsYaml(settings, options);

        // Active value should come before commented examples
        const tsIndex = result.indexOf('ts: "WebStorm"');
        const goIndex = result.indexOf('# go: "Goland"');

        expect(tsIndex).toBeGreaterThan(0);
        expect(goIndex).toBeGreaterThan(tsIndex);
      });
    });

    describe('empty arrays and null values', () => {
      test('should handle empty arrays correctly', () => {
        const settings: UserSettings = {
          shortcuts: defaultSettings.shortcuts,
          window: defaultSettings.window,
          builtInCommands: [],
          agentSkills: [],
          mentions: {
            fileSearch: {
              respectGitignore: true,
              includeHidden: true,
              maxFiles: 5000,
              maxDepth: null,
              maxSuggestions: 50,
              followSymlinks: false,
              includePatterns: [],
              excludePatterns: []
            },
            symbolSearch: {
              maxSymbols: 20000,
              timeout: 5000
            },
            customSearch: []
          }
        };

        const result = generateSettingsYaml(settings);

        // Empty arrays should be formatted as []
        expect(result).toContain('includePatterns: []');
        expect(result).toContain('excludePatterns: []');
      });

      test('should handle null values correctly', () => {
        const settings: UserSettings = {
          shortcuts: defaultSettings.shortcuts,
          window: defaultSettings.window,
          fileOpener: {
            defaultEditor: null,
            extensions: {}
          },
          mentions: {
            fileSearch: {
              respectGitignore: true,
              includeHidden: true,
              maxFiles: 5000,
              maxDepth: null,
              maxSuggestions: 50,
              followSymlinks: false,
              includePatterns: [],
              excludePatterns: []
            },
            symbolSearch: {
              maxSymbols: 20000,
              timeout: 5000
            }
          }
        };

        const result = generateSettingsYaml(settings);

        // null values should be formatted as 'null'
        expect(result).toContain('defaultEditor: null');
        expect(result).toContain('maxDepth: null');
      });

      test('should handle custom tool paths as null when not set', () => {
        const settings: UserSettings = {
          shortcuts: defaultSettings.shortcuts,
          window: defaultSettings.window,
          mentions: {
            fileSearch: {
              respectGitignore: true,
              includeHidden: true,
              maxFiles: 5000,
              maxDepth: null,
              maxSuggestions: 50,
              followSymlinks: false,
              includePatterns: [],
              excludePatterns: []
            },
            symbolSearch: {
              maxSymbols: 20000,
              timeout: 5000
            }
          }
        };

        const result = generateSettingsYaml(settings);

        // Should have commented fdPath and rgPath when null
        expect(result).toContain('#fdPath: null');
        expect(result).toContain('#rgPath: null');
      });
    });

    describe('special characters in strings', () => {
      test('should properly quote strings with special characters', () => {
        const settings: UserSettings = {
          shortcuts: defaultSettings.shortcuts,
          window: defaultSettings.window,
          builtInCommands: ['claude'],
          agentSkills: [
            {
              name: 'test: command',
              description: 'Command with "quotes" and special chars',
              path: '~/path/with spaces/commands',
              pattern: '*.md'
            }
          ]
        };

        const result = generateSettingsYaml(settings);

        // Strings with special characters should be quoted
        expect(result).toContain('name: "test: command"');
        expect(result).toContain('description: "Command with "quotes" and special chars"');
      });

      test('should handle empty strings', () => {
        const settings: UserSettings = {
          shortcuts: defaultSettings.shortcuts,
          window: defaultSettings.window,
          builtInCommands: ['claude'],
          agentSkills: [
            {
              name: 'test',
              description: '',
              path: '~/.claude/commands',
              pattern: '*.md'
            }
          ]
        };

        const result = generateSettingsYaml(settings);

        expect(result).toContain('description: ""');
      });
    });

    describe('missing optional sections', () => {
      test('should handle missing fileOpener section', () => {
        const settings: UserSettings = {
          shortcuts: defaultSettings.shortcuts,
          window: defaultSettings.window
        };

        const result = generateSettingsYaml(settings);

        // Should have commented extensions section
        expect(result).toContain('#extensions:');
        expect(result).toContain('defaultEditor: null');
      });

      test('should handle missing agentSkills section', () => {
        const settings: UserSettings = {
          shortcuts: defaultSettings.shortcuts,
          window: defaultSettings.window
        };

        const result = generateSettingsYaml(settings);

        // Should have commented builtInCommands and agentSkills templates
        expect(result).toContain('#builtInCommands:');
        expect(result).toContain('#agentSkills:');
      });

      test('should handle missing mentions section', () => {
        const settings: UserSettings = {
          shortcuts: defaultSettings.shortcuts,
          window: defaultSettings.window
        };

        const result = generateSettingsYaml(settings);

        // Should have commented mentions template
        expect(result).toContain('#mentions:');
        expect(result).toContain('#  fileSearch:');
        expect(result).toContain('#  symbolSearch:');
        expect(result).toContain('#  customSearch:');
      });

      test('should handle builtInCommands without agentSkills', () => {
        const settings: UserSettings = {
          shortcuts: defaultSettings.shortcuts,
          window: defaultSettings.window,
          builtInCommands: ['claude']
          // No agentSkills
        };

        const result = generateSettingsYaml(settings);

        expect(result).toContain('builtInCommands:');
        expect(result).toContain('- claude');
        // agentSkills should be commented since not provided
        expect(result).toContain('#agentSkills:');
      });
    });

    describe('YAML parsing integration', () => {
      test('should generate valid YAML that can be parsed by js-yaml', () => {
        const settings = { ...defaultSettings };
        const result = generateSettingsYaml(settings);

        // Remove comment-only lines and header for parsing
        const yamlContent = result
          .split('\n')
          .filter(line => !line.trim().startsWith('#') || line.includes(':'))
          .join('\n');

        // Should be parseable without errors
        expect(() => yaml.load(yamlContent)).not.toThrow();
      });

      test('should generate parseable YAML with all optional fields', () => {
        const settings: UserSettings = {
          shortcuts: {
            main: 'Alt+Space',
            paste: 'Enter',
            close: 'Escape',
            historyNext: 'Ctrl+j',
            historyPrev: 'Ctrl+k',
            search: 'Cmd+f'
          },
          window: {
            position: 'cursor',
            width: 800,
            height: 400
          },
          fileOpener: {
            defaultEditor: 'VSCode',
            extensions: {
              ts: 'WebStorm',
              md: 'Typora'
            }
          },
          builtInCommands: ['claude', 'codex'],
          agentSkills: [
            {
              name: '{basename}',
              description: 'Test',
              path: '~/.claude/commands',
              pattern: '*.md',
              argumentHint: 'hint',
              maxSuggestions: 20
            }
          ],
          mentions: {
            fileSearch: {
              respectGitignore: true,
              includeHidden: true,
              maxFiles: 5000,
              maxDepth: null,
              maxSuggestions: 50,
              followSymlinks: false,
              includePatterns: ['*.log'],
              excludePatterns: ['*.tmp']
            },
            symbolSearch: {
              maxSymbols: 20000,
              timeout: 5000
            },
            customSearch: [
              {
                name: 'agent-{basename}',
                description: 'Test agent',
                path: '~/.claude/agents',
                pattern: '*.md',
                searchPrefix: 'agent'
              }
            ]
          }
        };

        const result = generateSettingsYaml(settings);

        // Remove comment-only lines for parsing
        const yamlContent = result
          .split('\n')
          .filter(line => !line.trim().startsWith('#') || line.includes(':'))
          .join('\n');

        const parsed = yaml.load(yamlContent) as any;

        // Verify key sections are parsed correctly
        expect(parsed.shortcuts.main).toBe('Alt+Space');
        expect(parsed.window.position).toBe('cursor');
        expect(parsed.fileOpener.defaultEditor).toBe('VSCode');
        expect(parsed.builtInCommands).toEqual(['claude', 'codex']);
      });

      test('should preserve data types after round-trip parsing', () => {
        const settings: UserSettings = {
          shortcuts: defaultSettings.shortcuts,
          window: {
            position: 'center',
            width: 600,
            height: 300
          },
          mentions: {
            fileSearch: {
              respectGitignore: true,
              includeHidden: false,
              maxFiles: 5000,
              maxDepth: null,
              maxSuggestions: 50,
              followSymlinks: false,
              includePatterns: [],
              excludePatterns: []
            },
            symbolSearch: {
              maxSymbols: 20000,
              timeout: 5000
            }
          }
        };

        const result = generateSettingsYaml(settings);

        // Remove comment-only lines
        const yamlContent = result
          .split('\n')
          .filter(line => !line.trim().startsWith('#') || line.includes(':'))
          .join('\n');

        const parsed = yaml.load(yamlContent) as any;

        // Check data types
        expect(typeof parsed.window.width).toBe('number');
        expect(typeof parsed.window.height).toBe('number');
        expect(typeof parsed.mentions.fileSearch.respectGitignore).toBe('boolean');
        expect(typeof parsed.mentions.fileSearch.includeHidden).toBe('boolean');
        expect(parsed.mentions.fileSearch.maxDepth).toBeNull();
      });
    });

    describe('formatting and structure', () => {
      test('should include section headers and comments', () => {
        const settings = { ...defaultSettings };
        const result = generateSettingsYaml(settings);

        // Should include main header
        expect(result).toContain('# Prompt Line Settings Configuration');

        // Should include section headers
        expect(result).toContain('# KEYBOARD SHORTCUTS');
        expect(result).toContain('# WINDOW SETTINGS');
        expect(result).toContain('# FILE OPENER SETTINGS');
        expect(result).toContain('# BUILT-IN COMMANDS');
        expect(result).toContain('# AGENT SKILLS SETTINGS');
        expect(result).toContain('# MENTION SETTINGS');
      });

      test('should have proper indentation for nested structures', () => {
        const settings: UserSettings = {
          shortcuts: defaultSettings.shortcuts,
          window: defaultSettings.window,
          builtInCommands: ['claude'],
          agentSkills: [
            {
              name: 'test',
              description: 'desc',
              path: '~/.claude/commands',
              pattern: '*.md'
            }
          ]
        };

        const result = generateSettingsYaml(settings);

        // Check indentation patterns
        expect(result).toContain('builtInCommands:');
        expect(result).toContain('  - claude');
        expect(result).toContain('agentSkills:');
        expect(result).toContain('  - name: "test"');
        expect(result).toContain('    description: "desc"');
      });

      test('should include inline comments for important fields', () => {
        const settings: UserSettings = {
          shortcuts: defaultSettings.shortcuts,
          window: defaultSettings.window,
          mentions: {
            fileSearch: {
              respectGitignore: true,
              includeHidden: true,
              maxFiles: 5000,
              maxDepth: null,
              maxSuggestions: 50,
              followSymlinks: false,
              includePatterns: [],
              excludePatterns: []
            },
            symbolSearch: {
              maxSymbols: 20000,
              timeout: 5000
            },
            customSearch: [
              {
                name: 'agent-{basename}',
                description: 'Test',
                path: '~/.claude/agents',
                pattern: '*.md',
                searchPrefix: 'agent',
                inputFormat: '{filepath}'
              }
            ]
          }
        };

        const result = generateSettingsYaml(settings);

        // Should include helpful inline comments
        expect(result).toMatch(/respectGitignore:.*# Respect .gitignore files/);
        expect(result).toMatch(/includeHidden:.*# Include hidden files/);
        expect(result).toMatch(/searchPrefix: agent.*# Search with @agent:/);
        expect(result).toMatch(/inputFormat: \{filepath\}.*# Insert file path instead of name/);
      });
    });

    describe('customSearch entry formatting', () => {
      test('should format customSearch entries with all optional fields', () => {
        const settings: UserSettings = {
          shortcuts: defaultSettings.shortcuts,
          window: defaultSettings.window,
          mentions: {
            fileSearch: {
              respectGitignore: true,
              includeHidden: true,
              maxFiles: 5000,
              maxDepth: null,
              maxSuggestions: 50,
              followSymlinks: false,
              includePatterns: [],
              excludePatterns: []
            },
            symbolSearch: {
              maxSymbols: 20000,
              timeout: 5000
            },
            customSearch: [
              {
                name: 'test-{basename}',
                description: 'Test description',
                path: '~/.test/path',
                pattern: '**/*.md',
                searchPrefix: 'test',
                maxSuggestions: 100,
                orderBy: 'name desc',
                inputFormat: '{filepath}'
              }
            ]
          }
        };

        const result = generateSettingsYaml(settings);

        expect(result).toContain('- name: "test-{basename}"');
        expect(result).toContain('description: "Test description"');
        expect(result).toContain('path: ~/.test/path');
        expect(result).toContain('pattern: "**/*.md"');
        expect(result).toContain('searchPrefix: test');
        expect(result).toContain('maxSuggestions: 100');
        expect(result).toContain('orderBy: "name desc"');
        expect(result).toContain('inputFormat: {filepath}');
      });

      test('should format customSearch entries without optional fields', () => {
        const settings: UserSettings = {
          shortcuts: defaultSettings.shortcuts,
          window: defaultSettings.window,
          mentions: {
            fileSearch: {
              respectGitignore: true,
              includeHidden: true,
              maxFiles: 5000,
              maxDepth: null,
              maxSuggestions: 50,
              followSymlinks: false,
              includePatterns: [],
              excludePatterns: []
            },
            symbolSearch: {
              maxSymbols: 20000,
              timeout: 5000
            },
            customSearch: [
              {
                name: 'simple',
                description: 'Simple entry',
                path: '~/.simple',
                pattern: '*.md'
              }
            ]
          }
        };

        const result = generateSettingsYaml(settings);

        expect(result).toContain('- name: "simple"');
        expect(result).toContain('description: "Simple entry"');
        expect(result).toContain('path: ~/.simple');
        expect(result).toContain('pattern: "*.md"');

        // The result will still contain "searchPrefix:" in the commented help text
        // Verify that optional fields are not present in the entry by checking for
        // specific values that would only appear if the field was set
        const lines = result.split('\n');
        let inSimpleEntry = false;
        let simpleEntryLines: string[] = [];

        for (const line of lines) {
          if (line.includes('- name: "simple"')) {
            inSimpleEntry = true;
            simpleEntryLines.push(line);
          } else if (inSimpleEntry) {
            if (line.trim().startsWith('-') || line.trim() === '') {
              // Next entry or empty line - stop collecting
              break;
            }
            simpleEntryLines.push(line);
          }
        }

        const simpleEntryText = simpleEntryLines.join('\n');
        // Check that optional field values are not in the actual entry
        expect(simpleEntryText).not.toMatch(/searchPrefix:\s+\w+/);  // No actual searchPrefix value
        expect(simpleEntryText).not.toMatch(/maxSuggestions:\s+\d+/);  // No actual maxSuggestions value
        expect(simpleEntryText).not.toMatch(/orderBy:\s+/);  // No actual orderBy value
      });
    });

    describe('legacy field support', () => {
      test('should handle legacy fileSearch field (outside mentions)', () => {
        const settings: UserSettings = {
          shortcuts: defaultSettings.shortcuts,
          window: defaultSettings.window,
          fileSearch: {
            respectGitignore: false,
            includeHidden: true,
            maxFiles: 3000,
            maxDepth: 3,
            maxSuggestions: 40,
            followSymlinks: true,
            includePatterns: [],
            excludePatterns: []
          }
        };

        const result = generateSettingsYaml(settings);

        // Should use legacy field for generation
        expect(result).toContain('respectGitignore: false');
        expect(result).toContain('maxFiles: 3000');
        expect(result).toContain('maxDepth: 3');
      });

      test('should prefer mentions.fileSearch over legacy fileSearch', () => {
        const settings: UserSettings = {
          shortcuts: defaultSettings.shortcuts,
          window: defaultSettings.window,
          fileSearch: {
            respectGitignore: false,
            includeHidden: true,
            maxFiles: 3000,
            maxDepth: 3,
            maxSuggestions: 40,
            followSymlinks: false,
            includePatterns: [],
            excludePatterns: []
          },
          mentions: {
            fileSearch: {
              respectGitignore: true,
              includeHidden: true,
              maxFiles: 5000,
              maxDepth: null,
              maxSuggestions: 50,
              followSymlinks: false,
              includePatterns: [],
              excludePatterns: []
            },
            symbolSearch: {
              maxSymbols: 20000,
              timeout: 5000
            }
          }
        };

        const result = generateSettingsYaml(settings);

        // Should use mentions.fileSearch values, not legacy
        expect(result).toContain('respectGitignore: true');
        expect(result).toContain('maxFiles: 5000');
        expect(result).toContain('maxDepth: null');
      });
    });

    describe('formatValue edge cases', () => {
      test('should handle non-string array elements safely', () => {
        // Create malformed settings with non-string array elements
        const malformedSettings: UserSettings = {
          shortcuts: defaultSettings.shortcuts,
          window: defaultSettings.window,
          mentions: {
            fileSearch: {
              respectGitignore: true,
              includeHidden: true,
              maxFiles: 5000,
              maxDepth: null,
              maxSuggestions: 50,
              followSymlinks: false,
              // Array with non-string elements (numbers)
              includePatterns: [123, 456] as any,
              // Array with non-string elements (objects)
              excludePatterns: [{ key: 'value' }, { key2: 'value2' }] as any
            },
            symbolSearch: {
              maxSymbols: 20000,
              timeout: 5000
            }
          }
        };

        // Should not throw and should return safe fallback
        const result = generateSettingsYaml(malformedSettings);

        // Should output '[]' for safety when non-string elements are detected
        expect(result).toContain('includePatterns: []');
        expect(result).toContain('excludePatterns: []');
      });

      test('should handle unexpected value types safely', () => {
        // Create malformed settings with unexpected value types
        const malformedSettings: UserSettings = {
          shortcuts: defaultSettings.shortcuts,
          window: defaultSettings.window,
          mentions: {
            fileSearch: {
              respectGitignore: true,
              includeHidden: true,
              maxFiles: 5000,
              maxDepth: null,
              maxSuggestions: 50,
              // Function as value (unexpected type)
              followSymlinks: (() => true) as any,
              includePatterns: [],
              excludePatterns: []
            },
            symbolSearch: {
              maxSymbols: 20000,
              // Symbol as value (unexpected type)
              timeout: Symbol('timeout') as any
            }
          }
        };

        // Should not throw and should return safe fallback
        const result = generateSettingsYaml(malformedSettings);

        // Should output 'null' for safety when unexpected types are detected
        expect(result).toContain('followSymlinks: null');
        expect(result).toContain('timeout: null');
      });
    });

    describe('edge cases', () => {
      test('should handle very long extension lists', () => {
        const extensions: Record<string, string> = {};
        for (let i = 0; i < 20; i++) {
          extensions[`ext${i}`] = `App${i}`;
        }

        const settings: UserSettings = {
          shortcuts: defaultSettings.shortcuts,
          window: defaultSettings.window,
          fileOpener: {
            defaultEditor: null,
            extensions
          }
        };

        const result = generateSettingsYaml(settings);

        // Should contain all extensions
        expect(result).toContain('ext0: "App0"');
        expect(result).toContain('ext19: "App19"');
      });

      test('should handle multiple customSearch entries', () => {
        const customSearch = [
          {
            name: 'entry1',
            description: 'First entry',
            path: '~/.path1',
            pattern: '*.md'
          },
          {
            name: 'entry2',
            description: 'Second entry',
            path: '~/.path2',
            pattern: '**/*.md'
          },
          {
            name: 'entry3',
            description: 'Third entry',
            path: '~/.path3',
            pattern: 'test-*.md'
          }
        ];

        const settings: UserSettings = {
          shortcuts: defaultSettings.shortcuts,
          window: defaultSettings.window,
          mentions: {
            fileSearch: {
              respectGitignore: true,
              includeHidden: true,
              maxFiles: 5000,
              maxDepth: null,
              maxSuggestions: 50,
              followSymlinks: false,
              includePatterns: [],
              excludePatterns: []
            },
            symbolSearch: {
              maxSymbols: 20000,
              timeout: 5000
            },
            customSearch
          }
        };

        const result = generateSettingsYaml(settings);

        expect(result).toContain('name: "entry1"');
        expect(result).toContain('name: "entry2"');
        expect(result).toContain('name: "entry3"');
      });

      test('should handle boolean false values correctly', () => {
        const settings: UserSettings = {
          shortcuts: defaultSettings.shortcuts,
          window: defaultSettings.window,
          mentions: {
            fileSearch: {
              respectGitignore: false,
              includeHidden: false,
              maxFiles: 5000,
              maxDepth: null,
              maxSuggestions: 50,
              followSymlinks: false,
              includePatterns: [],
              excludePatterns: []
            },
            symbolSearch: {
              maxSymbols: 20000,
              timeout: 5000
            }
          }
        };

        const result = generateSettingsYaml(settings);

        // Boolean false should be formatted as 'false', not empty or null
        expect(result).toContain('respectGitignore: false');
        expect(result).toContain('includeHidden: false');
        expect(result).toContain('followSymlinks: false');
      });

      test('should handle numeric zero values correctly', () => {
        const settings: UserSettings = {
          shortcuts: defaultSettings.shortcuts,
          window: {
            position: 'center',
            width: 0,
            height: 0
          }
        };

        const result = generateSettingsYaml(settings);

        // Numeric zero should be formatted as '0', not null or empty
        expect(result).toContain('width: 0');
        expect(result).toContain('height: 0');
      });
    });
  });
});
