import { screen } from 'electron';
import { logger } from '../../utils/utils';
import type { StartupPosition } from '../../types';
import {
  CenterPositionStrategy,
  ActiveWindowCenterPositionStrategy,
  CursorPositionStrategy,
  ActiveTextFieldPositionStrategy,
  type PositionStrategy
} from './position-strategies';

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

    const strategy = this.getStrategy(position);
    const strategyStartTime = performance.now();
    const result = await strategy.calculate(windowWidth, windowHeight);

    logger.debug(`⏱️  ${position} calculation: ${(performance.now() - strategyStartTime).toFixed(2)}ms`);
    logger.debug(`🏁 Total position calculation (${position}): ${(performance.now() - methodStartTime).toFixed(2)}ms`);

    return result;
  }

  /**
   * Get positioning strategy based on mode
   */
  private getStrategy(position: StartupPosition): PositionStrategy {
    const constrainFn = this.constrainToScreenBounds.bind(this);

    switch (position) {
      case 'center':
        return new CenterPositionStrategy();
      case 'active-window-center':
        return new ActiveWindowCenterPositionStrategy(constrainFn);
      case 'active-text-field':
        return new ActiveTextFieldPositionStrategy(constrainFn);
      case 'cursor':
        return new CursorPositionStrategy(constrainFn);
      default:
        logger.warn('Invalid position value, falling back to active-window-center', { position });
        return new ActiveWindowCenterPositionStrategy(constrainFn);
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
