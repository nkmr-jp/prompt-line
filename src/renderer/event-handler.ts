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
  private agentSkillManager: { isActiveMode(): boolean } | null = null;
  private fileSearchManager: { isActive(): boolean } | null = null;
  private onTabKeyInsert: (e: KeyboardEvent) => void;
  private onShiftTabKeyPress: (e: KeyboardEvent) => void;
  private shortcutHandler: ShortcutHandler;
  private windowBlurHandler: WindowBlurHandler;

  // Bound event handlers to prevent memory leaks
  private boundHandleDocumentKeyDown = this.handleDocumentKeyDown.bind(this);
  private boundHandleWindowBlur = this.handleWindowBlur.bind(this);
  private boundHandleCompositionStart = this.handleCompositionStart.bind(this);
  private boundHandleCompositionEnd = this.handleCompositionEnd.bind(this);
  private boundHandleTextareaKeyDown = this.handleTextareaKeyDown.bind(this);

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

  public setAgentSkillManager(agentSkillManager: { isActiveMode(): boolean }): void {
    this.agentSkillManager = agentSkillManager;
    this.shortcutHandler.setAgentSkillManager(agentSkillManager);
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
    document.addEventListener('keydown', this.boundHandleDocumentKeyDown, true);
  }

  private setupWindowEvents(): void {
    window.addEventListener('blur', this.boundHandleWindowBlur);
  }

  private setupCompositionEvents(): void {
    if (this.textarea) {
      this.textarea.addEventListener('compositionstart', this.boundHandleCompositionStart);
      this.textarea.addEventListener('compositionend', this.boundHandleCompositionEnd);
      // Add keydown handler at textarea level to capture all keys including Tab
      // This ensures Tab key is captured before default browser handling
      this.textarea.addEventListener('keydown', this.boundHandleTextareaKeyDown);
    }
  }

  private handleCompositionStart(): void {
    this.isComposing = true;
  }

  private handleCompositionEnd(): void {
    this.isComposing = false;
  }

  private handleTextareaKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Tab') {
      // Skip if agent skill menu is active (let agent skill manager handle it)
      if (this.agentSkillManager?.isActiveMode()) {
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
    document.removeEventListener('keydown', this.boundHandleDocumentKeyDown, true);
    window.removeEventListener('blur', this.boundHandleWindowBlur);

    if (this.textarea) {
      this.textarea.removeEventListener('compositionstart', this.boundHandleCompositionStart);
      this.textarea.removeEventListener('compositionend', this.boundHandleCompositionEnd);
      this.textarea.removeEventListener('keydown', this.boundHandleTextareaKeyDown);
    }
  }
}