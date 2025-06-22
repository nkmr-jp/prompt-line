import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { DraftManager } from '../../src/renderer/draft-manager';
import type { IpcRenderer, Config } from '../../src/renderer/types';

describe('DraftManager', () => {
  let draftManager: DraftManager;
  let mockIpcRenderer: jest.Mocked<IpcRenderer>;
  let mockGetText: jest.MockedFunction<() => string>;

  beforeEach(() => {
    mockIpcRenderer = {
      invoke: jest.fn(),
      send: jest.fn(),
      on: jest.fn()
    } as any;

    const mockElectronAPI = {
      draft: {
        save: jest.fn().mockImplementation((...args: any[]) => {
          return mockIpcRenderer.invoke('save-draft', ...args);
        }),
        clear: jest.fn().mockImplementation((...args: any[]) => {
          return mockIpcRenderer.invoke('clear-draft', ...args);
        })
      }
    };

    mockGetText = jest.fn();
    draftManager = new DraftManager(mockElectronAPI, mockGetText);
    
    // Clear only the call history, not the mock implementations
    mockIpcRenderer.invoke.mockClear();
    mockGetText.mockClear();
  });

  afterEach(() => {
    // Clean up any timers to prevent Jest from hanging
    if (draftManager) {
      draftManager.cleanup();
    }
  });

  describe('configuration', () => {
    test('should set config', () => {
      const config: Config = {
        draft: { saveDelay: 1000 }
      };

      draftManager.setConfig(config);

      // No direct way to test this, but it should not throw
      expect(() => draftManager.setConfig(config)).not.toThrow();
    });
  });

  describe('debounced draft saving', () => {
    test('should save draft with default delay', (done) => {
      mockGetText.mockReturnValue('test text');

      draftManager.saveDraftDebounced();

      setTimeout(() => {
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('save-draft', 'test text');
        done();
      }, 550); // Default delay is 500ms
    });

    test('should save draft with custom delay', (done) => {
      const config: Config = { draft: { saveDelay: 100 } };
      draftManager.setConfig(config);
      mockGetText.mockReturnValue('test text');

      draftManager.saveDraftDebounced();

      setTimeout(() => {
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('save-draft', 'test text');
        done();
      }, 150);
    });

    test('should cancel previous debounced save', (done) => {
      mockGetText.mockReturnValue('first text').mockReturnValueOnce('second text');
      const config: Config = { draft: { saveDelay: 100 } };
      draftManager.setConfig(config);

      draftManager.saveDraftDebounced();
      mockGetText.mockReturnValue('second text');
      draftManager.saveDraftDebounced();

      setTimeout(() => {
        expect(mockIpcRenderer.invoke).toHaveBeenCalledTimes(1);
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('save-draft', 'second text');
        done();
      }, 150);
    });
  });

  describe('immediate draft saving', () => {
    test('should save draft immediately', async () => {
      mockGetText.mockReturnValue('test text');

      await draftManager.saveDraftImmediate();

      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('save-draft', 'test text');
    });

    test('should save provided text immediately', async () => {
      await draftManager.saveDraftImmediate('provided text');

      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('save-draft', 'provided text');
      expect(mockGetText).not.toHaveBeenCalled();
    });

    test('should not save empty text', async () => {
      mockGetText.mockReturnValue('');

      await draftManager.saveDraftImmediate();

      expect(mockIpcRenderer.invoke).not.toHaveBeenCalled();
    });

    test('should not save whitespace-only text', async () => {
      mockGetText.mockReturnValue('   \n\t  ');

      await draftManager.saveDraftImmediate();

      expect(mockIpcRenderer.invoke).not.toHaveBeenCalled();
    });
  });

  describe('draft clearing', () => {
    test('should clear draft', async () => {
      await draftManager.clearDraft();

      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('clear-draft');
    });
  });

  describe('draft value extraction', () => {
    test('should extract string draft value', () => {
      const result = draftManager.extractDraftValue('test string');

      expect(result).toBe('test string');
    });

    test('should extract object draft value', () => {
      const result = draftManager.extractDraftValue({ text: 'test object' });

      expect(result).toBe('test object');
    });

    test('should handle null draft value', () => {
      const result = draftManager.extractDraftValue(null);

      expect(result).toBe('');
    });

    test('should handle undefined draft value', () => {
      const result = draftManager.extractDraftValue(undefined);

      expect(result).toBe('');
    });

    test('should handle empty object draft value', () => {
      const result = draftManager.extractDraftValue({} as any);

      expect(result).toBe('');
    });
  });

  describe('cleanup', () => {
    test('should clear timeout on cleanup', () => {
      mockGetText.mockReturnValue('test text');
      
      draftManager.saveDraftDebounced();
      draftManager.cleanup();

      // Wait longer than the timeout would have been
      setTimeout(() => {
        expect(mockIpcRenderer.invoke).not.toHaveBeenCalled();
      }, 600);
    });

    test('should handle cleanup when no timeout exists', () => {
      expect(() => draftManager.cleanup()).not.toThrow();
    });
  });
});