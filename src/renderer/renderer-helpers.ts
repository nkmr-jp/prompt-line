/**
 * Helper utilities for PromptLineRenderer
 * Extracted from renderer.ts to improve code organization and reduce file size
 */

import type { HistoryItem } from './types';

// Secure electronAPI access via preload script
const electronAPI = (window as any).electronAPI;

if (!electronAPI) {
  throw new Error('Electron API not available. Preload script may not be loaded correctly.');
}

// Default display limit for history items
export const DEFAULT_DISPLAY_LIMIT = 50;

/**
 * Handle image paste operation
 * Returns true if image was pasted, false otherwise
 */
export async function handleImagePaste(
  textBeforePaste: string,
  cursorPosition: number,
  setText: (text: string) => void,
  setCursorPosition: (position: number) => void,
  insertTextAtCursor: (text: string) => void,
  saveDraftDebounced: () => void
): Promise<void> {
  try {
    const result = await electronAPI.invoke('paste-image') as any;
    if (result.success && result.path) {
      // Image paste successful - remove any text that was pasted and insert image path
      setText(textBeforePaste);
      setCursorPosition(cursorPosition);
      insertTextAtCursor(result.path);
      saveDraftDebounced();
    }
    // If no image, the default text paste behavior is preserved
  } catch (error) {
    console.error('Error handling image paste:', error);
  }
}

/**
 * Setup event listeners for textarea input
 */
export function setupTextareaInputListener(
  textarea: HTMLTextAreaElement,
  updateCharCount: () => void,
  saveDraftDebounced: () => void,
  clearHistorySelection: () => void,
  snapshotManager: { hasSnapshot: () => boolean; clearSnapshot: () => void }
): void {
  textarea.addEventListener('input', () => {
    updateCharCount();
    saveDraftDebounced();
    clearHistorySelection();

    // 編集開始時にスナップショットをクリア
    if (snapshotManager.hasSnapshot()) {
      snapshotManager.clearSnapshot();
      console.debug('Snapshot cleared on text edit');
    }
  });
}

/**
 * Setup context menu prevention
 */
export function setupContextMenuPrevention(): void {
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });
}

/**
 * Setup keypress listener for Enter key handling
 */
export function setupKeypressListener(textarea: HTMLTextAreaElement): void {
  textarea.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) {
      e.stopPropagation();
    }
  });
}

/**
 * Setup mouse event listeners to disable keyboard navigation
 */
export function setupMouseListeners(clearHistorySelection: () => void): void {
  document.addEventListener('mousemove', () => {
    clearHistorySelection();
  });

  document.addEventListener('mousedown', () => {
    clearHistorySelection();
  });
}

/**
 * Calculate filtered history data based on search state
 */
export function calculateFilteredHistory(
  isSearchMode: boolean,
  searchFilteredData: HistoryItem[],
  historyData: HistoryItem[],
  displayLimit: number
): { filtered: HistoryItem[]; total: number | undefined } {
  if (isSearchMode) {
    return {
      filtered: searchFilteredData,
      total: undefined
    };
  } else {
    return {
      filtered: historyData.slice(0, displayLimit),
      total: historyData.length
    };
  }
}

/**
 * Determine if history selection should be cleared
 */
export function shouldClearHistorySelection(
  isSearchMode: boolean,
  filteredData: HistoryItem[],
  currentFilteredData: HistoryItem[]
): boolean {
  const isLoadingMore = filteredData.length > currentFilteredData.length;
  return !isSearchMode || (filteredData.length !== currentFilteredData.length && !isLoadingMore);
}

/**
 * Handle load more functionality for non-search mode
 */
export function handleNonSearchLoadMore(
  currentDisplayLimit: number,
  historyData: HistoryItem[],
  currentFilteredData: HistoryItem[]
): { newLimit: number; newFiltered: HistoryItem[] } | null {
  if (currentFilteredData.length >= historyData.length) {
    // Already showing all items
    return null;
  }
  const newLimit = currentDisplayLimit + DEFAULT_DISPLAY_LIMIT;
  return {
    newLimit,
    newFiltered: historyData.slice(0, newLimit)
  };
}

/**
 * Get electron API instance
 */
export function getElectronAPI(): any {
  return electronAPI;
}

/**
 * Handle undo operation with snapshot manager
 */
export function handleUndoWithSnapshot(
  snapshotManager: { hasSnapshot: () => boolean; restore: () => any },
  setText: (text: string) => void,
  setCursorPosition: (position: number) => void,
  focusTextarea: () => void
): boolean {
  if (snapshotManager.hasSnapshot()) {
    const snapshot = snapshotManager.restore();
    if (snapshot) {
      setText(snapshot.text);
      setCursorPosition(snapshot.cursorPosition);
      focusTextarea();
      console.debug('Snapshot restored successfully');
      return true;
    }
  }
  console.debug('No snapshot, using browser default undo');
  return false;
}

/**
 * Handle window hide callback
 */
export async function handleWindowHide(
  saveDraftImmediate: () => Promise<void>
): Promise<void> {
  try {
    await saveDraftImmediate();
    await electronAPI.window.hide();
  } catch (error) {
    console.error('Error handling window hide:', error);
  }
}

