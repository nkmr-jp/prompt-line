// Import types and dependencies
import type { 
  HistoryItem, 
  WindowData, 
  Config, 
  PasteResult, 
  ImageResult,
  UserSettings 
} from './types';
import { EventHandler } from './event-handler';
import { SearchManager } from './search-manager';
import { DomManager } from './dom-manager';
import { DraftManager } from './draft-manager';
import { HistoryUIManager } from './history-ui-manager';
import { LifecycleManager } from './lifecycle-manager';

// Secure electronAPI access via preload script
const electronAPI = (window as any).electronAPI;

if (!electronAPI) {
  throw new Error('Electron API not available. Preload script may not be loaded correctly.');
}

// Export the renderer class for testing
export class PromptLineRenderer {
  private historyData: HistoryItem[] = [];
  private filteredHistoryData: HistoryItem[] = [];
  private config: Config = {};
  private userSettings: UserSettings | null = null;
  private eventHandler: EventHandler | null = null;
  private searchManager: SearchManager | null = null;
  private domManager: DomManager;
  private draftManager: DraftManager;
  private historyUIManager: HistoryUIManager;
  private lifecycleManager: LifecycleManager;

  constructor() {
    this.domManager = new DomManager();
    this.draftManager = new DraftManager(electronAPI, () => this.domManager.getCurrentText());
    this.historyUIManager = new HistoryUIManager(
      () => this.domManager.historyList,
      (text: string) => this.domManager.setText(text),
      () => this.domManager.focusTextarea(),
      () => this.searchManager
    );
    this.lifecycleManager = new LifecycleManager(
      electronAPI,
      () => this.domManager.appNameEl,
      () => this.domManager.headerShortcutsEl,
      () => this.domManager.historyShortcutsEl,
      (name: string) => this.domManager.updateAppName(name),
      (text: string) => this.domManager.setText(text),
      () => this.domManager.focusTextarea(),
      (position: number) => this.domManager.setCursorPosition(position),
      () => this.domManager.selectAll()
    );
    this.init();
  }

  private async init(): Promise<void> {
    try {
      this.domManager.initializeElements();
      this.config = await electronAPI.config.get('') as Config;
      this.draftManager.setConfig(this.config);
      
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
    
    this.eventHandler.setTextarea(this.domManager.textarea);
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
    if (!this.domManager.textarea) return;

    this.domManager.textarea.addEventListener('input', () => {
      this.domManager.updateCharCount();
      this.draftManager.saveDraftDebounced();
      this.historyUIManager.clearHistorySelection();
    });

    this.domManager.textarea.addEventListener('keydown', (e) => {
      this.handleKeyDown(e);
    });

    document.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });

