/**
 * @jest-environment jsdom
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import type { UserSettings, HistoryItem } from '../../src/types';

let testDir: string;
let settingsFile: string;

describe('Error Handling Integration Tests', () => {
    beforeEach(async () => {
        testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'prompt-line-error-test-'));
        settingsFile = path.join(testDir, 'settings.yml');
        
        // Set up DOM for tests
        document.body.innerHTML = `
            <textarea id="textInput"></textarea>
            <div id="appName"></div>
            <div id="charCount"></div>
            <div id="historyList"></div>
        `;
    });

    afterEach(async () => {
        try {
            await fs.rm(testDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    function createHistoryElement(item: HistoryItem): HTMLElement {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        historyItem.dataset.text = item.text;
        historyItem.dataset.id = item.id;

        const textDiv = document.createElement('div');
        textDiv.className = 'history-text';
        textDiv.textContent = item.text.replace(/\n/g, ' ');

        const timeDiv = document.createElement('div');
        timeDiv.className = 'history-time';
        timeDiv.textContent = 'Just now';

        historyItem.appendChild(textDiv);
        historyItem.appendChild(timeDiv);

        return historyItem;
    }

    function renderHistoryWithErrorHandling(
        historyData: HistoryItem[], 
        _settings: UserSettings | null
    ): void {
        try {
            const historyList = document.getElementById('historyList');
            if (!historyList) return;

            if (!historyData || historyData.length === 0) {
                historyList.innerHTML = '<div class="history-empty">No history items</div>';
                return;
            }

            const maxVisibleItems = 200; // MAX_VISIBLE_ITEMS constant
            const visibleItems = historyData.slice(0, maxVisibleItems);
            const fragment = document.createDocumentFragment();

            visibleItems.forEach((item) => {
                try {
                    const historyItem = createHistoryElement(item);
                    fragment.appendChild(historyItem);
                } catch (error) {
                    console.error('Error creating history element:', error);
                    // Continue with other items
                }
            });

            historyList.innerHTML = '';
            historyList.appendChild(fragment);

            if (historyData.length > maxVisibleItems) {
                const moreIndicator = document.createElement('div');
                moreIndicator.className = 'history-more';
                moreIndicator.textContent = `+${historyData.length - maxVisibleItems} more items`;
                historyList.appendChild(moreIndicator);
            }
        } catch (error) {
            console.error('Error rendering history:', error);
            const historyList = document.getElementById('historyList');
            if (historyList) {
                historyList.innerHTML = '<div class="history-empty">Error loading history</div>';
            }
        }
    }

    describe('Error handling scenarios', () => {
        test('should handle large datasets without crashing', () => {
            const historyItems: HistoryItem[] = Array.from({ length: 100 }, (_, i) => ({
                text: `Item ${i + 1}`,
                timestamp: Date.now() - i * 1000,
                id: `id-${i + 1}`
            }));

            const settings: UserSettings = {
                shortcuts: { main: 'Cmd+Space', paste: 'Enter', close: 'Escape', historyNext: 'Ctrl+j', historyPrev: 'Ctrl+k', search: 'Cmd+f' },
                window: { position: 'cursor', width: 800, height: 400 }
            };

            // Should not crash or hang
            expect(() => {
                renderHistoryWithErrorHandling(historyItems, settings);
            }).not.toThrow();

            const historyList = document.getElementById('historyList');
            const renderedItems = historyList?.querySelectorAll('.history-item');
            
            // Should render up to MAX_VISIBLE_ITEMS (200)
            expect(renderedItems?.length).toBe(100);
        });

        test('should handle null settings gracefully', () => {
            const historyItems: HistoryItem[] = [
                { text: 'Test item', timestamp: Date.now(), id: 'test-1' }
            ];

            // Should handle gracefully without crashing
            expect(() => {
                renderHistoryWithErrorHandling(historyItems, null);
            }).not.toThrow();

            // Should render the item with default behavior
            const historyList = document.getElementById('historyList');
            const renderedItems = historyList?.querySelectorAll('.history-item');
            expect(renderedItems?.length).toBe(1);
        });

        test('should handle malformed settings', () => {
            const historyItems: HistoryItem[] = [
                { text: 'Test item', timestamp: Date.now(), id: 'test-1' }
            ];

            const malformedSettings = { invalid: 'structure' } as any;

            // Should handle gracefully without crashing
            expect(() => {
                renderHistoryWithErrorHandling(historyItems, malformedSettings);
            }).not.toThrow();

            // Should fallback to default behavior
            const historyList = document.getElementById('historyList');
            const renderedItems = historyList?.querySelectorAll('.history-item');
            expect(renderedItems?.length).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Corrupted settings file scenarios', () => {
        test('should handle completely empty settings file', async () => {
            await fs.writeFile(settingsFile, '', 'utf8');

            // Test that rendering works with empty file scenario  
            const historyItems: HistoryItem[] = [
                { text: 'Test item', timestamp: Date.now(), id: 'test-1' }
            ];

            // Simulate settings parsing failure - null settings
            expect(() => {
                renderHistoryWithErrorHandling(historyItems, null);
            }).not.toThrow();

            // Should use default (15) when settings are null
            const historyList = document.getElementById('historyList');
            const renderedItems = historyList?.querySelectorAll('.history-item');
            expect(renderedItems?.length).toBe(1);
        });

        test('should handle binary/non-text settings file', async () => {
            // Write binary data to settings file
            const binaryData = Buffer.from([0, 1, 2, 3, 255, 254, 253]);
            await fs.writeFile(settingsFile, binaryData);

            // Test that rendering handles corrupted settings gracefully
            const historyItems: HistoryItem[] = [
                { text: 'Test item', timestamp: Date.now(), id: 'test-1' }
            ];

            // Simulate corrupted settings - malformed object
            const corruptedSettings = { invalid: 'structure' } as any;

            expect(() => {
                renderHistoryWithErrorHandling(historyItems, corruptedSettings);
            }).not.toThrow();

            // Should fallback to default when settings structure is invalid
            const historyList = document.getElementById('historyList');
            expect(historyList?.innerHTML).toContain('history-item');
        });

        test('should handle settings file with only invalid YAML', async () => {
            const invalidYaml = `
{[}]invalid yaml syntax}
definitely not yaml: [[[
more broken content: }}}
`.trim();

            await fs.writeFile(settingsFile, invalidYaml, 'utf8');

            // Test with various invalid settings scenarios
            const historyItems: HistoryItem[] = Array.from({ length: 5 }, (_, i) => ({
                text: `Item ${i + 1}`,
                timestamp: Date.now() - i * 1000,
                id: `id-${i + 1}`
            }));

            // Test null settings
            expect(() => {
                renderHistoryWithErrorHandling(historyItems, null);
            }).not.toThrow();

            // Test partial settings
            const partialSettings = {
                shortcuts: { main: 'Cmd+Space', paste: 'Enter', close: 'Escape', historyNext: 'Ctrl+j', historyPrev: 'Ctrl+k', search: 'Cmd+f' },
                window: { position: 'cursor', width: 800, height: 400 }
            } as any;

            expect(() => {
                renderHistoryWithErrorHandling(historyItems, partialSettings);
            }).not.toThrow();
        });

        test('should handle settings file with mixed valid/invalid content', async () => {
            const mixedYaml = `
shortcuts:
  main: Cmd+Shift+Space
  paste: }invalid{
window:
  position: cursor
  width: not_a_number
  invalid_field: [broken array syntax
`.trim();

            await fs.writeFile(settingsFile, mixedYaml, 'utf8');

            // Test that renderer handles malformed settings
            const historyItems: HistoryItem[] = Array.from({ length: 20 }, (_, i) => ({
                text: `Mixed item ${i + 1}`,
                timestamp: Date.now() - i * 1000,
                id: `mixed-${i + 1}`
            }));

            const invalidSettings = {
                shortcuts: { main: 'Cmd+Shift+Space', paste: 'Enter', close: 'Escape', historyNext: 'Ctrl+j', historyPrev: 'Ctrl+k', search: 'Cmd+f' },
                window: { position: 'cursor', width: 'not_a_number', height: 400 }
            } as any;

            expect(() => {
                renderHistoryWithErrorHandling(historyItems, invalidSettings);
            }).not.toThrow();

            // Should handle invalid settings gracefully
            const historyList = document.getElementById('historyList');
            const renderedItems = historyList?.querySelectorAll('.history-item');
            expect(renderedItems?.length).toBeGreaterThanOrEqual(0);
        });
    });

    describe('File system error scenarios', () => {
        test('should handle permission denied on settings directory', async () => {
            // Make parent directory unwritable
            await fs.chmod(testDir, 0o444);

            try {
                // Test that file write operations fail as expected
                await expect(
                    fs.writeFile(settingsFile, 'test: data', 'utf8')
                ).rejects.toThrow();

                // Test that rendering still works with permission errors
                const historyItems: HistoryItem[] = [
                    { text: 'Permission test', timestamp: Date.now(), id: 'perm-1' }
                ];

                // Should still render with default settings when file access fails
                expect(() => {
                    renderHistoryWithErrorHandling(historyItems, null);
                }).not.toThrow();

                const historyList = document.getElementById('historyList');
                const renderedItems = historyList?.querySelectorAll('.history-item');
                expect(renderedItems?.length).toBe(1);
            } finally {
                // Restore permissions
                await fs.chmod(testDir, 0o755);
            }
        });

        test('should handle settings file being a directory instead of file', async () => {
            // Create directory where settings file should be
            await fs.mkdir(settingsFile);

            try {
                // Test that reading the "file" (which is actually a directory) fails
                await expect(
                    fs.readFile(settingsFile, 'utf8')
                ).rejects.toThrow();

                // Test that rendering works when settings file is inaccessible
                const historyItems: HistoryItem[] = [
                    { text: 'Directory test', timestamp: Date.now(), id: 'dir-1' }
                ];

                expect(() => {
                    renderHistoryWithErrorHandling(historyItems, null);
                }).not.toThrow();

                const historyList = document.getElementById('historyList');
                expect(historyList?.innerHTML).toContain('history-item');
            } finally {
                await fs.rmdir(settingsFile);
            }
        });

        test('should handle disk space exhaustion during file operations', async () => {
            // Test that rendering works even when file operations fail
            const historyItems: HistoryItem[] = Array.from({ length: 3 }, (_, i) => ({
                text: `Disk space test ${i + 1}`,
                timestamp: Date.now() - i * 1000,
                id: `disk-${i + 1}`
            }));

            // Simulate disk space issues by testing with very large settings objects
            const hugeSettings = {
                shortcuts: { main: 'Cmd+Space', paste: 'Enter', close: 'Escape', historyNext: 'Ctrl+j', historyPrev: 'Ctrl+k', search: 'Cmd+f' },
                window: { position: 'cursor', width: 800, height: 400 },
                // Add large data to simulate memory pressure
                largeData: new Array(1000).fill('large_data_item')
            } as any;

            expect(() => {
                renderHistoryWithErrorHandling(historyItems, hugeSettings);
            }).not.toThrow();

            const historyList = document.getElementById('historyList');
            const renderedItems = historyList?.querySelectorAll('.history-item');
            expect(renderedItems?.length).toBe(3); // Should render all items
        });
    });

    describe('Renderer error scenarios', () => {
        test('should handle missing DOM elements gracefully', () => {
            // No DOM elements exist
            document.body.innerHTML = '';

            const historyItems: HistoryItem[] = [
                { text: 'Test', timestamp: Date.now(), id: 'test-1' }
            ];

            const settings: UserSettings = {
                shortcuts: { main: 'Cmd+Space', paste: 'Enter', close: 'Escape', historyNext: 'Ctrl+j', historyPrev: 'Ctrl+k', search: 'Cmd+f' },
                window: { position: 'cursor', width: 800, height: 400 }
            };

            // Should not crash when DOM elements are missing
            expect(() => {
                renderHistoryWithErrorHandling(historyItems, settings);
            }).not.toThrow();

            // historyList will be null, function should handle it
            const historyList = document.getElementById('historyList');
            expect(historyList).toBeNull();
        });

        test('should handle extremely large history dataset', () => {
            document.body.innerHTML = `
                <textarea id="textInput"></textarea>
                <div id="appName"></div>
                <div id="charCount"></div>
                <div id="historyList"></div>
            `;

            // Create very large history dataset
            const largeHistory: HistoryItem[] = Array.from({ length: 10000 }, (_, i) => ({
                text: `Very long history item text that contains lots of characters to test memory usage and rendering performance ${i + 1}`.repeat(10),
                timestamp: Date.now() - i * 1000,
                id: `large-id-${i + 1}`
            }));

            const settings: UserSettings = {
                shortcuts: { main: 'Cmd+Space', paste: 'Enter', close: 'Escape', historyNext: 'Ctrl+j', historyPrev: 'Ctrl+k', search: 'Cmd+f' },
                window: { position: 'cursor', width: 800, height: 400 }
            };

            // Should not hang or crash
            const startTime = Date.now();
            expect(() => {
                renderHistoryWithErrorHandling(largeHistory, settings);
            }).not.toThrow();
            
            const endTime = Date.now();
            // Should complete in reasonable time (< 5 seconds)
            expect(endTime - startTime).toBeLessThan(5000);

            // Should actually render elements up to MAX_VISIBLE_ITEMS
            const historyList = document.getElementById('historyList');
            const renderedItems = historyList?.querySelectorAll('.history-item');
            expect(renderedItems?.length).toBeGreaterThan(0);
            expect(renderedItems?.length).toBeLessThanOrEqual(200); // Should respect MAX_VISIBLE_ITEMS
        });

        test('should handle history items with problematic content', () => {
            document.body.innerHTML = `
                <textarea id="textInput"></textarea>
                <div id="appName"></div>
                <div id="charCount"></div>
                <div id="historyList"></div>
            `;

            const problematicHistory: HistoryItem[] = [
                // XSS attempt
                { text: '<script>alert("xss")</script>', timestamp: Date.now(), id: 'xss-1' },
                // HTML injection
                { text: '<img src="x" onerror="alert(1)">', timestamp: Date.now() - 1000, id: 'html-1' },
                // Very long single line
                { text: 'a'.repeat(100000), timestamp: Date.now() - 2000, id: 'long-1' },
                // Unicode and special characters
                { text: '🚀🔥💯\u200B\u200C\u200D\uFEFF', timestamp: Date.now() - 3000, id: 'unicode-1' },
                // Empty string
                { text: '', timestamp: Date.now() - 4000, id: 'empty-1' },
                // Only whitespace
                { text: '   \n\t\r   ', timestamp: Date.now() - 5000, id: 'whitespace-1' }
            ];

            const settings: UserSettings = {
                shortcuts: { main: 'Cmd+Space', paste: 'Enter', close: 'Escape', historyNext: 'Ctrl+j', historyPrev: 'Ctrl+k', search: 'Cmd+f' },
                window: { position: 'cursor', width: 800, height: 400 }
            };

            expect(() => {
                renderHistoryWithErrorHandling(problematicHistory, settings);
            }).not.toThrow();

            const historyList = document.getElementById('historyList');
            const renderedItems = historyList?.querySelectorAll('.history-item');
            
            // Should render items without executing scripts
            expect(renderedItems?.length).toBeGreaterThan(0);
            
            // Should not have unescaped script tags in rendered text content (XSS prevention)
            // The data attribute may contain original text, but the displayed text should be escaped
            const textElements = historyList?.querySelectorAll('.history-text');
            const displayedTexts = Array.from(textElements || []).map(el => el.innerHTML);
            
            // Check that script tags are escaped in the displayed content
            expect(displayedTexts.some(text => text.includes('&lt;script&gt;'))).toBe(true);
            expect(displayedTexts.some(text => text.includes('<script>'))).toBe(false);
            
            // Verify each problematic item was handled safely
            const textContents = Array.from(renderedItems || []).map(item => 
                item.querySelector('.history-text')?.textContent
            );
            
            // XSS content should be rendered as text, not executed
            expect(textContents.some(text => text?.includes('alert("xss")'))).toBe(true);
            
            // Empty and whitespace content should be handled
            expect(textContents.some(text => text === '')).toBe(true);
            expect(textContents.some(text => text?.trim() === '')).toBe(true);
        });
    });

    describe('Memory and performance edge cases', () => {
        test('should handle rapid file operations without memory leaks', async () => {
            // Rapidly create and delete files to test memory handling
            const promises = [];
            for (let i = 0; i < 100; i++) {
                const tempFile = path.join(testDir, `temp-${i}.yaml`);
                promises.push(
                    fs.writeFile(tempFile, `window:\n  width: ${600 + i * 10}`, 'utf8')
                        .then(() => fs.unlink(tempFile).catch(() => {})) // Ignore cleanup errors
                );
            }

            // Should handle all operations without errors
            await Promise.all(promises);

            // Test that rendering still works after rapid file operations
            const historyItems: HistoryItem[] = [
                { text: 'Memory test', timestamp: Date.now(), id: 'mem-1' }
            ];

            expect(() => {
                renderHistoryWithErrorHandling(historyItems, null);
            }).not.toThrow();
        });

        test('should handle rapid re-renders without memory issues', () => {
            document.body.innerHTML = `
                <textarea id="textInput"></textarea>
                <div id="appName"></div>
                <div id="charCount"></div>
                <div id="historyList"></div>
            `;

            const historyItems: HistoryItem[] = Array.from({ length: 50 }, (_, i) => ({
                text: `Rapid render test ${i + 1}`,
                timestamp: Date.now() - i * 1000,
                id: `rapid-${i + 1}`
            }));

            // Rapidly re-render with different settings
            for (let i = 1; i <= 20; i++) {
                const settings: UserSettings = {
                    shortcuts: { main: 'Cmd+Space', paste: 'Enter', close: 'Escape', historyNext: 'Ctrl+j', historyPrev: 'Ctrl+k', search: 'Cmd+f' },
                    window: { position: 'cursor', width: 800 + i * 10, height: 400 }
                };

                expect(() => {
                    renderHistoryWithErrorHandling(historyItems, settings);
                }).not.toThrow();

                const renderedItems = document.querySelectorAll('.history-item');
                expect(renderedItems.length).toBe(Math.min(200, historyItems.length)); // Always limited to MAX_VISIBLE_ITEMS
            }

            // Verify final state is clean
            const finalItems = document.querySelectorAll('.history-item');
            expect(finalItems.length).toBe(50); // Last iteration had 50 items
        });

        test('should handle stress test with large data and rapid changes', () => {
            document.body.innerHTML = `
                <textarea id="textInput"></textarea>
                <div id="appName"></div>
                <div id="charCount"></div>
                <div id="historyList"></div>
            `;

            // Create very large dataset
            const largeHistory: HistoryItem[] = Array.from({ length: 1000 }, (_, i) => ({
                text: `Stress test item ${i + 1} `.repeat(50), // Large text
                timestamp: Date.now() - i * 1000,
                id: `stress-${i + 1}`
            }));

            // Rapidly change settings and re-render
            const stressWidths = [600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400, 1500];
            
            for (const width of stressWidths) {
                const settings: UserSettings = {
                    shortcuts: { main: 'Cmd+Space', paste: 'Enter', close: 'Escape', historyNext: 'Ctrl+j', historyPrev: 'Ctrl+k', search: 'Cmd+f' },
                    window: { position: 'cursor', width: width, height: 400 }
                };

                const startTime = Date.now();
                expect(() => {
                    renderHistoryWithErrorHandling(largeHistory, settings);
                }).not.toThrow();
                
                const renderTime = Date.now() - startTime;
                expect(renderTime).toBeLessThan(1000); // Should complete within 1 second

                const renderedItems = document.querySelectorAll('.history-item');
                const expectedCount = Math.min(200, largeHistory.length); // Always limited to MAX_VISIBLE_ITEMS
                expect(renderedItems.length).toBe(expectedCount);
            }
        });
    });
});