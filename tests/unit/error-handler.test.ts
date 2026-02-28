/**
 * Tests for error-handler utility
 */

import type { MockInstance } from 'vitest';
import { handleError } from '../../src/renderer/utils/error-handler';

describe('error-handler', () => {
  // Mock console.error
  let consoleErrorSpy: MockInstance;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Ensure window is available
    if (typeof window === 'undefined') {
      (global as any).window = {};
    }
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    // Cleanup window mock
    if ((window as any).uiManager) {
      delete (window as any).uiManager;
    }
  });

  describe('handleError', () => {
    it('should skip logging in silent mode', () => {
      const error = new Error('Test error');
      handleError('TestContext', error, { silent: true });

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should show notification when notify option is true', () => {
      const mockShowNotification = vi.fn();
      (window as any).uiManager = {
        showNotification: mockShowNotification
      };

      const error = new Error('Test error');
      handleError('TestContext', error, { notify: true });

      expect(mockShowNotification).toHaveBeenCalledWith('[TestContext] Test error', 'error');

      // Cleanup
      delete (window as any).uiManager;
    });

    it('should handle missing UIManager gracefully', () => {
      const error = new Error('Test error');

      // Should not throw even if UIManager is not available
      expect(() => {
        handleError('TestContext', error, { notify: true });
      }).not.toThrow();

      // Should still log the error
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should rethrow error when rethrow option is true', () => {
      const error = new Error('Test error');

      expect(() => {
        handleError('TestContext', error, { rethrow: true });
      }).toThrow('Test error');
    });

    it('should support all options combined', () => {
      const mockShowNotification = vi.fn();
      (window as any).uiManager = {
        showNotification: mockShowNotification
      };

      const error = new Error('Test error');

      expect(() => {
        handleError('TestContext', error, {
          notify: true,
          rethrow: true,
          silent: true
        });
      }).toThrow('Test error');

      expect(consoleErrorSpy).not.toHaveBeenCalled(); // silent mode
      expect(mockShowNotification).toHaveBeenCalled(); // notify

      // Cleanup
      delete (window as any).uiManager;
    });

  });
});
