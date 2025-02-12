/**
 * @fileoverview Main application entry point for the smart-apparel system
 * Implements enterprise-grade security, HIPAA compliance, and high-performance
 * event processing for real-time sensor data.
 * @version 1.0.0
 */

import express, { Express, Request, Response, NextFunction } from 'express'; // v4.18.2
import helmet from 'helmet'; // v7.0.0
import compression from 'compression'; // v1.7.4
import cors from 'cors'; // v2.8.5
import rateLimit from 'express-rate-limit'; // v7.1.0
import { Server } from 'ws'; // v8.14.2
import { Kafka } from 'kafkajs'; // v2.2.4
import prometheus from 'prom-client'; // v14.2.0
import winston from 'winston'; // v3.10.0
import { createMongoConnection } from './config/database.config';
import { securityConfig } from './config/security.config';
import { 
  CURRENT_ENV, 
  PERFORMANCE_THRESHOLDS, 
  SYSTEM_TIMEOUTS 
} from './constants/system.constants';

// Initialize Prometheus metrics
const metrics = new prometheus.Registry();
const httpRequestDurationMs = new prometheus.Histogram({
  name: 'http_request_duration_ms',
  help: 'Duration of HTTP requests in ms',
  buckets: [50, 100, 200, 400, 800, 1600, 3200],
});
metrics.registerMetric(httpRequestDurationMs);

// Configure Winston logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'smart-apparel' },
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

if (CURRENT_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

// Initialize Express application
const app: Express = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: securityConfig.tls.csp
  },
  hsts: securityConfig.tls.hsts
}));

// CORS configuration with HIPAA compliance
app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400
}));

// Performance optimization middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    httpRequestDurationMs.observe(duration);
    logger.info('Request processed', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration
    });
  });
  next();
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: CURRENT_ENV,
    version: process.env.APP_VERSION
  });
});

// Metrics endpoint for Prometheus
app.get('/metrics', async (req: Request, res: Response) => {
  try {
    res.set('Content-Type', prometheus.register.contentType);
    res.end(await prometheus.register.metrics());
  } catch (err) {
    res.status(500).end(err);
  }
});

// Initialize WebSocket server for real-time data
const wsServer = new Server({ noServer: true });

wsServer.on('connection', (socket) => {
  socket.on('message', (message) => {
    // Handle real-time sensor data
    try {
      const data = JSON.parse(message.toString());
      // Process and validate sensor data
      // Emit to Kafka for processing
    } catch (error) {
      logger.error('WebSocket message error', { error });
    }
  });
});

// Initialize Kafka client
const kafka = new Kafka({
  clientId: 'smart-apparel',
  brokers: process.env.KAFKA_BROKERS?.split(',') || [],
  ssl: CURRENT_ENV === 'production',
  sasl: CURRENT_ENV === 'production' ? {
    mechanism: 'plain',
    username: process.env.KAFKA_USERNAME!,
    password: process.env.KAFKA_PASSWORD!
  } : undefined,
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error', { error: err });
  res.status(500).json({
    error: CURRENT_ENV === 'production' ? 'Internal server error' : err.message
  });
});

// Initialize database connection
async function initializeApp() {
  try {
    await createMongoConnection(CURRENT_ENV);
    const producer = kafka.producer();
    await producer.connect();

    const server = app.listen(process.env.PORT || 3000, () => {
      logger.info('Server started', {
        port: process.env.PORT || 3000,
        environment: CURRENT_ENV
      });
    });

    server.on('upgrade', (request, socket, head) => {
      wsServer.handleUpgrade(request, socket, head, (socket) => {
        wsServer.emit('connection', socket, request);
      });
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully');
      await producer.disconnect();
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });

  } catch (error) {
    logger.error('Failed to initialize application', { error });
    process.exit(1);
  }
}

// Export for testing
export { app, metrics, logger };

// Start the application
if (require.main === module) {
  initializeApp();
}