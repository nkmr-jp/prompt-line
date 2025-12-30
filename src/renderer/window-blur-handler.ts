/**
 * Window Blur Handler
 * Handles window blur events and auto-hide functionality
 */

import { TIMEOUTS } from '../constants';
import { electronAPI } from './services/electron-api';

export class WindowBlurHandler {
  private domManager: { isDraggable(): boolean } | null = null;
  private suppressBlurHide = false;

  public setDomManager(domManager: { isDraggable(): boolean }): void {
    this.domManager = domManager;
  }

  /**
   * Suppress the next blur event from hiding the window
   * Used when opening files to prevent the window from closing
   */
  public setSuppressBlurHide(value: boolean): void {
    this.suppressBlurHide = value;
  }

  /**
   * Handle window blur event
   */
  public async handleWindowBlur(): Promise<void> {
    try {
      // Check blur suppression flag (used when opening files to prevent window from closing)
      if (this.suppressBlurHide) {
        this.suppressBlurHide = false; // Reset after one use
        return;
      }

      // Check if window is in draggable state (file was opened from link)
      // In this state, don't close the window when focus moves to another application
      // This allows the user to interact with the opened file while keeping the prompt window visible
      if (this.domManager?.isDraggable()) {
        return;
      }

      // Hide window when focus moves to another application
      // This should happen regardless of which element has focus within the window
      setTimeout(async () => {
        await electronAPI.invoke('hide-window', false);
      }, TIMEOUTS.WINDOW_BLUR_HIDE_DELAY);
    } catch (error) {
      console.error('Error handling window blur:', error);
    }
  }
}
