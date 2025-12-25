import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import type { LogLevel } from '../types';
import config from "../config/app-config";

// Sensitive information patterns for masking
const SENSITIVE_PATTERNS = [
  { pattern: /password['":\s]*['"]?[\w!@#$%^&*]+/gi, replacement: 'password: [MASKED]' },
  { pattern: /token['":\s]*['"]?[\w\-.]+/gi, replacement: 'token: [MASKED]' },
  { pattern: /api[_-]?key['":\s]*['"]?[\w-]+/gi, replacement: 'api_key: [MASKED]' },
  { pattern: /secret['":\s]*['"]?[\w-]+/gi, replacement: 'secret: [MASKED]' },
  { pattern: /authorization['":\s]*['"]?Bearer [\w\-.]+/gi, replacement: 'authorization: Bearer [MASKED]' },
];

// Sensitive key names that should be masked
const SENSITIVE_KEYS = ['password', 'token', 'secret', 'apikey', 'api_key', 'authorization', 'bearer', 'auth'];

/**
 * Masks sensitive data in strings and objects before logging
 * @param data - Data to mask (string, object, or primitive)
 * @returns Masked data with sensitive information replaced
 */
export function maskSensitiveData(data: unknown): unknown {
  if (typeof data === 'string') {
    let masked = data;
    for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
      masked = masked.replace(pattern, replacement);
    }
    return masked;
  }

  if (typeof data === 'object' && data !== null) {
    if (Array.isArray(data)) {
      return data.map(item => maskSensitiveData(item));
    }

    const masked: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_KEYS.some(k => lowerKey.includes(k))) {
        masked[key] = '[MASKED]';
      } else {
        masked[key] = maskSensitiveData(value);
      }
    }
    return masked;
  }

  return data;
}

class Logger {
  private level: LogLevel = 'info';
  private enableFileLogging: boolean = true;
  private logFile: string;

  constructor() {
    // Initialize with defaults to avoid circular dependency
    this.logFile = path.join(os.homedir(), '.prompt-line', 'app.log');

    // Set actual config values after initialization if available
    this.initializeConfig();
  }

  private initializeConfig(): void {
    try {
      if (config && config.logging) {
        this.level = config.logging.level || 'info';
        this.enableFileLogging = config.logging.enableFileLogging !== false;
      }
      if (config && config.paths && config.paths.logFile) {
        this.logFile = config.paths.logFile;
      }
    } catch {
      // Config not available yet, use defaults
    }
  }

  log(level: LogLevel, message: string, data: unknown = null): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

    if (!this.shouldLog(level)) return;

    // Mask sensitive data before logging
    const maskedData = data ? maskSensitiveData(data) : null;

    const consoleMethod = this.getConsoleMethod(level);
    if (maskedData) {
      consoleMethod(logMessage, maskedData);
    } else {
      consoleMethod(logMessage);
    }

    if (this.enableFileLogging) {
      this.writeToFile(logMessage, maskedData);
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };
    return levels[level] >= levels[this.level];
  }

  private getConsoleMethod(level: LogLevel): typeof console.log {
    switch (level) {
      case 'debug': return console.debug;
      case 'info': return console.info;
      case 'warn': return console.warn;
      case 'error': return console.error;
      default: return console.log;
    }
  }

  private writeToFile(message: string, data: unknown): void {
    const fullMessage = data ? `${message} ${JSON.stringify(data)}\n` : `${message}\n`;
    fs.appendFile(this.logFile, fullMessage).catch(err => {
      console.error('Failed to write to log file:', err);
    });
  }

  debug(message: string, data?: unknown): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: unknown): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: unknown): void {
    this.log('warn', message, data);
  }

  error(message: string, data?: unknown): void {
    this.log('error', message, data);
  }
}

export const logger = new Logger();
