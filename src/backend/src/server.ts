/**
 * @fileoverview Entry point for the smart-apparel backend server
 * Implements high-availability server initialization with comprehensive error handling,
 * performance monitoring, and graceful shutdown capabilities.
 * @version 1.0.0
 */

import 'dotenv/config'; // v16.3.1
import { app } from './app';
import { Logger } from './utils/logger.util';
import { createServer, Server } from 'http';
import {
  PERFORMANCE_THRESHOLDS,
  SYSTEM_TIMEOUTS,
  CURRENT_ENV
} from './constants/system.constants';

// Initialize logger for server module
const logger = new Logger('server', {
  performanceTracking: true,
  elasticsearchConfig: {
    node: process.env.ELASTICSEARCH_URL,
    index: 'smart-apparel-logs'
  }
});

// Global state tracking
let isShuttingDown = false;
let httpServer: Server;

/**
 * Enhanced handler for uncaught exceptions
 * @param error - The uncaught error
 */
const handleUncaughtException = (error: Error): void => {
  logger.error('Uncaught Exception', error, {
    type: 'UNCAUGHT_EXCEPTION',
    timestamp: new Date().toISOString()
  });

  logger.performance('error_count', 1, {
    type: 'UNCAUGHT_EXCEPTION',
    impact: 'critical'
  });

  // Attempt graceful shutdown
  gracefulShutdown()
    .catch(shutdownError => {
      logger.error('Shutdown failed after uncaught exception', shutdownError);
      process.exit(1);
    });
};

/**
 * Enhanced handler for unhandled promise rejections
 * @param reason - The rejection reason
 */
const handleUnhandledRejection = (reason: any): void => {
  logger.error('Unhandled Promise Rejection', reason instanceof Error ? reason : new Error(String(reason)), {
    type: 'UNHANDLED_REJECTION',
    timestamp: new Date().toISOString()
  });

  logger.performance('error_count', 1, {
    type: 'UNHANDLED_REJECTION',
    impact: 'high'
  });

  if (reason instanceof Error && reason.message.includes('FATAL')) {
    gracefulShutdown()
      .catch(shutdownError => {
        logger.error('Shutdown failed after unhandled rejection', shutdownError);
        process.exit(1);
      });
  }
};

/**
 * Comprehensive graceful shutdown procedure
 * @returns Promise<void>
 */
const gracefulShutdown = async (): Promise<void> => {
  if (isShuttingDown) {
    logger.info('Shutdown already in progress');
    return;
  }

  isShuttingDown = true;
  logger.info('Starting graceful shutdown');

  const shutdownTimeout = setTimeout(() => {
    logger.error('Shutdown timed out, forcing exit');
    process.exit(1);
  }, SYSTEM_TIMEOUTS.API_REQUEST_MS);

  try {
    // Stop accepting new connections
    if (httpServer) {
      await new Promise<void>((resolve) => {
        httpServer.close(() => {
          logger.info('HTTP server closed');
          resolve();
        });
      });
    }

    // Log final performance metrics
    logger.performance('shutdown_time', Date.now(), {
      status: 'completed',
      type: 'graceful'
    });

    clearTimeout(shutdownTimeout);
    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown', error instanceof Error ? error : new Error(String(error)));
    clearTimeout(shutdownTimeout);
    process.exit(1);
  }
};

/**
 * Initialize and start server with comprehensive monitoring
 * @returns Promise<void>
 */
const startServer = async (): Promise<void> => {
  try {
    // Create HTTP server
    httpServer = createServer(app);

    // Track server startup time
    const startTime = Date.now();

    // Start listening
    const port = process.env.PORT || 3000;
    httpServer.listen(port, () => {
      const startupTime = Date.now() - startTime;
      logger.info(`Server started on port ${port}`, {
        environment: CURRENT_ENV,
        startupTime,
        port
      });

      logger.performance('startup_time', startupTime, {
        threshold: PERFORMANCE_THRESHOLDS.MAX_LATENCY_MS
      });
    });

    // Server error handling
    httpServer.on('error', (error: Error) => {
      logger.error('Server error', error, {
        type: 'SERVER_ERROR',
        timestamp: new Date().toISOString()
      });
    });

    // Track connection metrics
    httpServer.on('connection', (socket) => {
      if (!isShuttingDown) {
        socket.setKeepAlive(true);
        socket.setTimeout(SYSTEM_TIMEOUTS.API_REQUEST_MS);
      }
    });

  } catch (error) {
    logger.error('Failed to start server', error instanceof Error ? error : new Error(String(error)));
    process.exit(1);
  }
};

// Register enhanced error handlers
process.on('uncaughtException', handleUncaughtException);
process.on('unhandledRejection', handleUnhandledRejection);

// Register shutdown handlers
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
  startServer().catch((error) => {
    logger.error('Server startup failed', error instanceof Error ? error : new Error(String(error)));
    process.exit(1);
  });
}

// Export server instance for testing
export { httpServer };