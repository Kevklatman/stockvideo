// src/utils/logger.ts
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import fs from 'fs';

export class Logger {
  private static instance: Logger;
  private logger: winston.Logger;
  private readonly logDir: string = 'logs';
  
  private constructor() {
    this.createLogDir();
    this.logger = this.initializeLogger();
  }

  /**
   * Get Logger instance (Singleton)
   */
  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Create log directory if it doesn't exist
   */
  private createLogDir(): void {
    const logDir = path.join(process.cwd(), this.logDir);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir);
    }
  }

  /**
   * Initialize Winston logger with configuration
   */
  private initializeLogger(): winston.Logger {
    const logFormat = winston.format.combine(
      winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
      }),
      winston.format.errors({ stack: true }),
      winston.format.splat(),
      winston.format.json()
    );

    const consoleFormat = winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
      }),
      winston.format.printf(
        info => `${info.timestamp} ${info.level}: ${info.message}${info.stack ? '\n' + info.stack : ''}`
      )
    );

    const transports: winston.transport[] = [
      // Console transport
      new winston.transports.Console({
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        format: consoleFormat
      }),

      // Info file transport
      new DailyRotateFile({
        level: 'info',
        filename: path.join(this.logDir, 'application-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '14d',
        format: logFormat
      }),

      // Error file transport
      new DailyRotateFile({
        level: 'error',
        filename: path.join(this.logDir, 'error-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '30d',
        format: logFormat
      })
    ];

    // Add HTTP transport in production
    if (process.env.NODE_ENV === 'production' && process.env.LOG_API_URL) {
      transports.push(
        new winston.transports.Http({
          level: 'error',
          host: new URL(process.env.LOG_API_URL).hostname,
          path: new URL(process.env.LOG_API_URL).pathname,
          format: logFormat
        })
      );
    }

    return winston.createLogger({
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      format: logFormat,
      transports,
      exitOnError: false
    });
  }

  /**
   * Log debug message
   */
  public debug(message: string, meta?: any): void {
    this.logger.debug(message, meta);
  }

  /**
   * Log info message
   */
  public info(message: string, meta?: any): void {
    this.logger.info(message, meta);
  }

  /**
   * Log warning message
   */
  public warn(message: string, meta?: any): void {
    this.logger.warn(message, meta);
  }

  /**
   * Log error message
   */
  public error(message: string, error?: any): void {
    if (error instanceof Error) {
      this.logger.error(message, {
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name
        }
      });
    } else {
      this.logger.error(message, { error });
    }
  }

  /**
   * Log critical error message
   */
  public critical(message: string, error?: any): void {
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
  private handleCriticalError(message: string, meta: any): void {
    // TODO: Implement notification system (e.g., email, Slack)
    // This is where you'd add integration with notification services
    if (process.env.NODE_ENV === 'production') {
      console.error('CRITICAL ERROR:', message, meta);
    }
  }

  /**
   * Log HTTP request
   */
  public httpRequest(req: any, res: any, responseTime: number): void {
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
  public child(meta: object): Logger {
    const childLogger = new Logger();
    childLogger.logger = this.logger.child(meta);
    return childLogger;
  }

  /**
   * Stream for Morgan HTTP logger
   */
  public get stream() {
    return {
      write: (message: string) => {
        this.info(message.trim());
      }
    };
  }
}

// Create request logging middleware
export const requestLogger = (req: any, res: any, next: any) => {
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

// Export default instance
export const logger = Logger.getInstance();