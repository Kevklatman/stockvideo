"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.requestLogger = exports.Logger = void 0;
// src/utils/logger.ts
const winston_1 = __importDefault(require("winston"));
const winston_daily_rotate_file_1 = __importDefault(require("winston-daily-rotate-file"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
class Logger {
    constructor() {
        this.logDir = 'logs';
        this.createLogDir();
        this.logger = this.initializeLogger();
    }
    /**
     * Get Logger instance (Singleton)
     */
    static getInstance() {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }
    /**
     * Create log directory if it doesn't exist
     */
    createLogDir() {
        const logDir = path_1.default.join(process.cwd(), this.logDir);
        if (!fs_1.default.existsSync(logDir)) {
            fs_1.default.mkdirSync(logDir);
        }
    }
    /**
     * Initialize Winston logger with configuration
     */
    initializeLogger() {
        const logFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }), winston_1.default.format.errors({ stack: true }), winston_1.default.format.splat(), winston_1.default.format.json());
        const consoleFormat = winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }), winston_1.default.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}${info.stack ? '\n' + info.stack : ''}`));
        const transports = [
            // Console transport
            new winston_1.default.transports.Console({
                level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
                format: consoleFormat
            }),
            // Info file transport
            new winston_daily_rotate_file_1.default({
                level: 'info',
                filename: path_1.default.join(this.logDir, 'application-%DATE%.log'),
                datePattern: 'YYYY-MM-DD',
                zippedArchive: true,
                maxSize: '20m',
                maxFiles: '14d',
                format: logFormat
            }),
            // Error file transport
            new winston_daily_rotate_file_1.default({
                level: 'error',
                filename: path_1.default.join(this.logDir, 'error-%DATE%.log'),
                datePattern: 'YYYY-MM-DD',
                zippedArchive: true,
                maxSize: '20m',
                maxFiles: '30d',
                format: logFormat
            })
        ];
        // Add HTTP transport in production
        if (process.env.NODE_ENV === 'production' && process.env.LOG_API_URL) {
            transports.push(new winston_1.default.transports.Http({
                level: 'error',
                host: new URL(process.env.LOG_API_URL).hostname,
                path: new URL(process.env.LOG_API_URL).pathname,
                format: logFormat
            }));
        }
        return winston_1.default.createLogger({
            level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
            format: logFormat,
            transports,
            exitOnError: false
        });
    }
    /**
     * Log debug message
     */
    debug(message, meta) {
        this.logger.debug(message, meta);
    }
    /**
     * Log info message
     */
    info(message, meta) {
        this.logger.info(message, meta);
    }
    /**
     * Log warning message
     */
    warn(message, meta) {
        this.logger.warn(message, meta);
    }
    /**
     * Log error message
     */
    error(message, error) {
        if (error instanceof Error) {
            this.logger.error(message, {
                error: {
                    message: error.message,
                    stack: error.stack,
                    name: error.name
                }
            });
        }
        else {
            this.logger.error(message, { error });
        }
    }
    /**
     * Log critical error message
     */
    critical(message, error) {
        const meta = {
            severity: 'CRITICAL',
            error: error instanceof Error ? {
                message: error.message,
                stack: error.stack,
                name: error.name
            } : error
        };
        this.logger.error(message, meta);
        // Additional handling for critical errors (e.g., notification)
        this.handleCriticalError(message, meta);
    }
    /**
     * Handle critical errors
     */
    handleCriticalError(message, meta) {
        // TODO: Implement notification system (e.g., email, Slack)
        // This is where you'd add integration with notification services
        if (process.env.NODE_ENV === 'production') {
            console.error('CRITICAL ERROR:', message, meta);
        }
    }
    /**
     * Log HTTP request
     */
    httpRequest(req, res, responseTime) {
        this.logger.info('HTTP Request', {
            method: req.method,
            url: req.url,
            status: res.statusCode,
            responseTime,
            userAgent: req.get('user-agent'),
            ip: req.ip
        });
    }
    /**
     * Create child logger with additional metadata
     */
    child(meta) {
        const childLogger = new Logger();
        childLogger.logger = this.logger.child(meta);
        return childLogger;
    }
    /**
     * Stream for Morgan HTTP logger
     */
    get stream() {
        return {
            write: (message) => {
                this.info(message.trim());
            }
        };
    }
}
exports.Logger = Logger;
// Create request logging middleware
const requestLogger = (req, res, next) => {
    const startTime = Date.now();
    // Log request
    Logger.getInstance().debug(`Incoming ${req.method} request to ${req.url}`);
    // Log response
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        Logger.getInstance().httpRequest(req, res, duration);
    });
    next();
};
exports.requestLogger = requestLogger;
// Export default instance
exports.logger = Logger.getInstance();
