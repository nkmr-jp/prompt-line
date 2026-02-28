// @vitest-environment jsdom

import type { Mock } from 'vitest';
import { EventHandler } from '../../src/renderer/event-handler';

describe('EventHandler', () => {
  let eventHandler: EventHandler;
  let mockCallbacks: {
    onTextPaste: Mock;
    onWindowHide: Mock;
    onTabKeyInsert: Mock;
    onShiftTabKeyPress: Mock;
    onHistoryNavigation: Mock;
    onSearchToggle: Mock;
  };
  let textarea: HTMLTextAreaElement;

  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = '';

    // Create mock callbacks
    mockCallbacks = {
      onTextPaste: vi.fn(async () => {}),
      onWindowHide: vi.fn(async () => {}),
      onTabKeyInsert: vi.fn(),
      onShiftTabKeyPress: vi.fn(),
      onHistoryNavigation: vi.fn(),
      onSearchToggle: vi.fn()
    };

    // Create EventHandler
    eventHandler = new EventHandler(mockCallbacks as any);

    // Create and set textarea
    textarea = document.createElement('textarea');
    textarea.id = 'textInput';
    document.body.appendChild(textarea);

    eventHandler.setTextarea(textarea);
  });

  describe('Tab key handling', () => {
    test('should dispatch Tab to onTabKeyInsert and Shift+Tab to onShiftTabKeyPress', () => {
      eventHandler.setupEventListeners();

      // Tab without Shift calls onTabKeyInsert and prevents default
      const tabEvent = new KeyboardEvent('keydown', {
        key: 'Tab', shiftKey: false, bubbles: true, cancelable: true
      });
      const tabPreventDefaultSpy = vi.spyOn(tabEvent, 'preventDefault');
      textarea.dispatchEvent(tabEvent);
      expect(mockCallbacks.onTabKeyInsert).toHaveBeenCalledTimes(1);
      expect(mockCallbacks.onShiftTabKeyPress).not.toHaveBeenCalled();
      expect(tabPreventDefaultSpy).toHaveBeenCalled();

      // Shift+Tab calls onShiftTabKeyPress instead and prevents default
      const shiftTabEvent = new KeyboardEvent('keydown', {
        key: 'Tab', shiftKey: true, bubbles: true, cancelable: true
      });
      const shiftTabPreventDefaultSpy = vi.spyOn(shiftTabEvent, 'preventDefault');
      textarea.dispatchEvent(shiftTabEvent);
      expect(mockCallbacks.onTabKeyInsert).toHaveBeenCalledTimes(1); // still 1
      expect(mockCallbacks.onShiftTabKeyPress).toHaveBeenCalledTimes(1);
      expect(shiftTabPreventDefaultSpy).toHaveBeenCalled();
    });

    test('should NOT call onTabKeyInsert when Tab is pressed during IME composition', () => {
      eventHandler.setupEventListeners();

      // Simulate IME composition start
      textarea.dispatchEvent(new Event('compositionstart'));

      // Tab during composition should be ignored
      textarea.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Tab', shiftKey: false, bubbles: true
      }));
      expect(mockCallbacks.onTabKeyInsert).not.toHaveBeenCalled();

      // Simulate IME composition end
      textarea.dispatchEvent(new Event('compositionend'));

      // Tab after composition should work
      textarea.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Tab', shiftKey: false, bubbles: true
      }));
      expect(mockCallbacks.onTabKeyInsert).toHaveBeenCalledTimes(1);
    });

    test('should ignore non-Tab keys', () => {
      eventHandler.setupEventListeners();

      textarea.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Enter', bubbles: true
      }));
      textarea.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'a', bubbles: true
      }));

      expect(mockCallbacks.onTabKeyInsert).not.toHaveBeenCalled();
      expect(mockCallbacks.onShiftTabKeyPress).not.toHaveBeenCalled();
    });
  });
});
