/**
 * IPC Handler related type definitions
 */

/**
 * Statistics about registered IPC handlers
 */
export interface HandlerStats {
  /** Total number of registered handlers */
  totalHandlers: number;
  /** List of registered handler names */
  registeredHandlers: string[];
  /** Timestamp when stats were collected */
  timestamp: number;
}
