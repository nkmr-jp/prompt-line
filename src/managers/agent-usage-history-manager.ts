import path from 'path';
import { UsageHistoryManager } from './usage-history-manager';
import appConfig from '../config/app-config';

/**
 * Agent Usage History Manager
 * Manages usage history for @ mention agent selections
 */
class AgentUsageHistoryManager extends UsageHistoryManager {
  private static instance: AgentUsageHistoryManager | null = null;

  private constructor() {
    const filePath = path.join(appConfig.paths.projectsCacheDir, 'agent-usage-history.jsonl');
    super(filePath, {
      maxEntries: 100,
      ttlDays: 30,
    });
  }

  static getInstance(): AgentUsageHistoryManager {
    if (!AgentUsageHistoryManager.instance) {
      AgentUsageHistoryManager.instance = new AgentUsageHistoryManager();
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

export const agentUsageHistoryManager = AgentUsageHistoryManager.getInstance();
export { AgentUsageHistoryManager };
