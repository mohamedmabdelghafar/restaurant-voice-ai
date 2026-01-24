// src/utils/logger.js - Structured Logging Service
const util = require('util');

// Log levels
const LOG_LEVELS = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4
};

// Current log level from environment
const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL] ?? LOG_LEVELS.info;

// Colors for console output
const COLORS = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m',
    green: '\x1b[32m'
};

/**
 * Format log entry as JSON for production or pretty print for development
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {Object} meta - Additional metadata
 * @returns {string}
 */
function formatLog(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const isProduction = process.env.NODE_ENV === 'production';

    const logEntry = {
        timestamp,
        level: level.toUpperCase(),
        message,
        ...meta
    };

    if (isProduction) {
        // JSON format for production (easier to parse)
        return JSON.stringify(logEntry);
    }

    // Pretty format for development
    const levelColors = {
        error: COLORS.red,
        warn: COLORS.yellow,
        info: COLORS.blue,
        http: COLORS.cyan,
        debug: COLORS.gray
    };

    const color = levelColors[level] || COLORS.reset;
    const metaStr = Object.keys(meta).length > 0
        ? `\n${COLORS.gray}${util.inspect(meta, { colors: true, depth: 3 })}${COLORS.reset}`
        : '';

    return `${COLORS.gray}[${timestamp}]${COLORS.reset} ${color}${level.toUpperCase().padEnd(5)}${COLORS.reset} ${message}${metaStr}`;
}

/**
 * Log a message
 * @param {string} level - Log level
 * @param {string} message - Message to log
 * @param {Object} meta - Additional metadata
 */
function log(level, message, meta = {}) {
    if (LOG_LEVELS[level] > currentLevel) return;

    const formattedLog = formatLog(level, message, meta);

    if (level === 'error') {
        console.error(formattedLog);
    } else if (level === 'warn') {
        console.warn(formattedLog);
    } else {
        console.log(formattedLog);
    }
}

/**
 * Create child logger with preset context
 * @param {Object} context - Preset context for all logs
 * @returns {Object} Child logger
 */
function createChild(context) {
    return {
        error: (message, meta = {}) => log('error', message, { ...context, ...meta }),
        warn: (message, meta = {}) => log('warn', message, { ...context, ...meta }),
        info: (message, meta = {}) => log('info', message, { ...context, ...meta }),
        http: (message, meta = {}) => log('http', message, { ...context, ...meta }),
        debug: (message, meta = {}) => log('debug', message, { ...context, ...meta })
    };
}

/**
 * HTTP request logger middleware
 */
function httpLogger(req, res, next) {
    const startTime = Date.now();

    // Generate request ID
    req.id = req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Set response header
    res.setHeader('X-Request-ID', req.id);

    // Log on response finish
    res.on('finish', () => {
        const duration = Date.now() - startTime;

        log('http', `${req.method} ${req.path}`, {
            requestId: req.id,
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            userAgent: req.headers['user-agent']?.substring(0, 50),
            ip: req.ip || req.connection.remoteAddress
        });
    });

    next();
}

/**
 * Error logger
 * @param {Error} error - Error object
 * @param {Object} context - Additional context
 */
function logError(error, context = {}) {
    log('error', error.message, {
        ...context,
        errorName: error.name,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        code: error.code
    });
}

module.exports = {
    error: (message, meta) => log('error', message, meta),
    warn: (message, meta) => log('warn', message, meta),
    info: (message, meta) => log('info', message, meta),
    http: (message, meta) => log('http', message, meta),
    debug: (message, meta) => log('debug', message, meta),
    createChild,
    httpLogger,
    logError,
    LOG_LEVELS
};
