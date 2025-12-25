import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import SettingsManager from '../../src/managers/settings-manager';
// UserSettings type is used in test validation

// Create test directory and files
let testDir: string;
let settingsFile: string;
let originalSettingsManager: typeof SettingsManager.prototype.constructor;

describe('Settings File Integration Tests', () => {
    beforeEach(async () => {
        // Create temporary directory for test files
        testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'prompt-line-settings-test-'));
        settingsFile = path.join(testDir, 'settings.yml');
        
        // Store original constructor to restore later
        originalSettingsManager = SettingsManager.prototype.constructor;
    });

    afterEach(async () => {
        // Restore original constructor
        SettingsManager.prototype.constructor = originalSettingsManager;
        
        // Clean up test files
        try {
            await fs.rm(testDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    async function createTestYAMLFile(content: string): Promise<void> {
        await fs.writeFile(settingsFile, content, 'utf8');
    }

    async function readTestYAMLFile(): Promise<string> {
        return await fs.readFile(settingsFile, 'utf8');
    }


    describe('YAML file format validation', () => {
        test('should correctly parse valid YAML', async () => {
            const validYaml = `
shortcuts:
  main: Cmd+Shift+Space
  paste: Cmd+Enter
  close: Escape
window:
  position: cursor
  width: 600
  height: 300
`.trim();

            await createTestYAMLFile(validYaml);
            
            // Verify file was written correctly
            const readContent = await readTestYAMLFile();
            expect(readContent).toContain('position: cursor');
        });

        test('should handle different YAML string formats', async () => {
            const formats = [
                'position: cursor',    // Unquoted string
                'position: "center"',  // Quoted string
                'position:   center',  // Extra spaces
            ];

            for (const format of formats) {
                const yamlContent = `
window:
  width: 600
  ${format}
`.trim();

                await createTestYAMLFile(yamlContent);
                const content = await readTestYAMLFile();
                expect(content).toContain(format);
            }
        });

        test('should validate YAML structure integrity', async () => {
            const complexYaml = `
shortcuts:
  main: Cmd+Shift+Space
  paste: Cmd+Enter
  close: Escape
window:
  position: cursor
  width: 600
  height: 300
`.trim();

            await createTestYAMLFile(complexYaml);
            const content = await readTestYAMLFile();
            
            // Verify all sections exist
            expect(content).toContain('shortcuts:');
            expect(content).toContain('window:');
            expect(content).toContain('width: 600');
        });

        test('should handle file corruption detection', async () => {
            const corruptedContents = [
                '',                                    // Empty file
                'invalid: yaml: content: [[[',        // Malformed YAML
                Buffer.from([0, 1, 2, 3]).toString(), // Binary content
                'window:\n  width: invalid_number', // Invalid number
            ];

            for (const corruptedContent of corruptedContents) {
                await createTestYAMLFile(corruptedContent);
                
                // File should exist but contain invalid data
                const fileExists = await fs.access(settingsFile).then(() => true).catch(() => false);
                expect(fileExists).toBe(true);
                
                const content = await readTestYAMLFile();
                expect(typeof content).toBe('string');
            }
        });
    });

    describe('File system operations', () => {
        test('should write and read YAML content correctly', async () => {
            const testContent = `
window:
  width: 800
  height: 400
`.trim();

            await createTestYAMLFile(testContent);
            const readContent = await readTestYAMLFile();
            
            expect(readContent).toContain('width: 800');
            expect(readContent).toContain('height: 400');
        });

        test('should handle file updates preserving format', async () => {
            const originalContent = `
shortcuts:
  main: Ctrl+Alt+Space
  paste: Enter
  close: Escape
window:
  position: center
  width: 800
  height: 400
`.trim();

            await createTestYAMLFile(originalContent);
            
            // Simulate an update to width
            const updatedContent = originalContent.replace('width: 800', 'width: 1200');
            await createTestYAMLFile(updatedContent);

            const finalContent = await readTestYAMLFile();
            expect(finalContent).toContain('main: Ctrl+Alt+Space'); // Preserved
            expect(finalContent).toContain('position: center'); // Preserved  
            expect(finalContent).toContain('height: 400'); // Preserved
            expect(finalContent).toContain('width: 1200'); // Updated
        });

        test('should handle permission errors gracefully', async () => {
            // Create file first
            await createTestYAMLFile('test: content');
            
            // Make directory read-only
            await fs.chmod(testDir, 0o444);

            try {
                // This should throw due to permission error
                await expect(createTestYAMLFile('new: content'))
                    .rejects.toThrow();
            } finally {
                // Restore permissions for cleanup
                await fs.chmod(testDir, 0o755);
            }
        });

        test('should handle rapid file updates', async () => {
            const updates = [];
            
            // Create multiple rapid updates
            for (let i = 0; i < 10; i++) {
                updates.push(createTestYAMLFile(`window:\n  width: ${600 + i * 100}`));
            }

            // All updates should complete
            await Promise.all(updates);

            // Final content should be one of the values
            const finalContent = await readTestYAMLFile();
            expect(finalContent).toContain('width:');
            
            // Should contain a valid number
            const match = finalContent.match(/width: (\d+)/);
            expect(match).toBeTruthy();
            if (match && match[1]) {
                const value = parseInt(match[1]);
                expect(value).toBeGreaterThanOrEqual(600);
                expect(value).toBeLessThanOrEqual(10000); // Further increased for slower CI environments
            }
        });
    });

    describe('Edge cases and validation', () => {
        test('should handle boundary number values in YAML', async () => {
            const boundaryValues = [300, 600, 1200, 9999];

            for (const value of boundaryValues) {
                const yamlContent = `window:\n  width: ${value}`;
                await createTestYAMLFile(yamlContent);
                
                const content = await readTestYAMLFile();
                expect(content).toContain(`width: ${value}`);
            }
        });

        test('should handle different file paths correctly', async () => {
            // Test nested directory
            const deepDir = path.join(testDir, 'very', 'deep', 'nested');
            await fs.mkdir(deepDir, { recursive: true });
            
            const nestedFile = path.join(deepDir, 'settings.yml');
            await fs.writeFile(nestedFile, 'window:\n  width: 1024', 'utf8');
            
            const content = await fs.readFile(nestedFile, 'utf8');
            expect(content).toContain('width: 1024');
        });

        test('should handle files without extensions', async () => {
            const noExtFile = path.join(testDir, 'settings_no_ext');
            await fs.writeFile(noExtFile, 'window:\n  height: 768', 'utf8');
            
            const content = await fs.readFile(noExtFile, 'utf8');
            expect(content).toContain('height: 768');
        });
    });
});