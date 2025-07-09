/**
 * @jest-environment jsdom
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { formatShortcut, updateShortcutsDisplay } from '../../../src/renderer/utils/shortcut-formatter';

describe('formatShortcut', () => {
  test('should replace Cmd with ⌘', () => {
    expect(formatShortcut('Cmd+Enter')).toBe('⌘+↵');
  });

  test('should replace Command with ⌘', () => {
    expect(formatShortcut('Command+Enter')).toBe('⌘+↵');
  });

  test('should preserve Ctrl', () => {
    expect(formatShortcut('Ctrl+j')).toBe('Ctrl+j');
  });

  test('should replace Control with Ctrl', () => {
    expect(formatShortcut('Control+k')).toBe('Ctrl+k');
  });

  test('should preserve Alt', () => {
    expect(formatShortcut('Alt+Tab')).toBe('Alt+Tab');
  });

  test('should replace Option with ⌥', () => {
    expect(formatShortcut('Option+Tab')).toBe('⌥+Tab');
  });

  test('should replace Shift with ⇧', () => {
    expect(formatShortcut('Shift+Tab')).toBe('⇧+Tab');
  });

  test('should replace Enter with ↵', () => {
    expect(formatShortcut('Cmd+Enter')).toBe('⌘+↵');
  });

  test('should replace Escape with Esc', () => {
    expect(formatShortcut('Escape')).toBe('Esc');
  });

  test('should handle case insensitive replacements', () => {
    expect(formatShortcut('cmd+enter')).toBe('⌘+↵');
    expect(formatShortcut('CMD+ENTER')).toBe('⌘+↵');
  });

  test('should handle complex shortcuts', () => {
    expect(formatShortcut('Cmd+Shift+Option+Enter')).toBe('⌘+⇧+⌥+↵');
  });

  test('should preserve plus signs in output', () => {
    expect(formatShortcut('Cmd+A')).toBe('⌘+A');
  });

  test('should handle single keys', () => {
    expect(formatShortcut('Escape')).toBe('Esc');
    expect(formatShortcut('Enter')).toBe('↵');
  });
});

describe('updateShortcutsDisplay', () => {
  let headerShortcutsEl: HTMLElement;
  let historyShortcutsEl: HTMLElement;

  beforeEach(() => {
    // Set up DOM
    document.body.innerHTML = '';
    headerShortcutsEl = document.createElement('div');
    historyShortcutsEl = document.createElement('div');
    headerShortcutsEl.id = 'headerShortcuts';
    historyShortcutsEl.id = 'historyShortcuts';
    document.body.appendChild(headerShortcutsEl);
    document.body.appendChild(historyShortcutsEl);
  });

  test('should update header shortcuts display', () => {
    const shortcuts = {
      paste: 'Cmd+Enter',
      close: 'Escape'
    };

    updateShortcutsDisplay(headerShortcutsEl, historyShortcutsEl, shortcuts);

    expect(headerShortcutsEl.innerHTML).toBe(`
      <kbd>⌘</kbd>+<kbd>↵</kbd> Paste
      <kbd>Esc</kbd> Close
    `);
  });

  test('should update history shortcuts display', () => {
    const shortcuts = {
      paste: 'Cmd+Enter',
      close: 'Escape',
      historyNext: 'Ctrl+j',
      historyPrev: 'Ctrl+k'
    };

    updateShortcutsDisplay(headerShortcutsEl, historyShortcutsEl, shortcuts);

    expect(historyShortcutsEl.innerHTML).toBe('<kbd class="history-kbd">Ctrl</kbd>+<kbd class="history-kbd">j</kbd>/<kbd class="history-kbd">k</kbd>');
  });

  test('should use default history shortcuts when not provided', () => {
    const shortcuts = {
      paste: 'Cmd+Enter',
      close: 'Escape'
    };

    updateShortcutsDisplay(headerShortcutsEl, historyShortcutsEl, shortcuts);

    expect(historyShortcutsEl.innerHTML).toBe('<kbd class="history-kbd">Ctrl</kbd>+<kbd class="history-kbd">j</kbd>/<kbd class="history-kbd">k</kbd>');
  });

  test('should handle complex paste shortcuts', () => {
    const shortcuts = {
      paste: 'Cmd+Shift+Enter',
      close: 'Escape'
    };

    updateShortcutsDisplay(headerShortcutsEl, historyShortcutsEl, shortcuts);

    expect(headerShortcutsEl.innerHTML).toBe(`
      <kbd>⌘+⇧</kbd>+<kbd>↵</kbd> Paste
      <kbd>Esc</kbd> Close
    `);
  });

  test('should handle null elements gracefully', () => {
    const shortcuts = {
      paste: 'Cmd+Enter',
      close: 'Escape'
    };

    expect(() => {
      updateShortcutsDisplay(null, null, shortcuts);
    }).not.toThrow();
  });

  test('should handle only header element', () => {
    const shortcuts = {
      paste: 'Cmd+Enter',
      close: 'Escape'
    };

    updateShortcutsDisplay(headerShortcutsEl, null, shortcuts);

    expect(headerShortcutsEl.innerHTML).toBe(`
      <kbd>⌘</kbd>+<kbd>↵</kbd> Paste
      <kbd>Esc</kbd> Close
    `);
  });

  test('should handle only history element', () => {
    const shortcuts = {
      paste: 'Cmd+Enter',
      close: 'Escape',
      historyNext: 'Ctrl+Down',
      historyPrev: 'Ctrl+Up'
    };

    updateShortcutsDisplay(null, historyShortcutsEl, shortcuts);

    expect(historyShortcutsEl.innerHTML).toBe('<kbd class="history-kbd">Ctrl</kbd>+<kbd class="history-kbd">Down</kbd>/<kbd class="history-kbd">Up</kbd>');
  });

  test('should extract key from complex shortcuts', () => {
    const shortcuts = {
      paste: 'Cmd+Enter',
      close: 'Escape',
      historyNext: 'Cmd+Shift+j',
      historyPrev: 'Cmd+Shift+k'
    };

    updateShortcutsDisplay(headerShortcutsEl, historyShortcutsEl, shortcuts);

    expect(historyShortcutsEl.innerHTML).toBe('<kbd class="history-kbd">⌘+⇧</kbd>+<kbd class="history-kbd">j</kbd>/<kbd class="history-kbd">k</kbd>');
  });
});