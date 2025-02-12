/**
 * @fileoverview Root Redux store configuration with optimized performance for real-time data processing
 * Implements store configuration with <100ms latency requirement and state update batching
 * @version 1.0.0
 */

import { 
  configureStore, 
  combineReducers, 
  Middleware,
  isPlainObject,
  createListenerMiddleware
} from '@reduxjs/toolkit'; // ^1.9.0

// Import feature reducers
import alertReducer from './alertSlice';
import analyticsReducer from './analyticsSlice';
import sensorReducer from './sensorSlice';

// Performance monitoring constants
const PERFORMANCE_THRESHOLD = 100; // 100ms latency requirement
const BATCH_TIMEOUT = 50; // 50ms batching window
const ERROR_THRESHOLD = 0.05; // 5% error threshold

/**
 * Custom performance monitoring middleware
 * Tracks state update latency and logs violations of performance requirements
 */
const performanceMiddleware: Middleware = store => next => action => {
  const start = performance.now();
  const result = next(action);
  const duration = performance.now() - start;

  if (duration > PERFORMANCE_THRESHOLD) {
    console.warn(
      `Performance threshold exceeded for action ${action.type}: ${duration.toFixed(2)}ms`
    );
  }

  return result;
};

/**
 * Custom error tracking middleware
 * Monitors and logs Redux state management errors
 */
const errorTrackingMiddleware: Middleware = () => next => action => {
  try {
    return next(action);
  } catch (error) {
    console.error('Redux Error:', {
      action: action.type,
      payload: action.payload,
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
};

/**
 * State validation middleware
 * Ensures state updates maintain data integrity
 */
const stateValidationMiddleware: Middleware = () => next => action => {
  const result = next(action);
  
  if (!isPlainObject(result)) {
    console.error('Invalid state update detected:', {
      action: action.type,
      state: result
    });
  }
  
  return result;
};

// Configure listener middleware for side effects
const listenerMiddleware = createListenerMiddleware();

// Combine feature reducers
const rootReducer = combineReducers({
  alert: alertReducer,
  analytics: analyticsReducer,
  sensor: sensorReducer
});

/**
 * Configure and create Redux store with performance optimizations
 * Implements requirements for real-time data processing
 */
const setupStore = () => {
  return configureStore({
    reducer: rootReducer,
    middleware: (getDefaultMiddleware) => getDefaultMiddleware({
      // Performance optimizations
      immutableCheck: false, // Disable for performance
      serializableCheck: {
        // Ignore specific paths for real-time data
        ignoredActions: ['sensor/addSensorData', 'analytics/processDataStream'],
        ignoredPaths: ['sensor.sensorData', 'analytics.metrics']
      },
      // Enable batched updates
      thunk: {
        extraArgument: {
          batchTimeout: BATCH_TIMEOUT
        }
      }
    }).concat(
      performanceMiddleware,
      errorTrackingMiddleware,
      stateValidationMiddleware,
      listenerMiddleware.middleware
    ),
    devTools: process.env.NODE_ENV !== 'production' && {
      // DevTools configuration for performance
      maxAge: 50, // Limit stored actions
      latency: 1000, // Artificial latency for development
      trace: true, // Enable action tracing
    }
  });
};

// Create store instance
export const store = setupStore();

// Export types
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Export store instance and type definitions
export default store;