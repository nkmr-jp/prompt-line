import { IpcMainInvokeEvent } from 'electron';
import { logger } from '../utils/utils';
import { getFileUsageHistoryManager } from '../managers/file-usage-history-manager';
import { getSymbolUsageHistoryManager } from '../managers/symbol-usage-history-manager';
import { getAgentUsageHistoryManager } from '../managers/agent-usage-history-manager';

/**
 * UsageHistoryHandler manages all IPC handlers for usage history tracking.
 * This includes file, symbol, and agent usage recording and bonus calculation.
 */
class UsageHistoryHandler {

  /**
   * Register all usage history related IPC handlers
   */
  setupHandlers(ipcMain: typeof import('electron').ipcMain): void {
    // File usage
    ipcMain.handle('record-file-usage', this.handleRecordFileUsage.bind(this));
    ipcMain.handle('get-file-usage-bonuses', this.handleGetFileUsageBonuses.bind(this));

    // Symbol usage
    ipcMain.handle('record-symbol-usage', this.handleRecordSymbolUsage.bind(this));
    ipcMain.handle('get-symbol-usage-bonuses', this.handleGetSymbolUsageBonuses.bind(this));

    // Agent usage
    ipcMain.handle('record-agent-usage', this.handleRecordAgentUsage.bind(this));
    ipcMain.handle('get-agent-usage-bonuses', this.handleGetAgentUsageBonuses.bind(this));

    logger.info('UsageHistory IPC handlers registered');
  }

  /**
   * Remove all usage history related IPC handlers
   */
  removeHandlers(ipcMain: typeof import('electron').ipcMain): void {
    const handlers = [
      'record-file-usage',
      'get-file-usage-bonuses',
      'record-symbol-usage',
      'get-symbol-usage-bonuses',
      'record-agent-usage',
      'get-agent-usage-bonuses',
    ];

    handlers.forEach(handler => {
      ipcMain.removeAllListeners(handler);
    });

    logger.info('UsageHistory IPC handlers removed');
  }

  // ========================================
  // File Usage Handlers
  // ========================================

  private async handleRecordFileUsage(
    _event: IpcMainInvokeEvent,
    filePath: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await getFileUsageHistoryManager().recordFileUsage(filePath);
      return { success: true };
    } catch (error) {
      logger.error('Failed to record file usage', { error, filePath });
      return { success: false, error: String(error) };
    }
  }

  private async handleGetFileUsageBonuses(
    _event: IpcMainInvokeEvent,
    filePaths: string[]
  ): Promise<Record<string, number>> {
    const bonuses: Record<string, number> = {};

    for (const filePath of filePaths) {
      bonuses[filePath] = getFileUsageHistoryManager().calculateFileBonus(filePath);
    }

    return bonuses;
  }

  // ========================================
  // Symbol Usage Handlers
  // ========================================

  private async handleRecordSymbolUsage(
    _event: IpcMainInvokeEvent,
    filePath: string,
    symbolName: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await getSymbolUsageHistoryManager().recordSymbolUsage(filePath, symbolName);
      return { success: true };
    } catch (error) {
      logger.error('Failed to record symbol usage', { error, filePath, symbolName });
      return { success: false, error: String(error) };
    }
  }

  private async handleGetSymbolUsageBonuses(
    _event: IpcMainInvokeEvent,
    symbols: Array<{ filePath: string; symbolName: string }>
  ): Promise<Record<string, number>> {
    const bonuses: Record<string, number> = {};
    const manager = getSymbolUsageHistoryManager();

    for (const { filePath, symbolName } of symbols) {
      const key = manager.createSymbolKey(filePath, symbolName);
      bonuses[key] = manager.calculateSymbolBonus(filePath, symbolName);
    }

    return bonuses;
  }

  // ========================================
  // Agent Usage Handlers
  // ========================================

  private async handleRecordAgentUsage(
    _event: IpcMainInvokeEvent,
    agentName: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await getAgentUsageHistoryManager().recordAgentUsage(agentName);
      return { success: true };
    } catch (error) {
      logger.error('Failed to record agent usage', { error, agentName });
      return { success: false, error: String(error) };
    }
  }

  private async handleGetAgentUsageBonuses(
    _event: IpcMainInvokeEvent,
    agentNames: string[]
  ): Promise<Record<string, number>> {
    const bonuses: Record<string, number> = {};

    for (const agentName of agentNames) {
      bonuses[agentName] = getAgentUsageHistoryManager().calculateAgentBonus(agentName);
    }

    return bonuses;
  }
}

export default UsageHistoryHandler;
