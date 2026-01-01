import { TIMEOUTS } from '../constants';
import { updateShortcutsDisplay } from './utils/shortcut-formatter';
import type { WindowData, AppInfo, UserSettings } from './types';

interface DraftInfo {
  text: string;
  scrollTop: number;
}

export class LifecycleManager {
  private userSettings: UserSettings | null = null;

  constructor(
    private electronAPI: any,
    private getAppNameEl: () => HTMLElement | null,
    private getHeaderShortcutsEl: () => HTMLElement | null,
    private getHistoryShortcutsEl: () => HTMLElement | null,
    private updateAppNameCallback: (name: string) => void,
    private setTextCallback: (text: string) => void,
    private focusTextareaCallback: () => void,
    private setCursorPositionCallback: (position: number) => void,
    private selectAllCallback: () => void,
    private setScrollTopCallback: (scrollTop: number) => void
  ) {}

  public handleWindowShown(data: WindowData): void {
    try {
      const draftInfo = this.extractDraftInfo(data.draft);
      this.initializeTextArea(draftInfo, !!data.draft);
      this.updateUserSettings(data.settings);

      const appName = this.getAppDisplayName(data.sourceApp);
      this.updateAppNameCallback(appName);

      // Draft is loaded instantly, no notification needed
    } catch (error) {
      console.error('Error handling window shown:', error);
    }
  }

  public async handleWindowHide(): Promise<void> {
    try {
      const appNameEl = this.getAppNameEl();
      if (appNameEl?.textContent?.trim()) {
        await this.electronAPI.draft.save(appNameEl.textContent);
      }
      await this.electronAPI.window.hide();
    } catch (error) {
      console.error('Error handling window hide:', error);
    }
  }

  private extractDraftInfo(draft: string | { text: string; scrollTop?: number } | null | undefined): DraftInfo {
    if (typeof draft === 'string') {
      return { text: draft, scrollTop: 0 };
    }
    return {
      text: draft?.text || '',
      scrollTop: typeof draft?.scrollTop === 'number' ? draft.scrollTop : 0
    };
  }

  private initializeTextArea(draftInfo: DraftInfo, hasDraft: boolean): void {
    this.setTextCallback(draftInfo.text);

    // Restore scroll position immediately after setting text (before rendering)
    // to prevent visual flickering
    if (hasDraft && draftInfo.scrollTop > 0) {
      this.setScrollTopCallback(draftInfo.scrollTop);
    }

    setTimeout(() => {
      this.focusTextareaCallback();
      if (!hasDraft) {
        this.selectAllCallback();
      } else {
        this.setCursorPositionCallback(draftInfo.text.length);
        // Re-apply scroll position after cursor is set (cursor setting may affect scroll)
        if (draftInfo.scrollTop > 0) {
          this.setScrollTopCallback(draftInfo.scrollTop);
        }
      }
    }, TIMEOUTS.TEXTAREA_FOCUS_DELAY);
  }

  private updateUserSettings(settings?: UserSettings): void {
    this.userSettings = settings || null;
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


  private updateShortcutsDisplay(): void {
    if (!this.userSettings) return;

    updateShortcutsDisplay(
      this.getHeaderShortcutsEl(),
      this.getHistoryShortcutsEl(),
      this.userSettings.shortcuts
    );
  }

  public getUserSettings(): UserSettings | null {
    return this.userSettings;
  }
}