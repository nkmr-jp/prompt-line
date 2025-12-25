/**
 * HoverStateManager - Manages Cmd+hover link style interactions
 *
 * Responsibilities:
 * - Track Cmd key state for hover interactions
 * - Track mouse position for hover detection
 * - Manage hovered path state
 * - Coordinate with BackdropRenderer for link style rendering
 */

import type { AtPathRange } from '../types';

export interface HoverStateCallbacks {
  findClickableRangeAtPosition: (charPos: number) => AtPathRange | null;
  getCharPositionFromCoordinates: (clientX: number, clientY: number) => number | null;
  renderFilePathHighlight: () => void;
  clearFilePathHighlight: () => void;
}

/**
 * Manages Cmd+hover state and link style highlighting
 */
export class HoverStateManager {
  private callbacks: HoverStateCallbacks;

  // Cmd+hover state
  private isCmdHoverActive: boolean = false;
  private hoveredAtPath: AtPathRange | null = null;

  // Mouse position tracking for Cmd key press detection
  private lastMouseX: number = 0;
  private lastMouseY: number = 0;

  constructor(callbacks: HoverStateCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Get the currently hovered path
   */
  public getHoveredPath(): AtPathRange | null {
    return this.hoveredAtPath;
  }

  /**
   * Handle mouse move for Cmd+hover link style
   */
  public onMouseMove(e: MouseEvent): void {
    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;

    if (!e.metaKey) {
      if (this.hoveredAtPath) {
        this.clearHover();
      }
      return;
    }

    this.isCmdHoverActive = true;
    this.checkAndHighlightAtPath(e.clientX, e.clientY);
  }

  /**
   * Handle Cmd key down
   */
  public onCmdKeyDown(): void {
    if (!this.isCmdHoverActive) {
      this.isCmdHoverActive = true;
      // Re-check current mouse position for @path
      this.updateHoverStateAtLastPosition();
    }
  }

  /**
   * Handle Cmd key up
   */
  public onCmdKeyUp(): void {
    if (this.isCmdHoverActive) {
      this.isCmdHoverActive = false;
      this.clearHover();
    }
  }

  /**
   * Clear hover state
   */
  public clearHover(): void {
    this.hoveredAtPath = null;
    this.callbacks.clearFilePathHighlight();
  }

  /**
   * Check if mouse is over a clickable path and highlight it
   */
  private checkAndHighlightAtPath(clientX: number, clientY: number): void {
    const charPos = this.callbacks.getCharPositionFromCoordinates(clientX, clientY);

    if (charPos === null) {
      this.clearHover();
      return;
    }

    // Find any clickable range at this position
    const clickableRange = this.callbacks.findClickableRangeAtPosition(charPos);

    if (clickableRange) {
      // Update hover state if changed
      if (!this.hoveredAtPath ||
          this.hoveredAtPath.start !== clickableRange.start ||
          this.hoveredAtPath.end !== clickableRange.end) {
        this.hoveredAtPath = clickableRange;
        this.callbacks.renderFilePathHighlight();
      }
    } else {
      this.clearHover();
    }
  }

  /**
   * Update hover state when Cmd key is pressed
   */
  private updateHoverStateAtLastPosition(): void {
    if (this.lastMouseX && this.lastMouseY) {
      this.checkAndHighlightAtPath(this.lastMouseX, this.lastMouseY);
    }
  }
}
