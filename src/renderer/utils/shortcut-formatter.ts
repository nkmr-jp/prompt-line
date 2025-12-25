export function formatShortcut(shortcut: string): string {
  return shortcut
    .replace(/Cmd/gi, '⌘')
    .replace(/Command/gi, '⌘')
    .replace(/Ctrl/gi, 'Ctrl')
    .replace(/Control/gi, 'Ctrl')
    .replace(/Alt/gi, 'Alt')
    .replace(/Option/gi, '⌥')
    .replace(/Shift/gi, '⇧')
    .replace(/Enter/gi, '↵')
    .replace(/Escape/gi, 'Esc')
    .replace(/\+/g, '+');
}

/**
 * Splits shortcut into modifier and key parts
 */
function splitShortcut(formattedShortcut: string): { modifiers: string; key: string } {
  const parts = formattedShortcut.split('+');
  return {
    modifiers: parts.slice(0, -1).join('+'),
    key: parts[parts.length - 1] || ''
  };
}

/**
 * Updates header shortcuts display
 */
function updateHeaderShortcuts(
  headerShortcutsEl: HTMLElement,
  pasteShortcut: string,
  closeShortcut: string
): void {
  const pasteKey = formatShortcut(pasteShortcut);
  const closeKey = formatShortcut(closeShortcut);
  const { modifiers, key } = splitShortcut(pasteKey);

  headerShortcutsEl.innerHTML = `
    <kbd>${modifiers}</kbd>+<kbd>${key}</kbd> Paste
    <kbd>${closeKey}</kbd> Close
  `;
}

/**
 * Updates history navigation shortcuts display
 */
function updateHistoryShortcuts(
  historyShortcutsEl: HTMLElement,
  historyNext: string,
  historyPrev: string
): void {
  const formattedNext = formatShortcut(historyNext);
  const formattedPrev = formatShortcut(historyPrev);

  const { modifiers: nextModifier, key: nextKey } = splitShortcut(formattedNext);
  const { key: prevKey } = splitShortcut(formattedPrev);

  historyShortcutsEl.innerHTML = `<kbd class="history-kbd">${nextModifier}</kbd>+<kbd class="history-kbd">${nextKey}</kbd>/<kbd class="history-kbd">${prevKey}</kbd>`;
}

/**
 * Updates search button tooltip
 */
function updateSearchTooltip(searchShortcut: string): void {
  const searchButtonEl = document.getElementById('searchButton');
  if (searchButtonEl) {
    const searchKey = formatShortcut(searchShortcut);
    searchButtonEl.title = `Search history (${searchKey})`;
  }
}

export function updateShortcutsDisplay(
  headerShortcutsEl: HTMLElement | null,
  historyShortcutsEl: HTMLElement | null,
  shortcuts: {
    paste: string;
    close: string;
    historyNext?: string;
    historyPrev?: string;
    search?: string;
  }
): void {
  // Update header shortcuts
  if (headerShortcutsEl) {
    updateHeaderShortcuts(headerShortcutsEl, shortcuts.paste, shortcuts.close);
  }

  // Update history navigation shortcuts
  if (historyShortcutsEl) {
    const historyNext = shortcuts.historyNext || 'Ctrl+j';
    const historyPrev = shortcuts.historyPrev || 'Ctrl+k';
    updateHistoryShortcuts(historyShortcutsEl, historyNext, historyPrev);
  }

  // Update search button tooltip
  if (shortcuts.search) {
    updateSearchTooltip(shortcuts.search);
  }
}