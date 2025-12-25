/**
 * Agent Search Manager
 * Manages agent search functionality via IPC
 *
 * Responsibilities:
 * - Searching for agents via IPC
 * - Limiting agent results based on settings
 * - Error handling for agent search
 */

import type { AgentItem } from '../../../types';

export interface AgentSearchCallbacks {
  getMaxSuggestions: (type: 'command' | 'mention') => Promise<number>;
}

export class AgentSearchManager {
  private callbacks: AgentSearchCallbacks;

  constructor(callbacks: AgentSearchCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Search agents via IPC
   * @param query - Search query for agents
   * @returns Array of matching agents
   */
  public async searchAgents(query: string): Promise<AgentItem[]> {
    try {
      const electronAPI = (window as unknown as { electronAPI?: { agents?: { get?: (query: string) => Promise<AgentItem[]> } } }).electronAPI;
      if (electronAPI?.agents?.get) {
        const agents = await electronAPI.agents.get(query);
        const maxSuggestions = await this.callbacks.getMaxSuggestions('mention');
        return agents.slice(0, maxSuggestions);
      }
    } catch (error) {
      console.error('[AgentSearchManager] Failed to search agents:', error);
    }
    return [];
  }
}
