import path from 'path';
import { UsageHistoryManager } from './usage-history-manager';

/**
 * Agent Usage History Manager
 * Manages usage history for @ mention agent selections
 */
class AgentUsageHistoryManager extends UsageHistoryManager {
  private static instance: AgentUsageHistoryManager | null = null;
  private static _filePath: string | null = null;

  private static get filePath(): string {
    if (!AgentUsageHistoryManager._filePath) {
       
      const appConfig = require('../config/app-config').default;
      AgentUsageHistoryManager._filePath = path.join(appConfig.paths.projectsCacheDir, 'agent-usage-history.jsonl');
    }
    return AgentUsageHistoryManager._filePath;
  }

  private constructor(filePath: string) {
    super(filePath, {
      maxEntries: 100,
      ttlDays: 30,
    });
  }

  static getInstance(): AgentUsageHistoryManager {
    if (!AgentUsageHistoryManager.instance) {
      AgentUsageHistoryManager.instance = new AgentUsageHistoryManager(AgentUsageHistoryManager.filePath);
    }
    return AgentUsageHistoryManager.instance;
  }

  /**
   * Record agent usage by name
   */
  async recordAgentUsage(agentName: string): Promise<void> {
    await this.recordUsage(agentName);
  }

  /**
   * Calculate bonus for an agent
   */
  calculateAgentBonus(agentName: string): number {
    return this.calculateBonus(agentName);
  }
}

// Lazy singleton - only instantiated when first accessed
let _agentUsageHistoryManager: AgentUsageHistoryManager | null = null;
export function getAgentUsageHistoryManager(): AgentUsageHistoryManager {
  if (!_agentUsageHistoryManager) {
    _agentUsageHistoryManager = AgentUsageHistoryManager.getInstance();
  }
  return _agentUsageHistoryManager;
}

export { AgentUsageHistoryManager };
