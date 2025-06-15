/**
 * Event Handler for renderer process
 * Manages all DOM events and keyboard shortcuts
 */

import { TIMEOUTS } from '../constants';
import { matchesShortcutString } from './utils/shortcut-parser';
import type { UserSettings } from './types';

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
  private searchManager: { isInSearchMode(): boolean } | null = null;
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

  public setSearchManager(searchManager: { isInSearchMode(): boolean }): void {
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
        // Check if search mode is active
        if (this.searchManager && this.searchManager.isInSearchMode()) {
          // Let the search manager handle it
          return;
        }
        e.preventDefault();
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

      // Handle Cmd+F for search
      if (e.key === 'f' && e.metaKey) {
        // Skip shortcut if IME is active
        if (this.isComposing || e.isComposing) {
          return;
        }
        e.preventDefault();
        this.onSearchToggle();
        return;
      }

      // Handle Cmd+V for image paste
      if (e.key === 'v' && e.metaKey) {
        await this.handleImagePaste(e);
        return;
      }
    } catch (error) {
      console.error('Error handling keydown:', error);
    }
  }

  private async handleWindowBlur(): Promise<void> {
    try {
      // Hide window when focus moves to another application
      // This should happen regardless of which element has focus within the window
      setTimeout(async () => {
        await ipcRenderer.invoke('hide-window', false);
      }, TIMEOUTS.WINDOW_BLUR_HIDE_DELAY);
    } catch (error) {
      console.error('Error handling window blur:', error);
    }
  }

  private async handleImagePaste(e: KeyboardEvent): Promise<void> {
    try {
      if (!this.textarea) return;

      const result = await ipcRenderer.invoke('paste-image') as ImageResult;
      
      if (result.success && result.path) {
        e.preventDefault();
        
        // Get current cursor position
        const start = this.textarea.selectionStart;
        const end = this.textarea.selectionEnd;
        const currentValue = this.textarea.value;
        
        // Insert the image path at cursor position
        const newValue = currentValue.substring(0, start) + result.path + currentValue.substring(end);
        this.textarea.value = newValue;
        
        // Update cursor position
        const newCursorPos = start + result.path.length;
        this.textarea.setSelectionRange(newCursorPos, newCursorPos);
        
        // Trigger input event for any listeners
        this.textarea.dispatchEvent(new Event('input', { bubbles: true }));
      } else if (result.error) {
        console.warn('Image paste failed:', result.error);
      }
      // If no image in clipboard, let the default Cmd+V behavior proceed
    } catch (error) {
      console.error('Error handling image paste:', error);
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