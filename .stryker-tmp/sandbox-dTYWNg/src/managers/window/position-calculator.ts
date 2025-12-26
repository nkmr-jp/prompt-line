// @ts-nocheck
import { screen } from 'electron';
import { logger, getActiveWindowBounds } from '../../utils/utils';
import type { StartupPosition } from '../../types';
import { getActiveTextFieldBounds } from './text-field-bounds-detector';

/**
 * Window position calculator with multiple positioning strategies
 * Handles window positioning for different modes with screen boundary constraints
 */
class WindowPositionCalculator {
  /**
   * Calculate window position based on specified positioning mode
   * @param position - Positioning mode (center, active-window-center, cursor, active-text-field)
   * @param windowWidth - Width of the window to position
   * @param windowHeight - Height of the window to position
   * @returns Promise resolving to window position coordinates
   */
  async calculateWindowPosition(
    position: StartupPosition,
    windowWidth: number,
    windowHeight: number
  ): Promise<{ x: number; y: number }> {
    const methodStartTime = performance.now();
    logger.debug(`🕐 Calculating position for: ${position}`);

    let result: { x: number; y: number };

    switch (position) {
      case 'center': {
        const centerStartTime = performance.now();
        result = this.calculateCenterPosition(windowWidth, windowHeight);
        logger.debug(`⏱️  Center calculation: ${(performance.now() - centerStartTime).toFixed(2)}ms`);
        break;
      }

      case 'active-window-center': {
        const awcStartTime = performance.now();
        result = await this.calculateActiveWindowCenterPosition(windowWidth, windowHeight);
        logger.debug(`⏱️  Active window center calculation: ${(performance.now() - awcStartTime).toFixed(2)}ms`);
        break;
      }

      case 'active-text-field': {
        const atfStartTime = performance.now();
        result = await this.calculateActiveTextFieldPosition(windowWidth, windowHeight);
        logger.debug(`⏱️  Active text field calculation: ${(performance.now() - atfStartTime).toFixed(2)}ms`);
        break;
      }

      case 'cursor': {
        const cursorStartTime = performance.now();
        result = this.calculateCursorPosition(windowWidth, windowHeight);
        logger.debug(`⏱️  Cursor calculation: ${(performance.now() - cursorStartTime).toFixed(2)}ms`);
        break;
      }

      default: {
        logger.warn('Invalid position value, falling back to active-window-center', { position });
        const fallbackStartTime = performance.now();
        result = await this.calculateActiveWindowCenterPosition(windowWidth, windowHeight);
        logger.debug(`⏱️  Fallback calculation: ${(performance.now() - fallbackStartTime).toFixed(2)}ms`);
        break;
      }
    }

    logger.debug(`🏁 Total position calculation (${position}): ${(performance.now() - methodStartTime).toFixed(2)}ms`);
    return result;
  }

  /**
   * Calculate center position on primary display with slight upward offset
   * @param windowWidth - Width of the window
   * @param windowHeight - Height of the window
   * @returns Window position coordinates centered on primary display
   */
  calculateCenterPosition(windowWidth: number, windowHeight: number): { x: number; y: number } {
    const display = screen.getPrimaryDisplay();
    const bounds = display.bounds;
    return {
      x: bounds.x + (bounds.width - windowWidth) / 2,
      y: bounds.y + (bounds.height - windowHeight) / 2 - 100
    };
  }

  /**
   * Calculate position centered within the currently active window
   * Falls back to center position if active window bounds cannot be determined
   * @param windowWidth - Width of the window
   * @param windowHeight - Height of the window
   * @returns Window position coordinates centered in active window
   */
  async calculateActiveWindowCenterPosition(
    windowWidth: number,
    windowHeight: number
  ): Promise<{ x: number; y: number }> {
    try {
      const activeWindowBounds = await getActiveWindowBounds();
      if (activeWindowBounds) {
        const x = activeWindowBounds.x + (activeWindowBounds.width - windowWidth) / 2;
        const y = activeWindowBounds.y + (activeWindowBounds.height - windowHeight) / 2;

        const point = {
          x: activeWindowBounds.x + activeWindowBounds.width / 2,
          y: activeWindowBounds.y + activeWindowBounds.height / 2
        };

        return this.constrainToScreenBounds({ x, y }, windowWidth, windowHeight, point);
      } else {
        logger.warn('Could not get active window bounds, falling back to center position');
        return this.calculateCenterPosition(windowWidth, windowHeight);
      }
    } catch (error) {
      logger.warn('Error getting active window bounds, falling back to center position:', error);
      return this.calculateCenterPosition(windowWidth, windowHeight);
    }
  }

  /**
   * Calculate position at cursor location
   * Window is centered on the cursor with screen boundary constraints
   * @param windowWidth - Width of the window
   * @param windowHeight - Height of the window
   * @returns Window position coordinates centered on cursor
   */
  calculateCursorPosition(windowWidth: number, windowHeight: number): { x: number; y: number } {
    const point = screen.getCursorScreenPoint();
    const x = point.x - (windowWidth / 2);
    const y = point.y - (windowHeight / 2);

    return this.constrainToScreenBounds({ x, y }, windowWidth, windowHeight, point);
  }

  /**
   * Calculate position near the currently focused text field
   * Falls back to active-window-center if text field cannot be detected
   * @param windowWidth - Width of the window
   * @param windowHeight - Height of the window
   * @returns Window position coordinates near active text field
   */
  async calculateActiveTextFieldPosition(
    windowWidth: number,
    windowHeight: number
  ): Promise<{ x: number; y: number }> {
    try {
      const textFieldBounds = await getActiveTextFieldBounds();
      if (textFieldBounds) {
        // If text field is narrower than window, align to left edge of text field
        // Otherwise, center the window horizontally within the text field
        let x: number;
        if (textFieldBounds.width < windowWidth) {
          x = textFieldBounds.x;
        } else {
          x = textFieldBounds.x + (textFieldBounds.width - windowWidth) / 2;
        }

        // Always center vertically
        const y = textFieldBounds.y + (textFieldBounds.height - windowHeight) / 2;

        return this.constrainToScreenBounds({ x, y }, windowWidth, windowHeight, {
          x: textFieldBounds.x + textFieldBounds.width / 2,
          y: textFieldBounds.y + textFieldBounds.height / 2
        });
      } else {
        logger.warn('Could not get active text field bounds, falling back to active-window-center');
        return this.calculateActiveWindowCenterPosition(windowWidth, windowHeight);
      }
    } catch (error) {
      logger.warn('Error getting active text field bounds, falling back to active-window-center:', error);
      return this.calculateActiveWindowCenterPosition(windowWidth, windowHeight);
    }
  }

  /**
   * Constrain window position to screen bounds for multi-monitor setups
   * Ensures the window stays fully visible within the screen containing the reference point
   * @param position - Initial window position
   * @param windowWidth - Width of the window
   * @param windowHeight - Height of the window
   * @param referencePoint - Reference point for determining which screen to use
   * @returns Constrained window position that stays within screen bounds
   */
  private constrainToScreenBounds(
    position: { x: number; y: number },
    windowWidth: number,
    windowHeight: number,
    referencePoint: { x: number; y: number }
  ): { x: number; y: number } {
    const display = screen.getDisplayNearestPoint(referencePoint);
    const bounds = display.bounds;

    return {
      x: Math.max(bounds.x, Math.min(position.x, bounds.x + bounds.width - windowWidth)),
      y: Math.max(bounds.y, Math.min(position.y, bounds.y + bounds.height - windowHeight))
    };
  }
}

export default WindowPositionCalculator;
