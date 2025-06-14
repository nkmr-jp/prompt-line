// Browser environment - use global require with typed interface
interface IpcRenderer {
  invoke(channel: string, ...args: unknown[]): Promise<unknown>;
  send(channel: string, ...args: unknown[]): void;
  on(channel: string, listener: (event: unknown, ...args: unknown[]) => void): void;
}

interface ElectronWindow extends Window {
  require: (module: string) => { ipcRenderer: IpcRenderer };
}

const { ipcRenderer } = (window as ElectronWindow).require('electron');

// Import constants
import { TIMEOUTS, DELAYS, LIMITS, TIME_CALCULATIONS } from '../constants';
import { EventHandler } from './event-handler';
import { SearchManager } from './search-manager';

interface HistoryItem {
  text: string;
  timestamp: number;
  id: string;
}

interface AppInfo {
  name: string;
  bundleId?: string | null;
}

interface UserSettings {
  shortcuts: {
    main: string;
    paste: string;
    close: string;
    historyNext: string;
    historyPrev: string;
  };
  window: {
    position: string;
    width: number;
    height: number;
  };
}

interface WindowData {
  sourceApp?: AppInfo | string | null;
  history?: HistoryItem[];
  draft?: string | { text: string } | null;
  settings?: UserSettings;
}

interface Config {
  draft?: {
    saveDelay?: number;
  };
}

interface PasteResult {
  success: boolean;
  error?: string;
  warning?: string;
}

interface ImageResult {
  success: boolean;
  path?: string;
  error?: string;
}

declare global {
  interface Window {
    promptLineRenderer: PromptLineRenderer;
  }
}

