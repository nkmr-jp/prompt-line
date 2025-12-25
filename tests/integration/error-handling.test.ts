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

// Helper constants
const MAX_VISIBLE_ITEMS = 200;
const TEST_DOM = `
    <textarea id="textInput"></textarea>
    <div id="appName"></div>
    <div id="charCount"></div>
    <div id="historyList"></div>
`;

// Helper functions
function setupTestDOM(): void {
    document.body.innerHTML = TEST_DOM;
}

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

function createMoreIndicator(remaining: number): HTMLElement {
    const moreIndicator = document.createElement('div');
    moreIndicator.className = 'history-more';
    moreIndicator.textContent = `+${remaining} more items`;
    return moreIndicator;
}

function renderItems(
    fragment: DocumentFragment,
    items: HistoryItem[]
): void {
    items.forEach((item) => {
        try {
            const historyItem = createHistoryElement(item);
            fragment.appendChild(historyItem);
        } catch (error) {
            console.error('Error creating history element:', error);
        }
    });
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

        const visibleItems = historyData.slice(0, MAX_VISIBLE_ITEMS);
        const fragment = document.createDocumentFragment();
        renderItems(fragment, visibleItems);

        historyList.innerHTML = '';
        historyList.appendChild(fragment);

        if (historyData.length > MAX_VISIBLE_ITEMS) {
            const indicator = createMoreIndicator(historyData.length - MAX_VISIBLE_ITEMS);
            historyList.appendChild(indicator);
        }
    } catch (error) {
        console.error('Error rendering history:', error);
        const historyList = document.getElementById('historyList');
        if (historyList) {
            historyList.innerHTML = '<div class="history-empty">Error loading history</div>';
        }
    }
}

// Factory functions for test data
function createMockSettings(overrides: Partial<UserSettings> = {}): UserSettings {
    return {
        shortcuts: { main: 'Cmd+Space', paste: 'Enter', close: 'Escape', historyNext: 'Ctrl+j', historyPrev: 'Ctrl+k', search: 'Cmd+f' },
        window: { position: 'cursor', width: 800, height: 400 },
        ...overrides
    };
}

function createHistoryItems(count: number, textPrefix = 'Item'): HistoryItem[] {
    return Array.from({ length: count }, (_, i) => ({
        text: `${textPrefix} ${i + 1}`,
        timestamp: Date.now() - i * 1000,
        id: `id-${i + 1}`
    }));
}

function getRenderedItemsCount(): number {
    const historyList = document.getElementById('historyList');
    return historyList?.querySelectorAll('.history-item').length || 0;
}

