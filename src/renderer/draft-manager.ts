import { DELAYS } from '../constants';
import type { Config } from './types';

export class DraftManager {
  private draftSaveTimeout: NodeJS.Timeout | null = null;
  private config: Config = {};

  constructor(
    private electronAPI: any,
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
      this.electronAPI.draft.save(text);
    }, this.config.draft?.saveDelay || DELAYS.DEFAULT_DRAFT_SAVE);
  }

  public async saveDraftImmediate(text?: string): Promise<void> {
    const textToSave = text ?? this.getTextCallback();
    if (textToSave.trim()) {
      await this.electronAPI.draft.save(textToSave);
    }
  }

  public async clearDraft(): Promise<void> {
    await this.electronAPI.draft.clear();
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