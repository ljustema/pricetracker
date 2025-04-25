/**
 * Simple logging utility for PriceTracker
 * Provides consistent formatting and optional file logging
 */

import fs from 'fs';
import path from 'path';

// Log levels
export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

// Configuration
const LOG_TO_FILE = process.env.LOG_TO_FILE !== 'false';
// Use absolute path to logs directory at project root
const LOG_DIR = process.env.LOG_DIR || path.join(process.cwd(), 'logs');
const MIN_LOG_LEVEL = (process.env.MIN_LOG_LEVEL as LogLevel) || 'INFO';

// Log level priorities (lower number = higher priority)
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  'ERROR': 0,
  'WARN': 1,
  'INFO': 2,
  'DEBUG': 3
};

// Ensure log directory exists if file logging is enabled
if (LOG_TO_FILE) {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
  } catch (_err) {
    console.error(`Failed to create log directory: ${_err}`);
  }
}

/**
 * Format a log message with timestamp, level, and context
 */
function formatLogMessage(level: LogLevel, context: string, message: string): string {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level}] [${context}] ${message}`;
}

/**
 * Write a log message to file if enabled
 */
function writeToFile(formattedMessage: string): void {
  if (!LOG_TO_FILE) return;

  try {
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const logFile = path.join(LOG_DIR, `pricetracker-${date}.log`);

    fs.appendFileSync(logFile, formattedMessage + '\n');
  } catch (_err) {
    console.error(`Failed to write to log file: ${_err}`);
  }
}

/**
 * Log a message if its level meets the minimum log level
 */
function log(level: LogLevel, context: string, message: string, data?: unknown): void {
  // Check if we should log this level
  if (LOG_LEVEL_PRIORITY[level] > LOG_LEVEL_PRIORITY[MIN_LOG_LEVEL]) {
    return;
  }

  let formattedMessage = formatLogMessage(level, context, message);

  // Add data if provided
  if (data !== undefined) {
    let dataStr: string;
    try {
      dataStr = typeof data === 'string' ? data : JSON.stringify(data);
      formattedMessage += ` | Data: ${dataStr}`;
    } catch (_err) {
      formattedMessage += ` | Data: [Unstringifiable Object]`;
    }
  }

  // Log to console with appropriate method
  switch (level) {
    case 'ERROR':
      console.error(formattedMessage);
      break;
    case 'WARN':
      console.warn(formattedMessage);
      break;
    case 'DEBUG':
      console.debug(formattedMessage);
      break;
    case 'INFO':
    default:
      console.log(formattedMessage);
  }

  // Write to file if enabled
  writeToFile(formattedMessage);
}

// Export convenience methods
export const logger = {
  debug: (context: string, message: string, data?: unknown) => log('DEBUG', context, message, data),
  info: (context: string, message: string, data?: unknown) => log('INFO', context, message, data),
  warn: (context: string, message: string, data?: unknown) => log('WARN', context, message, data),
  error: (context: string, message: string, data?: unknown) => log('ERROR', context, message, data)
};

export default logger;