// Export the renderer class for testing
export class PromptLineRenderer {
  private textarea: HTMLTextAreaElement | null = null;
  private appNameEl: HTMLElement | null = null;
  private charCountEl: HTMLElement | null = null;
  private historyList: HTMLElement | null = null;
  private headerShortcutsEl: HTMLElement | null = null;
  private historyShortcutsEl: HTMLElement | null = null;
  private searchInput: HTMLInputElement | null = null;
  private historyData: HistoryItem[] = [];
  private filteredHistoryData: HistoryItem[] = [];
  private draftSaveTimeout: NodeJS.Timeout | null = null;
  private config: Config = {};
  private userSettings: UserSettings | null = null;
  private historyIndex: number = -1;
  private keyboardNavigationTimeout: NodeJS.Timeout | null = null;
  private eventHandler: EventHandler | null = null;
  private searchManager: SearchManager | null = null;

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    try {
      this.textarea = document.getElementById('textInput') as HTMLTextAreaElement;
      this.appNameEl = document.getElementById('appName');
      this.charCountEl = document.getElementById('charCount');
      this.historyList = document.getElementById('historyList');
      this.headerShortcutsEl = document.getElementById('headerShortcuts');
      this.historyShortcutsEl = document.getElementById('historyShortcuts');
      this.searchInput = document.getElementById('searchInput') as HTMLInputElement;



      if (!this.textarea || !this.appNameEl || !this.charCountEl || !this.historyList) {
        throw new Error('Required DOM elements not found');
      }

      this.config = await ipcRenderer.invoke('get-config') as Config;
      this.setupEventHandler();
      this.setupSearchManager();
      this.setupEventListeners();
      this.setupIPCListeners();

      console.log('Prompt Line renderer initialized');
    } catch (error) {
      console.error('Failed to initialize renderer:', error);
    }
  }

  private setupEventHandler(): void {
    this.eventHandler = new EventHandler({
      onTextPaste: this.handleTextPasteCallback.bind(this),
      onWindowHide: this.handleWindowHideCallback.bind(this),
      onTabKeyInsert: this.handleTabKeyCallback.bind(this),
      onHistoryNavigation: this.navigateHistory.bind(this),
      onSearchToggle: this.handleSearchToggle.bind(this)
    });
    
    this.eventHandler.setTextarea(this.textarea);
    this.eventHandler.setupEventListeners();
  }

  private setupSearchManager(): void {
    this.searchManager = new SearchManager({
      onSearchStateChange: this.handleSearchStateChange.bind(this)
    });
    
    this.searchManager.initializeElements();
    this.searchManager.setupEventListeners();
    
    // Set SearchManager reference in EventHandler
    if (this.eventHandler) {
      this.eventHandler.setSearchManager(this.searchManager);
    }
  }

  private setupEventListeners(): void {
    if (!this.textarea) return;

    this.textarea.addEventListener('input', () => {
      this.updateCharCount();
      this.saveDraftDebounced();
      this.clearHistorySelection();
    });

    this.textarea.addEventListener('keydown', (e) => {
      this.handleKeyDown(e);
    });

    document.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });

    this.textarea.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) {
        e.stopPropagation();
      }
    });

    // Add mouse event listeners to disable keyboard navigation mode on mouse interaction
    document.addEventListener('mousemove', () => {
      this.disableKeyboardNavigation();
    });

    document.addEventListener('mousedown', () => {
      this.disableKeyboardNavigation();
    });

    // Search navigation in search input (allow Ctrl+j/k even when search input is focused)
    if (this.searchInput) {
      this.searchInput.addEventListener('keydown', (e) => {
        if ((e.key === 'ArrowDown' || e.key === 'j') && e.ctrlKey) {
          e.preventDefault();
          this.navigateHistory(e, 'next');
          return;
        }
        
        if ((e.key === 'ArrowUp' || e.key === 'k') && e.ctrlKey) {
          e.preventDefault();
          this.navigateHistory(e, 'prev');
          return;
        }
      });
    }
  }

  private setupIPCListeners(): void {
    ipcRenderer.on('window-shown', (_event: unknown, ...args: unknown[]) => {
      const data = args[0] as WindowData;
      this.handleWindowShown(data);
    });
  }

  private async handleKeyDown(e: KeyboardEvent): Promise<void> {
    try {
      if (!this.textarea) return;

      if (e.key === 'v' && (e.metaKey || e.ctrlKey)) {
        // Check if there's an image in clipboard first
        const result = await ipcRenderer.invoke('paste-image') as ImageResult;
        if (result.success && result.path) {
          e.preventDefault();
          this.insertTextAtCursor(result.path);
        }
        // If no image, let the default paste behavior handle text
        return;
      }

      // Skip shortcuts if IME is active to avoid conflicts with Japanese input
      const isComposing = this.eventHandler?.getIsComposing() || e.isComposing;
      if (isComposing) {
        return;
      }
    } catch (error) {
      console.error('Error handling keydown:', error);
    }
  }


  private async handleTextPasteCallback(text: string): Promise<void> {
    const result = await ipcRenderer.invoke('paste-text', text) as PasteResult;
    if (!result.success) {
      console.error('Paste error:', result.error);
      this.showError('Paste failed: ' + result.error);
    } else if (result.warning) {
      console.warn('Paste warning:', result.warning);
    } else {
      this.clearTextAndDraft();
      this.clearHistorySelection();
    }
  }

  private async handleWindowHideCallback(): Promise<void> {
    try {
      if (this.textarea?.value.trim()) {
        await ipcRenderer.invoke('save-draft', this.textarea.value, true);
      }
      await ipcRenderer.invoke('hide-window', true);
    } catch (error) {
      console.error('Error handling window hide:', error);
    }
  }

  private handleTabKeyCallback(e: KeyboardEvent): void {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    this.insertTextAtCursor('\t');
  }

  private insertTextAtCursor(text: string): void {
    if (!this.textarea) return;

    const start = this.textarea.selectionStart;
    const end = this.textarea.selectionEnd;
    const value = this.textarea.value;

    this.textarea.value = value.substring(0, start) + text + value.substring(end);
    this.textarea.selectionStart = this.textarea.selectionEnd = start + text.length;
    this.updateCharCount();
    this.saveDraftDebounced();
  }

  private async clearTextAndDraft(): Promise<void> {
    if (this.textarea) {
      this.textarea.value = '';
      this.updateCharCount();
      await ipcRenderer.invoke('clear-draft');
    }
  }



  private handleWindowShown(data: WindowData): void {
    try {
      if (!this.textarea) return;

      const draftValue = this.extractDraftValue(data.draft);
      this.initializeTextArea(draftValue, !!data.draft);
      this.updateHistoryAndSettings(data);
      
      const appName = this.getAppDisplayName(data.sourceApp);
      this.updateAppName(appName);
      
      if (draftValue && draftValue.trim()) {
        this.showDraftRestoredNotification(appName);
      }
    } catch (error) {
      console.error('Error handling window shown:', error);
    }
  }

  private extractDraftValue(draft: string | { text: string } | null | undefined): string {
    return typeof draft === 'string' ? draft : (draft?.text || '');
  }

  private initializeTextArea(draftValue: string, hasDraft: boolean): void {
    if (!this.textarea) return;

    this.textarea.value = draftValue;
    this.updateCharCount();

    setTimeout(() => {
      if (!this.textarea) return;
      
      this.textarea.focus();
      if (!hasDraft) {
        this.textarea.select();
      } else {
        this.textarea.setSelectionRange(this.textarea.value.length, this.textarea.value.length);
      }
    }, TIMEOUTS.TEXTAREA_FOCUS_DELAY);
  }

  private updateHistoryAndSettings(data: WindowData): void {
    this.historyData = data.history || [];
    this.filteredHistoryData = [...this.historyData];
    this.userSettings = data.settings || null;
    this.searchManager?.updateHistoryData(this.historyData);
    this.renderHistory();
    this.historyIndex = -1;
    this.updateShortcutsDisplay();
  }

  private getAppDisplayName(sourceApp: AppInfo | string | null | undefined): string {
    if (sourceApp && typeof sourceApp === 'object' && (sourceApp as AppInfo).name) {
      const appName = (sourceApp as AppInfo).name;
      return `Paste to: ${appName}`;
    }
    
    if (sourceApp && sourceApp !== 'Electron') {
      const appName = typeof sourceApp === 'object' 
        ? (sourceApp as AppInfo).name 
        : sourceApp as string;
      return `Paste to: ${appName}`;
    }
    
    return 'Prompt Line';
  }

  private showDraftRestoredNotification(originalAppName: string): void {
    this.updateAppName(this.appNameEl?.textContent + ' (draft restored)');
    setTimeout(() => {
      this.updateAppName(originalAppName);
    }, 2000);
  }

  private updateCharCount(): void {
    if (!this.textarea || !this.charCountEl) return;
    
    const count = this.textarea.value.length;
    this.charCountEl.textContent = `${count} char${count !== 1 ? 's' : ''}`;
  }

  private saveDraftDebounced(): void {
    if (this.draftSaveTimeout) {
      clearTimeout(this.draftSaveTimeout);
    }
    this.draftSaveTimeout = setTimeout(() => {
      if (this.textarea) {
        ipcRenderer.invoke('save-draft', this.textarea.value);
      }
    }, this.config.draft?.saveDelay || DELAYS.DEFAULT_DRAFT_SAVE);
  }

  private formatTime(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / TIME_CALCULATIONS.MILLISECONDS_PER_MINUTE);
    const hours = Math.floor(diff / TIME_CALCULATIONS.MILLISECONDS_PER_HOUR);
    const days = Math.floor(diff / TIME_CALCULATIONS.MILLISECONDS_PER_DAY);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  }

  private renderHistory(): void {
    try {
      if (!this.historyList) return;

      const dataToRender = this.filteredHistoryData;
      const isSearchMode = this.searchManager?.isInSearchMode() || false;

      if (!dataToRender || dataToRender.length === 0) {
        const emptyMessage = isSearchMode ? 'No matching items found' : 'No history items';
        this.historyList.innerHTML = `<div class="history-empty">${emptyMessage}</div>`;
        return;
      }
      // 0 means unlimited, so show all items
      const visibleItems = dataToRender.slice(0, LIMITS.MAX_VISIBLE_ITEMS);
      const fragment = document.createDocumentFragment();

      visibleItems.forEach((item) => {
        const historyItem = this.createHistoryElement(item);
        fragment.appendChild(historyItem);
      });

      this.historyList.innerHTML = '';
      this.historyList.appendChild(fragment);

      if (dataToRender.length > LIMITS.MAX_VISIBLE_ITEMS) {
        const moreIndicator = document.createElement('div');
        moreIndicator.className = 'history-more';
        moreIndicator.textContent = `+${dataToRender.length - LIMITS.MAX_VISIBLE_ITEMS} more items`;
        moreIndicator.style.cssText = `
          padding: 8px 16px;
          text-align: center;
          color: rgba(255, 255, 255, 0.4);
          font-size: 11px;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
        `;
        this.historyList.appendChild(moreIndicator);
      }

    } catch (error) {
      console.error('Error rendering history:', error);
      if (this.historyList) {
        this.historyList.innerHTML = '<div class="history-empty">Error loading history</div>';
      }
    }
  }

  private createHistoryElement(item: HistoryItem): HTMLElement {
    const historyItem = document.createElement('div');
    historyItem.className = 'history-item';
    historyItem.dataset.text = item.text;
    historyItem.dataset.id = item.id;

    const textDiv = document.createElement('div');
    textDiv.className = 'history-text';
    
    // Apply search highlighting if in search mode
    const displayText = item.text.replace(/\n/g, ' ');
    const isSearchMode = this.searchManager?.isInSearchMode() || false;
    const searchTerm = this.searchManager?.getSearchTerm() || '';
    
    if (isSearchMode && searchTerm) {
      textDiv.innerHTML = this.searchManager?.highlightSearchTerms(displayText, searchTerm) || displayText;
    } else {
      textDiv.textContent = displayText;
    }

    const timeDiv = document.createElement('div');
    timeDiv.className = 'history-time';
    timeDiv.textContent = this.formatTime(item.timestamp);

    historyItem.appendChild(textDiv);
    historyItem.appendChild(timeDiv);

    historyItem.addEventListener('click', () => {
      this.selectHistoryItemFromClick(item.text);
    });

    return historyItem;
  }


  private selectHistoryItem(text: string): void {
    if (!this.textarea) return;
    
    this.textarea.value = text;
    this.updateCharCount();
    this.textarea.focus();
    this.textarea.setSelectionRange(text.length, text.length);
  }

  private selectHistoryItemFromClick(text: string): void {
    this.selectHistoryItem(text);
    this.clearHistorySelection();
  }

  private navigateHistory(e: KeyboardEvent, direction: 'next' | 'prev'): void {
    e.preventDefault();
    
    const dataToNavigate = this.filteredHistoryData;
    
    if (!dataToNavigate || dataToNavigate.length === 0) return;

    // Enable keyboard navigation mode and disable hover effects
    this.enableKeyboardNavigation();
    const visibleItemsCount = Math.min(dataToNavigate.length, LIMITS.MAX_VISIBLE_ITEMS);

    if (direction === 'next') {
      if (this.historyIndex === -1) {
        // From initial state, go to first item
        this.historyIndex = 0;
      } else if (this.historyIndex < visibleItemsCount - 1) {
        this.historyIndex = this.historyIndex + 1;
      }
    } else {
      if (this.historyIndex === -1) {
        // From initial state, go to last item
        this.historyIndex = visibleItemsCount - 1;
      } else if (this.historyIndex > 0) {
        this.historyIndex = this.historyIndex - 1;
      }
    }

    const selectedItem = dataToNavigate[this.historyIndex];
    if (selectedItem) {
      this.selectHistoryItem(selectedItem.text);
      this.flashHistoryItem();
      this.scrollToSelectedItem();
    }
  }

  private flashHistoryItem(): void {
    if (!this.historyList || this.historyIndex < 0) return;

    const historyItems = this.historyList.querySelectorAll('.history-item');
    
    // Clear all existing flash effects
    historyItems.forEach(item => {
      item.classList.remove('flash');
    });

    const selectedItem = historyItems[this.historyIndex] as HTMLElement;
    
    if (selectedItem) {
      // Force reflow to ensure the removal takes effect before adding
      void selectedItem.offsetHeight;
      
      // Use requestAnimationFrame to ensure proper timing
      requestAnimationFrame(() => {
        selectedItem.classList.add('flash');
        
        // Remove flash class after animation
        setTimeout(() => {
          selectedItem.classList.remove('flash');
        }, TIMEOUTS.FLASH_ANIMATION_DURATION);
      });
    }
  }

  private clearHistorySelection(): void {
    this.historyIndex = -1;
    
    // Clear all flash effects
    if (this.historyList) {
      const historyItems = this.historyList.querySelectorAll('.history-item');
      historyItems.forEach(item => {
        item.classList.remove('flash');
      });
    }

    // Disable keyboard navigation mode when clearing selection
    this.disableKeyboardNavigation();
  }

  private enableKeyboardNavigation(): void {
    if (this.historyList) {
      this.historyList.classList.add('keyboard-navigation');
    }

    // Clear any existing timeout
    if (this.keyboardNavigationTimeout) {
      clearTimeout(this.keyboardNavigationTimeout);
    }

    // Auto-disable keyboard navigation after a period of inactivity
    this.keyboardNavigationTimeout = setTimeout(() => {
      this.disableKeyboardNavigation();
    }, TIMEOUTS.KEYBOARD_NAVIGATION_TIMEOUT);
  }

  private disableKeyboardNavigation(): void {
    if (this.historyList) {
      this.historyList.classList.remove('keyboard-navigation');
    }

    // Clear the timeout
    if (this.keyboardNavigationTimeout) {
      clearTimeout(this.keyboardNavigationTimeout);
      this.keyboardNavigationTimeout = null;
    }
  }

  private scrollToSelectedItem(): void {
    if (!this.historyList || this.historyIndex < 0) return;

    const historyItems = this.historyList.querySelectorAll('.history-item');
    const selectedItem = historyItems[this.historyIndex] as HTMLElement;
    
    if (selectedItem) {
      selectedItem.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'nearest' 
      });
    }
  }


  private showError(message: string): void {
    if (!this.appNameEl) return;
    
    const originalText = this.appNameEl.textContent;
    this.appNameEl.textContent = `Error: ${message}`;
    this.appNameEl.style.color = '#ff6b6b';

    setTimeout(() => {
      if (this.appNameEl) {
        this.appNameEl.textContent = originalText;
        this.appNameEl.style.color = '';
      }
    }, TIMEOUTS.ERROR_MESSAGE_DURATION);
  }

  private updateAppName(name: string): void {
    if (this.appNameEl) {
      this.appNameEl.textContent = name;
    }
  }

  private formatShortcut(shortcut: string): string {
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

  private updateShortcutsDisplay(): void {
    if (!this.userSettings) return;

    // Update header shortcuts
    if (this.headerShortcutsEl) {
      const pasteKey = this.formatShortcut(this.userSettings.shortcuts.paste);
      const closeKey = this.formatShortcut(this.userSettings.shortcuts.close);
      
      const parts = pasteKey.split('+');
      const modifiers = parts.slice(0, -1).join('+');
      const key = parts[parts.length - 1];
      
      this.headerShortcutsEl.innerHTML = `
        <kbd>${modifiers}</kbd>+<kbd>${key}</kbd> Paste
        <kbd>${closeKey}</kbd> Close
      `;
    }

    // Update history navigation shortcuts
    if (this.historyShortcutsEl) {
      const historyNext = this.userSettings.shortcuts.historyNext || 'Ctrl+j';
      const historyPrev = this.userSettings.shortcuts.historyPrev || 'Ctrl+k';
      
      // Extract key parts (e.g., "Ctrl+j" -> "j", "Ctrl+k" -> "k")
      const nextKey = historyNext.split('+').pop() || 'j';
      const prevKey = historyPrev.split('+').pop() || 'k';
      
      this.historyShortcutsEl.innerHTML = `<kbd style="font-size: 9px; padding: 1px 4px;">Ctrl</kbd>+<kbd style="font-size: 9px; padding: 1px 4px;">${nextKey}${prevKey}</kbd>`;
    }
  }

  // Public API methods
  public getCurrentText(): string {
    return this.textarea?.value || '';
  }

  public setText(text: string): void {
    if (this.textarea) {
      this.textarea.value = text;
      this.updateCharCount();
    }
  }

  public clearText(): void {
    if (this.textarea) {
      this.textarea.value = '';
      this.updateCharCount();
    }
  }

  public focus(): void {
    this.textarea?.focus();
  }

  // Search functionality callbacks
  private handleSearchToggle(): void {
    this.searchManager?.toggleSearchMode();
  }

  private handleSearchStateChange(isSearchMode: boolean, filteredData: HistoryItem[]): void {
    this.filteredHistoryData = filteredData;
    this.renderHistory();
    
    if (!isSearchMode) {
      // Return focus to main textarea when exiting search
      this.searchManager?.focusMainTextarea();
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  (window as ElectronWindow & { promptLineRenderer: PromptLineRenderer }).promptLineRenderer = new PromptLineRenderer();
});