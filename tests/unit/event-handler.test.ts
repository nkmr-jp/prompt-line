/**
 * @jest-environment jsdom
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { EventHandler } from '../../src/renderer/event-handler';

describe('EventHandler', () => {
  let eventHandler: EventHandler;
  let mockCallbacks: {
    onTextPaste: jest.Mock;
    onWindowHide: jest.Mock;
    onTabKeyInsert: jest.Mock;
    onShiftTabKeyPress: jest.Mock;
    onHistoryNavigation: jest.Mock;
    onSearchToggle: jest.Mock;
  };
  let textarea: HTMLTextAreaElement;

  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = '';

    // Create mock callbacks
    mockCallbacks = {
      onTextPaste: jest.fn(async () => {}),
      onWindowHide: jest.fn(async () => {}),
      onTabKeyInsert: jest.fn(),
      onShiftTabKeyPress: jest.fn(),
      onHistoryNavigation: jest.fn(),
      onSearchToggle: jest.fn()
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
    test('should call onTabKeyInsert when Tab key is pressed without Shift', () => {
      // Setup composition events
      eventHandler.setupEventListeners();

      // Create Tab key event without Shift
      const tabEvent = new KeyboardEvent('keydown', {
        key: 'Tab',
        shiftKey: false,
        bubbles: true
      });

      // Dispatch event
      textarea.dispatchEvent(tabEvent);

      // Verify onTabKeyInsert was called
      expect(mockCallbacks.onTabKeyInsert).toHaveBeenCalledTimes(1);
      expect(mockCallbacks.onTabKeyInsert).toHaveBeenCalledWith(expect.objectContaining({
        key: 'Tab',
        shiftKey: false
      }));
    });

    test('should call onShiftTabKeyPress when Shift+Tab is pressed', () => {
      // Setup composition events
      eventHandler.setupEventListeners();

      // Create Shift+Tab key event
      const shiftTabEvent = new KeyboardEvent('keydown', {
        key: 'Tab',
        shiftKey: true,
        bubbles: true
      });

      // Dispatch event
      textarea.dispatchEvent(shiftTabEvent);

      // Verify onTabKeyInsert was NOT called
      expect(mockCallbacks.onTabKeyInsert).not.toHaveBeenCalled();

      // Verify onShiftTabKeyPress WAS called
      expect(mockCallbacks.onShiftTabKeyPress).toHaveBeenCalledTimes(1);
      expect(mockCallbacks.onShiftTabKeyPress).toHaveBeenCalledWith(expect.objectContaining({
        key: 'Tab',
        shiftKey: true
      }));
    });

    test('should NOT call onTabKeyInsert when Tab is pressed during IME composition', () => {
      // Setup composition events
      eventHandler.setupEventListeners();

      // Simulate IME composition start
      const compositionStartEvent = new Event('compositionstart');
      textarea.dispatchEvent(compositionStartEvent);

      // Create Tab key event
      const tabEvent = new KeyboardEvent('keydown', {
        key: 'Tab',
        shiftKey: false,
        bubbles: true
      });

      // Dispatch event
      textarea.dispatchEvent(tabEvent);

      // Verify onTabKeyInsert was NOT called
      expect(mockCallbacks.onTabKeyInsert).not.toHaveBeenCalled();

      // Simulate IME composition end
      const compositionEndEvent = new Event('compositionend');
      textarea.dispatchEvent(compositionEndEvent);

      // Create another Tab key event after composition
      const tabEvent2 = new KeyboardEvent('keydown', {
        key: 'Tab',
        shiftKey: false,
        bubbles: true
      });

      // Dispatch event
      textarea.dispatchEvent(tabEvent2);

      // Now onTabKeyInsert should be called
      expect(mockCallbacks.onTabKeyInsert).toHaveBeenCalledTimes(1);
    });

    test('should prevent default Tab behavior', () => {
      // Setup composition events
      eventHandler.setupEventListeners();

      // Create Tab key event with preventDefault spy
      const tabEvent = new KeyboardEvent('keydown', {
        key: 'Tab',
        shiftKey: false,
        bubbles: true,
        cancelable: true
      });

      const preventDefaultSpy = jest.spyOn(tabEvent, 'preventDefault');

      // Dispatch event
      textarea.dispatchEvent(tabEvent);

      // Verify preventDefault was called
      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    test('should prevent default Shift+Tab behavior', () => {
      // Setup composition events
      eventHandler.setupEventListeners();

      // Create Shift+Tab key event with preventDefault spy
      const shiftTabEvent = new KeyboardEvent('keydown', {
        key: 'Tab',
        shiftKey: true,
        bubbles: true,
        cancelable: true
      });

      const preventDefaultSpy = jest.spyOn(shiftTabEvent, 'preventDefault');

      // Dispatch event
      textarea.dispatchEvent(shiftTabEvent);

      // Verify preventDefault was called even for Shift+Tab
      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });

  describe('Composition state tracking', () => {
    test('should track composition state correctly', () => {
      // Setup composition events
      eventHandler.setupEventListeners();

      // Initial state should be false
      expect(eventHandler.getIsComposing()).toBe(false);

      // Simulate IME composition start
      const compositionStartEvent = new Event('compositionstart');
      textarea.dispatchEvent(compositionStartEvent);

      // State should be true
      expect(eventHandler.getIsComposing()).toBe(true);

      // Simulate IME composition end
      const compositionEndEvent = new Event('compositionend');
      textarea.dispatchEvent(compositionEndEvent);

      // State should be false again
      expect(eventHandler.getIsComposing()).toBe(false);
    });
  });
});
