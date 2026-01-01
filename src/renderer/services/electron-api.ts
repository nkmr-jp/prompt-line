/**
 * Type-safe Electron API Access
 *
 * Provides centralized, type-safe access to the Electron API injected by preload script.
 * All renderer processes should use this module instead of directly accessing window.electronAPI.
 */

import type { ElectronAPI } from '../../types/ipc';

/**
 * Get the Electron API with type safety
 * @throws {Error} If Electron API is not available (preload script not loaded)
 * @returns {ElectronAPI} Type-safe Electron API
 */
export const getElectronAPI = (): ElectronAPI => {
  const api = (window as any).electronAPI as ElectronAPI | undefined;
  if (!api) {
    throw new Error('Electron API not available. Preload script may not be loaded correctly.');
  }
  return api;
};

/**
 * Lazy-initialized singleton instance of Electron API for convenience
 * Uses Proxy to avoid initialization errors in test environments
 * The Proxy always fetches from window.electronAPI to support test mocking
 */
export const electronAPI: ElectronAPI = new Proxy({} as ElectronAPI, {
  get(_target, prop) {
    const api = (window as any).electronAPI;
    if (!api) {
      throw new Error('Electron API not available. Preload script may not be loaded correctly.');
    }
    return api[prop];
  }
});
