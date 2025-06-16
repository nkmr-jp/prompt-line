/**
 * @jest-environment jsdom
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import type { UserSettings, HistoryItem } from '../../src/types';

describe('DOM Integration Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        
        // Set up DOM for tests
        document.body.innerHTML = `
            <textarea id="textInput"></textarea>
            <div id="appName"></div>
            <div id="charCount"></div>
            <div id="historyList"></div>
        `;
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

    function renderHistoryWithSettings(
        historyData: HistoryItem[], 
        _settings: UserSettings | null
    ): void {
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
            const historyItem = createHistoryElement(item);
            fragment.appendChild(historyItem);
        });

        historyList.innerHTML = '';
        historyList.appendChild(fragment);

        if (historyData.length > maxVisibleItems) {
            const moreIndicator = document.createElement('div');
            moreIndicator.className = 'history-more';
            moreIndicator.textContent = `+${historyData.length - maxVisibleItems} more items`;
            historyList.appendChild(moreIndicator);
        }
    }

    describe('DOM rendering', () => {
        test('should render all items when under the limit', () => {
            const historyData: HistoryItem[] = Array.from({ length: 20 }, (_, i) => ({
                text: `History item ${i + 1}`,
                timestamp: Date.now() - i * 1000,
                id: `id-${i + 1}`
            }));

            const settings: UserSettings = {
                shortcuts: { main: 'Cmd+Shift+Space', paste: 'Cmd+Enter', close: 'Escape', historyNext: 'Ctrl+j', historyPrev: 'Ctrl+k', search: 'Cmd+f' },
                window: { position: 'cursor', width: 600, height: 300 }
            };

            renderHistoryWithSettings(historyData, settings);

            // Check actual DOM elements
            const historyItems = document.querySelectorAll('.history-item');
            expect(historyItems.length).toBe(20);

            // Check that more indicator is not shown (all items fit)
            const moreIndicator = document.querySelector('.history-more');
            expect(moreIndicator).toBeNull();
        });

        test('should fallback to default when no settings provided', () => {
            const historyData: HistoryItem[] = Array.from({ length: 20 }, (_, i) => ({
                text: `History item ${i + 1}`,
                timestamp: Date.now() - i * 1000,
                id: `id-${i + 1}`
            }));

            renderHistoryWithSettings(historyData, null);

            // Should use default of 200 (all 20 items should be visible)
            const historyItems = document.querySelectorAll('.history-item');
            expect(historyItems.length).toBe(20);

            const moreIndicator = document.querySelector('.history-more');
            expect(moreIndicator).toBeNull();
        });

        test('should handle empty history', () => {
            const settings: UserSettings = {
                shortcuts: { main: 'Cmd+Shift+Space', paste: 'Cmd+Enter', close: 'Escape', historyNext: 'Ctrl+j', historyPrev: 'Ctrl+k', search: 'Cmd+f' },
                window: { position: 'cursor', width: 600, height: 300 }
            };

            renderHistoryWithSettings([], settings);

            // Should show empty state
            const historyList = document.getElementById('historyList');
            expect(historyList?.innerHTML).toContain('No history items');

            // Should not have any history items
            const historyItems = document.querySelectorAll('.history-item');
            expect(historyItems.length).toBe(0);
        });

        test('should handle small history dataset', () => {
            const historyData: HistoryItem[] = Array.from({ length: 3 }, (_, i) => ({
                text: `History item ${i + 1}`,
                timestamp: Date.now() - i * 1000,
                id: `id-${i + 1}`
            }));

            const settings: UserSettings = {
                shortcuts: { main: 'Cmd+Shift+Space', paste: 'Cmd+Enter', close: 'Escape', historyNext: 'Ctrl+j', historyPrev: 'Ctrl+k', search: 'Cmd+f' },
                window: { position: 'cursor', width: 600, height: 300 }
            };

            renderHistoryWithSettings(historyData, settings);

            // Should render all available items (3)
            const historyItems = document.querySelectorAll('.history-item');
            expect(historyItems.length).toBe(3);

            // Should not show more indicator
            const moreIndicator = document.querySelector('.history-more');
            expect(moreIndicator).toBeNull();
        });


        test('should create history elements with correct structure', () => {
            const historyData: HistoryItem[] = [
                { text: 'Test content with\nnewlines', timestamp: Date.now(), id: 'test-1' }
            ];

            const settings: UserSettings = {
                shortcuts: { main: 'Cmd+Shift+Space', paste: 'Cmd+Enter', close: 'Escape', historyNext: 'Ctrl+j', historyPrev: 'Ctrl+k', search: 'Cmd+f' },
                window: { position: 'cursor', width: 600, height: 300 }
            };

            renderHistoryWithSettings(historyData, settings);

            const historyItem = document.querySelector('.history-item') as HTMLElement;
            expect(historyItem).toBeTruthy();
            expect(historyItem?.dataset.text).toBe('Test content with\nnewlines');
            expect(historyItem?.dataset.id).toBe('test-1');

            // Check text content processing (newlines should be replaced with spaces)
            const textDiv = historyItem?.querySelector('.history-text');
            expect(textDiv?.textContent).toBe('Test content with newlines');

            // Check time element exists
            const timeDiv = historyItem?.querySelector('.history-time');
            expect(timeDiv?.textContent).toBe('Just now');
        });
    });
});