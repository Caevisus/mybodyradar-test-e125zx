import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import now from 'performance-now';
import { Logger } from '../../../utils/logger.util';
import { ENVIRONMENT } from '../../../constants/system.constants';

/**
 * Error codes for different types of errors in the system
 */
export enum ErrorCodes {
  VALIDATION_ERROR = 'ERR_VALIDATION',
  AUTHENTICATION_ERROR = 'ERR_AUTH',
  AUTHORIZATION_ERROR = 'ERR_FORBIDDEN',
  NOT_FOUND_ERROR = 'ERR_NOT_FOUND',
  INTERNAL_ERROR = 'ERR_INTERNAL',
  RATE_LIMIT_ERROR = 'ERR_RATE_LIMIT',
  DATA_ERROR = 'ERR_DATA',
  INTEGRATION_ERROR = 'ERR_INTEGRATION'
}

/**
 * Custom HTTP Error class with enhanced error details
 */
export class HttpError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: string;
  public readonly correlationId: string;
  public readonly details: any;
  public readonly timestamp: Date;

  constructor(
    statusCode: number,
    message: string,
    errorCode: ErrorCodes,
    details?: any
  ) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.correlationId = Math.random().toString(36).substring(2, 15);
    this.timestamp = new Date();
    this.details = details;
    Error.captureStackTrace(this, HttpError);
  }

  /**
   * Converts error to JSON format with environment-specific details
   */
  toJSON(isProduction: boolean = false): object {
    const baseError = {
      errorCode: this.errorCode,
      message: this.message,
      correlationId: this.correlationId,
      timestamp: this.timestamp.toISOString()
    };

    if (!isProduction) {
      return {
        ...baseError,
        details: this.details,
        stack: this.stack
      };
    }

    return baseError;
  }
}

// Initialize logger for error middleware
const logger = new Logger('ErrorMiddleware');

/**
 * Formats error response based on environment and error type
 */
const formatErrorResponse = (
  error: Error | HttpError,
  isProduction: boolean,
  correlationId: string
): object => {
  if (error instanceof HttpError) {
    return error.toJSON(isProduction);
  }

  // Handle non-HTTP errors
  const baseError = {
    errorCode: ErrorCodes.INTERNAL_ERROR,
    message: isProduction ? 'Internal Server Error' : error.message,
    correlationId,
    timestamp: new Date().toISOString()
  };

  if (!isProduction) {
    return {
      ...baseError,
      stack: error.stack
    };
  }

  return baseError;
};

/**
 * Central error handling middleware for Express application
 */
export const errorHandler = (
  error: Error | HttpError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const startTime = now();
  const correlationId = req.headers['x-correlation-id'] as string || 
    Math.random().toString(36).substring(2, 15);

  // Determine environment
  const isProduction = process.env.NODE_ENV === ENVIRONMENT.PRODUCTION;

  // Log error with appropriate severity
  if (error instanceof HttpError) {
    logger.warn('HTTP Error occurred', {
      correlationId,
      statusCode: error.statusCode,
      errorCode: error.errorCode,
      path: req.path,
      method: req.method,
      error: error.toJSON(isProduction)
    });
  } else {
    logger.error('Unhandled error occurred', error, {
      correlationId,
      path: req.path,
      method: req.method
    });
  }

  // Format response
  const statusCode = (error instanceof HttpError) ? 
    error.statusCode : StatusCodes.INTERNAL_SERVER_ERROR;
  
  const formattedResponse = formatErrorResponse(
    error,
    isProduction,
    correlationId
  );

  // Track error handling performance
  const processingTime = now() - startTime;
  logger.performance('error_handling_time', processingTime, {
    correlationId,
    statusCode
  });

  // Clean up any resources if needed
  if (req.file) {
    // Clean up uploaded files in case of error
    // Implementation depends on file upload middleware
  }

  // Send response
  res
    .status(statusCode)
    .set('X-Correlation-ID', correlationId)
    .json(formattedResponse);
};

export default errorHandler;