    this.domManager.textarea.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) {
        e.stopPropagation();
      }
    });

    // Add mouse event listeners to disable keyboard navigation mode on mouse interaction
    document.addEventListener('mousemove', () => {
      this.historyUIManager.clearHistorySelection();
    });

    document.addEventListener('mousedown', () => {
      this.historyUIManager.clearHistorySelection();
    });

    // Search navigation in search input (allow history navigation shortcuts even when search input is focused)
    if (this.domManager.searchInput) {
      this.domManager.searchInput.addEventListener('keydown', (e) => {
        // Use eventHandler's user settings if available
        if (this.eventHandler && this.userSettings?.shortcuts) {
          const handled = this.eventHandler.handleHistoryNavigationShortcuts(e, (direction) => {
            this.navigateHistory(e, direction);
          });
          // Prevent event propagation to avoid duplicate handling by document listener
          if (handled) {
            e.stopPropagation();
            e.stopImmediatePropagation();
          }
        }
      });
    }
  }

  private setupIPCListeners(): void {
    electronAPI.on('window-shown', (...args: unknown[]) => {
      const data = args[0] as WindowData;
      this.handleWindowShown(data);
    });
  }

  private async handleKeyDown(e: KeyboardEvent): Promise<void> {
    try {
      if (!this.domManager.textarea) return;

      if (e.key === 'v' && (e.metaKey || e.ctrlKey)) {
        // Store current text content before paste operation
        const textBeforePaste = this.domManager.getCurrentText();
        const cursorPosition = this.domManager.textarea.selectionStart;
        
        // Let default paste happen first, then check if we need to handle image
        setTimeout(async () => {
          try {
            const result = await electronAPI.invoke('paste-image') as ImageResult;
            if (result.success && result.path) {
              // Image paste successful - remove any text that was pasted and insert image path
              this.domManager.setText(textBeforePaste);
              this.domManager.setCursorPosition(cursorPosition);
              this.domManager.insertTextAtCursor(result.path);
              this.draftManager.saveDraftDebounced();
            }
            // If no image, the default text paste behavior is preserved
          } catch (error) {
            console.error('Error handling image paste:', error);
          }
        }, 0);
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
    const result = await electronAPI.pasteText(text) as PasteResult;
    if (!result.success) {
      console.error('Paste error:', result.error);
      this.domManager.showError('Paste failed: ' + result.error);
    } else if (result.warning) {
      console.warn('Paste warning:', result.warning);
    } else {
      await this.clearTextAndDraft();
      this.historyUIManager.clearHistorySelection();
    }
  }

  private async handleWindowHideCallback(): Promise<void> {
    try {
      await this.draftManager.saveDraftImmediate();
      await electronAPI.window.hide();
    } catch (error) {
      console.error('Error handling window hide:', error);
    }
  }

  private handleTabKeyCallback(e: KeyboardEvent): void {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    this.domManager.insertTextAtCursor('\t');
    this.draftManager.saveDraftDebounced();
  }


  private async clearTextAndDraft(): Promise<void> {
    this.domManager.clearText();
    await this.draftManager.clearDraft();
  }



  private handleWindowShown(data: WindowData): void {
    try {
      this.lifecycleManager.handleWindowShown(data);
      this.updateHistoryAndSettings(data);
      
      // Reset search mode and scroll position when window is shown
      this.searchManager?.exitSearchMode();
      this.resetHistoryScrollPosition();
    } catch (error) {
      console.error('Error handling window shown:', error);
    }
  }


  private updateHistoryAndSettings(data: WindowData): void {
    this.historyData = data.history || [];
    this.filteredHistoryData = [...this.historyData];
    this.searchManager?.updateHistoryData(this.historyData);
    
    // Update user settings if provided
    if (data.settings) {
      this.userSettings = data.settings;
      // Pass settings to event handler
      if (this.eventHandler) {
        this.eventHandler.setUserSettings(data.settings);
      }
    }
    
    this.renderHistory();
  }





  private renderHistory(): void {
    this.historyUIManager.renderHistory(this.filteredHistoryData);
  }




  private navigateHistory(e: KeyboardEvent, direction: 'next' | 'prev'): void {
    this.historyUIManager.navigateHistory(e, direction, this.filteredHistoryData);
  }





  // Public API methods
  public getCurrentText(): string {
    return this.domManager.getCurrentText();
  }

  public setText(text: string): void {
    this.domManager.setText(text);
  }

  public clearText(): void {
    this.domManager.clearText();
  }

  public focus(): void {
    this.domManager.focusTextarea();
  }

  // Search functionality callbacks
  private handleSearchToggle(): void {
    this.searchManager?.toggleSearchMode();
  }

  private handleSearchStateChange(isSearchMode: boolean, filteredData: HistoryItem[]): void {
    // Only clear history selection when entering search mode or when filter actually changes data length
    const shouldClearSelection = !isSearchMode || filteredData.length !== this.filteredHistoryData.length;
    
    this.filteredHistoryData = filteredData;
    this.renderHistory();

    if (shouldClearSelection) {
      this.historyUIManager.clearHistorySelection();
    }

    if (!isSearchMode) {
      // Return focus to main textarea when exiting search
      this.searchManager?.focusMainTextarea();
    }
  }

  private resetHistoryScrollPosition(): void {
    if (this.domManager.historyList) {
      this.domManager.historyList.scrollTop = 0;
    }
  }

  // Cleanup method
  public cleanup(): void {
    this.draftManager.cleanup();
    this.historyUIManager.cleanup();
  }
}

document.addEventListener('DOMContentLoaded', () => {
   
  (window as any).promptLineRenderer = new PromptLineRenderer();
});