/**
 * Handle Tab key press with event handling
 */
export function handleTabKey(
  e: KeyboardEvent,
  insertTextAtCursor: (text: string) => void,
  saveDraftDebounced: () => void
): void {
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();

  insertTextAtCursor('\t');
  saveDraftDebounced();
}

/**
 * Handle Shift+Tab key press with event handling
 */
export function handleShiftTabKey(
  e: KeyboardEvent,
  outdentAtCursor: () => void,
  saveDraftDebounced: () => void
): void {
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();

  outdentAtCursor();
  saveDraftDebounced();
}

/**
 * Clear text and draft together
 */
export async function clearTextAndDraft(
  clearText: () => void,
  clearDraft: () => Promise<void>,
  fileSearchManager: { clearAtPaths: () => void } | null
): Promise<void> {
  clearText();
  await clearDraft();
  fileSearchManager?.clearAtPaths();
}

/**
 * Update history and settings data
 */
export function updateHistoryAndSettingsData(
  data: any,
  searchManager: { updateHistoryData: (data: any[]) => void } | null,
  eventHandler: { setUserSettings: (settings: any) => void } | null
): {
  historyData: any[];
  filteredHistoryData: any[];
  totalMatchCount: number;
  userSettings: any | null;
} {
  const historyData = data.history || [];
  const filteredHistoryData = historyData.slice(0, DEFAULT_DISPLAY_LIMIT);
  const totalMatchCount = historyData.length;

  searchManager?.updateHistoryData(historyData);

  let userSettings = null;
  if (data.settings) {
    userSettings = data.settings;
    eventHandler?.setUserSettings(data.settings);
  }

  return {
    historyData,
    filteredHistoryData,
    totalMatchCount,
    userSettings
  };
}

/**
 * Create event handler configuration object
 */
export function createEventHandlerConfig(callbacks: {
  onTextPaste: (text: string) => Promise<void>;
  onWindowHide: () => Promise<void>;
  onTabKeyInsert: (e: KeyboardEvent) => void;
  onShiftTabKeyPress: (e: KeyboardEvent) => void;
  onHistoryNavigation: (e: KeyboardEvent, direction: 'next' | 'prev') => void;
  onSearchToggle: () => void;
  onUndo: () => boolean;
}): any {
  return {
    onTextPaste: callbacks.onTextPaste,
    onWindowHide: callbacks.onWindowHide,
    onTabKeyInsert: callbacks.onTabKeyInsert,
    onShiftTabKeyPress: callbacks.onShiftTabKeyPress,
    onHistoryNavigation: callbacks.onHistoryNavigation,
    onSearchToggle: callbacks.onSearchToggle,
    onUndo: callbacks.onUndo
  };
}

/**
 * Create search manager configuration
 */
export function createSearchManagerConfig(onSearchStateChange: (isSearchMode: boolean, filteredData: any[], totalMatches?: number) => void): any {
  return { onSearchStateChange };
}

/**
 * Create slash command manager configuration
 */
export function createSlashCommandConfig(callbacks: {
  onCommandSelect: (command: string) => Promise<void>;
  onCommandInsert: (command: string) => void;
  onBeforeOpenFile: () => void;
  setDraggable: (enabled: boolean) => void;
}): any {
  return {
    onCommandSelect: async (command: string) => {
      console.debug('Slash command selected (Enter):', command);
      if (command) {
        await callbacks.onCommandSelect(command);
      }
    },
    onCommandInsert: (command: string) => {
      console.debug('Slash command inserted (Tab):', command);
      callbacks.onCommandInsert(command);
    },
    onBeforeOpenFile: callbacks.onBeforeOpenFile,
    setDraggable: callbacks.setDraggable
  };
}

/**
 * Create file search manager configuration
 */
export function createFileSearchConfig(callbacks: {
  onFileSelected: (filePath: string) => void;
  getTextContent: () => string;
  setTextContent: (text: string) => void;
  getCursorPosition: () => number;
  setCursorPosition: (position: number) => void;
  onBeforeOpenFile: () => void;
  updateHintText: (text: string) => void;
  getDefaultHintText: () => string;
  setDraggable: (enabled: boolean) => void;
  replaceRangeWithUndo: (start: number, end: number, newText: string) => void;
  getIsComposing: () => boolean;
}): any {
  return {
    onFileSelected: (filePath: string) => {
      console.debug('[FileSearchManager] File selected:', filePath);
      callbacks.onFileSelected(filePath);
    },
    getTextContent: callbacks.getTextContent,
    setTextContent: callbacks.setTextContent,
    getCursorPosition: callbacks.getCursorPosition,
    setCursorPosition: callbacks.setCursorPosition,
    onBeforeOpenFile: callbacks.onBeforeOpenFile,
    updateHintText: callbacks.updateHintText,
    getDefaultHintText: callbacks.getDefaultHintText,
    setDraggable: callbacks.setDraggable,
    replaceRangeWithUndo: callbacks.replaceRangeWithUndo,
    getIsComposing: callbacks.getIsComposing
  };
}
