/**
 * @jest-environment jsdom
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import type { UserSettings, HistoryItem } from '../../src/types';

// Constants
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

    const visibleItems = historyData.slice(0, MAX_VISIBLE_ITEMS);
    const fragment = document.createDocumentFragment();

    visibleItems.forEach((item) => {
        const historyItem = createHistoryElement(item);
        fragment.appendChild(historyItem);
    });

    historyList.innerHTML = '';
    historyList.appendChild(fragment);

    if (historyData.length > MAX_VISIBLE_ITEMS) {
        historyList.appendChild(createMoreIndicator(historyData.length - MAX_VISIBLE_ITEMS));
    }
}

function createMockSettings(): UserSettings {
    return {
        shortcuts: { main: 'Cmd+Shift+Space', paste: 'Cmd+Enter', close: 'Escape', historyNext: 'Ctrl+j', historyPrev: 'Ctrl+k', search: 'Cmd+f' },
        window: { position: 'cursor', width: 600, height: 300 }
    };
}

function createHistoryItems(count: number, prefix = 'History item'): HistoryItem[] {
    return Array.from({ length: count }, (_, i) => ({
        text: `${prefix} ${i + 1}`,
        timestamp: Date.now() - i * 1000,
        id: `id-${i + 1}`
    }));
}

describe('DOM Integration Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        setupTestDOM();
    });

    describe('DOM rendering', () => {
        test('should render all items when under the limit', () => {
            const historyData = createHistoryItems(20);
            renderHistoryWithSettings(historyData, createMockSettings());

            expect(document.querySelectorAll('.history-item').length).toBe(20);
            expect(document.querySelector('.history-more')).toBeNull();
        });

        test('should fallback to default when no settings provided', () => {
            const historyData = createHistoryItems(20);
            renderHistoryWithSettings(historyData, null);

            expect(document.querySelectorAll('.history-item').length).toBe(20);
            expect(document.querySelector('.history-more')).toBeNull();
        });

        test('should handle empty history', () => {
            renderHistoryWithSettings([], createMockSettings());

            const historyList = document.getElementById('historyList');
            expect(historyList?.innerHTML).toContain('No history items');
            expect(document.querySelectorAll('.history-item').length).toBe(0);
        });

        test('should handle small history dataset', () => {
            const historyData = createHistoryItems(3);
            renderHistoryWithSettings(historyData, createMockSettings());

            expect(document.querySelectorAll('.history-item').length).toBe(3);
            expect(document.querySelector('.history-more')).toBeNull();
        });

        test('should create history elements with correct structure', () => {
            const historyData: HistoryItem[] = [
                { text: 'Test content with\nnewlines', timestamp: Date.now(), id: 'test-1' }
            ];

            renderHistoryWithSettings(historyData, createMockSettings());

            const historyItem = document.querySelector('.history-item') as HTMLElement;
            expect(historyItem).toBeTruthy();
            expect(historyItem?.dataset.text).toBe('Test content with\nnewlines');
            expect(historyItem?.dataset.id).toBe('test-1');

            const textDiv = historyItem?.querySelector('.history-text');
            expect(textDiv?.textContent).toBe('Test content with newlines');

            const timeDiv = historyItem?.querySelector('.history-time');
            expect(timeDiv?.textContent).toBe('Just now');
        });
    });
});