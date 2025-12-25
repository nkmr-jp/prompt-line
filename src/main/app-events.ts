import { app } from 'electron';
import config from '../config/app-config';
import { logger } from '../utils/utils';
import type DraftManager from '../managers/draft-manager';
import type HistoryManager from '../managers/history-manager';
import type OptimizedHistoryManager from '../managers/optimized-history-manager';

interface AppEventHandlers {
  onShowWindow: () => Promise<void>;
  onCleanup: () => Promise<void>;
}

export class AppEventListener {
  constructor(
    private draftManager: DraftManager,
    private historyManager: HistoryManager | OptimizedHistoryManager,
    private handlers: AppEventHandlers
  ) {}

  setupEventListeners(): void {
    this.setupWillQuit();
    this.setupWindowAllClosed();
    this.setupActivate();
    this.setupBeforeQuit();
  }

  private setupWillQuit(): void {
    app.on('will-quit', (event) => {
      event.preventDefault();
      this.handlers.onCleanup().finally(() => {
        app.exit(0);
      });
    });
  }

  private setupWindowAllClosed(): void {
    app.on('window-all-closed', () => {
      logger.debug('All windows closed, keeping app running in background');
    });
  }

  private setupActivate(): void {
    app.on('activate', async () => {
      if (config.platform.isMac) {
        await this.handlers.onShowWindow();
      }
    });
  }

  private setupBeforeQuit(): void {
    app.on('before-quit', async (_event) => {
      logger.info('Application is about to quit');

      const savePromises: Promise<unknown>[] = [];

      if (this.draftManager && this.draftManager.hasDraft()) {
        savePromises.push(
          this.draftManager.saveDraftImmediately(this.draftManager.getCurrentDraft())
        );
      }

      if (this.historyManager) {
        savePromises.push(this.historyManager.flushPendingSaves());
      }

      try {
        await Promise.allSettled(savePromises);
        logger.info('Critical data saved before quit');
      } catch (error) {
        logger.error('Error saving critical data before quit:', error);
      }
    });
  }
}
