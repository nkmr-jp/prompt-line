/**
 * @jest-environment jsdom
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { PopupManager, PopupManagerCallbacks } from '../../src/renderer/mentions/managers';

describe('PopupManager', () => {
  let popupManager: PopupManager;
  let mockCallbacks: PopupManagerCallbacks;
  let mainContent: HTMLElement;

  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = '';

    // Create main-content container (required for popup attachment)
    mainContent = document.createElement('div');
    mainContent.className = 'main-content';
    document.body.appendChild(mainContent);

    // Create mock callbacks
    mockCallbacks = {
      getSelectedSuggestion: jest.fn(() => null),
      getSuggestionsContainer: jest.fn(() => null)
    };

    // Create PopupManager
    popupManager = new PopupManager(mockCallbacks);
  });

  afterEach(() => {
    popupManager.destroy();
    jest.clearAllTimers();
  });

  describe('initialize', () => {
    test('should create popup element and append to main-content', () => {
      popupManager.initialize();

      const popup = document.getElementById('frontmatterPopup');
      expect(popup).not.toBeNull();
      expect(popup?.className).toBe('frontmatter-popup');
      expect(popup?.style.display).toBe('none');
      expect(mainContent.contains(popup)).toBe(true);
    });

    test('should not create duplicate popup on multiple initialize calls', () => {
      popupManager.initialize();
      popupManager.initialize();

      const popups = document.querySelectorAll('#frontmatterPopup');
      expect(popups).toHaveLength(1);
    });

    test('should not throw when main-content is missing', () => {
      mainContent.remove();

      expect(() => {
        popupManager.initialize();
      }).not.toThrow();
    });
  });

  describe('showFrontmatterPopup', () => {
    let suggestionsContainer: HTMLElement;
    let targetElement: HTMLElement;

    beforeEach(() => {
      // Create suggestions container
      suggestionsContainer = document.createElement('div');
      suggestionsContainer.className = 'file-suggestions';
      suggestionsContainer.style.width = '400px';
      mainContent.appendChild(suggestionsContainer);

      // Create target element (info icon)
      targetElement = document.createElement('span');
      targetElement.className = 'frontmatter-info-icon';
      suggestionsContainer.appendChild(targetElement);

      // Mock getBoundingClientRect
      Object.defineProperty(targetElement, 'getBoundingClientRect', {
        value: () => ({
          top: 100,
          bottom: 120,
          left: 350,
          right: 370,
          width: 20,
          height: 20
        })
      });

      Object.defineProperty(suggestionsContainer, 'getBoundingClientRect', {
        value: () => ({
          top: 50,
          bottom: 250,
          left: 50,
          right: 450,
          width: 400,
          height: 200
        })
      });

      // Update mock to return suggestions container
      (mockCallbacks.getSuggestionsContainer as jest.Mock).mockReturnValue(suggestionsContainer);
    });

    test('should show popup with agent frontmatter content', async () => {
      popupManager.initialize();

      const agent = {
        name: 'test-agent',
        description: 'Test agent description',
        filePath: '/path/to/agent',
        frontmatter: 'This is the agent description'
      };

      await popupManager.showFrontmatterPopup(agent, targetElement);

      const popup = document.getElementById('frontmatterPopup');
      expect(popup?.style.display).toBe('block');

      const content = popup?.querySelector('.frontmatter-content');
      expect(content?.textContent).toBe('This is the agent description');
    });

    test('should show hint message in popup', async () => {
      popupManager.initialize();

      const agent = {
        name: 'test-agent',
        description: 'Test agent description',
        filePath: '/path/to/agent',
        frontmatter: 'Agent description'
      };

      await popupManager.showFrontmatterPopup(agent, targetElement);

      const popup = document.getElementById('frontmatterPopup');
      const hint = popup?.querySelector('.frontmatter-hint');
      expect(hint?.textContent).toBe('Ctrl+i: auto-show tooltip');
    });

    test('should not show popup when agent has no frontmatter', () => {
      popupManager.initialize();

      const agent = {
        name: 'test-agent',
        description: 'Test agent description',
        filePath: '/path/to/agent',
        frontmatter: undefined
      };

      popupManager.showFrontmatterPopup(agent as any, targetElement);

      const popup = document.getElementById('frontmatterPopup');
      expect(popup?.style.display).toBe('none');
    });

    test('should not show popup when suggestions container is null', () => {
      popupManager.initialize();

      (mockCallbacks.getSuggestionsContainer as jest.Mock).mockReturnValue(null);

      const agent = {
        name: 'test-agent',
        description: 'Test agent description',
        filePath: '/path/to/agent',
        frontmatter: 'Agent description'
      };

      popupManager.showFrontmatterPopup(agent, targetElement);

      const popup = document.getElementById('frontmatterPopup');
      expect(popup?.style.display).toBe('none');
    });
  });

  describe('hideFrontmatterPopup', () => {
    test('should hide popup', () => {
      popupManager.initialize();

      // Show popup first
      const popup = document.getElementById('frontmatterPopup');
      if (popup) popup.style.display = 'block';

      popupManager.hideFrontmatterPopup();

      expect(popup?.style.display).toBe('none');
    });

    test('should handle missing popup gracefully', () => {
      expect(() => {
        popupManager.hideFrontmatterPopup();
      }).not.toThrow();
    });
  });

  describe('schedulePopupHide', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should hide popup after delay', () => {
      popupManager.initialize();

      const popup = document.getElementById('frontmatterPopup');
      if (popup) popup.style.display = 'block';

      popupManager.schedulePopupHide();

      // Popup should still be visible
      expect(popup?.style.display).toBe('block');

      // Fast forward timer
      jest.advanceTimersByTime(100);

      // Popup should now be hidden
      expect(popup?.style.display).toBe('none');
    });

    test('should cancel previous scheduled hide when called again', () => {
      popupManager.initialize();

      const popup = document.getElementById('frontmatterPopup');
      if (popup) popup.style.display = 'block';

      popupManager.schedulePopupHide();
      popupManager.schedulePopupHide();

      // Fast forward timer
      jest.advanceTimersByTime(100);

      // Popup should be hidden only once (no double execution)
      expect(popup?.style.display).toBe('none');
    });
  });

  describe('cancelPopupHide', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should cancel scheduled popup hide', () => {
      popupManager.initialize();

      const popup = document.getElementById('frontmatterPopup');
      if (popup) popup.style.display = 'block';

      popupManager.schedulePopupHide();
      popupManager.cancelPopupHide();

      // Fast forward timer
      jest.advanceTimersByTime(100);

      // Popup should still be visible (hide was cancelled)
      expect(popup?.style.display).toBe('block');
    });
  });

  describe('toggleAutoShowTooltip', () => {
    test('should toggle auto-show tooltip state', () => {
      popupManager.initialize();

      // Initially disabled
      expect(popupManager.isAutoShowTooltipEnabled()).toBe(false);

      // Toggle on
      popupManager.toggleAutoShowTooltip();
      expect(popupManager.isAutoShowTooltipEnabled()).toBe(true);

      // Toggle off
      popupManager.toggleAutoShowTooltip();
      expect(popupManager.isAutoShowTooltipEnabled()).toBe(false);
    });

    test('should hide popup when toggling off', () => {
      popupManager.initialize();

      const popup = document.getElementById('frontmatterPopup');
      if (popup) popup.style.display = 'block';

      // Toggle on
      popupManager.toggleAutoShowTooltip();

      // Toggle off should hide
      popupManager.toggleAutoShowTooltip();
      expect(popup?.style.display).toBe('none');
    });
  });

  describe('showTooltipForSelectedItem', () => {
    let suggestionsContainer: HTMLElement;

    beforeEach(() => {
      // Create suggestions container
      suggestionsContainer = document.createElement('div');
      suggestionsContainer.className = 'file-suggestions';
      mainContent.appendChild(suggestionsContainer);

      // Create selected item with info icon
      const selectedItem = document.createElement('div');
      selectedItem.className = 'file-suggestion-item selected';

      const infoIcon = document.createElement('span');
      infoIcon.className = 'frontmatter-info-icon';

      Object.defineProperty(infoIcon, 'getBoundingClientRect', {
        value: () => ({
          top: 100,
          bottom: 120,
          left: 350,
          right: 370,
          width: 20,
          height: 20
        })
      });

      Object.defineProperty(suggestionsContainer, 'getBoundingClientRect', {
        value: () => ({
          top: 50,
          bottom: 250,
          left: 50,
          right: 450,
          width: 400,
          height: 200
        })
      });

      selectedItem.appendChild(infoIcon);
      suggestionsContainer.appendChild(selectedItem);

      (mockCallbacks.getSuggestionsContainer as jest.Mock).mockReturnValue(suggestionsContainer);
    });

    test('should show tooltip when auto-show is enabled and agent is selected', async () => {
      popupManager.initialize();

      // Enable auto-show
      popupManager.toggleAutoShowTooltip();

      // Mock selected suggestion with agent
      (mockCallbacks.getSelectedSuggestion as jest.Mock).mockReturnValue({
        type: 'agent',
        agent: {
          name: 'test-agent',
          description: 'Test agent description',
          filePath: '/path/to/agent',
          frontmatter: 'Agent description'
        }
      });

      await popupManager.showTooltipForSelectedItem();

      const popup = document.getElementById('frontmatterPopup');
      expect(popup?.style.display).toBe('block');
    });

    test('should not show tooltip when auto-show is disabled', () => {
      popupManager.initialize();

      // Mock selected suggestion with agent
      (mockCallbacks.getSelectedSuggestion as jest.Mock).mockReturnValue({
        type: 'agent',
        agent: {
          name: 'test-agent',
          description: 'Test agent description',
          filePath: '/path/to/agent',
          frontmatter: 'Agent description'
        }
      });

      popupManager.showTooltipForSelectedItem();

      const popup = document.getElementById('frontmatterPopup');
      expect(popup?.style.display).toBe('none');
    });

    test('should hide popup when selected item is not an agent', () => {
      popupManager.initialize();

      // Enable auto-show
      popupManager.toggleAutoShowTooltip();

      // Mock selected suggestion with file
      (mockCallbacks.getSelectedSuggestion as jest.Mock).mockReturnValue({
        type: 'file',
        file: {
          name: 'test.txt',
          path: '/path/to/test.txt'
        }
      });

      // Show popup first
      const popup = document.getElementById('frontmatterPopup');
      if (popup) popup.style.display = 'block';

      popupManager.showTooltipForSelectedItem();

      expect(popup?.style.display).toBe('none');
    });
  });

  describe('destroy', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should remove popup element from DOM', () => {
      popupManager.initialize();

      expect(document.getElementById('frontmatterPopup')).not.toBeNull();

      popupManager.destroy();

      expect(document.getElementById('frontmatterPopup')).toBeNull();
    });

    test('should cancel any pending hide timeout', () => {
      popupManager.initialize();

      const popup = document.getElementById('frontmatterPopup');
      if (popup) popup.style.display = 'block';

      popupManager.schedulePopupHide();
      popupManager.destroy();

      // Fast forward timer - should not throw even though popup is removed
      expect(() => {
        jest.advanceTimersByTime(100);
      }).not.toThrow();
    });

    test('should handle destroy when not initialized', () => {
      expect(() => {
        popupManager.destroy();
      }).not.toThrow();
    });
  });

  describe('mouse events on popup', () => {
    let suggestionsContainer: HTMLElement;

    beforeEach(() => {
      jest.useFakeTimers();

      // Create suggestions container
      suggestionsContainer = document.createElement('div');
      suggestionsContainer.className = 'file-suggestions';
      mainContent.appendChild(suggestionsContainer);

      Object.defineProperty(suggestionsContainer, 'getBoundingClientRect', {
        value: () => ({
          top: 50,
          bottom: 250,
          left: 50,
          right: 450,
          width: 400,
          height: 200
        })
      });

      (mockCallbacks.getSuggestionsContainer as jest.Mock).mockReturnValue(suggestionsContainer);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should cancel hide on mouseenter', () => {
      popupManager.initialize();

      const popup = document.getElementById('frontmatterPopup');
      if (!popup) throw new Error('Popup not found');

      popup.style.display = 'block';

      // Schedule hide
      popupManager.schedulePopupHide();

      // Trigger mouseenter
      const mouseenterEvent = new Event('mouseenter');
      popup.dispatchEvent(mouseenterEvent);

      // Fast forward timer
      jest.advanceTimersByTime(100);

      // Popup should still be visible
      expect(popup.style.display).toBe('block');
    });

    test('should schedule hide on mouseleave', () => {
      popupManager.initialize();

      const popup = document.getElementById('frontmatterPopup');
      if (!popup) throw new Error('Popup not found');

      popup.style.display = 'block';

      // Trigger mouseleave
      const mouseleaveEvent = new Event('mouseleave');
      popup.dispatchEvent(mouseleaveEvent);

      // Fast forward timer
      jest.advanceTimersByTime(100);

      // Popup should be hidden
      expect(popup.style.display).toBe('none');
    });
  });
});
