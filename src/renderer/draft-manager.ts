import { DELAYS } from '../constants';
import type { Config, IpcRenderer } from './types';

export class DraftManager {
  private draftSaveTimeout: NodeJS.Timeout | null = null;
  private config: Config = {};

  constructor(
    private ipcRenderer: IpcRenderer,
    private getTextCallback: () => string
  ) {}

  public setConfig(config: Config): void {
    this.config = config;
  }

  public saveDraftDebounced(): void {
    if (this.draftSaveTimeout) {
      clearTimeout(this.draftSaveTimeout);
    }
    this.draftSaveTimeout = setTimeout(() => {
      const text = this.getTextCallback();
      this.ipcRenderer.invoke('save-draft', text);
    }, this.config.draft?.saveDelay || DELAYS.DEFAULT_DRAFT_SAVE);
  }

  public async saveDraftImmediate(text?: string): Promise<void> {
    const textToSave = text ?? this.getTextCallback();
    if (textToSave.trim()) {
      await this.ipcRenderer.invoke('save-draft', textToSave, true);
    }
  }

  public async clearDraft(): Promise<void> {
    await this.ipcRenderer.invoke('clear-draft');
  }

  public extractDraftValue(draft: string | { text: string } | null | undefined): string {
    return typeof draft === 'string' ? draft : (draft?.text || '');
  }

  public cleanup(): void {
    if (this.draftSaveTimeout) {
      clearTimeout(this.draftSaveTimeout);
      this.draftSaveTimeout = null;
    }
  }
}