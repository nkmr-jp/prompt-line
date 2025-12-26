/**
 * Simple Snapshot Manager
 * Manages a single snapshot of text state before history selection
 * Supports browser's default undo functionality while providing
 * recovery from history selection overwrites
 */
// @ts-nocheck


export interface TextSnapshot {
  text: string;
  cursorPosition: number;
}

export class SimpleSnapshotManager {
  private snapshot: TextSnapshot | null = null;

  /**
   * Save a snapshot of the current text state
   * Only saves if no snapshot exists (prevents overwriting on multiple history selections)
   */
  public saveSnapshot(text: string, cursorPosition: number): void {
    // Only save if no snapshot exists yet
    if (this.snapshot === null) {
      this.snapshot = { text, cursorPosition };
      console.debug('Snapshot saved:', {
        textLength: text.length,
        cursorPosition
      });
    } else {
      console.debug('Snapshot already exists, skipping save');
    }
  }

  /**
   * Restore the saved snapshot
   * Returns the snapshot and clears it (one-time restore)
   * @returns The saved snapshot or null if none exists
   */
  public restore(): TextSnapshot | null {
    const result = this.snapshot;

    if (result) {
      console.debug('Snapshot restored:', {
        textLength: result.text.length,
        cursorPosition: result.cursorPosition
      });
      this.snapshot = null; // Clear after restore
    } else {
      console.debug('No snapshot to restore');
    }

    return result;
  }

  /**
   * Check if a snapshot exists
   * @returns true if snapshot exists, false otherwise
   */
  public hasSnapshot(): boolean {
    return this.snapshot !== null;
  }

  /**
   * Clear the saved snapshot without restoring
   * Used when the snapshot is no longer needed (e.g., successful paste)
   */
  public clearSnapshot(): void {
    if (this.snapshot !== null) {
      console.debug('Snapshot cleared');
      this.snapshot = null;
    }
  }
}
