/**
 * Simple logger for Renderer process
 * Provides consistent logging with log levels and formatting
 *
 * Usage:
 *   import { rendererLogger } from './utils/logger';
 *   rendererLogger.info('Message');
 *   rendererLogger.error('Error message', error);
 */
// @ts-nocheck


type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
  enabled: boolean;
  minLevel: LogLevel;
  prefix: string;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

const defaultConfig: LoggerConfig = {
  enabled: true,
  minLevel: 'info',
  prefix: '[Renderer]'
};

class RendererLogger {
  private config: LoggerConfig;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  private shouldLog(level: LogLevel): boolean {
    if (!this.config.enabled) return false;
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.minLevel];
  }

  private formatMessage(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString().slice(11, 23);
    return `${timestamp} ${this.config.prefix} [${level.toUpperCase()}] ${message}`;
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage('debug', message), ...args);
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage('info', message), ...args);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message), ...args);
    }
  }

  error(message: string, ...args: unknown[]): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message), ...args);
    }
  }

  /**
   * Update logger configuration
   */
  setConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Enable debug level logging
   */
  enableDebug(): void {
    this.config.minLevel = 'debug';
  }

  /**
   * Disable all logging
   */
  disable(): void {
    this.config.enabled = false;
  }
}

// Export singleton instance
export const rendererLogger = new RendererLogger();

// Export class for custom instances
export { RendererLogger };
export type { LogLevel, LoggerConfig };
