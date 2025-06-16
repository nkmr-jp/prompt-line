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
    
    // Extract key parts (e.g., "Ctrl+j" -> "j", "Ctrl+k" -> "k")
    const nextKey = historyNext.split('+').pop() || 'j';
    const prevKey = historyPrev.split('+').pop() || 'k';
    
    historyShortcutsEl.innerHTML = `<kbd style="font-size: 9px; padding: 1px 4px;">Ctrl</kbd>+<kbd style="font-size: 9px; padding: 1px 4px;">${nextKey}</kbd>/<kbd style="font-size: 9px; padding: 1px 4px;">${prevKey}</kbd>`;
  }

  // Update search button tooltip
  const searchButtonEl = document.getElementById('searchButton');
  if (searchButtonEl && shortcuts.search) {
    const searchKey = formatShortcut(shortcuts.search);
    searchButtonEl.title = `Search history (${searchKey})`;
  }
}