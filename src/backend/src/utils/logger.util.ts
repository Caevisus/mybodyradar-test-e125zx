import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { ElasticsearchTransport } from 'winston-elasticsearch';
import { ENVIRONMENT } from '../constants/system.constants';

/**
 * Custom log levels with performance tracking support
 */
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
  performance: 5,
};

/**
 * Color scheme for console logging
 */
const LOG_COLORS = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
  performance: 'blue',
};

/**
 * Performance thresholds for monitoring
 */
const PERFORMANCE_THRESHOLDS = {
  latency: 100, // milliseconds
  uptime: 99.9, // percentage
};

/**
 * Interface for logger options
 */
interface LoggerOptions {
  sampling?: boolean;
  elasticsearchConfig?: {
    node: string;
    index: string;
  };
  retentionDays?: number;
  performanceTracking?: boolean;
}

/**
 * Interface for metric tracking
 */
interface MetricTracker {
  startTime: number;
  measurements: Map<string, number[]>;
}

/**
 * Sanitizes sensitive data from log messages
 */
const sanitizeLogData = (data: any): any => {
  if (!data) return data;
  
  const sensitiveFields = ['password', 'token', 'apiKey', 'secret'];
  const sanitized = { ...data };

  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }

  return sanitized;
};

/**
 * Formats log messages with consistent structure and sanitization
 */
const formatLogMessage = (info: winston.LogEntry): string => {
  const timestamp = new Date().toISOString();
  const { level, message, module, correlationId, ...metadata } = info;

  const sanitizedMetadata = sanitizeLogData(metadata);
  
  return JSON.stringify({
    timestamp,
    level,
    module,
    correlationId,
    message,
    ...sanitizedMetadata,
  });
};

/**
 * Creates a configured Winston logger instance
 */
const createLogger = (module: string, options: LoggerOptions = {}): winston.Logger => {
  const {
    sampling = false,
    elasticsearchConfig,
    retentionDays = 30,
    performanceTracking = true,
  } = options;

  // Configure base logger
  const logger = winston.createLogger({
    levels: LOG_LEVELS,
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
  });

  // Add console transport for development
  if (process.env.NODE_ENV === ENVIRONMENT.DEVELOPMENT) {
    logger.add(new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize({ colors: LOG_COLORS }),
        winston.format.simple()
      ),
    }));
  }

  // Add file rotation transport for production
  if (process.env.NODE_ENV === ENVIRONMENT.PRODUCTION) {
    logger.add(new DailyRotateFile({
      filename: 'logs/%DATE%-app.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: `${retentionDays}d`,
      maxSize: '100m',
      compress: true,
    }));

    // Add Elasticsearch transport if configured
    if (elasticsearchConfig) {
      logger.add(new ElasticsearchTransport({
        level: 'info',
        clientOpts: { node: elasticsearchConfig.node },
        indexPrefix: elasticsearchConfig.index,
        buffering: true,
        bufferLimit: 100,
        flushInterval: 2000,
      }));
    }
  }

  return logger;
};

/**
 * Main Logger class providing structured logging capabilities
 */
export class Logger {
  private logger: winston.Logger;
  private module: string;
  private metrics: MetricTracker;
  private sampling: boolean;

  constructor(module: string, options: LoggerOptions = {}) {
    this.module = module;
    this.sampling = options.sampling || false;
    this.logger = createLogger(module, options);
    this.metrics = {
      startTime: Date.now(),
      measurements: new Map(),
    };
  }

  /**
   * Logs error messages with stack traces and context
   */
  error(message: string, error?: Error, context: object = {}): void {
    const logEntry = {
      message,
      module: this.module,
      correlationId: context['correlationId'],
      stack: error?.stack,
      ...sanitizeLogData(context),
    };

    this.logger.error(formatLogMessage(logEntry as winston.LogEntry));
  }

  /**
   * Logs warning messages
   */
  warn(message: string, context: object = {}): void {
    const logEntry = {
      message,
      module: this.module,
      correlationId: context['correlationId'],
      ...sanitizeLogData(context),
    };

    this.logger.warn(formatLogMessage(logEntry as winston.LogEntry));
  }

  /**
   * Logs informational messages
   */
  info(message: string, context: object = {}): void {
    if (this.sampling && Math.random() > 0.1) return;

    const logEntry = {
      message,
      module: this.module,
      correlationId: context['correlationId'],
      ...sanitizeLogData(context),
    };

    this.logger.info(formatLogMessage(logEntry as winston.LogEntry));
  }

  /**
   * Logs performance metrics with threshold checking
   */
  performance(metric: string, value: number, context: object = {}): void {
    const measurements = this.metrics.measurements.get(metric) || [];
    measurements.push(value);
    this.metrics.measurements.set(metric, measurements);

    if (metric === 'latency' && value > PERFORMANCE_THRESHOLDS.latency) {
      this.warn(`High latency detected: ${value}ms`, { metric, threshold: PERFORMANCE_THRESHOLDS.latency });
    }

    const logEntry = {
      message: `Performance metric: ${metric}`,
      module: this.module,
      correlationId: context['correlationId'],
      value,
      threshold: PERFORMANCE_THRESHOLDS[metric as keyof typeof PERFORMANCE_THRESHOLDS],
      ...sanitizeLogData(context),
    };

    this.logger.log('performance', formatLogMessage(logEntry as winston.LogEntry));
  }

  /**
   * Logs debug messages
   */
  debug(message: string, context: object = {}): void {
    if (process.env.NODE_ENV === ENVIRONMENT.PRODUCTION) return;

    const logEntry = {
      message,
      module: this.module,
      correlationId: context['correlationId'],
      ...sanitizeLogData(context),
    };

    this.logger.debug(formatLogMessage(logEntry as winston.LogEntry));
  }
}

export const createLoggerInstance = (module: string, options?: LoggerOptions): Logger => {
  return new Logger(module, options);
};