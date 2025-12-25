import { screen } from 'electron';
import { logger, getActiveWindowBounds, TEXT_FIELD_DETECTOR_PATH } from '../../utils/utils';
import config from '../../config/app-config';
import type { WindowBounds } from '../../types';
import { execFile } from 'child_process';
import { parseTextFieldBoundsResponse } from './text-field-bounds-parser';

/**
 * Base interface for position calculation strategies
 */
export interface PositionStrategy {
  calculate(windowWidth: number, windowHeight: number): Promise<{ x: number; y: number }>;
}

/**
 * Center position strategy - centers on primary display
 */
export class CenterPositionStrategy implements PositionStrategy {
  async calculate(windowWidth: number, windowHeight: number): Promise<{ x: number; y: number }> {
    const display = screen.getPrimaryDisplay();
    const bounds = display.bounds;
    return {
      x: bounds.x + (bounds.width - windowWidth) / 2,
      y: bounds.y + (bounds.height - windowHeight) / 2 - 100
    };
  }
}

/**
 * Active window center position strategy
 */
export class ActiveWindowCenterPositionStrategy implements PositionStrategy {
  constructor(private constrainFn: (pos: { x: number; y: number }, width: number, height: number, ref: { x: number; y: number }) => { x: number; y: number }) {}

  async calculate(windowWidth: number, windowHeight: number): Promise<{ x: number; y: number }> {
    try {
      const activeWindowBounds = await getActiveWindowBounds();
      if (activeWindowBounds) {
        return this.calculateWithinWindow(activeWindowBounds, windowWidth, windowHeight);
      } else {
        logger.warn('Could not get active window bounds, falling back to center position');
        return new CenterPositionStrategy().calculate(windowWidth, windowHeight);
      }
    } catch (error) {
      logger.warn('Error getting active window bounds, falling back to center position:', error);
      return new CenterPositionStrategy().calculate(windowWidth, windowHeight);
    }
  }

  private calculateWithinWindow(
    activeWindowBounds: WindowBounds,
    windowWidth: number,
    windowHeight: number
  ): { x: number; y: number } {
    const x = activeWindowBounds.x + (activeWindowBounds.width - windowWidth) / 2;
    const y = activeWindowBounds.y + (activeWindowBounds.height - windowHeight) / 2;

    const point = {
      x: activeWindowBounds.x + activeWindowBounds.width / 2,
      y: activeWindowBounds.y + activeWindowBounds.height / 2
    };

    return this.constrainFn({ x, y }, windowWidth, windowHeight, point);
  }
}

/**
 * Cursor position strategy
 */
export class CursorPositionStrategy implements PositionStrategy {
  constructor(private constrainFn: (pos: { x: number; y: number }, width: number, height: number, ref: { x: number; y: number }) => { x: number; y: number }) {}

  async calculate(windowWidth: number, windowHeight: number): Promise<{ x: number; y: number }> {
    const point = screen.getCursorScreenPoint();
    const x = point.x - (windowWidth / 2);
    const y = point.y - (windowHeight / 2);

    return this.constrainFn({ x, y }, windowWidth, windowHeight, point);
  }
}

/**
 * Active text field position strategy
 */
export class ActiveTextFieldPositionStrategy implements PositionStrategy {
  constructor(private constrainFn: (pos: { x: number; y: number }, width: number, height: number, ref: { x: number; y: number }) => { x: number; y: number }) {}

  async calculate(windowWidth: number, windowHeight: number): Promise<{ x: number; y: number }> {
    try {
      const textFieldBounds = await this.getActiveTextFieldBounds();
      if (textFieldBounds) {
        return this.calculateNearTextField(textFieldBounds, windowWidth, windowHeight);
      } else {
        logger.warn('Could not get active text field bounds, falling back to active-window-center');
        return new ActiveWindowCenterPositionStrategy(this.constrainFn).calculate(windowWidth, windowHeight);
      }
    } catch (error) {
      logger.warn('Error getting active text field bounds, falling back to active-window-center:', error);
      return new ActiveWindowCenterPositionStrategy(this.constrainFn).calculate(windowWidth, windowHeight);
    }
  }

  private calculateNearTextField(
    textFieldBounds: WindowBounds,
    windowWidth: number,
    windowHeight: number
  ): { x: number; y: number } {
    const x = this.calculateXPosition(textFieldBounds, windowWidth);
    const y = textFieldBounds.y + (textFieldBounds.height - windowHeight) / 2;

    return this.constrainFn({ x, y }, windowWidth, windowHeight, {
      x: textFieldBounds.x + textFieldBounds.width / 2,
      y: textFieldBounds.y + textFieldBounds.height / 2
    });
  }

  private calculateXPosition(textFieldBounds: WindowBounds, windowWidth: number): number {
    if (textFieldBounds.width < windowWidth) {
      return textFieldBounds.x;
    } else {
      return textFieldBounds.x + (textFieldBounds.width - windowWidth) / 2;
    }
  }

  private async getActiveTextFieldBounds(): Promise<WindowBounds | null> {
    if (!config.platform.isMac) {
      logger.debug('Text field detection only supported on macOS');
      return null;
    }

    const options = {
      timeout: 3000,
      killSignal: 'SIGTERM' as const
    };

    return new Promise((resolve) => {
      execFile(TEXT_FIELD_DETECTOR_PATH, ['text-field-bounds'], options, (error: Error | null, stdout?: string) => {
        if (error) {
          logger.debug('Error getting text field bounds via native tool:', error);
          resolve(null);
          return;
        }

        const bounds = parseTextFieldBoundsResponse(stdout);
        resolve(bounds);
      });
    });
  }
}
