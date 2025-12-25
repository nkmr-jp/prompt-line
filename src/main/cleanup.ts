import { globalShortcut } from 'electron';
import { logger } from '../utils/utils';
import type WindowManager from '../managers/window-manager';
import type HistoryManager from '../managers/history-manager';
import type OptimizedHistoryManager from '../managers/optimized-history-manager';
import type DraftManager from '../managers/draft-manager';
import type IPCHandlers from '../handlers/ipc-handlers';
import type { TrayManager } from './tray-manager';

export interface CleanupResources {
  windowManager: WindowManager | null;
  historyManager: HistoryManager | OptimizedHistoryManager | null;
  draftManager: DraftManager | null;
  ipcHandlers: IPCHandlers | null;
  trayManager: TrayManager | null;
}

export class AppCleanup {
  async cleanup(resources: CleanupResources): Promise<void> {
    try {
      logger.info('Cleaning up application resources...');

      this.unregisterGlobalShortcuts();
      this.cleanupTray(resources.trayManager);

      const cleanupPromises = this.collectCleanupPromises(resources);
      await Promise.allSettled(cleanupPromises);

      logger.info('Application cleanup completed (optimized)');
    } catch (error) {
      logger.error('Error during cleanup:', error);
    }
  }

  private unregisterGlobalShortcuts(): void {
    globalShortcut.unregisterAll();
  }

  private cleanupTray(trayManager: TrayManager | null): void {
    if (trayManager) {
      trayManager.destroy();
    }
  }

  private collectCleanupPromises(resources: CleanupResources): Promise<unknown>[] {
    const cleanupPromises: Promise<unknown>[] = [];

    if (resources.ipcHandlers) {
      cleanupPromises.push(
        Promise.resolve(resources.ipcHandlers.removeAllHandlers())
      );
    }

    if (resources.draftManager) {
      cleanupPromises.push(resources.draftManager.destroy());
    }

    if (resources.historyManager) {
      cleanupPromises.push(resources.historyManager.destroy());
    }

    if (resources.windowManager) {
      cleanupPromises.push(
        Promise.resolve(resources.windowManager.destroy())
      );
    }

    return cleanupPromises;
  }
}
