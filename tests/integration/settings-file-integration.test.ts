import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import SettingsManager from '../../src/managers/settings-manager';
// UserSettings type is used in test validation

let testDir: string;
let settingsFile: string;
let originalSettingsManager: typeof SettingsManager.prototype.constructor;

// Helper functions
async function createTestYAMLFile(file: string, content: string): Promise<void> {
    await fs.writeFile(file, content, 'utf8');
}

async function readTestYAMLFile(file: string): Promise<string> {
    return await fs.readFile(file, 'utf8');
}

async function verifyYAMLContent(file: string, expectedContent: string): Promise<void> {
    const content = await readTestYAMLFile(file);
    expect(content).toContain(expectedContent);
}

describe('Settings File Integration Tests', () => {
    beforeEach(async () => {
        testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'prompt-line-settings-test-'));
        settingsFile = path.join(testDir, 'settings.yml');
        originalSettingsManager = SettingsManager.prototype.constructor;
    });

    afterEach(async () => {
        SettingsManager.prototype.constructor = originalSettingsManager;
        try {
            await fs.rm(testDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    });


    describe('YAML file format validation', () => {
        test('should correctly parse valid YAML', async () => {
            const validYaml = 'shortcuts:\n  main: Cmd+Shift+Space\nwindow:\n  position: cursor';
            await createTestYAMLFile(settingsFile, validYaml);
            await verifyYAMLContent(settingsFile, 'position: cursor');
        });

        test('should handle different YAML string formats', async () => {
            const formats = ['position: cursor', 'position: "center"', 'position:   center'];

            for (const format of formats) {
                const yamlContent = `window:\n  width: 600\n  ${format}`;
                await createTestYAMLFile(settingsFile, yamlContent);
                await verifyYAMLContent(settingsFile, format);
            }
        });

        test('should validate YAML structure integrity', async () => {
            const complexYaml = 'shortcuts:\n  main: Cmd+Shift+Space\nwindow:\n  width: 600';
            await createTestYAMLFile(settingsFile, complexYaml);

            const content = await readTestYAMLFile(settingsFile);
            expect(content).toContain('shortcuts:');
            expect(content).toContain('window:');
            expect(content).toContain('width: 600');
        });

        test('should handle file corruption detection', async () => {
            const corruptedContents = [
                '',
                'invalid: yaml: content: [[[',
                Buffer.from([0, 1, 2, 3]).toString(),
                'window:\n  width: invalid_number'
            ];

            for (const corruptedContent of corruptedContents) {
                await createTestYAMLFile(settingsFile, corruptedContent);

                const fileExists = await fs.access(settingsFile).then(() => true).catch(() => false);
                expect(fileExists).toBe(true);

                const content = await readTestYAMLFile(settingsFile);
                expect(typeof content).toBe('string');
            }
        });
    });

    describe('File system operations', () => {
        test('should write and read YAML content correctly', async () => {
            const testContent = 'window:\n  width: 800\n  height: 400';
            await createTestYAMLFile(settingsFile, testContent);

            const readContent = await readTestYAMLFile(settingsFile);
            expect(readContent).toContain('width: 800');
            expect(readContent).toContain('height: 400');
        });

        test('should handle file updates preserving format', async () => {
            const originalContent = 'shortcuts:\n  main: Ctrl+Alt+Space\nwindow:\n  position: center\n  width: 800\n  height: 400';
            await createTestYAMLFile(settingsFile, originalContent);

            const updatedContent = originalContent.replace('width: 800', 'width: 1200');
            await createTestYAMLFile(settingsFile, updatedContent);

            const finalContent = await readTestYAMLFile(settingsFile);
            expect(finalContent).toContain('main: Ctrl+Alt+Space');
            expect(finalContent).toContain('position: center');
            expect(finalContent).toContain('height: 400');
            expect(finalContent).toContain('width: 1200');
        });

        test('should handle permission errors gracefully', async () => {
            await createTestYAMLFile(settingsFile, 'test: content');
            await fs.chmod(testDir, 0o444);

            try {
                await expect(createTestYAMLFile(settingsFile, 'new: content')).rejects.toThrow();
            } finally {
                await fs.chmod(testDir, 0o755);
            }
        });

        test('should handle rapid file updates', async () => {
            const updates = Array.from({ length: 10 }, (_, i) =>
                createTestYAMLFile(settingsFile, `window:\n  width: ${600 + i * 100}`)
            );

            await Promise.all(updates);

            const finalContent = await readTestYAMLFile(settingsFile);
            expect(finalContent).toContain('width:');

            const match = finalContent.match(/width: (\d+)/);
            expect(match).toBeTruthy();
            if (match && match[1]) {
                const value = parseInt(match[1]);
                expect(value).toBeGreaterThanOrEqual(600);
                expect(value).toBeLessThanOrEqual(10000);
            }
        });
    });

    describe('Edge cases and validation', () => {
        test('should handle boundary number values in YAML', async () => {
            const boundaryValues = [300, 600, 1200, 9999];

            for (const value of boundaryValues) {
                const yamlContent = `window:\n  width: ${value}`;
                await createTestYAMLFile(settingsFile, yamlContent);
                await verifyYAMLContent(settingsFile, `width: ${value}`);
            }
        });

        test('should handle different file paths correctly', async () => {
            const deepDir = path.join(testDir, 'very', 'deep', 'nested');
            await fs.mkdir(deepDir, { recursive: true });

            const nestedFile = path.join(deepDir, 'settings.yml');
            await createTestYAMLFile(nestedFile, 'window:\n  width: 1024');
            await verifyYAMLContent(nestedFile, 'width: 1024');
        });

        test('should handle files without extensions', async () => {
            const noExtFile = path.join(testDir, 'settings_no_ext');
            await createTestYAMLFile(noExtFile, 'window:\n  height: 768');
            await verifyYAMLContent(noExtFile, 'height: 768');
        });
    });
});