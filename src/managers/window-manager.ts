/**
 * WindowManager - Re-export for backward compatibility
 *
 * The WindowManager implementation has been refactored into the window/ directory
 * with the following module structure:
 *
 * - window/window-manager.ts: Main coordinator class
 * - window/position-calculator.ts: Window positioning algorithms
 * - window/native-tool-executor.ts: Native macOS tool execution
 * - window/directory-detector.ts: Directory detection and file search
 * - window/types.ts: Type definitions
 *
 * This file re-exports from the new location to maintain backward compatibility
 * with existing imports.
 */

// Re-export WindowManager from the new location
export { default } from './window';
export * from './window';
