// @vitest-environment jsdom

import type { Mock } from 'vitest';
import { ShortcutHandler } from '../../src/renderer/shortcut-handler';

// Mock electronAPI
vi.mock('../../src/renderer/services/electron-api', () => ({
  electronAPI: {
    invoke: vi.fn(async () => {})
  }
}));

// Mock renderer logger
vi.mock('../../src/renderer/utils/logger', () => ({
  rendererLogger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

function createKeyboardEvent(key: string, options: {
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
} = {}): KeyboardEvent {
  return new KeyboardEvent('keydown', {
    key,
    metaKey: options.metaKey ?? false,
    ctrlKey: options.ctrlKey ?? false,
    shiftKey: options.shiftKey ?? false,
    altKey: options.altKey ?? false,
    bubbles: true,
    cancelable: true
  });
}

describe('ShortcutHandler', () => {
  let handler: ShortcutHandler;
  let mockCallbacks: {
    onTextPaste: Mock;
    onWindowHide: Mock;
    onTabKeyInsert: Mock;
    onShiftTabKeyPress: Mock;
    onHistoryNavigation: Mock;
    onSearchToggle: Mock;
    onUndo: Mock;
    onSaveDraftToHistory: Mock;
  };
  let textarea: HTMLTextAreaElement;

  beforeEach(() => {
    document.body.innerHTML = '';

    mockCallbacks = {
      onTextPaste: vi.fn(async () => {}),
      onWindowHide: vi.fn(async () => {}),
      onTabKeyInsert: vi.fn(),
      onShiftTabKeyPress: vi.fn(),
      onHistoryNavigation: vi.fn(),
      onSearchToggle: vi.fn(),
      onUndo: vi.fn(() => true),
      onSaveDraftToHistory: vi.fn(async () => {})
    };

    handler = new ShortcutHandler(mockCallbacks);

    textarea = document.createElement('textarea');
    textarea.id = 'textInput';
    textarea.value = 'test text';
    document.body.appendChild(textarea);
    handler.setTextarea(textarea);
  });

  describe('paste shortcut (default: Cmd+Enter)', () => {
    test('should trigger paste with default Cmd+Enter when no settings', async () => {
      // No userSettings set - should use fallback
      const e = createKeyboardEvent('Enter', { metaKey: true });
      const result = await handler.handleKeyDown(e);
      expect(result).toBe(true);
      expect(mockCallbacks.onTextPaste).toHaveBeenCalledWith('test text');
    });

    test('should trigger paste with default Cmd+Enter when settings match default', async () => {
      handler.setUserSettings({
        shortcuts: {
          main: 'Cmd+Shift+Space',
          paste: 'Cmd+Enter',
          close: 'Escape',
          historyNext: 'Ctrl+j',
          historyPrev: 'Ctrl+k',
          search: 'Cmd+f'
        }
      } as any);

      const e = createKeyboardEvent('Enter', { metaKey: true });
      const result = await handler.handleKeyDown(e);
      expect(result).toBe(true);
      expect(mockCallbacks.onTextPaste).toHaveBeenCalledWith('test text');
    });

    test('should respect custom paste shortcut override', async () => {
      handler.setUserSettings({
        shortcuts: {
          main: 'Cmd+Shift+Space',
          paste: 'Ctrl+Enter',
          close: 'Escape',
          historyNext: 'Ctrl+j',
          historyPrev: 'Ctrl+k',
          search: 'Cmd+f'
        }
      } as any);

      // Default Cmd+Enter should NOT trigger paste
      const defaultEvent = createKeyboardEvent('Enter', { metaKey: true });
      await handler.handleKeyDown(defaultEvent);
      expect(mockCallbacks.onTextPaste).not.toHaveBeenCalled();

      // Custom Ctrl+Enter SHOULD trigger paste
      const customEvent = createKeyboardEvent('Enter', { ctrlKey: true });
      const result = await handler.handleKeyDown(customEvent);
      expect(result).toBe(true);
      expect(mockCallbacks.onTextPaste).toHaveBeenCalledWith('test text');
    });

    test('should respect Cmd+Shift+Enter as paste shortcut', async () => {
      handler.setUserSettings({
        shortcuts: {
          main: 'Cmd+Shift+Space',
          paste: 'Cmd+Shift+Enter',
          close: 'Escape',
          historyNext: 'Ctrl+j',
          historyPrev: 'Ctrl+k',
          search: 'Cmd+f'
        }
      } as any);

      // Default Cmd+Enter should NOT trigger paste
      const defaultEvent = createKeyboardEvent('Enter', { metaKey: true });
      await handler.handleKeyDown(defaultEvent);
      expect(mockCallbacks.onTextPaste).not.toHaveBeenCalled();

      // Custom Cmd+Shift+Enter SHOULD trigger paste
      const customEvent = createKeyboardEvent('Enter', { metaKey: true, shiftKey: true });
      const result = await handler.handleKeyDown(customEvent);
      expect(result).toBe(true);
      expect(mockCallbacks.onTextPaste).toHaveBeenCalledWith('test text');
    });
  });

  describe('close shortcut (default: Escape)', () => {
    test('should trigger close with default Escape when no settings', async () => {
      const e = createKeyboardEvent('Escape');
      const result = await handler.handleKeyDown(e);
      expect(result).toBe(true);
      expect(mockCallbacks.onWindowHide).toHaveBeenCalled();
    });

    test('should trigger close with default Escape when settings match default', async () => {
      handler.setUserSettings({
        shortcuts: {
          main: 'Cmd+Shift+Space',
          paste: 'Cmd+Enter',
          close: 'Escape',
          historyNext: 'Ctrl+j',
          historyPrev: 'Ctrl+k',
          search: 'Cmd+f'
        }
      } as any);

      const e = createKeyboardEvent('Escape');
      const result = await handler.handleKeyDown(e);
      expect(result).toBe(true);
      expect(mockCallbacks.onWindowHide).toHaveBeenCalled();
    });

    test('should respect custom close shortcut override', async () => {
      handler.setUserSettings({
        shortcuts: {
          main: 'Cmd+Shift+Space',
          paste: 'Cmd+Enter',
          close: 'Cmd+w',
          historyNext: 'Ctrl+j',
          historyPrev: 'Ctrl+k',
          search: 'Cmd+f'
        }
      } as any);

      // Default Escape should NOT trigger close
      const escEvent = createKeyboardEvent('Escape');
      const result1 = await handler.handleKeyDown(escEvent);
      expect(result1).toBe(false);
      expect(mockCallbacks.onWindowHide).not.toHaveBeenCalled();

      // Custom Cmd+W SHOULD trigger close
      const customEvent = createKeyboardEvent('w', { metaKey: true });
      const result2 = await handler.handleKeyDown(customEvent);
      expect(result2).toBe(true);
      expect(mockCallbacks.onWindowHide).toHaveBeenCalled();
    });

    test('should respect Ctrl+Escape as close shortcut', async () => {
      handler.setUserSettings({
        shortcuts: {
          main: 'Cmd+Shift+Space',
          paste: 'Cmd+Enter',
          close: 'Ctrl+Escape',
          historyNext: 'Ctrl+j',
          historyPrev: 'Ctrl+k',
          search: 'Cmd+f'
        }
      } as any);

      // Plain Escape should NOT trigger close
      const plainEsc = createKeyboardEvent('Escape');
      const result1 = await handler.handleKeyDown(plainEsc);
      expect(result1).toBe(false);
      expect(mockCallbacks.onWindowHide).not.toHaveBeenCalled();

      // Ctrl+Escape SHOULD trigger close
      const ctrlEsc = createKeyboardEvent('Escape', { ctrlKey: true });
      const result2 = await handler.handleKeyDown(ctrlEsc);
      expect(result2).toBe(true);
      expect(mockCallbacks.onWindowHide).toHaveBeenCalled();
    });
  });

  describe('historyNext shortcut (default: Ctrl+j)', () => {
    test('should respect custom historyNext shortcut', async () => {
      handler.setUserSettings({
        shortcuts: {
          main: 'Cmd+Shift+Space',
          paste: 'Cmd+Enter',
          close: 'Escape',
          historyNext: 'Cmd+Down',
          historyPrev: 'Cmd+Up',
          search: 'Cmd+f'
        }
      } as any);

      // Default Ctrl+j should NOT trigger historyNext
      const defaultEvent = createKeyboardEvent('j', { ctrlKey: true });
      await handler.handleKeyDown(defaultEvent);
      expect(mockCallbacks.onHistoryNavigation).not.toHaveBeenCalled();
    });

    test('should use settings for historyNext', async () => {
      handler.setUserSettings({
        shortcuts: {
          main: 'Cmd+Shift+Space',
          paste: 'Cmd+Enter',
          close: 'Escape',
          historyNext: 'Alt+j',
          historyPrev: 'Alt+k',
          search: 'Cmd+f'
        }
      } as any);

      // Default Ctrl+j should NOT work
      const defaultEvent = createKeyboardEvent('j', { ctrlKey: true });
      await handler.handleKeyDown(defaultEvent);
      expect(mockCallbacks.onHistoryNavigation).not.toHaveBeenCalled();

      // Custom Alt+j SHOULD work
      const customEvent = createKeyboardEvent('j', { altKey: true });
      const result = await handler.handleKeyDown(customEvent);
      expect(result).toBe(true);
      expect(mockCallbacks.onHistoryNavigation).toHaveBeenCalledWith(customEvent, 'next');
    });
  });

  describe('search shortcut (default: Cmd+f)', () => {
    test('should respect custom search shortcut', async () => {
      handler.setUserSettings({
        shortcuts: {
          main: 'Cmd+Shift+Space',
          paste: 'Cmd+Enter',
          close: 'Escape',
          historyNext: 'Ctrl+j',
          historyPrev: 'Ctrl+k',
          search: 'Ctrl+f'
        }
      } as any);

      // Default Cmd+f should NOT trigger search
      const defaultEvent = createKeyboardEvent('f', { metaKey: true });
      await handler.handleKeyDown(defaultEvent);
      expect(mockCallbacks.onSearchToggle).not.toHaveBeenCalled();

      // Custom Ctrl+f SHOULD trigger search
      const customEvent = createKeyboardEvent('f', { ctrlKey: true });
      const result = await handler.handleKeyDown(customEvent);
      expect(result).toBe(true);
      expect(mockCallbacks.onSearchToggle).toHaveBeenCalled();
    });
  });

  describe('hardcoded shortcuts should remain unchanged', () => {
    test('Cmd+Z should always trigger undo', async () => {
      const e = createKeyboardEvent('z', { metaKey: true });
      const result = await handler.handleKeyDown(e);
      expect(result).toBe(true);
      expect(mockCallbacks.onUndo).toHaveBeenCalled();
    });

    test('Cmd+S should always trigger save draft to history', async () => {
      const e = createKeyboardEvent('s', { metaKey: true });
      const result = await handler.handleKeyDown(e);
      expect(result).toBe(true);
      expect(mockCallbacks.onSaveDraftToHistory).toHaveBeenCalled();
    });
  });

  describe('handleHistoryNavigationShortcutsForComponent', () => {
    test('should respect custom shortcuts for component navigation', () => {
      handler.setUserSettings({
        shortcuts: {
          main: 'Cmd+Shift+Space',
          paste: 'Cmd+Enter',
          close: 'Escape',
          historyNext: 'Alt+n',
          historyPrev: 'Alt+p',
          search: 'Cmd+f'
        }
      } as any);

      const onNavigate = vi.fn();

      // Custom Alt+n SHOULD trigger next
      const nextEvent = createKeyboardEvent('n', { altKey: true });
      const result1 = handler.handleHistoryNavigationShortcutsForComponent(nextEvent, onNavigate);
      expect(result1).toBe(true);
      expect(onNavigate).toHaveBeenCalledWith('next');

      // Custom Alt+p SHOULD trigger prev
      const prevEvent = createKeyboardEvent('p', { altKey: true });
      const result2 = handler.handleHistoryNavigationShortcutsForComponent(prevEvent, onNavigate);
      expect(result2).toBe(true);
      expect(onNavigate).toHaveBeenCalledWith('prev');

      // Default Ctrl+j should NOT work
      const defaultEvent = createKeyboardEvent('j', { ctrlKey: true });
      onNavigate.mockClear();
      const result3 = handler.handleHistoryNavigationShortcutsForComponent(defaultEvent, onNavigate);
      expect(result3).toBe(false);
      expect(onNavigate).not.toHaveBeenCalled();
    });
  });
});
