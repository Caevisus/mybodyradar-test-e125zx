/**
 * @fileoverview Entry point for the smart-apparel web application
 * Implements React 18 concurrent rendering with comprehensive error handling,
 * performance monitoring, and browser compatibility checks.
 * @version 1.0.0
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import * as Sentry from '@sentry/react';
import App from './App';
import { store } from './store';

// Initialize Sentry for error monitoring
const initializeMonitoring = (): void => {
  if (process.env.NODE_ENV === 'production') {
    Sentry.init({
      dsn: process.env.VITE_SENTRY_DSN,
      environment: process.env.NODE_ENV,
      tracesSampleRate: 1.0,
      integrations: [
        new Sentry.BrowserTracing({
          tracePropagationTargets: ['localhost', process.env.VITE_API_URL],
        }),
      ],
      beforeSend(event) {
        // Sanitize sensitive data
        if (event.request) {
          delete event.request.cookies;
          delete event.request.headers;
        }
        return event;
      },
    });

    // Initialize performance monitoring
    Sentry.setTag('app.version', '1.0.0');
    Sentry.configureScope(scope => {
      scope.setTag('app.name', 'smart-apparel');
    });
  }
};

// Check browser compatibility
const checkBrowserCompatibility = (): boolean => {
  const requirements = {
    webgl: (): boolean => {
      const canvas = document.createElement('canvas');
      return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
    },
    webSocket: (): boolean => 'WebSocket' in window,
    localStorage: (): boolean => {
      try {
        localStorage.setItem('test', 'test');
        localStorage.removeItem('test');
        return true;
      } catch (e) {
        return false;
      }
    },
    performance: (): boolean => 'performance' in window,
    worker: (): boolean => 'Worker' in window,
  };

  const compatibilityResults = Object.entries(requirements).map(([feature, test]) => {
    const isSupported = test();
    if (!isSupported) {
      console.error(`Browser compatibility check failed: ${feature} not supported`);
    }
    return isSupported;
  });

  return compatibilityResults.every(result => result);
};

// Render application with error boundary and performance monitoring
const renderApp = (): void => {
  const rootElement = document.getElementById('root');
  
  if (!rootElement) {
    throw new Error('Root element not found');
  }

  // Initialize monitoring in production
  initializeMonitoring();

  // Check browser compatibility
  if (!checkBrowserCompatibility()) {
    rootElement.innerHTML = `
      <div role="alert">
        <h1>Browser Not Supported</h1>
        <p>Please use a modern browser with WebGL and WebSocket support.</p>
      </div>
    `;
    return;
  }

  // Create React 18 concurrent root
  const root = createRoot(rootElement);

  // Enable React profiler in development
  const AppWithProfiler = process.env.NODE_ENV === 'development' ? (
    <React.Profiler id="App" onRender={(id, phase, actualDuration) => {
      if (actualDuration > 16.67) { // 60fps threshold
        console.warn(`Slow render detected in ${id} during ${phase}: ${actualDuration}ms`);
      }
    }}>
      <App />
    </React.Profiler>
  ) : (
    <App />
  );

  // Render application with providers and error boundary
  root.render(
    <React.StrictMode>
      <Sentry.ErrorBoundary
        fallback={({ error }) => (
          <div role="alert">
            <h1>Application Error</h1>
            <p>An error occurred while loading the application.</p>
            {process.env.NODE_ENV === 'development' && (
              <pre>{error.message}</pre>
            )}
          </div>
        )}
        showDialog={process.env.NODE_ENV === 'production'}
      >
        <Provider store={store}>
          {AppWithProfiler}
        </Provider>
      </Sentry.ErrorBoundary>
    </React.StrictMode>
  );
};

// Initialize application
try {
  renderApp();
} catch (error) {
  console.error('Application initialization failed:', error);
  if (process.env.NODE_ENV === 'production') {
    Sentry.captureException(error);
  }
}