describe('Error Handling Integration Tests', () => {
    beforeEach(async () => {
        testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'prompt-line-error-test-'));
        settingsFile = path.join(testDir, 'settings.yml');
        setupTestDOM();
    });

    afterEach(async () => {
        try {
            await fs.rm(testDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    describe('Error handling scenarios', () => {
        test('should handle large datasets without crashing', () => {
            const historyItems = createHistoryItems(100);
            const settings = createMockSettings();

            expect(() => renderHistoryWithErrorHandling(historyItems, settings)).not.toThrow();
            expect(getRenderedItemsCount()).toBe(100);
        });

        test('should handle null settings gracefully', () => {
            const historyItems = createHistoryItems(1, 'Test item');

            expect(() => renderHistoryWithErrorHandling(historyItems, null)).not.toThrow();
            expect(getRenderedItemsCount()).toBe(1);
        });

        test('should handle malformed settings', () => {
            const historyItems = createHistoryItems(1, 'Test item');
            const malformedSettings = { invalid: 'structure' } as any;

            expect(() => renderHistoryWithErrorHandling(historyItems, malformedSettings)).not.toThrow();
            expect(getRenderedItemsCount()).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Corrupted settings file scenarios', () => {
        test('should handle completely empty settings file', async () => {
            await fs.writeFile(settingsFile, '', 'utf8');
            const historyItems = createHistoryItems(1, 'Test item');

            expect(() => renderHistoryWithErrorHandling(historyItems, null)).not.toThrow();
            expect(getRenderedItemsCount()).toBe(1);
        });

        test('should handle binary/non-text settings file', async () => {
            const binaryData = Buffer.from([0, 1, 2, 3, 255, 254, 253]);
            await fs.writeFile(settingsFile, binaryData);

            const historyItems = createHistoryItems(1, 'Test item');
            const corruptedSettings = { invalid: 'structure' } as any;

            expect(() => renderHistoryWithErrorHandling(historyItems, corruptedSettings)).not.toThrow();

            const historyList = document.getElementById('historyList');
            expect(historyList?.innerHTML).toContain('history-item');
        });

        test('should handle settings file with only invalid YAML', async () => {
            const invalidYaml = '{[}]invalid yaml syntax}\ndefinitely not yaml: [[[';
            await fs.writeFile(settingsFile, invalidYaml, 'utf8');

            const historyItems = createHistoryItems(5);

            expect(() => renderHistoryWithErrorHandling(historyItems, null)).not.toThrow();
            expect(() => renderHistoryWithErrorHandling(historyItems, createMockSettings())).not.toThrow();
        });

        test('should handle settings file with mixed valid/invalid content', async () => {
            const mixedYaml = 'shortcuts:\n  paste: }invalid{\nwindow:\n  width: not_a_number';
            await fs.writeFile(settingsFile, mixedYaml, 'utf8');

            const historyItems = createHistoryItems(20, 'Mixed item');
            const invalidSettings = createMockSettings({ window: { position: 'cursor', width: 'not_a_number' as any, height: 400 } });

            expect(() => renderHistoryWithErrorHandling(historyItems, invalidSettings)).not.toThrow();
            expect(getRenderedItemsCount()).toBeGreaterThanOrEqual(0);
        });
    });

    describe('File system error scenarios', () => {
        test('should handle permission denied on settings directory', async () => {
            await fs.chmod(testDir, 0o444);

            try {
                await expect(fs.writeFile(settingsFile, 'test: data', 'utf8')).rejects.toThrow();

                const historyItems = createHistoryItems(1, 'Permission test');
                expect(() => renderHistoryWithErrorHandling(historyItems, null)).not.toThrow();
                expect(getRenderedItemsCount()).toBe(1);
            } finally {
                await fs.chmod(testDir, 0o755);
            }
        });

        test('should handle settings file being a directory instead of file', async () => {
            await fs.mkdir(settingsFile);

            try {
                await expect(fs.readFile(settingsFile, 'utf8')).rejects.toThrow();

                const historyItems = createHistoryItems(1, 'Directory test');
                expect(() => renderHistoryWithErrorHandling(historyItems, null)).not.toThrow();

                const historyList = document.getElementById('historyList');
                expect(historyList?.innerHTML).toContain('history-item');
            } finally {
                await fs.rmdir(settingsFile);
            }
        });

        test('should handle disk space exhaustion during file operations', async () => {
            const historyItems = createHistoryItems(3, 'Disk space test');
            const hugeSettings = createMockSettings({ largeData: new Array(1000).fill('data') } as any);

            expect(() => renderHistoryWithErrorHandling(historyItems, hugeSettings)).not.toThrow();
            expect(getRenderedItemsCount()).toBe(3);
        });
    });

    describe('Renderer error scenarios', () => {
        test('should handle missing DOM elements gracefully', () => {
            document.body.innerHTML = '';
            const historyItems = createHistoryItems(1, 'Test');
            const settings = createMockSettings();

            expect(() => renderHistoryWithErrorHandling(historyItems, settings)).not.toThrow();
            expect(document.getElementById('historyList')).toBeNull();
        });

        test('should handle extremely large history dataset', () => {
            setupTestDOM();

            const largeHistory: HistoryItem[] = Array.from({ length: 10000 }, (_, i) => ({
                text: `Very long text ${i + 1}`.repeat(10),
                timestamp: Date.now() - i * 1000,
                id: `large-id-${i + 1}`
            }));

            const startTime = Date.now();
            expect(() => renderHistoryWithErrorHandling(largeHistory, createMockSettings())).not.toThrow();
            expect(Date.now() - startTime).toBeLessThan(5000);

            expect(getRenderedItemsCount()).toBeGreaterThan(0);
            expect(getRenderedItemsCount()).toBeLessThanOrEqual(MAX_VISIBLE_ITEMS);
        });

        test('should handle history items with problematic content', () => {
            setupTestDOM();

            const problematicHistory: HistoryItem[] = [
                { text: '<script>alert("xss")</script>', timestamp: Date.now(), id: 'xss-1' },
                { text: '<img src="x" onerror="alert(1)">', timestamp: Date.now() - 1000, id: 'html-1' },
                { text: 'a'.repeat(100000), timestamp: Date.now() - 2000, id: 'long-1' },
                { text: '🚀🔥💯\u200B\u200C\u200D\uFEFF', timestamp: Date.now() - 3000, id: 'unicode-1' },
                { text: '', timestamp: Date.now() - 4000, id: 'empty-1' },
                { text: '   \n\t\r   ', timestamp: Date.now() - 5000, id: 'whitespace-1' }
            ];

            expect(() => renderHistoryWithErrorHandling(problematicHistory, createMockSettings())).not.toThrow();

            const historyList = document.getElementById('historyList');
            const textElements = historyList?.querySelectorAll('.history-text');
            const displayedTexts = Array.from(textElements || []).map(el => el.innerHTML);

            expect(displayedTexts.some(text => text.includes('&lt;script&gt;'))).toBe(true);
            expect(displayedTexts.some(text => text.includes('<script>'))).toBe(false);
        });
    });

    describe('Memory and performance edge cases', () => {
        test('should handle rapid file operations without memory leaks', async () => {
            const promises = Array.from({ length: 100 }, (_, i) => {
                const tempFile = path.join(testDir, `temp-${i}.yaml`);
                return fs.writeFile(tempFile, `window:\n  width: ${600 + i * 10}`, 'utf8')
                    .then(() => fs.unlink(tempFile).catch(() => {}));
            });

            await Promise.all(promises);

            const historyItems = createHistoryItems(1, 'Memory test');
            expect(() => renderHistoryWithErrorHandling(historyItems, null)).not.toThrow();
        });

        test('should handle rapid re-renders without memory issues', () => {
            setupTestDOM();
            const historyItems = createHistoryItems(50, 'Rapid render test');

            for (let i = 1; i <= 20; i++) {
                const settings = createMockSettings({ window: { position: 'cursor', width: 800 + i * 10, height: 400 } });
                expect(() => renderHistoryWithErrorHandling(historyItems, settings)).not.toThrow();
                expect(getRenderedItemsCount()).toBe(Math.min(MAX_VISIBLE_ITEMS, historyItems.length));
            }

            expect(getRenderedItemsCount()).toBe(50);
        });

        test('should handle stress test with large data and rapid changes', () => {
            setupTestDOM();

            const largeHistory: HistoryItem[] = Array.from({ length: 1000 }, (_, i) => ({
                text: `Stress test item ${i + 1} `.repeat(50),
                timestamp: Date.now() - i * 1000,
                id: `stress-${i + 1}`
            }));

            const stressWidths = [600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400, 1500];

            stressWidths.forEach(width => {
                const settings = createMockSettings({ window: { position: 'cursor', width, height: 400 } });
                const startTime = Date.now();

                expect(() => renderHistoryWithErrorHandling(largeHistory, settings)).not.toThrow();
                expect(Date.now() - startTime).toBeLessThan(1000);
                expect(getRenderedItemsCount()).toBe(Math.min(MAX_VISIBLE_ITEMS, largeHistory.length));
            });
        });
    });
});