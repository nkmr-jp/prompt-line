/**
 * Event Handler for renderer process
 * Manages all DOM events and keyboard shortcuts
 */

import { ShortcutHandler } from './shortcut-handler';
import { WindowBlurHandler } from './window-blur-handler';
import type { UserSettings } from './types';
import type { IInitializable } from './interfaces/initializable';

export interface PasteResult {
  success: boolean;
  error?: string;
  warning?: string;
}

export interface ImageResult {
  success: boolean;
  path?: string;
  error?: string;
}

export class EventHandler implements IInitializable {
  private textarea: HTMLTextAreaElement | null = null;
  private isComposing = false;
  private slashCommandManager: { isActiveMode(): boolean } | null = null;
  private fileSearchManager: { isActive(): boolean } | null = null;
  private onTabKeyInsert: (e: KeyboardEvent) => void;
  private onShiftTabKeyPress: (e: KeyboardEvent) => void;
  private shortcutHandler: ShortcutHandler;
  private windowBlurHandler: WindowBlurHandler;

  constructor(callbacks: {
    onTextPaste: (text: string) => Promise<void>;
    onWindowHide: () => Promise<void>;
    onTabKeyInsert: (e: KeyboardEvent) => void;
    onShiftTabKeyPress: (e: KeyboardEvent) => void;
    onHistoryNavigation: (e: KeyboardEvent, direction: 'next' | 'prev') => void;
    onSearchToggle: () => void;
    onUndo: () => boolean;
    onSaveDraftToHistory: () => Promise<void>;
  }) {
    this.onTabKeyInsert = callbacks.onTabKeyInsert;
    this.onShiftTabKeyPress = callbacks.onShiftTabKeyPress;

    // Initialize handlers with callbacks
    this.shortcutHandler = new ShortcutHandler(callbacks);
    this.windowBlurHandler = new WindowBlurHandler();
  }

  public setTextarea(textarea: HTMLTextAreaElement | null): void {
    this.textarea = textarea;
    this.shortcutHandler.setTextarea(textarea);
  }

  public setSearchManager(searchManager: { isInSearchMode(): boolean; exitSearchMode(): void }): void {
    this.shortcutHandler.setSearchManager(searchManager);
  }

  public setSlashCommandManager(slashCommandManager: { isActiveMode(): boolean }): void {
    this.slashCommandManager = slashCommandManager;
    this.shortcutHandler.setSlashCommandManager(slashCommandManager);
  }

  public setMentionManager(fileSearchManager: { isActive(): boolean }): void {
    this.fileSearchManager = fileSearchManager;
    this.shortcutHandler.setMentionManager(fileSearchManager);
  }

  public setDomManager(domManager: { isDraggable(): boolean }): void {
    this.windowBlurHandler.setDomManager(domManager);
  }

  public setUserSettings(settings: UserSettings): void {
    this.shortcutHandler.setUserSettings(settings);
  }

  /**
   * Initialize event listeners (IInitializable implementation)
   */
  public initialize(): void {
    this.setupEventListeners();
  }

  public setupEventListeners(): void {
    this.setupDocumentEvents();
    this.setupWindowEvents();
    this.setupCompositionEvents();
  }

  private setupDocumentEvents(): void {
    document.addEventListener('keydown', this.handleDocumentKeyDown.bind(this), true);
  }

  private setupWindowEvents(): void {
    window.addEventListener('blur', this.handleWindowBlur.bind(this));
  }

  private setupCompositionEvents(): void {
    if (this.textarea) {
      this.textarea.addEventListener('compositionstart', () => {
        this.isComposing = true;
      });

      this.textarea.addEventListener('compositionend', () => {
        this.isComposing = false;
      });

      // Add keydown handler at textarea level to capture all keys including Tab
      // This ensures Tab key is captured before default browser handling
      this.textarea.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Tab') {
          // Skip if slash command menu is active (let slash command manager handle it)
          if (this.slashCommandManager?.isActiveMode()) {
            return;
          }

          // Skip if file search suggestions are active (let file search manager handle it)
          if (this.fileSearchManager?.isActive()) {
            return;
          }

          // Skip Tab key if IME is active to avoid conflicts with Japanese input
          // Only check this.isComposing (managed by compositionstart/end events)
          if (this.isComposing) {
            return;
          }

          // Prevent default Tab behavior (focus change)
          e.preventDefault();
          // Stop propagation to prevent duplicate handling by document listener
          e.stopPropagation();

          if (e.shiftKey) {
            // Shift+Tab: outdent (remove indentation)
            this.onShiftTabKeyPress(e);
          } else {
            // Tab: insert tab character
            this.onTabKeyInsert(e);
          }
        }
      });
    }
  }

  private async handleDocumentKeyDown(e: KeyboardEvent): Promise<void> {
    try {
      // Update composition state in shortcut handler
      this.shortcutHandler.setIsComposing(this.isComposing);

      // Delegate to shortcut handler
      await this.shortcutHandler.handleKeyDown(e);

      // Image paste is handled by PromptLineRenderer to avoid duplication
    } catch (error) {
      console.error('Error handling keydown:', error);
    }
  }

  private async handleWindowBlur(): Promise<void> {
    // Delegate to window blur handler
    await this.windowBlurHandler.handleWindowBlur();
  }

  /**
   * Suppress the next blur event from hiding the window
   * Used when opening files to prevent the window from closing
   */
  public setSuppressBlurHide(value: boolean): void {
    this.windowBlurHandler.setSuppressBlurHide(value);
  }

  public getIsComposing(): boolean {
    return this.isComposing;
  }

  /**
   * Handle history navigation shortcuts for use by other components
   */
  public handleHistoryNavigationShortcuts(e: KeyboardEvent, onNavigate: (direction: 'next' | 'prev') => void): boolean {
    // Update composition state in shortcut handler
    this.shortcutHandler.setIsComposing(this.isComposing);

    // Delegate to shortcut handler
    return this.shortcutHandler.handleHistoryNavigationShortcutsForComponent(e, onNavigate);
  }

  public destroy(): void {
    document.removeEventListener('keydown', this.handleDocumentKeyDown.bind(this), true);
    window.removeEventListener('blur', this.handleWindowBlur.bind(this));
  }
}