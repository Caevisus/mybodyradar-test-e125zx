import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../../../utils/logger.util';
import { ENVIRONMENT } from '../../../constants/system.constants';

// Initialize logger instance for HTTP requests
const logger = new Logger('HTTP');

// Headers that should be redacted from logs for security
const SENSITIVE_HEADERS = ['authorization', 'cookie', 'x-api-key'];

// Performance threshold in milliseconds (from technical requirements)
const PERFORMANCE_THRESHOLD = 100;

/**
 * Express middleware for HTTP request/response logging with performance tracking
 */
export default function requestLogger(req: Request, res: Response, next: NextFunction): void {
  // Generate unique request ID for correlation
  const requestId = uuidv4();
  
  // Record request start time with high precision
  const startTime = process.hrtime();
  
  // Log incoming request details
  logger.info('Incoming request', formatRequestLog(req, requestId));
  
  // Add correlation ID to response headers
  res.setHeader('X-Request-ID', requestId);
  
  // Override response.end to capture response timing and details
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: string | undefined, callback?: (() => void) | undefined): Response {
    // Calculate request duration in milliseconds with nanosecond precision
    const [seconds, nanoseconds] = process.hrtime(startTime);
    const duration = (seconds * 1000) + (nanoseconds / 1000000);
    
    // Log response with timing information
    const responseLog = formatResponseLog(res, requestId, duration);
    logger.info('Outgoing response', responseLog);
    
    // Track performance metrics
    logger.performance('request_duration', duration, { 
      path: req.path,
      method: req.method,
      correlationId: requestId 
    });
    
    // Emit warning if response time exceeds threshold
    if (duration > PERFORMANCE_THRESHOLD) {
      logger.warn('Request exceeded performance threshold', {
        duration,
        threshold: PERFORMANCE_THRESHOLD,
        path: req.path,
        method: req.method,
        correlationId: requestId
      });
    }
    
    return originalEnd.call(this, chunk, encoding as BufferEncoding, callback);
  };
  
  next();
}

/**
 * Formats request information into structured log entry
 */
function formatRequestLog(req: Request, requestId: string): object {
  return {
    correlationId: requestId,
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    query: sanitizeHeaders(req.query),
    headers: sanitizeHeaders(req.headers),
    userAgent: req.get('user-agent'),
    ip: req.ip,
    protocol: req.protocol,
    hostname: req.hostname
  };
}

/**
 * Formats response information into structured log entry
 */
function formatResponseLog(res: Response, requestId: string, duration: number): object {
  const logEntry: any = {
    correlationId: requestId,
    timestamp: new Date().toISOString(),
    statusCode: res.statusCode,
    duration: `${duration.toFixed(2)}ms`,
    headers: sanitizeHeaders(res.getHeaders()),
    size: res.get('content-length'),
    performanceAlert: duration > PERFORMANCE_THRESHOLD
  };

  // Include response body sample in development environment
  if (process.env.NODE_ENV === ENVIRONMENT.DEVELOPMENT) {
    // Access response body if available (depends on how response was constructed)
    if ((res as any).body) {
      logEntry.body = JSON.stringify((res as any).body).substring(0, 200);
    }
  }

  return logEntry;
}

/**
 * Filters sensitive information from request/response headers
 */
function sanitizeHeaders(headers: object): object {
  const sanitized = { ...headers };
  
  // Remove sensitive headers
  SENSITIVE_HEADERS.forEach(header => {
    if (header in sanitized) {
      delete sanitized[header];
    }
  });
  
  // Mask any remaining sensitive patterns (e.g., Basic Auth, Bearer tokens)
  Object.keys(sanitized).forEach(key => {
    const value = sanitized[key];
    if (typeof value === 'string' && 
       (value.startsWith('Basic ') || 
        value.startsWith('Bearer ') || 
        value.match(/^[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*$/))) {
      sanitized[key] = '[REDACTED]';
    }
  });
  
  return sanitized;
}