/**
 * Shortcut Handler for keyboard shortcuts
 * Handles all keyboard shortcut processing and routing
 */

import { matchesShortcutString } from './utils/shortcut-parser';
import { rendererLogger } from './utils/logger';
import type { UserSettings } from './types';

// Secure electronAPI access via preload script
const electronAPI = (window as any).electronAPI;

export class ShortcutHandler {
  private textarea: HTMLTextAreaElement | null = null;
  private isComposing = false;
  private searchManager: { isInSearchMode(): boolean; exitSearchMode(): void } | null = null;
  private slashCommandManager: { isActiveMode(): boolean } | null = null;
  private fileSearchManager: { isActive(): boolean } | null = null;
  private userSettings: UserSettings | null = null;
  private onTextPaste: (text: string) => Promise<void>;
  private onWindowHide: () => Promise<void>;
  private onTabKeyInsert: (e: KeyboardEvent) => void;
  private onShiftTabKeyPress: (e: KeyboardEvent) => void;
  private onHistoryNavigation: (e: KeyboardEvent, direction: 'next' | 'prev') => void;
  private onSearchToggle: () => void;
  private onUndo: () => boolean;

  constructor(callbacks: {
    onTextPaste: (text: string) => Promise<void>;
    onWindowHide: () => Promise<void>;
    onTabKeyInsert: (e: KeyboardEvent) => void;
    onShiftTabKeyPress: (e: KeyboardEvent) => void;
    onHistoryNavigation: (e: KeyboardEvent, direction: 'next' | 'prev') => void;
    onSearchToggle: () => void;
    onUndo: () => boolean;
  }) {
    this.onTextPaste = callbacks.onTextPaste;
    this.onWindowHide = callbacks.onWindowHide;
    this.onTabKeyInsert = callbacks.onTabKeyInsert;
    this.onShiftTabKeyPress = callbacks.onShiftTabKeyPress;
    this.onHistoryNavigation = callbacks.onHistoryNavigation;
    this.onSearchToggle = callbacks.onSearchToggle;
    this.onUndo = callbacks.onUndo;
  }

  public setTextarea(textarea: HTMLTextAreaElement | null): void {
    this.textarea = textarea;
  }

  public setSearchManager(searchManager: { isInSearchMode(): boolean; exitSearchMode(): void }): void {
    this.searchManager = searchManager;
  }

  public setSlashCommandManager(slashCommandManager: { isActiveMode(): boolean }): void {
    this.slashCommandManager = slashCommandManager;
  }

  public setFileSearchManager(fileSearchManager: { isActive(): boolean }): void {
    this.fileSearchManager = fileSearchManager;
  }

  public setUserSettings(settings: UserSettings): void {
    this.userSettings = settings;
  }

  public setIsComposing(isComposing: boolean): void {
    this.isComposing = isComposing;
  }

  /**
   * Handle keyboard shortcuts
   * Returns true if shortcut was handled, false otherwise
   */
  public async handleKeyDown(e: KeyboardEvent): Promise<boolean> {
    // Skip if event originated from search input to avoid duplicate handling
    const target = e.target as HTMLElement;
    if (target && target.id === 'searchInput') {
      return false;
    }

    // Handle Cmd+Z for Undo
    if (e.key === 'z' && e.metaKey && !e.shiftKey) {
      return this.handleUndoShortcut(e);
    }

    // Handle Cmd+Enter for paste action
    if (e.key === 'Enter' && e.metaKey) {
      await this.handlePasteShortcut(e);
      return true;
    }

    // Handle Escape for hide window
    if (e.key === 'Escape') {
      return await this.handleEscapeKey(e);
    }

    // Handle Tab for tab insertion
    if (e.key === 'Tab') {
      return this.handleTabKey(e, target);
    }

    // Handle history navigation shortcuts
    if (await this.handleHistoryNavigationShortcuts(e)) {
      return true;
    }

    // Handle search shortcut
    if (this.handleSearchShortcut(e)) {
      return true;
    }

    // Handle Shift+Cmd+, for opening settings directory
    if (e.key === ',' && e.metaKey && e.shiftKey) {
      await this.handleSettingsDirectoryShortcut(e);
      return true;
    }

    // Handle Cmd+, for opening settings file
    if (e.key === ',' && e.metaKey && !e.shiftKey) {
      await this.handleSettingsShortcut(e);
      return true;
    }

    return false;
  }

  private handleUndoShortcut(e: KeyboardEvent): boolean {
    // Skip if IME is active to avoid conflicts with Japanese input
    if (this.isComposing || e.isComposing) {
      return false;
    }

    // Call undo handler - it will decide whether to preventDefault
    const shouldHandle = this.onUndo();
    if (shouldHandle) {
      e.preventDefault();
    }
    return shouldHandle;
  }

