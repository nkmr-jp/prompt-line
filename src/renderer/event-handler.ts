/**
 * Event Handler for renderer process
 * Manages all DOM events and keyboard shortcuts
 */

import { TIMEOUTS } from '../constants';
import { matchesShortcutString } from './utils/shortcut-parser';
import type { UserSettings } from './types';

// Secure electronAPI access via preload script
const electronAPI = (window as any).electronAPI;

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

export class EventHandler {
  private textarea: HTMLTextAreaElement | null = null;
  private isComposing = false;
  private searchManager: { isInSearchMode(): boolean; exitSearchMode(): void } | null = null;
  private userSettings: UserSettings | null = null;
  private onTextPaste: (text: string) => Promise<void>;
  private onWindowHide: () => Promise<void>;
  private onTabKeyInsert: (e: KeyboardEvent) => void;
  private onHistoryNavigation: (e: KeyboardEvent, direction: 'next' | 'prev') => void;
  private onSearchToggle: () => void;

  constructor(callbacks: {
    onTextPaste: (text: string) => Promise<void>;
    onWindowHide: () => Promise<void>;
    onTabKeyInsert: (e: KeyboardEvent) => void;
    onHistoryNavigation: (e: KeyboardEvent, direction: 'next' | 'prev') => void;
    onSearchToggle: () => void;
  }) {
    this.onTextPaste = callbacks.onTextPaste;
    this.onWindowHide = callbacks.onWindowHide;
    this.onTabKeyInsert = callbacks.onTabKeyInsert;
    this.onHistoryNavigation = callbacks.onHistoryNavigation;
    this.onSearchToggle = callbacks.onSearchToggle;
  }

  public setTextarea(textarea: HTMLTextAreaElement | null): void {
    this.textarea = textarea;
  }

  public setSearchManager(searchManager: { isInSearchMode(): boolean; exitSearchMode(): void }): void {
    this.searchManager = searchManager;
  }

  public setUserSettings(settings: UserSettings): void {
    this.userSettings = settings;
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
    }
  }

  private async handleDocumentKeyDown(e: KeyboardEvent): Promise<void> {
    try {
      // Skip if event originated from search input to avoid duplicate handling
      const target = e.target as HTMLElement;
      if (target && target.id === 'searchInput') {
        return;
      }

      // Handle Cmd+Enter for paste action
      if (e.key === 'Enter' && e.metaKey) {
        e.preventDefault();
        
        if (this.textarea) {
          const text = this.textarea.value.trim();
          if (text) {
            await this.onTextPaste(text);
          }
        }
        return;
      }

      // Handle Escape for hide window
      if (e.key === 'Escape') {
        e.preventDefault();
        // Check if search mode is active
        if (this.searchManager && this.searchManager.isInSearchMode()) {
          // Exit search mode instead of hiding window
          this.searchManager.exitSearchMode();
          return;
        }
        await this.onWindowHide();
        return;
      }

      // Handle Tab for tab insertion
      if (e.key === 'Tab') {
        // Skip shortcut if IME is active to avoid conflicts with Japanese input
        if (this.isComposing || e.isComposing) {
          return;
        }
        this.onTabKeyInsert(e);
        return;
      }

      // Handle history navigation shortcuts
      if (this.userSettings?.shortcuts) {
        // Check for historyNext shortcut
        if (matchesShortcutString(e, this.userSettings.shortcuts.historyNext)) {
          // Skip shortcut if IME is active to avoid conflicts with Japanese input
          if (this.isComposing || e.isComposing) {
            return;
          }
          e.preventDefault();
          this.onHistoryNavigation(e, 'next');
          return;
        }

        // Check for historyPrev shortcut
        if (matchesShortcutString(e, this.userSettings.shortcuts.historyPrev)) {
          // Skip shortcut if IME is active to avoid conflicts with Japanese input
          if (this.isComposing || e.isComposing) {
            return;
          }
          e.preventDefault();
          this.onHistoryNavigation(e, 'prev');
          return;
        }
      }

      // Handle search shortcut
      if (this.userSettings?.shortcuts?.search) {
        if (matchesShortcutString(e, this.userSettings.shortcuts.search)) {
          // Skip shortcut if IME is active
          if (this.isComposing || e.isComposing) {
            return;
          }
          e.preventDefault();
          this.onSearchToggle();
          return;
        }
      }

      // Handle Cmd+, for opening settings (local shortcut only when window is active)
      if (e.key === ',' && e.metaKey) {
        e.preventDefault();
        
        try {
          await electronAPI.invoke('open-settings');
          console.log('Settings file opened');
        } catch (error) {
          console.error('Failed to open settings:', error);
        }
        return;
      }

      // Image paste is handled by PromptLineRenderer to avoid duplication
    } catch (error) {
      console.error('Error handling keydown:', error);
    }
  }

  private async handleWindowBlur(): Promise<void> {
    try {
      // Hide window when focus moves to another application
      // This should happen regardless of which element has focus within the window
      setTimeout(async () => {
        await electronAPI.invoke('hide-window', false);
      }, TIMEOUTS.WINDOW_BLUR_HIDE_DELAY);
    } catch (error) {
      console.error('Error handling window blur:', error);
    }
  }


  public getIsComposing(): boolean {
    return this.isComposing;
  }

  /**
   * Handle history navigation shortcuts for use by other components
   */
  public handleHistoryNavigationShortcuts(e: KeyboardEvent, onNavigate: (direction: 'next' | 'prev') => void): boolean {
    if (!this.userSettings?.shortcuts) {
      return false;
    }

    // Check for historyNext shortcut
    if (matchesShortcutString(e, this.userSettings.shortcuts.historyNext)) {
      // Skip shortcut if IME is active to avoid conflicts with Japanese input
      if (this.isComposing || e.isComposing) {
        return false;
      }
      e.preventDefault();
      onNavigate('next');
      return true;
    }

    // Check for historyPrev shortcut
    if (matchesShortcutString(e, this.userSettings.shortcuts.historyPrev)) {
      // Skip shortcut if IME is active to avoid conflicts with Japanese input
      if (this.isComposing || e.isComposing) {
        return false;
      }
      e.preventDefault();
      onNavigate('prev');
      return true;
    }

    return false;
  }

  public destroy(): void {
    document.removeEventListener('keydown', this.handleDocumentKeyDown.bind(this), true);
    window.removeEventListener('blur', this.handleWindowBlur.bind(this));
  }
}