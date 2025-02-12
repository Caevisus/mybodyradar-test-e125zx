import { Router } from 'express'; // ^4.18.2
import { HealthController } from '../controllers/health.controller';
import requestLogger from '../middlewares/logging.middleware';
import rateLimit from 'express-rate-limit'; // ^7.1.0
import helmet from 'helmet'; // ^7.0.0
import { PERFORMANCE_THRESHOLDS, SYSTEM_TIMEOUTS } from '../../../constants/system.constants';

/**
 * Configure and return Express router with comprehensive health check endpoints
 * Implements Prometheus-compatible metrics with detailed status reporting
 */
const configureHealthRoutes = (): Router => {
  const router = Router({ strict: true });
  const healthController = new HealthController();

  // Apply security middleware
  router.use(helmet({
    hidePoweredBy: true,
    hsts: true,
    noSniff: true,
    referrerPolicy: { policy: 'same-origin' }
  }));

  // Configure rate limiting for health endpoints
  const healthRateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute window
    max: 60, // 60 requests per minute
    message: 'Too many health check requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false
  });

  // Apply request logging with correlation IDs
  router.use(requestLogger);

  // Configure timeout for health check routes
  router.use((req, res, next) => {
    res.setTimeout(SYSTEM_TIMEOUTS.API_REQUEST_MS, () => {
      res.status(503).json({
        status: 'error',
        message: 'Health check timeout exceeded',
        timestamp: new Date().toISOString()
      });
    });
    next();
  });

  // Overall system health check endpoint
  router.get('/health',
    healthRateLimiter,
    async (req, res, next) => {
      try {
        const startTime = process.hrtime();
        const response = await healthController.checkHealth(req, res);
        const [seconds, nanoseconds] = process.hrtime(startTime);
        const duration = (seconds * 1000) + (nanoseconds / 1000000);

        // Check if response time meets SLA
        if (duration > PERFORMANCE_THRESHOLDS.MAX_LATENCY_MS) {
          res.set('X-Performance-Alert', 'true');
        }

        return response;
      } catch (error) {
        next(error);
      }
    }
  );

  // Database health check endpoint
  router.get('/health/database',
    healthRateLimiter,
    async (req, res, next) => {
      try {
        const startTime = process.hrtime();
        const response = await healthController.checkDatabaseHealth(req, res);
        const [seconds, nanoseconds] = process.hrtime(startTime);
        const duration = (seconds * 1000) + (nanoseconds / 1000000);

        if (duration > PERFORMANCE_THRESHOLDS.MAX_LATENCY_MS) {
          res.set('X-Performance-Alert', 'true');
        }

        return response;
      } catch (error) {
        next(error);
      }
    }
  );

  // Sensor system health check endpoint
  router.get('/health/sensors',
    healthRateLimiter,
    async (req, res, next) => {
      try {
        const startTime = process.hrtime();
        const response = await healthController.checkSensorSystemHealth(req, res);
        const [seconds, nanoseconds] = process.hrtime(startTime);
        const duration = (seconds * 1000) + (nanoseconds / 1000000);

        if (duration > PERFORMANCE_THRESHOLDS.MAX_LATENCY_MS) {
          res.set('X-Performance-Alert', 'true');
        }

        return response;
      } catch (error) {
        next(error);
      }
    }
  );

  // Error handling middleware for health routes
  router.use((error: Error, req: any, res: any, next: any) => {
    res.status(500).json({
      status: 'error',
      message: 'Health check failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  });

  return router;
};

// Export configured health check router
export const healthRouter = configureHealthRoutes();