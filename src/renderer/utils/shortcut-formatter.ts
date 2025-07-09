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
    const pasteKey = formatShortcut(shortcuts.paste);
    const closeKey = formatShortcut(shortcuts.close);
    
    const parts = pasteKey.split('+');
    const modifiers = parts.slice(0, -1).join('+');
    const key = parts[parts.length - 1];
    
    headerShortcutsEl.innerHTML = `
      <kbd>${modifiers}</kbd>+<kbd>${key}</kbd> Paste
      <kbd>${closeKey}</kbd> Close
    `;
  }

  // Update history navigation shortcuts
  if (historyShortcutsEl) {
    const historyNext = shortcuts.historyNext || 'Ctrl+j';
    const historyPrev = shortcuts.historyPrev || 'Ctrl+k';
    
    // Format the shortcuts properly
    const formattedNext = formatShortcut(historyNext);
    const formattedPrev = formatShortcut(historyPrev);
    
    // Extract modifier and key parts for both shortcuts
    const nextParts = formattedNext.split('+');
    const prevParts = formattedPrev.split('+');
    
    const nextModifier = nextParts.slice(0, -1).join('+');
    const nextKey = nextParts[nextParts.length - 1];
    const prevKey = prevParts[prevParts.length - 1];
    
    historyShortcutsEl.innerHTML = `<kbd class="history-kbd">${nextModifier}</kbd>+<kbd class="history-kbd">${nextKey}</kbd>/<kbd class="history-kbd">${prevKey}</kbd>`;
  }

  // Update search button tooltip
  const searchButtonEl = document.getElementById('searchButton');
  if (searchButtonEl && shortcuts.search) {
    const searchKey = formatShortcut(shortcuts.search);
    searchButtonEl.title = `Search history (${searchKey})`;
  }
}