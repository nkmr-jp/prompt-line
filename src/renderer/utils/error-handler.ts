/**
 * Error Handler Utility
 * Provides unified error handling for renderer process
 */

export interface ErrorHandlerOptions {
  /** Show notification via UIManager (default: false) */
  notify?: boolean;
  /** Rethrow error after handling (default: false) */
  rethrow?: boolean;
  /** Silent mode - skip console logging (default: false) */
  silent?: boolean;
}

/**
 * Handle errors with unified logging format and optional notification
 * @param context - Error context (e.g., "FileSearchManager.loadDirectory")
 * @param error - Error object or unknown value
 * @param options - Error handling options
 */
export function handleError(
  context: string,
  error: unknown,
  options: ErrorHandlerOptions = {}
): void {
  const { notify = false, rethrow = false, silent = false } = options;

  // Extract error message
  const message = error instanceof Error ? error.message : String(error);
  const fullMessage = `[${context}] ${message}`;

  // Log to console unless silent
  if (!silent) {
    console.error(fullMessage, error);
  }

  // Show notification if requested
  if (notify) {
    showErrorNotification(fullMessage);
  }

  // Rethrow if requested
  if (rethrow) {
    throw error;
  }
}

/**
 * Show error notification via UIManager
 * @param message - Error message to display
 */
function showErrorNotification(message: string): void {
  try {
    // Access UIManager from global window object
    const uiManager = (window as any).uiManager;
    if (uiManager && typeof uiManager.showNotification === 'function') {
      uiManager.showNotification(message, 'error');
    }
  } catch (err) {
    // Fallback: log to console if UIManager is not available
    console.error('[ErrorHandler] Failed to show notification:', err);
  }
}
