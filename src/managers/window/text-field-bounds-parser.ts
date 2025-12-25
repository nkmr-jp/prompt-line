import { logger } from '../../utils/utils';
import type { WindowBounds } from '../../types';

/**
 * Parse text field bounds from JSON response
 */
export function parseTextFieldBoundsResponse(stdout?: string): WindowBounds | null {
  try {
    const result = JSON.parse(stdout?.trim() || '{}');

    if (result.error) {
      logger.debug('Text field detector error:', result.error);
      return null;
    }

    if (!isValidBoundsData(result)) {
      logger.debug('Invalid text field bounds data received');
      return null;
    }

    return extractBounds(result);
  } catch (parseError) {
    logger.debug('Error parsing text field detector output:', parseError);
    return null;
  }
}

/**
 * Check if result contains valid bounds data
 */
function isValidBoundsData(result: any): boolean {
  return result.success &&
         typeof result.x === 'number' &&
         typeof result.y === 'number' &&
         typeof result.width === 'number' &&
         typeof result.height === 'number';
}

/**
 * Extract bounds from result, using parent container if available
 */
function extractBounds(result: any): WindowBounds {
  let bounds: WindowBounds = {
    x: result.x,
    y: result.y,
    width: result.width,
    height: result.height
  };

  if (hasValidParentBounds(result)) {
    bounds = extractParentBounds(result);
  }

  logger.debug('Text field bounds found:', bounds);
  return bounds;
}

/**
 * Extract parent bounds from result
 */
function extractParentBounds(result: any): WindowBounds {
  logger.debug('Using parent container bounds for scrollable text field');
  return {
    x: result.parent.x,
    y: result.parent.y,
    width: result.parent.width,
    height: result.parent.height
  };
}

/**
 * Check if result has valid parent bounds
 */
function hasValidParentBounds(result: any): boolean {
  const parent = result.parent;
  return parent &&
         parent.isVisibleContainer &&
         typeof parent.x === 'number' &&
         typeof parent.y === 'number' &&
         typeof parent.width === 'number' &&
         typeof parent.height === 'number';
}