  private async handlePasteShortcut(e: KeyboardEvent): Promise<void> {
    e.preventDefault();

    if (this.textarea) {
      const text = this.textarea.value.trim();
      if (text) {
        await this.onTextPaste(text);
      }
    }
  }

  private async handleEscapeKey(e: KeyboardEvent): Promise<boolean> {
    // Skip if slash command menu is active (let slash command manager handle it)
    if (this.slashCommandManager?.isActiveMode()) {
      return false;
    }

    // Skip if file search suggestions are active (let file search manager handle it)
    if (this.fileSearchManager?.isActive()) {
      return false;
    }

    e.preventDefault();
    // Check if search mode is active
    if (this.searchManager && this.searchManager.isInSearchMode()) {
      // Exit search mode instead of hiding window
      this.searchManager.exitSearchMode();
      return true;
    }
    await this.onWindowHide();
    return true;
  }

  private handleTabKey(e: KeyboardEvent, target: HTMLElement): boolean {
    // Skip if event originated from textarea to avoid duplicate handling
    // Textarea-level handler will handle Tab key events
    if (target && target === this.textarea) {
      return false;
    }

    // Skip if file search suggestions are active (let file search manager handle it)
    if (this.fileSearchManager?.isActive()) {
      return false;
    }

    // Skip Tab key if IME is active to avoid conflicts with Japanese input
    if (this.isComposing) {
      return false;
    }

    if (e.shiftKey) {
      // Shift+Tab: outdent (remove indentation)
      this.onShiftTabKeyPress(e);
    } else {
      // Tab: insert tab character
      this.onTabKeyInsert(e);
    }
    return true;
  }

  private async handleHistoryNavigationShortcuts(e: KeyboardEvent): Promise<boolean> {
    // Skip if slash command menu is active (let slash command manager handle Ctrl+j/k)
    // Skip if file search is active (let file search manager handle Ctrl+j/k)
    if (!this.userSettings?.shortcuts ||
        this.slashCommandManager?.isActiveMode() ||
        this.fileSearchManager?.isActive()) {
      return false;
    }

    // Check for historyNext shortcut
    if (matchesShortcutString(e, this.userSettings.shortcuts.historyNext)) {
      // Skip shortcut if IME is active to avoid conflicts with Japanese input
      if (this.isComposing || e.isComposing) {
        return false;
      }
      e.preventDefault();
      this.onHistoryNavigation(e, 'next');
      return true;
    }

    // Check for historyPrev shortcut
    if (matchesShortcutString(e, this.userSettings.shortcuts.historyPrev)) {
      // Skip shortcut if IME is active to avoid conflicts with Japanese input
      if (this.isComposing || e.isComposing) {
        return false;
      }
      e.preventDefault();
      this.onHistoryNavigation(e, 'prev');
      return true;
    }

    return false;
  }

  private handleSearchShortcut(e: KeyboardEvent): boolean {
    if (!this.userSettings?.shortcuts?.search) {
      return false;
    }

    if (matchesShortcutString(e, this.userSettings.shortcuts.search)) {
      // Skip shortcut if IME is active
      if (this.isComposing || e.isComposing) {
        return false;
      }
      e.preventDefault();
      this.onSearchToggle();
      return true;
    }

    return false;
  }

  private async handleSettingsShortcut(e: KeyboardEvent): Promise<void> {
    e.preventDefault();

    try {
      await electronAPI.invoke('open-settings');
      rendererLogger.info('Settings file opened');
    } catch (error) {
      rendererLogger.error('Failed to open settings:', error);
    }
  }

  private async handleSettingsDirectoryShortcut(e: KeyboardEvent): Promise<void> {
    e.preventDefault();

    try {
      await electronAPI.invoke('open-settings-directory');
      rendererLogger.info('Settings directory opened');
    } catch (error) {
      rendererLogger.error('Failed to open settings directory:', error);
    }
  }

  /**
   * Handle history navigation shortcuts for use by other components
   */
  public handleHistoryNavigationShortcutsForComponent(e: KeyboardEvent, onNavigate: (direction: 'next' | 'prev') => void): boolean {
    if (!this.userSettings?.shortcuts) {
      return false;
    }

    // Skip if slash command menu is active (let slash command manager handle Ctrl+j/k)
    if (this.slashCommandManager?.isActiveMode()) {
      return false;
    }

    // Skip if file search is active (let file search manager handle Ctrl+j/k)
    if (this.fileSearchManager?.isActive()) {
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
}
