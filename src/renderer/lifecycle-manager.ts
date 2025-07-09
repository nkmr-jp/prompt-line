import { TIMEOUTS } from '../constants';
import { updateShortcutsDisplay } from './utils/shortcut-formatter';
import type { WindowData, AppInfo, UserSettings } from './types';

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
    private selectAllCallback: () => void
  ) {}

  public handleWindowShown(data: WindowData): void {
    try {
      const draftValue = this.extractDraftValue(data.draft);
      this.initializeTextArea(draftValue, !!data.draft);
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

  private extractDraftValue(draft: string | { text: string } | null | undefined): string {
    return typeof draft === 'string' ? draft : (draft?.text || '');
  }

  private initializeTextArea(draftValue: string, hasDraft: boolean): void {
    this.setTextCallback(draftValue);

    setTimeout(() => {
      this.focusTextareaCallback();
      if (!hasDraft) {
        this.selectAllCallback();
      } else {
        this.setCursorPositionCallback(draftValue.length);
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