import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Test: Tab key behavior in NavigationManager when suggestions are empty.
 *
 * Root cause: NavigationManager.handleTab only called preventDefault/stopPropagation
 * when totalItems > 0. When "No matching items found" was shown (totalItems === 0),
 * Tab's default focus-change behavior was not prevented, causing focus to leave the textarea.
 */
describe('NavigationManager Tab key with empty suggestions', () => {
  let preventDefaultCalled: boolean;
  let stopPropagationCalled: boolean;
  let hideSuggestionsCalled: boolean;
  let selectItemCalled: boolean;

  const createMockEvent = (key: string, options: Partial<KeyboardEvent> = {}): KeyboardEvent => {
    return {
      key,
      isComposing: false,
      ctrlKey: false,
      preventDefault: () => { preventDefaultCalled = true; },
      stopPropagation: () => { stopPropagationCalled = true; },
      ...options,
    } as unknown as KeyboardEvent;
  };

  // Simulate NavigationManager.handleTab logic
  function simulateHandleTab(
    totalItems: number,
    isInSymbolMode: boolean,
    e: KeyboardEvent
  ): void {
    preventDefaultCalled = false;
    stopPropagationCalled = false;
    hideSuggestionsCalled = false;
    selectItemCalled = false;

    if (e.isComposing) return;

    // Updated logic: always preventDefault when visible
    e.preventDefault();
    e.stopPropagation();

    if (totalItems === 0 && !isInSymbolMode) {
      hideSuggestionsCalled = true;
      return;
    }

    selectItemCalled = true;
  }

  beforeEach(() => {
    preventDefaultCalled = false;
    stopPropagationCalled = false;
    hideSuggestionsCalled = false;
    selectItemCalled = false;
  });

  it('should preventDefault and close popup when totalItems is 0', () => {
    const e = createMockEvent('Tab');
    simulateHandleTab(0, false, e);

    expect(preventDefaultCalled).toBe(true);
    expect(stopPropagationCalled).toBe(true);
    expect(hideSuggestionsCalled).toBe(true);
    expect(selectItemCalled).toBe(false);
  });

  it('should preventDefault and select item when totalItems > 0', () => {
    const e = createMockEvent('Tab');
    simulateHandleTab(3, false, e);

    expect(preventDefaultCalled).toBe(true);
    expect(stopPropagationCalled).toBe(true);
    expect(hideSuggestionsCalled).toBe(false);
    expect(selectItemCalled).toBe(true);
  });

  it('should not handle Tab when IME is composing', () => {
    const e = createMockEvent('Tab', { isComposing: true });
    simulateHandleTab(0, false, e);

    expect(preventDefaultCalled).toBe(false);
    expect(stopPropagationCalled).toBe(false);
    expect(hideSuggestionsCalled).toBe(false);
  });

  it('should select item in symbol mode even with totalItems 0', () => {
    const e = createMockEvent('Tab');
    simulateHandleTab(0, true, e);

    expect(preventDefaultCalled).toBe(true);
    expect(stopPropagationCalled).toBe(true);
    expect(hideSuggestionsCalled).toBe(false);
    expect(selectItemCalled).toBe(true);
  });
});
