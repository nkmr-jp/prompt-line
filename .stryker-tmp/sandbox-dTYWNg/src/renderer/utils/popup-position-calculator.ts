/**
 * Popup Position Calculator
 *
 * Shared utility for calculating popup positioning relative to a target element.
 * This module consolidates duplicate popup positioning logic from
 * FrontmatterPopupManager and file-search PopupManager.
 */
// @ts-nocheck


/**
 * Options for calculating popup position
 */
export interface PopupPositionOptions {
  /** Rectangle of the target element (e.g., info icon) */
  targetRect: DOMRect;
  /** Rectangle of the container element */
  containerRect: DOMRect;
  /** Minimum height of the popup (default: 80) */
  minHeight?: number;
  /** Maximum height of the popup (default: 150) */
  maxHeight?: number;
  /** Horizontal gap between popup and target (default: 8) */
  horizontalGap?: number;
  /** Vertical gap between popup and target (default: 4) */
  verticalGap?: number;
  /** Width offset from container (default: 40) */
  widthOffset?: number;
  /** Margin from screen edges (default: 10) */
  screenMargin?: number;
}

/**
 * Result of popup position calculation
 */
export interface PopupPositionResult {
  /** CSS right position value */
  right: number;
  /** CSS top position value */
  top: number;
  /** Width of the popup */
  width: number;
  /** Maximum height of the popup */
  maxHeight: number;
  /** Whether the popup is shown above the target */
  showAbove: boolean;
}

/**
 * Calculate optimal popup position relative to a target element.
 * Positions popup to the left of the target, above or below based on available space.
 *
 * @param options - Configuration options for position calculation
 * @returns Calculated position values for the popup
 */
export function calculatePopupPosition(options: PopupPositionOptions): PopupPositionResult {
  const {
    targetRect,
    containerRect,
    minHeight = 80,
    maxHeight: maxHeightLimit = 150,
    horizontalGap = 8,
    verticalGap = 4,
    widthOffset = 40,
    screenMargin = 10
  } = options;

  // Calculate popup width based on container
  const width = containerRect.width - widthOffset;

  // Position popup to the left of the target
  const right = window.innerWidth - targetRect.left + horizontalGap;

  // Calculate available space below and above the target
  const spaceBelow = window.innerHeight - targetRect.bottom - screenMargin;
  const spaceAbove = targetRect.top - screenMargin;

  // Decide whether to show popup above or below the target
  const showAbove = spaceBelow < minHeight && spaceAbove > spaceBelow;

  let top: number;
  let maxHeight: number;

  if (showAbove) {
    // Position above the target (bottom of popup aligns with top of target)
    maxHeight = Math.max(minHeight, Math.min(maxHeightLimit, spaceAbove - verticalGap));
    top = targetRect.top - maxHeight - verticalGap;
  } else {
    // Position below the target (top of popup aligns with bottom of target)
    top = targetRect.bottom + verticalGap;
    maxHeight = Math.max(minHeight, Math.min(maxHeightLimit, spaceBelow - verticalGap));
  }

  return { right, top, width, maxHeight, showAbove };
}

/**
 * Apply calculated position to a popup element
 *
 * @param popup - The popup HTML element to position
 * @param position - The calculated position result
 */
export function applyPopupPosition(popup: HTMLElement, position: PopupPositionResult): void {
  popup.style.right = `${position.right}px`;
  popup.style.left = 'auto';
  popup.style.top = `${position.top}px`;
  popup.style.width = `${position.width}px`;
  popup.style.maxHeight = `${position.maxHeight}px`;
}
