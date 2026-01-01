import { DELAYS } from '../constants';
import type { Config } from './types';

export interface DraftData {
  text: string;
  scrollTop: number;
}

export class DraftManagerClient {
  private draftSaveTimeout: NodeJS.Timeout | null = null;
  private config: Config = {};

  constructor(
    private electronAPI: any,
    private getTextCallback: () => string,
    private getScrollTopCallback: () => number
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
      const scrollTop = this.getScrollTopCallback();
      this.electronAPI.draft.save(text, scrollTop);
    }, this.config.draft?.saveDelay || DELAYS.DEFAULT_DRAFT_SAVE);
  }

  public async saveDraftImmediate(text?: string, scrollTop?: number): Promise<void> {
    const textToSave = text ?? this.getTextCallback();
    const scrollTopToSave = scrollTop ?? this.getScrollTopCallback();
    if (textToSave.trim()) {
      await this.electronAPI.draft.save(textToSave, scrollTopToSave);
    }
  }

  public async clearDraft(): Promise<void> {
    await this.electronAPI.draft.clear();
  }

  public extractDraftValue(draft: string | { text: string } | null | undefined): string {
    return typeof draft === 'string' ? draft : (draft?.text || '');
  }

  public extractDraftData(draft: string | { text: string; scrollTop?: number } | null | undefined): DraftData {
    if (typeof draft === 'string') {
      return { text: draft, scrollTop: 0 };
    }
    return {
      text: draft?.text || '',
      scrollTop: typeof draft?.scrollTop === 'number' ? draft.scrollTop : 0
    };
  }

  public cleanup(): void {
    if (this.draftSaveTimeout) {
      clearTimeout(this.draftSaveTimeout);
      this.draftSaveTimeout = null;
    }
  }
}